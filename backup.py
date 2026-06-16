"""Backup de la base de datos PostgreSQL mediante pg_dump (o JSON como fallback)."""

from __future__ import annotations

import json
import shutil
import subprocess
import threading
from datetime import datetime
from pathlib import Path
from typing import Callable

from config import BASE_DIR, DATABASE_URL, PG_DATABASE, PG_HOST, PG_PASSWORD, PG_PORT, PG_USER

BACKUPS_DIR = BASE_DIR / "backups"
MAX_BACKUPS = 30


def _encontrar_pg_dump() -> str | None:
  """Devuelve la ruta a pg_dump o None si no se encuentra."""
  en_path = shutil.which("pg_dump")
  if en_path:
    return en_path
  rutas_windows = [
    r"C:\Program Files\PostgreSQL\16\bin\pg_dump.exe",
    r"C:\Program Files\PostgreSQL\15\bin\pg_dump.exe",
    r"C:\Program Files\PostgreSQL\14\bin\pg_dump.exe",
  ]
  for ruta in rutas_windows:
    if Path(ruta).exists():
      return ruta
  return None


def _hacer_backup_json(destino: Path) -> Path:
  """Exporta las tablas principales a JSON como fallback cuando no hay pg_dump."""
  import psycopg2
  import psycopg2.extras

  conn_kwargs: dict = {"cursor_factory": psycopg2.extras.RealDictCursor}
  if DATABASE_URL:
    conn_kwargs["dsn"] = DATABASE_URL
  else:
    conn_kwargs.update({"host": PG_HOST, "port": PG_PORT, "user": PG_USER,
                        "password": PG_PASSWORD, "dbname": PG_DATABASE})

  tablas = [
    "ventas", "lineas_venta", "productos", "configuracion",
    "turnos", "preparaciones", "insumos_catalogo", "compras",
    "compras_detalle", "trabajadores", "nomina_semana", "nomina_detalle",
    "contador_facturas",
  ]
  datos: dict = {}
  with psycopg2.connect(**conn_kwargs) as conn:
    with conn.cursor() as cur:
      for tabla in tablas:
        try:
          cur.execute(f"SELECT * FROM {tabla}")
          filas = cur.fetchall()
          datos[tabla] = [dict(f) for f in filas]
        except Exception:
          datos[tabla] = []

  destino.parent.mkdir(parents=True, exist_ok=True)
  destino.write_text(
    json.dumps(datos, ensure_ascii=False, indent=2, default=str),
    encoding="utf-8",
  )
  return destino


def hacer_backup(destino: Path | None = None) -> Path:
  """
  Ejecuta pg_dump y escribe el resultado en `destino`.
  Si pg_dump no está disponible, exporta las tablas a JSON.
  Devuelve la ruta del archivo generado.
  """
  BACKUPS_DIR.mkdir(parents=True, exist_ok=True)
  ts = datetime.now().strftime("%Y%m%d_%H%M%S")

  pg_dump = _encontrar_pg_dump()

  if pg_dump is None:
    if destino is None:
      destino = BACKUPS_DIR / f"backup_{ts}.json"
    return _hacer_backup_json(destino)

  if destino is None:
    destino = BACKUPS_DIR / f"backup_{ts}.sql"
  else:
    destino.parent.mkdir(parents=True, exist_ok=True)

  env_cmd: dict = {}
  if DATABASE_URL:
    cmd = [pg_dump, "--no-password", "--clean", "--if-exists", DATABASE_URL]
  else:
    cmd = [
      pg_dump,
      f"--host={PG_HOST}",
      f"--port={PG_PORT}",
      f"--username={PG_USER}",
      "--no-password",
      "--clean",
      "--if-exists",
      PG_DATABASE,
    ]
    env_cmd = {"PGPASSWORD": PG_PASSWORD}

  import os
  env = {**os.environ, **env_cmd}

  resultado = subprocess.run(
    cmd,
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
    timeout=120,
    env=env,
  )

  if resultado.returncode != 0 or not resultado.stdout.strip():
    # pg_dump falló — caer a JSON
    json_destino = destino.with_suffix(".json")
    return _hacer_backup_json(json_destino)

  destino.write_bytes(resultado.stdout)
  return destino


def rotar_backups(directorio: Path = BACKUPS_DIR, maximo: int = MAX_BACKUPS) -> None:
  """Elimina los backups más antiguos si hay más de `maximo` archivos."""
  patrones = list(directorio.glob("backup_*.sql")) + list(directorio.glob("backup_*.json"))
  archivos = sorted(patrones, key=lambda p: p.stat().st_mtime)
  for archivo in archivos[: max(0, len(archivos) - maximo)]:
    try:
      archivo.unlink()
    except OSError:
      pass


def backup_automatico_async(
  callback_ok: Callable[[Path], None] | None = None,
  callback_error: Callable[[str], None] | None = None,
) -> None:
  """Lanza el backup en un hilo daemon para no bloquear la GUI."""
  def _run() -> None:
    try:
      ruta = hacer_backup()
      rotar_backups()
      if callback_ok:
        callback_ok(ruta)
    except Exception as exc:
      if callback_error:
        callback_error(str(exc))

  threading.Thread(target=_run, daemon=True).start()
