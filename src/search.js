import { normalize } from './utils/text.js'

// Mirrors the word handling in scripts/product-types.mjs so query words
// compare with type keys: "huevos" → "huevo".
function singular(word) {
  if (word.length <= 3 || !word.endsWith('s')) return word
  if (/[lnrdj]es$/.test(word)) return word.slice(0, -2)
  return word.slice(0, -1)
}

export function queryWords(query) {
  return normalize(query).split(/\s+/).filter(Boolean)
}

export function matchProducts(products, { query, category, hiddenChains }) {
  const words = queryWords(query)
  if (words.length === 0 && !category) return []
  return products.filter(
    (p) =>
      !hiddenChains.has(p.chain) &&
      (!category || p.category === category) &&
      words.every((w) => p.search.includes(w)),
  )
}

// How well a product type answers the query, in tiers:
//   3  the type is exactly the query ("Leche entera")
//   2  it contains every query word and starts with one ("Leche entera sin lactosa")
//   1  it contains every query word ("Chocolate con leche y almendras")
//   0  the words only matched the pack format or part of a word
function tier(type, typeName, wanted) {
  if (wanted.length === 0) return 0
  const keys = type.split(' ')
  if (!wanted.every((w) => keys.includes(w))) return 0
  if (keys.length === wanted.length) return 3
  const head = singular(normalize(typeName.split(' ')[0] ?? ''))
  return wanted.includes(head) ? 2 : 1
}

// Within a tier, types sold by more chains compare better and come first.
// Same connecting words product types leave out ("pan de molde" → pan molde).
const STOPWORDS = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'con', 'en', 'y', 'e', 'a', 'al', 'para', 'por', 'o', 'un', 'una'])

export function groupByType(matches, query) {
  const wanted = queryWords(query)
    .filter((w) => !STOPWORDS.has(w))
    .map(singular)
  const types = new Map()
  for (const p of matches) {
    if (!types.has(p.type)) types.set(p.type, { type: p.type, name: p.typeName, items: [], chains: new Set() })
    const t = types.get(p.type)
    t.items.push(p)
    t.chains.add(p.chain)
  }
  return [...types.values()]
    .map((t) => ({ ...t, tier: tier(t.type, t.name, wanted) }))
    .sort((a, b) => b.tier - a.tier || b.chains.size - a.chains.size || b.items.length - a.items.length)
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
