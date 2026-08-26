/**
 * Dowody wizualne redesignu Organizacji (DEC-2026-08-26-78) — CLAUDE.md §7:
 * ekran renderuje i zrzuca SESJA, zanim zobaczy go Piotr. Zero logowania,
 * zero danych testowych w bazie — wyłącznie harness dev-render
 * (`dev-render/screens/org-identity-operating.tsx`) z mock API.
 *
 *   node scripts/org-redesign-evidence-shots.mjs
 *
 * Wymaga uruchomionego `npx vite --config dev-render/vite.config.ts --port 4521`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const BASE = 'http://localhost:4521';
const OUT = path.resolve(
  'docs/program/waves/WAVE_03_ACCEPTANCE/modules/01_ORGANIZATION/evidence/build-20260826'
);
fs.mkdirSync(OUT, { recursive: true });

const SHOTS = [
  {
    name: 'org-identity-operating-light',
    path: '/organization/profile/identity-scale',
    theme: 'light',
  },
  {
    name: 'org-identity-operating-dark',
    path: '/organization/profile/identity-scale',
    theme: 'dark',
  },
  {
    name: 'org-readiness-light',
    path: '/organization/readiness/summary',
    theme: 'light',
  },
  {
    name: 'org-readiness-dark',
    path: '/organization/readiness/summary',
    theme: 'dark',
  },
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on('pageerror', (e) => console.log('  [pageerror]', String(e).slice(0, 300)));
page.on('console', (msg) => {
  if (msg.type() === 'error') console.log('  [console.error]', msg.text().slice(0, 300));
});

for (const shot of SHOTS) {
  const url = `${BASE}${shot.path}?screen=org-identity-operating&theme=${shot.theme}`;
  await page.goto(url, { waitUntil: 'networkidle' });
  // Karta „Tożsamość" ładuje się po fetch profilu — czekamy na realny tekst,
  // nie na sztywny timeout.
  await page.waitForSelector('text=Organizacja', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1200);
  const file = path.join(OUT, `${shot.name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log('  saved', file);
}

// Dodatkowy zrzut: karta Tożsamość z rozwiniętym „Szczegóły techniczne" (dowód
// dla ID organizacji w karcie, nie w treści pola).
await page.goto(
  `${BASE}/organization/profile/identity-scale?screen=org-identity-operating&theme=light`,
  { waitUntil: 'networkidle' }
);
await page.waitForSelector('text=Szczegóły techniczne', { timeout: 15000 }).catch(() => {});
await page.click('text=Szczegóły techniczne').catch(() => {});
await page.waitForTimeout(500);
await page.screenshot({
  path: path.join(OUT, 'org-identity-tech-details-expanded-light.png'),
  fullPage: true,
});
console.log('  saved', path.join(OUT, 'org-identity-tech-details-expanded-light.png'));

await browser.close();
console.log('Done. Files in', OUT);
