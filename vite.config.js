import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// `base` must match the GitHub Pages path (https://<user>.github.io/<repo>/).
// The CI workflow sets BASE_PATH from the repo name.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/SuperPrecios/',
  plugins: [vue()],
})
