"""Endpoints para gestión de créditos (ventas fiadas)."""

import backend  # noqa: F401

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from persistencia import conexion, ErrorBaseDatos

router = APIRouter(prefix="/creditos", tags=["creditos"])


class CreditoIn(BaseModel):
    id_factura: str = ""
    nombre_cliente: str
    total_deuda: int
    cajero: str = ""


class PagoIn(BaseModel):
    monto: int
    metodo_pago: str = "Efectivo"
    cajero: str = ""


# ── GET /creditos — pendientes (público) ──────────────────────────────────────
@router.get("")
@router.get("/", include_in_schema=False)
def listar_pendientes():
    try:
        with conexion() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, id_factura, nombre_cliente, total_deuda,
                           total_pagado, estado, fecha_credito, cajero,
                           (total_deuda - total_pagado) AS saldo
                    FROM creditos
                    WHERE estado = 'pendiente'
                    ORDER BY fecha_credito DESC
                    """
                )
                return cur.fetchall() or []
    except ErrorBaseDatos as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── GET /creditos/historial — créditos pagados ───────────────────────────────
@router.get("/historial")
def listar_pagados():
    try:
        with conexion() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, id_factura, nombre_cliente, total_deuda,
                           total_pagado, estado, fecha_credito, fecha_pago, cajero
                    FROM creditos
                    WHERE estado = 'pagado'
                    ORDER BY fecha_pago DESC
                    LIMIT 100
                    """
                )
                return cur.fetchall() or []
    except ErrorBaseDatos as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── GET /creditos/clientes — autocompletado ───────────────────────────────────
@router.get("/clientes")
def listar_clientes():
    try:
        with conexion() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT DISTINCT nombre_cliente FROM creditos ORDER BY nombre_cliente"
                )
                rows = cur.fetchall() or []
                return [r["nombre_cliente"] for r in rows]
    except ErrorBaseDatos as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── GET /creditos/cliente/{nombre} — deuda del cliente ────────────────────────
@router.get("/cliente/{nombre}")
def creditos_por_cliente(nombre: str):
    try:
        with conexion() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, nombre_cliente, total_deuda, total_pagado,
                           (total_deuda - total_pagado) AS saldo,
                           fecha_credito
                    FROM creditos
                    WHERE nombre_cliente ILIKE %s AND estado = 'pendiente'
                    ORDER BY fecha_credito DESC
                    """,
                    (f"%{nombre}%",),
                )
                return cur.fetchall() or []
    except ErrorBaseDatos as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── POST /creditos — crear crédito ────────────────────────────────────────────
@router.post("/")
def crear_credito(body: CreditoIn):
    if body.total_deuda <= 0:
        raise HTTPException(status_code=400, detail="total_deuda debe ser mayor a 0")
    if not body.nombre_cliente.strip():
        raise HTTPException(status_code=400, detail="nombre_cliente es requerido")
    try:
        with conexion() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO creditos (id_factura, nombre_cliente, total_deuda, cajero)
                    VALUES (%s, %s, %s, %s)
                    RETURNING id
                    """,
                    (body.id_factura or None, body.nombre_cliente.strip(),
                     body.total_deuda, body.cajero),
                )
                row = cur.fetchone()
                return {"id": row["id"], "ok": True}
    except ErrorBaseDatos as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── POST /creditos/{id}/pagar — registrar pago ───────────────────────────────
@router.post("/{credito_id}/pagar")
def registrar_pago(credito_id: int, body: PagoIn):
    if body.monto <= 0:
        raise HTTPException(status_code=400, detail="monto debe ser mayor a 0")
    try:
        with conexion() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT total_deuda, total_pagado, estado FROM creditos WHERE id = %s",
                    (credito_id,),
                )
                credito = cur.fetchone()
                if not credito:
                    raise HTTPException(status_code=404, detail="Crédito no encontrado")
                if credito["estado"] == "pagado":
                    raise HTTPException(status_code=400, detail="Crédito ya está pagado")

                nuevo_pagado = credito["total_pagado"] + body.monto
                nuevo_estado = "pagado" if nuevo_pagado >= credito["total_deuda"] else "pendiente"
                saldo_restante = max(0, credito["total_deuda"] - nuevo_pagado)

                cur.execute(
                    """
                    UPDATE creditos
                    SET total_pagado = %s,
                        estado = %s,
                        fecha_pago = CASE WHEN %s = 'pagado' THEN NOW() ELSE NULL END
                    WHERE id = %s
                    """,
                    (nuevo_pagado, nuevo_estado, nuevo_estado, credito_id),
                )
                cur.execute(
                    """
                    INSERT INTO credito_pagos (credito_id, monto, metodo_pago, cajero)
                    VALUES (%s, %s, %s, %s)
                    """,
                    (credito_id, body.monto, body.metodo_pago, body.cajero),
                )
                return {
                    "ok": True,
                    "nuevo_estado": nuevo_estado,
                    "saldo_restante": saldo_restante,
                    "total_pagado": nuevo_pagado,
                }
    except HTTPException:
        raise
    except ErrorBaseDatos as e:
        raise HTTPException(status_code=500, detail=str(e))
