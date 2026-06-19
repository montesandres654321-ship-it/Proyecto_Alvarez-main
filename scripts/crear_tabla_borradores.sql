-- Ejecutar en Supabase SQL Editor
-- Columna lugar_compra en catálogo de insumos
ALTER TABLE insumos_catalogo
ADD COLUMN IF NOT EXISTS lugar_compra VARCHAR(20) DEFAULT 'ambos';

-- Tabla borradores para sincronización multi-dispositivo
CREATE TABLE IF NOT EXISTS borradores (
  id         SERIAL      PRIMARY KEY,
  usuario_id INTEGER     NOT NULL REFERENCES usuarios(id),
  tipo       VARCHAR(20) NOT NULL,
  datos      JSONB       NOT NULL DEFAULT '{}',
  updated_at TIMESTAMP   DEFAULT NOW(),
  UNIQUE(usuario_id, tipo)
);
