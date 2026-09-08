// Zrzuty dowodowe paczki D2 (docs/program/DANE_POKAZOWE_EN_20260908/PLAN.md §D2)
// — Interview (lista + podgląd z odpowiedziami), Tools (lista + wynik sesji),
// Assessment (lista + raport). Headless Playwright przeciw realnemu frontendowi
// (npx vite --mode test --port 38271, scripts/dev/d2-odkrycie-frontend.sh)
// i realnemu backendowi (server/src/index.ts, PORT=4180) wskazującemu na
// consultify_kopia_d2. Login OWNER Northwind, hasło z pliku poza repo
// (northwind-konta-d2.txt — patrz komentarz w tym pliku o kolizji z domyślną
// ścieżką haslo-plik dzieloną między pakietami D1-D6).
//
// Użycie: node scripts/dev/d2-odkrycie-screenshots.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://localhost:38271';
const EMAIL = 'james.whitfield@northwind.example';
const PASSWORD = 'D2-Northwind-2026x';
const OUT_DIR = path.resolve('evidence/dane-pokazowe-en/d2');
fs.mkdirSync(OUT_DIR, { recursive: true });

async function login(page) {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Log in' }).first().click();
  await page.waitForTimeout(500);
  await page.locator('input[type="email"]').first().fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(PASSWORD);
  const [loginResp] = await Promise.all([
    page.waitForResponse((res) => res.url().includes('/api/auth/login'), { timeout: 15000 }),
    page.locator('input[type="password"]').first().press('Enter'),
  ]);
  console.log('LOGIN STATUS', loginResp.status(), await loginResp.text().catch(() => '<no body>'));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT_DIR, '00-after-login.png') });
  // Onboarding tour dialog — dismiss if present.
  const skip = page.getByRole('button', { name: 'Skip for now' });
  if (await skip.isVisible().catch(() => false)) await skip.click();
}

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await login(page);

  // ---- 1. Interview — lista sesji -----------------------------------------
  await page.goto(`${BASE}/interview?tab=sessions`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(OUT_DIR, '01-interview-lista.png') });

  // ---- 2. Interview — podgląd z odpowiedziami (double-click otwiera pełny widok) ---
  await page.getByText('Plant Operations — Leeds', { exact: false }).first().dblclick();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(OUT_DIR, '02-interview-podglad-odpowiedzi.png') });

  // ---- 3. Tools — lista sesji narzędzi -------------------------------------
  await page.goto(`${BASE}/discovery-tools`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(OUT_DIR, '03-tools-lista.png') });

  // ---- 4. Tools — wynik sesji (Value Stream Map) ---------------------------
  const vsmRow = page.getByText('Warehouse Outbound Value Stream Map', { exact: false }).first();
  if (await vsmRow.isVisible().catch(() => false)) {
    await vsmRow.dblclick();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(OUT_DIR, '04-tools-wynik-sesji.png') });
  } else {
    await page.screenshot({ path: path.join(OUT_DIR, '04-tools-wynik-sesji-STOP-nie-znaleziono-wiersza.png') });
  }

  // ---- 5. Assessment — lista ocen ------------------------------------------
  await page.goto(`${BASE}/assessment`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(OUT_DIR, '05-assessment-lista.png') });

  // ---- 6. Assessment — raport ------------------------------------------------
  const assessmentRow = page.getByText('Operational Maturity Assessment', { exact: false }).first();
  if (await assessmentRow.isVisible().catch(() => false)) {
    await assessmentRow.dblclick();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(OUT_DIR, '06-assessment-raport.png') });
  } else {
    await page.screenshot({ path: path.join(OUT_DIR, '06-assessment-raport-STOP-nie-znaleziono-wiersza.png') });
  }

  await browser.close();
  console.log('Zapisano zrzuty do', OUT_DIR);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
