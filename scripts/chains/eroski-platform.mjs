import { fetchOk, retry } from './http.mjs'
import { parseQuantity } from './quantity.mjs'

// Eroski and Caprabo (Eroski group) run the same shop software. They also
// sell electronics, furniture… only food is compared.
const SECTIONS = ['alimentacion', 'frescos', 'dulces-y-desayuno', 'bebidas', 'congelados']

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

// Most cards show no unit price, so the quantity is read from the product name.
function unitPriceOf(item) {
  if (item.shown) return item.shown
  const quantity = parseQuantity(item.item_name)
  if (!quantity) return null
  return { unit: quantity.unit, unitPrice: Math.round((item.price / quantity.amount) * 1000) / 1000 }
}

export function eroskiPlatform({ id, name, site }) {
  async function request(path) {
    return retry(name, async () => (await fetchOk(site + path)).text())
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
