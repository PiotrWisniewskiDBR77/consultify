/**
 * DOWÓD JĘZYKOWY MODUŁU MATERIAŁY (paczka J10, DEC-453).
 *
 * Robi zrzuty ekranów modułu w wybranym języku konta i liczy obce słowa
 * WYŁĄCZNIE w chrome interfejsu (przyciski, zakładki, nagłówki kolumn,
 * etykiety, pozycje menu) — nie w komórkach z DANYMI. Tytuły prezentacji
 * i nazwiska w bazie DBR77 są po polsku z natury i nie są defektem
 * tłumaczenia; liczenie ich zawyżałoby wynik w obie strony.
 *
 * Słownik „polskiego” jest TEN SAM, na którym stoi
 * `scripts/i18n/pomiar-jezyka.mjs` (pomiar-jezyka.wyjatki.json), żeby dowód
 * i przyrząd pomiarowy nie rozjechały się definicją.
 *
 * Użycie: node scripts/dev/jezyk-j10-zrzuty.mjs <katalog-wyjściowy> <pl,en>
 */
import { chromium } from 'playwright';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.J10_BASE || 'http://127.0.0.1:3214';
const OUT = process.argv[2];
const LANGS = (process.argv[3] || 'en').split(',');
fs.mkdirSync(OUT, { recursive: true });
const sql = (q) =>
  execSync(
    `docker exec consultify-pg18 psql -U postgres -d consultify_kopia_final -Atc "${q.replace(/"/g, '\\"')}"`,
    { encoding: 'utf8' }
  ).trim();

import { wykryjPolski, wykryjAngielski } from '../i18n/pomiar-jezyka.mjs';

/** Nazwy wlasne i skroty, ktore sa tym samym slowem w obu jezykach. */
const NEUTRALNE = /^(status|data|ok|pdf|ppt|pptx|ai|qa|kpi|raid|roi|crm|id|url|api|consultify|dbr77|teresa|excel|word|powerpoint|legacy|sheet|beta|v\d+)$/i;

const b = await chromium.launch();
let c;
let p;

/**
 * ŚWIEŻA sesja przeglądarki na każdy język — nie samo przestawienie
 * `i18nextLng`. Powód (zmierzone 08.09, dwa przebiegi pod rząd): aplikacja
 * po zalogowaniu zapamiętuje język z profilu i przy kolejnych nawigacjach
 * nadpisuje nim wartość z localStorage; zrzuty „EN” wychodziły wtedy po
 * polsku, a „PL” po angielsku — czyli przyrząd kłamał w OBIE strony.
 * Kolejność jest tu istotna: najpierw `users.language` w bazie, dopiero
 * potem logowanie, żeby profil pobrany przy starcie sesji już był właściwy.
 */
async function nowaSesja(lang) {
  sql(`UPDATE users SET language='${lang}' WHERE email='audyt@dbr77.local'`);
  if (c) await c.close();
  c = await b.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
  p = await c.newPage();
  await p.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1500);
  await p.evaluate((l) => localStorage.setItem('i18nextLng', l), lang);
  await p.locator('input[type="email"]').first().fill('audyt@dbr77.local');
  await p.locator('input[type="password"]').first().fill('AudytDBR77!2026');
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
  await p.goto(`${BASE}/presentations`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(3000);
}

/**
 * Napisy chrome interfejsu — bez komorek z DANYMI (`td` poza naglowkiem).
 * Zwraca TABLICE napisow, zeby detektor jezyka ocenial kazdy z osobna
 * (tak samo jak `pomiar-jezyka.mjs` ocenia pojedyncza wartosc klucza).
 */
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
    return Array.from(out);
  });
}


/**
 * KOTWICA JĘZYKOWA — czeka, aż interfejs FAKTYCZNIE mówi w żądanym języku.
 *
 * Powód (zmierzone 08.09, trzy przebiegi): `i18nextLng` w localStorage i
 * `users.language` w bazie mogą być poprawne, a ekran i tak stoi w drugim
 * języku, bo pliki tłumaczeń dociągają się po `networkidle` i aplikacja
 * przełącza język dopiero po odpowiedzi z profilu. Zrzut robiony „po 2,5 s”
 * łapał wtedy stan przejściowy i dowód kłamał w OBIE strony (EN po polsku,
 * PL po angielsku). Kotwicą jest nazwa zakładki Menu 1 tego modułu — napis,
 * który na każdym z tych ekranów jest widoczny.
 */
const KOTWICA = { en: 'Template Library', pl: 'Biblioteka wzorców' };
async function jezykZgodny(lang) {
  const oczekiwany = KOTWICA[lang];
  const obcy = KOTWICA[lang === 'en' ? 'pl' : 'en'];
  for (let proba = 0; proba < 10; proba += 1) {
    const tekst = await p.evaluate(() => document.body.innerText);
    // Wystarczy OBECNOŚĆ kotwicy w żądanym języku. Warunku „i ani śladu
    // drugiego języka" świadomie NIE stawiamy na całym `body`: dane pokazowe
    // DBR77 (tytuły raportów, nazwy szablonów) bywają dwujęzyczne i wywalały
    // sprawne ekrany jako „nie przeszedł na en". Mieszankę i tak widać
    // w licznikach napisów UI niżej — one są miarą, kotwica tylko bramką.
    if (tekst.includes(oczekiwany)) return true;
    await p.waitForTimeout(1000);
  }
  return false;
}

const raport = [];
async function ekran(lang, nazwa, akcja, interakcja) {
  try {
    // Język USTAWIAMY PRZED KAŻDYM ekranem, nie raz na przebieg. Powód
    // (zmierzone 08.09): po zamknięciu modala „Nowy materiał” aplikacja
    // nadpisywała `i18nextLng` wartością z zapamiętanego profilu i trzy
    // ostatnie zrzuty przebiegu EN wychodziły po polsku — dowód pokazywałby
    // defekt, którego w produkcie nie ma (a przy odwrotnej kolejności ukryłby
    // defekt, który jest).
    // Do TRZECH podejść: gdy interfejs stoi jeszcze w poprzednim języku,
    // wymuszamy `i18nextLng`, przeładowujemy i POWTARZAMY całą akcję —
    // sam reload zamknąłby otwarty modal/kebab i zrzut pokazałby co innego.
    let zgodny = false;
    for (let podejscie = 0; podejscie < 3 && !zgodny; podejscie += 1) {
      await p.evaluate((l) => localStorage.setItem('i18nextLng', l), lang);
      await akcja();
      await p.waitForTimeout(1500);
      zgodny = await jezykZgodny(lang);
      if (!zgodny) {
        await p.evaluate((l) => localStorage.setItem('i18nextLng', l), lang);
        await p.goto(`${BASE}/presentations`, { waitUntil: 'networkidle' });
        await p.waitForTimeout(2500);
      }
    }
    if (!zgodny) throw new Error(`interfejs nie przeszedł na ${lang} — zrzut byłby fałszywy`);
    // Interakcja (kebab, pstryczek, modal) DOPIERO po potwierdzeniu języka:
    // otwarte menu zasłania kotwicę i sprawdzenie po nim dawałoby fałszywy
    // alarm „interfejs nie przeszedł”.
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
    raport.push({ lang, ekran: nazwa, blad: String(e.message).slice(0, 120) });
  }
}

const ZAKLADKI = [
  ['01-lista-wszystkie', 'all'],
  ['02-dokumenty', 'documents'],
  ['03-prezentacje', 'presentations'],
  ['04-skoroszyty', 'sheets'],
  ['05-wzorce', 'templates'],
];

for (const lang of LANGS) {
  await nowaSesja(lang);

  for (const [nazwa, tab] of ZAKLADKI) {
    await ekran(lang, nazwa, async () => {
      await p.goto(`${BASE}/presentations?tab=${tab}`, { waitUntil: 'networkidle' });
      await p.waitForTimeout(2500);
    });
  }
  await ekran(lang, '06-raporty', async () => {
    await p.goto(`${BASE}/reports`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(2500);
  });
  await ekran(lang, '07-podglad-wiersza', async () => {
    await p.goto(`${BASE}/presentations?tab=presentations`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(2500);
    await p.locator('table tbody tr').first().click({ timeout: 10000 });
    await p.waitForTimeout(2500);
  });
  await ekran(
    lang,
    '08-kebab',
    async () => {
      await p.keyboard.press('Escape');
      await p.goto(`${BASE}/presentations?tab=presentations`, { waitUntil: 'networkidle' });
      await p.waitForTimeout(2500);
    },
    async () => {
      await p.locator('table tbody tr').first().locator('button').last().click({ timeout: 10000 });
    }
  );
  await ekran(lang, '09-nowy-material', async () => {
    await p.keyboard.press('Escape');
    await p.goto(`${BASE}/presentations?tab=all`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(2500);
    await p
      .locator('button')
      .filter({ hasText: /^(New|Nowy|Nowa|Create|Utwórz)/ })
      .first()
      .click({ timeout: 10000 });
    await p.waitForTimeout(2500);
  });
  await ekran(lang, '10-filtry-menu3', async () => {
    await p.keyboard.press('Escape');
    await p.goto(`${BASE}/presentations?tab=presentations`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(2500);
    await p
      .locator('button')
      .filter({ hasText: /^(Status|Visibility|Widoczność)/ })
      .first()
      .click({ timeout: 10000 });
    await p.waitForTimeout(1500);
  });
  await ekran(lang, '11-wzorce-galeria', async () => {
    await p.keyboard.press('Escape');
    await p.goto(`${BASE}/presentations?tab=templates`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(3000);
  });
  await ekran(lang, '12-pstryczek-kolumn', async () => {
    await p.goto(`${BASE}/presentations?tab=presentations`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(2500);
    await p.locator('table thead button').last().click({ timeout: 10000 });
    await p.waitForTimeout(1500);
  });
}
sql(`UPDATE users SET language='pl' WHERE email='audyt@dbr77.local'`);
fs.writeFileSync(`${OUT}/liczniki.json`, JSON.stringify(raport, null, 1));
console.log(JSON.stringify(raport.map((r) => ({ e: r.ekran, l: r.lang, pl: r.polskichUi ?? r.blad, en: r.angielskichUi })), null, 0));
await b.close();
