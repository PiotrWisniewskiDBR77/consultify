import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vite';
const repoRoot = path.resolve(__dirname, '../../../..');
export default defineConfig({
  root: __dirname,
  plugins: [react()],
  resolve: { alias: { '@': path.join(repoRoot, 'src') } },
  server: {
    host: '127.0.0.1',
    port: 5598,
    strictPort: true,
    fs: { allow: [repoRoot] },
    proxy: { '/api': { target: 'http://127.0.0.1:4217', changeOrigin: true } },
  },
});
