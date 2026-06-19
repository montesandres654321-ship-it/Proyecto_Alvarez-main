// ── CARRITO ────────────────────────────────────────────────────────────────

export const guardarCarrito = (usuarioId, datos) => {
  try {
    localStorage.setItem(
      `carrito_${usuarioId}`,
      JSON.stringify({ ...datos, timestamp: Date.now() })
    )
  } catch (e) {
    console.error('Error guardando carrito:', e)
  }
}

export const cargarCarrito = (usuarioId) => {
  try {
    const raw = localStorage.getItem(`carrito_${usuarioId}`)
    if (!raw) return null
    const data = JSON.parse(raw)
    const MAX_AGE = 24 * 60 * 60 * 1000
    if (Date.now() - data.timestamp > MAX_AGE) {
      limpiarCarrito(usuarioId)
      return null
    }
    return data
  } catch (_) {
    return null
  }
}

export const limpiarCarrito = (usuarioId) => {
  localStorage.removeItem(`carrito_${usuarioId}`)
}

// ── INSUMOS ────────────────────────────────────────────────────────────────

export const guardarBorradorInsumos = (datos) => {
  try {
    localStorage.setItem(
      'insumos_borrador',
      JSON.stringify({ ...datos, timestamp: Date.now() })
    )
  } catch (_) {}
}

export const cargarBorradorInsumos = () => {
  try {
    const raw = localStorage.getItem('insumos_borrador')
    if (!raw) return null
    const data = JSON.parse(raw)
    const MAX_AGE = 12 * 60 * 60 * 1000
    if (Date.now() - data.timestamp > MAX_AGE) {
      limpiarBorradorInsumos()
      return null
    }
    return data
  } catch (_) {
    return null
  }
}

export const limpiarBorradorInsumos = () => {
  localStorage.removeItem('insumos_borrador')
}

// ── NÓMINA ─────────────────────────────────────────────────────────────────

export const guardarBorradorNomina = (datos) => {
  try {
    localStorage.setItem(
      'nomina_borrador',
      JSON.stringify({ ...datos, timestamp: Date.now() })
    )
  } catch (_) {}
}

export const cargarBorradorNomina = () => {
  try {
    const raw = localStorage.getItem('nomina_borrador')
    if (!raw) return null
    const data = JSON.parse(raw)
    const MAX_AGE = 24 * 60 * 60 * 1000
    if (Date.now() - data.timestamp > MAX_AGE) {
      limpiarBorradorNomina()
      return null
    }
    return data
  } catch (_) {
    return null
  }
}

export const limpiarBorradorNomina = () => {
  localStorage.removeItem('nomina_borrador')
}
