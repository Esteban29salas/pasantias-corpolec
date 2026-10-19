from rest_framework import viewsets, status, filters
import os
import subprocess
from django.http import JsonResponse
from pathlib import Path
from rest_framework.decorators import api_view, action
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from django.db import transaction
from django.db.models import ProtectedError
from decimal import Decimal
from .utils import generar_excel_kardex
from io import BytesIO
from django.http import HttpResponse
from .models import (
    Material, Personal, CierreAnual, DetalleCierreAnual,
    ActaEntrada, CartaRetiro, CartaDevolucion, DetalleActa, DetalleRetiro, MovimientoKardex, DetalleDevolucion, 
)
from .serializers import (
    CierreAnualSerializer, MaterialSerializer, PersonalSerializer,
    ActaEntradaSerializer, CartaRetiroSerializer, CartaDevolucionSerializer, MaterialKardexDetailSerializer
)



class MaterialViewSet(viewsets.ModelViewSet):
    queryset = Material.objects.all().order_by('-fecha_ingreso')
    serializer_class = MaterialSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['codigo', 'nombre', 'unidad_medida', 'fecha_ingreso']

    def perform_create(self, serializer):
        # Guarda el nuevo material (el método save asignará el pag_kardex automático)
        material = serializer.save()

        # Si ingresa con stock inicial superior a 0, creamos el movimiento inicial
        if material.stock_actual > 0:
            MovimientoKardex.objects.create(
                material=material,
                numero_documento="INVENTARIO INICIAL",
                tipo_movimiento="ENTRADA",
                cantidad_entrada=material.stock_actual,
                cantidad_salida=0,
                existencias=material.stock_actual,
                observaciones="Registro inicial de material en el sistema"
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


class ActaEntradaViewSet(viewsets.ModelViewSet):
    queryset = ActaEntrada.objects.all()
    serializer_class = ActaEntradaSerializer
    @transaction.atomic
    def create(self, request, *args, **kwargs):
        detalles_data = request.data.get('detalles', [])

        # 1. Guardar la cabecera del Acta de Entrada
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        acta = serializer.save()

        # 2. Registrar detalles e incrementar stock de cada material
        for item in detalles_data:
            codigo_mat = item.get('material')
            cant = float(item.get('cantidad', 0))

            try:
                material = Material.objects.select_for_update().get(codigo=codigo_mat)
            except Material.DoesNotExist:
                raise ValidationError({'error': f'El material con código "{codigo_mat}" no existe.'})

            material.stock_actual += Decimal(str(cant))
            material.save()
            DetalleActa.objects.create(
                acta=acta,
                material=material,
                cantidad=cant
            )

            # 3. Registrar Movimiento en Kardex
            MovimientoKardex.objects.create(
                material=material,
                numero_documento=f"ACTA-{acta.numero_acta}",
                fecha=acta.fecha_recepcion,
                tipo_movimiento='ENTRADA',
                destino='M',
                cantidad_entrada=cant,
                cantidad_salida=0,
                existencias=material.stock_actual,
                observaciones=acta.observaciones or "Ingreso por Acta de Entrada"
            )

        return Response(serializer.data, status=status.HTTP_201_CREATED)
class CartaRetiroViewSet(viewsets.ModelViewSet):
    queryset = CartaRetiro.objects.all()
    serializer_class = CartaRetiroSerializer

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        detalles_data = request.data.get('detalles', [])

        if not detalles_data:
            raise ValidationError({'error': 'Debe incluir al menos un material en el retiro.'})

        # 1. Validar disponibilidad de stock antes de procesar
        materiales_a_descontar = []
        for item in detalles_data:
            codigo_mat = item.get('material')
            cant = float(item.get('cantidad_despachada', item.get('cantidad', 0)))

            try:
                material = Material.objects.select_for_update().get(codigo=codigo_mat)
            except Material.DoesNotExist:
                raise ValidationError({'error': f'El material con código "{codigo_mat}" no existe.'})

            if material.stock_actual < cant:
                raise ValidationError({
                    'error': f'Stock insuficiente para {material.nombre}. Disponible: {material.stock_actual}, Solicitado: {cant}'
                })

            materiales_a_descontar.append((material, cant, item))

        # 2. Guardar la cabecera y los detalles AUTOMÁTICAMENTE mediante el Serializador
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        carta = serializer.save()

        # 3. Únicamente descontar stock y registrar el movimiento en el Kardex (SIN volver a crear DetalleRetiro)
        for material, cant, item in materiales_a_descontar:
            material.stock_actual -= Decimal(str(cant))
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

        return Response(serializer.data, status=status.HTTP_201_CREATED)



class CartaDevolucionViewSet(viewsets.ModelViewSet):
    queryset = CartaDevolucion.objects.all()
    serializer_class = CartaDevolucionSerializer



class CierreAnualViewSet(viewsets.ModelViewSet):
    queryset = CierreAnual.objects.all().order_by('-fecha_inicio')
    serializer_class = CierreAnualSerializer

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        fecha_inicio = serializer.validated_data.get('fecha_inicio')
        fecha_cierre = serializer.validated_data.get('fecha_cierre')
        observaciones = serializer.validated_data.get('observaciones', '')

        anio_int = fecha_inicio.year

        if not (2023 <= anio_int <= 2100):
            return Response(
                {"error": "El año ingresado no es valido. Debe estar entre 2023 y 2100."}, status=status.HTTP_400_BAD_REQUEST
            )

        if CierreAnual.objects.filter(fecha_inicio__year=anio_int).exists():
            return Response(
                {"error": f"Ya se realizo el cierre de inventario para el año {anio_int}."}, status=status.HTTP_400_BAD_REQUEST
            )

        

        if not anio_int:
            return Response(
                {"error": "El campo 'año' es obligatorio."}, status=status.HTTP_400_BAD_REQUEST
            )
        try:
            anio_int = int(fecha_inicio.year)
            if not (2023 <= anio_int <= 2100):
                return Response(
                    {"error": "El año ingresado no es valido. Debe estar entre 2023 y 2100."}, status=status.HTTP_400_BAD_REQUEST
                )
        except (AttributeError, ValueError, TypeError):
            return Response(
                {"error": "El año ingresado no es valido."}, status=status.HTTP_400_BAD_REQUEST
            )
        if CierreAnual.objects.filter(fecha_inicio__year=anio_int).exists():
            return Response(
                {"error": f"Ya se realizo el cierre de inventario para el año {anio_int}."}, status=status.HTTP_400_BAD_REQUEST
            )
        
        
        cierre = CierreAnual.objects.create(
            fecha_inicio=fecha_inicio,
            fecha_cierre=fecha_cierre,
            observaciones=observaciones)
        
        materiales = Material.objects.all()
        detalles = [
            DetalleCierreAnual(
                cierre=cierre,
                material=mat,
                stock_final=mat.stock_actual
            ) 
            for mat in materiales
        ] 
        DetalleCierreAnual.objects.bulk_create(detalles)

        response_serializer = self.get_serializer(cierre)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)


@api_view(['POST'])
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
        
        # Calcular nuevo saldo de existencias
        nueva_existencia = material.stock_actual + item['cantidad']
        material.stock_actual = nueva_existencia
        material.save()

        # Generar fila automática en el Kardex del material
        MovimientoKardex.objects.create(
            material=material,
            numero_documento=f"ACTA ALMACEN {numero_acta}",
            fecha=fecha_ingreso,
            tipo_movimiento='ENTRADA',
            destino=item.get('destino', 'M'),
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
        
        if material.stock_actual < item['cantidad']:
            raise ValueError(f"Stock insuficiente para {material.descripcion}")

        # Descontar stock
        nueva_existencia = material.stock_actual - item['cantidad']
        material.stock_actual = nueva_existencia
        material.save()

        # Generar fila de salida automática
        MovimientoKardex.objects.create(
            material=material,
            numero_documento=f"RD-{numero_carta_rd}",
            fecha=fecha_salida,
            tipo_movimiento='SALIDA',
            destino=item.get('destino', 'M'),
            cantidad_entrada=0,
            cantidad_salida=item['cantidad'],
            existencias=nueva_existencia,
            observaciones=item.get('observacion', observacion_general)
        )


@api_view(['GET'])
def obtener_kardex_material(request, material_id):
    try:
        material = Material.objects.get(pk=material_id)
        serializer = MaterialKardexDetailSerializer(material)
        return Response(serializer.data)
    except Material.DoesNotExist:
        return Response({'error': 'Material no encontrado'}, status=404)