<script setup>
import { ref } from 'vue'
import LoginGate from './components/LoginGate.vue'
import PriceSearch from './components/PriceSearch.vue'

const unlocked = ref(false)

function logout() {
  try {
    localStorage.removeItem('superprecios:password')
  } catch {
    // Nothing was saved.
  }
  location.reload()
}
</script>

<template>
  <PriceSearch v-if="unlocked" @logout="logout" />
  <LoginGate v-else @unlocked="unlocked = true" />
</template>
