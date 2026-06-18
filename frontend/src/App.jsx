import { useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import usePOSStore from './store/usePOSStore'
import TopBar from './components/TopBar'
import StatusBar from './components/StatusBar'
import RutaProtegida from './components/RutaProtegida'
import Login from './pages/Login'
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
            <Route path="/login" element={<Login />} />

            <Route path="/ventas" element={
              <RutaProtegida>
                <Venta />
              </RutaProtegida>
            } />

            <Route path="/reportes" element={
              <RutaProtegida soloAdmin>
                <Reportes />
              </RutaProtegida>
            } />

            <Route path="/insumos" element={
              <RutaProtegida soloAdmin>
                <Insumos />
              </RutaProtegida>
            } />

            <Route path="/nomina" element={
              <RutaProtegida soloAdmin>
                <Nomina />
              </RutaProtegida>
            } />

            <Route path="/admin" element={
              <RutaProtegida soloAdmin>
                <Admin />
              </RutaProtegida>
            } />

            <Route path="/" element={<Navigate to="/ventas" replace />} />
          </Routes>
        </div>
        <StatusBar />
      </div>
    </BrowserRouter>
  )
}
