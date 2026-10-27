<script setup>
import { computed, ref } from 'vue'
import { formatPrice, unitLabel } from '../utils/text'

const PAGE = 30

const props = defineProps({
  unit: { type: String, required: true },
  items: { type: Array, required: true },
  chains: { type: Array, required: true },
})

const shown = ref(PAGE)

const chainName = computed(() => Object.fromEntries(props.chains.map((c) => [c.id, c.name])))

// Items are sorted by unit price, so each chain's first item is its cheapest.
const cheapestByChain = computed(() => {
  const seen = new Map()
  for (const p of props.items) if (!seen.has(p.chain)) seen.set(p.chain, p)
  return [...seen.values()]
})

const bestPrice = computed(() => props.items[0]?.unitPrice)
</script>

<template>
  <section class="group">
    <h2>Precio por {{ unitLabel(unit) }} <span class="muted">· {{ items.length }}</span></h2>

    <ol v-if="cheapestByChain.length > 1" class="ranking">
      <li v-for="p in cheapestByChain" :key="p.chain" :class="{ best: p.unitPrice === bestPrice }">
        <span class="badge" :data-chain="p.chain">{{ chainName[p.chain] }}</span>
        desde <strong>{{ formatPrice(p.unitPrice) }}/{{ unit }}</strong>
      </li>
    </ol>

    <ul class="products">
      <li
        v-for="p in items.slice(0, shown)"
        :key="p.id"
        class="product"
        :class="{ best: p.unitPrice === bestPrice }"
      >
        <img
          :src="p.image"
          alt=""
          loading="lazy"
          width="56"
          height="56"
          @error="$event.target.style.visibility = 'hidden'"
        />
        <div class="info">
          <a :href="p.url" target="_blank" rel="noopener" class="name">{{ p.name }}</a>
          <div class="meta">
            <span class="badge" :data-chain="p.chain">{{ chainName[p.chain] }}</span>
            <span class="muted">{{ p.format }}</span>
          </div>
        </div>
        <div class="prices">
          <strong>{{ formatPrice(p.unitPrice) }}/{{ unit }}</strong>
          <span class="muted">{{ formatPrice(p.price) }}</span>
        </div>
      </li>
    </ul>

    <button v-if="items.length > shown" class="more" @click="shown += PAGE">
      Mostrar más ({{ items.length - shown }})
    </button>
  </section>
</template>
