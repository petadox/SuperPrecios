import { fetchOk, retry } from './http.mjs'

const API = 'https://tienda.mercadona.es/api'

// Prices and range depend on the warehouse that serves a postcode.
const WAREHOUSE = process.env.MERCADONA_WAREHOUSE ?? 'bcn1'

// Every chain reports unit prices in kg, L or ud so they can be compared.
const UNITS = {
  kg: { unit: 'kg', factor: 1 },
  '100 g': { unit: 'kg', factor: 10 },
  l: { unit: 'L', factor: 1 },
  '100 ml': { unit: 'L', factor: 10 },
  ud: { unit: 'ud', factor: 1 },
  dz: { unit: 'ud', factor: 1 / 12 },
  dc: { unit: 'ud', factor: 1 / 12 },
  lv: { unit: 'lavado', factor: 1 },
}

function unitPrice(pi) {
  const format = pi.reference_format?.toLowerCase()
  const { unit, factor } = UNITS[format] ?? { unit: format ?? 'ud', factor: 1 }
  return { unit, unitPrice: Math.round(Number(pi.reference_price ?? pi.bulk_price) * factor * 1000) / 1000 }
}

async function get(path) {
  const url = `${API}${path}${path.includes('?') ? '&' : '?'}lang=es&wh=${WAREHOUSE}`
  return retry('Mercadona', async () => (await fetchOk(url)).json())
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function toProduct(p, category, subcategory) {
  const pi = p.price_instructions
  const size = pi.unit_size ? `${String(pi.unit_size).replace('.', ',')} ${pi.size_format}` : ''
  return {
    id: `mercadona:${p.id}`,
    chain: 'mercadona',
    name: p.display_name,
    format: [p.packaging, size].filter(Boolean).join(' · '),
    price: Number(pi.unit_price),
    ...unitPrice(pi),
    category,
    subcategory,
    image: p.thumbnail,
    url: p.share_url,
  }
}

export const mercadona = {
  id: 'mercadona',
  name: 'Mercadona',
  async fetchProducts() {
    const { results: sections } = await get('/categories/')
    const products = new Map()
    for (const section of sections) {
      for (const { id } of section.categories) {
        const detail = await get(`/categories/${id}/`)
        for (const sub of detail.categories ?? []) {
          for (const p of sub.products ?? []) {
            if (!p.published || products.has(p.id)) continue
            products.set(p.id, toProduct(p, section.name, detail.name))
          }
        }
        await sleep(200)
      }
    }
    return { products: [...products.values()], location: WAREHOUSE }
  },
}
