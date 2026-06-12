#!/usr/bin/env python3
"""
Instala la base de datos en MySQL de XAMPP.
Ejecutar con MySQL iniciado en XAMPP:

  pip install pymysql
  python3 instalar_bd.py
"""

from persistencia import inicializar_bd, probar_conexion


def main() -> None:
  print("Alvarez Fast Food — Instalación MySQL (XAMPP)\n")
  ok, msg = probar_conexion()
  if ok:
    print("✓", msg)
    print("\nTablas listas: contador_facturas, ventas, lineas_venta")
    print("Puede abrir phpMyAdmin: http://localhost/phpmyadmin")
    print(f"Base de datos: alvarez_fastfood")
  else:
    print("✗", msg)
    print("\nPasos:")
    print("  1. Abra XAMPP y pulse Start en MySQL")
    print("  2. Si root tiene contraseña, copie db_local.example.py → db_local.py")
    print("  3. Vuelva a ejecutar: python3 instalar_bd.py")
    print("\nO importe database/schema.sql en phpMyAdmin")


if __name__ == "__main__":
  main()
