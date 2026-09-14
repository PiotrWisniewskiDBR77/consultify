import { resolve } from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  root: resolve(import.meta.dirname),
  plugins: [react()],
  server: { port: 5401, strictPort: true },
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, '../src'),
    },
  },
});
