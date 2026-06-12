"""Estructuras de datos del sistema de ventas."""

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class Producto:
  id: str
  categoria: str
  nombre: str
  precio: int
  ingredientes: str = ""
  activo: bool = True
  bebida_incluida: bool = False
  requiere_seleccion_bebida: bool = False
  bebida_automatica: Optional[str] = None


@dataclass
class LineaVenta:
  producto_id: str
  producto_nombre: str
  cantidad: int
  precio_unitario: int
  notas_modificacion: str = ""
  es_bebida_incluida: bool = False
  es_personalizado: bool = False
  categoria: str = ""

  @property
  def subtotal(self) -> int:
    return self.cantidad * self.precio_unitario


@dataclass
class Factura:
  id_factura: str
  fecha_hora: str
  items: list[LineaVenta] = field(default_factory=list)
  metodo_pago: str = ""
  tipo_entrega: str = ""
  telefono_cliente: str = ""
  total_pagar: int = 0
  turno_id: Optional[int] = None
  monto_recibido: int = 0
  vuelto_dado: int = 0
  nombre_cliente: str = ""

  def calcular_total(self) -> int:
    return sum(linea.subtotal for linea in self.items)
