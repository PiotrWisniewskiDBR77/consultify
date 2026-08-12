/**
 * Pakiet E — logika katalogu KPI trójwarstwowego (DEC-FIN-003, brief sekcja
 * "Katalog KPI"): rekomendacja per branża (Kreator Quick Create) i
 * WALIDACJA formuły własnej w piaskownicy (Kreator Customize krok 4).
 *
 * "Piaskownica" tu znaczy dosłownie: `validateCustomFormula` NIGDY nie
 * wykonuje `eval`/`new Function` na tekście użytkownika — tokenizuje i
 * odrzuca każdy token, który nie jest liczbą, operatorem arytmetycznym,
 * nawiasem, przecinkiem funkcji z dozwolonej listy, albo znanym kodem linii
 * kanonicznej, a na koniec dowodzi poprawnej GRAMATYKI uruchamiając ten sam
 * bezpieczny parser co realny evaluator (`analysisKpiCompute.ts`). Realna
 * walidacja (testowalna, niezależna od backendu, który dziś w ogóle nie
 * eksponuje endpointu zapisu formuły własnej — patrz
 * `PKG_E_ANALYSIS_report.md` §"Co niepokryte").
 */

import { evaluateArithmeticExpression } from './analysisKpiCompute';

// ---------------------------------------------------------------------------
// Rekomendacja per branża — Quick Create §"rekomendowany preset branżowy".
// Mały, realistyczny zestaw (nie udajemy pełnej taksonomii branżowej, której
// backend i tak jeszcze nie ma — `industry_code` w katalogu jest stringiem
// dowolnym po stronie serwera, ten plik jest jedynym miejscem, gdzie Kreator
// wie, co polecić).
// ---------------------------------------------------------------------------

export const ANALYSIS_INDUSTRY_PRESETS = [
  { code: 'GENERAL', labelPl: 'Ogólny (dowolna branża)' },
  { code: 'MANUFACTURING', labelPl: 'Produkcja' },
  { code: 'SAAS', labelPl: 'Oprogramowanie (SaaS)' },
  { code: 'PROFESSIONAL_SERVICES', labelPl: 'Usługi profesjonalne' },
  { code: 'RETAIL', labelPl: 'Handel detaliczny' },
] as const;
export type AnalysisIndustryCode = (typeof ANALYSIS_INDUSTRY_PRESETS)[number]['code'];

/**
 * KPI uniwersalne rekomendowane niezależnie od branży + dopisek branżowy.
 * Kody muszą pokrywać się z `kpiCode` realnie zwracanym przez
 * `GET /analysis/kpi-catalog` w danej organizacji — ta lista jest
 * PREFERENCJĄ (kolejność/wybór), nie źródłem prawdy o istnieniu KPI.
 */
const UNIVERSAL_RECOMMENDED_CODES = ['REVENUE_GROWTH_YOY', 'GROSS_MARGIN_PCT', 'EBITDA_MARGIN_PCT', 'NET_MARGIN_PCT'] as const;

const INDUSTRY_ADDITIONAL_CODES: Record<AnalysisIndustryCode, readonly string[]> = {
  GENERAL: [],
  MANUFACTURING: ['INVENTORY_DAYS', 'ASSET_TURNOVER'],
  SAAS: ['NET_REVENUE_RETENTION', 'CAC_PAYBACK_MONTHS', 'RULE_OF_40'],
  PROFESSIONAL_SERVICES: ['UTILIZATION_RATE_PCT', 'REVENUE_PER_FTE'],
  RETAIL: ['INVENTORY_TURNOVER', 'SAME_STORE_SALES_GROWTH'],
};

export interface AnalysisKpiCatalogEntryLike {
  kpiCode: string;
  tier: 'UNIVERSAL' | 'INDUSTRY' | 'ORG_CUSTOM';
  industryCode: string | null;
  status: string;
}

/**
 * Zwraca `kpiCode[]` w kolejności rekomendacji (uniwersalne najpierw, potem
 * branżowe), PRZEFILTROWANE do tego, co realnie istnieje w katalogu
 * organizacji (żeby Kreator nigdy nie zaznaczył wstępnie KPI, którego
 * backend nie zna — cichy błąd przy compute byłby gorszy niż krótsza lista).
 */
export function recommendKpisForIndustry(
  catalog: readonly AnalysisKpiCatalogEntryLike[],
  industryCode: AnalysisIndustryCode
): string[] {
  const available = new Set(catalog.filter((k) => k.status === 'ACTIVE').map((k) => k.kpiCode));
  const wanted = [...UNIVERSAL_RECOMMENDED_CODES, ...INDUSTRY_ADDITIONAL_CODES[industryCode]];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const code of wanted) {
    if (available.has(code) && !seen.has(code)) {
      seen.add(code);
      result.push(code);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Formuła własna w piaskownicy — Kreator Customize krok 4, katalog "KPI
// własne organizacji". Whitelist tokenizer, ZERO `eval`/`Function`.
// ---------------------------------------------------------------------------

const ALLOWED_FUNCTIONS = ['ABS', 'MIN', 'MAX', 'ROUND'] as const;
const TOKEN_RE = /\s*(?:([A-Z][A-Z0-9_]*)|(\d+(?:\.\d+)?)|([+\-*/(),]))/g;

export type FormulaValidationResult =
  | { ok: true; normalizedExpression: string; referencedLineCodes: string[] }
  | {
      ok: false;
      code: 'EMPTY' | 'UNKNOWN_TOKEN' | 'UNKNOWN_IDENTIFIER' | 'UNBALANCED_PARENS' | 'TOO_LONG' | 'INVALID_SYNTAX';
      messagePl: string;
      position?: number;
    };

const MAX_FORMULA_LENGTH = 500;

/**
 * `availableLineCodes` = kody linii kanonicznych DOSTĘPNE dla wybranych
 * okresów (brief: "wymagane składniki źródłowe. Dostępność per okres.") —
 * caller filtruje tę listę przed wywołaniem; ta funkcja tylko odmawia
 * identyfikatorów spoza niej, nie wie nic o okresach.
 */
export function validateCustomFormula(rawExpression: string, availableLineCodes: readonly string[]): FormulaValidationResult {
  const expression = rawExpression.trim();
  if (expression.length === 0) {
    return { ok: false, code: 'EMPTY', messagePl: 'Formuła nie może być pusta.' };
  }
  if (expression.length > MAX_FORMULA_LENGTH) {
    return { ok: false, code: 'TOO_LONG', messagePl: `Formuła może mieć maksymalnie ${MAX_FORMULA_LENGTH} znaków.` };
  }

  const knownIdentifiers = new Set<string>([...availableLineCodes, ...ALLOWED_FUNCTIONS]);
  const referencedLineCodes: string[] = [];
  let depth = 0;
  let cursor = 0;
  TOKEN_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  let consumedLength = 0;

  while ((match = TOKEN_RE.exec(expression)) !== null) {
    if (match.index !== cursor) {
      // Gap znaczy, że regex nic nie dopasował na tej pozycji — nieznany znak
      // (np. `;`, `` ` ``, litera spoza [A-Z0-9_], cudzysłów — wektor iniekcji).
      return {
        ok: false,
        code: 'UNKNOWN_TOKEN',
        messagePl: `Niedozwolony znak na pozycji ${cursor}: "${expression[cursor]}"`,
        position: cursor,
      };
    }
    const [full, identifier, , operator] = match;
    if (identifier) {
      if (!knownIdentifiers.has(identifier)) {
        return {
          ok: false,
          code: 'UNKNOWN_IDENTIFIER',
          messagePl: `Nieznany składnik lub funkcja: "${identifier}". Dozwolone są tylko kody linii dostępne dla wybranych okresów i funkcje ${ALLOWED_FUNCTIONS.join(', ')}.`,
          position: match.index,
        };
      }
      if (!(ALLOWED_FUNCTIONS as readonly string[]).includes(identifier)) {
        referencedLineCodes.push(identifier);
      }
    } else if (operator) {
      if (operator === '(') depth += 1;
      if (operator === ')') depth -= 1;
      if (depth < 0) {
        return { ok: false, code: 'UNBALANCED_PARENS', messagePl: 'Niesparowany nawias zamykający.', position: match.index };
      }
    }
    cursor = match.index + full.length;
    consumedLength = cursor;
  }

  if (consumedLength !== expression.length) {
    return {
      ok: false,
      code: 'UNKNOWN_TOKEN',
      messagePl: `Niedozwolony znak na pozycji ${consumedLength}: "${expression[consumedLength]}"`,
      position: consumedLength,
    };
  }
  if (depth !== 0) {
    return { ok: false, code: 'UNBALANCED_PARENS', messagePl: 'Niesparowane nawiasy w formule.' };
  }

  // Whitelist tokenów NIE wystarcza (np. "REVENUE // COGS" tokenizuje się
  // czysto — dwa poprawne tokeny operatora pod rząd — ale nie jest poprawną
  // gramatyką). Ostateczny dowód poprawności: uruchom TEN SAM parser co
  // realny evaluator (`analysisKpiCompute.ts`), z każdym znanym
  // identyfikatorem podstawionym za `1` (wartość nieistotna — liczy się
  // tylko, czy parsowanie się nie wywala). Import na górze pliku — brak
  // zależności cyklicznej, `analysisKpiCompute.ts` nie importuje nic z tego
  // pliku (granica katalog→compute jest jednokierunkowa).
  try {
    const dryRunValues: Record<string, number> = {};
    for (const code of referencedLineCodes) dryRunValues[code] = 1;
    evaluateArithmeticExpression(expression, dryRunValues);
  } catch (err) {
    return {
      ok: false,
      code: 'INVALID_SYNTAX',
      messagePl: `Formuła ma niepoprawną składnię: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  return {
    ok: true,
    normalizedExpression: expression.replace(/\s+/g, ' '),
    referencedLineCodes: [...new Set(referencedLineCodes)],
  };
}
