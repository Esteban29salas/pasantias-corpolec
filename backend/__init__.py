import pymysql
from django.db.backends.base.base import BaseDatabaseWrapper
from django.db.backends.mysql.features import DatabaseFeatures

pymysql.install_as_MySQLdb()

# Omitir la validación de versión mínima de MariaDB
BaseDatabaseWrapper.check_database_version_supported = lambda self: None

# Desactivar la sintaxis RETURNING no soportada por MariaDB 10.4
DatabaseFeatures.can_return_columns_from_insert = False