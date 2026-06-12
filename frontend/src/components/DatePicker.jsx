import { useState, useEffect, useRef } from 'react'
import './DatePicker.css'

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio',
  'Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DIAS_HEADER = ['L','M','X','J','V','S','D']

function formatearFecha(fecha) {
  const d = new Date(fecha + 'T12:00:00')
  return d.toLocaleDateString('es-CO', {
    weekday: 'long', day: 'numeric', month: 'short', year: 'numeric'
  })
}

function formatearFechaCorta(fecha) {
  if (!fecha || fecha === '...') return fecha
  const d = new Date(fecha + 'T12:00:00')
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
}

export default function DatePicker({
  modo = 'single',
  fecha,
  fechaDesde,
  fechaHasta,
  onChange,
  onChangeRango,
  maxFecha,
  placeholder,
}) {
  const wrapperRef = useRef(null)

  const [abierto, setAbierto] = useState(false)

  const [mesActual, setMesActual] = useState(() => {
    const ref = fecha || fechaDesde || new Date().toISOString().split('T')[0]
    return {
      mes: parseInt(ref.split('-')[1]) - 1,
      anio: parseInt(ref.split('-')[0])
    }
  })

  const [rangoTemp, setRangoTemp] = useState({
    desde: fechaDesde || null,
    hasta: fechaHasta || null,
    seleccionando: 'desde'
  })

  useEffect(() => {
    setRangoTemp({
      desde: fechaDesde || null,
      hasta: fechaHasta || null,
      seleccionando: 'desde'
    })
  }, [fechaDesde, fechaHasta])

  useEffect(() => {
    const handler = (e) => {
      if (!wrapperRef.current?.contains(e.target)) {
        setAbierto(false)
        setRangoTemp({
          desde: fechaDesde || null,
          hasta: fechaHasta || null,
          seleccionando: 'desde'
        })
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [fechaDesde, fechaHasta])

  const navegarMes = (dir) => {
    setMesActual(prev => {
      let m = prev.mes + dir
      let y = prev.anio
      if (m < 0) { m = 11; y-- }
      if (m > 11) { m = 0; y++ }
      return { mes: m, anio: y }
    })
  }

  const hoy = new Date().toISOString().split('T')[0]

  const generarDias = () => {
    const primerDia = new Date(mesActual.anio, mesActual.mes, 1)
    const ultimoDia = new Date(mesActual.anio, mesActual.mes + 1, 0)
    const primerDow = (primerDia.getDay() + 6) % 7 // Mon=0 .. Sun=6

    const dias = []

    for (let i = 0; i < primerDow; i++) {
      dias.push({ num: '', fecha: null, esOtroMes: true })
    }

    for (let d = 1; d <= ultimoDia.getDate(); d++) {
      const mes = String(mesActual.mes + 1).padStart(2, '0')
      const dia = String(d).padStart(2, '0')
      const fechaStr = `${mesActual.anio}-${mes}-${dia}`
      const jsDay = new Date(fechaStr + 'T12:00:00').getDay()
      dias.push({
        num: d,
        fecha: fechaStr,
        esOtroMes: false,
        esHoy: fechaStr === hoy,
        esSabado: jsDay === 6,
        esDomingo: jsDay === 0,
        esFuturo: maxFecha ? fechaStr > maxFecha : false,
      })
    }

    while (dias.length < 42) {
      dias.push({ num: '', fecha: null, esOtroMes: true })
    }

    return dias
  }

  const obtenerSemana = (sabStr) => {
    const sab = new Date(sabStr + 'T12:00:00')
    const lun = new Date(sab)
    lun.setDate(sab.getDate() + 2)
    return { sabStr, lunStr: lun.toISOString().split('T')[0] }
  }

  const clases = (dia) => {
    const cls = ['dp-dia']
    if (dia.esOtroMes) {
      cls.push('dp-dia-vacio')
      return cls.join(' ')
    }
    if (dia.esFuturo) {
      cls.push('dp-dia-futuro')
      return cls.join(' ')
    }
    if (dia.esHoy) cls.push('dp-dia-hoy')
    if ((dia.esSabado || dia.esDomingo) && !dia.esHoy) cls.push('dp-dia-fin-semana')

    if (modo === 'single') {
      if (fecha && dia.fecha === fecha) cls.push('dp-dia-seleccionado')
    } else if (modo === 'week') {
      if (fecha) {
        const { sabStr, lunStr } = obtenerSemana(fecha)
        if (dia.fecha === sabStr) {
          cls.push('dp-dia-semana-inicio')
        } else if (dia.fecha > sabStr && dia.fecha <= lunStr) {
          cls.push('dp-dia-semana')
        }
      }
    } else if (modo === 'range') {
      const desde = rangoTemp.desde
      const hasta = rangoTemp.hasta
      if (desde && dia.fecha === desde) cls.push('dp-dia-rango-inicio')
      else if (hasta && dia.fecha === hasta) cls.push('dp-dia-rango-fin')
      else if (desde && hasta && dia.fecha > desde && dia.fecha < hasta) cls.push('dp-dia-rango')
    }

    return cls.join(' ')
  }

  const seleccionarDia = (dia) => {
    if (!dia.fecha || dia.esFuturo || dia.esOtroMes) return

    if (modo === 'single') {
      onChange?.(dia.fecha)
      setAbierto(false)
    } else if (modo === 'week') {
      const d = new Date(dia.fecha + 'T12:00:00')
      const dow = d.getDay() // 0=Sun, 6=Sat
      const diffSab = dow === 6 ? 0 : dow === 0 ? -1 : -(dow + 1)
      const sab = new Date(d)
      sab.setDate(d.getDate() + diffSab)
      const sabStr = sab.toISOString().split('T')[0]
      onChange?.(sabStr)
      setAbierto(false)
    } else if (modo === 'range') {
      if (rangoTemp.seleccionando === 'desde') {
        setRangoTemp({ desde: dia.fecha, hasta: null, seleccionando: 'hasta' })
      } else {
        if (dia.fecha >= rangoTemp.desde) {
          onChangeRango?.(rangoTemp.desde, dia.fecha)
          setAbierto(false)
        } else {
          setRangoTemp({ desde: dia.fecha, hasta: null, seleccionando: 'hasta' })
        }
      }
    }
  }

  const renderLabel = () => {
    if (modo === 'single' && fecha) return formatearFecha(fecha)
    if (modo === 'week' && fecha) return `Sem. ${formatearFechaCorta(fecha)}`
    if (modo === 'range' && fechaDesde) {
      return `${formatearFechaCorta(fechaDesde)} – ${formatearFechaCorta(fechaHasta || '...')}`
    }
    return placeholder || 'Seleccionar fecha'
  }

  const dias = generarDias()

  return (
    <div className="dp-wrapper" ref={wrapperRef}>
      <button
        type="button"
        className="dp-trigger"
        onClick={() => setAbierto(v => !v)}
      >
        <span className="dp-icon">📅</span>
        <span className="dp-label">{renderLabel()}</span>
        <span className="dp-chevron">▾</span>
      </button>

      {abierto && (
        <div className="dp-popup">
          <div className="dp-header">
            <button type="button" className="dp-nav" onClick={() => navegarMes(-1)}>‹</button>
            <span className="dp-mes-anio">{MESES[mesActual.mes]} {mesActual.anio}</span>
            <button type="button" className="dp-nav" onClick={() => navegarMes(1)}>›</button>
          </div>

          <div className="dp-dias-header">
            {DIAS_HEADER.map(d => <div key={d} className="dp-dia-h">{d}</div>)}
          </div>

          <div className="dp-dias-grid">
            {dias.map((dia, i) => (
              <div
                key={i}
                className={clases(dia)}
                onClick={() => seleccionarDia(dia)}
              >
                {dia.num}
              </div>
            ))}
          </div>

          {modo === 'range' && (
            <div className="dp-footer-rango">
              <span>
                {rangoTemp.desde
                  ? `${formatearFechaCorta(rangoTemp.desde)} – ${rangoTemp.hasta ? formatearFechaCorta(rangoTemp.hasta) : '...'}`
                  : 'Selecciona fecha de inicio'
                }
              </span>
              <button
                type="button"
                className="dp-limpiar"
                onClick={() => {
                  setRangoTemp({ desde: null, hasta: null, seleccionando: 'desde' })
                  onChangeRango?.(null, null)
                }}
              >
                Limpiar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
