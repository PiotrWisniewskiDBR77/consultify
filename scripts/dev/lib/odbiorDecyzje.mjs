/**
 * STRONA `/decyzje` — JEDNA strona z tym, co właściciel ma DZIŚ rozstrzygnąć.
 *
 * POWÓD ISTNIENIA (2026-09-05): po rundzie 3 odbioru MVP rzeczy do decyzji leżą
 * w trzech różnych miejscach — otwarte pytania produktowe w
 * `docs/program/DECYZJE_OTWARTE_20260905.json`, ekrany z werdyktem
 * `NOWY_WZORZEC` rozsypane po 19 plikach `wyniki.json`, i naprawy z dzisiaj,
 * które mają dowód w postaci zrzutu. Właściciel nie ma ich gdzie odkliknąć w
 * jednym miejscu, więc odbiór wraca do rozmowy — a rozmowa nie jest rejestrem.
 *
 * Ta strona NIE liczy niczego od nowa: czyta te same pliki co `/zywo` i zapisuje
 * do tej samej tabeli `decyzje_zywo` (klucz `DEC:<id>` dla decyzji produktowych,
 * samo id ekranu dla ekranów — dzięki temu klik tutaj i klik na `/zywo` to jedna
 * i ta sama odpowiedź, nie dwie sprzeczne).
 *
 * Osobny moduł (nie w `odbior-serwer.mjs`) z tego samego powodu co
 * `lib/odbiorZywo.mjs`: żeby dało się to zbudować i sprawdzić bez stawiania HTTP.
 */
import fs from 'node:fs';
import path from 'node:path';

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** Ścieżka względna od katalogu `evidence/` → adres pod `/ev/…` (serwer już to obsługuje). */
export function urlEv(relOdEvidence) {
  const bez = String(relOdEvidence || '').replace(/^evidence[\\/]/, '');
  if (!bez) return '';
  return '/ev/' + bez.split(/[\\/]/).filter(Boolean).map(encodeURIComponent).join('/');
}

/**
 * Wszystkie `wyniki.json` z odbioru na żywo w jednej mapie id → wynik (+ `_katalog`).
 * Każda awaria pojedynczego pliku (brak, zepsuty JSON w trakcie zapisu przez
 * innego agenta) jest POMIJANA — strona właściciela nie ma prawa paść przez to,
 * że ktoś obok akurat pisze plik.
 */
export function zbierzWyniki(zywoDir) {
  const out = {};
  let katalogi;
  try {
    katalogi = fs.readdirSync(zywoDir).sort();
  } catch {
    return out;
  }
  for (const katalog of katalogi) {
    const plik = path.join(zywoDir, katalog, 'wyniki.json');
    let dane;
    try {
      if (!fs.statSync(path.join(zywoDir, katalog)).isDirectory()) continue;
      dane = JSON.parse(fs.readFileSync(plik, 'utf8'));
    } catch {
      continue;
    }
    if (!Array.isArray(dane)) continue;
    for (const w of dane) {
      if (w && typeof w.id === 'string' && w.id) out[w.id] = { ...w, _katalog: katalog };
    }
  }
  return out;
}

/** id ekranu → { nazwa, ocena } z `status.json` (żeby karta miała ludzką nazwę, nie samo id). */
export function indeksNazw(status) {
  const out = {};
  for (const m of (status && status.moduly) || []) {
    for (const e of m.ekrany || []) {
      if (e && e.id) out[e.id] = { nazwa: e.nazwa || e.id, ocena: e.ocena || '', modul: m.nazwa || '' };
    }
  }
  return out;
}

/**
 * id ekranu → ścieżka OBRAZU ZATWIERDZONEGO (jasny motyw).
 * Pierwsze źródło: pakiety odbioru (`pakiet-<katalog>.json`, pole
 * `obraz_zatwierdzony_light`) — tam ta ścieżka jest wskazana ręką, nie zgadnięta.
 * Pakiety mogą nie istnieć (leżą poza repo), więc drugie źródło podaje wyżej
 * serwer: ten sam skan `evidence/grafika/**` co na `/zywo`.
 */
export function indeksZatwierdzonychZPakietow(pakietyDir) {
  const out = {};
  let pliki;
  try {
    pliki = fs.readdirSync(pakietyDir);
  } catch {
    return out;
  }
  for (const f of pliki) {
    if (!f.startsWith('pakiet-') || !f.endsWith('.json')) continue;
    let dane;
    try {
      dane = JSON.parse(fs.readFileSync(path.join(pakietyDir, f), 'utf8'));
    } catch {
      continue;
    }
    for (const e of (dane && dane.ekrany) || []) {
      if (e && e.id && e.obraz_zatwierdzony_light) out[e.id] = e.obraz_zatwierdzony_light;
    }
  }
  return out;
}

/** `02-moja-praca` → `02 · moja praca` (nazwa katalogu JEST nazwą modułu, nie zgadujemy). */
export const ladnyKatalog = (k) => String(k || '').replace(/^(\d+)-/, '$1 · ').replace(/-/g, ' ');

/**
 * Wiersze tabel z `ODBIOR_SERYJNY_20260905.md`, których NIE ma wśród ekranów
 * `NOWY_WZORZEC` — czyli te, których właściciel nigdy nie oglądał, a które nie
 * trafiły same do akceptu seryjnego.
 *
 * Dopasowanie po id w backtickach z CAŁEGO wiersza (nie tylko z pierwszej
 * komórki): tabela konsolidacji Organizacji wymienia stare nazwy bez przedrostka
 * (`operating-model`), a wynik ma je z przedrostkiem (`org-operating-model`) —
 * sprawdzamy więc obie postaci. Sekcja „(c) zbudowane dziś" jest pomijana z
 * założenia: te pozycje mają własną sekcję C na tej stronie.
 */
export function wierszeNigdyNieogladane(mdPath, idNowyWzorzec) {
  const out = [];
  let tekst;
  try {
    tekst = fs.readFileSync(mdPath, 'utf8');
  } catch {
    return out;
  }
  let sekcja = '';
  for (const linia of tekst.split('\n')) {
    const nag = linia.match(/^##\s+(.+)$/);
    if (nag) {
      sekcja = nag[1].trim();
      continue;
    }
    if (!linia.startsWith('|')) continue;
    if (/^\|[\s:|-]+\|$/.test(linia.trim())) continue; // linia rozdzielająca
    if (!sekcja.startsWith('(')) continue;
    if (sekcja.startsWith('(c)')) continue; // zbudowane dziś — mają sekcję C
    const komorki = linia.split('|').slice(1, -1).map((x) => x.trim());
    if (!komorki.length) continue;
    if (/^(Id|#|Co)$/i.test(komorki[0])) continue; // nagłówek tabeli
    const tokeny = [...linia.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
    const znane = tokeny.some((t) => idNowyWzorzec.has(t) || idNowyWzorzec.has('org-' + t));
    if (znane) continue;
    const pierwszy = komorki[0].replace(/`/g, '');
    const wygladaNaId = /^[a-z0-9][a-z0-9-]{3,}$/.test(pierwszy);
    out.push({
      id: wygladaNaId ? pierwszy : '',
      sekcja,
      tekst: komorki.filter(Boolean).join(' · ').replace(/`/g, ''),
    });
  }
  return out;
}

/**
 * Etykiety werdyktów pomiaru — na kartach sekcji C pokazujemy je WPROST.
 * Powód: sekcja nazywa się „naprawione dziś”, ale pomiar rundy 3 dla części
 * z tych ekranów dalej brzmi RÓŻNI SIĘ (naprawa główna weszła, została
 * otoczka). Gdyby strona tego nie mówiła, właściciel klikałby „Zgodne” na
 * podstawie naszego nagłówka, a nie własnych oczu.
 */
export const ETYKIETA_WERDYKTU = {
  ZGODNY: 'zgodny',
  ROZNI_SIE: 'różni się',
  NIE_DOTARLEM: 'nie dotarłem',
  NOWY_WZORZEC: 'nowy wzorzec',
  DANE: 'kwestia danych',
  DECYZJA: 'czeka na decyzję',
  FALA_2: 'fala 2',
  BRAK_W_APLIKACJI: 'brak w aplikacji',
  CZEKA_NA_SERWER: 'czeka na serwer',
  WYMAGA_SUPERADMINA: 'wymaga superadmina',
};

/** NAPRAWIONE DZIŚ — lista ustalona ręcznie z rundy 3 (id → katalog + wzorzec pliku-dowodu). */
export const NAPRAWIONE_DZIS = [
  { id: 'mindmap-i18n-smoke', katalog: '01-czat' },
  { id: 'mw-007-calendar-narrow-viewport', katalog: '16-kanon' },
  { id: 'report-artifact', katalog: '10-materialy', dowod: 'evidence-r3-report-artifact.png' },
  { id: 'audyty-warsztat-kryterium', katalog: '11-audyty', dowod: 'proof-audyty-warsztat-kryterium.png' },
  { id: 'audyty-drd-report', katalog: '11-audyty', dowod: 'proof-audyty-drd-report-hub.png' },
  { id: 'drd-macierz-oceny', katalog: '05-ocena', dowod: 'proof-drd-macierz-oceny.png' },
  { id: 'assessment-report-contract', katalog: '05-ocena', dowod: 'proof-assessment-report-contract.png' },
  { id: 'assessment-reports-table', katalog: '05-ocena', dowod: 'proof-assessment-reports-table.png' },
  { id: 'assessment-list', katalog: '05-ocena' },
];

/** Ścieżka do pliku, jeśli istnieje — inaczej pusty string. Zero zgadywania. */
function jesliJest(root, rel) {
  try {
    return fs.existsSync(path.join(root, rel)) ? rel : '';
  } catch {
    return '';
  }
}

function obrazek(etykieta, url, klasa) {
  if (!url) {
    return `<figure class="fig ${klasa}"><figcaption>${esc(etykieta)}</figcaption><div class="brakObrazu">brak obrazu</div></figure>`;
  }
  return `<figure class="fig ${klasa}"><figcaption>${esc(etykieta)}</figcaption>
    <a href="${url}" target="_blank" rel="noopener"><img loading="lazy" src="${url}" alt="${esc(etykieta)}"></a></figure>`;
}

/** Wspólny dół każdej karty: przyciski + pole uwagi + to, co NAPRAWDĘ leży w bazie. */
function ogonKarty(klucz, opcje, zapis) {
  const d = zapis || {};
  const przyciski = opcje
    .map(
      (o) =>
        `<button type="button" class="opt ${o.kod === 'A' || o.kod === 'ok' ? 'tak' : 'nie'} ${d.decyzja === o.kod ? 'on' : ''}" data-k="${esc(klucz)}" data-d="${esc(o.kod)}">
          <span class="optEtykieta">${esc(o.etykieta)}</span>
          ${o.opis ? `<span class="optOpis">${esc(o.opis)}</span>` : ''}
          ${o.rekomendacja ? '<span class="rek">rekomendacja CTO</span>' : ''}
        </button>`
    )
    .join('');
  const slowo = Object.fromEntries(opcje.map((o) => [o.kod, o.etykieta]));
  return `<div class="opcje">${przyciski}</div>
  <input class="uw" data-k="${esc(klucz)}" placeholder="uwaga (opcjonalnie) — zapisuje się sama" value="${esc(d.uwaga || '')}">
  <div class="zapis ${d.kiedy ? 'jest' : ''}">${
    d.kiedy
      ? `w bazie: ${esc(slowo[d.decyzja] || (d.decyzja ? d.decyzja : 'bez odpowiedzi'))}${d.uwaga ? ', z uwagą' : ''} · ${esc(new Date(d.kiedy).toLocaleString('pl-PL'))}`
      : ''
  }</div>`;
}

/**
 * Buduje całą stronę `/decyzje`.
 * `p`: { decyzjeOtwarte, status, zywoDir, evidenceRoot, pakietyDir, mdSeryjny, zapisane, zatwierdzoneZapasowe }
 *  - `zapisane`: mapa klucz → { decyzja, uwaga, kiedy } z tabeli `decyzje_zywo`
 *  - `zatwierdzoneZapasowe`: mapa id → ścieżka absolutna (skan evidence/grafika, ten sam co na /zywo)
 */
export function stronaDecyzje(p) {
  const {
    decyzjeOtwarte = { decyzje: [] },
    status = { moduly: [] },
    zywoDir,
    evidenceRoot,
    pakietyDir,
    mdSeryjny,
    zapisane = {},
    zatwierdzoneZapasowe = {},
  } = p;

  const wyniki = zbierzWyniki(zywoDir);
  const nazwy = indeksNazw(status);
  const zPakietow = indeksZatwierdzonychZPakietow(pakietyDir);

  const urlZatwierdzonego = (id) => {
    if (zPakietow[id]) return urlEv(zPakietow[id]);
    const zapas = zatwierdzoneZapasowe[id];
    if (zapas) return urlEv(path.relative(evidenceRoot, zapas.pelna || zapas).split(path.sep).join('/'));
    return '';
  };
  const urlZywego = (id) => {
    const w = wyniki[id];
    if (w && w.zrzut) return urlEv(w.zrzut);
    return '';
  };
  const nazwa = (id) => (nazwy[id] ? nazwy[id].nazwa : id);

  /* ---------- A. DECYZJE ---------- */
  const decyzje = decyzjeOtwarte.decyzje || [];
  const kartyA = decyzje
    .map((d) => {
      const klucz = 'DEC:' + d.id;
      const zapis = zapisane[klucz];
      const miniatury = (d.ekrany || [])
        .map((id) => {
          const zywy = urlZywego(id);
          const zatw = urlZatwierdzonego(id);
          return `<div class="para">
            <div class="paraNazwa">${esc(nazwa(id))} <code>${esc(id)}</code></div>
            <div class="paraObrazy">
              ${obrazek('Zatwierdzone', zatw, 'mala')}
              ${obrazek('Na żywo 05.09', zywy, 'mala')}
            </div>
          </div>`;
        })
        .join('');
      const opcje = [
        { kod: 'A', etykieta: 'A', opis: (d.opcje && d.opcje.A) || '', rekomendacja: d.rekomendacja === 'A' },
        { kod: 'B', etykieta: 'B', opis: (d.opcje && d.opcje.B) || '', rekomendacja: d.rekomendacja === 'B' },
      ];
      return `<article class="karta dec" data-sek="A" data-stan="${esc((zapis && zapis.decyzja) || '')}" id="k-${esc(klucz)}">
        <div class="modul">${esc(d.modul || '')}</div>
        <p class="pytanie">${esc(d.pytanie)}</p>
        ${miniatury ? `<div class="pary">${miniatury}</div>` : ''}
        ${ogonKarty(klucz, opcje, zapis)}
      </article>`;
    })
    .join('');
  const odpA = decyzje.filter((d) => (zapisane['DEC:' + d.id] || {}).decyzja).length;

  /* ---------- B. AKCEPT SERYJNY ---------- */
  const nowe = Object.values(wyniki).filter((w) => w.werdykt === 'NOWY_WZORZEC');
  const idNowe = new Set(nowe.map((w) => w.id));
  const wgKatalogu = new Map();
  for (const w of nowe.sort((a, b) => a.id.localeCompare(b.id))) {
    if (!wgKatalogu.has(w._katalog)) wgKatalogu.set(w._katalog, []);
    wgKatalogu.get(w._katalog).push(w);
  }
  const opcjeEkranu = [
    { kod: 'ok', etykieta: 'Akceptuję' },
    { kod: 'poprawka', etykieta: 'Do poprawki' },
  ];
  const grupyB = [...wgKatalogu.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([katalog, lista]) => {
      const karty = lista
        .map((w) => {
          const zapis = zapisane[w.id];
          return `<article class="karta ekran" data-sek="B" data-stan="${esc((zapis && zapis.decyzja) || '')}" id="k-${esc(w.id)}">
            <h4>${esc(nazwa(w.id))} <code>${esc(w.id)}</code></h4>
            ${w.opis ? `<p class="opis">${esc(w.opis)}</p>` : ''}
            ${obrazek('Na żywo 05.09 — kliknij, żeby otworzyć w pełnym rozmiarze', urlZywego(w.id), 'duza')}
            ${ogonKarty(w.id, opcjeEkranu, zapis)}
          </article>`;
        })
        .join('');
      return `<h3 class="grupa">${esc(ladnyKatalog(katalog))} <small>${lista.length}</small></h3>
        <div class="siatka">${karty}</div>`;
    })
    .join('');

  const nigdy = wierszeNigdyNieogladane(mdSeryjny, idNowe);
  const kartyNigdy = nigdy
    .map((w, i) => {
      const klucz = w.id || 'SER:' + i;
      const zapis = zapisane[klucz];
      const zywy = w.id ? urlZywego(w.id) : '';
      return `<article class="karta ekran" data-sek="B" data-stan="${esc((zapis && zapis.decyzja) || '')}" id="k-${esc(klucz)}">
        <h4>${esc(w.id || 'pozycja z pakietu')} ${w.id ? `<code>${esc(w.id)}</code>` : ''}</h4>
        <p class="opis"><span class="skad">${esc(w.sekcja)}</span> ${esc(w.tekst)}</p>
        ${zywy ? obrazek('Na żywo 05.09', zywy, 'duza') : ''}
        ${ogonKarty(klucz, opcjeEkranu, zapis)}
      </article>`;
    })
    .join('');
  const razemB = nowe.length + nigdy.length;
  const odpB =
    nowe.filter((w) => (zapisane[w.id] || {}).decyzja).length +
    nigdy.filter((w, i) => (zapisane[w.id || 'SER:' + i] || {}).decyzja).length;

  /* ---------- C. NAPRAWIONE DZIŚ ---------- */
  const opcjeNaprawy = [
    { kod: 'ok', etykieta: 'Zgodne' },
    { kod: 'poprawka', etykieta: 'Nadal różni się' },
  ];
  const kartyC = NAPRAWIONE_DZIS.map((n) => {
    const zapis = zapisane[n.id];
    const dowodRel = n.dowod ? jesliJest(evidenceRoot, path.join(path.basename(zywoDir), n.katalog, n.dowod)) : '';
    const zwykly = jesliJest(evidenceRoot, path.join(path.basename(zywoDir), n.katalog, n.id + '.png'));
    const dowodUrl = dowodRel ? urlEv(dowodRel) : zwykly ? urlEv(zwykly) : urlZywego(n.id);
    const w = wyniki[n.id];
    return `<article class="karta ekran" data-sek="C" data-stan="${esc((zapis && zapis.decyzja) || '')}" id="k-${esc(n.id)}">
      <h4>${esc(nazwa(n.id))} <code>${esc(n.id)}</code></h4>
      ${w && w.werdykt ? `<span class="werdykt w-${esc(w.werdykt)}">pomiar rundy 3: ${esc(ETYKIETA_WERDYKTU[w.werdykt] || w.werdykt)}</span>` : ''}
      <p class="opis"><span class="skad">${esc(ladnyKatalog(n.katalog))}</span> ${esc((w && w.opis) || 'Naprawa z rundy 3 — dowód obok.')}</p>
      <div class="paraObrazy">
        ${obrazek('Zatwierdzone', urlZatwierdzonego(n.id), 'duza')}
        ${obrazek(n.dowod ? 'Dowód naprawy (dziś)' : 'Na żywo 05.09', dowodUrl, 'duza')}
      </div>
      ${ogonKarty(n.id, opcjeNaprawy, zapis)}
    </article>`;
  }).join('');
  const odpC = NAPRAWIONE_DZIS.filter((n) => (zapisane[n.id] || {}).decyzja).length;

  const licznik = (kod, ile, razem) =>
    `<a class="lic" href="#sek-${kod}"><b>${kod}</b> <span class="licN" data-lic="${kod}">${ile}</span> / ${razem}</a>`;

  return `<!doctype html><html lang="pl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Do decyzji i akceptu — 05.09</title><style>${STYL}</style></head><body>
<header class="pasek">
  <h1>Do rozstrzygnięcia dziś</h1>
  <nav class="liczniki">
    ${licznik('A', odpA, decyzje.length)}
    ${licznik('B', odpB, razemB)}
    ${licznik('C', odpC, NAPRAWIONE_DZIS.length)}
  </nav>
  <span class="stan" id="stan">gotowe</span>
</header>
<main>
  <section id="sek-A">
    <h2>A. DECYZJE <small>odpowiedziano <span data-lic="A">${odpA}</span> / ${decyzje.length}</small></h2>
    <p class="wstep">Pytania, na których stoją agenci. Wybierz A albo B — rekomendacja CTO jest oznaczona przy opcji.</p>
    <div class="kolumna">${kartyA || '<p class="pusto">Brak otwartych decyzji.</p>'}</div>
  </section>
  <section id="sek-B">
    <h2>B. AKCEPT SERYJNY (nowy wzorzec) <small>odpowiedziano <span data-lic="B">${odpB}</span> / ${razemB}</small></h2>
    <p class="wstep">Ekrany, które dziś wyglądają inaczej niż stary obraz zatwierdzony, bo zmienił się WZORZEC — nie dlatego, że coś się zepsuło. Jedno kliknięcie na ekran.</p>
    ${grupyB || '<p class="pusto">Brak ekranów z werdyktem NOWY_WZORZEC.</p>'}
    ${
      kartyNigdy
        ? `<h3 class="grupa">nigdy nieoglądane <small>${nigdy.length}</small></h3>
           <p class="wstep">Pozycje z pakietu odbioru seryjnego, które nie mają werdyktu „nowy wzorzec" — właściciel nie widział ich ani razu.</p>
           <div class="siatka">${kartyNigdy}</div>`
        : ''
    }
  </section>
  <section id="sek-C">
    <h2>C. NAPRAWIONE DZIŚ — do potwierdzenia <small>odpowiedziano <span data-lic="C">${odpC}</span> / ${NAPRAWIONE_DZIS.length}</small></h2>
    <p class="wstep">Różnice, którymi zajęliśmy się dziś w rundzie 3. Po lewej obraz zatwierdzony, po prawej dowód z dzisiaj. Plakietka mówi, co pokazał POMIAR — jeśli brzmi „różni się”, naprawa główna weszła, ale coś jeszcze zostało. Rozstrzyga Twoje oko, nie nasz nagłówek.</p>
    <div class="siatka">${kartyC}</div>
  </section>
</main>
<script>${SKRYPT}</script>
</body></html>`;
}

export const STYL = `
:root{--tlo:#f6f7f9;--karta:#fff;--tekst:#111827;--drugi:#4b5563;--kres:#dfe3e8;--ok:#15803d;--pop:#b45309;--blad:#9f1239;--nieb:#1d4ed8}
*{box-sizing:border-box}
body{margin:0;background:var(--tlo);color:var(--tekst);font:17px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
.pasek{position:sticky;top:0;z-index:30;background:#fff;border-bottom:1px solid var(--kres);padding:14px 28px;display:flex;gap:20px;align-items:center;flex-wrap:wrap}
.pasek h1{font-size:22px;margin:0;font-weight:680;letter-spacing:-.2px}
.liczniki{display:flex;gap:10px}
.lic{display:inline-flex;gap:8px;align-items:baseline;text-decoration:none;color:var(--drugi);border:1px solid var(--kres);border-radius:999px;padding:6px 14px;font-size:15px;background:#fff}
.lic b{color:var(--tekst);font-size:15px}
.lic .licN{font-variant-numeric:tabular-nums;font-weight:700;color:var(--ok)}
.lic:hover{border-color:var(--nieb);color:var(--nieb)}
.stan{margin-left:auto;font-size:14px;padding:5px 14px;border-radius:999px;background:#eef1f5;color:var(--drugi)}
.stan.dobrze{background:#dcfce7;color:#14532d}
.stan.zle{background:#fee2e2;color:#7f1d1d;font-weight:650}
main{padding:26px 28px 90px;max-width:1560px;margin:0 auto}
section{margin-bottom:52px}
h2{font-size:26px;margin:0 0 6px;font-weight:700;letter-spacing:-.3px}
h2 small{font-size:16px;font-weight:500;color:var(--drugi);margin-left:12px}
.wstep{margin:0 0 18px;color:var(--drugi);font-size:16px;max-width:96ch}
.grupa{font-size:18px;font-weight:650;margin:26px 0 10px;padding-bottom:6px;border-bottom:1px solid var(--kres)}
.grupa small{font-weight:500;color:var(--drugi);margin-left:8px;font-size:14px}
.kolumna{display:flex;flex-direction:column;gap:16px}
.siatka{display:grid;grid-template-columns:repeat(auto-fill,minmax(460px,1fr));gap:16px}
.karta{background:var(--karta);border:1px solid var(--kres);border-radius:14px;padding:18px 20px}
.karta[data-stan="ok"],.karta[data-stan="A"],.karta[data-stan="B"]{border-color:#bbf7d0;box-shadow:inset 4px 0 0 var(--ok)}
.karta[data-stan="poprawka"]{border-color:#fde68a;box-shadow:inset 4px 0 0 var(--pop)}
.modul{font-size:13px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--drugi);margin-bottom:6px}
.pytanie{font-size:18px;line-height:1.55;margin:0 0 14px}
.karta h4{font-size:16px;margin:0 0 6px;font-weight:650}
.karta h4 code,.paraNazwa code{font-weight:400;font-size:12.5px;color:var(--drugi);background:#f1f3f7;border-radius:5px;padding:1px 6px;margin-left:6px}
.opis{margin:0 0 12px;font-size:14.5px;color:var(--drugi)}
.skad{display:inline-block;background:#eef1f5;border-radius:5px;padding:1px 7px;font-size:12px;margin-right:6px;color:var(--drugi)}
.werdykt{display:inline-block;font-size:12px;font-weight:700;border-radius:999px;padding:3px 10px;margin:0 0 8px;background:#eef1f5;color:var(--drugi)}
.werdykt.w-ZGODNY{background:#dcfce7;color:#14532d}
.werdykt.w-ROZNI_SIE{background:#fef3c7;color:#78350f}
.werdykt.w-DANE{background:#e0e7ff;color:#312e81}
.pary{display:flex;flex-wrap:wrap;gap:14px;margin-bottom:14px}
.para{flex:1 1 340px;min-width:0}
.paraNazwa{font-size:13.5px;color:var(--drugi);margin-bottom:4px}
.paraObrazy{display:flex;gap:8px}
.fig{margin:0;flex:1;min-width:0}
.fig figcaption{font-size:12px;color:var(--drugi);margin-bottom:4px}
/* PUŁAPKA (05.09): pierwsza wersja kadrowała miniatury przez object-fit:cover
   od GÓRY. Zrzuty modali (np. unified-create-launcher) to wyśrodkowane okno na
   szarej przesłonie — kadr od góry pokazywał właścicielowi czysty szary
   prostokąt, czyli obraz wyglądający na zepsuty. object-fit:contain pokazuje
   CAŁY zrzut, pomniejszony; pełny rozmiar jest o jedno kliknięcie dalej. */
.fig img{width:100%;display:block;border:1px solid var(--kres);border-radius:9px;background:#f8fafc;object-fit:contain;object-position:top center}
.fig.mala img{height:190px}
.fig.duza img{height:330px}
.brakObrazu{border:1px dashed var(--kres);border-radius:9px;padding:26px 10px;text-align:center;font-size:13px;color:#9aa3ad;background:#fbfcfd}
.opcje{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}
.opt{flex:1 1 220px;text-align:left;border:1.5px solid var(--kres);background:#fff;border-radius:11px;padding:11px 14px;cursor:pointer;font:inherit;display:flex;flex-direction:column;gap:3px}
.opt:hover{border-color:#9aa3ad}
.optEtykieta{font-size:16px;font-weight:680}
.optOpis{font-size:13.5px;color:var(--drugi);line-height:1.45}
.rek{font-size:11.5px;font-weight:700;letter-spacing:.03em;text-transform:uppercase;color:#166534;background:#dcfce7;border-radius:5px;padding:2px 7px;align-self:flex-start;margin-top:3px}
.opt.on.tak{border-color:var(--ok);background:#f0fdf4}
.opt.on.tak .optEtykieta{color:#14532d}
.opt.on.nie{border-color:var(--pop);background:#fffbeb}
.opt.on.nie .optEtykieta{color:#78350f}
.opt:focus-visible,.uw:focus-visible{outline:2px solid var(--nieb);outline-offset:2px}
.uw{width:100%;margin-top:10px;border:1px solid var(--kres);border-radius:9px;padding:9px 12px;font:15px/1.5 inherit}
.zapis{font-size:13px;margin-top:7px;min-height:18px;color:var(--drugi)}
.zapis.jest{color:var(--ok);font-weight:600}
.zapis.blad{color:var(--blad);font-weight:700}
.pusto{color:var(--drugi)}
`;

export const SKRYPT = `
const stan = document.getElementById('stan');
const pokaz = (t, zle) => { stan.textContent = t; stan.className = 'stan ' + (zle ? 'zle' : 'dobrze'); };
function przelicz() {
  for (const sek of ['A','B','C']) {
    const ile = document.querySelectorAll('.karta[data-sek="' + sek + '"][data-stan]:not([data-stan=""])').length;
    document.querySelectorAll('[data-lic="' + sek + '"]').forEach((x) => { x.textContent = ile; });
  }
}
function wyslij(klucz, dane) {
  const karta = document.getElementById('k-' + klucz);
  const znacznik = karta && karta.querySelector('.zapis');
  if (znacznik) { znacznik.textContent = 'zapisuję…'; znacznik.className = 'zapis'; }
  pokaz('zapisuję…', false);
  return fetch('/decyzja-zywo', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: klucz, ...dane }) })
    .then(async (r) => {
      const odp = await r.json().catch(() => ({}));
      if (!r.ok || !odp.ok) throw new Error(odp.blad || ('serwer odpowiedział ' + r.status));
      const w = odp.wiersz || {};
      const btn = karta && karta.querySelector('.opt[data-d="' + (w.decyzja || '') + '"] .optEtykieta');
      const slowo = btn ? btn.textContent.trim() : (w.decyzja || 'bez odpowiedzi');
      const godzina = new Date(w.kiedy).toLocaleTimeString('pl-PL');
      if (znacznik) {
        znacznik.textContent = 'w bazie: ' + slowo + (w.uwaga ? ', z uwagą' : '') + ' · ' + godzina;
        znacznik.className = 'zapis jest';
      }
      pokaz('zapisane w bazie', false);
    })
    .catch((e) => {
      if (znacznik) { znacznik.textContent = 'NIE ZAPISANO — ' + e.message; znacznik.className = 'zapis blad'; }
      pokaz('NIE ZAPISANO — ' + e.message, true);
    });
}
document.addEventListener('click', (ev) => {
  const b = ev.target.closest('.opt');
  if (!b) return;
  const karta = b.closest('.karta');
  const nowa = karta.dataset.stan === b.dataset.d ? '' : b.dataset.d;
  karta.dataset.stan = nowa;
  karta.querySelectorAll('.opt').forEach((x) => x.classList.toggle('on', !!nowa && x.dataset.d === nowa));
  przelicz();
  wyslij(b.dataset.k, { decyzja: nowa });
});
const stanPol = new Map();
function pole(k) { let s = stanPol.get(k); if (!s) { s = { timer: null, ostatnia: undefined }; stanPol.set(k, s); } return s; }
function wyslijUwage(u) {
  const s = pole(u.dataset.k);
  clearTimeout(s.timer); s.timer = null;
  if (s.ostatnia === u.value) return;
  s.ostatnia = u.value;
  wyslij(u.dataset.k, { uwaga: u.value });
}
document.addEventListener('input', (ev) => {
  const u = ev.target.closest('.uw'); if (!u) return;
  const s = pole(u.dataset.k);
  clearTimeout(s.timer);
  s.timer = setTimeout(() => wyslijUwage(u), 800);
});
document.addEventListener('focusout', (ev) => { const u = ev.target.closest('.uw'); if (u) wyslijUwage(u); });
window.addEventListener('pagehide', () => {
  document.querySelectorAll('.uw').forEach((u) => {
    const s = pole(u.dataset.k);
    if (s.ostatnia === u.value) return;
    s.ostatnia = u.value;
    clearTimeout(s.timer);
    navigator.sendBeacon('/decyzja-zywo', new Blob([JSON.stringify({ id: u.dataset.k, uwaga: u.value })], { type: 'application/json' }));
  });
});
przelicz();
`;
