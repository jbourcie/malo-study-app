import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Base fixe pour GitHub Pages (évite un build sans base quand la variable n'est pas injectée).
const base = process.env.VITE_BASE_PATH || '/malo-study-app/'

export default defineConfig({
  plugins: [react()],
  base,
})
