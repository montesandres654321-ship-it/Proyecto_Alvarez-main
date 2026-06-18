import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import usePOSStore from '../store/usePOSStore'
import { setPinHeader } from '../api/client'
import './Login.css'

export default function Login() {
  const [modo, setModo] = useState(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const { setRol } = usePOSStore()
  const navigate = useNavigate()

  const handleLogin = async (pinActual) => {
    const pinUsado = pinActual ?? pin
    if (pinUsado.length < 4) return
    setCargando(true)
    setError('')
    try {
      const res = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinUsado }),
      })
      const data = await res.json()

      if (!data.ok) {
        setError('PIN incorrecto')
        setPin('')
        setCargando(false)
        return
      }

      if (modo === 'admin' && data.rol !== 'admin') {
        setError('PIN incorrecto para Administrador')
        setPin('')
        setCargando(false)
        return
      }
      if (modo === 'cajero' && data.rol === null) {
        setError('PIN incorrecto')
        setPin('')
        setCargando(false)
        return
      }

      if (data.rol === 'admin') setPinHeader(pinUsado)
      setRol(data.rol, pinUsado)
      navigate('/ventas')
    } catch {
      setError('Error de conexión')
      setCargando(false)
    }
  }

  const handleTecla = (n) => {
    if (n === '⌫') {
      setPin((p) => p.slice(0, -1))
      setError('')
      return
    }
    if (n === '' || pin.length >= 4) return
    const nuevo = pin + n
    setPin(nuevo)
    if (nuevo.length === 4) {
      setTimeout(() => handleLogin(nuevo), 100)
    }
  }

  return (
    <div className="login-page">
      <div className="login-box">
        <div className="login-logo">
          <img src="/pwa-192.png" alt="Alvarez Fast Food" className="login-logo-img" />
        </div>
        <div className="login-titulo">Alvarez Fast Food</div>
        <div className="login-subtitulo">Punto de Venta</div>

        {!modo ? (
          <div className="login-roles">
            <button className="btn-rol btn-rol-admin" onClick={() => setModo('admin')}>
              <span className="btn-rol-icon">🔐</span>
              <span className="btn-rol-texto">
                <span className="btn-rol-label">Administrador</span>
                <span className="btn-rol-sub">Acceso completo al sistema</span>
              </span>
            </button>
            <button className="btn-rol btn-rol-cajero" onClick={() => setModo('cajero')}>
              <span className="btn-rol-icon">💚</span>
              <span className="btn-rol-texto">
                <span className="btn-rol-label">Cajero</span>
                <span className="btn-rol-sub">Solo pantalla de ventas</span>
              </span>
            </button>
          </div>
        ) : (
          <div className="login-pin-section">
            <div className="login-pin-header">
              <button
                className="btn-volver"
                onClick={() => { setModo(null); setPin(''); setError('') }}
              >
                ← Volver
              </button>
              <div className="login-pin-titulo">
                {modo === 'admin' ? '🔐 Administrador' : '💚 Cajero'}
              </div>
            </div>

            <div className="pin-puntos">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className={`pin-punto ${pin.length > i ? 'activo' : ''}`} />
              ))}
            </div>

            {error && <div className="login-error">{error}</div>}

            <div className="pin-teclado">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, '⌫'].map((n, i) => (
                <button
                  key={i}
                  className={`pin-key ${n === '' ? 'pin-key-vacio' : ''}`}
                  onClick={() => handleTecla(n)}
                  disabled={cargando}
                >
                  {n}
                </button>
              ))}
            </div>

            <button
              className="btn-ingresar"
              onClick={() => handleLogin()}
              disabled={pin.length < 4 || cargando}
            >
              {cargando ? 'Verificando...' : 'Ingresar'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
