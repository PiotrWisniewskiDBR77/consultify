// pomiar-jezyka-ekrany.mjs — SKAN WIZUALNY spójności językowej.
//
// Loguje się jako `audyt@dbr77.local` z interfejsem ustawionym na EN, wchodzi na
// główny ekran każdej z 16 pozycji menu (kolejność wg docs/FUNCTIONAL_DOCUMENTATION.md),
// robi zrzut 1440x900 (jasny) i liczy POLSKIE SŁOWA w `document.body.innerText`.
//
// PO CO, skoro jest skaner kodu: innerText łapie to, czego skan repo nie widzi —
// etykiety z BAZY (statusy, słowniki, `job_title`, dane pokazowe) i zdania
// wracające z SERWERA w odpowiedziach HTTP.
//
// Stanowisko: API 4175 + Vite 3195, baza consultify_kopia_final.
// Wymaga: UPDATE users SET language='en' WHERE email='audyt@dbr77.local';
//
// Użycie: node scripts/i18n/pomiar-jezyka-ekrany.mjs
// Wynik:  evidence/jezyk-pomiar-0809/<nr>-<modul>-en.png  +  _wynik.json

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const WYJATKI = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'pomiar-jezyka.wyjatki.json'), 'utf8'),
);

const API = 'http://127.0.0.1:4175';
const BASE = 'http://127.0.0.1:3195';
const OUT = path.join(ROOT, 'evidence/jezyk-pomiar-0809');
fs.mkdirSync(OUT, { recursive: true });

const EKRANY = [
  ['01', 'chat', '/chat'],
  ['02', 'my-work', '/my-work'],
  ['03', 'interview', '/interview'],
  ['04', 'tools', '/discovery-tools'],
  ['05', 'assessment', '/assessment/overview'],
  ['06', 'initiatives', '/initiatives'],
  ['07', 'execution', '/execution'],
  ['08', 'results', '/results/kpi'],
  ['09', 'finance', '/finance'],
  ['10', 'materials', '/presentations'],
  ['11', 'audits', '/audit-programs'],
  ['12', 'meeting', '/meetings'],
  ['13', 'organization', '/organization/profile'],
  ['14', 'admin', '/admin'],
  ['15', 'settings', '/settings/profile'],
  ['16', 'partner', '/partner'],
];

const DIAKRYTYKI = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;
const nazwyWlasne = new Set(WYJATKI.nazwyWlasne.map((s) => s.toLowerCase()));
const plSilne = new Set(WYJATKI.polskieSilne);
const plSlabe = new Set(WYJATKI.polskieSlabe);

/** ta sama heurystyka co w pomiar-jezyka.mjs, tylko na tekście ze strony */
function policzPolskie(innerText) {
  const linie = String(innerText)
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length >= 2);
  const trafienia = [];
  for (const linia of linie) {
    const slowaLinii = linia
      .split(/[^A-Za-zĄąĆćĘęŁłŃńÓóŚśŹźŻż]+/)
      .filter(Boolean)
      .map((w) => w.toLowerCase())
      .filter((w) => !nazwyWlasne.has(w));
    const dowod = [];
    const d = linia.match(DIAKRYTYKI);
    if (d) dowod.push(`diakrytyk:${d[0]}`);
    const silne = [...new Set(slowaLinii.filter((w) => plSilne.has(w)))];
    const slabe = [...new Set(slowaLinii.filter((w) => plSlabe.has(w)))];
    if (silne.length) dowod.push(...silne.map((w) => `pl:${w}`));
    else if (!dowod.length && slabe.length >= 2) dowod.push(...slabe.slice(0, 2).map((w) => `pl?:${w}`));
    if (dowod.length) trafienia.push({ tekst: linia.slice(0, 120), dowod: dowod.slice(0, 3).join(',') });
  }
  const unikalne = [];
  const widziane = new Set();
  for (const t of trafienia) {
    if (widziane.has(t.tekst)) continue;
    widziane.add(t.tekst);
    unikalne.push(t);
  }
  return { linieOgolem: linie.length, trafienia: unikalne };
}

async function login() {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'audyt@dbr77.local', password: 'AudytDBR77!2026' }),
  });
  if (!res.ok) throw new Error(`login failed ${res.status}: ${await res.text()}`);
  return res.json();
}

async function seedSession(page, session) {
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.evaluate((session) => {
    localStorage.setItem('token', session.token);
    localStorage.setItem('refreshToken', session.refreshToken);
    localStorage.setItem('user', JSON.stringify(session.user));
    localStorage.setItem('consultify_current_org_id', session.user.organizationId);
    localStorage.setItem('i18nextLng', 'en'); // POMIAR JEST O WERSJI ANGIELSKIEJ
    try {
      const raw = localStorage.getItem('consultify-storage');
      const storage = raw ? JSON.parse(raw) : { state: {}, version: 0 };
      storage.state = storage.state || {};
      storage.state.theme = 'light';
      localStorage.setItem('consultify-storage', JSON.stringify(storage));
    } catch (e) {
      console.error('motyw:', e);
    }
  }, session);
}

const session = await login();
console.log('zalogowano, users.language =', session.user?.language);
const browser = await chromium.launch();
const wynik = { data: new Date().toISOString(), jezykKonta: session.user?.language, ekrany: [] };

for (const [nr, nazwa, trasa] of EKRANY) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.emulateMedia({ colorScheme: 'light' });
  const bledy = [];
  page.on('pageerror', (e) => bledy.push(String(e).slice(0, 200)));
  page.on('response', (r) => {
    if (r.status() >= 400 && !r.url().includes('/api/auth/')) bledy.push(`HTTP ${r.status()} ${r.url().slice(0, 120)}`);
  });
  try {
    await seedSession(page, session);
    await page.goto(`${BASE}${trasa}`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(2500);
  } catch (e) {
    bledy.push(`nawigacja: ${String(e).slice(0, 160)}`);
  }
  const plik = `${nr}-${nazwa}-en`;
  await page.screenshot({ path: path.join(OUT, `${plik}.png`), fullPage: false });
  const innerText = await page.evaluate(() => document.body.innerText || '');
  const pomiar = policzPolskie(innerText);
  const wpis = {
    nr,
    modul: nazwa,
    trasa,
    url: page.url(),
    zrzut: `${plik}.png`,
    linieTekstu: pomiar.linieOgolem,
    polskichLinii: pomiar.trafienia.length,
    przyklady: pomiar.trafienia.slice(0, 12),
    bledy: bledy.slice(0, 6),
  };
  wynik.ekrany.push(wpis);
  console.log(`${nr} ${nazwa.padEnd(14)} linii=${String(pomiar.linieOgolem).padStart(4)}  POLSKICH=${String(pomiar.trafienia.length).padStart(4)}  ${page.url()}`);
  await context.close();
}

await browser.close();
fs.writeFileSync(path.join(OUT, '_wynik.json'), JSON.stringify(wynik, null, 2));
const suma = wynik.ekrany.reduce((s, e) => s + e.polskichLinii, 0);
console.log(`\nRAZEM polskich linii na 16 ekranach EN: ${suma}`);
