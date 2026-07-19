#!/usr/bin/env node
/**
 * REJESTR V7-8 — wizualny smoke-suite regresji dev-render.
 *
 * Startuje dev-render (Vite, dev-render/vite.config.ts) na porcie 3230,
 * renderuje KAŻDY ekran zarejestrowany w dev-render/main.tsx (SCREENS) w
 * light + dark, robi zrzuty do tests/visual/__shots__/current/, porównuje
 * z tests/visual/__shots__/baseline/. Zero backendu, zero logowania —
 * dokładnie ten sam harness co CLAUDE.md #7 (dev-render), tylko zautomatyzowany.
 *
 * Użycie:
 *   node tests/visual/run.mjs              — porównaj current vs baseline (gate)
 *   node tests/visual/run.mjs --update      — nadpisz baseline current-em (seed/re-seed)
 *   node tests/visual/run.mjs --only=a,b,c  — ogranicz do wybranych kluczy ekranów
 *   node tests/visual/run.mjs --port=3231   — inny port (gdy 3230 zajęty)
 *   node tests/visual/run.mjs --threshold=0.03 — luźniejszy próg diffu (domyślnie 0.02)
 *
 * Exit code: 0 = PASS (current == baseline w progu), 1 = FAIL (regresja/nowy/brak bazowego).
 */
import { mkdirSync, writeFileSync, existsSync, copyFileSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { loadScreenKeys, repoRoot } from './lib/screens.mjs';
import { startDevRender } from './lib/devserver.mjs';
import { comparePng } from './lib/compare.mjs';

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const value = (name, def) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : def;
};

const UPDATE = flag('update');
const PORT = Number(value('port', '3230'));
// Empirically calibrated (2026-07-19, grid-hash fallback comparator, GRID=24,
// full-page 1440x900 shots): identical re-renders land at diffRatio 0.0000,
// a subtle canvas-animation frame-timing artifact (melscanvas-workspace) at
// ~0.0001, and a deliberate full-panel color-swap regression (bg-c-surface →
// bg-c-danger-solid on ev-football-field) at 0.0078–0.0120. 0.0015 sits ~15x
// above the observed noise floor and ~5x below the smallest real regression
// tested — see tests/visual/README.md "Kalibracja progu".
const THRESHOLD = Number(value('threshold', '0.0015'));
const ONLY = value('only', null);
const VIEWPORT = { width: 1440, height: 900 };
const THEMES = ['light', 'dark'];

const SHOTS_DIR = path.join(repoRoot, 'tests/visual/__shots__');
const CURRENT_DIR = path.join(SHOTS_DIR, 'current');
const BASELINE_DIR = path.join(SHOTS_DIR, 'baseline');
const DIFF_DIR = path.join(SHOTS_DIR, 'diff');
const REPORT_PATH = path.join(SHOTS_DIR, 'report.json');

function log(msg) {
  process.stdout.write(`${msg}\n`);
}

/**
 * Vite's dep pre-bundling (esbuild) can race the very first request(s) for a
 * freshly-discovered npm dependency, returning "504 Outdated Optimize Dep"
 * for one or more chunks and leaving the page half-mounted. This is a known
 * Vite dev-server cold-start behavior, not a real render bug — a reload once
 * the optimizer settles always recovers. Retry goto→reload up to 4x before
 * treating it as a genuine render-error.
 */
async function loadScreen(page, url) {
  const maxAttempts = 4;
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      if (attempt === 1) {
        await page.goto(url, { waitUntil: 'load', timeout: 15_000 });
      } else {
        await page.waitForTimeout(500 * attempt);
        await page.reload({ waitUntil: 'load', timeout: 15_000 });
      }
      await page.waitForSelector('#dev-render-root > *', { timeout: 8_000 });
      return;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

async function main() {
  let screenKeys = loadScreenKeys();
  if (ONLY) {
    const wanted = new Set(ONLY.split(',').map((s) => s.trim()));
    screenKeys = screenKeys.filter((k) => wanted.has(k));
  }
  if (screenKeys.length === 0) {
    log('BRAK ekranów do przetestowania (sprawdź dev-render/main.tsx SCREENS albo --only).');
    process.exit(1);
  }

  for (const d of [CURRENT_DIR, BASELINE_DIR, DIFF_DIR]) mkdirSync(d, { recursive: true });
  // Clean current+diff from previous run so stale shots don't linger.
  for (const f of readdirSync(CURRENT_DIR)) rmSync(path.join(CURRENT_DIR, f));
  for (const f of readdirSync(DIFF_DIR)) rmSync(path.join(DIFF_DIR, f));

  log(`[v7-8-smoke] dev-render start (port ${PORT})...`);
  const server = await startDevRender({ port: PORT });
  log(`[v7-8-smoke] dev-render gotowy: ${server.url}`);

  const browser = await chromium.launch();
  const results = [];

  try {
    const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
    const page = await context.newPage();

    let i = 0;
    const total = screenKeys.length * THEMES.length;
    for (const key of screenKeys) {
      for (const theme of THEMES) {
        i++;
        const shotName = `${key}--${theme}.png`;
        const currentPath = path.join(CURRENT_DIR, shotName);
        const url = `${server.url}?screen=${encodeURIComponent(key)}&lang=pl&theme=${theme}`;
        process.stdout.write(`[v7-8-smoke] (${i}/${total}) ${shotName} ... `);
        try {
          await loadScreen(page, url);
          await page.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
          await page.waitForTimeout(350); // settle: transitions/late paints/i18n swap
          await page.screenshot({ path: currentPath, fullPage: true });
        } catch (err) {
          results.push({
            key,
            theme,
            shot: shotName,
            status: 'render-error',
            error: String(err && err.message ? err.message : err),
          });
          process.stdout.write('RENDER-ERROR\n');
          continue;
        }

        if (UPDATE) {
          copyFileSync(currentPath, path.join(BASELINE_DIR, shotName));
          results.push({ key, theme, shot: shotName, status: 'seeded' });
          process.stdout.write('SEEDED\n');
          continue;
        }

        const cmp = await comparePng({
          currentPath,
          baselinePath: path.join(BASELINE_DIR, shotName),
          diffPath: path.join(DIFF_DIR, shotName),
          threshold: THRESHOLD,
        });
        results.push({ key, theme, shot: shotName, ...cmp });
        process.stdout.write(
          `${cmp.status.toUpperCase()}${cmp.diffRatio != null ? ` (${(cmp.diffRatio * 100).toFixed(2)}%)` : ''}\n`
        );
      }
    }
  } finally {
    await browser.close();
    await server.stop();
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    mode: UPDATE ? 'update' : 'gate',
    port: PORT,
    threshold: THRESHOLD,
    viewport: VIEWPORT,
    total: results.length,
    counts: results.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {}),
    results,
  };
  writeFileSync(REPORT_PATH, JSON.stringify(summary, null, 2));

  log('');
  log('═══════════════════════════════════════════════════════════════');
  log(`  REJESTR V7-8 smoke — ${UPDATE ? 'SEED BASELINE' : 'GATE'} — ${screenKeys.length} ekranów × ${THEMES.length} motywy = ${results.length} zrzutów`);
  log('═══════════════════════════════════════════════════════════════');
  for (const [status, n] of Object.entries(summary.counts)) {
    log(`  ${status}: ${n}`);
  }

  if (UPDATE) {
    log('');
    log(`Baseline zaktualizowany: ${BASELINE_DIR}`);
    log(`Nie zapomnij: git add -f tests/visual/__shots__/baseline (tests/* jest w .gitignore, ale tests/*/ jest re-included — zweryfikuj \`git status\`).`);
    process.exit(0);
  }

  const failing = results.filter((r) => !['match', 'seeded'].includes(r.status));
  if (failing.length > 0) {
    log('');
    log('FAIL — ekrany z regresją / bez bazowego zrzutu / błędem renderu:');
    for (const f of failing) {
      log(
        `  - ${f.shot}: ${f.status}${f.diffRatio != null ? ` diff=${(f.diffRatio * 100).toFixed(2)}%` : ''}${f.detail ? ` (${f.detail})` : ''}${f.error ? ` — ${f.error}` : ''}`
      );
    }
    log('');
    log(`Pełny raport: ${REPORT_PATH}`);
    log(`Diff-y (gdy pixelmatch dostępny): ${DIFF_DIR}`);
    process.exit(1);
  }

  log('');
  log('PASS — current == baseline w progu.');
  process.exit(0);
}

main().catch((err) => {
  console.error('[v7-8-smoke] FATAL:', err);
  process.exit(1);
});
