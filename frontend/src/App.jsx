import { useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import usePOSStore from './store/usePOSStore'
import TopBar from './components/TopBar'
import StatusBar from './components/StatusBar'
import Venta from './pages/Venta'
import Reportes from './pages/Reportes'
import Admin from './pages/Admin'
import Insumos from './pages/Insumos'
import Nomina from './pages/Nomina'
import './App.css'

function WSManager() {
  const { actualizarMesaDesdeWS, setWsConnected } = usePOSStore()
  const wsRef = useRef(null)
  const retryRef = useRef(null)

  const connect = () => {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const url = `${proto}://${window.location.host}/ws/mesas`
    const ws = new WebSocket(url)

    ws.onopen = () => setWsConnected(true)
    ws.onclose = () => {
      setWsConnected(false)
      retryRef.current = setTimeout(connect, 3000)
    }
    ws.onerror = () => ws.close()
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.evento === 'mesa_actualizada' && msg.data) {
          actualizarMesaDesdeWS(msg.mesa, msg.data)
        }
      } catch {}
    }
    wsRef.current = ws
  }

  useEffect(() => {
    connect()
    return () => {
      clearTimeout(retryRef.current)
      wsRef.current?.close()
    }
  }, [])

  return null
}

export default function App() {
  const { cargarConfig } = usePOSStore()
  useEffect(() => { cargarConfig() }, [])

  return (
    <BrowserRouter>
      <WSManager />
      <div className="app-shell">
        <TopBar />
        <div className="routes-content">
          <Routes>
            <Route path="/" element={<Venta />} />
            <Route path="/reportes" element={<Reportes />} />
            <Route path="/insumos" element={<Insumos />} />
            <Route path="/nomina" element={<Nomina />} />
            <Route path="/admin" element={<Admin />} />
          </Routes>
        </div>
        <StatusBar />
      </div>
    </BrowserRouter>
  )
}
