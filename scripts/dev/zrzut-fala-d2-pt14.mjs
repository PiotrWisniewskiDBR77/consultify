#!/usr/bin/env node
/**
 * Fala D2 · P-T14 — zrzuty ewidencyjne ekranu dowodowego
 * `dev-render/screens/p-t14-pomysly-etap-kandydat.tsx` (PRZED = odtworzenie
 * linii `integracja/20260911`, PO = realne komponenty tej gałęzi).
 *
 * Wariantów 4: {pl,en} × {light,dark}. Każda para light/dark przechodzi
 * kanoniczny bezpiecznik `checkScreenshotPairState` (KSZTAŁT 13 — duplikat
 * zamiast motywu, KSZTAŁT 19 — para zgodna, ale bez wyniku w DOM).
 *
 * Użycie: node scripts/dev/zrzut-fala-d2-pt14.mjs [port] [outDir]
 */
import fs from 'node:fs';
import path from 'node:path';

import { chromium } from 'playwright';

import { checkScreenshotPairState } from './lib/checkScreenshotPairState.mjs';
import { meanLuma } from './lib/meanLuma.mjs';

const PORT = process.argv[2] || '4552';
const OUT = process.argv[3] || path.join(process.env.HOME, 'Developer/cto-codex/fala-d2-20260914/zrzuty-pt14');
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const results = [];

for (const lang of ['pl', 'en']) {
  const perTheme = {};
  for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      colorScheme: theme,
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    const errors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    const url = `http://localhost:${PORT}/?screen=p-t14-pomysly-etap-kandydat&lang=${lang}&theme=${theme}`;
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid="process-flow-candidate-preview"]', { timeout: 15000 });
    await page.waitForTimeout(400);

    // KSZTAŁT 19: zmierz obecność WYNIKU (nazwany podgląd PO) w DOM, nie tylko jasność.
    const hasResult = await page
      .locator('[data-testid="process-flow-candidate-preview-summary"]')
      .count()
      .then((n) => n > 0);
    // Dowód, że lista etapów jest W WIERSZU (P-T14 a) — 4 wiersze kolumny PO.
    const stageSelects = await page.locator('[data-testid="idea-stage-select"]').count();

    const file = path.join(OUT, `pt14-${lang}-${theme}.png`);
    await page.screenshot({ path: file, fullPage: true });
    perTheme[theme] = { file, hasResult, stageSelects, errors };
    console.log(
      `${path.basename(file)} · listy etapu w wierszu=${stageSelects} · nazwany wynik=${hasResult} · bledy konsoli=${errors.length}`
    );
    await context.close();
  }

  const verdict = checkScreenshotPairState({
    pairName: `pt14-${lang}`,
    lightMeanLuma: await meanLuma(perTheme.light.file),
    darkMeanLuma: await meanLuma(perTheme.dark.file),
    requiresResultMarker: true,
    lightHasResultMarker: perTheme.light.hasResult,
    darkHasResultMarker: perTheme.dark.hasResult,
  });
  results.push({ lang, verdict, perTheme });
  console.log(`para pt14-${lang}: ${verdict.ok ? 'OK' : 'ODRZUCONA'}`);
  for (const reason of verdict.reasons) console.log('  ' + reason);
}

await browser.close();

const failed = results.filter((r) => !r.verdict.ok);
const emptyStageCells = results.some((r) =>
  Object.values(r.perTheme).some((t) => t.stageSelects !== 4)
);
if (emptyStageCells) console.log('BLAD: kolumna PO nie ma 4 list etapu w wierszach.');
process.exit(failed.length || emptyStageCells ? 1 : 0);
