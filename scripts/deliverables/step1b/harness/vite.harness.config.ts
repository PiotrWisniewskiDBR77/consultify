import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

// Minimal Vite config for the Step 1b render harness. Serves scripts/deliverables/
// step1b/harness/index.html with the app's `@` alias + PostCSS/Tailwind (picked up
// from repo-root postcss.config.js / tailwind.config.js). No backend, no DB, no env.
const repoRoot = path.resolve(__dirname, '../../../..');

export default defineConfig({
  root: __dirname,
  plugins: [react()],
  resolve: {
    // Only alias the app's `@` root. React/react-dom/jsx-runtime resolve via
    // normal node resolution — aliasing the bare package dirs makes esbuild's
    // dep optimizer try to read a directory as a file (worktree symlink quirk).
    alias: {
      '@': path.resolve(repoRoot, 'src'),
    },
  },
  server: {
    port: 4321,
    host: '127.0.0.1',
    fs: { allow: [repoRoot] },
  },
});
