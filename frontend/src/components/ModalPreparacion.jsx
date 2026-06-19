import { useState } from 'react'
import { formatCOP } from '../api/client'
import { getProductEmoji } from '../utils/productEmojis'
import './ModalPreparacion.css'

export default function ModalPreparacion({ producto, opciones, onAgregar, onCerrar }) {
  const [seleccionadas, setSeleccionadas] = useState([])
  const [nota, setNota] = useState('')
  const [cantidad, setCantidad] = useState(1)

  const toggleOpcion = (op) => {
    setSeleccionadas((prev) =>
      prev.includes(op) ? prev.filter((o) => o !== op) : [...prev, op]
    )
  }

  const handleAgregar = () => {
    const notaFinal = [...seleccionadas, nota.trim()].filter(Boolean).join(' · ')
    onAgregar(producto, cantidad, notaFinal)
    onCerrar()
  }

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal-prep-box" onClick={(e) => e.stopPropagation()}>

        <div className="modal-prep-header">
          <div className="modal-prep-emoji">
            {getProductEmoji(producto.nombre, producto.categoria)}
          </div>
          <div>
            <div className="modal-prep-nombre">{producto.nombre}</div>
            <div className="modal-prep-precio">{formatCOP(producto.precio)}</div>
          </div>
        </div>

        <div className="modal-prep-scroll">
          {opciones.length > 0 && (
            <div className="modal-prep-section">
              <div className="modal-prep-label">¿CÓMO LO PREPARO?</div>
              <div className="modal-prep-opciones">
                {opciones.map((op) => (
                  <button
                    key={op}
                    className={`prep-opcion${seleccionadas.includes(op) ? ' activa' : ''}`}
                    onClick={() => toggleOpcion(op)}
                  >
                    {seleccionadas.includes(op) ? '✓ ' : ''}{op}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="modal-prep-section">
            <div className="modal-prep-label">NOTA ADICIONAL (opcional)</div>
            <textarea
              className="modal-prep-nota"
              placeholder="Ej: bien cocido, extra papas, sin cebolla..."
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              rows={2}
              maxLength={120}
            />
          </div>

          <div className="modal-prep-section modal-prep-cantidad-row">
            <div className="modal-prep-label">CANTIDAD</div>
            <div className="cantidad-control">
              <button onClick={() => setCantidad((c) => Math.max(1, c - 1))}>−</button>
              <span>{cantidad}</span>
              <button onClick={() => setCantidad((c) => Math.min(20, c + 1))}>+</button>
            </div>
          </div>
        </div>

        <div className="modal-prep-footer">
          <button className="btn-prep-cancelar" onClick={onCerrar}>
            Cancelar
          </button>
          <button className="btn-prep-agregar" onClick={handleAgregar}>
            Agregar{cantidad > 1 ? ` ×${cantidad}` : ''} →
          </button>
        </div>

      </div>
    </div>
  )
}
