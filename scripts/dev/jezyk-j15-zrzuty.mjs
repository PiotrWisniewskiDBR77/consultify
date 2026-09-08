/**
 * DOWÓD JĘZYKOWY MODUŁU USTAWIENIA (paczka J15, DEC-453).
 *
 * Robi zrzuty ekranów modułu w wybranym języku konta i liczy obce słowa
 * WYŁĄCZNIE w napisach interfejsu (przyciski, zakładki, nagłówki, etykiety,
 * `aria-label`, `placeholder`) — nie w komórkach z DANYMI (nazwy urządzeń,
 * adresy IP, nazwy integracji z bazy). Detektor jest TEN SAM, na którym stoi
 * `scripts/i18n/pomiar-jezyka.mjs`, żeby dowód i przyrząd nie rozjechały się
 * definicją „polskiego”.
 *
 * Pułapki przyrządu przejęte z J10 (`evidence/jezyk-j10/README.md`):
 *   - ŚWIEŻA sesja przeglądarki na każdy język (najpierw `users.language`
 *     w bazie, potem logowanie) — inaczej profil nadpisuje `i18nextLng`;
 *   - KOTWICA JĘZYKOWA przed zrzutem — pliki tłumaczeń dochodzą po
 *     `networkidle` i zrzut „po 2 s” łapie stan przejściowy;
 *   - do trzech podejść z POWTÓRZENIEM CAŁEJ akcji (sam reload zamknąłby
 *     otwarty modal i zrzut pokazywałby inny ekran, niż mówi jego nazwa).
 *
 * Użycie: node scripts/dev/jezyk-j15-zrzuty.mjs <katalog-wyjściowy> <pl,en>
 */
import { chromium } from 'playwright';
import { execSync } from 'node:child_process';
import fs from 'node:fs';

const BASE = process.env.J15_BASE || 'http://127.0.0.1:3221';
const DB = process.env.J15_DB || 'consultify_kopia_d22';
const KONTO = 'audyt-j15@dbr77.local';
const OUT = process.argv[2];
const LANGS = (process.argv[3] || 'en').split(',');
fs.mkdirSync(OUT, { recursive: true });
const sql = (q) =>
  execSync(
    `docker exec consultify-pg18 psql -U postgres -d ${DB} -Atc "${q.replace(/"/g, '\\"')}"`,
    { encoding: 'utf8' }
  ).trim();

import { wykryjPolski, wykryjAngielski } from '../i18n/pomiar-jezyka.mjs';

/** Nazwy własne i skróty, które są tym samym słowem w obu językach. */
const NEUTRALNE =
  /^(status|data|ok|pdf|ai|qa|kpi|roi|crm|id|url|api|sms|mfa|otp|totp|sso|saml|scim|ip|pin|email|e-mail|webhook|webhooks|consultify|dbr77|teresa|google|microsoft|slack|github|jira|notion|beta|v\d+)$/i;

/** Surowy klucz i18n wyswietlony zamiast napisu, np. `settings.mfa.title`. */
const KLUCZ_SUROWY = /^[a-z][A-Za-z0-9]*(\.[A-Za-z0-9_-]+){1,6}$/;

const b = await chromium.launch();
let c;
let p;

async function nowaSesja(lang) {
  sql(`UPDATE users SET language='${lang}' WHERE email='${KONTO}'`);
  if (c) await c.close();
  c = await b.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
  p = await c.newPage();
  await p.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1500);
  await p.evaluate((l) => localStorage.setItem('i18nextLng', l), lang);
  await p.locator('input[type="email"]').first().fill(KONTO);
  await p.locator('input[type="password"]').first().fill('AudytDBR77!2026');
  await p.locator('input[type="password"]').first().press('Enter');
  await p.waitForURL((u) => !String(u).includes('/login'), { timeout: 60000 });
  await p.waitForTimeout(1500);
  await p.evaluate(() => {
    const K = 'consultify-storage';
    const r = localStorage.getItem(K);
    const o = r ? JSON.parse(r) : { state: {}, version: 0 };
    o.state = { ...(o.state || {}), theme: 'light' };
    localStorage.setItem(K, JSON.stringify(o));
  });
  await p.evaluate((l) => localStorage.setItem('i18nextLng', l), lang);
  // MODAL POWITALNY zaslania KAZDY ekran ustawien (zmierzone: 30 zrzutow z ta sama
  // trescia modala zamiast produktu — „przyrzad pokazuje nie produkt"). Klucz
  // z `src/components/Onboarding/useFirstRunOnboarding.ts`.
  await p.evaluate(() => localStorage.setItem('consultify_onboarding_done:audyt-j15', 'true'));
  await p.goto(`${BASE}/settings/profile`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(2500);
  // Gdyby modal mimo to wstal (flaga serwerowa) — zamykamy go jawnie.
  const pominInt = p.locator('button').filter({ hasText: /^(Skip for now|Pomin|Pomiń)/ }).first();
  if (await pominInt.count()) {
    await pominInt.click({ timeout: 5000 }).catch(() => {});
    await p.waitForTimeout(1200);
  }
}

async function napisyUi() {
  return p.evaluate(() => {
    const sel =
      'button, [role=tab], [role=menuitem], [role=option], [role=switch], th, label, legend, h1, h2, h3, h4, nav a, [aria-label], [placeholder]';
    const out = new Set();
    for (const el of Array.from(document.querySelectorAll(sel))) {
      if (!(el instanceof HTMLElement)) continue;
      const widoczny = el.offsetParent !== null || el.getBoundingClientRect().width > 0;
      const aria = el.getAttribute('aria-label');
      const ph = el.getAttribute('placeholder');
      if (aria) out.add(aria.trim());
      if (ph) out.add(ph.trim());
      if (!widoczny) continue;
      for (const w of Array.from(el.childNodes)) {
        if (w.nodeType === 3) {
          const t = String(w.textContent || '').trim();
          if (t && t.length < 200) out.add(t);
        }
      }
      const t = (el.innerText || '').trim();
      if (t && t.length < 120 && !t.includes('\n')) out.add(t);
    }
    return Array.from(out);
  });
}

/** KOTWICA JĘZYKOWA — nazwa modułu w bocznym menu Ustawień. */
const KOTWICA = { en: 'Settings', pl: 'Ustawieni' };
async function jezykZgodny(lang) {
  const oczekiwany = KOTWICA[lang];
  for (let proba = 0; proba < 10; proba += 1) {
    const tekst = await p.evaluate(() => document.body.innerText);
    if (tekst.toLowerCase().includes(oczekiwany.toLowerCase())) return true;
    await p.waitForTimeout(1000);
  }
  return false;
}

const raport = [];
async function ekran(lang, nazwa, akcja, interakcja) {
  try {
    let zgodny = false;
    for (let podejscie = 0; podejscie < 3 && !zgodny; podejscie += 1) {
      await p.evaluate((l) => localStorage.setItem('i18nextLng', l), lang);
      await akcja();
      await p.waitForTimeout(1200);
      zgodny = await jezykZgodny(lang);
      if (!zgodny) {
        await p.evaluate((l) => localStorage.setItem('i18nextLng', l), lang);
        await p.goto(`${BASE}/settings/profile`, { waitUntil: 'networkidle' });
        await p.waitForTimeout(2000);
      }
    }
    if (!zgodny) throw new Error(`interfejs nie przeszedł na ${lang} — zrzut byłby fałszywy`);
    if (interakcja) {
      await interakcja();
      await p.waitForTimeout(1500);
    }
    await p.waitForTimeout(1200);
    await p.screenshot({ path: `${OUT}/${nazwa}-${lang}.png`, fullPage: false });
    const napisy = (await napisyUi()).filter((t) => t && !NEUTRALNE.test(t));
    const pl = napisy.filter((t) => wykryjPolski(t));
    const en = napisy.filter((t) => wykryjAngielski(t));
    // SUROWY KLUCZ na ekranie (K3aKLUCZ) — dla uzytkownika EN to defekt tej
    // samej wagi co obcy jezyk, a detektor jezykowy go NIE widzi: „settings.
    // security.title" nie jest ani polskim, ani angielskim slowem.
    const klucze = napisy.filter((t) => KLUCZ_SUROWY.test(t.trim()));
    raport.push({
      lang,
      ekran: nazwa,
      napisowUi: napisy.length,
      polskichUi: pl.length,
      polskie: pl.slice(0, 40),
      angielskichUi: en.length,
      angielskie: en.slice(0, 40),
      surowychKluczyUi: klucze.length,
      surowieKlucze: klucze.slice(0, 40),
    });
  } catch (e) {
    raport.push({ lang, ekran: nazwa, blad: String(e.message).slice(0, 140) });
  }
}

/** Ekrany modułu: sekcje bocznego menu Ustawień (trasa /settings/<sekcja>). */
const SEKCJE = [
  ['01-przeglad', 'overview'],
  ['02-profil', 'profile'],
  ['03-avatar', 'avatar'],
  ['04-podpisy-mailowe', 'signatures'],
  ['05-godziny-pracy', 'working-hours'],
  ['06-jezyk', 'language'],
  ['07-regionalne', 'regional'],
  ['08-bezpieczenstwo-przeglad', 'security-overview'],
  ['09-haslo', 'password'],
  ['10-mfa', 'mfa'],
  ['11-kody-zapasowe', 'recovery'],
  ['12-sesje-aktywnosc', 'sessions-activity'],
  ['13-historia-logowan', 'login-history'],
  ['14-panel-bezpieczenstwa', 'security-dashboard'],
  ['15-powiadomienia', 'notifications-overview'],
  ['16-powiadomienia-email', 'notifications-email-digest'],
  ['17-powiadomienia-dostepnosc', 'notifications-availability'],
  ['18-integracje-aplikacje', 'connected-apps'],
  ['19-integracje-klucze-api', 'api-keys'],
  ['20-integracje-webhooki', 'webhooks'],
  ['21-prywatnosc', 'privacy'],
  ['22-kontrola-danych', 'data-controls'],
  ['23-wyglad', 'theme'],
  ['24-dostepnosc', 'accessibility'],
  ['25-ai-zachowanie', 'ai-behavior'],
  ['26-ai-prywatnosc', 'ai-privacy'],
  ['27-ai-zuzycie', 'ai-usage'],
  ['28-historia-ustawien', 'settings-history'],
  ['29-import-eksport', 'import-export'],
  ['30-pulpit', 'dashboard'],
];

for (const lang of LANGS) {
  await nowaSesja(lang);
  for (const [nazwa, sekcja] of SEKCJE) {
    await ekran(lang, nazwa, async () => {
      await p.goto(`${BASE}/settings/${sekcja}`, { waitUntil: 'networkidle' });
      await p.waitForTimeout(2200);
    });
  }
  // Wyszukiwarka ustawień — pole i podpowiedzi (SettingsSearch).
  await ekran(
    lang,
    '31-wyszukiwarka',
    async () => {
      await p.goto(`${BASE}/settings/profile`, { waitUntil: 'networkidle' });
      await p.waitForTimeout(2000);
    },
    async () => {
      const pole = p.locator('input[type="search"], input[placeholder]').first();
      await pole.click({ timeout: 8000 });
      await pole.fill('a');
      await p.waitForTimeout(1200);
    }
  );
}
sql(`UPDATE users SET language='en' WHERE email='${KONTO}'`);
fs.writeFileSync(`${OUT}/liczniki.json`, JSON.stringify(raport, null, 1));
console.log(
  JSON.stringify(
    raport.map((r) => ({
      e: r.ekran,
      l: r.lang,
      pl: r.polskichUi ?? r.blad,
      en: r.angielskichUi,
      klucze: r.surowychKluczyUi,
    })),
    null,
    0
  )
);
await b.close();
