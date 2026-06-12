"""Endpoints de consulta de ventas."""

import backend  # noqa: F401

from fastapi import APIRouter, HTTPException, Query
from persistencia import listar_ventas, listar_ventas_por_fecha, obtener_venta_por_id, ErrorBaseDatos
from backend.schemas import FacturaDetalle, FacturaResumen, LineaVentaOut

router = APIRouter(prefix="/ventas", tags=["ventas"])


def _item_dict_to_out(item: dict) -> LineaVentaOut:
    # _lineas_de_factura devuelve "producto_id" y "producto" (no "producto_nombre")
    return LineaVentaOut(
        producto_id=item["producto_id"],
        producto_nombre=item["producto"],
        cantidad=item["cantidad"],
        precio_unitario=item["precio_unitario"],
        subtotal=item["cantidad"] * item["precio_unitario"],
        notas_modificacion=item.get("notas_modificacion", ""),
        es_bebida_incluida=bool(item.get("es_bebida_incluida", False)),
        categoria=item.get("categoria", ""),
    )


def _venta_dict_to_resumen(v: dict) -> FacturaResumen:
    return FacturaResumen(
        id_factura=v["id_factura"],
        fecha_hora=str(v["fecha_hora"]),
        total_pagar=int(v["total_pagar"]),
        metodo_pago=v["metodo_pago"],
        tipo_entrega=v["tipo_entrega"],
        telefono_cliente=v.get("telefono_cliente") or "",
    )


@router.get("/", response_model=list[FacturaResumen])
def listar(
    fecha: str | None = Query(None, description="YYYY-MM-DD — filtra por día"),
    limit: int = Query(50, ge=1, le=500),
):
    try:
        if fecha:
            ventas = listar_ventas_por_fecha(fecha)
        else:
            ventas = listar_ventas(limite=limit)
    except ErrorBaseDatos as e:
        raise HTTPException(status_code=500, detail=str(e))
    return [_venta_dict_to_resumen(v) for v in ventas]


@router.get("/{id_factura}", response_model=FacturaDetalle)
def obtener(id_factura: str):
    try:
        venta = obtener_venta_por_id(id_factura)
    except ErrorBaseDatos as e:
        raise HTTPException(status_code=500, detail=str(e))
    if venta is None:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    r = _venta_dict_to_resumen(venta)
    return FacturaDetalle(
        id_factura=r.id_factura,
        fecha_hora=r.fecha_hora,
        total_pagar=r.total_pagar,
        metodo_pago=r.metodo_pago,
        tipo_entrega=r.tipo_entrega,
        telefono_cliente=r.telefono_cliente,
        items=[_item_dict_to_out(i) for i in venta.get("items", [])],
    )
