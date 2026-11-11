import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Relative asset paths so the built site works from any folder
  // (GitHub Pages sub-path or Netlify root). Routing uses HashRouter.
  base: './',
  // "@/..." points to src/ (same alias as in tsconfig, used by shadcn/ui)
  resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } },
})
