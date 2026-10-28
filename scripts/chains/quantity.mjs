// Reads the pack size out of text like "pack 6x1 litro", "bolsa 1.000 g" or "75 cl".
const UNITS = {
  kg: { unit: 'kg', factor: 1 },
  kilo: { unit: 'kg', factor: 1 },
  kilos: { unit: 'kg', factor: 1 },
  g: { unit: 'kg', factor: 0.001 },
  gr: { unit: 'kg', factor: 0.001 },
  grs: { unit: 'kg', factor: 0.001 },
  gramos: { unit: 'kg', factor: 0.001 },
  l: { unit: 'L', factor: 1 },
  lt: { unit: 'L', factor: 1 },
  litro: { unit: 'L', factor: 1 },
  litros: { unit: 'L', factor: 1 },
  cl: { unit: 'L', factor: 0.01 },
  ml: { unit: 'L', factor: 0.001 },
  ud: { unit: 'ud', factor: 1 },
  uds: { unit: 'ud', factor: 1 },
  unidad: { unit: 'ud', factor: 1 },
  unidades: { unit: 'ud', factor: 1 },
}

const NUMBER = String.raw`\d{1,3}(?:\.\d{3})+(?!\d)|\d+(?:[.,]\d+)?`
const UNIT = Object.keys(UNITS)
  .sort((a, b) => b.length - a.length)
  .join('|')
const QUANTITY = new RegExp(String.raw`(?:(\d+)\s*x\s*)?(${NUMBER})\s*(${UNIT})\b`, 'gi')

// "1.000 g" is a thousand grams, "1.5 kg" and "1,5 kg" are one and a half.
function toNumber(text) {
  return Number(/^\d{1,3}(\.\d{3})+$/.test(text) ? text.replaceAll('.', '') : text.replace(',', '.'))
}

export function parseQuantity(text) {
  const lower = text.toLowerCase()
  const matches = [...lower.matchAll(QUANTITY)]
  if (matches.length === 0 && /\bdocena\b/.test(lower)) return { unit: 'ud', amount: 12 }
  if (matches.length === 0) return null
  const [, packs, size, unitName] = matches.at(-1)
  const { unit, factor } = UNITS[unitName]
  const amount = Number(packs ?? 1) * toNumber(size) * factor
  return amount > 0 ? { unit, amount } : null
}
