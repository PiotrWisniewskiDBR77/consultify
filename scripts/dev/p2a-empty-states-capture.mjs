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

// PRZYCZYNA (znaleziona 2026-09-10, ZADANIE 2 dyżuru p10-decyzje): motyw
// aplikacji NIE zależy od `prefers-color-scheme` przeglądarki. Trzyma go
// zustand store, persystowany do `localStorage['consultify-storage'].state.theme`
// (domyślnie 'dark' — src/store/slices/uiSlice.ts:163), a `ThemeSync`
// (src/providers/AppProviders.tsx) nakłada klasę `.dark` na <html> na
// podstawie TEJ wartości, ignorując `prefers-color-scheme` chyba że
// theme==='system' (identyczny mechanizm i identyczny bug udokumentowany już
// raz w dev-render/main.tsx przy ?theme=). Dlatego `page.emulateMedia({colorScheme})`
// nigdy nic nie zmieniał — świeże konto ma domyślnie theme:'dark', więc KAŻDY
// poprzedni zrzut (i nazwany "-light", i "-dark") wychodził ciemny.
//
// Naprawa: wstrzykujemy pożądany motyw do localStorage PRZED uruchomieniem
// kodu aplikacji (`context.addInitScript` wykonuje się przed skryptami strony
// na KAŻDYM nowym dokumencie w tym kontekście), żeby `initThemeClass()`
// (src/index.tsx) i rehydratacja zustand-persist odczytały właściwą wartość
// od razu przy starcie — bez tego set na żywym już zamontowanym store nie
// miałby efektu wstecznego. Osobny `BrowserContext` na motyw, bo
// `addInitScript` nie da się podmienić w locie.
async function captureTheme(theme) {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript((t) => {
    try {
      localStorage.setItem('consultify-storage', JSON.stringify({ state: { theme: t }, version: 2 }));
    } catch {
      // localStorage niedostępny (np. tryb prywatny) — zostanie domyślny motyw aplikacji.
    }
  }, theme);
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

      // Bezpiecznik dowodowy: potwierdź NAPRAWDĘ zastosowany motyw zamiast
      // zakładać, że wstrzyknięcie zadziałało (ta sama pułapka co przy emulateMedia).
      const applied = await page.evaluate(() =>
        document.documentElement.classList.contains('dark') ? 'dark' : 'light'
      );
      if (applied !== theme) {
        console.log('OSTRZEZENIE', s.key, `zadany motyw ${theme}, zastosowany faktycznie ${applied}`);
      }

      await page.screenshot({ path: new URL(`${s.key}-${theme}.png`, OUT).pathname, fullPage: false });
      const text = await page.locator('main').first().innerText().catch(() => '(brak main)');
      fs.writeFileSync(
        new URL(`${s.key}-${theme}.txt`, OUT).pathname,
        `URL: ${BASE}${s.path}\nMotyw zadany: ${theme} / zastosowany faktycznie: ${applied}\n---\n${text}\n`
      );
      console.log('OK', s.key, theme);
    } catch (e) {
      console.log('BLAD', s.key, theme, e.message);
    }
  }

  await browser.close();
}

const run = async () => {
  await captureTheme('light');
  await captureTheme('dark');
};

run();
