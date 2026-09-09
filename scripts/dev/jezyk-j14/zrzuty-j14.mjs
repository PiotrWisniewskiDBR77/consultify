/**
 * DOWÓD JĘZYKOWY PANELU ADMINISTRATORA (paczka J14, DEC-453).
 *
 * Robi zrzuty ekranów panelu w wybranym języku KONTA i liczy obce słowa
 * WYŁĄCZNIE w chrome interfejsu (menu, przyciski, zakładki, nagłówki kolumn,
 * etykiety, `aria-label`, `placeholder`) — nie w komórkach z DANYMI. Nazwy
 * organizacji, e-maile i identyfikatory z bazy DBR77 nie są defektem
 * tłumaczenia; liczenie ich zawyżałoby wynik w obie strony.
 *
 * Detektor „polskiego"/„angielskiego" to TEN SAM moduł, na którym stoi
 * `scripts/i18n/pomiar-jezyka.mjs`, żeby dowód i przyrząd pomiarowy nie
 * rozjechały się definicją.
 *
 * Użycie: node scripts/dev/jezyk-j14/zrzuty-j14.mjs <katalog-wyjściowy> <pl,en>
 */
import { chromium } from 'playwright';
import { execSync } from 'node:child_process';
import fs from 'node:fs';

import { wykryjPolski, wykryjAngielski } from '../../i18n/pomiar-jezyka.mjs';

const BASE = process.env.J14_BASE || 'http://127.0.0.1:3222';
const DB = process.env.J14_DB || 'consultify_kopia_d23';
const KONTO = process.env.J14_EMAIL || 'audyt-j14@dbr77.local';
const HASLO = process.env.J14_PASS || 'AudytDBR77!2026';
const OUT = process.argv[2];
const LANGS = (process.argv[3] || 'en').split(',');
fs.mkdirSync(OUT, { recursive: true });

const sql = (q) =>
  execSync(`docker exec consultify-pg18 psql -U postgres -d ${DB} -Atc "${q.replace(/"/g, '\\"')}"`, {
    encoding: 'utf8',
  }).trim();

/** Skróty i nazwy własne, które są tym samym słowem w obu językach. */
const NEUTRALNE =
  /^(status|data|ok|ai|api|sso|scim|dlp|soc2|mfa|kpi|id|url|json|csv|pdf|sla|slo|rbac|iam|crm|roi|consultify|dbr77|teresa|admin|e-?mail|beta|v\d+|[0-9\s./:,%-]+)$/i;

const b = await chromium.launch();
let c;
let p;

/**
 * ŚWIEŻA sesja przeglądarki na każdy język — nie samo przestawienie
 * `i18nextLng`. Powód (lekcja z J10): aplikacja po zalogowaniu nadpisuje
 * język wartością z profilu, więc zrzuty „EN" wychodziły po polsku, a „PL"
 * po angielsku. Kolejność jest istotna: najpierw `users.language` w bazie,
 * dopiero potem logowanie.
 */
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
  // ONBOARDING PIERWSZEGO URUCHOMIENIA zasłania panel modalem „Meet Teresa"
  // (widziane na pierwszym przebiegu 09.09 — licznik liczyłby modal, nie
  // produkt). Gasimy go tak, jak gasi go aplikacja: kluczem
  // `consultify_onboarding_done:{userId}` z useFirstRunOnboarding.ts,
  // a nie klikaniem „Skip for now" — klikanie zależałoby od języka przycisku.
  await p.evaluate((uid) => {
    localStorage.setItem(`consultify_onboarding_done:${uid}`, 'true');
    localStorage.setItem('consultify_onboarding_cta_dismissed:' + uid, 'true');
  }, 'audyt-j14');
  await p.evaluate((l) => localStorage.setItem('i18nextLng', l), lang);
  await p.goto(`${BASE}/admin/team/members`, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(2500);
  // Gdyby modal mimo to stał (server-side flag), zamykamy go po roli, nie po napisie.
  const modal = p.locator('[role="dialog"]');
  if (await modal.count()) {
    const skip = modal.locator('button').last();
    if (await skip.count()) await skip.click().catch(() => {});
    await p.waitForTimeout(1200);
  }
}

async function napisyUi() {
  return p.evaluate(() => {
    const sel =
      'button, [role=tab], [role=menuitem], [role=option], th, label, h1, h2, h3, nav a, option, [aria-label], [placeholder]';
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
 * Kotwicą jest pierwsza domena Menu 1 panelu, widoczna na KAŻDYM z 62 ekranów.
 */
const KOTWICA = { en: 'team & access', pl: 'zespół i dostęp' };
async function jezykZgodny(lang) {
  for (let proba = 0; proba < 12; proba += 1) {
    // BEZ WIELKOSCI LITER. `innerText` zwraca tekst PO transformacji CSS,
    // a naglowek grupy Menu 1 ma `text-transform: uppercase`. Porownanie
    // wrazliwe na wielkosc przepuscilo tylko 2 z 14 ekranow i zameldowalo
    // „interfejs nie przeszedl na en" dla dzialajacego produktu (09.09).
    const tekst = (await p.evaluate(() => document.body.innerText).catch(() => '')).toLowerCase();
    if (tekst.includes(KOTWICA[lang])) return true;
    await p.waitForTimeout(600);
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
      zgodny = await jezykZgodny(lang);
      if (!zgodny) {
        await p.evaluate((l) => localStorage.setItem('i18nextLng', l), lang);
        await p.goto(`${BASE}/admin/team/members`, { waitUntil: 'domcontentloaded' });
        await p.waitForTimeout(2000);
      }
    }
    if (!zgodny) throw new Error(`interfejs nie przeszedł na ${lang} — zrzut byłby fałszywy`);
    if (interakcja) {
      await interakcja();
      await p.waitForTimeout(1500);
    }
    await p.waitForTimeout(900);
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
    console.log(`  ${nazwa}-${lang}: napisow=${napisy.length} pl=${pl.length} en=${en.length}`);
  } catch (e) {
    raport.push({ lang, ekran: nazwa, blad: String(e.message).slice(0, 160) });
    console.log(`  ${nazwa}-${lang}: BLAD ${String(e.message).slice(0, 90)}`);
  }
}

const EKRANY = [
  ['01-zespol-uzytkownicy', '/admin/team/members'],
  ['02-zespol-role', '/admin/team/roles-permissions'],
  ['03-rozliczenia-przeglad', '/admin/billing/overview'],
  ['04-rozliczenia-platnosci', '/admin/billing/payment-methods'],
  ['05-rozliczenia-faktury', '/admin/billing/invoices'],
  ['06-rozliczenia-budzety', '/admin/billing/budgets-alerts'],
  ['07-ai-polityka', '/admin/ai/policy-autonomy'],
  ['08-ai-audyt', '/admin/ai/ai-audit'],
  ['09-bezpieczenstwo-api', '/admin/security/api-access'],
  ['10-bezpieczenstwo-polityka', '/admin/security/security-policy'],
  ['11-audyt-zdarzenia', '/admin/audit/events'],
  ['12-dowodzenie-koszt', '/admin/command/cost-capacity'],
  ['13-stan-uslug', '/admin/health/service-status'],
];

for (const lang of LANGS) {
  console.log(`\n== ${lang.toUpperCase()} ==`);
  await nowaSesja(lang);
  for (const [nazwa, url] of EKRANY) {
    await ekran(lang, nazwa, async () => {
      await p.goto(`${BASE}${url}`, { waitUntil: 'domcontentloaded' });
      await p.waitForTimeout(1400);
    });
  }
  // Modal tworzenia klucza API — najgęstszy formularz panelu.
  await ekran(
    lang,
    '14-modal-nowy-klucz',
    async () => {
      await p.goto(`${BASE}/admin/security/api-access`, { waitUntil: 'domcontentloaded' });
      await p.waitForTimeout(1600);
    },
    async () => {
      const btn = p.locator('button', { hasText: /Create API Key|Utwórz klucz API/i }).first();
      if (await btn.count()) await btn.click();
      await p.waitForTimeout(1200);
    }
  );
}

fs.writeFileSync(`${OUT}/liczniki.json`, JSON.stringify(raport, null, 2));
await b.close();
console.log(`\nRAPORT: ${OUT}/liczniki.json`);
