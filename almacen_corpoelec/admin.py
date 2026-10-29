from django.contrib import admin
from .models import (
    Material, Personal, 
    ActaEntrada, DetalleActa, CierreAnual,
    DetalleCierreAnual, CartaRetiro, DetalleRetiro, 
    CartaDevolucion, DetalleDevolucion,
    SolicitudLiberacion, HistorialLiberaciones
)

admin.site.register(Material)
admin.site.register(Personal)
admin.site.register(ActaEntrada)
admin.site.register(DetalleActa)
admin.site.register(CartaRetiro)
admin.site.register(DetalleRetiro)
admin.site.register(CartaDevolucion)
admin.site.register(DetalleDevolucion)
admin.site.register(CierreAnual)
admin.site.register(DetalleCierreAnual)
admin.site.register(SolicitudLiberacion)
admin.site.register(HistorialLiberaciones)

# Register your models here.
