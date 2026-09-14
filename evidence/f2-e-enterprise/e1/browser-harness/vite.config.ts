import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vite';
const repo = path.resolve(__dirname, '../../../..');
export default defineConfig({
  root: __dirname,
  publicDir: path.join(repo, 'public'),
  plugins: [react()],
  resolve: { alias: { '@': path.join(repo, 'src') }, dedupe: ['react','react-dom','zustand'] },
  build: { outDir: path.join(__dirname, 'dist'), emptyOutDir: true },
});
