-- ============================================================
-- SEED SUPABASE — Ejecutar en SQL Editor de tu proyecto
-- Instrucciones: supabase.com → SQL Editor → New query → Run
-- ============================================================

-- ── Insumos catálogo ─────────────────────────────────────────
INSERT INTO insumos_catalogo (nombre, unidad, precio_ref, activo, orden)
VALUES
  ('Carne de cerdo',      'kg',  0, 1, 1),
  ('Carne de pollo',      'kg',  0, 1, 2),
  ('Papas',               'kg',  0, 1, 3),
  ('Salchichas',          'paq', 0, 1, 4),
  ('Pan de perro',        'paq', 0, 1, 5),
  ('Pan de hamburguesa',  'paq', 0, 1, 6),
  ('Aceite',              'lt',  0, 1, 7),
  ('Salsas (surtido)',    'und', 0, 1, 8),
  ('Condimentos',         'und', 0, 1, 9),
  ('Gaseosas',            'und', 0, 1, 10)
ON CONFLICT DO NOTHING;

-- ── Preparaciones ────────────────────────────────────────────
INSERT INTO preparaciones (categoria, opcion, orden, activo)
VALUES
  ('PICADAS',           'Con todo',          1, 1),
  ('PICADAS',           'Sin verduras',       2, 1),
  ('PICADAS',           'Sin salsa',          3, 1),
  ('PICADAS',           'Con poca salsa',     4, 1),
  ('DESGRANADOS',       'Con todo',           1, 1),
  ('DESGRANADOS',       'Sin verduras',       2, 1),
  ('DESGRANADOS',       'Sin salsa',          3, 1),
  ('DESGRANADOS',       'Con poca salsa',     4, 1),
  ('SALCHIPAPAS',       'Con todo',           1, 1),
  ('SALCHIPAPAS',       'Sin salsa',          2, 1),
  ('SALCHIPAPAS',       'Con poca salsa',     3, 1),
  ('SALCHIPAPAS',       'Solo papas',         4, 1),
  ('PERROS CALIENTES',  'Con todo',           1, 1),
  ('PERROS CALIENTES',  'Sin verduras',       2, 1),
  ('PERROS CALIENTES',  'Sin salsa',          3, 1),
  ('PERROS CALIENTES',  'Con mostaza',        4, 1),
  ('HAMBURGUESAS',      'Con todo',           1, 1),
  ('HAMBURGUESAS',      'Sin verduras',       2, 1),
  ('HAMBURGUESAS',      'Sin salsa',          3, 1),
  ('HAMBURGUESAS',      'Sin queso',          4, 1)
ON CONFLICT DO NOTHING;
