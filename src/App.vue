<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { chains, error, loadCatalog, loading, products, updatedAt } from './catalog'
import { formatDate, normalize } from './utils/text'
import UnitGroup from './components/UnitGroup.vue'

const SUGGESTIONS = ['leche entera', 'aceite oliva virgen extra', 'huevos', 'arroz', 'atún', 'café molido', 'papel higiénico', 'detergente']

const params = new URLSearchParams(location.search)
const query = ref(params.get('q') ?? '')
const category = ref(params.get('cat') ?? '')
const hiddenChains = ref(new Set())

watch([query, category], () => {
  const next = new URLSearchParams()
  if (query.value.trim()) next.set('q', query.value.trim())
  if (category.value) next.set('cat', category.value)
  const search = next.toString()
  history.replaceState(null, '', search ? `?${search}` : location.pathname)
})

onMounted(loadCatalog)

const categories = computed(() =>
  [...new Set(products.value.map((p) => p.category))].sort((a, b) => a.localeCompare(b, 'es')),
)

const matches = computed(() => {
  const words = normalize(query.value).split(/\s+/).filter(Boolean)
  if (words.length === 0 && !category.value) return []
  return products.value.filter(
    (p) =>
      !hiddenChains.value.has(p.chain) &&
      (!category.value || p.category === category.value) &&
      words.every((w) => p.search.includes(w)),
  )
})

const groups = computed(() => {
  const byUnit = new Map()
  for (const p of matches.value) {
    if (!byUnit.has(p.unit)) byUnit.set(p.unit, [])
    byUnit.get(p.unit).push(p)
  }
  return [...byUnit]
    .map(([unit, items]) => ({ unit, items: items.sort((a, b) => a.unitPrice - b.unitPrice) }))
    .sort((a, b) => b.items.length - a.items.length)
})

function toggleChain(id) {
  const next = new Set(hiddenChains.value)
  next.has(id) ? next.delete(id) : next.add(id)
  hiddenChains.value = next
}
</script>

<template>
  <header class="header">
    <div class="wrap">
      <h1>🛒 SuperPrecios</h1>
      <p class="muted">Compara el precio por kilo, litro o unidad entre supermercados.</p>
    </div>
  </header>

  <main class="wrap">
    <p v-if="loading" class="muted">Cargando precios…</p>
    <p v-else-if="error" class="error">{{ error }}</p>

    <template v-else>
      <section class="controls">
        <input
          v-model="query"
          class="search"
          type="search"
          placeholder="¿Qué buscas? Ej. leche entera"
          autofocus
        />
        <div class="filters">
          <select v-model="category" class="select">
            <option value="">Todas las categorías</option>
            <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
          </select>
          <button
            v-for="c in chains"
            :key="c.id"
            class="chip"
            :class="{ off: hiddenChains.has(c.id) }"
            :data-chain="c.id"
            @click="toggleChain(c.id)"
          >
            {{ c.name }}
          </button>
        </div>
      </section>

      <section v-if="!query.trim() && !category" class="empty">
        <p class="muted">Prueba con:</p>
        <div class="suggestions">
          <button v-for="s in SUGGESTIONS" :key="s" class="chip" @click="query = s">{{ s }}</button>
        </div>
      </section>

      <p v-else-if="matches.length === 0" class="muted">No hay productos que coincidan.</p>

      <template v-else>
        <p class="muted">{{ matches.length }} productos</p>
        <UnitGroup
          v-for="g in groups"
          :key="g.unit + query + category"
          :unit="g.unit"
          :items="g.items"
          :chains="chains"
        />
      </template>
    </template>
  </main>

  <footer v-if="updatedAt" class="wrap footer muted">
    Precios actualizados el {{ formatDate(updatedAt) }} ·
    <span v-for="(c, i) in chains" :key="c.id">
      {{ c.name }} ({{ c.count }} productos, zona {{ c.location }}){{ i < chains.length - 1 ? ' · ' : '' }}
    </span>
  </footer>
</template>
