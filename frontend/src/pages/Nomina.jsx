import { useEffect, useState } from 'react'
import api, { formatCOP } from '../api/client'
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
  const [semana, setSemana]               = useState(null)
  const [lunesEsFestivo, setLunesEsFestivo] = useState(false)
  const [trabajadores, setTrabajadores]   = useState([])
  const [asistencia, setAsistencia]       = useState({})
  const [guardando, setGuardando]         = useState(false)
  const [confirmacion, setConfirmacion]   = useState(null)
  const [historial, setHistorial]         = useState([])
  const [expandido, setExpandido]         = useState(null)
  const [msg, setMsg]                     = useState('')

  const cargarDatos = async () => {
    try {
      const [semRes, trabRes] = await Promise.all([
        api.get('/nomina/semana-actual'),
        api.get('/nomina/trabajadores'),
      ])
      setSemana(semRes.data)
      setLunesEsFestivo(semRes.data.lunes_es_festivo)
      setTrabajadores(trabRes.data)
      // Inicializar asistencia en false para todos
      const init = {}
      trabRes.data.forEach(t => { init[t.id] = { sab: false, dom: false, lun: false } })
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

  const toggleAsistencia = (tid, dia) => {
    setAsistencia(prev => ({
      ...prev,
      [tid]: { ...(prev[tid] || {}), [dia]: !(prev[tid]?.[dia]) },
    }))
  }

  // Calcular total por trabajador
  const calcularTotalTrabajador = (t) => {
    const a = asistencia[t.id] || { sab: false, dom: false, lun: false }
    const tarifa = t.tarifa_dia
    const recargo = parseFloat(t.recargo_festivo) || 1.0
    const diasFest = lunesEsFestivo && a.lun ? 1 : 0
    const diasNorm = (a.sab ? 1 : 0) + (a.dom ? 1 : 0) + (!lunesEsFestivo && a.lun ? 1 : 0)
    return Math.round(diasNorm * tarifa + diasFest * tarifa * recargo)
  }

  const totalNomina = trabajadores.reduce((s, t) => s + calcularTotalTrabajador(t), 0)

  const guardarNomina = async (estado) => {
    const detalle = trabajadores
      .filter(t => {
        const a = asistencia[t.id] || {}
        return a.sab || a.dom || a.lun
      })
      .map(t => {
        const a = asistencia[t.id] || {}
        return {
          trabajador_id: t.id,
          trabajo_sabado: !!a.sab,
          trabajo_domingo: !!a.dom,
          trabajo_lunes: !!a.lun,
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
        fecha_inicio: semana.fecha_sabado,
        fecha_fin: semana.fecha_lunes,
        lunes_es_festivo: lunesEsFestivo,
        detalle,
        estado,
      })

      if (estado === 'pagada') {
        setConfirmacion({
          total: totalNomina,
          hora: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
          semana: formatSemana(semana.fecha_sabado, semana.fecha_lunes),
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

  const mostrarLunes = true // siempre mostramos lunes, con o sin festivo

  return (
    <div className="nomina-page">
      {/* ── Encabezado ── */}
      <div className="nomina-header">
        <div>
          <h2>Nómina del fin de semana</h2>
          {semana && (
            <p className="nomina-subtitulo">
              Sáb {formatFecha(semana.fecha_sabado)} · Dom {formatFecha(semana.fecha_domingo)}
              {' · '}Lun {formatFecha(semana.fecha_lunes)}
              {lunesEsFestivo && ' 🎉'}
            </p>
          )}
        </div>
      </div>

      {/* ── Toggle lunes festivo ── */}
      <div className="festivo-toggle">
        <span className="toggle-label">
          ¿El lunes {semana ? formatFecha(semana.fecha_lunes) : ''} es festivo?
          {lunesEsFestivo && ' — se aplica recargo festivo por trabajador'}
        </span>
        <button
          className={`toggle-switch ${lunesEsFestivo ? 'on' : 'off'}`}
          onClick={() => setLunesEsFestivo(v => !v)}
        >
          <span className="toggle-thumb" />
        </button>
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
          <table className="nomina-tabla">
            <thead>
              <tr>
                <th>Trabajador</th>
                <th>Rol</th>
                <th>Sáb {semana ? formatFecha(semana.fecha_sabado) : ''}</th>
                <th>Dom {semana ? formatFecha(semana.fecha_domingo) : ''}</th>
                <th>
                  Lun {semana ? formatFecha(semana.fecha_lunes) : ''}
                  {lunesEsFestivo ? ' 🎉' : ''}
                </th>
                <th style={{ textAlign: 'center' }}>Días</th>
                <th style={{ textAlign: 'right' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {trabajadores.map(t => {
                const a = asistencia[t.id] || { sab: false, dom: false, lun: false }
                const diasFest = lunesEsFestivo && a.lun ? 1 : 0
                const diasNorm = (a.sab ? 1 : 0) + (a.dom ? 1 : 0) + (!lunesEsFestivo && a.lun ? 1 : 0)
                const total = calcularTotalTrabajador(t)
                return (
                  <tr key={t.id}>
                    <td className="td-nombre">{t.nombre}</td>
                    <td className="td-rol">{t.rol}</td>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        className="asistencia-check"
                        checked={!!a.sab}
                        onChange={() => toggleAsistencia(t.id, 'sab')}
                      />
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        className="asistencia-check"
                        checked={!!a.dom}
                        onChange={() => toggleAsistencia(t.id, 'dom')}
                      />
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        className="asistencia-check"
                        checked={!!a.lun}
                        onChange={() => toggleAsistencia(t.id, 'lun')}
                      />
                    </td>
                    <td className="td-dias">{diasNorm + diasFest}</td>
                    <td className="td-total-trabajador">
                      {total > 0 ? formatCOP(total) : '—'}
                      {diasFest > 0 && (
                        <span className="recargo-badge" title={`Recargo ${t.recargo_festivo}x`}> ×{t.recargo_festivo}</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="nomina-total-row">
                <td colSpan={5} className="total-label">TOTAL NÓMINA</td>
                <td></td>
                <td className="total-valor">{formatCOP(totalNomina)}</td>
              </tr>
            </tfoot>
          </table>

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
