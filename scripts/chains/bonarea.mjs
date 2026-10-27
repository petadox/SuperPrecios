const SITE = 'https://www.bonarea-online.com'
const HEADERS = {
  'User-Agent': 'SuperPrecios (uso personal)',
  'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
}

// Food, drinks, cleaning and personal care; the shop also sells tools, clothes…
const FAMILIES = ['13*300', '13*310', '13*320', '13*330', '13*340']

// The label names the pack's unit, not the price's: "11,77 €/cl." on a 75 cl
// bottle at 8,83 € is per litre, "9,80 €/g." on 100 g at 0,98 € is per kilo.
const UNITS = {
  kg: { unit: 'kg', factor: 1 },
  g: { unit: 'kg', factor: 1 },
  l: { unit: 'L', factor: 1 },
  cl: { unit: 'L', factor: 1 },
  ml: { unit: 'L', factor: 1 },
  u: { unit: 'ud', factor: 1 },
  d: { unit: 'lavado', factor: 1 },
  m: { unit: 'm', factor: 1 },
}

function decode(text) {
  return text
    .replaceAll('&middot;', '·')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&amp;', '&')
    .trim()
}

// The shop's own category pages load their articles with this read-only call.
async function shoppingBody(reference) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${SITE}/es/shop/ShoppingBody`, {
      method: 'POST',
      headers: HEADERS,
      body: new URLSearchParams({ reference }),
    })
    if (res.ok && res.headers.get('content-type')?.includes('application/json')) return res.json()
    if (attempt === 3) throw new Error(`bonÀrea ${res.status} en ${reference}`)
    await sleep(2000 * attempt)
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function leaves(node, path, out) {
  if (!node.children?.length) {
    out.push({ id: node.identifier, path })
    return out
  }
  for (const child of node.children) leaves(child, [...path, child.descripcio], out)
  return out
}

function parseUnitPrice(text) {
  const match = text?.match(/([\d.]*\d,\d+)\s*€\s*\/\s*([a-zà-ú]+)/i)
  if (!match) return null
  const value = Number(match[1].replaceAll('.', '').replace(',', '.'))
  const format = match[2].toLowerCase()
  const { unit, factor } = UNITS[format] ?? { unit: format, factor: 1 }
  const unitPrice = Math.round(value * factor * 1000) / 1000
  return unitPrice > 0 ? { unit, unitPrice } : null
}

function toProduct(article, leaf) {
  const perUnit = parseUnitPrice(article.unitPrice)
  if (!perUnit || !(article.priceToPay > 0)) return null
  return {
    id: `bonarea:${article.identifier}`,
    chain: 'bonarea',
    name: decode(article.description),
    format: decode(article.measurementUnit ?? ''),
    price: article.priceToPay,
    ...perUnit,
    category: leaf.path[1] ?? leaf.path[0],
    subcategory: leaf.path.at(-1),
    image: article.image?.[0] ? `https://images.bonarea.com/${article.image[0]}?width=175&height=175` : '',
    url: article.urlFriendly,
  }
}

export const bonarea = {
  id: 'bonarea',
  name: 'bonÀrea',
  async fetchProducts() {
    const { nivells } = await shoppingBody(FAMILIES[0])
    const families = nivells.filter((n) => FAMILIES.includes(n.identifier))
    if (families.length === 0) throw new Error('bonÀrea: no se encontraron categorías')
    const targets = families.flatMap((family) => leaves(family, [family.descripcio], []))

    const products = new Map()
    for (const leaf of targets) {
      const { articles = [] } = await shoppingBody(leaf.id)
      for (const article of articles) {
        if (products.has(article.identifier) || !article.isValid) continue
        const product = toProduct(article, leaf)
        if (product) products.set(article.identifier, product)
      }
      await sleep(200)
    }
    return { products: [...products.values()], location: 'web' }
  },
}
