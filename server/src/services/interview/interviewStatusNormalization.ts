/**
 * M03R-004 — normalizacja statusów wywiadu.
 *
 * Na demo ta sama kolumna niesie dwie konwencje zapisu, bo pisały do niej dwie
 * ścieżki: `interview_assignments.status` ma `assigned` (73) obok `ASSIGNED` (1),
 * `submitted` (25) obok `SUBMITTED` (1), `in_progress` (6) obok `IN_PROGRESS` (1);
 * `interview_sessions.status` ma `completed` (17) obok `COMPLETED` (1).
 *
 * Każdy filtr porównujący status dosłownie gubi wiersze zapisane drugą
 * konwencją — a gubi je CICHO, bo wynik jest poprawną, tylko krótszą listą.
 *
 * Kanon: zapis ZAWSZE w snake_case lowercase; odczyt tolerancyjny (compatibility
 * read), dopóki historyczne wiersze nie zostaną znormalizowane migracją.
 */

/** Kanoniczna postać dowolnego zapisu statusu. Nie waliduje dziedziny. */
export function canonicalStatusToken(raw: unknown): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

/**
 * Fragment SQL do porównania kolumny statusu odporny na wielkość liter.
 * Używać zamiast `col = ?`; parametr przekazywać przez `canonicalStatusToken()`.
 */
export function statusEqualsSql(column: string): string {
  return `lower(replace(${column}, '-', '_')) = ?`;
}

/**
 * Fragment SQL dla listy dozwolonych statusów. Zwraca gotowy warunek z
 * literałami — wartości pochodzą wyłącznie z kodu (kanoniczne stałe), nigdy
 * z wejścia użytkownika, więc nie ma tu wektora wstrzyknięcia.
 */
export function statusInSql(column: string, statuses: readonly string[]): string {
  const list = statuses.map((s) => `'${canonicalStatusToken(s)}'`).join(', ');
  return `lower(replace(${column}, '-', '_')) IN (${list})`;
}
