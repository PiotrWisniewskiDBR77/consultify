// Evidence for 1.1-N (2026-09-06) — prawy róg warsztatu Pomysłów (Process Flow):
// Menu 2 (segment trzech ikon: Narzędzia/Kontekst/Sugestie AI, crimson zdjęty)
// + Menu 3 (Kształtuje się · Zapisano przed chwilą / Pokaż panel / kebab /
// Konwertuj, pigułka "Teresa" zdjęta — DEC-404c). Prawy panel "Składnik | Teresa"
// BEZ ZMIAN (dowód: zrzut z otwartym panelem, zakładki nietknięte).
//
// Usage: node scripts/dev/1-1-n-warsztat-rog-screenshots.mjs [outdir]
import fs from 'fs';
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3131';
const OUT = process.argv[2] || '/private/tmp/wt-11n/evidence/1-1-n';

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  colorScheme: 'dark',
});
const page = await context.newPage();

const url = `${BASE}/?screen=mywork-idea-topbar&tool=process_flow&theme=dark`;
console.log('navigating', url);
await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(1200);

// 01 — cały warsztat, panel "Składnik | Teresa" otwarty (BEZ ZMIAN).
await page.screenshot({ path: `${OUT}/01-warsztat-panel-otwarty.png`, fullPage: false });

// 02 — zbliżenie prawego rogu (Menu 2 + Menu 3), panel otwarty.
const corner = page.locator('[data-testid="mels-topbar-chips"]').first();
await corner.scrollIntoViewIfNeeded().catch(() => {});
await page.screenshot({
  path: `${OUT}/02-prawy-rog-panel-otwarty.png`,
  clip: { x: 620, y: 0, width: 820, height: 64 },
});

// 03 — kebab Menu 3 otwarty (dowód kolejności overflow: Eksport/Historia/…).
await page.locator('[data-testid="mels-topbar-overflow"]').click();
await page.waitForTimeout(200);
await page.screenshot({ path: `${OUT}/03-kebab-otwarty.png`, fullPage: false });
await page.keyboard.press('Escape');
await page.waitForTimeout(150);

// 04 — zamknij panel: "Pokaż panel" musi się pojawić jako JEDYNE wejście.
await page.locator('[data-testid="idea-panel-close"]').click();
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/04-panel-zamkniety-pokaz-panel.png`, fullPage: false });

// 05 — Menu 2 (trzy ikony) z otwartym panelem "Narzędzia" — dowód: bez crimson.
await page.locator('button[aria-label="Narzędzia"]').click();
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/05-menu2-narzedzia-aktywne.png`, fullPage: false });

// 06 — light theme (kontrola pary jasny/ciemny).
await page.emulateMedia({ colorScheme: 'light' });
await page.goto(`${BASE}/?screen=mywork-idea-topbar&tool=process_flow&theme=light`, {
  waitUntil: 'networkidle',
  timeout: 60000,
});
await page.waitForTimeout(1000);
await page.screenshot({ path: `${OUT}/06-warsztat-jasny.png`, fullPage: false });

await browser.close();
console.log('DONE', OUT);
