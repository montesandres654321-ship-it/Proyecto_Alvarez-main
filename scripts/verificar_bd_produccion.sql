-- ═══════════════════════════════════════════════════════════════════════════
-- ALVAREZ FAST FOOD — Script de verificación y corrección de BD producción
-- Ejecutar en: Supabase → SQL Editor → Run
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════
-- URGENTE: Deduplicar categorías_gasto
-- (bug: seed sin UNIQUE insertaba 6 filas
--  en cada arranque del servidor)
-- ═══════════════════════════════════════

-- Ver cuántos duplicados hay
SELECT nombre, COUNT(*) as total, array_agg(id ORDER BY id) as ids
FROM categorias_gasto GROUP BY nombre ORDER BY nombre;

-- Reasignar gastos que apunten a IDs duplicados al ID más bajo por nombre
UPDATE gastos_generales g
SET categoria_id = sub.id_correcto
FROM (
  SELECT nombre, MIN(id) as id_correcto FROM categorias_gasto GROUP BY nombre
) sub
JOIN categorias_gasto dup ON dup.nombre = sub.nombre AND dup.id != sub.id_correcto
WHERE g.categoria_id = dup.id;

-- Eliminar los duplicados (conservar el de id más bajo por nombre)
DELETE FROM categorias_gasto
WHERE id NOT IN (
  SELECT MIN(id) FROM categorias_gasto GROUP BY nombre
);

-- Agregar constraint UNIQUE para que no vuelva a pasar
ALTER TABLE categorias_gasto ADD CONSTRAINT IF NOT EXISTS uq_cat_gasto_nombre UNIQUE (nombre);

-- Verificar: ahora deben ser exactamente 6
SELECT id, nombre, emoji, orden FROM categorias_gasto ORDER BY orden;

-- ═══════════════════════════════════════
-- VERIFICACIÓN 1: Créditos huérfanos
-- ═══════════════════════════════════════

-- Ver ventas a crédito sin registro en creditos
SELECT
  v.id_factura,
  v.total_pagar as deuda,
  v.fecha_hora,
  COALESCE(v.telefono_cliente, 'Sin nombre') as cliente
FROM ventas v
WHERE v.metodo_pago = 'Crédito'
  AND (v.anulada = 0 OR v.anulada IS NULL)
  AND v.id_factura NOT IN (
    SELECT COALESCE(id_factura, '')
    FROM creditos
    WHERE id_factura IS NOT NULL
  )
ORDER BY v.fecha_hora DESC;

-- Si hay filas en el resultado anterior: insertar los faltantes
INSERT INTO creditos (id_factura, nombre_cliente, total_deuda, estado)
SELECT
  v.id_factura,
  COALESCE(NULLIF(v.telefono_cliente, ''), 'Cliente'),
  v.total_pagar,
  'pendiente'
FROM ventas v
WHERE v.metodo_pago = 'Crédito'
  AND (v.anulada = 0 OR v.anulada IS NULL)
  AND v.id_factura NOT IN (
    SELECT COALESCE(id_factura, '')
    FROM creditos
    WHERE id_factura IS NOT NULL
  )
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════
-- VERIFICACIÓN 2: Integridad de BD
-- ═══════════════════════════════════════

-- Líneas sin venta padre (esperado: 0)
SELECT
  'lineas_sin_venta' as check_name,
  COUNT(*) as resultado,
  CASE WHEN COUNT(*) = 0 THEN '✅ OK' ELSE '❌ PROBLEMA' END as estado
FROM lineas_venta lv
WHERE NOT EXISTS (
  SELECT 1 FROM ventas v WHERE v.id_factura = lv.id_factura
);

-- Detalle nómina sin nómina (esperado: 0)
SELECT
  'detalle_sin_nomina' as check_name,
  COUNT(*) as resultado,
  CASE WHEN COUNT(*) = 0 THEN '✅ OK' ELSE '❌ PROBLEMA' END as estado
FROM nomina_detalle nd
WHERE NOT EXISTS (
  SELECT 1 FROM nomina_semana ns WHERE ns.id = nd.nomina_id
);

-- Pagos sin crédito (esperado: 0)
SELECT
  'pagos_sin_credito' as check_name,
  COUNT(*) as resultado,
  CASE WHEN COUNT(*) = 0 THEN '✅ OK' ELSE '❌ PROBLEMA' END as estado
FROM credito_pagos cp
WHERE NOT EXISTS (
  SELECT 1 FROM creditos c WHERE c.id = cp.credito_id
);

-- Créditos con saldo negativo (esperado: 0)
SELECT
  'creditos_saldo_negativo' as check_name,
  COUNT(*) as resultado,
  CASE WHEN COUNT(*) = 0 THEN '✅ OK' ELSE '❌ PROBLEMA' END as estado
FROM creditos
WHERE total_pagado > total_deuda;

-- Créditos con estado incorrecto (pendiente pero ya pagado)
SELECT
  'creditos_estado_incorrecto' as check_name,
  COUNT(*) as resultado,
  CASE WHEN COUNT(*) = 0 THEN '✅ OK' ELSE '⚠️ CORREGIR' END as estado
FROM creditos
WHERE estado = 'pendiente' AND total_pagado >= total_deuda;

-- Corregir créditos con estado incorrecto
UPDATE creditos
SET estado = 'pagado', fecha_pago = NOW()
WHERE estado = 'pendiente' AND total_pagado >= total_deuda;

-- Contador facturas vs max en ventas
SELECT
  cf.anio,
  cf.ultimo_numero as contador_actual,
  COALESCE(
    MAX(CAST(REGEXP_REPLACE(v.id_factura, '[^0-9]', '', 'g') AS INTEGER)),
    0
  ) as max_en_ventas,
  CASE
    WHEN cf.ultimo_numero >= COALESCE(MAX(
      CAST(REGEXP_REPLACE(v.id_factura, '[^0-9]', '', 'g') AS INTEGER)
    ), 0) THEN '✅ OK'
    ELSE '❌ CONTADOR DESINCRONIZADO'
  END as estado
FROM contador_facturas cf
LEFT JOIN ventas v ON v.id_factura LIKE 'FAC-' || cf.anio || '-%'
GROUP BY cf.anio, cf.ultimo_numero;

-- Resumen de filas por tabla
SELECT tablename as tabla, n_live_tup as filas_aproximadas
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- ═══════════════════════════════════════
-- VERIFICACIÓN 3: Tablas de gastos
-- ═══════════════════════════════════════

SELECT
  table_name,
  '✅ Existe' as estado
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'gastos_generales', 'categorias_gasto', 'creditos',
    'credito_pagos', 'usuarios', 'sesiones'
  )
ORDER BY table_name;

-- Seed de categorías (si está vacía)
INSERT INTO categorias_gasto (nombre, emoji, orden)
VALUES
  ('Arriendo',           '🏠', 1),
  ('Servicios públicos', '💡', 2),
  ('Gas',                '🔥', 3),
  ('Internet',           '📶', 4),
  ('Transporte',         '🚛', 5),
  ('Otros',              '📦', 6)
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════
-- VERIFICACIÓN 4: Usuarios
-- ═══════════════════════════════════════

SELECT id, nombre, rol, activo, created_at
FROM usuarios
ORDER BY rol DESC, nombre;

SELECT
  u.nombre, u.rol, s.dispositivo, s.last_seen, s.activo
FROM sesiones s
JOIN usuarios u ON u.id = s.usuario_id
WHERE s.activo = 1
ORDER BY s.last_seen DESC;

-- ═══════════════════════════════════════
-- VERIFICACIÓN 5: Festivos Colombia 2026
-- ═══════════════════════════════════════

SELECT clave, valor FROM configuracion WHERE clave = 'festivos';

INSERT INTO configuracion (clave, valor, descripcion)
VALUES (
  'festivos',
  '2026-01-01,2026-01-12,2026-03-23,2026-04-02,2026-04-03,2026-05-01,2026-05-18,2026-06-08,2026-06-29,2026-07-20,2026-08-07,2026-08-17,2026-10-12,2026-11-02,2026-11-16,2026-12-08,2026-12-25',
  'Festivos Colombia 2026 — formato YYYY-MM-DD separados por coma'
)
ON CONFLICT (clave) DO UPDATE
  SET valor = EXCLUDED.valor
  WHERE configuracion.valor = '' OR configuracion.valor IS NULL;

SELECT clave, valor
FROM configuracion
WHERE clave IN ('festivos', 'pin_admin', 'pin_cajero', 'nombre_restaurante');

-- ═══════════════════════════════════════
-- VERIFICACIÓN 6: Estadísticas generales
-- ═══════════════════════════════════════

SELECT
  (SELECT COUNT(*) FROM ventas WHERE anulada = 0 OR anulada IS NULL)
    as total_ventas,
  (SELECT COALESCE(SUM(total_pagar), 0) FROM ventas WHERE anulada = 0 OR anulada IS NULL)
    as ingresos_totales,
  (SELECT COUNT(*) FROM creditos WHERE estado = 'pendiente')
    as creditos_pendientes,
  (SELECT COALESCE(SUM(total_deuda - total_pagado), 0) FROM creditos WHERE estado = 'pendiente')
    as deuda_pendiente_total,
  (SELECT COUNT(*) FROM trabajadores WHERE activo = 1)
    as trabajadores_activos,
  (SELECT COUNT(*) FROM usuarios WHERE activo = 1)
    as usuarios_sistema,
  (SELECT COUNT(*) FROM compras)
    as compras_insumos,
  (SELECT COUNT(*) FROM gastos_generales)
    as gastos_registrados;
