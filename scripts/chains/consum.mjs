import { fetchOk, retry } from './http.mjs'

const API = 'https://tienda.consum.es/api/rest/V1.0'
const PAGE = 100

const UNITS = {
  '1 kg': { unit: 'kg', factor: 1 },
  '100 gr': { unit: 'kg', factor: 10 },
  '1 l': { unit: 'L', factor: 1 },
  '100 ml': { unit: 'L', factor: 10 },
  '1 u': { unit: 'ud', factor: 1 },
  '1 dc': { unit: 'ud', factor: 1 / 12 },
  '1 lv': { unit: 'lavado', factor: 1 },
  '1 m': { unit: 'm', factor: 1 },
  '1 do': { unit: 'dosis', factor: 1 },
}

// Promotional sections that repeat products from their real category.
const SKIP_SECTIONS = new Set(['Ahora más barato'])

async function get(path) {
  return retry('Consum', async () => (await fetchOk(API + path)).json())
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Products only name their deepest category; map every menu node to its
// first and second level.
function indexMenu(menu) {
  const sections = new Map()
  function walk(node, top, second) {
    sections.set(node.id, { category: top.name, subcategory: second.name, skip: SKIP_SECTIONS.has(top.name) })
    for (const child of node.subcategories ?? []) walk(child, top, second)
  }
  for (const top of menu) {
    for (const second of top.subcategories ?? []) walk(second, top, second)
  }
  return sections
}

function titleCase(text) {
  return text.toLowerCase().replace(/(^|[\s-])\p{L}/gu, (m) => m.toUpperCase())
}

function toProduct(p, section) {
  const { prices, unitPriceUnitType } = p.priceData
  const current = prices.find((pr) => pr.id === 'OFFER_PRICE') ?? prices.find((pr) => pr.id === 'PRICE')
  const format = unitPriceUnitType.toLowerCase()
  const { unit, factor } = UNITS[format] ?? { unit: format.replace(/^1 /, ''), factor: 1 }
  return {
    id: `consum:${p.code}`,
    chain: 'consum',
    brand: p.productData.brand?.name ?? '',
    name: [p.productData.description || p.productData.name, p.productData.brand && titleCase(p.productData.brand.name)]
      .filter(Boolean)
      .join(' '),
    format: '',
    price: current.value.centAmount,
    unitPrice: Math.round(current.value.centUnitAmount * factor * 1000) / 1000,
    unit,
    category: section.category,
    subcategory: section.subcategory,
    image: p.media?.[0]?.url ?? p.productData.imageURL,
    url: p.productData.url,
  }
}

export const consum = {
  id: 'consum',
  name: 'Consum',
  async fetchProducts() {
    const sections = indexMenu(await get('/shopping/category/menu/'))
    const unknown = { category: 'Otros', subcategory: 'Otros' }
    const products = []
    for (let offset = 0, more = true; more; offset += PAGE) {
      const page = await get(`/catalog/product?limit=${PAGE}&offset=${offset}`)
      for (const p of page.products) {
        const candidates = p.categories.map((c) => sections.get(c.id)).filter(Boolean)
        const section = candidates.find((s) => !s.skip) ?? candidates[0] ?? unknown
        if (p.priceData.prices.length) products.push(toProduct(p, section))
      }
      more = page.hasMore
      await sleep(200)
    }
    return { products, location: 'web' }
  },
}
