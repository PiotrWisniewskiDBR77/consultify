// grafika/logowanie-i18n-20260902 — dowod PO dla rodziny ekranow przed
// zalogowaniem (logowanie, rejestracja, kod organizacji, odzyskiwanie hasla,
// zmiana hasla z linku, weryfikacja e-mail [martwy komponent]).
//
// Wzor: scripts/dev/ui-latki-20260828-screenshots.mjs (swiezy kontekst per zrzut).
// Usage: node scripts/dev/logowanie-i18n-20260902-screenshots.mjs <outdir>
import fs from 'fs';
import { chromium } from 'playwright';

const BASE = process.env.LOGOWANIE_I18N_BASE_URL || 'http://localhost:4560';
const OUT = process.argv[2] || 'evidence/grafika/215-logowanie-i18n';

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();

async function shoot(name, screen, theme, opts = {}) {
  const context = await browser.newContext({ viewport: { width: 900, height: 900 } });
  const page = await context.newPage();
  const url = `${BASE}/?screen=${screen}&lang=pl&theme=${theme}`;
  console.log('navigating', url);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  if (opts.waitFor) {
    await page.waitForSelector(opts.waitFor, { timeout: 15000 }).catch(() => {});
  }
  await page.waitForTimeout(400);
  const path = `${OUT}/${name}.png`;
  await page.screenshot({ path, fullPage: false });
  console.log('saved', path);
  await context.close();
}

// 1) LOGOWANIE
await shoot('01-logowanie-light', 'auth-login', 'light', { waitFor: 'text=Witamy ponownie' });
await shoot('02-logowanie-dark', 'auth-login', 'dark', { waitFor: 'text=Witamy ponownie' });

// 2) REJESTRACJA
await shoot('03-rejestracja-light', 'auth-register', 'light', {
  waitFor: 'text=Spersonalizujmy',
});
await shoot('04-rejestracja-dark', 'auth-register', 'dark', { waitFor: 'text=Spersonalizujmy' });

// 3) KOD ORGANIZACJI (zaproszenie)
await shoot('05-kod-organizacji-light', 'auth-code-entry', 'light', {
  waitFor: 'text=Wpisz kod dostępu',
});
await shoot('06-kod-organizacji-dark', 'auth-code-entry', 'dark', {
  waitFor: 'text=Wpisz kod dostępu',
});

// 4) ODZYSKIWANIE HASLA
await shoot('07-odzyskiwanie-hasla-light', 'auth-forgot-password', 'light', {
  waitFor: 'text=Zresetuj hasło',
});
await shoot('08-odzyskiwanie-hasla-dark', 'auth-forgot-password', 'dark', {
  waitFor: 'text=Zresetuj hasło',
});

// 5) ZMIANA HASLA Z LINKU
await shoot('09-zmiana-hasla-light', 'auth-reset-password', 'light', {
  waitFor: 'text=Ustaw nowe hasło',
});
await shoot('10-zmiana-hasla-dark', 'auth-reset-password', 'dark', {
  waitFor: 'text=Ustaw nowe hasło',
});

// 6) WERYFIKACJA E-MAIL (martwy komponent — brak trasy, patrz dev-render/screens/auth-verify-email.tsx)
await shoot('11-weryfikacja-email-light', 'auth-verify-email', 'light');
await shoot('12-weryfikacja-email-dark', 'auth-verify-email', 'dark');

await browser.close();
console.log('DONE');
