# Create your models here.
import calendar
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Max
from django.db import transaction
from django.utils import timezone
from .validators import(
    validar_cedula,
    validar_observaciones,
    validar_codigo,
    validar_rango_fecha,
    validar_nombres,
    validar_fecha_hoy,
    validar_fecha_recepcion,
    validar_stock
)

class UnidadMedida(models.TextChoices):
    #conteo
    PIEZA = 'PZA', 'Pieza (PZA)'
    UNIDAD = 'UND', 'Unidad (UND)'

    #Longitud
    CENTIMETRO = 'CM', 'Ceentimetro (CM)'
    METROS = 'MTS', 'Metros (MTS)'
    KILOMETROS = 'KM', 'Kilometros (KM)'

    #Masa / Peso
    GRAMO = 'GR', 'Gramo'
    KILOGRAMO = 'KG', 'Kilogramos (KG)'
    TONELADA = 'TON', 'Tonelada (TON)'

    class Meta:
        db_table = 'UnidadMaterial'

class EstadoMaterial(models.TextChoices):
    OPERATIVO = 'OPERATIVO','Operativo'
    DETERIORADO = 'DETERIORADO', 'Deteriorado'
    REPARACION = 'REPARACION', 'En reparacion'

    class Meta:
        db_table = 'EstadoMaterial'

class CargoPersonal(models.TextChoices):
    INGENIERO = 'INGENIERO', 'Ingeniero'
    LICENCIADO = 'LICENCIADO', 'Licenciado'

    class Meta:
        db_table = 'CargoPersonal'

class Material(models.Model):
    #se incorporan las validadciones del codigo del material
    codigo = models.CharField(
        max_length=10,
        primary_key=True,
        validators = [validar_codigo],
    )
    #incorporacion de la validacion del nombre 
    nombre = models.CharField(
        max_length=150, default=" ",
        verbose_name="Nombre del Material",
        
    )
    descripcion = models.TextField(
        blank=True,
        null=True,
        validators=[validar_observaciones]
        )
    unidad_medida = models.CharField(
        max_length=5,
        choices=UnidadMedida.choices, 
        default=UnidadMedida.UNIDAD,
        verbose_name="Unidad de Medida"
        )
    stock_actual = models.DecimalField(
        max_digits=12, 
        decimal_places=2, 
        default=0.00,
        verbose_name="Stock Actual",
        )
    pag_kardex = models.IntegerField(
        null=True,
        blank=True,
        unique=True, 
        editable=False, 
        help_text="Número de Folio/PÁG en Kardex"
        )
    fecha_ingreso = models.DateTimeField(
        default=timezone.now, 
        validators=[validar_fecha_recepcion],           
        verbose_name="Fecha de Ingreso"
        )

    def save(self, *args, **kwargs):
        if not self.pag_kardex:
            # Busca el valor más alto registrado en pag_kardex
            max_pag = Material.objects.aggregate(Max('pag_kardex'))['pag_kardex__max']
                    # Asigna el siguiente consecutivo o empieza en 1 si es el primer registro
            self.pag_kardex = (max_pag or 0) + 1
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.codigo} - {self.nombre} - {self.unidad_medida}, {self.fecha_ingreso})"

    class Meta:
        db_table = 'Material'


class MovimientoKardex(models.Model):
    TIPO_CHOICES = (
        ('ENTRADA', 'Entrada'),
        ('SALIDA', 'Salida'),
        ('DEVOLUCION', 'Devolución'),
    )
    DESTINO_CHOICES = (
        ('M', 'Mantenimiento'),
        ('O', 'Obra'),
    )

    material = models.ForeignKey(Material, on_delete=models.CASCADE, related_name='historial_kardex')
    numero_documento = models.CharField(max_length=100, help_text="Ej: ACTA ALMACEN 016, RD-001, R-19839861")
    fecha = models.DateField(default=timezone.now)
    tipo_movimiento = models.CharField(max_length=15, choices=TIPO_CHOICES)
    destino = models.CharField(max_length=1, choices=DESTINO_CHOICES, default='M')
    
    cantidad_entrada = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    cantidad_salida = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    existencias = models.DecimalField(max_digits=12, decimal_places=2, help_text="Saldo resultante")
    
    observaciones = models.TextField(blank=True, null=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['fecha', 'id']

class Personal(models.Model):
    cedula = models.CharField(max_length=10, primary_key=True, validators=[validar_cedula])
    nombre = models.CharField(max_length=50, default="")
    apellido = models.CharField(max_length=50, default="")
    cargo = models.CharField(max_length=100, choices=CargoPersonal.choices)

    def __str__(self):
        return f"{self.cedula} - {self.nombre} - {self.apellido}"

    class Meta:
        db_table = 'Personal'

class ActaEntrada(models.Model):
    numero_acta = models.CharField(max_length=50, unique=True, validators=[validar_codigo])
    ceco = models.CharField(max_length=50, default='00000000', editable=False)
    material = models.ForeignKey(Material, on_delete=models.PROTECT, related_name='materiales_actas', null=True, blank=True)
    fecha_recepcion = models.DateField(validators=[validar_fecha_recepcion])
    origen = models.CharField(max_length=150)
    observaciones = models.TextField(blank=True, null=True, validators=[validar_observaciones])
    entregado_por = models.ForeignKey(Personal, on_delete=models.PROTECT, related_name='actas_entregadas', null=True, blank=True)
    recibido_por = models.ForeignKey(Personal, on_delete=models.PROTECT, related_name='actas_recibidas', null=True, blank=True)

    def __str__(self):
        return f"Acta {self.numero_acta} - {self.fecha_recepcion}"

    class Meta:
        db_table = 'ActaEntrada'

class DetalleActa(models.Model):
    acta = models.ForeignKey(ActaEntrada, on_delete=models.CASCADE, related_name='actas')
    material = models.ForeignKey(Material, on_delete=models.PROTECT)
    cantidad = models.DecimalField(max_digits=10, decimal_places=2)
    # ... tus otros campos (acta, material, cantidad, etc.) ...
    estado = models.CharField(
        max_length=20,
        choices=EstadoMaterial.choices,
        default=EstadoMaterial.OPERATIVO
    )
    observaciones = models.TextField(blank=True, null=True)

class CartaRetiro(models.Model):
    codigo_retiro = models.CharField(max_length=20, unique=True, blank=True)
    fecha_hora = models.DateTimeField(auto_now_add=True, validators=[validar_fecha_hoy])
    tipo_movimiento = models.CharField(max_length=50, default="RETIRO")
    entregado_por = models.ForeignKey(Personal, on_delete=models.PROTECT, related_name='cartas_entregadas')
    retirado_por = models.ForeignKey(Personal, on_delete=models.PROTECT, related_name='cartas_retiradas')
    destino_circuito = models.CharField(max_length=200)
    observaciones = models.TextField(blank=True, null=True, validators=[validar_observaciones])


    # 'id' se incrementa automáticamente a nivel de Base de Datos sin condiciones de carrera

    @property
    def codigo_retiro(self):
        if self.id:
            return str(self.id).zfill(5) # "00001", "00002"
        return ""

    def __str__(self):
        return f"Retiro {self.codigo_retiro:03d} - {self.fecha_hora} "

class DetalleRetiro(models.Model):
    carta_retiro = models.ForeignKey(CartaRetiro, on_delete=models.CASCADE, related_name='RD')
    codigo_sap = models.CharField(max_length=20, default='')
    descripcion = models.CharField(max_length=255, default='')
    condicion = models.CharField(max_length=20, default='PZA')
    material = models.ForeignKey(Material, on_delete=models.PROTECT)
    pag = models.CharField(max_length=10, blank=True, null=True)
    cantidad_devuelta = models.PositiveIntegerField(default=0)
    cantidad = models.PositiveIntegerField(default=1, validators=[validar_stock])
    entregado_por = models.ForeignKey(Personal, on_delete=models.PROTECT, related_name='detalles_entregadas',null=True, 
        blank=True,)
    retirado_por = models.ForeignKey(Personal, on_delete=models.PROTECT, related_name='detalles_retiradas',null=True, 
        blank=True,)

class CartaDevolucion(models.Model):
    carta_retiro = models.ForeignKey(CartaRetiro, on_delete=models.PROTECT, related_name='devoluciones')
    fecha_hora = models.DateTimeField(auto_now_add=True, validators=[validar_fecha_hoy])
    observaciones = models.TextField(blank=True, null=True, validators=[validar_observaciones])

    def __str__(self):
        return f"Devolución de {self.carta_retiro.codigo_retiro} - {self.fecha_hora}"
    
    class Meta:
        db_table = 'CartaDevolucion'

class DetalleDevolucion(models.Model):
    ESTADO_CHOICES = [
        ('OPERATIVO', 'Operativo'),
        ('DANADO', 'Dañado / Desecho'),
    ]
    carta_devolucion = models.ForeignKey(CartaDevolucion, on_delete=models.CASCADE, related_name='detalles')
    material = models.ForeignKey(Material, on_delete=models.PROTECT)
    cantidad = models.DecimalField(max_digits=10, decimal_places=2)
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='OPERATIVO')

    class Meta:
        db_table = 'DetalleDevolucion'

class CierreAnual(models.Model):
    fecha_inicio = models.DateTimeField(default=timezone.now, verbose_name="Fecha de Inicio del Cierre Anual", validators=[validar_rango_fecha, validar_fecha_recepcion, ])
    #fecha_cierre = models.DateTimeField(auto_now_add=True)
    observaciones = models.TextField(blank=True, null=True)
    fecha_cierre = models.DateTimeField(default=timezone.now, verbose_name="Fecha de Cierre", validators=[validar_rango_fecha, validar_fecha_recepcion])

    def __str__(self):
        return f"Cierre Anual {self.fecha_inicio}"
    class Meta:
        db_table = 'CierreAnual'

class DetalleCierreAnual(models.Model):
    cierre = models.ForeignKey(CierreAnual, on_delete=models.CASCADE)
    material = models.ForeignKey(Material, on_delete=models.PROTECT)
    stock_final = models.IntegerField()

    def __str__(self):
        return f"{self.material} - Stock: {self.stock_final} ({self.cierre.fecha_inicio})"

    class Meta:
        db_table = 'DetalleCierreAnual'

# Tu_app/models.py

class GuiaEntrada(models.Model):
    codigo_guia = models.CharField(max_length=50, unique=True)
    origen = models.CharField(max_length=100, default='Almacen Táchira')
    destino = models.CharField(max_length=100, default='Almacen La Fría')
    archivo_pdf = models.CharField(max_length=255)
    estado = models.CharField(max_length=20, default='PROCESADO')
    fecha_recepcion = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'guia_entrada'  # Vincula con la tabla de phpMyAdmin

class DetalleGuiaMaterial(models.Model):
    guia = models.ForeignKey(GuiaEntrada, on_delete=models.CASCADE, related_name='detalles', db_column='guia_id')
    codigo_material = models.CharField(max_length=50, null=True, blank=True)
    descripcion = models.TextField()
    cantidad = models.DecimalField(max_digits=10, decimal_places=2)
    unidad_medida = models.CharField(max_length=20)

    class Meta:
        db_table = 'detalle_guia_material'

class OrdenSalidaLaFria(models.Model):
    codigo_salida = models.CharField(max_length=50, unique=True)
    guia_origen = models.ForeignKey(GuiaEntrada, on_delete=models.CASCADE, db_column='guia_origen_id')
    personal_retiro_nombre = models.CharField(max_length=150, null=True, blank=True)
    personal_retiro_cedula = models.CharField(max_length=20, null=True, blank=True)
    fecha_impresion = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'orden_salida_lafria'