#!/usr/bin/env node
/**
 * ODBIÓR NA ŻYWO 05.09 — zrzut realnego ekranu aplikacji (localhost:3000 → backend stagingu),
 * zalogowaną sesją z ODBIOR_AUTH_STATE, domyślnie JASNY motyw i szerokość 1440.
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
 * --zdarzenie=<nazwa>::<jsonDetail> (OPT-IN, 2026-09-06): wysyła `window.dispatchEvent(new CustomEvent(nazwa,{detail}))`.
 *   Potrzebne dla ekranów osiągalnych WYŁĄCZNIE zdarzeniem (np. `mywork-open-item` — wejście do rekordu
 *   z panelu powiązań w Mojej Pracy). Kroki --klik/--wpisz/--zdarzenie wykonują się w KOLEJNOŚCI Z WIERSZA POLECEŃ.
 *   Przykład: --zdarzenie='mywork-open-item::{"type":"initiative","id":"abc","name":"X"}'
 * --wybierz=<selektor>::<wartość> (OPT-IN, 2026-09-06): wybiera opcję w <select> (`selectOption`).
 *   `--wpisz` na <select> pada („Element is not an <input>…”), a kreatory (np. generator wniosku
 *   Oceny) prowadzą przez listy rozwijane — bez tego kroku ich ekranu wynikowego nie da się
 *   odtworzyć zrzutem. Wykonuje się w KOLEJNOŚCI Z WIERSZA POLECEŃ razem z --klik/--wpisz/--zdarzenie.
 * --wpisz=<selektor>::<tekst> (OPT-IN, 2026-09-06): wpisuje tekst w pole/edytor. Można podać wiele razy;
 *   kroki --klik i --wpisz wykonują się w KOLEJNOŚCI Z WIERSZA POLECEŃ. Pola formularza dostają `fill`,
 *   `contenteditable` (TipTap) — realne pisanie z klawiatury. Bez tego parametru zero zmiany zachowania.
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
 * --szerokosc=<px> (OPT-IN): szerokość viewportu; domyślnie 1440.
 * --motyw=light|dark (OPT-IN): motyw i colorScheme; domyślnie light (patrz opis wyżej).
 * Zapisuje też <out>.json z adresem końcowym, tytułem i listą błędów konsoli (do werdyktu).
 *
 * ★ OSTRZEŻENIE (BLOKER RAPORT_B #6, naprawione 2026-09-06): TEN SKRYPT NIGDY DOMYŚLNIE
 *   NIE ZAPISUJE sesji z powrotem do pliku ODBIOR_AUTH_STATE. Wcześniej robił to
 *   bezwarunkowo za każdym razem, gdy końcowy URL nie był `/login` — w tym gdy trafił na
 *   stronę PUBLICZNĄ bez ważnej sesji, co przy kilku agentach współdzielących JEDEN plik
 *   sesji nadpisywało cudzą ważną sesję pustym/bez-tokenowym stanem. Zapis dziś wymaga
 *   JAWNEJ opcji `--zapisz-sesje` I następuje tylko, gdy w stanie jest realny token oraz
 *   URL końcowy nie jest `/login` (logika: zrzutSesja.mjs, test: tests/unit/odbior/
 *   zrzutSesja.test.ts). Zapis jest atomowy (plik tymczasowy + rename). Włączaj
 *   `--zapisz-sesje` TYLKO gdy świadomie chcesz odświeżyć rotujący token — nie jako
 *   domyślny nawyk przy każdym wywołaniu.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { zapiszSesjeJesliBezpiecznie } from './zrzutSesja.mjs';
const args = process.argv.slice(2);
const get = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const kliki = args.filter((x) => x.startsWith('--klik=')).map((x) => x.slice(7));
// --wpisz=<selektor>::<tekst> (OPT-IN, 2026-09-06): wpisz tekst do pola/edytora.
// Potrzebne, gdy dowodem jest DZIAŁANIE, a nie sam wygląd (np. „Czysto" w
// Materiałach: dokument liczy się dopiero wtedy, gdy da się w nim NAPISAĆ i
// zapisać). Kroki `--klik` i `--wpisz` wykonują się w KOLEJNOŚCI Z WIERSZA
// POLECEŃ — bez tego parametru zachowanie skryptu jest bajt w bajt jak dotąd.
// Pola formularza dostają `fill`, edytory `contenteditable` — realne pisanie
// z klawiatury (TipTap i spółka ignorują podmianę wartości).
const kroki = args
  .filter(
    (x) =>
      x.startsWith('--klik=') ||
      x.startsWith('--wpisz=') ||
      x.startsWith('--wybierz=') ||
      x.startsWith('--zdarzenie=')
  )
  .map((x) => {
    if (x.startsWith('--klik=')) return { rodzaj: 'klik', selektor: x.slice(7) };
    if (x.startsWith('--wybierz=')) {
      const surowy = x.slice(10);
      const i = surowy.indexOf('::');
      if (i < 0) return { rodzaj: 'blad', selektor: surowy };
      return { rodzaj: 'wybierz', selektor: surowy.slice(0, i), tekst: surowy.slice(i + 2) };
    }
    if (x.startsWith('--zdarzenie=')) {
      // --zdarzenie=<nazwa>::<jsonDetail> (OPT-IN, 2026-09-06, zlecenie 1.1-L).
      // Aplikacja ma powierzchnie osiagalne WYLACZNIE przez `window.dispatchEvent`
      // (np. `mywork-open-item` — wejscie do rekordu z panelu powiazan). Bez tego
      // kroku takiego ekranu nie da sie odtworzyc zrzutem, a dorabianie wlasnego
      // skryptu obok kanonicznego juz raz dalo falszywy dowod. Krok jest opt-in:
      // bez parametru zachowanie skryptu jest bajt w bajt jak dotad.
      const surowy = x.slice(12);
      const i = surowy.indexOf('::');
      if (i < 0) return { rodzaj: 'blad', selektor: surowy };
      return { rodzaj: 'zdarzenie', selektor: surowy.slice(0, i), tekst: surowy.slice(i + 2) };
    }
    const surowy = x.slice(8);
    const i = surowy.indexOf('::');
    return i < 0
      ? { rodzaj: 'blad', selektor: surowy }
      : { rodzaj: 'wpisz', selektor: surowy.slice(0, i), tekst: surowy.slice(i + 2) };
  });
const wpisy = kroki.filter((k) => k.rodzaj === 'wpisz').map((k) => k.selektor);
const zdarzenia = kroki.filter((k) => k.rodzaj === 'zdarzenie').map((k) => `${k.selektor}::${k.tekst}`);
const przewin = get('przewin', '');
const url = get('url', '/chat'); const requestedOut = get('out'); const czekaj = Number(get('czekaj', '1200'));
// --czekaj-po=<ms> (OPT-IN, re-audyt 0609): dodatkowe oczekiwanie PO wykonaniu wszystkich
// --klik/--wpisz, PRZED zrzutem i PRZED zamknieciem przegladarki. Domyslnie 0 (zero zmiany
// zachowania) — bez tego strumienie SSE/fetch zainicjowane klikiem (np. wyslanie wiadomosci
// czatu) sa przerywane przez `browser.close()` ok. 1.5s po kliku, co serwer loguje jako
// "Provider stream was aborted before start" — to artefakt przyrzadu, nie usterka produktu.
const czekajPo = Number(get('czekaj-po', '0'));
const pelna = args.includes('--pelna'); const wysokosc = Number(get('wysokosc', '900'));
const port = Number(get('port', '3000'));
const host = get('host', 'localhost');
const szerokosc = Number(get('szerokosc', '1440'));
const motyw = get('motyw', 'light');
if (!Number.isFinite(szerokosc) || szerokosc < 320 || !['light', 'dark'].includes(motyw)) {
  console.error('Nieprawidłowe --szerokosc (min. 320) lub --motyw (light|dark)');
  process.exit(2);
}
const baza = `http://${host}:${port}`;
const out = motyw === 'dark' && requestedOut
  ? requestedOut.replace(/(?<!__dark)(\.[^.\/]+)$/, '__dark$1')
  : requestedOut;
const domSelektory = args.filter((x) => x.startsWith('--dom=')).map((x) => x.slice(6));
// OSTRZEŻENIE (BLOKER RAPORT_B #6): zapis sesji z powrotem do pliku NIE jest
// domyślny. Bez tej opcji skrypt TYLKO CZYTA sesję i nigdy jej nie nadpisuje —
// bezpieczne do uruchamiania równolegle przez kilku agentów na WSPÓLNYM pliku
// ODBIOR_AUTH_STATE. Włącz `--zapisz-sesje` TYLKO gdy świadomie chcesz
// odświeżyć rotujący token dla przyszłych zrzutów (patrz zrzutSesja.mjs).
const zapiszSesje = args.includes('--zapisz-sesje');
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
const ctx = await browser.newContext({ storageState: sesja, viewport: { width: szerokosc, height: wysokosc }, colorScheme: motyw, locale: 'pl-PL' });
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
const odpowiedziHttp = [];
page.on('console', (m) => { if (m.type() === 'error') bledy.push(m.text().slice(0, 200)); });
page.on('pageerror', (e) => bledy.push('pageerror: ' + String(e).slice(0, 200)));
page.on('response', (response) => {
  if (response.status() >= 400) odpowiedziHttp.push({ status: response.status(), url: response.url() });
});
await page.goto(baza + url, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(czekaj);
for (const krok of kroki) {
  if (krok.rodzaj === 'blad') {
    bledy.push(`--wpisz bez separatora "::": ${krok.selektor}`);
    continue;
  }
  if (krok.rodzaj === 'klik') {
    try { await page.locator(krok.selektor).first().click({ timeout: 8000 }); await page.waitForTimeout(900); }
    catch (e) { bledy.push(`klik nieudany: ${krok.selektor}: ${String(e.message).split('\n')[0].slice(0, 160)}`); }
    continue;
  }
  if (krok.rodzaj === 'wybierz') {
    try {
      const cel = page.locator(krok.selektor).first();
      await cel.waitFor({ state: 'visible', timeout: 8000 });
      await cel.selectOption(krok.tekst, { timeout: 8000 });
      await page.waitForTimeout(900);
    } catch (e) {
      bledy.push(
        `wybor nieudany: ${krok.selektor}: ${String(e.message).split('\n')[0].slice(0, 160)}`
      );
    }
    continue;
  }
  if (krok.rodzaj === 'zdarzenie') {
    try {
      const detal = JSON.parse(krok.tekst);
      await page.evaluate(
        ({ nazwa, detail }) => window.dispatchEvent(new CustomEvent(nazwa, { detail })),
        { nazwa: krok.selektor, detail: detal }
      );
      await page.waitForTimeout(1200);
    } catch (e) {
      bledy.push(`zdarzenie nieudane: ${krok.selektor}: ${String(e.message).split('\n')[0].slice(0, 160)}`);
    }
    continue;
  }
  try {
    const cel = page.locator(krok.selektor).first();
    await cel.waitFor({ state: 'visible', timeout: 8000 });
    await cel.click({ timeout: 8000 });
    const edytowalny = await cel.evaluate((el) => el.isContentEditable === true).catch(() => false);
    if (edytowalny) {
      // ProseMirror/TipTap ustawia selekcję dopiero po obsłużeniu kliknięcia —
      // bez tej pauzy PIERWSZY wpisany znak ginie (zmierzone: „Dokument…" →
      // „okument…" na zrzucie dowodowym).
      await page.waitForTimeout(400);
      await page.keyboard.type(krok.tekst, { delay: 12 });
    } else {
      await cel.fill(krok.tekst, { timeout: 8000 });
    }
    await page.waitForTimeout(900);
  } catch (e) {
    bledy.push(`wpisanie nieudane: ${krok.selektor}: ${String(e.message).split('\n')[0].slice(0, 160)}`);
  }
}
if (przewin) {
  try { await page.locator(przewin).first().scrollIntoViewIfNeeded({ timeout: 8000 }); await page.waitForTimeout(700); }
  catch (e) { bledy.push(`przewiniecie nieudane: ${przewin}: ${String(e.message).split('\n')[0].slice(0, 160)}`); }
}
await page.waitForTimeout(600);
if (czekajPo > 0) await page.waitForTimeout(czekajPo);
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
fs.writeFileSync(out + '.json', JSON.stringify({ url: page.url(), tytul: await page.title(), kliki, wpisy, zdarzenia, przewin: przewin || null, pelna, wysokosc, szerokosc, motyw, bledy, bledyKonsoli: bledy, odpowiedziHttp, tekst, ...(domSelektory.length ? { dom } : {}), kiedy: new Date().toISOString() }, null, 1));
console.log('OK', out, page.url(), bledy.length ? `(${bledy.length} błędów konsoli/klików)` : '');
// Sesja: token odswieza sie rotacyjnie, WIEC BYLOBY WYGODNIE zapisac zaktualizowany
// stan z powrotem — ale TYLKO gdy jawnie o to poproszono (--zapisz-sesje) i tylko gdy
// stan faktycznie ma token i nie jest to /login. Patrz zrzutSesja.mjs (BLOKER
// RAPORT_B #6): bezwarunkowy zapis "gdy nie /login" nadpisywał cudzą ważną sesję,
// gdy TEN proces trafil na strone publiczna bez tokenu. Zapis (gdy dozwolony) jest
// atomowy (plik tymczasowy + rename), wiec wspoldzielony plik nigdy nie jest
// widoczny w stanie polowicznym.
try {
  const st = await ctx.storageState();
  const wynikZapisu = zapiszSesjeJesliBezpiecznie({
    zapiszSesje,
    urlKoncowy: page.url(),
    storageState: st,
    baza,
    authPath: auth,
  });
  if (zapiszSesje) console.log('sesja:', wynikZapisu.zapisano ? 'zapisana' : `NIE zapisana (${wynikZapisu.powod})`);
} catch {}
await browser.close();
