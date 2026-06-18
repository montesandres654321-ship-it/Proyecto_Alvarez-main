"""Endpoints de apertura y cierre de turno/caja."""

import backend  # noqa: F401

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from persistencia import abrir_turno, cerrar_turno, turno_activo, eliminar_turno, anular_turno, ErrorBaseDatos
from backend.dependencies import verify_pin, verify_pin_o_cajero

router = APIRouter(prefix="/turnos", tags=["turnos"])


class AbrirTurnoIn(BaseModel):
    cajero: str = Field("Cajero", min_length=1, max_length=100)
    efectivo_inicial: int = Field(0, ge=0)


@router.get("/activo")
def obtener_activo():
    """Devuelve el turno abierto actualmente, o null si no hay ninguno."""
    try:
        turno = turno_activo()
    except ErrorBaseDatos as e:
        raise HTTPException(status_code=500, detail=str(e))
    return turno  # puede ser None → JSON null


@router.post("/abrir", dependencies=[Depends(verify_pin_o_cajero)])
def abrir(body: AbrirTurnoIn):
    try:
        turno_id = abrir_turno(body.cajero, body.efectivo_inicial)
    except ErrorBaseDatos as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"id": turno_id, "cajero": body.cajero, "efectivo_inicial": body.efectivo_inicial, "estado": "abierto"}


@router.post("/{turno_id}/cerrar", dependencies=[Depends(verify_pin)])
def cerrar(turno_id: int):
    try:
        resumen = cerrar_turno(turno_id)
    except ErrorBaseDatos as e:
        raise HTTPException(status_code=500, detail=str(e))
    return resumen


@router.delete("/{turno_id}", dependencies=[Depends(verify_pin)])
def eliminar(turno_id: int):
    """Elimina permanentemente un turno sin ventas activas."""
    try:
        eliminar_turno(turno_id)
    except ErrorBaseDatos as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"ok": True, "mensaje": f"Turno {turno_id} eliminado"}


@router.patch("/{turno_id}/anular", dependencies=[Depends(verify_pin)])
def anular(turno_id: int):
    """Marca un turno como anulado sin eliminarlo."""
    try:
        anular_turno(turno_id)
    except ErrorBaseDatos as e:
        raise HTTPException(status_code=404, detail=str(e))
    return {"ok": True, "mensaje": f"Turno {turno_id} anulado"}
