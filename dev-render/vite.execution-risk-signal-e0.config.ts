import { resolve } from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  root: resolve(import.meta.dirname),
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, '../src'),
    },
  },
  build: {
    outDir: resolve(import.meta.dirname, '../evidence/f2-2-realizacja/e0/build'),
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(import.meta.dirname, 'execution-risk-signal-e0.html'),
    },
  },
});
