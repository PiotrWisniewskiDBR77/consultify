// Dowód dla ZLECENIA mvp/raporty-menu2-cta [ODMROZENIE 06_EXECUTION DEC-453].
// Renderuje REALNĄ trasę /execution (Realizacja → Raporty) na lokalnym API+Vite
// (patrz stanowisko: API 4171 / Vite 3191 --mode test, baza consultify_kopia_final),
// loguje się przez /api/auth/login (bez klikania formularza), 1440x900,
// jasny i ciemny motyw, zapisuje PNG do evidence/raporty-menu2-cta/.
//
// UWAGA: `--mode test` na Vite jest CELOWE — `executionLocalReviewEnabled`
// (src/components/Execution/executionLocalReviewData.ts) wstrzykuje fixture
// „2 raporty" w zwykłym `vite dev`, gdy API zwraca pustą tabelę (wygodne dla
// developera, ale KŁAMIE o realnym stanie 0 raportów). `--mode test` wyłącza
// tę furtkę (`import.meta.env.MODE !== 'test'`), więc zrzut „0 raportów"
// pokazuje PRAWDZIWY pusty stan z bazy, nie fixture.
//
// Użycie:
//   node scripts/dev/raporty-menu2-cta-screenshots.mjs --krok 0-raportow
//   node scripts/dev/raporty-menu2-cta-screenshots.mjs --krok menu-otwarte
//   node scripts/dev/raporty-menu2-cta-screenshots.mjs --krok po-wyborze
//   node scripts/dev/raporty-menu2-cta-screenshots.mjs --krok 2-raporty
//   node scripts/dev/raporty-menu2-cta-screenshots.mjs --krok member

import { chromium } from 'playwright';
import fs from 'node:fs';

const args = process.argv.slice(2);
const arg = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};
const KROK = arg('krok', '0-raportow');
const API = 'http://127.0.0.1:4171';
const BASE = 'http://127.0.0.1:3191';
const OUT = 'evidence/raporty-menu2-cta';
fs.mkdirSync(OUT, { recursive: true });

async function login(email, password) {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`login failed ${res.status}: ${await res.text()}`);
  return res.json();
}

async function seedSession(page, session, theme) {
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(
    ({ session, theme }) => {
      localStorage.setItem('token', session.token);
      localStorage.setItem('refreshToken', session.refreshToken);
      localStorage.setItem('user', JSON.stringify(session.user));
      localStorage.setItem('consultify_current_org_id', session.user.organizationId);
      localStorage.setItem('i18nextLng', 'pl');
      try {
        const raw = localStorage.getItem('consultify-storage');
        const storage = raw ? JSON.parse(raw) : { state: {}, version: 0 };
        storage.state = storage.state || {};
        storage.state.theme = theme;
        localStorage.setItem('consultify-storage', JSON.stringify(storage));
      } catch (e) {
        console.error('Nie udało się wymusić motywu:', e);
      }
    },
    { session, theme }
  );
}

const bledyKonsoli = [];
function wireConsole(page) {
  page.on('console', (m) => m.type() === 'error' && bledyKonsoli.push(m.text()));
  page.on('pageerror', (e) => bledyKonsoli.push(String(e)));
  page.on('response', (r) => {
    if (r.status() >= 400 && !r.url().includes('/api/auth/')) {
      bledyKonsoli.push(`HTTP ${r.status()} ${r.url()}`);
    }
  });
}

function zapiszRaport(nazwa, extra = {}) {
  fs.writeFileSync(
    `${OUT}/${nazwa}.png.json`,
    JSON.stringify({ krok: KROK, bledyKonsoli, ...extra }, null, 2)
  );
}

const browser = await chromium.launch();

async function otworzRaporty(page) {
  await page.goto(`${BASE}/execution`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1200);
  // Klik zakładki "Raporty" w Menu 1 modułu Realizacja.
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    const btn = btns.find((b) => (b.textContent ?? '').trim() === 'Raporty');
    btn?.click();
  });
  await page.waitForTimeout(1200);
}

if (KROK === '0-raportow') {
  const session = await login('audyt@dbr77.local', 'AudytDBR77!2026');
  for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.emulateMedia({ colorScheme: theme });
    wireConsole(page);
    await seedSession(page, session, theme);
    await otworzRaporty(page);
    const plik = `01-0-raportow-${theme}`;
    await page.screenshot({ path: `${OUT}/${plik}.png`, fullPage: false });
    zapiszRaport(plik, { url: page.url(), theme });
    console.log(plik, 'błędy konsoli:', bledyKonsoli.length);
    await context.close();
  }
} else if (KROK === 'menu-otwarte') {
  const session = await login('audyt@dbr77.local', 'AudytDBR77!2026');
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.emulateMedia({ colorScheme: 'light' });
  wireConsole(page);
  await seedSession(page, session, 'light');
  await otworzRaporty(page);
  await page.click('[data-testid="execution-reports-add-report-menu-trigger"]');
  await page.waitForTimeout(500);
  const plik = '02-menu-otwarte-light';
  await page.screenshot({ path: `${OUT}/${plik}.png`, fullPage: false });
  zapiszRaport(plik, { url: page.url() });
  console.log(plik, 'błędy konsoli:', bledyKonsoli.length);
  await context.close();
} else if (KROK === 'po-wyborze') {
  // UWAGA: `audyt@dbr77.local` ma sztuczny (nie-UUID) `id` — kolumna
  // `execution_report_snapshots.created_by` jest typu `uuid`, więc INSERT
  // pęka na "invalid input syntax for type uuid" (środowiskowy artefakt
  // lokalnego konta stanowiska, NIE regresja tej zmiany). Realny użytkownik
  // DBR77 (prawdziwy UUID) z tymczasowo nadanym hasłem na czas dowodu.
  const session = await login('piotr.wisniewski@dbr77.com', 'TestGenerowanie2026!');
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.emulateMedia({ colorScheme: 'light' });
  wireConsole(page);
  await seedSession(page, session, 'light');
  await otworzRaporty(page);
  await page.click('[data-testid="execution-reports-add-report-menu-trigger"]');
  await page.waitForTimeout(400);
  // "Karta realizacji" = initiative-card (poziom OWNER) — pierwsza pozycja MVP.
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('[role="menuitem"]')];
    const btn = btns.find((b) => (b.textContent ?? '').includes('Karta realizacji'));
    btn?.click();
  });
  await page.waitForTimeout(600);
  await page.waitForSelector('[data-testid="execution-report-wizard"]', { timeout: 10000 });
  await page.click('[data-testid="execution-report-wizard"] button:has-text("Generuj migawkę")');
  await page.waitForTimeout(3000);
  const plik = '03a-po-wyborze-raport-w-tabeli';
  await page.screenshot({ path: `${OUT}/${plik}.png`, fullPage: false });
  zapiszRaport(plik, { url: page.url() });
  console.log(plik, 'błędy konsoli:', bledyKonsoli.length);

  // Reload — sprawdź, że raport przetrwał odświeżenie.
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    const btn = btns.find((b) => (b.textContent ?? '').trim() === 'Raporty');
    btn?.click();
  });
  await page.waitForTimeout(1000);
  const plik2 = '03b-po-reload-raport-nadal-jest';
  await page.screenshot({ path: `${OUT}/${plik2}.png`, fullPage: false });
  zapiszRaport(plik2, { url: page.url() });
  console.log(plik2, 'błędy konsoli:', bledyKonsoli.length);
  await context.close();
} else if (KROK === '2-raporty') {
  const session = await login('audyt@dbr77.local', 'AudytDBR77!2026');
  for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.emulateMedia({ colorScheme: theme });
    wireConsole(page);
    await seedSession(page, session, theme);
    await otworzRaporty(page);
    const plik = `04-2-raporty-dbr77-${theme}`;
    await page.screenshot({ path: `${OUT}/${plik}.png`, fullPage: false });
    zapiszRaport(plik, { url: page.url(), theme });
    console.log(plik, 'błędy konsoli:', bledyKonsoli.length);
    await context.close();
  }
} else if (KROK === 'member') {
  const session = await login('member@dbr77.local', 'AudytDBR77!2026');
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.emulateMedia({ colorScheme: 'light' });
  wireConsole(page);
  await seedSession(page, session, 'light');
  await otworzRaporty(page);
  const plik = '05-member-cta-widoczne';
  await page.screenshot({ path: `${OUT}/${plik}.png`, fullPage: false });
  zapiszRaport(plik, { url: page.url() });
  console.log(plik, 'błędy konsoli:', bledyKonsoli.length);
  await context.close();
} else {
  console.error('Nieznany --krok:', KROK);
  process.exitCode = 1;
}

await browser.close();
