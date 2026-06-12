import { useEffect, useState } from 'react'
import usePOSStore from '../store/usePOSStore'
import api from '../api/client'
import './StatusBar.css'

export default function StatusBar() {
  const { wsConnected, nombreRestaurante } = usePOSStore()
  const [turno, setTurno] = useState(null)
  const host = window.location.hostname

  useEffect(() => {
    const fetchTurno = async () => {
      try {
        const res = await api.get('/turnos/activo')
        setTurno(res.data)
      } catch {
        setTurno(null)
      }
    }
    fetchTurno()
    const t = setInterval(fetchTurno, 60000)
    return () => clearInterval(t)
  }, [])

  const turnoInfo = turno
    ? ` · Turno: ${turno.cajero} desde ${String(turno.fecha_apertura).slice(11, 16)}`
    : ''

  return (
    <div className="status-bar">
      <span className={`status-dot ${wsConnected ? 'online' : 'offline'}`} />
      <span className="status-text">
        {wsConnected ? 'Conectado' : 'Sin conexión'} · {nombreRestaurante} · {host}{turnoInfo}
      </span>
    </div>
  )
}
