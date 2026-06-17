"""Router de nómina — trabajadores y semana."""

from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

import persistencia
from backend.dependencies import verify_pin

router = APIRouter(prefix="/nomina", tags=["nomina"])


# ── UTILIDADES ────────────────────────────────────────────────────────────────

def _detectar_sabado_anterior(hoy: date) -> date:
    wd = hoy.weekday()  # 0=lun … 5=sab, 6=dom
    if wd == 5:
        return hoy
    if wd == 6:
        return hoy - timedelta(days=1)
    if wd == 0:
        return hoy - timedelta(days=2)
    if wd == 1:
        return hoy - timedelta(days=3)
    if wd == 2:
        return hoy - timedelta(days=4)
    return hoy - timedelta(days=wd + 2)


def _festivos_configurados() -> list[date]:
    raw = persistencia.get_config("festivos", "")
    result = []
    for s in raw.split(","):
        s = s.strip()
        if s:
            try:
                result.append(date.fromisoformat(s))
            except ValueError:
                pass
    return result


# ── TRABAJADORES ─────────────────────────────────────────────────────────────

@router.get("/trabajadores")
def listar_trabajadores():
    with persistencia.conexion() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, nombre, rol, tarifa_dia, recargo_festivo, activo, orden "
                "FROM trabajadores WHERE activo = 1 ORDER BY orden, nombre"
            )
            return [dict(r) for r in cur.fetchall()]


class TrabajadorIn(BaseModel):
    nombre: str
    rol: str = "Trabajador"
    tarifa_dia: int
    recargo_festivo: float = 1.0


@router.post("/trabajadores", dependencies=[Depends(verify_pin)])
def crear_trabajador(body: TrabajadorIn):
    with persistencia.conexion() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO trabajadores (nombre, rol, tarifa_dia, recargo_festivo) "
                "VALUES (%s, %s, %s, %s) RETURNING id",
                (body.nombre.strip(), body.rol.strip(), body.tarifa_dia, body.recargo_festivo),
            )
            new_id = cur.fetchone()['id']
            cur.execute(
                "SELECT id, nombre, rol, tarifa_dia, recargo_festivo, activo, orden "
                "FROM trabajadores WHERE id = %s",
                (new_id,),
            )
            return dict(cur.fetchone())


class TrabajadorUpdate(BaseModel):
    nombre: Optional[str] = None
    rol: Optional[str] = None
    tarifa_dia: Optional[int] = None
    recargo_festivo: Optional[float] = None
    activo: Optional[int] = None


@router.put("/trabajadores/{tid}", dependencies=[Depends(verify_pin)])
def actualizar_trabajador(tid: int, body: TrabajadorUpdate):
    sets, params = [], []
    if body.nombre is not None:
        sets.append("nombre = %s"); params.append(body.nombre.strip())
    if body.rol is not None:
        sets.append("rol = %s"); params.append(body.rol.strip())
    if body.tarifa_dia is not None:
        sets.append("tarifa_dia = %s"); params.append(body.tarifa_dia)
    if body.recargo_festivo is not None:
        sets.append("recargo_festivo = %s"); params.append(body.recargo_festivo)
    if body.activo is not None:
        sets.append("activo = %s"); params.append(body.activo)
    if not sets:
        raise HTTPException(status_code=400, detail="Sin campos para actualizar")
    params.append(tid)
    with persistencia.conexion() as conn:
        with conn.cursor() as cur:
            cur.execute(f"UPDATE trabajadores SET {', '.join(sets)} WHERE id = %s", params)
    return {"ok": True}


@router.delete("/trabajadores/{tid}", dependencies=[Depends(verify_pin)])
def desactivar_trabajador(tid: int):
    with persistencia.conexion() as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE trabajadores SET activo = 0 WHERE id = %s", (tid,))
    return {"ok": True}


# ── SEMANA ACTUAL ─────────────────────────────────────────────────────────────

@router.get("/semana-actual")
def semana_actual():
    hoy = date.today()
    sabado = _detectar_sabado_anterior(hoy)
    domingo = sabado + timedelta(days=1)
    lunes = sabado + timedelta(days=2)

    festivos = _festivos_configurados()
    lunes_es_festivo = lunes in festivos

    nomina_existente = None
    with persistencia.conexion() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, estado, total FROM nomina_semana "
                "WHERE fecha_inicio = %s ORDER BY id DESC LIMIT 1",
                (sabado.isoformat(),),
            )
            row = cur.fetchone()
            if row:
                nomina_existente = {
                    "id": int(row["id"]),
                    "estado": row["estado"],
                    "total": int(row["total"]),
                }

    return {
        "fecha_sabado": sabado.isoformat(),
        "fecha_domingo": domingo.isoformat(),
        "fecha_lunes": lunes.isoformat(),
        "lunes_es_festivo": lunes_es_festivo,
        "dias_laborales": ["sabado", "domingo", "lunes"],
        "nomina_existente": nomina_existente,
    }


# ── REGISTRAR NÓMINA ─────────────────────────────────────────────────────────

class DetalleNominaIn(BaseModel):
    trabajador_id: int
    trabajo_sabado: bool = False
    trabajo_domingo: bool = False
    trabajo_lunes: bool = False
    dias_trabajados: Optional[str] = None
    total_override: Optional[int] = None


class NominaIn(BaseModel):
    fecha_inicio: str
    fecha_fin: str
    lunes_es_festivo: bool = False
    detalle: List[DetalleNominaIn]
    notas: str = ""
    estado: str = "borrador"


@router.post("/registrar", dependencies=[Depends(verify_pin)])
def registrar_nomina(body: NominaIn):
    if not body.detalle:
        raise HTTPException(status_code=400, detail="El detalle no puede estar vacío")

    trabajadores_ids = [d.trabajador_id for d in body.detalle]

    with persistencia.conexion() as conn:
        with conn.cursor() as cur:
            # Cargar datos de trabajadores
            fmt = ",".join(["%s"] * len(trabajadores_ids))
            cur.execute(
                f"SELECT id, nombre, rol, tarifa_dia, recargo_festivo FROM trabajadores WHERE id IN ({fmt})",
                trabajadores_ids,
            )
            tw_map: dict[int, Any] = {r["id"]: r for r in cur.fetchall()}

            detalles_calc = []
            total_nomina = 0

            for d in body.detalle:
                t = tw_map.get(d.trabajador_id)
                if not t:
                    continue
                tarifa = int(t["tarifa_dia"])
                recargo = float(t["recargo_festivo"])

                sab = 1 if d.trabajo_sabado else 0
                dom = 1 if d.trabajo_domingo else 0
                lun = 1 if d.trabajo_lunes else 0

                if d.total_override is not None:
                    total_t = d.total_override
                    dias_normales = len(d.dias_trabajados.split(',')) if d.dias_trabajados else (sab + dom + lun)
                    dias_festivos = 0
                else:
                    dias_festivos = lun if body.lunes_es_festivo else 0
                    dias_normales = sab + dom + (lun if not body.lunes_es_festivo else 0)
                    total_normal = dias_normales * tarifa
                    total_festivo = dias_festivos * tarifa * recargo
                    total_t = round(total_normal + total_festivo)

                total_nomina += total_t

                detalles_calc.append({
                    "trabajador_id": d.trabajador_id,
                    "nombre": t["nombre"],
                    "rol": t["rol"] or "",
                    "tarifa_dia": tarifa,
                    "recargo_festivo": recargo,
                    "sab": sab,
                    "dom": dom,
                    "lun": lun,
                    "dias_normales": dias_normales,
                    "dias_festivos": dias_festivos,
                    "total": total_t,
                })

            # Verificar si ya existe nómina para esas fechas
            cur.execute(
                "SELECT id FROM nomina_semana WHERE fecha_inicio = %s LIMIT 1",
                (body.fecha_inicio,),
            )
            existente = cur.fetchone()

            if existente:
                nomina_id = int(existente["id"])
                cur.execute(
                    "UPDATE nomina_semana SET total = %s, estado = %s, notas = %s WHERE id = %s",
                    (total_nomina, body.estado, body.notas or None, nomina_id),
                )
                cur.execute("DELETE FROM nomina_detalle WHERE nomina_id = %s", (nomina_id,))
            else:
                cur.execute(
                    "INSERT INTO nomina_semana (fecha_inicio, fecha_fin, total, estado, notas) "
                    "VALUES (%s, %s, %s, %s, %s) RETURNING id",
                    (body.fecha_inicio, body.fecha_fin, total_nomina,
                     body.estado, body.notas or None),
                )
                nomina_id = cur.fetchone()['id']

            for d in detalles_calc:
                cur.execute(
                    """
                    INSERT INTO nomina_detalle
                      (nomina_id, trabajador_id, nombre_trabajador, rol, tarifa_dia,
                       recargo_festivo, trabajo_sabado, trabajo_domingo, trabajo_lunes,
                       dias_normales, dias_festivos, total_trabajador)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    """,
                    (nomina_id, d["trabajador_id"], d["nombre"], d["rol"],
                     d["tarifa_dia"], d["recargo_festivo"],
                     d["sab"], d["dom"], d["lun"],
                     d["dias_normales"], d["dias_festivos"], d["total"]),
                )

            if body.estado == "pagada":
                cur.execute(
                    "UPDATE nomina_semana SET fecha_pago = %s WHERE id = %s",
                    (datetime.now(), nomina_id),
                )

    return {"id": nomina_id, "total": total_nomina, "num_trabajadores": len(detalles_calc)}


@router.post("/{nomina_id}/pagar", dependencies=[Depends(verify_pin)])
def pagar_nomina(nomina_id: int):
    ahora = datetime.now()
    with persistencia.conexion() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE nomina_semana SET estado='pagada', fecha_pago=%s WHERE id=%s",
                (ahora, nomina_id),
            )
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail="Nómina no encontrada")
    return {"ok": True, "fecha_pago": ahora.isoformat()}


# ── HISTORIAL ─────────────────────────────────────────────────────────────────

@router.get("/historial")
def historial_nominas(limite: int = 10):
    with persistencia.conexion() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT ns.id, ns.fecha_inicio, ns.fecha_fin, ns.total,
                       ns.estado, ns.fecha_pago, ns.notas,
                       COUNT(nd.id) AS num_trabajadores
                FROM nomina_semana ns
                LEFT JOIN nomina_detalle nd ON nd.nomina_id = ns.id
                GROUP BY ns.id
                ORDER BY ns.fecha_inicio DESC
                LIMIT %s
                """,
                (limite,),
            )
            nominas = cur.fetchall()
            result = []
            for n in nominas:
                cur.execute(
                    "SELECT * FROM nomina_detalle WHERE nomina_id = %s",
                    (n["id"],),
                )
                detalle = [dict(d) for d in cur.fetchall()]
                row = dict(n)
                row["fecha_inicio"] = str(row["fecha_inicio"])
                row["fecha_fin"] = str(row["fecha_fin"])
                row["fecha_pago"] = str(row["fecha_pago"]) if row["fecha_pago"] else None
                row["detalle"] = detalle
                result.append(row)
            return result


@router.get("/resumen", dependencies=[Depends(verify_pin)])
def resumen_nomina(desde: str, hasta: str):
    with persistencia.conexion() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT COALESCE(SUM(total), 0) AS total_nomina,
                       COUNT(*) AS num_semanas
                FROM nomina_semana
                WHERE estado = 'pagada'
                  AND fecha_inicio BETWEEN %s AND %s
                """,
                (desde, hasta),
            )
            row = cur.fetchone()
    return {
        "total_nomina": int(row["total_nomina"] or 0),
        "num_semanas": int(row["num_semanas"] or 0),
        "desde": desde,
        "hasta": hasta,
    }
