import { normalize } from './utils/text.js'

const STOPWORDS = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'con', 'en', 'y', 'e', 'a', 'al', 'para', 'por', 'o', 'un', 'una'])

// "Coca-Cola" and "coca cola", "huevos" and "huevo" compare equal.
function words(text) {
  return normalize(text)
    .split(/[^a-z0-9ñ]+/)
    .filter((w) => w && !STOPWORDS.has(w))
    .map((w) => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w))
}

export function searchText(p) {
  return normalize([p.name, p.format, p.type, p.product, p.brandName].filter(Boolean).join(' '))
}

export function matchProducts(products, { query, category, hiddenChains }) {
  const wanted = normalize(query).split(/\s+/).filter(Boolean)
  if (wanted.length === 0 && !category) return []
  return products.filter(
    (p) =>
      !hiddenChains.has(p.chain) &&
      (!category || p.category === category) &&
      wanted.every((w) => p.search.includes(w)),
  )
}

// Searching a brand ("coca cola", "dia") groups that brand's products by what
// they are: "Coca-Cola · Refresco de cola", "Coca-Cola · Refresco de cola sin
// azúcar"… Sub-brands that start with the query ("Coca-Cola Zero", "Dia
// Láctea") join their parent. Anything else ("leche entera", "refresco de
// cola") groups by what the product is, across brands.
function brandMatch(p, wanted) {
  const brand = words(p.brandName ?? '')
  return wanted.length > 0 && wanted.length <= brand.length && wanted.every((w, i) => brand[i] === w)
}

function cardOf(p, wanted) {
  if (brandMatch(p, wanted)) return { key: `b:${p.type}`, name: p.type, byBrand: true }
  return { key: `t:${p.type}`, name: p.type, byBrand: false }
}

// The brand as the products spell it, preferring the exact one over sub-brands.
function brandLabel(items, wanted) {
  const counts = new Map()
  for (const p of items) counts.set(p.brandName, (counts.get(p.brandName) ?? 0) + 1)
  const exact = [...counts].filter(([b]) => words(b).length === wanted.length)
  return [...(exact.length ? exact : counts)].sort((a, b) => b[1] - a[1])[0][0]
}

//   3  the card is exactly the query ("Leche entera", "Coca-Cola")
//   2  it has every query word and starts with one ("Leche entera sin lactosa")
//   1  it has every query word ("Chocolate con leche")
//   0  the words matched elsewhere (format, brand, part of a word)
function tier(name, wanted) {
  if (wanted.length === 0) return 0
  const have = words(name)
  if (!wanted.every((w) => have.includes(w))) return 0
  if (have.length === wanted.length) return 3
  return wanted.includes(have[0]) ? 2 : 1
}

// Brand cards come first when the query is a brand. Within a tier, cards sold
// by more chains compare better; among a brand's cards the plainer type (the
// regular Coca-Cola before its variants) goes first.
export function groupProducts(matches, query) {
  const wanted = words(query)
  const cards = new Map()
  for (const p of matches) {
    const { key, name, byBrand } = cardOf(p, wanted)
    if (!cards.has(key)) cards.set(key, { key, name, byBrand, items: [], chains: new Set() })
    const card = cards.get(key)
    card.items.push(p)
    card.chains.add(p.chain)
  }
  return [...cards.values()]
    .map((c) => {
      if (!c.byBrand) return { ...c, tier: tier(c.name, wanted), plainness: 0 }
      return { ...c, name: `${brandLabel(c.items, wanted)} · ${c.name}`, tier: 4, plainness: -words(c.name).length }
    })
    .sort(
      (a, b) =>
        b.tier - a.tier ||
        b.chains.size - a.chains.size ||
        b.plainness - a.plainness ||
        b.items.length - a.items.length,
    )
}

export function groupByUnit(items) {
  const byUnit = new Map()
  for (const p of items) {
    if (!byUnit.has(p.unit)) byUnit.set(p.unit, [])
    byUnit.get(p.unit).push(p)
  }
  return [...byUnit]
    .map(([unit, list]) => ({ unit, items: list.sort((a, b) => a.unitPrice - b.unitPrice) }))
    .sort((a, b) => b.items.length - a.items.length)
}
