"""Generación de tickets de texto para impresora térmica y cliente."""

from __future__ import annotations

from config import DATA_DIR, NEQUI_NUMERO
from logica import etiqueta_pago, formatear_pesos
from modelos import Factura
from persistencia import get_config


def _linea(sep: str = "-", ancho: int = 40) -> str:
  return sep * ancho


def _prefijo_linea(item) -> str:
  if item.es_personalizado:
    return "  [CUSTOM] "
  if item.es_bebida_incluida:
    return "  [BEB] "
  return ""


def ticket_cocina(factura: Factura) -> str:
  lineas = [
    _linea("="),
    "  ALVAREZ FAST FOOD - COCINA",
    "  Copa Mundial 2026",
    _linea("="),
    f"Factura: {factura.id_factura}",
    f"Hora: {factura.fecha_hora}",
    f"Entrega: {factura.tipo_entrega.upper()}",
  ]
  if factura.telefono_cliente:
    lineas.append(f"Tel: {factura.telefono_cliente}")

  lineas.append(_linea())
  for item in factura.items:
    prefijo = _prefijo_linea(item)
    lineas.append(f"{prefijo}{item.cantidad}x {item.producto_nombre}")
    if item.categoria and item.es_personalizado:
      lineas.append(f"     ({item.categoria})")
    if item.notas_modificacion:
      lineas.append(f"     >> {item.notas_modificacion}")

  lineas.extend([_linea(), "  *** PREPARAR PEDIDO ***", _linea("="), ""])
  return "\n".join(lineas)


def ticket_cliente(factura: Factura) -> str:
  lineas = [
    _linea("="),
    "     ALVAREZ FAST FOOD",
    "   Edicion Copa Mundial 2026",
    _linea("="),
    f"No: {factura.id_factura}",
    f"Fecha: {factura.fecha_hora}",
    f"Entrega: {factura.tipo_entrega}",
    _linea(),
    f"  PAGO: {etiqueta_pago(factura.metodo_pago).upper()}",
  ]
  if factura.metodo_pago == "Nequi":
    lineas.append(f"  Cuenta Nequi: {get_config('nequi_numero', NEQUI_NUMERO)}")
  elif factura.metodo_pago == "Efectivo":
    lineas.append("  Pagado en efectivo")

  lineas.append(_linea())
  for item in factura.items:
    nombre = item.producto_nombre[:32]
    sub = item.subtotal
    lineas.append(f"  {item.cantidad} {nombre}")
    lineas.append(
      f"      {formatear_pesos(item.precio_unitario)} c/u = {formatear_pesos(sub)}"
    )
    if item.notas_modificacion:
      lineas.append(f"      Nota: {item.notas_modificacion}")

  lineas.extend(
    [
      _linea(),
      f"  TOTAL: {formatear_pesos(factura.total_pagar)}",
      _linea("="),
      "  Gracias por su compra!",
      f"  {get_config('domicilio_mensaje', 'Domicilio sin costo adicional')}",
      "",
    ]
  )
  return "\n".join(lineas)


def guardar_tickets(factura: Factura) -> tuple[str, str]:
  dir_tickets = DATA_DIR / "tickets"
  dir_tickets.mkdir(parents=True, exist_ok=True)
  base = factura.id_factura.replace("/", "-")
  ruta_cocina = dir_tickets / f"{base}_cocina.txt"
  ruta_cliente = dir_tickets / f"{base}_cliente.txt"
  ruta_cocina.write_text(ticket_cocina(factura), encoding="utf-8")
  ruta_cliente.write_text(ticket_cliente(factura), encoding="utf-8")
  return str(ruta_cocina), str(ruta_cliente)
