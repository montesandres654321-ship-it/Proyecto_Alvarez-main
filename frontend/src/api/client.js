import axios from 'axios'

const api = axios.create({ baseURL: '/' })

// PIN de administrador — se establece después de verificación exitosa en PinGuard
let _pin = null
export function setPinHeader(pin) {
  _pin = pin
}

api.interceptors.request.use((config) => {
  if (_pin) config.headers['X-PIN'] = _pin
  return config
})

export default api

export const formatCOP = (n) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n)
