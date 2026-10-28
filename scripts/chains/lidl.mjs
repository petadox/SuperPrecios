import { parseQuantity } from './quantity.mjs'

const SITE = 'https://www.lidl.es'
const HEADERS = { 'User-Agent': 'SuperPrecios (uso personal)' }

// Lidl sells no groceries online; only its weekly food offers carry prices.
const OFFER_PAGES = ['/c/ofertas-semanales/a10089449', '/c/ofertas-proxima-semana/a10088432']

async function request(path) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(SITE + path, { headers: HEADERS })
    if (res.ok) return res.text()
    if (attempt === 3) throw new Error(`Lidl ${res.status} en ${path}`)
    await new Promise((resolve) => setTimeout(resolve, 2000 * attempt))
  }
}

function decode(text) {
  return text.replaceAll('&quot;', '"').replaceAll('&#39;', "'").replaceAll('&amp;', '&')
}

function parsePrice(text) {
  const match = text?.match(/([\d.]*\d,\d+)\s*€\s*\/\s*(kg|l)\b/i)
  if (!match) return null
  return { unit: match[2].toLowerCase() === 'l' ? 'L' : 'kg', unitPrice: Number(match[1].replaceAll('.', '').replace(',', '.')) }
}

// "A granel" is sold by weight and priced per kilo; "Ud" is a single unit.
function unitPriceOf(price) {
  const shown = parsePrice(price.basePrice?.text)
  if (shown) return shown
  const packaging = price.packaging?.text ?? ''
  if (/granel/i.test(packaging)) return { unit: 'kg', unitPrice: price.price }
  if (/^\s*ud\.?\s*$/i.test(packaging)) return { unit: 'ud', unitPrice: price.price }
  const quantity = parseQuantity(packaging)
  if (!quantity) return null
  return { unit: quantity.unit, unitPrice: Math.round((price.price / quantity.amount) * 1000) / 1000 }
}

function toProduct(item) {
  const perUnit = unitPriceOf(item.price)
  if (!perUnit) return null
  return {
    id: `lidl:${item.productId}`,
    chain: 'lidl',
    name: item.fullTitle.replace(/^[-\s]+/, ''),
    format: item.price.packaging?.text ?? '',
    price: item.price.price,
    ...perUnit,
    category: 'Ofertas de la semana',
    subcategory: 'Lidl',
    image: item.image,
    url: SITE + item.canonicalUrl,
  }
}

export const lidl = {
  id: 'lidl',
  name: 'Lidl',
  async fetchProducts() {
    const now = Date.now() / 1000
    const products = new Map()
    for (const page of OFFER_PAGES) {
      const html = await request(page)
      for (const [, data] of html.matchAll(/data-grid-data="([^"]+)"/g)) {
        const item = JSON.parse(decode(data))
        if (item.category !== 'Food' || !(item.price?.price > 0) || products.has(item.productId)) continue
        if (item.storeStartDate && item.storeStartDate > now) continue
        const product = toProduct(item)
        if (product) products.set(item.productId, product)
      }
    }
    return { products: [...products.values()], location: 'ofertas de la semana' }
  },
}
