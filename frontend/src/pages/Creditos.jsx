import { useEffect, useState } from 'react'
import api, { formatCOP } from '../api/client'
import ModalPagoCredito from '../components/ModalPagoCredito'
import './Creditos.css'

function formatFechaCorta(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
  return `${d.getDate()} ${meses[d.getMonth()]}`
}

export default function Creditos() {
  const [tab, setTab]                   = useState('pendientes')
  const [creditos, setCreditos]         = useState([])
  const [pagados, setPagados]           = useState([])
  const [cargando, setCargando]         = useState(true)
  const [modalPago, setModalPago]       = useState(null)
  const [totalPendiente, setTotalPendiente] = useState(0)

  const cargarPendientes = async () => {
    setCargando(true)
    try {
      const res = await api.get('/creditos')
      setCreditos(res.data)
      const total = res.data.reduce((s, c) => s + (c.total_deuda - c.total_pagado), 0)
      setTotalPendiente(total)
    } catch {}
    setCargando(false)
  }

  const cargarPagados = async () => {
    try {
      const res = await api.get('/creditos/historial')
      setPagados(res.data)
    } catch {}
  }

  useEffect(() => {
    cargarPendientes()
  }, [])

  useEffect(() => {
    if (tab === 'pagados') cargarPagados()
  }, [tab])

  return (
    <div className="creditos-page">
      <div className="creditos-header">
        <h2>💳 Créditos</h2>
        {totalPendiente > 0 && (
          <div className="creditos-total-badge">
            En deuda: {formatCOP(totalPendiente)}
          </div>
        )}
      </div>

      <div className="creditos-tabs">
        <button
          className={`credito-tab ${tab === 'pendientes' ? 'activo' : ''}`}
          onClick={() => setTab('pendientes')}
        >
          Pendientes
          {creditos.length > 0 && (
            <span className="tab-count">{creditos.length}</span>
          )}
        </button>
        <button
          className={`credito-tab ${tab === 'pagados' ? 'activo' : ''}`}
          onClick={() => setTab('pagados')}
        >
          Pagados
        </button>
      </div>

      {tab === 'pendientes' && (
        <div className="creditos-lista">
          {cargando ? (
            <div className="creditos-vacio">
              <div style={{ color: 'var(--text-muted)' }}>Cargando...</div>
            </div>
          ) : creditos.length === 0 ? (
            <div className="creditos-vacio">
              <div style={{ fontSize: '40px' }}>✅</div>
              <div>No hay créditos pendientes</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Todos los clientes están al día
              </div>
            </div>
          ) : (
            creditos.map(c => {
              const saldo = c.total_deuda - c.total_pagado
              return (
                <div key={c.id} className="credito-card-full">
                  <div className="credito-card-top">
                    <div>
                      <div className="credito-card-nombre">{c.nombre_cliente}</div>
                      <div className="credito-card-factura">
                        {c.id_factura && `${c.id_factura} · `}{formatFechaCorta(c.fecha_credito)}
                      </div>
                    </div>
                    <div className="credito-card-saldo">{formatCOP(saldo)}</div>
                  </div>

                  {c.total_pagado > 0 && (
                    <div className="credito-progreso">
                      <div className="credito-progreso-bar">
                        <div
                          className="credito-progreso-fill"
                          style={{ width: `${Math.min(100, Math.round(c.total_pagado / c.total_deuda * 100))}%` }}
                        />
                      </div>
                      <div className="credito-progreso-txt">
                        Pagado: {formatCOP(c.total_pagado)} de {formatCOP(c.total_deuda)}
                      </div>
                    </div>
                  )}

                  <button
                    className="btn-credito-pagar"
                    onClick={() => setModalPago(c)}
                  >
                    💵 Registrar pago
                  </button>
                </div>
              )
            })
          )}
        </div>
      )}

      {tab === 'pagados' && (
        <div className="creditos-lista">
          {pagados.length === 0 ? (
            <div className="creditos-vacio">
              <div style={{ fontSize: '40px' }}>📋</div>
              <div style={{ color: 'var(--text-muted)' }}>No hay créditos pagados aún</div>
            </div>
          ) : (
            pagados.map(c => (
              <div key={c.id} className="credito-card-full pagado">
                <div className="credito-card-top">
                  <div>
                    <div className="credito-card-nombre">{c.nombre_cliente}</div>
                    <div className="credito-card-factura">
                      {c.id_factura && `${c.id_factura} · `}{formatFechaCorta(c.fecha_credito)}
                    </div>
                  </div>
                  <div className="credito-pagado-badge">✓ Pagado</div>
                </div>
                <div style={{ textAlign: 'right', color: 'var(--text-muted)', fontSize: '13px' }}>
                  Total: {formatCOP(c.total_deuda)}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {modalPago && (
        <ModalPagoCredito
          credito={modalPago}
          onPago={() => {
            setModalPago(null)
            cargarPendientes()
            if (tab === 'pagados') cargarPagados()
          }}
          onCerrar={() => setModalPago(null)}
        />
      )}
    </div>
  )
}
