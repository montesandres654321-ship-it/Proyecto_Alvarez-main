"""Router de insumos — catálogo y compras."""

from __future__ import annotations

from datetime import date, datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

import persistencia
from backend.dependencies import verify_pin

router = APIRouter(prefix="/insumos", tags=["insumos"])


# ── CATÁLOGO ──────────────────────────────────────────────────────────────────

@router.get("/catalogo")
def listar_catalogo():
    with persistencia.conexion() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, nombre, unidad, precio_ref, activo, orden
                FROM insumos_catalogo
                WHERE activo = 1
                ORDER BY orden, nombre
                """
            )
            return cur.fetchall()


class InsumoIn(BaseModel):
    nombre: str
    unidad: str = "und"
    precio_ref: int = 0


@router.post("/catalogo")
def crear_insumo(body: InsumoIn):
    with persistencia.conexion() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO insumos_catalogo (nombre, unidad, precio_ref)
                VALUES (%s, %s, %s) RETURNING id
                """,
                (body.nombre.strip(), body.unidad, body.precio_ref),
            )
            new_id = cur.fetchone()['id']
            cur.execute(
                "SELECT id, nombre, unidad, precio_ref, activo, orden FROM insumos_catalogo WHERE id = %s",
                (new_id,),
            )
            return cur.fetchone()


class InsumoUpdate(BaseModel):
    nombre: Optional[str] = None
    unidad: Optional[str] = None
    precio_ref: Optional[int] = None
    activo: Optional[int] = None


@router.put("/catalogo/{insumo_id}")
def actualizar_insumo(insumo_id: int, body: InsumoUpdate):
    sets = []
    params = []
    if body.nombre is not None:
        sets.append("nombre = %s"); params.append(body.nombre.strip())
    if body.unidad is not None:
        sets.append("unidad = %s"); params.append(body.unidad)
    if body.precio_ref is not None:
        sets.append("precio_ref = %s"); params.append(body.precio_ref)
    if body.activo is not None:
        sets.append("activo = %s"); params.append(body.activo)
    if not sets:
        raise HTTPException(status_code=400, detail="Sin campos para actualizar")
    params.append(insumo_id)
    with persistencia.conexion() as conn:
        with conn.cursor() as cur:
            cur.execute(f"UPDATE insumos_catalogo SET {', '.join(sets)} WHERE id = %s", params)
    return {"ok": True}


@router.delete("/catalogo/{insumo_id}")
def desactivar_insumo(insumo_id: int):
    with persistencia.conexion() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE insumos_catalogo SET activo = 0 WHERE id = %s",
                (insumo_id,),
            )
    return {"ok": True}


# ── COMPRAS ───────────────────────────────────────────────────────────────────

class DetalleCompra(BaseModel):
    nombre_insumo: str
    cantidad: float
    unidad: str
    valor_unitario: int
    subtotal: int


class CompraIn(BaseModel):
    fecha: str
    notas: str = ""
    detalle: List[DetalleCompra]


@router.post("/compras")
def registrar_compra(body: CompraIn):
    if not body.detalle:
        raise HTTPException(status_code=400, detail="El detalle no puede estar vacío")
    total = sum(d.subtotal for d in body.detalle)
    with persistencia.conexion() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO compras (fecha, total, notas) VALUES (%s, %s, %s) RETURNING id",
                (body.fecha, total, body.notas or None),
            )
            compra_id = cur.fetchone()['id']
            for d in body.detalle:
                cur.execute(
                    """
                    INSERT INTO compras_detalle
                      (compra_id, nombre_insumo, cantidad, unidad, valor_unitario, subtotal)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    """,
                    (compra_id, d.nombre_insumo, d.cantidad, d.unidad, d.valor_unitario, d.subtotal),
                )
                cur.execute(
                    """
                    UPDATE insumos_catalogo
                    SET precio_ref = %s
                    WHERE nombre = %s AND activo = 1
                    """,
                    (d.valor_unitario, d.nombre_insumo),
                )
    return {"id": compra_id, "total": total, "num_items": len(body.detalle)}


@router.get("/compras")
def listar_compras(fecha: str = None):
    if fecha is None:
        fecha = datetime.now().strftime("%Y-%m-%d")
    with persistencia.conexion() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, fecha, fecha_hora, total, notas
                FROM compras
                WHERE fecha = %s
                ORDER BY fecha_hora DESC
                """,
                (fecha,),
            )
            compras = cur.fetchall()
            result = []
            for c in compras:
                cur.execute(
                    "SELECT * FROM compras_detalle WHERE compra_id = %s",
                    (c["id"],),
                )
                detalle = cur.fetchall()
                row = dict(c)
                row["fecha"] = str(row["fecha"])
                row["fecha_hora"] = str(row["fecha_hora"])
                row["detalle"] = [dict(d) for d in detalle]
                result.append(row)
            return result


@router.get("/resumen")
def resumen_gastos_ventas(desde: str, hasta: str):
    from datetime import date as _date, timedelta
    try:
        d0 = _date.fromisoformat(desde)
        d1 = _date.fromisoformat(hasta)
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato de fecha inválido (YYYY-MM-DD)")

    resultado = []
    cur_date = d0
    with persistencia.conexion() as conn:
        with conn.cursor() as cur:
            while cur_date <= d1:
                f = cur_date.isoformat()
                cur.execute(
                    "SELECT COALESCE(SUM(total), 0) AS tc FROM compras WHERE fecha = %s",
                    (f,),
                )
                tc = int(cur.fetchone()["tc"] or 0)

                cur.execute(
                    """
                    SELECT COALESCE(SUM(total_pagar), 0) AS tv
                    FROM ventas
                    WHERE LEFT(fecha_hora, 10) = %s AND COALESCE(anulada, 0) = 0
                    """,
                    (f,),
                )
                tv = int(cur.fetchone()["tv"] or 0)

                resultado.append({
                    "fecha": f,
                    "total_ventas": tv,
                    "total_compras": tc,
                    "diferencia": tv - tc,
                })
                cur_date += timedelta(days=1)
    return resultado
