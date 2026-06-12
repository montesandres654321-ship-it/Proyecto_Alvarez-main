import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import usePOSStore from '../store/usePOSStore'
import './TopBar.css'

export default function TopBar() {
  const { wsConnected, nombreRestaurante } = usePOSStore()
  const [hora, setHora] = useState(() =>
    new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
  )

  useEffect(() => {
    const t = setInterval(() => {
      setHora(new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }))
    }, 30000)
    return () => clearInterval(t)
  }, [])

  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="topbar-logo">A</div>
        <div className="topbar-brand">
          <span className="topbar-name">{nombreRestaurante}</span>
          <span className="topbar-sub">Punto de venta · Copa Mundial 2026</span>
        </div>
        <nav className="topbar-nav">
          <NavLink to="/" end className={({ isActive }) => `topbar-link${isActive ? ' active' : ''}`}>
            Ventas
          </NavLink>
          <NavLink to="/reportes" className={({ isActive }) => `topbar-link${isActive ? ' active' : ''}`}>
            Reportes
          </NavLink>
          <NavLink to="/insumos" className={({ isActive }) => `topbar-link insumos-link${isActive ? ' active' : ''}`}>
            🛒 Insumos
          </NavLink>
          <NavLink to="/nomina" className={({ isActive }) => `topbar-link${isActive ? ' active' : ''}`}>
            👥 Nómina
          </NavLink>
          <NavLink to="/admin" className={({ isActive }) => `topbar-link${isActive ? ' active' : ''}`}>
            Admin
          </NavLink>
        </nav>
      </div>
      <div className="topbar-right">
        <div className={`ws-indicator ${wsConnected ? 'online' : 'offline'}`}>
          <span className="ws-dot" />
          <span className="ws-label">{wsConnected ? 'En línea' : 'Sin conexión'}</span>
        </div>
        <span className="topbar-clock">{hora}</span>
      </div>
    </header>
  )
}
