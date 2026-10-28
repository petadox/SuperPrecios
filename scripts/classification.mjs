import { readFile, writeFile } from 'node:fs/promises'
import { decryptJson, encryptJson, keyFromBase64 } from '../src/crypto.js'

// What each product is, decided once by Claude (see CLASIFICACION.md) and kept
// encrypted in the repo; the daily run only applies it. Keyed by normalised
// product name, since a name means the same product in every chain and format.
//   { [key]: [type, brand, product] }
//     type     "Refresco de cola sin azúcar" (what it is, no brand)
//     brand    "Coca-Cola"
//     product  "Coca-Cola Zero", only for branded products searched by name
const FILE = new URL('../classification.bin', import.meta.url)

export function classificationKey(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

async function key() {
  if (!process.env.HOME_DATA_KEY) throw new Error('Falta HOME_DATA_KEY')
  return keyFromBase64(process.env.HOME_DATA_KEY)
}

export async function loadClassification() {
  let bytes
  try {
    bytes = new Uint8Array(await readFile(FILE))
  } catch {
    return new Map()
  }
  return new Map(Object.entries(await decryptJson(await key(), bytes)))
}

export async function saveClassification(map) {
  const sorted = Object.fromEntries([...map].sort(([a], [b]) => a.localeCompare(b)))
  await writeFile(FILE, await encryptJson(await key(), sorted))
}

// A store brand only sells in its own chains; a store brand on another chain's
// product is a classification slip copied from a neighbouring line.
const STORE_BRANDS = [
  [/^dia\b/, ['dia']],
  [/^(hacendado|deliplus|bosque verde|compy|solcare)\b/, ['mercadona']],
  [/^consum\b/, ['consum']],
  [/^eroski\b/, ['eroski', 'caprabo']],
  [/^bonarea\b/, ['bonarea']],
]

function brandFor(brand, chain) {
  const plain = classificationKey(brand ?? '')
  const store = STORE_BRANDS.find(([re]) => re.test(plain))
  return store && !store[1].includes(chain) ? '' : brand
}

// Products nobody has classified yet stand alone under their own name.
export function applyClassification(products, map) {
  const missing = []
  for (const p of products) {
    const entry = map.get(classificationKey(p.name))
    if (entry) {
      const [type, brand, product] = entry
      p.type = type
      p.brandName = brandFor(brand, p.chain)
      p.product = product
    } else {
      p.type = p.name
      missing.push(p.name)
    }
  }
  return missing
}
