/**
 * Zrzuty dowodowe do uwag testera Tomka (T-II, T-III).
 *
 * Uruchamiany DWA razy: raz na kodzie sprzed naprawy (faza "przed"), raz po
 * naprawie (faza "po"). Faza idzie argumentem:
 *   node scripts/dev/tomek-konto-zrzuty.mjs przed
 *   node scripts/dev/tomek-konto-zrzuty.mjs po
 *
 * Wymaga działających: API na 4321 i Vite na 5331 (patrz raport).
 * Motyw JASNY ustawiany przez zustand w localStorage — `emulateMedia` tego
 * NIE zmienia (lekcja z pomiaru 12 zrzutów „jasnych", które były ciemne).
 */
import { mkdirSync } from 'node:fs';
import path from 'node:path';

import { chromium } from 'playwright';

const FAZA = process.argv[2] === 'po' ? 'po' : 'przed';
const BASE = 'http://127.0.0.1:5331';
const KATALOG = path.resolve('evidence/tomek-konto-20260914');
const EMAIL = 'tomek.evidence@example.test';
const HASLO = 'HasloTomka!2026';

mkdirSync(KATALOG, { recursive: true });

/**
 * Bezpiecznik: zrzut nie może pokazywać PRZYRZĄDU zamiast produktu. Jeżeli na
 * ekranie dalej wisi modal pierwszego uruchomienia albo strona jest ciemna
 * mimo żądania motywu jasnego — mówimy o tym głośno, zamiast zapisać ładny
 * plik z nieprawdą.
 */
const zrzut = async (page, nazwa) => {
  const modal = await page.locator('text=Meet Teresa').count();
  if (modal > 0) console.log(`OSTRZEŻENIE [${nazwa}]: modal onboardingu wciąż na ekranie`);

  const ciemny = await page.evaluate(() => {
    const tlo = getComputedStyle(document.body).backgroundColor;
    const m = tlo.match(/\d+/g);
    if (!m) return null;
    const [r, g, b] = m.map(Number);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b < 128;
  });
  if (ciemny) console.log(`OSTRZEŻENIE [${nazwa}]: tło ciemne mimo motywu jasnego`);

  const plik = path.join(KATALOG, `${nazwa}-${FAZA}.png`);
  await page.screenshot({ path: plik, fullPage: false });
  console.log(`zapisano: ${plik}`);
};

const run = async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: 'light',
  });

  // Motyw jasny + token sesji wstrzykiwane PRZED pierwszym renderem.
  const res = await fetch('http://127.0.0.1:4321/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: HASLO }),
  });
  const dane = await res.json();
  if (!dane?.token) throw new Error(`logowanie nie powiodło się: ${JSON.stringify(dane)}`);

  await context.addInitScript(
    ({ token, user }) => {
      try {
        localStorage.setItem('token', token);
        localStorage.setItem('authToken', token);
        localStorage.setItem('user', JSON.stringify(user));

        // MOTYW: trzymany przez zustand-persist pod kluczem
        // `consultify-storage` (src/store/useAppStore.ts:56), domyślnie
        // 'dark' (uiSlice.ts:163). `emulateMedia`/`colorScheme` tego NIE
        // zmienia — pierwsze podejście dało 2 zrzuty „jasne", które były
        // ciemne. Wstrzykujemy realny kształt persist: { state, version }.
        localStorage.setItem(
          'consultify-storage',
          JSON.stringify({ state: { theme: 'light' }, version: 0 })
        );

        // ONBOARDING: modal pierwszego uruchomienia zasłaniał CAŁY ekran na
        // każdym zrzucie (klasyczne „przyrząd zasłania produkt"). Gasimy go
        // lokalną flagą `consultify_onboarding_done:{userId}`
        // (src/components/Onboarding/useFirstRunOnboarding.ts:8).
        if (user?.id) {
          localStorage.setItem(`consultify_onboarding_done:${user.id}`, 'true');
        }
      } catch {
        /* puste */
      }
    },
    { token: dane.token, user: dane.user }
  );

  const page = await context.newPage();

  // --- T-II: /help z maila powitalnego ---
  await page.goto(`${BASE}/help`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  console.log(`T-II adres po wejściu na /help: ${page.url()}`);
  await zrzut(page, 't-ii-help');

  // --- T-III: profil, zapis telefonu ---
  await page.goto(`${BASE}/settings/profile`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  const pole = page.locator('#profile-phone').first();
  if (await pole.count()) {
    await pole.fill('+48 601 234 567');
  } else {
    console.log('UWAGA: nie znalazłem pola telefonu po selektorze — zrzut i tak leci');
  }
  await zrzut(page, 't-iii-profil-przed-zapisem');

  const zapisz = page
    .locator('button', { hasText: /Zapisz|Save Changes|Save/i })
    .first();
  if (await zapisz.count()) {
    await zapisz.click();
    await page.waitForTimeout(3000);
  }
  await zrzut(page, 't-iii-profil-po-zapisie');

  // Po odświeżeniu — czy telefon przetrwał.
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  await zrzut(page, 't-iii-profil-po-odswiezeniu');

  await browser.close();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
