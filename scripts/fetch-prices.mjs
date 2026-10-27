import { mkdir, writeFile } from 'node:fs/promises'
import { mercadona } from './chains/mercadona.mjs'

// Add a new chain here: an object with id, name and fetchProducts().
const CHAINS = [mercadona]

const OUT_DIR = new URL('../public/data/', import.meta.url)

await mkdir(OUT_DIR, { recursive: true })

const index = { updatedAt: new Date().toISOString(), chains: [] }

for (const chain of CHAINS) {
  const started = Date.now()
  const { products, location } = await chain.fetchProducts()
  if (products.length === 0) throw new Error(`${chain.name}: 0 productos`)
  await writeFile(new URL(`${chain.id}.json`, OUT_DIR), JSON.stringify(products))
  index.chains.push({ id: chain.id, name: chain.name, count: products.length, location })
  console.log(`${chain.name}: ${products.length} productos en ${((Date.now() - started) / 1000).toFixed(0)}s`)
}

await writeFile(new URL('index.json', OUT_DIR), JSON.stringify(index, null, 2))
