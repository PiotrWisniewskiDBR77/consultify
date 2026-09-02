/**
 * KARTY MODUŁÓW — dane i widok jednej karty modułu na stronie odbioru (2026-09-02).
 *
 * PO CO. Właściciel domyka licznik CLOSED_FINAL (2 z 16) i prosi wprost o „całość
 * 16 modułów do odbioru". To ma być JEGO OSTATNIE PRZEJŚCIE — jedna karta na moduł,
 * jedno kliknięcie na moduł — a nie kolejny przegląd trzystu ekranów.
 *
 * ŹRÓDŁA — wyłącznie te i w tej kolejności pierwszeństwa:
 *  1. docs/program/waves/WAVE_03_ACCEPTANCE/MAPA_GRAFIKA_MODULY_20260902.md
 *     — JEDYNE źródło przypisania ekranu do modułu i wszystkich LICZB na karcie.
 *       Nie liczymy niczego własnym mapowaniem po katalogach: 14 ekranów zmieniło
 *       przynależność wg pola `gdzie`, 15 jest wielomodułowych i nie liczy się
 *       nikomu, 14 leży poza 16 modułami. Własne liczenie rozjechałoby kartę
 *       z bramkami w modules/<moduł>/MODULE_ACCEPTANCE.md.
 *  2. docs/program/grafika/status.json — nazwy ekranów, oceny, opisy.
 *  3. docs/program/grafika/ODBIOR_DECYZJE.json — decyzje właściciela i JEGO uwagi
 *     (cytowane DOSŁOWNIE, nigdy parafrazowane).
 *  4. docs/program/grafika/KORPUS_UWAG_20260902.md — klasyfikacja uwag
 *     (ZROBIONE / DO_NAPRAWY / BACKLOG). Gdy pliku nie ma, sekcja „co zostaje
 *     otwarte" mówi to WPROST zamiast zgadywać — patrz `korpus()` niżej.
 */
import fs from 'fs';
import path from 'path';

import { ile, FORMY } from './liczebnik.mjs';

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/* ─────────────────────────── 1. mapowanie (SSOT liczb) ─────────────────────── */

/**
 * Parsuje sekcje `## <KOD> — <Nazwa>` z mapy. Zwraca też ekrany z tabeli, bo karta
 * musi umieć wypisać z NAZWY, czego moduł nie obejmuje (oceny C i D).
 */
export function czytajMape(root) {
  const p = path.join(root, 'docs/program/waves/WAVE_03_ACCEPTANCE/MAPA_GRAFIKA_MODULY_20260902.md');
  const txt = fs.readFileSync(p, 'utf8');
  const moduly = [];
  const sekcje = txt.split(/\n## /).slice(1);
  for (const s of sekcje) {
    const [naglowek] = s.split('\n');
    const m = naglowek.match(/^([0-9]{2}_[A-Z_0-9]+|WSPOLNE|POZA16)\s+—\s+(.+)$/);
    if (!m) continue;
    const [, kod, nazwa] = m;
    const licz = (etykieta) => {
      const r = s.match(new RegExp(etykieta.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ':\\s*\\*\\*(\\d+)\\*\\*'));
      return r ? Number(r[1]) : 0;
    };
    const dec = s.match(/decyzje:\s*ok\s*(\d+),\s*nie\s*(\d+),\s*poprawka\s*(\d+)/);
    const ekrany = [];
    for (const w of s.matchAll(/^\|\s*`([^`]+)`\s*\|\s*([ABCD])\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|/gm)) {
      ekrany.push({ id: w[1], ocena: w[2], decyzja: w[3].trim(), uwaga: w[4].trim() === '—' ? null : w[4].trim() });
    }
    moduly.push({
      kod, nazwa: nazwa.trim(),
      zmapowanych: licz('Ekranów zmapowanych'),
      doOdbioru: licz('A/B (mianownik odbioru)'),
      zDecyzja: licz('z decyzją'),
      poza: licz('C/D poza odbiorem'),
      zUwaga: licz('ekranów z merytoryczną uwagą właściciela'),
      ok: dec ? Number(dec[1]) : 0, nie: dec ? Number(dec[2]) : 0, poprawka: dec ? Number(dec[3]) : 0,
      ekrany,
    });
  }
  return moduly;
}

/* ───────────────────── 2. do czego moduł służy konsultantowi ───────────────── */

/**
 * Jedno zdanie na moduł, JĘZYKIEM KONSULTANTA — po co mu ten moduł w robocie
 * u klienta, nie co zawiera technicznie. Autorskie; świadomie nie generowane
 * z opisów katalogów, bo tamte mówią o ekranach, a właściciel pyta o robotę.
 */
export const DO_CZEGO = {
  '01_ORGANIZATION': 'Tu zbierasz i porządkujesz wiedzę o kliencie: kim jest, dokąd zmierza, co go blokuje i skąd to wiesz — zanim cokolwiek mu zaproponujesz.',
  '02_INTERVIEW': 'Tu prowadzisz rozmowy z ludźmi klienta i zamieniasz je we wnioski, które da się pokazać zarządowi.',
  '03_TOOLS': 'Tu masz warsztat konsultanta — mapy myśli, tablice, przepływy procesów, tabele pomysłów — czyli to, czym realnie pracujesz na sesji.',
  '04_ASSESSMENT': 'Tu oceniasz dojrzałość organizacji według metodyki i dostajesz z tego raport oraz prezentację dla klienta.',
  '05_INITIATIVES': 'Tu z wniosków robią się konkretne inicjatywy: co robimy, po co, za ile i kto za to odpowiada.',
  '06_EXECUTION': 'Tu pilnujesz, żeby uzgodnione inicjatywy naprawdę się działy — zadania, zasoby, bramki i raport z postępu.',
  '07_MY_WORK_AGENT': 'To Twój własny pulpit: co dziś do Ciebie należy, jakie decyzje na Ciebie czekają i co podpowiada agent.',
  '08_MEETINGS': 'Tu umawiasz i prowadzisz spotkania z klientem, razem ze stroną, przez którą klient sam rezerwuje termin.',
  '09_RESULTS': 'Tu pokazujesz, że doradztwo się opłaciło: wskaźniki, cele, zwrot z inwestycji i zestawienia okresowe.',
  '10_FINANCE': 'Tu liczysz pieniądze klienta: sprawozdania, modele, prognozy i wycenę.',
  '11_MATERIALS': 'Tu powstają rzeczy, które klient dostaje do ręki: dokumenty, prezentacje i arkusze.',
  '12_AUDITS': 'Tu prowadzisz audyt: rejestr ustaleń, warsztat i raport końcowy.',
  '13_CHAT': 'Tu rozmawiasz z Teresą i pracujesz na kanwie — to wejście do całej reszty systemu.',
  '14_ADMIN': 'Tu zarządzasz firmą w systemie: ludzie, uprawnienia, koszty, zgodność i nadzór nad AI.',
  '15_SETTINGS': 'Tu każdy ustawia sobie system pod siebie: profil, powiadomienia, integracje i prywatność.',
  '16_PARTNER': 'Tu obsługujesz partnerów, którzy sprzedają i wdrażają Consultify u swoich klientów.',
};

/* ───────────────────────────── 3. korpus uwag ──────────────────────────────── */

/**
 * Klasyfikacja uwag właściciela. ŚWIADOMIE nie budujemy własnej: nadzorca składa
 * równolegle KORPUS_UWAG_20260902.md i to on jest źródłem. Dopóki pliku nie ma,
 * karta mówi WPROST, że klasyfikacji jeszcze nie ma, i pokazuje surowe cytaty —
 * zamiast wymyślić własny podział, który za godzinę rozjedzie się z korpusem.
 */
export function korpus(root) {
  const p = path.join(root, 'docs/program/grafika/KORPUS_UWAG_20260902.md');
  if (!fs.existsSync(p)) return { jest: false, wg: {} };
  const txt = fs.readFileSync(p, 'utf8');
  const wg = {};
  /*
   * Wiersz korpusu ma SZEŚĆ kolumn:
   * | `ekran` | cytat dosłowny | data | decyzja pierwotna | `KLASA` | uzasadnienie |
   * Cytat bierzemy ZNAK W ZNAK — to są słowa właściciela i parafraza byłaby
   * podmianą dowodu. Klasa stoi w odwrotnych apostrofach, stąd `?` przy nich.
   */
  for (const w of txt.matchAll(
    /^\|\s*`([^`]+)`\s*\|([^|]*)\|([^|]*)\|([^|]*)\|\s*`?(ZROBIONE|DO_NAPRAWY|BACKLOG)`?\s*\|([^|]*)\|/gm
  )) {
    /* Tabela podsumowania na gorze korpusu ma ten sam ksztalt co rejestr i wpadala
       tu jako "ekran" o nazwie ZROBIONE z liczbami w kolumnach. Identyfikator ekranu
       jest z definicji malymi literami z myslnikami i nigdy nie jest nazwa klasy. */
    if (!/^[a-z0-9][a-z0-9-]*$/.test(w[1])) continue;
    (wg[w[1]] ??= []).push({
      klasa: w[5],
      uwaga: w[2].trim().replace(/^[„"]|[”"]$/g, ''),
      kiedy: w[3].trim(),
      domyka: w[6].trim(),
    });
  }
  return { jest: true, wg };
}

/* ─────────────── 4. co się zmieniło dziś · co wstrzymane · uwagi ───────────── */

/**
 * Naprawy z dzisiaj czytamy ze `status.json` (pole `naprawione`, wpisy z prefiksem
 * daty), a NIE z `odbior.sqlite`. Powód: baza jest w `.gitignore` — jest lokalna
 * i ulotna, więc karta oparta na niej znikłaby przy pierwszym świeżym pobraniu
 * repozytorium. Plik w repo jest jedyną trwałą kopią.
 */
export function naprawioneDzis(root, data = '2026-09-02') {
  const s = JSON.parse(fs.readFileSync(path.join(root, 'docs/program/grafika/status.json'), 'utf8'));
  const out = {};
  for (const m of s.moduly) for (const e of m.ekrany) {
    const wpis = (e.naprawione || []).find((x) => x.startsWith(data + ': '));
    if (wpis) out[e.id] = { nazwa: e.nazwa, opis: wpis.slice(data.length + 2) };
  }
  return out;
}

/**
 * Ekrany C/D z nazwą dla właściciela i JEDNYM ZDANIEM powodu.
 * Ekran, dla którego nie dało się ustalić powodu bez zgadywania, NIE ma tu wpisu
 * — karta powie wtedy wprost „powód dopisuję", zamiast podać wymyślony.
 */
export function pozaOdbiorem(root) {
  const p = path.join(root, 'docs/program/grafika/EKRANY_POZA_ODBIOREM_20260902.json');
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')).ekrany || {} : {};
}

/** Ekrany, których zrzut ujawnił defekt — świadomie NIE poszły jako „poprawione". */
export function wstrzymane(root) {
  const p = path.join(root, 'docs/program/grafika/WSTRZYMANE_20260902.json');
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')).ekrany || {} : {};
}

/** Nazwy ekranów po ludzku — karta nigdy nie pokazuje identyfikatora technicznego. */
export function nazwyEkranow(root) {
  const s = JSON.parse(fs.readFileSync(path.join(root, 'docs/program/grafika/status.json'), 'utf8'));
  const out = {};
  for (const m of s.moduly) for (const e of m.ekrany) out[e.id] = e.nazwa;
  return out;
}

/** Kiedy właściciel przyjął ekrany modułu — pierwsza i ostatnia decyzja. */
export function oknoDecyzji(root, idy) {
  const p = path.join(root, 'docs/program/grafika/ODBIOR_DECYZJE.json');
  if (!fs.existsSync(p)) return null;
  const czasy = (JSON.parse(fs.readFileSync(p, 'utf8')).decyzje || [])
    .filter((d) => idy.has(d.ekran) && d.kiedy).map((d) => new Date(d.kiedy).getTime()).sort((a, b) => a - b);
  if (!czasy.length) return null;
  const fmt = (t) => new Date(t).toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  return { od: fmt(czasy[0]), do: fmt(czasy.at(-1)), ile: czasy.length };
}

/* ────────────────────────────── 5. widok karty ─────────────────────────────── */

const MINI = (id) => `/png/216-poprawione-dzis/mini-${id}__PO__light.png`;
const PELNY = (id) => `/png/216-poprawione-dzis/${id}__PO__light.png`;

/**
 * Jedna karta modułu. Kolejność bloków jest ustalona przez właściciela i się nie
 * zmienia: do czego to służy · ile przyjąłeś · co się zmieniło dziś · co zostaje
 * otwarte · czego moduł NIE obejmuje · decyzja.
 */
export function kartaModulu(s, ctx) {
  const { naprawione, wstrz, nazwy, kor, poza = {}, decyzja = {} } = ctx;
  const idy = new Set(s.ekrany.map((e) => e.id));
  const okno = ctx.okno;

  const zmienione = s.ekrany.filter((e) => naprawione[e.id]);
  const wstrzymaneTu = s.ekrany.filter((e) => wstrz[e.id]);
  const cd = s.ekrany.filter((e) => e.ocena === 'C' || e.ocena === 'D');
  const uwagi = s.ekrany.filter((e) => e.uwaga);

  /**
   * GRUPOWANIE PO OPISIE NAPRAWY — nie po ekranie.
   *
   * Pierwsza wersja tej karty wypisywała 21 kafli Organizacji, z których DWADZIEŚCIA
   * miało co do znaku ten sam opis („boczne menu ma poprawione dwie literówki").
   * Obejrzałem własny zrzut i to jest ściana tekstu, którą właściciel przeskoczy —
   * a wtedy przeoczy ten JEDEN kafel, który mówi o czymś innym (zielona plakietka
   * REKOMENDOWANY). Powtórzenie nie dodaje informacji, tylko ją ukrywa.
   *
   * Dlatego: jedna naprawa = jeden blok („to samo na N ekranach") z siatką miniatur.
   * Naprawa dotycząca jednego ekranu wygląda tak samo, tylko N = 1.
   */
  const wgOpisu = new Map();
  for (const e of zmienione) {
    const o = naprawione[e.id].opis;
    if (!wgOpisu.has(o)) wgOpisu.set(o, []);
    wgOpisu.get(o).push(e);
  }
  // Najliczniejsze naprawy na górze — właściciel czyta od największej zmiany.
  const grupy = [...wgOpisu.entries()].sort((a, b) => b[1].length - a[1].length);

  const blokZmian = zmienione.length
    ? `<div class="mblok">
        <h4>Co się w tym module zmieniło dzisiaj <span class="licz">${zmienione.length}</span></h4>
        ${grupy.map(([opis, lista]) => `
          <div class="grupa">
            <p class="gopis">${esc(opis)}
              <span class="gile">na ${esc(ile(lista.length, FORMY.ekranie))}</span></p>
            <div class="mini">${lista.map((e) => `
              <figure><a href="${PELNY(e.id)}" target="_blank"><img loading="lazy" src="${MINI(e.id)}" alt=""></a>
              <figcaption>${esc((nazwy[e.id] || e.id).replace(new RegExp('^' + s.nazwa + ' [—-] '), ''))}</figcaption></figure>`).join('')}
            </div>
          </div>`).join('')}
        </div>`
    : `<div class="mblok pusto"><h4>Co się w tym module zmieniło dzisiaj</h4>
        <p>Nic. Ten moduł przyjąłeś wcześniej i dzisiejsze naprawy go nie dotknęły — oglądasz dokładnie to, co zatwierdziłeś.</p></div>`;

  /*
   * CO ZOSTAJE OTWARTE — rozstrzygające dla decyzji właściciela.
   *
   * Korpus dzieli jego uwagi na trzy klasy i tylko JEDNA z nich blokuje zamknięcie:
   *   DO_NAPRAWY — realna robota do zrobienia, moduł nie jest gotowy;
   *   BACKLOG    — życzenie na później, NIE blokuje (przenosimy i zamykamy);
   *   ZROBIONE   — już domknięte, pokazujemy, żeby wiedział, że nie zginęło.
   * Karta ma powiedzieć wprost, ile z tego BLOKUJE — inaczej właściciel widzi
   * listę uwag i zakłada najgorsze, choć większość to życzenia na później.
   */
  const zKorpusu = [];
  for (const e of s.ekrany) for (const k of (kor.wg[e.id] || [])) {
    zKorpusu.push({ nazwa: nazwy[e.id] || e.id, cytat: k.uwaga, domyka: k.domyka, klasa: k.klasa, kiedy: k.kiedy });
  }
  // Ekrany wstrzymane dziś przeze mnie to też otwarta sprawa — z moim powodem, nie jego cytatem.
  for (const e of wstrzymaneTu) {
    zKorpusu.push({ nazwa: nazwy[e.id] || e.id, cytat: null, domyka: wstrz[e.id], klasa: 'WSTRZYMANE', kiedy: null });
  }
  // Uwagi z mapy, których korpus nie objął — nie gubimy ich w ciszy.
  for (const e of uwagi) {
    if ((kor.wg[e.id] || []).length) continue;
    zKorpusu.push({ nazwa: nazwy[e.id] || e.id, cytat: e.uwaga, domyka: null, klasa: null, kiedy: null });
  }
  const RANGA = { DO_NAPRAWY: 0, WSTRZYMANE: 1, BACKLOG: 2, ZROBIONE: 3 };
  zKorpusu.sort((a, b) => (RANGA[a.klasa] ?? 1.5) - (RANGA[b.klasa] ?? 1.5));
  const blokuje = zKorpusu.filter((x) => x.klasa === 'DO_NAPRAWY' || x.klasa === 'WSTRZYMANE' || x.klasa === null).length;

  const werdykt = zKorpusu.length === 0
    ? '<p class="werdykt zielony">Nic tu nie zostało otwarte — możesz zamknąć ten moduł.</p>'
    : blokuje === 0
      ? `<p class="werdykt zielony">Nic z tego nie blokuje zamknięcia — ${esc(ile(zKorpusu.length, ['życzenie na później', 'życzenia na później', 'życzeń na później']))}. Przenosimy je do kolejki, a moduł możesz zamknąć.</p>`
      : blokuje === zKorpusu.length
        ? `<p class="werdykt zolty">Blokuje ${zKorpusu.length === 1 ? 'jedyna otwarta pozycja' : `wszystkie ${esc(ile(zKorpusu.length, FORMY.pozycja))}`} — ten moduł jeszcze nie jest gotowy do zamknięcia.</p>`
        : `<p class="werdykt zolty">Blokuje ${esc(ile(blokuje, FORMY.pozycja))} z ${zKorpusu.length}. Reszta to życzenia na później, które nie stoją zamknięciu na drodze.</p>`;

  const ETYK = { DO_NAPRAWY: 'do naprawy', BACKLOG: 'na później', ZROBIONE: 'już zrobione', WSTRZYMANE: 'wstrzymane przeze mnie' };
  const blokOtwarte = zKorpusu.length
    ? `<div class="mblok">
        <h4>Co w tym module zostaje otwarte <span class="licz">${zKorpusu.length}</span></h4>
        ${werdykt}
        <ul class="otwarte">${zKorpusu.map((x) => `<li class="w-${esc(x.klasa || 'NIEZNANE')}">
          <b>${esc(x.nazwa)}</b><span class="kl kl-${esc(x.klasa || 'NIEZNANE')}">${esc(ETYK[x.klasa] || 'bez klasyfikacji')}</span>
          ${x.cytat ? `<q>${esc(x.cytat)}</q>` : ''}
          ${x.domyka ? `<span class="domyka">${esc(x.domyka)}</span>` : ''}
        </li>`).join('')}</ul></div>`
    : `<div class="mblok pusto"><h4>Co w tym module zostaje otwarte</h4>
        ${werdykt}</div>`;

  const KAT = {
    PRZYRZAD: 'nasze narzędzie pomiarowe', NIEPODLACZONE: 'jeszcze niepodłączone', ANGIELSKI: 'jeszcze po angielsku',
    DUBLET: 'powtórka', TWOJA_DECYZJA: 'czeka na Twoją decyzję', WYREJESTROWANY: 'wycofane', HISTORYCZNY: 'wpis historyczny',
  };
  const blokPoza = cd.length
    ? `<div class="mblok szary"><h4>Czego ten moduł nie obejmuje <span class="licz">${cd.length}</span></h4>
        <p>Te ekrany nie szły do odbioru — świadomie ich nie pokazywaliśmy. Zamknięcie modułu ich nie dotyczy. Przy każdym piszę, dlaczego:</p>
        <ul class="pozalista">${cd.map((e) => {
          const o = poza[e.id];
          return `<li>
            <b>${esc(o?.nazwa || nazwy[e.id] || e.id)}</b>${o ? `<span class="kat">${esc(KAT[o.kategoria] || o.kategoria)}</span>` : '<span class="kat brak">powód dopisuję</span>'}
            ${o ? `<span class="ppowod">${esc(o.powod)}</span>` : '<span class="ppowod brak">Nie podaję powodu, dopóki nie jestem go pewien — wolę tu lukę niż zmyślone zdanie.</span>'}
          </li>`;
        }).join('')}</ul></div>`
    : `<div class="mblok szary pusto"><h4>Czego ten moduł nie obejmuje</h4>
        <p>Nic nie zostało poza odbiorem — wszystkie ekrany tego modułu były Ci pokazane.</p></div>`;

  const st = decyzja.decyzja || '';
  return `<article class="mk" id="m-${esc(s.kod)}" data-modul="${esc(s.kod)}" data-stan="${esc(st)}">
  <header>
    <h3>${esc(s.nazwa)}</h3>
    ${decyzja.decyzja === 'zamykam' ? '<span class="plom zam">zamknięty</span>' : decyzja.decyzja === 'jeszcze' ? '<span class="plom jesz">jeszcze nie</span>' : '<span class="plom">czeka na Twoją decyzję</span>'}
  </header>
  <p class="doczego">${esc(DO_CZEGO[s.kod] || '')}</p>
  <div class="liczby">
    <span><b>${s.doOdbioru}</b> ${esc(ile(s.doOdbioru, FORMY.ekran).replace(String(s.doOdbioru) + ' ', ''))} do odbioru</span>
    <span><b>${s.zDecyzja}</b> z nich przyjąłeś${okno ? ` <i>${okno.od === okno.do ? `— ${esc(okno.od)}` : `— od ${esc(okno.od)} do ${esc(okno.do)}`}</i>` : ''}</span>
    ${s.nie || s.poprawka ? `<span class="uw"><b>${s.nie + s.poprawka}</b> ${esc(ile(s.nie + s.poprawka, ['odrzucony lub do poprawki', 'odrzucone lub do poprawki', 'odrzuconych lub do poprawki']).replace(String(s.nie + s.poprawka) + ' ', ''))}</span>` : ''}
  </div>
  ${blokZmian}
  ${blokOtwarte}
  ${blokPoza}
  <div class="makcje">
    <button class="mb zamykam ${st === 'zamykam' ? 'on' : ''}" data-m="${esc(s.kod)}" data-d="zamykam">Zamykam moduł</button>
    <button class="mb jeszcze ${st === 'jeszcze' ? 'on' : ''}" data-m="${esc(s.kod)}" data-d="jeszcze">Jeszcze nie — powód</button>
    <a class="mb link" href="/?modul=${esc(s.kod)}" target="_blank">Pokaż wszystkie ekrany modułu</a>
  </div>
  <input class="mpowod" data-m="${esc(s.kod)}" placeholder="powód, jeśli jeszcze nie — zapisuje się sam" value="${esc(decyzja.powod || '')}">
  <div class="mzapis">${decyzja.kiedy && decyzja.decyzja ? `w bazie: ${esc(decyzja.decyzja === 'zamykam' ? 'Zamykam moduł' : 'Jeszcze nie')} · ${esc(new Date(decyzja.kiedy).toLocaleString('pl-PL'))}` : ''}</div>
</article>`;
}
