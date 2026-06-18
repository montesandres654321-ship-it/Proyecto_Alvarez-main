import { Navigate } from 'react-router-dom'
import usePOSStore from '../store/usePOSStore'

export default function RutaProtegida({ children, soloAdmin = false }) {
  const { rol } = usePOSStore()

  if (!rol) {
    return <Navigate to="/login" replace />
  }

  if (soloAdmin && rol !== 'admin') {
    return <Navigate to="/ventas" replace />
  }

  return children
}
