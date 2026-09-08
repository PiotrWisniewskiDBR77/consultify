/**
 * Nazwy osi/obszarów metod (DRD, ADMA, SIRI, CMMI, Lean) są w strukturze
 * dwujęzyczne: `name` po angielsku, `namePL` po polsku. Wzorzec `namePL || name`
 * rozsiany po module dawał POLSKĄ nazwę także użytkownikowi EN — a to jest
 * dokładnie ten „jeden inny język", którego w wersji angielskiej być nie może
 * (docs/program/JEZYK_EN_PL_20260908/PLAN.md §2.1).
 *
 * Ten helper jest jedynym miejscem, w którym wybór wariantu zależy od języka
 * interfejsu. Nie tłumaczy — wybiera gotowy wariant ze struktury metody.
 */
export function nazwaWJezyku(
  namePL: string | undefined | null,
  name: string | undefined | null,
  isPolish: boolean
): string {
  if (isPolish) return (namePL || name) ?? '';
  return (name || namePL) ?? '';
}

/** Wariant dla kodu, który ma pod ręką `i18n.language` zamiast flagi. */
export function nazwaDlaJezyka(
  namePL: string | undefined | null,
  name: string | undefined | null,
  language: string | undefined | null
): string {
  return nazwaWJezyku(namePL, name, (language || '').toLowerCase().startsWith('pl'));
}
