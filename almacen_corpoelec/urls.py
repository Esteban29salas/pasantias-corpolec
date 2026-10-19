from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    MaterialViewSet, PersonalViewSet, CierreAnualViewSet,
    ActaEntradaViewSet, CartaRetiroViewSet, CartaDevolucionViewSet, descargar_kardex_excel, generar_kardex_excel_directo, obtener_kardex_material,
)

router = DefaultRouter()
router.register(r'materiales', MaterialViewSet)
router.register(r'personal', PersonalViewSet)
router.register(r'actas-entrada', ActaEntradaViewSet)
router.register(r'cartas-retiro', CartaRetiroViewSet)
router.register(r'cierre-anuales', CierreAnualViewSet)
router.register(r'cartas-devolucion', CartaDevolucionViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('kardex/excel/<int:codigo_retiro>/', descargar_kardex_excel, name='descargar_kardex_excel'),
    path('materiales/<str:material_id>/kardex/', obtener_kardex_material, name='kardex-material'),
    # Nota: Usa <str:material_id> o <int:material_id> según cómo busques por código SAP en la BD.
    
    # CAMBIA ESTA LÍNEA (Línea 19):
    path('kardex/excel/generar/', descargar_kardex_excel, name='descargar_kardex_excel_generar'),
]