import { useEffect, useRef, useState } from 'react'
import { formatCOP } from '../api/client'
import './ModalCobro.css'

const METODOS = [
  { id: 'Efectivo',      icono: '💵', label: 'Efectivo' },
  { id: 'Nequi',         icono: '📱', label: 'Nequi' },
  { id: 'Transferencia', icono: '🏦', label: 'Transferencia' },
  { id: 'Otros',         icono: '···', label: 'Otros' },
  { id: 'Crédito',       icono: '💳', label: 'Crédito' },
]

export default function ModalCobro({ mesa, slot, nequiNumero, turno, onConfirmar, onCancelar }) {
  const total = mesa?.total ?? 0
  const esDomicilio = slot?.tipo === 'domicilio' || slot != null

  const [metodo, setMetodo]               = useState('Efectivo')
  const [tipoEntrega, setTipoEntrega]     = useState(esDomicilio ? 'Domicilio' : 'Mesa')
  const [montoRecibido, setMontoRecibido] = useState(0)
  const [referencia, setReferencia]       = useState('')
  const [otroMetodo, setOtroMetodo]       = useState('')
  const [nombreCliente, setNombreCliente] = useState(slot?.nombre || '')
  const [clientesSugeridos, setClientesSugeridos] = useState([])
  const [alertaDeuda, setAlertaDeuda]     = useState(null)
  const [cargando, setCargando]           = useState(false)
  const [error, setError]                 = useState('')
  const firstFocusRef = useRef(null)

  useEffect(() => {
    firstFocusRef.current?.focus()
    const onKey = (e) => { if (e.key === 'Escape') onCancelar() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const vuelto = montoRecibido - total
  const montoInsuficiente = metodo === 'Efectivo' && montoRecibido > 0 && vuelto < 0
  const creditoSinNombre = metodo === 'Crédito' && !nombreCliente.trim()

  const buscarSugerencias = async (valor) => {
    if (valor.length < 2) { setClientesSugeridos([]); return }
    try {
      const res = await fetch('/creditos/clientes')
      const data = await res.json()
      setClientesSugeridos(
        data.filter(c => c.toLowerCase().includes(valor.toLowerCase())).slice(0, 5)
      )
    } catch {}
  }

  const verificarDeuda = async (nombre) => {
    if (nombre.trim().length < 2) { setAlertaDeuda(null); return }
    try {
      const res = await fetch(`/creditos/cliente/${encodeURIComponent(nombre.trim())}`)
      const data = await res.json()
      if (data.length > 0) {
        const deudaTotal = data.reduce((s, c) => s + (c.total_deuda - c.total_pagado), 0)
        setAlertaDeuda(deudaTotal)
      } else {
        setAlertaDeuda(null)
      }
    } catch {}
  }

  const confirmar = async () => {
    setCargando(true)
    setError('')
    const metodoFinal = metodo === 'Otros' ? (otroMetodo.trim() || 'Otros') : metodo
    const montoFinal  = metodo === 'Efectivo' ? montoRecibido : 0
    const clienteFinal = metodo === 'Crédito' ? nombreCliente.trim() : (slot?.nombre ?? '')
    try {
      await onConfirmar(metodoFinal, tipoEntrega, montoFinal, clienteFinal, total)
    } catch (e) {
      setError(e?.response?.data?.detail ?? 'Error al procesar la venta')
      setCargando(false)
    }
  }

  const mesaLabel = esDomicilio
    ? `🛵 ${slot.nombre}`
    : `Mesa ${mesa?.mesa_id ?? '—'}`

  return (
    <div className="modal-overlay" onClick={onCancelar} role="dialog" aria-modal="true" aria-label="Cobrar pedido">
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">Cobrar pedido</div>
            <div className="modal-mesa">{mesaLabel}</div>
          </div>
          <button className="modal-close" onClick={onCancelar} aria-label="Cerrar modal">✕</button>
        </div>

        <div className="modal-body">
          {/* Total */}
          <div className="modal-total">
            <div className="modal-total-label">Total a cobrar</div>
            <div className="modal-total-amount">{formatCOP(total)}</div>
          </div>

          {/* Método de pago — grid 2×3 */}
          <div className="modal-section">
            <div className="modal-section-label">Método de pago</div>
            <div className="payment-grid" role="radiogroup" aria-label="Método de pago">
              {METODOS.map((m, i) => (
                <button
                  key={m.id}
                  ref={i === 0 ? firstFocusRef : undefined}
                  className={`payment-btn${metodo === m.id ? ' selected' : ''}`}
                  onClick={() => setMetodo(m.id)}
                  role="radio"
                  aria-checked={metodo === m.id}
                >
                  <span className="payment-icon" aria-hidden="true">{m.icono}</span>
                  {m.label}
                </button>
              ))}
            </div>

            {metodo === 'Nequi' && nequiNumero && (
              <div className="nequi-info">
                <span className="nequi-label">Número Nequi</span>
                <span className="nequi-number">{nequiNumero}</span>
              </div>
            )}
            {metodo === 'Transferencia' && (
              <input
                className="phone-input"
                type="text"
                placeholder="Número de referencia (opcional)"
                value={referencia}
                onChange={(e) => setReferencia(e.target.value)}
              />
            )}
            {metodo === 'Otros' && (
              <input
                className="phone-input"
                type="text"
                placeholder="Ej: Daviplata, bono, etc."
                value={otroMetodo}
                onChange={(e) => setOtroMetodo(e.target.value)}
              />
            )}

            {/* ── Crédito: nombre del cliente ── */}
            {metodo === 'Crédito' && (
              <div className="credito-cliente-section">
                <label className="credito-cliente-label">NOMBRE DEL CLIENTE</label>
                <input
                  type="text"
                  className="credito-input"
                  value={nombreCliente}
                  onChange={async (e) => {
                    setNombreCliente(e.target.value)
                    buscarSugerencias(e.target.value)
                  }}
                  onBlur={() => verificarDeuda(nombreCliente)}
                  placeholder="Nombre del cliente"
                />
                {clientesSugeridos.length > 0 && (
                  <div className="credito-sugerencias">
                    {clientesSugeridos.map(c => (
                      <button
                        key={c}
                        className="credito-sugerencia"
                        onMouseDown={() => {
                          setNombreCliente(c)
                          setClientesSugeridos([])
                          verificarDeuda(c)
                        }}
                      >{c}</button>
                    ))}
                  </div>
                )}
                {alertaDeuda && (
                  <div className="credito-alerta">
                    ⚠️ {nombreCliente} ya debe {formatCOP(alertaDeuda)}. ¿Continuar con nueva deuda?
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Pago recibido — solo Efectivo */}
          {metodo === 'Efectivo' && (
            <div className="recibido-section">
              <label className="recibido-label" htmlFor="monto-recibido">Pago recibido</label>
              <input
                id="monto-recibido"
                className="recibido-input"
                type="number"
                min="0"
                step="1000"
                placeholder="$ 0"
                value={montoRecibido || ''}
                onChange={(e) => setMontoRecibido(Number(e.target.value))}
                aria-describedby={montoInsuficiente ? 'error-vuelto' : undefined}
              />
              {montoRecibido > 0 && (
                <div className="vuelto-table">
                  <div className="vuelto-row">
                    <span className="vuelto-label">Total del pedido</span>
                    <span className="vuelto-neutral">{formatCOP(total)}</span>
                  </div>
                  <div className="vuelto-row">
                    <span className="vuelto-label">Pago recibido</span>
                    <span className="vuelto-neutral">{formatCOP(montoRecibido)}</span>
                  </div>
                  <div className="vuelto-divider" />
                  <div className="vuelto-row">
                    <span className="vuelto-label">Vuelto</span>
                    <span className={`vuelto-amount ${vuelto >= 0 ? 'ok' : 'short'}`}>
                      {vuelto >= 0 ? formatCOP(vuelto) : `Faltan ${formatCOP(-vuelto)}`}
                    </span>
                  </div>
                  {turno?.efectivo_inicial != null && (
                    <div className="vuelto-row vuelto-row-small">
                      <span className="vuelto-label">Efectivo en caja</span>
                      <span className="vuelto-caja">{formatCOP(turno.efectivo_inicial)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Tipo de entrega */}
          <div className="modal-section">
            <div className="modal-section-label">Tipo de entrega</div>
            <div className="payment-options">
              <button
                className={`payment-btn${tipoEntrega === 'Mesa' ? ' selected' : ''}`}
                onClick={() => setTipoEntrega('Mesa')}
              >
                <span className="payment-icon">🪑</span>
                Mesa
              </button>
              <button
                className={`payment-btn${tipoEntrega === 'Domicilio' ? ' selected' : ''}`}
                onClick={() => setTipoEntrega('Domicilio')}
              >
                <span className="payment-icon">🛵</span>
                Domicilio
              </button>
            </div>
            {esDomicilio && (
              <div className="domicilio-info">
                <span className="domicilio-nombre">{slot.nombre}</span>
                {slot.telefono && <span className="domicilio-tel">{slot.telefono}</span>}
              </div>
            )}
          </div>

          {error && <p className="modal-error" role="alert">{error}</p>}
        </div>

        <div className="modal-footer">
          <button className="btn-cancelar" onClick={onCancelar}>Cancelar</button>
          <button
            className="btn-confirmar"
            onClick={confirmar}
            disabled={cargando || montoInsuficiente || creditoSinNombre}
            title={creditoSinNombre ? 'Ingresa el nombre del cliente' : montoInsuficiente ? 'Monto insuficiente' : undefined}
          >
            {cargando ? <span className="spinner" /> : `Cobrar ${formatCOP(total)}`}
          </button>
        </div>
      </div>
    </div>
  )
}
