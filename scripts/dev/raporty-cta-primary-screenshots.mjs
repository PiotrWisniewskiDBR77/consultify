// Dowód dla ZLECENIA mvp/raporty-cta-primary [ODMROZENIE 06_EXECUTION DEC-453].
// CTA "Dodaj raport" (Realizacja -> Raporty) przeniesione z btn-secondary
// (onRegisterFilterControl / AddReportMenu) do ciemnego primary CTA
// (onRegisterPrimaryCta, wariant menu) - ten sam wyglad co Praca/Zasoby/
// Decyzje i ryzyka. Stanowisko: API 4176 / Vite 3196 (--mode test) na
// kopii bazy consultify_kopia_final, logowanie przez /api/auth/login.
import { chromium } from 'playwright';
import fs from 'node:fs';

const args = process.argv.slice(2);
const arg = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};
const KROK = arg('krok', 'raporty-zamkniete');
const API = 'http://127.0.0.1:4176';
const BASE = 'http://127.0.0.1:3196';
const OUT = 'evidence/raporty-cta-primary';
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
      localStorage.setItem('demo_tour_skipped', '1');
      localStorage.setItem('demo_tour_completed', '1');
      try {
        const raw = localStorage.getItem('consultify-storage');
        const storage = raw ? JSON.parse(raw) : { state: {}, version: 0 };
        storage.state = storage.state || {};
        storage.state.theme = theme;
        localStorage.setItem('consultify-storage', JSON.stringify(storage));
      } catch (e) {
        console.error('Nie udalo sie wymusic motywu:', e);
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

async function klikZakladke(page, nazwa) {
  await page.evaluate((label) => {
    const btns = [...document.querySelectorAll('button')];
    const btn = btns.find((b) => (b.textContent ?? '').trim() === label);
    btn?.click();
  }, nazwa);
  await page.waitForTimeout(1200);
}

async function otworzExecution(page, zakladka) {
  await page.goto(`${BASE}/execution`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1200);
  await klikZakladke(page, zakladka);
}

if (KROK === 'raporty-zamkniete') {
  const session = await login('audyt@dbr77.local', 'AudytDBR77!2026');
  for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.emulateMedia({ colorScheme: theme });
    wireConsole(page);
    await seedSession(page, session, theme);
    await otworzExecution(page, 'Raporty');
    const plik = `01-raporty-cta-zamkniete-${theme}`;
    await page.screenshot({ path: `${OUT}/${plik}.png`, fullPage: false });
    zapiszRaport(plik, { url: page.url(), theme });
    console.log(plik, 'bledy konsoli:', bledyKonsoli.length);
    await context.close();
  }
} else if (KROK === 'raporty-menu-otwarte') {
  const session = await login('audyt@dbr77.local', 'AudytDBR77!2026');
  for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.emulateMedia({ colorScheme: theme });
    wireConsole(page);
    await seedSession(page, session, theme);
    await otworzExecution(page, 'Raporty');
    await page.evaluate(() => {
      const btn = document.querySelector('[data-testid="execution-reports-add-report-menu"]');
      btn?.click();
    });
    await page.waitForTimeout(500);
    const plik = `02-raporty-cta-menu-otwarte-${theme}`;
    await page.screenshot({ path: `${OUT}/${plik}.png`, fullPage: false });
    zapiszRaport(plik, { url: page.url(), theme });
    console.log(plik, 'bledy konsoli:', bledyKonsoli.length);
    await context.close();
  }
} else if (KROK === 'decyzje-porownanie') {
  const session = await login('audyt@dbr77.local', 'AudytDBR77!2026');
  for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.emulateMedia({ colorScheme: theme });
    wireConsole(page);
    await seedSession(page, session, theme);
    await otworzExecution(page, 'Decyzje i ryzyka');
    const plik = `03-decyzje-i-ryzyka-porownanie-${theme}`;
    await page.screenshot({ path: `${OUT}/${plik}.png`, fullPage: false });
    zapiszRaport(plik, { url: page.url(), theme });
    console.log(plik, 'bledy konsoli:', bledyKonsoli.length);
    await context.close();
  }
}

await browser.close();
