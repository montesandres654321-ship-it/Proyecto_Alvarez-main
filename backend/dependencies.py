"""Dependencias FastAPI reutilizables."""

from fastapi import Header, HTTPException
from persistencia import get_config


async def verify_pin(x_pin: str = Header(None, alias="X-PIN")):
    if x_pin is None:
        raise HTTPException(status_code=401, detail="PIN requerido (header X-PIN)")
    pin_real = get_config("pin_admin") or "1234"
    if x_pin != pin_real:
        raise HTTPException(status_code=403, detail="PIN incorrecto")


async def verify_pin_o_cajero(x_pin: str = Header(None, alias="X-PIN")):
    """Acepta PIN de admin o PIN de cajero (para abrir turno)."""
    if x_pin is None:
        raise HTTPException(status_code=401, detail="PIN requerido (header X-PIN)")
    pin_admin  = get_config("pin_admin",  "1234")
    pin_cajero = get_config("pin_cajero", "0000")
    if x_pin not in (pin_admin, pin_cajero):
        raise HTTPException(status_code=403, detail="PIN incorrecto")
