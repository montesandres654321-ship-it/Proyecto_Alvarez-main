import { useNavigate } from 'react-router-dom'
import { formatCOP } from '../api/client'
import './Carrito.css'

function CartRow({ linea, idx, onQuitar }) {
  return (
    <div className="cart-row">
      <div className="cart-qty-badge">{linea.cantidad}</div>
      <div className="cart-item-info">
        <div className="cart-item-name">{linea.producto_nombre}</div>
        {linea.notas_modificacion && (
          <div className="cart-item-note">{linea.notas_modificacion}</div>
        )}
      </div>
      <span className="cart-item-price">{formatCOP(linea.subtotal)}</span>
      <button className="cart-row-remove" onClick={() => onQuitar(idx)} title="Quitar">×</button>
    </div>
  )
}

export default function Carrito({ mesa, slot, onQuitar, onCobrar, cobrarDeshabilitado = false, open = false, onClose }) {
  const items = mesa?.items ?? []
  const total = mesa?.total ?? 0
  const navigate = useNavigate()

  return (
    <div className={`cart-panel${open ? ' open' : ''}`}>
      <div className="cart-header">
        <div className="cart-label">Pedido actual</div>
        {slot ? (
          <div>
            <div className="cart-mesa-name">🛵 {slot.nombre}</div>
            {slot.telefono && <div className="cart-dom-tel">{slot.telefono}</div>}
          </div>
        ) : (
          <div className="cart-mesa-name">Mesa {mesa?.mesa_id ?? '—'}</div>
        )}
      </div>

      <div className="cart-items">
        {items.length === 0 ? (
          <div className="cart-empty">
            <span className="cart-empty-icon">🛒</span>
            <span className="cart-empty-text">Toca un producto para agregarlo al pedido</span>
          </div>
        ) : (
          items.map((linea, idx) => (
            <CartRow key={idx} linea={linea} idx={idx} onQuitar={onQuitar} />
          ))
        )}
      </div>

      <div className="cart-footer">
        <div className="total-section">
          <span className="total-label">Total</span>
          <span className="total-amount">{formatCOP(total)}</span>
        </div>
        <div className="cart-actions">
          <button
            className="btn-quitar-ultimo"
            onClick={() => items.length > 0 && onQuitar(items.length - 1)}
            disabled={items.length === 0}
            title="Quitar último ítem"
          >
            ✕ Quitar
          </button>
          {cobrarDeshabilitado ? (
            <button
              className="btn-cobrar btn-cobrar-caja"
              onClick={() => navigate('/reportes')}
              disabled={false}
              title="Ir a abrir la caja"
            >
              🔓 Abre la caja
            </button>
          ) : (
            <button
              className="btn-cobrar"
              onClick={onCobrar}
              disabled={items.length === 0}
              title={items.length === 0 ? 'Agrega productos primero' : undefined}
            >
              💳 Cobrar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
