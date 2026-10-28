import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { KDF_ITERATIONS, encryptJson, keyFromPassword, toBase64 } from '../src/crypto.js'

// Publishes data/ into public/data/ encrypted with SITE_PASSWORD, so the
// prices can only be read with the password even though Pages is public.
const DATA_DIR = new URL('../data/', import.meta.url)
const OUT_DIR = new URL('../public/data/', import.meta.url)

const password = process.env.SITE_PASSWORD
if (!password) throw new Error('Falta SITE_PASSWORD')

const salt = crypto.getRandomValues(new Uint8Array(16))
const key = await keyFromPassword(password, salt, KDF_ITERATIONS)

await rm(OUT_DIR, { recursive: true, force: true })
await mkdir(OUT_DIR, { recursive: true })

const index = JSON.parse(await readFile(new URL('index.json', DATA_DIR), 'utf8'))
await writeFile(new URL('crypto.json', OUT_DIR), JSON.stringify({ salt: toBase64(salt), iterations: KDF_ITERATIONS }))
await writeFile(new URL('index.bin', OUT_DIR), await encryptJson(key, index))
for (const chain of index.chains) {
  const products = JSON.parse(await readFile(new URL(`${chain.id}.json`, DATA_DIR), 'utf8'))
  await writeFile(new URL(`${chain.id}.bin`, OUT_DIR), await encryptJson(key, products))
}
console.log(`Cifradas ${index.chains.length} cadenas en public/data/`)
