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
 * WERSJA 2 (2026-09-05, po pierwszym kontakcie właściciela ze stroną).
 * Co poszło źle w wersji 1 — zmierzone, nie zgadnięte: w bazie leżał wiersz
 * `DEC:d01-launcher-wywiad` z `uwaga: "OK"` i BEZ `decyzja`. Właściciel napisał
 * „OK" w polu uwagi, bo dwa przyciski „A" i „B" (z opisami opcji pisanymi dla
 * inżyniera) nie wyglądały jak coś, co się akceptuje. Odpowiedź nie zapisała się
 * jako decyzja — czyli strona zebrała zero.
 *
 * Dlatego wersja 2 ma na KAŻDEJ karcie, w każdej z trzech sekcji, dokładnie ten
 * sam ogon: dwa duże przyciski „Akceptuję" / „Do poprawki" i jedno pole uwagi
 * widoczne zawsze. Nie ma trzeciego wzorca do nauczenia się. W sekcji A wybór
 * merytoryczny robi rekomendacja CTO podana JAKO ZDANIE („Proponuję: …"), a
 * alternatywa jest tylko dopiskiem — właściciel akceptuje propozycję albo pisze,
 * czego chce inaczej. Techniczna proza agentów (ścieżki plików, angielskie
 * skróty) siedzi w zwiniętych „szczegółach technicznych" i nie zasłania obrazu.
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
 * otoczka). Gdyby strona tego nie mówiła, właściciel klikałby „Akceptuję” na
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

/**
 * DWIE ODPOWIEDZI, JEDNO SŁOWNICTWO.
 *
 * Wersja 1 zapisywała `ok`/`poprawka` (ekrany) i `A`/`B` (decyzje). Strona
 * `/zywo`, która pisze do TEJ SAMEJ tabeli, zapisuje `ok`/`poprawka`. Wersja 2
 * mówi jednym słowem: `AKCEPT` / `POPRAWKA`. Żeby stare kliknięcia właściciela
 * nie zniknęły z ekranu (a to jest jedyna trwała kopia jego pracy), obie postaci
 * czytamy przez tę funkcję. Serwer robi to samo w drugą stronę, zanim poda dane
 * stronie `/zywo` — dzięki temu dalej jest JEDEN rejestr, nie dwa sprzeczne.
 */
export function normalizujDecyzje(d) {
  const s = String(d ?? '').trim();
  if (!s) return '';
  if (s === 'AKCEPT' || s === 'ok' || s === 'OK') return 'AKCEPT';
  if (s === 'POPRAWKA' || s === 'poprawka') return 'POPRAWKA';
  return s; // 'A' / 'B' z wersji 1 rozstrzyga karta sekcji A (zna rekomendację)
}

/** Ścieżka do pliku, jeśli istnieje — inaczej pusty string. Zero zgadywania. */
export function jesliJest(root, rel) {
  try {
    return fs.existsSync(path.join(root, rel)) ? rel : '';
  } catch {
    return '';
  }
}

/**
 * JEDNO ZDANIE PO POLSKU z prozy agenta — albo NIC.
 *
 * `opis` w `wyniki.json` pisali agenci do agentów: ścieżki plików, SHA, nazwy
 * komponentów, angielskie wtręty. Właściciel ma na karcie widzieć jedno zdanie,
 * które mu coś mówi. Bierzemy pierwsze zdanie TYLKO wtedy, gdy jest krótkie i
 * nie zawiera znaków kodu — w każdym innym przypadku wolimy uczciwe zdanie
 * domyślne niż udawanie, że proza inżynierska jest po polsku.
 */
export function zdaniePoPolsku(opis) {
  const t = String(opis || '').trim();
  if (!t) return '';
  const m = t.match(/^[^.!?]{10,150}[.!?]/);
  if (!m) return '';
  const z = m[0].trim();
  if (/[`<>{}()\[\]/\\]|https?:|[A-Za-z]+\.(tsx|ts|mjs|js|json|png|md)\b|\bSHA\b|_[a-z]/.test(z)) return '';
  return z;
}

/**
 * OBRAZ NA ŻYWO — jedyny widoczny domyślnie (reguła 05.09 właściciela: ocenia
 * TYLKO obraz na żywo). Pełna szerokość karty, duży, klik otwiera oryginał.
 */
function figuraZywa(url, etykieta, klasa = 'duza') {
  if (!url) {
    return `<figure class="fig zywy ${klasa}"><figcaption>${esc(etykieta)}</figcaption><div class="brakObrazu">brak obrazu na żywo</div></figure>`;
  }
  return `<figure class="fig zywy ${klasa}"><figcaption>${esc(etykieta)}</figcaption>
    <a href="${url}" target="_blank" rel="noopener"><img loading="lazy" src="${url}" alt="${esc(etykieta)}"></a></figure>`;
}

/**
 * OBRAZ ZATWIERDZONY — schowany pod tekstowym przełącznikiem, zamknięty
 * domyślnie. Powód: właściciel 05.09 — „pokazujesz mi dwa zupełnie różne
 * obrazy [...] nie wiem, co mam z tego zrobić" — pokazywanie starego obrazu
 * OBOK żywego sugerowało, że oba są do oceny. Teraz stary obraz jest notatką
 * z historii, nie materiałem do osądu.
 * `niepewne`: plakietka ostrzegawcza, gdy ścieżka obrazu nie zawiera id
 * ekranu (dopasowanie zrobione ręką w pakiecie mogło się pomylić) — plakietka
 * sama nigdy nie jest widoczna poza tym schowkiem.
 */
function blokZatwierdzony(url, niepewne) {
  if (!url) return '';
  return `<details class="stary">
    <summary>pokaż stary obraz z historii</summary>
    <p class="staryOpis">To stara notatka z historii — bywa błędna. Oceniasz tylko obraz na żywo.${
      niepewne ? ' <span class="niepewne">dopasowanie niepewne</span>' : ''
    }</p>
    <a href="${url}" target="_blank" rel="noopener"><img loading="lazy" class="staryImg" src="${url}" alt="stary obraz zatwierdzony (z historii)"></a>
  </details>`;
}

/** Blok obrazów karty: żywy na wierzchu, zatwierdzony schowany za tym samym przełącznikiem wszędzie. */
function blokObrazow(zatw, zywy, etykietaZywego, klasa, niepewne) {
  if (!zatw && !zywy) return '';
  return `<div class="obrazyKarty">
    ${figuraZywa(zywy, etykietaZywego, klasa)}
    ${blokZatwierdzony(zatw, niepewne)}
  </div>`;
}

/** `2026-09-05T08:56:56.122Z` → `08:56` (właściciel chce godzinę, nie znacznik czasu). */
function godzina(kiedy) {
  if (!kiedy) return '';
  const d = new Date(kiedy);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Etykiety przycisków — sekcja A pyta o zgodę na propozycję, B/C pytają o obraz na żywo. */
const ETYKIETY_PRZYCISKOW = {
  A: { tak: 'Tak, zgadzam się', nie: 'Nie, ma być inaczej' },
  BC: { tak: 'Tak, tak ma być', nie: 'Nie, ma być inaczej' },
};

/**
 * OGON KARTY — identyczny szkielet w A, B i C (dwa duże przyciski + jedno pole
 * uwagi), tekst przycisków zależy od sekcji (patrz `ETYKIETY_PRZYCISKOW`).
 * `wybor` jedzie z przyciskiem „tak" tylko w sekcji A (litera opcji, którą
 * rekomendujemy) — dzięki temu w rejestrze zostaje ślad, CO właściciel przyjął,
 * a nie samo „zgadza się".
 */
function ogonKarty(klucz, stan, zapis, wyborAkceptu, etykiety = ETYKIETY_PRZYCISKOW.BC) {
  const d = zapis || {};
  const uwaga = d.uwaga || '';
  const w = wyborAkceptu ? ` data-w="${esc(wyborAkceptu)}"` : '';
  return `<div class="przyciski">
    <button type="button" class="dbtn tak ${stan === 'AKCEPT' ? 'on' : ''}" data-k="${esc(klucz)}" data-d="AKCEPT"${w}>${esc(etykiety.tak)}</button>
    <button type="button" class="dbtn nie ${stan === 'POPRAWKA' ? 'on' : ''}" data-k="${esc(klucz)}" data-d="POPRAWKA">${esc(etykiety.nie)}</button>
  </div>
  <div class="zapis ${d.kiedy ? 'jest' : ''}">${d.kiedy ? `zapisano ${esc(godzina(d.kiedy))}` : ''}</div>
  <label class="uwPole">
    <span class="uwEtykieta">Uwaga — co ma być inaczej</span>
    <textarea class="uw" rows="2" data-k="${esc(klucz)}" placeholder="napisz jednym zdaniem, co ma być inaczej (np. „ma być jak stary obraz”)">${esc(uwaga)}</textarea>
  </label>
  <div class="podpowiedz" hidden>napisz jedną uwagę</div>`;
}

/** Zwinięte „szczegóły techniczne" — proza agentów nigdy nie wchodzi właścicielowi na twarz. */
function szczegoly(tekst) {
  if (!tekst) return '';
  return `<details class="tech"><summary>szczegóły techniczne</summary><p>${esc(tekst)}</p></details>`;
}

/**
 * Buduje całą stronę `/decyzje`.
 * `p`: { decyzjeOtwarte, status, zywoDir, evidenceRoot, pakietyDir, mdSeryjny, zapisane, zatwierdzoneZapasowe }
 *  - `zapisane`: mapa klucz → { decyzja, uwaga, wybor, kiedy } z tabeli `decyzje_zywo`
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

  /**
   * Obraz zatwierdzony + flaga „dopasowanie niepewne" (reguła 5 z 05.09).
   * Źródło z pakietu jest wpisane ręką — gdy ścieżka nie zawiera id ekranu,
   * ktoś mógł wkleić złą pozycję; ta plakietka to jedyny ślad tego ryzyka,
   * bo obraz i tak jest domyślnie schowany. Skan zapasowy (`evidence/grafika`)
   * dopasowuje po prefiksie NAZWY PLIKU == id, więc jest z definicji pewny.
   */
  const zatwierdzony = (id) => {
    if (zPakietow[id]) {
      const rel = zPakietow[id];
      return { url: urlEv(rel), niepewne: !String(rel).toLowerCase().includes(String(id).toLowerCase()) };
    }
    const zapas = zatwierdzoneZapasowe[id];
    if (zapas) {
      const rel = path.relative(evidenceRoot, zapas.pelna || zapas).split(path.sep).join('/');
      return { url: urlEv(rel), niepewne: false };
    }
    return { url: '', niepewne: false };
  };
  const urlZatwierdzonego = (id) => zatwierdzony(id).url;
  const urlZywego = (id) => {
    const w = wyniki[id];
    if (w && w.zrzut) return urlEv(w.zrzut);
    return '';
  };
  const nazwa = (id) => (nazwy[id] ? nazwy[id].nazwa : id);
  const modulEkranu = (id) => (nazwy[id] ? nazwy[id].modul : '');

  /* ---------- A. DECYZJE ---------- */
  const decyzje = decyzjeOtwarte.decyzje || [];
  const stanA = (d) => {
    const zapis = zapisane['DEC:' + d.id] || {};
    const s = normalizujDecyzje(zapis.decyzja);
    if (s === 'AKCEPT' || s === 'POPRAWKA') return s;
    // wersja 1 zapisywała samą literę: rekomendacja = akcept, druga opcja = poprawka
    if (s === 'A' || s === 'B') return s === d.rekomendacja ? 'AKCEPT' : 'POPRAWKA';
    return '';
  };
  const kartyA = decyzje
    .map((d) => {
      const klucz = 'DEC:' + d.id;
      const zapis = zapisane[klucz];
      const stan = stanA(d);
      const litera = d.rekomendacja === 'B' ? 'B' : 'A';
      const inna = litera === 'A' ? 'B' : 'A';
      const proponuje = (d.opcje && d.opcje[litera]) || '';
      const alternatywa = (d.opcje && d.opcje[inna]) || '';
      const miniatury = (d.ekrany || [])
        .map((id) => {
          const zat = zatwierdzony(id);
          return `<div class="para">
            <div class="paraNazwa">${esc(nazwa(id))} <code>${esc(id)}</code></div>
            ${blokObrazow(zat.url, urlZywego(id), 'Na żywo 05.09', 'srednia', zat.niepewne)}
          </div>`;
        })
        .join('');
      return `<article class="karta dec" data-sek="A" data-stan="${esc(stan)}" id="k-${esc(klucz)}">
        <div class="modul">${esc(d.modul || '')}</div>
        <p class="pytanie">${esc(d.pytanie)}</p>
        <div class="propozycja">
          <p class="propTekst"><b>Proponuję:</b> ${esc(proponuje)}</p>
          ${alternatywa ? `<p class="propInaczej"><b>Inaczej:</b> ${esc(alternatywa)}</p>` : ''}
        </div>
        ${miniatury ? `<div class="pary">${miniatury}</div>` : ''}
        ${ogonKarty(klucz, stan, zapis, litera, ETYKIETY_PRZYCISKOW.A)}
      </article>`;
    })
    .join('');
  const odpA = decyzje.filter((d) => stanA(d)).length;

  /* ---------- B. AKCEPT SERYJNY ---------- */
  const nowe = Object.values(wyniki).filter((w) => w.werdykt === 'NOWY_WZORZEC');
  const idNowe = new Set(nowe.map((w) => w.id));
  const wgKatalogu = new Map();
  for (const w of nowe.sort((a, b) => a.id.localeCompare(b.id))) {
    if (!wgKatalogu.has(w._katalog)) wgKatalogu.set(w._katalog, []);
    wgKatalogu.get(w._katalog).push(w);
  }
  const ZDANIE_B = 'Ekran przebudowany po Twoich wcześniejszych decyzjach — obraz zatwierdzony jest nieaktualny.';
  const grupyB = [...wgKatalogu.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([katalog, lista]) => {
      const karty = lista
        .map((w) => {
          const zapis = zapisane[w.id];
          const stan = normalizujDecyzje(zapis && zapis.decyzja);
          const zat = zatwierdzony(w.id);
          return `<article class="karta ekran" data-sek="B" data-stan="${esc(stan)}" id="k-${esc(w.id)}">
            <div class="modul">${esc(modulEkranu(w.id) || ladnyKatalog(katalog))}</div>
            <h4>${esc(nazwa(w.id))} <code>${esc(w.id)}</code></h4>
            <p class="poLudzku">${esc(zdaniePoPolsku(w.opis) || ZDANIE_B)}</p>
            ${szczegoly(w.opis)}
            ${blokObrazow(zat.url, urlZywego(w.id), 'Na żywo 05.09 — kliknij, żeby powiększyć', 'duza', zat.niepewne)}
            ${ogonKarty(w.id, stan, zapis)}
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
      const stan = normalizujDecyzje(zapis && zapis.decyzja);
      const zywy = w.id ? urlZywego(w.id) : '';
      const zat = w.id ? zatwierdzony(w.id) : { url: '', niepewne: false };
      return `<article class="karta ekran" data-sek="B" data-stan="${esc(stan)}" id="k-${esc(klucz)}">
        <div class="modul">${esc(w.sekcja)}</div>
        <h4>${esc(w.id ? nazwa(w.id) : 'pozycja z pakietu')} ${w.id ? `<code>${esc(w.id)}</code>` : ''}</h4>
        <p class="poLudzku">Tej pozycji nie widziałeś ani razu — obejrzyj i powiedz, czy zostaje.</p>
        ${szczegoly(w.tekst)}
        ${blokObrazow(zat.url, zywy, 'Na żywo 05.09', 'duza', zat.niepewne)}
        ${ogonKarty(klucz, stan, zapis)}
      </article>`;
    })
    .join('');
  const razemB = nowe.length + nigdy.length;
  const odpB =
    nowe.filter((w) => normalizujDecyzje((zapisane[w.id] || {}).decyzja)).length +
    nigdy.filter((w, i) => normalizujDecyzje((zapisane[w.id || 'SER:' + i] || {}).decyzja)).length;

  /* ---------- C. NAPRAWIONE DZIŚ ---------- */
  const ZDANIE_C = 'Naprawa weszła dziś. Sprawdź, czy wygląda jak obraz.';
  const kartyC = NAPRAWIONE_DZIS.map((n) => {
    const zapis = zapisane[n.id];
    const stan = normalizujDecyzje(zapis && zapis.decyzja);
    const dowodRel = n.dowod ? jesliJest(evidenceRoot, path.join(path.basename(zywoDir), n.katalog, n.dowod)) : '';
    const zwykly = jesliJest(evidenceRoot, path.join(path.basename(zywoDir), n.katalog, n.id + '.png'));
    const dowodUrl = dowodRel ? urlEv(dowodRel) : zwykly ? urlEv(zwykly) : urlZywego(n.id);
    const w = wyniki[n.id];
    const zat = zatwierdzony(n.id);
    return `<article class="karta ekran" data-sek="C" data-stan="${esc(stan)}" id="k-${esc(n.id)}">
      <div class="modul">${esc(modulEkranu(n.id) || ladnyKatalog(n.katalog))}</div>
      <h4>${esc(nazwa(n.id))} <code>${esc(n.id)}</code></h4>
      ${w && w.werdykt ? `<span class="werdykt w-${esc(w.werdykt)}">pomiar rundy 3: ${esc(ETYKIETA_WERDYKTU[w.werdykt] || w.werdykt)}</span>` : ''}
      <p class="poLudzku">${esc(ZDANIE_C)}</p>
      ${szczegoly(w && w.opis)}
      ${blokObrazow(zat.url, dowodUrl, n.dowod ? 'Dowód naprawy (dziś)' : 'Na żywo 05.09', 'duza', zat.niepewne)}
      ${ogonKarty(n.id, stan, zapis)}
    </article>`;
  }).join('');
  const odpC = NAPRAWIONE_DZIS.filter((n) => normalizujDecyzje((zapisane[n.id] || {}).decyzja)).length;

  const chip = (kod, nazwaSek, ile, razem) =>
    `<a class="lic" href="#sek-${kod}"><b>${kod}</b> <span class="licNazwa">${esc(nazwaSek)}</span> <span class="licN" data-lic="${kod}">${ile}</span><span class="licZ">/${razem}</span></a>`;

  return `<!doctype html><html lang="pl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Do decyzji i akceptu — 05.09</title><style>${STYL}</style></head><body>
<header class="pasek">
  <div class="paskGora">
    <h1>Do rozstrzygnięcia dziś</h1>
    <span class="stan" id="stan">gotowe</span>
  </div>
  <div class="paskDol">
    <nav class="liczniki">
      ${chip('A', 'Decyzje', odpA, decyzje.length)}
      ${chip('B', 'Nowy wzorzec', odpB, razemB)}
      ${chip('C', 'Naprawione dziś', odpC, NAPRAWIONE_DZIS.length)}
    </nav>
    <label class="filtr"><input type="checkbox" id="tylkoBez"> pokaż tylko bez odpowiedzi</label>
  </div>
</header>
<main>
  <ul class="jakTo">
    <li>Oceniasz tylko obraz „Na żywo” — to jest dzisiejsza aplikacja.</li>
    <li>Wygląda dobrze → Tak. Wygląda źle → Nie + jedno zdanie, co ma być inaczej.</li>
    <li>Stary obraz z historii jest schowany pod kartą; bywa błędny — nie kieruj się nim.</li>
  </ul>
  <section id="sek-A">
    <h2>A. Decyzje <small>odpowiedziano <span data-lic="A">${odpA}</span> / ${decyzje.length}</small></h2>
    <p class="wstep">Pytania, na których stoją agenci. Przy każdym jest moja propozycja — akceptujesz ją albo piszesz, czego chcesz inaczej.</p>
    <div class="kolumna">${kartyA || '<p class="pusto">Brak otwartych decyzji.</p>'}</div>
  </section>
  <section id="sek-B">
    <h2>B. Nowy wzorzec <small>odpowiedziano <span data-lic="B">${odpB}</span> / ${razemB}</small></h2>
    <p class="wstep">Ekrany, które dziś wyglądają inaczej niż stary obraz zatwierdzony, bo zmienił się wzorzec — nie dlatego, że coś się zepsuło.</p>
    ${grupyB || '<p class="pusto">Brak ekranów z werdyktem NOWY_WZORZEC.</p>'}
    ${
      kartyNigdy
        ? `<h3 class="grupa">nigdy nieoglądane <small>${nigdy.length}</small></h3>
           <p class="wstep">Pozycje z pakietu odbioru, których nie widziałeś ani razu.</p>
           <div class="siatka">${kartyNigdy}</div>`
        : ''
    }
  </section>
  <section id="sek-C">
    <h2>C. Naprawione dziś <small>odpowiedziano <span data-lic="C">${odpC}</span> / ${NAPRAWIONE_DZIS.length}</small></h2>
    <p class="wstep">Po lewej obraz zatwierdzony, po prawej dowód z dzisiaj. Plakietka mówi, co pokazał pomiar — jeśli brzmi „różni się”, naprawa główna weszła, ale coś jeszcze zostało. Rozstrzyga Twoje oko, nie nasz nagłówek.</p>
    <div class="siatka">${kartyC}</div>
  </section>
</main>
<script>${SKRYPT}</script>
</body></html>`;
}

export const STYL = `
:root{--tlo:#f6f7f9;--karta:#fff;--tekst:#111827;--drugi:#4b5563;--kres:#dfe3e8;--ok:#15803d;--pop:#b45309;--blad:#9f1239;--nieb:#1d4ed8;--wybrany:#111827}
*{box-sizing:border-box}
body{margin:0;background:var(--tlo);color:var(--tekst);font:17px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
.pasek{position:sticky;top:0;z-index:30;background:#fff;border-bottom:1px solid var(--kres);padding:12px 28px 10px}
.paskGora{display:flex;align-items:center;gap:16px}
.pasek h1{font-size:22px;margin:0;font-weight:680;letter-spacing:-.2px}
.paskDol{display:flex;align-items:center;gap:18px;flex-wrap:wrap;margin-top:9px}
.liczniki{display:flex;gap:10px}
.lic{display:inline-flex;gap:7px;align-items:baseline;text-decoration:none;color:var(--drugi);border:1px solid var(--kres);border-radius:999px;padding:6px 15px;font-size:15px;background:#fff}
.lic b{color:var(--tekst);font-size:15px}
.lic .licNazwa{color:var(--drugi)}
.lic .licN{font-variant-numeric:tabular-nums;font-weight:700;color:var(--ok)}
.lic .licZ{font-variant-numeric:tabular-nums;color:var(--drugi)}
.lic:hover{border-color:var(--nieb);color:var(--nieb)}
.filtr{display:inline-flex;align-items:center;gap:8px;font-size:15px;color:var(--drugi);cursor:pointer}
.filtr input{width:17px;height:17px;accent-color:var(--wybrany)}
.stan{margin-left:auto;font-size:14px;padding:5px 14px;border-radius:999px;background:#eef1f5;color:var(--drugi)}
.stan.dobrze{background:#dcfce7;color:#14532d}
.stan.zle{background:#fee2e2;color:#7f1d1d;font-weight:650}
main{padding:22px 28px 90px;max-width:1560px;margin:0 auto}
ul.jakTo{margin:0 0 26px;padding:14px 18px 14px 34px;background:#fff;border:1px solid var(--kres);border-radius:12px;font-size:16px;color:var(--tekst);max-width:110ch}
.jakTo li{margin:5px 0}
section{margin-bottom:52px;scroll-margin-top:120px}
h2{font-size:26px;margin:0 0 6px;font-weight:700;letter-spacing:-.3px}
h2 small{font-size:16px;font-weight:500;color:var(--drugi);margin-left:12px}
.wstep{margin:0 0 18px;color:var(--drugi);font-size:16px;max-width:96ch}
.grupa{font-size:18px;font-weight:650;margin:26px 0 10px;padding-bottom:6px;border-bottom:1px solid var(--kres)}
.grupa small{font-weight:500;color:var(--drugi);margin-left:8px;font-size:14px}
.kolumna{display:flex;flex-direction:column;gap:16px}
.siatka{display:flex;flex-direction:column;gap:16px}
.karta{background:var(--karta);border:1px solid var(--kres);border-radius:14px;padding:18px 20px}
.karta[data-stan="AKCEPT"]{border-color:#bbf7d0;box-shadow:inset 4px 0 0 var(--ok)}
.karta[data-stan="POPRAWKA"]{border-color:#fde68a;box-shadow:inset 4px 0 0 var(--pop)}
body.tylkoBez .karta[data-stan="AKCEPT"],body.tylkoBez .karta[data-stan="POPRAWKA"]{display:none}
.modul{font-size:13px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--drugi);margin-bottom:6px}
.pytanie{font-size:18px;line-height:1.55;margin:0 0 14px}
.propozycja{border-left:3px solid var(--kres);padding:2px 0 2px 14px;margin:0 0 14px}
.propTekst{margin:0;font-size:17px;line-height:1.55}
.propInaczej{margin:6px 0 0;font-size:14.5px;color:var(--drugi);line-height:1.5}
.karta h4{font-size:16.5px;margin:0 0 6px;font-weight:650}
.karta h4 code,.paraNazwa code{font-weight:400;font-size:12.5px;color:var(--drugi);background:#f1f3f7;border-radius:5px;padding:1px 6px;margin-left:6px}
.poLudzku{margin:0 0 8px;font-size:15.5px;color:var(--tekst);line-height:1.5}
.tech{margin:0 0 12px}
.tech summary{cursor:pointer;font-size:13px;color:var(--drugi);list-style:none;display:inline-flex;align-items:center;gap:6px;padding:3px 9px;border:1px solid var(--kres);border-radius:7px;background:#fbfcfd}
.tech summary::-webkit-details-marker{display:none}
.tech summary::before{content:"›";font-size:15px;line-height:1}
.tech[open] summary::before{content:"⌄"}
.tech p{margin:8px 0 0;font-size:13.5px;line-height:1.55;color:var(--drugi);background:#f7f9fb;border:1px solid var(--kres);border-radius:9px;padding:10px 12px;white-space:pre-wrap}
.werdykt{display:inline-block;font-size:12px;font-weight:700;border-radius:999px;padding:3px 10px;margin:0 0 8px;background:#eef1f5;color:var(--drugi)}
.werdykt.w-ZGODNY{background:#dcfce7;color:#14532d}
.werdykt.w-ROZNI_SIE{background:#fef3c7;color:#78350f}
.werdykt.w-DANE{background:#e0e7ff;color:#312e81}
.pary{display:flex;flex-wrap:wrap;gap:14px;margin-bottom:14px}
.para{flex:1 1 340px;min-width:0}
.paraNazwa{font-size:13.5px;color:var(--drugi);margin-bottom:4px}
.obrazyKarty{margin-bottom:4px}
.fig{margin:0 0 8px}
.fig figcaption{font-size:12px;color:var(--drugi);margin-bottom:4px}
/* PUŁAPKA (05.09): pierwsza wersja kadrowała miniatury przez object-fit:cover
   od GÓRY. Zrzuty modali (np. unified-create-launcher) to wyśrodkowane okno na
   szarej przesłonie — kadr od góry pokazywał właścicielowi czysty szary
   prostokąt, czyli obraz wyglądający na zepsuty. object-fit:contain pokazuje
   CAŁY zrzut, pomniejszony; pełny rozmiar jest o jedno kliknięcie dalej. */
.fig img{width:100%;display:block;border:1px solid var(--kres);border-radius:9px;background:#f8fafc;object-fit:contain;object-position:top center}
.fig.zywy.duza img{max-height:620px}
.fig.zywy.srednia img{max-height:420px}
.brakObrazu{border:1px dashed var(--kres);border-radius:9px;padding:26px 10px;text-align:center;font-size:13px;color:#9aa3ad;background:#fbfcfd}
/* Obraz zatwierdzony (WERSJA 3, 05.09): schowany za tekstowym przełącznikiem,
   ZAMKNIĘTY domyślnie — reguła właściciela: ocenia TYLKO obraz na żywo. */
.stary{margin:8px 0 0}
.stary summary{cursor:pointer;font-size:13.5px;color:var(--drugi);list-style:none;display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border:1px solid var(--kres);border-radius:8px;background:#fbfcfd}
.stary summary::-webkit-details-marker{display:none}
.stary summary::before{content:"›";font-size:15px;line-height:1}
.stary[open] summary::before{content:"⌄"}
.staryOpis{margin:9px 0 7px;font-size:13px;line-height:1.5;color:var(--drugi);background:#f7f9fb;border:1px solid var(--kres);border-radius:9px;padding:10px 12px}
.staryImg{width:100%;display:block;border:1px solid var(--kres);border-radius:9px;background:#f8fafc;object-fit:contain;max-height:420px}
.niepewne{display:inline-block;margin-left:6px;font-size:11px;font-weight:700;padding:2px 9px;border-radius:999px;background:#e5e7eb;color:#4b5563;white-space:nowrap}
.przyciski{display:flex;gap:12px;margin-top:14px}
.dbtn{flex:1 1 0;border:1.5px solid #c9ced6;background:#fff;color:var(--tekst);border-radius:11px;padding:14px 18px;cursor:pointer;font:650 17px/1.2 inherit;text-align:center}
.dbtn:hover{border-color:var(--wybrany)}
.dbtn.on{background:var(--wybrany);border-color:var(--wybrany);color:#fff}
.dbtn:focus-visible,.uw:focus-visible{outline:2px solid var(--nieb);outline-offset:2px}
.zapis{font-size:13.5px;margin-top:8px;min-height:19px;color:var(--drugi)}
.zapis.jest{color:var(--ok);font-weight:600}
.zapis.blad{color:var(--blad);font-weight:700}
.uwPole{display:block;margin-top:6px}
.uwEtykieta{display:block;font-size:13.5px;color:var(--drugi);margin-bottom:5px}
.uw{width:100%;border:1px solid var(--kres);border-radius:9px;padding:10px 12px;font:15.5px/1.5 inherit;resize:vertical;background:#fff;color:var(--tekst)}
.uw::placeholder{color:#9aa3ad}
.karta.prosiOUwage .uw{border-color:var(--pop);background:#fffbeb}
.podpowiedz{margin-top:6px;font-size:13.5px;color:var(--pop);font-weight:600}
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
function dwie(n) { return String(n).padStart(2, '0'); }
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
      const d = new Date(w.kiedy);
      if (znacznik) {
        znacznik.textContent = 'zapisano ' + dwie(d.getHours()) + ':' + dwie(d.getMinutes());
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
  const b = ev.target.closest('.dbtn');
  if (!b) return;
  const karta = b.closest('.karta');
  const nowa = karta.dataset.stan === b.dataset.d ? '' : b.dataset.d;
  karta.dataset.stan = nowa;
  karta.querySelectorAll('.dbtn').forEach((x) => x.classList.toggle('on', !!nowa && x.dataset.d === nowa));
  przelicz();
  // „Do poprawki" bez uwagi jest bezużyteczne dla wykonawcy — prosimy o jedno
  // zdanie, ALE decyzję zapisujemy i tak (nigdy nie gubimy kliknięcia właściciela).
  const pole = karta.querySelector('.uw');
  const podp = karta.querySelector('.podpowiedz');
  const prosi = nowa === 'POPRAWKA' && pole && !pole.value.trim();
  karta.classList.toggle('prosiOUwage', !!prosi);
  if (podp) podp.hidden = !prosi;
  if (prosi) pole.focus();
  const dane = { decyzja: nowa };
  if (nowa === 'AKCEPT' && b.dataset.w) dane.wybor = b.dataset.w;
  if (nowa === '') dane.wybor = '';
  wyslij(b.dataset.k, dane);
});
const stanPol = new Map();
function pole(k) { let s = stanPol.get(k); if (!s) { s = { timer: null, ostatnia: undefined }; stanPol.set(k, s); } return s; }
/*
 * ZMIERZONE 05.09 (Playwright, wersja 2): bez tej linii KAŻDE przeładowanie
 * strony wysyłało przez \`pagehide\` uwagę z KAŻDEGO pola — bo "ostatnia"
 * (undefined) nigdy nie równa się treści pola. Jedno wejście na stronę zakładało
 * 12 pustych wierszy w rejestrze właściciela i przestawiało znacznik czasu jego
 * prawdziwej odpowiedzi. Zapamiętujemy więc stan WYRENDEROWANY: wysyłamy tylko
 * to, co właściciel naprawdę zmienił.
 */
document.querySelectorAll('.uw').forEach((u) => { pole(u.dataset.k).ostatnia = u.value; });
function wyslijUwage(u) {
  const s = pole(u.dataset.k);
  clearTimeout(s.timer); s.timer = null;
  if (s.ostatnia === u.value) return;
  s.ostatnia = u.value;
  const karta = u.closest('.karta');
  if (karta && u.value.trim()) {
    karta.classList.remove('prosiOUwage');
    const podp = karta.querySelector('.podpowiedz');
    if (podp) podp.hidden = true;
  }
  wyslij(u.dataset.k, { uwaga: u.value });
}
document.addEventListener('input', (ev) => {
  const u = ev.target.closest('.uw'); if (!u) return;
  const s = pole(u.dataset.k);
  clearTimeout(s.timer);
  s.timer = setTimeout(() => wyslijUwage(u), 800);
});
document.addEventListener('focusout', (ev) => { const u = ev.target.closest('.uw'); if (u) wyslijUwage(u); });
document.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Enter' || ev.shiftKey) return;
  const u = ev.target.closest('.uw'); if (!u) return;
  ev.preventDefault();
  wyslijUwage(u);
  u.blur();
});
const przelacznik = document.getElementById('tylkoBez');
if (przelacznik) przelacznik.addEventListener('change', () => {
  document.body.classList.toggle('tylkoBez', przelacznik.checked);
});
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

/**
 * TRYB `/krok` (2026-09-05, prośba właściciela wprost): „przebuduj ją w taki
 * sposób, żeby było czytelne, łatwe i zrozumiałe, bo w obecnej strukturze na
 * pewno popełnimy błędy. Zatem jest to strasznie męczące." `/decyzje` pokazuje
 * WSZYSTKO naraz w trzech sekcjach — dobre do przeglądu, męczące do
 * rozstrzygania jeden po drugim. `/krok` to JEDEN ekran naraz: jedno pytanie,
 * jeden obraz, dwa duże przyciski. Zero starego obrazu (właściciel 05.09:
 * ocenia TYLKO obraz na żywo), zero prozy technicznej — to jest zredukowany,
 * nie inny, widok tych samych danych. Ten sam rejestr (`decyzje_zywo`, klucze
 * `DEC:<id>` / id ekranu) — jedna prawda, dwa okna na nią.
 *
 * `<id-pierwszy-znak>` w id ekranu: `-` → spacja, pierwsza litera wielka.
 * Używane tylko gdy `status.json`/pakiet nie znają ludzkiej nazwy ekranu.
 */
function humanizujId(id) {
  const s = String(id || '').replace(/-/g, ' ').trim();
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Płaska, uporządkowana lista pozycji do rozstrzygnięcia — jedna pozycja =
 * jeden ekran wizarda. Budowana z TYCH SAMYCH źródeł co `stronaDecyzje`
 * (sekcje A/B/C), więc `/krok` i `/decyzje` nigdy nie rozjadą się co do tego,
 * co jest do zrobienia — różni je tylko to, ile naraz się pokazuje.
 *
 * KOLEJNOŚĆ (żądanie właściciela): najpierw nieodpowiedziane, w porządku
 * sekcji A→B→C, grupowane wg modułu — tak, jak i tak grupuje je budowa sekcji
 * B (wg katalogu) i C (wg `NAPRAWIONE_DZIS`); potem odpowiedziane, w tym samym
 * porządku sekcji, żeby dało się je przejrzeć na końcu.
 */
export function zbierzPozycje(p) {
  const {
    decyzjeOtwarte = { decyzje: [] },
    status = { moduly: [] },
    zywoDir,
    evidenceRoot,
    mdSeryjny,
    zapisane = {},
  } = p;

  const wyniki = zbierzWyniki(zywoDir);
  const nazwy = indeksNazw(status);
  const nazwa = (id) => (nazwy[id] ? nazwy[id].nazwa : humanizujId(id));
  const modulEkranu = (id) => (nazwy[id] ? nazwy[id].modul : '');
  const urlZywego = (id) => {
    const w = wyniki[id];
    return w && w.zrzut ? urlEv(w.zrzut) : '';
  };

  const pozycje = [];

  /* ---------- A. DECYZJE ---------- */
  for (const d of decyzjeOtwarte.decyzje || []) {
    const klucz = 'DEC:' + d.id;
    const zapis = zapisane[klucz];
    const zapisana = normalizujDecyzje(zapis && zapis.decyzja);
    const litera = d.rekomendacja === 'B' ? 'B' : 'A';
    const inna = litera === 'A' ? 'B' : 'A';
    // wersja 1 zapisywała samą literę wybranej opcji — patrz `stanA` w `stronaDecyzje`.
    const stan =
      zapisana === 'A' || zapisana === 'B' ? (zapisana === d.rekomendacja ? 'AKCEPT' : 'POPRAWKA') : zapisana;
    const pierwszyEkran = (d.ekrany || [])[0] || '';
    pozycje.push({
      klucz,
      sekcja: 'A',
      modul: d.modul || '',
      tytul: (pierwszyEkran && nazwa(pierwszyEkran)) || d.modul || d.id,
      zywyUrl: pierwszyEkran ? urlZywego(pierwszyEkran) : '',
      pytanie: d.pytanie || '',
      proponuje: (d.opcje && d.opcje[litera]) || '',
      alternatywa: (d.opcje && d.opcje[inna]) || '',
      wybor: litera,
      stan,
      zapis,
    });
  }

  /* ---------- B. AKCEPT SERYJNY ---------- */
  const ZDANIE_B = 'Ten ekran wygląda dziś tak. Czy tak ma zostać?';
  const nowe = Object.values(wyniki)
    .filter((w) => w.werdykt === 'NOWY_WZORZEC')
    .sort((a, b) => a.id.localeCompare(b.id));
  const wgKatalogu = new Map();
  for (const w of nowe) {
    if (!wgKatalogu.has(w._katalog)) wgKatalogu.set(w._katalog, []);
    wgKatalogu.get(w._katalog).push(w);
  }
  for (const katalog of [...wgKatalogu.keys()].sort((a, b) => a.localeCompare(b))) {
    for (const w of wgKatalogu.get(katalog)) {
      const zapis = zapisane[w.id];
      pozycje.push({
        klucz: w.id,
        sekcja: 'B',
        modul: modulEkranu(w.id) || ladnyKatalog(katalog),
        tytul: nazwa(w.id),
        zywyUrl: urlZywego(w.id),
        zdanie: ZDANIE_B,
        stan: normalizujDecyzje(zapis && zapis.decyzja),
        zapis,
      });
    }
  }
  const idNowe = new Set(nowe.map((w) => w.id));
  wierszeNigdyNieogladane(mdSeryjny, idNowe).forEach((w, i) => {
    const klucz = w.id || 'SER:' + i;
    const zapis = zapisane[klucz];
    pozycje.push({
      klucz,
      sekcja: 'B',
      modul: w.sekcja,
      tytul: w.id ? nazwa(w.id) : 'Pozycja z pakietu',
      zywyUrl: w.id ? urlZywego(w.id) : '',
      zdanie: ZDANIE_B,
      stan: normalizujDecyzje(zapis && zapis.decyzja),
      zapis,
    });
  });

  /* ---------- C. NAPRAWIONE DZIŚ ---------- */
  const ZDANIE_C = 'Ten ekran został dziś naprawiony. Czy wygląda dobrze?';
  for (const n of NAPRAWIONE_DZIS) {
    const zapis = zapisane[n.id];
    const dowodRel = n.dowod ? jesliJest(evidenceRoot, path.join(path.basename(zywoDir), n.katalog, n.dowod)) : '';
    const zwykly = jesliJest(evidenceRoot, path.join(path.basename(zywoDir), n.katalog, n.id + '.png'));
    const dowodUrl = dowodRel ? urlEv(dowodRel) : zwykly ? urlEv(zwykly) : urlZywego(n.id);
    pozycje.push({
      klucz: n.id,
      sekcja: 'C',
      modul: modulEkranu(n.id) || ladnyKatalog(n.katalog),
      tytul: nazwa(n.id),
      zywyUrl: dowodUrl,
      zdanie: ZDANIE_C,
      stan: normalizujDecyzje(zapis && zapis.decyzja),
      zapis,
    });
  }

  // Nieodpowiedziane najpierw (w porządku A→B→C ustalonym wyżej), odpowiedziane na koniec.
  const bez = pozycje.filter((x) => !x.stan);
  const z = pozycje.filter((x) => x.stan);
  const finalne = [...bez, ...z];
  finalne.forEach((x, i) => {
    x.nr = i + 1;
  });
  return finalne;
}

/** Etykiety przycisków wizarda — sekcja A pyta o zgodę na propozycję, B/C o obraz na żywo. */
const ETYKIETY_KROK = {
  A: { tak: 'Tak, zgadzam się', nie: 'Nie' },
  BC: { tak: 'Tak, tak ma być', nie: 'Nie, ma być inaczej' },
};

function pozycjaHtml(x) {
  const etyk = x.sekcja === 'A' ? ETYKIETY_KROK.A : ETYKIETY_KROK.BC;
  const uwaga = (x.zapis && x.zapis.uwaga) || '';
  const obraz = x.zywyUrl
    ? `<a href="${x.zywyUrl}" target="_blank" rel="noopener"><img loading="lazy" src="${x.zywyUrl}" alt="${esc(x.tytul)}"></a>`
    : `<div class="brakObrazu">brak obrazu na żywo</div>`;
  const tresc =
    x.sekcja === 'A'
      ? `<p class="tresc"><span class="pyt">${esc(x.pytanie)}</span> <b>Proponuję:</b> ${esc(x.proponuje)}</p>
         ${x.alternatywa ? `<p class="inaczej">Inaczej: ${esc(x.alternatywa)}</p>` : ''}`
      : `<p class="tresc jedno">${esc(x.zdanie)}</p>`;
  return `<article class="krok" data-nr="${x.nr}" data-klucz="${esc(x.klucz)}" data-sekcja="${esc(x.sekcja)}"
    data-modul="${esc(x.modul)}" data-stan="${esc(x.stan || '')}" ${x.wybor ? `data-w="${esc(x.wybor)}"` : ''}>
    <div class="modul">${esc(x.modul)}</div>
    <h2 class="tytul">${esc(x.tytul)}</h2>
    ${tresc}
    <div class="obraz">${obraz}</div>
    <div class="przyciski">
      <button type="button" class="dbtn tak ${x.stan === 'AKCEPT' ? 'on' : ''}" data-d="AKCEPT">${esc(etyk.tak)}</button>
      <button type="button" class="dbtn nie ${x.stan === 'POPRAWKA' ? 'on' : ''}" data-d="POPRAWKA">${esc(etyk.nie)}</button>
    </div>
    <div class="zapis ${x.zapis && x.zapis.kiedy ? 'jest' : ''}">${x.zapis && x.zapis.kiedy ? `zapisano ${esc(godzina(x.zapis.kiedy))}` : ''}</div>
    <label class="uwPole">
      <span class="uwEtykieta">Co ma być inaczej? (jedno zdanie)</span>
      <textarea class="uw" rows="2" placeholder="napisz jednym zdaniem, co ma być inaczej">${esc(uwaga)}</textarea>
    </label>
    <div class="dalejWrap"><button type="button" class="dalejDuzy" hidden>Dalej →</button></div>
    <nav class="male">
      <button type="button" class="lnk wstecz">← wstecz</button>
      <button type="button" class="lnk pomin">pomiń</button>
      <button type="button" class="lnk dalej">dalej →</button>
    </nav>
  </article>`;
}

/**
 * Buduje całą stronę `/krok` — WSZYSTKIE pozycje wyrenderowane od razu
 * (jak `/decyzje`/`/zywo`), ale ukryte poza jedną aktywną: `SKRYPT_KROK`
 * przełącza widoczność i wysyła te same żądania `POST /decyzja-zywo` co
 * `/decyzje`. Zero przeładowania strony między ekranami — właściciel nie ma
 * czekać na sieć między jednym pytaniem a drugim.
 */
export function stronaKrok(p) {
  const pozycje = zbierzPozycje(p);
  const karty = pozycje.map(pozycjaHtml).join('\n');
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Do rozstrzygnięcia — jeden ekran naraz</title><style>${STYL_KROK}</style></head><body>
<header class="paskKrok">
  <div class="gora">
    <span id="opisEkranu"></span>
    <a class="lista" href="/decyzje">lista</a>
  </div>
  <div class="torProgresu"><div class="progres" id="progres"></div></div>
</header>
<main id="glowna">
${karty || '<p class="pusto">Brak pozycji do rozstrzygnięcia.</p>'}
<section class="podsumowanie" id="podsumowanie" hidden>
  <h2>Gotowe</h2>
  <p id="podsumowanieTekst"></p>
  <a class="lista duza" href="/decyzje">zobacz listę →</a>
</section>
</main>
<script>const CALKEM = ${pozycje.length};\n${SKRYPT_KROK}</script>
</body></html>`;
}

export const STYL_KROK = `
:root{--tlo:#f6f7f9;--karta:#fff;--tekst:#111827;--drugi:#4b5563;--kres:#dfe3e8;--ok:#15803d;--pop:#b45309;--blad:#9f1239;--nieb:#1d4ed8;--wybrany:#111827}
*{box-sizing:border-box}
body{margin:0;background:var(--tlo);color:var(--tekst);font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
.paskKrok{position:sticky;top:0;z-index:30;background:#fff;border-bottom:1px solid var(--kres);padding:14px 26px 12px}
.paskKrok .gora{display:flex;align-items:center;gap:16px;font-size:16px;color:var(--drugi)}
#opisEkranu{font-weight:650;color:var(--tekst)}
.lista{margin-left:auto;font-size:14px;color:var(--nieb);text-decoration:none}
.lista:hover{text-decoration:underline}
.torProgresu{margin-top:10px;height:6px;border-radius:999px;background:#eef1f5;overflow:hidden}
.progres{height:100%;background:var(--nieb);border-radius:999px;width:0%;transition:width .25s ease}
main{padding:26px 20px 90px;max-width:820px;margin:0 auto}
.krok{display:none;background:var(--karta);border:1px solid var(--kres);border-radius:16px;padding:26px 28px 22px}
.krok.aktywny{display:block}
.modul{font-size:13px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--drugi);margin-bottom:8px}
.tytul{font-size:22px;margin:0 0 14px;font-weight:700;letter-spacing:-.2px}
.tresc{font-size:18px;line-height:1.6;margin:0 0 6px}
.tresc.jedno{font-size:19px}
.inaczej{margin:0 0 16px;font-size:14.5px;color:var(--drugi);line-height:1.5}
.obraz{margin:14px 0 20px}
.obraz a{display:block}
.obraz img{width:100%;max-height:70vh;display:block;object-fit:contain;object-position:top center;border:1px solid var(--kres);border-radius:11px;background:#f8fafc;cursor:zoom-in}
.brakObrazu{border:1px dashed var(--kres);border-radius:11px;padding:40px 10px;text-align:center;font-size:14px;color:#9aa3ad;background:#fbfcfd}
.przyciski{display:flex;gap:12px}
.dbtn{flex:1 1 0;border:1.5px solid #c9ced6;background:#fff;color:var(--tekst);border-radius:13px;padding:18px 18px;cursor:pointer;font:700 18px/1.25 inherit;text-align:center}
.dbtn:hover{border-color:var(--wybrany)}
.dbtn.on{background:var(--wybrany);border-color:var(--wybrany);color:#fff}
.dbtn:focus-visible,.uw:focus-visible,.dalejDuzy:focus-visible{outline:2px solid var(--nieb);outline-offset:2px}
.zapis{font-size:14px;margin-top:10px;min-height:20px;color:var(--ok);font-weight:650}
.zapis.jest{color:var(--ok)}
.zapis.blad{color:var(--blad)}
.uwPole{display:block;margin-top:10px}
.uwEtykieta{display:block;font-size:14px;color:var(--drugi);margin-bottom:6px}
.uw{width:100%;border:1px solid var(--kres);border-radius:10px;padding:11px 13px;font:16px/1.5 inherit;resize:vertical;background:#fff;color:var(--tekst)}
.uw::placeholder{color:#9aa3ad}
.dalejWrap{margin-top:14px;min-height:0}
.dalejDuzy{border:1.5px solid var(--kres);background:#fff;color:var(--drugi);border-radius:12px;padding:13px 20px;font:650 16px/1.2 inherit;cursor:pointer;width:100%}
.dalejDuzy.pelne{background:var(--nieb);border-color:var(--nieb);color:#fff;font-weight:700}
.male{display:flex;gap:22px;justify-content:center;margin-top:22px}
.lnk{background:none;border:0;color:var(--drugi);font-size:14.5px;cursor:pointer;padding:4px 6px}
.lnk:hover{color:var(--nieb);text-decoration:underline}
.podsumowanie{background:var(--karta);border:1px solid var(--kres);border-radius:16px;padding:40px 28px;text-align:center}
.podsumowanie h2{font-size:26px;margin:0 0 10px}
.podsumowanie p{font-size:18px;color:var(--drugi);margin:0 0 22px}
.lista.duza{display:inline-block;font-size:16px;font-weight:650;padding:12px 22px;border-radius:11px;background:var(--wybrany);color:#fff;text-decoration:none}
.pusto{color:var(--drugi);text-align:center;padding:40px}
`;

export const SKRYPT_KROK = `
let obecny = 1;
const glowna = document.getElementById('glowna');
const opis = document.getElementById('opisEkranu');
const progres = document.getElementById('progres');
const podsum = document.getElementById('podsumowanie');
function aktywnyKrok() { return glowna.querySelector('.krok[data-nr="' + obecny + '"]'); }
function odswiezDalejDuzy(krok) {
  if (!krok) return;
  const btn = krok.querySelector('.dalejDuzy');
  const pole = krok.querySelector('.uw');
  const trzeba = krok.dataset.stan === 'POPRAWKA';
  btn.hidden = !trzeba;
  btn.classList.toggle('pelne', trzeba && !!pole.value.trim());
}
function pokaz(n) {
  obecny = Math.max(1, Math.min(CALKEM + 1, n));
  document.querySelectorAll('.krok').forEach((k) => {
    k.classList.toggle('aktywny', Number(k.dataset.nr) === obecny);
  });
  if (obecny > CALKEM || !CALKEM) {
    podsum.hidden = false;
    opis.textContent = 'Gotowe';
    progres.style.width = '100%';
    const wszystkie = [...document.querySelectorAll('.krok')];
    const tak = wszystkie.filter((k) => k.dataset.stan === 'AKCEPT').length;
    const nie = wszystkie.filter((k) => k.dataset.stan === 'POPRAWKA').length;
    const pominiete = wszystkie.length - tak - nie;
    document.getElementById('podsumowanieTekst').textContent =
      'Gotowe: ' + tak + ' tak · ' + nie + ' nie · ' + pominiete + ' pominięte';
    return;
  }
  podsum.hidden = true;
  const krok = aktywnyKrok();
  opis.textContent = 'Ekran ' + obecny + ' z ' + CALKEM + (krok ? ' · ' + krok.dataset.modul : '');
  progres.style.width = (obecny / CALKEM * 100) + '%';
  odswiezDalejDuzy(krok);
}
function ustawStan(krok, stan) {
  krok.dataset.stan = stan;
  krok.querySelectorAll('.dbtn').forEach((b) => b.classList.toggle('on', b.dataset.d === stan));
  odswiezDalejDuzy(krok);
}
function dwie(n) { return String(n).padStart(2, '0'); }
function wyslij(klucz, dane) {
  return fetch('/decyzja-zywo', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: klucz, ...dane }) })
    .then(async (r) => {
      const odp = await r.json().catch(() => ({}));
      if (!r.ok || !odp.ok) throw new Error(odp.blad || ('serwer odpowiedział ' + r.status));
      return odp;
    })
    .catch((e) => {
      const krok = glowna.querySelector('.krok[data-klucz="' + klucz.replace(/"/g, '') + '"]');
      const znacznik = krok && krok.querySelector('.zapis');
      if (znacznik) { znacznik.textContent = 'NIE ZAPISANO — ' + e.message; znacznik.className = 'zapis blad'; }
    });
}
const ostatniaUwaga = new Map();
document.querySelectorAll('.krok').forEach((k) => {
  const u = k.querySelector('.uw');
  ostatniaUwaga.set(k.dataset.klucz, u.value);
});
function zapiszUwage(krok) {
  const u = krok.querySelector('.uw');
  if (ostatniaUwaga.get(krok.dataset.klucz) === u.value) return;
  ostatniaUwaga.set(krok.dataset.klucz, u.value);
  odswiezDalejDuzy(krok);
  wyslij(krok.dataset.klucz, { uwaga: u.value });
}
function idzDalej() {
  const krok = aktywnyKrok();
  if (krok) zapiszUwage(krok);
  pokaz(obecny + 1);
}
function idzWstecz() { pokaz(obecny - 1); }
function naciskTak(krok) {
  ustawStan(krok, 'AKCEPT');
  const znacznik = krok.querySelector('.zapis');
  if (znacznik) { znacznik.textContent = 'zapisano ✓'; znacznik.className = 'zapis jest'; }
  const dane = { decyzja: 'AKCEPT' };
  if (krok.dataset.sekcja === 'A' && krok.dataset.w) dane.wybor = krok.dataset.w;
  wyslij(krok.dataset.klucz, dane);
  setTimeout(idzDalej, 600);
}
function naciskNie(krok) {
  ustawStan(krok, 'POPRAWKA');
  wyslij(krok.dataset.klucz, { decyzja: 'POPRAWKA' });
  const pole = krok.querySelector('.uw');
  pole.focus();
  // Kursor na KONIEC istniejącej treści — pole bywa już wypełnione starszą
  // uwagą właściciela, dopisujemy się za nią zamiast wjeżdżać na jej początek.
  const koniec = pole.value.length;
  pole.setSelectionRange(koniec, koniec);
}
document.addEventListener('click', (ev) => {
  const dbtn = ev.target.closest('.dbtn');
  if (dbtn) {
    const krok = dbtn.closest('.krok');
    if (dbtn.dataset.d === 'AKCEPT') naciskTak(krok); else naciskNie(krok);
    return;
  }
  if (ev.target.closest('.dalejDuzy') || ev.target.closest('.dalej') || ev.target.closest('.pomin')) return idzDalej();
  if (ev.target.closest('.wstecz')) return idzWstecz();
});
document.addEventListener('input', (ev) => {
  const u = ev.target.closest('.uw');
  if (!u) return;
  odswiezDalejDuzy(u.closest('.krok'));
});
document.addEventListener('focusout', (ev) => {
  const u = ev.target.closest('.uw');
  if (u) zapiszUwage(u.closest('.krok'));
});
document.addEventListener('keydown', (ev) => {
  const wPolu = ev.target.closest('.uw') || ev.target.tagName === 'INPUT' || ev.target.tagName === 'TEXTAREA';
  if (wPolu) {
    if (ev.key === 'Enter' && !ev.shiftKey) {
      ev.preventDefault();
      zapiszUwage(ev.target.closest('.krok'));
      idzDalej();
    }
    return;
  }
  const krok = aktywnyKrok();
  // PUŁAPKA zmierzona Playwrightem (05.09): „N" przełącza fokus na pole uwagi
  // W TYM SAMYM zdarzeniu klawisza — bez preventDefault przeglądarka i tak
  // wpisuje literę „n" do pola, które właśnie dostało fokus. Jedna owocna
  // uwaga właściciela dostała wtedy obcy znak na początku.
  if (ev.key === 't' || ev.key === 'T') { ev.preventDefault(); if (krok) naciskTak(krok); }
  else if (ev.key === 'n' || ev.key === 'N') { ev.preventDefault(); if (krok) naciskNie(krok); }
  else if (ev.key === 'ArrowRight') { ev.preventDefault(); idzDalej(); }
  else if (ev.key === 'ArrowLeft') { ev.preventDefault(); idzWstecz(); }
});
window.addEventListener('pagehide', () => {
  const krok = aktywnyKrok();
  if (krok) {
    const u = krok.querySelector('.uw');
    if (u && ostatniaUwaga.get(krok.dataset.klucz) !== u.value) {
      navigator.sendBeacon('/decyzja-zywo', new Blob([JSON.stringify({ id: krok.dataset.klucz, uwaga: u.value })], { type: 'application/json' }));
    }
  }
});
pokaz(1);
`;
