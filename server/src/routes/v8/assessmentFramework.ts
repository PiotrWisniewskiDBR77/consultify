/**
 * Odbiór na żywo 05.09 (05-ocena, defekt 2): panel „Wnioski" pokazywał
 * „Ocena dostępna tylko dla assessmentów DRD." NA REKORDZIE DRD — bez trzech
 * kafli (Kompletność / Śr. poziom osiągnięty / Pokrycie dowodami).
 *
 * Zmierzona przyczyna (GET /api/v8/assessment/dbr77-assess-001 na danych
 * właściciela): wiersz ma `assessment_type = "MATURITY"` i `framework_type =
 * "DRD"`. Framework mieszka w DWÓCH kolumnach, a reszta aplikacji rozstrzyga
 * go przez `COALESCE(framework_type, assessment_type, 'DRD')` (patrz
 * assessment-hub.routes.ts). Ten router patrzył wyłącznie na
 * `assessment_type`, więc dla takiego wiersza `scoring` wychodziło null,
 * a klient — pozbawiony danych — pokazywał komunikat „tylko dla DRD".
 *
 * Ta funkcja jest jedynym miejscem, w którym router rozstrzyga framework.
 */
export function resolveAssessmentFramework(
  row: { framework_type?: unknown; assessment_type?: unknown } | null | undefined
): string {
  const framework = row?.framework_type == null ? '' : String(row.framework_type).trim();
  const legacy = row?.assessment_type == null ? '' : String(row.assessment_type).trim();
  return (framework || legacy).toUpperCase();
}

export function isDrdAssessmentRow(
  row: { framework_type?: unknown; assessment_type?: unknown } | null | undefined
): boolean {
  return resolveAssessmentFramework(row) === 'DRD';
}
