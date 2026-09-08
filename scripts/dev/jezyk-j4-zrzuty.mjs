/**
 * DOWÓD JĘZYKOWY MODUŁU NARZĘDZIA (paczka J4, DEC-453).
 *
 * Robi zrzuty ekranów modułu w wybranym języku konta i liczy obce słowa
 * WYŁĄCZNIE w chrome interfejsu (przyciski, zakładki, nagłówki kolumn,
 * etykiety, pozycje menu) — nie w komórkach z DANYMI. Nazwy sesji narzędzi
 * i tytuły wpisów w bazie DBR77 bywają po polsku z natury i nie są defektem
 * tłumaczenia; liczenie ich zawyżałoby wynik w obie strony.
 *
 * Słownik „polskiego” jest TEN SAM, na którym stoi
 * `scripts/i18n/pomiar-jezyka.mjs` (pomiar-jezyka.wyjatki.json), żeby dowód
 * i przyrząd pomiarowy nie rozjechały się definicją.
 *
 * Pułapki przyrządu przejęte z J10 (zmierzone, nie teoretyczne):
 *  - ŚWIEŻA sesja przeglądarki na każdy język (najpierw `users.language`
 *    w bazie, potem logowanie) — inaczej profil nadpisuje `i18nextLng`;
 *  - KOTWICA JĘZYKOWA (nazwa zakładki Menu 1) — zrzut po „networkidle + 2 s”
 *    łapie stan przejściowy sprzed dociągnięcia plików tłumaczeń;
 *  - do trzech podejść z POWTÓRZENIEM CAŁEJ AKCJI — sam reload zamknąłby
 *    otwarty kebab/picker i zrzut pokazywałby inny ekran, niż mówi nazwa.
 *
 * Użycie: node scripts/dev/jezyk-j4-zrzuty.mjs <katalog-wyjściowy> <pl,en>
 */
import { chromium } from 'playwright';
import { execSync } from 'node:child_process';
import fs from 'node:fs';

const BASE = process.env.J4_BASE || 'http://127.0.0.1:3220';
const DB = process.env.J4_DB || 'consultify_kopia_d21';
const KONTO = process.env.J4_EMAIL || 'audyt-j4@dbr77.local';
const HASLO = process.env.J4_PASS || 'AudytDBR77!2026';
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
  /^(status|data|ok|pdf|ppt|pptx|ai|qa|kpi|raid|roi|crm|id|url|api|consultify|dbr77|teresa|swot|studio|canvas|model|insight|insights|sonar|a3|smed|sop|dms|rpa|okr|bcg|v\d+|beta)$/i;

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
  await p.locator('input[type="password"]').first().fill(HASLO);
  await p.locator('input[type="password"]').first().press('Enter');
  await p.waitForURL((u) => !String(u).includes('/login'), { timeout: 40000 });
  await p.waitForTimeout(1500);
  await p.evaluate(() => {
    const K = 'consultify-storage';
    const r = localStorage.getItem(K);
    const o = r ? JSON.parse(r) : { state: {}, version: 0 };
    o.state = { ...(o.state || {}), theme: 'light' };
    localStorage.setItem(K, JSON.stringify(o));
  });
  await p.evaluate((l) => localStorage.setItem('i18nextLng', l), lang);
  await p.goto(`${BASE}/discovery-tools`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(3000);
  await zamknijOnboarding();
}

/**
 * Modal powitalny („Meet Teresa”) zasłaniał CAŁY produkt na pierwszym
 * przebiegu zrzutów 09.09 — dokładnie klasa „przyrząd pokazuje nie produkt”.
 * Zamykamy go raz na sesję i dodatkowo przed każdym zrzutem (wraca po
 * przeładowaniu, dopóki backend nie zapisze pominięcia).
 */
async function zamknijOnboarding() {
  for (const wzorzec of [/^(Skip for now|Pomiń na razie|Pomiń)$/i, /^(Close|Zamknij)$/i]) {
    const przycisk = p.locator('button').filter({ hasText: wzorzec }).first();
    if (await przycisk.count().catch(() => 0)) {
      await przycisk.click({ timeout: 4000 }).catch(() => {});
      await p.waitForTimeout(800);
    }
  }
  await p.keyboard.press('Escape').catch(() => {});
  await p.waitForTimeout(400);
}

async function napisyUi() {
  return p.evaluate(() => {
    const sel =
      'button, [role=tab], [role=menuitem], [role=option], th, label, h1, h2, h3, nav a, [aria-label], [placeholder]';
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
    // Okruszki (breadcrumbs) i nagłówek modułu — tam siedział literał
    // „Narzędzia” w AppRoutes.tsx, a żaden z selektorów wyżej go nie łapie.
    for (const el of Array.from(document.querySelectorAll('nav[aria-label], ol li, .breadcrumb, .breadcrumbs'))) {
      const t = String(el.textContent || '').trim();
      if (t && t.length < 80) out.add(t);
    }
    // KOLUMNA KATEGORII to ENUM renderowany przez UI (CATEGORY_META), nie
    // dane z bazy — a leży w `td`, które reguła „bez komórek z danymi”
    // pomija. Pierwszy przebieg 09.09 pokazał przez to „2 polskie napisy”
    // na ekranie, gdzie w kolumnie stało 12× „Strategiczne”. Zbieramy więc
    // komórki DOKŁADNIE tej jednej kolumny, po nazwie jej nagłówka.
    for (const tabela of Array.from(document.querySelectorAll('table'))) {
      const naglowki = Array.from(tabela.querySelectorAll('thead th'));
      const idx = naglowki.findIndex((th) =>
        /^(category|kategoria)$/i.test(String(th.textContent || '').trim())
      );
      if (idx < 0) continue;
      for (const wiersz of Array.from(tabela.querySelectorAll('tbody tr'))) {
        const komorka = wiersz.children[idx];
        const t = String(komorka?.textContent || '').trim();
        if (t && t.length < 60) out.add(t);
      }
    }
    return Array.from(out);
  });
}

const KOTWICA = { en: 'Library', pl: 'Biblioteka' };
async function jezykZgodny(lang) {
  const oczekiwany = KOTWICA[lang];
  for (let proba = 0; proba < 10; proba += 1) {
    const tekst = await p.evaluate(() => document.body.innerText);
    if (tekst.includes(oczekiwany)) return true;
    await p.waitForTimeout(1000);
  }
  return false;
}

const raport = [];
async function ekran(lang, nazwa, akcja, interakcja, bezKotwicy = false) {
  try {
    let zgodny = false;
    for (let podejscie = 0; podejscie < 3 && !zgodny; podejscie += 1) {
      await p.evaluate((l) => localStorage.setItem('i18nextLng', l), lang);
      await akcja();
      await p.waitForTimeout(1500);
      await zamknijOnboarding();
      zgodny = bezKotwicy ? true : await jezykZgodny(lang);
      if (!zgodny) {
        await p.evaluate((l) => localStorage.setItem('i18nextLng', l), lang);
        await p.goto(`${BASE}/discovery-tools`, { waitUntil: 'networkidle' });
        await p.waitForTimeout(2500);
      }
    }
    if (!zgodny) throw new Error(`interfejs nie przeszedł na ${lang} — zrzut byłby fałszywy`);
    if (interakcja) {
      await interakcja();
      await p.waitForTimeout(1500);
    }
    await p.waitForTimeout(1500);
    await p.screenshot({ path: `${OUT}/${nazwa}-${lang}.png`, fullPage: false });
    const napisy = (await napisyUi()).filter((t) => t && !NEUTRALNE.test(t));
    const pl = napisy.filter((t) => wykryjPolski(t));
    const en = napisy.filter((t) => wykryjAngielski(t));
    raport.push({
      lang,
      ekran: nazwa,
      napisowUi: napisy.length,
      polskichUi: pl.length,
      polskie: pl.slice(0, 40),
      angielskichUi: en.length,
      angielskie: en.slice(0, 40),
    });
  } catch (e) {
    raport.push({ lang, ekran: nazwa, blad: String(e.message).slice(0, 160) });
  }
}

const ZAKLADKI = [
  ['01-biblioteka', ''],
  ['02-sesje', '?tab=sessions'],
  ['03-insighty', '?tab=outputs'],
  ['04-raporty', '?tab=reports'],
  ['05-inicjatywy', '?tab=initiatives'],
];

for (const lang of LANGS) {
  await nowaSesja(lang);

  for (const [nazwa, q] of ZAKLADKI) {
    await ekran(lang, nazwa, async () => {
      await p.goto(`${BASE}/discovery-tools${q}`, { waitUntil: 'networkidle' });
      await p.waitForTimeout(2500);
    });
  }

  // Okruszki podkategorii — literały „Analiza strategiczna”/„Operacyjne”/
  // „Cyfrowe”/„Automatyzacja procesów” z AppRoutes.tsx.
  for (const [nazwa, sciezka] of [
    ['06-okruszki-strategiczne', '/discovery-tools/strategic'],
    ['07-okruszki-operacyjne', '/discovery-tools/operational'],
    ['08-okruszki-cyfrowe', '/discovery-tools/digital'],
    ['09-okruszki-automatyzacja', '/discovery-tools/process-automation'],
  ]) {
    await ekran(lang, nazwa, async () => {
      await p.goto(`${BASE}${sciezka}`, { waitUntil: 'networkidle' });
      await p.waitForTimeout(2500);
    });
  }

  // Picker „Add tool” — tam żyją nazwy KATEGORII (CATEGORY_META).
  await ekran(
    lang,
    '10-picker-kategorie',
    async () => {
      await p.keyboard.press('Escape');
      await p.goto(`${BASE}/discovery-tools`, { waitUntil: 'networkidle' });
      await p.waitForTimeout(2500);
    },
    async () => {
      await p
        .locator('button')
        .filter({ hasText: /^(Add tool|Dodaj narzędzie)/ })
        .first()
        .click({ timeout: 10000 });
    }
  );

  // Kebab wiersza w Bibliotece.
  await ekran(
    lang,
    '11-kebab-wiersza',
    async () => {
      await p.keyboard.press('Escape');
      await p.goto(`${BASE}/discovery-tools`, { waitUntil: 'networkidle' });
      await p.waitForTimeout(2500);
    },
    async () => {
      await p.locator('table tbody tr').first().locator('button').last().click({ timeout: 10000 });
    }
  );

  // Podgląd wiersza (preview).
  await ekran(lang, '12-podglad-wiersza', async () => {
    await p.keyboard.press('Escape');
    await p.goto(`${BASE}/discovery-tools`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(2500);
    await p.locator('table tbody tr').first().click({ timeout: 10000 });
    await p.waitForTimeout(2500);
  });

  // Pstryczek kolumn.
  await ekran(
    lang,
    '13-pstryczek-kolumn',
    async () => {
      await p.keyboard.press('Escape');
      await p.goto(`${BASE}/discovery-tools`, { waitUntil: 'networkidle' });
      await p.waitForTimeout(2500);
    },
    async () => {
      await p.locator('table thead button').last().click({ timeout: 10000 });
    }
  );

  // Megatrendy — ekran z największą liczbą hardcode’u angielskiego (boli PL).
  await ekran(
    lang,
    '14-megatrendy',
    async () => {
      await p.keyboard.press('Escape');
      await p.goto(`${BASE}/discovery-tools/strategic/megatrends`, { waitUntil: 'networkidle' });
      await p.waitForTimeout(3500);
    },
    null,
    true
  );

  // Studio (kreator diagramu) — „Describe your diagram” itd.
  await ekran(
    lang,
    '15-studio',
    async () => {
      await p.goto(`${BASE}/studio`, { waitUntil: 'networkidle' });
      await p.waitForTimeout(3500);
    },
    null,
    true
  );
}

sql(`UPDATE users SET language='en' WHERE email='${KONTO}'`);
fs.writeFileSync(`${OUT}/liczniki.json`, JSON.stringify(raport, null, 1));
console.log(
  JSON.stringify(
    raport.map((r) => ({ e: r.ekran, l: r.lang, pl: r.polskichUi ?? r.blad, en: r.angielskichUi })),
    null,
    0
  )
);
await b.close();
