#!/usr/bin/env python3
"""Migra ventas del archivo SQLite antiguo (data/ventas.db) a MySQL."""

import sqlite3
from pathlib import Path

from config import DB_PATH
from persistencia import inicializar_bd, guardar_factura
from modelos import Factura, LineaVenta


def main() -> None:
  if not DB_PATH.exists():
    print("No hay archivo SQLite en", DB_PATH)
    return

  inicializar_bd()
  conn = sqlite3.connect(DB_PATH)
  conn.row_factory = sqlite3.Row

  ventas = conn.execute("SELECT * FROM ventas ORDER BY fecha_hora").fetchall()
  print(f"Migrando {len(ventas)} ventas...")

  for v in ventas:
    lineas_raw = conn.execute(
      "SELECT * FROM lineas_venta WHERE id_factura = ? ORDER BY id",
      (v["id_factura"],),
    ).fetchall()

    items = [
      LineaVenta(
        producto_id=l["producto_id"],
        producto_nombre=l["producto_nombre"],
        cantidad=l["cantidad"],
        precio_unitario=l["precio_unitario"],
        notas_modificacion=l["notas_modificacion"] or "",
        es_bebida_incluida=bool(l["es_bebida_incluida"]),
        es_personalizado=bool(l["es_personalizado"] if "es_personalizado" in l.keys() else 0),
        categoria=l["categoria"] if "categoria" in l.keys() else "",
      )
      for l in lineas_raw
    ]

    factura = Factura(
      id_factura=v["id_factura"],
      fecha_hora=v["fecha_hora"],
      items=items,
      metodo_pago=v["metodo_pago"],
      tipo_entrega=v["tipo_entrega"],
      telefono_cliente=v["telefono_cliente"] or "",
      total_pagar=v["total_pagar"],
    )
    try:
      guardar_factura(factura)
      print("  OK", v["id_factura"])
    except Exception as e:
      print("  Omitida (ya existe?)", v["id_factura"], e)

  conn.close()
  print("Migración finalizada.")


if __name__ == "__main__":
  main()
