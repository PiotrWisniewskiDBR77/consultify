/**
 * KANON SZEROKOŚCI KOLUMN (K5-7, 2026-09-13) — mechanika w JEDNYM miejscu.
 *
 * ODCHYLENIE ZMIERZONE (odbiór właściciela, staging `cf3fded7e4`, ciemny
 * motyw, 1440×900): „wszędzie preview i tabele nie są całkiem zgodne
 * z formułą" — konkretnie T1: „kolumny tabel dzielone po równo", nagłówki
 * ucięte („DAYS OVERI", „PLANNED WINDO"), długie teksty łamane na 3–4 linie,
 * kolumny z samymi „—" tak samo szerokie jak tytuł.
 *
 * PRZYCZYNA (zmierzona w kodzie, nie z oka):
 *   1. `FilterableTable` renderuje `<table className="w-full table-fixed">`
 *      z jawnym `width` na każdej kolumnie. Gdy SUMA szerokości jest MNIEJSZA
 *      niż kontener, `table-fixed` rozdziela nadmiar PROPORCJONALNIE na
 *      wszystkie kolumny — więc kolumna z samymi „—" puchnie dokładnie tak
 *      samo jak kolumna tytułowa. To jest dosłownie „dzielone po równo",
 *      którego nie widać w żadnej deklaracji ekranu, bo robi to przeglądarka.
 *   2. Gdy suma jest WIĘKSZA niż kontener (Inicjatywy: 11 kolumn × średnio
 *      163 px = 1790 px przy 1440 px), `columnFit` ściska wszystko do podłóg
 *      — także kolumny, które i tak niosą trzy znaki. Zabrana szerokość
 *      brakuje kolumnom prozy, więc „Monitor the execution" łamie się na dwie
 *      linie i wiersz rośnie z kanonicznych 56 px.
 *
 * ZASADA KANONU (TABLE_AND_PREVIEW_CANON §3.3 „każda kolumna: jawne min/max
 * width", TRIADA §B): szerokość kolumny wynika z JEJ TREŚCI i JEJ TYPU, nie
 * z równego podziału. Kolumna tytułowa rośnie i zabiera luz; kolumny stanowe
 * (chip/status/data/liczba/osoba) mają wąskie sufity i luzu nie dostają.
 *
 * ŚWIADOMIE: te funkcje są CZYSTE i bez DOM-u (pomiar tekstu wstrzykiwany),
 * żeby dało się je przetestować i zmutować bez przeglądarki.
 */

import type React from 'react';

export type CanonColumnDataType = 'text' | 'status' | 'date' | 'owner' | 'number';

/**
 * Sufity szerokości per typ — kolumna „stanowa" nigdy nie rośnie jak proza.
 * Wartości z pomiaru treści, nie z oka: „Pending approval" (najdłuższy status
 * w rejestrze Inicjatyw) to 112 px tekstu + 32 px `px-4` = 144 px; zakres dat
 * „09/08/2026 — 02/11/2026" to 150 px + 32 = 182 px, ale kanon §3.3 każe
 * skracać datę, nie rozpychać kolumnę, więc sufit stoi niżej.
 */
export const COLUMN_MAX_WIDTH_BY_DATA_TYPE: Record<CanonColumnDataType, number> = {
  text: 320,
  status: 160,
  date: 180,
  owner: 190,
  number: 120,
};

/** Budżet poziomy komórki: `px-4` (2×16 px) + 8 px zapasu na kursor/ikonę. */
export const CELL_CONTENT_PADDING_PX = 40;

/** Ile wierszy próbkujemy przy pomiarze treści (reszta nic już nie zmienia). */
export const CONTENT_SAMPLE_ROWS = 40;

/**
 * Wzorce działają na haystacku ZNORMALIZOWANYM (camelCase rozbity na słowa,
 * patrz `slowaKolumny`) i z granicą słowa `\b`.
 *
 * Bez tego „daysOverdue" trafiało w `due` ze środka słowa „Overdue" i kolumna
 * LICZBOWA dostawała sufit daty. To nie jest hipotetyczne: „DAYS OVERDUE" to
 * jedna z kolumn ze zrzutu właściciela (ucięta jako „DAYS OVERI").
 */
const STATUS_PATTERN =
  /\b(status|state|stage|gate|readiness|health|priority|severity|confidence|risk|phase|etap|stan|gotowosc|gotowość|priorytet|pewnosc|pewność)\b/i;
const DATE_PATTERN =
  /\b(date|updated|created|modified|deadline|due|window|start|end|period|termin|data|okno|aktualizacja|utworzono)\b/i;
const OWNER_PATTERN =
  /\b(owner|assignee|assigned|author|responsible|manager|user|member|person|wlasciciel|właściciel|osoba|autor|odpowiedzialny)\b/i;
const NUMBER_PATTERN =
  /\b(count|total|amount|budget|score|progress|percent|share|qty|quantity|number|days|hours|value|liczba|kwota|ilosc|ilość|udzial|udział|wartosc|wartość|dni|godziny)\b/i;

/** „daysOverdue" → „days Overdue" — żeby `\b` miało na czym pracować. */
const slowaKolumny = (id: string, label?: string): string =>
  `${id.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ')} ${label ?? ''}`;

const NUMERIC_VALUE = /^[-+]?[\d\s.,%]+$/;
const DATE_VALUE = /^\d{1,4}[./-]\d{1,2}([./-]\d{1,4})?/;

/**
 * Typ kolumny: deklaracja modułu ma pierwszeństwo, potem nazwa/etykieta,
 * na końcu KSZTAŁT DANYCH. Kolumna bez typu nie zostaje „tekstem" z automatu —
 * to był cichy powód, dla którego kolumna dat dostawała sufit prozy.
 */
export const inferColumnDataType = (
  column: { id: string; label?: string; dataType?: CanonColumnDataType },
  samples: string[] = []
): CanonColumnDataType => {
  if (column.dataType) return column.dataType;

  const haystack = slowaKolumny(column.id, column.label);
  if (OWNER_PATTERN.test(haystack)) return 'owner';
  if (DATE_PATTERN.test(haystack)) return 'date';
  if (STATUS_PATTERN.test(haystack)) return 'status';
  if (NUMBER_PATTERN.test(haystack)) return 'number';

  const realne = samples.map((s) => s.trim()).filter((s) => s.length > 0 && s !== '—');
  if (realne.length === 0) return 'text';
  if (realne.every((s) => DATE_VALUE.test(s))) return 'date';
  if (realne.every((s) => NUMERIC_VALUE.test(s))) return 'number';
  return 'text';
};

/**
 * Tekst komórki rozbity na LINIE.
 *
 * Po co nie jeden string: moduły renderują komórki dwupiętrowe
 * (`h('div', {}, h('span', tytuł), h('span', opis))`). Sklejenie w jeden ciąg
 * dałoby szerokość sumy obu pięter i kolumna urosłaby dwukrotnie ponad
 * potrzebę. Reguła: sąsiadujące teksty w TYM SAMYM elemencie to jedna linia,
 * zagnieżdżony element zaczyna nową.
 *
 * ŚWIADOMIE bez DOM-u: to statyczny obchód drzewa elementów Reacta, więc
 * działa w teście node'owym tak samo jak w przeglądarce.
 *
 * ── TEKST NIESIONY PROPEM `content` (SCALENIE 2026-09-13) ──────────────────
 *
 * Obchód po samych `children` ma ŚLEPĄ PLAMĘ na kanonicznym `OverflowTooltip`
 * z jądra: renderuje on `{children ?? content}`, więc komórka zapisana jako
 * `<OverflowTooltip content={row.name} />` (bez dzieci — dokładnie tak robi
 * kolumna nazwy w banku Realizacji) miała ZERO tekstu do zmierzenia. Pomiar
 * wychodził 0, kolumna dostawała `min(zadeklarowana, 0+padding)` i siadała na
 * podłodze: tytuł banku 300 px → 200 px, czyli ten sam obraz („pierwsza
 * kolumna beznadziejna"), który partia szerokości miała usunąć — tylko innym
 * mechanizmem. Zmierzone testem `ExecutionBankViews.columnWidths`.
 *
 * Dlatego obchód czyta `children ?? content` — DOKŁADNIE tę samą regułę, którą
 * stosuje sam komponent. Prop, który nie trafia na ekran, nie jest tu ryzykiem:
 * pomiar i tak nigdy nie przekracza ani sufitu typu, ani szerokości
 * zadeklarowanej przez ekran.
 */
export const cellTextLines = (node: React.ReactNode, depth = 0): string[] => {
  const lines: string[] = [];
  let bufor = '';

  const zamknij = () => {
    const tekst = bufor.trim();
    if (tekst) lines.push(tekst);
    bufor = '';
  };

  const chodz = (n: React.ReactNode, d: number) => {
    if (n === null || n === undefined || typeof n === 'boolean') return;
    if (typeof n === 'string' || typeof n === 'number') {
      bufor += String(n);
      return;
    }
    if (d > 8) return;
    if (Array.isArray(n)) {
      for (const dziecko of n) chodz(dziecko, d);
      return;
    }
    const element = n as { props?: { children?: React.ReactNode; content?: unknown } };
    if (element && typeof element === 'object' && 'props' in element) {
      zamknij();
      const dzieci = element.props?.children;
      const content = element.props?.content;
      if (dzieci !== null && dzieci !== undefined) {
        chodz(dzieci, d + 1);
      } else if (typeof content === 'string' || typeof content === 'number') {
        // `children ?? content` — reguła `OverflowTooltip`, patrz nota wyżej.
        chodz(content, d + 1);
      }
      zamknij();
    }
  };

  chodz(node, depth);
  zamknij();
  return lines;
};

export interface ContentWidthInput<Row> {
  columns: Array<{
    id: string;
    label?: string;
    dataType?: CanonColumnDataType;
    type?: 'select';
    render?: (row: Row) => React.ReactNode;
  }>;
  rows: Row[];
  /** Pomiar tekstu w px (wstrzykiwany — canvas w przeglądarce, atrapa w teście). */
  measure: (text: string) => number;
  sampleRows?: number;
}

export interface ColumnContentMeasure {
  /** Najszersza LINIA treści + budżet poziomy komórki. */
  width: number;
  /** Typ rozstrzygnięty (deklaracja → nazwa → kształt danych). */
  dataType: CanonColumnDataType;
  /** `true`, gdy KAŻDY próbkowany wiersz jest pusty („—"/brak). */
  empty: boolean;
}

const rawCellText = <Row,>(column: ContentWidthInput<Row>['columns'][number], row: Row): string[] => {
  if (column.render) {
    try {
      return cellTextLines(column.render(row));
    } catch {
      return [];
    }
  }
  const value = (row as Record<string, unknown>)?.[column.id];
  if (value === null || value === undefined) return [];
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return cellTextLines(String(value));
  }
  return [];
};

/**
 * Ile miejsca kolumna NAPRAWDĘ potrzebuje — z treści, nie z deklaracji.
 * Zwraca też typ i „pustkę" (kolumna, w której każdy wiersz to „—").
 */
export const measureColumnContent = <Row,>({
  columns,
  rows,
  measure,
  sampleRows = CONTENT_SAMPLE_ROWS,
}: ContentWidthInput<Row>): Record<string, ColumnContentMeasure> => {
  const probka = rows.slice(0, sampleRows);
  const wynik: Record<string, ColumnContentMeasure> = {};

  for (const column of columns) {
    if (column.type === 'select') continue;
    let najszersza = 0;
    let pusta = probka.length > 0;
    const teksty: string[] = [];

    for (const row of probka) {
      const linie = rawCellText(column, row);
      const realne = linie.filter((l) => l && l !== '—');
      if (realne.length > 0) pusta = false;
      for (const linia of linie) {
        teksty.push(linia);
        const szer = measure(linia);
        if (szer > najszersza) najszersza = szer;
      }
    }

    wynik[column.id] = {
      width: probka.length === 0 ? 0 : Math.ceil(najszersza) + CELL_CONTENT_PADDING_PX,
      dataType: inferColumnDataType(column, teksty),
      empty: pusta,
    };
  }

  return wynik;
};

export interface SurplusColumn {
  id: string;
  /** Szerokość po dociśnięciu do treści. */
  width: number;
  /** Ile kolumna chciałaby mieć (treść), 0 = brak pomiaru. */
  want: number;
  isPrimary: boolean;
  dataType: CanonColumnDataType;
  /** Kolumna zmieniona ręcznie przez użytkownika — luzu NIE dostaje. */
  manual?: boolean;
}

/**
 * ROZDZIAŁ LUZU — sedno naprawy T1.
 *
 * Gdy suma kolumn jest mniejsza niż kontener, `table-fixed` rozda nadmiar SAM,
 * proporcjonalnie do zadeklarowanych szerokości — i wtedy kolumna „—" rośnie
 * razem z tytułem. Dlatego luz rozdajemy TU i oddajemy tabeli szerokości,
 * które sumują się DOKŁADNIE do dostępnego obszaru: przeglądarce nie zostaje
 * nic do „równego podziału".
 *
 * Kolejność (kanon: „kolumna tytułowa rośnie, stanowe nie"):
 *   1. kolumna tytułowa do swojej realnej potrzeby treści,
 *   2. kolumny prozy (`text`) do swojej potrzeby,
 *   3. reszta luzu — waga 2 dla tytułu, 1 dla prozy; gdy nie ma ani jednej
 *      takiej kolumny, dopiero wtedy równo na wszystkie (bo nie ma komu oddać).
 * Kolumny `status`/`date`/`number`/`owner` nie rosną NIGDY ponad swój sufit.
 */
export const distributeColumnSurplus = (
  kolumny: SurplusColumn[],
  surplus: number
): Record<string, number> => {
  const widths: Record<string, number> = {};
  for (const c of kolumny) widths[c.id] = c.width;
  if (surplus <= 0 || kolumny.length === 0) return widths;

  let zostalo = surplus;

  const dosyp = (c: SurplusColumn, ile: number) => {
    if (ile <= 0) return;
    widths[c.id] += ile;
    zostalo -= ile;
  };

  const rosnace = kolumny.filter((c) => !c.manual);

  // 1) tytuł do potrzeby treści
  const tytul = rosnace.find((c) => c.isPrimary);
  if (tytul && tytul.want > widths[tytul.id]) {
    dosyp(tytul, Math.min(zostalo, tytul.want - widths[tytul.id]));
  }

  // 2) proza do potrzeby treści
  for (const c of rosnace) {
    if (zostalo <= 0) break;
    if (c.isPrimary || c.dataType !== 'text') continue;
    if (c.want > widths[c.id]) dosyp(c, Math.min(zostalo, c.want - widths[c.id]));
  }

  if (zostalo <= 0) return widths;

  // 3) reszta luzu — tytuł ma podwójną wagę, kolumny stanowe zerową.
  const wagi = new Map<string, number>();
  for (const c of rosnace) {
    const waga = c.isPrimary ? 2 : c.dataType === 'text' ? 1 : 0;
    if (waga > 0) wagi.set(c.id, waga);
  }
  if (wagi.size === 0) {
    // Nie ma komu oddać luzu (same kolumny stanowe) — wtedy równy podział jest
    // JEDYNYM uczciwym wyjściem; inaczej `table-fixed` zrobi to samo, tylko
    // poza naszą kontrolą.
    for (const c of rosnace) wagi.set(c.id, 1);
  }
  if (wagi.size === 0) return widths;

  const suma = [...wagi.values()].reduce((a, b) => a + b, 0);
  const doRozdania = zostalo;
  let rozdane = 0;
  const lista = [...wagi.entries()];
  lista.forEach(([id, waga], idx) => {
    const ile =
      idx === lista.length - 1 ? doRozdania - rozdane : Math.floor((doRozdania * waga) / suma);
    widths[id] += ile;
    rozdane += ile;
  });

  return widths;
};

/**
 * ── CZY KOMÓRKĘ WOLNO PRZYCIĄĆ (K5-7, 2026-09-13) ──────────────────────────
 *
 * Kanon §3.4 mrozi wysokość wiersza, a §3.3 każe skracać wielokropkiem —
 * ale `CELL_ELEMENT_WRAP_CLASS` świadomie NIE ma `overflow-hidden`, bo komórki
 * renderują popovery i menu BEZ portalu (`PMO/StatusTransitionDropdown.tsx`
 * w `assessment/InitiativesTable.tsx`) i przycięcie ucięłoby je do szerokości
 * kolumny. Efekt uboczny: treść elementowa ZAWIJA się na 2–4 linie i wiersz
 * puchnie z 56 px do 73–130 px — to odchylenie T1 z odbioru właściciela
 * („długie teksty łamane na 3–4 linie").
 *
 * Rozstrzygnięcie: przycinamy tylko te komórki, z których NIC nie może
 * wyskoczyć — drzewo elementów bez uchwytu zdarzeń, bez `role`, bez elementu
 * interaktywnego i bez KOMPONENTU (bo jego wnętrza nie widzimy). Predykat jest
 * statyczny i sprawdzalny; w razie wątpliwości odpowiada „nie wolno", więc
 * najgorszym przypadkiem jest dzisiejsze zachowanie, nie ucięty popover.
 */
const INTERAKTYWNE_TAGI = new Set(['button', 'a', 'input', 'select', 'textarea', 'details']);

export const cellCanClip = (node: React.ReactNode, depth = 0): boolean => {
  if (node === null || node === undefined || typeof node === 'boolean') return true;
  if (typeof node === 'string' || typeof node === 'number') return true;
  if (depth > 8) return false;
  if (Array.isArray(node)) return node.every((n) => cellCanClip(n, depth + 1));

  const element = node as {
    type?: unknown;
    props?: Record<string, unknown> & { children?: React.ReactNode };
  };
  if (!element || typeof element !== 'object' || !('props' in element)) return false;

  // Komponent (nie tag HTML) — nie widzimy wnętrza, więc nie ryzykujemy.
  if (typeof element.type !== 'string') return false;
  if (INTERAKTYWNE_TAGI.has(element.type)) return false;

  const props = element.props ?? {};
  for (const key of Object.keys(props)) {
    if (key === 'role' || key === 'tabIndex') return false;
    if (key.startsWith('on') && typeof props[key] === 'function') return false;
  }

  return cellCanClip(props.children, depth + 1);
};
