import { useEffect, useState } from 'react'
import { formatMiles } from '../utils/formatMiles'
import api from '../api/client'
import './Gastos.css'

const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
]

function formatFechaCorta(iso) {
  if (!iso) return ''
  const [, m, d] = iso.split('-')
  return `${parseInt(d)} ${MESES[parseInt(m) - 1].slice(0, 3)}`
}

export default function Gastos() {
  const [gastos, setGastos]           = useState([])
  const [categorias, setCategorias]   = useState([])
  const [cargando, setCargando]       = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editando, setEditando]       = useState(null)
  const [filtroMes, setFiltroMes]     = useState(new Date().getMonth() + 1)
  const [filtroAnio, setFiltroAnio]   = useState(new Date().getFullYear())
  const [resumen, setResumen]         = useState(null)

  const [form, setForm] = useState({
    nombre: '',
    valorDisplay: '',
    valor: 0,
    categoria_id: null,
    categoria_nombre: 'Otros',
    tipo: 'variable',
    fecha: new Date().toISOString().split('T')[0],
    notas: '',
  })

  const cargarCategorias = async () => {
    try {
      const res = await api.get('/gastos/categorias')
      setCategorias(res.data)
    } catch {}
  }

  const cargarGastos = async () => {
    setCargando(true)
    try {
      const [gRes, rRes] = await Promise.all([
        api.get(`/gastos?mes=${filtroMes}&anio=${filtroAnio}`),
        api.get(`/gastos/resumen?mes=${filtroMes}&anio=${filtroAnio}`),
      ])
      setGastos(gRes.data)
      setResumen(rRes.data)
    } catch {}
    finally { setCargando(false) }
  }

  useEffect(() => {
    cargarCategorias()
  }, [])

  useEffect(() => {
    cargarGastos()
  }, [filtroMes, filtroAnio])

  const abrirNuevo = () => {
    setEditando(null)
    setForm({
      nombre: '',
      valorDisplay: '',
      valor: 0,
      categoria_id: null,
      categoria_nombre: 'Otros',
      tipo: 'variable',
      fecha: new Date().toISOString().split('T')[0],
      notas: '',
    })
    setMostrarForm(true)
  }

  const guardarGasto = async () => {
    const payload = {
      nombre: form.nombre.trim(),
      valor: form.valor,
      categoria_id: form.categoria_id,
      categoria_nombre: form.categoria_nombre,
      tipo: form.tipo,
      fecha: form.fecha,
      notas: form.notas,
    }
    try {
      if (editando) {
        await api.put(`/gastos/${editando.id}`, payload)
      } else {
        await api.post('/gastos/', payload)
      }
      setMostrarForm(false)
      setEditando(null)
      cargarGastos()
    } catch (e) {
      alert('Error: ' + (e?.response?.data?.detail ?? e.message))
    }
  }

  const eliminarGasto = async (id) => {
    if (!window.confirm('¿Eliminar este gasto?')) return
    try {
      await api.delete(`/gastos/${id}`)
      cargarGastos()
    } catch (e) {
      alert('Error: ' + (e?.response?.data?.detail ?? e.message))
    }
  }

  return (
    <div className="gastos-page">

      {/* Header */}
      <div className="gastos-header">
        <h2>💸 Gastos del negocio</h2>
        <button className="btn-nuevo-gasto" onClick={abrirNuevo}>
          + Nuevo gasto
        </button>
      </div>

      {/* Filtro de mes */}
      <div className="gastos-filtro">
        <select
          value={filtroMes}
          onChange={e => setFiltroMes(parseInt(e.target.value))}
          className="gastos-select-mes"
        >
          {MESES.map((m, i) => (
            <option key={i + 1} value={i + 1}>{m}</option>
          ))}
        </select>
        <input
          type="number"
          value={filtroAnio}
          onChange={e => setFiltroAnio(parseInt(e.target.value))}
          className="gastos-input-anio"
          min="2024"
          max="2030"
        />
        <button
          className="btn-filtro-hoy"
          onClick={() => {
            const hoy = new Date()
            setFiltroMes(hoy.getMonth() + 1)
            setFiltroAnio(hoy.getFullYear())
          }}
        >
          Mes actual
        </button>
      </div>

      {/* Resumen */}
      {resumen && (
        <div className="gastos-resumen">
          <div className="gastos-resumen-card">
            <div className="gastos-resumen-label">Total gastos</div>
            <div className="gastos-resumen-valor rojo">$ {formatMiles(resumen.total)}</div>
          </div>
          <div className="gastos-resumen-card">
            <div className="gastos-resumen-label">💜 Fijos</div>
            <div className="gastos-resumen-valor purple">$ {formatMiles(resumen.total_fijo)}</div>
          </div>
          <div className="gastos-resumen-card">
            <div className="gastos-resumen-label">🟡 Variables</div>
            <div className="gastos-resumen-valor amber">$ {formatMiles(resumen.total_variable)}</div>
          </div>
        </div>
      )}

      {/* Lista */}
      {cargando ? (
        <div className="gastos-cargando">Cargando...</div>
      ) : gastos.length === 0 ? (
        <div className="gastos-vacio">
          <div style={{ fontSize: '40px' }}>💸</div>
          <div>No hay gastos registrados</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            en {MESES[filtroMes - 1]} {filtroAnio}
          </div>
        </div>
      ) : (
        <div className="gastos-lista">
          {gastos.map(g => (
            <div key={g.id} className="gasto-item">
              <div className="gasto-emoji">{g.emoji || '💸'}</div>
              <div className="gasto-info">
                <div className="gasto-nombre">{g.nombre}</div>
                <div className="gasto-meta">
                  {g.categoria_nombre || 'Otros'}
                  {' · '}
                  {formatFechaCorta(g.fecha)}
                  {' '}
                  <span className={`gasto-tipo-badge ${g.tipo === 'fijo' ? 'fijo' : 'var'}`}>
                    {g.tipo === 'fijo' ? 'Fijo' : 'Variable'}
                  </span>
                </div>
                {g.notas && <div className="gasto-notas">{g.notas}</div>}
              </div>
              <div className="gasto-derecha">
                <div className="gasto-valor">$ {formatMiles(g.valor)}</div>
                <div className="gasto-acciones">
                  <button
                    className="btn-gasto-editar"
                    onClick={() => {
                      setEditando(g)
                      setForm({
                        nombre: g.nombre,
                        valorDisplay: formatMiles(g.valor),
                        valor: g.valor,
                        categoria_id: g.categoria_id,
                        categoria_nombre: g.categoria_nombre,
                        tipo: g.tipo,
                        fecha: g.fecha,
                        notas: g.notas || '',
                      })
                      setMostrarForm(true)
                    }}
                  >✏️</button>
                  <button
                    className="btn-gasto-eliminar"
                    onClick={() => eliminarGasto(g.id)}
                  >🗑</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Por categoría */}
      {resumen?.por_categoria?.length > 0 && (
        <div className="gastos-por-cat">
          <div className="gastos-por-cat-titulo">Por categoría</div>
          {resumen.por_categoria.map(c => (
            <div key={c.categoria} className="gasto-cat-row">
              <span>{c.emoji} {c.categoria}</span>
              <span className="gasto-cat-val">$ {formatMiles(c.total)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Modal formulario */}
      {mostrarForm && (
        <div className="modal-overlay" onClick={() => setMostrarForm(false)}>
          <div className="modal-gasto" onClick={e => e.stopPropagation()}>

            <div className="modal-gasto-header">
              <div className="modal-gasto-titulo">
                {editando ? 'Editar gasto' : 'Nuevo gasto'}
              </div>
              <button className="modal-gasto-cerrar" onClick={() => setMostrarForm(false)}>×</button>
            </div>

            <div className="modal-gasto-body">

              <div className="gasto-campo">
                <label>NOMBRE DEL GASTO</label>
                <input
                  type="text"
                  className="gasto-input"
                  value={form.nombre}
                  onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
                  placeholder="Ej: Arriendo local"
                  autoFocus
                />
              </div>

              <div className="gasto-campo">
                <label>VALOR</label>
                <input
                  type="text"
                  inputMode="numeric"
                  className="gasto-input gold"
                  value={form.valorDisplay}
                  onChange={e => {
                    const raw = e.target.value.replace(/\./g, '').replace(/\D/g, '')
                    setForm(p => ({
                      ...p,
                      valorDisplay: raw ? formatMiles(raw) : '',
                      valor: raw ? parseInt(raw) : 0,
                    }))
                  }}
                  placeholder="$ 0"
                />
              </div>

              <div className="gasto-campo">
                <label>CATEGORÍA</label>
                <div className="gasto-cats-grid">
                  {categorias.map(c => (
                    <button
                      key={c.id}
                      className={`gasto-cat-btn ${form.categoria_id === c.id ? 'seleccionada' : ''}`}
                      onClick={() => setForm(p => ({
                        ...p,
                        categoria_id: c.id,
                        categoria_nombre: c.nombre,
                      }))}
                    >
                      {c.emoji} {c.nombre}
                    </button>
                  ))}
                </div>
              </div>

              <div className="gasto-campo">
                <label>TIPO DE GASTO</label>
                <div className="gasto-tipo-row">
                  <button
                    className={`gasto-tipo-btn ${form.tipo === 'variable' ? 'activo-var' : ''}`}
                    onClick={() => setForm(p => ({ ...p, tipo: 'variable' }))}
                  >
                    🟡 Variable
                  </button>
                  <button
                    className={`gasto-tipo-btn ${form.tipo === 'fijo' ? 'activo-fijo' : ''}`}
                    onClick={() => setForm(p => ({ ...p, tipo: 'fijo' }))}
                  >
                    💜 Fijo mensual
                  </button>
                </div>
              </div>

              <div className="gasto-campo">
                <label>FECHA</label>
                <input
                  type="date"
                  className="gasto-input"
                  value={form.fecha}
                  onChange={e => setForm(p => ({ ...p, fecha: e.target.value }))}
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>

              <div className="gasto-campo">
                <label>NOTAS (OPCIONAL)</label>
                <input
                  type="text"
                  className="gasto-input"
                  value={form.notas}
                  onChange={e => setForm(p => ({ ...p, notas: e.target.value }))}
                  placeholder="Observaciones..."
                />
              </div>

            </div>

            <div className="modal-gasto-footer">
              <button className="btn-gasto-cancelar" onClick={() => setMostrarForm(false)}>
                Cancelar
              </button>
              <button
                className="btn-gasto-guardar"
                onClick={guardarGasto}
                disabled={!form.nombre.trim() || form.valor <= 0}
              >
                {editando ? 'Guardar cambios' : 'Registrar gasto'}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  )
}
