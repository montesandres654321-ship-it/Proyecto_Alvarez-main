import { create } from 'zustand'
import api from '../api/client'

function mergeItems(mesaData) {
  if (!mesaData?.items) return mesaData
  const merged = []
  const rawIndices = []
  mesaData.items.forEach((item, rawIdx) => {
    const match = merged.findIndex(
      (m) => m.producto_id === item.producto_id &&
             (m.notas_modificacion || '') === (item.notas_modificacion || '')
    )
    if (match >= 0) {
      merged[match].cantidad += item.cantidad
      merged[match].subtotal += item.subtotal
      rawIndices[match].push(rawIdx)
    } else {
      merged.push({ ...item })
      rawIndices.push([rawIdx])
    }
  })
  merged.forEach((item, i) => { item._rawIndices = rawIndices[i] })
  return { ...mesaData, items: merged }
}

const usePOSStore = create((set, get) => ({
  // ── Estado ─────────────────────────────────────────────────────────────
  mesaActual: '1',
  mesas: {},          // { [mesa_id]: MesaEstadoOut }
  domicilios: [],     // [{ id, nombre, telefono }]
  productos: [],
  categorias: [],
  categoriaActiva: null,
  wsConnected: false,
  nequiNumero: '',
  nombreRestaurante: 'Alvarez Fast Food',
  numMesas: 8,
  pinAdmin: null,

  // ── Acciones ────────────────────────────────────────────────────────────
  setMesaActual: (id) => set({ mesaActual: id }),

  cargarProductos: async () => {
    const [pRes, cRes] = await Promise.all([
      api.get('/productos/?solo_activos=true'),
      api.get('/productos/categorias'),
    ])
    set({
      productos: pRes.data,
      categorias: cRes.data,
      categoriaActiva: cRes.data[0] ?? null,
    })
  },

  setCategoriaActiva: (cat) => set({ categoriaActiva: cat }),

  cargarConfig: async () => {
    try {
      const [nRes, nrRes, nmRes] = await Promise.all([
        api.get('/configuracion/nequi_numero'),
        api.get('/configuracion/nombre_restaurante'),
        api.get('/configuracion/num_mesas'),
      ])
      set({
        nequiNumero: nRes.data.valor ?? '',
        nombreRestaurante: nrRes.data.valor ?? 'Alvarez Fast Food',
        numMesas: parseInt(nmRes.data.valor ?? '8', 10) || 8,
      })
    } catch (_) {}
  },

  cargarMesa: async (mesaId) => {
    const res = await api.get(`/mesas/${mesaId}`)
    const merged = mergeItems(res.data)
    set((s) => ({ mesas: { ...s.mesas, [mesaId]: merged } }))
    return merged
  },

  agregarItem: async (mesaId, productoId, cantidad = 1, notas = '') => {
    const res = await api.post(`/mesas/${mesaId}/items`, {
      producto_id: productoId,
      cantidad,
      notas,
    })
    const merged = mergeItems(res.data)
    set((s) => ({ mesas: { ...s.mesas, [mesaId]: merged } }))
    return merged
  },

  agregarItemCustom: async (mesaId, nombre, precio, categoria, cantidad = 1, notas = '') => {
    const res = await api.post(`/mesas/${mesaId}/items/custom`, {
      nombre,
      precio,
      categoria,
      cantidad,
      notas,
    })
    const merged = mergeItems(res.data)
    set((s) => ({ mesas: { ...s.mesas, [mesaId]: merged } }))
    return merged
  },

  quitarItem: async (mesaId, visualIdx) => {
    const mergedItems = get().mesas[mesaId]?.items ?? []
    const item = mergedItems[visualIdx]
    const rawIdx = item?._rawIndices?.at(-1) ?? visualIdx
    const res = await api.delete(`/mesas/${mesaId}/items/${rawIdx}`)
    const merged = mergeItems(res.data)
    set((s) => ({ mesas: { ...s.mesas, [mesaId]: merged } }))
    return merged
  },

  cobrar: async (mesaId, metodoPago, tipoEntrega, telefonoCliente, montoRecibido = 0, nombreCliente = '') => {
    const res = await api.post(`/mesas/${mesaId}/cobrar`, {
      metodo_pago:      metodoPago,
      tipo_entrega:     tipoEntrega,
      telefono_cliente: telefonoCliente,
      monto_recibido:   montoRecibido,
      nombre_cliente:   nombreCliente,
    })
    set((s) => {
      const mesas = { ...s.mesas }
      delete mesas[mesaId]
      return { mesas }
    })
    return res.data
  },

  limpiarMesa: async (mesaId) => {
    await api.delete(`/mesas/${mesaId}`)
    set((s) => {
      const mesas = { ...s.mesas }
      delete mesas[mesaId]
      return { mesas }
    })
  },

  // ── Domicilios ──────────────────────────────────────────────────────────
  agregarDomicilio: (nombre, telefono) => {
    const id = `dom-${Date.now()}`
    set((s) => ({
      domicilios: [...s.domicilios, { id, nombre, telefono }],
      mesaActual: id,
    }))
    return id
  },

  eliminarDomicilio: (id) => {
    set((s) => {
      const mesas = { ...s.mesas }
      delete mesas[id]
      return {
        domicilios: s.domicilios.filter((d) => d.id !== id),
        mesas,
        mesaActual: s.mesaActual === id ? '1' : s.mesaActual,
      }
    })
  },

  // ── WebSocket ──────────────────────────────────────────────────────────
  actualizarMesaDesdeWS: (mesaId, data) => {
    set((s) => ({ mesas: { ...s.mesas, [mesaId]: mergeItems(data) } }))
  },

  setWsConnected: (v) => set({ wsConnected: v }),
  setPinAdmin: (pin) => set({ pinAdmin: pin }),
}))

export default usePOSStore
