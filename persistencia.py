"""Persistencia en PostgreSQL (Supabase)."""

from __future__ import annotations

import json
import re
import time as _time
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Any, Iterator

import psycopg2
import psycopg2.extras

from config import (
  DATA_DIR,
  DATABASE_URL,
  PG_HOST,
  PG_PORT,
  PG_USER,
  PG_PASSWORD,
  PG_DATABASE,
  NEQUI_NUMERO,
  PREFIJO_FACTURA,
)
from modelos import Factura, Producto


class ErrorBaseDatos(Exception):
  """Error de conexión o consulta de base de datos."""


def _get_connection() -> "psycopg2.connection":
  """Abre una conexión psycopg2 con RealDictCursor como cursor por defecto."""
  kwargs: dict[str, Any] = {
    "cursor_factory": psycopg2.extras.RealDictCursor,
    "connect_timeout": 10,
  }
  if DATABASE_URL:
    kwargs["dsn"] = DATABASE_URL
  else:
    kwargs.update({
      "host": PG_HOST,
      "port": PG_PORT,
      "user": PG_USER,
      "password": PG_PASSWORD,
      "dbname": PG_DATABASE,
    })
  return psycopg2.connect(**kwargs)


@contextmanager
def conexion() -> Iterator["psycopg2.connection"]:
  try:
    conn = _get_connection()
  except psycopg2.Error as e:
    raise ErrorBaseDatos(
      f"No se pudo conectar a PostgreSQL ({PG_HOST}:{PG_PORT}).\n"
      f"Detalle: {e}"
    ) from e
  conn.autocommit = False
  try:
    yield conn
    conn.commit()
  except Exception:
    conn.rollback()
    raise
  finally:
    conn.close()


def _crear_base_y_tablas() -> None:
  with conexion() as conn:
    with conn.cursor() as cur:
      cur.execute(
        """
        CREATE TABLE IF NOT EXISTS contador_facturas (
          anio          INT NOT NULL PRIMARY KEY,
          ultimo_numero INT NOT NULL DEFAULT 0
        )
        """
      )
      cur.execute(
        """
        CREATE TABLE IF NOT EXISTS ventas (
          id_factura       VARCHAR(24)  NOT NULL PRIMARY KEY,
          fecha_hora       VARCHAR(32)  NOT NULL,
          metodo_pago      VARCHAR(20)  NOT NULL,
          tipo_entrega     VARCHAR(20)  NOT NULL,
          telefono_cliente VARCHAR(20)  DEFAULT NULL,
          total_pagar      INT          NOT NULL,
          turno_id         INT          DEFAULT NULL,
          monto_recibido   INT          NOT NULL DEFAULT 0,
          vuelto_dado      INT          NOT NULL DEFAULT 0,
          anulada          SMALLINT     NOT NULL DEFAULT 0,
          motivo_anulacion VARCHAR(200) DEFAULT NULL
        )
        """
      )
      cur.execute("CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON ventas(fecha_hora)")
      cur.execute("CREATE INDEX IF NOT EXISTS idx_ventas_pago  ON ventas(metodo_pago)")
      cur.execute(
        """
        CREATE TABLE IF NOT EXISTS lineas_venta (
          id                 SERIAL      PRIMARY KEY,
          id_factura         VARCHAR(24) NOT NULL,
          producto_id        VARCHAR(64) NOT NULL,
          producto_nombre    VARCHAR(255) NOT NULL,
          cantidad           INT         NOT NULL,
          precio_unitario    INT         NOT NULL,
          notas_modificacion TEXT,
          es_bebida_incluida SMALLINT    NOT NULL DEFAULT 0,
          es_personalizado   SMALLINT    NOT NULL DEFAULT 0,
          categoria          VARCHAR(64) DEFAULT '',
          CONSTRAINT fk_lineas_venta_factura
            FOREIGN KEY (id_factura) REFERENCES ventas(id_factura)
            ON DELETE CASCADE
        )
        """
      )
      cur.execute("CREATE INDEX IF NOT EXISTS idx_lineas_factura ON lineas_venta(id_factura)")
      cur.execute(
        """
        CREATE TABLE IF NOT EXISTS productos (
          id           SERIAL       PRIMARY KEY,
          producto_id  VARCHAR(30)  NOT NULL UNIQUE,
          nombre       VARCHAR(100) NOT NULL,
          precio       INT          NOT NULL,
          categoria    VARCHAR(50)  NOT NULL,
          ingredientes TEXT         DEFAULT NULL,
          activo       SMALLINT     NOT NULL DEFAULT 1,
          orden        INT          NOT NULL DEFAULT 0,
          cat_orden    INT          NOT NULL DEFAULT 0,
          created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """
      )
      cur.execute("CREATE INDEX IF NOT EXISTS idx_cat_activo ON productos(categoria, activo)")
      cur.execute(
        """
        CREATE TABLE IF NOT EXISTS configuracion (
          clave       VARCHAR(50)  NOT NULL PRIMARY KEY,
          valor       VARCHAR(255) NOT NULL,
          descripcion VARCHAR(200) DEFAULT NULL
        )
        """
      )
      cur.execute(
        """
        INSERT INTO configuracion (clave, valor, descripcion) VALUES
          ('nequi_numero',       %s, 'Número de cuenta Nequi para cobros'),
          ('nombre_restaurante', %s, 'Nombre del restaurante'),
          ('prefijo_factura',    %s, 'Prefijo base de facturas (el año se añade automáticamente)'),
          ('pin_admin',          %s, 'PIN de 4 dígitos para acceder a reportes y configuración'),
          ('domicilio_mensaje',  %s, 'Mensaje en el ticket del cliente'),
          ('num_mesas',          %s, 'Cantidad de mesas del restaurante'),
          ('pin_cajero',         %s, 'PIN de acceso cajeros')
        ON CONFLICT (clave) DO NOTHING
        """,
        (
          NEQUI_NUMERO,
          "Alvarez Fast Food",
          "FAC",
          "1234",
          "Domicilio sin costo adicional",
          "8",
          "0000",
        ),
      )
      cur.execute(
        """
        CREATE TABLE IF NOT EXISTS turnos (
          id                SERIAL      PRIMARY KEY,
          cajero            VARCHAR(100) NOT NULL DEFAULT 'Cajero',
          fecha_apertura    TIMESTAMP   NOT NULL,
          efectivo_inicial  INT         NOT NULL DEFAULT 0,
          fecha_cierre      TIMESTAMP   DEFAULT NULL,
          total_ventas      INT         NOT NULL DEFAULT 0,
          total_vueltos     INT         NOT NULL DEFAULT 0,
          efectivo_esperado INT         NOT NULL DEFAULT 0,
          anulado           SMALLINT    NOT NULL DEFAULT 0,
          estado            VARCHAR(10) NOT NULL DEFAULT 'abierto'
            CHECK (estado IN ('abierto', 'cerrado'))
        )
        """
      )
      cur.execute("CREATE INDEX IF NOT EXISTS idx_turnos_estado ON turnos(estado)")
      cur.execute("CREATE INDEX IF NOT EXISTS idx_turnos_fecha  ON turnos(fecha_apertura)")
      anio = datetime.now().year
      cur.execute(
        "INSERT INTO contador_facturas (anio, ultimo_numero) VALUES (%s, 0) ON CONFLICT DO NOTHING",
        (anio,),
      )
      cur.execute(
        """
        CREATE TABLE IF NOT EXISTS preparaciones (
          id        SERIAL      PRIMARY KEY,
          categoria VARCHAR(50)  NOT NULL,
          opcion    VARCHAR(100) NOT NULL,
          orden     INT          NOT NULL DEFAULT 0,
          activo    SMALLINT     NOT NULL DEFAULT 1,
          UNIQUE (categoria, opcion)
        )
        """
      )
      cur.execute(
        """
        INSERT INTO preparaciones (categoria, opcion, orden) VALUES
          ('PICADAS', 'Con todo', 1),
          ('PICADAS', 'Sin verduras', 2),
          ('PICADAS', 'Sin salsa', 3),
          ('PICADAS', 'Con poca salsa', 4),
          ('DESGRANADOS', 'Con todo', 1),
          ('DESGRANADOS', 'Sin verduras', 2),
          ('DESGRANADOS', 'Sin salsa', 3),
          ('DESGRANADOS', 'Con poca salsa', 4),
          ('SALCHIPAPAS', 'Con todo', 1),
          ('SALCHIPAPAS', 'Sin salsa', 2),
          ('SALCHIPAPAS', 'Con poca salsa', 3),
          ('SALCHIPAPAS', 'Solo papas', 4),
          ('PERROS CALIENTES', 'Con todo', 1),
          ('PERROS CALIENTES', 'Sin verduras', 2),
          ('PERROS CALIENTES', 'Sin salsa', 3),
          ('HAMBURGUESAS', 'Con todo', 1),
          ('HAMBURGUESAS', 'Sin verduras', 2),
          ('HAMBURGUESAS', 'Sin queso', 3)
        ON CONFLICT (categoria, opcion) DO NOTHING
        """
      )
      cur.execute(
        """
        CREATE TABLE IF NOT EXISTS insumos_catalogo (
          id         SERIAL       PRIMARY KEY,
          nombre     VARCHAR(100) NOT NULL,
          unidad     VARCHAR(20)  NOT NULL DEFAULT 'und',
          precio_ref INT          DEFAULT 0,
          activo     SMALLINT     DEFAULT 1,
          orden      INT          DEFAULT 0
        )
        """
      )
      cur.execute(
        """
        CREATE TABLE IF NOT EXISTS compras (
          id         SERIAL  PRIMARY KEY,
          fecha      DATE    NOT NULL,
          fecha_hora TIMESTAMP DEFAULT NOW(),
          total      INT     NOT NULL DEFAULT 0,
          notas      VARCHAR(200)
        )
        """
      )
      cur.execute(
        """
        CREATE TABLE IF NOT EXISTS compras_detalle (
          id             SERIAL        PRIMARY KEY,
          compra_id      INT           NOT NULL,
          nombre_insumo  VARCHAR(100)  NOT NULL,
          cantidad       DECIMAL(10,2) NOT NULL,
          unidad         VARCHAR(20)   NOT NULL,
          valor_unitario INT           NOT NULL,
          subtotal       INT           NOT NULL,
          FOREIGN KEY (compra_id) REFERENCES compras(id)
        )
        """
      )
      cur.execute(
        """
        CREATE TABLE IF NOT EXISTS trabajadores (
          id              SERIAL       PRIMARY KEY,
          nombre          VARCHAR(100) NOT NULL,
          rol             VARCHAR(50)  DEFAULT 'Trabajador',
          tarifa_dia      INT          NOT NULL DEFAULT 0,
          recargo_festivo DECIMAL(3,1) DEFAULT 1.0,
          activo          SMALLINT     DEFAULT 1,
          orden           INT          DEFAULT 0,
          created_at      TIMESTAMP    DEFAULT NOW()
        )
        """
      )
      cur.execute(
        """
        CREATE TABLE IF NOT EXISTS nomina_semana (
          id           SERIAL  PRIMARY KEY,
          fecha_inicio DATE    NOT NULL,
          fecha_fin    DATE    NOT NULL,
          total        INT     NOT NULL DEFAULT 0,
          estado       VARCHAR(10) DEFAULT 'borrador'
            CHECK (estado IN ('borrador', 'pagada')),
          fecha_pago   TIMESTAMP,
          notas        VARCHAR(200)
        )
        """
      )
      cur.execute(
        """
        CREATE TABLE IF NOT EXISTS nomina_detalle (
          id                SERIAL       PRIMARY KEY,
          nomina_id         INT          NOT NULL,
          trabajador_id     INT          NOT NULL,
          nombre_trabajador VARCHAR(100) NOT NULL,
          rol               VARCHAR(50),
          tarifa_dia        INT          NOT NULL,
          recargo_festivo   DECIMAL(3,1) DEFAULT 1.0,
          trabajo_sabado    SMALLINT     DEFAULT 0,
          trabajo_domingo   SMALLINT     DEFAULT 0,
          trabajo_lunes     SMALLINT     DEFAULT 0,
          dias_normales     INT          DEFAULT 0,
          dias_festivos     INT          DEFAULT 0,
          total_trabajador  INT          NOT NULL DEFAULT 0,
          FOREIGN KEY (nomina_id)     REFERENCES nomina_semana(id),
          FOREIGN KEY (trabajador_id) REFERENCES trabajadores(id)
        )
        """
      )


def _prefijo_año_actual() -> str:
  """Prefijo de factura calculado en el momento de la llamada (no en importación)."""
  return f"FAC-{datetime.now().year}"


def _ultimo_numero_en_ventas(cur: Any) -> int:
  """Mayor número FAC-YYYY-NNNN ya guardado en ventas para el año actual."""
  prefijo = f"{_prefijo_año_actual()}-"
  cur.execute(
    """
    SELECT id_factura FROM ventas
    WHERE id_factura LIKE %s
    ORDER BY LENGTH(id_factura) DESC, id_factura DESC
    LIMIT 1
    """,
    (f"{prefijo}%",),
  )
  fila = cur.fetchone()
  if not fila:
    return 0
  sufijo = str(fila["id_factura"])[len(prefijo) :]
  try:
    return int(sufijo)
  except ValueError:
    return 0


def sincronizar_contador_facturas() -> int:
  """
  Alinea el contador con las facturas ya existentes.
  Útil tras migrar datos o si hubo error de duplicado.
  Devuelve el último número en uso.
  """
  anio = datetime.now().year
  with conexion() as conn:
    with conn.cursor() as cur:
      max_ventas = _ultimo_numero_en_ventas(cur)
      cur.execute(
        "SELECT ultimo_numero FROM contador_facturas WHERE anio = %s",
        (anio,),
      )
      fila = cur.fetchone()
      if fila is None:
        cur.execute(
          "INSERT INTO contador_facturas (anio, ultimo_numero) VALUES (%s, %s)",
          (anio, max_ventas),
        )
      else:
        actual = int(fila["ultimo_numero"])
        nuevo = max(actual, max_ventas)
        cur.execute(
          "UPDATE contador_facturas SET ultimo_numero = %s WHERE anio = %s",
          (nuevo, anio),
        )
      return max_ventas
  return 0


def _seed_productos() -> None:
  """Inserta los 18 productos del menú original si aún no existen (INSERT IGNORE)."""
  semilla = [
    # (producto_id, nombre, precio, categoria, ingredientes, orden, cat_orden)
    ("pic-cerdo",     "Picada de Cerdo",          14000, "PICADAS",          "Papa a la francesa, queso costeno, lechuga, papa ripio, salsa de la casa",                   0, 1),
    ("pic-pollo",     "Picada de Pollo",           13000, "PICADAS",          "Papa a la francesa, queso costeno, lechuga, papa ripio, salsa de la casa",                   1, 1),
    ("pic-suiza",     "Picada Suiza",              13000, "PICADAS",          "Papa a la francesa, queso costeno, lechuga, papa ripio, salsa de la casa",                   2, 1),
    ("pic-alvarera",  "Picada Alvarera (5)",       45000, "PICADAS",          "Papa a la francesa, queso costeno, lechuga, papa ripio, salsa de la casa",                   3, 1),
    ("des-cerdo",     "Desgranado de Cerdo",       17000, "DESGRANADOS",      "Papa a la francesa, queso mozzarella, lechuga, papa ripio, maiz tierno, salsa de la casa",  0, 2),
    ("des-pollo",     "Desgranado de Pollo",       16000, "DESGRANADOS",      "Papa a la francesa, queso mozzarella, lechuga, papa ripio, maiz tierno, salsa de la casa",  1, 2),
    ("des-suizo",     "Desgranado Suizo",          16000, "DESGRANADOS",      "Papa a la francesa, queso mozzarella, lechuga, papa ripio, maiz tierno, salsa de la casa",  2, 2),
    ("des-angelical", "Desgranado Angelical (3)",  35000, "DESGRANADOS",      "Papa a la francesa, queso mozzarella, lechuga, papa ripio, maiz tierno, salsa de la casa",  3, 2),
    ("sal-sencilla",  "Salchipapa Sencilla",       10000, "SALCHIPAPAS",      "Papa a la francesa, queso costeno, lechuga, papa ripio, salsa de la casa",                   0, 3),
    ("cho-sencilla",  "Choripapa Sencilla",        12000, "SALCHIPAPAS",      "Papa a la francesa, queso costeno, lechuga, papa ripio, salsa de la casa",                   1, 3),
    ("perro-sencillo","Perro Sencillo",             6000, "PERROS CALIENTES", "Pan fresco, salchicha cunit, lechuga, papa ripio, queso mozzarella",                         0, 4),
    ("choriperro",    "Choriperro",                 8000, "PERROS CALIENTES", "Pan fresco, salchicha cunit, lechuga, papa ripio, queso mozzarella",                         1, 4),
    ("ham-sencilla",  "Hamburguesa Sencilla",       8000, "HAMBURGUESAS",     "Pan fresco, carne de res, lechuga, tomate, queso mozzarella, papa ripio",                    0, 5),
    ("ham-doble",     "Hamburguesa Doble",         13000, "HAMBURGUESAS",     "Pan fresco, carne de res, lechuga, tomate, queso mozzarella, papa ripio",                    1, 5),
    ("ham-papas",     "Hamburguesa + Papas",       15000, "HAMBURGUESAS",     "Pan fresco, carne de res, lechuga, tomate, queso mozzarella, papa ripio",                    2, 5),
    ("gas-mini",      "Gaseosa Mini",               1000, "GASEOSAS",         "Gaseosa mini bien fria",                                                                      0, 6),
    ("gas-personal",  "Gaseosa Personal",           2000, "GASEOSAS",         "Gaseosa personal bien fria",                                                                  1, 6),
    ("gas-familiar",  "Gaseosa Familiar",           5000, "GASEOSAS",         "Gaseosa familiar",                                                                            2, 6),
  ]
  with conexion() as conn:
    with conn.cursor() as cur:
      for fila in semilla:
        cur.execute(
          """
          INSERT INTO productos
            (producto_id, nombre, precio, categoria, ingredientes, activo, orden, cat_orden)
          VALUES (%s, %s, %s, %s, %s, 1, %s, %s)
          ON CONFLICT (producto_id) DO NOTHING
          """,
          fila,
        )


def get_config(clave: str, default: str = "") -> str:
  """Lee un valor de la tabla configuracion. Devuelve `default` si no existe o hay error de BD."""
  try:
    with conexion() as conn:
      with conn.cursor() as cur:
        cur.execute("SELECT valor FROM configuracion WHERE clave = %s", (clave,))
        fila = cur.fetchone()
        return str(fila["valor"]) if fila else default
  except (ErrorBaseDatos, psycopg2.Error):
    return default


def set_config(clave: str, valor: str) -> None:
  """Guarda o actualiza un valor en la tabla configuracion."""
  with conexion() as conn:
    with conn.cursor() as cur:
      cur.execute(
        """
        INSERT INTO configuracion (clave, valor)
        VALUES (%s, %s)
        ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor
        """,
        (clave, valor),
      )


def _migraciones() -> None:
  """Aplica migraciones de esquema idempotentes para bases existentes."""
  _alter = [
    ("ventas",  "turno_id",         "ALTER TABLE ventas ADD COLUMN turno_id INT DEFAULT NULL"),
    ("ventas",  "monto_recibido",   "ALTER TABLE ventas ADD COLUMN monto_recibido INT NOT NULL DEFAULT 0"),
    ("ventas",  "vuelto_dado",      "ALTER TABLE ventas ADD COLUMN vuelto_dado INT NOT NULL DEFAULT 0"),
    ("ventas",  "anulada",          "ALTER TABLE ventas ADD COLUMN anulada SMALLINT NOT NULL DEFAULT 0"),
    ("ventas",  "motivo_anulacion", "ALTER TABLE ventas ADD COLUMN motivo_anulacion VARCHAR(200) DEFAULT NULL"),
    ("turnos",  "anulado",          "ALTER TABLE turnos ADD COLUMN anulado SMALLINT NOT NULL DEFAULT 0"),
    ("turnos",  "total_vueltos",    "ALTER TABLE turnos ADD COLUMN total_vueltos INT NOT NULL DEFAULT 0"),
    ("turnos",  "efectivo_esperado","ALTER TABLE turnos ADD COLUMN efectivo_esperado INT NOT NULL DEFAULT 0"),
  ]
  with conexion() as conn:
    with conn.cursor() as cur:
      for tabla, columna, sql in _alter:
        cur.execute(
          """
          SELECT column_name FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = %s AND column_name = %s
          """,
          (tabla, columna),
        )
        if not cur.fetchone():
          cur.execute(sql)


def inicializar_bd() -> None:
  _crear_base_y_tablas()
  try:
    sincronizar_contador_facturas()
  except (psycopg2.Error, ErrorBaseDatos):
    pass
  try:
    _seed_productos()
  except (psycopg2.Error, ErrorBaseDatos):
    pass
  try:
    _migraciones()
  except (psycopg2.Error, ErrorBaseDatos):
    pass


# ---------------------------------------------------------------------------
# CRUD de productos
# ---------------------------------------------------------------------------

def listar_productos(
  categoria: str | None = None,
  solo_activos: bool = True,
) -> list[Producto]:
  """Devuelve productos desde BD ordenados por cat_orden, orden, nombre."""
  condiciones: list[str] = []
  params: list[Any] = []
  if solo_activos:
    condiciones.append("activo = 1")
  if categoria:
    condiciones.append("categoria = %s")
    params.append(categoria)
  where = f"WHERE {' AND '.join(condiciones)}" if condiciones else ""
  sql = f"""
    SELECT producto_id, nombre, precio, categoria, ingredientes, activo
    FROM productos
    {where}
    ORDER BY cat_orden, orden, nombre
  """
  with conexion() as conn:
    with conn.cursor() as cur:
      cur.execute(sql, params)
      filas = cur.fetchall()
  return [
    Producto(
      id=f["producto_id"],
      categoria=f["categoria"],
      nombre=f["nombre"],
      precio=int(f["precio"]),
      ingredientes=f["ingredientes"] or "",
      activo=bool(f["activo"]),
    )
    for f in filas
  ]


def obtener_producto_por_id(producto_id: str) -> Producto | None:
  """Devuelve un Producto por su producto_id, o None si no existe."""
  with conexion() as conn:
    with conn.cursor() as cur:
      cur.execute(
        """
        SELECT producto_id, nombre, precio, categoria, ingredientes, activo
        FROM productos
        WHERE producto_id = %s
        """,
        (producto_id,),
      )
      f = cur.fetchone()
  if f is None:
    return None
  return Producto(
    id=f["producto_id"],
    categoria=f["categoria"],
    nombre=f["nombre"],
    precio=int(f["precio"]),
    ingredientes=f["ingredientes"] or "",
    activo=bool(f["activo"]),
  )


def desactivar_producto(producto_id: str) -> None:
  """Desactiva un producto (activo = 0). No lo elimina de la BD."""
  with conexion() as conn:
    with conn.cursor() as cur:
      cur.execute(
        "UPDATE productos SET activo = 0 WHERE producto_id = %s",
        (producto_id,),
      )


def categorias_activas() -> list[str]:
  """Categorías con al menos un producto activo, en orden de display (cat_orden)."""
  with conexion() as conn:
    with conn.cursor() as cur:
      cur.execute(
        """
        SELECT categoria
        FROM productos
        WHERE activo = 1
        GROUP BY categoria
        ORDER BY MIN(cat_orden), categoria
        """
      )
      filas = cur.fetchall()
  return [f["categoria"] for f in filas]


def crear_producto(
  nombre: str,
  precio: int,
  categoria: str,
  ingredientes: str = "",
  orden: int = 0,
) -> str:
  """Crea un producto nuevo. Devuelve el producto_id generado."""
  slug = re.sub(r"[^a-z0-9]+", "-", nombre.lower())[:15].strip("-")
  producto_id = f"{slug}-{int(_time.time()) % 100000}"

  with conexion() as conn:
    with conn.cursor() as cur:
      cur.execute(
        "SELECT MIN(cat_orden) AS co FROM productos WHERE categoria = %s",
        (categoria,),
      )
      fila = cur.fetchone()
      cat_orden = int(fila["co"]) if fila and fila["co"] is not None else 99
      cur.execute(
        """
        INSERT INTO productos
          (producto_id, nombre, precio, categoria, ingredientes, activo, orden, cat_orden)
        VALUES (%s, %s, %s, %s, %s, 1, %s, %s)
        """,
        (producto_id, nombre.strip(), precio, categoria.strip(),
         ingredientes.strip(), orden, cat_orden),
      )
  return producto_id


def actualizar_producto(
  producto_id: str,
  nombre: str,
  precio: int,
  categoria: str,
  ingredientes: str = "",
) -> None:
  """Actualiza nombre, precio, categoría e ingredientes de un producto."""
  with conexion() as conn:
    with conn.cursor() as cur:
      cur.execute(
        """
        UPDATE productos
        SET nombre = %s, precio = %s, categoria = %s, ingredientes = %s
        WHERE producto_id = %s
        """,
        (nombre.strip(), precio, categoria.strip(),
         ingredientes.strip(), producto_id),
      )


def toggle_activo_producto(producto_id: str) -> bool:
  """Activa o desactiva un producto. Devuelve el nuevo estado (True = activo)."""
  with conexion() as conn:
    with conn.cursor() as cur:
      cur.execute(
        "SELECT activo FROM productos WHERE producto_id = %s", (producto_id,)
      )
      fila = cur.fetchone()
      if fila is None:
        raise ErrorBaseDatos(f"Producto '{producto_id}' no encontrado")
      nuevo = 0 if int(fila["activo"]) else 1
      cur.execute(
        "UPDATE productos SET activo = %s WHERE producto_id = %s",
        (nuevo, producto_id),
      )
  return bool(nuevo)


def siguiente_id_factura() -> str:
  anio = datetime.now().year
  prefijo = _prefijo_año_actual()
  with conexion() as conn:
    with conn.cursor() as cur:
      cur.execute(
        "SELECT ultimo_numero FROM contador_facturas WHERE anio = %s FOR UPDATE",
        (anio,),
      )
      fila = cur.fetchone()
      max_ventas = _ultimo_numero_en_ventas(cur)

      if fila is None:
        cur.execute(
          "INSERT INTO contador_facturas (anio, ultimo_numero) VALUES (%s, 0)",
          (anio,),
        )
        ultimo_contador = 0
      else:
        ultimo_contador = int(fila["ultimo_numero"])

      numero = max(ultimo_contador, max_ventas) + 1

      cur.execute(
        """
        INSERT INTO contador_facturas (anio, ultimo_numero) VALUES (%s, %s)
        ON CONFLICT (anio) DO UPDATE SET ultimo_numero = EXCLUDED.ultimo_numero
        """,
        (anio, numero),
      )
  return f"{prefijo}-{numero:04d}"


def guardar_factura(factura: Factura) -> None:
  fh = factura.fecha_hora.replace("T", " ")[:32]
  with conexion() as conn:
    with conn.cursor() as cur:
      cur.execute(
        """
        INSERT INTO ventas (
          id_factura, fecha_hora, metodo_pago, tipo_entrega,
          telefono_cliente, total_pagar,
          turno_id, monto_recibido, vuelto_dado
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (
          factura.id_factura,
          fh,
          factura.metodo_pago,
          factura.tipo_entrega,
          factura.telefono_cliente or None,
          factura.total_pagar,
          factura.turno_id or None,
          factura.monto_recibido or 0,
          factura.vuelto_dado or 0,
        ),
      )
      for linea in factura.items:
        cur.execute(
          """
          INSERT INTO lineas_venta (
            id_factura, producto_id, producto_nombre, cantidad,
            precio_unitario, notas_modificacion, es_bebida_incluida,
            es_personalizado, categoria
          ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
          """,
          (
            factura.id_factura,
            linea.producto_id,
            linea.producto_nombre,
            linea.cantidad,
            linea.precio_unitario,
            linea.notas_modificacion,
            1 if linea.es_bebida_incluida else 0,
            1 if linea.es_personalizado else 0,
            linea.categoria or "",
          ),
        )


def _lineas_de_factura(cur: Any, id_factura: str) -> list[dict[str, Any]]:
  cur.execute(
    """
    SELECT producto_id, producto_nombre, cantidad, precio_unitario,
           notas_modificacion, es_bebida_incluida, es_personalizado, categoria
    FROM lineas_venta WHERE id_factura = %s
    ORDER BY id
    """,
    (id_factura,),
  )
  lineas = cur.fetchall()
  return [
    {
      "producto_id": l["producto_id"],
      "producto": l["producto_nombre"],
      "cantidad": l["cantidad"],
      "precio_unitario": l["precio_unitario"],
      "notas_modificacion": l["notas_modificacion"] or "",
      "es_bebida_incluida": bool(l["es_bebida_incluida"]),
      "es_personalizado": bool(l["es_personalizado"]),
      "categoria": l["categoria"] or "",
    }
    for l in lineas
  ]


def _venta_dict(v: dict[str, Any], items: list[dict[str, Any]]) -> dict[str, Any]:
  return {
    "id_factura": v["id_factura"],
    "fecha_hora": str(v["fecha_hora"]),
    "metodo_pago": v["metodo_pago"],
    "tipo_entrega": v["tipo_entrega"],
    "telefono_cliente": v["telefono_cliente"] or "",
    "total_pagar": int(v["total_pagar"]),
    "items": items,
  }


def exportar_ventas_json(fecha: str | None = None, ruta: Path | None = None) -> Path:
  if fecha is None:
    fecha = datetime.now().strftime("%Y-%m-%d")
  datos = reporte_dia(fecha)
  DATA_DIR.mkdir(parents=True, exist_ok=True)
  destino = ruta or (DATA_DIR / f"ventas_{fecha}.json")
  destino.write_text(
    json.dumps(datos, ensure_ascii=False, indent=2),
    encoding="utf-8",
  )
  return destino


def listar_ventas(limite: int | None = 50) -> list[dict[str, Any]]:
  sql = "SELECT * FROM ventas ORDER BY fecha_hora DESC"
  params: list[Any] = []
  if limite is not None:
    sql += " LIMIT %s"
    params.append(limite)

  with conexion() as conn:
    with conn.cursor() as cur:
      cur.execute(sql, params)
      filas_ventas = cur.fetchall()
      resultado: list[dict[str, Any]] = []
      for v in filas_ventas:
        items = _lineas_de_factura(cur, v["id_factura"])
        resultado.append(_venta_dict(v, items))
      return resultado


def listar_ventas_por_fecha(fecha: str | None = None) -> list[dict[str, Any]]:
  if fecha is None:
    fecha = datetime.now().strftime("%Y-%m-%d")

  with conexion() as conn:
    with conn.cursor() as cur:
      cur.execute(
        """
        SELECT id_factura, fecha_hora, metodo_pago, tipo_entrega,
               telefono_cliente, total_pagar,
               turno_id, monto_recibido, vuelto_dado
        FROM ventas
        WHERE LEFT(fecha_hora, 10) = %s
        ORDER BY fecha_hora ASC
        """,
        (fecha,),
      )
      filas = cur.fetchall()

  return [
    {
      "id_factura": f["id_factura"],
      "fecha_hora": str(f["fecha_hora"]),
      "metodo_pago": f["metodo_pago"],
      "tipo_entrega": f["tipo_entrega"],
      "telefono_cliente": f["telefono_cliente"] or "",
      "total_pagar": int(f["total_pagar"]),
      "turno_id": f.get("turno_id"),
      "monto_recibido": int(f.get("monto_recibido") or 0),
      "vuelto_dado": int(f.get("vuelto_dado") or 0),
    }
    for f in filas
  ]


def reporte_dia(fecha: str | None = None) -> dict[str, Any]:
  """Reporte completo del día: resumen, turnos y ventas."""
  if fecha is None:
    fecha = datetime.now().strftime("%Y-%m-%d")

  with conexion() as conn:
    with conn.cursor() as cur:
      # Turnos abiertos ese día
      cur.execute(
        "SELECT * FROM turnos WHERE DATE(fecha_apertura) = %s ORDER BY fecha_apertura ASC",
        (fecha,),
      )
      turnos_rows = cur.fetchall()

      # Ventas del día con nombre del cajero
      cur.execute(
        """
        SELECT v.id_factura, v.fecha_hora, v.metodo_pago, v.tipo_entrega,
               v.total_pagar, v.turno_id,
               COALESCE(v.monto_recibido, 0)  AS monto_recibido,
               COALESCE(v.vuelto_dado, 0)     AS vuelto_dado,
               COALESCE(t.cajero, '')          AS cajero_nombre,
               COALESCE(v.anulada, 0)          AS anulada
        FROM ventas v
        LEFT JOIN turnos t ON v.turno_id = t.id
        WHERE LEFT(v.fecha_hora, 10) = %s
        ORDER BY v.fecha_hora ASC
        """,
        (fecha,),
      )
      ventas_rows = cur.fetchall()

      # Stats agrupadas por turno (solo ventas no anuladas)
      cur.execute(
        """
        SELECT
          turno_id,
          COUNT(CASE WHEN COALESCE(anulada,0)=0 THEN 1 END)                                     AS num_facturas,
          COALESCE(SUM(CASE WHEN COALESCE(anulada,0)=0 THEN total_pagar ELSE 0 END), 0)         AS total_ventas,
          COALESCE(SUM(CASE WHEN COALESCE(anulada,0)=0 AND metodo_pago='Efectivo' THEN total_pagar ELSE 0 END), 0) AS ventas_efectivo,
          COALESCE(SUM(CASE WHEN COALESCE(anulada,0)=0 THEN vuelto_dado ELSE 0 END), 0)         AS total_vueltos
        FROM ventas
        WHERE LEFT(fecha_hora, 10) = %s
        GROUP BY turno_id
        """,
        (fecha,),
      )
      stats_rows = cur.fetchall()

  stats_by_turno: dict[Any, Any] = {r["turno_id"]: r for r in stats_rows}

  turnos_out = []
  for t in turnos_rows:
    tid   = int(t["id"])
    stats = stats_by_turno.get(tid, {})
    ef_i  = int(t["efectivo_inicial"])
    v_ef  = int(stats.get("ventas_efectivo") or 0)
    vuelt = int(stats.get("total_vueltos")   or 0)
    ef_esp = ef_i + v_ef - vuelt
    ha = str(t["fecha_apertura"])[11:16] if t["fecha_apertura"] else ""
    hc = str(t["fecha_cierre"])[11:16]  if t["fecha_cierre"]    else None
    turnos_out.append({
      "id": tid, "cajero": t["cajero"],
      "hora_apertura": ha, "hora_cierre": hc,
      "efectivo_inicial": ef_i,
      "ventas_efectivo": v_ef,
      "total_vueltos": vuelt,
      "efectivo_esperado": ef_esp,
      "total_ventas_turno": int(stats.get("total_ventas") or 0),
      "num_facturas": int(stats.get("num_facturas") or 0),
      "estado": t["estado"],
      "anulado": bool(int(t.get("anulado") or 0)),
    })

  ventas_out = []
  for v in ventas_rows:
    fh   = str(v["fecha_hora"])
    hora = fh[11:19] if len(fh) > 11 else ""
    ventas_out.append({
      "id_factura":    v["id_factura"],
      "hora":          hora,
      "cajero":        v.get("cajero_nombre") or "",
      "turno_id":      v.get("turno_id"),
      "metodo_pago":   v["metodo_pago"],
      "tipo_entrega":  v["tipo_entrega"],
      "monto_recibido": int(v["monto_recibido"]),
      "vuelto_dado":   int(v["vuelto_dado"]),
      "total":         int(v["total_pagar"]),
      "anulada":       bool(int(v.get("anulada") or 0)),
    })

  activas = [x for x in ventas_out if not x.get("anulada")]
  total_ventas       = sum(x["total"]       for x in activas)
  total_efectivo     = sum(x["total"]       for x in activas if x["metodo_pago"] == "Efectivo")
  total_nequi        = sum(x["total"]       for x in activas if x["metodo_pago"] == "Nequi")
  total_transferencia= sum(x["total"]       for x in activas if x["metodo_pago"] == "Transferencia")
  total_otros        = sum(x["total"]       for x in activas
                           if x["metodo_pago"] not in ("Efectivo","Nequi","Transferencia"))
  total_vueltos      = sum(x["vuelto_dado"] for x in activas)

  return {
    "fecha": fecha,
    "resumen": {
      "total_ventas": total_ventas,
      "total_efectivo": total_efectivo,
      "total_nequi": total_nequi,
      "total_transferencia": total_transferencia,
      "total_otros": total_otros,
      "total_vueltos": total_vueltos,
      "total_facturas": len(activas),
    },
    "turnos":  turnos_out,
    "ventas":  ventas_out,
  }


def obtener_venta_por_id(id_factura: str) -> dict[str, Any] | None:
  with conexion() as conn:
    with conn.cursor() as cur:
      cur.execute("SELECT * FROM ventas WHERE id_factura = %s", (id_factura,))
      v = cur.fetchone()
      if v is None:
        return None
      items = _lineas_de_factura(cur, id_factura)
      return _venta_dict(v, items)


def reporte_cuadre_caja(fecha: str | None = None) -> dict[str, Any]:
  if fecha is None:
    fecha = datetime.now().strftime("%Y-%m-%d")

  filtro = "LEFT(fecha_hora, 10) = %s AND COALESCE(anulada, 0) = 0"

  with conexion() as conn:
    with conn.cursor() as cur:
      cur.execute(
        f"""
        SELECT metodo_pago, COUNT(*) AS cantidad, SUM(total_pagar) AS total
        FROM ventas
        WHERE {filtro}
        GROUP BY metodo_pago
        """,
        (fecha,),
      )
      filas = cur.fetchall()

      cur.execute(
        f"""
        SELECT COUNT(*) AS facturas, COALESCE(SUM(total_pagar), 0) AS total
        FROM ventas
        WHERE {filtro}
        """,
        (fecha,),
      )
      total_general = cur.fetchone()

  por_metodo = {
    f["metodo_pago"]: {"cantidad": f["cantidad"], "total": int(f["total"] or 0)}
    for f in filas
  }
  efectivo = por_metodo.get("Efectivo", {"cantidad": 0, "total": 0})
  nequi = por_metodo.get("Nequi", {"cantidad": 0, "total": 0})

  return {
    "fecha": fecha,
    "facturas": int(total_general["facturas"]),
    "total_general": int(total_general["total"] or 0),
    "efectivo": efectivo,
    "nequi": nequi,
    "detalle": listar_ventas_por_fecha(fecha),
  }


def abrir_turno(cajero: str, efectivo_inicial: int = 0) -> int:
  """Crea un nuevo turno abierto. Devuelve el id del turno."""
  with conexion() as conn:
    with conn.cursor() as cur:
      cur.execute(
        """
        INSERT INTO turnos (cajero, fecha_apertura, efectivo_inicial, estado)
        VALUES (%s, %s, %s, 'abierto') RETURNING id
        """,
        (cajero.strip() or "Cajero", datetime.now(), efectivo_inicial),
      )
      return cur.fetchone()["id"]


def cerrar_turno(turno_id: int) -> dict[str, Any]:
  """Cierra el turno y calcula efectivo_esperado = base + efectivo_vendido - vueltos."""
  with conexion() as conn:
    with conn.cursor() as cur:
      cur.execute("SELECT * FROM turnos WHERE id = %s", (turno_id,))
      turno = cur.fetchone()
      if turno is None:
        raise ErrorBaseDatos(f"Turno {turno_id} no encontrado")

      ahora = datetime.now()

      cur.execute(
        """
        SELECT
          COALESCE(SUM(total_pagar), 0)                                             AS total_ventas,
          COALESCE(SUM(CASE WHEN metodo_pago = 'Efectivo' THEN total_pagar ELSE 0 END), 0) AS total_efectivo,
          COALESCE(SUM(vuelto_dado), 0)                                             AS total_vueltos
        FROM ventas
        WHERE turno_id = %s
        """,
        (turno_id,),
      )
      row = cur.fetchone()
      total        = int(row["total_ventas"]  or 0)
      total_ef     = int(row["total_efectivo"] or 0)
      total_vuelt  = int(row["total_vueltos"]  or 0)
      ef_esperado  = int(turno["efectivo_inicial"]) + total_ef - total_vuelt

      cur.execute(
        """
        UPDATE turnos
        SET fecha_cierre = %s, total_ventas = %s,
            total_vueltos = %s, efectivo_esperado = %s, estado = 'cerrado'
        WHERE id = %s
        """,
        (ahora, total, total_vuelt, ef_esperado, turno_id),
      )
  return {
    "id": turno_id,
    "cajero": turno["cajero"],
    "fecha_apertura": str(turno["fecha_apertura"]),
    "fecha_cierre": ahora.isoformat(timespec="seconds"),
    "efectivo_inicial": int(turno["efectivo_inicial"]),
    "total_ventas": total,
    "total_efectivo": total_ef,
    "total_vueltos": total_vuelt,
    "efectivo_esperado": ef_esperado,
    "estado": "cerrado",
  }


def turno_activo() -> dict[str, Any] | None:
  """Devuelve el turno abierto más reciente, o None si no hay ninguno."""
  with conexion() as conn:
    with conn.cursor() as cur:
      cur.execute(
        "SELECT * FROM turnos WHERE estado = 'abierto' ORDER BY fecha_apertura DESC LIMIT 1"
      )
      row = cur.fetchone()
  if row is None:
    return None
  return {
    "id": int(row["id"]),
    "cajero": row["cajero"],
    "fecha_apertura": str(row["fecha_apertura"]),
    "efectivo_inicial": int(row["efectivo_inicial"]),
    "estado": "abierto",
  }


# ---------------------------------------------------------------------------
# CRUD de preparaciones
# ---------------------------------------------------------------------------

def listar_preparaciones(
  categoria: str | None = None,
  solo_activas: bool = True,
) -> list[dict[str, Any]]:
  condiciones: list[str] = []
  params: list[Any] = []
  if solo_activas:
    condiciones.append("activo = 1")
  if categoria:
    condiciones.append("categoria = %s")
    params.append(categoria)
  where = f"WHERE {' AND '.join(condiciones)}" if condiciones else ""
  sql = f"""
    SELECT id, categoria, opcion, orden, activo
    FROM preparaciones
    {where}
    ORDER BY categoria, orden, opcion
  """
  with conexion() as conn:
    with conn.cursor() as cur:
      cur.execute(sql, params)
      return cur.fetchall()


def preparaciones_por_categoria() -> dict[str, list[str]]:
  """Devuelve {PICADAS: ['Con todo', ...], ...} solo con activas."""
  filas = listar_preparaciones(solo_activas=True)
  resultado: dict[str, list[str]] = {}
  for f in filas:
    cat = f["categoria"]
    if cat not in resultado:
      resultado[cat] = []
    resultado[cat].append(f["opcion"])
  return resultado


def crear_preparacion(categoria: str, opcion: str, orden: int = 0) -> int:
  """Crea una nueva opción de preparación. Devuelve el id generado."""
  with conexion() as conn:
    with conn.cursor() as cur:
      cur.execute(
        "INSERT INTO preparaciones (categoria, opcion, orden) VALUES (%s, %s, %s) RETURNING id",
        (categoria.strip(), opcion.strip(), orden),
      )
      return cur.fetchone()["id"]


def desactivar_preparacion(prep_id: int) -> None:
  """Desactiva una opción (activo=0). No la borra."""
  with conexion() as conn:
    with conn.cursor() as cur:
      cur.execute(
        "UPDATE preparaciones SET activo = 0 WHERE id = %s",
        (prep_id,),
      )


def anular_venta(id_factura: str) -> None:
  """Marca una venta como anulada (no la elimina)."""
  with conexion() as conn:
    with conn.cursor() as cur:
      cur.execute(
        "UPDATE ventas SET anulada=1 WHERE id_factura=%s",
        (id_factura,),
      )
      if cur.rowcount == 0:
        raise ErrorBaseDatos(f"Venta {id_factura} no encontrada")


def eliminar_turno(turno_id: int) -> None:
  """Elimina un turno permanentemente. Falla si tiene ventas activas."""
  with conexion() as conn:
    with conn.cursor() as cur:
      cur.execute(
        "SELECT COUNT(*) AS cnt FROM ventas WHERE turno_id=%s AND COALESCE(anulada,0)=0",
        (turno_id,),
      )
      row = cur.fetchone()
      if int(row["cnt"]) > 0:
        raise ErrorBaseDatos("El turno tiene ventas activas y no puede eliminarse")
      cur.execute("DELETE FROM turnos WHERE id=%s", (turno_id,))


def anular_turno(turno_id: int) -> None:
  """Marca un turno como anulado (no lo elimina)."""
  with conexion() as conn:
    with conn.cursor() as cur:
      cur.execute(
        "UPDATE turnos SET anulado=1 WHERE id=%s",
        (turno_id,),
      )
      if cur.rowcount == 0:
        raise ErrorBaseDatos(f"Turno {turno_id} no encontrado")


def probar_conexion() -> tuple[bool, str]:
  """Devuelve (éxito, mensaje) para mostrar en la interfaz."""
  try:
    inicializar_bd()
    with conexion() as conn:
      with conn.cursor() as cur:
        cur.execute("SELECT 1 AS ok")
        cur.fetchone()
    return True, f"Conectado a PostgreSQL — {PG_HOST}:{PG_PORT}/{PG_DATABASE}"
  except ErrorBaseDatos as e:
    return False, str(e)
  except psycopg2.Error as e:
    return False, f"Error PostgreSQL: {e}"
