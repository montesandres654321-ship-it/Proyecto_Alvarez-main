import { useState } from 'react'
import { formatCOP } from '../api/client'
import './ModalPrecioEspecial.css'

export default function ModalPrecioEspecial({ categoriaActiva, opciones, onAgregar, onCerrar }) {
  const [descripcion, setDescripcion] = useState('')
  const [precio, setPrecio] = useState('')
  const [seleccionadas, setSeleccionadas] = useState([])
  const [nota, setNota] = useState('')
  const [cantidad, setCantidad] = useState(1)

  const precioNum = parseInt(precio) || 0
  const disabled = !descripcion.trim() || precioNum <= 0

  const toggleOpcion = (op) => {
    setSeleccionadas((prev) =>
      prev.includes(op) ? prev.filter((o) => o !== op) : [...prev, op]
    )
  }

  const handleAgregar = () => {
    if (disabled) return
    const notaFinal = [...seleccionadas, nota.trim()].filter(Boolean).join(' · ')
    const productoCustom = {
      id: `custom-${Date.now()}`,
      nombre: descripcion.trim(),
      precio: precioNum,
      categoria: categoriaActiva,
    }
    onAgregar(productoCustom, cantidad, notaFinal)
    onCerrar()
  }

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal-prep-box modal-pe-box" onClick={(e) => e.stopPropagation()}>

        <div className="modal-prep-header">
          <div className="modal-prep-emoji modal-pe-emoji">✏️</div>
          <div>
            <div className="modal-prep-nombre">Precio especial</div>
            <div className="modal-pe-cat">{categoriaActiva}</div>
          </div>
        </div>

        <div className="modal-prep-section">
          <div className="modal-prep-label">¿QUÉ ES?</div>
          <input
            className="modal-pe-input"
            type="text"
            placeholder="Ej: Picada grande, mitad cerdo mitad pollo..."
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            autoFocus
            maxLength={100}
          />
        </div>

        <div className="modal-prep-section">
          <div className="modal-prep-label">VALOR</div>
          <input
            className="modal-pe-precio"
            type="number"
            min={500}
            step={500}
            placeholder="$ 0"
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
          />
        </div>

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

        <div className="modal-prep-footer">
          <button className="btn-prep-cancelar" onClick={onCerrar}>
            Cancelar
          </button>
          <button
            className="btn-pe-agregar"
            onClick={handleAgregar}
            disabled={disabled}
          >
            {disabled
              ? 'Agregar →'
              : `Agregar ${formatCOP(precioNum)}${cantidad > 1 ? ` ×${cantidad}` : ''} →`}
          </button>
        </div>

      </div>
    </div>
  )
}
