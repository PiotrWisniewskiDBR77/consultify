// Z-38 — zrzuty PL jasny+ciemny z harnessu Z-30 (InitiativeWorkloadSurface,
// pigułka „Brak" zamiast uciętej „Brak dostępności" + rozdzielone nagłówki
// „Dostępność (h/tydz.)" vs „Dostępność (%)").
// Harness dev-render czyta `theme=` bezpośrednio z URL (main.tsx:2850) —
// bez sztuczek ze store/localStorage (patrz notatka
// zrzuty-motyw-z-zustand-nie-z-media: page.emulateMedia nic tu nie zmienia,
// ale w tym harnessie to nieistotne, bo theme steruje wprost query param).
//
// Użycie: node scripts/dev/z38-heatmapa-pl-zrzuty.mjs [--port 5410]
import { chromium } from 'playwright';
import fs from 'node:fs';

const args = process.argv.slice(2);
const arg = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};
const PORT = arg('port', '5410');
const BASE = `http://localhost:${PORT}`;
const OUT = 'evidence/z38-heatmapa-pl';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();

for (const theme of ['light', 'dark']) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await context.newPage();
  const bledyKonsoli = [];
  page.on('console', (m) => m.type() === 'error' && bledyKonsoli.push(m.text()));
  page.on('pageerror', (e) => bledyKonsoli.push(String(e)));
  page.on('response', (r) => {
    if (r.status() >= 400) bledyKonsoli.push(`HTTP ${r.status()} ${r.url()}`);
  });

  const url = `${BASE}/?screen=z30-inicjatywy-obciazenie&tab=capacity&lang=pl&theme=${theme}`;
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForSelector('[data-testid^="workload-"]', { timeout: 30000 });
  await page.waitForTimeout(600);

  const path = `${OUT}/z38-heatmapa-pl-${theme}.png`;
  await page.screenshot({ path, fullPage: false });
  fs.writeFileSync(
    `${path}.json`,
    JSON.stringify({ url, bledyKonsoli }, null, 2)
  );
  console.log(`zapisano ${path} (błędy konsoli: ${bledyKonsoli.length})`);
  await context.close();
}

await browser.close();
