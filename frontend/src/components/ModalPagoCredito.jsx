import { useState } from 'react'
import { formatCOP } from '../api/client'
import { formatMiles, parseMiles } from '../utils/formatMiles'
import '../pages/Creditos.css'

const METODOS = ['Efectivo', 'Nequi', 'Transferencia']

export default function ModalPagoCredito({ credito, onPago, onCerrar }) {
  const saldo = credito.saldo ?? (credito.total_deuda - credito.total_pagado)
  const [montoDisplay, setMontoDisplay] = useState(formatMiles(saldo))
  const [metodo, setMetodo]             = useState('Efectivo')
  const [procesando, setProcesando]     = useState(false)
  const [error, setError]               = useState('')

  const monto     = parseMiles(montoDisplay)
  const restante  = Math.max(0, saldo - monto)
  const esPagoTotal = monto >= saldo

  const confirmar = async () => {
    if (monto <= 0) { setError('Ingresa un monto válido'); return }
    setProcesando(true)
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
      setProcesando(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onCerrar} role="dialog">
      <div className="modal-pago-credito" onClick={e => e.stopPropagation()}>
        <div className="modal-pago-header">
          <div>
            <div className="modal-pago-titulo">Registrar pago</div>
            <div className="modal-pago-cliente">{credito.nombre_cliente}</div>
          </div>
          <button className="modal-close" onClick={onCerrar}>✕</button>
        </div>

        <div className="modal-pago-body">
          <div className="modal-pago-deuda">
            Deuda actual: <span>{formatCOP(saldo)}</span>
          </div>

          <div>
            <div className="modal-monto-label">MONTO QUE TRAE EL CLIENTE</div>
            <div className="modal-monto-row">
              <input
                type="text"
                inputMode="numeric"
                className="modal-monto-input"
                value={montoDisplay}
                autoFocus
                onChange={e => {
                  const raw = e.target.value.replace(/\./g, '').replace(/\D/g, '')
                  setMontoDisplay(raw ? formatMiles(raw) : '')
                }}
              />
              <button
                className="btn-pago-total"
                onClick={() => setMontoDisplay(formatMiles(saldo))}
              >
                Pago total
              </button>
            </div>
          </div>

          <div>
            <div className="modal-monto-label">MÉTODO DE PAGO</div>
            <div className="metodos-pago-row">
              {METODOS.map(m => (
                <button
                  key={m}
                  className={`metodo-pill${metodo === m ? ' activo' : ''}`}
                  onClick={() => setMetodo(m)}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {monto > 0 && (
            <div className={`preview-resultado ${esPagoTotal ? 'preview-completo' : 'preview-parcial'}`}>
              {esPagoTotal ? (
                <>✓ PAGO COMPLETO — El crédito quedará saldado</>
              ) : (
                <>PAGO PARCIAL — Queda pendiente: {formatCOP(restante)}</>
              )}
            </div>
          )}

          {error && <p className="modal-pago-error">{error}</p>}
        </div>

        <div className="modal-pago-footer">
          <button className="btn-modal-cancelar" onClick={onCerrar}>Cancelar</button>
          <button
            className="btn-modal-confirmar-pago"
            onClick={confirmar}
            disabled={monto <= 0 || procesando}
          >
            {procesando ? <span className="spinner" /> : `Confirmar ${formatCOP(monto)}`}
          </button>
        </div>
      </div>
    </div>
  )
}
