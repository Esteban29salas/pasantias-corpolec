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
    MovimientoKardex
)

class MovimientoKardexSerializer(serializers.ModelSerializer):
    
    class Meta:
        model = MovimientoKardex
        fields = [
            'id', 'numero_documento', 'fecha', 'tipo_movimiento', 
            'destino', 'cantidad_entrada', 'cantidad_salida', 
            'existencias', 'observaciones'
        ]

class MaterialKardexDetailSerializer(serializers.ModelSerializer):
    historial_kardex = MovimientoKardexSerializer(many=True, read_only=True)
    pag_formateado = serializers.SerializerMethodField()
    nombre_material = serializers.ReadOnlyField(source='nombre')  # <-- Mapea directamente desde el campo 'nombre'

    class Meta:
        model = Material
        fields = [
            'codigo', 'nombre', 'nombre_material', 'descripcion', 'unidad_medida', 
            'pag_kardex', 'pag_formateado', 'stock_actual',     
            'historial_kardex'
        ]

    def get_pag_formateado(self, obj):
        if obj.pag_kardex is not None:
            return f"PAG-{obj.pag_kardex:03d}"
        return "PAG-001"  # O puedes retornar None o "" si prefieres dejarlo vacío

class MaterialSerializer(serializers.ModelSerializer):
    stock_actual = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        validators=[validar_stock],
    )

    class Meta:
        model = Material
        fields = '__all__'

    def validate_unidad_medida(self, value):
        return validar_unidad_medida(value)

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
    # Se declara como ReadOnlyField relacionando al modelo Material
    unidad_medida = serializers.ReadOnlyField(source='material.unidad_medida')

    class Meta:
        model = DetalleActa
        fields = [
            'id',
            'material',
            'codigo_material',
            'nombre_material',
            'cantidad',
            'unidad_medida',  # Agregado
            'estado',
            'observaciones',
        ]

    def validate_PZA(self, attrs):
        material = attrs.get('material')
        cantidad = attrs.get('cantidad')

        #si el material es por Pieza, la cantidad debe ser un número entero
        if material and material.unidad_medida == 'PZA':
            if cantidad % 1 != 0:
                raise serializers.ValidationError(
                    "La cantidad debe ser un número entero para materiales con unidad de medida 'PZA'."
                )
        return attrs

class ActaEntradaSerializer(serializers.ModelSerializer):
    origen = serializers.CharField(required=False, allow_blank=True, default='')
    detalles = DetalleActaSerializer(many=True, required=False)
    class Meta:
        model = ActaEntrada
        fields = ['id', 'numero_acta', 'ceco', 'fecha_recepcion', 'origen', 'observaciones', 'entregado_por', 'recibido_por', 'detalles']

    # 👇 Validación estricta para números entre 1 y 9999
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
        #valida que la lista de materiales no llegue vacia
        if not value or len (value) == 0:
            raise serializers.ValidationError("Debe incluir al menos un material en la carta de retiro.")
        return value
    
    def create(self, validated_data):
        #extrae los detalles del diccionario
        detalles_data = validated_data.pop('detalles')
        # genera numero correlativo automatico (ej: ACTA-0001, ACTA-0002, etc.)
        ultimo_id = ActaEntrada.objects.aggregate(Max('id'))['id__max'] or 0
        siguiente_num = f"ACTA-{(ultimo_id + 1):06d}"

        validated_data['numero_acta']= siguiente_num
        #crea el registro cabecera
        acta_entrada = ActaEntrada.objects.create(**validated_data)
        #asocia y crea los intems en DetalleRetiro
        for detalle in detalles_data:
            DetalleActa.objects.create(acta=acta_entrada, **detalle)
        return acta_entrada

class DetalleRetiroSerializer(serializers.ModelSerializer):
    nombre_material = serializers.ReadOnlyField(source='material.nombre')
    codigo_material = serializers.ReadOnlyField(source='material.codigo')
    estado = serializers.ReadOnlyField(source='estado_devolucion.nombre')
    
    # 👇 1. Declarar el campo explícitamente aquí
    cantidad_devuelta = serializers.SerializerMethodField()

    class Meta:
        model = DetalleRetiro
        fields = '__all__'
        read_only_fields = ['carta_retiro']
        extra_kwargs = {
            'cantidad_devuelta': {'required': False, 'allow_null': True},
            'estado': {'required': False, 'allow_null': True},
            'observacion_devolucion': {'required': False, 'allow_null': True},
        }

    def validate(self, data):
        cantidad_retirada = data.get('cantidad', getattr(self.instance, 'cantidad', 0))
        cantidad_devuelta = data.get('cantidad_devuelta', getattr(self.instance, 'cantidad_devuelta', 0))
        if cantidad_devuelta and cantidad_devuelta > cantidad_retirada:
            raise serializers.ValidationError({
                "cantidad_devuelta": "La cantidad devuelta no puede ser mayor a la cantidad retirada."
            })
        return data

    # 👇 2. El método que calcula el valor para ese SerializerMethodField
    def get_cantidad_devuelta(self, obj):
        if not obj.pk or not obj.carta_retiro_id or not obj.material_id:
            return 0
            
        total = DetalleDevolucion.objects.filter(
            carta_devolucion__carta_retiro=obj.carta_retiro,
            material=obj.material
        ).aggregate(total=models.Sum('cantidad'))['total']
        
        return total or 0
            
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

    def to_internal_value(self, data):
            # Copiamos la data enviada por React y descartamos variables visuales
            data_clean = data.copy() if hasattr(data, 'copy') else dict(data)
            campos_visuales = ['ceco', 'ceco_codigo', 'ceco_nombre', 'estructura', 'unidad_tecnica']
            for campo in campos_visuales:
                data_clean.pop(campo, None)
            return super().to_internal_value(data_clean)
    
    class Meta:
        model = CartaRetiro
        fields = '__all__'

    def create(self, validated_data):
        detalles_data = validated_data.pop('RD', validated_data.pop('detalles',[]))
        carta = CartaRetiro.objects.create(**validated_data)

        #crea automaticamente cada reglon de material asociado a esta carta
        for detalle in detalles_data:
            DetalleRetiro.objects.create(carta_retiro=carta, **detalle)

        return carta

class DetalleDevolucionSerializer(serializers.ModelSerializer):
    class Meta:
        model = DetalleDevolucion
        fields = '__all__'
        read_only_fields = ['carta_devolucion']

class CartaDevolucionSerializer(serializers.ModelSerializer):
    detalles = DetalleDevolucionSerializer(many=True)

    class Meta:
        model = CartaDevolucion
        fields = '__all__'

    def validate(self, data):
        carta_retiro = data.get('carta_retiro')
        detalles_nuevos = data.get('detalles', [])

        # Consultamos todas las devoluciones anteriores hechas a esta misma carta de retiro
        devoluciones_previas = DetalleDevolucion.objects.filter(carta_devolucion__carta_retiro=carta_retiro)
        
        # Mapeamos cuánto se ha devuelto históricamente por cada material en esta carta
        acumulado_devuelto = {}
        for dev in devoluciones_previas:
            mat_id = dev.material.codigo
            acumulado_devuelto[mat_id] = acumulado_devuelto.get(mat_id, 0) + dev.cantidad

        # Validamos cada ítem que se quiere reingresar
        for detalle in detalles_nuevos:
            material = detalle.get('material')
            cantidad_a_devolver = detalle.get('cantidad', 0)
            
            if not material:
                continue

            # Buscamos cuánto se despachó originalmente en la Carta de Retiro
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
                material_obj.stock_actual += cantidad
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
        """
        Validar que no exista un cierre anual para el mismo año.
        """
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
        