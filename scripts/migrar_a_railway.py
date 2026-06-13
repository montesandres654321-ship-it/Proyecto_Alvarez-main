"""
Script para migrar la BD local (XAMPP) a Railway.

Uso:
  1. Configure las variables de entorno de Railway:
       DB_HOST=...  DB_PORT=...  DB_USER=...  DB_PASS=...  DB_NAME=...
  2. Ejecute:
       python scripts/migrar_a_railway.py

Requiere que mysqldump y mysql estén disponibles en el PATH
(vienen incluidos con XAMPP en C:\\xampp\\mysql\\bin).
"""

import os
import subprocess
import sys
from datetime import datetime


def main() -> None:
    dump_file = f"backup_migracion_{datetime.now().strftime('%Y%m%d_%H%M%S')}.sql"

    # ── 1. Dump de la BD local ────────────────────────────────────────────
    print(f"Haciendo dump de alvarez_fastfood → {dump_file} ...")
    dump_cmd = [
        "mysqldump",
        "-h", "127.0.0.1",
        "-u", "root",
        "alvarez_fastfood",
        "--no-tablespaces",
        "--single-transaction",
    ]

    with open(dump_file, "w", encoding="utf-8") as f:
        result = subprocess.run(dump_cmd, stdout=f, stderr=subprocess.PIPE)

    if result.returncode != 0:
        print("❌  Error en dump local:")
        print(result.stderr.decode(errors="replace"))
        sys.exit(1)

    print(f"✅  Dump creado: {dump_file}")

    # ── 2. Importar en Railway ────────────────────────────────────────────
    host = os.environ.get("DB_HOST")
    port = os.environ.get("DB_PORT", "3306")
    user = os.environ.get("DB_USER", "root")
    passwd = os.environ.get("DB_PASS", "")
    dbname = os.environ.get("DB_NAME", "alvarez_fastfood")

    if not host:
        print("❌  Falta la variable de entorno DB_HOST.")
        print("    Configure: DB_HOST, DB_PORT, DB_USER, DB_PASS, DB_NAME")
        sys.exit(1)

    print(f"Importando en Railway ({host}:{port}/{dbname}) ...")
    import_cmd = [
        "mysql",
        "-h", host,
        "-P", port,
        "-u", user,
        f"-p{passwd}",
        "--ssl-mode=REQUIRED",
        dbname,
    ]

    with open(dump_file, "r", encoding="utf-8") as f:
        result = subprocess.run(import_cmd, stdin=f, stderr=subprocess.PIPE)

    if result.returncode != 0:
        print("❌  Error importando en Railway:")
        print(result.stderr.decode(errors="replace"))
        sys.exit(1)

    print("✅  Migración a Railway completada exitosamente.")
    print(f"    Dump guardado en: {dump_file}")


if __name__ == "__main__":
    main()
