import { useEffect, useState } from 'react'
import api, { formatCOP } from '../api/client'
import DatePicker from '../components/DatePicker'
import './Insumos.css'

const UNIDADES = ['kg', 'und', 'lt', 'paq', 'gr']

function filaVacia(insumo) {
  return {
    id: insumo?.id ?? null,
    nombre: insumo?.nombre ?? '',
    unidad: insumo?.unidad ?? 'und',
    cantidad: '',
    valorUnit: insumo?.precio_ref > 0 ? String(insumo.precio_ref) : '',
    subtotal: 0,
    esExtra: !insumo,
    editandoNombre: false,
    modoSimple: false,
    totalDirecto: '',
  }
}

function formatearFechaLarga(fecha) {
  const d = new Date(fecha + 'T12:00:00')
  return d.toLocaleDateString('es-CO', {
    weekday: 'long', day: 'numeric', month: 'short', year: 'numeric'
  })
}

export default function Insumos() {
  const hoy = new Date().toISOString().slice(0, 10)

  const [fechaSeleccionada, setFechaSeleccionada] = useState(hoy)
  const [filas, setFilas] = useState([])
  const [nota, setNota] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState('')
  const [comprasHoy, setComprasHoy] = useState([])
  const [expandida, setExpandida] = useState(null)
  const [confirmacion, setConfirmacion] = useState(null)

  const cargarCatalogo = async () => {
    try {
      const res = await api.get('/insumos/catalogo')
      setFilas(res.data.map(filaVacia))
    } catch {}
  }

  const resetearFilas = async () => {
    await cargarCatalogo()
    setNota('')
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
  }, [])

  const calcularSubtotal = (f) => {
    if (f.modoSimple) return parseInt(f.totalDirecto) || 0
    return Math.round((parseFloat(f.cantidad) || 0) * (parseInt(f.valorUnit) || 0))
  }

  const actualizarFila = (idx, campo, valor) => {
    setFilas(prev => {
      const next = [...prev]
      const f = { ...next[idx], [campo]: valor }
      f.subtotal = calcularSubtotal(f)
      next[idx] = f
      return next
    })
  }

  const actualizarTotalDirecto = (idx, valor) => {
    setFilas(prev => {
      const next = [...prev]
      const f = { ...next[idx], totalDirecto: valor }
      f.subtotal = parseInt(valor) || 0
      next[idx] = f
      return next
    })
  }

  const toggleModoFila = (index) => {
    setFilas(prev => prev.map((f, i) =>
      i === index ? {
        ...f,
        modoSimple: !f.modoSimple,
        cantidad: '',
        valorUnit: '',
        totalDirecto: '',
        subtotal: 0,
      } : f
    ))
  }

  const agregarExtra = () => {
    setFilas(prev => [...prev, filaVacia(null)])
  }

  const eliminarFila = (idx) => {
    setFilas(prev => prev.filter((_, i) => i !== idx))
  }

  const toggleEditar = (index) => {
    setFilas(prev => prev.map((f, i) =>
      i === index ? { ...f, editandoNombre: !f.editandoNombre } : f
    ))
  }

  const actualizarNombre = (index, nuevoNombre) => {
    setFilas(prev => prev.map((f, i) =>
      i === index ? { ...f, nombre: nuevoNombre, editandoNombre: false } : f
    ))
  }

  const totalCompra = filas.reduce((s, f) => s + f.subtotal, 0)

  const guardarCompra = async () => {
    const detalle = filas
      .filter(f => f.subtotal > 0 && f.nombre.trim())
      .map(f => {
        if (f.modoSimple) {
          return {
            nombre_insumo: f.nombre,
            cantidad: 1,
            unidad: f.unidad,
            valor_unitario: f.subtotal,
            subtotal: f.subtotal,
          }
        }
        return {
          nombre_insumo: f.nombre,
          cantidad: parseFloat(f.cantidad),
          unidad: f.unidad,
          valor_unitario: parseInt(f.valorUnit),
          subtotal: f.subtotal,
        }
      })
    if (detalle.length === 0) return
    setGuardando(true)
    try {
      await api.post('/insumos/compras', {
        fecha: fechaSeleccionada,
        notas: nota,
        detalle,
      })
      setConfirmacion({
        total: totalCompra,
        numItems: detalle.length,
        hora: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
      })
      setTimeout(() => setConfirmacion(null), 3000)
      await resetearFilas()
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

  return (
    <div className="insumos-page">
      <div className="insumos-header">
        <h2>
          Compra de insumos — {formatearFechaLarga(fechaSeleccionada)}
        </h2>
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

      <table className="insumos-tabla">
        <colgroup>
          <col style={{ width: 32 }} />
          <col />
          <col style={{ width: 90 }} />
          <col style={{ width: 80 }} className="col-unidad" />
          <col style={{ width: 110 }} />
          <col style={{ width: 110 }} />
          <col style={{ width: 64 }} />
        </colgroup>
        <thead>
          <tr>
            <th></th>
            <th>Insumo</th>
            <th>Cantidad</th>
            <th className="th-unidad">Unidad</th>
            <th>Valor unit.</th>
            <th style={{ textAlign: 'right' }}>Subtotal</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {filas.map((fila, i) => (
            <tr key={fila.id ?? `extra-${i}`}>
              <td style={{ padding: '8px 4px' }}>
                <button
                  className={`btn-modo-fila ${fila.modoSimple ? 'modo-simple' : 'modo-detallado'}`}
                  onClick={() => toggleModoFila(i)}
                  title={fila.modoSimple ? 'Modo simple: solo total' : 'Modo detallado: cantidad × valor'}
                >
                  {fila.modoSimple ? '💰' : '📊'}
                </button>
              </td>
              <td className="insumo-nombre-celda">
                {fila.editandoNombre ? (
                  <input
                    className="nombre-editando"
                    autoFocus
                    value={fila.nombre}
                    onChange={e => actualizarFila(i, 'nombre', e.target.value)}
                    onBlur={e => actualizarNombre(i, e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && actualizarNombre(i, fila.nombre)}
                  />
                ) : fila.esExtra ? (
                  <input
                    className="insumo-nombre-input"
                    value={fila.nombre}
                    onChange={e => actualizarFila(i, 'nombre', e.target.value)}
                    placeholder="Nombre del insumo"
                  />
                ) : (
                  <span>{fila.nombre}</span>
                )}
              </td>
              {fila.modoSimple ? (
                <td colSpan={3}>
                  <input
                    className="insumo-num-input insumo-total-directo"
                    type="number"
                    min="0"
                    step="1000"
                    value={fila.totalDirecto}
                    onChange={e => actualizarTotalDirecto(i, e.target.value)}
                    placeholder="$ Total pagado"
                  />
                </td>
              ) : (
                <>
                  <td>
                    <input
                      className="insumo-num-input"
                      type="number"
                      min="0"
                      step="0.5"
                      value={fila.cantidad}
                      onChange={e => actualizarFila(i, 'cantidad', e.target.value)}
                      placeholder="0"
                    />
                  </td>
                  <td>
                    <select
                      className="insumo-unidad-select"
                      value={fila.unidad}
                      onChange={e => actualizarFila(i, 'unidad', e.target.value)}
                    >
                      {UNIDADES.map(u => <option key={u}>{u}</option>)}
                    </select>
                  </td>
                  <td>
                    <input
                      className="insumo-num-input insumo-precio"
                      type="number"
                      min="0"
                      step="500"
                      value={fila.valorUnit}
                      onChange={e => actualizarFila(i, 'valorUnit', e.target.value)}
                      placeholder="$ 0"
                    />
                  </td>
                </>
              )}
              <td className="insumo-subtotal">
                {fila.subtotal > 0 ? formatCOP(fila.subtotal) : '—'}
              </td>
              <td>
                <div className="fila-actions">
                  <button
                    className="btn-editar-fila"
                    onClick={() => toggleEditar(i)}
                    title="Editar nombre"
                  >
                    {fila.editandoNombre ? '✓' : '✏️'}
                  </button>
                  <button
                    className="btn-eliminar-fila"
                    onClick={() => eliminarFila(i)}
                    title="Eliminar fila"
                  >
                    ×
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <button className="btn-agregar-extra" onClick={agregarExtra}>
        + Agregar insumo
      </button>

      <div className="insumo-nota-row">
        <input
          className="insumo-nota-input"
          placeholder="Nota general (opcional)"
          value={nota}
          onChange={e => setNota(e.target.value)}
        />
      </div>

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

      {/* ── Historial del día ── */}
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
              : `No hay compras para el ${formatearFechaLarga(fechaSeleccionada)}`
            }
          </p>
        )}
      </div>
    </div>
  )
}
