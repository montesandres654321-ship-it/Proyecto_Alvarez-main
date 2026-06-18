"""Endpoints de reportes: cuadre de caja, ventas y exportaciones."""

import backend  # noqa: F401
import calendar

from datetime import date, timedelta
from io import BytesIO

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse, StreamingResponse
import persistencia
from persistencia import (
    reporte_cuadre_caja,
    reporte_dia,
    exportar_ventas_json,
    listar_ventas,
    listar_ventas_por_fecha,
    anular_venta,
    ErrorBaseDatos,
)
from backend.schemas import (
    CuadreCajaOut, DesglosePago, FacturaResumen,
    ReporteDiaOut, ResumenDia, TurnoResumen, VentaDiaOut,
)
from backend.dependencies import verify_pin

router = APIRouter(prefix="/reportes", tags=["reportes"])


@router.get("/cuadre", response_model=CuadreCajaOut)
def cuadre(fecha: str = Query(default_factory=lambda: date.today().isoformat())):
    try:
        datos = reporte_cuadre_caja(fecha)
    except ErrorBaseDatos as e:
        raise HTTPException(status_code=500, detail=str(e))
    ef = datos.get("efectivo", {})
    nq = datos.get("nequi", {})
    return CuadreCajaOut(
        fecha=datos["fecha"],
        facturas=int(datos.get("facturas", 0)),
        total_general=int(datos.get("total_general", 0)),
        efectivo=DesglosePago(cantidad=int(ef.get("cantidad", 0)), total=int(ef.get("total", 0))),
        nequi=DesglosePago(cantidad=int(nq.get("cantidad", 0)), total=int(nq.get("total", 0))),
    )


@router.get("/dia", response_model=ReporteDiaOut)
def reporte_dia_endpoint(
    fecha: str = Query(default_factory=lambda: date.today().isoformat()),
):
    """Reporte completo del día: resumen, turnos con cuadre de caja y lista de ventas."""
    try:
        datos = reporte_dia(fecha)
    except ErrorBaseDatos as e:
        raise HTTPException(status_code=500, detail=str(e))

    resumen = ResumenDia(**datos["resumen"])
    turnos  = [TurnoResumen(**t) for t in datos["turnos"]]
    ventas  = [VentaDiaOut(**v) for v in datos["ventas"]]
    return ReporteDiaOut(fecha=datos["fecha"], resumen=resumen, turnos=turnos, ventas=ventas)


@router.get("/ventas", response_model=list[FacturaResumen])
def ventas_reporte(
    desde: str | None = Query(None, description="YYYY-MM-DD inicio del rango"),
    hasta: str | None = Query(None, description="YYYY-MM-DD fin del rango"),
    limite: int = Query(50, ge=1, le=500),
):
    try:
        if desde and hasta:
            from datetime import datetime, timedelta
            d_inicio = datetime.strptime(desde, "%Y-%m-%d").date()
            d_fin    = datetime.strptime(hasta, "%Y-%m-%d").date()
            resultado = []
            d = d_inicio
            while d <= d_fin and len(resultado) < limite:
                resultado.extend(listar_ventas_por_fecha(d.isoformat()))
                d += timedelta(days=1)
            ventas = resultado[:limite]
        elif desde:
            ventas = listar_ventas_por_fecha(desde)
        else:
            ventas = listar_ventas(limite=limite)
    except ErrorBaseDatos as e:
        raise HTTPException(status_code=500, detail=str(e))

    return [
        FacturaResumen(
            id_factura=v["id_factura"],
            fecha_hora=str(v["fecha_hora"]),
            total_pagar=int(v["total_pagar"]),
            metodo_pago=v["metodo_pago"],
            tipo_entrega=v["tipo_entrega"],
            telefono_cliente=v.get("telefono_cliente") or "",
        )
        for v in ventas
    ]


@router.delete("/ventas/{id_factura}", dependencies=[Depends(verify_pin)])
def anular_venta_endpoint(id_factura: str):
    """Anula una venta (la marca como anulada, no la elimina)."""
    try:
        anular_venta(id_factura)
    except ErrorBaseDatos as e:
        raise HTTPException(status_code=404, detail=str(e))
    return {"ok": True, "mensaje": f"Venta {id_factura} anulada"}


@router.get("/exportar/json")
def exportar_json(
    fecha: str = Query(default_factory=lambda: date.today().isoformat()),
):
    try:
        ruta = exportar_ventas_json(fecha=fecha)
    except ErrorBaseDatos as e:
        raise HTTPException(status_code=500, detail=str(e))
    return FileResponse(path=str(ruta), media_type="application/json", filename=ruta.name)


@router.get("/exportar/xlsx")
@router.get("/exportar/excel")   # alias para compatibilidad
def exportar_excel_endpoint(
    fecha: str = Query(default_factory=lambda: date.today().isoformat()),
):
    try:
        from exportar_excel import exportar_ventas_excel
        output = BytesIO()
        exportar_ventas_excel(fecha=fecha, output=output)
        output.seek(0)
    except ImportError as e:
        raise HTTPException(status_code=500, detail=f"openpyxl no instalado: {e}")
    except ErrorBaseDatos as e:
        raise HTTPException(status_code=500, detail=str(e))
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="alvarez_{fecha}.xlsx"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


# ── UTILIDADES INTERNAS ───────────────────────────────────────────────────────

MESES_ES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio",
            "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]


def _sabado_de_semana(d: date) -> date:
    wd = d.weekday()  # 0=lun…5=sab,6=dom
    if wd == 5: return d
    if wd == 6: return d - timedelta(days=1)
    if wd == 0: return d - timedelta(days=2)
    if wd == 1: return d - timedelta(days=3)
    if wd == 2: return d - timedelta(days=4)
    return d - timedelta(days=wd + 2)


def _ventas_dia(cur, fecha_str: str) -> dict:
    cur.execute(
        """
        SELECT COALESCE(SUM(total_pagar),0) AS total, COUNT(*) AS facturas,
               COALESCE(SUM(CASE WHEN metodo_pago='Efectivo' THEN total_pagar ELSE 0 END),0) AS efectivo,
               COALESCE(SUM(CASE WHEN metodo_pago='Nequi'    THEN total_pagar ELSE 0 END),0) AS nequi,
               COALESCE(SUM(CASE WHEN metodo_pago NOT IN ('Efectivo','Nequi') THEN total_pagar ELSE 0 END),0) AS otros
        FROM ventas
        WHERE LEFT(fecha_hora,10)=%s AND (anulada=0 OR anulada IS NULL)
        """, (fecha_str,),
    )
    r = cur.fetchone()
    return {k: int(r[k] or 0) for k in ("total","facturas","efectivo","nequi","otros")}


def _insumos_dia(cur, fecha_str: str) -> int:
    cur.execute("SELECT COALESCE(SUM(total),0) AS t FROM compras WHERE fecha=%s", (fecha_str,))
    return int(cur.fetchone()["t"] or 0)


def _excel_response(output: BytesIO, filename: str) -> StreamingResponse:
    output.seek(0)
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


# ── FIN DE SEMANA ─────────────────────────────────────────────────────────────

@router.get("/fin-de-semana")
def reporte_fin_semana(
    fecha: str = Query(default_factory=lambda: date.today().isoformat()),
):
    try:
        d = date.fromisoformat(fecha)
    except ValueError:
        raise HTTPException(status_code=400, detail="Fecha inválida YYYY-MM-DD")
    sab = _sabado_de_semana(d)
    dom = sab + timedelta(days=1)
    lun = sab + timedelta(days=2)
    sab_s, dom_s, lun_s = sab.isoformat(), dom.isoformat(), lun.isoformat()

    try:
        with persistencia.conexion() as conn:
            with conn.cursor() as cur:
                v_sab = _ventas_dia(cur, sab_s)
                v_dom = _ventas_dia(cur, dom_s)
                v_lun = _ventas_dia(cur, lun_s)
                ti_sab = _insumos_dia(cur, sab_s)
                ti_dom = _insumos_dia(cur, dom_s)
                ti_lun = _insumos_dia(cur, lun_s)
                cur.execute(
                    "SELECT id, total, estado FROM nomina_semana WHERE fecha_inicio=%s LIMIT 1",
                    (sab_s,),
                )
                ns = cur.fetchone()
    except ErrorBaseDatos as e:
        raise HTTPException(status_code=500, detail=str(e))

    total_ventas  = v_sab["total"] + v_dom["total"] + v_lun["total"]
    total_insumos = ti_sab + ti_dom + ti_lun
    nomina        = {"id": int(ns["id"]), "total": int(ns["total"]), "estado": ns["estado"]} if ns else None
    total_nomina  = nomina["total"] if nomina else 0

    return {
        "fecha_sabado": sab_s, "fecha_domingo": dom_s, "fecha_lunes": lun_s,
        "ventas_sabado": v_sab, "ventas_domingo": v_dom, "ventas_lunes": v_lun,
        "total_ventas": total_ventas,
        "insumos_sabado": ti_sab, "insumos_domingo": ti_dom, "insumos_lunes": ti_lun,
        "total_insumos": total_insumos,
        "nomina": nomina, "total_nomina": total_nomina,
        "ganancia": total_ventas - total_insumos - total_nomina,
    }


@router.get("/exportar/fin-semana")
def exportar_excel_fin_semana(
    fecha: str = Query(default_factory=lambda: date.today().isoformat()),
):
    try:
        from exportar_excel import exportar_fin_semana
        output = BytesIO()
        exportar_fin_semana(fecha=fecha, output=output)
        output.seek(0)
    except ImportError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except ErrorBaseDatos as e:
        raise HTTPException(status_code=500, detail=str(e))
    try:
        d = date.fromisoformat(fecha)
        sab = _sabado_de_semana(d)
    except ValueError:
        sab = date.fromisoformat(fecha)
    return _excel_response(output, f"alvarez_semana_{sab.isoformat()}.xlsx")


# ── MES ───────────────────────────────────────────────────────────────────────

@router.get("/mes")
def reporte_mes(
    anio: int = Query(default_factory=lambda: date.today().year),
    mes:  int = Query(default_factory=lambda: date.today().month),
):
    if not (1 <= mes <= 12):
        raise HTTPException(status_code=400, detail="Mes inválido (1-12)")
    _, dias_mes = calendar.monthrange(anio, mes)
    f_ini = date(anio, mes, 1).isoformat()
    f_fin = date(anio, mes, dias_mes).isoformat()

    try:
        with persistencia.conexion() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT COALESCE(SUM(total_pagar),0) AS total, COUNT(*) AS facturas,
                           COALESCE(SUM(CASE WHEN metodo_pago='Efectivo' THEN total_pagar ELSE 0 END),0) AS efectivo,
                           COALESCE(SUM(CASE WHEN metodo_pago='Nequi'    THEN total_pagar ELSE 0 END),0) AS nequi,
                           COALESCE(SUM(CASE WHEN metodo_pago NOT IN ('Efectivo','Nequi') THEN total_pagar ELSE 0 END),0) AS otros
                    FROM ventas
                    WHERE LEFT(fecha_hora,10) BETWEEN %s AND %s AND (anulada=0 OR anulada IS NULL)
                    """, (f_ini, f_fin),
                )
                rv = cur.fetchone()
                cur.execute(
                    """
                    SELECT LEFT(fecha_hora,10) AS fecha,
                           COALESCE(SUM(total_pagar),0) AS total, COUNT(*) AS facturas
                    FROM ventas
                    WHERE LEFT(fecha_hora,10) BETWEEN %s AND %s AND (anulada=0 OR anulada IS NULL)
                    GROUP BY fecha ORDER BY fecha
                    """, (f_ini, f_fin),
                )
                por_dia = [{"fecha": r["fecha"], "total": int(r["total"]), "facturas": int(r["facturas"])}
                           for r in cur.fetchall()]
                cur.execute(
                    "SELECT COALESCE(SUM(total),0) AS t FROM compras WHERE fecha BETWEEN %s AND %s",
                    (f_ini, f_fin),
                )
                total_insumos = int(cur.fetchone()["t"] or 0)
                cur.execute(
                    """
                    SELECT COALESCE(SUM(total),0) AS t, COUNT(*) AS s
                    FROM nomina_semana WHERE estado='pagada' AND fecha_inicio BETWEEN %s AND %s
                    """, (f_ini, f_fin),
                )
                rn = cur.fetchone()
                cur.execute(
                    """
                    SELECT lv.producto_nombre,
                           SUM(lv.cantidad) AS cant,
                           SUM(lv.cantidad*lv.precio_unitario) AS total
                    FROM lineas_venta lv
                    JOIN ventas v ON v.id_factura=lv.id_factura
                    WHERE LEFT(v.fecha_hora,10) BETWEEN %s AND %s AND (v.anulada=0 OR v.anulada IS NULL)
                    GROUP BY lv.producto_nombre ORDER BY total DESC LIMIT 10
                    """, (f_ini, f_fin),
                )
                top_p = [{"nombre": r["producto_nombre"], "cantidad": int(r["cant"]), "total": int(r["total"])}
                         for r in cur.fetchall()]
    except ErrorBaseDatos as e:
        raise HTTPException(status_code=500, detail=str(e))

    total_ventas = int(rv["total"] or 0)
    total_nomina = int(rn["t"] or 0)
    return {
        "anio": anio, "mes": mes, "nombre_mes": MESES_ES[mes - 1],
        "total_ventas": total_ventas, "total_facturas": int(rv["facturas"] or 0),
        "total_efectivo": int(rv["efectivo"] or 0), "total_nequi": int(rv["nequi"] or 0),
        "total_otros": int(rv["otros"] or 0),
        "total_insumos": total_insumos, "total_nomina": total_nomina,
        "num_semanas_nomina": int(rn["s"] or 0),
        "ganancia": total_ventas - total_insumos - total_nomina,
        "por_dia": por_dia, "top_productos": top_p,
    }


@router.get("/exportar/mes")
def exportar_excel_mes(
    anio: int = Query(default_factory=lambda: date.today().year),
    mes:  int = Query(default_factory=lambda: date.today().month),
):
    try:
        from exportar_excel import exportar_mes
        output = BytesIO()
        exportar_mes(anio=anio, mes=mes, output=output)
        output.seek(0)
    except ImportError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except ErrorBaseDatos as e:
        raise HTTPException(status_code=500, detail=str(e))
    return _excel_response(output, f"alvarez_{anio}_{mes:02d}.xlsx")


# ── TRABAJADOR ────────────────────────────────────────────────────────────────

@router.get("/trabajador")
def reporte_trabajador(
    trabajador_id: int = Query(...),
    desde: str = Query(...),
    hasta: str = Query(...),
):
    try:
        with persistencia.conexion() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id, nombre, rol, tarifa_dia FROM trabajadores WHERE id=%s",
                    (trabajador_id,),
                )
                t = cur.fetchone()
                if not t:
                    raise HTTPException(status_code=404, detail="Trabajador no encontrado")
                cur.execute(
                    """
                    SELECT nd.trabajo_sabado, nd.trabajo_domingo, nd.trabajo_lunes,
                           nd.dias_normales, nd.dias_festivos, nd.total_trabajador,
                           ns.fecha_inicio, ns.fecha_fin, ns.estado
                    FROM nomina_detalle nd
                    JOIN nomina_semana ns ON ns.id=nd.nomina_id
                    WHERE nd.trabajador_id=%s AND ns.fecha_inicio BETWEEN %s AND %s
                    ORDER BY ns.fecha_inicio
                    """, (trabajador_id, desde, hasta),
                )
                semanas, total_ganado = [], 0
                dias_sab = dias_dom = dias_lun = dias_fest = 0
                for r in cur.fetchall():
                    semanas.append({
                        "fecha_inicio": str(r["fecha_inicio"]),
                        "fecha_fin": str(r["fecha_fin"]),
                        "estado": r["estado"],
                        "sab": int(r["trabajo_sabado"]),
                        "dom": int(r["trabajo_domingo"]),
                        "lun": int(r["trabajo_lunes"]),
                        "dias_normales": int(r["dias_normales"]),
                        "dias_festivos": int(r["dias_festivos"]),
                        "total": int(r["total_trabajador"]),
                    })
                    total_ganado += int(r["total_trabajador"])
                    dias_sab  += int(r["trabajo_sabado"])
                    dias_dom  += int(r["trabajo_domingo"])
                    dias_lun  += int(r["trabajo_lunes"])
                    dias_fest += int(r["dias_festivos"])
    except HTTPException:
        raise
    except ErrorBaseDatos as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {
        "trabajador": {"id": int(t["id"]), "nombre": t["nombre"],
                       "rol": t["rol"] or "", "tarifa_dia": int(t["tarifa_dia"])},
        "desde": desde, "hasta": hasta,
        "total_ganado": total_ganado, "num_semanas": len(semanas),
        "dias_sabado": dias_sab, "dias_domingo": dias_dom,
        "dias_lunes": dias_lun, "dias_festivos": dias_fest,
        "semanas": semanas,
    }


@router.get("/exportar/trabajador")
def exportar_excel_trabajador(
    trabajador_id: int = Query(...),
    desde: str = Query(...),
    hasta: str = Query(...),
):
    try:
        from exportar_excel import exportar_trabajador
        output = BytesIO()
        exportar_trabajador(trabajador_id=trabajador_id, desde=desde, hasta=hasta, output=output)
        output.seek(0)
    except ImportError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except ErrorBaseDatos as e:
        raise HTTPException(status_code=500, detail=str(e))
    return _excel_response(output, f"alvarez_trabajador_{trabajador_id}_{desde}_{hasta}.xlsx")


# ── GENERAL ───────────────────────────────────────────────────────────────────

@router.get("/general")
def reporte_general(
    desde: str = Query(...),
    hasta: str = Query(...),
):
    try:
        with persistencia.conexion() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT COALESCE(SUM(total_pagar),0) AS total, COUNT(*) AS facturas,
                           COALESCE(SUM(CASE WHEN metodo_pago='Efectivo' THEN total_pagar ELSE 0 END),0) AS efectivo,
                           COALESCE(SUM(CASE WHEN metodo_pago='Nequi'    THEN total_pagar ELSE 0 END),0) AS nequi,
                           COALESCE(SUM(CASE WHEN metodo_pago NOT IN ('Efectivo','Nequi') THEN total_pagar ELSE 0 END),0) AS otros
                    FROM ventas
                    WHERE LEFT(fecha_hora,10) BETWEEN %s AND %s AND (anulada=0 OR anulada IS NULL)
                    """, (desde, hasta),
                )
                rv = cur.fetchone()
                cur.execute(
                    """
                    SELECT LEFT(fecha_hora,10) AS fecha,
                           COALESCE(SUM(total_pagar),0) AS total, COUNT(*) AS facturas
                    FROM ventas
                    WHERE LEFT(fecha_hora,10) BETWEEN %s AND %s AND (anulada=0 OR anulada IS NULL)
                    GROUP BY fecha ORDER BY fecha
                    """, (desde, hasta),
                )
                ventas_por_dia = [{"fecha": r["fecha"], "total": int(r["total"]), "facturas": int(r["facturas"])}
                                  for r in cur.fetchall()]
                cur.execute(
                    "SELECT COALESCE(SUM(total),0) AS t FROM compras WHERE fecha BETWEEN %s AND %s",
                    (desde, hasta),
                )
                total_insumos = int(cur.fetchone()["t"] or 0)
                cur.execute(
                    """
                    SELECT COALESCE(SUM(total),0) AS t, COUNT(*) AS s
                    FROM nomina_semana WHERE estado='pagada' AND fecha_inicio BETWEEN %s AND %s
                    """, (desde, hasta),
                )
                rn = cur.fetchone()
                cur.execute(
                    """
                    SELECT ns.id, ns.fecha_inicio, ns.fecha_fin, ns.total, ns.estado
                    FROM nomina_semana ns
                    WHERE estado='pagada' AND fecha_inicio BETWEEN %s AND %s
                    ORDER BY fecha_inicio
                    """, (desde, hasta),
                )
                nomina_semanas = [
                    {"id": int(r["id"]), "fecha_inicio": str(r["fecha_inicio"]),
                     "fecha_fin": str(r["fecha_fin"]), "total": int(r["total"]), "estado": r["estado"]}
                    for r in cur.fetchall()
                ]
                cur.execute(
                    """
                    SELECT lv.producto_nombre,
                           SUM(lv.cantidad) AS cant,
                           SUM(lv.cantidad*lv.precio_unitario) AS total
                    FROM lineas_venta lv
                    JOIN ventas v ON v.id_factura=lv.id_factura
                    WHERE LEFT(v.fecha_hora,10) BETWEEN %s AND %s AND (v.anulada=0 OR v.anulada IS NULL)
                    GROUP BY lv.producto_nombre ORDER BY total DESC LIMIT 15
                    """, (desde, hasta),
                )
                top_p = [{"nombre": r["producto_nombre"], "cantidad": int(r["cant"]), "total": int(r["total"])}
                         for r in cur.fetchall()]
    except ErrorBaseDatos as e:
        raise HTTPException(status_code=500, detail=str(e))

    total_ventas = int(rv["total"] or 0)
    total_nomina = int(rn["t"] or 0)
    return {
        "desde": desde, "hasta": hasta,
        "total_ventas": total_ventas, "total_facturas": int(rv["facturas"] or 0),
        "total_efectivo": int(rv["efectivo"] or 0), "total_nequi": int(rv["nequi"] or 0),
        "total_otros": int(rv["otros"] or 0),
        "total_insumos": total_insumos, "total_nomina": total_nomina,
        "num_semanas_nomina": int(rn["s"] or 0),
        "ganancia": total_ventas - total_insumos - total_nomina,
        "ventas_por_dia": ventas_por_dia,
        "nomina_semanas": nomina_semanas,
        "top_productos": top_p,
    }


# ── TOP PRODUCTOS ─────────────────────────────────────────────────────────────

@router.get("/top-productos")
def top_productos(
    desde:  str | None = Query(None, description="YYYY-MM-DD"),
    hasta:  str | None = Query(None, description="YYYY-MM-DD"),
    limite: int        = Query(10, ge=1, le=20),
):
    hoy = date.today()
    f_hasta = hasta or hoy.isoformat()
    f_desde = desde or (hoy - timedelta(days=30)).isoformat()

    try:
        with persistencia.conexion() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT
                        lv.producto_nombre                              AS nombre,
                        SUM(lv.cantidad)                               AS total_unidades,
                        SUM(lv.cantidad * lv.precio_unitario)          AS total_cop,
                        COUNT(DISTINCT lv.id_factura)                  AS num_facturas
                    FROM lineas_venta lv
                    JOIN ventas v ON v.id_factura = lv.id_factura
                    WHERE (v.anulada = 0 OR v.anulada IS NULL)
                      AND LEFT(v.fecha_hora, 10) BETWEEN %s AND %s
                    GROUP BY lv.producto_nombre
                    ORDER BY total_unidades DESC
                    LIMIT %s
                    """, (f_desde, f_hasta, limite),
                )
                rows = cur.fetchall()
    except ErrorBaseDatos as e:
        raise HTTPException(status_code=500, detail=str(e))

    max_uds = int(rows[0]["total_unidades"]) if rows else 1
    productos = [
        {
            "nombre":      r["nombre"],
            "unidades":    int(r["total_unidades"]),
            "total_cop":   int(r["total_cop"] or 0),
            "num_facturas": int(r["num_facturas"]),
            "porcentaje":  round(int(r["total_unidades"]) / max_uds * 100, 1),
        }
        for r in rows
    ]
    return {"desde": f_desde, "hasta": f_hasta, "productos": productos}


# ── TOP SEMANAS ────────────────────────────────────────────────────────────────

MESES_CORTOS = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']


@router.get("/top-semanas")
def top_semanas_endpoint(
    anio:   int = Query(default_factory=lambda: date.today().year),
    limite: int = Query(10, ge=1, le=52),
):
    f_ini = date(anio, 1, 1).isoformat()
    f_fin = date(anio, 12, 31).isoformat()

    try:
        with persistencia.conexion() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT LEFT(fecha_hora, 10) AS fecha_dia,
                           COALESCE(SUM(total_pagar), 0) AS ventas_dia,
                           COUNT(*) AS facturas_dia
                    FROM ventas
                    WHERE (anulada = 0 OR anulada IS NULL)
                      AND LEFT(fecha_hora, 10) BETWEEN %s AND %s
                    GROUP BY fecha_dia
                    ORDER BY fecha_dia
                    """, (f_ini, f_fin),
                )
                dias = cur.fetchall()
    except ErrorBaseDatos as e:
        raise HTTPException(status_code=500, detail=str(e))

    semanas: dict[str, dict] = {}
    for row in dias:
        sab = _sabado_de_semana(date.fromisoformat(row["fecha_dia"]))
        sab_s = sab.isoformat()
        if sab_s not in semanas:
            semanas[sab_s] = {"total": 0, "facturas": 0}
        semanas[sab_s]["total"]    += int(row["ventas_dia"] or 0)
        semanas[sab_s]["facturas"] += int(row["facturas_dia"] or 0)

    resultado = []
    for sab_s, datos in semanas.items():
        sab = date.fromisoformat(sab_s)
        lun = sab + timedelta(days=2)
        label = f"{sab.day}–{lun.day} {MESES_CORTOS[sab.month - 1]} {sab.year}"
        resultado.append({
            "fecha_sabado": sab_s,
            "fecha_fin":    lun.isoformat(),
            "label":        label,
            "total_ventas": datos["total"],
            "num_facturas": datos["facturas"],
        })

    resultado.sort(key=lambda x: x["total_ventas"], reverse=True)
    resultado = resultado[:limite]
    for i, r in enumerate(resultado):
        r["posicion"] = i + 1

    return {"semanas": resultado}


# ── DASHBOARD ─────────────────────────────────────────────────────────────────

@router.get("/dashboard")
def dashboard():
    hoy  = date.today()
    hoy_s = hoy.isoformat()
    _, dias_mes = calendar.monthrange(hoy.year, hoy.month)
    mes_ini = date(hoy.year, hoy.month, 1).isoformat()
    mes_fin = date(hoy.year, hoy.month, dias_mes).isoformat()
    anio_ini = date(hoy.year, 1, 1).isoformat()
    anio_fin = date(hoy.year, 12, 31).isoformat()

    try:
        with persistencia.conexion() as conn:
            with conn.cursor() as cur:
                # Ventas de hoy
                v_hoy = _ventas_dia(cur, hoy_s)
                cur.execute(
                    "SELECT COALESCE(SUM(vuelto_dado),0) AS vueltos FROM ventas "
                    "WHERE LEFT(fecha_hora,10)=%s AND (anulada=0 OR anulada IS NULL)",
                    (hoy_s,),
                )
                vueltos_hoy = int(cur.fetchone()["vueltos"] or 0)

                # Top 5 productos del mes
                cur.execute(
                    """
                    SELECT lv.producto_nombre                        AS nombre,
                           SUM(lv.cantidad)                         AS total_unidades,
                           SUM(lv.cantidad * lv.precio_unitario)    AS total_cop
                    FROM lineas_venta lv
                    JOIN ventas v ON v.id_factura = lv.id_factura
                    WHERE (v.anulada = 0 OR v.anulada IS NULL)
                      AND LEFT(v.fecha_hora, 10) BETWEEN %s AND %s
                    GROUP BY lv.producto_nombre
                    ORDER BY total_unidades DESC
                    LIMIT 5
                    """, (mes_ini, mes_fin),
                )
                rows_prod = cur.fetchall()

                # Ventas por día del año para top semanas
                cur.execute(
                    """
                    SELECT LEFT(fecha_hora, 10) AS fecha_dia,
                           COALESCE(SUM(total_pagar), 0) AS ventas_dia,
                           COUNT(*) AS facturas_dia
                    FROM ventas
                    WHERE (anulada = 0 OR anulada IS NULL)
                      AND LEFT(fecha_hora, 10) BETWEEN %s AND %s
                    GROUP BY fecha_dia
                    """, (anio_ini, anio_fin),
                )
                dias = cur.fetchall()

                # Resumen del mes actual
                cur.execute(
                    """
                    SELECT COALESCE(SUM(total_pagar),0) AS total,
                           COUNT(*) AS facturas,
                           COALESCE(SUM(CASE WHEN metodo_pago='Efectivo' THEN total_pagar ELSE 0 END),0) AS efectivo,
                           COALESCE(SUM(CASE WHEN metodo_pago='Nequi'    THEN total_pagar ELSE 0 END),0) AS nequi
                    FROM ventas
                    WHERE LEFT(fecha_hora,10) BETWEEN %s AND %s
                      AND (anulada=0 OR anulada IS NULL)
                    """, (mes_ini, mes_fin),
                )
                rv_mes = cur.fetchone()

                cur.execute(
                    "SELECT COALESCE(SUM(total),0) AS t FROM compras WHERE fecha BETWEEN %s AND %s",
                    (mes_ini, mes_fin),
                )
                insumos_mes = int(cur.fetchone()["t"] or 0)

                cur.execute(
                    "SELECT COALESCE(SUM(total),0) AS t FROM nomina_semana "
                    "WHERE estado='pagada' AND fecha_inicio BETWEEN %s AND %s",
                    (mes_ini, mes_fin),
                )
                nomina_mes = int(cur.fetchone()["t"] or 0)
    except ErrorBaseDatos as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Procesar top productos
    max_uds = int(rows_prod[0]["total_unidades"]) if rows_prod else 1
    top_productos = [
        {
            "nombre":    r["nombre"],
            "unidades":  int(r["total_unidades"]),
            "total_cop": int(r["total_cop"] or 0),
            "porcentaje": round(int(r["total_unidades"]) / max_uds * 100, 1),
        }
        for r in rows_prod
    ]

    # Procesar top semanas
    semanas: dict[str, dict] = {}
    for row in dias:
        sab = _sabado_de_semana(date.fromisoformat(row["fecha_dia"]))
        sab_s = sab.isoformat()
        if sab_s not in semanas:
            semanas[sab_s] = {"total": 0, "facturas": 0}
        semanas[sab_s]["total"]    += int(row["ventas_dia"] or 0)
        semanas[sab_s]["facturas"] += int(row["facturas_dia"] or 0)

    top_semanas_list = []
    for sab_s, datos in semanas.items():
        sab = date.fromisoformat(sab_s)
        lun = sab + timedelta(days=2)
        label = f"{sab.day}–{lun.day} {MESES_CORTOS[sab.month - 1]} {sab.year}"
        top_semanas_list.append({
            "fecha_sabado": sab_s,
            "fecha_fin":    lun.isoformat(),
            "label":        label,
            "total_ventas": datos["total"],
            "num_facturas": datos["facturas"],
        })
    top_semanas_list.sort(key=lambda x: x["total_ventas"], reverse=True)
    top_semanas_list = top_semanas_list[:5]
    for i, r in enumerate(top_semanas_list):
        r["posicion"] = i + 1

    total_ventas_mes = int(rv_mes["total"] or 0)
    return {
        "hoy": {
            "total_ventas":  v_hoy["total"],
            "total_efectivo": v_hoy["efectivo"],
            "total_vueltos": vueltos_hoy,
            "num_facturas":  v_hoy["facturas"],
        },
        "mes": {
            "total_ventas":   total_ventas_mes,
            "total_facturas": int(rv_mes["facturas"] or 0),
            "total_efectivo": int(rv_mes["efectivo"] or 0),
            "total_nequi":    int(rv_mes["nequi"] or 0),
            "total_insumos":  insumos_mes,
            "total_nomina":   nomina_mes,
            "ganancia":       total_ventas_mes - insumos_mes - nomina_mes,
        },
        "top_productos": top_productos,
        "top_semanas":   top_semanas_list,
    }


@router.get("/exportar/general")
def exportar_excel_general(
    desde: str = Query(...),
    hasta: str = Query(...),
):
    try:
        from exportar_excel import exportar_general
        output = BytesIO()
        exportar_general(desde=desde, hasta=hasta, output=output)
        output.seek(0)
    except ImportError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except ErrorBaseDatos as e:
        raise HTTPException(status_code=500, detail=str(e))
    return _excel_response(output, f"alvarez_general_{desde}_{hasta}.xlsx")
