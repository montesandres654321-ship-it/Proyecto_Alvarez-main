export const formatMiles = (valor) => {
  const digits = String(valor).replace(/\D/g, '')
  if (!digits) return ''
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

export const parseMiles = (display) => {
  const clean = String(display).replace(/\./g, '').replace(/\D/g, '')
  return clean ? parseInt(clean, 10) : 0
}
