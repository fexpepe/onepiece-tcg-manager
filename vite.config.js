import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/onepiece-tcg-manager/', // nome do seu repositório no GitHub
})
