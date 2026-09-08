/**
 * DOWÓD JĘZYKOWY MODUŁU PARTNERZY / PARTNER PORTAL (paczka J16, DEC-453).
 *
 * Wzór: `scripts/dev/jezyk-j10-zrzuty.mjs`. Robi zrzuty ekranów modułu 16
 * w wybranym języku konta i liczy obce słowa WYŁĄCZNIE w chrome interfejsu
 * (przyciski, zakładki, nagłówki kolumn, etykiety, pozycje menu) — nie
 * w komórkach z DANYMI (nazwy partnerów, organizacji, kwoty).
 *
 * Słownik „polskiego"/„angielskiego" jest TEN SAM, na którym stoi
 * `scripts/i18n/pomiar-jezyka.mjs`, żeby dowód i przyrząd pomiarowy nie
 * rozjechały się definicją.
 *
 * Moduł ma DWIE role i DWA różne ekrany startowe — obie trzeba zmierzyć:
 *   rola `owner`   — OWNER/ADMIN organizacji BEZ wiersza `partner_users`:
 *                    widzi wyłącznie ekran „connect" (PartnerOrientationPanel),
 *                    reszta zakładek jest przekierowana na `partner-home`.
 *   rola `partner` — użytkownik z ACTIVE `partner_users`: pełny portal.
 *
 * Użycie: node scripts/dev/jezyk-j16-zrzuty.mjs <katalog-wyjściowy> <pl,en>
 */
import { chromium } from 'playwright';
import { execSync } from 'node:child_process';
import fs from 'node:fs';

import { wykryjPolski, wykryjAngielski } from '../i18n/pomiar-jezyka.mjs';

const BASE = process.env.J16_BASE || 'http://127.0.0.1:3223';
const DB = process.env.J16_DB || 'consultify_kopia_d24';
const KONTO = 'audyt-j16@dbr77.local';
const HASLO = 'AudytDBR77!2026';
const OUT = process.argv[2];
const LANGS = (process.argv[3] || 'en').split(',');
fs.mkdirSync(OUT, { recursive: true });

const sql = (q) =>
  execSync(`docker exec consultify-pg18 psql -U postgres -d ${DB} -Atc "${q.replace(/"/g, '\\"')}"`, {
    encoding: 'utf8',
  }).trim();

/** Nazwy własne i skróty, które są tym samym słowem w obu językach. */
const NEUTRALNE =
  /^(status|data|ok|pdf|ai|qa|kpi|roi|crm|id|url|api|consultify|dbr77|teresa|partner|partnerzy|nda|vat|eur|pln|beta|v\d+|\d+%?)$/i;

/**
 * Minimalna fikstura partnera w KOPII bazy (nigdy na demo/stagingu).
 *
 * `getActivePartnerOrgIdForTenantUser(organizationId, userId)` (D8,
 * `server/src/services/partnerOrgResolution.ts:107`) łączy `partner_users`
 * z `partner_organizations.owner_organization_id` — sam wiersz `partner_users`
 * NIE wystarczy, a żadna z 24 organizacji partnerskich w kopii stagingu nie ma
 * ustawionego `owner_organization_id` POZA jedną: `702709e7-…` („DBR77")
 * jest już przypięta do tenanta konta audytowego (zmierzone 09.09, kolumna ma
 * UNIQUE — druga organizacja na tym tenancie jest niemożliwa). Fikstura
 * dokłada więc WYŁĄCZNIE brakujący wiersz `partner_users` i kasuje go po
 * przebiegu — zero nowych organizacji w bazie.
 */
const ORG_TENANT = 'a3e05d4a-5397-419d-b486-8e44366c0063';
function wlaczPartnera() {
  const org = sql(
    `SELECT id FROM partner_organizations WHERE owner_organization_id='${ORG_TENANT}' AND LOWER(COALESCE(status,'active'))='active' LIMIT 1`
  );
  if (!org) throw new Error(`brak aktywnej partner_organizations dla tenanta ${ORG_TENANT}`);
  sql(
    `INSERT INTO partner_users (id,user_id,partner_org_id,status,role) VALUES ('pu-audyt-j16','audyt-j16','${org}','active','owner') ON CONFLICT (id) DO UPDATE SET partner_org_id='${org}', status='active'`
  );
  return org;
}
function wylaczPartnera() {
  sql(`DELETE FROM partner_users WHERE id='pu-audyt-j16'`);
}

const b = await chromium.launch();
let c;
let p;

/** ŚWIEŻA sesja przeglądarki na każdy język — powód opisany w J10:
 *  aplikacja nadpisuje `i18nextLng` językiem z profilu po zalogowaniu,
 *  więc `users.language` MUSI być ustawiony PRZED logowaniem. */
async function nowaSesja(lang) {
  sql(`UPDATE users SET language='${lang}' WHERE email='${KONTO}'`);
  // Modal pierwszego uruchomienia („Meet Teresa") zasłaniał KAŻDY zrzut
  // pierwszego przebiegu — liczniki wychodziły identyczne (pl 1 / en 6) na
  // wszystkich 23 ekranach, bo mierzony był przyrząd, nie produkt. Gasimy go
  // po stronie SERWERA (`user_preferences`), bo świeży kontekst przeglądarki
  // nie ma jeszcze klucza `consultify_onboarding_done:{userId}`.
  sql(
    `INSERT INTO user_preferences (user_id,key,value) VALUES ('audyt-j16','onboarding_completed','true') ON CONFLICT (user_id,key) DO UPDATE SET value='true'`
  );
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
}

/** Napisy chrome interfejsu — bez komórek z DANYMI (`td` poza nagłówkiem). */
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
 * Kotwicą jest stopka bocznego menu partnera (`partner.sidebar.backToApp`) —
 * jedyny napis obecny na KAŻDYM ekranie modułu w OBU rolach, także na ekranie
 * „connect". Pierwsza wersja kotwiczyła o nazwy grup menu i przebieg PL padł
 * na 13 z 20 ekranów komunikatem „interfejs nie przeszedł na pl": grupy są
 * w pliku PL zapisane WERSALIKAMI („POLECENIA"), a wzorzec był wrażliwy na
 * wielkość liter. Był to defekt PRZYRZĄDU, nie produktu — stąd `i` i napis,
 * którego pisownia nie zależy od sekcji.
 */
const KOTWICE = { en: /Back to app/i, pl: /Powrót do aplikacji/i };
async function jezykZgodny(rola, lang) {
  const wzor = KOTWICE[lang];
  for (let proba = 0; proba < 10; proba += 1) {
    const tekst = await p.evaluate(() => document.body.innerText);
    if (wzor.test(tekst)) return true;
    await p.waitForTimeout(1000);
  }
  return false;
}

const raport = [];
/**
 * `bezKotwicy` — ekrany POZA powłoką partnera (`/become-partner`, `/trial`,
 * `/subscriber/dashboard`, cennik) nie mają stopki „Back to app", więc kotwica
 * per-ekran jest tam niemożliwa. Język jest za to udowodniony NA POZIOMIE
 * SESJI: kontekst przeglądarki powstaje po ustawieniu `users.language`, a
 * wcześniejsze ekrany tej samej sesji przeszły kotwicę. Dodatkowo część z tych
 * ekranów (`TrialEntryView`, `SubscriberDashboardPage`) NIE MA ani jednego
 * `useTranslation` — przed naprawą stoi po polsku niezależnie od języka konta,
 * więc żadna kotwica językowa nie mogłaby tam przejść z definicji.
 */
async function ekran(rola, lang, nazwa, akcja, interakcja, bezKotwicy = false) {
  try {
    let zgodny = false;
    for (let podejscie = 0; podejscie < 3 && !zgodny; podejscie += 1) {
      await p.evaluate((l) => localStorage.setItem('i18nextLng', l), lang);
      await akcja();
      await p.waitForTimeout(1500);
      zgodny = bezKotwicy || (await jezykZgodny(rola, lang));
      if (!zgodny) {
        await p.evaluate((l) => localStorage.setItem('i18nextLng', l), lang);
        await p.goto(`${BASE}/partner`, { waitUntil: 'networkidle' });
        await p.waitForTimeout(2500);
      }
    }
    if (!zgodny) throw new Error(`interfejs nie przeszedł na ${lang} — zrzut byłby fałszywy`);
    // BEZPIECZNIK PRZYRZĄDU: żaden zrzut nie może pokazywać modala pierwszego
    // uruchomienia zamiast ekranu modułu (zdarzyło się w przebiegu 1/1).
    const modal = await p.evaluate(() => document.body.innerText.includes('Meet Teresa') || document.body.innerText.includes('WELCOME TO CONSULTIFY'));
    if (modal) throw new Error('modal pierwszego uruchomienia zasłania ekran — zrzut pokazywałby przyrząd, nie produkt');
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
      rola,
      lang,
      ekran: nazwa,
      napisowUi: napisy.length,
      polskichUi: pl.length,
      polskie: pl.slice(0, 40),
      angielskichUi: en.length,
      angielskie: en.slice(0, 40),
    });
  } catch (e) {
    raport.push({ rola, lang, ekran: nazwa, blad: String(e.message).slice(0, 160) });
  }
}

const ZAKLADKI_PARTNERA = [
  ['11-home', 'partner-home'],
  ['12-pulpit', 'dashboard'],
  ['13-metryki', 'metrics'],
  ['14-linki-kody', 'referral-tools'],
  ['15-analityka-klikniec', 'referral-analytics'],
  ['16-poleceni-klienci', 'referred-organizations'],
  ['17-zarobki', 'earnings'],
  ['18-zestawienia', 'statements'],
  ['19-wyplaty', 'payouts'],
  ['20-ustawienia-wyplat', 'payout-settings'],
  ['21-dostep-klienta', 'client-access'],
  ['22-organizacje', 'organizations'],
  ['23-projekty', 'projects'],
  ['24-uzytkownicy', 'users'],
  ['25-sciezka-nauki', 'learning-path'],
  ['26-egzaminy', 'exams'],
  ['27-certyfikaty', 'certificates'],
  ['28-dokumentacja', 'documentation'],
  ['29-materialy-marketingowe', 'marketing'],
  ['30-dane-firmy', 'company-info'],
];

for (const lang of LANGS) {
  // ---- ROLA 1: OWNER organizacji BEZ partnera → ekran „connect" ----
  wylaczPartnera();
  await nowaSesja(lang);
  await ekran('owner', lang, '01-connect-owner-bez-partnera', async () => {
    await p.goto(`${BASE}/partner`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(3000);
  });
  // zakładka wymuszona w URL — sprawdzamy, że nadal ląduje na connect
  await ekran('owner', lang, '02-connect-przekierowanie-z-zakladki', async () => {
    await p.goto(`${BASE}/partner?tab=earnings`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(3000);
  });
  await ekran('owner', lang, '03-connect-trasa-legacy', async () => {
    await p.goto(`${BASE}/partner/dashboard`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(3000);
  });

  // ---- Ekrany POZA powłoką partnera (publiczne + subskrybent) ----
  // Tu żyje większość K4pl/K4en modułu: `TrialEntryView` (13 polskich napisów
  // na sztywno) i `SubscriberDashboardPage` (angielskie na sztywno) nie mają
  // ani jednego `useTranslation`.
  for (const [nazwa, sciezka] of [
    ['04-zostan-partnerem', '/become-partner'],
    ['05-zgloszenie-partnera', '/become-partner/apply'],
    ['06-cennik-partnera', '/partner/pricing'],
    ['07-aktywacja-trial', '/trial'],
    ['08-pulpit-subskrybenta', '/subscriber/dashboard'],
  ]) {
    await ekran(
      'owner',
      lang,
      nazwa,
      async () => {
        await p.goto(`${BASE}${sciezka}`, { waitUntil: 'networkidle' });
        await p.waitForTimeout(3000);
      },
      undefined,
      true
    );
  }

  // ---- ROLA 2: partner z ACTIVE partner_users → pełny portal ----
  wlaczPartnera();
  await nowaSesja(lang);
  for (const [nazwa, tab] of ZAKLADKI_PARTNERA) {
    await ekran('partner', lang, nazwa, async () => {
      await p.goto(`${BASE}/partner?tab=${tab}`, { waitUntil: 'networkidle' });
      await p.waitForTimeout(2500);
    });
  }
  wylaczPartnera();
}

sql(`UPDATE users SET language='en' WHERE email='${KONTO}'`);
await b.close();
fs.writeFileSync(`${OUT}/liczniki.json`, JSON.stringify(raport, null, 1));
console.log(
  JSON.stringify(
    raport.map((r) => ({ r: r.rola, e: r.ekran, l: r.lang, pl: r.polskichUi ?? r.blad, en: r.angielskichUi })),
    null,
    0
  )
);
