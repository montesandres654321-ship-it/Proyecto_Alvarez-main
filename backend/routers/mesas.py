"""Endpoints de estado de mesas y carrito — F1-B."""

import backend  # noqa: F401
import logging
import threading
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, HTTPException, status

logger = logging.getLogger("uvicorn.error")

from logica import Carrito
from modelos import LineaVenta
from persistencia import (
    obtener_producto_por_id,
    guardar_factura,
    siguiente_id_factura,
    turno_activo,
    ErrorBaseDatos,
)
from backend.schemas import (
    AgregarItem,
    AgregarItemCustom,
    CobrarMesa,
    FacturaDetalle,
    LineaVentaOut,
    MensajeOk,
    MesaEstadoOut,
    MesasResumenOut,
)
from backend.websocket import schedule_broadcast

router = APIRouter(prefix="/mesas", tags=["mesas"])

_state: dict[str, Carrito] = {}
# Un lock por mesa — operaciones en mesas distintas corren en paralelo
_mesa_locks: dict[str, threading.Lock] = {}
_registry_lock = threading.Lock()  # solo protege el acceso a los dicts de locks


def _get_mesa_lock(mesa_id: str) -> threading.Lock:
    with _registry_lock:
        if mesa_id not in _mesa_locks:
            _mesa_locks[mesa_id] = threading.Lock()
        return _mesa_locks[mesa_id]


def _bg_guardar_ticket(factura) -> None:
    try:
        from tickets import guardar_tickets
        guardar_tickets(factura)
    except Exception as e:
        logger.warning("Ticket no generado para %s: %s", factura.id_factura, e)


# ── Helpers ────────────────────────────────────────────────────────────────

def _linea_to_out(linea: LineaVenta) -> LineaVentaOut:
    return LineaVentaOut(
        producto_id=linea.producto_id,
        producto_nombre=linea.producto_nombre,
        cantidad=linea.cantidad,
        precio_unitario=linea.precio_unitario,
        subtotal=linea.subtotal,
        notas_modificacion=linea.notas_modificacion,
        es_bebida_incluida=linea.es_bebida_incluida,
        categoria=linea.categoria,
    )


def _carrito_to_out(mesa_id: str, carrito: Carrito) -> MesaEstadoOut:
    return MesaEstadoOut(
        mesa_id=mesa_id,
        items=[_linea_to_out(l) for l in carrito.lineas],
        total=carrito.subtotal(),
    )


def _get_or_create(mesa_id: str) -> Carrito:
    if mesa_id not in _state:
        _state[mesa_id] = Carrito()
    return _state[mesa_id]


# ── Endpoints ──────────────────────────────────────────────────────────────

@router.get("/", response_model=MesasResumenOut)
def listar():
    with _registry_lock:
        activas = [
            _carrito_to_out(mid, c)
            for mid, c in _state.items()
            if not c.esta_vacio()
        ]
    return MesasResumenOut(mesas=activas, total_mesas_activas=len(activas))



@router.get("/{mesa_id}", response_model=MesaEstadoOut)
def obtener(mesa_id: str):
    with _get_mesa_lock(mesa_id):
        carrito = _state.get(mesa_id)
    if carrito is None:
        return MesaEstadoOut(mesa_id=mesa_id, items=[], total=0)
    return _carrito_to_out(mesa_id, carrito)


@router.post("/{mesa_id}/items", response_model=MesaEstadoOut, status_code=status.HTTP_201_CREATED)
def agregar_item(mesa_id: str, body: AgregarItem):
    try:
        producto = obtener_producto_por_id(body.producto_id)
    except ErrorBaseDatos as e:
        raise HTTPException(status_code=500, detail=str(e))

    if producto is None:
        raise HTTPException(status_code=404, detail=f"Producto '{body.producto_id}' no encontrado")
    if not producto.activo:
        raise HTTPException(status_code=422, detail=f"Producto '{body.producto_id}' está inactivo")

    with _get_mesa_lock(mesa_id):
        carrito = _get_or_create(mesa_id)
        carrito.agregar_producto(producto, body.cantidad, body.notas)
        out = _carrito_to_out(mesa_id, carrito)

    schedule_broadcast({"evento": "mesa_actualizada", "mesa": mesa_id, "data": out.model_dump()})
    return out


@router.post("/{mesa_id}/items/custom", response_model=MesaEstadoOut, status_code=status.HTTP_201_CREATED)
def agregar_item_custom(mesa_id: str, body: AgregarItemCustom):
    with _get_mesa_lock(mesa_id):
        carrito = _get_or_create(mesa_id)
        carrito.agregar_personalizado(
            categoria=body.categoria,
            nombre=body.nombre,
            precio=body.precio,
            cantidad=body.cantidad,
            notas=body.notas,
        )
        out = _carrito_to_out(mesa_id, carrito)
    schedule_broadcast({"evento": "mesa_actualizada", "mesa": mesa_id, "data": out.model_dump()})
    return out


@router.delete("/{mesa_id}/items/{linea_idx}", response_model=MesaEstadoOut)
def quitar_item(mesa_id: str, linea_idx: int):
    with _get_mesa_lock(mesa_id):
        carrito = _state.get(mesa_id)
        if carrito is None or carrito.esta_vacio():
            raise HTTPException(status_code=404, detail="Mesa vacía o no existe")
        if linea_idx < 0 or linea_idx >= len(carrito.lineas):
            raise HTTPException(
                status_code=422,
                detail=f"Índice {linea_idx} fuera de rango (0–{len(carrito.lineas)-1})",
            )
        carrito.lineas.pop(linea_idx)
        if carrito.esta_vacio():
            del _state[mesa_id]
            out = MesaEstadoOut(mesa_id=mesa_id, items=[], total=0)
        else:
            out = _carrito_to_out(mesa_id, carrito)

    schedule_broadcast({"evento": "mesa_actualizada", "mesa": mesa_id, "data": out.model_dump()})
    return out


@router.post("/{mesa_id}/cobrar", response_model=FacturaDetalle)
def cobrar(mesa_id: str, body: CobrarMesa, bg: BackgroundTasks):
    try:
        turno = turno_activo()
    except ErrorBaseDatos as e:
        raise HTTPException(status_code=500, detail=str(e))
    if turno is None:
        raise HTTPException(
            status_code=400,
            detail="No hay turno abierto. Abre la caja primero desde la sección Reportes.",
        )

    with _get_mesa_lock(mesa_id):
        carrito = _state.get(mesa_id)
        if carrito is None or carrito.esta_vacio():
            raise HTTPException(status_code=422, detail="La mesa no tiene items")

        try:
            id_f = siguiente_id_factura()
        except ErrorBaseDatos as e:
            raise HTTPException(status_code=500, detail=str(e))

        fh = datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")
        total_carrito = carrito.subtotal()
        vuelto_dado = (
            max(0, body.monto_recibido - total_carrito)
            if body.metodo_pago == "Efectivo" and body.monto_recibido > 0
            else 0
        )
        factura = carrito.construir_factura(
            id_factura=id_f,
            fecha_hora=fh,
            metodo_pago=body.metodo_pago,
            tipo_entrega=body.tipo_entrega,
            telefono_cliente=body.telefono_cliente,
        )
        factura.turno_id       = turno["id"]
        factura.monto_recibido = body.monto_recibido if body.metodo_pago == "Efectivo" else 0
        factura.vuelto_dado    = vuelto_dado
        factura.nombre_cliente = body.nombre_cliente or ""

        try:
            guardar_factura(factura)
        except ErrorBaseDatos as e:
            raise HTTPException(status_code=500, detail=f"No se pudo guardar la venta: {e}")

        del _state[mesa_id]

    detalle = FacturaDetalle(
        id_factura=factura.id_factura,
        fecha_hora=factura.fecha_hora,
        total_pagar=factura.total_pagar,
        metodo_pago=factura.metodo_pago,
        tipo_entrega=factura.tipo_entrega,
        telefono_cliente=factura.telefono_cliente or "",
        items=[_linea_to_out(l) for l in factura.items],
    )
    bg.add_task(_bg_guardar_ticket, factura)
    schedule_broadcast({"evento": "venta_completada", "mesa": mesa_id, "data": detalle.model_dump()})
    return detalle


@router.delete("/{mesa_id}", response_model=MensajeOk)
def limpiar_mesa(mesa_id: str):
    with _get_mesa_lock(mesa_id):
        if mesa_id in _state:
            del _state[mesa_id]
    schedule_broadcast({"evento": "mesa_cerrada", "mesa": mesa_id, "data": None})
    return MensajeOk(mensaje=f"Mesa '{mesa_id}' limpiada")
