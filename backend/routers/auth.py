"""Auth con tokens: login, me, logout."""

import secrets
import backend  # noqa: F401

from datetime import datetime
from fastapi import APIRouter, HTTPException, Header
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
import persistencia

router = APIRouter(prefix="/auth", tags=["auth"])


def generar_token() -> str:
    return secrets.token_hex(32)


def get_usuario_por_token(token: str):
    """Verifica token activo y devuelve usuario; None si inválido."""
    if not token:
        return None
    conn = persistencia.get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT u.id, u.nombre, u.rol, u.activo,
                   s.id as sesion_id
            FROM sesiones s
            JOIN usuarios u ON u.id = s.usuario_id
            WHERE s.token = %s
              AND s.activo = 1
              AND u.activo = 1
            """,
            (token,),
        )
        row = cur.fetchone()
        if row:
            cur.execute(
                "UPDATE sesiones SET last_seen = NOW() WHERE token = %s",
                (token,),
            )
            conn.commit()
        return dict(row) if row else None
    finally:
        cur.close()
        conn.close()


# ── POST /auth/login ──────────────────────────────────────────────────────────

class LoginIn(BaseModel):
    pin: str
    dispositivo: Optional[str] = ""


@router.post("/login")
@router.post("/login/")
async def login(body: LoginIn):
    pin = body.pin.strip()
    if not pin:
        return JSONResponse({"ok": False, "mensaje": "PIN requerido"})

    conn = persistencia.get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT id, nombre, rol
            FROM usuarios
            WHERE pin = %s AND activo = 1
            LIMIT 1
            """,
            (pin,),
        )
        usuario = cur.fetchone()

        if not usuario:
            return JSONResponse({"ok": False, "mensaje": "PIN incorrecto"})

        token = generar_token()
        cur.execute(
            """
            INSERT INTO sesiones (usuario_id, token, dispositivo)
            VALUES (%s, %s, %s)
            """,
            (
                usuario["id"],
                token,
                (body.dispositivo or "")[:200],
            ),
        )
        conn.commit()

        return JSONResponse({
            "ok": True,
            "token": token,
            "usuario": {
                "id": usuario["id"],
                "nombre": usuario["nombre"],
                "rol": usuario["rol"],
            },
        })
    finally:
        cur.close()
        conn.close()


# ── GET /auth/me ──────────────────────────────────────────────────────────────

@router.get("/me")
async def me(authorization: Optional[str] = Header(None)):
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]

    usuario = get_usuario_por_token(token)
    if not usuario:
        raise HTTPException(401, "Sesión inválida")

    return JSONResponse({
        "ok": True,
        "usuario": {
            "id": usuario["id"],
            "nombre": usuario["nombre"],
            "rol": usuario["rol"],
        },
    })


# ── POST /auth/logout ─────────────────────────────────────────────────────────

@router.post("/logout")
async def logout(authorization: Optional[str] = Header(None)):
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]

    if token:
        conn = persistencia.get_connection()
        try:
            cur = conn.cursor()
            cur.execute(
                "UPDATE sesiones SET activo = 0 WHERE token = %s",
                (token,),
            )
            conn.commit()
        finally:
            cur.close()
            conn.close()

    return JSONResponse({"ok": True})
