"""Endpoints CRUD de opciones de preparación por categoría."""

import backend  # noqa: F401

from fastapi import APIRouter, Depends, HTTPException, status

from persistencia import (
    listar_preparaciones,
    preparaciones_por_categoria,
    crear_preparacion,
    desactivar_preparacion,
)
from backend.schemas import MensajeOk, PreparacionIn, PreparacionOut
from backend.dependencies import verify_pin

router = APIRouter(prefix="/preparaciones", tags=["preparaciones"])


@router.get("/todas", response_model=dict[str, list[str]])
def listar_todas():
    """Devuelve todas las opciones activas agrupadas por categoría."""
    return preparaciones_por_categoria()


@router.get("/", response_model=list[PreparacionOut])
def listar(categoria: str | None = None):
    """Lista opciones activas (opcionalmente filtrando por categoría)."""
    filas = listar_preparaciones(categoria=categoria, solo_activas=True)
    return [
        PreparacionOut(
            id=int(f["id"]),
            categoria=f["categoria"],
            opcion=f["opcion"],
            orden=int(f["orden"]),
            activo=bool(f["activo"]),
        )
        for f in filas
    ]


@router.post("/", response_model=PreparacionOut, status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(verify_pin)])
def crear(body: PreparacionIn):
    try:
        nuevo_id = crear_preparacion(body.categoria, body.opcion)
    except Exception as e:
        raise HTTPException(status_code=409, detail=str(e))
    return PreparacionOut(
        id=nuevo_id,
        categoria=body.categoria,
        opcion=body.opcion,
        orden=0,
        activo=True,
    )


@router.delete("/{prep_id}", response_model=MensajeOk, dependencies=[Depends(verify_pin)])
def eliminar(prep_id: int):
    try:
        desactivar_preparacion(prep_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return MensajeOk(mensaje="Opción eliminada")
