import { useState } from 'react'
import usePOSStore from '../store/usePOSStore'
import { formatCOP } from '../api/client'
import ModalDomicilio from './ModalDomicilio'
import './MesasBar.css'

export default function MesasBar() {
  const { numMesas, mesaActual, mesas, domicilios, setMesaActual } = usePOSStore()
  const [showDomModal, setShowDomModal] = useState(false)
  const MESAS = Array.from({ length: numMesas || 8 }, (_, i) => String(i + 1))

  return (
    <div className="mesas-bar">
      {MESAS.map((m) => {
        const mesa = mesas[m]
        const tieneItems = (mesa?.items?.length ?? 0) > 0
        const esActual = mesaActual === m
        let cls = 'mesa-pill'
        if (esActual) cls += ' activa'
        else if (tieneItems) cls += ' con-pedido'

        return (
          <button key={m} className={cls} onClick={() => setMesaActual(m)}>
            {tieneItems && !esActual
              ? `Mesa ${m} · ${formatCOP(mesa.total ?? 0)}`
              : `Mesa ${m}`}
          </button>
        )
      })}

      {domicilios.map((dom) => {
        const mesa = mesas[dom.id]
        const tieneItems = (mesa?.items?.length ?? 0) > 0
        const esActual = mesaActual === dom.id
        const nombre = dom.nombre.length > 8 ? dom.nombre.slice(0, 8) : dom.nombre
        const label = `🛵 ${nombre}`
        let cls = 'mesa-pill dom-pill'
        if (esActual) cls += ' dom-activa'

        return (
          <button key={dom.id} className={cls} onClick={() => setMesaActual(dom.id)}>
            {tieneItems && !esActual
              ? `${label} · ${formatCOP(mesa?.total ?? 0)}`
              : label}
          </button>
        )
      })}

      <button className="mesa-pill nueva-dom" onClick={() => setShowDomModal(true)}>
        + Domicilio
      </button>

      {showDomModal && (
        <ModalDomicilio
          onCreado={() => setShowDomModal(false)}
          onCancelar={() => setShowDomModal(false)}
        />
      )}
    </div>
  )
}
