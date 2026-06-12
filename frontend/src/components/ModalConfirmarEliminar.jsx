import { useState } from 'react'
import { formatCOP } from '../api/client'
import './ModalConfirmarEliminar.css'

export default function ModalConfirmarEliminar({ tipo, registro, onConfirmar, onCerrar }) {
  const [pin, setPin]         = useState('')
  const [error, setError]     = useState('')
  const [cargando, setCargando] = useState(false)

  const isPermanente = tipo === 'turno-permanente'

  const titulos = {
    'turno-permanente': '🗑 Eliminar turno permanentemente',
    'turno-anular':     '⚠ Anular turno',
    'venta-anular':     '⚠ Anular venta',
  }

  const handleConfirmar = async () => {
    if (pin.length < 4) return
    setCargando(true)
    setError('')
    try {
      let url, method = 'DELETE', body
      if (tipo === 'turno-permanente') {
        url = `/turnos/${registro.id}`
      } else if (tipo === 'turno-anular') {
        url = `/turnos/${registro.id}/anular`
        method = 'PATCH'
        body = '{}'
      } else {
        url = `/reportes/ventas/${registro.id_factura}`
      }

      const resp = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'X-PIN': pin },
        ...(body ? { body } : {}),
      })

      if (resp.status === 401 || resp.status === 403) {
        setError('PIN incorrecto')
        return
      }
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}))
        setError(data.detail ?? 'Error al procesar')
        return
      }
      onConfirmar()
    } catch {
      setError('Error de conexión')
    } finally {
      setCargando(false)
    }
  }

  const esTurno = tipo === 'turno-permanente' || tipo === 'turno-anular'

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal-del-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-del-header">
          <div className="modal-del-titulo">{titulos[tipo]}</div>
        </div>

        <div className="modal-del-body">
          <div className="modal-del-detalle">
            {esTurno ? (
              <>
                <div className="del-row">
                  <span className="del-label">Cajero</span>
                  <span className="del-val">{registro.cajero}</span>
                </div>
                <div className="del-row">
                  <span className="del-label">Apertura</span>
                  <span className="del-val">{registro.hora_apertura}</span>
                </div>
                <div className="del-row">
                  <span className="del-label">Base</span>
                  <span className="del-val">{formatCOP(registro.efectivo_inicial)}</span>
                </div>
                <div className="del-row">
                  <span className="del-label">Ventas</span>
                  <span className="del-val">{registro.num_facturas} facturas</span>
                </div>
              </>
            ) : (
              <>
                <div className="del-row">
                  <span className="del-label">Factura</span>
                  <span className="del-val del-mono">{registro.id_factura}</span>
                </div>
                <div className="del-row">
                  <span className="del-label">Hora</span>
                  <span className="del-val">{registro.hora}</span>
                </div>
                <div className="del-row">
                  <span className="del-label">Total</span>
                  <span className="del-val">{formatCOP(registro.total)}</span>
                </div>
                <div className="del-row">
                  <span className="del-label">Método</span>
                  <span className="del-val">{registro.metodo_pago}</span>
                </div>
              </>
            )}
          </div>

          <div className={`modal-del-warn ${isPermanente ? 'danger' : 'amber'}`}>
            {isPermanente
              ? 'Esta acción NO se puede deshacer. El turno será eliminado permanentemente.'
              : 'El registro quedará marcado como anulado y seguirá visible en el historial.'}
          </div>

          <div className="modal-del-pin-section">
            <div className="modal-del-pin-label">PIN de administrador</div>
            <input
              className={`modal-del-pin-input${error ? ' input-error' : ''}`}
              type="password"
              inputMode="numeric"
              maxLength={4}
              placeholder="••••"
              value={pin}
              autoFocus
              onChange={(e) => { setPin(e.target.value.replace(/\D/g, '')); setError('') }}
              onKeyDown={(e) => e.key === 'Enter' && pin.length === 4 && handleConfirmar()}
            />
            {error && <div className="modal-del-pin-error">{error}</div>}
          </div>
        </div>

        <div className="modal-del-footer">
          <button className="btn-prep-cancelar" onClick={onCerrar}>Cancelar</button>
          <button
            className={`btn-del-confirmar ${isPermanente ? 'danger' : 'amber'}`}
            onClick={handleConfirmar}
            disabled={pin.length < 4 || cargando}
          >
            {cargando ? 'Procesando...' : isPermanente ? 'Eliminar' : 'Anular'}
          </button>
        </div>
      </div>
    </div>
  )
}
