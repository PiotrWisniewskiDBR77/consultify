/**
 * kpiReportLabels — SŁOWNIK ETYKIET raportu KPI (Wyniki → KPI, poziomy 1–3).
 *
 * PO CO OSOBNY PLIK (P4 „kody techniczne w UI"): wartości, które przychodzą
 * z bazy, są kodami — `settlement`, `threshold_min`, `on_target`. Wstawienie
 * ich do tabeli byłoby dokładnie tym, przed czym P4 ostrzega: użytkownik czyta
 * napis techniczny zamiast słowa po polsku. Ten plik zamienia kod na SŁOWO;
 * kolor tego samego stanu jest osobnym pytaniem i mieszka w `stateToneMap.ts`.
 *
 * Nazwy miesięcy są tutaj, a nie na serwerze, świadomie: nazwa miesiąca należy
 * do JĘZYKA INTERFEJSU, nie do danych. Serwer podaje granice okresu, front
 * zapisuje je słowem.
 *
 * SSOT: `docs/modules/07_rezultaty/SSOT_WYNIKI_KPI_OKR_ROI.md` §2 i §6.
 */

type Bilingual = { pl: string; en: string };

const pick = (labels: Bilingual, isPolish: boolean): string => (isPolish ? labels.pl : labels.en);

// ── Typ wskaźnika (rozliczeniowy / informacyjny) ────────────────────────────

const INDICATOR_TYPE_LABELS: Record<string, Bilingual> = {
  settlement: { pl: 'Rozliczeniowy', en: 'Settlement' },
  informational: { pl: 'Informacyjny', en: 'Informational' },
};

export function kpiIndicatorTypeLabel(
  value: string | null | undefined,
  isPolish: boolean
): string | null {
  if (!value) return null;
  const labels = INDICATOR_TYPE_LABELS[value];
  return labels ? pick(labels, isPolish) : null;
}

// ── Kierunek miernika (min. / max.) ─────────────────────────────────────────
//
// `threshold_min` = „nie mniej niż" → im więcej, tym lepiej (strzałka w górę).
// `threshold_max` = „nie więcej niż" → im mniej, tym lepiej (strzałka w dół).
// Pozostałe geometrie (`range`, `exact`, `binary`, `custom`) nie mają jednego
// kierunku i dostają `null` — UI pokaże wtedy samą jednostkę, a nie zmyśloną
// strzałkę.

const DIRECTION_LABELS: Record<string, Bilingual> = {
  threshold_min: { pl: '↑ min.', en: '↑ min.' },
  threshold_max: { pl: '↓ maks.', en: '↓ max.' },
};

export function kpiDirectionLabel(
  targetGeometry: string | null | undefined,
  isPolish: boolean
): string | null {
  if (!targetGeometry) return null;
  const labels = DIRECTION_LABELS[targetGeometry];
  return labels ? pick(labels, isPolish) : null;
}

// ── Częstotliwość pomiaru ───────────────────────────────────────────────────
//
// W schemacie kadencja jest LICZBĄ DNI (`measurement_frequency_days`), nie
// enumem. Zamiana na słowo idzie po przedziałach dobranych do wartości, które
// naprawdę występują (7 / 14 / 30 / 90 / 365); wszystko poza nimi zostaje
// uczciwie opisane liczbą dni, zamiast być wciśnięte w najbliższą etykietę.

export function kpiCadenceLabel(
  frequencyDays: number | null | undefined,
  isPolish: boolean
): string | null {
  if (frequencyDays === null || frequencyDays === undefined) return null;
  if (frequencyDays <= 7) return isPolish ? 'Tydzień' : 'Weekly';
  if (frequencyDays <= 15) return isPolish ? '2 tygodnie' : 'Biweekly';
  if (frequencyDays <= 31) return isPolish ? 'Miesiąc' : 'Monthly';
  if (frequencyDays <= 92) return isPolish ? 'Kwartał' : 'Quarterly';
  if (frequencyDays <= 186) return isPolish ? 'Półrocze' : 'Half-year';
  if (frequencyDays <= 366) return isPolish ? 'Rok' : 'Annual';
  return isPolish ? `Co ${frequencyDays} dni` : `Every ${frequencyDays} days`;
}

// ── Stan miernika w okresie ─────────────────────────────────────────────────
//
// `neutral` to w schemacie „pomiar bez oceny", a nie „w normie" — dlatego ma
// własne słowo „Bez oceny", a nie jest sklejane z brakiem danych.

const PERFORMANCE_STATUS_LABELS: Record<string, Bilingual> = {
  on_target: { pl: 'W normie', en: 'On target' },
  warning: { pl: 'Ostrzeżenie', en: 'Warning' },
  critical: { pl: 'Krytyczne', en: 'Critical' },
  neutral: { pl: 'Bez oceny', en: 'Not rated' },
};

export function kpiPerformanceStatusLabel(
  value: string | null | undefined,
  isPolish: boolean
): string | null {
  if (!value) return null;
  const labels = PERFORMANCE_STATUS_LABELS[value];
  return labels ? pick(labels, isPolish) : null;
}

/** Ton koloru stanu — czerwień WYŁĄCZNIE dla „krytyczne" (CLAUDE.md, pułapka nr 1). */
export function kpiPerformanceStatusTone(
  value: string | null | undefined
): 'ok' | 'warn' | 'bad' | 'neutral' {
  if (value === 'on_target') return 'ok';
  if (value === 'warning') return 'warn';
  if (value === 'critical') return 'bad';
  return 'neutral';
}

// ── Okresy ──────────────────────────────────────────────────────────────────

const MONTH_SHORT_PL = [
  'STY',
  'LUT',
  'MAR',
  'KWI',
  'MAJ',
  'CZE',
  'LIP',
  'SIE',
  'WRZ',
  'PAŹ',
  'LIS',
  'GRU',
] as const;

const MONTH_SHORT_EN = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
] as const;

/** Miesiąc rzymski — zapis, którym właściciel opisuje okres raportu („VIII 2026"). */
const MONTH_ROMAN = [
  'I',
  'II',
  'III',
  'IV',
  'V',
  'VI',
  'VII',
  'VIII',
  'IX',
  'X',
  'XI',
  'XII',
] as const;

/**
 * Nagłówek kolumny okresu w tabeli raportu: `SIE 2026`, `Q3 2026`, `2026`.
 * Klucz pochodzi z serwera (`2026-08`, `2026-Q3`, `2026`) — nieznany kształt
 * zwracamy bez zmian, zamiast zgadywać.
 */
export function kpiPeriodColumnLabel(periodKey: string, isPolish: boolean): string {
  const months = isPolish ? MONTH_SHORT_PL : MONTH_SHORT_EN;
  const monthMatch = /^(\d{4})-(\d{2})$/.exec(periodKey);
  if (monthMatch) {
    const monthIndex = Number(monthMatch[2]) - 1;
    return `${months[monthIndex] ?? monthMatch[2]} ${monthMatch[1]}`;
  }
  const quarterMatch = /^(\d{4})-Q([1-4])$/.exec(periodKey);
  if (quarterMatch) return `Q${quarterMatch[2]} ${quarterMatch[1]}`;
  return periodKey;
}

/** Okres raportu w nagłówku i na liście: „VIII 2026", „Q3 2026", „2026". */
export function kpiReportPeriodLabel(periodKey: string): string {
  const monthMatch = /^(\d{4})-(\d{2})$/.exec(periodKey);
  if (monthMatch) {
    const monthIndex = Number(monthMatch[2]) - 1;
    return `${MONTH_ROMAN[monthIndex] ?? monthMatch[2]} ${monthMatch[1]}`;
  }
  const quarterMatch = /^(\d{4})-Q([1-4])$/.exec(periodKey);
  if (quarterMatch) return `Q${quarterMatch[2]} ${quarterMatch[1]}`;
  return periodKey;
}

/** Klucz okresu, w którym mieści się data — ten sam kształt co na serwerze. */
export function kpiPeriodKeyForDate(
  date: Date,
  granularity: 'month' | 'quarter' | 'year'
): string {
  const year = date.getUTCFullYear();
  if (granularity === 'year') return String(year);
  if (granularity === 'quarter') return `${year}-Q${Math.floor(date.getUTCMonth() / 3) + 1}`;
  return `${year}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

// ── Liczby ──────────────────────────────────────────────────────────────────

/**
 * Liczba w komórce raportu: separator tysięcy spacją nierozdzielającą (żeby
 * „11 620" nigdy nie złamało się na dwie linie — werdykt K2), maksymalnie dwa
 * miejsca po przecinku, jednostka doklejona tylko wtedy, gdy jest.
 *
 * `null` NIE jest zamieniane na 0 — zwracamy `null`, a komórka pokazuje „—"
 * (SSOT §6: „brak danych = »—«, nigdy 0").
 */
export function formatKpiValue(
  value: number | null | undefined,
  unit: string | null | undefined,
  isPolish: boolean
): string | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const formatted = new Intl.NumberFormat(isPolish ? 'pl-PL' : 'en-GB', {
    maximumFractionDigits: 2,
  })
    .format(value)
    /* Intl wstawia wąską spację (U+202F) albo zwykłą — obie potrafią złamać
       liczbę na końcu wiersza. Podmieniamy na spację NIEROZDZIELAJĄCĄ. */
    .replace(/[   ]/g, ' ');
  const trimmedUnit = unit?.trim();
  if (!trimmedUnit) return formatted;
  /* Procent przykleja się do liczby („79%"), reszta jednostek stoi za spacją
     nierozdzielającą („11 620 LC/1000"). */
  return trimmedUnit === '%' ? `${formatted}%` : `${formatted} ${trimmedUnit}`;
}
