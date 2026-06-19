-- Alvarez Fast Food — DDL tablas de usuarios y sesiones
-- Ejecutar en Supabase SQL Editor

CREATE TABLE IF NOT EXISTS usuarios (
  id         SERIAL       PRIMARY KEY,
  nombre     VARCHAR(100) NOT NULL,
  pin        VARCHAR(10)  NOT NULL,
  rol        VARCHAR(10)  DEFAULT 'cajero'
    CHECK (rol IN ('admin','cajero')),
  activo     SMALLINT     DEFAULT 1,
  created_at TIMESTAMP    DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sesiones (
  id          SERIAL       PRIMARY KEY,
  usuario_id  INTEGER      NOT NULL
    REFERENCES usuarios(id),
  token       VARCHAR(64)  UNIQUE NOT NULL,
  dispositivo VARCHAR(200),
  activo      SMALLINT     DEFAULT 1,
  created_at  TIMESTAMP    DEFAULT NOW(),
  last_seen   TIMESTAMP    DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sesiones_token ON sesiones(token);
CREATE INDEX IF NOT EXISTS idx_sesiones_usuario ON sesiones(usuario_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_rol ON usuarios(rol);

-- Seed: crear admin por defecto solo si no existe ninguno
INSERT INTO usuarios (nombre, pin, rol)
SELECT 'Administrador',
  COALESCE(
    (SELECT valor FROM configuracion WHERE clave = 'pin_admin'),
    '1234'
  ),
  'admin'
WHERE NOT EXISTS (
  SELECT 1 FROM usuarios WHERE rol = 'admin'
);
