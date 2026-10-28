// Shared by the build scripts (Node) and the browser: data is gzipped, then
// encrypted with AES-GCM. A file is the 12-byte IV followed by the ciphertext.
const encoder = new TextEncoder()
const decoder = new TextDecoder()

export const KDF_ITERATIONS = 300_000

export function toBase64(bytes) {
  let text = ''
  for (const byte of bytes) text += String.fromCharCode(byte)
  return btoa(text)
}

export function fromBase64(text) {
  return Uint8Array.from(atob(text), (c) => c.charCodeAt(0))
}

export async function keyFromPassword(password, salt, iterations) {
  const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export function keyFromBase64(text) {
  return crypto.subtle.importKey('raw', fromBase64(text), 'AES-GCM', false, ['encrypt', 'decrypt'])
}

async function pipe(bytes, transform) {
  const stream = new Blob([bytes]).stream().pipeThrough(transform)
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

export async function encryptJson(key, value) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const packed = await pipe(encoder.encode(JSON.stringify(value)), new CompressionStream('gzip'))
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, packed))
  const out = new Uint8Array(iv.length + cipher.length)
  out.set(iv)
  out.set(cipher, iv.length)
  return out
}

// Throws when the key is wrong: AES-GCM rejects data it did not encrypt.
export async function decryptJson(key, bytes) {
  const packed = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12) }, key, bytes.slice(12))
  const plain = await pipe(new Uint8Array(packed), new DecompressionStream('gzip'))
  return JSON.parse(decoder.decode(plain))
}
