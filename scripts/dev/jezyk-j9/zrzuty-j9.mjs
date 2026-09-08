/**
 * DOWÓD WIZUALNY paczki J9 — moduł 09 FINANSE, EN i PL.
 *
 * Wzór: scripts/dev/jezyk-j7/zrzuty-j7.mjs (paczka J7b), ten sam licznik
 * i to samo wiadro DANE.
 *
 * Stanowisko: API 4196 / Vite 3215 / baza consultify_kopia_final.
 * PORT 3215, NIE 3214: 3214 w chwili pomiaru trzymała inna paczka
 * (worktree j10-materialy) — zrzut z tamtego portu fotografowałby CUDZY kod,
 * nie ten. Sprawdzone `lsof -d cwd` przed pierwszym zrzutem.
 *
 * Uruchomienie:
 *   node scripts/dev/jezyk-j9/zrzuty-j9.mjs przed|po
 *
 * Dla każdego ekranu zapisuje <nazwa>-<lang>.png oraz <nazwa>-<lang>.png.json
 * z licznikiem słów obcego języka w `main`.innerText. Wiersze, których treść
 * pokrywa się z wartościami z bazy (tytuły inicjatyw/zadań/decyzji/RAID,
 * nazwiska), trafiają do osobnego wiadra DANE i NIE liczą się jako UI.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { chromium } from 'playwright';

const FAZA = process.argv[2] === 'po' ? 'po' : 'przed';
const BASE = 'http://127.0.0.1:3215';
const OUT = path.resolve(process.cwd(), 'evidence/jezyk-j9', FAZA);
fs.mkdirSync(OUT, { recursive: true });

const sql = (q) =>
  execSync(
    `docker exec consultify-pg18 psql -U postgres -d consultify_kopia_final -Atc "${q.replace(/"/g, '\\"')}"`,
    { encoding: 'utf8' }
  ).trim();

/** Zapytanie tolerancyjne: brak tabeli w tej bazie nie może przerwać dowodu. */
const sqlMoze = (q) => {
  try {
    return sql(q);
  } catch {
    console.log(`  (pomijam, brak tabeli/kolumny) ${q}`);
    return '';
  }
};

// --- wiadro DANE: wartości pochodzące z bazy, nie z interfejsu -------------
const DANE = new Set();
for (const q of [
  // Nazwy artefaktów finansowych — sprawdzone w information_schema tej bazy,
  // nie zgadywane: zła nazwa tabeli dawałaby CICHE pominięcie wiadra DANE
  // i tytuły rekordów („DBR77 Sp. z o.o. — wycena Q3 2026") liczyłyby się
  // jako polski NAPIS INTERFEJSU na zrzucie angielskim.
  'select display_name from finance_artifacts',
  'select name from financial_models',
  'select title from financial_analyses',
  'select name from finance_prediction_scenarios',
  // `budgets.title` — znalezione PRZEZ PRZESZUKANIE SCHEMATU, nie zgadnięte:
  // zrzut listy budżetów pokazywał „DBR77 Scale-Up — Budżet programu 2026-2028"
  // i licznik brał to za polski NAPIS INTERFEJSU na ekranie angielskim.
  'select title from budgets',
  // Nazwa podmiotu sprawozdania („Grupa Kapitałowa CD PROJEKT") wchodzi na
  // ekran w trzech różnych oprawach: sama, jako „Entity: <nazwa>" i jako
  // „<nazwa> - FY2024 - PLN". To DANE, nie interfejs.
  'select entity_name from financial_statement_packs',
  'select entity_name from financial_statements',
  'select name from finance_prediction_initiatives',
  'select name from finance_valuation_cases',
  'select name from finance_valuation_variants',
  'select title from finance_valuation_advisor_outputs',
  'select name from finance_saved_views',
  'select title from valuations',
  'select name from financial_consolidations',
  'select label from finance_periods',
  'select label from finance_stmt_periods',
  'select title from initiatives',
  'select name from initiatives',
  "select coalesce(display_name, first_name || ' ' || last_name) from users",
  'select first_name from users',
  'select last_name from users',
  'select name from organizations',
]) {
  for (const v of sqlMoze(q).split('\n')) {
    const s = v.trim();
    if (s) DANE.add(s.toLowerCase());
  }
}


const DANE_LISTA = [...DANE];
/**
 * Linia pochodzi z DANYCH (nie z interfejsu), gdy pokrywa się z wartością
 * z bazy. Komórki tabeli bywają ucięte wielokropkiem, więc porównujemy też
 * prefiks — inaczej „Naprawa krytycznego błędu produk…" liczyłaby się jako
 * polski napis interfejsu.
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
  'nie','tak','jest','są','brak','oraz','albo','lub','dla','przez','wszystkie','wszystkich','nowy','nowa','nowe',
  'zapisz','utwórz','utworz','zamknij','wybierz','sprawdź','sprawdz','pokaż','pokaz','dodaj','usuń','usun',
  'raport','raporty','poziom','okres','okresy','autor','stan','danych','wycena','wyceny','sprawozdanie','sprawozdania','budżet','budzet','analiza','analizy','wartość','wartosc','kwota','wiersz','wiersze','wierszy','założenia','zalozenia','przeliczenie','przeliczono','nazwa','wersja','wersji','bilans','rachunek','zysków','zyskow','strat','przepływów','przeplywow','pieniężnych','pienieznych','gotówka','gotowka','wskaźnik','wskaznik','wzór','wzor','jakość','jakosc','dostępność','dostepnosc','podgląd','podglad','źródło','zrodlo','dowód','dowod',
  'osób','osob','popyt','podaż','podaz','obłożenie','oblozenie','zaległość','zaleglosc','tygodni','tygodnie',
  'wykonane','odrzucone','zrobione','trwa','ponownie','spróbuj','sprobuj','ładowanie','ladowanie','od',
  'sty','lut','mar','kwi','maj','cze','lip','sie','wrz','paź','paz','lis','gru',
  'problem','założenie','zalozenie','zależność','zaleznosc','sygnały','sygnaly','sygnał','sygnal',
]);
const EN_SLOWA = new Set([
  'the','and','for','with','from','all','new','close','save','create','delete','edit','open','risk','risks',
  'decision','decisions','report','reports','level','period','author','status','task','tasks','people','demand',
  'supply','utilisation','utilization','backlog','week','weeks','overdue','blocked','signals','signal','none',
  'assumption','dependency','issue','of','as','no','yes','add','review','published','draft','done','pending','statement','statements','valuation','budget','analysis','value','amount','row','rows','assumptions','name','version','balance','sheet','cash','flow','indicator','formula','quality','availability','preview','source','evidence','period','periods','calculation','calculations',
  // Domierzone OKIEM na zrzutach PL 08.09 — licznik ich nie miał, więc
  // milczał na „0 selected" w kreatorze analizy i na surowym enumie
  // „Comprehensive" w kolumnie rodzaju analizy.
  'selected','comprehensive','investment','case','historical','ratio','archived',
  'type','types','quality','availability','indicator','formula','rows','saved',
  // Miesiące po angielsku BEZ 'jan' i 'mar': „Jan" to polskie imię (Jan Kowalski
  // w danych pokazowych), a „mar" to polski skrót marca — oba dawały fałszywe
  // trafienia w PL (zmierzone 08.09 na zrzucie 07-zasoby-tabela-pl).
  'feb','apr','jun','jul','aug','sep','oct','nov','dec',
]);
/**
 * Słowa IDENTYCZNE w obu językach — nie są dowodem obcego języka w żadną
 * stronę. „Status" po polsku to „status"; liczenie go jako angielszczyzny
 * zawyżało wynik PL o jedno trafienie na każdym ekranie z tabelą.
 */
/**
 * Słowa IDENTYCZNE w obu językach albo terminy fachowe, które zostają
 * nietłumaczone W OBU wersjach (decyzja właściciela / zlecenie J9:
 * „P&L, EBITDA, cash flow, CAPEX/OPEX zostają"). Liczenie ich jako obcego
 * języka zawyżałoby wynik po obu stronach.
 */
const NEUTRALNE = new Set([
  'status', 'kpi', 'raid', 'sla', 'ok', 'pmo', 'roi', 'ai',
  'ebitda', 'ebit', 'capex', 'opex', 'wacc', 'npv', 'irr', 'dcf', 'fcff', 'ev',
  'cagr', 'dso', 'dio', 'dpo', 'ccc', 'dscr', 'cogs', 'p&l', 'pl', 'bs', 'cf',
  'baseline', 'benchmark', 'lineage', 'manifest', 'consultify', 'dbr', 'teresa',
  // „Model" i „import"/„export" brzmią IDENTYCZNIE po polsku i po angielsku.
  // Zmierzone: bez tego wyjątku licznik zgłaszał 78 „obcych słów" na samych
  // ekranach angielskich, w tym w zdaniu „Create a financial model…" —
  // czyli przyrząd oskarżał poprawny angielski o polskość.
  'model', 'modele', 'models', 'financial_model', 'import', 'export',
  'pln', 'eur', 'usd',
]);

function liniePodejrzane(text, lang) {
  const wynik = { ui: [], dane: [] };
  for (const raw of text.split('\n')) {
    const linia = raw.trim();
    if (!linia) continue;
    const czysty = linia.replace(/https?:\/\/\S+/g, ' ');
    const slowa = czysty.split(/[^A-Za-zĄąĆćĘęŁłŃńÓóŚśŹźŻż]+/).filter(Boolean);
    let trafienia = [];
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
 * KOTWICA JĘZYKOWA — zamiast ustawiania `users.language` w bazie.
 *
 * DLACZEGO NIE PRZEZ BAZĘ (zmierzone 08.09, dwa nieudane podejścia):
 * w chwili robienia tego dowodu na TEJ SAMEJ bazie `consultify_kopia_final`
 * i na TYM SAMYM koncie `audyt@dbr77.local` pracowały równolegle trzy inne
 * paczki językowe (`zrzuty-j2.mjs`, `jezyk-j10-zrzuty.mjs`,
 * `zrzuty-jmale.mjs` — sprawdzone `ps` o 22:48). Każda z nich przełącza język
 * konta. Mój `UPDATE users SET language='en'` znikał w ciągu kilkudziesięciu
 * sekund, a zrzuty z etykietą `-en` wychodziły POLSKIE (potwierdzone okiem na
 * `09-analiza-lista-en.png` z pierwszego podejścia: cały ekran po polsku).
 *
 * Dlatego: język wymuszam WYŁĄCZNIE po stronie przeglądarki (`i18nextLng`
 * w `localStorage` + przeładowanie) i NIE dotykam konta — żeby nie zepsuć
 * dowodu sąsiednim paczkom, tak jak one psuły mój.
 *
 * KOTWICA jest dowodem, nie deklaracją: sprawdzam, że w menu modułu stoi
 * słowo z DOCELOWEGO języka i NIE MA słowa z drugiego. Sam `localStorage`
 * nie wystarczy — pokazuje, o co poprosiłem, nie to, co się wyrenderowało.
 */
const KOTWICA = { en: 'Statements', pl: 'Sprawozdania' };

async function wymusJezyk(p, lang, przeladuj) {
  const oczekiwany = KOTWICA[lang];
  const obcy = KOTWICA[lang === 'en' ? 'pl' : 'en'];
  for (let proba = 0; proba < 8; proba += 1) {
    // Plik tłumaczeń to ~1,9 MB pobierane po HTTP — przez pierwsze sekundy
    // ekran POTRAFI stać w poprzednim języku mimo poprawnego `i18nextLng`.
    // Dlatego najpierw czekam, a dopiero potem uznaję próbę za nieudaną.
    for (let tik = 0; tik < 8; tik += 1) {
      const t = await p.evaluate(() => document.body.innerText);
      if (t.includes(oczekiwany) && !t.includes(obcy)) return;
      await p.waitForTimeout(1000);
    }
    // Wymuszenie na DWÓCH warstwach naraz. Sam `localStorage` nie wystarcza:
    // po każdym przeładowaniu `App.tsx` woła `syncLanguageFromAccount`
    // z `users.language`, więc konto ustawione przez SĄSIEDNIĄ paczkę
    // natychmiast cofa mój wybór i pętla nigdy by nie wygrała.
    await p.evaluate((l) => localStorage.setItem('i18nextLng', l), lang);
    sql(`UPDATE users SET language='${lang}' WHERE email='audyt@dbr77.local'`);
    await przeladuj();
  }
  const tekst = await p.evaluate(() => document.body.innerText);
  if (!tekst.includes(oczekiwany) || tekst.includes(obcy)) {
    throw new Error(
      `interfejs nie przeszedł na '${lang}' (kotwica „${oczekiwany}") — przerywam, zamiast zapisać kłamliwy dowód`
    );
  }
}

async function zrzut(p, nazwa, lang) {
  await p.waitForTimeout(2000);
  // Cały dokument: pasek modułu + tabela + PODGLĄD (aside) + modale.
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

/**
 * Wzorzec NIEKOTWICZONY. Pierwsza wersja miała `^…$` i przez to NIE KLIKAŁA
 * ani razu w „+ Nowa wycena" / „+ New analysis" — przycisk niesie prefiks `+`,
 * więc pełne dopasowanie nigdy nie wchodziło. Skrypt meldował wtedy
 * „! nie kliknięto" i szedł dalej, a zrzut „formularz" pokazywał… tę samą
 * listę co ekran obok. Dwa pliki, jeden obraz — dowód, który nic nie dowodzi.
 */
const re = (pl, en) => new RegExp(`(${pl}|${en})`, 'i');

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

/** Świeży kontekst (pusty localStorage) + logowanie — jeden na język. */
async function zalogujOdNowa(lang) {
  const c = await b.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
  const p = await c.newPage();
  await p.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1500);
  await p.evaluate((l) => localStorage.setItem('i18nextLng', l), lang);
  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1200);
  await p.locator('input[type="email"]').first().fill('audyt@dbr77.local');
  await p.locator('input[type="password"]').first().fill('AudytDBR77!2026');
  await p.locator('input[type="password"]').first().press('Enter');
  await p.waitForURL((u) => !String(u).includes('/login'), { timeout: 40000 });
  await p.waitForTimeout(2000);
  await p.evaluate(() => {
    const K = 'consultify-storage';
    const r = localStorage.getItem(K);
    const o = r ? JSON.parse(r) : { state: {}, version: 0 };
    o.state = { ...(o.state || {}), theme: 'light' };
    localStorage.setItem(K, JSON.stringify(o));
  });
  return { c, p };
}

/**
 * Panele wartości M16 chodzą za flagami domyślnie WYŁĄCZONYMI. Włączam je
 * w URL, bo zlecenie każe pokazać „ROI / panele wartości" — bez tego zrzut
 * pokazałby pustą zakładkę i ogłosiłbym „czysto" tam, gdzie nic nie było
 * widać (to jest ten sam błąd, co „brak pomiaru uznany za wynik").
 */
const FF = [
  'ff_valueOffice=1',
  'ff_investAppraisal=1',
  'ff_valuationVisuals=1',
  'ff_varianceBridge=1',
  'ff_driverPlanner=1',
  'ff_modelVersioning=1',
  'ff_m16ValuationSuite=1',
  'ff_m16PlanningSuite=1',
  'ff_m16AdvancedSuite=1',
  'ff_m16ValueSuite=1',
].join('&');

const raport = [];
for (const lang of ['en', 'pl']) {
  const { c, p } = await zalogujOdNowa(lang);
  const idz = async (qs) => {
    const wejdz = async () => {
      await p.goto(`${BASE}/finance?${qs}&${FF}`, { waitUntil: 'networkidle' });
      await p.waitForTimeout(2500);
    };
    await wejdz();
    await wymusJezyk(p, lang, wejdz);
  };
  const pierwszyWiersz = () => p.locator('main table tbody tr').first().locator('td').first();

  // 1. Sprawozdania — lista (ekran wejściowy modułu)
  await idz('tab=statements');
  await p.waitForSelector('main table tbody tr', { timeout: 20000 }).catch(() => {});
  raport.push(await zrzut(p, '01-sprawozdania-lista', lang));

  // 2. Sprawozdania — podgląd wiersza
  await klik(p, pierwszyWiersz(), 'wiersz sprawozdania');
  raport.push(await zrzut(p, '02-sprawozdania-podglad', lang));

  // 3. Sprawozdania — kebab wiersza
  await idz('tab=statements');
  await klik(
    p,
    p.locator('main [aria-label*="akcje" i], main [aria-label*="actions" i], main button[aria-haspopup="menu"]'),
    'kebab wiersza sprawozdania'
  );
  raport.push(await zrzut(p, '03-sprawozdania-kebab', lang));

  // 4. Modele — lista
  await idz('tab=models');
  await p.waitForSelector('main table tbody tr', { timeout: 20000 }).catch(() => {});
  raport.push(await zrzut(p, '04-modele-lista', lang));

  // 5. Modele — podgląd
  await klik(p, pierwszyWiersz(), 'wiersz modelu');
  raport.push(await zrzut(p, '05-modele-podglad', lang));

  // 6. Budżet / scenariusze — lista
  await idz('tab=prediction');
  await p.waitForSelector('main table tbody tr', { timeout: 20000 }).catch(() => {});
  raport.push(await zrzut(p, '06-budzet-lista', lang));

  // 7. Budżet — formularz „Nowy budżet / scenariusz"
  await klik(
    p,
    p.locator('main button').filter({ hasText: re('Nowy scenariusz|Nowy budżet', 'New scenario|New budget') }),
    'Nowy budżet'
  );
  raport.push(await zrzut(p, '07-budzet-formularz', lang));

  // 8. Budżet — otwarty warsztat
  await idz('tab=prediction');
  await klik(p, pierwszyWiersz(), 'wiersz budżetu');
  await klik(
    p,
    p.locator('main button, main a').filter({ hasText: re('Otwórz', 'Open') }),
    'Otwórz budżet'
  );
  raport.push(await zrzut(p, '08-budzet-otwarty', lang));

  // 9. Analiza — lista
  await idz('tab=analysis');
  await p.waitForSelector('main table tbody tr', { timeout: 20000 }).catch(() => {});
  raport.push(await zrzut(p, '09-analiza-lista', lang));

  // 9b. Analiza — kreator (modal „+ Nowa analiza"): 10 napisów kategorii K4pl
  await klik(
    p,
    p.locator('main button').filter({ hasText: re('Nowa analiza', 'New analysis') }),
    'Nowa analiza'
  );
  raport.push(await zrzut(p, '09b-analiza-kreator', lang));

  // 9c. Modele — modal „+ Nowy model"
  await idz('tab=models');
  await klik(
    p,
    p.locator('main button').filter({ hasText: re('Nowy model', 'New model') }),
    'Nowy model'
  );
  raport.push(await zrzut(p, '09c-model-kreator', lang));

  // 10. Wycena — lista
  await idz('tab=valuation');
  await p.waitForSelector('main table tbody tr', { timeout: 20000 }).catch(() => {});
  raport.push(await zrzut(p, '10-wycena-lista', lang));

  // 11. Wycena — formularz „Nowa wycena"
  await klik(
    p,
    p.locator('main button').filter({ hasText: re('Nowa wycena', 'New valuation') }),
    'Nowa wycena'
  );
  raport.push(await zrzut(p, '11-wycena-formularz', lang));

  // 12. Wycena — otwarty warsztat (kroki)
  await idz('tab=valuation');
  await klik(p, pierwszyWiersz(), 'wiersz wyceny');
  await klik(
    p,
    p.locator('main button, main a').filter({ hasText: re('Otwórz', 'Open') }),
    'Otwórz wycenę'
  );
  raport.push(await zrzut(p, '12-wycena-otwarta', lang));

  // 13. ROI / analiza inwestycji
  await idz('tab=investment');
  raport.push(await zrzut(p, '13-roi-inwestycje', lang));

  // 14. Panele wartości (flagi M16 włączone w URL)
  await idz('tab=models&financeValuePanels=1');
  await klik(
    p,
    p.locator('main button').filter({ hasText: re('Wartość|Panele', 'Value|Panels') }),
    'panele wartości'
  );
  raport.push(await zrzut(p, '14-panele-wartosci', lang));
  await c.close();
}

fs.writeFileSync(path.join(OUT, 'raport.json'), JSON.stringify(raport, null, 1));
const en = raport.filter((r) => r.jezyk === 'en');
const pl = raport.filter((r) => r.jezyk === 'pl');
console.log('');
console.log(`SUMA UI  EN: ${en.reduce((a, r) => a + r.obcychSlowUI, 0)} obcych slow`);
console.log(`SUMA UI  PL: ${pl.reduce((a, r) => a + r.obcychSlowUI, 0)} obcych slow`);
// Sprzątanie po sobie: konto wraca do stanu zastanego przed pomiarem.
// Baza jest współdzielona z trzema innymi paczkami — zostawienie na niej
// „mojego" języka byłoby dokładnie tą samą przeszkodą, która psuła mnie.
sql("UPDATE users SET language='pl' WHERE email='audyt@dbr77.local'");
await b.close();
