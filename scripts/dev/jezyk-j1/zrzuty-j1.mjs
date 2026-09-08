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
    if (s) DANE.add(s.toLowerCase());
  }
}

const DANE_LISTA = [...DANE];
/**
 * Linia pochodzi z DANYCH (nie z interfejsu), gdy pokrywa się z wartością
 * z bazy. Tytuły rozmów na liście bywają ucięte wielokropkiem, więc
 * porównujemy też prefiks.
 */
function czyDane(linia) {
  const l = linia.toLowerCase().trim();
  if (!l) return false;
  if (DANE.has(l)) return true;
  const ucieta = l.replace(/(\.\.\.|…)$/, '').trim();
  if (ucieta.length >= 8 && DANE_LISTA.some((d) => d.startsWith(ucieta))) return true;
  return DANE_LISTA.some((d) => d.length >= 12 && l.includes(d));
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

async function ustawJezyk(p, lang) {
  sql(`UPDATE users SET language='${lang}' WHERE email='audyt@dbr77.local'`);
  await p.evaluate((l) => localStorage.setItem('i18nextLng', l), lang);
}

async function zrzut(p, nazwa, lang) {
  await p.waitForTimeout(2000);
  const text = await p.evaluate(() => document.body.innerText);
  const plik = path.join(OUT, `${nazwa}-${lang}.png`);
  await p.screenshot({ path: plik });
  const w = liniePodejrzane(text, lang);
  const meta = {
    ekran: nazwa,
    jezyk: lang,
    url: p.url(),
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
const c = await b.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
const p = await c.newPage();
await p.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(1500);
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
  await ustawJezyk(p, lang);

  // 1. Czat — stan pusty (powitanie, wybór wyjścia, pole wpisu, podpowiedzi)
  await idz('/chat');
  raport.push(await zrzut(p, '01-czat-pusty', lang));

  // 2. Menu „Narzędzia AI" (Pracuj z AI) — ToolsMenu
  await klik(p, p.locator('button[aria-label], button').filter({ hasText: re('Narzędzia AI', 'AI tools') }), 'Narzędzia AI');
  if (!(await p.locator('[role=menu], [role=dialog]').first().isVisible().catch(() => false))) {
    await klik(p, p.locator('[aria-label*="narzędzia" i], [aria-label*="AI tools" i]'), 'Narzędzia AI (aria)');
  }
  raport.push(await zrzut(p, '02-menu-narzedzia-ai', lang));
  await p.keyboard.press('Escape');

  // 3. Menu „Dodaj pliki" — CloudFilePicker wejście
  await idz('/chat');
  await klik(p, p.locator('[aria-label*="Dodaj pliki" i], [aria-label*="Add files" i]'), 'Dodaj pliki');
  raport.push(await zrzut(p, '03-dodaj-pliki', lang));
  await p.keyboard.press('Escape');

  // 4. Wybór trybu skupienia / źródeł (FocusModeSelector)
  await idz('/chat');
  await klik(p, p.locator('button').filter({ hasText: re('Współ-myśliciel|Co-Thinker', 'Co-Thinker') }), 'Co-Thinker');
  raport.push(await zrzut(p, '04-tryb-zrodel', lang));
  await p.keyboard.press('Escape');

  // 5. Lista wątków (historia rozmów)
  await idz('/chat');
  await klik(p, p.locator('[aria-label*="Historia" i], [aria-label*="History" i]'), 'Historia');
  raport.push(await zrzut(p, '05-lista-watkow', lang));

  // 6. Kebab wątku — akcje rozmowy (zmiana nazwy, projekt, usunięcie)
  await klik(
    p,
    p.locator('[aria-label*="akcje" i], [aria-label*="actions" i], [aria-label*="Więcej" i], [aria-label*="More" i]'),
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
  await klik(p, p.locator('[aria-label*="panel pracy" i], [aria-label*="work panel" i]'), 'panel pracy');
  raport.push(await zrzut(p, '09-panel-artefaktow', lang));

  // 10. Arkusz (Excele) — prawy panel/rail: 34 polskie defaulty
  await idz('/excele');
  raport.push(await zrzut(p, '10-arkusz', lang));

  // 11. Arkusz — prawy panel szczegółów
  await klik(
    p,
    p.locator('[aria-label*="Szczegóły arkusza" i], [aria-label*="Sheet details" i], [aria-label*="details" i]'),
    'prawy panel arkusza'
  );
  raport.push(await zrzut(p, '11-arkusz-prawy-panel', lang));

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
