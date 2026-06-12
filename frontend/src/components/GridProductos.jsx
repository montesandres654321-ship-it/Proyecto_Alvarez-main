import ProductCard from './ProductCard'
import './GridProductos.css'

const CATS_PRECIO_ESPECIAL = ['PICADAS', 'DESGRANADOS', 'SALCHIPAPAS']

export default function GridProductos({ productos, onAgregar, categoriaActiva, onPrecioEspecial }) {
  if (!productos.length && !CATS_PRECIO_ESPECIAL.includes(categoriaActiva)) {
    return (
      <div className="product-empty">
        <span>Sin productos en esta categoría</span>
      </div>
    )
  }
  return (
    <div className="product-grid">
      {productos.map((p) => (
        <ProductCard key={p.id} producto={p} onAgregar={onAgregar} />
      ))}

      {CATS_PRECIO_ESPECIAL.includes(categoriaActiva) && (
        <div
          className="product-card precio-especial"
          onClick={onPrecioEspecial}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && onPrecioEspecial?.()}
        >
          <div className="product-img">✏️</div>
          <div className="product-name">Precio especial</div>
          <div className="product-price">ingresar valor</div>
        </div>
      )}
    </div>
  )
}
