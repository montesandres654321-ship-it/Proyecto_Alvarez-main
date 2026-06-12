import { formatCOP } from '../api/client'
import { getProductEmoji } from '../utils/productEmojis'
import './ProductCard.css'

export default function ProductCard({ producto, onAgregar }) {
  const isCustom = producto.nombre.toLowerCase().includes('personaliz')

  return (
    <button
      className={`product-card${isCustom ? ' custom' : ''}`}
      onClick={() => onAgregar(producto)}
      title={producto.ingredientes || producto.nombre}
    >
      <div className="product-img">
        {getProductEmoji(producto.nombre, producto.categoria)}
      </div>
      <span className="product-name">{producto.nombre}</span>
      <span className="product-price">
        {isCustom ? 'Precio libre' : formatCOP(producto.precio)}
      </span>
    </button>
  )
}
