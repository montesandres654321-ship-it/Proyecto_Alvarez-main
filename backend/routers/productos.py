"""Endpoints CRUD de productos."""

import backend  # noqa: F401

from fastapi import APIRouter, Depends, HTTPException, status
from persistencia import (
    actualizar_producto,
    categorias_activas,
    crear_producto,
    desactivar_producto,
    listar_productos,
    obtener_producto_por_id,
    toggle_activo_producto,
)
from backend.schemas import MensajeOk, ProductoIn, ProductoOut, ProductoUpdate
from backend.dependencies import verify_pin

router = APIRouter(prefix="/productos", tags=["productos"])


def _to_out(p) -> ProductoOut:
    return ProductoOut(
        id=p.id,
        categoria=p.categoria,
        nombre=p.nombre,
        precio=p.precio,
        ingredientes=p.ingredientes,
        activo=p.activo,
        bebida_incluida=p.bebida_incluida,
        requiere_seleccion_bebida=p.requiere_seleccion_bebida,
        bebida_automatica=p.bebida_automatica,
    )


@router.get("/categorias", response_model=list[str])
def listar_categorias():
    return categorias_activas()


@router.get("/", response_model=list[ProductoOut])
def listar(categoria: str | None = None, solo_activos: bool = True):
    return [_to_out(p) for p in listar_productos(categoria=categoria, solo_activos=solo_activos)]


@router.get("/{producto_id}", response_model=ProductoOut)
def obtener(producto_id: str):
    p = obtener_producto_por_id(producto_id)
    if p is None:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return _to_out(p)


@router.post("/", response_model=ProductoOut, status_code=status.HTTP_201_CREATED, dependencies=[Depends(verify_pin)])
def crear(body: ProductoIn):
    try:
        pid = crear_producto(
            nombre=body.nombre,
            precio=body.precio,
            categoria=body.categoria,
            ingredientes=body.ingredientes,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    p = obtener_producto_por_id(pid)
    if p is None:
        raise HTTPException(status_code=500, detail="Producto creado pero no encontrado")
    return _to_out(p)


@router.put("/{producto_id}", response_model=MensajeOk, dependencies=[Depends(verify_pin)])
def actualizar(producto_id: str, body: ProductoUpdate):
    try:
        actualizar_producto(
            producto_id=producto_id,
            nombre=body.nombre,
            precio=body.precio,
            categoria=body.categoria,
            ingredientes=body.ingredientes,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return MensajeOk(mensaje="Producto actualizado")


@router.delete("/{producto_id}", response_model=MensajeOk, dependencies=[Depends(verify_pin)])
def eliminar(producto_id: str):
    """Desactiva el producto (activo=0). No lo borra de la BD."""
    try:
        desactivar_producto(producto_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return MensajeOk(mensaje="Producto desactivado")


@router.patch("/{producto_id}/toggle", response_model=MensajeOk, dependencies=[Depends(verify_pin)])
def toggle_activo(producto_id: str):
    try:
        nuevo_estado = toggle_activo_producto(producto_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    estado_str = "activado" if nuevo_estado else "desactivado"
    return MensajeOk(mensaje=f"Producto {estado_str}")
