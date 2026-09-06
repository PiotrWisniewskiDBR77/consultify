#!/usr/bin/env node
/**
 * STANOWISKO LOKALNE NOC — odświeżenie sesji Playwright dla audytorów/robotników.
 *
 * Loguje się PRZEZ FORMULARZ (http://localhost:3090/login, testid email-input /
 * password-input / login-button) kontem z /private/tmp/stanowisko-noc/konto.json
 * i zapisuje storageState do /private/tmp/stanowisko-noc/auth.json.
 *
 * Dlaczego formularz, a nie samo POST /api/auth/login: aplikacja trzyma token w
 * localStorage pod kluczami, które ustawia KOD FRONTENDU. Ręcznie wstrzyknięty
 * token bywa niekompletny (brak refreshToken/uzytkownika w store) i pierwsza
 * nawigacja wyrzuca na /login. Logowanie formularzem daje dokładnie ten sam stan,
 * co u człowieka.
 *
 * Plik sesji jest zgodny z scripts/dev/odbior-zywo/zrzut.mjs: zapisujemy origin
 * `http://localhost:3000` (kanoniczny, którego szuka tamten skrypt) ORAZ realny
 * `http://localhost:<port>`, więc działa i z `--port=3090`, i bez `--port`.
 *
 * Uruchamiaj ponownie, gdy token wygaśnie (JWT_EXPIRES_IN ~8h):
 *   node scripts/dev/stanowisko-lokalne/zaloguj-api.mjs
 *
 * Parametry (opcjonalne):
 *   --port=3090          port frontendu stanowiska
 *   --konto=<sciezka>    inny plik konta
 *   --out=<sciezka>      inny plik sesji
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const get = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const port = Number(get('port', '3090'));
const kontoPath = get('konto', '/private/tmp/stanowisko-noc/konto.json');
const out = get('out', '/private/tmp/stanowisko-noc/auth.json');
const baza = `http://localhost:${port}`;

if (!fs.existsSync(kontoPath)) { console.error(`Brak pliku konta: ${kontoPath}`); process.exit(2); }
const konto = JSON.parse(fs.readFileSync(kontoPath, 'utf8'));
if (!konto.email || !konto.haslo) { console.error('konto.json musi mieć pola email i haslo'); process.exit(2); }

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pl-PL' });
const page = await ctx.newPage();
const bledy = [];
page.on('console', (m) => { if (m.type() === 'error') bledy.push(m.text().slice(0, 160)); });

await page.goto(`${baza}/login`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);
await page.getByTestId('email-input').fill(konto.email);
await page.getByTestId('password-input').fill(konto.haslo);
await page.getByTestId('login-button').click();

// Czekamy aż aplikacja opuści /login (albo aż token pojawi się w localStorage).
let ok = false;
for (let i = 0; i < 40; i += 1) {
  await page.waitForTimeout(500);
  const url = page.url();
  const token = await page.evaluate(() => { try { return localStorage.getItem('token'); } catch { return null; } });
  if (token && !url.includes('/login')) { ok = true; break; }
}
// Wyciszamy pierwszorazowy onboarding ("Krok 1 z 3 — WITAJ W CONSULTIFY").
// Bez tego KAZDY nocny zrzut ma na wierzchu kreator powitalny zamiast ekranu
// produktu. Klucz: src/components/Onboarding/useFirstRunOnboarding.ts (doneKey).
// --z-onboardingiem = zostaw kreator (gdy ktos odbiera wlasnie ten ekran).
if (!args.includes('--z-onboardingiem')) {
  await page.evaluate((userId) => {
    try {
      if (userId) localStorage.setItem(`consultify_onboarding_done:${userId}`, 'true');
      localStorage.setItem('demo_tour_completed', 'true');
      localStorage.setItem('demo_tour_skipped', 'true');
    } catch { /* localStorage niedostepny */ }
  }, konto.userId || null);
  await page.waitForTimeout(300);
}

const koncowyUrl = page.url();
const stan = await ctx.storageState();
await browser.close();

if (!ok) {
  console.error(JSON.stringify({ ok: false, url: koncowyUrl, bledyKonsoli: bledy.slice(0, 5) }, null, 2));
  process.exit(1);
}

// Dopisujemy kanoniczny origin localhost:3000 (patrz nagłówek).
const zrodlo = (stan.origins || []).find((o) => o.origin === baza);
if (zrodlo && !(stan.origins || []).some((o) => o.origin === 'http://localhost:3000')) {
  stan.origins.push({ ...zrodlo, origin: 'http://localhost:3000' });
}
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(stan, null, 2), { mode: 0o600 });
console.log(JSON.stringify({
  ok: true,
  plik: out,
  url: koncowyUrl,
  originy: stan.origins.map((o) => o.origin),
  bledyKonsoli: bledy.slice(0, 5),
}, null, 2));
