import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

// Minimal Vite config for the grow-content render harness. Same shape as the W7
// fill-canvas harness: app `@` alias + repo-root PostCSS/Tailwind. No backend.
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
    port: 4326,
    host: '127.0.0.1',
    fs: { allow: [repoRoot] },
  },
});
