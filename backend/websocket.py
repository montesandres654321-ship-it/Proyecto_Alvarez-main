"""WebSocket /ws/mesas — broadcast en tiempo real del estado de mesas."""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from fastapi import WebSocket, WebSocketDisconnect

logger = logging.getLogger("uvicorn.error")

# Referencia al event loop de FastAPI — se asigna en on_startup
_event_loop: asyncio.AbstractEventLoop | None = None


def set_event_loop(loop: asyncio.AbstractEventLoop) -> None:
    """Llamar desde el evento startup de FastAPI."""
    global _event_loop
    _event_loop = loop


class MesasConnectionManager:
    def __init__(self) -> None:
        self.active: list[WebSocket] = []

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self.active.append(ws)
        logger.info("WS cliente conectado — total: %d", len(self.active))

    def disconnect(self, ws: WebSocket) -> None:
        if ws in self.active:
            self.active.remove(ws)
        logger.info("WS cliente desconectado — total: %d", len(self.active))

    async def broadcast(self, message: dict[str, Any]) -> None:
        if not self.active:
            return
        payload = json.dumps(message, ensure_ascii=False)
        dead: list[WebSocket] = []
        for ws in list(self.active):
            try:
                await ws.send_text(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)

    async def send_to(self, ws: WebSocket, message: dict[str, Any]) -> None:
        try:
            await ws.send_text(json.dumps(message, ensure_ascii=False))
        except Exception:
            self.disconnect(ws)


manager = MesasConnectionManager()


def schedule_broadcast(message: dict[str, Any]) -> None:
    """
    Programa un broadcast desde código síncrono (endpoints en thread pool).
    Usa asyncio.run_coroutine_threadsafe para cruzar al event loop de FastAPI.
    """
    if _event_loop and not _event_loop.is_closed():
        asyncio.run_coroutine_threadsafe(manager.broadcast(message), _event_loop)


async def websocket_mesas(websocket: WebSocket) -> None:
    """Manejador del WebSocket de mesas."""
    await manager.connect(websocket)
    try:
        # Enviar estado inicial de bienvenida
        await manager.send_to(websocket, {"evento": "conectado", "data": None})
        # Mantener vivo; el servidor hace push, el cliente solo escucha
        while True:
            try:
                await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
            except asyncio.TimeoutError:
                # ping para mantener la conexión
                await manager.send_to(websocket, {"evento": "ping"})
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)
