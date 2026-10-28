import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { bonarea } from './chains/bonarea.mjs'
import { caprabo } from './chains/caprabo.mjs'
import { consum } from './chains/consum.mjs'
import { dia } from './chains/dia.mjs'
import { eroski } from './chains/eroski.mjs'
import { lidl } from './chains/lidl.mjs'
import { mercadona } from './chains/mercadona.mjs'

// Add a new chain here: an object with id, name and fetchProducts().
const CHAINS = [mercadona, dia, consum, eroski, caprabo, bonarea, lidl]

// These block GitHub's servers: they are fetched from home by
// scripts/fetch-at-home.sh and reach CI through the home-data branch.
const HOME_CHAINS = ['eroski', 'caprabo']

// Plain data stays out of public/: only scripts/encrypt-data.mjs publishes it.
const DATA_DIR = new URL('../data/', import.meta.url)

// `npm run fetch -- dia consum` refreshes only those chains and keeps the rest.
const only = process.argv.slice(2)
const selected = (only.length ? CHAINS.filter((c) => only.includes(c.id)) : CHAINS).filter(
  (c) => !(process.env.CI && HOME_CHAINS.includes(c.id)),
)
if (selected.length === 0) throw new Error(`Cadenas desconocidas: ${only.join(', ')}`)

await mkdir(DATA_DIR, { recursive: true })

// Each chain is a different site, so they are fetched in parallel. A chain that
// fails is left out so the others still get published.
const settled = await Promise.allSettled(
  selected.map(async (chain) => {
    const started = Date.now()
    const { products, location } = await chain.fetchProducts()
    if (products.length === 0) throw new Error(`${chain.name}: 0 productos`)
    const meta = { id: chain.id, name: chain.name, count: products.length, location, updatedAt: new Date().toISOString() }
    await writeFile(new URL(`${chain.id}.json`, DATA_DIR), JSON.stringify(products))
    await writeFile(new URL(`${chain.id}.meta.json`, DATA_DIR), JSON.stringify(meta))
    console.log(`${chain.name}: ${products.length} productos en ${((Date.now() - started) / 1000).toFixed(0)}s`)
  }),
)

const failures = settled.filter((s) => s.status === 'rejected')
for (const { reason } of failures) console.error(`::warning::Se omite una cadena: ${reason.message}`)
if (failures.length === selected.length) throw new Error('No se pudo descargar ninguna cadena')

// The index lists every chain with data on disk, fetched now or earlier.
const chains = []
for (const chain of CHAINS) {
  try {
    chains.push(JSON.parse(await readFile(new URL(`${chain.id}.meta.json`, DATA_DIR), 'utf8')))
  } catch {
    // Never fetched here.
  }
}
await writeFile(new URL('index.json', DATA_DIR), JSON.stringify({ updatedAt: new Date().toISOString(), chains }, null, 2))
