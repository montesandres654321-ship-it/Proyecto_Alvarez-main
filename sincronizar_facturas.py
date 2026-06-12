#!/usr/bin/env python3
"""Corrige el contador de facturas si aparece error de duplicado (FAC-2026-0003)."""

from persistencia import inicializar_bd, sincronizar_contador_facturas
from config import PREFIJO_FACTURA


def main() -> None:
  inicializar_bd()
  ultimo = sincronizar_contador_facturas()
  print(f"✓ Contador sincronizado.")
  print(f"  Última factura en uso: {PREFIJO_FACTURA}-{ultimo:04d}")
  print(f"  La próxima venta será: {PREFIJO_FACTURA}-{ultimo + 1:04d}")


if __name__ == "__main__":
  main()
