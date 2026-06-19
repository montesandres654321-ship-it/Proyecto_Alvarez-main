"""Endpoints de gastos generales y categorías."""

import backend  # noqa: F401

from datetime import date
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
import persistencia

router = APIRouter(prefix="/gastos", tags=["gastos"])


# ── CATEGORÍAS ────────────────────────────────────────────────────────────────

@router.get("/categorias")
def listar_categorias():
    conn = persistencia.get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT id, nombre, emoji, activo, orden
            FROM categorias_gasto
            WHERE activo = 1
            ORDER BY orden, nombre
            """
        )
        return JSONResponse([dict(r) for r in cur.fetchall()])
    finally:
        cur.close()
        conn.close()


class CategoriaIn(BaseModel):
    nombre: str
    emoji: Optional[str] = "💸"


@router.post("/categorias")
def crear_categoria(body: CategoriaIn):
    conn = persistencia.get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO categorias_gasto (nombre, emoji)
            VALUES (%s, %s)
            RETURNING id, nombre, emoji
            """,
            (body.nombre.strip(), body.emoji or "💸"),
        )
        row = cur.fetchone()
        conn.commit()
        return JSONResponse(dict(row))
    finally:
        cur.close()
        conn.close()


class CategoriaUpdate(BaseModel):
    nombre: Optional[str] = None
    emoji: Optional[str] = None
    activo: Optional[int] = None


@router.put("/categorias/{cat_id}")
def editar_categoria(cat_id: int, body: CategoriaUpdate):
    conn = persistencia.get_connection()
    try:
        cur = conn.cursor()
        campos, valores = [], []
        if body.nombre is not None:
            campos.append("nombre = %s")
            valores.append(body.nombre.strip())
        if body.emoji is not None:
            campos.append("emoji = %s")
            valores.append(body.emoji)
        if body.activo is not None:
            campos.append("activo = %s")
            valores.append(body.activo)
        if not campos:
            raise HTTPException(400, "Nada que actualizar")
        valores.append(cat_id)
        cur.execute(
            f"UPDATE categorias_gasto SET {', '.join(campos)} WHERE id = %s",
            valores,
        )
        conn.commit()
        return JSONResponse({"ok": True})
    finally:
        cur.close()
        conn.close()


@router.delete("/categorias/{cat_id}")
def eliminar_categoria(cat_id: int):
    conn = persistencia.get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "UPDATE categorias_gasto SET activo = 0 WHERE id = %s",
            (cat_id,),
        )
        conn.commit()
        return JSONResponse({"ok": True})
    finally:
        cur.close()
        conn.close()


# ── RESUMEN (debe ir ANTES de /{gasto_id} para evitar conflicto de rutas) ────

@router.get("/resumen")
def resumen_gastos(
    mes: Optional[int] = None,
    anio: Optional[int] = None,
    desde: Optional[str] = None,
    hasta: Optional[str] = None,
):
    conn = persistencia.get_connection()
    try:
        cur = conn.cursor()
        where, params = ["1=1"], []
        if mes:
            where.append("EXTRACT(MONTH FROM fecha) = %s")
            params.append(mes)
        if anio:
            where.append("EXTRACT(YEAR FROM fecha) = %s")
            params.append(anio)
        if desde:
            where.append("fecha >= %s")
            params.append(desde)
        if hasta:
            where.append("fecha <= %s")
            params.append(hasta)

        cond = " AND ".join(where)

        cur.execute(
            f"""
            SELECT
              COALESCE(SUM(valor), 0) as total,
              COALESCE(SUM(CASE WHEN tipo='fijo' THEN valor ELSE 0 END), 0) as total_fijo,
              COALESCE(SUM(CASE WHEN tipo='variable' THEN valor ELSE 0 END), 0) as total_variable,
              COUNT(*) as num_gastos
            FROM gastos_generales
            WHERE {cond}
            """,
            params,
        )
        totales = dict(cur.fetchone())

        cur.execute(
            f"""
            SELECT
              COALESCE(g.categoria_nombre, 'Otros') as categoria,
              COALESCE(c.emoji, '💸') as emoji,
              SUM(g.valor) as total,
              COUNT(*) as cantidad
            FROM gastos_generales g
            LEFT JOIN categorias_gasto c ON c.id = g.categoria_id
            WHERE {cond}
            GROUP BY g.categoria_nombre, c.emoji
            ORDER BY total DESC
            """,
            params,
        )
        por_categoria = [dict(r) for r in cur.fetchall()]

        return JSONResponse({**totales, "por_categoria": por_categoria})
    finally:
        cur.close()
        conn.close()


# ── GASTOS ────────────────────────────────────────────────────────────────────

@router.get("")
@router.get("/")
def listar_gastos(
    mes: Optional[int] = None,
    anio: Optional[int] = None,
    categoria_id: Optional[int] = None,
):
    conn = persistencia.get_connection()
    try:
        cur = conn.cursor()
        where, params = ["1=1"], []
        if mes:
            where.append("EXTRACT(MONTH FROM fecha) = %s")
            params.append(mes)
        if anio:
            where.append("EXTRACT(YEAR FROM fecha) = %s")
            params.append(anio)
        if categoria_id:
            where.append("g.categoria_id = %s")
            params.append(categoria_id)
        cur.execute(
            f"""
            SELECT
              g.id, g.nombre, g.valor,
              g.categoria_id, g.categoria_nombre,
              g.tipo,
              g.fecha::text as fecha,
              g.notas,
              g.created_at::text as created_at,
              c.emoji
            FROM gastos_generales g
            LEFT JOIN categorias_gasto c ON c.id = g.categoria_id
            WHERE {' AND '.join(where)}
            ORDER BY g.fecha DESC, g.created_at DESC
            """,
            params,
        )
        return JSONResponse([dict(r) for r in cur.fetchall()])
    finally:
        cur.close()
        conn.close()


class GastoIn(BaseModel):
    nombre: str
    valor: int
    categoria_id: Optional[int] = None
    categoria_nombre: Optional[str] = "Otros"
    tipo: Optional[str] = "variable"
    fecha: Optional[str] = None
    notas: Optional[str] = ""


@router.post("")
@router.post("/")
def crear_gasto(body: GastoIn):
    conn = persistencia.get_connection()
    try:
        cur = conn.cursor()
        cat_nombre = body.categoria_nombre or "Otros"
        if body.categoria_id:
            cur.execute(
                "SELECT nombre FROM categorias_gasto WHERE id = %s",
                (body.categoria_id,),
            )
            row = cur.fetchone()
            if row:
                cat_nombre = row["nombre"]

        fecha = body.fecha or str(date.today())

        cur.execute(
            """
            INSERT INTO gastos_generales
              (nombre, valor, categoria_id, categoria_nombre, tipo, fecha, notas)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id, nombre, valor, fecha::text as fecha
            """,
            (
                body.nombre.strip(),
                body.valor,
                body.categoria_id,
                cat_nombre,
                body.tipo or "variable",
                fecha,
                body.notas or "",
            ),
        )
        row = cur.fetchone()
        conn.commit()
        return JSONResponse({"ok": True, **dict(row)})
    except Exception as e:
        conn.rollback()
        raise HTTPException(500, str(e))
    finally:
        cur.close()
        conn.close()


class GastoUpdate(BaseModel):
    nombre: Optional[str] = None
    valor: Optional[int] = None
    categoria_id: Optional[int] = None
    categoria_nombre: Optional[str] = None
    tipo: Optional[str] = None
    fecha: Optional[str] = None
    notas: Optional[str] = None


@router.put("/{gasto_id}")
def editar_gasto(gasto_id: int, body: GastoUpdate):
    conn = persistencia.get_connection()
    try:
        cur = conn.cursor()
        campos, valores = [], []
        if body.nombre is not None:
            campos.append("nombre = %s")
            valores.append(body.nombre.strip())
        if body.valor is not None:
            campos.append("valor = %s")
            valores.append(body.valor)
        if body.categoria_id is not None:
            campos.append("categoria_id = %s")
            valores.append(body.categoria_id)
            cur.execute(
                "SELECT nombre FROM categorias_gasto WHERE id = %s",
                (body.categoria_id,),
            )
            row = cur.fetchone()
            if row:
                campos.append("categoria_nombre = %s")
                valores.append(row["nombre"])
        if body.tipo is not None:
            campos.append("tipo = %s")
            valores.append(body.tipo)
        if body.fecha is not None:
            campos.append("fecha = %s")
            valores.append(body.fecha)
        if body.notas is not None:
            campos.append("notas = %s")
            valores.append(body.notas)
        if not campos:
            raise HTTPException(400, "Nada que actualizar")
        valores.append(gasto_id)
        cur.execute(
            f"UPDATE gastos_generales SET {', '.join(campos)} WHERE id = %s",
            valores,
        )
        conn.commit()
        return JSONResponse({"ok": True})
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(500, str(e))
    finally:
        cur.close()
        conn.close()


@router.delete("/{gasto_id}")
def eliminar_gasto(gasto_id: int):
    conn = persistencia.get_connection()
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM gastos_generales WHERE id = %s", (gasto_id,))
        conn.commit()
        return JSONResponse({"ok": True})
    finally:
        cur.close()
        conn.close()
