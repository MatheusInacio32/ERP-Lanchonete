import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,   // escuta em 0.0.0.0 → acessível por outros aparelhos na rede local
    port: 5173,
  },
})
