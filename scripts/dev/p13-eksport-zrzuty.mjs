/**
 * P13 — zrzuty dowodowe przycisku eksportu danych organizacji (DEC-460).
 * Odpala REALNY <OrganizationsView> przez dev-render harness
 * (?screen=p13-eksport-organizacje), bez logowania.
 *
 * Wymaga uruchomionego harnessu:
 *   npx vite --config dev-render/vite.config.ts --port 3124 --strictPort
 *
 * Użycie: node scripts/dev/p13-eksport-zrzuty.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

import { chromium } from 'playwright';

const base = process.env.P13_BASE_URL || 'http://127.0.0.1:3124';
const outDir = path.resolve('evidence/p13-eksport-jezyk-20260910');
fs.mkdirSync(outDir, { recursive: true });

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  await page.goto(`${base}/?screen=p13-eksport-organizacje&lang=pl&theme=light`, {
    waitUntil: 'networkidle',
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(outDir, '01-tabela-organizacje.png'), fullPage: true });

  // Kebab wiersza: button[title="Akcje"][aria-label="Akcje wiersza"] (StandardTable, kolumna sticky).
  const kebab = page.locator('button[aria-label="Akcje wiersza"]').first();
  await kebab.click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(outDir, '02-kebab-otwarty.png'), fullPage: true });

  // Kliknij "Export Data" i przechwyć zdarzenie pobrania pliku.
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 5000 }).catch(() => null),
    page.getByText('Export Data', { exact: true }).click(),
  ]);
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outDir, '03-po-eksporcie.png'), fullPage: true });

  const downloadInfo = download
    ? `Pobrano plik: ${download.suggestedFilename()}`
    : 'BRAK zdarzenia download w 5s';
  fs.writeFileSync(path.join(outDir, 'download-info.txt'), downloadInfo);
  console.log(downloadInfo);

  fs.writeFileSync(path.join(outDir, 'console-errors.txt'), consoleErrors.join('\n') || '(brak)');
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
