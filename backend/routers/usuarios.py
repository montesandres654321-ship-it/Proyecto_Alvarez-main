"""CRUD de usuarios del sistema."""

import backend  # noqa: F401

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
import persistencia

router = APIRouter(prefix="/usuarios", tags=["usuarios"])


class UsuarioIn(BaseModel):
    nombre: str
    pin: str
    rol: str = "cajero"


class UsuarioUpdate(BaseModel):
    nombre: Optional[str] = None
    pin: Optional[str] = None
    rol: Optional[str] = None
    activo: Optional[int] = None


# ── GET /usuarios ─────────────────────────────────────────────────────────────

@router.get("")
@router.get("/")
def listar_usuarios():
    conn = persistencia.get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT id, nombre, rol, activo, created_at
            FROM usuarios
            ORDER BY rol DESC, nombre
            """
        )
        rows = cur.fetchall()
        return JSONResponse([dict(r) for r in rows])
    finally:
        cur.close()
        conn.close()


# ── POST /usuarios ────────────────────────────────────────────────────────────

@router.post("")
@router.post("/")
def crear_usuario(body: UsuarioIn):
    nombre = body.nombre.strip()
    pin = body.pin.strip()
    rol = body.rol.strip()

    if not nombre:
        raise HTTPException(400, "Nombre requerido")
    if not pin.isdigit() or len(pin) != 4:
        raise HTTPException(400, "El PIN debe tener exactamente 4 dígitos")
    if rol not in ("admin", "cajero"):
        raise HTTPException(400, "Rol debe ser 'admin' o 'cajero'")

    conn = persistencia.get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT id FROM usuarios WHERE pin = %s AND activo = 1",
            (pin,),
        )
        if cur.fetchone():
            raise HTTPException(409, "Ya existe un usuario activo con ese PIN")

        cur.execute(
            """
            INSERT INTO usuarios (nombre, pin, rol)
            VALUES (%s, %s, %s)
            RETURNING id, nombre, rol
            """,
            (nombre, pin, rol),
        )
        row = cur.fetchone()
        conn.commit()
        return JSONResponse(dict(row), status_code=201)
    finally:
        cur.close()
        conn.close()


# ── PUT /usuarios/{id} ────────────────────────────────────────────────────────

@router.put("/{usuario_id}")
def actualizar_usuario(usuario_id: int, body: UsuarioUpdate):
    conn = persistencia.get_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT id, rol FROM usuarios WHERE id = %s", (usuario_id,))
        usuario = cur.fetchone()
        if not usuario:
            raise HTTPException(404, "Usuario no encontrado")

        if body.pin is not None:
            pin = body.pin.strip()
            if not pin.isdigit() or len(pin) != 4:
                raise HTTPException(400, "El PIN debe tener exactamente 4 dígitos")
            cur.execute(
                "SELECT id FROM usuarios WHERE pin = %s AND activo = 1 AND id != %s",
                (pin, usuario_id),
            )
            if cur.fetchone():
                raise HTTPException(409, "Ya existe un usuario activo con ese PIN")

        updates = []
        params = []
        if body.nombre is not None:
            updates.append("nombre = %s")
            params.append(body.nombre.strip())
        if body.pin is not None:
            updates.append("pin = %s")
            params.append(body.pin.strip())
        if body.rol is not None:
            if body.rol not in ("admin", "cajero"):
                raise HTTPException(400, "Rol debe ser 'admin' o 'cajero'")
            updates.append("rol = %s")
            params.append(body.rol)
        if body.activo is not None:
            # No desactivar si es el único admin
            if body.activo == 0 and usuario["rol"] == "admin":
                cur.execute(
                    "SELECT COUNT(*) as cnt FROM usuarios WHERE rol='admin' AND activo=1"
                )
                result = cur.fetchone()
                if result["cnt"] <= 1:
                    raise HTTPException(409, "No se puede desactivar el único administrador")
            updates.append("activo = %s")
            params.append(body.activo)

        if not updates:
            return JSONResponse({"ok": True})

        params.append(usuario_id)
        cur.execute(
            f"UPDATE usuarios SET {', '.join(updates)} WHERE id = %s",
            params,
        )
        conn.commit()
        return JSONResponse({"ok": True})
    finally:
        cur.close()
        conn.close()


# ── DELETE /usuarios/{id} ─────────────────────────────────────────────────────

@router.delete("/{usuario_id}")
def desactivar_usuario(usuario_id: int):
    conn = persistencia.get_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT id, rol FROM usuarios WHERE id = %s", (usuario_id,))
        usuario = cur.fetchone()
        if not usuario:
            raise HTTPException(404, "Usuario no encontrado")

        if usuario["rol"] == "admin":
            cur.execute(
                "SELECT COUNT(*) as cnt FROM usuarios WHERE rol='admin' AND activo=1"
            )
            result = cur.fetchone()
            if result["cnt"] <= 1:
                raise HTTPException(409, "No se puede eliminar el único administrador")

        cur.execute("UPDATE usuarios SET activo = 0 WHERE id = %s", (usuario_id,))
        cur.execute("UPDATE sesiones SET activo = 0 WHERE usuario_id = %s", (usuario_id,))
        conn.commit()
        return JSONResponse({"ok": True})
    finally:
        cur.close()
        conn.close()


# ── GET /usuarios/sesiones-activas ────────────────────────────────────────────

@router.get("/sesiones-activas")
def sesiones_activas():
    conn = persistencia.get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT s.id as sesion_id, u.nombre, u.rol,
                   s.dispositivo, s.last_seen, s.created_at
            FROM sesiones s
            JOIN usuarios u ON u.id = s.usuario_id
            WHERE s.activo = 1
            ORDER BY s.last_seen DESC
            """
        )
        rows = cur.fetchall()
        return JSONResponse([dict(r) for r in rows])
    finally:
        cur.close()
        conn.close()


# ── DELETE /usuarios/sesiones/{sesion_id} ─────────────────────────────────────

@router.delete("/sesiones/{sesion_id}")
def cerrar_sesion_remota(sesion_id: int):
    conn = persistencia.get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "UPDATE sesiones SET activo = 0 WHERE id = %s",
            (sesion_id,),
        )
        conn.commit()
        return JSONResponse({"ok": True})
    finally:
        cur.close()
        conn.close()
