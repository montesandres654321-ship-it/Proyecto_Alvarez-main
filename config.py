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

# --- PostgreSQL / Supabase ---
# En producción Supabase inyecta DATABASE_URL. En local se usan variables sueltas.
PG_HOST     = "127.0.0.1"
PG_PORT     = 5432
PG_USER     = "postgres"
PG_PASSWORD = ""
PG_DATABASE = "alvarez_fastfood"

# Cargar configuración local opcional (copie db_local.example.py → db_local.py)
try:
  from db_local import *  # noqa: F403
except ImportError:
  pass

# DATABASE_URL tiene prioridad sobre vars sueltas (Supabase la provee directamente).
DATABASE_URL = os.environ.get("DATABASE_URL", "")

PG_HOST     = os.environ.get("DB_HOST",  os.environ.get("PG_HOST",     PG_HOST))
PG_PORT     = int(os.environ.get("DB_PORT", os.environ.get("PG_PORT",  str(PG_PORT))))
PG_USER     = os.environ.get("DB_USER",  os.environ.get("PG_USER",     PG_USER))
PG_PASSWORD = os.environ.get("DB_PASS",  os.environ.get("PG_PASSWORD", PG_PASSWORD))
PG_DATABASE = os.environ.get("DB_NAME",  os.environ.get("PG_DATABASE", PG_DATABASE))
