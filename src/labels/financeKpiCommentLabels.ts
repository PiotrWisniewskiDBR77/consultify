/**
 * financeKpiCommentLabels — surowy tekst diagnostyczny silnika wskaźników
 * → polskie zdanie dla człowieka. Ten sam wzorzec, co `errorMessageMapper`.
 *
 * ★ POWÓD (audyt FIN 2026-09-06, defekt #6c, zrzut `06-analiza-karta.png`):
 * kolumna „KOMENTARZ" w tabeli wskaźników renderowała
 * `finance_analysis_kpi_values.interpretation_text` wprost, a to pole niesie
 * dla nieobliczonych wskaźników komunikat DIAGNOSTYCZNY silnika — z kodem
 * błędu i UUID okresu:
 *
 *   NA_REASON:DENOMINATOR_MISSING — cannot compute ratio: denominator is
 *   MISSING (WRONG_PERIOD_TYPE_FOR_LTM: LTM_SUM_4Q requires a period_type='Q'
 *   current period, got 'FY' for 3206a8c3-c67c-4816-b594-eea4d4933408)
 *
 * UUID nie jest treścią dla CFO, a „NA_REASON:DENOMINATOR_MISSING" to kod, nie
 * komunikat. Ten moduł tłumaczy ZNANE przyczyny na zdania mówiące, CZEGO
 * zabrakło. Przyczyna NIEZNANA nie jest echowana surowo — dostaje ogólne,
 * uczciwe zdanie, żeby żaden UUID ani kod nie wyciekł na ekran.
 */

const UUID_ANYWHERE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

interface CommentRule {
  /** Wzorzec rozpoznający przyczynę w surowym tekście silnika. */
  match: RegExp;
  sentencePl: string;
}

const RULES: readonly CommentRule[] = [
  {
    match: /WRONG_PERIOD_TYPE_FOR_LTM|LTM_SUM_4Q/i,
    sentencePl:
      'Nie policzono: ten wskaźnik wymaga danych kwartalnych (suma z 4 kwartałów), a pakiet zawiera wyłącznie okresy roczne.',
  },
  {
    match: /AVERAGE_BALANCE needs a previous_period_id|first period on record/i,
    sentencePl:
      'Nie policzono: wskaźnik liczy średni stan z dwóch okresów, a to pierwszy okres w pakiecie — brak okresu poprzedzającego.',
  },
  {
    match: /PRIOR_YEAR_SAME_PERIOD|chain ran out/i,
    sentencePl:
      'Nie policzono: brak okresu porównawczego sprzed roku — łańcuch okresów w pakiecie kończy się wcześniej.',
  },
  {
    match: /DENOMINATOR_ZERO|division by zero/i,
    sentencePl: 'Nie policzono: mianownik wynosi zero — iloraz jest matematycznie nieokreślony.',
  },
  {
    match: /NEGATIVE_DENOMINATOR/i,
    sentencePl:
      'Nie policzono: mianownik jest ujemny — wynik ilorazu byłby mylący, więc wskaźnik nie jest prezentowany.',
  },
  {
    match: /NUMERATOR_MISSING/i,
    sentencePl: 'Nie policzono: brakuje licznika — pozycji źródłowej nie ma w tym okresie.',
  },
  {
    match: /DENOMINATOR_MISSING/i,
    sentencePl: 'Nie policzono: brakuje mianownika — pozycji źródłowej nie ma w tym okresie.',
  },
  {
    match: /INSUFFICIENT_HISTORY/i,
    sentencePl: 'Nie policzono: za krótka historia — wskaźnik potrzebuje więcej okresów niż jest w pakiecie.',
  },
];

const GENERIC_NOT_COMPUTED =
  'Nie policzono: brakuje danych źródłowych wymaganych przez ten wskaźnik w tym okresie.';

/** `true` gdy tekst jest komunikatem diagnostycznym silnika, a nie komentarzem analityka. */
export function isEngineDiagnosticText(text: string | null | undefined): boolean {
  const value = String(text ?? '').trim();
  if (!value) return false;
  if (value.startsWith('NA_REASON:')) return true;
  if (UUID_ANYWHERE.test(value)) return true;
  return RULES.some((rule) => rule.match.test(value));
}

/**
 * Komentarz do wskaźnika. Komentarz NAPISANY PRZEZ CZŁOWIEKA przechodzi bez
 * zmian; komunikat silnika jest tłumaczony; pusty → `—`.
 */
export function financeKpiCommentLabel(interpretationText: string | null | undefined): string {
  const value = String(interpretationText ?? '').trim();
  if (!value) return '—';
  if (!isEngineDiagnosticText(value)) return value;
  for (const rule of RULES) {
    if (rule.match.test(value)) return rule.sentencePl;
  }
  return GENERIC_NOT_COMPUTED;
}
