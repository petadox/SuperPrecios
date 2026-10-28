<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import basket from '../assets/market-basket.svg'
import { chains, products } from '../catalog'
import { formatDate, formatPrice, normalize } from '../utils/text'
import ProductView from './ProductView.vue'

const SUGGESTIONS = ['leche entera', 'aceite oliva virgen extra', 'huevos', 'arroz', 'atún', 'café molido', 'papel higiénico', 'detergente']

const emit = defineEmits(['logout'])

const params = new URLSearchParams(location.search)
const query = ref(params.get('q') ?? '')
const category = ref(params.get('cat') ?? '')
const open = ref(params.get('ver') === '1')
const hiddenChains = ref(new Set())

function url(withProduct) {
  const next = new URLSearchParams()
  if (query.value.trim()) next.set('q', query.value.trim())
  if (category.value) next.set('cat', category.value)
  if (withProduct) next.set('ver', '1')
  const search = next.toString()
  return search ? `?${search}` : location.pathname
}

watch([query, category], () => {
  open.value = false
  history.replaceState(null, '', url(false))
})

// The product view gets its own history entry, so the phone's back gesture
// returns to the search instead of leaving the site.
let pushed = false

function openProduct() {
  open.value = true
  pushed = true
  history.pushState(null, '', url(true))
  window.scrollTo({ top: 0 })
}

// Opened from a shared link there is no search entry to go back to.
function closeProduct() {
  if (pushed) {
    history.back()
    return
  }
  open.value = false
  history.replaceState(null, '', url(false))
}

function syncFromHistory() {
  open.value = new URLSearchParams(location.search).get('ver') === '1'
  if (!open.value) pushed = false
}

onMounted(() => window.addEventListener('popstate', syncFromHistory))
onUnmounted(() => window.removeEventListener('popstate', syncFromHistory))

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

const title = computed(() => {
  const text = query.value.trim() || category.value
  return text.charAt(0).toUpperCase() + text.slice(1)
})

const chainName = computed(() => Object.fromEntries(chains.value.map((c) => [c.id, c.name])))

// What the single result card shows: the cheapest option in the unit most
// products are sold by.
const summary = computed(() => {
  const main = groups.value[0]
  if (!main) return null
  const best = main.items[0]
  const tied = new Set(main.items.filter((p) => p.unitPrice === best.unitPrice).map((p) => chainName.value[p.chain]))
  return {
    best,
    unit: main.unit,
    winners: [...tied].join(', '),
    chainCount: new Set(matches.value.map((p) => p.chain)).size,
  }
})

function toggleChain(id) {
  const next = new Set(hiddenChains.value)
  next.has(id) ? next.delete(id) : next.add(id)
  hiddenChains.value = next
}
</script>

<template>
  <header class="header gingham">
    <div class="wrap header-row">
      <div class="brand">
        <img :src="basket" alt="" class="brand-basket" width="480" height="430" />
        <div>
          <p class="eyebrow">Tu compra, más barata</p>
          <h1 class="title">SuperPrecios</h1>
        </div>
      </div>
      <button class="link-button" type="button" @click="emit('logout')">Salir</button>
    </div>
  </header>

  <main class="wrap">
    <section class="controls">
      <input v-model="query" class="search" type="search" placeholder="¿Qué buscas? Ej. leche entera" autofocus />
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
      <p class="muted">¿Qué te falta en la despensa? Prueba con:</p>
      <div class="suggestions">
        <button v-for="s in SUGGESTIONS" :key="s" class="chip" @click="query = s">{{ s }}</button>
      </div>
    </section>

    <p v-else-if="!summary" class="muted">No hay productos que coincidan.</p>

    <ProductView
      v-else-if="open"
      :title="title"
      :groups="groups"
      :chains="chains"
      :total="matches.length"
      @back="closeProduct"
    />

    <button v-else class="result-card" type="button" @click="openProduct">
      <img
        :src="summary.best.image"
        alt=""
        class="result-image"
        width="72"
        height="72"
        @error="$event.target.style.visibility = 'hidden'"
      />
      <span class="result-body">
        <span class="result-title">{{ title }}</span>
        <span class="result-price">
          Desde <strong>{{ formatPrice(summary.best.unitPrice) }}/{{ summary.unit }}</strong> en {{ summary.winners }}
        </span>
        <span class="muted result-meta">
          {{ matches.length }} productos en {{ summary.chainCount }}
          {{ summary.chainCount === 1 ? 'supermercado' : 'supermercados' }}
        </span>
      </span>
      <span class="result-chevron" aria-hidden="true">›</span>
    </button>
  </main>

  <footer class="wrap footer muted">
    <p>Precios actualizados:</p>
    <ul class="footer-list">
      <li v-for="c in chains" :key="c.id">
        {{ c.name }}: {{ formatDate(c.updatedAt) }} · {{ c.count }} productos · {{ c.location }}
      </li>
    </ul>
  </footer>
</template>
