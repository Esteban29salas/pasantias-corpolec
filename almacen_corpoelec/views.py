from rest_framework import viewsets, status, filters
import json
import os
import subprocess
from django.http import JsonResponse
from pathlib import Path
from rest_framework.decorators import api_view, action, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.decorators import api_view, action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied, ValidationError
from django.db import transaction
from django.db.models import ProtectedError
from decimal import Decimal
from .utils import generar_excel_kardex
from io import BytesIO
from django.http import HttpResponse
from .models import (
    Material, Personal, CierreAnual, DetalleCierreAnual,
    ActaEntrada, CartaRetiro, CartaDevolucion, DetalleActa, DetalleRetiro, MovimientoKardex, DetalleDevolucion, Usuario,
    SolicitudLiberacion, HistorialLiberaciones
)
from .serializers import (
    CierreAnualSerializer, MaterialSerializer, PersonalSerializer,
    ActaEntradaSerializer, CartaRetiroSerializer, CartaDevolucionSerializer, MaterialKardexDetailSerializer, UsuarioSerializer,
    SolicitudLiberacionSerializer, HistorialLiberacionesSerializer
)
from .permissions import (
    UsuarioTokenAuthentication, EsAdministrador, SoloLecturaOAdmin, CrearOAdminEditar,
    generar_token_usuario
)
from django.utils import timezone

class UsuarioViewSet(viewsets.ModelViewSet):
    queryset = Usuario.objects.all()
    serializer_class = UsuarioSerializer
    authentication_classes = [UsuarioTokenAuthentication]

    def get_permissions(self):
        if self.action in ['login', 'register']:
            return [AllowAny()]
        return [EsAdministrador()]
    
    @action(detail=False, methods=['post'])
    def login(self, request):
        email = request.data.get('email')
        password = request.data.get('password')
        
        if not email or not password:
            return Response({'error': 'Email y contraseña son requeridos'}, 
                          status=status.HTTP_400_BAD_REQUEST)
        
        try:
            usuario = Usuario.objects.get(email=email, password=password)
            serializer = self.get_serializer(usuario)
            data = serializer.data
            data.pop('password', None)
            data['token'] = generar_token_usuario(usuario)
            return Response(data, status=status.HTTP_200_OK)
        except Usuario.DoesNotExist:
            return Response({'error': 'Credenciales incorrectas'}, 
                          status=status.HTTP_401_UNAUTHORIZED)
    
    @action(detail=False, methods=['post'])
    def register(self, request):
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            usuario = serializer.save()
            data = serializer.data
            data.pop('password', None)
            return Response(data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)




class MaterialViewSet(viewsets.ModelViewSet):
    queryset = Material.objects.all().order_by('-fecha_ingreso')
    serializer_class = MaterialSerializer
    authentication_classes = [UsuarioTokenAuthentication]
    permission_classes = [CrearOAdminEditar]
    filter_backends = [filters.SearchFilter]
    search_fields = ['codigo', 'nombre', 'unidad_medida', 'fecha_ingreso']

    @transaction.atomic
    def perform_create(self, serializer):
        # Guarda el nuevo material (el método save asignará el pag_kardex automático)
        material = serializer.save()

        # Si ingresa con stock inicial superior a 0, creamos los movimientos iniciales
        # por cada destino para mantener el Kardex consistente con el desglose.
        if material.stock_mantenimiento > 0:
            MovimientoKardex.objects.create(
                material=material,
                numero_documento="INVENTARIO INICIAL",
                tipo_movimiento="ENTRADA",
                destino="M",
                cantidad_entrada=material.stock_mantenimiento,
                cantidad_salida=0,
                existencias=material.stock_mantenimiento,
                observaciones="Registro inicial de material (Mantenimiento) en el sistema"
            )

        if material.stock_obra > 0:
            MovimientoKardex.objects.create(
                material=material,
                numero_documento="INVENTARIO INICIAL",
                tipo_movimiento="ENTRADA",
                destino="O",
                proyecto=material.proyecto_obra or '',
                cantidad_entrada=material.stock_obra,
                cantidad_salida=0,
                existencias=material.stock_actual,
                observaciones="Registro inicial de material (Obra) en el sistema"
            )

    def destroy(self, request, *args, **kwargs):
        try:
            instance = self.get_object()
            self.perform_destroy(instance)
            return Response(
            {"mensaje": "Material eliminado con exito."},
            status=status.HTTP_204_NO_CONTENT
            )
        except ProtectedError:
            return Response(
                {"error": "No se puede eliminar este material porque tiene registros vinculados en actas o cartas de retiro."},
                status=status.HTTP_400_BAD_REQUEST
            )

class PersonalViewSet(viewsets.ModelViewSet):
    queryset = Personal.objects.all()
    serializer_class = PersonalSerializer
    authentication_classes = [UsuarioTokenAuthentication]
    permission_classes = [SoloLecturaOAdmin]

class ActaEntradaViewSet(viewsets.ModelViewSet):
    queryset = ActaEntrada.objects.all()
    serializer_class = ActaEntradaSerializer
    authentication_classes = [UsuarioTokenAuthentication]
    permission_classes = [CrearOAdminEditar]

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        detalles_data = request.data.get('detalles', [])

        if not detalles_data:
            raise ValidationError({'error': 'Debe incluir al menos un material en el acta.'})

        # 1. Guardar cabecera y detalles AUTOMÁTICAMENTE a través del serializador (Una sola vez)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        acta = serializer.save()

        # 2. Únicamente incrementar stock y registrar el movimiento en el Kardex por cada material
        for item in detalles_data:
            mat_id = item.get('material')
            cant = Decimal(str(item.get('cantidad', 0)))
            destino = item.get('destino', 'M') or 'M'
            if destino not in ('M', 'O'):
                destino = 'M'

            try:
                material = Material.objects.select_for_update().get(pk=mat_id)
            except Material.DoesNotExist:
                raise ValidationError({'error': f'El material con identificador "{mat_id}" no existe.'})

            if destino == 'O':
                material.stock_obra += cant
            else:
                material.stock_mantenimiento += cant
            material.stock_actual = material.stock_mantenimiento + material.stock_obra

            observacion_detalle = item.get('observacion') or item.get('observaciones') or ''
            proyecto = item.get('proyecto') or item.get('proyecto_obra') or ''
            if destino == 'O':
                if not proyecto:
                    proyecto = observacion_detalle or acta.observaciones or ''
                material.proyecto_obra = proyecto
            else:
                proyecto = ''

            material.save()

            # Registrar Movimiento en Kardex
            MovimientoKardex.objects.create(
                material=material,
                numero_documento=acta.numero_acta,
                fecha=acta.fecha_recepcion,
                tipo_movimiento='ENTRADA',
                destino=destino,
                proyecto=proyecto,
                cantidad_entrada=cant,
                cantidad_salida=0,
                existencias=material.stock_actual,
                observaciones=observacion_detalle or acta.observaciones or "Ingreso por Acta de Entrada"
            )

        return Response(serializer.data, status=status.HTTP_201_CREATED)
class CartaRetiroViewSet(viewsets.ModelViewSet):
    queryset = CartaRetiro.objects.all()
    serializer_class = CartaRetiroSerializer
    authentication_classes = [UsuarioTokenAuthentication]
    permission_classes = [CrearOAdminEditar]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        detalles_data = request.data.get('detalles', [])

        if isinstance(detalles_data, str):
            try:
                detalles_data = json.loads(detalles_data)
            except json.JSONDecodeError:
                raise ValidationError({'error': 'El detalle de materiales no tiene un formato válido.'})

        if not detalles_data:
            raise ValidationError({'error': 'Debe incluir al menos un material en el retiro.'})

        usuario_autenticado = request.user
        solicitante_id = getattr(usuario_autenticado, 'pk', None)
        solicitante_nombre = (
            f"{getattr(usuario_autenticado, 'nombres', '')} "
            f"{getattr(usuario_autenticado, 'apellidos', '')}"
        ).strip()
        if not solicitante_nombre:
            solicitante_nombre = (
                request.data.get('usuario_nombre')
                or request.data.get('solicitado_por_nombre')
                or ''
            )

        # 1. Validar disponibilidad de stock según el origen (Mantenimiento u Obra).
        # Se acumula por (material, origen) para que varias líneas del mismo material
        # no puedan superar el stock disponible de forma individual.
        materiales_procesar = []
        totales_por_material = {}
        for item in detalles_data:
            codigo_mat = item.get('material')
            cant = Decimal(str(item.get('cantidad_despachada', item.get('cantidad', 0))))
            origen = item.get('origen', 'M') or 'M'
            if origen not in ('M', 'O'):
                origen = 'M'

            try:
                material = Material.objects.select_for_update().get(codigo=codigo_mat)
            except Material.DoesNotExist:
                raise ValidationError({'error': f'El material con código "{codigo_mat}" no existe.'})

            clave = (material.pk, origen)
            totales_por_material[clave] = totales_por_material.get(clave, 0) + cant
            materiales_procesar.append((material, cant, item, origen))

        for (material_pk, origen), cantidad_total in totales_por_material.items():
            material = Material.objects.get(pk=material_pk)
            disponible = (
                material.stock_mantenimiento
                if origen == 'M'
                else material.stock_obra
            )
            if disponible < cantidad_total:
                etiqueta = 'Mantenimiento' if origen == 'M' else 'Obra'
                raise ValidationError({
                    'error': (
                        f'Stock de {etiqueta} insuficiente para {material.nombre}. '
                        f'Disponible: {disponible}, Solicitado: {cantidad_total}'
                    )
                })

        # 2. Guardar la cabecera y los detalles AUTOMÁTICAMENTE mediante el Serializador
        datos_serializer = request.data.dict() if hasattr(request.data, 'dict') else dict(request.data)
        datos_serializer['detalles'] = detalles_data
        serializer = self.get_serializer(data=datos_serializer)
        serializer.is_valid(raise_exception=True)
        carta = serializer.save()

        solicitudes_creadas = 0

        # 3. Descontar Mantenimiento de inmediato; Obra queda pendiente de aprobación
        for material, cant, item, origen in materiales_procesar:
            if origen == 'O':
                detalle_retiro = DetalleRetiro.objects.filter(
                    carta_retiro=carta,
                    material=material,
                    origen='O',
                ).first()
                SolicitudLiberacion.objects.create(
                    material=material,
                    cantidad=cant,
                    carta_retiro=carta,
                    detalle_retiro=detalle_retiro,
                    proyecto_origen=(
                        item.get('observacion')
                        or carta.observaciones
                        or carta.destino_circuito
                        or ''
                    ),
                    motivo=(
                        item.get('observacion')
                        or carta.observaciones
                        or 'Solicitud de liberación de material de obra'
                    ),
                    solicitado_por_id=solicitante_id or None,
                    solicitado_por_nombre=solicitante_nombre,
                )
                solicitudes_creadas += 1
                continue

            material.stock_mantenimiento -= cant
            material.stock_actual = material.stock_mantenimiento + material.stock_obra
            material.save()

            MovimientoKardex.objects.create(
                material=material,
                numero_documento=f"RD-{carta.codigo_retiro}",
                fecha=carta.fecha_hora.date(),
                tipo_movimiento='SALIDA',
                destino='M',
                cantidad_entrada=0,
                cantidad_salida=cant,
                existencias=material.stock_actual,
                observaciones=carta.observaciones or "Salida por Carta de Retiro"
            )

        data = serializer.data
        data['solicitudes_creadas'] = solicitudes_creadas
        return Response(data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], parser_classes=[MultiPartParser, FormParser])
    def soporte(self, request, pk=None):
        carta = self.get_object()
        campos_actualizados = []

        for campo in ('imagen_soporte_1', 'imagen_soporte_2'):
            archivo = request.FILES.get(campo)
            if not archivo:
                continue
            if not (archivo.content_type or '').startswith('image/'):
                return Response(
                    {'error': f'El archivo {campo} debe ser una imagen.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            setattr(carta, campo, archivo)
            campos_actualizados.append(campo)

        if not campos_actualizados:
            return Response(
                {'error': 'Debe adjuntar al menos una imagen de soporte.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        carta.save(update_fields=campos_actualizados)
        return Response(self.get_serializer(carta).data, status=status.HTTP_200_OK)



class SolicitudLiberacionViewSet(viewsets.ModelViewSet):
    queryset = SolicitudLiberacion.objects.all().select_related('material', 'carta_retiro')
    serializer_class = SolicitudLiberacionSerializer
    authentication_classes = [UsuarioTokenAuthentication]
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_permissions(self):
        if self.action in [
            'aprobar', 'rechazar', 'create', 'update', 'partial_update', 'destroy',
        ]:
            return [EsAdministrador()]
        return [IsAuthenticated()]

    def get_queryset(self):
        queryset = super().get_queryset()
        usuario = self.request.user

        # El administrador visualiza todas las solicitudes; el usuario normal
        # únicamente puede consultar las que él mismo generó.
        if getattr(usuario, 'rol', None) != 'admin':
            queryset = queryset.filter(solicitado_por_id=usuario.pk)

        estado = self.request.query_params.get('estado')
        if estado:
            queryset = queryset.filter(estado=estado.upper())
        material = self.request.query_params.get('material')
        if material:
            queryset = queryset.filter(material_id=material)
        return queryset

    def _obtener_administrador(self, request):
        admin = request.user
        if not admin or getattr(admin, 'rol', None) != 'admin':
            raise PermissionDenied(
                'Solo un usuario administrador puede autorizar liberaciones.'
            )

        nombre = f"{admin.nombres} {admin.apellidos}".strip()
        return admin, nombre

    @action(detail=False, methods=['get'])
    def resumen(self, request):
        queryset = self.get_queryset()
        return Response({
            'pendientes': queryset.filter(estado='PENDIENTE').count(),
            'aprobadas': queryset.filter(estado='APROBADA').count(),
            'rechazadas': queryset.filter(estado='RECHAZADA').count(),
            'total': queryset.count(),
        })

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def aprobar(self, request, pk=None):
        admin, admin_nombre = self._obtener_administrador(request)
        imagen_soporte = request.FILES.get('imagen_soporte')

        if not imagen_soporte:
            return Response(
                {'error': 'Debe adjuntar una imagen de soporte para aprobar la liberación.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not (imagen_soporte.content_type or '').startswith('image/'):
            return Response(
                {'error': 'El archivo adjunto debe ser una imagen.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            solicitud = SolicitudLiberacion.objects.select_for_update().get(pk=pk)
        except SolicitudLiberacion.DoesNotExist:
            return Response({'error': 'Solicitud no encontrada.'}, status=status.HTTP_404_NOT_FOUND)

        if solicitud.estado != 'PENDIENTE':
            return Response(
                {'error': f'La solicitud ya fue {solicitud.estado.lower()} y no puede aprobarse de nuevo.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        material = Material.objects.select_for_update().get(pk=solicitud.material_id)
        cantidad = solicitud.cantidad

        if material.stock_obra < cantidad:
            return Response(
                {'error': (
                    f'Stock de Obra insuficiente para {material.nombre}. '
                    f'Disponible: {material.stock_obra}, Solicitado: {cantidad}'
                )},
                status=status.HTTP_400_BAD_REQUEST
            )

        motivo = request.data.get('motivo') or solicitud.motivo or 'Liberación de material de obra'

        material.stock_obra -= cantidad
        material.stock_actual = material.stock_mantenimiento + material.stock_obra
        if material.stock_obra <= 0:
            material.proyecto_obra = ''
        material.save()

        numero_documento = (
            f"RD-{solicitud.carta_retiro.codigo_retiro}"
            if solicitud.carta_retiro
            else f"LIB-{solicitud.id:05d}"
        )
        proyecto = solicitud.proyecto_origen or motivo

        MovimientoKardex.objects.create(
            material=material,
            numero_documento=numero_documento,
            fecha=timezone.now().date(),
            tipo_movimiento='SALIDA',
            destino='O',
            proyecto=proyecto,
            cantidad_entrada=0,
            cantidad_salida=cantidad,
            existencias=material.stock_actual,
            observaciones=motivo,
        )

        HistorialLiberaciones.objects.create(
            material=material,
            cantidad=cantidad,
            proyecto_origen=proyecto,
            administrador_id=admin.pk,
            administrador_nombre=admin_nombre,
            motivo=motivo,
            numero_documento=numero_documento,
            imagen_soporte=imagen_soporte,
            solicitud=solicitud,
        )

        solicitud.estado = 'APROBADA'
        solicitud.aprobado_por_id = admin.pk
        solicitud.aprobado_por_nombre = admin_nombre
        solicitud.fecha_resolucion = timezone.now()
        solicitud.save()

        return Response(SolicitudLiberacionSerializer(solicitud).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def rechazar(self, request, pk=None):
        admin, admin_nombre = self._obtener_administrador(request)

        try:
            solicitud = SolicitudLiberacion.objects.select_for_update().get(pk=pk)
        except SolicitudLiberacion.DoesNotExist:
            return Response({'error': 'Solicitud no encontrada.'}, status=status.HTTP_404_NOT_FOUND)

        if solicitud.estado != 'PENDIENTE':
            return Response(
                {'error': f'La solicitud ya fue {solicitud.estado.lower()} y no puede rechazarse de nuevo.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        solicitud.estado = 'RECHAZADA'
        solicitud.aprobado_por_id = admin.pk
        solicitud.aprobado_por_nombre = admin_nombre
        solicitud.motivo = request.data.get('motivo') or solicitud.motivo
        solicitud.fecha_resolucion = timezone.now()
        solicitud.save()

        return Response(SolicitudLiberacionSerializer(solicitud).data, status=status.HTTP_200_OK)


class HistorialLiberacionesViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = HistorialLiberaciones.objects.all().select_related('material')
    serializer_class = HistorialLiberacionesSerializer
    authentication_classes = [UsuarioTokenAuthentication]
    permission_classes = [EsAdministrador]
    filter_backends = [filters.SearchFilter]
    search_fields = ['material__codigo', 'material__nombre', 'proyecto_origen', 'administrador_nombre']


class CartaDevolucionViewSet(viewsets.ModelViewSet):
    queryset = CartaDevolucion.objects.all()
    serializer_class = CartaDevolucionSerializer
    authentication_classes = [UsuarioTokenAuthentication]
    permission_classes = [CrearOAdminEditar]




class CierreAnualViewSet(viewsets.ModelViewSet):
    queryset = CierreAnual.objects.all().order_by('-fecha_inicio')
    serializer_class = CierreAnualSerializer

    @action(detail=False, methods=['get'], url_path='historial-filtrado')
    def historial_filtrado(self, request):
        # Capturamos los parámetros de fecha de la URL (ej: ?fecha_inicio=2026-10-01&fecha_fin=2026-10-23)
        fecha_inicio = request.GET.get('fecha_inicio')
        fecha_fin = request.GET.get('fecha_fin')

        actas = ActaEntrada.objects.all()
        retiros = CartaRetiro.objects.all()
        devoluciones = CartaDevolucion.objects.all()

        if fecha_inicio and fecha_fin:
            actas = actas.filter(fecha_recepcion__range=[fecha_inicio, fecha_fin])
            retiros = retiros.filter(fecha_hora__date__range=[fecha_inicio, fecha_fin])
            devoluciones = devoluciones.filter(fecha_hora__date__range=[fecha_inicio, fecha_fin])
        elif fecha_inicio:
            actas = actas.filter(fecha_recepcion__gte=fecha_inicio)
            retiros = retiros.filter(fecha_hora__date__gte=fecha_inicio)
            devoluciones = devoluciones.filter(fecha_hora__date__gte=fecha_inicio)

        return Response({
            "actas_entrada": ActaEntradaSerializer(actas, many=True).data,
            "cartas_retiro": CartaRetiroSerializer(retiros, many=True).data,
            "cartas_devolucion": CartaDevolucionSerializer(devoluciones, many=True).data,
        })


@api_view(['POST'])
@authentication_classes([UsuarioTokenAuthentication])
@permission_classes([IsAuthenticated])
def generar_kardex_excel_directo(request):
    data = request.data
    info_raw = data.get('info_producto', {})
    detalles_raw = data.get('detalles', [])
    
    fecha_ingresada = info_raw.get('fecha_ingresada', info_raw.get('fecha', ''))

    if '-' in fecha_ingresada:
        partes = fecha_ingresada.split('-')
        fecha_formateada = f"{partes[2]}/{partes[1]}/{partes[0]}"
    else:
        fecha_formateada = fecha_ingresada

    informacion_producto = {
        'codigo_sap': info_raw.get('codigo_sap', 'BORRADOR'),
        'destino_circuito': f"CIRCUITO / DESTINO: {info_raw.get('destino_circuito', 'SIN DESTINO')}",
        'fecha_ingresada': fecha_formateada,
        'entregado_por': info_raw.get('entregado_por', ''),
        'retirado_por': info_raw.get('retirado_por', '')
    }

    lista_movimientos = []
    for item in detalles_raw:
        lista_movimientos.append({
            'codigo_sap': item.get('codigo_sap', ''),
            'descripcion': item.get('descripcion', ''),
            'unidad_medida': item.get('unidad_medida', 'UND'),
            'condicion': item.get('condicion', 'OPERATIVO'),
            'cantidad_despachada': item.get('cantidad_despachada', 0),
            'cantidad_devuelta': item.get('cantidad_devuelta', 0),
            'observacion': item.get('observacion', ''),
            'pag': item.get('pag', 1),
        })

    # 1. Generar el libro con la función de utils.py
    wb = generar_excel_kardex(informacion_producto, lista_movimientos)

    # 2. Definir la carpeta destino local (Carpeta Descargas de la PC)
    ruta_destino = Path.home() / "Downloads"
    os.makedirs(ruta_destino, exist_ok=True)
    
    codigo = informacion_producto['codigo_sap']
    nombre_archivo = f"Kardex_RD_{codigo}.xlsx"
    ruta_completa = ruta_destino / nombre_archivo

    # 3. Guardar el archivo directamente en el disco duro (Sin preguntar al usuario)
    wb.save(ruta_completa)

    # 4. Abrir automáticamente el archivo guardado en Microsoft Excel
    os.startfile(ruta_completa)

    return Response({
        "status": "success",
        "mensaje": f"Archivo guardado y abierto automáticamente en: {ruta_completa}"
    }, status=status.HTTP_200_OK)

def formatear_personal(p):
    if not p:
        return ""

    val_str = str(p).strip()

    # 1. Si viene en formato "25626343 - jose carlos santander lulu"
    if ' - ' in val_str:
        partes = val_str.split(' - ', 1)
        cedula = partes[0].strip()
        nombre = partes[1].strip().title()
        return f"{nombre} / C.I.: {cedula}"

    # 2. Si viene únicamente la cédula (solo números)
    if val_str.isdigit():
        persona = Personal.objects.filter(cedula=val_str).first()
        if persona:
            nombre_comp = f"{persona.nombre} {persona.apellido}".strip().title()
            return f"{nombre_comp} / C.I.: {persona.cedula}"
        return f"C.I.: {val_str}"

    return val_str


@api_view(['GET', 'POST'])
@authentication_classes([UsuarioTokenAuthentication])
@permission_classes([IsAuthenticated])
def descargar_kardex_excel(request, codigo_retiro=None):
    if request.method == 'POST':
        data = request.data
        
        # Extraer datos de info_producto (si viene anidado) o de la raíz del JSON
        info_data = data.get('info_producto') if isinstance(data.get('info_producto'), dict) else data
        
        obs_raw = (
            info_data.get('destino_circuito') or 
            info_data.get('observaciones_generales') or 
            data.get('destino_circuito') or 
            data.get('observaciones_generales') or ''
        )
        
        obs_limpia = str(obs_raw).replace('CIRCUITO / DESTINO:', '').strip()

        info_producto = {
            'codigo_sap': info_data.get('codigo_sap') or info_data.get('numero_acta') or data.get('codigo_sap') or '',
            'observaciones_generales': obs_limpia,
            'fecha_ingresada': info_data.get('fecha_ingresada') or info_data.get('fecha_carta') or data.get('fecha_ingresada') or '',
            'entregado_por': formatear_personal(info_data.get('entregado_por') or data.get('entregado_por')),
            'retirado_por': formatear_personal(info_data.get('retirado_por') or info_data.get('recibido_por') or data.get('retirado_por')),
        }

        lista_movimientos = data.get('detalles', []) or data.get('lista_movimientos', [])
        codigo_filename = info_producto['codigo_sap'] or 'KARDEX'

    else:
        # Lógica GET para bases de datos
        carta = CartaRetiro.objects.filter(codigo_retiro=codigo_retiro).first()
        if not carta:
            carta = ActaEntrada.objects.filter(numero_acta=codigo_retiro).first()

        if not carta:
            return JsonResponse({'error': 'No se encontró el registro'}, status=404)

        fecha_carta = carta.fecha_hora.strftime('%d/%m/%Y') if hasattr(carta, 'fecha_hora') and carta.fecha_hora else ''
        obs_val = getattr(carta, 'observaciones', None) or getattr(carta, 'observacion', None) or getattr(carta, 'destino_circuito', None) or ''

        info_producto = {
            'codigo_sap': getattr(carta, 'codigo_retiro', getattr(carta, 'numero_acta', '')),
            'observaciones_generales': str(obs_val).strip(),
            'fecha_ingresada': fecha_carta,
            'entregado_por': formatear_personal(getattr(carta, 'entregado_por', '')),
            'retirado_por': formatear_personal(getattr(carta, 'recibido_por', '')),
        }

        detalles = DetalleRetiro.objects.filter(carta_retiro=carta) if hasattr(carta, 'codigo_retiro') else []
        lista_movimientos = []
        for item in detalles:
            mat_codigo = getattr(item.material, 'codigo', '') if hasattr(item, 'material') and item.material else getattr(item, 'codigo_sap', '')
            mat_desc = getattr(item.material, 'nombre', '') if hasattr(item, 'material') and item.material else getattr(item, 'descripcion', '')
            mat_um = getattr(item.material, 'unidad_medida', 'UND') if hasattr(item, 'material') and item.material else getattr(item, 'unidad_medida', 'UND')

            lista_movimientos.append({
                'codigo_sap': mat_codigo,
                'descripcion': mat_desc,
                'unidad_medida': mat_um,
                'condicion': getattr(item, 'condicion', 'OPERATIVO'),
                'cantidad_despachada': getattr(item, 'cantidad_despachada', 0),
                'cantidad_devuelta': getattr(item, 'cantidad_devuelta', 0),
                'observacion': getattr(item, 'observacion', ''),
            })
        codigo_filename = getattr(carta, 'codigo_retiro', getattr(carta, 'numero_acta', 'KARDEX'))

    # 1. Generar el libro openpyxl
    wb = generar_excel_kardex(info_producto, lista_movimientos)

    # 2. Guardar el archivo localmente en la carpeta del sistema o Downloads
    ruta_descargas = os.path.join(os.path.expanduser('~'), 'Downloads')
    nombre_archivo = f"Kardex_RD_{codigo_filename}.xlsx"
    filepath = os.path.join(ruta_descargas, nombre_archivo)

    try:
        wb.save(filepath)
        # 3. Abrir el archivo automáticamente en Windows
        if os.name == 'nt':
            os.startfile(filepath)
    except Exception as e:
        print("Error guardando o abriendo el Excel:", e)

    # 4. Devolver JSON para que React no tire SyntaxError
    return JsonResponse({'mensaje': 'Archivo Excel generado y abierto con éxito'})


@transaction.atomic
def registrar_ingreso_acta(numero_acta, fecha_ingreso, items_materiales, observacion_general=""):
    """
    items_materiales es una lista de diccionarios:
    [
        {"material_id": 1, "cantidad": 5, "destino": "M", "observacion": "..."},
        {"material_id": 2, "cantidad": 10, "destino": "O", "observacion": "..."},
    ]
    """
    for item in items_materiales:
        material = Material.objects.select_for_update().get(id=item['material_id'])
        destino = item.get('destino', 'M') or 'M'

        if destino == 'O':
            material.stock_obra += item['cantidad']
        else:
            material.stock_mantenimiento += item['cantidad']

        material.stock_actual = material.stock_mantenimiento + material.stock_obra
        nueva_existencia = material.stock_actual
        proyecto = item.get('proyecto', '') if destino == 'O' else ''
        if destino == 'O' and proyecto:
            material.proyecto_obra = proyecto
        material.save()

        # Generar fila automática en el Kardex del material
        MovimientoKardex.objects.create(
            material=material,
            numero_documento=f"ACTA ALMACEN {numero_acta}",
            fecha=fecha_ingreso,
            tipo_movimiento='ENTRADA',
            destino=destino,
            proyecto=proyecto,
            cantidad_entrada=item['cantidad'],
            cantidad_salida=0,
            existencias=nueva_existencia,
            observaciones=item.get('observacion', observacion_general)
        )


@transaction.atomic
def registrar_salida_carta_rd(numero_carta_rd, fecha_salida, items_materiales, observacion_general=""):
    """
    Registra salidas múltiples por Carta RD y actualiza el Kardex
    """
    for item in items_materiales:
        material = Material.objects.select_for_update().get(id=item['material_id'])
        destino = item.get('destino', 'M') or 'M'

        disponible = (
            material.stock_obra if destino == 'O' else material.stock_mantenimiento
        )
        if disponible < item['cantidad']:
            raise ValueError(f"Stock insuficiente para {material.nombre or material.descripcion}")

        # Descontar stock del destino correspondiente
        if destino == 'O':
            material.stock_obra -= item['cantidad']
        else:
            material.stock_mantenimiento -= item['cantidad']

        material.stock_actual = material.stock_mantenimiento + material.stock_obra
        nueva_existencia = material.stock_actual
        proyecto = item.get('proyecto', '') if destino == 'O' else ''
        if destino == 'O' and material.stock_obra <= 0:
            material.proyecto_obra = ''
        material.save()

        # Generar fila de salida automática
        MovimientoKardex.objects.create(
            material=material,
            numero_documento=f"RD-{numero_carta_rd}",
            fecha=fecha_salida,
            tipo_movimiento='SALIDA',
            destino=destino,
            proyecto=proyecto,
            cantidad_entrada=0,
            cantidad_salida=item['cantidad'],
            existencias=nueva_existencia,
            observaciones=item.get('observacion', observacion_general)
        )


@api_view(['GET'])
@authentication_classes([UsuarioTokenAuthentication])
@permission_classes([IsAuthenticated])
def obtener_kardex_material(request, material_id):
    
    try:
        material = Material.objects.get(pk=material_id)
        serializer = MaterialKardexDetailSerializer(material)
        return Response(serializer.data)
    except Material.DoesNotExist:
        return Response({'error': 'Material no encontrado'}, status=404)