import datetime, re
from django.core.exceptions import ValidationError

CARACTERES_ESPECIALES = set('!"#$%&/()=?¡¿\¬|°{}[]`+-*<>;:.,´^^')

def _textos_sin_espacios(value):
    #hace que cualquier texto no se comforme solo con espacios
    if value:
        texto = value.strip().replace(".","").replace(" ","")
        if not texto:
            raise ValidationError("Las observaciones no pueden ser solo espacios en blanco.")
        return texto
    return ""

def _validar_sin_especiales(value):
    #any() devuelve True si al menos un caracter del texto esta en el conjunto especial
    if any(char in CARACTERES_ESPECIALES for char in value):
        raise ValidationError("El campo no permite caracteres especiales.")

def validar_con_especiales(value):
    #not any() devuelve false si al menos un caracter del texto esta en el conjundo especial
    if not any(char in CARACTERES_ESPECIALES for char in value):
        raise ValidationError("La contraseña debe contener al menos un caracter especial.")

def validar_rango_fecha(value):
    #garantiza que el año este entre 2023 y 2100.
    if value and not (2023 <= value.year <= 2100):
        raise ValidationError("La fecha debe registrarse entre los años 2023 y 2100.")

def validar_fecha_hoy(value):
    """Garantiza que la fecha sea estrictamente el día de hoy."""
    if value and value != datetime.date.today():
        raise ValidationError("La fecha de salida debe corresponder al día de hoy.")

def validar_codigo(value):
    #Garantiza que el codigo tenga entre 6 y 10 caracteres (sin espacios).
    if not value:
        return
    codigo = str(value).strip()
    _validar_sin_especiales(codigo)
    if " " in codigo:
        raise ValidationError("El codigo no puede contener espacion en blanco.")
    if not codigo.isdigit():
        raise ValidationError("EL codigo solo debe contener numero (sin letras, espcacios ni caracteres especiales)")
    # Permite únicamente de 1 a 4 dígitos numéricos


# Validador exclusivo para el NÚMERO DE ACTA (1 a 9999)
def validar_numero_acta(value):
    try:
        val = int(value)
        if val < 1 or val > 9999:
            raise ValidationError("El número de acta debe ser un valor entero de 1 a 4 dígitos (1 a 9999).")
    except (ValueError, TypeError):
        raise ValidationError("El número de acta debe ser un número entero.")

def validar_cedula(value):
    #Garantiza numeros de cedula entre 7 y 10 digitos.
    cedula = str(value).strip().replace(".","").replace(" ","")
    if not cedula.isdigit():
        raise ValidationError("La cedula solo debe contener numeros.")
    if not (7 <= len(cedula) <= 10):
        raise ValidationError("la cedula debe tener entre 7 y 10 digitos.")

def validar_observaciones(value):
    #valida maximo 500 y minimo 10 caracteres y evita textos de solo espacios
    #se llama a la funcion pasandole (value) y guardando el retorno
    texto = _textos_sin_espacios(value)
    #se valida la longitud (evaluando la variable devuelta)
    #logica invertida: lanza error si es menor a 10 o si es mayor a 500
    if not (10 <= len(texto) <= 500):
        raise ValidationError("Las observaciones no pueden exceder los 500 caracteres y tienen que ser mayor a 10 caracteres")

def validar_nombres(value):
    if not value:
        return
    #valida maximo 100 caracteres y minimo 10 caracteres y evita solo espacios
    texto = _textos_sin_espacios(value)
    _validar_sin_especiales(str(value).replace(" ", ""))
    if any (char.isdigit() for char in texto):
        raise ValidationError("El campo de nombre no puede contener numero.")
    if not (5 <= len(texto) <= 50):
        raise ValidationError("el campo de nombre no pueden exceder los 100 caracteres y tienen que ser mayor a 10 caracteres")

def validar_fecha_recepcion(value):
    #Permite el registro de fechas pasadas y del dia de hoy, pero rechaza fechas futuras
    if not value:
        return

    fecha_evaluar = value.date() if isinstance(value, datetime.datetime) else value
    hoy = datetime.date.today()

    #bloquear fechas futuras (posteriores a hoy)
    if fecha_evaluar > hoy:
        raise ValidationError("la fecha ingresada no puede ser una fecha posterior a hoy.")

    #(Opciona) limite inferion para evitar fechas demasiado antiguas
    if fecha_evaluar.year < 2023:
        raise ValidationError("la fecha ingresada no puede ser anteria al año 2023.")

def validar_stock(value):
    #Garantiza que el stock sea un numero entero positivo
    try:
            val = float(value)
            if val  < 0:
                raise ValidationError("El stock no puede ser un número negativo.")
    except (ValueError, TypeError):
        raise ValidationError("Ingrese un número válido para el stock.")

def validar_unidad_medida(value):
    #Garantiza que la unidad de medida sea una cadena de texto no vacía y sin caracteres especiales
    valor = str(value).strip().upper()
    if valor in ['METRO', 'METROS', 'M']:
        return 'MTS'
    return valor
    if not value or not isinstance(value, str):
        raise ValidationError("La unidad de medida debe ser una cadena de texto no vacía.")
    _validar_sin_especiales(value) 

def validar_personal_duplicado(attrs, instance=None, model=None):
    """
    Valida que no exista un personal con el mismo nombre y apellido en la base de datos.
    Si se proporciona una instancia, se excluye de la validación (para actualizaciones).
    """
    nombre = attrs.get('nombre')
    apellido = attrs.get('apellido')

    if nombre and apellido:
        # Filtra los registros que coinciden con el nombre y apellido
        queryset = model.objects.filter(nombre=nombre, apellido=apellido)
        if instance:
            # Excluye la instancia actual si se está actualizando
            queryset = queryset.exclude(pk=instance.pk)
        if queryset.exists():
            raise ValidationError("Ya existe un personal con el mismo nombre y apellido.")
    return attrs