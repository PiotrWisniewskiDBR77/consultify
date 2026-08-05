/**
 * M03R-007 — utwardzenie treści pytania wobec technicznego sufiksu `$NN`.
 *
 * Na demo sześć pytań jednej sesji (batch z 2026-08-04T04:16:42.604Z,
 * `source_template_question_id = NULL`, więc spoza biblioteki) kończy się
 * doklejonym indeksem: `...copy-paste data between them$23`. Renderer jest
 * niewinny — pokazuje dokładnie to, co zapisano.
 *
 * Zadanie jest węższe, niż wygląda: trzeba usunąć artefakt, NIE tykając
 * prawidłowych kwot. Dlatego reguła jest celowo wąska i wymaga JEDNOCZEŚNIE:
 *   1. `$` na samym końcu treści (po cyfrach nic już nie ma),
 *   2. `$` przyklejonego do znaku niebędącego spacją (czyli doklejonego do
 *      słowa, nie stojącego jako symbol waluty),
 *   3. najwyżej trzech cyfr (indeks pozycji, nie kwota).
 *
 * Dzięki temu przechodzą nietknięte:
 *   „What is the budget? $23"      — spacja przed `$`
 *   „$23 million in savings"       — `$` nie na końcu
 *   „Costs rose to $1200"          — cztery cyfry, to kwota
 *   „Revenue target: 23$"          — `$` po cyfrze, inny kształt
 */

/** Wyłapuje wyłącznie doklejony indeks pozycji na końcu treści. */
const TRAILING_INDEX_ARTIFACT = /(?<=\S)\$\d{1,3}$/;

/**
 * Zwraca treść pytania bez technicznego sufiksu. Nie zmienia niczego innego —
 * bez trimowania wnętrza, bez normalizacji interpunkcji.
 */
export function sanitizeQuestionText(raw: unknown): string {
  const text = String(raw ?? '');
  const trimmedEnd = text.replace(/\s+$/, '');
  if (!TRAILING_INDEX_ARTIFACT.test(trimmedEnd)) return text;
  return trimmedEnd.replace(TRAILING_INDEX_ARTIFACT, '');
}

/** Czy treść niesie artefakt — do raportów i planu naprawy danych. */
export function hasTrailingIndexArtifact(raw: unknown): boolean {
  return TRAILING_INDEX_ARTIFACT.test(String(raw ?? '').replace(/\s+$/, ''));
}
