import { resolve } from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  root: resolve(import.meta.dirname),
  plugins: [react()],
  resolve: { alias: { '@': resolve(import.meta.dirname, '../src') } },
  publicDir: resolve(import.meta.dirname, '../public'),
  build: {
    outDir: resolve(import.meta.dirname, '../.tmp-e2-render'),
    emptyOutDir: true,
    rollupOptions: { input: resolve(import.meta.dirname, 'execution-work-analysis.html') },
  },
});
