import { useEffect, useState } from 'react'
import PinGuard from '../components/PinGuard'
import api from '../api/client'
import { formatMiles, parseMiles } from '../utils/formatMiles'
import './Admin.css'

// ── Utilidades de tiempo relativo ─────────────────────────────────────────
function tiempoRelativo(isoStr) {
  if (!isoStr) return 'desconocido'
  const diff = Math.floor((Date.now() - new Date(isoStr)) / 1000)
  if (diff < 60) return 'hace un momento'
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`
  return `hace ${Math.floor(diff / 86400)} días`
}

function AdminContenido() {
  const [productos, setProductos] = useState([])
  const [config, setConfig] = useState({})
  const [tab, setTab] = useState('productos')
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [mostrarNuevaCat, setMostrarNuevaCat] = useState(false)
  const [nuevaCat, setNuevaCat] = useState('')
  const [errors, setErrors] = useState({})

  // ── Preparaciones ────────────────────────────────────────────────────────
  const [prepCat, setPrepCat] = useState('')
  const [prepOpciones, setPrepOpciones] = useState([]) // [{id, opcion}]
  const [prepNueva, setPrepNueva] = useState('')
  const [prepSaving, setPrepSaving] = useState(false)

  // ── Insumos ──────────────────────────────────────────────────────────────
  const [insumos, setInsumos]             = useState([])
  const [insumoForm, setInsumoForm]       = useState(null) // null | {id?, nombre, unidad, precio_ref}
  const [insumoSaving, setInsumoSaving]   = useState(false)

  const cargarInsumos = async () => {
    try {
      const res = await api.get('/insumos/catalogo')
      setInsumos(res.data)
    } catch {}
  }

  // ── Usuarios ─────────────────────────────────────────────────────────────
  const [usuariosLista, setUsuariosLista]     = useState([])
  const [usuarioForm, setUsuarioForm]         = useState(null)
  const [usuarioSaving, setUsuarioSaving]     = useState(false)
  const [sesionesActivas, setSesionesActivas] = useState([])

  const cargarUsuarios = async () => {
    try {
      const res = await api.get('/usuarios/')
      setUsuariosLista(res.data)
    } catch {}
  }

  const cargarSesionesActivas = async () => {
    try {
      const res = await api.get('/usuarios/sesiones-activas')
      setSesionesActivas(res.data)
    } catch {}
  }

  // ── Trabajadores ─────────────────────────────────────────────────────────
  const [trabajadores, setTrabajadores]         = useState([])
  const [trabajadorForm, setTrabajadorForm]     = useState(null)
  const [trabajadorSaving, setTrabajadorSaving] = useState(false)

  const cargarTrabajadores = async () => {
    try {
      const res = await api.get('/nomina/trabajadores')
      setTrabajadores(res.data)
    } catch {}
  }

  const cargarProductos = async () => {
    const res = await api.get('/productos/?solo_activos=false')
    setProductos(res.data)
  }

  const cargarConfig = async () => {
    const res = await api.get('/configuracion/')
    setConfig(res.data)
  }

  const cargarPreparaciones = async (cat) => {
    if (!cat) return
    const res = await api.get(`/preparaciones/?categoria=${encodeURIComponent(cat)}`)
    setPrepOpciones(res.data)
  }

  const categorias = [...new Set(productos.map(p => p.categoria).filter(Boolean))].sort()

  useEffect(() => {
    cargarProductos()
    cargarConfig()
    cargarInsumos()
    cargarTrabajadores()
    cargarUsuarios()
  }, [])

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 3000) }

  const abrirForm = (datos) => {
    const precio = datos.precio ? formatMiles(String(datos.precio).replace(/\D/g, '')) : ''
    setForm({ ...datos, precio })
    setMostrarNuevaCat(false)
    setNuevaCat('')
    setErrors({})
  }
  const cerrarForm = () => {
    setForm(null)
    setMostrarNuevaCat(false)
    setNuevaCat('')
    setErrors({})
  }

  const validar = () => {
    const e = {}
    if (!form.nombre?.trim() || form.nombre.trim().length < 2)
      e.nombre = 'Nombre requerido (mínimo 2 caracteres)'
    if (!form.precio || parseMiles(form.precio) <= 0)
      e.precio = 'Precio inválido'
    if (!form.categoria)
      e.categoria = 'Selecciona una categoría'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const guardarProducto = async () => {
    if (!validar()) return
    setSaving(true)
    const precioInt = parseMiles(form.precio)
    try {
      if (form.id) {
        await api.put(`/productos/${form.id}`, {
          nombre: form.nombre, precio: precioInt,
          categoria: form.categoria, ingredientes: form.ingredientes ?? '',
        })
        flash('Producto actualizado ✓')
      } else {
        await api.post('/productos/', {
          nombre: form.nombre, precio: precioInt,
          categoria: form.categoria, ingredientes: form.ingredientes ?? '',
        })
        flash('Producto creado ✓')
      }
      setForm(null)
      cargarProductos()
    } catch (e) {
      flash('Error: ' + (e?.response?.data?.detail ?? e.message))
    } finally {
      setSaving(false)
    }
  }

  const toggleActivo = async (p) => {
    await api.patch(`/productos/${p.id}/toggle`)
    cargarProductos()
  }

  const guardarConfig = async (clave, valor) => {
    await api.put(`/configuracion/${clave}`, { valor })
    flash(`${clave} guardado ✓`)
    cargarConfig()
  }

  const agregarPrep = async () => {
    if (!prepNueva.trim()) return
    setPrepSaving(true)
    try {
      await api.post('/preparaciones/', { categoria: prepCat, opcion: prepNueva.trim() })
      setPrepNueva('')
      cargarPreparaciones(prepCat)
      flash('Opción agregada ✓')
    } catch (e) {
      flash('Error: ' + (e?.response?.data?.detail ?? e.message))
    } finally {
      setPrepSaving(false)
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h2>Administración</h2>
        {msg && <div className="admin-msg">{msg}</div>}
      </div>

      <div className="admin-tabs">
        <button
          className={`admin-tab${tab === 'productos' ? ' active' : ''}`}
          onClick={() => setTab('productos')}
        >
          Productos
        </button>
        <button
          className={`admin-tab${tab === 'preparaciones' ? ' active' : ''}`}
          onClick={() => setTab('preparaciones')}
        >
          Preparaciones
        </button>
        <button
          className={`admin-tab${tab === 'insumos' ? ' active' : ''}`}
          onClick={() => { setTab('insumos'); cargarInsumos() }}
        >
          Insumos
        </button>
        <button
          className={`admin-tab${tab === 'trabajadores' ? ' active' : ''}`}
          onClick={() => { setTab('trabajadores'); cargarTrabajadores() }}
        >
          Trabajadores
        </button>
        <button
          className={`admin-tab${tab === 'usuarios' ? ' active' : ''}`}
          onClick={() => { setTab('usuarios'); cargarUsuarios(); cargarSesionesActivas() }}
        >
          Usuarios
        </button>
        <button
          className={`admin-tab${tab === 'config' ? ' active' : ''}`}
          onClick={() => setTab('config')}
        >
          Configuración
        </button>
      </div>

      {/* ── PRODUCTOS ── */}
      {tab === 'productos' && (
        <div className="admin-section">
          <button
            className="btn-nuevo-producto"
            onClick={() => abrirForm({ nombre: '', precio: '', categoria: '', ingredientes: '' })}
          >
            + Nuevo producto
          </button>

          {form !== null && (
            <div className="form-producto">
              <h3>{form.id ? 'Editar producto' : 'Nuevo producto'}</h3>
              <div className="form-grid">
                <label className="form-label">
                  Nombre
                  <input
                    className={errors.nombre ? 'input-error' : ''}
                    value={form.nombre}
                    onChange={(e) => {
                      setForm({ ...form, nombre: e.target.value })
                      if (errors.nombre) setErrors({ ...errors, nombre: undefined })
                    }}
                  />
                  {errors.nombre && <span className="field-error">{errors.nombre}</span>}
                </label>
                <label className="form-label">
                  Precio (COP)
                  <input
                    type="text"
                    inputMode="numeric"
                    className={errors.precio ? 'input-error' : ''}
                    value={form.precio}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\./g, '').replace(/\D/g, '')
                      setForm({ ...form, precio: raw ? formatMiles(raw) : '' })
                      if (errors.precio) setErrors({ ...errors, precio: undefined })
                    }}
                  />
                  {errors.precio && <span className="field-error">{errors.precio}</span>}
                </label>
                <label className="form-label">
                  Categoría
                  <select
                    className={`form-select${errors.categoria ? ' input-error' : ''}`}
                    value={mostrarNuevaCat ? '__nueva__' : form.categoria}
                    onChange={(e) => {
                      if (e.target.value === '__nueva__') {
                        setMostrarNuevaCat(true)
                        setNuevaCat('')
                        setForm({ ...form, categoria: '' })
                      } else {
                        setMostrarNuevaCat(false)
                        setNuevaCat('')
                        setForm({ ...form, categoria: e.target.value })
                      }
                    }}
                  >
                    <option value="">Selecciona categoría...</option>
                    {categorias.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                    <option value="__nueva__">+ Nueva categoría</option>
                  </select>
                  {mostrarNuevaCat && (
                    <input
                      className="nueva-cat-input"
                      type="text"
                      placeholder="Nombre de la nueva categoría"
                      value={nuevaCat}
                      autoFocus
                      onChange={(e) => {
                        const v = e.target.value.toUpperCase()
                        setNuevaCat(v)
                        setForm({ ...form, categoria: v })
                        if (errors.categoria) setErrors({ ...errors, categoria: undefined })
                      }}
                    />
                  )}
                  {errors.categoria && <span className="field-error">{errors.categoria}</span>}
                </label>
                <label className="form-label">
                  Ingredientes
                  <input value={form.ingredientes ?? ''} onChange={(e) => setForm({ ...form, ingredientes: e.target.value })} />
                </label>
              </div>
              <div className="form-acciones">
                <button className="btn-form-cancel" onClick={cerrarForm}>Cancelar</button>
                <button className="btn-form-save" onClick={guardarProducto} disabled={saving}>
                  {saving ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            </div>
          )}

          <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Categoría</th>
                <th>Precio</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {productos.map((p) => (
                <tr key={p.id} className={p.activo ? '' : 'row-inactivo'}>
                  <td>{p.nombre}</td>
                  <td className="td-categoria">{p.categoria}</td>
                  <td className="td-precio">
                    {new Intl.NumberFormat('es-CO', {
                      style: 'currency', currency: 'COP', minimumFractionDigits: 0,
                    }).format(p.precio)}
                  </td>
                  <td>
                    <button
                      className={`toggle-switch ${p.activo ? 'on' : 'off'}`}
                      onClick={() => toggleActivo(p)}
                      title={p.activo ? 'Activo — click para desactivar' : 'Inactivo — click para activar'}
                    >
                      <span className="toggle-thumb" />
                    </button>
                  </td>
                  <td className="td-acciones">
                    <button className="btn-edit" onClick={() => abrirForm({ ...p })} title="Editar">✏️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>

          {/* Tarjetas móvil — productos */}
          <div className="admin-cards-movil">
            {productos.map((p) => (
              <div key={p.id} className={`admin-card-item${p.activo ? '' : ' card-inactivo'}`}>
                <div className="admin-card-header">
                  <span className="admin-card-nombre">{p.nombre}</span>
                  <div className="admin-card-acciones">
                    <button className="btn-edit" onClick={() => abrirForm({ ...p })} title="Editar">✏️</button>
                    <button
                      className={`toggle-switch ${p.activo ? 'on' : 'off'}`}
                      onClick={() => toggleActivo(p)}
                      title={p.activo ? 'Activo' : 'Inactivo'}
                    >
                      <span className="toggle-thumb" />
                    </button>
                  </div>
                </div>
                <div className="admin-card-detalles">
                  <span className="admin-card-categoria">{p.categoria}</span>
                  <span className="admin-card-precio">
                    {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(p.precio)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── PREPARACIONES ── */}
      {tab === 'preparaciones' && (
        <div className="admin-section">
          <div className="prep-cat-selector">
            <label className="config-label">Categoría</label>
            <select
              className="form-select"
              value={prepCat}
              onChange={(e) => {
                const cat = e.target.value
                setPrepCat(cat)
                setPrepNueva('')
                cargarPreparaciones(cat)
              }}
            >
              <option value="">Selecciona categoría…</option>
              {categorias.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {prepCat && (
            <div className="prep-lista-wrapper">
              {prepOpciones.length === 0 ? (
                <p className="prep-empty">Sin opciones configuradas para {prepCat}</p>
              ) : (
                prepOpciones.map((item) => (
                  <div key={item.id} className="prep-row">
                    <span className="prep-row-text">{item.opcion}</span>
                    <button
                      className="prep-row-delete"
                      title="Eliminar opción"
                      onClick={async () => {
                        await api.delete(`/preparaciones/${item.id}`)
                        cargarPreparaciones(prepCat)
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))
              )}

              <div className="prep-add-row">
                <input
                  className="prep-add-input"
                  placeholder="Nueva opción de preparación…"
                  value={prepNueva}
                  onChange={(e) => setPrepNueva(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && prepNueva.trim()) agregarPrep()
                  }}
                />
                <button
                  className="prep-add-btn"
                  disabled={!prepNueva.trim() || prepSaving}
                  onClick={agregarPrep}
                >
                  + Agregar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── INSUMOS ── */}
      {tab === 'insumos' && (
        <div className="admin-section">
          <button
            className="btn-nuevo-producto"
            onClick={() => setInsumoForm({ nombre: '', unidad: 'und', precio_ref: '' })}
          >
            + Nuevo insumo
          </button>

          {insumoForm !== null && (
            <div className="form-producto">
              <h3>{insumoForm.id ? 'Editar insumo' : 'Nuevo insumo'}</h3>
              <div className="form-grid">
                <label className="form-label">
                  Nombre
                  <input
                    value={insumoForm.nombre}
                    onChange={e => setInsumoForm({ ...insumoForm, nombre: e.target.value })}
                    placeholder="Ej: Carne de res"
                  />
                </label>
                <label className="form-label">
                  Unidad
                  <select
                    className="form-select"
                    value={insumoForm.unidad}
                    onChange={e => setInsumoForm({ ...insumoForm, unidad: e.target.value })}
                  >
                    {['kg', 'und', 'lt', 'paq', 'gr'].map(u => <option key={u}>{u}</option>)}
                  </select>
                </label>
                <label className="form-label">
                  Precio referencia (COP)
                  <input
                    type="number"
                    value={insumoForm.precio_ref}
                    onChange={e => setInsumoForm({ ...insumoForm, precio_ref: e.target.value })}
                    placeholder="0"
                  />
                </label>
              </div>
              <div className="form-acciones">
                <button className="btn-form-cancel" onClick={() => setInsumoForm(null)}>Cancelar</button>
                <button
                  className="btn-form-save"
                  disabled={insumoSaving || !insumoForm.nombre.trim()}
                  onClick={async () => {
                    setInsumoSaving(true)
                    try {
                      const payload = {
                        nombre: insumoForm.nombre.trim(),
                        unidad: insumoForm.unidad,
                        precio_ref: parseInt(insumoForm.precio_ref || '0'),
                      }
                      if (insumoForm.id) {
                        await api.put(`/insumos/catalogo/${insumoForm.id}`, payload)
                        flash('Insumo actualizado ✓')
                      } else {
                        await api.post('/insumos/catalogo', payload)
                        flash('Insumo creado ✓')
                      }
                      setInsumoForm(null)
                      cargarInsumos()
                    } catch (e) {
                      flash('Error: ' + (e?.response?.data?.detail ?? e.message))
                    } finally {
                      setInsumoSaving(false)
                    }
                  }}
                >
                  {insumoSaving ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            </div>
          )}

          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Unidad</th>
                  <th>Precio ref.</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {insumos.map(ins => (
                  <tr key={ins.id}>
                    <td>{ins.nombre}</td>
                    <td className="td-categoria">{ins.unidad}</td>
                    <td className="td-precio">
                      {ins.precio_ref > 0
                        ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(ins.precio_ref)
                        : '—'}
                    </td>
                    <td className="td-acciones">
                      <button
                        className="btn-edit"
                        title="Editar"
                        onClick={() => setInsumoForm({ ...ins, precio_ref: String(ins.precio_ref) })}
                      >✏️</button>
                      <button
                        className="btn-edit"
                        title="Desactivar"
                        style={{ marginLeft: 4 }}
                        onClick={async () => {
                          await api.delete(`/insumos/catalogo/${ins.id}`)
                          flash('Insumo desactivado ✓')
                          cargarInsumos()
                        }}
                      >🗑</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Tarjetas móvil — insumos */}
          <div className="admin-cards-movil">
            {insumos.map(ins => (
              <div key={ins.id} className="admin-card-item">
                <div className="admin-card-header">
                  <span className="admin-card-nombre">{ins.nombre}</span>
                  <div className="admin-card-acciones">
                    <button className="btn-edit" title="Editar" onClick={() => setInsumoForm({ ...ins, precio_ref: String(ins.precio_ref) })}>✏️</button>
                    <button className="btn-edit" title="Eliminar" onClick={async () => { await api.delete(`/insumos/catalogo/${ins.id}`); flash('Insumo desactivado ✓'); cargarInsumos() }}>🗑</button>
                  </div>
                </div>
                <div className="admin-card-detalles">
                  <span className="admin-card-categoria">{ins.unidad}</span>
                  <span className="admin-card-precio">
                    {ins.precio_ref > 0
                      ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(ins.precio_ref)
                      : '—'}
                  </span>
                </div>
              </div>
            ))}
            {insumos.length === 0 && (
              <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>
                Sin insumos en catálogo
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── TRABAJADORES ── */}
      {tab === 'trabajadores' && (
        <div className="admin-section">
          <button
            className="btn-nuevo-producto"
            onClick={() => setTrabajadorForm({ nombre: '', rol: '', tarifa_dia: '' })}
          >
            + Nuevo trabajador
          </button>

          {trabajadorForm !== null && (
            <div className="form-producto">
              <h3>{trabajadorForm.id ? 'Editar trabajador' : 'Nuevo trabajador'}</h3>
              <div className="form-grid">
                <label className="form-label">
                  Nombre
                  <input
                    value={trabajadorForm.nombre}
                    onChange={e => setTrabajadorForm({ ...trabajadorForm, nombre: e.target.value })}
                    placeholder="Nombre completo"
                  />
                </label>
                <label className="form-label">
                  Rol
                  <input
                    value={trabajadorForm.rol}
                    onChange={e => setTrabajadorForm({ ...trabajadorForm, rol: e.target.value })}
                    placeholder="Ej: Cajero, Cocinero..."
                  />
                </label>
                <label className="form-label">
                  Tarifa por día (COP)
                  <input
                    type="text"
                    inputMode="numeric"
                    value={trabajadorForm.tarifa_dia}
                    onChange={e => {
                      const raw = e.target.value.replace(/\./g, '').replace(/\D/g, '')
                      setTrabajadorForm({ ...trabajadorForm, tarifa_dia: raw ? formatMiles(raw) : '' })
                    }}
                    placeholder="50.000"
                  />
                </label>
              </div>
              <div className="form-acciones">
                <button className="btn-form-cancel" onClick={() => setTrabajadorForm(null)}>Cancelar</button>
                <button
                  className="btn-form-save"
                  disabled={trabajadorSaving || !trabajadorForm.nombre.trim() || parseMiles(trabajadorForm.tarifa_dia) <= 0}
                  onClick={async () => {
                    setTrabajadorSaving(true)
                    try {
                      const payload = {
                        nombre: trabajadorForm.nombre.trim(),
                        rol: trabajadorForm.rol.trim() || 'Trabajador',
                        tarifa_dia: parseMiles(trabajadorForm.tarifa_dia),
                        recargo_festivo: 1.0,
                      }
                      if (trabajadorForm.id) {
                        await api.put(`/nomina/trabajadores/${trabajadorForm.id}`, payload)
                        flash('Trabajador actualizado ✓')
                      } else {
                        await api.post('/nomina/trabajadores', payload)
                        flash('Trabajador creado ✓')
                      }
                      setTrabajadorForm(null)
                      cargarTrabajadores()
                    } catch (e) {
                      flash('Error: ' + (e?.response?.data?.detail ?? e.message))
                    } finally {
                      setTrabajadorSaving(false)
                    }
                  }}
                >
                  {trabajadorSaving ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            </div>
          )}

          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Rol</th>
                  <th>Tarifa/día</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {trabajadores.map(t => {
                  return (
                    <tr key={t.id}>
                      <td>{t.nombre}</td>
                      <td className="td-categoria">{t.rol}</td>
                      <td className="td-precio">
                        {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(t.tarifa_dia)}
                      </td>
                      <td className="td-acciones">
                        <button
                          className="btn-edit"
                          title="Editar"
                          onClick={() => setTrabajadorForm({
                            ...t,
                            tarifa_dia: t.tarifa_dia ? formatMiles(String(t.tarifa_dia)) : '',
                          })}
                        >✏️</button>
                        <button
                          className="btn-edit"
                          title="Desactivar"
                          style={{ marginLeft: 4 }}
                          onClick={async () => {
                            await api.delete(`/nomina/trabajadores/${t.id}`)
                            flash('Trabajador desactivado ✓')
                            cargarTrabajadores()
                          }}
                        >🗑</button>
                      </td>
                    </tr>
                  )
                })}
                {trabajadores.length === 0 && (
                  <tr><td colSpan={4} style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>
                    Sin trabajadores registrados
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Tarjetas móvil — trabajadores */}
          <div className="admin-cards-movil">
            {trabajadores.map(t => (
              <div key={t.id} className="admin-card-item">
                <div className="admin-card-header">
                  <span className="admin-card-nombre">{t.nombre}</span>
                  <div className="admin-card-acciones">
                    <button className="btn-edit" title="Editar" onClick={() => setTrabajadorForm({ ...t, tarifa_dia: t.tarifa_dia ? formatMiles(String(t.tarifa_dia)) : '' })}>✏️</button>
                    <button className="btn-edit" title="Eliminar" onClick={async () => { await api.delete(`/nomina/trabajadores/${t.id}`); flash('Trabajador desactivado ✓'); cargarTrabajadores() }}>🗑</button>
                  </div>
                </div>
                <div className="admin-card-detalles">
                  <span className="admin-card-categoria">{t.rol}</span>
                  <span className="admin-card-precio">
                    {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(t.tarifa_dia)}/día
                  </span>
                </div>
              </div>
            ))}
            {trabajadores.length === 0 && (
              <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>
                Sin trabajadores registrados
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── USUARIOS ── */}
      {tab === 'usuarios' && (
        <div className="admin-section">
          <button
            className="btn-nuevo-producto"
            onClick={() => setUsuarioForm({ nombre: '', pin: '', pinConfirm: '', rol: 'cajero' })}
          >
            + Nuevo usuario
          </button>

          {usuarioForm !== null && (
            <div className="form-producto">
              <h3>{usuarioForm.id ? 'Editar usuario' : 'Nuevo usuario'}</h3>
              <div className="form-grid">
                <label className="form-label">
                  Nombre
                  <input
                    value={usuarioForm.nombre}
                    onChange={e => setUsuarioForm({ ...usuarioForm, nombre: e.target.value })}
                    placeholder="Nombre completo"
                  />
                </label>
                <label className="form-label">
                  PIN (4 dígitos)
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={usuarioForm.pin}
                    onChange={e => setUsuarioForm({ ...usuarioForm, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                    placeholder="••••"
                  />
                </label>
                <label className="form-label">
                  Confirmar PIN
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={usuarioForm.pinConfirm}
                    onChange={e => setUsuarioForm({ ...usuarioForm, pinConfirm: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                    placeholder="••••"
                  />
                </label>
                <label className="form-label">
                  Rol
                  <select
                    className="form-select"
                    value={usuarioForm.rol}
                    onChange={e => setUsuarioForm({ ...usuarioForm, rol: e.target.value })}
                  >
                    <option value="cajero">Cajero</option>
                    <option value="admin">Administrador</option>
                  </select>
                </label>
              </div>
              <div className="form-acciones">
                <button className="btn-form-cancel" onClick={() => setUsuarioForm(null)}>Cancelar</button>
                <button
                  className="btn-form-save"
                  disabled={usuarioSaving || !usuarioForm.nombre.trim() || usuarioForm.pin.length !== 4}
                  onClick={async () => {
                    if (!usuarioForm.id && usuarioForm.pin !== usuarioForm.pinConfirm) {
                      flash('Los PINs no coinciden')
                      return
                    }
                    setUsuarioSaving(true)
                    try {
                      if (usuarioForm.id) {
                        const payload = { nombre: usuarioForm.nombre.trim(), rol: usuarioForm.rol }
                        if (usuarioForm.pin) payload.pin = usuarioForm.pin
                        await api.put(`/usuarios/${usuarioForm.id}`, payload)
                        flash('Usuario actualizado ✓')
                      } else {
                        await api.post('/usuarios/', {
                          nombre: usuarioForm.nombre.trim(),
                          pin: usuarioForm.pin,
                          rol: usuarioForm.rol,
                        })
                        flash('Usuario creado ✓')
                      }
                      setUsuarioForm(null)
                      cargarUsuarios()
                    } catch (e) {
                      flash('Error: ' + (e?.response?.data?.detail ?? e.message))
                    } finally {
                      setUsuarioSaving(false)
                    }
                  }}
                >
                  {usuarioSaving ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            </div>
          )}

          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {usuariosLista.map(u => (
                  <tr key={u.id} className={u.activo ? '' : 'row-inactivo'}>
                    <td>{u.nombre}</td>
                    <td>
                      <span className={u.rol === 'admin' ? 'badge-rol-admin' : 'badge-rol-cajero'}>
                        {u.rol === 'admin' ? 'Admin' : 'Cajero'}
                      </span>
                    </td>
                    <td>
                      <button
                        className={`toggle-switch ${u.activo ? 'on' : 'off'}`}
                        title={u.activo ? 'Activo' : 'Inactivo'}
                        onClick={async () => {
                          try {
                            await api.put(`/usuarios/${u.id}`, { activo: u.activo ? 0 : 1 })
                            cargarUsuarios()
                          } catch (e) {
                            flash('Error: ' + (e?.response?.data?.detail ?? e.message))
                          }
                        }}
                      >
                        <span className="toggle-thumb" />
                      </button>
                    </td>
                    <td className="td-acciones">
                      <button
                        className="btn-edit"
                        title="Editar"
                        onClick={() => setUsuarioForm({ ...u, pin: '', pinConfirm: '' })}
                      >✏️</button>
                      <button
                        className="btn-edit"
                        title="Eliminar"
                        style={{ marginLeft: 4 }}
                        onClick={async () => {
                          try {
                            await api.delete(`/usuarios/${u.id}`)
                            flash('Usuario desactivado ✓')
                            cargarUsuarios()
                          } catch (e) {
                            flash('Error: ' + (e?.response?.data?.detail ?? e.message))
                          }
                        }}
                      >🗑</button>
                    </td>
                  </tr>
                ))}
                {usuariosLista.length === 0 && (
                  <tr><td colSpan={4} style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>
                    Sin usuarios registrados
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Tarjetas móvil — usuarios */}
          <div className="admin-cards-movil">
            {usuariosLista.map(u => (
              <div key={u.id} className={`admin-card-item${u.activo ? '' : ' card-inactivo'}`}>
                <div className="admin-card-header">
                  <span className="admin-card-nombre">{u.nombre}</span>
                  <div className="admin-card-acciones">
                    <button className="btn-edit" title="Editar" onClick={() => setUsuarioForm({ ...u, pin: '', pinConfirm: '' })}>✏️</button>
                    <button className="btn-edit" title="Eliminar" onClick={async () => {
                      try {
                        await api.delete(`/usuarios/${u.id}`)
                        flash('Usuario desactivado ✓')
                        cargarUsuarios()
                      } catch (e) {
                        flash('Error: ' + (e?.response?.data?.detail ?? e.message))
                      }
                    }}>🗑</button>
                  </div>
                </div>
                <div className="admin-card-detalles">
                  <span className={u.rol === 'admin' ? 'badge-rol-admin' : 'badge-rol-cajero'}>
                    {u.rol === 'admin' ? 'Admin' : 'Cajero'}
                  </span>
                  <span style={{ color: u.activo ? '#4ade80' : 'var(--text-muted)', fontSize: 11 }}>
                    {u.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Dispositivos conectados */}
          <div className="usuarios-sesiones">
            <div className="usuarios-sesiones-header">
              <h3>Dispositivos conectados</h3>
              <button className="btn-config-save" onClick={cargarSesionesActivas}>Actualizar</button>
            </div>
            {sesionesActivas.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Sin sesiones activas</p>
            ) : (
              sesionesActivas.map(s => (
                <div key={s.sesion_id} className="sesion-card">
                  <div className="sesion-info">
                    <span className={s.rol === 'admin' ? 'badge-rol-admin' : 'badge-rol-cajero'}>
                      {s.rol === 'admin' ? 'Admin' : 'Cajero'}
                    </span>
                    <span className="sesion-nombre">{s.nombre}</span>
                    <span className="sesion-tiempo">{tiempoRelativo(s.last_seen)}</span>
                  </div>
                  <button
                    className="btn-cerrar-sesion"
                    onClick={async () => {
                      try {
                        await api.delete(`/usuarios/sesiones/${s.sesion_id}`)
                        cargarSesionesActivas()
                        flash('Sesión cerrada ✓')
                      } catch (e) {
                        flash('Error: ' + (e?.response?.data?.detail ?? e.message))
                      }
                    }}
                  >
                    Cerrar sesión
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── CONFIGURACIÓN ── */}
      {tab === 'config' && (
        <div className="admin-section">
          <ConfigField label="Nombre del restaurante"       valor={config.nombre_restaurante ?? ''} onGuardar={(v) => guardarConfig('nombre_restaurante', v)} />
          <ConfigField label="Número Nequi"                 valor={config.nequi_numero ?? ''}       onGuardar={(v) => guardarConfig('nequi_numero', v)} />
          <ConfigField label="PIN administrador (4 dígitos)" valor={config.pin_admin ?? ''}         tipo="password" onGuardar={(v) => guardarConfig('pin_admin', v)} />
          <ConfigField label="PIN cajero (4 dígitos) — compartido entre todos los cajeros" valor={config.pin_cajero ?? ''} tipo="password" onGuardar={(v) => guardarConfig('pin_cajero', v)} />
          <ConfigField label="Mensaje domicilio"            valor={config.domicilio_mensaje ?? ''}  onGuardar={(v) => guardarConfig('domicilio_mensaje', v)} />
          <ConfigField label="Número de mesas (1-20)"       valor={config.num_mesas ?? '8'}         tipo="number"   onGuardar={(v) => guardarConfig('num_mesas', v)} />
        </div>
      )}
    </div>
  )
}

function ConfigField({ label, valor, tipo = 'text', onGuardar }) {
  const [val, setVal] = useState(valor)
  useEffect(() => setVal(valor), [valor])
  return (
    <div className="config-field">
      <label className="config-label">{label}</label>
      <div className="config-input-row">
        <input type={tipo} value={val} onChange={(e) => setVal(e.target.value)} />
        <button className="btn-config-save" onClick={() => onGuardar(val)}>Guardar</button>
      </div>
    </div>
  )
}

export default function Admin() {
  return <AdminContenido />
}
