-- Alvarez Fast Food — DDL tablas de gastos generales
-- Ejecutar en Supabase SQL Editor

CREATE TABLE IF NOT EXISTS categorias_gasto (
  id     SERIAL       PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  emoji  VARCHAR(10)  DEFAULT '💸',
  activo SMALLINT     DEFAULT 1,
  orden  INTEGER      DEFAULT 0
);

CREATE TABLE IF NOT EXISTS gastos_generales (
  id               SERIAL       PRIMARY KEY,
  nombre           VARCHAR(100) NOT NULL,
  valor            INTEGER      NOT NULL,
  categoria_id     INTEGER
    REFERENCES categorias_gasto(id),
  categoria_nombre VARCHAR(100),
  tipo             VARCHAR(10)  DEFAULT 'variable'
    CHECK (tipo IN ('fijo','variable')),
  fecha            DATE         NOT NULL DEFAULT CURRENT_DATE,
  notas            VARCHAR(200),
  created_at       TIMESTAMP    DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gastos_fecha ON gastos_generales(fecha);
CREATE INDEX IF NOT EXISTS idx_gastos_categoria ON gastos_generales(categoria_id);

INSERT INTO categorias_gasto (nombre, emoji, orden)
VALUES
  ('Arriendo',           '🏠', 1),
  ('Servicios públicos', '💡', 2),
  ('Gas',                '🔥', 3),
  ('Internet',           '📶', 4),
  ('Transporte',         '🚛', 5),
  ('Otros',              '📦', 6)
ON CONFLICT DO NOTHING;
