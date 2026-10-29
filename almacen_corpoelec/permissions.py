from django.core import signing
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.permissions import BasePermission, SAFE_METHODS

from .models import Usuario

TOKEN_SALT = 'corpoelec.usuario.auth'
TOKEN_MAX_AGE = 60 * 60 * 12


def generar_token_usuario(usuario):
    return signing.dumps({'usuario_id': usuario.pk}, salt=TOKEN_SALT)


class UsuarioTokenAuthentication(BaseAuthentication):
    keyword = 'Bearer'

    def authenticate(self, request):
        encabezado = request.headers.get('Authorization', '')
        partes = encabezado.split()

        if not partes or partes[0].lower() != self.keyword.lower():
            return None

        if len(partes) != 2:
            raise AuthenticationFailed('Token de autenticación inválido.')

        try:
            datos = signing.loads(partes[1], salt=TOKEN_SALT, max_age=TOKEN_MAX_AGE)
        except signing.SignatureExpired:
            raise AuthenticationFailed('La sesión ha expirado. Inicie sesión nuevamente.')
        except signing.BadSignature:
            raise AuthenticationFailed('Token de autenticación inválido.')

        try:
            usuario = Usuario.objects.get(pk=datos.get('usuario_id'))
        except Usuario.DoesNotExist:
            raise AuthenticationFailed('El usuario autenticado no existe.')

        return (usuario, partes[1])


class EsAdministrador(BasePermission):
    message = 'Esta acción es exclusiva de usuarios administradores.'

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and getattr(request.user, 'rol', None) == 'admin'
        )


class SoloLecturaOAdmin(BasePermission):
    message = 'Solo un administrador puede modificar o eliminar estos registros.'

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        if request.method in SAFE_METHODS:
            return True

        return getattr(request.user, 'rol', None) == 'admin'


class CrearOAdminEditar(BasePermission):
    message = (
        'Los usuarios normales solo pueden registrar nuevos documentos. '
        'Editar o eliminar requiere rol de administrador.'
    )

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        if request.method in SAFE_METHODS or request.method == 'POST':
            return True

        return getattr(request.user, 'rol', None) == 'admin'
