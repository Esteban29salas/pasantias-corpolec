from rest_framework import serializers
from django.db.models import Max
from django.db import models
from datetime import timedelta
from .validators import (
    validar_personal_duplicado,
    validar_unidad_medida,
    validar_stock,
)
from .models import (
    Material, Personal, CierreAnual, DetalleCierreAnual,
    ActaEntrada, DetalleActa,
    CartaRetiro, DetalleRetiro,
    CartaDevolucion, DetalleDevolucion, 
    MovimientoKardex, Usuario,
    SolicitudLiberacion, HistorialLiberaciones
)

class UsuarioSerializer(serializers.ModelSerializer):
    class Meta:
        model = Usuario
        fields = ['id', 'cedula', 'nombres', 'apellidos', 
                  'fecha_nacimiento', 'cargo', 'email', 'password', 'rol', 'fecha_registro']
        extra_kwargs = {
            'password': {'write_only': True},
            'fecha_registro': {'read_only': True}
        }
    
    def create(self, validated_data):
        return Usuario.objects.create(**validated_data)


class MovimientoKardexSerializer(serializers.ModelSerializer):
    class Meta:
        model = MovimientoKardex
        fields = [
            'id', 'numero_documento', 'fecha', 'tipo_movimiento', 
            'destino', 'proyecto', 'cantidad_entrada', 'cantidad_salida', 
            'existencias', 'observaciones'
        ]

class MaterialKardexDetailSerializer(serializers.ModelSerializer):
    historial_kardex = MovimientoKardexSerializer(many=True, read_only=True)
    pag_formateado = serializers.SerializerMethodField()
    nombre_material = serializers.ReadOnlyField(source='nombre')

    class Meta:
        model = Material
        fields = [
            'codigo', 'nombre', 'nombre_material', 'descripcion', 'unidad_medida', 
            'pag_kardex', 'pag_formateado', 'stock_actual',
            'stock_mantenimiento', 'stock_obra', 'proyecto_obra', 'stock_total',
            'historial_kardex'
        ]

    def get_pag_formateado(self, obj):
        if obj.pag_kardex is not None:
            return f"PAG-{obj.pag_kardex:03d}"
        return "PAG-001"

class MaterialSerializer(serializers.ModelSerializer):
    stock_actual = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        required=False,
        default=0,
        validators=[validar_stock],
    )
    stock_mantenimiento = serializers.DecimalField(
        max_digits=12, decimal_places=2, required=False,
        validators=[validar_stock],
    )
    stock_obra = serializers.DecimalField(
        max_digits=12, decimal_places=2, required=False,
        validators=[validar_stock],
    )
    stock_total = serializers.SerializerMethodField()

    class Meta:
        model = Material
        fields = [
            'codigo', 'nombre', 'descripcion', 'unidad_medida',
            'stock_actual', 'stock_mantenimiento', 'stock_obra', 'proyecto_obra', 'stock_total',
            'pag_kardex', 'fecha_ingreso',
        ]
        read_only_fields = ['pag_kardex']
        extra_kwargs = {
            'nombre': {'required': True, 'allow_blank': False},
            'descripcion': {
                'required': True,
                'allow_blank': False,
                'allow_null': False,
            },
        }

    def get_stock_total(self, obj):
        return (obj.stock_mantenimiento or 0) + (obj.stock_obra or 0)

    def validate_nombre(self, value):
        nombre = str(value).strip()
        if not nombre:
            raise serializers.ValidationError("El nombre del material es requerido.")
        return nombre

    def validate_descripcion(self, value):
        descripcion = str(value).strip()
        if not descripcion:
            raise serializers.ValidationError("La descripción del material es requerida.")
        return descripcion

    def validate(self, attrs):
        stock_obra_definido = 'stock_obra' in attrs
        stock_obra = attrs.get('stock_obra', 0)
        proyecto_obra = attrs.get(
            'proyecto_obra',
            getattr(self.instance, 'proyecto_obra', '') if self.instance else '',
        )

        if (
            stock_obra_definido
            and stock_obra
            and stock_obra > 0
            and not str(proyecto_obra or '').strip()
        ):
            raise serializers.ValidationError({
                'proyecto_obra': (
                    'Indique el proyecto o calle de destino cuando el stock de Obra es mayor a 0.'
                )
            })

        return attrs

    def validate_unidad_medida(self, value):
        return validar_unidad_medida(value)

    def _sincronizar_stock(self, validated_data, instance=None):
        mantenimiento = validated_data.get(
            'stock_mantenimiento',
            getattr(instance, 'stock_mantenimiento', None),
        )
        obra = validated_data.get(
            'stock_obra',
            getattr(instance, 'stock_obra', None),
        )
        total_actual = validated_data.get(
            'stock_actual',
            getattr(instance, 'stock_actual', 0),
        )

        if mantenimiento is None and obra is None:
            mantenimiento = total_actual or 0
            obra = 0
        else:
            mantenimiento = mantenimiento if mantenimiento is not None else 0
            obra = obra if obra is not None else 0

        validated_data['stock_mantenimiento'] = mantenimiento
        validated_data['stock_obra'] = obra
        validated_data['stock_actual'] = (mantenimiento or 0) + (obra or 0)
        if (obra or 0) <= 0:
            validated_data['proyecto_obra'] = ''
        return validated_data

    def create(self, validated_data):
        validated_data = self._sincronizar_stock(validated_data)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data = self._sincronizar_stock(validated_data, instance=instance)
        return super().update(instance, validated_data)

class PersonalSerializer(serializers.ModelSerializer):
    class Meta:
        model = Personal
        fields = '__all__'

    def validate(self, attrs):
        return validar_personal_duplicado(attrs, instance=self.instance, model=Personal)


class DetalleActaSerializer(serializers.ModelSerializer):
    material = serializers.PrimaryKeyRelatedField(queryset=Material.objects.all())
    codigo_material = serializers.ReadOnlyField(source='material.codigo')
    nombre_material = serializers.ReadOnlyField(source='material.nombre')
    unidad_medida = serializers.ReadOnlyField(source='material.unidad_medida')
    observacion = serializers.CharField(required=False, allow_blank=True, write_only=True)

    class Meta:
        model = DetalleActa
        fields = [
            'id',
            'material',
            'codigo_material',
            'nombre_material',
            'cantidad',
            'unidad_medida',
            'estado',
            'observaciones',
            'observacion',
            'destino',
            'proyecto',
        ]

    def validate(self, attrs):
        material = attrs.get('material')
        cantidad = attrs.get('cantidad', 0)
        if material and material.unidad_medida == 'PZA':
            if cantidad % 1 != 0:
                raise serializers.ValidationError(
                    "La cantidad debe ser un número entero para materiales con unidad de medida 'PZA'."
                )
        return attrs


class ActaEntradaSerializer(serializers.ModelSerializer):
    origen = serializers.CharField(required=False, allow_blank=True, default='')
    detalles = DetalleActaSerializer(many=True, required=False, source='actas')

    recibido_por_nombre = serializers.SerializerMethodField()
    entregado_por_nombre = serializers.SerializerMethodField()

    class Meta:
        model = ActaEntrada
        fields = [
            'id', 'numero_acta', 'ceco', 'fecha_recepcion', 'origen', 
            'observaciones', 'entregado_por', 'recibido_por', 
            'recibido_por_nombre', 'entregado_por_nombre', 'detalles'
        ]

    def get_recibido_por_nombre(self, obj):
        if obj.recibido_por:
            return f"{obj.recibido_por.nombre} {obj.recibido_por.apellido}".strip().title()
        return "-"

    def get_entregado_por_nombre(self, obj):
        if obj.entregado_por:
            return f"{obj.entregado_por.nombre} {obj.entregado_por.apellido}".strip().title()
        return "-"

    def validate_numero_acta(self, value):
        val_str = str(value).strip()
        if not val_str.isdigit() or len(val_str) > 4:
            raise serializers.ValidationError(
                "El número de acta solo debe contener números de 1 a 4 dígitos."
            )
        num = int(val_str)
        if num < 1 or num > 9999:
            raise serializers.ValidationError(
                "El número de acta debe estar comprendido entre 1 y 9999."
            )
        return val_str

    def validate_detalles(self, value):
        if not value or len(value) == 0:
            raise serializers.ValidationError("Debe incluir al menos un material en el acta.")
        return value
    
    def create(self, validated_data):
        # 1. Extraemos los detalles limpios que envía el frontend
        detalles_data = validated_data.pop('actas', [])
        
        # 2. Generamos el número de acta automático
        ultimo_id = ActaEntrada.objects.aggregate(Max('id'))['id__max'] or 0
        siguiente_num = f"ACTA-{(ultimo_id + 1):06d}"
        validated_data['numero_acta'] = siguiente_num

        # 3. Creamos la cabecera del acta
        acta_entrada = ActaEntrada.objects.create(**validated_data)
        
        # 4. Agrupamos solo duplicados exactos (material + destino + observación + proyecto),
        # de forma que un mismo material pueda ingresar parte a Mantenimiento y
        # parte a Obra en la misma acta.
        detalles_unicos = {}
        for detalle in detalles_data:
            mat = detalle.get('material')
            destino = detalle.get('destino', 'M') or 'M'
            observacion = detalle.get('observaciones') or detalle.get('observacion') or ''
            proyecto = detalle.get('proyecto') or detalle.get('proyecto_obra') or ''
            if destino == 'O' and not proyecto:
                proyecto = observacion
            if destino != 'O':
                proyecto = ''
            clave = (mat.pk if hasattr(mat, 'pk') else mat, destino, observacion, proyecto)
            cant = detalle.get('cantidad', 0)
            
            if clave in detalles_unicos:
                detalles_unicos[clave]['cantidad'] += cant
            else:
                detalles_unicos[clave] = {
                    'acta': acta_entrada,
                    'material': mat,
                    'cantidad': cant,
                    'estado': detalle.get('estado', 'OPERATIVO'),
                    'observaciones': observacion,
                    'destino': destino,
                    'proyecto': proyecto,
                }

        # Insertamos en la base de datos solo elementos únicos garantizados
        for datos_detalle in detalles_unicos.values():
            DetalleActa.objects.create(**datos_detalle)
            
        return acta_entrada

class DetalleRetiroSerializer(serializers.ModelSerializer):
    descripcion = serializers.ReadOnlyField(source='material.nombre')
    codigo_material = serializers.ReadOnlyField(source='material.codigo')
    nombre_material = serializers.ReadOnlyField(source='material.nombre')
    cantidad_devuelta = serializers.SerializerMethodField()
    observacion = serializers.CharField(required=False, allow_blank=True, write_only=True)

    class Meta:
        model = DetalleRetiro
        fields = '__all__'
        read_only_fields = ['carta_retiro']
        extra_kwargs = {
            'cantidad_devuelta': {'required': False, 'allow_null': True},
        }

    def validate(self, data):
        material = data.get('material', getattr(self.instance, 'material', None))
        cantidad_solicitada = data.get('cantidad_solicitada', data.get('cantidad', 0))
        origen = data.get('origen', getattr(self.instance, 'origen', 'M')) or 'M'

        if material:
            disponible = (
                material.stock_mantenimiento
                if origen == 'M'
                else material.stock_obra
            )
            if cantidad_solicitada > disponible:
                etiqueta = 'Mantenimiento' if origen == 'M' else 'Obra'
                raise serializers.ValidationError({
                    "cantidad": (
                        f"Stock de {etiqueta} insuficiente para {material.nombre}. "
                        f"Disponible: {disponible}, Solicitado: {cantidad_solicitada}"
                    )
                })
        return data

    def get_cantidad_devuelta(self, obj):
        if not obj.pk or not obj.carta_retiro_id or not obj.material_id:
            return 0
            
        total = DetalleDevolucion.objects.filter(
            carta_devolucion__carta_retiro=obj.carta_retiro,
            material=obj.material
        ).aggregate(total=models.Sum('cantidad'))['total']

        return total or 0


class CartaRetiroSerializer(serializers.ModelSerializer):
    codigo_retiro = serializers.ReadOnlyField()
    entregado_por = serializers.SlugRelatedField(slug_field='cedula', queryset=Personal.objects.all())
    retirado_por = serializers.SlugRelatedField(slug_field='cedula', queryset=Personal.objects.all())
    detalles = DetalleRetiroSerializer(many=True, source='RD')

    entregado_por_nombre = serializers.SerializerMethodField()
    retirado_por_nombre = serializers.SerializerMethodField()

    def get_entregado_por_nombre(self, obj):
        if obj.entregado_por:
            return f"{obj.entregado_por.nombre} {obj.entregado_por.apellido}".strip().title()
        return "-"

    def get_retirado_por_nombre(self, obj):
        if obj.retirado_por:
            return f"{obj.retirado_por.nombre} {obj.retirado_por.apellido}".strip().title()
        return "-"

    # Única definición limpia de to_internal_value
    def to_internal_value(self, data):
        data_clean = data.copy() if hasattr(data, 'copy') else dict(data)
        campos_visuales = ['ceco', 'ceco_codigo', 'ceco_nombre', 'estructura', 'unidad_tecnica']
        for campo in campos_visuales:
            data_clean.pop(campo, None)
        return super().to_internal_value(data_clean)
    
    class Meta:
        model = CartaRetiro
        fields = '__all__'

    def create(self, validated_data):
        detalles_data = validated_data.pop('RD', validated_data.pop('detalles', []))
        carta = CartaRetiro.objects.create(**validated_data)

        for detalle in detalles_data:
            detalle.pop('observacion', None)
            if detalle.get('pag') is None:
                detalle['pag'] = ''
            DetalleRetiro.objects.create(carta_retiro=carta, **detalle)

        return carta


class SolicitudLiberacionSerializer(serializers.ModelSerializer):
    material = serializers.PrimaryKeyRelatedField(queryset=Material.objects.all())
    material_codigo = serializers.ReadOnlyField(source='material.codigo')
    material_nombre = serializers.ReadOnlyField(source='material.nombre')
    unidad_medida = serializers.ReadOnlyField(source='material.unidad_medida')
    stock_obra_actual = serializers.SerializerMethodField()
    codigo_retiro = serializers.SerializerMethodField()

    class Meta:
        model = SolicitudLiberacion
        fields = '__all__'
        read_only_fields = [
            'estado', 'fecha_solicitud', 'fecha_resolucion',
            'aprobado_por_id', 'aprobado_por_nombre',
        ]

    def get_stock_obra_actual(self, obj):
        return obj.material.stock_obra

    def get_codigo_retiro(self, obj):
        return obj.carta_retiro.codigo_retiro if obj.carta_retiro else ''


class HistorialLiberacionesSerializer(serializers.ModelSerializer):
    material_codigo = serializers.ReadOnlyField(source='material.codigo')
    material_nombre = serializers.ReadOnlyField(source='material.nombre')
    unidad_medida = serializers.ReadOnlyField(source='material.unidad_medida')

    class Meta:
        model = HistorialLiberaciones
        fields = '__all__'


class DetalleDevolucionSerializer(serializers.ModelSerializer):
    nombre_material = serializers.ReadOnlyField(source='material.nombre')
    codigo_sap = serializers.ReadOnlyField(source='material.codigo')
    unidad_medida = serializers.ReadOnlyField(source='material.unidad_medida')

    class Meta:
        model = DetalleDevolucion
        fields = '__main__' if hasattr(serializers, '__main__') else '__all__'
        read_only_fields = ['carta_devolucion']


class CartaDevolucionSerializer(serializers.ModelSerializer):
    # Mantenemos DetalleDevolucionSerializer para que acepte datos al crear devoluciones
    detalles = DetalleDevolucionSerializer(many=True)
    
    recibido_por_nombre = serializers.SerializerMethodField()
    devuelto_por_nombre = serializers.SerializerMethodField()

    def get_recibido_por_nombre(self, obj):
        if hasattr(obj, 'recibido_por') and obj.recibido_por:
            return f"{obj.recibido_por.nombre} {obj.recibido_por.apellido}".strip().title()
        return "-"

    def get_devuelto_por_nombre(self, obj):
        if hasattr(obj, 'devuelto_por') and obj.devuelto_por:
            return f"{obj.devuelto_por.nombre} {obj.devuelto_por.apellido}".strip().title()
        return "-"

    class Meta:
        model = CartaDevolucion
        fields = '__all__'

    def validate(self, data):
        carta_retiro = data.get('carta_retiro')
        detalles_nuevos = data.get('detalles', [])

        devoluciones_previas = DetalleDevolucion.objects.filter(carta_devolucion__carta_retiro=carta_retiro)
        
        acumulado_devuelto = {}
        for dev in devoluciones_previas:
            mat_id = dev.material.codigo
            acumulado_devuelto[mat_id] = acumulado_devuelto.get(mat_id, 0) + dev.cantidad

        for detalle in detalles_nuevos:
            material = detalle.get('material')
            cantidad_a_devolver = detalle.get('cantidad', 0)
            
            if not material:
                continue

            detalles_retiro = DetalleRetiro.objects.filter(carta_retiro=carta_retiro, material=material)
            total_despachado = sum([d.cantidad for d in detalles_retiro])

            ya_devuelto = acumulado_devuelto.get(material.codigo, 0)
            disponible = total_despachado - ya_devuelto

            if cantidad_a_devolver > disponible:
                raise serializers.ValidationError({
                    "detalles": f"El material {material.nombre} ya tiene {ya_devuelto} unidades devueltas. Solo quedan {disponible} disponibles para devolver."
                })

        return data

    def create(self, validated_data):
        detalles_data = validated_data.pop('detalles', [])
        carta_devolucion = CartaDevolucion.objects.create(**validated_data)
        
        for detalle_data in detalles_data:
            material_obj = detalle_data.get('material')
            cantidad = int(detalle_data.get('cantidad', 0))
            estado = detalle_data.get('estado', 'OPERATIVO')

            DetalleDevolucion.objects.create(
                carta_devolucion=carta_devolucion,
                material=material_obj,
                cantidad=cantidad,
                estado=estado
            )

            if estado == 'OPERATIVO' and material_obj:
                detalle_retiro = DetalleRetiro.objects.filter(
                    carta_retiro=carta_devolucion.carta_retiro,
                    material=material_obj,
                ).first()
                origen = detalle_retiro.origen if detalle_retiro else 'M'

                if origen == 'O':
                    material_obj.stock_obra += cantidad
                else:
                    material_obj.stock_mantenimiento += cantidad

                material_obj.stock_actual = (
                    material_obj.stock_mantenimiento + material_obj.stock_obra
                )
                material_obj.save()

        return carta_devolucion


class DetalleCierreAnualSerializer(serializers.ModelSerializer):
    material_nombre = serializers.ReadOnlyField(source='material.nombre')

    class Meta:
        model = DetalleCierreAnual
        fields = '__all__'


class CierreAnualSerializer(serializers.ModelSerializer):
    detalles = DetalleCierreAnualSerializer(many=True, read_only=True)

    observaciones = serializers.CharField(
        max_length=50,
        required=False,
        allow_blank=True,
        error_messages={
            'max_length':(
                'Las observaciones no pueden exceder los 50 caracteres.'
            )
        },
    )

    class Meta:
        model = CierreAnual
        fields = (
            'id',
            'fecha_inicio',
            'observaciones', 
            'fecha_cierre',
            'detalles',
        )

    def validate(self, data):
        fecha_inicio = data.get('fecha_inicio')
        fecha_cierre = data.get('fecha_cierre')

        if fecha_inicio and fecha_cierre:
            if fecha_inicio == fecha_cierre:
                raise serializers.ValidationError({
                    'fecha_cierre': (
                        'La fecha de cierre no puede ser igual a la fecha de inicio del cierre anual.'
                    )
                })

            d_inicio = (
                fecha_inicio.date()
                if hasattr(fecha_inicio, 'date')
                else fecha_inicio
            )
            d_cierre = (
                fecha_cierre.date()
                if hasattr(fecha_cierre, 'date')
                else fecha_cierre
            )

            if (d_cierre - d_inicio) != timedelta(days=365):
                raise serializers.ValidationError({
                    'fecha_cierre': (
                        'La fecha de cierre debe ser exactamente 365 dias posterios a la fecha de inicio del cierre anual.'
                    )
                })
        return data