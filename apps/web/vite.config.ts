import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { env } from 'node:process';
const target = env.API_PROXY ?? 'http://127.0.0.1:3000';
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  server: { proxy: { '/api': target, '/socket.io': { target, ws: true } } },
});
