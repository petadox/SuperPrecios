import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { bonarea } from './chains/bonarea.mjs'
import { caprabo } from './chains/caprabo.mjs'
import { consum } from './chains/consum.mjs'
import { dia } from './chains/dia.mjs'
import { eroski } from './chains/eroski.mjs'
import { mercadona } from './chains/mercadona.mjs'

// Add a new chain here: an object with id, name and fetchProducts().
const CHAINS = [mercadona, dia, consum, eroski, caprabo, bonarea]

const OUT_DIR = new URL('../public/data/', import.meta.url)
const INDEX = new URL('index.json', OUT_DIR)

// `npm run fetch -- dia consum` refreshes only those chains and keeps the rest.
const only = process.argv.slice(2)
const selected = only.length ? CHAINS.filter((c) => only.includes(c.id)) : CHAINS
if (selected.length === 0) throw new Error(`Cadenas desconocidas: ${only.join(', ')}`)

await mkdir(OUT_DIR, { recursive: true })

// Each chain is a different site, so they are fetched in parallel. A chain that
// fails is left out so the others still get published.
const settled = await Promise.allSettled(
  selected.map(async (chain) => {
    const started = Date.now()
    const { products, location } = await chain.fetchProducts()
    if (products.length === 0) throw new Error(`${chain.name}: 0 productos`)
    await writeFile(new URL(`${chain.id}.json`, OUT_DIR), JSON.stringify(products))
    console.log(`${chain.name}: ${products.length} productos en ${((Date.now() - started) / 1000).toFixed(0)}s`)
    return { id: chain.id, name: chain.name, count: products.length, location }
  }),
)

const results = settled.filter((s) => s.status === 'fulfilled').map((s) => s.value)
const failures = settled.filter((s) => s.status === 'rejected')
for (const { reason } of failures) console.error(`::warning::Se omite una cadena: ${reason.message}`)
if (results.length === 0) throw new Error('No se pudo descargar ninguna cadena')

const previous = only.length ? await readIndex() : []
const chains = CHAINS.map((c) => results.find((r) => r.id === c.id) ?? previous.find((p) => p.id === c.id)).filter(Boolean)
await writeFile(INDEX, JSON.stringify({ updatedAt: new Date().toISOString(), chains }, null, 2))

async function readIndex() {
  try {
    return JSON.parse(await readFile(INDEX, 'utf8')).chains
  } catch {
    return []
  }
}
