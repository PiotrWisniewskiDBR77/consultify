// Jednorazowy skrypt dowodowy P2A: zrzuty pustych stanów świeżej organizacji na staging.
// Nie jest częścią testów automatycznych — tylko zbiera dowód wizualny do evidence/.
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.P2A_BASE_URL || 'https://staging.consultify.ai';
const EMAIL = process.env.P2A_EMAIL;
const PASSWORD = process.env.P2A_PASSWORD;
if (!EMAIL || !PASSWORD) {
  console.error('Ustaw P2A_EMAIL i P2A_PASSWORD (konto testowe na staging) przed uruchomieniem.');
  process.exit(1);
}
const OUT = new URL('../../evidence/p2a-puste-stany-20260910/', import.meta.url);
fs.mkdirSync(OUT, { recursive: true });

const screens = [
  { key: '01-czat', label: 'Czat / Teresa', path: '/' },
  { key: '02-moja-praca', label: 'Moja Praca', path: '/my-work' },
  { key: '03-wywiad', label: 'Wywiad', path: '/interview' },
  { key: '04-ocena', label: 'Ocena', path: '/assessment' },
  { key: '05-organizacja', label: 'Organizacja', path: '/organization' },
  { key: '06-ustawienia', label: 'Ustawienia', path: '/settings' },
];

async function shot(page, key, theme) {
  await page.emulateMedia({ colorScheme: theme });
  await page.waitForTimeout(600);
  await page.screenshot({ path: new URL(`${key}-${theme}.png`, OUT).pathname, fullPage: false });
}

const run = async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.goto(`${BASE}/login`);
  await page.waitForLoadState('networkidle');
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button:has-text("Log in"), button:has-text("Zaloguj")');
  await page.waitForTimeout(2500);

  for (const s of screens) {
    try {
      await page.goto(`${BASE}${s.path}`);
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(1000);
      await shot(page, s.key, 'light');
      await shot(page, s.key, 'dark');
      const text = await page.locator('main').first().innerText().catch(() => '(brak main)');
      fs.writeFileSync(new URL(`${s.key}.txt`, OUT).pathname, `URL: ${BASE}${s.path}\n---\n${text}\n`);
      console.log('OK', s.key);
    } catch (e) {
      console.log('BLAD', s.key, e.message);
    }
  }

  await browser.close();
};

run();
