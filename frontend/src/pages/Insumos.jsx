import { useEffect, useState } from 'react'
import api, { formatCOP } from '../api/client'
import { formatMiles } from '../utils/formatMiles'
import { guardarBorradorInsumos, cargarBorradorInsumos, limpiarBorradorInsumos } from '../utils/persistencia'
import DatePicker from '../components/DatePicker'
import './Insumos.css'

const UNIDADES = ['kg', 'und', 'lt', 'paq', 'gr']

function filaExtraVacia() {
  return {
    nombre: '',
    cantidad: '',
    valorUnitDisplay: '',
    valorUnit: 0,
    subtotal: 0,
    unidad: 'und',
    modoSimple: false,
    totalDirectoDisplay: '',
    totalDirecto: 0,
  }
}

function formatearFechaLarga(fecha) {
  const d = new Date(fecha + 'T12:00:00')
  return d.toLocaleDateString('es-CO', {
    weekday: 'long', day: 'numeric', month: 'short', year: 'numeric',
  })
}

export default function Insumos() {
  const hoy = new Date().toISOString().slice(0, 10)

  const [fechaSeleccionada, setFechaSeleccionada] = useState(hoy)
  const [catalogo, setCatalogo]         = useState([])
  const [seleccionados, setSeleccionados] = useState({})
  const [filas, setFilas]               = useState({})
  const [extras, setExtras]             = useState([])
  const [nota, setNota]                 = useState('')
  const [guardando, setGuardando]       = useState(false)
  const [msg, setMsg]                   = useState('')
  const [comprasHoy, setComprasHoy]     = useState([])
  const [expandida, setExpandida]       = useState(null)
  const [confirmacion, setConfirmacion] = useState(null)
  const [toast, setToast]               = useState('')

  const mostrarToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const cargarCatalogo = async () => {
    try {
      const res = await api.get('/insumos/catalogo')
      setCatalogo(res.data)
    } catch {}
  }

  const cargarComprasDelDia = async (fecha) => {
    try {
      const res = await api.get(`/insumos/compras?fecha=${fecha}`)
      setComprasHoy(res.data)
    } catch {}
  }

  useEffect(() => {
    cargarCatalogo()
    cargarComprasDelDia(hoy)
    // Restaurar borrador si existe
    const borrador = cargarBorradorInsumos()
    if (borrador) {
      setSeleccionados(borrador.seleccionados || {})
      setFilas(borrador.filas || {})
      setExtras(borrador.extras || [])
      setNota(borrador.nota || '')
      if (borrador.fecha) setFechaSeleccionada(borrador.fecha)
      mostrarToast('Borrador de compra restaurado 📋')
    }
  }, [])

  // Auto-guardar borrador cuando cambian los datos
  useEffect(() => {
    const tieneDatos = Object.keys(seleccionados).length > 0 || extras.length > 0
    if (!tieneDatos) {
      limpiarBorradorInsumos()
      return
    }
    guardarBorradorInsumos({ seleccionados, filas, extras, nota, fecha: fechaSeleccionada })
  }, [seleccionados, filas, extras, nota])

  // ── Chips ────────────────────────────────────────────────────────────────

  const seleccionarChip = (ins) => {
    if (seleccionados[ins.id]) return
    setSeleccionados(prev => ({ ...prev, [ins.id]: true }))
    setFilas(prev => ({
      ...prev,
      [ins.id]: {
        cantidad: '',
        valorUnitDisplay: ins.precio_ref > 0 ? formatMiles(ins.precio_ref) : '',
        valorUnit: ins.precio_ref || 0,
        subtotal: 0,
        unidad: ins.unidad,
        modoSimple: false,
        totalDirectoDisplay: '',
        totalDirecto: 0,
      },
    }))
  }

  const quitarSeleccionado = (id) => {
    setSeleccionados(prev => { const n = { ...prev }; delete n[id]; return n })
    setFilas(prev => { const n = { ...prev }; delete n[id]; return n })
  }

  // ── Filas de catálogo ─────────────────────────────────────────────────────

  const toggleModoFila = (id) => {
    setFilas(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        modoSimple: !prev[id].modoSimple,
        cantidad: '', valorUnitDisplay: '', valorUnit: 0,
        subtotal: 0, totalDirectoDisplay: '', totalDirecto: 0,
      },
    }))
  }

  const actualizarCantidadFila = (id, cant) => {
    setFilas(prev => {
      const f = prev[id]
      const sub = Math.round(parseFloat(cant || 0) * (f.valorUnit || 0))
      return { ...prev, [id]: { ...f, cantidad: cant, subtotal: sub } }
    })
  }

  const actualizarValorUnit = (id, raw) => {
    const num = raw ? parseInt(raw) : 0
    setFilas(prev => {
      const f = prev[id]
      return {
        ...prev,
        [id]: {
          ...f,
          valorUnitDisplay: raw ? formatMiles(raw) : '',
          valorUnit: num,
          subtotal: Math.round(parseFloat(f.cantidad || 0) * num),
        },
      }
    })
  }

  const actualizarTotalDirecto = (id, raw) => {
    const num = raw ? parseInt(raw) : 0
    setFilas(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        totalDirectoDisplay: raw ? formatMiles(raw) : '',
        totalDirecto: num,
        subtotal: num,
      },
    }))
  }

  const actualizarUnidadFila = (id, unidad) => {
    setFilas(prev => ({ ...prev, [id]: { ...prev[id], unidad } }))
  }

  // ── Extras ────────────────────────────────────────────────────────────────

  const agregarExtra = () => setExtras(prev => [...prev, filaExtraVacia()])

  const actualizarExtra = (i, updates) => {
    setExtras(prev => {
      const next = [...prev]
      next[i] = { ...next[i], ...updates }
      return next
    })
  }

  const actualizarExtraCantidad = (i, cant) => {
    setExtras(prev => {
      const next = [...prev]
      const ex = next[i]
      next[i] = { ...ex, cantidad: cant, subtotal: Math.round(parseFloat(cant || 0) * (ex.valorUnit || 0)) }
      return next
    })
  }

  const actualizarExtraValorUnit = (i, raw) => {
    const num = raw ? parseInt(raw) : 0
    setExtras(prev => {
      const next = [...prev]
      const ex = next[i]
      next[i] = {
        ...ex,
        valorUnitDisplay: raw ? formatMiles(raw) : '',
        valorUnit: num,
        subtotal: Math.round(parseFloat(ex.cantidad || 0) * num),
      }
      return next
    })
  }

  const actualizarExtraTotalDirecto = (i, raw) => {
    const num = raw ? parseInt(raw) : 0
    setExtras(prev => {
      const next = [...prev]
      next[i] = {
        ...next[i],
        totalDirectoDisplay: raw ? formatMiles(raw) : '',
        totalDirecto: num,
        subtotal: num,
      }
      return next
    })
  }

  const toggleModoExtra = (i) => {
    setExtras(prev => {
      const next = [...prev]
      next[i] = {
        ...next[i],
        modoSimple: !next[i].modoSimple,
        cantidad: '', valorUnitDisplay: '', valorUnit: 0,
        subtotal: 0, totalDirectoDisplay: '', totalDirecto: 0,
      }
      return next
    })
  }

  const quitarExtra = (i) => setExtras(prev => prev.filter((_, j) => j !== i))

  // ── Totales ───────────────────────────────────────────────────────────────

  const totalSeleccionados = Object.entries(filas)
    .filter(([id]) => seleccionados[id])
    .reduce((s, [, f]) => s + f.subtotal, 0)
  const totalExtras = extras.reduce((s, ex) => s + ex.subtotal, 0)
  const totalCompra = totalSeleccionados + totalExtras

  // ── Guardar ───────────────────────────────────────────────────────────────

  const guardarCompra = async () => {
    const detalleSelected = catalogo
      .filter(ins => seleccionados[ins.id] && filas[ins.id]?.subtotal > 0)
      .map(ins => {
        const f = filas[ins.id]
        return f.modoSimple
          ? { nombre_insumo: ins.nombre, cantidad: 1, unidad: f.unidad, valor_unitario: f.subtotal, subtotal: f.subtotal }
          : { nombre_insumo: ins.nombre, cantidad: parseFloat(f.cantidad), unidad: f.unidad, valor_unitario: f.valorUnit, subtotal: f.subtotal }
      })

    const detalleExtras = extras
      .filter(ex => ex.subtotal > 0 && ex.nombre.trim())
      .map(ex => ex.modoSimple
        ? { nombre_insumo: ex.nombre, cantidad: 1, unidad: ex.unidad, valor_unitario: ex.subtotal, subtotal: ex.subtotal }
        : { nombre_insumo: ex.nombre, cantidad: parseFloat(ex.cantidad), unidad: ex.unidad, valor_unitario: ex.valorUnit, subtotal: ex.subtotal }
      )

    const detalle = [...detalleSelected, ...detalleExtras]
    if (detalle.length === 0) return

    setGuardando(true)
    try {
      await api.post('/insumos/compras', { fecha: fechaSeleccionada, notas: nota, detalle })
      setConfirmacion({
        total: totalCompra,
        numItems: detalle.length,
        hora: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
      })
      setTimeout(() => setConfirmacion(null), 3000)
      limpiarBorradorInsumos()
      setSeleccionados({})
      setFilas({})
      setExtras([])
      setNota('')
      await cargarComprasDelDia(fechaSeleccionada)
    } catch (e) {
      setMsg('Error: ' + (e?.response?.data?.detail ?? e.message))
      setTimeout(() => setMsg(''), 4000)
    } finally {
      setGuardando(false)
    }
  }

  const tituloHistorial = fechaSeleccionada === hoy
    ? `Compras registradas hoy (${comprasHoy.length})`
    : `Compras del ${formatearFechaLarga(fechaSeleccionada)} (${comprasHoy.length})`

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="insumos-page">
      <div className="insumos-header">
        <h2>Compra de insumos — {formatearFechaLarga(fechaSeleccionada)}</h2>
        <DatePicker
          modo="single"
          fecha={fechaSeleccionada}
          onChange={(nuevaFecha) => {
            setFechaSeleccionada(nuevaFecha)
            cargarComprasDelDia(nuevaFecha)
          }}
          maxFecha={hoy}
        />
      </div>

      {msg && <div className="insumos-msg">{msg}</div>}

      {confirmacion && (
        <div className="compra-confirmacion">
          <div className="confirmacion-icon">✅</div>
          <div className="confirmacion-titulo">Compra guardada</div>
          <div className="confirmacion-hora">{confirmacion.hora}</div>
          <div className="confirmacion-total">{formatCOP(confirmacion.total)}</div>
          <div className="confirmacion-items">
            {confirmacion.numItems} insumo{confirmacion.numItems !== 1 ? 's' : ''} registrado{confirmacion.numItems !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      {/* ── Chips grid ─────────────────────────────────────────────────────── */}
      <div className="insumos-chips-titulo">Toca los insumos que vas a comprar hoy</div>
      <div className="insumos-chips-grid">
        {catalogo.map(ins => (
          <button
            key={ins.id}
            className={`insumo-chip ${seleccionados[ins.id] ? 'chip-seleccionado' : 'chip-disponible'}`}
            onClick={() => seleccionarChip(ins)}
          >
            {seleccionados[ins.id] && <span className="chip-check">✓</span>}
            {ins.nombre}
          </button>
        ))}
        <button className="insumo-chip chip-extra" onClick={agregarExtra}>
          + Agregar otro
        </button>
      </div>

      {/* ── Tarjetas detalle de catálogo ────────────────────────────────────── */}
      {Object.keys(seleccionados).length > 0 && (
        <div className="insumos-detalle-titulo">Ingresa cantidades y valores</div>
      )}

      {catalogo
        .filter(ins => seleccionados[ins.id])
        .map(ins => {
          const f = filas[ins.id] || {}
          return (
            <div key={ins.id} className="insumo-detalle-card">
              <div className="insumo-detalle-header">
                <span className="insumo-detalle-nombre">✓ {ins.nombre}</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className={`btn-modo-mini${f.modoSimple ? ' modo-simple' : ''}`}
                    onClick={() => toggleModoFila(ins.id)}
                    title={f.modoSimple ? 'Modo detallado' : 'Modo simple'}
                  >{f.modoSimple ? '💰' : '📊'}</button>
                  <button className="btn-quitar-insumo" onClick={() => quitarSeleccionado(ins.id)}>×</button>
                </div>
              </div>

              {f.modoSimple ? (
                <div className="insumo-campo-grupo">
                  <label>Total pagado</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    className="insumo-input-grande gold"
                    value={f.totalDirectoDisplay || ''}
                    onChange={e => {
                      const raw = e.target.value.replace(/\./g, '').replace(/\D/g, '')
                      actualizarTotalDirecto(ins.id, raw)
                    }}
                    placeholder="$ 0"
                  />
                </div>
              ) : (
                <div className="insumo-campos-detalle">
                  <div className="insumo-campo-grupo">
                    <label>Cantidad</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      className="insumo-input-grande"
                      value={f.cantidad || ''}
                      onChange={e => actualizarCantidadFila(ins.id, e.target.value)}
                      placeholder="0"
                      min="0"
                      step="0.5"
                    />
                  </div>
                  <div className="insumo-campo-grupo">
                    <label>Unidad</label>
                    <select
                      className="insumo-select"
                      value={f.unidad || ins.unidad}
                      onChange={e => actualizarUnidadFila(ins.id, e.target.value)}
                    >
                      {UNIDADES.map(u => <option key={u}>{u}</option>)}
                    </select>
                  </div>
                  <div className="insumo-campo-grupo">
                    <label>Valor unitario</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      className="insumo-input-grande gold"
                      value={f.valorUnitDisplay || ''}
                      onChange={e => {
                        const raw = e.target.value.replace(/\./g, '').replace(/\D/g, '')
                        actualizarValorUnit(ins.id, raw)
                      }}
                      placeholder="$ 0"
                    />
                  </div>
                </div>
              )}

              <div className="insumo-subtotal-row">
                <span>Subtotal</span>
                <span className="insumo-subtotal-val">{f.subtotal > 0 ? formatMiles(f.subtotal) : '—'}</span>
              </div>
            </div>
          )
        })}

      {/* ── Extras ───────────────────────────────────────────────────────────── */}
      {extras.map((ex, i) => (
        <div key={`ex-${i}`} className="insumo-detalle-card insumo-card-extra">
          <div className="insumo-detalle-header">
            <input
              className="insumo-nombre-extra"
              value={ex.nombre}
              onChange={e => actualizarExtra(i, { nombre: e.target.value })}
              placeholder="Nombre del insumo"
            />
            <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
              <button
                className={`btn-modo-mini${ex.modoSimple ? ' modo-simple' : ''}`}
                onClick={() => toggleModoExtra(i)}
              >{ex.modoSimple ? '💰' : '📊'}</button>
              <button className="btn-quitar-insumo" onClick={() => quitarExtra(i)}>×</button>
            </div>
          </div>

          {ex.modoSimple ? (
            <div className="insumo-campo-grupo">
              <label>Total pagado</label>
              <input
                type="text"
                inputMode="numeric"
                className="insumo-input-grande gold"
                value={ex.totalDirectoDisplay || ''}
                onChange={e => {
                  const raw = e.target.value.replace(/\./g, '').replace(/\D/g, '')
                  actualizarExtraTotalDirecto(i, raw)
                }}
                placeholder="$ 0"
              />
            </div>
          ) : (
            <div className="insumo-campos-detalle">
              <div className="insumo-campo-grupo">
                <label>Cantidad</label>
                <input
                  type="number"
                  inputMode="decimal"
                  className="insumo-input-grande"
                  value={ex.cantidad || ''}
                  onChange={e => actualizarExtraCantidad(i, e.target.value)}
                  placeholder="0"
                  min="0"
                  step="0.5"
                />
              </div>
              <div className="insumo-campo-grupo">
                <label>Unidad</label>
                <select
                  className="insumo-select"
                  value={ex.unidad}
                  onChange={e => actualizarExtra(i, { unidad: e.target.value })}
                >
                  {UNIDADES.map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
              <div className="insumo-campo-grupo">
                <label>Valor unitario</label>
                <input
                  type="text"
                  inputMode="numeric"
                  className="insumo-input-grande gold"
                  value={ex.valorUnitDisplay || ''}
                  onChange={e => {
                    const raw = e.target.value.replace(/\./g, '').replace(/\D/g, '')
                    actualizarExtraValorUnit(i, raw)
                  }}
                  placeholder="$ 0"
                />
              </div>
            </div>
          )}

          <div className="insumo-subtotal-row">
            <span>Subtotal</span>
            <span className="insumo-subtotal-val">{ex.subtotal > 0 ? formatMiles(ex.subtotal) : '—'}</span>
          </div>
        </div>
      ))}

      {/* ── Nota ─────────────────────────────────────────────────────────────── */}
      <div className="insumo-nota-row">
        <input
          className="insumo-nota-input"
          placeholder="Nota general (opcional)"
          value={nota}
          onChange={e => setNota(e.target.value)}
        />
      </div>

      {/* ── Footer total ────────────────────────────────────────────────────── */}
      <div className="insumos-footer">
        <div className="insumos-total-label">TOTAL COMPRA</div>
        <div className="insumos-total-valor">{formatCOP(totalCompra)}</div>
        <button
          className="btn-guardar-compra"
          onClick={guardarCompra}
          disabled={totalCompra === 0 || guardando}
        >
          {guardando ? 'Guardando...' : 'Guardar compra'}
        </button>
      </div>

      {/* ── Historial del día ────────────────────────────────────────────────── */}
      <div className="compras-historial">
        {comprasHoy.length > 0 ? (
          <>
            <div className="compras-historial-title">{tituloHistorial}</div>
            {comprasHoy.map(c => (
              <div
                key={c.id}
                className="compra-card"
                onClick={() => setExpandida(expandida === c.id ? null : c.id)}
              >
                <div className="compra-card-header">
                  <span className="compra-card-hora">
                    {String(c.fecha_hora).slice(11, 16)}
                    {c.notas ? ` · ${c.notas}` : ''}
                  </span>
                  <span className="compra-card-total">{formatCOP(c.total)}</span>
                </div>
                {expandida === c.id && (
                  <div className="compra-detalle">
                    {c.detalle.map(d => (
                      <div key={d.id} className="compra-detalle-row">
                        <span>{d.nombre_insumo} — {d.cantidad} {d.unidad}</span>
                        <span>{formatCOP(d.subtotal)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </>
        ) : (
          <p className="compras-sin-datos">
            {fechaSeleccionada === hoy
              ? 'No hay compras registradas hoy'
              : `No hay compras para el ${formatearFechaLarga(fechaSeleccionada)}`}
          </p>
        )}
      </div>

      {toast && <div className="toast-restaurado">{toast}</div>}
    </div>
  )
}
