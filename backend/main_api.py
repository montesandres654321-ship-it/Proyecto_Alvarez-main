"""FastAPI — punto de entrada de la API REST de Alvarez Fast Food."""

import asyncio
import logging
import logging.handlers
import os
import time
from pathlib import Path

import backend  # noqa: F401 — registra sys.path

from fastapi import FastAPI, Request, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from persistencia import inicializar_bd
from backend.routers import auth, configuracion, creditos, insumos, mesas, nomina, preparaciones, productos, reportes, turnos, usuarios, ventas
from backend.websocket import set_event_loop, websocket_mesas

# ── Paths ─────────────────────────────────────────────────────────────────

_ROOT = Path(__file__).resolve().parent.parent
_FRONTEND_DIST = _ROOT / "frontend" / "dist"
_LOGS_DIR = _ROOT / "logs"
_LOGS_DIR.mkdir(exist_ok=True)

# ── Logging: stdout en Render, archivo en local ───────────────────────────

_formatter = logging.Formatter("%(asctime)s %(levelname)s %(name)s — %(message)s")

if os.environ.get("RENDER"):
    _handler: logging.Handler = logging.StreamHandler()
else:
    _handler = logging.handlers.TimedRotatingFileHandler(
        filename=_LOGS_DIR / "api.log",
        when="midnight",
        backupCount=7,
        encoding="utf-8",
    )
_handler.setFormatter(_formatter)
for _log in ("uvicorn", "uvicorn.access", "uvicorn.error"):
    logging.getLogger(_log).addHandler(_handler)

_APP_START = time.time()

# ── App ───────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Alvarez Fast Food API",
    version="1.0.0",
    description="API REST del sistema de ventas Alvarez Fast Food",
)

# CORS: en producción se restringe al dominio del frontend (FRONTEND_URL).
# En desarrollo se permite todo con allow_origins=["*"].
_FRONTEND_URL = os.environ.get("FRONTEND_URL", "*")
_origins = (
    ["*"]
    if _FRONTEND_URL == "*"
    else [
        _FRONTEND_URL,
        "http://localhost:5173",
        "http://localhost:8000",
    ]
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*", "X-PIN"],
    expose_headers=["Content-Disposition"],
)

# ── Middleware PIN para rutas /admin/* ────────────────────────────────────

@app.middleware("http")
async def pin_middleware(request: Request, call_next):
    if request.url.path.startswith("/admin"):
        from persistencia import get_config
        pin_correcto = get_config("pin_admin", "1234")

        # Legacy: X-PIN header
        if request.headers.get("X-PIN", "") == pin_correcto:
            return await call_next(request)

        # Nuevo: Authorization Bearer token de usuario admin
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
            from backend.routers.auth import get_usuario_por_token
            usuario = get_usuario_por_token(token)
            if usuario and usuario.get("rol") == "admin":
                return await call_next(request)

        return JSONResponse(
            status_code=401,
            content={"detail": "PIN requerido o incorrecto (header X-PIN)"},
        )
    return await call_next(request)

# ── Routers API ───────────────────────────────────────────────────────────

app.include_router(auth.router)
app.include_router(usuarios.router)
app.include_router(creditos.router)
app.include_router(productos.router)
app.include_router(configuracion.router)
app.include_router(ventas.router)
app.include_router(mesas.router)
app.include_router(reportes.router)
app.include_router(turnos.router)
app.include_router(preparaciones.router)
app.include_router(insumos.router)
app.include_router(nomina.router)


@app.websocket("/ws/mesas")
async def ws_mesas(websocket: WebSocket):
    await websocket_mesas(websocket)


@app.get("/health", tags=["sistema"])
def health():
    from persistencia import probar_conexion
    ok, msg = probar_conexion()
    return {
        "status": "ok" if ok else "degraded",
        "db": msg,
        "version": "1.0.0",
        "uptime_segundos": int(time.time() - _APP_START),
        "environment": os.environ.get("RENDER", "local"),
    }


# ── Eventos ───────────────────────────────────────────────────────────────

async def _backup_startup():
    """Backup silencioso al arrancar — espera 5 s para que la BD termine de inicializar."""
    await asyncio.sleep(5)
    try:
        from backup import hacer_backup
        ruta = hacer_backup()
        logging.getLogger("uvicorn.error").info("Backup automático completado: %s", ruta.name)
    except Exception as e:
        logging.getLogger("uvicorn.error").warning("Backup startup fallido: %s", e)


@app.on_event("startup")
async def on_startup():
    set_event_loop(asyncio.get_running_loop())
    try:
        inicializar_bd()
    except Exception as e:
        logging.getLogger("uvicorn.error").error("BD no disponible al arrancar: %s", e)
    asyncio.create_task(_backup_startup())
    # Montar assets estáticos del build de React
    if (_FRONTEND_DIST / "assets").exists():
        app.mount(
            "/assets",
            StaticFiles(directory=str(_FRONTEND_DIST / "assets")),
            name="static_assets",
        )


# ── SPA Fallback (debe ir al final — captura todo lo que no es API) ───────

@app.get("/sw.js", include_in_schema=False)
@app.get("/workbox-{rest:path}", include_in_schema=False)
@app.get("/manifest.webmanifest", include_in_schema=False)
async def static_files(request: Request, rest: str = ""):
    """Sirve archivos de Service Worker y manifest desde dist/."""
    path = request.url.path.lstrip("/")
    f = _FRONTEND_DIST / path
    if f.exists():
        return FileResponse(str(f))
    return JSONResponse({"detail": "Not found"}, status_code=404)


@app.get("/{full_path:path}", include_in_schema=False)
async def spa_fallback(full_path: str):
    """Sirve index.html para todas las rutas del SPA React."""
    # Primero intentar servir el archivo como estático
    static = _FRONTEND_DIST / full_path
    if static.is_file():
        return FileResponse(str(static))
    # Fallback a index.html para el routing del cliente
    index = _FRONTEND_DIST / "index.html"
    if index.exists():
        return FileResponse(str(index))
    return JSONResponse({"detail": "Frontend no compilado. Ejecute: npm run build"}, status_code=404)
