import { useEffect, useState } from 'react'
import usePOSStore from '../store/usePOSStore'
import MesasBar from '../components/MesasBar'
import GridProductos from '../components/GridProductos'
import Carrito from '../components/Carrito'
import ModalCobro from '../components/ModalCobro'
import ModalAbrirCaja from '../components/ModalAbrirCaja'
import ModalPreparacion from '../components/ModalPreparacion'
import ModalPrecioEspecial from '../components/ModalPrecioEspecial'
import ModalPagoCredito from '../components/ModalPagoCredito'
import { OPCIONES_DEFAULT } from '../utils/opcionesDefault'
import { formatCOP } from '../api/client'
import api from '../api/client'
import './Venta.css'

export default function Venta() {
  const {
    mesaActual, mesas, domicilios, productos, categorias, categoriaActiva,
    setCategoriaActiva, cargarProductos, cargarMesa,
    agregarItem, agregarItemCustom, quitarItem, cobrar, nequiNumero, eliminarDomicilio,
  } = usePOSStore()

  const [modalCobro, setModalCobro]         = useState(false)
  const [ventaConfirmada, setVentaConfirmada] = useState(null)
  const [cargando, setCargando]             = useState(true)
  const [turnoActivo, setTurnoActivo]       = useState(null)
  const [turnoVerificado, setTurnoVerificado] = useState(false)
  const [cartOpen, setCartOpen]             = useState(false)
  const [modalPrep, setModalPrep]           = useState(null)
  const [modalPrecioEsp, setModalPrecioEsp] = useState(false)
  const [prepConfig, setPrepConfig]         = useState({})
  const [creditos, setCreditos]             = useState([])
  const [modalPago, setModalPago]           = useState(null)

  const verificarTurno = async () => {
    try {
      const res = await api.get('/turnos/activo')
      setTurnoActivo(res.data)
    } catch {
      setTurnoActivo(null)
    } finally {
      setTurnoVerificado(true)
    }
  }

  const cargarCreditos = async () => {
    try {
      const res = await fetch('/creditos')
      const data = await res.json()
      setCreditos(Array.isArray(data) ? data : [])
    } catch {}
  }

  useEffect(() => {
    const init = async () => {
      await Promise.all([cargarProductos(), cargarMesa(mesaActual), verificarTurno()])
      setCargando(false)
    }
    init()
    cargarCreditos()
    api.get('/preparaciones/todas')
      .then((res) => setPrepConfig(res.data))
      .catch(() => {})
  }, [])

  useEffect(() => {
    cargarMesa(mesaActual)
  }, [mesaActual])

  const mesa = mesas[mesaActual]
  const slot = domicilios.find((d) => d.id === mesaActual) ?? null

  const productosFiltrados = categoriaActiva
    ? productos.filter((p) => p.categoria === categoriaActiva)
    : productos

  // Opciones efectivas: BD si disponibles, sino defaults
  const opcionesPara = (cat) =>
    prepConfig[cat] ?? OPCIONES_DEFAULT[cat] ?? []

  const handleOpenModal = (producto) => {
    setModalPrep({
      producto,
      opciones: opcionesPara(producto.categoria),
    })
  }

  const handleConfirmarPrep = async (producto, cantidad, nota) => {
    try {
      await agregarItem(mesaActual, producto.id, cantidad, nota)
    } catch (e) {
      alert(e?.response?.data?.detail ?? 'Error al agregar')
    }
  }

  const handleConfirmarPrecioEsp = async (productoCustom, cantidad, nota) => {
    try {
      await agregarItemCustom(
        mesaActual,
        productoCustom.nombre,
        productoCustom.precio,
        productoCustom.categoria,
        cantidad,
        nota,
      )
    } catch (e) {
      alert(e?.response?.data?.detail ?? 'Error al agregar precio especial')
    }
  }

  const handleQuitar = async (idx) => {
    await quitarItem(mesaActual, idx)
  }

  const handleCobrar = async (metodo, tipo, montoRecibido = 0, clienteFinal = '', totalVenta = 0) => {
    const telefono      = slot?.telefono ?? ''
    const nombreCliente = clienteFinal || (slot?.nombre ?? '')
    const factura = await cobrar(mesaActual, metodo, tipo, telefono, montoRecibido, nombreCliente)
    if (metodo === 'Crédito' && factura?.id_factura) {
      try {
        await fetch('/creditos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id_factura: factura.id_factura,
            nombre_cliente: nombreCliente,
            total_deuda: totalVenta || factura.total_pagar,
            cajero: turnoActivo?.cajero || '',
          }),
        })
        cargarCreditos()
      } catch {}
    }
    if (slot) eliminarDomicilio(mesaActual)
    setModalCobro(false)
    setVentaConfirmada(factura)
    verificarTurno()
  }

  if (ventaConfirmada) {
    return (
      <div className="venta-ticket">
        <h2>✅ Venta registrada</h2>
        <p className="ticket-id">{ventaConfirmada.id_factura}</p>
        <p>
          Total:{' '}
          <strong>
            {new Intl.NumberFormat('es-CO', {
              style: 'currency',
              currency: 'COP',
              minimumFractionDigits: 0,
            }).format(ventaConfirmada.total_pagar)}
          </strong>
        </p>
        <p>Método: {ventaConfirmada.metodo_pago} · {ventaConfirmada.tipo_entrega}</p>
        <button className="btn-nueva-venta" onClick={() => setVentaConfirmada(null)}>
          Nueva venta
        </button>
      </div>
    )
  }

  return (
    <div className="venta-view">
      <MesasBar />

      <div className="content-area">
        <div className="product-panel">
          <div className="category-tabs">
            {categorias.map((cat) => (
              <button
                key={cat}
                className={`cat-tab ${categoriaActiva === cat ? 'active' : 'inactive'}`}
                onClick={() => setCategoriaActiva(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
          {cargando ? (
            <div className="product-loading">Cargando menú…</div>
          ) : (
            <GridProductos
              productos={productosFiltrados}
              onAgregar={handleOpenModal}
              categoriaActiva={categoriaActiva}
              onPrecioEspecial={() => setModalPrecioEsp(true)}
            />
          )}
        </div>

        <div className="right-panel">
          <Carrito
            mesa={mesa}
            slot={slot}
            onQuitar={handleQuitar}
            onCobrar={() => setModalCobro(true)}
            cobrarDeshabilitado={!turnoActivo}
            open={cartOpen}
            onClose={() => setCartOpen(false)}
          />
          {creditos.length > 0 && (
            <div className="creditos-panel">
              <div className="creditos-titulo">💳 Créditos pendientes ({creditos.length})</div>
              {creditos.map(c => (
                <div key={c.id} className="credito-card">
                  <div className="credito-card-header">
                    <span className="credito-nombre">{c.nombre_cliente}</span>
                    <span className="credito-deuda">{formatCOP(c.saldo ?? (c.total_deuda - c.total_pagado))}</span>
                  </div>
                  <div className="credito-card-footer">
                    <span className="credito-fecha">{String(c.fecha_credito).slice(0, 10)}</span>
                    <button className="btn-registrar-pago" onClick={() => setModalPago(c)}>
                      Registrar pago
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* FAB móvil */}
      <button
        className="cart-fab"
        onClick={() => setCartOpen((v) => !v)}
        aria-label="Ver carrito"
      >
        🛒
        {(mesa?.items?.length ?? 0) > 0 && (
          <span className="cart-fab-badge">{mesa.items.length}</span>
        )}
      </button>
      {cartOpen && (
        <div className="cart-backdrop" onClick={() => setCartOpen(false)} />
      )}

      {turnoVerificado && !turnoActivo && (
        <ModalAbrirCaja onAbierta={(turno) => setTurnoActivo(turno)} />
      )}

      {modalCobro && (
        <ModalCobro
          mesa={mesa}
          slot={slot}
          nequiNumero={nequiNumero}
          turno={turnoActivo}
          onConfirmar={handleCobrar}
          onCancelar={() => setModalCobro(false)}
        />
      )}

      {modalPrep && (
        <ModalPreparacion
          producto={modalPrep.producto}
          opciones={modalPrep.opciones}
          onAgregar={handleConfirmarPrep}
          onCerrar={() => setModalPrep(null)}
        />
      )}

      {modalPrecioEsp && (
        <ModalPrecioEspecial
          categoriaActiva={categoriaActiva}
          opciones={opcionesPara(categoriaActiva)}
          onAgregar={handleConfirmarPrecioEsp}
          onCerrar={() => setModalPrecioEsp(false)}
        />
      )}

      {modalPago && (
        <ModalPagoCredito
          credito={modalPago}
          onPago={() => { setModalPago(null); cargarCreditos() }}
          onCerrar={() => setModalPago(null)}
        />
      )}
    </div>
  )
}
