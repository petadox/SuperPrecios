<script setup>
import { onMounted, ref } from 'vue'
import { WrongPasswordError, unlock } from '../catalog'

const STORAGE_KEY = 'superprecios:password'

const emit = defineEmits(['unlocked'])

const password = ref('')
const busy = ref(false)
const error = ref('')

function saved() {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

function remember(value) {
  try {
    if (value) localStorage.setItem(STORAGE_KEY, value)
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Private mode: the password is asked again next time.
  }
}

async function enter(value, fromStorage = false) {
  busy.value = true
  error.value = ''
  try {
    await unlock(value)
    remember(value)
    emit('unlocked')
  } catch (e) {
    if (fromStorage) remember('')
    else error.value = e instanceof WrongPasswordError ? 'Contraseña incorrecta.' : e.message
  } finally {
    busy.value = false
  }
}

onMounted(() => {
  const value = saved()
  if (value) enter(value, true)
})
</script>

<template>
  <main class="gate">
    <div class="gate-card">
      <h1>🛒 SuperPrecios</h1>
      <p class="gate-lead">
        Busca un producto y te digo en qué supermercado te sale más barato, comparando el precio por kilo, litro o
        unidad.
      </p>
      <form class="gate-form" @submit.prevent="enter(password.trim())">
        <input type="text" name="username" value="superprecios" autocomplete="username" hidden />
        <label for="password" class="gate-label">Contraseña</label>
        <input
          id="password"
          v-model="password"
          class="search"
          type="password"
          autocomplete="current-password"
          autocapitalize="none"
          spellcheck="false"
          :disabled="busy"
          required
        />
        <button class="gate-button" type="submit" :disabled="busy || !password.trim()">
          {{ busy ? 'Entrando…' : 'Entrar' }}
        </button>
        <p v-if="error" class="error" role="alert">{{ error }}</p>
      </form>
    </div>
  </main>
</template>
