"""Endpoints para leer y escribir configuración del sistema."""

import backend  # noqa: F401

from fastapi import APIRouter, Depends, HTTPException, Request
from persistencia import get_config, set_config, ErrorBaseDatos
from backend.schemas import ConfigValor, MensajeOk
from backend.dependencies import verify_pin

router = APIRouter(prefix="/configuracion", tags=["configuracion"])

_CLAVES_PERMITIDAS = {
    "nequi_numero",
    "nombre_restaurante",
    "prefijo_factura",
    "pin_admin",
    "pin_cajero",
    "domicilio_mensaje",
    "num_mesas",
}

# Claves que el cajero necesita leer sin PIN (número Nequi al cobrar, nombre del local)
_CLAVES_PUBLICAS = {"nequi_numero", "nombre_restaurante", "num_mesas"}


# ── GET /configuracion/ — lista completa ─────────────────────────────────
@router.get("/", response_model=dict[str, str])
def listar_todas():
    return {clave: get_config(clave) for clave in sorted(_CLAVES_PERMITIDAS)}


# ── GET /configuracion/{clave} — lectura individual ───────────────────────
@router.get("/{clave}", response_model=ConfigValor)
def obtener(clave: str):
    if clave not in _CLAVES_PERMITIDAS:
        raise HTTPException(status_code=404, detail=f"Clave '{clave}' no reconocida")
    return ConfigValor(valor=get_config(clave))


# ── PUT /configuracion/{clave} — escritura ────────────────────────────────
@router.put("/{clave}", response_model=MensajeOk)
def actualizar(clave: str, body: ConfigValor):
    if clave not in _CLAVES_PERMITIDAS:
        raise HTTPException(status_code=404, detail=f"Clave '{clave}' no reconocida")
    try:
        set_config(clave, body.valor)
    except ErrorBaseDatos as e:
        raise HTTPException(status_code=500, detail=str(e))
    return MensajeOk(mensaje=f"'{clave}' actualizado")
