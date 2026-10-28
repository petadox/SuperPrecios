<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import basket from '../assets/market-basket.svg'
import { WrongPasswordError, unlock } from '../catalog'

const STORAGE_KEY = 'superprecios:password'

const emit = defineEmits(['unlocked'])

const password = ref('')
const showPassword = ref(false)
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

// The ntfy notification links to …/#clave=<password>. The fragment never reaches
// the server, and it is wiped from the address bar straight away.
function fromLink() {
  const value = new URLSearchParams(location.hash.slice(1)).get('clave')
  if (value) history.replaceState(null, '', location.pathname + location.search)
  return value
}

function enterFromLink() {
  const linked = fromLink()
  if (!linked) return false
  password.value = linked
  enter(linked)
  return true
}

onMounted(() => {
  window.addEventListener('hashchange', enterFromLink)
  if (enterFromLink()) return
  const value = saved()
  if (value) enter(value, true)
})

onUnmounted(() => window.removeEventListener('hashchange', enterFromLink))
</script>

<template>
  <main class="gate">
    <div class="art">
      <img :src="basket" alt="" class="basket" width="480" height="430" />
    </div>

    <section class="panel">
      <div class="card">
        <p class="eyebrow">Tu compra, más barata</p>
        <h1 class="title">SuperPrecios</h1>
        <p class="lead">
          Busca un producto y te digo en qué supermercado te sale más barato, comparando el precio por kilo, litro o
          unidad.
        </p>

        <form class="form" @submit.prevent="enter(password.trim())">
          <input type="text" name="username" value="superprecios" autocomplete="username" hidden />
          <label for="password" class="label">Contraseña</label>
          <div class="field">
            <input
              id="password"
              v-model="password"
              class="input"
              :type="showPassword ? 'text' : 'password'"
              autocomplete="current-password"
              autocapitalize="none"
              spellcheck="false"
              placeholder="La de la notificación de hoy"
              :disabled="busy"
              :aria-invalid="Boolean(error)"
              required
            />
            <button
              class="toggle"
              type="button"
              :aria-pressed="showPassword"
              @click="showPassword = !showPassword"
            >
              {{ showPassword ? 'Ocultar' : 'Mostrar' }}
            </button>
          </div>
          <button class="submit" type="submit" :disabled="busy || !password.trim()">
            {{ busy ? 'Abriendo la despensa…' : 'Entrar' }}
          </button>
          <p v-if="error" class="error" role="alert">{{ error }}</p>
        </form>

        <p class="note">La contraseña cambia cada día. Te llega al móvil cada mañana.</p>
      </div>
    </section>
  </main>
</template>

<style scoped>
.gate {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
  min-height: 100vh;
  min-height: 100dvh;
  color: var(--text);
  background: var(--bg);
}

.art {
  display: grid;
  place-items: center;
  padding: 48px;
  background-color: var(--gingham-bg);
  background-image:
    linear-gradient(90deg, var(--gingham) 50%, transparent 50%),
    linear-gradient(var(--gingham) 50%, transparent 50%);
  background-size: 56px 56px;
}

.basket {
  width: min(100%, 520px);
  height: auto;
  filter: drop-shadow(0 18px 30px rgba(59, 42, 32, 0.12));
}

.panel {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px 32px;
  background: var(--surface);
}

.card {
  width: 100%;
  max-width: 400px;
}

.eyebrow {
  margin: 0 0 6px;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--olive);
}

.title {
  margin: 0;
  font-family: 'Fraunces', Georgia, serif;
  font-size: clamp(2.3rem, 5vw, 3.2rem);
  font-weight: 700;
  line-height: 1.05;
  letter-spacing: -0.01em;
  color: var(--text);
}

.lead {
  margin: 14px 0 28px;
  font-size: 1.1rem;
  line-height: 1.5;
  color: var(--muted);
}

.form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.label {
  font-weight: 600;
}

.field {
  position: relative;
}

.input {
  width: 100%;
  padding: 14px 92px 14px 16px;
  font: inherit;
  font-size: 1.05rem;
  color: var(--text);
  background: var(--bg);
  border: 1.5px solid var(--border);
  border-radius: 14px;
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
}

.input::placeholder {
  color: var(--muted);
  opacity: 0.7;
}

.input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 4px var(--accent-soft);
}

.input[aria-invalid='true'] {
  border-color: var(--danger);
}

.toggle {
  position: absolute;
  top: 50%;
  right: 8px;
  transform: translateY(-50%);
  padding: 8px 10px;
  font: inherit;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--accent);
  background: none;
  border: 0;
  border-radius: 10px;
  cursor: pointer;
}

.toggle:hover,
.toggle:focus-visible {
  background: var(--accent-soft);
  outline: none;
}

.submit {
  margin-top: 4px;
  padding: 15px 16px;
  font: inherit;
  font-size: 1.05rem;
  font-weight: 700;
  color: #fffaf2;
  background: var(--accent);
  border: 0;
  border-radius: 14px;
  box-shadow: 0 6px 16px rgba(200, 100, 59, 0.28);
  cursor: pointer;
  transition:
    background 0.15s,
    transform 0.1s;
}

.submit:hover:not(:disabled) {
  background: var(--accent-strong);
}

.submit:active:not(:disabled) {
  transform: translateY(1px);
}

.submit:focus-visible {
  outline: 3px solid var(--olive);
  outline-offset: 2px;
}

.submit:disabled {
  opacity: 0.55;
  box-shadow: none;
  cursor: default;
}

.error {
  margin: 2px 0 0;
  font-weight: 600;
  color: var(--danger);
}

.note {
  margin: 24px 0 0;
  padding-top: 18px;
  font-size: 0.9rem;
  color: var(--muted);
  border-top: 1px dashed var(--border);
}

@media (max-width: 800px) {
  .gate {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
  }

  .art {
    padding: 28px 24px 52px;
    background-size: 40px 40px;
  }

  .basket {
    width: auto;
    max-width: 100%;
    max-height: 30vh;
    max-height: 30dvh;
  }

  .panel {
    position: relative;
    align-items: flex-start;
    margin-top: -28px;
    padding: 32px 20px 40px;
    border-radius: 28px 28px 0 0;
    box-shadow: 0 -10px 30px rgba(59, 42, 32, 0.08);
  }

  .lead {
    font-size: 1.02rem;
  }
}

@media (prefers-color-scheme: dark) {
  .basket {
    filter: brightness(0.92) drop-shadow(0 18px 30px rgba(0, 0, 0, 0.35));
  }

  .submit {
    color: #1d1712;
  }
}
</style>
