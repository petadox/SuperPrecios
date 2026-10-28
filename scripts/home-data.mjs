import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { decryptJson, encryptJson, keyFromBase64 } from '../src/crypto.js'

// Moves the chains fetched at home through the public home-data branch,
// encrypted with HOME_DATA_KEY:
//   pack <dir>    data/<id>.json → <dir>/<id>.bin   (on the Mac)
//   unpack <dir>  <dir>/<id>.bin → data/<id>.json   (in CI)
const HOME_CHAINS = ['eroski', 'caprabo']
const DATA_DIR = new URL('../data/', import.meta.url)

const [command, dir] = process.argv.slice(2)
if (!['pack', 'unpack'].includes(command) || !dir) throw new Error('Uso: home-data.mjs pack|unpack <directorio>')
if (!process.env.HOME_DATA_KEY) throw new Error('Falta HOME_DATA_KEY')

const key = await keyFromBase64(process.env.HOME_DATA_KEY)
const other = pathToFileURL(`${resolve(dir)}/`)
await mkdir(command === 'pack' ? other : DATA_DIR, { recursive: true })

for (const id of HOME_CHAINS) {
  const [from, to] = command === 'pack' ? [DATA_DIR, other] : [other, DATA_DIR]
  try {
    await copyFile(new URL(`${id}.meta.json`, from), new URL(`${id}.meta.json`, to))
  } catch {
    console.warn(`${id}: sin datos, se omite`)
    continue
  }
  if (command === 'pack') {
    const products = JSON.parse(await readFile(new URL(`${id}.json`, DATA_DIR), 'utf8'))
    await writeFile(new URL(`${id}.bin`, other), await encryptJson(key, products))
  } else {
    const products = await decryptJson(key, new Uint8Array(await readFile(new URL(`${id}.bin`, other))))
    await writeFile(new URL(`${id}.json`, DATA_DIR), JSON.stringify(products))
  }
  console.log(`${id}: ${command === 'pack' ? 'empaquetado' : 'desempaquetado'}`)
}
