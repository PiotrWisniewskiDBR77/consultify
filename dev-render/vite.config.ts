import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

/**
 * Standalone Vite config for the DEV-RENDER HARNESS.
 *
 * Purpose (CLAUDE.md #7): let the session supervisor mount a REAL screen
 * component with mock data + the app's real CSS (Tailwind + c-* tokens) and
 * take a screenshot BEFORE the owner ever sees it. No login, no backend, no DB.
 *
 * This is DEV-ONLY tooling. It never ships in the production bundle — the
 * production build uses the repo-root `vite.config.ts` whose entry is
 * `index.html` at the repo root; `dev-render/` is not referenced there.
 *
 * Run from the REPO ROOT (so PostCSS/Tailwind config resolve):
 *   npx vite --config dev-render/vite.config.ts --port 3020
 */
const repoRoot = path.resolve(__dirname, '..');

export default defineConfig({
  root: __dirname,
  // Serve the app's real /locales/** so i18n HttpBackend loads cleanly.
  publicDir: path.resolve(repoRoot, 'public'),
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(repoRoot, 'src'),
      // Dedupe React exactly like the main config to avoid two-copies errors.
      react: path.resolve(repoRoot, 'node_modules/react'),
      'react-dom': path.resolve(repoRoot, 'node_modules/react-dom'),
      'react/jsx-runtime': path.resolve(repoRoot, 'node_modules/react/jsx-runtime.js'),
      'react/jsx-dev-runtime': path.resolve(repoRoot, 'node_modules/react/jsx-dev-runtime.js'),
    },
  },
  server: {
    port: 3020,
    host: '0.0.0.0',
    fs: {
      // Allow importing files from the repo root (src/, node_modules/, public/).
      allow: [repoRoot],
    },
  },
});
