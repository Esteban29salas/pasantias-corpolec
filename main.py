import os
import sys
import threading
import webview
from waitress import serve
from django.core.management import execute_from_command_line
from django.core.wsgi import get_wsgi_application
from django.contrib.staticfiles.handlers import StaticFilesHandler

# 1. Configurar variables del proyecto Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

# 2. Cargar la aplicación WSGI
from backend.wsgi import application

application = StaticFilesHandler(get_wsgi_application())

def iniciar_servidor():
    """Ejecuta Django bajo el servidor de producción ligero Waitress."""
    serve(application, host='127.0.0.1', port=8000, _quiet=True)

if __name__ == '__main__':
    # Aplicar migraciones pendientes antes de abrir
    execute_from_command_line(['manage.py', 'migrate'])

    # Iniciar el servidor Django en un hilo secundario
    hilo_servidor = threading.Thread(target=iniciar_servidor, daemon=True)
    hilo_servidor.start()

    # Abrir la ventana nativa apuntando a la URL del sistema
    webview.create_window(
        title='Sistema de Gestión de Almacén - Corpoelec',
        url='http://127.0.0.1:5173', # O la ruta de tus plantillas HTML
        width=1280,
        height=800,
        min_size=(900, 600)
    )
    
    # Iniciar el motor gráfico de la ventana
    webview.start()