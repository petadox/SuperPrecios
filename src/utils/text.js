export function normalize(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

const euro = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' })

export function formatPrice(value) {
  return euro.format(value)
}

const UNIT_LABELS = { kg: 'kg', L: 'litro', ud: 'unidad', lavado: 'lavado' }

export function unitLabel(unit) {
  return UNIT_LABELS[unit] ?? unit
}

export function formatDate(iso) {
  return new Date(iso).toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short' })
}
