// Evidence capture — 116-idee-notatnik (dyżur: prawy panel Idea vs Notatnik).
// Wzór: scripts/dev/ui-latki-20260828-screenshots.mjs (fresh context per shot).
// Usage: node scripts/dev/idee-notatnik-116-screenshots.mjs <outdir>
import fs from 'fs';
import { chromium } from 'playwright';

const BASE = process.env.HARNESS_BASE_URL || 'http://localhost:3020';
const OUT = process.argv[2] || '/private/tmp/m03/evidence/assessment/116-idee-notatnik';

fs.mkdirSync(`${OUT}/przed`, { recursive: true });
fs.mkdirSync(`${OUT}/po`, { recursive: true });

const browser = await chromium.launch();

async function shootIdeaPanel(name, theme, outdir) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const url = `${BASE}/?screen=ideas-teresa-panel&theme=${theme}&lang=pl`;
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForSelector('text=Mapa myśli', { timeout: 15000 });
  await page.waitForTimeout(300);
  // Rozwiń wszystkie sekcje akordeonu poza domyślnie otwartą Historią, żeby
  // jeden zrzut pokazał całą powłokę: Akcje, Właściwości, Powiązania.
  for (const label of ['Akcje', 'Właściwości', 'Powiązania']) {
    const header = page.getByText(label, { exact: true }).first();
    if (await header.count()) {
      await header.click();
      await page.waitForTimeout(120);
    }
  }
  const path = `${outdir}/${name}.png`;
  await page.screenshot({ path, fullPage: true });
  console.log('saved', path);
  await context.close();
}

async function shootNotebookRail(name, theme, outdir) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 1400 } });
  const page = await context.newPage();
  const url = `${BASE}/?screen=mywork-notebook-rail-speca&theme=${theme}&lang=pl`;
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForSelector('text=Warsztat 3', { timeout: 15000 });
  await page.waitForTimeout(400);
  for (const label of ['Komentarze', 'Historia i AI']) {
    const header = page.getByText(label, { exact: true }).first();
    if (await header.count()) {
      await header.click();
      await page.waitForTimeout(120);
    }
  }
  const path = `${outdir}/${name}.png`;
  await page.screenshot({ path, fullPage: true });
  console.log('saved', path);
  await context.close();
}

const mode = process.env.SHOT_MODE || 'po';
const outdir = mode === 'przed' ? `${OUT}/przed` : `${OUT}/po`;

await shootIdeaPanel('01-idea-panel-light', 'light', outdir);
await shootIdeaPanel('02-idea-panel-dark', 'dark', outdir);
await shootNotebookRail('03-notebook-rail-light', 'light', outdir);
await shootNotebookRail('04-notebook-rail-dark', 'dark', outdir);

await browser.close();
console.log('DONE', mode);
