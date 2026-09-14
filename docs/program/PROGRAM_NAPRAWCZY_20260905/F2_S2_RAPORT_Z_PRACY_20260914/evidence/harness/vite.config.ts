import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
const repoRoot = path.resolve(__dirname, '../../../../../..');
export default defineConfig({
  root: __dirname,
  plugins: [react()],
  resolve: { alias: { '@': path.join(repoRoot, 'src') } },
  server: { fs: { allow: [repoRoot] } },
});
