import { useEffect, useState } from 'react'
import api, { formatCOP } from '../api/client'
import { formatMiles } from '../utils/formatMiles'
import { guardarBorradorInsumos, cargarBorradorInsumos, limpiarBorradorInsumos } from '../utils/persistencia'
import borradorSync from '../utils/borradorSync'
import usePOSStore from '../store/usePOSStore'
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
    estado: 'tentativo',
    guardando: false,
    detalleId: null,
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
  const { token } = usePOSStore()

  const [fechaSeleccionada, setFechaSeleccionada] = useState(hoy)
  const [catalogo, setCatalogo]           = useState([])
  const [seleccionados, setSeleccionados] = useState({})
  const [filas, setFilas]                 = useState({})
  const [extras, setExtras]               = useState([])
  const [nota, setNota]                   = useState('')
  const [msg, setMsg]                     = useState('')
  const [comprasHoy, setComprasHoy]       = useState([])
  const [expandida, setExpandida]         = useState(null)
  const [toast, setToast]                 = useState('')
  const [busqueda, setBusqueda]           = useState('')
  const [filtroLugar, setFiltroLugar]     = useState('todos')

  const mostrarToast = (texto) => {
    setToast(texto)
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
    // Restaurar borrador: BD primero, localStorage como fallback
    const restaurar = async () => {
      if (token) {
        const borrador = await borradorSync.get('insumos')
        if (borrador && Object.keys(borrador.seleccionados || {}).length > 0) {
          setSeleccionados(borrador.seleccionados || {})
          setFilas(borrador.filas || {})
          setExtras(borrador.extras || [])
          setNota(borrador.nota || '')
          if (borrador.fecha) setFechaSeleccionada(borrador.fecha)
          mostrarToast('📋 Borrador restaurado')
          return
        }
      }
      const borrador = cargarBorradorInsumos()
      if (borrador) {
        setSeleccionados(borrador.seleccionados || {})
        setFilas(borrador.filas || {})
        setExtras(borrador.extras || [])
        setNota(borrador.nota || '')
        if (borrador.fecha) setFechaSeleccionada(borrador.fecha)
        mostrarToast('Borrador de compra restaurado 📋')
      }
    }
    restaurar()
  }, [token])

  // Auto-guardar borrador en BD y localStorage (debounce 1.5s)
  useEffect(() => {
    const tieneDatos = Object.keys(seleccionados).length > 0 || extras.length > 0
    if (!tieneDatos) {
      limpiarBorradorInsumos()
      return
    }
    const datos = { seleccionados, filas, extras, nota, fecha: fechaSeleccionada, timestamp: Date.now() }
    guardarBorradorInsumos(datos)
    if (!token) return
    const timer = setTimeout(() => {
      borradorSync.guardar('insumos', datos)
    }, 1500)
    return () => clearTimeout(timer)
  }, [seleccionados, filas, extras, nota, token])

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
        estado: 'tentativo',
        guardando: false,
        detalleId: null,
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
      return { ...prev, [id]: { ...f, cantidad: cant, subtotal: Math.round(parseFloat(cant || 0) * (f.valorUnit || 0)) } }
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
      [id]: { ...prev[id], totalDirectoDisplay: raw ? formatMiles(raw) : '', totalDirecto: num, subtotal: num },
    }))
  }

  const actualizarUnidadFila = (id, unidad) => {
    setFilas(prev => ({ ...prev, [id]: { ...prev[id], unidad } }))
  }

  // ── Extras ────────────────────────────────────────────────────────────────

  const agregarExtra = () => setExtras(prev => [...prev, filaExtraVacia()])

  const actualizarExtra = (i, updates) => {
    setExtras(prev => { const next = [...prev]; next[i] = { ...next[i], ...updates }; return next })
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
      next[i] = { ...ex, valorUnitDisplay: raw ? formatMiles(raw) : '', valorUnit: num, subtotal: Math.round(parseFloat(ex.cantidad || 0) * num) }
      return next
    })
  }

  const actualizarExtraTotalDirecto = (i, raw) => {
    const num = raw ? parseInt(raw) : 0
    setExtras(prev => {
      const next = [...prev]
      next[i] = { ...next[i], totalDirectoDisplay: raw ? formatMiles(raw) : '', totalDirecto: num, subtotal: num }
      return next
    })
  }

  const toggleModoExtra = (i) => {
    setExtras(prev => {
      const next = [...prev]
      next[i] = { ...next[i], modoSimple: !next[i].modoSimple, cantidad: '', valorUnitDisplay: '', valorUnit: 0, subtotal: 0, totalDirectoDisplay: '', totalDirecto: 0 }
      return next
    })
  }

  const quitarExtra = (i) => setExtras(prev => prev.filter((_, j) => j !== i))

  // ── Guardar individual ───────────────────────────────────────────────────

  const guardarInsumoIndividual = async (insId, nombreInsumo, fila) => {
    const subtotalFinal = fila.modoSimple ? fila.totalDirecto : fila.subtotal
    if (subtotalFinal <= 0) {
      mostrarToast('Ingresa cantidad y valor primero')
      return
    }
    setFilas(prev => ({ ...prev, [insId]: { ...prev[insId], guardando: true } }))
    try {
      const res = await fetch('/insumos/compras/item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre_insumo: nombreInsumo,
          cantidad: fila.modoSimple ? 1 : parseFloat(fila.cantidad) || 1,
          unidad: fila.unidad,
          valor_unitario: fila.modoSimple ? fila.totalDirecto : fila.valorUnit,
          subtotal: subtotalFinal,
          fecha: fechaSeleccionada,
          notas: '',
        }),
      })
      const data = await res.json()
      if (data.ok) {
        setFilas(prev => ({
          ...prev,
          [insId]: { ...prev[insId], estado: 'guardado', guardando: false, detalleId: data.detalle_id },
        }))
        mostrarToast(`✅ ${nombreInsumo} guardado`)
        cargarComprasDelDia(fechaSeleccionada)
      } else {
        throw new Error(data.detail || 'Error')
      }
    } catch {
      setFilas(prev => ({ ...prev, [insId]: { ...prev[insId], guardando: false } }))
      mostrarToast(`❌ Error guardando ${nombreInsumo}`)
    }
  }

  const guardarExtraIndividual = async (idx, extra) => {
    const subtotalFinal = extra.modoSimple ? extra.totalDirecto : extra.subtotal
    if (subtotalFinal <= 0 || !extra.nombre.trim()) {
      mostrarToast('Ingresa nombre, cantidad y valor primero')
      return
    }
    setExtras(prev => { const next = [...prev]; next[idx] = { ...next[idx], guardando: true }; return next })
    try {
      const res = await fetch('/insumos/compras/item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre_insumo: extra.nombre,
          cantidad: extra.modoSimple ? 1 : parseFloat(extra.cantidad) || 1,
          unidad: extra.unidad,
          valor_unitario: extra.modoSimple ? extra.totalDirecto : extra.valorUnit,
          subtotal: subtotalFinal,
          fecha: fechaSeleccionada,
          notas: '',
        }),
      })
      const data = await res.json()
      if (data.ok) {
        setExtras(prev => {
          const next = [...prev]
          next[idx] = { ...next[idx], estado: 'guardado', guardando: false, detalleId: data.detalle_id }
          return next
        })
        mostrarToast(`✅ ${extra.nombre} guardado`)
        cargarComprasDelDia(fechaSeleccionada)
      } else {
        throw new Error(data.detail || 'Error')
      }
    } catch {
      setExtras(prev => { const next = [...prev]; next[idx] = { ...next[idx], guardando: false }; return next })
      mostrarToast(`❌ Error guardando ${extra.nombre}`)
    }
  }

  const guardarTodosPendientes = async () => {
    const pendientesCatalogo = catalogo.filter(ins => {
      const f = filas[ins.id]
      return seleccionados[ins.id] && f?.estado === 'tentativo' && (f.modoSimple ? f.totalDirecto : f.subtotal) > 0
    })
    for (const ins of pendientesCatalogo) {
      await guardarInsumoIndividual(ins.id, ins.nombre, filas[ins.id])
    }
    for (let i = 0; i < extras.length; i++) {
      const ex = extras[i]
      if (ex.estado === 'tentativo' && (ex.modoSimple ? ex.totalDirecto : ex.subtotal) > 0 && ex.nombre.trim()) {
        await guardarExtraIndividual(i, ex)
      }
    }
  }

  // ── Totales ───────────────────────────────────────────────────────────────

  const totalReal = Object.entries(filas)
    .filter(([id, f]) => seleccionados[id] && f.estado === 'guardado')
    .reduce((sum, [, f]) => sum + (f.modoSimple ? f.totalDirecto : f.subtotal), 0)
    + extras.filter(e => e.estado === 'guardado').reduce((sum, e) => sum + e.subtotal, 0)

  const totalTentativo = Object.entries(filas)
    .filter(([id, f]) => seleccionados[id] && f.estado === 'tentativo')
    .reduce((sum, [, f]) => sum + (f.modoSimple ? f.totalDirecto : f.subtotal), 0)
    + extras.filter(e => e.estado === 'tentativo').reduce((sum, e) => sum + e.subtotal, 0)

  const totalGeneral = totalReal + totalTentativo

  const totalSincelejo = Object.entries(filas)
    .filter(([id, f]) => {
      const ins = catalogo.find(c => c.id === parseInt(id))
      return seleccionados[id] && f.estado === 'guardado' && ins?.lugar_compra === 'sincelejo'
    })
    .reduce((sum, [, f]) => sum + (f.modoSimple ? f.totalDirecto : f.subtotal), 0)

  const totalSampues = Object.entries(filas)
    .filter(([id, f]) => {
      const ins = catalogo.find(c => c.id === parseInt(id))
      return seleccionados[id] && f.estado === 'guardado' &&
        (ins?.lugar_compra === 'sampues' || ins?.lugar_compra === 'ambos')
    })
    .reduce((sum, [, f]) => sum + (f.modoSimple ? f.totalDirecto : f.subtotal), 0)

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

      {/* ── Buscador ─────────────────────────────────────────────────────────── */}
      {Object.keys(seleccionados).length > 0 && (
        <div className="insumos-buscador">
          <div className="buscador-input-wrap">
            <span className="buscador-icon">🔍</span>
            <input
              type="text"
              className="buscador-input"
              placeholder="Buscar en seleccionados..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
            />
            {busqueda && (
              <button className="buscador-clear" onClick={() => setBusqueda('')}>×</button>
            )}
          </div>
          <div className="buscador-filtros">
            {['todos', 'sincelejo', 'sampues'].map(f => (
              <button
                key={f}
                className={`filtro-btn${filtroLugar === f ? ' activo' : ''} filtro-${f}`}
                onClick={() => setFiltroLugar(f)}
              >
                {f === 'todos' ? 'Todos' : f === 'sincelejo' ? '🔵 Sincelejo' : '🟣 Sampués'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Tarjetas detalle de catálogo ────────────────────────────────────── */}
      {Object.keys(seleccionados).length > 0 && (
        <div className="insumos-detalle-titulo">Ingresa cantidades y valores</div>
      )}

      {(() => {
        const insumosVisibles = catalogo
          .filter(ins => seleccionados[ins.id])
          .filter(ins => !busqueda || ins.nombre.toLowerCase().includes(busqueda.toLowerCase()))
          .filter(ins => {
            if (filtroLugar === 'todos') return true
            if (filtroLugar === 'sincelejo') return ins.lugar_compra === 'sincelejo'
            if (filtroLugar === 'sampues') return ins.lugar_compra === 'sampues' || ins.lugar_compra === 'ambos'
            return true
          })
        return (
          <>
            {busqueda && (
              <div className="buscador-resultado">
                {insumosVisibles.length} resultado{insumosVisibles.length !== 1 ? 's' : ''}
              </div>
            )}
            {insumosVisibles.map(ins => {
              const fila = filas[ins.id] || {}
              const esGuardado = fila.estado === 'guardado'
              const lugar = ins.lugar_compra || 'ambos'
              const claseCard = esGuardado ? 'card-guardado' : (
                lugar === 'sincelejo' ? 'card-sincelejo-lugar' :
                lugar === 'sampues' ? 'card-sampues-lugar' : 'card-tentativo'
              )
              const claseNombre = esGuardado ? 'nombre-verde' :
                lugar === 'sincelejo' ? 'sincelejo' :
                lugar === 'sampues' ? 'sampues' : ''
              const valSubtotal = fila.modoSimple ? (fila.totalDirecto || 0) : (fila.subtotal || 0)
              return (
            <div
              key={ins.id}
              className={`insumo-detalle-card ${claseCard}`}
            >
              <div className="insumo-detalle-header">
                <span className={`insumo-detalle-nombre ${claseNombre}`}>
                  ✓ {ins.nombre}
                </span>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  {esGuardado
                    ? <span className="badge-guardado">✅ Pagado</span>
                    : <span className="badge-tentativo">Tentativo</span>
                  }
                  {!esGuardado && (
                    <span className={`badge-lugar badge-lugar-${lugar}`}>
                      {lugar === 'sincelejo' ? '🔵 Sincelejo' : lugar === 'sampues' ? '🟣 Sampués' : '🟢 Ambos'}
                    </span>
                  )}
                  {!esGuardado && (
                    <button
                      className={`btn-modo-mini${fila.modoSimple ? ' modo-simple' : ''}`}
                      onClick={() => toggleModoFila(ins.id)}
                      title={fila.modoSimple ? 'Modo detallado' : 'Modo simple'}
                    >{fila.modoSimple ? '💰' : '📊'}</button>
                  )}
                  {!esGuardado && (
                    <button className="btn-quitar-insumo" onClick={() => quitarSeleccionado(ins.id)}>×</button>
                  )}
                </div>
              </div>

              {esGuardado ? (
                <div className="insumo-guardado-datos">
                  <div className="insumo-guardado-row">
                    <span className="guardado-label">Cantidad</span>
                    <span className="guardado-val">{fila.modoSimple ? 1 : fila.cantidad} {fila.unidad}</span>
                  </div>
                  <div className="insumo-guardado-row">
                    <span className="guardado-label">Valor pagado</span>
                    <span className="guardado-val verde">
                      $ {formatMiles(fila.modoSimple ? fila.totalDirecto : fila.valorUnit)}
                    </span>
                  </div>
                </div>
              ) : fila.modoSimple ? (
                <div className="insumo-campo-grupo">
                  <label>Total pagado</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    className="insumo-input-grande gold"
                    value={fila.totalDirectoDisplay || ''}
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
                      value={fila.cantidad || ''}
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
                      value={fila.unidad || ins.unidad}
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
                      value={fila.valorUnitDisplay || ''}
                      onChange={e => {
                        const raw = e.target.value.replace(/\./g, '').replace(/\D/g, '')
                        actualizarValorUnit(ins.id, raw)
                      }}
                      placeholder="$ 0"
                    />
                  </div>
                </div>
              )}

              <div className="insumo-card-footer">
                <div>
                  <div className="subtotal-label">{esGuardado ? 'Total pagado' : 'Subtotal'}</div>
                  <div className={`insumo-subtotal-val ${esGuardado ? 'verde' : ''}`}>
                    {valSubtotal > 0 ? formatMiles(valSubtotal) : '—'}
                  </div>
                </div>
                {esGuardado ? (
                  <button className="btn-ya-guardado" disabled>✓ Guardado</button>
                ) : (
                  <button
                    className="btn-guardar-individual"
                    onClick={() => guardarInsumoIndividual(ins.id, ins.nombre, fila)}
                    disabled={fila.guardando || valSubtotal <= 0}
                  >
                    {fila.guardando ? 'Guardando...' : '💾 Guardar'}
                  </button>
                )}
              </div>
            </div>
              )
            })}
          </>
        )
      })()}

      {/* ── Extras ───────────────────────────────────────────────────────────── */}
      {extras.map((ex, i) => {
        const esGuardado = ex.estado === 'guardado'
        const valSubtotal = ex.modoSimple ? (ex.totalDirecto || 0) : (ex.subtotal || 0)
        return (
          <div key={`ex-${i}`} className={`insumo-detalle-card insumo-card-extra ${esGuardado ? 'card-guardado' : ''}`}>
            <div className="insumo-detalle-header">
              {esGuardado ? (
                <span className="insumo-detalle-nombre nombre-verde">✓ {ex.nombre}</span>
              ) : (
                <input
                  className="insumo-nombre-extra"
                  value={ex.nombre}
                  onChange={e => actualizarExtra(i, { nombre: e.target.value })}
                  placeholder="Nombre del insumo"
                />
              )}
              <div style={{ display: 'flex', gap: '6px', flexShrink: 0, alignItems: 'center' }}>
                {esGuardado
                  ? <span className="badge-guardado">✅ Pagado</span>
                  : <span className="badge-tentativo">Tentativo</span>
                }
                {!esGuardado && (
                  <button
                    className={`btn-modo-mini${ex.modoSimple ? ' modo-simple' : ''}`}
                    onClick={() => toggleModoExtra(i)}
                  >{ex.modoSimple ? '💰' : '📊'}</button>
                )}
                {!esGuardado && (
                  <button className="btn-quitar-insumo" onClick={() => quitarExtra(i)}>×</button>
                )}
              </div>
            </div>

            {esGuardado ? (
              <div className="insumo-guardado-datos">
                <div className="insumo-guardado-row">
                  <span className="guardado-label">Cantidad</span>
                  <span className="guardado-val">{ex.modoSimple ? 1 : ex.cantidad} {ex.unidad}</span>
                </div>
                <div className="insumo-guardado-row">
                  <span className="guardado-label">Valor pagado</span>
                  <span className="guardado-val verde">
                    $ {formatMiles(ex.modoSimple ? ex.totalDirecto : ex.valorUnit)}
                  </span>
                </div>
              </div>
            ) : ex.modoSimple ? (
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

            <div className="insumo-card-footer">
              <div>
                <div className="subtotal-label">{esGuardado ? 'Total pagado' : 'Subtotal'}</div>
                <div className={`insumo-subtotal-val ${esGuardado ? 'verde' : ''}`}>
                  {valSubtotal > 0 ? formatMiles(valSubtotal) : '—'}
                </div>
              </div>
              {esGuardado ? (
                <button className="btn-ya-guardado" disabled>✓ Guardado</button>
              ) : (
                <button
                  className="btn-guardar-individual"
                  onClick={() => guardarExtraIndividual(i, ex)}
                  disabled={ex.guardando || valSubtotal <= 0}
                >
                  {ex.guardando ? 'Guardando...' : '💾 Guardar'}
                </button>
              )}
            </div>
          </div>
        )
      })}

      {/* ── Nota ─────────────────────────────────────────────────────────────── */}
      <div className="insumo-nota-row">
        <input
          className="insumo-nota-input"
          placeholder="Nota general (opcional)"
          value={nota}
          onChange={e => setNota(e.target.value)}
        />
      </div>

      {/* ── Box de totales ───────────────────────────────────────────────────── */}
      {(Object.keys(seleccionados).length > 0 || extras.length > 0) && (
        <div className="insumos-totales-box">
          {totalReal > 0 && (
            <>
              {totalSincelejo > 0 && (
                <div className="total-lugar sincelejo">
                  <span>🔵 Sincelejo</span>
                  <span>$ {formatMiles(totalSincelejo)}</span>
                </div>
              )}
              {totalSampues > 0 && (
                <div className="total-lugar sampues">
                  <span>🟣 Sampués</span>
                  <span>$ {formatMiles(totalSampues)}</span>
                </div>
              )}
              <div className="total-separador" />
            </>
          )}
          {totalReal > 0 && (
            <div className="total-row-real">
              <div className="total-row-label verde">✅ Total pagado</div>
              <div className="total-row-valor verde">$ {formatMiles(totalReal)}</div>
            </div>
          )}
          {totalTentativo > 0 && (
            <div className="total-row-tent">
              <div className="total-row-label gold">🟡 Por comprar</div>
              <div className="total-row-valor gold">$ {formatMiles(totalTentativo)}</div>
            </div>
          )}
          <div className="total-separador" />
          <div className="total-row-general">
            <div className="total-general-label">TOTAL ESTIMADO</div>
            <div className="total-general-valor">$ {formatMiles(totalGeneral)}</div>
          </div>
          {totalTentativo > 0 && (
            <button className="btn-guardar-pendientes" onClick={guardarTodosPendientes}>
              💾 Guardar todos los pendientes
            </button>
          )}
        </div>
      )}

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
