import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig({
  plugins: [react(), tailwindcss() as any, viteSingleFile()],
  build: {
    assetsInlineLimit: 10_000_000, // inline wszystkie assety (tekstury) do base64
  },
  test: {
    globals: true,
    environment: 'node',
  },
})
