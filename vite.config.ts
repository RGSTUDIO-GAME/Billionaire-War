import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative asset URLs so the same build works from a GitHub Pages project
  // path (/Billionaire-War/), a custom domain, or a plain local server.
  base: './',
})
