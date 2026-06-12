"""Pydantic schemas para la API REST."""

from __future__ import annotations

from typing import Optional
from pydantic import BaseModel, Field


# ── Productos ──────────────────────────────────────────────────────────────

class ProductoOut(BaseModel):
    id: str
    categoria: str
    nombre: str
    precio: int
    ingredientes: str
    activo: bool
    bebida_incluida: bool
    requiere_seleccion_bebida: bool
    bebida_automatica: Optional[str]


class ProductoIn(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=100)
    precio: int = Field(..., gt=0)
    categoria: str = Field(..., min_length=1, max_length=50)
    ingredientes: str = ""


class ProductoUpdate(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=100)
    precio: int = Field(..., gt=0)
    categoria: str = Field(..., min_length=1, max_length=50)
    ingredientes: str = ""


# ── Configuración ──────────────────────────────────────────────────────────

class ConfigValor(BaseModel):
    valor: str


# ── Línea de venta ─────────────────────────────────────────────────────────

class LineaVentaOut(BaseModel):
    producto_id: str
    producto_nombre: str
    cantidad: int
    precio_unitario: int
    subtotal: int
    notas_modificacion: str
    es_bebida_incluida: bool
    categoria: str


# ── Mesa / Carrito ─────────────────────────────────────────────────────────

class AgregarItem(BaseModel):
    producto_id: str
    cantidad: int = Field(1, ge=1)
    notas: str = ""


class AgregarItemCustom(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=100)
    precio: int = Field(..., gt=0)
    categoria: str = Field(..., min_length=1, max_length=50)
    cantidad: int = Field(1, ge=1)
    notas: str = ""


class PreparacionIn(BaseModel):
    categoria: str = Field(..., min_length=1, max_length=50)
    opcion: str = Field(..., min_length=1, max_length=100)


class PreparacionOut(BaseModel):
    id: int
    categoria: str
    opcion: str
    orden: int
    activo: bool


class CobrarMesa(BaseModel):
    metodo_pago: str = Field(..., min_length=1, max_length=30)
    tipo_entrega: str = Field(..., pattern="^(Mesa|Domicilio)$")
    telefono_cliente: str = ""
    monto_recibido: int = 0
    nombre_cliente: str = ""


class MesaEstadoOut(BaseModel):
    mesa_id: str
    items: list[LineaVentaOut]
    total: int


class MesasResumenOut(BaseModel):
    mesas: list[MesaEstadoOut]
    total_mesas_activas: int


# ── Ventas ─────────────────────────────────────────────────────────────────

class FacturaResumen(BaseModel):
    id_factura: str
    fecha_hora: str
    total_pagar: int
    metodo_pago: str
    tipo_entrega: str
    telefono_cliente: str


class FacturaDetalle(FacturaResumen):
    items: list[LineaVentaOut]


# ── Reportes ───────────────────────────────────────────────────────────────

class DesglosePago(BaseModel):
    cantidad: int
    total: int


class CuadreCajaOut(BaseModel):
    fecha: str
    facturas: int
    total_general: int
    efectivo: DesglosePago
    nequi: DesglosePago


# ── Reporte del día ────────────────────────────────────────────────────────

class ResumenDia(BaseModel):
    total_ventas: int
    total_efectivo: int
    total_nequi: int
    total_transferencia: int
    total_otros: int
    total_vueltos: int
    total_facturas: int


class TurnoResumen(BaseModel):
    id: int
    cajero: str
    hora_apertura: str
    hora_cierre: Optional[str] = None
    efectivo_inicial: int
    ventas_efectivo: int
    total_vueltos: int
    efectivo_esperado: int
    total_ventas_turno: int
    num_facturas: int
    estado: str
    anulado: bool = False


class VentaDiaOut(BaseModel):
    id_factura: str
    hora: str
    cajero: str
    turno_id: Optional[int] = None
    metodo_pago: str
    tipo_entrega: str
    monto_recibido: int
    vuelto_dado: int
    total: int
    anulada: bool = False


class ReporteDiaOut(BaseModel):
    fecha: str
    resumen: ResumenDia
    turnos: list[TurnoResumen]
    ventas: list[VentaDiaOut]


# ── Respuestas genéricas ───────────────────────────────────────────────────

class MensajeOk(BaseModel):
    ok: bool = True
    mensaje: str = ""
