-- Alvarez Fast Food — Esquema PostgreSQL para Supabase
-- Ejecute este script en el SQL Editor de Supabase (o con psql).
-- Es idempotente: puede ejecutarse varias veces sin error.

CREATE TABLE IF NOT EXISTS contador_facturas (
  anio          INT NOT NULL PRIMARY KEY,
  ultimo_numero INT NOT NULL DEFAULT 0
);

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
);
CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON ventas(fecha_hora);
CREATE INDEX IF NOT EXISTS idx_ventas_pago  ON ventas(metodo_pago);

CREATE TABLE IF NOT EXISTS lineas_venta (
  id                 SERIAL       PRIMARY KEY,
  id_factura         VARCHAR(24)  NOT NULL,
  producto_id        VARCHAR(64)  NOT NULL,
  producto_nombre    VARCHAR(255) NOT NULL,
  cantidad           INT          NOT NULL,
  precio_unitario    INT          NOT NULL,
  notas_modificacion TEXT,
  es_bebida_incluida SMALLINT     NOT NULL DEFAULT 0,
  es_personalizado   SMALLINT     NOT NULL DEFAULT 0,
  categoria          VARCHAR(64)  DEFAULT '',
  CONSTRAINT fk_lineas_venta_factura
    FOREIGN KEY (id_factura) REFERENCES ventas(id_factura)
    ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_lineas_factura ON lineas_venta(id_factura);

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
);
CREATE INDEX IF NOT EXISTS idx_cat_activo ON productos(categoria, activo);

CREATE TABLE IF NOT EXISTS configuracion (
  clave       VARCHAR(50)  NOT NULL PRIMARY KEY,
  valor       VARCHAR(255) NOT NULL,
  descripcion VARCHAR(200) DEFAULT NULL
);

INSERT INTO configuracion (clave, valor, descripcion) VALUES
  ('nequi_numero',       '3143435217',                   'Número de cuenta Nequi para cobros'),
  ('nombre_restaurante', 'Alvarez Fast Food',             'Nombre del restaurante'),
  ('prefijo_factura',    'FAC',                           'Prefijo base de facturas'),
  ('pin_admin',          '1234',                          'PIN de 4 dígitos para reportes y configuración'),
  ('domicilio_mensaje',  'Domicilio sin costo adicional', 'Mensaje en el ticket del cliente'),
  ('num_mesas',          '8',                             'Cantidad de mesas del restaurante'),
  ('metodos_pago',       'Efectivo,Nequi,Transferencia,Otros', 'Métodos de pago habilitados')
ON CONFLICT (clave) DO NOTHING;

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
);
CREATE INDEX IF NOT EXISTS idx_turnos_estado ON turnos(estado);
CREATE INDEX IF NOT EXISTS idx_turnos_fecha  ON turnos(fecha_apertura);

INSERT INTO contador_facturas (anio, ultimo_numero)
VALUES (EXTRACT(YEAR FROM NOW())::INT, 0)
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS preparaciones (
  id        SERIAL       PRIMARY KEY,
  categoria VARCHAR(50)  NOT NULL,
  opcion    VARCHAR(100) NOT NULL,
  orden     INT          NOT NULL DEFAULT 0,
  activo    SMALLINT     NOT NULL DEFAULT 1,
  UNIQUE (categoria, opcion)
);

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
ON CONFLICT (categoria, opcion) DO NOTHING;

CREATE TABLE IF NOT EXISTS insumos_catalogo (
  id         SERIAL       PRIMARY KEY,
  nombre     VARCHAR(100) NOT NULL,
  unidad     VARCHAR(20)  NOT NULL DEFAULT 'und',
  precio_ref INT          DEFAULT 0,
  activo     SMALLINT     DEFAULT 1,
  orden      INT          DEFAULT 0
);

CREATE TABLE IF NOT EXISTS compras (
  id         SERIAL  PRIMARY KEY,
  fecha      DATE    NOT NULL,
  fecha_hora TIMESTAMP DEFAULT NOW(),
  total      INT     NOT NULL DEFAULT 0,
  notas      VARCHAR(200)
);

CREATE TABLE IF NOT EXISTS compras_detalle (
  id             SERIAL        PRIMARY KEY,
  compra_id      INT           NOT NULL,
  nombre_insumo  VARCHAR(100)  NOT NULL,
  cantidad       DECIMAL(10,2) NOT NULL,
  unidad         VARCHAR(20)   NOT NULL,
  valor_unitario INT           NOT NULL,
  subtotal       INT           NOT NULL,
  FOREIGN KEY (compra_id) REFERENCES compras(id)
);

CREATE TABLE IF NOT EXISTS trabajadores (
  id              SERIAL       PRIMARY KEY,
  nombre          VARCHAR(100) NOT NULL,
  rol             VARCHAR(50)  DEFAULT 'Trabajador',
  tarifa_dia      INT          NOT NULL DEFAULT 0,
  recargo_festivo DECIMAL(3,1) DEFAULT 1.0,
  activo          SMALLINT     DEFAULT 1,
  orden           INT          DEFAULT 0,
  created_at      TIMESTAMP    DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nomina_semana (
  id           SERIAL  PRIMARY KEY,
  fecha_inicio DATE    NOT NULL,
  fecha_fin    DATE    NOT NULL,
  total        INT     NOT NULL DEFAULT 0,
  estado       VARCHAR(10) DEFAULT 'borrador'
    CHECK (estado IN ('borrador', 'pagada')),
  fecha_pago   TIMESTAMP,
  notas        VARCHAR(200)
);

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
);
