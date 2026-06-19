import usePOSStore from '../store/usePOSStore'

const borradorSync = {
  get: async (tipo) => {
    const { token } = usePOSStore.getState()
    if (!token) return null
    try {
      const res = await fetch(`/borradores/${tipo}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      })
      if (!res.ok) return null
      const data = await res.json()
      return data.datos || null
    } catch {
      return null
    }
  },

  guardar: async (tipo, datos) => {
    const { token } = usePOSStore.getState()
    if (!token) return
    try {
      await fetch(`/borradores/${tipo}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ datos }),
      })
    } catch {
      localStorage.setItem(`borrador_${tipo}`, JSON.stringify(datos))
    }
  },

  limpiar: async (tipo) => {
    const { token } = usePOSStore.getState()
    if (!token) return
    try {
      await fetch(`/borradores/${tipo}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      })
    } catch {}
    localStorage.removeItem(`borrador_${tipo}`)
  },
}

export default borradorSync
