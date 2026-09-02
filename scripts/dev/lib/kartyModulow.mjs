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
  // Wiersz tabeli: | `ekran` | KLASA | ... | co domyka |
  for (const w of txt.matchAll(/^\|\s*`([^`]+)`\s*\|\s*(ZROBIONE|DO_NAPRAWY|BACKLOG)\s*\|([^|]*)\|([^|]*)\|/gm)) {
    (wg[w[1]] ??= []).push({ klasa: w[2], uwaga: w[3].trim(), domyka: w[4].trim() });
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
  const { naprawione, wstrz, nazwy, kor, decyzja = {} } = ctx;
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
              <span class="gile">${lista.length === 1 ? 'na 1 ekranie' : `na ${lista.length} ekranach`}</span></p>
            <div class="mini">${lista.map((e) => `
              <figure><a href="${PELNY(e.id)}" target="_blank"><img loading="lazy" src="${MINI(e.id)}" alt=""></a>
              <figcaption>${esc((nazwy[e.id] || e.id).replace(new RegExp('^' + s.nazwa + ' [—-] '), ''))}</figcaption></figure>`).join('')}
            </div>
          </div>`).join('')}
        </div>`
    : `<div class="mblok pusto"><h4>Co się w tym module zmieniło dzisiaj</h4>
        <p>Nic. Ten moduł przyjąłeś wcześniej i dzisiejsze naprawy go nie dotknęły — oglądasz dokładnie to, co zatwierdziłeś.</p></div>`;

  const pozycjeOtwarte = [];
  for (const e of uwagi) {
    const k = kor.jest ? (kor.wg[e.id] || []) : [];
    const domyka = k.length ? k.map((x) => x.domyka).filter(Boolean).join(' · ') : null;
    pozycjeOtwarte.push({ nazwa: nazwy[e.id] || e.id, cytat: e.uwaga, domyka, klasa: k[0]?.klasa || null });
  }
  for (const e of wstrzymaneTu) {
    pozycjeOtwarte.push({ nazwa: nazwy[e.id] || e.id, cytat: null, domyka: wstrz[e.id], klasa: 'WSTRZYMANE' });
  }

  const blokOtwarte = pozycjeOtwarte.length
    ? `<div class="mblok">
        <h4>Co w tym module zostaje otwarte <span class="licz">${pozycjeOtwarte.length}</span></h4>
        ${!kor.jest && uwagi.length ? `<p class="brakkorpusu">Twoje uwagi cytuję dosłownie. Klasyfikacji („zrobione / do naprawy / na później") jeszcze nie ma — powstaje osobno i celowo jej tu nie wymyślam.</p>` : ''}
        <ul class="otwarte">${pozycjeOtwarte.map((x) => `<li>
          <b>${esc(x.nazwa)}</b>${x.klasa ? `<span class="kl kl-${esc(x.klasa)}">${esc(x.klasa === 'WSTRZYMANE' ? 'wstrzymane' : x.klasa.toLowerCase().replace('_', ' '))}</span>` : ''}
          ${x.cytat ? `<q>${esc(x.cytat)}</q>` : ''}
          ${x.domyka ? `<span class="domyka">${esc(x.domyka)}</span>` : ''}
        </li>`).join('')}</ul></div>`
    : `<div class="mblok pusto"><h4>Co w tym module zostaje otwarte</h4>
        <p>Nic. Nie zostawiłeś tu żadnej uwagi, której byśmy nie domknęli.</p></div>`;

  const blokPoza = cd.length
    ? `<div class="mblok szary"><h4>Czego ten moduł nie obejmuje <span class="licz">${cd.length}</span></h4>
        <p>Te ekrany nie szły do odbioru — świadomie ich nie pokazywaliśmy. Zamknięcie modułu ich nie dotyczy:</p>
        <ul class="poza">${cd.map((e) => `<li>${esc(nazwy[e.id] || e.id)} <span class="o o${esc(e.ocena)}">${esc(e.ocena)}</span></li>`).join('')}</ul></div>`
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
    <span><b>${s.doOdbioru}</b> ekranów do odbioru</span>
    <span><b>${s.zDecyzja}</b> z Twoją decyzją${okno ? ` <i>${okno.od === okno.do ? `— przyjęte ${esc(okno.od)}` : `— od ${esc(okno.od)} do ${esc(okno.do)}`}</i>` : ''}</span>
    ${s.nie || s.poprawka ? `<span class="uw"><b>${s.nie + s.poprawka}</b> odrzucone lub do poprawki</span>` : ''}
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
  <div class="mzapis">${decyzja.kiedy ? `w bazie: ${esc(decyzja.decyzja === 'zamykam' ? 'Zamykam moduł' : 'Jeszcze nie')} · ${esc(new Date(decyzja.kiedy).toLocaleString('pl-PL'))}` : ''}</div>
</article>`;
}
