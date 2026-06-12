const EMOJI_MAP = {
  'cerdo':        '🥩',
  'pollo':        '🍗',
  'suiza':        '🥩',
  'alvarera':     '🍖',
  'desgranado':   '🌽',
  'salchipapa':   '🍟',
  'choripapa':    '🍟',
  'perro':        '🌭',
  'choriperro':   '🌭',
  'hamburguesa':  '🍔',
  'gaseosa':      '🥤',
  'mini':         '🥤',
  'familiar':     '🧃',
  'personal':     '🥤',
  'papas':        '🍟',
  'picada':       '🍖',
  // Categorías como fallback (clave en MAYÚSCULAS)
  'PICADAS':            '🍖',
  'DESGRANADOS':        '🌽',
  'SALCHIPAPAS':        '🍟',
  'PERROS CALIENTES':   '🌭',
  'HAMBURGUESAS':       '🍔',
  'GASEOSAS':           '🥤',
}

export function getProductEmoji(nombre = '', categoria = '') {
  const nombreLower = nombre.toLowerCase()
  for (const [key, emoji] of Object.entries(EMOJI_MAP)) {
    if (key === key.toUpperCase()) continue // saltar entradas de categoría
    if (nombreLower.includes(key)) return emoji
  }
  return EMOJI_MAP[categoria] || '🍽️'
}
