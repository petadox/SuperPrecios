<script setup>
import { computed, ref } from 'vue'
import UnitGroup from './UnitGroup.vue'

const props = defineProps({
  title: { type: String, required: true },
  groups: { type: Array, required: true },
  chains: { type: Array, required: true },
  total: { type: Number, required: true },
})

const emit = defineEmits(['back'])

const showAll = ref(false)

// Matches sold by another unit are mostly loose hits ("chocolate con leche y
// almendras enteras"), so only the main unit shows until everything is asked for.
const visible = computed(() => (showAll.value ? props.groups : props.groups.slice(0, 1)))
const hidden = computed(() => props.groups.slice(1).reduce((n, g) => n + g.items.length, 0))
</script>

<template>
  <section class="product-view">
    <button class="back" type="button" @click="emit('back')">← Volver</button>

    <div class="view-head">
      <h2 class="view-title">{{ title }}</h2>
      <label class="switch">
        <input v-model="showAll" type="checkbox" role="switch" />
        <span class="switch-track" aria-hidden="true"><span class="switch-thumb" /></span>
        <span>Ver todos los productos ({{ total }})</span>
      </label>
    </div>

    <p class="muted view-hint">
      {{ showAll ? 'Todos los productos, del más barato al más caro.' : 'La opción más barata de cada supermercado.' }}
    </p>

    <UnitGroup
      v-for="g in visible"
      :key="g.unit + showAll"
      :unit="g.unit"
      :items="g.items"
      :chains="chains"
      :show-all="showAll"
    />

    <p v-if="!showAll && hidden" class="muted view-hint">
      Hay {{ hidden }} {{ hidden === 1 ? 'producto más que se vende' : 'productos más que se venden' }} por otra
      unidad: los verás con «Ver todos los productos».
    </p>
  </section>
</template>
