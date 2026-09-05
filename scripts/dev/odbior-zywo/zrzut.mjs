#!/usr/bin/env node
/**
 * ODBIÓR NA ŻYWO 05.09 — zrzut realnego ekranu aplikacji (localhost:3000 → backend stagingu),
 * zalogowaną sesją z ODBIOR_AUTH_STATE, domyślnie JASNY motyw, szerokość 1440.
 * Użycie:
 *   node scripts/dev/odbior-zywo/zrzut.mjs --url=/my-work --out=evidence/odbior-zywo-20260905/02/mywork-inbox.png \
 *     [--klik="text=Zadania"] [--klik="css=button[aria-label='History']"] [--czekaj=1500] [--pelna] [--wysokosc=900] [--port=3055] [--motyw=dark]
 * --motyw=light|dark (OPT-IN, 2026-09-05): domyślnie light. Dla dark plik dostaje sufiks __dark.
 * --port: aplikacja na INNYM porcie niż 3000 (kilka rąk naraz — każdy agent ma swój vite).
 *   Sesja z ODBIOR_AUTH_STATE jest zapisana dla origin http://localhost:3000, a localStorage
 *   (w tym `token`) jest zakresowany PER ORIGIN — bez przepisania portu aplikacja uzna, że
 *   nikt nie jest zalogowany, i przekieruje na /login. Ciasteczka nie mają portu w domenie,
 *   więc wystarczy przepisać `origins`. Robimy to na KOPII w pamięci — plik sesji nietknięty.
 * --klik można podać wiele razy (kolejno). Selektor w składni Playwright (text=, css=, role=…).
 * --przewin=<selektor> (OPT-IN, dodane 2026-09-05): po klikach przewija podany element do widoku
 *   i dopiero wtedy robi zrzut. Potrzebne, gdy odbierany blok leży poniżej pierwszego ekranu, a
 *   `--pelna` daje obraz zbyt wysoki, żeby cokolwiek na nim zobaczyć (np. panel EV football-field
 *   na kroku „Wyniki" wyceny). Bez tego parametru zachowanie skryptu jest bajt w bajt jak dotąd.
 * --host=<nazwa> (OPT-IN, 2026-09-05): host aplikacji zamiast `localhost` (np. `127.0.0.1`, gdy vite
 *   agenta jest zbindowany tylko na pętlę IPv4). Origin sesji jest przepisywany tak samo jak przy --port.
 * --dom=<selektor> (OPT-IN, 2026-09-05): policz elementy pasujące do selektora (składnia Playwright/CSS)
 *   i zapisz ich liczbę oraz prostokąty do <out>.json (klucz `dom`). Można podać wiele razy. Potrzebne,
 *   gdy odbiór dotyczy LICZBY paneli/kolumn (np. „ma być dokładnie jeden prawy panel") — samo oko na
 *   zrzucie nie odróżnia dwóch sąsiadujących kolumn od jednej szerokiej.
 * Zapisuje też <out>.json z adresem końcowym, tytułem i listą błędów konsoli (do werdyktu).
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const args = process.argv.slice(2);
const get = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const kliki = args.filter((x) => x.startsWith('--klik=')).map((x) => x.slice(7));
const przewin = get('przewin', '');
const url = get('url', '/chat'); const requestedOut = get('out'); const czekaj = Number(get('czekaj', '1200'));
const pelna = args.includes('--pelna'); const wysokosc = Number(get('wysokosc', '900'));
const port = Number(get('port', '3000'));
const host = get('host', 'localhost');
const baza = `http://${host}:${port}`;
const motyw = get('motyw', 'light');
if (!['light', 'dark'].includes(motyw)) { console.error('Dozwolone: --motyw=light|dark'); process.exit(2); }
const out = motyw === 'dark' && requestedOut
  ? requestedOut.replace(/(?<!__dark)(\.[^.\/]+)$/, '__dark$1')
  : requestedOut;
const domSelektory = args.filter((x) => x.startsWith('--dom=')).map((x) => x.slice(6));
const auth = process.env.ODBIOR_AUTH_STATE;
if (!out || !auth || !fs.existsSync(auth)) { console.error('Wymagane: --out oraz ODBIOR_AUTH_STATE (istniejący plik)'); process.exit(2); }
fs.mkdirSync(path.dirname(out), { recursive: true });
const browser = await chromium.launch({ headless: true });
// Kopia sesji z przepisanym originem (patrz --port wyżej). Przy porcie 3000
// to jest dokładnie ta sama treść co w pliku — zero zmiany zachowania.
const sesja = JSON.parse(fs.readFileSync(auth, 'utf8'));
const originy = sesja.origins || [];
const zTokenem = originy.find((o) =>
  (o.localStorage || []).some((entry) => entry.name === 'token' && entry.value)
);
const kanoniczny = originy.find((o) => o.origin === 'http://localhost:3000' &&
  (o.localStorage || []).some((entry) => entry.name === 'token' && entry.value));
const zrodlo = kanoniczny || zTokenem || originy.find((o) => o.origin === 'http://localhost:3000');
if (zrodlo) {
  sesja.origins = [
    ...originy.filter((o) => o.origin !== baza),
    { ...zrodlo, origin: baza },
  ];
}
const ctx = await browser.newContext({ storageState: sesja, viewport: { width: 1440, height: wysokosc }, colorScheme: motyw, locale: 'pl-PL' });
// Aplikacja trzyma motyw w zustand persist `consultify-storage` (state.theme: 'light'|'dark'|'system',
// src/store/slices/uiSlice.ts) — nadpisujemy PRZED startem aplikacji (i PO kopii sesji powyżej).
await ctx.addInitScript((theme) => {
  try {
    const raw = localStorage.getItem('consultify-storage');
    const obj = raw ? JSON.parse(raw) : { state: {}, version: 0 };
    obj.state = { ...(obj.state || {}), theme };
    localStorage.setItem('consultify-storage', JSON.stringify(obj));
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  } catch {}
}, motyw);
const page = await ctx.newPage();
const bledy = [];
page.on('console', (m) => { if (m.type() === 'error') bledy.push(m.text().slice(0, 200)); });
page.on('pageerror', (e) => bledy.push('pageerror: ' + String(e).slice(0, 200)));
await page.goto(baza + url, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(czekaj);
for (const k of kliki) {
  try { await page.locator(k).first().click({ timeout: 8000 }); await page.waitForTimeout(900); }
  catch (e) { bledy.push(`klik nieudany: ${k}: ${String(e.message).split('\n')[0].slice(0, 160)}`); }
}
if (przewin) {
  try { await page.locator(przewin).first().scrollIntoViewIfNeeded({ timeout: 8000 }); await page.waitForTimeout(700); }
  catch (e) { bledy.push(`przewiniecie nieudane: ${przewin}: ${String(e.message).split('\n')[0].slice(0, 160)}`); }
}
await page.waitForTimeout(600);
await page.screenshot({ path: out, fullPage: pelna });
// --dom: pomiar liczebnosci (opt-in). Bez parametru `dom` w JSON nie ma — zero zmiany dla dotychczasowych wywolan.
const dom = {};
for (const sel of domSelektory) {
  try {
    const loc = page.locator(sel);
    const n = await loc.count();
    const boxy = [];
    for (let i = 0; i < n; i += 1) { const b = await loc.nth(i).boundingBox().catch(() => null); boxy.push(b); }
    dom[sel] = { liczba: n, boxy };
  } catch (e) { dom[sel] = { blad: String(e.message).split('\n')[0].slice(0, 160) }; }
}
// tekst: zawsze pelny innerText body (P4, dyzur 374 — straznik slepej plamy czyta .tekst
// bezwarunkowo); to jest nadzbior zachowania opt-in z P3 (--dom=body), wiec zadnego wolacza
// nie psuje — kazdy dostaje co najmniej to, co dostawal wczesniej.
const tekst = await page.locator('body').innerText().catch(() => '');
fs.writeFileSync(out + '.json', JSON.stringify({ url: page.url(), tytul: await page.title(), kliki, przewin: przewin || null, pelna, wysokosc, bledy, bledyKonsoli: bledy, tekst, ...(domSelektory.length ? { dom } : {}), kiedy: new Date().toISOString() }, null, 1));
console.log('OK', out, page.url(), bledy.length ? `(${bledy.length} błędów konsoli/klików)` : '');
// Sesja: token odswieza sie rotacyjnie — zapisz zaktualizowany stan z powrotem, zeby kolejne
// zrzuty (i inni agenci) nie dostali 401 po rotacji. Tylko gdy nadal zalogowani (nie /login).
// Zapis zrotowanej sesji ZAWSZE pod originem kanonicznym :3000 (05.09: agent na :3011 nadpisal plik
// wspolny i wylogowal rownolegla sesje na :3000). Kopia w pamieci, origin przepisany z powrotem.
try {
  if (!page.url().includes('/login')) {
    const st = await ctx.storageState();
    st.origins = (st.origins || []).map((o) => ({ ...o, origin: String(o.origin).replace(baza, 'http://localhost:3000') }));
    fs.writeFileSync(auth, JSON.stringify(st, null, 2), { mode: 0o600 });
  }
} catch {}
await browser.close();
