import fs from 'fs';
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

/**
 * Zbieranie uwag właściciela z panelu odbioru (dev-render/PanelUwag.tsx).
 * GET  /__uwagi?ekran=x  → zapis dla ekranu
 * POST /__uwagi          → nadpisuje zapis; plik na dysku = źródło prawdy dla nadzorcy
 * Katalog: odbior-uwagi/<ekran>.json (poza gitem — to notatki, nie kod).
 */
function pluginUwag() {
  const katalog = path.resolve(__dirname, '../odbior-uwagi');
  const plik = (ekran: string) =>
    path.join(katalog, `${String(ekran).replace(/[^a-z0-9-]/gi, '_')}.json`);
  return {
    name: 'odbior-uwagi',
    configureServer(server: any) {
      // Oceny artefaktów (5 osi 0-10) — jeden plik, zapis przy każdej zmianie.
      const plikOcen = path.join(katalog, '_oceny.json');
      server.middlewares.use('/__oceny', (req: any, res: any) => {
        res.setHeader('content-type', 'application/json; charset=utf-8');
        try {
          if (req.method === 'GET') {
            res.end(fs.existsSync(plikOcen) ? fs.readFileSync(plikOcen, 'utf8') : '{}');
            return;
          }
          if (req.method === 'POST') {
            let body = '';
            req.on('data', (c: any) => (body += c));
            req.on('end', () => {
              fs.mkdirSync(katalog, { recursive: true });
              fs.writeFileSync(plikOcen, JSON.stringify(JSON.parse(body || '{}'), null, 2), 'utf8');
              res.end(JSON.stringify({ ok: true }));
            });
            return;
          }
          res.statusCode = 405;
          res.end('{"blad":"metoda"}');
        } catch (e) {
          res.statusCode = 500;
          res.end(JSON.stringify({ blad: String(e) }));
        }
      });
      server.middlewares.use('/__uwagi', (req: any, res: any) => {
        res.setHeader('content-type', 'application/json; charset=utf-8');
        try {
          if (req.method === 'GET' && req.url.startsWith('/wszystkie')) {
            // Zbiorczo — hub rysuje z tego liczniki uwag przy obiektach.
            const out: Record<string, unknown> = {};
            if (fs.existsSync(katalog)) {
              for (const f of fs.readdirSync(katalog)) {
                if (!f.endsWith('.json')) continue;
                try {
                  const d = JSON.parse(fs.readFileSync(path.join(katalog, f), 'utf8'));
                  if (d && d.ekran) out[d.ekran] = d;
                } catch { /* pomijamy uszkodzony plik */ }
              }
            }
            res.end(JSON.stringify(out));
            return;
          }
          if (req.method === 'GET') {
            const ekran = new URL(req.url, 'http://x').searchParams.get('ekran') || '';
            const f = plik(ekran);
            res.end(fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : JSON.stringify({ ekran, werdykt: null, uwagi: [] }));
            return;
          }
          if (req.method === 'POST') {
            let body = '';
            req.on('data', (c: any) => (body += c));
            req.on('end', () => {
              const dane = JSON.parse(body || '{}');
              if (!dane.ekran) { res.statusCode = 400; res.end('{"blad":"brak ekranu"}'); return; }
              fs.mkdirSync(katalog, { recursive: true });
              fs.writeFileSync(plik(dane.ekran), JSON.stringify(dane, null, 2), 'utf8');
              res.end(JSON.stringify({ ok: true }));
            });
            return;
          }
          res.statusCode = 405;
          res.end('{"blad":"metoda"}');
        } catch (e) {
          res.statusCode = 500;
          res.end(JSON.stringify({ blad: String(e) }));
        }
      });
    },
  };
}


export default defineConfig({
  root: __dirname,
  // Dedykowany cache — node_modules jest symlinkiem do głównego repo, więc
  // domyślny node_modules/.vite koliduje z równoległymi harnessami innych
  // worktree (dwie kopie React → "Invalid hook call"). Trzymaj cache lokalnie.
  cacheDir: path.resolve(__dirname, '.vite-cache'),
  // Serve the app's real /locales/** so i18n HttpBackend loads cleanly.
  publicDir: path.resolve(repoRoot, 'public'),
  plugins: [react(), pluginUwag()],
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
