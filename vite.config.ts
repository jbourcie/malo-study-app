import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Pour GitHub Pages: base doit être "/<NOM_DU_REPO>/"
// Avec HashRouter, ça évite les 404 au refresh, mais les assets doivent avoir le bon base.
const base = process.env.VITE_BASE_PATH || '/'

export default defineConfig({
  plugins: [react()],
  base,
})
