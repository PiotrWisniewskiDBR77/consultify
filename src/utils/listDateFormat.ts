/**
 * SSOT formatowania dat w LISTACH i PODGLĄDACH (kanon TRIADA).
 *
 * Powód istnienia (przegląd 128 zrzutów, 2026-07-27 — N-7, N-13, N-54, N-78, N-94):
 * aplikacja pokazywała SZEŚĆ formatów tej samej rzeczy — `24/07/2026`, `29d ago`,
 * `6/8/2026`, `Apr 20`, `30 Apr 2026`, `7/3/2026` — i nie były to warianty
 * świadome:
 *   - Interview → Sessions miał `7/21/2026` (M/D) w nazwie i `21/07/2026` (D/M)
 *     w kolumnie obok — TA SAMA data, dwa zapisy, jeden wiersz;
 *   - Tools → Reports pokazywał `30 Apr 2026` w podglądzie i `30/04/2026`
 *     w tabeli tuż obok;
 *   - Notebook mieszał `29d ago` i `6/8/2026` w JEDNEJ kolumnie.
 *
 * Przyczyna była mechaniczna: 270 wywołań `toLocaleDateString()` BEZ argumentu.
 * Taki zapis bierze locale z przeglądarki, a nie z języka konta — więc ten sam
 * rekord renderował się inaczej niż sąsiedni, który locale podawał jawnie.
 * Od 07-27 językiem UI steruje konto (patrz `i18n.ts`), i daty mają iść za nim.
 *
 * Reguły:
 *   1. Kolumna daty pokazuje datę ABSOLUTNĄ. Zapis względny („6 dni temu") może
 *      być podtytułem albo dymkiem — nigdy jedyną wartością w kolumnie, bo nie
 *      da się po nim sortować wzrokiem ani porównać dwóch wierszy.
 *   2. Locale jest zawsze JAWNE i pochodzi z konta.
 *   3. Brak daty to `—` (kanon C7), nie pusta komórka i nie `Invalid Date`.
 */

/**
 * Świadomie `i18next`, a NIE `@/i18n`.
 *
 * `@/i18n` to moduł INICJALIZUJĄCY: ciągnie `initReactI18next`, detektor języka
 * i backend HTTP. Import stąd wciągał to wszystko do każdego komponentu, który
 * formatuje datę — i wywalił cztery zestawy testów, które mockują
 * `react-i18next` bez eksportu `initReactI18next` (m.in.
 * `MyIdeasListContent.folders`, `apiGateway.stubRoutes.*`).
 *
 * `i18next` to sama instancja: `language` czyta się z niej tak samo, a nic się
 * przy okazji nie inicjalizuje.
 */
import i18n from 'i18next';

export const PUSTA_DATA = '—';

/** Język konta → tag BCP-47 do `Intl`. Nigdy nie zwraca `undefined`. */
export function localeListy(): string {
  const lng = String(i18n.language || '').toLowerCase();
  if (lng.startsWith('pl')) return 'pl-PL';
  if (lng.startsWith('de')) return 'de-DE';
  if (lng.startsWith('es')) return 'es-ES';
  if (lng.startsWith('ja') || lng.startsWith('jp')) return 'ja-JP';
  if (lng.startsWith('ar')) return 'ar';
  // Domyślnie brytyjski, nie amerykański: reszta produktu (breadcrumby, raporty,
  // eksporty) używa zapisu dzień-miesiąc-rok, a `en-US` wstawiłby M/D i wróciłby
  // dokładnie ten rozjazd, który ten plik likwiduje.
  return 'en-GB';
}

function naDate(value: unknown): Date | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  // Liczba to znacznik czasu, NIE tekst do sparsowania: `new Date(String(0))`
  // dałoby rok 2000, a `new Date(0)` — poprawny 1970. Wywołania w rodzaju
  // `formatListDate(x || 0)` istnieją w kodzie i muszą zachować się jak wcześniej.
  if (typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Data w komórce tabeli i w meta podglądu: **`DD/MM/YYYY`, jeden wzorzec
 * niezależnie od języka konta**.
 *
 * Decyzja (CTO, 2026-07-28): świadomie NIE oddajemy tego `Intl.DateTimeFormat`,
 * choć to kuszące. Powody:
 *   1. Piotr poprosił o „jeden format daty w całej aplikacji" — `Intl` dałby
 *      `24.07.2026` polskiemu kontu i `24/07/2026` angielskiemu, czyli dwa
 *      zapisy zamiast jednego.
 *   2. `24/07/2026` to zapis, który stoi dziś na ekranach i którego Piotr nie
 *      kwestionował — kwestionował NIESPÓJNOŚĆ. Przejście na kropki zmieniłoby
 *      wygląd każdej daty w produkcie przy okazji naprawy czegoś innego.
 * Ceną jest nietypowy zapis dla konta japońskiego; spójność wygrywa, bo to
 * produkt dla jednego zespołu konsultantów, nie globalny portal.
 */
export function formatListDate(value: unknown, fallback = PUSTA_DATA): string {
  const d = naDate(value);
  if (!d) return fallback;
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** Data z godziną — dla kolumn typu „ostatnia zmiana", gdy sama data nie wystarcza. */
export function formatListDateTime(value: unknown, fallback = PUSTA_DATA): string {
  const d = naDate(value);
  if (!d) return fallback;
  return `${formatListDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Zapis względny („6 dni temu") — WYŁĄCZNIE jako dopisek lub dymek przy dacie
 * absolutnej, nigdy zamiast niej (reguła 1). Zwraca `null`, gdy daty nie ma,
 * żeby wywołujący nie wstawił pustego nawiasu.
 */
export function formatRelativeHint(value: unknown, teraz: Date): string | null {
  const d = naDate(value);
  if (!d) return null;

  const sekundy = Math.round((d.getTime() - teraz.getTime()) / 1000);
  const progi: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 60 * 60 * 24 * 365],
    ['month', 60 * 60 * 24 * 30],
    ['week', 60 * 60 * 24 * 7],
    ['day', 60 * 60 * 24],
    ['hour', 60 * 60],
    ['minute', 60],
  ];

  const rtf = new Intl.RelativeTimeFormat(localeListy(), { numeric: 'auto' });
  for (const [jednostka, dlugosc] of progi) {
    if (Math.abs(sekundy) >= dlugosc) {
      return rtf.format(Math.round(sekundy / dlugosc), jednostka);
    }
  }
  return rtf.format(0, 'minute');
}

/**
 * Data + dymek ze zapisem względnym — gotowy zestaw dla komórki tabeli.
 * `{ text: '24/07/2026', title: '4 dni temu' }`
 */
export function listDateCell(value: unknown, teraz: Date): { text: string; title: string | null } {
  return { text: formatListDate(value), title: formatRelativeHint(value, teraz) };
}
