/**
 * Pakiet E — silnik obliczeń KPI TYLKO do dowodu (known-answer test) i
 * harnessu dev-render. NIE jest to duplikat/zamiennik realnego backendowego
 * `kpiComputeService.computeAnalysisKpis` (`server/**` poza allowlistą tego
 * pakietu, i tak zostaje jedynym źródłem prawdy na produkcji) — to jest
 * NIEZALEŻNA implementacja tej samej prostej arytmetyki, celowo osobna, żeby
 * "independent known-answer" (DoD, brief) rzeczywiście znaczyło niezależne
 * policzenie, nie odczytanie tej samej liczby dwa razy z tego samego miejsca.
 *
 * Reguły przeniesione WPROST z `kpiComputeService.ts` (przeczytany, cytowany
 * w komentarzach), bo produkt musi zachowywać się identycznie:
 *   - brak wymaganego składnika ⇒ `MISSING` (kpiComputeService.ts:410-413,
 *     "missing required input therefore surfaces as value_status='MISSING'")
 *   - ujemny mianownik + polityka `FORCE_NA` ⇒ `NOT_APPLICABLE`/`NA` z
 *     PODANYM powodem, NIGDY liczba i NIGDY 0 (kpiComputeService.ts:206-214)
 *   - `value_status` PRESENT_ZERO tylko dla realnego zera, nie dla braku.
 *
 * ZERO `eval`/`new Function` — wyrażenia idą przez `validateCustomFormula`
 * (tokenizer whitelist) + poniższy rekurencyjny parser tych samych tokenów.
 */

import type { FinanceValue, FinanceValueStatus } from '../../../services/api/financeV2.types';
import type { AnalysisNegativeDenominatorPolicy } from '../../../services/api/financeV2.types';

// ---------------------------------------------------------------------------
// Bezpieczny parser arytmetyczny (recursive-descent, gramatyka: + - * / ()
// oraz ABS/MIN/MAX/ROUND) nad ROZWIĄZANYMI już wartościami (identyfikator →
// number|null, null = MISSING). Współdzieli whitelist z
// `analysisKpiCatalog.ts` (ta sama lista `ALLOWED_FUNCTIONS`), ale nie
// importuje jej stąd, żeby ten plik nie zależał od walidacji formularza —
// evaluator działa też na formułach systemowych z katalogu, nie tylko
// formułach własnych użytkownika.
// ---------------------------------------------------------------------------

export type MissingPropagatingNumber = number | null;

interface Token {
  kind: 'num' | 'ident' | 'op';
  text: string;
}

function tokenize(expression: string): Token[] {
  const re = /\s*(?:([A-Z][A-Z0-9_]*)|(\d+(?:\.\d+)?)|([+\-*/(),]))/g;
  const tokens: Token[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(expression)) !== null) {
    if (match[1]) tokens.push({ kind: 'ident', text: match[1] });
    else if (match[2]) tokens.push({ kind: 'num', text: match[2] });
    else if (match[3]) tokens.push({ kind: 'op', text: match[3] });
  }
  return tokens;
}

const FUNCTIONS: Record<string, (args: MissingPropagatingNumber[]) => MissingPropagatingNumber> = {
  ABS: (args) => (args[0] === null ? null : Math.abs(args[0])),
  MIN: (args) => (args.some((a) => a === null) ? null : Math.min(...(args as number[]))),
  MAX: (args) => (args.some((a) => a === null) ? null : Math.max(...(args as number[]))),
  // Zaokrągla do najbliższej liczby całkowitej (bez parametru miejsc
  // dziesiętnych — analogicznie do jednoargumentowego ROUND arkuszy
  // kalkulacyjnych). Formatowanie procentowe/walutowe do wyświetlenia jest
  // zadaniem warstwy prezentacji (`formatFinanceValueForDisplay`), nie tej funkcji.
  ROUND: (args) => (args[0] === null ? null : Math.round(args[0])),
};

class ExpressionParser {
  private pos = 0;
  constructor(
    private readonly tokens: Token[],
    private readonly resolve: (identifier: string) => MissingPropagatingNumber
  ) {}

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }
  private consume(): Token {
    const t = this.tokens[this.pos];
    this.pos += 1;
    return t;
  }

  parse(): MissingPropagatingNumber {
    const value = this.parseAddSub();
    if (this.pos !== this.tokens.length) {
      throw new Error(`Nieoczekiwany token przy pozycji ${this.pos}`);
    }
    return value;
  }

  private parseAddSub(): MissingPropagatingNumber {
    let left = this.parseMulDiv();
    while (this.peek()?.kind === 'op' && (this.peek()!.text === '+' || this.peek()!.text === '-')) {
      const op = this.consume().text;
      const right = this.parseMulDiv();
      if (left === null || right === null) {
        left = null;
      } else {
        left = op === '+' ? left + right : left - right;
      }
    }
    return left;
  }

  private parseMulDiv(): MissingPropagatingNumber {
    let left = this.parseUnary();
    while (this.peek()?.kind === 'op' && (this.peek()!.text === '*' || this.peek()!.text === '/')) {
      const op = this.consume().text;
      const right = this.parseUnary();
      if (left === null || right === null) {
        left = null;
      } else if (op === '/') {
        left = right === 0 ? Number.POSITIVE_INFINITY : left / right;
      } else {
        left = left * right;
      }
    }
    return left;
  }

  private parseUnary(): MissingPropagatingNumber {
    if (this.peek()?.kind === 'op' && this.peek()!.text === '-') {
      this.consume();
      const value = this.parseUnary();
      return value === null ? null : -value;
    }
    return this.parsePrimary();
  }

  private parsePrimary(): MissingPropagatingNumber {
    const token = this.peek();
    if (!token) throw new Error('Nieoczekiwany koniec wyrażenia');
    if (token.kind === 'num') {
      this.consume();
      return Number(token.text);
    }
    if (token.kind === 'op' && token.text === '(') {
      this.consume();
      const value = this.parseAddSub();
      if (this.peek()?.kind !== 'op' || this.peek()!.text !== ')') {
        throw new Error('Brak domykającego nawiasu');
      }
      this.consume();
      return value;
    }
    if (token.kind === 'ident') {
      this.consume();
      if (token.text in FUNCTIONS) {
        if (this.peek()?.kind !== 'op' || this.peek()!.text !== '(') {
          throw new Error(`Funkcja ${token.text} wymaga nawiasów`);
        }
        this.consume();
        const args: MissingPropagatingNumber[] = [];
        if (!(this.peek()?.kind === 'op' && this.peek()!.text === ')')) {
          args.push(this.parseAddSub());
          while (this.peek()?.kind === 'op' && this.peek()!.text === ',') {
            this.consume();
            args.push(this.parseAddSub());
          }
        }
        if (this.peek()?.kind !== 'op' || this.peek()!.text !== ')') {
          throw new Error('Brak domykającego nawiasu wywołania funkcji');
        }
        this.consume();
        return FUNCTIONS[token.text](args);
      }
      return this.resolve(token.text);
    }
    throw new Error(`Nieoczekiwany token: ${token.text}`);
  }
}

/** Ewaluuje wyrażenie (identyfikatory = kody linii kanonicznych) przeciw mapie wartości. `null` = MISSING, propaguje się przez każdy operator. */
export function evaluateArithmeticExpression(
  expression: string,
  valuesByLineCode: Readonly<Record<string, MissingPropagatingNumber>>
): MissingPropagatingNumber {
  const tokens = tokenize(expression);
  const parser = new ExpressionParser(tokens, (id) => {
    if (!(id in valuesByLineCode)) return null; // nieznany/nieprzekazany kod = traktuj jak brak danych, nie jak błąd programu
    return valuesByLineCode[id];
  });
  return parser.parse();
}

// ---------------------------------------------------------------------------
// KNOWN-ANSWER — definicja KPI + obliczenie z jawną semantyką statusu.
// ---------------------------------------------------------------------------

export interface AnalysisKnownAnswerKpiDef {
  kpiCode: string;
  kpiName: string;
  numeratorExpression: string;
  /** `null` ⇒ KPI nie jest ilorazem (np. sama wartość liniowa), pomija krok mianownika. */
  denominatorExpression: string | null;
  negativeDenominatorPolicy: AnalysisNegativeDenominatorPolicy;
}

export type AnalysisComputedKpiReasonCode =
  | 'MISSING_INPUT'
  | 'NEGATIVE_DENOMINATOR'
  | 'ZERO_DENOMINATOR'
  | 'NOT_APPLICABLE_STRUCTURAL';

export interface AnalysisComputedKpi {
  kpiCode: string;
  status: FinanceValueStatus;
  valueDecimal: string | null;
  reasonCode: AnalysisComputedKpiReasonCode | null;
}

/**
 * `valuesByLineCode`: `null` oznacza MISSING (brak danych źródłowych) —
 * NIGDY podawaj `0` jako proxy braku (dokładnie ten błąd, którego reguła
 * produktu zakazuje, WP-B01 §2.7 / CLAUDE.md).
 */
export function computeKnownAnswerKpi(
  def: AnalysisKnownAnswerKpiDef,
  valuesByLineCode: Readonly<Record<string, MissingPropagatingNumber>>
): AnalysisComputedKpi {
  const numerator = evaluateArithmeticExpression(def.numeratorExpression, valuesByLineCode);
  if (numerator === null) {
    return { kpiCode: def.kpiCode, status: 'MISSING', valueDecimal: null, reasonCode: 'MISSING_INPUT' };
  }

  if (def.denominatorExpression === null) {
    return {
      kpiCode: def.kpiCode,
      status: numerator === 0 ? 'PRESENT_ZERO' : 'PRESENT_NONZERO',
      valueDecimal: String(numerator),
      reasonCode: null,
    };
  }

  const denominator = evaluateArithmeticExpression(def.denominatorExpression, valuesByLineCode);
  if (denominator === null) {
    return { kpiCode: def.kpiCode, status: 'MISSING', valueDecimal: null, reasonCode: 'MISSING_INPUT' };
  }
  if (denominator === 0) {
    // Nie jest to "ujemny mianownik" (osobna reguła), ale ta sama zasada
    // produktu: nigdy nie pokazuj wyniku dzielenia przez zero jako liczby
    // (byłoby ±Infinity) — bezpieczny domyślny fail-closed do NA.
    return { kpiCode: def.kpiCode, status: 'NA', valueDecimal: null, reasonCode: 'ZERO_DENOMINATOR' };
  }
  if (denominator < 0) {
    switch (def.negativeDenominatorPolicy) {
      case 'FORCE_NA':
        return { kpiCode: def.kpiCode, status: 'NA', valueDecimal: null, reasonCode: 'NEGATIVE_DENOMINATOR' };
      case 'FLAG_ONLY': {
        const value = numerator / denominator;
        return { kpiCode: def.kpiCode, status: value === 0 ? 'PRESENT_ZERO' : 'PRESENT_NONZERO', valueDecimal: String(value), reasonCode: 'NEGATIVE_DENOMINATOR' };
      }
      case 'ALLOW_NEGATIVE_RATIO': {
        const value = numerator / denominator;
        return { kpiCode: def.kpiCode, status: value === 0 ? 'PRESENT_ZERO' : 'PRESENT_NONZERO', valueDecimal: String(value), reasonCode: null };
      }
      default:
        // Nieznana wartość polityki (rozszerzenie kontraktu backendowego,
        // patrz komentarz przy `AnalysisNegativeDenominatorPolicyValues`) —
        // fail-closed jak FORCE_NA, NIGDY "policz mimo to" po cichu.
        return { kpiCode: def.kpiCode, status: 'NA', valueDecimal: null, reasonCode: 'NEGATIVE_DENOMINATOR' };
    }
  }

  const value = numerator / denominator;
  return { kpiCode: def.kpiCode, status: value === 0 ? 'PRESENT_ZERO' : 'PRESENT_NONZERO', valueDecimal: String(value), reasonCode: null };
}

/** Buduje mapę `lineCode -> number|null` z `FinanceValue[]` — most między semantyką API (Pakiet C) i tym evaluatorem. */
export function financeValuesToLineCodeMap(entries: readonly { lineCode: string; value: Pick<FinanceValue, 'status' | 'valueDecimal'> }[]): Record<string, MissingPropagatingNumber> {
  const result: Record<string, MissingPropagatingNumber> = {};
  for (const entry of entries) {
    const { status, valueDecimal } = entry.value;
    if (status === 'PRESENT_ZERO' || status === 'PRESENT_NONZERO') {
      result[entry.lineCode] = valueDecimal === null ? null : Number(valueDecimal);
    } else {
      // MISSING/NA/NOT_APPLICABLE — wszystkie trzy propagują jako "brak" do
      // evaluatora (żaden nie jest 0). Rozróżnienie MIĘDZY nimi jest
      // wyświetlane wyżej (financeValueDisplayReasonLabel), nie tutaj.
      result[entry.lineCode] = null;
    }
  }
  return result;
}
