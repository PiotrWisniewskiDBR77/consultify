import react from '@vitejs/plugin-react';
import fs from 'fs';
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
                } catch {
                  /* pomijamy uszkodzony plik */
                }
              }
            }
            res.end(JSON.stringify(out));
            return;
          }
          if (req.method === 'GET') {
            const ekran = new URL(req.url, 'http://x').searchParams.get('ekran') || '';
            const f = plik(ekran);
            res.end(
              fs.existsSync(f)
                ? fs.readFileSync(f, 'utf8')
                : JSON.stringify({ ekran, werdykt: null, uwagi: [] })
            );
            return;
          }
          if (req.method === 'POST') {
            let body = '';
            req.on('data', (c: any) => (body += c));
            req.on('end', () => {
              const dane = JSON.parse(body || '{}');
              if (!dane.ekran) {
                res.statusCode = 400;
                res.end('{"blad":"brak ekranu"}');
                return;
              }
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

/**
 * Endpoint odbioru (2026-07-23) — panel `?screen=odbior` zapisuje werdykty
 * Piotra PROSTO do repo, zamiast przez pobieranie pliku. Dzięki temu pętla
 * „obejrzyj → oceń → wykonam" nie wymaga przenoszenia plików z Downloads.
 *
 * POST /__odbior/zapisz  {partia, pozycje:[{id,werdykt,komentarz}]}
 *   → rejestr/_odbior/werdykty-<partia>.json (nadpisywany, ostatni stan wygrywa)
 * GET  /__odbior/wczytaj?partia=... → ostatnio zapisany stan (żeby panel wstawał z danymi)
 *
 * Dev-only: żyje wyłącznie w configu harnessu, nie w buildzie produkcyjnym.
 */
function odbiorPlugin() {
  const katalog = path.resolve(repoRoot, 'rejestr/_odbior');
  const plik = (partia: string) =>
    path.join(katalog, `werdykty-${String(partia).replace(/[^0-9a-zA-Z-]/g, '')}.json`);

  return {
    name: 'odbior-endpoint',
    configureServer(server: any) {
      server.middlewares.use('/__odbior/zapisz', (req: any, res: any, next: any) => {
        if (req.method !== 'POST') return next();
        let body = '';
        req.on('data', (c: any) => {
          body += c;
          if (body.length > 2_000_000) req.destroy();
        });
        req.on('end', () => {
          try {
            const dane = JSON.parse(body);
            fs.mkdirSync(katalog, { recursive: true });
            const wyjscie = { ...dane, zapisane: new Date().toISOString() };
            fs.writeFileSync(plik(dane.partia || 'biezaca'), JSON.stringify(wyjscie, null, 2));
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true, plik: plik(dane.partia || 'biezaca') }));
          } catch (e: any) {
            res.statusCode = 400;
            res.end(JSON.stringify({ ok: false, blad: String(e && e.message) }));
          }
        });
      });

      /**
       * SPINACZ OBSZARÓW: pozycje do odbioru czytamy wprost z rejestru
       * (`rejestr/3-DO-ODBIORU/*.md`) — SSOT, do którego pisze KAŻDY agent.
       * Dzięki temu panel odbioru obejmuje wszystkie 4 obszary bez ręcznego
       * dopisywania: nowa pozycja w rejestrze = nowa karta w panelu.
       * Pola opcjonalne we frontmatterze sterują żywym podglądem:
       *   ekran: <klucz-ekranu-dev-render>   query: "&ff_x=1"   wysokosc: 620
       *   klik: "co kliknąć, żeby zobaczyć zmianę"
       */
      server.middlewares.use('/__odbior/pozycje', (req: any, res: any, next: any) => {
        if (req.method !== 'GET') return next();
        const dir = path.resolve(repoRoot, 'rejestr/3-DO-ODBIORU');
        const out: any[] = [];
        try {
          for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.md'))) {
            const tekst = fs.readFileSync(path.join(dir, f), 'utf8');
            const m = tekst.match(/^---\n([\s\S]*?)\n---/);
            const fm: Record<string, string> = {};
            if (m) {
              m[1].split('\n').forEach((linia) => {
                const i = linia.indexOf(':');
                if (i > 0)
                  fm[linia.slice(0, i).trim()] = linia
                    .slice(i + 1)
                    .trim()
                    .replace(/^["']|["']$/g, '');
              });
            }
            const sekcja = (nazwa: RegExp) => {
              const mm = tekst.match(nazwa);
              return mm ? mm[1].trim().slice(0, 900) : '';
            };
            out.push({
              id: fm.id || f.replace(/\.md$/, ''),
              tytul: fm.tytul || f,
              obszar: fm.obszar || 'INNE',
              narzedzie: fm.narzedzie || fm.obszar || '',
              flaga: fm.flaga || '',
              waga: fm.waga || '',
              ekran: fm.ekran || '',
              query: fm.query || '',
              klik: fm.klik || '',
              wysokosc: fm.wysokosc ? Number(fm.wysokosc) : 0,
              zmiana: sekcja(/##\s*1\.[^\n]*\n([\s\S]*?)(?=\n##\s|\n*$)/),
              patrz: sekcja(/##\s*2\.[^\n]*\n([\s\S]*?)(?=\n##\s|\n*$)/),
              ryzyko: sekcja(/##\s*3\.[^\n]*\n([\s\S]*?)(?=\n##\s|\n*$)/),
              plik: `rejestr/3-DO-ODBIORU/${f}`,
            });
          }
        } catch (e: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ blad: String(e && e.message) }));
          return;
        }
        out.sort((a, b) => (a.obszar + a.id).localeCompare(b.obszar + b.id));
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ pozycje: out }));
      });

      server.middlewares.use('/__odbior/wczytaj', (req: any, res: any, next: any) => {
        if (req.method !== 'GET') return next();
        const partia = new URL(req.url, 'http://x').searchParams.get('partia') || 'biezaca';
        res.setHeader('Content-Type', 'application/json');
        try {
          res.end(fs.readFileSync(plik(partia), 'utf8'));
        } catch {
          res.end(JSON.stringify({ partia, pozycje: [] }));
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
  plugins: [react(), pluginUwag(), odbiorPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(repoRoot, 'src'),
      // Dedupe React exactly like the main config to avoid two-copies errors.
      react: path.resolve(repoRoot, 'node_modules/react'),
      'react-dom': path.resolve(repoRoot, 'node_modules/react-dom'),
      'react/jsx-runtime': path.resolve(repoRoot, 'node_modules/react/jsx-runtime.js'),
      'react/jsx-dev-runtime': path.resolve(repoRoot, 'node_modules/react/jsx-dev-runtime.js'),
    },
    // ★ 2026-07-28: bez tego KAŻDY ekran z płótnem (mapa myśli, tablica,
    // przepływ) wywalał się na „[React Flow]: Seems like you have not used
    // zustand provider as an ancestor" (error#001). Kod płócien importuje i z
    // `reactflow`, i wprost z `@reactflow/core`; przy symlinkowanym
    // `node_modules` (worktree) vite prebundlował te dwa wejścia osobno →
    // DWIE kopie store'a zustand → provider z jednej kopii, `useStore` z
    // drugiej. `dedupe` + jawne `optimizeDeps.include` sprowadzają je do
    // jednej instancji. Objaw wyglądał jak zepsuty ekran, przyczyna była
    // wyłącznie w rozwiązywaniu zależności harnessu.
    dedupe: [
      'react',
      'react-dom',
      'zustand',
      'reactflow',
      '@reactflow/core',
      '@reactflow/background',
      '@reactflow/controls',
      '@reactflow/minimap',
      '@reactflow/node-resizer',
      '@reactflow/node-toolbar',
    ],
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'zustand',
      'reactflow',
      '@reactflow/core',
      '@reactflow/background',
      '@reactflow/controls',
      '@reactflow/minimap',
      '@reactflow/node-resizer',
      '@reactflow/node-toolbar',
    ],
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
