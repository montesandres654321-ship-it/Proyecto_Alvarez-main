import { useEffect, useState } from 'react'
import { formatCOP } from '../api/client'
import ModalPagoCredito from '../components/ModalPagoCredito'
import './Creditos.css'

function formatFechaCorta(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
  return `${d.getDate()} ${meses[d.getMonth()]}`
}

function toArray(data) {
  if (Array.isArray(data)) return data
  if (data && typeof data === 'object') {
    return data.creditos || data.data || data.items || data.results || []
  }
  return []
}

export default function Creditos() {
  const [tab, setTab]                   = useState('pendientes')
  const [creditos, setCreditos]         = useState([])
  const [pagados, setPagados]           = useState([])
  const [cargando, setCargando]         = useState(true)
  const [errorMsg, setErrorMsg]         = useState('')
  const [modalPago, setModalPago]       = useState(null)
  const [totalPendiente, setTotalPendiente] = useState(0)

  const cargarPendientes = async () => {
    setCargando(true)
    setErrorMsg('')
    try {
      const res = await fetch('/creditos')
      if (!res.ok) {
        const txt = await res.text()
        console.error('[Creditos] GET /creditos error', res.status, txt)
        setErrorMsg(`Error del servidor (${res.status})`)
        setCreditos([])
        setCargando(false)
        return
      }
      const contentType = res.headers.get('content-type') || ''
      if (!contentType.includes('application/json')) {
        const txt = await res.text()
        console.error('[Creditos] Respuesta no es JSON:', txt.slice(0, 200))
        setErrorMsg('El servidor devolvió HTML en lugar de datos. Verifica el deploy.')
        setCreditos([])
        setCargando(false)
        return
      }
      const data = await res.json()
      console.log('[Creditos] datos recibidos:', data)
      const lista = toArray(data)
      setCreditos(lista)
      const total = lista.reduce((s, c) => s + ((c.saldo ?? (c.total_deuda - c.total_pagado)) || 0), 0)
      setTotalPendiente(total)
    } catch (e) {
      console.error('[Creditos] fetch error:', e)
      setErrorMsg('No se pudo conectar al servidor')
      setCreditos([])
    }
    setCargando(false)
  }

  const cargarPagados = async () => {
    try {
      const res = await fetch('/creditos/historial')
      if (!res.ok) return
      const contentType = res.headers.get('content-type') || ''
      if (!contentType.includes('application/json')) return
      const data = await res.json()
      setPagados(toArray(data))
    } catch (e) {
      console.error('[Creditos] historial error:', e)
      setPagados([])
    }
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
          ) : errorMsg ? (
            <div className="creditos-vacio">
              <div style={{ fontSize: '32px' }}>⚠️</div>
              <div style={{ color: '#f87171', fontSize: '14px', textAlign: 'center' }}>{errorMsg}</div>
              <button
                onClick={cargarPendientes}
                style={{ marginTop: 8, padding: '8px 16px', background: 'var(--red)', border: 'none', borderRadius: 8, color: 'white', cursor: 'pointer', fontSize: 13 }}
              >
                Reintentar
              </button>
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
              const saldo = c.saldo ?? (c.total_deuda - c.total_pagado)
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
