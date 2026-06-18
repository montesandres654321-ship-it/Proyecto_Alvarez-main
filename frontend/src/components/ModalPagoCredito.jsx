import { useState } from 'react'
import { formatCOP } from '../api/client'
import { formatMiles, parseMiles } from '../utils/formatMiles'

const METODOS = ['Efectivo', 'Nequi', 'Transferencia']

export default function ModalPagoCredito({ credito, onPago, onCerrar }) {
  const saldo = credito.saldo ?? (credito.total_deuda - credito.total_pagado)
  const [montoDisplay, setMontoDisplay] = useState('')
  const [metodo, setMetodo]             = useState('Efectivo')
  const [cargando, setCargando]         = useState(false)
  const [error, setError]               = useState('')

  const monto = parseMiles(montoDisplay)
  const restante = saldo - monto
  const pagoCompleto = restante <= 0

  const confirmar = async () => {
    if (monto <= 0) { setError('Ingresa un monto válido'); return }
    setCargando(true)
    setError('')
    try {
      const res = await fetch(`/creditos/${credito.id}/pagar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monto, metodo_pago: metodo }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail || 'Error al registrar pago')
      }
      onPago()
    } catch (e) {
      setError(e.message)
      setCargando(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onCerrar} role="dialog">
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 380 }}>
        <div className="modal-header">
          <div>
            <div className="modal-title">Registrar pago</div>
            <div className="modal-mesa">{credito.nombre_cliente}</div>
          </div>
          <button className="modal-close" onClick={onCerrar}>✕</button>
        </div>

        <div className="modal-body">
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
              Deuda actual
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#f87171', fontVariantNumeric: 'tabular-nums' }}>
              {formatCOP(saldo)}
            </div>
          </div>

          <div className="modal-section">
            <div className="modal-section-label">Monto a pagar</div>
            <input
              type="text"
              inputMode="numeric"
              className="recibido-input"
              value={montoDisplay}
              onChange={e => {
                const raw = e.target.value.replace(/\./g, '').replace(/\D/g, '')
                setMontoDisplay(raw ? formatMiles(raw) : '')
              }}
              placeholder="$ 0"
              autoFocus
            />
          </div>

          <div className="modal-section">
            <div className="modal-section-label">Método de pago</div>
            <div className="payment-options">
              {METODOS.map(m => (
                <button
                  key={m}
                  className={`payment-btn${metodo === m ? ' selected' : ''}`}
                  onClick={() => setMetodo(m)}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {monto > 0 && (
            <div className="vuelto-table" style={{ marginTop: 12 }}>
              <div className="vuelto-row">
                <span className="vuelto-label">Paga</span>
                <span className="vuelto-neutral">{formatCOP(monto)}</span>
              </div>
              <div className="vuelto-row">
                <span className="vuelto-label">Queda</span>
                <span className={`vuelto-amount ${pagoCompleto ? 'ok' : 'short'}`}>
                  {pagoCompleto ? formatCOP(0) : formatCOP(restante)}
                </span>
              </div>
              <div className="vuelto-divider" />
              <div style={{ textAlign: 'center', paddingTop: 8 }}>
                {pagoCompleto
                  ? <span style={{ background: '#0a1a0a', color: '#4ade80', border: '1px solid #22c55e', borderRadius: 99, padding: '4px 12px', fontSize: 12, fontWeight: 700 }}>PAGO COMPLETO</span>
                  : <span style={{ background: '#1a1200', color: '#fbbf24', border: '1px solid var(--gold)', borderRadius: 99, padding: '4px 12px', fontSize: 12, fontWeight: 700 }}>PAGO PARCIAL</span>
                }
              </div>
            </div>
          )}

          {error && <p className="modal-error">{error}</p>}
        </div>

        <div className="modal-footer">
          <button className="btn-cancelar" onClick={onCerrar}>Cancelar</button>
          <button
            className="btn-confirmar"
            onClick={confirmar}
            disabled={monto <= 0 || cargando}
          >
            {cargando ? <span className="spinner" /> : 'Confirmar pago'}
          </button>
        </div>
      </div>
    </div>
  )
}
