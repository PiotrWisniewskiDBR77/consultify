/**
 * interviewInsightProse — usuwa surowe identyfikatory dowodów z PROZY wniosku.
 *
 * ── DLACZEGO ISTNIEJE (P-J02 pkt 3, bloker testerki 15.09) ──────────────────
 * Justyna: „treść ze znakami które nie są literami a powinny być".
 * Zmierzone na żywej bazie stagingu, jej własny wniosek
 * `ii_b5a80a46-91a2-4d3b-8d88-7bb885b78222` („Justyna wnioski", DBR77,
 * 2026-09-15 04:08 UTC), kolumna `themes_json`:
 *
 *   "description": "…automatyzacja powtarzalnych zadań mogą poprawić
 *    efektywność. (Źródła: Justyna Laskowska,
 *    [answer_id: 0ca24fc4-a401-46fd-9032-5dce2863165f],
 *    [answer_id: 4b0f2007-97c6-470b-85c7-fbdbe3903a15])",
 *   "evidence_refs": ["0ca24fc4-…", "4b0f2007-…"]
 *
 * Te same identyfikatory SĄ już w `evidence_refs` — model dopisał je DRUGI raz
 * do zdania czytanego przez człowieka. Prompt (`InterviewInsightService`
 * „Each answer in the data below is tagged with an [answer_id: ...]") każe
 * używać ich w `evidence_refs`/`evidence_map`, ale nigdy nie zabraniał wpisania
 * ich do prozy — i model tego nadużył.
 *
 * To NIE jest mojibake: skan 883 kolumn tekstowych bazy stagingu wzorcem
 * [Â Ã Å U+FFFD] dał 0 trafień. Kodowanie jest poprawne end-to-end (odpowiedź
 * `/api/v8/interview/insights` ma `charset=utf-8`, polskie diakrytyki wracają
 * całe). Uszkodzona jest TREŚĆ, nie transport.
 *
 * ── DLACZEGO CZYSZCZENIE, A NIE SAM PROMPT ─────────────────────────────────
 * Sama reguła w prompcie to obietnica bez pokrycia (model dryfuje, a defekt
 * widzi klient). Dlatego reguła idzie do promptu ORAZ ten sanitizer stoi na
 * DWÓCH ścieżkach: przy zapisie (`parseV6Response`) i przy odczycie
 * (mapowanie wiersza na `Insight`), żeby wnioski wygenerowane WCZEŚNIEJ —
 * m.in. ten Justyny — też pokazały się czyste bez migracji danych.
 *
 * Sanitizer NIE rusza `evidence_refs`, `evidence_map` ani cytatów
 * (`answer_snippet`) — tam identyfikator jest daną, nie śmieciem.
 */

/** `[answer_id: …]`, `[answer id: …]`, `(answer_id: …)` — z dowolnym białym znakiem. */
const ZNACZNIK_ID = /[[(]\s*answer[_\s-]?id\s*:\s*[^)\]]*[)\]]/gi;

/**
 * Nawias z listą źródeł, który po usunięciu znaczników zostaje pusty albo
 * niesie już tylko interpunkcję: `(Źródła: )`, `(Sources: , )`, `( , )`.
 */
const PUSTY_NAWIAS = /\(\s*(?:Źródła|Zrodla|Sources|Source|Evidence)?\s*:?\s*[,;\s]*\)/gi;

/** Porządki po wycięciu: zdublowane przecinki, spacja przed interpunkcją. */
const SPRZATANIE: Array<[RegExp, string]> = [
  [/,\s*(?=[,;)])/g, ''],
  [/\(\s*,\s*/g, '('],
  [/\s+([,.;:!?])/g, '$1'],
  [/[ \t]{2,}/g, ' '],
  [/[ \t]+\n/g, '\n'],
];

/**
 * Wytnij surowe `[answer_id: …]` z jednego kawałka prozy.
 * Pusty/nietekstowy wejściowy zostaje bez zmian (nie podstawiamy treści).
 */
export function oczyscProzeWniosku(wartosc: unknown): string {
  if (typeof wartosc !== 'string' || wartosc.length === 0) return typeof wartosc === 'string' ? wartosc : '';
  let out = wartosc.replace(ZNACZNIK_ID, '');
  out = out.replace(PUSTY_NAWIAS, '');
  for (const [re, zam] of SPRZATANIE) out = out.replace(re, zam);
  return out.trim();
}

/** Czy tekst niesie surowy znacznik identyfikatora (do testów i pomiarów). */
export function maSurowyIdentyfikator(wartosc: unknown): boolean {
  if (typeof wartosc !== 'string') return false;
  ZNACZNIK_ID.lastIndex = 0;
  return ZNACZNIK_ID.test(wartosc);
}

/** Pola prozy jednego znaleziska (temat/problem/szansa/sygnał). */
const POLA_PROZY = ['title', 'description', 'divergence_note', 'divergenceNote', 'statement'] as const;

/** Oczyść listę znalezisk — `evidence_refs` i reszta struktury bez zmian. */
export function oczyscZnaleziska<T>(items: T[] | undefined | null): T[] {
  if (!Array.isArray(items)) return [];
  return items.map((item) => {
    if (!item || typeof item !== 'object') return item;
    const kopia: Record<string, unknown> = { ...(item as Record<string, unknown>) };
    for (const pole of POLA_PROZY) {
      if (typeof kopia[pole] === 'string') kopia[pole] = oczyscProzeWniosku(kopia[pole]);
    }
    return kopia as unknown as T;
  });
}

/** Oczyść listę zdań (np. `missing_data`). */
export function oczyscListeZdan(items: unknown): string[] {
  if (!Array.isArray(items)) return [];
  return items.map((x) => oczyscProzeWniosku(String(x ?? ''))).filter((x) => x.length > 0);
}
