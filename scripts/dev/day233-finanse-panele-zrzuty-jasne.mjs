// FIX day233 Finanse — usunięcie wyścigu klik→zrzut w ekranie dowodowym
// dev-render/screens/finance-value-panels.tsx (AutoRun, linie ~245-251).
//
// Odbiór dyżuru 233 wykrył, że pierwotny (jednorazowy, nigdy nie
// zacommitowany) skrypt przechwytywał zrzut PO stałym czasie zamiast po
// pojawieniu się wyniku. Dla panel-monte-carlo-populated-light.png i
// panel-scenarios-populated-light.png zrzut zdążył przed wynikiem (sam
// formularz), warianty dark — już po (histogram / wykres wachlarzowy).
// KSZTALT_19 (docs/program/funkcje/KSZTALT_19_PARA_ZGODNA_ROZNE_STANY.md):
// stary bezpiecznik (tylko różnica jasności) to złapał TYM TRUDNIEJ, im
// większy był defekt.
//
// Naprawa (dwuwarstwowa):
//  1) Każdy zrzut czeka na selektor DOM WYNIKU (nie na czas) — dokładnie ten
//     sam wzorzec, którego realne panele Real Options / Efficient Frontier /
//     What-if Sensitivity już używały poprawnie.
//  2) Po każdej parze light/dark skrypt SAM sprawdza się przez
//     checkScreenshotPairState (luma RÓWNOCZEŚNIE z obecnością wyniku w DOM
//     w chwili zrzutu) — scripts/dev/lib/checkScreenshotPairState.mjs.
//     Jeśli para nie przejdzie, skrypt kończy się kodem != 0.
//
// DAY233_SIMULATE_RACE=1 odtwarza WYŁĄCZNIE do celów dowodu mutacyjnego
// pierwotny błąd (networkidle + krótki stały timeout zamiast czekania na
// wynik) — NIGDY nie używać tego trybu do produkowania prawdziwych dowodów.
//
// Wzór: scripts/dev/ui-latki-20260828-screenshots.mjs (fresh context per shot).
// Usage: node scripts/dev/day233-finanse-panele-zrzuty-jasne.mjs <outdir>
import fs from 'fs';
import { chromium } from 'playwright';

import { checkScreenshotPairState } from './lib/checkScreenshotPairState.mjs';
import { meanLuma } from './lib/meanLuma.mjs';

const BASE = process.env.DAY233_BASE_URL || 'http://localhost:5172';
const OUT = process.argv[2] || '/private/tmp/fix233-zrzuty-artefakty';
const SIMULATE_RACE = process.env.DAY233_SIMULATE_RACE === '1';

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();

// panel key → (a) URL panel=, (b) state, (c) selector(s) that only exist
// once the RESULT is rendered (never the button/form that exists on mount).
const PANELS = [
  {
    name: 'panel-monte-carlo-populated',
    panel: 'monte-carlo',
    state: 'populated',
    waitFor: '[data-testid="mc-histogram"]',
    requiresResultMarker: true,
  },
  {
    name: 'panel-real-options-populated',
    panel: 'real-options',
    state: 'populated',
    waitFor: '[data-testid="ro-defer-result"]',
    requiresResultMarker: true,
  },
  {
    name: 'panel-frontier-populated',
    panel: 'frontier',
    state: 'populated',
    waitFor: '[data-testid="frontier-chart"]',
    requiresResultMarker: true,
  },
  {
    name: 'panel-sensitivity-populated',
    panel: 'sensitivity',
    state: 'populated',
    // AutoRun clicks BOTH sens-run-tornado and sens-run-heatmap — wait for both.
    waitFor: ['[data-testid="sens-tornado-chart"]', '[data-testid="sens-heatmap-chart"]'],
    requiresResultMarker: true,
  },
  {
    name: 'panel-scenarios-populated',
    panel: 'scenarios',
    state: 'populated',
    waitFor: '[data-testid="scenario-fan-chart"]',
    requiresResultMarker: true,
  },
  // No AutoRun race here (no click, no async result) — wait for the panel's
  // own empty-state testid so the pair still proves a stable state.
  {
    name: 'panel-driver-empty',
    panel: 'driver',
    state: 'empty',
    waitFor: '[data-testid="driver-planner-empty"]',
    requiresResultMarker: false,
  },
  {
    name: 'panel-value-empty',
    panel: 'value',
    state: 'empty',
    waitFor: '[data-testid="value-office-empty"]',
    requiresResultMarker: false,
  },
  {
    name: 'panel-list-populated',
    panel: 'list',
    state: 'populated',
    waitFor: '[data-testid="finance-value-panels-surface"]',
    requiresResultMarker: false,
  },
];

async function shoot({ name, panel, state, waitFor, requiresResultMarker }, theme) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  // panel=list mounts <FinanceValuePanelsSurface>, gated behind the
  // (default-OFF) ff_financeValuePanels flag — CLAUDE.md #7: flag only ON
  // for the harness screenshot itself, never touched as a default.
  const flag = panel === 'list' ? '&ff_financeValuePanels=1' : '';
  const url = `${BASE}/?screen=day233-finanse-panele&panel=${panel}&state=${state}&theme=${theme}&lang=pl${flag}`;
  console.log('navigating', url);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });

  const selectors = Array.isArray(waitFor) ? waitFor : [waitFor];

  if (SIMULATE_RACE) {
    // Reproduce the ORIGINAL bug exactly: no wait for the result selector,
    // just a short fixed delay after networkidle. networkidle fires almost
    // immediately here because the fetchers are local mocks (no real network
    // call), so this barely gives AutoRun's click + async setResult time to
    // land before the screenshot — the original race.
    await page.waitForTimeout(20);
  } else {
    for (const sel of selectors) {
      await page.waitForSelector(sel, { timeout: 20000, state: 'attached' });
    }
    // Let the last paint (charts via recharts ResizeObserver) settle after
    // the DOM node lands — short, and gated behind the real wait above, not
    // a substitute for it.
    await page.waitForTimeout(200);
  }

  // Record whether the result is ACTUALLY in the DOM right now, regardless
  // of mode — this is the ground truth the new safeguard checks against.
  const hasResultMarker = requiresResultMarker
    ? await page.evaluate(
        (sels) => sels.every((s) => document.querySelector(s) !== null),
        selectors
      )
    : null;

  const path = `${OUT}/${name}-${theme}.png`;
  await page.screenshot({ path, fullPage: false });
  console.log('saved', path, requiresResultMarker ? `(wynik w DOM: ${hasResultMarker})` : '');
  await context.close();
  return { path, hasResultMarker };
}

const failures = [];
for (const p of PANELS) {
  const light = await shoot(p, 'light');
  const dark = await shoot(p, 'dark');
  const [lightMeanLuma, darkMeanLuma] = await Promise.all([
    meanLuma(light.path),
    meanLuma(dark.path),
  ]);
  const verdict = checkScreenshotPairState({
    pairName: p.name,
    lightMeanLuma,
    darkMeanLuma,
    requiresResultMarker: p.requiresResultMarker,
    lightHasResultMarker: light.hasResultMarker,
    darkHasResultMarker: dark.hasResultMarker,
  });
  console.log(
    `${verdict.ok ? 'PASS' : 'FAIL'} ${p.name} — luma light=${lightMeanLuma.toFixed(1)} dark=${darkMeanLuma.toFixed(1)} diff=${Math.abs(lightMeanLuma - darkMeanLuma).toFixed(1)}`
  );
  if (!verdict.ok) {
    for (const reason of verdict.reasons) console.log(`  ${reason}`);
    failures.push(p.name);
  }
}

await browser.close();

if (failures.length > 0) {
  console.log(`DONE — ${failures.length} PARA(Y) NIE PRZESZŁY KONTROLI: ${failures.join(', ')}`);
  process.exit(1);
}
console.log('DONE — wszystkie pary przeszły kontrolę (jasność + zgodność stanu).');
