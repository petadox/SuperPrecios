// Merges the subagents' output into classification.bin.
// Usage: HOME_DATA_KEY=… node scripts/classify/merge.mjs [work dir]
//   <work dir>/keys.json         classification key of each input line (line n → keys[n-1])
//   <work dir>/out/chunk-*.json  written by collect.mjs: { n: { type, brand, product } }
import { readdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { loadClassification, saveClassification } from '../classification.mjs'

const work = pathToFileURL(`${resolve(process.argv[2] ?? 'classify-work')}/`)
const keys = JSON.parse(await readFile(new URL('keys.json', work), 'utf8'))

const results = {}
// chunk-14b.json and the like hold lines redone after a failed or drifted chunk.
for (const file of (await readdir(new URL('out/', work))).filter((f) => /^chunk-\d+[a-z]?\.json$/.test(f))) {
  Object.assign(results, JSON.parse(await readFile(new URL(`out/${file}`, work), 'utf8')))
}

const tidy = (text) => {
  const t = String(text ?? '').replace(/\s+/g, ' ').trim()
  return t && t.charAt(0).toUpperCase() + t.slice(1)
}
// Packs and cans that slipped into a type ("Refresco de cola pack 2").
const tidyType = (text) => tidy(text).replace(/\s+(pack \d+|mini lata)$/i, '')
const plain = (text) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
const STOP = new Set(['de', 'del', 'con', 'en', 'y', 'a', 'al', 'la', 'el'])
// "Leche entera con calcio" and "Leche entera calcio" are one type.
const sameType = (text) => [...new Set(plain(text).split(/[^a-z0-9ñ%.]+/).filter((w) => w && !STOP.has(w)))].sort().join(' ')

// Picks the most used spelling for values that only differ in case,
// accents or connecting words, across every chunk and the existing map.
function canonical(values, keyOf) {
  const counts = new Map()
  for (const v of values) {
    if (!v) continue
    const k = keyOf(v)
    if (!counts.has(k)) counts.set(k, new Map())
    counts.get(k).set(v, (counts.get(k).get(v) ?? 0) + 1)
  }
  const pick = new Map()
  for (const [k, spellings] of counts) pick.set(k, [...spellings].sort((a, b) => b[1] - a[1])[0][0])
  return (v) => (v ? pick.get(keyOf(v)) : '')
}

const map = await loadClassification()
const before = map.size
let added = 0
for (const [n, r] of Object.entries(results)) {
  const key = keys[Number(n) - 1]
  if (!key) throw new Error(`Línea ${n} sin clave`)
  map.set(key, [tidyType(r.type), tidy(r.brand), tidy(r.product)])
  added++
}

const entries = [...map.values()]
const type = canonical(entries.map((e) => e[0]), sameType)
const brand = canonical(entries.map((e) => e[1]), plain)
const product = canonical(entries.map((e) => e[2]), plain)
for (const [key, [t, b, p]] of map) map.set(key, [type(t), brand(b), product(p)])

await saveClassification(map)
const types = new Set([...map.values()].map((e) => e[0])).size
console.log(`Clasificación: ${before} → ${map.size} nombres (${added} de esta ronda), ${types} tipos`)
