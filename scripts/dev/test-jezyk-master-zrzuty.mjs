/**
 * TEST-JEZYK (paczka Fable, 09.09.2026) — CZĘŚĆ A, przebieg EN + PL na ŻYWYM
 * stagingu (`https://staging.consultify.ai`). Tylko nawigacja i odczyt; jedyny
 * zapis to zmiana języka WŁASNEGO konta testowego w Ustawieniach → Appearance
 * → Language (EN → PL na czas testu → z powrotem EN na koniec).
 *
 * Wzór: `scripts/dev/jezyk-j16-zrzuty.mjs` / `scripts/dev/jezyk-jdog-a-zrzuty.mjs`
 * (struktura sesji + liczenie obcych słów), ale BEZ dostępu do bazy (SQL) —
 * na żywym stagingu logowanie wyłącznie przez formularz, język wyłącznie przez
 * UI Ustawień, modal onboardingu zamykany klikiem, nie zapisem w bazie.
 *
 * Konto: pierwsze z ~/Developer/consultify-secrets/northwind-konta-STAGING.txt
 * (james.whitfield@northwind.example, OWNER). Hasło czytane w czasie
 * wykonania z tego pliku — NIGDY nie trafia do konsoli/logów/repo.
 *
 * Użycie: node scripts/dev/test-jezyk-master-zrzuty.mjs
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { wykryjPolski, wykryjAngielski } from '../i18n/pomiar-jezyka.mjs';
import { wykryjPolskiBezOgonkow } from '../i18n/polski-bez-ogonkow.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(ROOT, 'evidence/test-jezyk-dane-0909/jezyk');
fs.mkdirSync(OUT, { recursive: true });

const BASE = 'https://staging.consultify.ai';
const SECRETS_PATH = path.join(process.env.HOME, 'Developer/consultify-secrets/northwind-konta-STAGING.txt');
const SECRETS = fs.readFileSync(SECRETS_PATH, 'utf8');
const EMAIL = SECRETS.match(/james\.whitfield@northwind\.example/)[0];
const HASLO = SECRETS.match(/Wspólne hasło[^:]*:\s*(\S+)/)[1];
// Hasło NIE jest logowane. Nie dodawaj console.log(HASLO) ani podobnych.

/**
 * 16 modułów wg mapy `scripts/i18n/pomiar-jezyka-ekrany.mjs` (kolejność =
 * docs/FUNCTIONAL_DOCUMENTATION.md). `tabs`: nazwy widocznych zakładek Menu 2
 * (zmierzone żywą eksploracją 09.09 — evidence w /private/tmp tej sesji, nie
 * w repo). `subnav: true` = moduł ma boczną nawigację z grupami zamiast
 * poziomych zakładek (Admin/Settings) — próbkujemy reprezentatywne pozycje,
 * nie każdą (Admin ma ~30 podekranów, Settings ~25).
 */
const MODULES = [
  { id: '01-chat', nazwa: 'Chat', route: '/chat', tabs: [] },
  {
    id: '02-my-work',
    nazwa: 'My Work',
    route: '/my-work',
    tabs: ['Ideas', 'Notebook', 'Inbox', 'Calendar', 'Tasks', 'Decisions', 'Vaults'],
  },
  {
    id: '03-interview',
    nazwa: 'Interview',
    route: '/interview',
    tabs: ['Inbox', 'Sessions', 'Assigned', 'Templates', 'Insights', 'Initiatives'],
  },
  {
    id: '04-tools',
    nazwa: 'Tools',
    route: '/discovery-tools',
    tabs: ['Library', 'Sessions', 'Insights', 'Reports', 'Initiatives'],
  },
  {
    id: '05-assessment',
    nazwa: 'Assessment',
    route: '/assessment/overview',
    tabs: ['Library', 'Processes', 'Insights', 'Reports', 'Initiatives'],
  },
  {
    id: '06-initiatives',
    nazwa: 'Initiatives',
    route: '/initiatives',
    tabs: ['Plan', 'Load'],
  },
  {
    id: '07-execution',
    nazwa: 'Execution',
    route: '/execution',
    tabs: ['Dashboard', 'Deliveries', 'Work', 'Resources', 'Decisions & risks', 'Reports'],
  },
  {
    id: '08-results',
    nazwa: 'Results',
    route: '/results/kpi',
    tabs: ['OKR', 'ROI', 'Management reports'],
  },
  {
    id: '09-finance',
    nazwa: 'Finance',
    route: '/finance',
    tabs: ['Analysis', 'Models', 'Prediction', 'Enterprise valuation'],
    znalezisko: 'Brak pozycji "Finance" w Menu 1 (sidebar) — moduł osiągalny WYŁĄCZNIE przez bezpośredni URL /finance.',
  },
  {
    id: '10-materials',
    nazwa: 'Materials',
    route: '/presentations',
    tabs: ['Documents', 'Presentations', 'Sheets', 'Template Library'],
  },
  {
    id: '11-audits',
    nazwa: 'Audits',
    route: '/audit-programs',
    tabs: ['Library', 'Sessions', 'Conclusions', 'Reports', 'Initiatives'],
  },
  {
    id: '12-meeting',
    nazwa: 'Meeting',
    route: '/meetings',
    tabs: [],
    placeholder: true,
    znalezisko: 'Meeting = placeholder "planned for Wave 2" — moduł NIE jest zaimplementowany w MVP.',
  },
  {
    id: '13-organization',
    nazwa: 'Organization',
    route: '/organization/profile',
    tabs: ['Scale', 'Markets & systems'],
  },
  {
    id: '14-admin',
    nazwa: 'Admin Panel',
    route: '/admin',
    tabs: [],
    subnav: true,
    subnavClicks: ['Invitations', 'Roles & Permissions'],
  },
  {
    id: '15-settings',
    nazwa: 'Settings',
    route: '/settings/profile',
    tabs: [],
    subnav: true,
    subnavClicks: ['Security'],
  },
  {
    id: '16-partner',
    nazwa: 'Partner Portal',
    route: '/partner',
    tabs: [],
    znalezisko:
      'Konto OWNER bez partner_users: portal pokazuje wyłącznie ekran "connect" (nie klikamy — dołączenie do programu partnerskiego to zmiana stanu organizacji), pozycje Menu 2 są disabled.',
  },
];

const manifest = { start: new Date().toISOString(), en: [], pl: [] };
const konsolaSiec = [];

function slug(s) {
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const b = await chromium.launch();
let c;
let p;
let currentTag = 'init';

async function nowaSesja() {
  if (c) await c.close();
  c = await b.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
  p = await c.newPage();
  p.on('console', (m) => {
    if (m.type() === 'error') {
      konsolaSiec.push({ ekran: currentTag, typ: 'console.error', tekst: m.text().slice(0, 300) });
    }
  });
  p.on('pageerror', (e) => {
    konsolaSiec.push({ ekran: currentTag, typ: 'pageerror', tekst: String(e).slice(0, 300) });
  });
  p.on('response', (r) => {
    const status = r.status();
    if (status >= 400 && !r.url().includes('/api/auth/')) {
      konsolaSiec.push({
        ekran: currentTag,
        typ: `http-${status}`,
        url: r.url().replace(BASE, '').slice(0, 160),
      });
    }
  });
}

async function zaloguj() {
  await p.goto(`${BASE}/login`, { waitUntil: 'load', timeout: 60000 });
  await p.waitForTimeout(2500);
  await p.locator('input[type="email"]').first().fill(EMAIL);
  await p.locator('input[type="password"]').first().fill(HASLO);
  await p.locator('input[type="password"]').first().press('Enter');
  await p.waitForURL((u) => !String(u).includes('/login'), { timeout: 40000 });
  await p.waitForTimeout(2000);
  // wymuś jasny motyw
  await p.evaluate(() => {
    const K = 'consultify-storage';
    const r = localStorage.getItem(K);
    const o = r ? JSON.parse(r) : { state: {}, version: 0 };
    o.state = { ...(o.state || {}), theme: 'light' };
    localStorage.setItem(K, JSON.stringify(o));
  });
  await p.reload({ waitUntil: 'load', timeout: 60000 });
  await p.waitForTimeout(2000);
}

/** Zamyka modal powitalny/"Meet Teresa" jeśli obecny — WYŁĄCZNIE klikiem UI. */
async function zamknijModal() {
  const kandydaci = [
    p.getByRole('button', { name: /Skip for now|Pomiń na razie/i }),
    p.getByRole('button', { name: /^Skip$|^Pomiń$/i }),
    p.getByRole('button', { name: /Got it|Rozumiem/i }),
    p.getByRole('button', { name: /Maybe later|Może później/i }),
    p.getByRole('button', { name: /^Close$|^Zamknij$/i }),
    p.locator('[role="dialog"] button[aria-label="Close"]'),
    p.locator('[role="dialog"] button[aria-label="Zamknij"]'),
  ];
  for (const k of kandydaci) {
    try {
      if (await k.first().isVisible({ timeout: 800 })) {
        await k.first().click({ timeout: 2000 });
        await p.waitForTimeout(500);
        return true;
      }
    } catch {
      /* dalej */
    }
  }
  return false;
}

async function zrzut(lang, modId, screenId, extra = {}) {
  const dir = path.join(OUT, lang, modId);
  fs.mkdirSync(dir, { recursive: true });
  const base = `${screenId}`;
  await p.screenshot({ path: path.join(dir, `${base}.png`), fullPage: false });
  const innerText = await p.evaluate(() => document.body.innerText || '');
  fs.writeFileSync(path.join(dir, `${base}.txt`), innerText, 'utf8');
  const wpis = {
    lang,
    modul: modId,
    ekran: screenId,
    url: p.url(),
    plik: `${lang}/${modId}/${base}`,
    dlugoscTekstu: innerText.length,
    ...extra,
  };
  manifest[lang].push(wpis);
  console.log(`[${lang}] ${modId}/${base} -> ${p.url()}`);
  return innerText;
}

async function ekran(lang, modId, screenId, akcja, extra = {}) {
  currentTag = `${lang}/${modId}/${screenId}`;
  const bledyPrzed = konsolaSiec.length;
  try {
    await akcja();
    await p.waitForTimeout(1600);
    await zamknijModal();
    await p.waitForTimeout(300);
    await zrzut(lang, modId, screenId, { bledyLiczba: konsolaSiec.length - bledyPrzed, ...extra });
  } catch (e) {
    manifest[lang].push({
      lang,
      modul: modId,
      ekran: screenId,
      status: 'N/A',
      powod: String(e.message || e).slice(0, 300),
    });
    console.log(`[${lang}] ${modId}/${screenId} -> N/A: ${String(e.message || e).slice(0, 150)}`);
  }
}

/** Próba podglądu pierwszego wiersza tabeli (StandardPreview). Best-effort. */
async function probaPodgladu(lang, modId) {
  currentTag = `${lang}/${modId}/podglad`;
  try {
    const wiersz = p.locator('table tbody tr, [role="row"]:not([aria-rowindex="1"])').first();
    if (!(await wiersz.count())) throw new Error('brak wierszy tabeli');
    await wiersz.click({ timeout: 4000 });
    await p.waitForTimeout(1400);
    await zrzut(lang, modId, '90-podglad-rekordu');
  } catch (e) {
    manifest[lang].push({
      lang,
      modul: modId,
      ekran: '90-podglad-rekordu',
      status: 'N/A',
      powod: String(e.message || e).slice(0, 200),
    });
  } finally {
    await p.keyboard.press('Escape').catch(() => {});
    await p.waitForTimeout(300);
  }
}

/** Próba otwarcia formularza/modala tworzenia (New/Add/Create). Nie zapisuje. */
async function probaTworzenia(lang, modId) {
  currentTag = `${lang}/${modId}/tworzenie`;
  try {
    const przycisk = p
      .getByRole('button', { name: /^(New|Add|Create|Import)\b/i })
      .first();
    if (!(await przycisk.count())) throw new Error('brak przycisku New/Add/Create');
    await przycisk.click({ timeout: 4000 });
    await p.waitForTimeout(1400);
    await zrzut(lang, modId, '91-tworzenie');
  } catch (e) {
    manifest[lang].push({
      lang,
      modul: modId,
      ekran: '91-tworzenie',
      status: 'N/A',
      powod: String(e.message || e).slice(0, 200),
    });
  } finally {
    await p.keyboard.press('Escape').catch(() => {});
    await p.waitForTimeout(300);
  }
}

async function przebieg(lang) {
  for (const mod of MODULES) {
    await ekran(lang, mod.id, '01-menu1', async () => {
      await p.goto(`${BASE}${mod.route}`, { waitUntil: 'load', timeout: 40000 });
    });

    if (mod.placeholder) continue; // Meeting: nic więcej do zmierzenia

    for (const tab of mod.tabs) {
      await ekran(lang, mod.id, `02-tab-${slug(tab)}`, async () => {
        const t = p.getByRole('tab', { name: tab, exact: false }).first();
        if (await t.count()) {
          await t.click({ timeout: 4000 });
        } else {
          const btn = p.getByRole('button', { name: tab, exact: false }).first();
          await btn.click({ timeout: 4000 });
        }
      });
    }

    if (mod.subnav) {
      for (const item of mod.subnavClicks || []) {
        await ekran(lang, mod.id, `03-subnav-${slug(item)}`, async () => {
          const link = p.getByRole('button', { name: item, exact: false }).first();
          const link2 = p.getByText(item, { exact: true }).first();
          if (await link.count()) await link.click({ timeout: 4000 });
          else await link2.click({ timeout: 4000 });
        });
      }
    }

    if (!mod.subnav && mod.id !== '16-partner') {
      // wróć na ekran startowy modułu przed próbą podglądu/tworzenia
      await p.goto(`${BASE}${mod.route}`, { waitUntil: 'load', timeout: 40000 }).catch(() => {});
      await p.waitForTimeout(1200);
      await probaPodgladu(lang, mod.id);
      await probaTworzenia(lang, mod.id);
    }
  }
}

// ---------------------------------------------------------------------------
// PRZEBIEG 1: EN (domyślny język konta)
// ---------------------------------------------------------------------------
await nowaSesja();
await zaloguj();
await przebieg('en');

// ---------------------------------------------------------------------------
// PRZEŁĄCZENIE JĘZYKA: Ustawienia -> Appearance -> Language -> Polski (A7)
// ---------------------------------------------------------------------------
currentTag = 'przelaczenie-jezyka-pl';
let przelaczonoPl = false;
try {
  await p.goto(`${BASE}/settings/language`, { waitUntil: 'load', timeout: 40000 });
  await p.waitForTimeout(1500);
  const polski = p.getByRole('button', { name: /Polski|Polish/i }).first();
  await polski.click({ timeout: 5000 });
  await p.waitForTimeout(1500);
  przelaczonoPl = true;
} catch (e) {
  manifest.pl.push({ lang: 'pl', modul: 'przelaczenie', status: 'BLAD', powod: String(e.message || e).slice(0, 300) });
  console.log('BŁĄD przełączenia na PL:', String(e.message || e).slice(0, 200));
}
await p.reload({ waitUntil: 'load', timeout: 40000 }).catch(() => {});
await p.waitForTimeout(2000);
await zrzut('pl', '00-przelaczenie', '01-po-przelaczeniu-i-odswiezeniu');

// ---------------------------------------------------------------------------
// PRZEBIEG 2: PL
// ---------------------------------------------------------------------------
if (przelaczonoPl) {
  await przebieg('pl');
}

// ---------------------------------------------------------------------------
// PRZYWRÓCENIE: PL -> EN
// ---------------------------------------------------------------------------
currentTag = 'przywrocenie-jezyka-en';
try {
  await p.goto(`${BASE}/settings/language`, { waitUntil: 'load', timeout: 40000 });
  await p.waitForTimeout(1500);
  const english = p.getByRole('button', { name: /English|Angielski/i }).first();
  await english.click({ timeout: 5000 });
  await p.waitForTimeout(1500);
} catch (e) {
  console.log('BŁĄD przywrócenia EN:', String(e.message || e).slice(0, 200));
  manifest.pl.push({ lang: 'en', modul: 'przywrocenie', status: 'BLAD', powod: String(e.message || e).slice(0, 300) });
}
await p.reload({ waitUntil: 'load', timeout: 40000 }).catch(() => {});
await p.waitForTimeout(2000);
await zrzut('en', '00-przywrocenie', '02-po-przywroceniu-en');

await b.close();

manifest.koniec = new Date().toISOString();
fs.writeFileSync(path.join(OUT, 'captures-manifest.json'), JSON.stringify(manifest, null, 1));
fs.writeFileSync(path.join(OUT, 'konsola-siec.json'), JSON.stringify(konsolaSiec, null, 1));
console.log('\nGOTOWE. Ekranów EN:', manifest.en.length, ' PL:', manifest.pl.length, ' błędów konsoli/sieci:', konsolaSiec.length);
