<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import basket from '../assets/market-basket.svg'
import { chains, products } from '../catalog'
import { groupByUnit, groupProducts, matchProducts } from '../search'
import { formatDate, formatPrice } from '../utils/text'
import ProductView from './ProductView.vue'

const SUGGESTIONS = ['leche', 'aceite oliva virgen extra', 'huevos', 'arroz', 'atún', 'café molido', 'papel higiénico', 'detergente']
const PAGE = 10

const emit = defineEmits(['logout'])

const params = new URLSearchParams(location.search)
const query = ref(params.get('q') ?? '')
const category = ref(params.get('cat') ?? '')
const openType = ref(params.get('tipo') ?? '')
const hiddenChains = ref(new Set())
const shown = ref(PAGE)

function url(type) {
  const next = new URLSearchParams()
  if (query.value.trim()) next.set('q', query.value.trim())
  if (category.value) next.set('cat', category.value)
  if (type) next.set('tipo', type)
  const search = next.toString()
  return search ? `?${search}` : location.pathname
}

watch([query, category], () => {
  openType.value = ''
  shown.value = PAGE
  history.replaceState(null, '', url(''))
})

// The product view gets its own history entry, so the phone's back gesture
// returns to the search instead of leaving the site.
let pushed = false

function openProduct(type) {
  openType.value = type
  pushed = true
  history.pushState(null, '', url(type))
  window.scrollTo({ top: 0 })
}

// Opened from a shared link there is no search entry to go back to.
function closeProduct() {
  if (pushed) {
    history.back()
    return
  }
  openType.value = ''
  history.replaceState(null, '', url(''))
}

function syncFromHistory() {
  openType.value = new URLSearchParams(location.search).get('tipo') ?? ''
  if (!openType.value) pushed = false
}

onMounted(() => window.addEventListener('popstate', syncFromHistory))
onUnmounted(() => window.removeEventListener('popstate', syncFromHistory))

const categories = computed(() =>
  [...new Set(products.value.map((p) => p.category))].sort((a, b) => a.localeCompare(b, 'es')),
)

const matches = computed(() =>
  matchProducts(products.value, { query: query.value, category: category.value, hiddenChains: hiddenChains.value }),
)

const chainName = computed(() => Object.fromEntries(chains.value.map((c) => [c.id, c.name])))

// "Mercadona, Dia y 3 más" keeps a tie readable on a phone.
function listNames(names) {
  if (names.length <= 2) return names.join(' y ')
  return `${names.slice(0, 2).join(', ')} y ${names.length - 2} más`
}

// One card per kind of product ("Leche entera", "Leche desnatada sin lactosa"…),
// showing the cheapest option in the unit most of its products are sold by.
const types = computed(() =>
  groupProducts(matches.value, query.value).map((t) => {
    const units = groupByUnit(t.items)
    const main = units[0]
    const best = main.items[0]
    const winners = [...new Set(main.items.filter((p) => p.unitPrice === best.unitPrice).map((p) => chainName.value[p.chain]))]
    return { ...t, units, best, unit: main.unit, winners: listNames(winners) }
  }),
)

const selected = computed(() => types.value.find((t) => t.key === openType.value))

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

    <p v-else-if="types.length === 0" class="muted">No hay productos que coincidan.</p>

    <ProductView
      v-else-if="selected"
      :title="selected.name"
      :groups="selected.units"
      :chains="chains"
      :total="selected.items.length"
      @back="closeProduct"
    />

    <template v-else>
      <p class="muted count">
        {{ types.length }} {{ types.length === 1 ? 'tipo de producto' : 'tipos de producto' }} ·
        {{ matches.length }} productos
      </p>
      <ul class="result-list">
        <li v-for="t in types.slice(0, shown)" :key="t.key">
          <button class="result-card" type="button" @click="openProduct(t.key)">
            <img
              :src="t.best.image"
              alt=""
              class="result-image"
              width="72"
              height="72"
              loading="lazy"
              @error="$event.target.style.visibility = 'hidden'"
            />
            <span class="result-body">
              <span class="result-title">{{ t.name }}</span>
              <span class="result-price">
                Desde <strong>{{ formatPrice(t.best.unitPrice) }}/{{ t.unit }}</strong> en {{ t.winners }}
              </span>
              <span class="muted result-meta">
                {{ t.items.length }} {{ t.items.length === 1 ? 'producto' : 'productos' }} en {{ t.chains.size }}
                {{ t.chains.size === 1 ? 'supermercado' : 'supermercados' }}
              </span>
            </span>
            <span class="result-chevron" aria-hidden="true">›</span>
          </button>
        </li>
      </ul>
      <button v-if="types.length > shown" class="more" type="button" @click="shown += PAGE">
        Mostrar más tipos ({{ types.length - shown }})
      </button>
    </template>
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
