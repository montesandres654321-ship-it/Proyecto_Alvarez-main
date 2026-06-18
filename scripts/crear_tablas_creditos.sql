-- Ejecutar en Supabase SQL Editor si las tablas no existen
-- Verificar primero: SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('creditos','credito_pagos');

CREATE TABLE IF NOT EXISTS creditos (
  id              SERIAL       PRIMARY KEY,
  id_factura      VARCHAR(24)  DEFAULT NULL,
  nombre_cliente  VARCHAR(100) NOT NULL,
  total_deuda     INTEGER      NOT NULL CHECK (total_deuda > 0),
  total_pagado    INTEGER      NOT NULL DEFAULT 0 CHECK (total_pagado >= 0),
  estado          VARCHAR(10)  NOT NULL DEFAULT 'pendiente'
                               CHECK (estado IN ('pendiente', 'pagado')),
  fecha_credito   TIMESTAMP    NOT NULL DEFAULT NOW(),
  fecha_pago      TIMESTAMP    DEFAULT NULL,
  cajero          VARCHAR(100) DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_creditos_estado
  ON creditos(estado);

CREATE INDEX IF NOT EXISTS idx_creditos_cliente
  ON creditos(nombre_cliente);

CREATE TABLE IF NOT EXISTS credito_pagos (
  id          SERIAL      PRIMARY KEY,
  credito_id  INT         NOT NULL REFERENCES creditos(id) ON DELETE CASCADE,
  monto       INT         NOT NULL CHECK (monto > 0),
  metodo_pago VARCHAR(20) NOT NULL DEFAULT 'Efectivo',
  fecha_pago  TIMESTAMP   NOT NULL DEFAULT NOW(),
  cajero      VARCHAR(100) DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_credito_pagos_credito
  ON credito_pagos(credito_id);

-- Verificar resultado:
-- SELECT table_name, (SELECT count(*) FROM information_schema.columns WHERE table_name = t.table_name) AS columnas
-- FROM information_schema.tables t
-- WHERE table_schema = 'public' AND table_name IN ('creditos','credito_pagos');
