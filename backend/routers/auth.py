"""Endpoint de autenticación por PIN para roles admin y cajero."""

import backend  # noqa: F401

from fastapi import APIRouter
from pydantic import BaseModel
from persistencia import get_config

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginIn(BaseModel):
    pin: str


@router.post("/login")
def login(body: LoginIn):
    pin = body.pin.strip()

    pin_admin  = get_config("pin_admin",  "1234")
    pin_cajero = get_config("pin_cajero", "0000")

    if pin == pin_admin:
        return {"ok": True, "rol": "admin"}
    elif pin == pin_cajero:
        return {"ok": True, "rol": "cajero"}
    else:
        return {"ok": False, "rol": None, "mensaje": "PIN incorrecto"}
