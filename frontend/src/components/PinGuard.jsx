import { useState } from 'react'
import api, { setPinHeader } from '../api/client'
import './PinGuard.css'

const KEYS = ['1','2','3','4','5','6','7','8','9','','0','⌫']

export default function PinGuard({ children }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [ok, setOk] = useState(false)
  const [loading, setLoading] = useState(false)

  const verificar = async (pinValue) => {
    setLoading(true)
    try {
      const res = await api.get('/configuracion/pin_admin', {
        headers: { 'X-PIN': pinValue },
      })
      if (res.data.valor !== undefined) {
        setPinHeader(pinValue)
        setOk(true)
      }
    } catch (e) {
      const status = e?.response?.status
      setError(status === 401 || status === 403 ? 'PIN incorrecto' : 'Error al verificar PIN')
      setPin('')
    } finally {
      setLoading(false)
    }
  }

  const handleKey = (key) => {
    if (loading || key === '') return
    if (key === '⌫') {
      setPin((p) => p.slice(0, -1))
      setError('')
      return
    }
    if (pin.length >= 4) return
    const newPin = pin + key
    setPin(newPin)
    setError('')
    if (newPin.length === 4) verificar(newPin)
  }

  if (ok) return children

  return (
    <div className="pin-overlay">
      <div className="pin-box">
        <div className="pin-title">🔒 Acceso restringido</div>
        <div className="pin-subtitle">Ingrese el PIN de administrador</div>

        <div className="pin-dots">
          {[0,1,2,3].map((i) => (
            <div key={i} className={`pin-dot${i < pin.length ? ' filled' : ''}`} />
          ))}
        </div>

        {error && <div className="pin-error">{error}</div>}

        <div className="pin-keypad">
          {KEYS.map((key, i) => (
            <button
              key={i}
              className={`pin-key${key === '' ? ' empty' : ''}${key === '⌫' ? ' delete' : ''}`}
              onClick={() => handleKey(key)}
              disabled={loading || key === ''}
            >
              {loading && key === '⌫' ? '…' : key}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
