import axios from 'axios'

const api = axios.create({ baseURL: '/' })

// PIN de administrador — legacy, mantenido para compatibilidad
let _pin = null
export function setPinHeader(pin) {
  _pin = pin
}

api.interceptors.request.use((config) => {
  if (_pin) config.headers['X-PIN'] = _pin
  // Token de sesión — se lee de localStorage para evitar dependencia circular con el store
  const token = localStorage.getItem('session_token')
  if (token) config.headers['Authorization'] = `Bearer ${token}`
  return config
})

export default api

export const formatCOP = (n) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n)
