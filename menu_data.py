"""Catálogo maestro del menú Alvarez Fast Food — Copa Mundial 2026."""

from config import PRECIO_GASEOSA_FAMILIAR, PRECIO_GASEOSA_PERSONAL, PRECIO_GASEOSA_MINI
from modelos import Producto

MENU: list[Producto] = [
  # PICADAS
  Producto(
    id="pic-cerdo",
    categoria="PICADAS",
    nombre="Picada de Cerdo",
    precio=14000,
    ingredientes="Papa a la francesa, queso costeño, lechuga, papa ripio, salsa de la casa",
  ),
  Producto(
    id="pic-pollo",
    categoria="PICADAS",
    nombre="Picada de Pollo",
    precio=13000,
    ingredientes="Papa a la francesa, queso costeño, lechuga, papa ripio, salsa de la casa",
  ),
  Producto(
    id="pic-suiza",
    categoria="PICADAS",
    nombre="Picada Suiza",
    precio=13000,
    ingredientes="Papa a la francesa, queso costeño, lechuga, papa ripio, salsa de la casa",
  ),
  Producto(
    id="pic-alvarera",
    categoria="PICADAS",
    nombre="Picada Alvarera (5)",
    precio=45000,
    ingredientes="Papa a la francesa, queso costeño, lechuga, papa ripio, salsa de la casa",
  ),
  # DESGRANADOS
  Producto(
    id="des-cerdo",
    categoria="DESGRANADOS",
    nombre="Desgranado de Cerdo",
    precio=17000,
    ingredientes="Papa a la francesa, queso mozzarella, lechuga, papa ripio, maíz tierno, salsa de la casa",
  ),
  Producto(
    id="des-pollo",
    categoria="DESGRANADOS",
    nombre="Desgranado de Pollo",
    precio=16000,
    ingredientes="Papa a la francesa, queso mozzarella, lechuga, papa ripio, maíz tierno, salsa de la casa",
  ),
  Producto(
    id="des-suizo",
    categoria="DESGRANADOS",
    nombre="Desgranado Suizo",
    precio=16000,
    ingredientes="Papa a la francesa, queso mozzarella, lechuga, papa ripio, maíz tierno, salsa de la casa",
  ),
  Producto(
    id="des-angelical",
    categoria="DESGRANADOS",
    nombre="Desgranado Angelical (3)",
    precio=35000,
    ingredientes="Papa a la francesa, queso mozzarella, lechuga, papa ripio, maíz tierno, salsa de la casa",
  ),
  # SALCHIPAPAS
  Producto(
    id="sal-sencilla",
    categoria="SALCHIPAPAS",
    nombre="Salchipapa Sencilla",
    precio=10000,
    ingredientes="Papa a la francesa, queso costeño, lechuga, papa ripio, salsa de la casa",
  ),
  Producto(
    id="cho-sencilla",
    categoria="SALCHIPAPAS",
    nombre="Choripapa Sencilla",
    precio=12000,
    ingredientes="Papa a la francesa, queso costeño, lechuga, papa ripio, salsa de la casa",
  ),
  # PERROS CALIENTES (bebidas se piden aparte en GASEOSAS)
  Producto(
    id="perro-sencillo",
    categoria="PERROS CALIENTES",
    nombre="Perro Sencillo",
    precio=6000,
    ingredientes="Pan fresco, salchicha cunit, lechuga, papa ripio, queso mozzarella",
  ),
  Producto(
    id="choriperro",
    categoria="PERROS CALIENTES",
    nombre="Choriperro",
    precio=8000,
    ingredientes="Pan fresco, salchicha cunit, lechuga, papa ripio, queso mozzarella",
  ),
  # HAMBURGUESAS
  Producto(
    id="ham-sencilla",
    categoria="HAMBURGUESAS",
    nombre="Hamburguesa Sencilla",
    precio=8000,
    ingredientes="Pan fresco, carne de res, lechuga, tomate, queso mozzarella, papa ripio",
  ),
  Producto(
    id="ham-doble",
    categoria="HAMBURGUESAS",
    nombre="Hamburguesa Doble",
    precio=13000,
    ingredientes="Pan fresco, carne de res, lechuga, tomate, queso mozzarella, papa ripio",
  ),
  Producto(
    id="ham-papas",
    categoria="HAMBURGUESAS",
    nombre="Hamburguesa + Papas",
    precio=15000,
    ingredientes="Pan fresco, carne de res, lechuga, tomate, queso mozzarella, papa ripio",
  ),
  # GASEOSAS (por aparte)
  Producto(
    id="gas-mini",
    categoria="GASEOSAS",
    nombre="Gaseosa Mini",
    precio=PRECIO_GASEOSA_MINI,
    ingredientes="Gaseosa mini bien fría",
  ),
  Producto(
    id="gas-personal",
    categoria="GASEOSAS",
    nombre="Gaseosa Personal",
    precio=PRECIO_GASEOSA_PERSONAL,
    ingredientes="Gaseosa personal bien fría",
  ),
  Producto(
    id="gas-familiar",
    categoria="GASEOSAS",
    nombre="Gaseosa Familiar",
    precio=PRECIO_GASEOSA_FAMILIAR,
    ingredientes="Gaseosa familiar",
  ),
]


def menu_por_id() -> dict[str, Producto]:
  return {p.id: p for p in MENU}


def categorias_ordenadas() -> list[str]:
  visto: list[str] = []
  for p in MENU:
    if p.categoria not in visto:
      visto.append(p.categoria)
  return visto
