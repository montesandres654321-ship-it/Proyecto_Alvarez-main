import React, { useEffect, useState } from 'react'
import PinGuard from '../components/PinGuard'
import api, { formatCOP } from '../api/client'
import ModalConfirmarEliminar from '../components/ModalConfirmarEliminar'
import DatePicker from '../components/DatePicker'
import './Reportes.css'

// ── Helpers ──────────────────────────────────────────────────────────────────
const HOY = new Date().toISOString().slice(0, 10)

function primerDiaMes() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function mesAnteriorInicio() {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - 1)
  return d.toISOString().slice(0, 10)
}

function mesAnteriorFin() {
  const d = new Date()
  d.setDate(0) // último día del mes anterior
  return d.toISOString().slice(0, 10)
}

function ultimasCuatroSemanas() {
  const d = new Date()
  d.setDate(d.getDate() - 28)
  return d.toISOString().slice(0, 10)
}

function obtenerSabadoActual() {
  const today = new Date()
  const dow = today.getDay()
  const diffSab = dow === 6 ? 0 : dow === 0 ? -1 : -(dow + 1)
  const sab = new Date(today)
  sab.setDate(today.getDate() + diffSab)
  return sab.toISOString().slice(0, 10)
}

// ── Panel turno activo ────────────────────────────────────────────────────────
function PanelTurno({ onCambio }) {
  const [turno, setTurno]       = useState(undefined)
  const [cajero, setCajero]     = useState('')
  const [efectivo, setEfectivo] = useState('')
  const [cargando, setCargando] = useState(false)
  const [msg, setMsg]           = useState('')

  const cargarTurno = async () => {
    try { const res = await api.get('/turnos/activo'); setTurno(res.data) }
    catch { setTurno(null) }
  }
  useEffect(() => { cargarTurno() }, [])

  const abrir = async () => {
    if (!cajero.trim()) { setMsg('Ingresa el nombre del cajero'); return }
    setCargando(true)
    try {
      await api.post('/turnos/abrir', {
        cajero: cajero.trim(),
        efectivo_inicial: parseInt(efectivo || '0', 10) || 0,
      })
      await cargarTurno(); setMsg('Turno abierto')
      setCajero(''); setEfectivo(''); onCambio?.()
    } catch (e) { setMsg('Error: ' + (e?.response?.data?.detail ?? e.message)) }
    finally { setCargando(false) }
  }

  const cerrar = async () => {
    if (!turno) return; setCargando(true)
    try {
      await api.post(`/turnos/${turno.id}/cerrar`)
      await cargarTurno(); setMsg('Turno cerrado'); onCambio?.()
    } catch (e) { setMsg('Error: ' + (e?.response?.data?.detail ?? e.message)) }
    finally { setCargando(false) }
  }

  if (turno === undefined) return null
  return (
    <div className={`panel-turno ${turno ? 'abierto' : 'cerrado'}`}>
      {turno ? (
        <>
          <div className="turno-info">
            <span className="turno-badge abierto">● Caja abierta</span>
            <span className="turno-cajero">{turno.cajero}</span>
            <span className="turno-desde">Desde {String(turno.fecha_apertura).slice(11, 16)}</span>
            <span className="turno-base">Base {formatCOP(turno.efectivo_inicial)}</span>
          </div>
          <button className="btn-turno cerrar" onClick={cerrar} disabled={cargando}>
            {cargando ? 'Cerrando...' : 'Cerrar caja'}
          </button>
        </>
      ) : (
        <>
          <span className="turno-badge cerrado">● Caja cerrada</span>
          <div className="turno-abrir-form">
            <input placeholder="Nombre cajero" value={cajero} onChange={(e) => setCajero(e.target.value)} className="turno-input" autoFocus />
            <input type="number" placeholder="Efectivo inicial ($)" value={efectivo} onChange={(e) => setEfectivo(e.target.value)} className="turno-input" min="0" />
            <button className="btn-turno abrir" onClick={abrir} disabled={cargando}>
              {cargando ? 'Abriendo...' : '▶ Abrir caja'}
            </button>
          </div>
        </>
      )}
      {msg && <span className="turno-msg">{msg}</span>}
    </div>
  )
}

function BadgeMetodo({ metodo }) {
  const cls = metodo === 'Efectivo' ? 'badge-efectivo' : metodo === 'Nequi' ? 'badge-nequi' : 'badge-otro'
  return <span className={cls}>{metodo}</span>
}

// ════════════════════════════════════════════════════════════════════════════
// TAB 1 — DÍA
// ════════════════════════════════════════════════════════════════════════════
function TabDia({ recargarTurno }) {
  const [fecha, setFecha]         = useState(HOY)
  const [datos, setDatos]         = useState(null)
  const [cargando, setCargando]   = useState(false)
  const [error, setError]         = useState('')
  const [ventaAbierta, setVentaAbierta] = useState(null)
  const [modalEliminar, setModalEliminar] = useState(null)
  const [totalInsumos, setTotalInsumos] = useState(0)
  const [totalNomina, setTotalNomina]   = useState(0)
  const [totalGastos, setTotalGastos]   = useState(0)

  const cargar = async () => {
    setCargando(true); setError('')
    try {
      const res = await api.get(`/reportes/dia?fecha=${fecha}`)
      setDatos(res.data)
    } catch (e) { setError(e?.response?.data?.detail ?? 'Error al cargar') }
    finally { setCargando(false) }
  }

  const cargarInsumos = async () => {
    try {
      const res = await api.get(`/insumos/compras?fecha=${fecha}`)
      setTotalInsumos(res.data.reduce((s, c) => s + c.total, 0))
    } catch { setTotalInsumos(0) }
  }

  const cargarNomina = async () => {
    try {
      const d = new Date(fecha + 'T12:00:00')
      const wd = d.getDay()
      let delta = wd === 6 ? 0 : wd === 0 ? -1 : wd === 1 ? -2 : -(wd + 1)
      const sab = new Date(d); sab.setDate(d.getDate() + delta)
      const sabStr = sab.toISOString().slice(0, 10)
      const res = await api.get('/nomina/historial?limite=20')
      const semana = res.data.find(n => n.fecha_inicio === sabStr && n.estado === 'pagada')
      setTotalNomina(semana ? semana.total : 0)
    } catch { setTotalNomina(0) }
  }

  const cargarGastosDia = async () => {
    try {
      const res = await api.get(`/gastos/resumen?desde=${fecha}&hasta=${fecha}`)
      setTotalGastos(res.data.total ?? 0)
    } catch { setTotalGastos(0) }
  }

  useEffect(() => { cargar(); cargarInsumos(); cargarNomina(); cargarGastosDia() }, [fecha])

  const exportar = async (fmt) => {
    try {
      const res = await api.get(`/reportes/exportar/${fmt}?fecha=${fecha}`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data); const a = document.createElement('a')
      a.href = url; a.download = `alvarez_${fecha}.${fmt}`; a.click(); URL.revokeObjectURL(url)
    } catch (err) { alert('Error al exportar: ' + (err?.message ?? 'desconocido')) }
  }

  const cargarDetalle = async (id) => {
    if (ventaAbierta?.id_factura === id) { setVentaAbierta(null); return }
    try { const res = await api.get(`/ventas/${id}`); setVentaAbierta(res.data) } catch {}
  }

  const r = datos?.resumen
  const turnos = datos?.turnos ?? []
  const ventas = datos?.ventas ?? []

  return (
    <div>
      <div className="reportes-header">
        <h2>Reporte del día</h2>
        <div className="reportes-controls">
          <DatePicker
            modo="single"
            fecha={fecha}
            onChange={setFecha}
            maxFecha={HOY}
          />
          <button onClick={() => { cargar(); cargarInsumos(); cargarNomina() }} className="btn-recargar">↻</button>
          <button onClick={() => exportar('xlsx')} className="btn-export excel">Excel</button>
          <button onClick={() => exportar('json')} className="btn-export json">JSON</button>
        </div>
      </div>

      {cargando && <p className="r-cargando">Cargando...</p>}
      {error    && <p className="r-error">{error}</p>}

      {r && (
        <div className="report-cards">
          <div className="report-card">
            <div className="report-card-label">Total del día</div>
            <div className="report-card-value">{formatCOP(r.total_ventas)}</div>
            <div className="report-card-sub">{r.total_facturas} ventas</div>
          </div>
          <div className="report-card">
            <div className="report-card-label">Efectivo</div>
            <div className="report-card-value">{formatCOP(r.total_efectivo)}</div>
          </div>
          <div className="report-card">
            <div className="report-card-label">Nequi</div>
            <div className="report-card-value">{formatCOP(r.total_nequi)}</div>
          </div>
          <div className="report-card">
            <div className="report-card-label">Transf. / Otros</div>
            <div className="report-card-value">{formatCOP(r.total_transferencia + r.total_otros)}</div>
          </div>
          <div className="report-card card-vueltos">
            <div className="report-card-label">Vueltos dados</div>
            <div className="report-card-value report-card-value-danger">{formatCOP(r.total_vueltos)}</div>
          </div>
        </div>
      )}

      {r && (
        <div className="gastos-ventas-section">
          <div className="gastos-ventas-title">Gastos vs Ventas</div>
          <div className="gastos-ventas-cards gv-grid-2x2">
            <div className="gv-card"><div className="gv-label">💰 Total vendido</div><div className="gv-valor">{formatCOP(r.total_ventas)}</div></div>
            <div className="gv-card"><div className="gv-label">🛒 Total insumos</div><div className="gv-valor gv-rojo">{formatCOP(totalInsumos)}</div></div>
            <div className="gv-card"><div className="gv-label">👥 Total nómina</div><div className="gv-valor gv-rojo">{formatCOP(totalNomina)}</div></div>
            <div className="gv-card"><div className="gv-label">💸 Gastos generales</div><div className="gv-valor gv-rojo">{formatCOP(totalGastos)}</div></div>
            {(() => {
              const g = r.total_ventas - totalInsumos - totalNomina - totalGastos
              return (
                <div className={`gv-card ganancia-real ${g < 0 ? 'negativa' : ''}`} style={{ gridColumn: 'span 2' }}>
                  <div className="gv-label">📈 Ganancia real</div>
                  <div className={`gv-valor ${g >= 0 ? 'gv-verde' : 'gv-rojo'}`}>{g >= 0 ? '↑ ' : '↓ '}{formatCOP(Math.abs(g))}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>ventas − insumos − nómina − gastos</div>
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {turnos.length > 0 && (
        <div className="turnos-section">
          <div className="turnos-title">Turnos del día ({turnos.length})</div>
          {turnos.map((t) => (
            <div key={t.id} className={`turno-card ${t.estado}${t.anulado ? ' anulado' : ''}`}>
              <div className="turno-card-left">
                <div className="turno-card-cajero">👤 {t.cajero}{t.anulado && <span className="badge-anulado"> ANULADO</span>}</div>
                <div className="turno-card-horas">{t.hora_apertura}{t.hora_cierre ? ` → ${t.hora_cierre}` : <span className="turno-abierto-badge"> ● ABIERTO</span>}</div>
              </div>
              <div className="turno-card-stat"><div className="turno-stat-label">Base inicial</div><div className="turno-stat-val">{formatCOP(t.efectivo_inicial)}</div></div>
              <div className="turno-card-stat"><div className="turno-stat-label">Efectivo vendido</div><div className="turno-stat-val">{formatCOP(t.ventas_efectivo)}</div><div className="turno-stat-sub">Vueltos: {formatCOP(t.total_vueltos)}</div></div>
              <div className="turno-card-stat turno-card-caja"><div className="turno-stat-label">Efectivo en caja</div><div className="turno-stat-caja">{formatCOP(t.efectivo_esperado)}</div><div className="turno-stat-sub">{t.num_facturas} facturas</div></div>
              {!t.anulado && (
                <button className="btn-del-turno" title={t.num_facturas > 0 ? 'Anular turno' : 'Eliminar turno'}
                  onClick={() => setModalEliminar({ tipo: t.num_facturas > 0 ? 'turno-anular' : 'turno-permanente', registro: t })}>🗑</button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="tabla-ventas">
        <h3>Ventas del día ({ventas.length})</h3>
        {ventas.length === 0 ? <p className="r-sin-datos">Sin ventas para esta fecha</p> : (
          <div className="ventas-table-wrapper">
            <table className="ventas-table">
              <thead>
                <tr><th>Factura</th><th>Hora</th><th>Cajero</th><th>Metodo</th><th>Entrega</th><th>Recibido</th><th>Vuelto</th><th>Total</th><th></th></tr>
              </thead>
              <tbody>
                {ventas.map((v) => (
                  <React.Fragment key={v.id_factura}>
                    <tr className={`fila-venta${v.anulada ? ' fila-anulada' : ''}`} onClick={() => !v.anulada && cargarDetalle(v.id_factura)}>
                      <td className="td-factura">{v.id_factura}</td>
                      <td>{v.hora}</td>
                      <td className="td-cajero">{v.cajero || '—'}</td>
                      <td><BadgeMetodo metodo={v.metodo_pago} /></td>
                      <td>{v.tipo_entrega}</td>
                      <td className="td-num">{v.metodo_pago === 'Efectivo' && v.monto_recibido > 0 ? formatCOP(v.monto_recibido) : '—'}</td>
                      <td className="td-num td-vuelto">{v.metodo_pago === 'Efectivo' && v.vuelto_dado > 0 ? formatCOP(v.vuelto_dado) : '—'}</td>
                      <td className="td-total">{formatCOP(v.total)}</td>
                      <td className="td-acciones-venta">
                        {v.anulada ? <span className="badge-anulado">ANUL</span> : (
                          <button className="btn-anular-venta" title="Anular venta"
                            onClick={(e) => { e.stopPropagation(); setModalEliminar({ tipo: 'venta-anular', registro: v }) }}>🗑</button>
                        )}
                      </td>
                    </tr>
                    {ventaAbierta?.id_factura === v.id_factura && (
                      <tr className="fila-detalle"><td colSpan={9}>
                        <div className="detalle-items">
                          {ventaAbierta.items.map((it, i) => (
                            <div key={i} className="detalle-linea">
                              <span>{it.producto_nombre}</span>
                              <span>{it.cantidad} × {formatCOP(it.precio_unitario)} = {formatCOP(it.subtotal)}</span>
                            </div>
                          ))}
                        </div>
                      </td></tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalEliminar && (
        <ModalConfirmarEliminar tipo={modalEliminar.tipo} registro={modalEliminar.registro}
          onConfirmar={() => { setModalEliminar(null); cargar() }}
          onCerrar={() => setModalEliminar(null)} />
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// TAB 2 — FIN DE SEMANA
// ════════════════════════════════════════════════════════════════════════════
function TabFinSemana() {
  const [modoAuto, setModoAuto]       = useState(true)
  const [fechaManualSab, setFechaManualSab] = useState(obtenerSabadoActual())
  const [datos, setDatos]             = useState(null)
  const [gastosFS, setGastosFS]       = useState(0)
  const [cargando, setCargando]       = useState(false)
  const [error, setError]             = useState('')

  const fecha = modoAuto ? HOY : (fechaManualSab || HOY)

  const cargar = async () => {
    setCargando(true); setError('')
    try { const res = await api.get(`/reportes/fin-de-semana?fecha=${fecha}`); setDatos(res.data) }
    catch (e) { setError(e?.response?.data?.detail ?? 'Error al cargar') }
    finally { setCargando(false) }
  }

  useEffect(() => { cargar() }, [fecha])

  useEffect(() => {
    if (!datos) return
    api.get(`/gastos/resumen?desde=${datos.fecha_sabado}&hasta=${datos.fecha_lunes}`)
      .then(r => setGastosFS(r.data.total ?? 0))
      .catch(() => setGastosFS(0))
  }, [datos])

  const exportar = async () => {
    try {
      const res = await api.get(`/reportes/exportar/fin-semana?fecha=${fecha}`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data); const a = document.createElement('a')
      a.href = url; a.download = `alvarez_semana_${datos?.fecha_sabado ?? fecha}.xlsx`; a.click(); URL.revokeObjectURL(url)
    } catch (err) { alert('Error al exportar: ' + (err?.message ?? 'desconocido')) }
  }

  const fmtFecha = (iso) => {
    if (!iso) return ''
    const d = new Date(iso + 'T12:00:00')
    return d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })
  }

  const DiaCard = ({ label, fecha_str, ventas, insumos }) => (
    <div className="fin-dia-card">
      <div className="fin-dia-label">{label}</div>
      <div className="fin-dia-fecha">{fmtFecha(fecha_str)}</div>
      <div className="fin-dia-row"><span>Ventas</span><span className="fin-dia-val">{formatCOP(ventas?.total ?? 0)}</span></div>
      <div className="fin-dia-row fin-dia-sub"><span>{ventas?.facturas ?? 0} facturas</span></div>
      <div className="fin-dia-row"><span>Insumos</span><span className="fin-dia-val gv-rojo">{formatCOP(insumos ?? 0)}</span></div>
    </div>
  )

  return (
    <div>
      <div className="reportes-header">
        <h2>Fin de semana</h2>
        <div className="reportes-controls">
          <button
            className={`btn-modo-semana ${modoAuto ? 'activo' : ''}`}
            onClick={() => setModoAuto(v => !v)}
          >
            {modoAuto ? '● Auto' : '○ Manual'}
          </button>
          {!modoAuto && (
            <DatePicker
              modo="week"
              fecha={fechaManualSab}
              onChange={(sab) => setFechaManualSab(sab)}
              maxFecha={HOY}
            />
          )}
          <button onClick={cargar} className="btn-recargar">↻</button>
          <button onClick={exportar} className="btn-export excel">Excel</button>
        </div>
      </div>

      {cargando && <p className="r-cargando">Cargando...</p>}
      {error    && <p className="r-error">{error}</p>}

      {datos && (
        <>
          <div className="fin-semana-dias">
            <DiaCard label="Sábado" fecha_str={datos.fecha_sabado} ventas={datos.ventas_sabado} insumos={datos.insumos_sabado} />
            <DiaCard label="Domingo" fecha_str={datos.fecha_domingo} ventas={datos.ventas_domingo} insumos={datos.insumos_domingo} />
            <DiaCard label="Lunes" fecha_str={datos.fecha_lunes} ventas={datos.ventas_lunes} insumos={datos.insumos_lunes} />
          </div>

          <div className="fin-resumen-grid">
            <div className="gv-card">
              <div className="gv-label">💰 Total ventas</div>
              <div className="gv-valor">{formatCOP(datos.total_ventas)}</div>
              <div className="fin-sub">
                {(datos.ventas_sabado.facturas + datos.ventas_domingo.facturas + datos.ventas_lunes.facturas)} facturas
              </div>
            </div>
            <div className="gv-card">
              <div className="gv-label">🛒 Total insumos</div>
              <div className="gv-valor gv-rojo">{formatCOP(datos.total_insumos)}</div>
            </div>
            <div className="gv-card">
              <div className="gv-label">👥 Nómina semana</div>
              <div className="gv-valor gv-rojo">{formatCOP(datos.total_nomina)}</div>
              {datos.nomina && <div className="fin-sub badge-estado-{datos.nomina.estado}">{datos.nomina.estado}</div>}
              {!datos.nomina && <div className="fin-sub" style={{ color: 'var(--text-muted)' }}>Sin registrar</div>}
            </div>
            <div className="gv-card">
              <div className="gv-label">💸 Gastos generales</div>
              <div className="gv-valor gv-rojo">{formatCOP(gastosFS)}</div>
            </div>
            {(() => {
              const g = datos.ganancia - gastosFS
              return (
                <div className={`gv-card ganancia-real ${g < 0 ? 'negativa' : ''}`} style={{ gridColumn: 'span 2' }}>
                  <div className="gv-label">📈 Ganancia real</div>
                  <div className={`gv-valor ${g >= 0 ? 'gv-verde' : 'gv-rojo'}`}>
                    {g >= 0 ? '↑ ' : '↓ '}{formatCOP(Math.abs(g))}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>ventas − insumos − nómina − gastos</div>
                </div>
              )
            })()}
          </div>
        </>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// TAB 3 — MES
// ════════════════════════════════════════════════════════════════════════════
function TabMes() {
  const hoyD  = new Date()
  const [anio, setAnio] = useState(hoyD.getFullYear())
  const [mes,  setMes]  = useState(hoyD.getMonth() + 1)
  const [datos, setDatos]             = useState(null)
  const [gastosResMes, setGastosResMes] = useState(null)
  const [cargando, setCargando]       = useState(false)
  const [error, setError]             = useState('')

  const cargar = async () => {
    setCargando(true); setError('')
    try {
      const diasMes = new Date(anio, mes, 0).getDate()
      const fIni = `${anio}-${String(mes).padStart(2,'0')}-01`
      const fFin = `${anio}-${String(mes).padStart(2,'0')}-${String(diasMes).padStart(2,'0')}`
      const [repRes, gasRes] = await Promise.all([
        api.get(`/reportes/mes?anio=${anio}&mes=${mes}`),
        api.get(`/gastos/resumen?desde=${fIni}&hasta=${fFin}`),
      ])
      setDatos(repRes.data)
      setGastosResMes(gasRes.data)
    }
    catch (e) { setError(e?.response?.data?.detail ?? 'Error al cargar') }
    finally { setCargando(false) }
  }

  useEffect(() => { cargar() }, [anio, mes])

  const exportar = async () => {
    try {
      const res = await api.get(`/reportes/exportar/mes?anio=${anio}&mes=${mes}`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data); const a = document.createElement('a')
      a.href = url; a.download = `alvarez_${anio}_${String(mes).padStart(2,'0')}.xlsx`; a.click(); URL.revokeObjectURL(url)
    } catch (err) { alert('Error al exportar: ' + (err?.message ?? 'desconocido')) }
  }

  const irMesActual = () => {
    const d = new Date()
    setAnio(d.getFullYear())
    setMes(d.getMonth() + 1)
  }

  const irMesAnterior = () => {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - 1)
    setAnio(d.getFullYear())
    setMes(d.getMonth() + 1)
  }

  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  const maxVenta = datos?.por_dia?.length ? Math.max(...datos.por_dia.map(d => d.total), 1) : 1

  return (
    <div>
      <div className="reportes-header">
        <h2>Reporte mensual</h2>
        <div className="reportes-controls">
          <select className="turno-input" value={mes} onChange={(e) => setMes(Number(e.target.value))}>
            {MESES.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
          </select>
          <input type="number" className="turno-input" style={{ width: 80 }} value={anio}
            min={2020} max={2099} onChange={(e) => setAnio(Number(e.target.value))} />
          <button onClick={cargar} className="btn-recargar">↻</button>
          <button onClick={exportar} className="btn-export excel">Excel</button>
        </div>
      </div>

      <div className="rep-atajos">
        <button className="btn-atajo" onClick={irMesActual}>Mes actual</button>
        <button className="btn-atajo" onClick={irMesAnterior}>Mes anterior</button>
      </div>

      {cargando && <p className="r-cargando">Cargando...</p>}
      {error    && <p className="r-error">{error}</p>}

      {datos && (
        <>
          <div className="report-cards" style={{ gridTemplateColumns: 'repeat(2,1fr)' }}>
            <div className="report-card">
              <div className="report-card-label">Total ventas</div>
              <div className="report-card-value">{formatCOP(datos.total_ventas)}</div>
              <div className="report-card-sub">{datos.total_facturas} facturas</div>
            </div>
            <div className="report-card">
              <div className="report-card-label">Efectivo</div>
              <div className="report-card-value">{formatCOP(datos.total_efectivo)}</div>
            </div>
            <div className="report-card">
              <div className="report-card-label">Nequi</div>
              <div className="report-card-value">{formatCOP(datos.total_nequi)}</div>
            </div>
            <div className="report-card">
              <div className="report-card-label">Otros</div>
              <div className="report-card-value">{formatCOP(datos.total_otros)}</div>
            </div>
          </div>

          <div className="gastos-ventas-section">
            <div className="gastos-ventas-title">Resultado del mes</div>
            <div className="gastos-ventas-cards gv-grid-2x2">
              <div className="gv-card"><div className="gv-label">💰 Ventas</div><div className="gv-valor">{formatCOP(datos.total_ventas)}</div></div>
              <div className="gv-card"><div className="gv-label">🛒 Insumos</div><div className="gv-valor gv-rojo">{formatCOP(datos.total_insumos)}</div></div>
              <div className="gv-card"><div className="gv-label">👥 Nómina ({datos.num_semanas_nomina} sem.)</div><div className="gv-valor gv-rojo">{formatCOP(datos.total_nomina)}</div></div>
              <div className="gv-card"><div className="gv-label">💸 Gastos generales</div><div className="gv-valor gv-rojo">{formatCOP(gastosResMes?.total ?? 0)}</div></div>
              {(() => {
                const g = datos.ganancia - (gastosResMes?.total ?? 0)
                return (
                  <div className={`gv-card ganancia-real ${g < 0 ? 'negativa' : ''}`} style={{ gridColumn: 'span 2' }}>
                    <div className="gv-label">📈 Ganancia</div>
                    <div className={`gv-valor ${g >= 0 ? 'gv-verde' : 'gv-rojo'}`}>{g >= 0 ? '↑ ' : '↓ '}{formatCOP(Math.abs(g))}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>ventas − insumos − nómina − gastos</div>
                  </div>
                )
              })()}
            </div>
          </div>

          {datos.por_dia.length > 0 && (
            <div className="mes-barras-section">
              <div className="gastos-ventas-title">Ventas por día</div>
              <div className="mes-barras">
                {datos.por_dia.map(d => (
                  <div key={d.fecha} className="mes-barra-col" title={`${d.fecha}: ${formatCOP(d.total)} (${d.facturas} fact.)`}>
                    <div className="mes-barra-wrap">
                      <div className="mes-barra-fill" style={{ height: `${Math.round((d.total / maxVenta) * 100)}%` }} />
                    </div>
                    <div className="mes-barra-day">{d.fecha.slice(8)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {datos.top_productos.length > 0 && (
            <div className="top-productos-section">
              <div className="gastos-ventas-title">Top productos del mes</div>
              <table className="ventas-table">
                <thead><tr><th>Producto</th><th style={{ textAlign: 'right' }}>Cantidad</th><th style={{ textAlign: 'right' }}>Total</th></tr></thead>
                <tbody>
                  {datos.top_productos.map((p, i) => (
                    <tr key={i}>
                      <td>{p.nombre}</td>
                      <td style={{ textAlign: 'right' }}>{p.cantidad}</td>
                      <td style={{ textAlign: 'right' }} className="td-total">{formatCOP(p.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// TAB 4 — TRABAJADOR
// ════════════════════════════════════════════════════════════════════════════
function TabTrabajador() {
  const [trabajadores, setTrabajadores] = useState([])
  const [selId, setSelId]       = useState('')
  const [desde, setDesde]       = useState(mesAnteriorInicio())
  const [hasta, setHasta]       = useState(HOY)
  const [datos, setDatos]       = useState(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError]       = useState('')

  useEffect(() => {
    api.get('/nomina/trabajadores').then(r => setTrabajadores(r.data)).catch(() => {})
  }, [])

  const cargar = async () => {
    if (!selId) return
    setCargando(true); setError('')
    try { const res = await api.get(`/reportes/trabajador?trabajador_id=${selId}&desde=${desde}&hasta=${hasta}`); setDatos(res.data) }
    catch (e) { setError(e?.response?.data?.detail ?? 'Error al cargar') }
    finally { setCargando(false) }
  }

  useEffect(() => { if (selId) cargar() }, [selId, desde, hasta])

  const exportar = async () => {
    if (!selId) return
    try {
      const res = await api.get(`/reportes/exportar/trabajador?trabajador_id=${selId}&desde=${desde}&hasta=${hasta}`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data); const a = document.createElement('a')
      a.href = url; a.download = `alvarez_trabajador_${selId}_${desde}.xlsx`; a.click(); URL.revokeObjectURL(url)
    } catch (err) { alert('Error al exportar: ' + (err?.message ?? 'desconocido')) }
  }

  const fmtFecha = (iso) => {
    if (!iso) return ''
    const d = new Date(iso + 'T12:00:00')
    return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
  }

  return (
    <div>
      <div className="reportes-header">
        <h2>Reporte por trabajador</h2>
        <div className="reportes-controls">
          <select className="turno-input" value={selId} onChange={(e) => setSelId(e.target.value)}>
            <option value="">Seleccionar trabajador…</option>
            {trabajadores.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
          <button onClick={cargar} className="btn-recargar" disabled={!selId}>↻</button>
          <button onClick={exportar} className="btn-export excel" disabled={!selId || !datos}>Excel</button>
        </div>
      </div>

      <div className="rango-fechas">
        <DatePicker
          modo="single"
          fecha={desde}
          onChange={setDesde}
          maxFecha={hasta || HOY}
          placeholder="Desde"
        />
        <span style={{ color: 'var(--text-muted)' }}>—</span>
        <DatePicker
          modo="single"
          fecha={hasta}
          onChange={setHasta}
          maxFecha={HOY}
          placeholder="Hasta"
        />
      </div>

      {!selId && <p className="r-sin-datos">Selecciona un trabajador para ver su reporte</p>}
      {cargando && <p className="r-cargando">Cargando...</p>}
      {error    && <p className="r-error">{error}</p>}

      {datos && (
        <>
          <div className="trab-header-card">
            <div className="trab-nombre">{datos.trabajador.nombre}</div>
            <div className="trab-rol">{datos.trabajador.rol}</div>
            <div className="trab-tarifa">Tarifa: {formatCOP(datos.trabajador.tarifa_dia)}/día</div>
          </div>

          <div className="gastos-ventas-cards gv-grid-2x2" style={{ marginBottom: 20 }}>
            <div className="gv-card"><div className="gv-label">💰 Total ganado</div><div className="gv-valor gv-verde">{formatCOP(datos.total_ganado)}</div></div>
            <div className="gv-card"><div className="gv-label">📅 Semanas</div><div className="gv-valor">{datos.num_semanas}</div></div>
            <div className="gv-card">
              <div className="gv-label">📆 Días trabajados</div>
              <div className="gv-valor">{datos.dias_sabado + datos.dias_domingo + datos.dias_lunes}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                Sáb {datos.dias_sabado} · Dom {datos.dias_domingo} · Lun {datos.dias_lunes}
              </div>
            </div>
            <div className="gv-card"><div className="gv-label">🎉 Días festivos</div><div className="gv-valor">{datos.dias_festivos}</div></div>
          </div>

          {datos.semanas.length > 0 && (
            <div className="tabla-ventas">
              <h3>Semanas trabajadas ({datos.semanas.length})</h3>
              <div className="ventas-table-wrapper">
                <table className="ventas-table">
                  <thead>
                    <tr><th>Semana</th><th>Sáb</th><th>Dom</th><th>Lun</th><th>Días norm.</th><th>Días fest.</th><th>Estado</th><th style={{ textAlign: 'right' }}>Total</th></tr>
                  </thead>
                  <tbody>
                    {datos.semanas.map((s, i) => (
                      <tr key={i}>
                        <td style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{fmtFecha(s.fecha_inicio)} – {fmtFecha(s.fecha_fin)}</td>
                        <td style={{ textAlign: 'center' }}>{s.sab ? '✓' : '—'}</td>
                        <td style={{ textAlign: 'center' }}>{s.dom ? '✓' : '—'}</td>
                        <td style={{ textAlign: 'center' }}>{s.lun ? '✓' : '—'}</td>
                        <td style={{ textAlign: 'center' }}>{s.dias_normales}</td>
                        <td style={{ textAlign: 'center' }}>{s.dias_festivos}</td>
                        <td><span className={s.estado === 'pagada' ? 'badge-efectivo' : 'badge-otro'}>{s.estado}</span></td>
                        <td className="td-total" style={{ textAlign: 'right' }}>{formatCOP(s.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// TAB 5 — GENERAL
// ════════════════════════════════════════════════════════════════════════════
function TabGeneral() {
  const [desde, setDesde]             = useState(primerDiaMes())
  const [hasta, setHasta]             = useState(HOY)
  const [datos, setDatos]             = useState(null)
  const [gastosResumen, setGastosResumen] = useState(null)
  const [cargando, setCargando]       = useState(false)
  const [error, setError]             = useState('')

  const cargar = async () => {
    setCargando(true); setError('')
    try {
      const [repRes, gasRes] = await Promise.all([
        api.get(`/reportes/general?desde=${desde}&hasta=${hasta}`),
        api.get(`/gastos/resumen?desde=${desde}&hasta=${hasta}`),
      ])
      setDatos(repRes.data)
      setGastosResumen(gasRes.data)
    }
    catch (e) { setError(e?.response?.data?.detail ?? 'Error al cargar') }
    finally { setCargando(false) }
  }

  useEffect(() => { cargar() }, [desde, hasta])

  const exportar = async () => {
    try {
      const res = await api.get(`/reportes/exportar/general?desde=${desde}&hasta=${hasta}`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data); const a = document.createElement('a')
      a.href = url; a.download = `alvarez_general_${desde}_${hasta}.xlsx`; a.click(); URL.revokeObjectURL(url)
    } catch (err) { alert('Error al exportar: ' + (err?.message ?? 'desconocido')) }
  }

  const maxVenta = datos?.ventas_por_dia?.length ? Math.max(...datos.ventas_por_dia.map(d => d.total), 1) : 1

  return (
    <div>
      <div className="reportes-header">
        <h2>Reporte general</h2>
        <div className="reportes-controls">
          <DatePicker
            modo="range"
            fechaDesde={desde}
            fechaHasta={hasta}
            onChangeRango={(d, h) => {
              setDesde(d || primerDiaMes())
              setHasta(h || HOY)
            }}
            maxFecha={HOY}
            placeholder="Seleccionar rango de fechas"
          />
          <button onClick={cargar} className="btn-recargar">↻</button>
          <button onClick={exportar} className="btn-export excel" disabled={!datos}>Excel</button>
        </div>
      </div>

      <div className="rep-atajos">
        <button className="btn-atajo" onClick={() => { setDesde(primerDiaMes()); setHasta(HOY) }}>
          Este mes
        </button>
        <button className="btn-atajo" onClick={() => { setDesde(mesAnteriorInicio()); setHasta(mesAnteriorFin()) }}>
          Mes anterior
        </button>
        <button className="btn-atajo" onClick={() => { setDesde(ultimasCuatroSemanas()); setHasta(HOY) }}>
          Últimas 4 semanas
        </button>
      </div>

      {cargando && <p className="r-cargando">Cargando...</p>}
      {error    && <p className="r-error">{error}</p>}

      {datos && (
        <>
          <div className="gastos-ventas-section">
            <div className="gastos-ventas-title">Resultado del período {desde} → {hasta}</div>
            <div className="gastos-ventas-cards gv-grid-2x2">
              <div className="gv-card"><div className="gv-label">💰 Ventas totales</div><div className="gv-valor">{formatCOP(datos.total_ventas)}</div><div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{datos.total_facturas} facturas</div></div>
              <div className="gv-card"><div className="gv-label">🛒 Insumos</div><div className="gv-valor gv-rojo">{formatCOP(datos.total_insumos)}</div></div>
              <div className="gv-card"><div className="gv-label">👥 Nómina ({datos.num_semanas_nomina} sem.)</div><div className="gv-valor gv-rojo">{formatCOP(datos.total_nomina)}</div></div>
              <div className="gv-card"><div className="gv-label">💸 Gastos generales</div><div className="gv-valor gv-rojo">{formatCOP(gastosResumen?.total ?? 0)}</div></div>
              {(() => {
                const g = datos.ganancia - (gastosResumen?.total ?? 0)
                return (
                  <div className={`gv-card ganancia-real ${g < 0 ? 'negativa' : ''}`} style={{ gridColumn: 'span 2' }}>
                    <div className="gv-label">📈 Ganancia real</div>
                    <div className={`gv-valor ${g >= 0 ? 'gv-verde' : 'gv-rojo'}`}>{g >= 0 ? '↑ ' : '↓ '}{formatCOP(Math.abs(g))}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>ventas − insumos − nómina − gastos</div>
                  </div>
                )
              })()}
            </div>
          </div>

          <div className="report-cards" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 20 }}>
            <div className="report-card"><div className="report-card-label">Efectivo</div><div className="report-card-value">{formatCOP(datos.total_efectivo)}</div></div>
            <div className="report-card"><div className="report-card-label">Nequi</div><div className="report-card-value">{formatCOP(datos.total_nequi)}</div></div>
            <div className="report-card"><div className="report-card-label">Otros</div><div className="report-card-value">{formatCOP(datos.total_otros)}</div></div>
          </div>

          {gastosResumen?.por_categoria?.length > 0 && (
            <div className="gastos-ventas-section" style={{ marginBottom: 20 }}>
              <div className="gastos-ventas-title">💸 Gastos por categoría</div>
              <div className="gastos-reporte-cats">
                {gastosResumen.por_categoria.map(c => (
                  <div key={c.categoria} className="gasto-cat-reporte-row">
                    <span>{c.emoji} {c.categoria}</span>
                    <span style={{ fontWeight: 600, color: '#f87171', fontVariantNumeric: 'tabular-nums' }}>{formatCOP(c.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {datos.ventas_por_dia.length > 0 && (
            <div className="mes-barras-section">
              <div className="gastos-ventas-title">Ventas día a día</div>
              <div className="mes-barras">
                {datos.ventas_por_dia.map(d => (
                  <div key={d.fecha} className="mes-barra-col" title={`${d.fecha}: ${formatCOP(d.total)} (${d.facturas} fact.)`}>
                    <div className="mes-barra-wrap">
                      <div className="mes-barra-fill" style={{ height: `${Math.round((d.total / maxVenta) * 100)}%` }} />
                    </div>
                    <div className="mes-barra-day">{d.fecha.slice(5)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {datos.top_productos.length > 0 && (
            <div className="top-productos-section">
              <div className="gastos-ventas-title">Top productos del período</div>
              <table className="ventas-table">
                <thead><tr><th>Producto</th><th style={{ textAlign: 'right' }}>Cantidad</th><th style={{ textAlign: 'right' }}>Total</th></tr></thead>
                <tbody>
                  {datos.top_productos.map((p, i) => (
                    <tr key={i}>
                      <td>{p.nombre}</td>
                      <td style={{ textAlign: 'right' }}>{p.cantidad}</td>
                      <td style={{ textAlign: 'right' }} className="td-total">{formatCOP(p.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {datos.nomina_semanas.length > 0 && (
            <div className="top-productos-section">
              <div className="gastos-ventas-title">Semanas de nómina pagadas ({datos.nomina_semanas.length})</div>
              <table className="ventas-table">
                <thead><tr><th>Semana</th><th style={{ textAlign: 'right' }}>Total</th></tr></thead>
                <tbody>
                  {datos.nomina_semanas.map(n => (
                    <tr key={n.id}>
                      <td style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{n.fecha_inicio} – {n.fecha_fin}</td>
                      <td className="td-total" style={{ textAlign: 'right' }}>{formatCOP(n.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// TAB 0 — DASHBOARD
// ════════════════════════════════════════════════════════════════════════════

const COLORES_BARRA = [
  '#CE1126', '#b50f21', '#8a0a19',
  '#660816', '#660816',
  '#3a0a0d', '#3a0a0d', '#3a0a0d', '#3a0a0d', '#3a0a0d',
]

function computarPeriodo(p) {
  const hoy = new Date().toISOString().slice(0, 10)
  const d   = new Date()
  if (p === 'mes') {
    const ini = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
    return { desde: ini, hasta: hoy }
  }
  if (p === 'trimestre') {
    const t = new Date(d); t.setDate(t.getDate() - 90)
    return { desde: t.toISOString().slice(0, 10), hasta: hoy }
  }
  // anio
  return { desde: `${d.getFullYear()}-01-01`, hasta: hoy }
}

function TabDashboard() {
  const [datos,          setDatos]          = useState(null)
  const [topProductos,   setTopProductos]   = useState([])
  const [periodo,        setPeriodo]        = useState('mes')
  const [cargando,       setCargando]       = useState(true)
  const [cargandoTop,    setCargandoTop]    = useState(false)
  const [creditosDatos,  setCreditosDatos]  = useState({ total: 0, count: 0 })
  const [gastosMes,      setGastosMes]      = useState(0)

  useEffect(() => {
    const cargarCreditos = async () => {
      try {
        const res = await fetch('/creditos')
        const data = await res.json()
        if (Array.isArray(data)) {
          const total = data.reduce((s, c) => s + (c.saldo ?? (c.total_deuda - c.total_pagado)), 0)
          setCreditosDatos({ total, count: data.length })
        }
      } catch {}
    }
    cargarCreditos()
  }, [])

  useEffect(() => {
    const cargar = async () => {
      setCargando(true)
      try {
        const hoyD = new Date()
        const mesIni = `${hoyD.getFullYear()}-${String(hoyD.getMonth()+1).padStart(2,'0')}-01`
        const mesFin = new Date(hoyD.getFullYear(), hoyD.getMonth()+1, 0).toISOString().slice(0,10)
        const [dashRes, gasRes] = await Promise.all([
          api.get('/reportes/dashboard'),
          api.get(`/gastos/resumen?desde=${mesIni}&hasta=${mesFin}`),
        ])
        setDatos(dashRes.data)
        setTopProductos(dashRes.data.top_productos || [])
        setGastosMes(gasRes.data.total ?? 0)
      } catch {}
      finally { setCargando(false) }
    }
    cargar()
  }, [])

  useEffect(() => {
    if (!datos) return
    const { desde, hasta } = computarPeriodo(periodo)
    const cargarTop = async () => {
      setCargandoTop(true)
      try {
        const res = await api.get(`/reportes/top-productos?desde=${desde}&hasta=${hasta}&limite=10`)
        setTopProductos(res.data.productos || [])
      } catch {}
      finally { setCargandoTop(false) }
    }
    cargarTop()
  }, [periodo, datos])

  const estrella = datos?.top_productos?.[0]
  const mejorSemana = datos?.top_semanas?.[0]

  if (cargando) {
    return (
      <div>
        <div className="dashboard-cards-mini">
          {[1,2,3,4].map(i => (
            <div key={i} className="dashboard-mini-card">
              <div className="dashboard-skeleton" style={{ height: 12, width: '60%', marginBottom: 10 }} />
              <div className="dashboard-skeleton" style={{ height: 24, width: '80%', marginBottom: 8 }} />
              <div className="dashboard-skeleton" style={{ height: 10, width: '50%' }} />
            </div>
          ))}
        </div>
        <div className="dashboard-skeleton" style={{ height: 200, borderRadius: 10, marginBottom: 16 }} />
        <div className="dashboard-skeleton" style={{ height: 200, borderRadius: 10 }} />
      </div>
    )
  }

  if (!datos) return <p className="r-error">Error al cargar el dashboard</p>

  return (
    <div>
      {/* ── 4 mini cards ── */}
      <div className="dashboard-cards-mini">
        <div className="dashboard-mini-card">
          <div className="dashboard-mini-label">Ventas hoy</div>
          <div className="dashboard-mini-val">{formatCOP(datos.hoy.total_ventas)}</div>
          <div className="dashboard-mini-sub">{datos.hoy.num_facturas} facturas hoy</div>
        </div>
        <div className="dashboard-mini-card">
          <div className="dashboard-mini-label">Efectivo en caja hoy</div>
          <div className="dashboard-mini-val">{formatCOP(datos.hoy.total_efectivo)}</div>
          <div className="dashboard-mini-sub">vueltos: {formatCOP(datos.hoy.total_vueltos)}</div>
        </div>
        <div className="dashboard-mini-card">
          <div className="dashboard-mini-label">Producto estrella del mes</div>
          <div className="dashboard-mini-val rojo" style={{ fontSize: 14 }}>
            {estrella?.nombre || '—'}
          </div>
          <div className="dashboard-mini-sub">{estrella ? `${estrella.unidades} uds vendidas` : 'Sin datos'}</div>
        </div>
        <div className="dashboard-mini-card">
          <div className="dashboard-mini-label">Mejor fin de semana</div>
          <div className="dashboard-mini-val" style={{ fontSize: 14 }}>
            {mejorSemana?.label || '—'}
          </div>
          <div className="dashboard-mini-sub">{mejorSemana ? formatCOP(mejorSemana.total_ventas) : 'Sin datos'}</div>
        </div>
        {creditosDatos.count > 0 && (
          <div className="dashboard-mini-card" style={{ borderColor: '#F0A500' }}>
            <div className="dashboard-mini-label" style={{ color: '#F0A500' }}>💳 Créditos pendientes</div>
            <div className="dashboard-mini-val rojo" style={{ color: '#F0A500' }}>{formatCOP(creditosDatos.total)}</div>
            <div className="dashboard-mini-sub">{creditosDatos.count} cliente{creditosDatos.count !== 1 ? 's' : ''}</div>
          </div>
        )}
      </div>

      {/* ── Filtro de período ── */}
      <div className="dashboard-filtro">
        {[
          { id: 'mes',       label: 'Último mes' },
          { id: 'trimestre', label: 'Últimos 3 meses' },
          { id: 'anio',      label: 'Este año' },
        ].map(p => (
          <button
            key={p.id}
            className={periodo === p.id ? 'activo' : ''}
            onClick={() => setPeriodo(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* ── Top 10 productos ── */}
      <div className="dashboard-section">
        <div className="dashboard-section-title">
          🏆 Productos más vendidos
          {cargandoTop && <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>  actualizando…</span>}
        </div>
        {topProductos.length === 0 ? (
          <p className="r-sin-datos">Sin ventas en este período</p>
        ) : (() => {
          const maxUni = topProductos[0]?.unidades || 1
          return topProductos.map((p, i) => {
            const pct = p.porcentaje != null ? p.porcentaje : Math.round((p.unidades / maxUni) * 100)
            return (
              <div key={p.nombre} className="top-bar-row">
                <div className="top-bar-pos">{i + 1}</div>
                <div className="top-bar-nombre" title={p.nombre}>{p.nombre}</div>
                <div className="top-bar-track">
                  <div
                    className="top-bar-fill"
                    style={{ width: `${pct}%`, background: COLORES_BARRA[i] || COLORES_BARRA[9] }}
                  >
                    {p.unidades} uds
                  </div>
                </div>
                <div className="top-bar-val">{formatCOP(p.total_cop)}</div>
              </div>
            )
          })
        })()}
      </div>

      {/* ── Top fines de semana ── */}
      <div className="dashboard-section">
        <div className="dashboard-section-title">
          📅 Fines de semana más vendidos — {new Date().getFullYear()}
        </div>
        {datos.top_semanas.length === 0 ? (
          <p className="r-sin-datos">Sin datos de fines de semana</p>
        ) : (() => {
          const maxSemana = datos.top_semanas[0]?.total_ventas || 1
          return datos.top_semanas.map((s, i) => (
            <div key={s.fecha_sabado} className="top-bar-row">
              <div className="top-bar-pos">{i + 1}</div>
              <div className="top-bar-nombre">
                {s.label}{i === 0 ? ' 🏆' : ''}
              </div>
              <div className="top-bar-track">
                <div
                  className="top-bar-fill"
                  style={{
                    width: `${Math.round(s.total_ventas / maxSemana * 100)}%`,
                    background: COLORES_BARRA[i] || COLORES_BARRA[4],
                  }}
                >
                  {formatCOP(s.total_ventas)}
                </div>
              </div>
              <div className="top-bar-val">{s.num_facturas} fact.</div>
            </div>
          ))
        })()}
      </div>

      {/* ── Resumen del mes ── */}
      <div className="dashboard-section">
        <div className="dashboard-section-title">📆 Resumen del mes actual</div>
        <div className="gastos-ventas-cards gv-grid-2x2">
          <div className="gv-card">
            <div className="gv-label">💰 Ventas</div>
            <div className="gv-valor">{formatCOP(datos.mes.total_ventas)}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{datos.mes.total_facturas} facturas</div>
          </div>
          <div className="gv-card">
            <div className="gv-label">🛒 Insumos</div>
            <div className="gv-valor gv-rojo">{formatCOP(datos.mes.total_insumos)}</div>
          </div>
          <div className="gv-card">
            <div className="gv-label">👥 Nómina</div>
            <div className="gv-valor gv-rojo">{formatCOP(datos.mes.total_nomina)}</div>
          </div>
          <div className="gv-card">
            <div className="gv-label">💸 Gastos generales</div>
            <div className="gv-valor gv-rojo">{formatCOP(gastosMes)}</div>
          </div>
          {(() => {
            const g = datos.mes.ganancia - gastosMes
            return (
              <div className={`gv-card ganancia-real ${g < 0 ? 'negativa' : ''}`} style={{ gridColumn: 'span 2' }}>
                <div className="gv-label">📈 Ganancia</div>
                <div className={`gv-valor ${g >= 0 ? 'gv-verde' : 'gv-rojo'}`}>
                  {g >= 0 ? '↑ ' : '↓ '}{formatCOP(Math.abs(g))}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>ventas − insumos − nómina − gastos</div>
              </div>
            )
          })()}
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// CONTENIDO PRINCIPAL — 6 TABS
// ════════════════════════════════════════════════════════════════════════════
const TABS = [
  { id: 'dashboard',   label: '📊 Dashboard' },
  { id: 'dia',         label: '📅 Día' },
  { id: 'semana',      label: '🗓 Fin de semana' },
  { id: 'mes',         label: '📆 Mes' },
  { id: 'trabajador',  label: '👤 Trabajador' },
  { id: 'general',     label: '🔍 General' },
]

function ReportesContenido() {
  const [tab, setTab] = useState('dashboard')

  return (
    <div className="reportes-page">
      <PanelTurno />

      <div className="rep-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`rep-tab${tab === t.id ? ' active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="rep-tab-content">
        {tab === 'dashboard'  && <TabDashboard />}
        {tab === 'dia'        && <TabDia />}
        {tab === 'semana'     && <TabFinSemana />}
        {tab === 'mes'        && <TabMes />}
        {tab === 'trabajador' && <TabTrabajador />}
        {tab === 'general'    && <TabGeneral />}
      </div>
    </div>
  )
}

export default function Reportes() {
  return <ReportesContenido />
}
