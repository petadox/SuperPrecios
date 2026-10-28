// Lists the product names that have no classification yet and splits them
// into chunks for Claude subagents (see CLASIFICACION.md).
// Usage: HOME_DATA_KEY=… node scripts/classify/prepare.mjs [chunk size]
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { classificationKey, loadClassification } from '../classification.mjs'

const SIZE = Number(process.argv[2] ?? 2000)
const DATA_DIR = new URL('../../data/', import.meta.url)
const WORK = new URL('../../classify-work/', import.meta.url)

const index = JSON.parse(await readFile(new URL('index.json', DATA_DIR), 'utf8'))
const products = (
  await Promise.all(index.chains.map(async (c) => JSON.parse(await readFile(new URL(`${c.id}.json`, DATA_DIR), 'utf8'))))
).flat()
const known = await loadClassification()

const clean = (s) => String(s ?? '').replace(/[\t\n]+/g, ' ').trim()
const pending = new Map()
for (const p of products) {
  const key = classificationKey(p.name)
  if (known.has(key) || pending.has(key)) continue
  pending.set(key, [clean(p.name), clean(p.format), clean(`${p.category} › ${p.subcategory}`), clean(p.brand)])
}

// Alphabetical order keeps a product's variants and relatives next to each other.
const entries = [...pending].sort(([a], [b]) => a.localeCompare(b))
await rm(WORK, { recursive: true, force: true })
await mkdir(new URL('chunks/', WORK), { recursive: true })
await mkdir(new URL('out/', WORK), { recursive: true })
await writeFile(new URL('keys.json', WORK), JSON.stringify(entries.map(([key]) => key)))

const lines = entries.map(([, fields], i) => [i + 1, ...fields].join('\t'))
const chunks = []
for (let i = 0; i < lines.length; i += SIZE) chunks.push(lines.slice(i, i + SIZE))
for (const [i, chunk] of chunks.entries()) {
  await writeFile(new URL(`chunks/chunk-${String(i + 1).padStart(2, '0')}.tsv`, WORK), chunk.join('\n') + '\n')
}
console.log(`${entries.length} nombres sin clasificar en ${chunks.length} bloques (classify-work/chunks/)`)
