/**
 * SERWER ODBIORU GRAFIKI — właściciel klika w przeglądarce, decyzje lądują na dysku.
 *
 * POWÓD ISTNIENIA (2026-08-30): strona `odbior-grafika.html` była tylko spisem —
 * właściciel mógł ją przeczytać, ale nie mógł nią NICZEGO rozstrzygnąć. Odbiór
 * wracał do rozmowy, a rozmowa nie jest rejestrem. Tu każde kliknięcie zapisuje
 * się natychmiast do `docs/program/grafika/ODBIOR_DECYZJE.json` i przeżywa
 * zamknięcie przeglądarki.
 *
 * Zero zależności — czysty `node:http`. Uruchomienie:
 *   node scripts/dev/odbior-serwer.mjs            (port 3030)
 *
 * NAPRAWA (2026-09-01): pole uwagi zapisywało do `historia` PRZY KAŻDYM
 * NACIŚNIĘCIU KLAWISZA — jedna uwaga „dalej jest problem" trafiła do bazy
 * w 11 rosnących wersjach, jeden ekran miał 18 wpisów jednego dnia. Log
 * historii miał być trwałym zapisem KOLEJNYCH decyzji właściciela, a stał
 * się zrzutem klatka-po-klatce jego pisania — nieczytelnym i rosnącym bez
 * potrzeby. Teraz front wysyła uwagę dopiero po ~800 ms ciszy od ostatniego
 * znaku (plus natychmiast przy opuszczeniu pola i przy zamknięciu karty —
 * właściciel nie może stracić uwagi, bo `decyzje` aktualizuje się od razu),
 * a serwer ma dodatkową siatkę bezpieczeństwa: jeśli kolejny zapis dla tego
 * samego ekranu przychodzi krótko po poprzednim i jest jego PRZEDŁUŻENIEM,
 * dopisuje się do OSTATNIEGO wiersza historii zamiast tworzyć nowy.
 */
import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PORT = Number(process.env.PORT_ODBIOR || 3030);
const HARNESS = process.env.HARNESS || 'http://127.0.0.1:3020';
const STATUS = path.join(ROOT, 'docs/program/grafika/status.json');
const DECYZJE = path.join(ROOT, 'docs/program/grafika/ODBIOR_DECYZJE.json');
const BAZA = path.join(ROOT, 'docs/program/grafika/odbior.sqlite');
/**
 * RESZTA ODBIORU (2026-09-02). Właściciel przekliknął wszystkie 253 karty A/B —
 * ani jedna nie została bez decyzji. To, co zostaje, to karty do PONOWNEGO
 * spojrzenia: albo poprosił o poprawkę, albo obraz, na który patrzył, nie
 * pokazywał produktu (reguła 17). Bez tego pliku strona wystawiałaby mu 253
 * karty od nowa i utopiłaby te 22, które naprawdę czekają.
 * Opis pomiaru: docs/program/grafika/RESZTA_ODBIORU_20260902.md
 */
const RESZTA = path.join(ROOT, 'docs/program/grafika/reszta-odbioru.json');
/**
 * POPROSZONY PRZEGLĄD (2026-09-02). Właściciel przyjął partię „poprawione dziś"
 * zbiorczo, ale SZEŚĆ ekranów poprosił, żeby obejrzeć osobiście — po jednym
 * z każdego RODZAJU tabeli. Powód jest merytoryczny, nie kaprys: dzisiejsza
 * naprawa szerokości kolumn dotyka KAŻDEJ tabeli w aplikacji, więc ryzyko
 * regresji układu jest realne, a on wyłapie ją szybciej niż my.
 *
 * Ta lista ma PIERWSZEŃSTWO przed wszystkimi innymi filtrami przy starcie
 * strony — dopóki nie jest pusta, właściciel wchodzi prosto na te sześć kart
 * i widzi przy każdej JEDNO ZDANIE, czego ma szukać. Brak pliku = brak filtra,
 * nie awaria strony (tak samo jak RESZTA wyżej).
 */
const POPROSZONE = path.join(ROOT, 'docs/program/grafika/poproszony-przeglad.json');
const ODBIOR_MODULOW = path.join(ROOT, 'docs/program/grafika/ODBIOR_MODULOW.json');
const EVID = path.join(ROOT, 'evidence/grafika');

import { czytajMape, korpus, naprawioneDzis, wstrzymane, nazwyEkranow, oknoDecyzji, kartaModulu, pozaOdbiorem, coDomyka } from './lib/kartyModulow.mjs';
import { STYL_MODULOW } from './lib/stylModulow.mjs';

/**
 * KOLEJNOŚĆ MODUŁÓW W WIDOKU — ustalona przez nadzorcę z rozliczenia korpusu uwag,
 * NIE alfabetyczna i nie po numerze. Najpierw to, co domyka samo przeniesienie
 * życzeń do kolejki, potem moduły z jedną otwartą sprawą, na końcu te z wieloma.
 * Powód: właściciel ma od wejścia zobaczyć kilka modułów gotowych do zamknięcia,
 * a nie ścianę „jeszcze nie".
 */
const KOLEJNOSC_MODULOW = [
  '12_AUDITS', '08_MEETINGS', '01_ORGANIZATION', '16_PARTNER',
  '06_EXECUTION', '14_ADMIN', '02_INTERVIEW', '03_TOOLS', '10_FINANCE', '05_INITIATIVES',
  '13_CHAT', '15_SETTINGS', '07_MY_WORK_AGENT', '04_ASSESSMENT', '11_MATERIALS', '09_RESULTS',
];

const esc = (s) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** Mapa id ekranu → { motyw → { faza → ścieżka } }. Wolimy PO, bo to stan po naprawach. */
function indeksZrzutow() {
  const out = {};
  for (const dir of fs.readdirSync(EVID)) {
    const full = path.join(EVID, dir);
    if (!fs.statSync(full).isDirectory()) continue;
    for (const f of fs.readdirSync(full)) {
      if (!f.endsWith('.png')) continue;
      // Nazwa kanoniczna: <ekran>__<FAZA>__<motyw>.png. Pliki spoza tego wzorca
      // (ręczne zrzuty interakcji, np. `PO__kebab-wiersza.png`) POMIJAMY — wcześniej
      // wywracały cały serwer na `undefined.replace`, czyli jeden plik z ręki
      // zabijał odbiór dla właściciela. Cisza po stronie serwera jest tu gorsza
      // niż brak zrzutu.
      const czesci = f.split('__');
      if (czesci.length < 3) continue;
      const [id, faza, motywPng] = czesci;
      const motyw = motywPng.replace('.png', '');
      const pelna = path.join(full, f);
      const mtime = fs.statSync(pelna).mtimeMs;
      out[id] ??= {};
      out[id][motyw] ??= {};
      const obecny = out[id][motyw][faza];
      // PUŁAPKA (2026-08-31, Z-20): katalogi `evidence/grafika/*` sortują się
      // TEKSTOWO, nie chronologicznie — „15-", „90-", „99-" idą alfabetycznie ZA
      // „144-"/„146-", bo porównanie jest po znakach, nie po liczbie. Poprzednia
      // wersja brała OSTATNI plik napotkany w kolejności `fs.readdirSync`, więc
      // stary zrzut (czasem sprzed napraw) przykrywał dzisiejszy na 120 z 229 kart.
      // Wygrywa teraz plik o NAJNOWSZYM `mtime`, niezależnie od kolejności katalogów.
      if (!obecny || mtime > obecny.mtime) {
        out[id][motyw][faza] = { sciezka: path.join(dir, f), mtime };
      }
    }
  }
  // Spłaszczamy do samych ścieżek — mtime był potrzebny tylko do wyboru zwycięzcy,
  // reszta kodu (wybierz PO/PRZED w karta()) oczekuje zwykłego stringa.
  for (const id of Object.keys(out)) {
    for (const motyw of Object.keys(out[id])) {
      for (const faza of Object.keys(out[id][motyw])) {
        out[id][motyw][faza] = out[id][motyw][faza].sciezka;
      }
    }
  }
  return out;
}

/**
 * BAZA — dlaczego SQLite, a nie plik JSON.
 *
 * Pierwsza wersja trzymała decyzje w jednym pliku JSON nadpisywanym w całości.
 * Serwer padł w trakcie pracy właściciela, dwie uwagi przepadły i NIKT tego nie
 * zauważył. Plik nadpisywany hurtem nie ma historii: jeśli zapis się nie uda albo
 * nadpisze go czyjś inny proces, poprzednia treść znika bez śladu.
 *
 * `node:sqlite` jest WBUDOWANY w Node 24 — zero zależności, a daje trzy rzeczy,
 * których plik nie da: zapis atomowy (albo cały, albo żaden), osobną tabelę
 * HISTORII (każde kliknięcie zostaje na zawsze, także zmiana zdania) i odczyt
 * niezależny od tego, czy serwer żyje.
 *
 * JSON zostaje — ale jako EKSPORT do czytania i do gita, nie jako źródło prawdy.
 */
const db = new DatabaseSync(BAZA);
db.exec(`
  CREATE TABLE IF NOT EXISTS decyzje (
    ekran   TEXT PRIMARY KEY,
    decyzja TEXT,
    uwaga   TEXT,
    kiedy   TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS poprawki (
    lp    INTEGER PRIMARY KEY AUTOINCREMENT,
    ekran TEXT NOT NULL,
    opis  TEXT NOT NULL,
    kiedy TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS historia (
    lp      INTEGER PRIMARY KEY AUTOINCREMENT,
    ekran   TEXT NOT NULL,
    decyzja TEXT,
    uwaga   TEXT,
    kiedy   TEXT NOT NULL
  );
  /*
   * ODBIÓR MODUŁOWY (2026-09-02). Właściciel domyka licznik zamkniętych modułów
   * jednym kliknięciem na moduł. Osobna tabela, nie kolumna w decyzje — moduł
   * to inna jednostka niż ekran i mieszanie ich w jednym worku wywróciłoby
   * wszystkie dotychczasowe liczniki na stronie ekranów.
   */
  CREATE TABLE IF NOT EXISTS decyzje_modulow (
    modul   TEXT PRIMARY KEY,
    decyzja TEXT,
    powod   TEXT,
    kiedy   TEXT NOT NULL
  );
`);

const czytajDecyzjeModulow = () => {
  const out = {};
  for (const w of db.prepare('SELECT modul, decyzja, powod, kiedy FROM decyzje_modulow').all()) {
    out[w.modul] = { decyzja: w.decyzja || undefined, powod: w.powod || undefined, kiedy: w.kiedy };
  }
  return out;
};

/**
 * Zapis decyzji modułowej + NATYCHMIASTOWY eksport do pliku w repo.
 * Baza jest w `.gitignore` — lokalna i ulotna. Plik JSON jest JEDYNĄ trwałą
 * kopią tych decyzji, więc eksport idzie po KAŻDYM zapisie, nie na koniec dnia.
 */
function zapiszDecyzjeModulu(modul, { decyzja, powod }) {
  const teraz = new Date().toISOString();
  const stare = db.prepare('SELECT modul, decyzja, powod FROM decyzje_modulow WHERE modul = ?').get(modul);
  if (stare) {
    db.prepare('UPDATE decyzje_modulow SET decyzja = ?, powod = ?, kiedy = ? WHERE modul = ?').run(
      decyzja !== undefined ? decyzja || null : (stare.decyzja ?? null),
      powod !== undefined ? powod || null : (stare.powod ?? null),
      teraz, modul
    );
  } else {
    db.prepare('INSERT INTO decyzje_modulow (modul, decyzja, powod, kiedy) VALUES (?, ?, ?, ?)').run(
      modul, decyzja || null, powod || null, teraz
    );
  }
  const wszystkie = czytajDecyzjeModulow();
  const zamk = Object.values(wszystkie).filter((x) => x.decyzja === 'zamykam').length;
  fs.writeFileSync(ODBIOR_MODULOW, JSON.stringify({
    _opis: 'Trwala kopia decyzji modulowych wlasciciela (baza sqlite jest lokalna i ulotna).',
    _wyeksportowano: teraz.slice(0, 19),
    _podsumowanie: { zamkniete: zamk, jeszcze_nie: Object.values(wszystkie).filter((x) => x.decyzja === 'jeszcze').length, z_szesnastu: 16 },
    decyzje: Object.entries(wszystkie).map(([m, x]) => ({ modul: m, ...x })),
  }, null, 1), 'utf8');
  return db.prepare('SELECT modul, decyzja, powod, kiedy FROM decyzje_modulow WHERE modul = ?').get(modul);
}

const czytajDecyzje = () => {
  const out = {};
  for (const w of db.prepare('SELECT ekran, decyzja, uwaga, kiedy FROM decyzje').all()) {
    out[w.ekran] = { decyzja: w.decyzja || undefined, uwaga: w.uwaga || undefined, kiedy: w.kiedy };
  }
  return out;
};

/** Zwraca zapisany wiersz — strona pokazuje właścicielowi TO, co naprawdę leży w bazie. */
function zapiszDecyzje(ekran, zmiana) {
  const teraz = new Date().toISOString();
  const stary = db.prepare('SELECT decyzja, uwaga FROM decyzje WHERE ekran = ?').get(ekran) || {};
  const decyzja = zmiana.decyzja !== undefined ? zmiana.decyzja : (stary.decyzja ?? null);
  const uwaga = zmiana.uwaga !== undefined ? zmiana.uwaga : (stary.uwaga ?? null);
  db.prepare(
    `INSERT INTO decyzje (ekran, decyzja, uwaga, kiedy) VALUES (?, ?, ?, ?)
     ON CONFLICT(ekran) DO UPDATE SET decyzja = excluded.decyzja, uwaga = excluded.uwaga, kiedy = excluded.kiedy`
  ).run(ekran, decyzja || null, uwaga || null, teraz);
  // SIATKA BEZPIECZEŃSTWA po stronie serwera: gdyby debounce po stronie
  // przeglądarki zawiódł (np. wysyłka przy zamknięciu karty), nie chcemy
  // znowu zasypać `historia` klatkami tej samej uwagi. Jeśli poprzedni wiersz
  // dla TEGO SAMEGO ekranu jest sprzed chwili i jego uwaga jest PREFIKSEM
  // nowej (czyli to dalej ten sam ciąg pisania, tylko dłuższy), NADPISUJEMY
  // go zamiast dokładać kolejny — jedna uwaga zostaje jednym wpisem.
  const PROG_KONTYNUACJI_MS = 5000;
  const ostatni = db
    .prepare('SELECT lp, decyzja, uwaga, kiedy FROM historia WHERE ekran = ? ORDER BY lp DESC LIMIT 1')
    .get(ekran);
  const toKontynuacja =
    ostatni &&
    (decyzja || null) === (ostatni.decyzja || null) &&
    typeof uwaga === 'string' &&
    typeof ostatni.uwaga === 'string' &&
    uwaga !== ostatni.uwaga &&
    uwaga.startsWith(ostatni.uwaga) &&
    Date.parse(teraz) - Date.parse(ostatni.kiedy) < PROG_KONTYNUACJI_MS;
  if (toKontynuacja) {
    db.prepare('UPDATE historia SET decyzja = ?, uwaga = ?, kiedy = ? WHERE lp = ?').run(
      decyzja || null,
      uwaga || null,
      teraz,
      ostatni.lp
    );
  } else {
    db.prepare('INSERT INTO historia (ekran, decyzja, uwaga, kiedy) VALUES (?, ?, ?, ?)').run(
      ekran,
      decyzja || null,
      uwaga || null,
      teraz
    );
  }
  // Eksport do czytania i do gita — po KAŻDYM zapisie, żeby plik nigdy nie był starszy niż baza.
  fs.writeFileSync(DECYZJE, JSON.stringify(czytajDecyzje(), null, 1), 'utf8');
  return db.prepare('SELECT ekran, decyzja, uwaga, kiedy FROM decyzje WHERE ekran = ?').get(ekran);
}

/** Ostatnia poprawka per ekran — to ona zapala zielony znacznik „obejrzyj ponownie". */
const czytajPoprawki = () => {
  const out = {};
  for (const w of db
    .prepare('SELECT ekran, opis, kiedy FROM poprawki ORDER BY lp')
    .all()) {
    out[w.ekran] = { opis: w.opis, kiedy: w.kiedy };
  }
  return out;
};

/**
 * Czy poprawka czeka na ponowne obejrzenie?
 * TAK, jeśli jest nowsza niż ostatnia decyzja właściciela o tym ekranie. Gdy
 * właściciel kliknie cokolwiek po poprawce, znacznik gaśnie sam — bo to znaczy,
 * że już ją zobaczył i się do niej odniósł.
 */
const czekaNaPonowne = (popr, dec) => !!popr && (!dec?.kiedy || popr.kiedy > dec.kiedy);

/**
 * WIDOK „Moduły" — 16 kart, po jednej na moduł, jedno kliknięcie na moduł.
 *
 * Wpięty 2026-09-02 na wyraźne polecenie: właściciel prosił o całość TERAZ,
 * więc widok wchodzi niekompletny i uzupełnia się w locie. Moduł, którego treści
 * jeszcze nie dopracowałem, ma jawny stan „przygotowuję" — właściciel widzi, że
 * nad nim pracuję, zamiast zgadywać, czemu karta jest uboga.
 */
function stronaModulow() {
  const mapa = czytajMape(ROOT).filter((m) => /^[0-9]/.test(m.kod));
  const ctx = { naprawione: naprawioneDzis(ROOT), wstrz: wstrzymane(ROOT), nazwy: nazwyEkranow(ROOT), kor: korpus(ROOT), poza: pozaOdbiorem(ROOT), domyka: coDomyka(ROOT) };
  const dec = czytajDecyzjeModulow();
  const wg = new Map(mapa.map((m) => [m.kod, m]));
  const uporzadkowane = [
    ...KOLEJNOSC_MODULOW.map((k) => wg.get(k)).filter(Boolean),
    ...mapa.filter((m) => !KOLEJNOSC_MODULOW.includes(m.kod)),
  ];
  const karty = uporzadkowane.map((m) =>
    kartaModulu(m, { ...ctx, okno: oknoDecyzji(ROOT, new Set(m.ekrany.map((e) => e.id))), decyzja: dec[m.kod] || {} })
  ).join('\n');
  const zamk = Object.values(dec).filter((x) => x.decyzja === 'zamykam').length;

  return `<!doctype html><html lang="pl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Odbiór modułowy — ${zamk} z 16 zamkniętych</title><style>${STYL_MODULOW}</style></head><body>
<div class="pasek"><h1>Odbiór modułowy</h1>
  <span class="lic"><b id="mlicz">${zamk}</b> z 16 zamkniętych</span>
  <span class="stan" id="mstan">gotowe</span>
  <a class="mb link" href="/" style="margin-left:auto">← wróć do odbioru ekranów</a></div>
<main class="mkarty">
<div class="mwstep">Jedna karta na moduł, jedno kliknięcie na moduł. To jest Twoje ostatnie przejście, nie kolejny przegląd ekranów.
Kolejność nie jest przypadkowa: <b>na górze stoją moduły, które domyka samo przeniesienie życzeń do kolejki</b>, na dole te z realną robotą.
Uwagi cytuję Twoimi słowami; przy każdej piszę, czy blokuje zamknięcie, czy nie.</div>
${karty}</main>
<script>
const stan = document.getElementById('mstan');
const pokaz = (t, dobrze = true) => { stan.textContent = t; stan.className = 'stan ' + (dobrze ? 'dobrze' : 'zle'); };
async function wyslij(modul, dane) {
  try {
    const r = await fetch('/decyzja-modulu', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ modul, ...dane }) });
    if (!r.ok) throw new Error(r.status);
    const w = await r.json();
    pokaz('zapisane ' + new Date().toLocaleTimeString('pl-PL'));
    const k = document.getElementById('m-' + modul);
    if (k) {
      const z = k.querySelector('.mzapis');
      if (z) z.textContent = w.kiedy ? 'w bazie: ' + (w.decyzja === 'zamykam' ? 'Zamykam moduł' : w.decyzja === 'jeszcze' ? 'Jeszcze nie' : 'bez decyzji') + ' · ' + new Date(w.kiedy).toLocaleString('pl-PL') : '';
      const p = k.querySelector('header .plom');
      if (p) { p.className = 'plom' + (w.decyzja === 'zamykam' ? ' zam' : w.decyzja === 'jeszcze' ? ' jesz' : ''); p.textContent = w.decyzja === 'zamykam' ? 'zamknięty' : w.decyzja === 'jeszcze' ? 'jeszcze nie' : 'czeka na Twoją decyzję'; }
    }
    document.getElementById('mlicz').textContent = document.querySelectorAll('.mk[data-stan=zamykam]').length;
  } catch (e) { pokaz('NIE ZAPISANO — powiedz mi o tym', false); }
}
document.addEventListener('click', (ev) => {
  const b = ev.target.closest('.mb[data-d]');
  if (!b) return;
  const k = b.closest('.mk');
  const nowa = k.dataset.stan === b.dataset.d ? '' : b.dataset.d;
  k.dataset.stan = nowa;
  k.querySelectorAll('.mb[data-d]').forEach((x) => x.classList.toggle('on', !!nowa && x.dataset.d === nowa));
  wyslij(b.dataset.m, { decyzja: nowa });
});
/* Powód zapisuje się sam po chwili bezczynności — właściciel nie ma nic zatwierdzać. */
document.querySelectorAll('.mpowod').forEach((u) => {
  let t; u.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => wyslij(u.dataset.m, { powod: u.value }), 700); });
});
</script></body></html>`;
}

function strona() {
  const status = JSON.parse(fs.readFileSync(STATUS, 'utf8'));
  const zrzuty = indeksZrzutow();
  const decyzje = czytajDecyzje();
  const poprawki = czytajPoprawki();
  // Brak pliku = brak filtra, nie awaria strony: odbiór ma działać także wtedy,
  // gdy lista reszty jeszcze nie powstała albo została świadomie usunięta.
  const reszta = fs.existsSync(RESZTA) ? (JSON.parse(fs.readFileSync(RESZTA, 'utf8')).ekrany || {}) : {};
  const poproszone = fs.existsSync(POPROSZONE) ? (JSON.parse(fs.readFileSync(POPROSZONE, 'utf8')).ekrany || {}) : {};

  const doOdbioru = [];
  const niepokazane = [];
  for (const m of status.moduly) {
    for (const e of m.ekrany) {
      (e.ocena === 'A' || e.ocena === 'B' ? doOdbioru : niepokazane).push({ ...e, modul: m.nazwa });
    }
  }

  const karta = (e) => {
    const z = zrzuty[e.id] || {};
    const wybierz = (motyw) => (z[motyw]?.PO || z[motyw]?.PRZED || '').replace(/\\/g, '/');
    const light = wybierz('light');
    const dark = wybierz('dark');
    const d = decyzje[e.id] || {};
    const popr = poprawki[e.id];
    const swieze = czekaNaPonowne(popr, d);
    // Znacznik czasu poprawki w adresie obrazka — bez tego przeglądarka pokazałaby
    // zrzut SPRZED naprawy i właściciel oceniłby nieaktualny obraz.
    const wersja = popr ? `?v=${encodeURIComponent(popr.kiedy)}` : '';
    const r = reszta[e.id];
    // Karta „czeka na budowę" nie jest do oceny: właściciel ma ją widzieć, ale
    // nie ma czego akceptować, bo gotowość nie zależy od wyglądu. Zamiast
    // przycisków dostaje jedno zdanie, co ją blokuje.
    const rKlik = r && r.klikalna;
    const pop = poproszone[e.id];
    const btn = (kod, etykieta) =>
      `<button class="b ${kod} ${d.decyzja === kod ? 'on' : ''}" data-id="${esc(e.id)}" data-d="${kod}">${etykieta}</button>`;
    return `<article class="k${pop ? ' poproszona' : ''}${swieze ? ' swieza' : ''}${rKlik ? ' reszta' : ''}${r && !rKlik ? ' czeka' : ''}" id="k-${esc(e.id)}" data-stan="${esc(d.decyzja || '')}" data-swieza="${swieze ? '1' : ''}" data-reszta="${rKlik ? '1' : ''}" data-czeka="${r && !rKlik ? '1' : ''}" data-poproszona="${pop ? '1' : ''}">
  <header>
    <h3>${esc(e.nazwa)}</h3>
    <span class="o o${esc(e.ocena)}">${esc(e.ocena)}</span>
  </header>
  ${r ? `<div class="dlaczego${rKlik ? '' : ' blok'}"><b>${esc(r.grupa)}</b><span>${esc(r.powod)}</span>${r.czeka ? `<span class="czeka-txt">${esc(r.czeka)}</span>` : ''}</div>` : ''}
  ${pop ? `<div class="prosba"><b>Poproszony przegląd — ${esc(pop.rodzaj)}</b><span>${esc(pop.czego_szukac)}</span></div>` : ''}
  <div class="popr-slot">${
    swieze
      ? `<div class="popr"><b>Poprawione — obejrzyj ponownie</b><span>${esc(popr.opis)}</span><time>${esc(new Date(popr.kiedy).toLocaleString('pl-PL'))}</time></div>`
      : ''
  }</div>
  ${e.gdzie ? `<p class="gdzie">${esc(e.gdzie)}</p>` : ''}
  ${
    e.warianty?.length
      ? `<p class="wariant">Ten sam komponent oglądasz też jako: ${e.warianty.map((x) => esc(x)).join(' · ')}</p>`
      : ''
  }
  <p class="co">${esc(e.co)}</p>
  ${e.naprawione?.length ? `<ul class="nap">${e.naprawione.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
  ${e.wyjatki?.length ? `<ul class="wyj">${e.wyjatki.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
  <div class="obrazy">
    ${light ? `<figure><figcaption>jasny</figcaption><a href="/png/${esc(light)}${wersja}" target="_blank"><img loading="lazy" src="/png/${esc(light)}${wersja}" alt=""></a></figure>` : ''}
    ${dark ? `<figure><figcaption>ciemny</figcaption><a href="/png/${esc(dark)}${wersja}" target="_blank"><img loading="lazy" src="/png/${esc(dark)}${wersja}" alt=""></a></figure>` : ''}
  </div>
  <div class="akcje">
    ${rKlik || !r ? `${btn('ok', 'Akceptuję')}${btn('poprawka', 'Do poprawki')}${btn('nie', 'Odrzucam')}` : '<span class="niedo">Nie oceniaj tej karty — czeka na budowę, nie na wygląd</span>'}
    <a class="zywo" href="${HARNESS}/?screen=${encodeURIComponent(e.id)}&lang=pl&theme=light" target="_blank">otwórz na żywo</a>
  </div>
  <input class="uw" data-id="${esc(e.id)}" placeholder="uwaga (opcjonalnie) — zapisuje się sama" value="${esc(d.uwaga || '')}">
  <div class="zapis ${d.kiedy ? 'jest' : ''}">${d.kiedy ? `w bazie: ${esc(d.decyzja ? { ok: 'Akceptuję', poprawka: 'Do poprawki', nie: 'Odrzucam' }[d.decyzja] : 'bez decyzji')}${d.uwaga ? ', z uwagą' : ''} · ${esc(new Date(d.kiedy).toLocaleString('pl-PL'))}` : ''}</div>
</article>`;
  };

  const moduly = [];
  for (const m of status.moduly) {
    const ekrany = m.ekrany.filter((e) => e.ocena === 'A' || e.ocena === 'B');
    if (!ekrany.length) continue;
    moduly.push(`<section class="m">
  <h2><span class="nr">${esc(m.katalog.split('-')[0])}</span> ${esc(m.nazwa)} <small>${ekrany.length}</small></h2>
  <p class="opis">${esc(m.opis)}</p>
  <div class="karty">${ekrany.map(karta).join('')}</div>
</section>`);
  }

  const nieTabela = niepokazane
    .map(
      (e) =>
        `<tr><td>${esc(e.nazwa)}</td><td><span class="o o${esc(e.ocena)}">${esc(e.ocena)}</span></td><td>${esc(e.co)}</td><td>${esc((e.wyjatki || []).join(' · '))}</td></tr>`
    )
    .join('');

  return `<!doctype html>
<html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Odbiór grafiki — klikasz, zapisuje się</title>
<style>
:root{--tlo:#f7f8fa;--karta:#fff;--tekst:#0f172a;--drugi:#475569;--kres:#e2e8f0;--ok:#15803d;--pop:#b45309;--nie:#9f1239;--nieb:#1d4ed8}
*{box-sizing:border-box}
body{margin:0;background:var(--tlo);color:var(--tekst);font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
.pasek{position:sticky;top:0;z-index:20;background:#fff;border-bottom:1px solid var(--kres);padding:12px 20px;display:flex;gap:18px;align-items:center;flex-wrap:wrap}
.pasek h1{font-size:16px;margin:0;font-weight:650}
.lic{font-variant-numeric:tabular-nums;color:var(--drugi);font-size:14px}
.lic b{color:var(--tekst)}
.stan{font-size:12.5px;padding:3px 10px;border-radius:999px;background:#f1f5f9;color:var(--drugi)}
.stan.dobrze{background:#dcfce7;color:#14532d}
.stan.zle{background:#fee2e2;color:#7f1d1d;font-weight:650}
.filtry button{border:1px solid var(--kres);background:#fff;border-radius:999px;padding:5px 12px;font-size:13px;cursor:pointer}
.filtry button.on{background:var(--tekst);color:#fff;border-color:var(--tekst)}
main{padding:20px;max-width:1500px;margin:0 auto}
.m{margin-bottom:34px}
.m h2 .nr{display:inline-block;min-width:26px;height:26px;line-height:26px;text-align:center;border-radius:7px;background:var(--tekst);color:#fff;font-size:12px;font-weight:700;margin-right:7px;vertical-align:2px}
.m h2{font-size:19px;margin:0 0 2px;font-weight:650}
.m h2 small{color:var(--drugi);font-weight:500;font-size:13px}
.opis{margin:0 0 14px;color:var(--drugi);font-size:13.5px}
.karty{display:grid;grid-template-columns:repeat(auto-fill,minmax(430px,1fr));gap:16px}
.k{background:var(--karta);border:1px solid var(--kres);border-radius:12px;padding:14px}
.k[data-stan=ok]{border-color:var(--ok);box-shadow:inset 3px 0 0 var(--ok)}
.k[data-stan=poprawka]{border-color:var(--pop);box-shadow:inset 3px 0 0 var(--pop)}
.k[data-stan=nie]{border-color:var(--nie);box-shadow:inset 3px 0 0 var(--nie)}
.k header{display:flex;justify-content:space-between;align-items:start;gap:10px}
.k h3{font-size:15px;margin:0 0 6px;font-weight:620}
.o{font-size:11px;font-weight:700;border-radius:5px;padding:2px 7px;flex:none}
.oA{background:#dcfce7;color:#14532d}.oB{background:#fef3c7;color:#78350f}
.oC{background:#e2e8f0;color:#334155}.oD{background:#fee2e2;color:#7f1d1d}
/* Odbiór 2026-08-30: właściciel trzy razy napisał „nie wiem, gdzie to jest".
   Karta pokazywała obrazek i nazwę, ale nie ŚCIEŻKĘ w aplikacji — więc ocena
   szła w próżni. */
.gdzie{margin:0 0 6px;font-size:12px;color:var(--nieb);background:#eff6ff;border-radius:6px;padding:4px 8px;display:inline-block}
/* Odbiór 2026-08-30, słowa właściciela: „Trzeci raz dajesz mi tę kartę do
   akceptacji". Kilka ekranów harnessu montuje TEN SAM komponent produkcyjny
   w różnych stanach. Karta mówi teraz o tym wprost, żeby nie oceniał tego
   samego kilka razy nie wiedząc o tym. */
.wariant{margin:0 0 6px;font-size:11.5px;color:#78350f;background:#fef3c7;border-radius:6px;padding:4px 8px;display:inline-block}
.co{margin:0 0 8px;font-size:13.5px;color:var(--drugi)}
.nap,.wyj{margin:0 0 8px;padding-left:16px;font-size:12.5px}
.nap li{color:var(--ok)}.wyj li{color:var(--pop)}
.obrazy{display:flex;gap:8px;margin:10px 0}
.obrazy figure{margin:0;flex:1;min-width:0}
.obrazy figcaption{font-size:11px;color:var(--drugi);margin-bottom:3px}
.obrazy img{width:100%;border:1px solid var(--kres);border-radius:7px;display:block;background:#fff}
.akcje{display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin-top:6px}
.b{border:1px solid var(--kres);background:#fff;border-radius:8px;padding:6px 12px;font-size:13px;cursor:pointer;font-weight:550}
.b.ok.on{background:var(--ok);color:#fff;border-color:var(--ok)}
.b.poprawka.on{background:var(--pop);color:#fff;border-color:var(--pop)}
.b.nie.on{background:var(--nie);color:#fff;border-color:var(--nie)}
.b:focus-visible,.uw:focus-visible{outline:2px solid var(--nieb);outline-offset:1px}
.zywo{font-size:12.5px;color:var(--nieb);margin-left:auto}
.k.swieza{border-color:var(--ok);box-shadow:0 0 0 2px #86efac inset}
.popr{background:#dcfce7;border:1px solid #86efac;border-radius:9px;padding:8px 11px;margin-bottom:9px;display:flex;flex-direction:column;gap:2px}
.popr b{color:#14532d;font-size:12.5px}
.popr b::before{content:"✔ ";font-weight:800}
.popr span{color:#166534;font-size:12.5px}
.popr time{color:#3f6212;font-size:11px}
.doModulow{display:inline-block;padding:5px 13px;border-radius:999px;background:#0f172a;color:#fff;text-decoration:none;font-size:13px;font-weight:600}
.doModulow:hover{background:#1e293b}
.filtry button[data-f=poproszone].on{background:#7c3aed;border-color:#7c3aed}
.k.poproszona{border-color:#7c3aed;box-shadow:0 0 0 2px #ddd6fe inset}
.prosba{background:#f5f3ff;border:1px solid #ddd6fe;border-radius:9px;padding:9px 12px;margin-bottom:9px;display:flex;flex-direction:column;gap:3px}
.prosba b{color:#5b21b6;font-size:12.5px}
.prosba b::before{content:"★ ";font-weight:800}
.prosba span{color:#6d28d9;font-size:13.5px;line-height:1.5}
.filtry button[data-f=swieze].on{background:var(--ok);border-color:var(--ok)}
.filtry button[data-f=reszta].on{background:var(--nieb);border-color:var(--nieb)}
.k.reszta{border-color:var(--nieb);box-shadow:inset 3px 0 0 var(--nieb)}
.k.czeka{border-color:#cbd5e1;background:#fbfcfd;box-shadow:inset 3px 0 0 #94a3b8}
.dlaczego.blok{background:#f8fafc;border-color:#e2e8f0}
.dlaczego.blok b{color:#334155}.dlaczego.blok span{color:#475569}
.czeka-txt{font-weight:600;color:#334155 !important}
.niedo{font-size:12.5px;color:var(--drugi);font-style:italic}
.dlaczego{background:#eff6ff;border:1px solid #bfdbfe;border-radius:9px;padding:8px 11px;margin-bottom:9px;display:flex;flex-direction:column;gap:3px}
.dlaczego b{color:#1e3a8a;font-size:12px;text-transform:uppercase;letter-spacing:.03em}
.dlaczego span{color:#1e40af;font-size:13px}
.zapis{font-size:11.5px;margin-top:6px;min-height:15px;color:var(--drugi)}
.zapis.jest{color:var(--ok)}
.zapis.czeka{color:var(--drugi)}
.zapis.blad{color:var(--nie);font-weight:700}
.uw{width:100%;margin-top:8px;border:1px solid var(--kres);border-radius:8px;padding:6px 9px;font-size:13px;font-family:inherit}
table{width:100%;border-collapse:collapse;font-size:13px;background:#fff;border:1px solid var(--kres);border-radius:10px;overflow:hidden}
th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--kres);vertical-align:top}
th{background:#f1f5f9;font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--drugi)}
.ukryta{display:none}
</style></head><body>
<div class="pasek">
  <h1>Odbiór grafiki</h1>
  <span class="lic" id="lic"></span>
  <span class="stan" id="stan">gotowe</span>
  <span class="filtry">
    <a class="doModulow" href="/moduly">Odbiór modułowy →</a>
    <button data-f="poproszone">★ Poproszony przegląd</button>
    <button data-f="reszta" class="on">★ Zostało do obejrzenia</button>
    <button data-f="czeka">Czeka na budowę</button>
    <button data-f="wszystkie">Wszystkie</button>
    <button data-f="nierozstrzygniete">Nierozstrzygnięte</button>
    <button data-f="swieze">Poprawione dla Ciebie</button>
    <button data-f="ok">Zaakceptowane</button>
    <button data-f="poprawka">Do poprawki</button>
    <button data-f="nie">Odrzucone</button>
  </span>
</div>
<main>
${moduly.join('\n')}
<section class="m">
  <h2>Świadomie Ci tego nie pokazuję <small>${niepokazane.length}</small></h2>
  <p class="opis">Każda pozycja z powodem. Nic tu nie ginie — leży w rejestrze i wraca, kiedy zdecydujesz.</p>
  <table><thead><tr><th>Ekran</th><th>Ocena</th><th>Co to jest</th><th>Dlaczego nie pokazuję</th></tr></thead><tbody>${nieTabela}</tbody></table>
</section>
</main>
<script>
const licz = () => {
  const k = [...document.querySelectorAll('.k')];
  const n = (s) => k.filter((x) => x.dataset.stan === s).length;
  document.getElementById('lic').innerHTML =
    '<b>' + n('ok') + '</b> zaakceptowanych · <b>' + n('poprawka') + '</b> do poprawki · <b>' + n('nie') +
    '</b> odrzuconych · <b>' + k.filter((x) => !x.dataset.stan).length + '</b> czeka z ' + k.length;
};
/**
 * KAŻDY zapis musi być WIDOCZNY. Pierwsza wersja tej strony zapisywała po cichu —
 * serwer padł, właściciel wpisał dwie uwagi, strona nie powiedziała ani słowa,
 * a uwagi przepadły. Cisza nigdy nie oznacza „zapisane".
 */
const stan = document.getElementById('stan');
const pokaz = (tekst, zle) => {
  stan.textContent = tekst;
  stan.className = zle ? 'stan zle' : 'stan dobrze';
};
const SLOWO = { ok: 'Akceptuję', poprawka: 'Do poprawki', nie: 'Odrzucam' };
/** Ekrany poprawione, których właściciel jeszcze nie widział. */
const znane = new Set([...document.querySelectorAll('.k[data-swieza="1"]')].map((k) => k.id.slice(2)));
const wyslij = (id, dane) => {
  const karta = document.getElementById('k-' + id);
  const znacznik = karta && karta.querySelector('.zapis');
  if (znacznik) { znacznik.textContent = 'zapisuję…'; znacznik.className = 'zapis czeka'; }
  pokaz('zapisuję…', false);
  return fetch('/decyzja', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id, ...dane }),
  })
    .then(async (r) => {
      const dane = await r.json().catch(() => ({}));
      if (!r.ok || !dane.ok) throw new Error(dane.blad || 'serwer odpowiedział ' + r.status);
      // Potwierdzenie opisuje TO, CO LEŻY W BAZIE — nie to, co wysłaliśmy.
      const w = dane.wiersz || {};
      const godzina = new Date(w.kiedy).toLocaleTimeString('pl-PL');
      const opis = [w.decyzja ? SLOWO[w.decyzja] : 'bez decyzji', w.uwaga ? 'z uwagą' : null]
        .filter(Boolean)
        .join(', ');
      if (znacznik) { znacznik.textContent = 'w bazie: ' + opis + ' · ' + godzina; znacznik.className = 'zapis jest'; }
      // Odniósł się do poprawki → zielony znacznik gaśnie od razu, żeby filtr
      // „Poprawione dla Ciebie" pokazywał tylko to, czego jeszcze NIE widział.
      if (karta && karta.dataset.swieza === '1') {
        karta.dataset.swieza = '';
        karta.classList.remove('swieza');
        const slot = karta.querySelector('.popr-slot');
        if (slot) slot.innerHTML = '';
        znane.delete(id);
        document.title = znane.size ? '(' + znane.size + ') Odbiór grafiki' : 'Odbiór grafiki';
      }
      pokaz('zapisane w bazie · ' + dane.wpisowWHistorii + ' wpisów w historii', false);
    })
    .catch((e) => {
      if (znacznik) { znacznik.textContent = 'NIE ZAPISANO'; znacznik.className = 'zapis blad'; }
      pokaz('NIE ZAPISANO — ' + e.message + '. Nie zamykaj strony, powiedz mi o tym.', true);
    });
};
document.addEventListener('click', (ev) => {
  const b = ev.target.closest('.b');
  if (b) {
    const karta = b.closest('.k');
    const nowa = karta.dataset.stan === b.dataset.d ? '' : b.dataset.d;
    karta.dataset.stan = nowa;
    karta.querySelectorAll('.b').forEach((x) => x.classList.toggle('on', !!nowa && x.dataset.d === nowa));
    wyslij(b.dataset.id, { decyzja: nowa });
    licz();
    return;
  }
  const f = ev.target.closest('.filtry button');
  if (f) {
    document.querySelectorAll('.filtry button').forEach((x) => x.classList.toggle('on', x === f));
    const tryb = f.dataset.f;
    document.querySelectorAll('.k').forEach((k) => {
      const pokaz =
        tryb === 'poproszone'
          ? k.dataset.poproszona === '1'
          : tryb === 'reszta'
          ? k.dataset.reszta === '1'
          : tryb === 'czeka'
          ? k.dataset.czeka === '1'
          : tryb === 'wszystkie'
          ? true
          : tryb === 'nierozstrzygniete'
            ? !k.dataset.stan
            : tryb === 'swieze'
              ? k.dataset.swieza === '1'
              : k.dataset.stan === tryb;
      k.classList.toggle('ukryta', !pokaz);
    });
    document.querySelectorAll('.m').forEach((m) => {
      const karty = [...m.querySelectorAll('.k')];
      const widoczne = karty.filter((k) => !k.classList.contains('ukryta'));
      if (m.querySelector('.k')) m.classList.toggle('ukryta', !widoczne.length);
      /* Licznik przy nazwie modułu musi liczyć to, co WIDAĆ. Bez tego nagłówek
         mówił „Czat 15", a pod nim stało 5 kart — właściciel liczyłby rozbieżność
         zamiast oglądać ekrany. Zapamiętujemy liczbę pełną, żeby dało się wrócić. */
      const licznik = m.querySelector('h2 small');
      if (licznik) {
        if (!licznik.dataset.pelna) licznik.dataset.pelna = licznik.textContent.trim();
        licznik.textContent =
          tryb === 'wszystkie' ? licznik.dataset.pelna : widoczne.length + ' z ' + licznik.dataset.pelna;
      }
    });
  }
});
/**
 * UWAGA: zapis dopiero po zakończeniu pisania.
 * Wcześniej każde naciśnięcie klawisza leciało do bazy jako osobny wpis
 * historii — jedna uwaga rozrastała się do kilkunastu wierszy, każdy o jeden
 * znak dłuższy. Teraz czekamy ~800 ms ciszy od ostatniego znaku, ZANIM w
 * ogóle coś wyślemy — a dodatkowo wysyłamy natychmiast (pomijając ciszę),
 * gdy pole traci fokus albo karta się zamyka, żeby właściciel nigdy nie
 * stracił uwagi przez samo zamknięcie przeglądarki. Stan per-pole (timer,
 * ostatnia wysłana wartość) trzymamy w Map po id ekranu, bo wspólny jeden
 * timer na całą stronę potrafiłby skasować oczekujący zapis innego pola.
 */
const uwagiStan = new Map(); // id ekranu -> { timer, ostatnia }
function stanPola(id) {
  let s = uwagiStan.get(id);
  if (!s) { s = { timer: null, ostatnia: undefined }; uwagiStan.set(id, s); }
  return s;
}
function wyslijUwageTeraz(u) {
  const id = u.dataset.id;
  const s = stanPola(id);
  clearTimeout(s.timer);
  s.timer = null;
  if (s.ostatnia === u.value) return; // nic się nie zmieniło od ostatniej wysyłki
  s.ostatnia = u.value;
  wyslij(id, { uwaga: u.value });
}
document.addEventListener('input', (ev) => {
  const u = ev.target.closest('.uw');
  if (!u) return;
  const s = stanPola(u.dataset.id);
  clearTimeout(s.timer);
  s.timer = setTimeout(() => wyslijUwageTeraz(u), 800);
});
document.addEventListener('focusout', (ev) => {
  const u = ev.target.closest('.uw');
  if (!u) return;
  wyslijUwageTeraz(u);
});
/**
 * Zamknięcie karty/przeglądarki nie może ubić oczekującego zapisu — a
 * zwykły fetch w pagehide/beforeunload bywa ucinany, zanim żądanie
 * zdąży wylecieć. sendBeacon jest zbudowany dokładnie do tego: kolejkuje
 * wysyłkę niezależnie od losu strony.
 */
window.addEventListener('pagehide', () => {
  document.querySelectorAll('.uw').forEach((u) => {
    const s = stanPola(u.dataset.id);
    if (!s.timer && s.ostatnia === u.value) return;
    clearTimeout(s.timer);
    if (s.ostatnia === u.value) return;
    s.ostatnia = u.value;
    const cialo = JSON.stringify({ id: u.dataset.id, uwaga: u.value });
    navigator.sendBeacon('/decyzja', new Blob([cialo], { type: 'application/json' }));
  });
});
/**
 * Stan startowy — DWA przypadki, w tej kolejności (02.09, druga tura).
 *
 * 1. Jeśli są karty Świeżo poprawione (zielona ramka „Poprawione — obejrzyj
 *    ponownie"), strona otwiera się NA NICH. Powód: 02.09 wypuściliśmy 69 kart
 *    naraz, a strona otwierała się na fitrze „Zostało do obejrzenia", który ich
 *    NIE POKAZUJE — właściciel widziałby trzy pozycje i uznał, że nic się nie
 *    zmieniło. Poprawka bez tego kroku jest niewidoczna, czyli nie istnieje.
 * 2. W przeciwnym razie — filtr „★ Zostało do obejrzenia" jak dotychczas:
 *    właściciel przekliknął już wszystkie karty i prosił, żeby „skończyć odbiór",
 *    nie zaczynać go od nowa.
 *
 * Oba dotychczasowe filtry zostają nietknięte — zmienia się wyłącznie to, który
 * jest wybrany przy wejściu.
 */
const poproszonychNaStart = document.querySelectorAll('.k[data-poproszona="1"]').length;
const swiezychNaStart = document.querySelectorAll('.k[data-swieza="1"]').length;
if (swiezychNaStart) {
  const b = document.querySelector('.filtry button[data-f=swieze]');
  if (b) b.textContent = 'Poprawione dla Ciebie (' + swiezychNaStart + ')';
}
if (poproszonychNaStart) {
  /* Przypadek 0 — ma PIERWSZEŃSTWO nad wszystkim. Właściciel poprosił o te
     konkretne ekrany; gdyby strona otworzyła się na pełnej partii, jego sześć
     utonęłoby wśród kilkudziesięciu, a to jest dokładnie ten sam błąd, przez
     który rano widział trzy pozycje zamiast sześćdziesięciu dziewięciu. */
  const b = document.querySelector('.filtry button[data-f=poproszone]');
  if (b) b.textContent = '★ Poproszony przegląd (' + poproszonychNaStart + ')';
  b?.click();
} else if (swiezychNaStart) {
  document.querySelector('.filtry button[data-f=swieze]')?.click();
} else {
  document.querySelector('.filtry button[data-f=reszta]')?.click();
}
licz();

/**
 * NASŁUCH POPRAWEK — właściciel nie musi odświeżać strony.
 * Co 6 sekund pytamy serwer, które ekrany zostały poprawione i czekają na ponowne
 * obejrzenie. Nowe zapalamy na miejscu: zielona ramka, opis co zmieniłem i ŚWIEŻY
 * zrzut (adres obrazka dostaje znacznik czasu — inaczej przeglądarka pokazałaby
 * obraz sprzed naprawy i ocena poszłaby na nieaktualny widok).
 */
async function sprawdzPoprawki() {
  try {
    const r = await fetch('/stan', { cache: 'no-store' });
    if (!r.ok) return;
    const { swieze } = await r.json();
    let nowych = 0;
    for (const [ekran, popr] of Object.entries(swieze || {})) {
      if (znane.has(ekran)) continue;
      const k = document.getElementById('k-' + ekran);
      if (!k) continue;
      znane.add(ekran);
      nowych++;
      k.classList.add('swieza');
      k.dataset.swieza = '1';
      const slot = k.querySelector('.popr-slot');
      if (slot) {
        slot.innerHTML =
          '<div class="popr"><b>Poprawione — obejrzyj ponownie</b><span></span><time></time></div>';
        slot.querySelector('span').textContent = popr.opis;
        slot.querySelector('time').textContent = new Date(popr.kiedy).toLocaleString('pl-PL');
      }
      k.querySelectorAll('.obrazy img, .obrazy a').forEach((el) => {
        const pole = el.tagName === 'IMG' ? 'src' : 'href';
        const bazowy = el[pole].split('?')[0];
        el[pole] = bazowy + '?v=' + encodeURIComponent(popr.kiedy);
      });
    }
    if (nowych) {
      pokaz(nowych + ' ' + (nowych === 1 ? 'karta poprawiona' : 'kart poprawionych') + ' — zobacz zielone', false);
      document.title = '(' + znane.size + ') Odbiór grafiki';
    }
  } catch {
    /* cisza — brak sieci nie ma prawa zepsuć strony, po prostu spróbujemy za chwilę */
  }
}
setInterval(sprawdzPoprawki, 6000);
</script>
</body></html>`;
}

http
  .createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/decyzja') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        try {
          const { id, ...reszta } = JSON.parse(body);
          const wiersz = zapiszDecyzje(id, reszta);
          const ile = db.prepare('SELECT COUNT(*) AS n FROM historia').get().n;
          res
            .writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
            .end(JSON.stringify({ ok: true, wiersz, wpisowWHistorii: ile }));
        } catch (e) {
          console.error('BŁĄD zapisu:', e);
          res
            .writeHead(500, { 'content-type': 'application/json; charset=utf-8' })
            .end(JSON.stringify({ ok: false, blad: String(e && e.message) }));
        }
      });
      return;
    }
    if (req.url === '/stan') {
      // Strona odpytuje to co kilka sekund. Dzięki temu poprawka zapala się
      // u właściciela SAMA, bez odświeżania — nie musi zgadywać, czy już coś zrobiłem.
      const decyzje = czytajDecyzje();
      const poprawki = czytajPoprawki();
      const swieze = {};
      for (const [ekran, popr] of Object.entries(poprawki)) {
        if (czekaNaPonowne(popr, decyzje[ekran])) swieze[ekran] = popr;
      }
      return res
        .writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
        .end(JSON.stringify({ swieze }));
    }
    if (req.method === 'POST' && req.url === '/decyzja-modulu') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        try {
          const { modul, ...reszta } = JSON.parse(body);
          res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(zapiszDecyzjeModulu(modul, reszta)));
        } catch (e) {
          res.writeHead(400).end(JSON.stringify({ blad: String(e) }));
        }
      });
      return;
    }
    if (req.url === '/moduly' || req.url.startsWith('/moduly?')) {
      return res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(stronaModulow());
    }
    if (req.url.startsWith('/png/')) {
      const rel = decodeURIComponent(req.url.slice(5));
      const p = path.join(EVID, rel);
      if (!p.startsWith(EVID) || !fs.existsSync(p)) return res.writeHead(404).end('nie ma');
      res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'max-age=600' });
      return fs.createReadStream(p).pipe(res);
    }
    try {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(strona());
    } catch (e) {
      // Żaden błąd pojedynczego żądania nie ma prawa położyć serwera odbioru.
      console.error('BŁĄD renderu strony:', e);
      res
        .writeHead(500, { 'content-type': 'text/html; charset=utf-8' })
        .end(`<h1>Serwer odbioru nie zbudował strony</h1><pre>${String(e && e.stack)}</pre>`);
    }
  })
  .listen(PORT, '127.0.0.1', () => {
    console.log(`Odbiór grafiki → http://127.0.0.1:${PORT}/`);
    console.log(`Decyzje zapisują się do ${path.relative(ROOT, DECYZJE)}`);
  });
