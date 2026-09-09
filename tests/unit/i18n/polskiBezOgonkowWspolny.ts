/**
 * WSPÓLNY DETEKTOR „polski bez ogonków" dla bezpieczników źródłowych paczki
 * J-DOG-C (2026-09-09).
 *
 * Port 1:1 algorytmu z `scripts/i18n/polski-bez-ogonkow.mjs` (przyrząd
 * pomocniczy tej paczki) do TS, żeby bezpieczniki źródłowe (`jezyk<Modul>.
 * source.test.ts`) mogły go zaimportować bez ryzyka rozjazdu definicji
 * „polskiego" między testem a przyrządem pomiarowym.
 *
 * DLACZEGO ISTNIEJE: `pomiar-jezyka.mjs` (funkcja `wykryjPolski`) rozpoznaje
 * polski głównie po diakrytykach i krótkiej liście `polskieSilne/Slabe`
 * z `pomiar-jezyka.wyjatki.json` — polski BEZ ogonków spoza tej listy
 * („Strategiczne", „Sekcje", „Kolor", „Priorytet", „Rozmiar czcionki")
 * przechodzi niewidoczny. Ten moduł buduje szerszy słownik: automatycznie
 * z `public/locales/pl/translation.json` (minus słowa, które są też
 * legalnym angielskim tokenem w `en/translation.json`) + ręczna lista
 * rdzeni.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../../..');

const MAPA_OGONKOW: Record<string, string> = {
  ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z',
  Ą: 'A', Ć: 'C', Ę: 'E', Ł: 'L', Ń: 'N', Ó: 'O', Ś: 'S', Ź: 'Z', Ż: 'Z',
};
function zdejmijOgonki(s: string): string {
  return String(s).replace(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, (ch) => MAPA_OGONKOW[ch] || ch);
}

const RDZENIE_RECZNE = [
  'zapisz', 'anuluj', 'dalej', 'wstecz', 'brak', 'szczegol', 'dodaj', 'usun',
  'edytuj', 'nowy', 'nowa', 'wybierz', 'zaloguj', 'wyloguj', 'ladowanie',
  'wczytywanie', 'blad', 'sukces', 'uwaga', 'prosze', 'czekaj', 'filtr',
  'sortuj', 'wyszukaj', 'pokaz', 'ukryj', 'wiecej', 'mniej', 'wszystkie',
  'zadne', 'potwierdz', 'odrzuc', 'zatwierdz', 'wyslij',
  'pobierz', 'otworz', 'zamknij', 'kopiuj', 'wklej', 'drukuj', 'eksport',
  'import', 'ustawienia', 'raport', 'inicjatyw', 'zadani', 'zadanie',
  'spotkani', 'notatk', 'decyzj', 'ryzyk', 'koszt', 'budzet', 'termin',
  'wlasciciel', 'odpowiedzialn', 'priorytet', 'status', 'etap', 'krok',
  'faza', 'obszar', 'poziom', 'ocena', 'wynik', 'podsumowanie', 'wniosk',
  'rekomendacj', 'zrodlo', 'dowod', 'zalacznik', 'uczestnik', 'organizacj',
  'uzytkownik', 'zespol', 'klient', 'partner', 'prowizj',
  'strategiczn', 'sekcj', 'macierz', 'akademi',
  // rdzenie zmierzone przez J-DOG-C w Materiałach/Assessment (2026-09-09):
  'kolor', 'rozmiar', 'czcionk', 'kursyw', 'pogrubien', 'punktowan',
  'numerowan', 'cytat', 'asystent', 'wykres', 'niebiesk', 'zielon',
  'czerwon', 'neutraln', 'wzrost', 'spadek', 'cofnij', 'element',
  'wiersz', 'kierunek', 'zmian', 'obraz', 'alternatywn', 'widok',
  'filtruj', 'audyt', 'notatk', 'aktywn', 'motyw', 'identyfikacj',
  'etykiet', 'konektor', 'konfiguracj', 'formularz', 'wersj', 'histori',
  'aktor', 'rewizj', 'proces', 'stanowisk', 'marnotraw',
].map((r) => r.toLowerCase());

const RDZENIE_KROTKIE = new Set(['tak', 'nie']);

function splaszcz(obj: Record<string, unknown>, out: string[] = []): string[] {
  for (const v of Object.values(obj)) {
    if (v && typeof v === 'object') splaszcz(v as Record<string, unknown>, out);
    else if (typeof v === 'string') out.push(v);
  }
  return out;
}
function slowaZTekstu(tekst: string): string[] {
  return String(tekst)
    .replace(/\{\{[^}]*\}\}/g, ' ')
    .replace(/\$\{[^}]*\}/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .split(/[^A-Za-zĄąĆćĘęŁłŃńÓóŚśŹźŻż]+/)
    .filter(Boolean)
    .map((w) => w.toLowerCase());
}

function zbudujSlowniki(): { auto: Map<string, string>; en: Set<string> } {
  const plJson = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'public/locales/pl/translation.json'), 'utf8')
  );
  const enJson = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'public/locales/en/translation.json'), 'utf8')
  );
  const plWartosci = splaszcz(plJson);
  const enWartosci = splaszcz(enJson);
  const enSlowa = new Set<string>();
  for (const w of enWartosci) for (const s of slowaZTekstu(w)) enSlowa.add(s);
  const auto = new Map<string, string>();
  for (const w of plWartosci) {
    for (const s of slowaZTekstu(w)) {
      const bezOgonkow = zdejmijOgonki(s);
      if (bezOgonkow.length < 4) continue;
      if (enSlowa.has(bezOgonkow)) continue;
      if (!auto.has(bezOgonkow)) auto.set(bezOgonkow, s);
    }
  }
  return { auto, en: enSlowa };
}

const { auto: SLOWNIK_AUTO, en: SLOWNIK_EN } = zbudujSlowniki();

function jestPolskimSlowem(slowoBezOgonkow: string): boolean {
  if (SLOWNIK_EN.has(slowoBezOgonkow)) return false;
  if (RDZENIE_KROTKIE.has(slowoBezOgonkow)) return true;
  if (SLOWNIK_AUTO.has(slowoBezOgonkow)) return true;
  for (const rdzen of RDZENIE_RECZNE) {
    if (slowoBezOgonkow.length >= 4 && slowoBezOgonkow.startsWith(rdzen)) return true;
  }
  return false;
}

/** true, gdy tekst zawiera co najmniej jedno słowo uznane za polskie (z ogonkami lub bez). */
export function czyPolskiBezOgonkow(tekst: string): boolean {
  const s = String(tekst).trim();
  if (s.length < 3) return false;
  for (const w of slowaZTekstu(s)) {
    if (jestPolskimSlowem(zdejmijOgonki(w))) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// pomoc wspólna dla bezpieczników `jezyk<Modul>.source.test.ts` — jeden
// algorytm skanowania, żeby 7 nowych plików paczki J-DOG-C nie rozjeżdżało
// się drobnymi różnicami we własnych regexach.
// ---------------------------------------------------------------------------
export interface PlikZrodlowy {
  nazwa: string;
  tekst: string;
}

/** Komentarze wygaszone spacjami — numery linii zostają nienaruszone. */
export function bezKomentarzy(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1: string) => p1 + ' '.repeat(m.length - p1.length));
}

function plikiRek(dir: string, wylaczone: Record<string, string>, out: string[] = []): string[] {
  let wpisy: fs.Dirent[];
  try {
    wpisy = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const wpis of wpisy) {
    const p = path.join(dir, wpis.name);
    if (wpis.isDirectory()) {
      if (wpis.name === '__tests__' || wpis.name === 'node_modules') continue;
      plikiRek(p, wylaczone, out);
      continue;
    }
    if (!/\.tsx?$/.test(wpis.name)) continue;
    if (/\.test\.tsx?$/.test(wpis.name)) continue;
    if (wylaczone[wpis.name]) continue;
    out.push(p);
  }
  return out;
}

/**
 * Zbiera pliki źródłowe (.ts/.tsx, bez testów) z listy katalogów (ścieżki
 * bezwzględne), z komentarzami wygaszonymi. `wylaczone` = mapa nazwa pliku ->
 * powód wyłączenia (patrz konwencja w istniejących bezpiecznikach modułowych).
 */
export function zbierzPlikiZrodlowe(
  katalogi: string[],
  wylaczone: Record<string, string> = {}
): PlikZrodlowy[] {
  const out: PlikZrodlowy[] = [];
  for (const dir of katalogi) {
    for (const p of plikiRek(dir, wylaczone)) {
      out.push({ nazwa: path.relative(dir, p), tekst: bezKomentarzy(fs.readFileSync(p, 'utf8')) });
    }
  }
  return out;
}

const WZORZEC_T_DEFAULT = /\bt\(\s*(?:'[^']+'|"[^"]+"|`[^`]+`)\s*,\s*(['"])((?:\\.|(?!\1)[^\\])*)\1/g;
// tag/tekst mogą być w osobnych liniach, ale sam przechwycony tekst musi być
// jednoliniowy (żeby nie łapać kodu rozlanego na wiele linii jak w mjs).
const WZORZEC_JSX_TEKST = />[ \t\r\n]*([^<>{}'"`;=\n][^<>{}'"`;=\n]*)[ \t\r\n]*</g;
const WZORZEC_ATRYBUTY =
  /\b(title|placeholder|aria-label|label|openLabel|emptyText|subtitle)\s*=\s*"([^"]+)"/g;

/** generyki TS (`Foo<Bar<Baz>>`) i wyrażenia (`krok.wielokrotny ? (`) też
 * pasują do `>...<` — odrzuć te dwa kształty kodu, nie napisu na ekranie. */
function wygladaJakKod(kandydat: string): boolean {
  const s = kandydat.trim();
  if (/^[A-Za-z_$][\w.[\]']*\s*\?\s*\(?\s*$/.test(s)) return true;
  if (/^[A-Za-z_$][\w]*(\.[A-Za-z_$][\w]*)+$/.test(s)) return true;
  return false;
}

/** Zwraca listę `plik: "tekst"` dla polskich defaultValue w t(...). */
export function znajdzPolskieDefaultValue(zrodla: PlikZrodlowy[]): string[] {
  const trafienia: string[] = [];
  for (const { nazwa, tekst } of zrodla) {
    WZORZEC_T_DEFAULT.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = WZORZEC_T_DEFAULT.exec(tekst))) {
      if (czyPolskiBezOgonkow(m[2])) trafienia.push(`${nazwa}: „${m[2]}"`);
    }
  }
  return trafienia;
}

/** Zwraca listę `plik: "tekst"` dla polskich napisów w JSX/atrybutach poza t(). */
export function znajdzPolskiJsx(zrodla: PlikZrodlowy[]): string[] {
  const trafienia: string[] = [];
  for (const { nazwa, tekst } of zrodla) {
    for (const wzorzec of [WZORZEC_JSX_TEKST, WZORZEC_ATRYBUTY]) {
      wzorzec.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = wzorzec.exec(tekst))) {
        const wartosc = m[m.length - 1];
        if (wygladaJakKod(wartosc)) continue;
        if (czyPolskiBezOgonkow(wartosc)) trafienia.push(`${nazwa}: „${wartosc.trim()}"`);
      }
    }
  }
  return trafienia;
}

// ---------------------------------------------------------------------------
// TEST-DANE D-02 (09.09.2026) — trzeci kształt polskiego napisu, którego dwa
// powyższe detektory NIE widzą: literał w obiekcie konfiguracyjnym poza JSX
// i poza `t()`. Tak przeszło pięć pełnych polskich akapitów prawnych
// (SIRI/ADMA/CMMI/Lean) oraz nazwy osi „Pomierz/Zoptymalizuj/Automatyzuj"
// w `src/services/frameworkRegistry.ts` — plik-rejestr, nie komponent, więc
// `znajdzPolskiJsx` i `znajdzPolskieDefaultValue` mijały go co do jednego.
// ---------------------------------------------------------------------------

/** `klucz: 'wartość'` w literale obiektu — jedno- i wielolinijkowe. */
const WZORZEC_LITERAL_POLA =
  /\b([A-Za-z_$][\w]*)\s*:\s*(?:\n\s*)?(['"])((?:\\.|(?!\2)[^\\])*)\2/g;

/**
 * Pola, których wartość NIE jest napisem na ekranie (identyfikatory, klasy,
 * ikony, klucze i18n, kolory). Bez tej listy detektor zgłaszałby kod.
 */
const POLA_NIEWIDOCZNE = new Set([
  'id',
  'key',
  'icon',
  'color',
  'colorDark',
  'className',
  'testId',
  'type',
  'status',
  'legalNoticeType',
  'legalNoticeKey',
  'descriptionKey',
  'nameKey',
  'href',
  'path',
  'route',
]);

/**
 * Zwraca listę `plik: pole = "tekst"` dla polskich napisów przypisanych do pól
 * literałów obiektowych (rejestry, katalogi, konfiguracje) poza `t()`.
 */
export function znajdzPolskieLiteralyPol(zrodla: PlikZrodlowy[]): string[] {
  const trafienia: string[] = [];
  for (const { nazwa, tekst } of zrodla) {
    WZORZEC_LITERAL_POLA.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = WZORZEC_LITERAL_POLA.exec(tekst))) {
      const pole = m[1];
      const wartosc = m[3];
      if (POLA_NIEWIDOCZNE.has(pole)) continue;
      if (czyPolskiBezOgonkow(wartosc)) trafienia.push(`${nazwa}: ${pole} = „${wartosc}"`);
    }
  }
  return trafienia;
}

/** Wczytuje pojedyncze pliki (ścieżki bezwzględne) z wygaszonymi komentarzami. */
export function zbierzPliki(sciezki: string[]): PlikZrodlowy[] {
  return sciezki.map((p) => ({
    nazwa: path.basename(p),
    tekst: bezKomentarzy(fs.readFileSync(p, 'utf8')),
  }));
}
