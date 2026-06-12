"""Configuración global del sistema de ventas."""

import os
from datetime import datetime
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "ventas.db"  # Solo si se usa SQLite (legacy)

PREFIJO_FACTURA = f"FAC-{datetime.now().year}"
NEQUI_NUMERO = "3143435217"
METODOS_PAGO = ("Efectivo", "Nequi")
TIPOS_ENTREGA = ("Mesa", "Domicilio")

PRECIO_GASEOSA_PERSONAL = 2000
PRECIO_GASEOSA_FAMILIAR = 5000
PRECIO_GASEOSA_MINI = 1000

# --- MySQL / MariaDB (XAMPP) ---
# Valores por defecto de XAMPP. Puede sobreescribir en db_local.py
MYSQL_HOST = "127.0.0.1"
MYSQL_PORT = 3306
MYSQL_USER = "root"
MYSQL_PASSWORD = ""
MYSQL_DATABASE = "alvarez_fastfood"

# Cargar configuración local opcional (copie db_local.example.py → db_local.py)
try:
  from db_local import *  # noqa: F403
except ImportError:
  pass

# Variables de entorno (opcional)
MYSQL_HOST = os.environ.get("MYSQL_HOST", MYSQL_HOST)
MYSQL_PORT = int(os.environ.get("MYSQL_PORT", str(MYSQL_PORT)))
MYSQL_USER = os.environ.get("MYSQL_USER", MYSQL_USER)
MYSQL_PASSWORD = os.environ.get("MYSQL_PASSWORD", MYSQL_PASSWORD)
MYSQL_DATABASE = os.environ.get("MYSQL_DATABASE", MYSQL_DATABASE)
