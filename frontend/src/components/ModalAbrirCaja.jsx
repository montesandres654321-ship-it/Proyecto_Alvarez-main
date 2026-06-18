import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'
import usePOSStore from '../store/usePOSStore'
import './ModalAbrirCaja.css'

export default function ModalAbrirCaja({ onAbierta }) {
  const navigate = useNavigate()
  const { rol } = usePOSStore()
  const esCajero = rol === 'cajero'

  const [cajero, setCajero]     = useState('')
  const [efectivo, setEfectivo] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError]       = useState('')
  const cajeroRef = useRef(null)

  const abrir = async () => {
    if (!cajero.trim()) {
      setError('Ingresa tu nombre para abrir la caja')
      cajeroRef.current?.focus()
      return
    }
    const monto = parseInt(efectivo || '0', 10) || 0
    if (monto < 0) {
      setError('El monto no puede ser negativo')
      return
    }

    setCargando(true)
    setError('')
    try {
      const res = await api.post('/turnos/abrir', {
        cajero: cajero.trim(),
        efectivo_inicial: monto,
      })
      onAbierta(res.data)
    } catch (e) {
      setError(e?.response?.data?.detail ?? 'Error al abrir la caja')
      setCargando(false)
    }
  }

  return (
    <div className="modal-overlay modal-overlay-blocked">
      <div className="modal-caja-box">
        <div className="caja-header">
          <div className="caja-icon">💰</div>
          <div className="caja-title">Abrir caja</div>
          <div className="caja-subtitle">Ingresa tus datos para comenzar el turno</div>
        </div>

        <div className="caja-body">
          <div className="caja-field">
            <label className="caja-label">NOMBRE DEL CAJERO</label>
            <input
              ref={cajeroRef}
              className="caja-text-input"
              type="text"
              placeholder="Tu nombre"
              value={cajero}
              autoFocus
              onChange={(e) => { setCajero(e.target.value); setError('') }}
              onKeyDown={(e) => e.key === 'Enter' && abrir()}
            />
          </div>

          <div className="caja-field">
            <label className="caja-label">EFECTIVO EN CAJA</label>
            <input
              className="caja-amount-input"
              type="number"
              min="0"
              step="1000"
              placeholder="$ 0"
              value={efectivo}
              onChange={(e) => setEfectivo(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && abrir()}
            />
            <div className="caja-note">Este monto se usara para calcular vueltos</div>
          </div>

          {error && <p className="caja-error">{error}</p>}
        </div>

        <div className="caja-footer">
          <button
            className="btn-abrir-caja-modal"
            onClick={abrir}
            disabled={cargando}
          >
            {cargando ? <span className="spinner" /> : 'Abrir caja y empezar →'}
          </button>
        </div>

        {!esCajero && (
          <div className="modal-caja-alternativas">
            <button className="btn-ir-insumos" onClick={() => navigate('/insumos')}>
              🛒 Registrar compra de insumos
            </button>
            <button className="btn-ir-nomina" onClick={() => navigate('/nomina')}>
              👥 Registrar nómina
            </button>
            <button className="btn-ir-reportes" onClick={() => navigate('/reportes')}>
              📊 Solo ver reportes
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
