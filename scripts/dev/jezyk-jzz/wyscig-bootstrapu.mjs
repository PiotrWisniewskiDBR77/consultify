/**
 * DOWÓD WYŚCIGU BOOTSTRAPU i18n — paczka ZZ (komponenty wspólne).
 *
 * Pytanie pomiarowe: czy konto z `users.language='en'` i `i18nextLng='en'`
 * widzi POLSKI interfejs w pierwszych sekundach po przeładowaniu ekranu?
 *
 * Metoda: świeży kontekst przeglądarki, logowanie, potem PEŁNE przeładowanie
 * (`page.goto`) ekranu i próbkowanie `document.body.innerText` w 300 ms, 1 s
 * i 3 s od `domcontentloaded`. Każda próbka: zrzut PNG + JSON z listą polskich
 * słów interfejsu.
 *
 * Trzy pułapki przyrządu opisane przez J1 (evidence/jezyk-j1/README.md) są tu
 * ominięte świadomie:
 *  1. lepki język modułu w localStorage -> świeży kontekst na każdy przebieg;
 *  2. sonda na `document.title` kłamie -> czytamy tekst renderowany przez produkt;
 *  3. wiadro DANE (polskie rozmowy pokazowe) -> linie pokrywające się z bazą
 *     nie liczą się jako interfejs.
 *
 * Uruchomienie: node scripts/dev/jezyk-jzz/wyscig-bootstrapu.mjs przed|po
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { chromium } from 'playwright';

const FAZA = process.argv[2] === 'po' ? 'po' : 'przed';
/**
 * SCENARIUSZ:
 *   'lepki'  — localStorage ma juz i18nextLng='en' (uzytkownik, ktory raz wybral EN)
 *   'swieza' — SWIEZA przegladarka: ZERO i18nextLng, navigator='pl-PL'.
 *              To jest jedyny scenariusz, w ktorym o jezyk powloki gra KONTO
 *              przeciwko przegladarce — i w ktorym wyscig bootstrapu w ogole
 *              moze byc widoczny. Konto ma `users.language='en'`.
 */
const SCENARIUSZ = ['lepki', 'wolne-me', 'wolne-locale'].includes(process.argv[3])
  ? process.argv[3]
  : 'swieza';
/**
 * 'wolne-me' = 'swieza' + sztuczne opoznienie `GET /api/auth/me` o 2,5 s.
 * Po co: na szybkim localhoscie konto odpowiada szybciej, niz powloka zdazy
 * sie namalowac, wiec wyscig jest NIEWIDOCZNY — a to nie znaczy, ze go nie ma.
 * Realny uzytkownik na wolnym laczu maluje powloke ZANIM konto odpowie.
 * To nie jest „psucie produktu pod teze": opoznienie dotyczy WYLACZNIE
 * odpowiedzi sieciowej, ktora i tak jest asynchroniczna.
 */
const BASE = 'http://127.0.0.1:3219';
const OUT = path.resolve(process.cwd(), 'evidence/jezyk-jzz', `${FAZA}-${SCENARIUSZ}`);
fs.mkdirSync(OUT, { recursive: true });

const sql = (q) =>
  execSync(
    `docker exec consultify-pg18 psql -U postgres -d consultify_jzz -Atc "${q.replace(/"/g, '\\"')}"`,
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
  ).trim();

// --- wiadro DANE: wartości z bazy, nie z interfejsu -----------------------
const DANE = new Set();
for (const q of [
  'select title from conversations',
  'select left(content, 400) from conversation_messages where content is not null',
  'select title from initiatives',
  'select name from initiatives',
  'select description from initiatives',
  'select title from tasks',
  'select description from tasks',
  'select name from projects',
  'select description from projects',
  'select title from decisions',
  'select name from kpis',
  'select title from presentation_decks',
  'select name from presentation_templates',
  'select title from management_reports',
  'select title from report_builder_reports',
  'select title from knowledge_documents',
  'select name from document_studio_templates',
  "select coalesce(display_name, first_name || ' ' || last_name) from users",
]) {
  let out = '';
  try {
    out = sql(q);
  } catch {
    continue;
  }
  for (const v of out.split('\n')) {
    const s = v.trim();
    if (!s) continue;
    DANE.add(s.toLowerCase());
    for (const linia of s.split(/\\n|\n/)) {
      const l = linia.trim();
      if (l.length >= 8) DANE.add(l.toLowerCase());
    }
  }
}
const DANE_LISTA = [...DANE];
const norm = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[*_`#>]/g, ' ')
    .replace(/^\s*(?:[-•–]|\d+[.)])\s*/gm, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const KORPUS = norm(DANE_LISTA.join(' \n '));
function czyDane(linia) {
  const l = linia.toLowerCase().trim();
  if (!l) return false;
  if (DANE.has(l)) return true;
  const ucieta = l.replace(/(\.\.\.|…)$/, '').trim();
  if (ucieta.length >= 8 && DANE_LISTA.some((d) => d.startsWith(ucieta))) return true;
  if (DANE_LISTA.some((d) => d.length >= 12 && l.includes(d))) return true;
  const n = norm(l).replace(/(\.\.\.|…)$/, '').trim();
  return n.length >= 12 && KORPUS.includes(n);
}

const DIAKRYTYKI = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;
const PL_SLOWA = new Set([
  'nie','tak','jest','są','brak','oraz','albo','lub','dla','przez','wszystkie','wszystkich',
  'nowy','nowa','nowe','zapisz','utwórz','utworz','zamknij','wybierz','sprawdź','pokaż','dodaj',
  'usuń','anuluj','otwórz','więcej','mniej','ponownie','spróbuj','ładowanie','edytuj','przywróć',
  'odrzuć','zatwierdź','wyślij','przenieś','zmień','rozmowa','rozmowy','wiadomość','wiadomości',
  'historia','historii','wersja','wersji','ocena','oceny','narzędzia','narzędzie','projekt',
  'projekty','tydzień','miesiąc','dzisiaj','wczoraj','ustawienia','wyloguj','pulpit','moja','praca',
  'inicjatywy','inicjatywa','realizacja','materiały','wyniki','organizacja','ładowanie…','czat',
  'strona','wczytywanie','trwa','proszę','czekaj','powrót','wstecz','dalej','gotowe','błąd',
  'zadania','zadanie','pomoc','szukaj','filtry','kolumny','widok','wykres','tabela','raport',
]);
const NEUTRALNE = new Set([
  'status','kpi','ai','ok','teresa','consultify','dbr','studio','chat','auto','model','data',
  'canvas','deck','builder','excel','pdf','csv','api','url','id','sla','roi','pmo','raid',
  'audyt','lokalny','local','output','co','thinker','help','center','okr','crm','erp',
]);

function polskieLinie(text) {
  const wynik = { ui: [], dane: [] };
  for (const raw of String(text).split('\n')) {
    const linia = raw.trim();
    if (!linia) continue;
    const czysty = linia.replace(/https?:\/\/\S+/g, ' ');
    const slowa = czysty.split(/[^A-Za-zĄąĆćĘęŁłŃńÓóŚśŹźŻż]+/).filter(Boolean);
    const trafienia = [];
    for (const w of slowa) {
      const l = w.toLowerCase();
      if (NEUTRALNE.has(l)) continue;
      if (DIAKRYTYKI.test(w) || PL_SLOWA.has(l)) trafienia.push(w);
    }
    if (!trafienia.length) continue;
    (czyDane(linia) ? wynik.dane : wynik.ui).push({ linia, trafienia: [...new Set(trafienia)] });
  }
  return wynik;
}

const b = await chromium.launch();

async function zalogujEN() {
  sql("UPDATE users SET language='en' WHERE email='audyt@dbr77.local'");
  const ctx = await b.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: 'light',
    // przegladarka „mowi po polsku" — konto mowi po angielsku. Kto wygra?
    locale: SCENARIUSZ === 'lepki' ? 'en-US' : 'pl-PL',
  });
  const page = await ctx.newPage();
  if (SCENARIUSZ === 'wolne-locale') {
    // `en/translation.json` wazy 1,9 MB. Na localhoscie idzie z dysku w
    // milisekundach; u uzytkownika przez siec to sekundy. Przy
    // `react.useSuspense: false` powloka maluje sie NIE CZEKAJAC na ten plik,
    // wiec `t()` oddaje wtedy `defaultValue` z kodu — a tych polskich jest
    // 1046 w repo. To jest kanal A z PLANU §1, zmierzony wprost.
    await ctx.route('**/locales/**', async (route) => {
      await new Promise((r) => setTimeout(r, 3000));
      await route.continue();
    });
  }
  if (SCENARIUSZ === 'wolne-me') {
    await ctx.route('**/api/auth/me*', async (route) => {
      await new Promise((r) => setTimeout(r, 2500));
      await route.continue();
    });
  }
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  if (SCENARIUSZ === 'lepki') await page.evaluate(() => localStorage.setItem('i18nextLng', 'en'));
  await page.locator('input[type="email"]').first().fill('audyt@dbr77.local');
  await page.locator('input[type="password"]').first().fill('AudytDBR77!2026');
  await page.locator('input[type="password"]').first().press('Enter');
  await page.waitForURL((u) => !String(u).includes('/login'), { timeout: 40000 });
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    const K = 'consultify-storage';
    const r = localStorage.getItem(K);
    const o = r ? JSON.parse(r) : { state: {}, version: 0 };
    o.state = { ...(o.state || {}), theme: 'light' };
    localStorage.setItem(K, JSON.stringify(o));
  });
  if (SCENARIUSZ !== 'lepki') {
    // logowanie samo zapisalo i18nextLng (changeLanguage -> localStorage).
    // Kasujemy go, zeby nastepne wejscie na ekran bylo naprawde „pierwszym
    // wejsciem tego konta na tej przegladarce".
    await page.evaluate(() => {
      try {
        localStorage.removeItem('i18nextLng');
      } catch {
        /* ignore */
      }
    });
  }
  return { ctx, page };
}

/** Ekrany dowodowe: czat i inicjatywy (wskazane w zleceniu) + realizacja i materiały. */
const EKRANY = [
  ['czat', '/chat'],
  ['inicjatywy', '/initiatives'],
  ['realizacja', '/execution'],
  ['materialy', '/presentations'],
];
const PROBKI = [300, 1000, 3000, 'pelne'];

const raport = [];
let { ctx, page } = await zalogujEN();

for (const [nazwa, sciezka] of EKRANY) {
  // pełne przeładowanie ekranu = dokładnie to, co robi użytkownik F5-em
  await page.goto(`${BASE}${sciezka}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  const t0 = Date.now();
  for (const ms of PROBKI) {
    if (ms === 'pelne') {
      // „po pelnym zaladowaniu" — bo szkielet ladowania nie jest dowodem
      // w zadna strone (brak pomiaru != wynik).
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(2500);
    } else {
      const czekaj = ms - (Date.now() - t0);
      if (czekaj > 0) await page.waitForTimeout(czekaj);
    }
    const stan = await page.evaluate(() => ({
      tekst: document.body.innerText,
      lng: (() => {
        try {
          return localStorage.getItem('i18nextLng');
        } catch {
          return null;
        }
      })(),
      htmlLang: document.documentElement.lang,
    }));
    const w = polskieLinie(stan.tekst);
    const plik = path.join(OUT, `${nazwa}-en-${ms}ms.png`);
    await page.screenshot({ path: plik });
    const meta = {
      ekran: nazwa,
      sciezka,
      probkaMs: ms,
      scenariusz: SCENARIUSZ,
      faktycznyMs: Date.now() - t0,
      i18nextLng: stan.lng,
      htmlLang: stan.htmlLang,
      polskichSlowUI: w.ui.reduce((a, x) => a + x.trafienia.length, 0),
      polskichLiniiUI: w.ui.length,
      ui: w.ui.slice(0, 40),
      daneLinii: w.dane.length,
    };
    fs.writeFileSync(`${plik}.json`, JSON.stringify(meta, null, 1));
    raport.push(meta);
    console.log(
      `${nazwa} @${ms}ms: polskich slow UI=${meta.polskichSlowUI} (linii ${meta.polskichLiniiUI}), lng=${stan.lng}`
    );
    if (w.ui.length) console.log('   ' + w.ui.slice(0, 5).map((x) => x.linia).join(' | '));
  }
}

fs.writeFileSync(path.join(OUT, 'raport.json'), JSON.stringify(raport, null, 1));
console.log('\nSUMA polskich slow UI: ' + raport.reduce((a, r) => a + r.polskichSlowUI, 0));
await ctx.close();
await b.close();
