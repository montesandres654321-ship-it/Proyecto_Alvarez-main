import { useState } from 'react'
import usePOSStore from '../store/usePOSStore'
import './ModalDomicilio.css'

export default function ModalDomicilio({ onCreado, onCancelar }) {
  const { agregarDomicilio } = usePOSStore()
  const [nombre, setNombre]     = useState('')
  const [telefono, setTelefono] = useState('')

  const crear = () => {
    if (!nombre.trim()) return
    agregarDomicilio(nombre.trim(), telefono.trim())
    onCreado()
  }

  return (
    <div className="modal-overlay" onClick={onCancelar}>
      <div className="modal-dom-box" onClick={(e) => e.stopPropagation()}>
        <div className="dom-header">
          <span className="dom-icon">🛵</span>
          <span className="dom-title">Nuevo domicilio</span>
        </div>
        <div className="dom-body">
          <input
            className="dom-input"
            placeholder="Nombre del cliente *"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            autoFocus
          />
          <input
            className="dom-input"
            type="tel"
            placeholder="Teléfono (opcional)"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && crear()}
          />
        </div>
        <div className="dom-footer">
          <button className="dom-btn-crear" onClick={crear} disabled={!nombre.trim()}>
            Crear pedido →
          </button>
        </div>
      </div>
    </div>
  )
}
