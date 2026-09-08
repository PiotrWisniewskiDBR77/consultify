/**
 * DOWÓD WIZUALNY paczki J1 — moduł 01 Czat (AI Chat), EN i PL.
 *
 * Wzór: scripts/dev/jezyk-j7/zrzuty-j7.mjs (paczka J7b, moduł 07 Realizacja).
 * Stanowisko: API 4199 / Vite 3217 / baza consultify_kopia_final (docker consultify-pg18).
 *
 * Uruchomienie:
 *   node scripts/dev/jezyk-j1/zrzuty-j1.mjs przed|po
 *
 * Dla każdego ekranu zapisuje <nazwa>-<lang>.png oraz <nazwa>-<lang>.png.json
 * z licznikiem słów obcego języka w `document.body.innerText`. Wiersze, których
 * treść pokrywa się z wartościami z bazy (tytuły rozmów, treści wiadomości,
 * nazwy projektów, nazwiska), trafiają do osobnego wiadra DANE i NIE liczą się
 * jako UI — po polsku napisane rozmowy demo to kategoria K6, nie interfejs.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { chromium } from 'playwright';

const FAZA = process.argv[2] === 'po' ? 'po' : 'przed';
const BASE = 'http://127.0.0.1:3217';
const OUT = path.resolve(process.cwd(), 'evidence/jezyk-j1', FAZA);
fs.mkdirSync(OUT, { recursive: true });

const sql = (q) =>
  execSync(
    `docker exec consultify-pg18 psql -U postgres -d consultify_kopia_final -Atc "${q.replace(/"/g, '\\"')}"`,
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
  ).trim();

// --- wiadro DANE: wartości pochodzące z bazy, nie z interfejsu -------------
const DANE = new Set();
for (const q of [
  'select title from conversations',
  "select left(content, 400) from conversation_messages where content is not null",
  'select name from chat_projects',
  'select description from chat_projects',
  "select coalesce(display_name, first_name || ' ' || last_name) from users",
  'select first_name from users',
  'select last_name from users',
]) {
  let out = '';
  try {
    out = sql(q);
  } catch {
    // tabela może nie istnieć w tej kopii — brak danych to nie błąd dowodu
    continue;
  }
  for (const v of out.split('\n')) {
    const s = v.trim();
    if (!s) continue;
    DANE.add(s.toLowerCase());
    // Markdown łamie JEDNĄ odpowiedź modelu na dziesiątki linii ekranu, a psql
    // oddaje ją jako jeden rekord. Bez rozbicia na linie licznik policzył 333
    // słowa treści rozmowy jako „obcy język interfejsu" (zmierzone na PRZED).
    for (const linia of s.split(/\\n|\n/)) {
      const l = linia.trim();
      if (l.length >= 8) DANE.add(l.toLowerCase());
    }
  }
}

const DANE_LISTA = [...DANE];

/**
 * Normalizacja do porównania EKRAN ↔ BAZA.
 *
 * Zmierzone 08.09: ekran wątku dawał 320 „obcych słów interfejsu", a wszystkie
 * pochodziły z polskiej ODPOWIEDZI MODELU — czyli z danych (kategoria K6), nie
 * z interfejsu. Porównanie linia-w-linię nie działało, bo renderer markdown
 * zjada znaczniki listy, numerację i pogrubienia, więc linia na ekranie nigdy
 * nie jest znakowo równa linii w `conversation_messages.content`.
 * Zdejmujemy więc wszystko, co dokłada markdown, i sklejamy białe znaki.
 */
const norm = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[*_`#>]/g, ' ')
    .replace(/^\s*(?:[-•–]|\d+[.)])\s*/gm, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Cała treść rozmów jako JEDEN znormalizowany korpus — po nim szukamy linii ekranu. */
const KORPUS = norm(DANE_LISTA.join(' \n '));

/**
 * Linia pochodzi z DANYCH (nie z interfejsu), gdy pokrywa się z wartością
 * z bazy albo siedzi w korpusie treści rozmów. Tytuły na liście bywają ucięte
 * wielokropkiem, więc porównujemy też prefiks.
 */
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
  'nowy','nowa','nowe','zapisz','utwórz','utworz','zamknij','wybierz','sprawdź','sprawdz',
  'pokaż','pokaz','dodaj','usuń','usun','anuluj','zapisano','otwórz','otworz','więcej','wiecej',
  'mniej','ponownie','spróbuj','sprobuj','ładowanie','ladowanie','edytuj','przywróć','przywroc',
  'odrzuć','odrzuc','zatwierdź','zatwierdz','wyślij','wyslij','przenieś','przenies','zmień','zmien',
  'rozmowa','rozmowy','rozmów','rozmow','wiadomość','wiadomosc','wiadomości','wiadomosci',
  'arkusz','arkusza','arkusze','arkuszy','skoroszyt','skoroszytu','prezentacja','prezentacji',
  'historia','historii','wersja','wersji','wersje','ocena','oceny','opinia','opinii',
  'narzędzia','narzedzia','narzędzie','narzedzie','projekt','projektu','projekty','projektów',
  'przypięte','przypiete','tydzień','tydzien','miesiąc','miesiac','dzisiaj','wczoraj',
  'sty','lut','mar','kwi','maj','cze','lip','sie','wrz','paź','paz','lis','gru',
  'jakość','jakosc','właściwości','wlasciwosci','źródła','zrodla','powiązania','powiazania',
  'komórkę','komorke','klocek','krok','kroku','poziom','pusta','pusty','puste','treść','tresc',
]);
const EN_SLOWA = new Set([
  'the','and','for','with','from','all','new','close','save','create','delete','edit','open',
  'conversation','conversations','message','messages','sheet','sheets','workbook','presentation',
  'history','version','versions','rating','feedback','tools','tool','project','projects',
  'pinned','week','month','today','yesterday','quality','properties','sources','relations',
  'cell','block','step','level','empty','content','retry','cancel','approve','reject','dismiss',
  'send','move','rename','restore','loading','more','less','select','none','of','as','no','yes',
  'add','review','draft','done','pending','failed','error',
  // Miesiące po angielsku BEZ 'jan' i 'mar': „Jan" to polskie imię, a „mar" to
  // polski skrót marca — oba dawały fałszywe trafienia w PL (lekcja z J7b).
  'feb','apr','jun','jul','aug','sep','oct','nov','dec',
]);
/**
 * Słowa IDENTYCZNE w obu językach albo nazwy własne — nie są dowodem obcego
 * języka w żadną stronę.
 */
const NEUTRALNE = new Set([
  'status','kpi','ai','ok','teresa','consultify','dbr','studio','chat','auto','model','data',
  'canvas','deck','builder','excel','pdf','csv','api','url','id','sla','roi','pmo','raid',
  'audyt','lokalny','local','output','co','thinker','help','center',
]);

function liniePodejrzane(text, lang) {
  const wynik = { ui: [], dane: [] };
  for (const raw of text.split('\n')) {
    const linia = raw.trim();
    if (!linia) continue;
    const czysty = linia.replace(/https?:\/\/\S+/g, ' ');
    const slowa = czysty.split(/[^A-Za-zĄąĆćĘęŁłŃńÓóŚśŹźŻż]+/).filter(Boolean);
    const trafienia = [];
    if (lang === 'en') {
      for (const w of slowa) {
        const l = w.toLowerCase();
        if (NEUTRALNE.has(l)) continue;
        if (DIAKRYTYKI.test(w) || PL_SLOWA.has(l)) trafienia.push(w);
      }
    } else {
      if (DIAKRYTYKI.test(czysty)) continue; // linia z polskimi znakami = polska
      for (const w of slowa) {
        const l = w.toLowerCase();
        if (NEUTRALNE.has(l)) continue;
        if (EN_SLOWA.has(l)) trafienia.push(w);
      }
    }
    if (!trafienia.length) continue;
    const jestDanymi = czyDane(linia);
    (jestDanymi ? wynik.dane : wynik.ui).push({ linia, trafienia: [...new Set(trafienia)] });
  }
  return wynik;
}

/**
 * W jakim języku NAPRAWDĘ stoi powłoka.
 *
 * Zmierzone 08.09, dwa razy pod rząd: zrzut oznaczony „-en" pokazywał POLSKI
 * interfejs mimo `users.language='en'`. Pierwsza wersja tej sondy czytała
 * `document.title` — i SKŁAMAŁA: tytuł potrafi zostać z etykiety trasy
 * („AI Chat") przy polskim wnętrzu. Sonda czyta więc napisy, które renderuje
 * SAM PRODUKT: pole wpisu i pasek akcji czatu.
 */
async function jezykPowloki(p) {
  const tekst = await p.evaluate(() => {
    const ph = document.querySelector('textarea')?.getAttribute('placeholder') || '';
    return `${ph} ${document.body.innerText.slice(0, 1500)}`;
  });
  const pl = /Zapytaj Teres|Rozmawiaj głosem|Nowa rozmowa|Współmyśliciel|Wybierz tryb/i.test(tekst);
  const en = /Ask Teresa|Start by voice|New conversation|Co-Thinker|Choose a mode/i.test(tekst);
  if (pl && !en) return 'pl';
  if (en && !pl) return 'en';
  return null;
}

async function zrzut(p, nazwa, lang) {
  await p.waitForTimeout(2000);
  let wykryty = await jezykPowloki(p);
  if (wykryty && wykryty !== lang) {
    console.log(`  ! powłoka w języku ${wykryty}, oczekiwano ${lang} — przeładowuję`);
    await p.reload({ waitUntil: 'networkidle' });
    await p.waitForTimeout(2500);
    wykryty = await jezykPowloki(p);
  }
  const text = await p.evaluate(() => document.body.innerText);
  const plik = path.join(OUT, `${nazwa}-${lang}.png`);
  await p.screenshot({ path: plik });
  const w = liniePodejrzane(text, lang);
  const meta = {
    ekran: nazwa,
    jezyk: lang,
    url: p.url(),
    jezykPowloki: wykryty,
    zgodnyJezyk: wykryty === null ? null : wykryty === lang,
    obcychSlowUI: w.ui.reduce((a, x) => a + x.trafienia.length, 0),
    obcychLiniiUI: w.ui.length,
    ui: w.ui,
    dane: w.dane.slice(0, 40),
  };
  fs.writeFileSync(`${plik}.json`, JSON.stringify(meta, null, 1));
  console.log(
    `${nazwa}-${lang}: obce slowa UI=${meta.obcychSlowUI} (linii ${meta.obcychLiniiUI}), DANE=${w.dane.length}`
  );
  return meta;
}

const re = (pl, en) => new RegExp(`^\\s*(${pl}|${en})\\s*$`, 'i');

async function klik(p, locator, opis) {
  try {
    const el = locator.first();
    await el.waitFor({ state: 'visible', timeout: 6000 });
    await el.click({ force: true });
    await p.waitForTimeout(1200);
    return true;
  } catch {
    console.log(`  ! nie kliknięto: ${opis}`);
    return false;
  }
}

const b = await chromium.launch();

/**
 * ŚWIEŻE LOGOWANIE NA KAŻDY JĘZYK — świadomie, zamiast przełączania w locie.
 *
 * Przełączanie języka na żywo (UPDATE users.language + localStorage + reload)
 * zmierzyłem 08.09 jako NIEWIARYGODNE: powłoka zostawała w poprzednim języku,
 * bo bootstrap czyta użytkownika odtworzonego z localStorage, a moduł Czatu ma
 * WŁASNY, lepki wybór języka (`chatLanguage`: `consultify-preferred-chat-lang`
 * + `chatLanguageByConversationId` w `consultify-conversations`), który
 * przeżywa przeładowanie. Nowy kontekst przeglądarki = pusty localStorage =
 * jedyne źródło języka to konto. Dowód nie może stać na przyrządzie, który
 * pokazuje inny język, niż deklaruje nazwa pliku.
 */
async function zalogujDlaJezyka(lang) {
  sql(`UPDATE users SET language='${lang}' WHERE email='audyt@dbr77.local'`);
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.evaluate((l) => localStorage.setItem('i18nextLng', l), lang);
  await page.locator('input[type="email"]').first().fill('audyt@dbr77.local');
  await page.locator('input[type="password"]').first().fill('AudytDBR77!2026');
  await page.locator('input[type="password"]').first().press('Enter');
  await page.waitForURL((u) => !String(u).includes('/login'), { timeout: 40000 });
  await page.waitForTimeout(2000);
  await page.evaluate(() => {
    const K = 'consultify-storage';
    const r = localStorage.getItem(K);
    const o = r ? JSON.parse(r) : { state: {}, version: 0 };
    o.state = { ...(o.state || {}), theme: 'light' };
    localStorage.setItem(K, JSON.stringify(o));
  });
  return { ctx, page };
}

let { ctx: c, page: p } = await zalogujDlaJezyka('en');

// Rozmowa z treścią — do ekranu wątku i oceny odpowiedzi.
const ROZMOWA = sql(
  "select c.id from conversations c join conversation_messages m on m.conversation_id = c.id " +
    "where c.user_id = 'audyt-dbr77-lokalny' group by c.id having count(m.id) > 1 " +
    'order by max(m.created_at) desc limit 1'
).split('\n')[0];

const idz = async (url) => {
  await p.goto(`${BASE}${url}`, { waitUntil: 'networkidle' }).catch(() => {});
  await p.waitForTimeout(2500);
};

const raport = [];
for (const lang of ['en', 'pl']) {
  if (lang !== 'en') {
    await c.close();
    ({ ctx: c, page: p } = await zalogujDlaJezyka(lang));
  }

  // 1. Czat — stan pusty (powitanie, wybór wyjścia, pole wpisu, podpowiedzi)
  await idz('/chat');
  raport.push(await zrzut(p, '01-czat-pusty', lang));

  // 2. Menu „Narzędzia AI" (Pracuj z AI) — ToolsMenu
  await klik(p, p.locator('[aria-label="AI tools"], [aria-label="Narzędzia AI"]'), 'Narzędzia AI');
  raport.push(await zrzut(p, '02-menu-narzedzia-ai', lang));
  await p.keyboard.press('Escape');

  // 3. Menu „Dodaj pliki" — CloudFilePicker wejście
  await idz('/chat');
  await klik(p, p.locator('[aria-label*="Dodaj pliki" i], [aria-label*="Add files" i]'), 'Dodaj pliki');
  raport.push(await zrzut(p, '03-dodaj-pliki', lang));
  await p.keyboard.press('Escape');

  // 4. Wybór trybu skupienia / źródeł (FocusModeSelector)
  await idz('/chat');
  await klik(p, p.locator('[aria-label="Co-Thinker"], [aria-label*="myśliciel" i]'), 'Co-Thinker');
  raport.push(await zrzut(p, '04-tryb-zrodel', lang));
  await p.keyboard.press('Escape');

  // 5. Lista wątków (historia rozmów)
  await idz('/chat');
  await klik(p, p.locator('[aria-label*="Historia" i], [aria-label*="History" i]'), 'Historia');
  raport.push(await zrzut(p, '05-lista-watkow', lang));

  // 6. Kebab wątku — akcje rozmowy (zmiana nazwy, projekt, usunięcie)
  const wierszRozmowy = p.locator('[data-testid*="conversation"], aside a, aside li').first();
  await wierszRozmowy.hover().catch(() => {});
  await p.waitForTimeout(600);
  await klik(
    p,
    p.locator(
      '[aria-label*="akcje" i], [aria-label*="actions" i], [aria-label*="Więcej" i], [aria-label*="More" i], [aria-label*="options" i]'
    ),
    'kebab wątku'
  );
  raport.push(await zrzut(p, '06-kebab-watku', lang));
  await p.keyboard.press('Escape');

  // 7. Wątek z wiadomościami
  if (ROZMOWA) {
    await idz(`/chat/${ROZMOWA}`);
    raport.push(await zrzut(p, '07-watek', lang));

    // 8. Ocena odpowiedzi (InlineResponseFeedback — 19 polskich defaultów)
    await klik(
      p,
      p.locator('[aria-label*="ocen" i], [aria-label*="rate" i], [aria-label*="feedback" i], [aria-label*="opini" i]'),
      'ocena odpowiedzi'
    );
    raport.push(await zrzut(p, '08-ocena-odpowiedzi', lang));
    await p.keyboard.press('Escape');
  }

  // 9. Panel pracy / artefaktów (Canvas)
  await idz(`/chat${ROZMOWA ? '/' + ROZMOWA : ''}`);
  await klik(p, p.locator('[aria-label="Open work panel"], [aria-label*="panel pracy" i]'), 'panel pracy');
  raport.push(await zrzut(p, '09-panel-artefaktow', lang));

  // 10. Arkusz (Excele) — prawy panel/rail: 34 polskie defaulty
  await idz('/excele');
  raport.push(await zrzut(p, '10-arkusz', lang));

  // 11. Arkusz — prawy panel szczegółów
  await klik(
    p,
    p.locator('[aria-label="Sources and assumptions"], [aria-label="Źródła i założenia"]'),
    'arkusz — zakładka Źródła'
  );
  raport.push(await zrzut(p, '11-arkusz-zrodla', lang));

  // 12. Prezentacje — wybór trybu startu
  await idz('/prezentacje');
  raport.push(await zrzut(p, '12-prezentacje', lang));

  // 13. Kokpit AI OS — Action Center (angielski hardcode K4en)
  await idz('/ai-os/action-center');
  raport.push(await zrzut(p, '13-action-center', lang));

  // 14. Sesje badawcze (ResearchSessionsDock — 7 trafień K4en)
  await idz('/ai-os/research');
  raport.push(await zrzut(p, '14-sesje-badawcze', lang));
}

fs.writeFileSync(path.join(OUT, 'raport.json'), JSON.stringify(raport, null, 1));
const sumaEn = raport.filter((r) => r.jezyk === 'en').reduce((a, r) => a + r.obcychSlowUI, 0);
const sumaPl = raport.filter((r) => r.jezyk === 'pl').reduce((a, r) => a + r.obcychSlowUI, 0);
console.log(`\nRAZEM obce slowa UI: EN=${sumaEn} PL=${sumaPl} (ekranow ${raport.length})`);
await b.close();
