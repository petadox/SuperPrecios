import { ref, shallowRef } from 'vue'
import { decryptJson, fromBase64, keyFromPassword } from './crypto'
import { normalize } from './utils/text'

const base = `${import.meta.env.BASE_URL}data/`

export const chains = ref([])
export const products = shallowRef([])

export class WrongPasswordError extends Error {}

// The password only unlocks today's data: it rotates daily, so a saved one
// that stops working sends the visitor back to the gate.
export async function unlock(password) {
  const { salt, iterations } = await (await download('crypto.json')).json()
  const key = await keyFromPassword(password, fromBase64(salt), iterations)
  let index
  try {
    index = await decryptJson(key, await bytes('index.bin'))
  } catch {
    throw new WrongPasswordError('Contraseña incorrecta')
  }
  const lists = await Promise.all(index.chains.map(async (c) => decryptJson(key, await bytes(`${c.id}.bin`))))
  products.value = lists.flat().map((p) => ({
    ...p,
    search: normalize([p.name, p.format].join(' ')),
  }))
  chains.value = index.chains
}

async function download(file) {
  const res = await fetch(base + file, { cache: 'no-cache' })
  if (!res.ok) throw new Error(`No se pudo cargar ${file} (${res.status})`)
  return res
}

async function bytes(file) {
  return new Uint8Array(await (await download(file)).arrayBuffer())
}
