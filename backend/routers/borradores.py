"""Router borradores — sincronización multi-dispositivo."""

import json
from typing import Optional

from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel

import persistencia
from backend.routers.auth import get_usuario_por_token

router = APIRouter(prefix="/borradores", tags=["borradores"])


def _get_usuario(authorization: Optional[str]) -> dict:
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
    usuario = get_usuario_por_token(token)
    if not usuario:
        raise HTTPException(status_code=401, detail="No autenticado")
    return usuario


# ── GET borrador ──────────────────────────────────────────────────────────────

@router.get("/{tipo}")
def obtener_borrador(tipo: str, authorization: Optional[str] = Header(None)):
    usuario = _get_usuario(authorization)
    with persistencia.conexion() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT datos, updated_at::text AS updated_at FROM borradores WHERE usuario_id = %s AND tipo = %s",
                (usuario["id"], tipo),
            )
            row = cur.fetchone()
    if not row:
        return JSONResponse({"ok": True, "datos": None})
    return JSONResponse({"ok": True, "datos": row["datos"], "updated_at": row["updated_at"]})


# ── POST guardar borrador ─────────────────────────────────────────────────────

class BorradorIn(BaseModel):
    datos: dict


@router.post("/{tipo}")
@router.post("/{tipo}/")
def guardar_borrador(tipo: str, body: BorradorIn, authorization: Optional[str] = Header(None)):
    usuario = _get_usuario(authorization)
    with persistencia.conexion() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO borradores (usuario_id, tipo, datos, updated_at)
                VALUES (%s, %s, %s::jsonb, NOW())
                ON CONFLICT (usuario_id, tipo)
                DO UPDATE SET datos = EXCLUDED.datos, updated_at = NOW()
                """,
                (usuario["id"], tipo, json.dumps(body.datos)),
            )
    return JSONResponse({"ok": True})


# ── DELETE limpiar borrador ───────────────────────────────────────────────────

@router.delete("/{tipo}")
def limpiar_borrador(tipo: str, authorization: Optional[str] = Header(None)):
    usuario = _get_usuario(authorization)
    with persistencia.conexion() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM borradores WHERE usuario_id = %s AND tipo = %s",
                (usuario["id"], tipo),
            )
    return JSONResponse({"ok": True})
