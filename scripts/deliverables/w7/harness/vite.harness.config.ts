import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

// Minimal Vite config for the W7 fill-canvas render harness. Same shape as the
// step1b harness: app `@` alias + PostCSS/Tailwind from repo root. No backend.
const repoRoot = path.resolve(__dirname, '../../../..');

export default defineConfig({
  root: __dirname,
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(repoRoot, 'src'),
    },
  },
  server: {
    port: 4322,
    host: '127.0.0.1',
    fs: { allow: [repoRoot] },
  },
});
