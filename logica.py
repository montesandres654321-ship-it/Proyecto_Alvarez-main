"""Lógica de negocio: carrito, pedidos personalizados y cierre de venta."""

from __future__ import annotations

import re
import time

from modelos import Factura, LineaVenta, Producto
from menu_data import menu_por_id


class Carrito:
  def __init__(self) -> None:
    self.lineas: list[LineaVenta] = []

  def esta_vacio(self) -> bool:
    return len(self.lineas) == 0

  def subtotal(self) -> int:
    return sum(l.subtotal for l in self.lineas)

  def cantidad_items(self) -> int:
    return sum(l.cantidad for l in self.lineas)

  def agregar_producto(
    self,
    producto: Producto,
    cantidad: int = 1,
    notas: str = "",
  ) -> LineaVenta:
    if cantidad < 1:
      raise ValueError("La cantidad debe ser al menos 1")

    linea = LineaVenta(
      producto_id=producto.id,
      producto_nombre=producto.nombre,
      cantidad=cantidad,
      precio_unitario=producto.precio,
      notas_modificacion=notas.strip(),
      categoria=producto.categoria,
    )
    self.lineas.append(linea)
    return linea

  def agregar_personalizado(
    self,
    categoria: str,
    nombre: str,
    precio: int,
    cantidad: int = 1,
    notas: str = "",
  ) -> LineaVenta:
    nombre = nombre.strip()
    if not nombre:
      raise ValueError("Indique el nombre del pedido personalizado")
    if precio < 0:
      raise ValueError("El precio no puede ser negativo")
    if cantidad < 1:
      raise ValueError("La cantidad debe ser al menos 1")

    slug = re.sub(r"[^a-z0-9]+", "-", categoria.lower())[:12]
    linea = LineaVenta(
      producto_id=f"custom-{slug}-{time.time_ns()}",
      producto_nombre=f"[Personalizado] {nombre}",
      cantidad=cantidad,
      precio_unitario=precio,
      notas_modificacion=notas.strip(),
      es_personalizado=True,
      categoria=categoria,
    )
    self.lineas.append(linea)
    return linea

  def quitar_ultima_linea(self) -> bool:
    if not self.lineas:
      return False
    self.lineas.pop()
    return True

  def limpiar(self) -> None:
    self.lineas.clear()

  def ver_resumen(self) -> list[tuple[int, LineaVenta]]:
    return list(enumerate(self.lineas, start=1))

  def construir_factura(
    self,
    id_factura: str,
    fecha_hora: str,
    metodo_pago: str,
    tipo_entrega: str,
    telefono_cliente: str,
  ) -> Factura:
    factura = Factura(
      id_factura=id_factura,
      fecha_hora=fecha_hora,
      items=list(self.lineas),
      metodo_pago=metodo_pago,
      tipo_entrega=tipo_entrega,
      telefono_cliente=telefono_cliente,
    )
    factura.total_pagar = factura.calcular_total()
    return factura


def formatear_pesos(valor: int) -> str:
  return f"${valor:,.0f}".replace(",", ".")


def etiqueta_pago(metodo: str) -> str:
  """Texto visible para Nequi o Efectivo."""
  if metodo == "Nequi":
    return "Nequi"
  if metodo == "Efectivo":
    return "Efectivo"
  return metodo or "—"


def es_nequi(metodo: str) -> bool:
  return metodo == "Nequi"


def validar_metodo_pago(valor: str) -> bool:
  from config import METODOS_PAGO
  return valor in METODOS_PAGO


def validar_tipo_entrega(valor: str) -> bool:
  from config import TIPOS_ENTREGA
  return valor in TIPOS_ENTREGA


def obtener_producto(producto_id: str) -> Producto | None:
  return menu_por_id().get(producto_id)


def parsear_precio(texto: str) -> int:
  """Convierte '50000', '50.000' o '$50.000' a entero COP."""
  limpio = re.sub(r"[^\d]", "", texto.strip())
  if not limpio:
    raise ValueError("Ingrese un precio válido")
  return int(limpio)
