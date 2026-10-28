import { fetchOk, retry } from './http.mjs'

const SITE = 'https://www.dia.es'

// Any category page carries the whole menu tree in its embedded state.
const MENU_PAGE = '/huevos-leche-y-mantequilla/c/L108'

const UNITS = {
  KILO: { unit: 'kg', factor: 1 },
  '100 GR.': { unit: 'kg', factor: 10 },
  LITRO: { unit: 'L', factor: 1 },
  '100 ML.': { unit: 'L', factor: 10 },
  METRO: { unit: 'm', factor: 1 },
  UNIDAD: { unit: 'ud', factor: 1 },
  DOCENA: { unit: 'ud', factor: 1 / 12 },
  LAVADO: { unit: 'lavado', factor: 1 },
}

async function request(path, type) {
  return retry('Dia', async () => {
    const res = await fetchOk(SITE + path)
    const contentType = res.headers.get('content-type') ?? ''
    if (!contentType.includes(type)) throw new Error(`${contentType} en ${path}`)
    return res
  })
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchMenu() {
  const html = await (await request(MENU_PAGE, 'text/html')).text()
  const start = html.indexOf('"categoriesData":')
  if (start === -1) throw new Error('Dia: no se encontró el menú de categorías')
  const open = html.indexOf('{', start)
  let depth = 0
  let inString = false
  for (let i = open; i < html.length; i++) {
    const ch = html[i]
    if (inString) {
      if (ch === '\\') i++
      else if (ch === '"') inString = false
    } else if (ch === '"') inString = true
    else if (ch === '{') depth++
    else if (ch === '}' && --depth === 0) return JSON.parse(html.slice(open, i + 1)).categories
  }
  throw new Error('Dia: menú de categorías incompleto')
}

// "/huevos-leche-y-mantequilla/leche/p/608P6" → "/huevos-leche-y-mantequilla/leche"
function categoryPath(url) {
  return url.split('/').slice(0, 3).join('/')
}

function toProduct(item, category, subcategory) {
  const { price, price_per_unit: perUnit, measure_unit: measure } = item.prices
  const { unit, factor } = UNITS[measure] ?? { unit: measure?.toLowerCase() ?? 'ud', factor: 1 }
  return {
    id: `dia:${item.object_id}`,
    chain: 'dia',
    brand: item.brand ?? '',
    name: item.display_name,
    format: '',
    price,
    unitPrice: Math.round(perUnit * factor * 1000) / 1000,
    unit,
    category,
    subcategory,
    image: SITE + item.image,
    url: SITE + item.url,
  }
}

export const dia = {
  id: 'dia',
  name: 'Dia',
  async fetchProducts() {
    const menu = await fetchMenu()

    // A product sits under seasonal sections too (Navidad, Novedades…); its URL
    // names the section it really belongs to.
    const names = new Map()
    const subcategories = []
    for (const l1 of menu) {
      for (const l2 of l1.children ?? []) {
        if (l2.id === l1.id) continue
        names.set(l2.link.split('/c/')[0], { category: l1.name, subcategory: l2.name })
        subcategories.push({ ...l2, category: l1.name })
      }
    }

    const products = new Map()
    const failed = []
    for (const l2 of subcategories) {
      try {
        for (let page = 1, pages = 1; page <= pages; page++) {
          const res = await request(`/api/v1/plp-back/reduced${l2.link}?page=${page}`, 'application/json')
          const data = await res.json()
          pages = data.pagination?.total_pages ?? 1
          for (const item of data.plp_items ?? []) {
            if (products.has(item.object_id) || !item.prices) continue
            const canonical = names.get(categoryPath(item.url)) ?? { category: l2.category, subcategory: l2.name }
            products.set(item.object_id, toProduct(item, canonical.category, canonical.subcategory))
          }
          await sleep(200)
        }
      } catch (e) {
        console.warn(`Dia: se omite ${l2.link}: ${e.message}`)
        failed.push(l2.link)
      }
    }
    if (failed.length > subcategories.length * 0.1) {
      throw new Error(`Dia: fallaron ${failed.length} de ${subcategories.length} subcategorías`)
    }
    // Anonymous visitors get the web's default postcode.
    return { products: [...products.values()], location: 'CP 28041' }
  },
}
