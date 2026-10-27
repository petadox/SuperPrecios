// Eroski and Caprabo (Eroski group) run the same shop software.
const HEADERS = { 'User-Agent': 'SuperPrecios (uso personal)' }

// The shops also sell electronics, furniture… only food is compared.
const SECTIONS = ['alimentacion', 'frescos', 'dulces-y-desayuno', 'bebidas', 'congelados']

// Most cards show no unit price, so the quantity is read from the product name.
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function decode(text) {
  return text
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&')
}

const SHOWN_UNITS = { KILO: 'kg', LITRO: 'L', UNIDAD: 'ud' }

// Some cards (mostly fresh food) do show it: "1 KILO A 16,15 €".
function shownUnitPrice(card) {
  const match = card.match(/quantity-text">\s*1 (KILO|LITRO|UNIDAD) A\s+([\d.]*\d,\d+)\s*€/)
  if (!match) return null
  return { unit: SHOWN_UNITS[match[1]], unitPrice: Number(match[2].replaceAll('.', '').replace(',', '.')) }
}

function unitPriceOf(item) {
  if (item.shown) return item.shown
  const quantity = parseQuantity(item.item_name)
  if (!quantity) return null
  return { unit: quantity.unit, unitPrice: Math.round((item.price / quantity.amount) * 1000) / 1000 }
}

export function eroskiPlatform({ id, name, site }) {
  async function request(path) {
    for (let attempt = 1; ; attempt++) {
      const res = await fetch(site + path, { headers: HEADERS })
      if (res.ok) return res.text()
      if (attempt === 3) throw new Error(`${name} ${res.status} en ${path}`)
      await sleep(2000 * attempt)
    }
  }

  async function fetchMenu() {
    const html = await request('/es/')
    const subcategories = new Map()
    const names = new Map()
    for (const [, path, label] of html.matchAll(/href="[^"]*?(\/es\/supermercado\/[^"]+)">([^<]+)</g)) {
      const parts = path.split('/').filter(Boolean).slice(2)
      const section = parts[0]?.replace(/^\d+-/, '')
      if (!SECTIONS.includes(section)) continue
      const text = decode(label).replace(/^Ver todo /, '').trim()
      if (parts.length === 1) names.set(parts[0], text)
      if (parts.length === 2) subcategories.set(path, { path, section: parts[0], name: text })
    }
    return [...subcategories.values()].map((s) => ({ ...s, category: names.get(s.section) ?? s.section }))
  }

  function parseItems(html) {
    const items = new Map()
    for (const card of html.split('product-item-lineal').slice(1)) {
      const metrics = card.match(/data-metrics="([^"]*select_item[^"]*)"/)
      if (!metrics) continue
      const item = JSON.parse(decode(metrics[1])).ecommerce.items[0]
      const url = card.match(/href="https:\/\/[^/"]+?(?::443)?(\/es\/productdetail\/\d+-[^"]+)"/)?.[1]
      items.set(item.item_id, { ...item, url: url && site + url, shown: shownUnitPrice(card) })
    }
    return [...items.values()]
  }

  function toProduct(item, sub) {
    const full = item.item_name.trim()
    const comma = full.lastIndexOf(', ')
    const perUnit = unitPriceOf(item)
    if (!perUnit || !(item.price > 0)) return null
    return {
      id: `${id}:${item.item_id}`,
      chain: id,
      name: comma > 0 ? full.slice(0, comma) : full,
      format: comma > 0 ? full.slice(comma + 2).trim() : '',
      price: item.price,
      ...perUnit,
      category: sub.category,
      subcategory: sub.name,
      image: `${site}/images/${item.item_id}.jpg`,
      url: item.url ?? `${site}/es/productdetail/${item.item_id}/`,
    }
  }

  return {
    id,
    name,
    async fetchProducts({ limit = Infinity } = {}) {
      const subcategories = (await fetchMenu()).slice(0, limit)
      if (subcategories.length === 0) throw new Error(`${name}: no se encontraron categorías`)
      const products = new Map()
      let skipped = 0
      for (const sub of subcategories) {
        for (let page = 0; ; page++) {
          const items = parseItems(await request(`${sub.path}?pageNumber=${page}`))
          if (items.length === 0) break
          for (const item of items) {
            if (products.has(item.item_id)) continue
            const product = toProduct(item, sub)
            if (product) products.set(item.item_id, product)
            else skipped++
          }
          await sleep(300)
        }
      }
      console.log(`${name}: ${skipped} productos sin cantidad legible en el nombre`)
      return { products: [...products.values()], location: 'web' }
    },
  }
}
