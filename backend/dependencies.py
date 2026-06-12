"""Dependencias FastAPI reutilizables."""

from fastapi import Header, HTTPException
from persistencia import get_config


async def verify_pin(x_pin: str = Header(None, alias="X-PIN")):
    if x_pin is None:
        raise HTTPException(status_code=401, detail="PIN requerido (header X-PIN)")
    pin_real = get_config("pin_admin") or "1234"
    if x_pin != pin_real:
        raise HTTPException(status_code=403, detail="PIN incorrecto")
