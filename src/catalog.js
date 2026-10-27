import { ref, shallowRef } from 'vue'
import { normalize } from './utils/text'

const base = `${import.meta.env.BASE_URL}data/`

export const chains = ref([])
export const updatedAt = ref(null)
export const products = shallowRef([])
export const loading = ref(true)
export const error = ref(null)

export async function loadCatalog() {
  try {
    const index = await fetchJson('index.json')
    const lists = await Promise.all(index.chains.map((c) => fetchJson(`${c.id}.json`)))
    products.value = lists.flat().map((p) => ({
      ...p,
      search: normalize([p.name, p.format, p.subcategory, p.category].join(' ')),
    }))
    chains.value = index.chains
    updatedAt.value = index.updatedAt
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function fetchJson(file) {
  const res = await fetch(base + file)
  if (!res.ok) throw new Error(`No se pudo cargar ${file} (${res.status})`)
  return res.json()
}
