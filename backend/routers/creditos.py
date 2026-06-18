"""Endpoints para gestión de créditos (ventas fiadas)."""

import backend  # noqa: F401

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
from persistencia import conexion, ErrorBaseDatos

router = APIRouter(prefix="/creditos", tags=["creditos"])


class CreditoIn(BaseModel):
    id_factura: str = ""
    nombre_cliente: str
    total_deuda: int
    cajero: Optional[str] = ""


class PagoIn(BaseModel):
    monto: int
    metodo_pago: Optional[str] = "Efectivo"
    cajero: Optional[str] = ""


def _rows_to_list(rows) -> list:
    """Convierte filas de psycopg2 (RealDictRow) a lista de dicts JSON-seguros."""
    if not rows:
        return []
    result = []
    for row in rows:
        d = {}
        for k, v in row.items():
            if hasattr(v, 'isoformat'):
                d[k] = v.isoformat()
            else:
                d[k] = v
        result.append(d)
    return result


# ── GET /creditos  (sin y con slash) ─────────────────────────────────────────
@router.get("", response_class=JSONResponse)
@router.get("/", response_class=JSONResponse, include_in_schema=False)
def listar_pendientes():
    try:
        with conexion() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, id_factura, nombre_cliente,
                           total_deuda, total_pagado,
                           (total_deuda - total_pagado) AS saldo,
                           estado, fecha_credito, cajero
                    FROM creditos
                    WHERE estado = 'pendiente'
                    ORDER BY fecha_credito DESC
                    """
                )
                return _rows_to_list(cur.fetchall())
    except ErrorBaseDatos as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error inesperado: {e}")


# ── GET /creditos/historial ───────────────────────────────────────────────────
@router.get("/historial", response_class=JSONResponse)
def listar_pagados():
    try:
        with conexion() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, id_factura, nombre_cliente,
                           total_deuda, total_pagado,
                           (total_deuda - total_pagado) AS saldo,
                           estado, fecha_credito, fecha_pago, cajero
                    FROM creditos
                    ORDER BY fecha_credito DESC
                    LIMIT 200
                    """
                )
                return _rows_to_list(cur.fetchall())
    except ErrorBaseDatos as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error inesperado: {e}")


# ── GET /creditos/clientes ────────────────────────────────────────────────────
@router.get("/clientes", response_class=JSONResponse)
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
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error inesperado: {e}")


# ── GET /creditos/cliente/{nombre} ────────────────────────────────────────────
@router.get("/cliente/{nombre}", response_class=JSONResponse)
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
                return _rows_to_list(cur.fetchall())
    except ErrorBaseDatos as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error inesperado: {e}")


# ── POST /creditos  (sin y con slash) ────────────────────────────────────────
@router.post("", response_class=JSONResponse)
@router.post("/", response_class=JSONResponse, include_in_schema=False)
def crear_credito(body: CreditoIn):
    if not body.nombre_cliente.strip():
        raise HTTPException(status_code=400, detail="nombre_cliente es requerido")
    if body.total_deuda <= 0:
        raise HTTPException(status_code=400, detail="total_deuda debe ser mayor a 0")
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
                     body.total_deuda, body.cajero or ""),
                )
                row = cur.fetchone()
                return {"id": row["id"], "ok": True}
    except ErrorBaseDatos as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al crear crédito: {e}")


# ── POST /creditos/{id}/pagar ─────────────────────────────────────────────────
@router.post("/{credito_id}/pagar", response_class=JSONResponse)
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
                        fecha_pago = CASE WHEN %s = 'pagado' THEN NOW() ELSE fecha_pago END
                    WHERE id = %s
                    """,
                    (nuevo_pagado, nuevo_estado, nuevo_estado, credito_id),
                )
                cur.execute(
                    """
                    INSERT INTO credito_pagos (credito_id, monto, metodo_pago, cajero)
                    VALUES (%s, %s, %s, %s)
                    """,
                    (credito_id, body.monto, body.metodo_pago or "Efectivo", body.cajero or ""),
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
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al registrar pago: {e}")
