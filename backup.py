"""Backup automático de la base de datos MySQL mediante mysqldump."""

from __future__ import annotations

import subprocess
import threading
from datetime import datetime
from pathlib import Path
from typing import Callable

from config import (
  BASE_DIR,
  MYSQL_DATABASE,
  MYSQL_HOST,
  MYSQL_PASSWORD,
  MYSQL_PORT,
  MYSQL_USER,
)

BACKUPS_DIR = BASE_DIR / "backups"
MAX_BACKUPS = 30

# Rutas comunes de mysqldump en instalaciones XAMPP / MySQL nativo en Windows
_RUTAS_WINDOWS = [
  r"C:\xampp\mysql\bin\mysqldump.exe",
  r"C:\xampp64\mysql\bin\mysqldump.exe",
  r"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqldump.exe",
  r"C:\Program Files\MySQL\MySQL Server 5.7\bin\mysqldump.exe",
  r"C:\wamp64\bin\mysql\mysql8.0.31\bin\mysqldump.exe",
]


def _encontrar_mysqldump() -> str | None:
  """Devuelve la ruta a mysqldump o None si no se encuentra."""
  import shutil
  en_path = shutil.which("mysqldump")
  if en_path:
    return en_path
  for ruta in _RUTAS_WINDOWS:
    if Path(ruta).exists():
      return ruta
  return None


def hacer_backup(destino: Path | None = None) -> Path:
  """
  Ejecuta mysqldump y escribe el resultado en `destino`.
  Si destino es None, crea el archivo en BACKUPS_DIR con timestamp.
  Devuelve la ruta del archivo generado.
  Lanza RuntimeError si mysqldump no se encuentra o devuelve error.
  """
  mysqldump = _encontrar_mysqldump()
  if not mysqldump:
    raise RuntimeError(
      "No se encontró mysqldump.\n"
      "Verifique que XAMPP esté instalado en C:\\xampp "
      "o que MySQL esté disponible en el PATH."
    )

  if destino is None:
    BACKUPS_DIR.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    destino = BACKUPS_DIR / f"backup_{ts}.sql"
  else:
    destino.parent.mkdir(parents=True, exist_ok=True)

  cmd = [
    mysqldump,
    f"--host={MYSQL_HOST}",
    f"--port={MYSQL_PORT}",
    f"--user={MYSQL_USER}",
    f"--password={MYSQL_PASSWORD}",
    "--single-transaction",   # sin bloqueos en InnoDB
    "--routines",
    "--add-drop-table",
    MYSQL_DATABASE,
  ]

  resultado = subprocess.run(
    cmd,
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
    timeout=120,
  )

  if resultado.returncode != 0:
    stderr = resultado.stderr.decode("utf-8", errors="replace")
    # mysqldump escribe warnings en stderr incluso cuando tiene éxito;
    # solo falla si el stdout está vacío Y hay un error real
    if not resultado.stdout.strip():
      raise RuntimeError(
        f"mysqldump falló (código {resultado.returncode}):\n{stderr[:300]}"
      )

  destino.write_bytes(resultado.stdout)
  return destino


def rotar_backups(directorio: Path = BACKUPS_DIR, maximo: int = MAX_BACKUPS) -> None:
  """Elimina los backups más antiguos si hay más de `maximo` archivos."""
  archivos = sorted(
    directorio.glob("backup_*.sql"),
    key=lambda p: p.stat().st_mtime,
  )
  for archivo in archivos[: max(0, len(archivos) - maximo)]:
    try:
      archivo.unlink()
    except OSError:
      pass


def backup_automatico_async(
  callback_ok: Callable[[Path], None] | None = None,
  callback_error: Callable[[str], None] | None = None,
) -> None:
  """
  Lanza el backup en un hilo daemon para no bloquear la GUI.
  Llama a callback_ok(ruta) o callback_error(mensaje) al terminar.
  """
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
