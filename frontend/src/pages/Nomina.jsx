import { useEffect, useState } from 'react'
import api, { formatCOP } from '../api/client'
import DatePicker from '../components/DatePicker'
import { formatMiles, parseMiles } from '../utils/formatMiles'
import './Nomina.css'

function formatFecha(iso) {
  if (!iso) return ''
  const [, m, d] = iso.split('-')
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
  return `${parseInt(d)} ${meses[parseInt(m) - 1]}`
}

function formatSemana(inicio, fin) {
  if (!inicio || !fin) return ''
  const [ay, am, ad] = inicio.split('-')
  const [, , fd] = fin.split('-')
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
  return `${parseInt(ad)}–${parseInt(fd)} ${meses[parseInt(am) - 1]} ${ay}`
}

export default function Nomina() {
  const hoy = new Date().toISOString().split('T')[0]

  const [diasSeleccionados, setDiasSeleccionados] = useState([])
  const [trabajadores, setTrabajadores]   = useState([])
  const [asistencia, setAsistencia]       = useState({})
  const [guardando, setGuardando]         = useState(false)
  const [confirmacion, setConfirmacion]   = useState(null)
  const [historial, setHistorial]         = useState([])
  const [expandido, setExpandido]         = useState(null)
  const [msg, setMsg]                     = useState('')
  const [tarifasEdit, setTarifasEdit]     = useState({})
  const [editandoTarifa, setEditandoTarifa] = useState(null)

  const cargarDatos = async () => {
    try {
      const res = await api.get('/nomina/trabajadores')
      setTrabajadores(res.data)
      const init = {}
      res.data.forEach(t => { init[t.id] = [] })
      setAsistencia(init)
    } catch {}
  }

  const cargarHistorial = async () => {
    try {
      const res = await api.get('/nomina/historial?limite=5')
      setHistorial(res.data)
    } catch {}
  }

  useEffect(() => {
    cargarDatos()
    cargarHistorial()
  }, [])

  const toggleDia = (fecha) => {
    setDiasSeleccionados(prev => {
      const existe = prev.includes(fecha)
      const nuevos = existe
        ? prev.filter(d => d !== fecha)
        : [...prev, fecha].sort()
      if (existe) {
        setAsistencia(a => {
          const next = {}
          for (const tid in a) {
            next[tid] = a[tid].filter(d => d !== fecha)
          }
          return next
        })
      }
      return nuevos
    })
  }

  const toggleAsistencia = (tid, fecha) => {
    setAsistencia(prev => {
      const actual = prev[tid] || []
      const existe = actual.includes(fecha)
      return {
        ...prev,
        [tid]: existe ? actual.filter(d => d !== fecha) : [...actual, fecha].sort(),
      }
    })
  }

  const getTarifa = (t) => tarifasEdit[t.id] !== undefined ? tarifasEdit[t.id] : t.tarifa_dia

  const calcularTotalTrabajador = (t) => {
    const dias = (asistencia[t.id] || []).length
    const tarifa = getTarifa(t)
    return dias * (typeof tarifa === 'string' ? parseMiles(tarifa) : tarifa)
  }

  const guardarTarifa = async (t) => {
    const nuevo = parseMiles(tarifasEdit[t.id] ?? String(t.tarifa_dia))
    if (!nuevo || nuevo === t.tarifa_dia) {
      setEditandoTarifa(null)
      setTarifasEdit(prev => { const n = { ...prev }; delete n[t.id]; return n })
      return
    }
    try {
      await api.put(`/nomina/trabajadores/${t.id}`, { tarifa_dia: nuevo })
      setTrabajadores(prev => prev.map(w => w.id === t.id ? { ...w, tarifa_dia: nuevo } : w))
    } catch {}
    setEditandoTarifa(null)
    setTarifasEdit(prev => { const n = { ...prev }; delete n[t.id]; return n })
  }

  const totalNomina = trabajadores.reduce((s, t) => s + calcularTotalTrabajador(t), 0)

  const guardarNomina = async (estado) => {
    if (diasSeleccionados.length === 0) {
      setMsg('Selecciona al menos un día en el calendario')
      setTimeout(() => setMsg(''), 3000)
      return
    }

    const detalle = trabajadores
      .filter(t => (asistencia[t.id] || []).length > 0)
      .map(t => {
        const tarifa = typeof getTarifa(t) === 'string'
          ? parseMiles(getTarifa(t))
          : getTarifa(t)
        return {
          trabajador_id: t.id,
          dias_trabajados: (asistencia[t.id] || []).join(','),
          total_override: calcularTotalTrabajador(t),
          trabajo_sabado: false,
          trabajo_domingo: false,
          trabajo_lunes: false,
        }
      })

    if (detalle.length === 0) {
      setMsg('Marca la asistencia de al menos un trabajador')
      setTimeout(() => setMsg(''), 3000)
      return
    }

    setGuardando(true)
    try {
      await api.post('/nomina/registrar', {
        fecha_inicio: diasSeleccionados[0],
        fecha_fin: diasSeleccionados[diasSeleccionados.length - 1],
        lunes_es_festivo: false,
        detalle,
        estado,
      })

      if (estado === 'pagada') {
        setConfirmacion({
          total: totalNomina,
          hora: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
          semana: formatSemana(diasSeleccionados[0], diasSeleccionados[diasSeleccionados.length - 1]),
        })
        setTimeout(() => setConfirmacion(null), 3000)
      } else {
        setMsg('✅ Borrador guardado')
        setTimeout(() => setMsg(''), 3000)
      }
      await cargarHistorial()
    } catch (e) {
      setMsg('Error: ' + (e?.response?.data?.detail ?? e.message))
      setTimeout(() => setMsg(''), 4000)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="nomina-page">
      {/* ── Encabezado ── */}
      <div className="nomina-header">
        <div>
          <h2>Nómina</h2>
          <p className="nomina-subtitulo">
            {diasSeleccionados.length === 0
              ? 'Selecciona los días trabajados en el calendario'
              : `${diasSeleccionados.length} día${diasSeleccionados.length !== 1 ? 's' : ''} seleccionado${diasSeleccionados.length !== 1 ? 's' : ''}: ${diasSeleccionados.map(formatFecha).join(', ')}`
            }
          </p>
        </div>
      </div>

      {/* ── Selector de días ── */}
      <div className="nomina-nav-semana">
        <DatePicker
          modo="multi"
          diasSeleccionados={diasSeleccionados}
          onToggle={toggleDia}
          maxFecha={hoy}
          placeholder="Seleccionar días trabajados"
        />
        {diasSeleccionados.length > 0 && (
          <button
            className="btn-semana-hoy"
            onClick={() => {
              setDiasSeleccionados([])
              const init = {}
              trabajadores.forEach(t => { init[t.id] = [] })
              setAsistencia(init)
            }}
          >
            Limpiar días
          </button>
        )}
      </div>

      {msg && <div className="nomina-msg">{msg}</div>}

      {confirmacion && (
        <div className="nomina-confirmacion">
          <div className="confirmacion-icon">✅</div>
          <div className="confirmacion-titulo">Nómina pagada</div>
          <div className="confirmacion-hora">{confirmacion.semana} · {confirmacion.hora}</div>
          <div className="confirmacion-total">{formatCOP(confirmacion.total)}</div>
        </div>
      )}

      {/* ── Tabla de asistencia ── */}
      {trabajadores.length === 0 ? (
        <div className="nomina-sin-trabajadores">
          No hay trabajadores registrados. Agrégalos desde Admin → Trabajadores.
        </div>
      ) : (
        <>
          <div className="nomina-tabla-wrapper">
          <table className="nomina-tabla">
            <thead>
              <tr>
                <th>Trabajador</th>
                <th>Rol</th>
                <th style={{ textAlign: 'right' }}>Tarifa/día</th>
                {diasSeleccionados.map(d => (
                  <th key={d} style={{ textAlign: 'center', minWidth: 52 }}>
                    <span className="th-dia-short">{formatFecha(d)}</span>
                  </th>
                ))}
                {diasSeleccionados.length === 0 && (
                  <th style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>← días</th>
                )}
                <th style={{ textAlign: 'center' }}>Días</th>
                <th style={{ textAlign: 'right' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {trabajadores.map(t => {
                const diasT = asistencia[t.id] || []
                const total = calcularTotalTrabajador(t)
                return (
                  <tr key={t.id}>
                    <td className="td-nombre">{t.nombre}</td>
                    <td className="td-rol">{t.rol}</td>
                    <td style={{ textAlign: 'right' }}>
                      {editandoTarifa === t.id ? (
                        <input
                          className="tarifa-input"
                          autoFocus
                          value={tarifasEdit[t.id] ?? formatMiles(t.tarifa_dia)}
                          onChange={e => setTarifasEdit(prev => ({ ...prev, [t.id]: e.target.value }))}
                          onBlur={() => guardarTarifa(t)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') guardarTarifa(t)
                            if (e.key === 'Escape') {
                              setEditandoTarifa(null)
                              setTarifasEdit(prev => { const n = { ...prev }; delete n[t.id]; return n })
                            }
                          }}
                        />
                      ) : (
                        <span
                          className="tarifa-display"
                          onClick={() => {
                            setEditandoTarifa(t.id)
                            setTarifasEdit(prev => ({ ...prev, [t.id]: formatMiles(t.tarifa_dia) }))
                          }}
                          title="Clic para editar"
                        >
                          {formatMiles(getTarifa(t))}
                        </span>
                      )}
                    </td>
                    {diasSeleccionados.map(d => (
                      <td key={d} style={{ textAlign: 'center' }}>
                        <button
                          className={`asistencia-btn${diasT.includes(d) ? ' asistencia-presente' : ' asistencia-ausente'}`}
                          onClick={() => toggleAsistencia(t.id, d)}
                        >
                          {diasT.includes(d) ? '✓' : ''}
                        </button>
                      </td>
                    ))}
                    {diasSeleccionados.length === 0 && <td></td>}
                    <td className="td-dias">{diasT.length}</td>
                    <td className="td-total-trabajador">
                      {total > 0 ? formatCOP(total) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="nomina-total-row">
                <td colSpan={3 + diasSeleccionados.length + (diasSeleccionados.length === 0 ? 1 : 0)} className="total-label">TOTAL NÓMINA</td>
                <td></td>
                <td className="total-valor">{formatCOP(totalNomina)}</td>
              </tr>
            </tfoot>
          </table>
          </div>

          <div className="nomina-actions">
            <button
              className="btn-guardar-nomina"
              onClick={() => guardarNomina('borrador')}
              disabled={totalNomina === 0 || guardando}
            >
              Guardar borrador
            </button>
            <button
              className="btn-pagar-nomina"
              onClick={() => guardarNomina('pagada')}
              disabled={totalNomina === 0 || guardando}
            >
              {guardando ? 'Procesando...' : `Confirmar pago ${formatCOP(totalNomina)}`}
            </button>
          </div>
        </>
      )}

      {/* ── Historial ── */}
      <div className="nomina-historial">
        {historial.length > 0 && (
          <>
            <div className="nomina-historial-titulo">
              Nóminas anteriores ({historial.length})
            </div>
            {historial.map(n => (
              <div
                key={n.id}
                className="nomina-hist-item"
                onClick={() => setExpandido(expandido === n.id ? null : n.id)}
              >
                <div className="nomina-hist-header">
                  <div className="nomina-hist-izq">
                    <span className="nomina-hist-semana">
                      {formatSemana(n.fecha_inicio, n.fecha_fin)}
                    </span>
                    <span className={`badge-${n.estado}`}>
                      {n.estado === 'pagada' ? 'PAGADA' : 'BORRADOR'}
                    </span>
                  </div>
                  <span className="nomina-hist-total">{formatCOP(n.total)}</span>
                </div>
                {expandido === n.id && n.detalle.length > 0 && (
                  <div className="nomina-hist-detalle">
                    {n.detalle.map(d => (
                      <div key={d.id} className="nomina-hist-row">
                        <span>{d.nombre_trabajador} ({d.dias_normales + d.dias_festivos} días)</span>
                        <span>{formatCOP(d.total_trabajador)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
