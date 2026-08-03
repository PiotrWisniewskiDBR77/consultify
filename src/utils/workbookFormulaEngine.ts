/**
 * workbookFormulaEngine — lekki, przeglądarkowy interpreter formuł Excela dla
 * edytowalnej siatki arkusza (`EditableSpreadsheetGrid`).
 *
 * KONTEKST (zadanie „najmniejszy arkusz, który jest naprawdę arkuszem"):
 * właściciel ma móc kliknąć komórkę WEJŚCIOWĄ (np. stopę dyskontową na
 * arkuszu Założeń) i zobaczyć, jak przeliczają się formuły, które od niej
 * zależą (np. NPV/IRR na arkuszu Wyników) — BEZ przeładowania strony i bez
 * pobierania pliku. Serwer (WorkbookBuilder.ts) nie ma dziś żadnego ogólnego
 * silnika liczącego formuły — ExcelJS tylko ZAPISUJE formułę do pliku, samo
 * wyliczenie robi dopiero Excel/Google Sheets po otwarciu (patrz komentarz
 * "P1 — Cached formula results" w WorkbookBuilder.ts: nawet tam jest to tylko
 * naiwne składanie STAŁYCH literałów, nie pełny silnik). Zbudowanie pełnego
 * silnika po stronie serwera i tak wymagałoby napisania interpretera formuł —
 * więc zamiast robić to DWA razy, robimy to raz, w przeglądarce, gdzie wynik
 * jest też natychmiastowy (zero round-tripu przy każdym kliknięciu).
 *
 * ZAKRES FUNKCJI — wyłącznie te, które faktycznie występują w 8 szablonach
 * parametrycznych (`server/src/services/workbook/templates/*.ts`, potwierdzone
 * grepem 2026-07-28: `grep -rn "formula" templates/*.ts`) + IF (jawnie
 * wymienione w specyfikacji zadania jako podstawowy budulec):
 *   SUM     — cashflow12m, operatingBudget, loanAmortization, dcfValuation,
 *             projectViability
 *   MAX     — threeScenarioPnL, projectViability
 *   PV      — dcfValuation
 *   PMT     — loanAmortization
 *   NPV     — projectViability
 *   IRR     — projectViability
 *   COUNTIF — projectViability (okres zwrotu, "<0")
 *   IF      — nie znaleziono w 8 szablonach, ale jawnie w specyfikacji zadania
 *             jako minimalny budulec warunkowy (arkusze generowane przez LLM
 *             z pewnością go używają).
 * ŚWIADOMIE POMINIĘTE (nie ma dowodu w kodzie): AVERAGE, VLOOKUP, INDEX/MATCH,
 * CHOOSE, TEXT, daty. Nierozpoznana funkcja/identyfikator → komórka pokazuje
 * błąd `#NAZWA?` zamiast fałszywego zera lub crasha całej siatki.
 *
 * NAZWANE ZAKRESY (P3, `isAssumptions`): świadomie NIEOBSŁUGIWANE — to
 * artefakt budowany WYŁĄCZNIE przez ExcelJS przy eksporcie (`wb.definedNames`),
 * nieobecny w WorkbookSchema JSON, którym operuje ta siatka. Sprawdzone na
 * `projectViability.ts` (`aRef()`): sam szablon i tak referuje komórki przez
 * ABSOLUTNY adres `'Założenia'!$B$5`, nigdy przez przyjazną nazwę — więc model
 * NPV/IRR z demo działa poprawnie mimo tego ograniczenia. Formuła z bziurym
 * identyfikatorem (prawdziwa nazwana referencja) dostanie `#NAZWA?`.
 *
 * CYKLE: silnik ma WŁASNĄ, minimalną ochronę przed nieskończoną rekursją
 * (zbiór "w trakcie liczenia" per przebieg, patrz `callStack` niżej) — to NIE
 * jest duplikat bramki DX-02 (`workbookQualityGate.ts`, `checkFormulaCycles`).
 * DX-02 to STATYCZNY audyt treści CAŁEGO skoroszytu w momencie generowania
 * (czy model jest sensowny), uruchamiany na serwerze nad innym kształtem
 * danych. Tu potrzebna jest kolejność przeliczania pojedynczej edycji w
 * przeglądarce — inny cel, inny moment, inny format wejścia; ochrona przed
 * cyklem jest nieuniknioną częścią SAMEGO przeliczania (bez niej edycja
 * komórki w cyklu zawiesza kartę), nie osobną „bramką jakości".
 */

// ---------------------------------------------------------------------------
// Typy wejścia — dokładnie kształt WorkbookSchema (server/src/services/workbook/
// WorkbookSchema.ts): sheets[].columns[].key/header, sheets[].rows[].cells[key].
// Celowo luźniejsze niż zod (pole może brakować z różnych źródeł mocka/API).
// ---------------------------------------------------------------------------

export interface FormulaCellRaw {
  value?: string | number | boolean | null;
  formula?: string;
  [extra: string]: unknown;
}

export interface FormulaColumn {
  key: string;
  header?: string;
  [extra: string]: unknown;
}

export interface FormulaRow {
  cells?: Record<string, FormulaCellRaw | undefined>;
  [extra: string]: unknown;
}

export interface FormulaSheet {
  name?: string;
  columns?: FormulaColumn[];
  rows?: FormulaRow[];
  [extra: string]: unknown;
}

export type ComputedScalar = number | string | boolean | null;

export interface ComputedCell {
  raw: FormulaCellRaw;
  /** Wynik: liczba/tekst/bool/null, ALBO `null` gdy `error` jest ustawione. */
  computed: ComputedScalar;
  isFormula: boolean;
  error?: string; // np. "#CYKL!", "#NAZWA?", "#LICZBA!", "#WARTOŚĆ!"
}

export interface ComputedRow {
  cells: Record<string, ComputedCell>;
}

export interface ComputedSheet {
  name: string;
  columns: FormulaColumn[];
  rows: ComputedRow[];
}

// ---------------------------------------------------------------------------
// Adresowanie A1 — SPÓJNE z konwencją serwera (workbookQualityGate.ts
// dataRowNumber/cellAddress/colIndexToLetter): nagłówek = wiersz 1, pierwszy
// wiersz danych (rows[0]) = wiersz Excela 2; kolumna A = index 0.
// ---------------------------------------------------------------------------

export function colIndexToLetter(index0: number): string {
  let n = index0 + 1;
  let s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function colLetterToIndex1(letters: string): number {
  let idx = 0;
  for (let k = 0; k < letters.length; k++) {
    idx = idx * 26 + (letters.charCodeAt(k) - 64);
  }
  return idx;
}

export function excelRowForDataRowIndex(rowIndex0: number): number {
  return rowIndex0 + 2;
}

export function dataRowIndexForExcelRow(excelRow: number): number {
  return excelRow - 2;
}

function normSheetName(name: string | undefined | null): string {
  return (name ?? '').trim().toLowerCase();
}

// ---------------------------------------------------------------------------
// Błąd formuły — rzucany wewnątrz ewaluacji, złapany na granicy komórki.
// ---------------------------------------------------------------------------

class FormulaError extends Error {
  code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Lexer
// ---------------------------------------------------------------------------

type Token =
  | { t: 'num'; v: number }
  | { t: 'str'; v: string }
  | {
      t: 'ref';
      sheet: string | null;
      c1: number;
      r1: number;
      c2: number;
      r2: number;
      isRange: boolean;
    }
  | { t: 'ident'; name: string }
  | { t: 'unknown'; name: string }
  | { t: 'op'; v: string }
  | { t: 'eof' };

// Ta sama forma referencji co server/src/services/workbook/workbookQualityGate.ts
// extractCellRefs (DX-02) — celowo spójna heurystyka adresowania, ale użyta tu
// do INNEGO celu (lexing pojedynczej formuły, nie audyt całego grafu).
const REF_RE =
  /^(?:'([^']+)'!|([A-Za-z_][A-Za-z0-9_ ]*)!)?\$?([A-Za-z]{1,3})\$?(\d{1,7})(?::\$?([A-Za-z]{1,3})\$?(\d{1,7}))?/;

class Lexer {
  private pos = 0;
  constructor(private src: string) {}

  private rest(): string {
    return this.src.slice(this.pos);
  }

  private skipWs() {
    while (this.pos < this.src.length && /\s/.test(this.src[this.pos])) this.pos++;
  }

  next(): Token {
    this.skipWs();
    if (this.pos >= this.src.length) return { t: 'eof' };
    const rest = this.rest();

    // Number (incl. trailing percent literal, e.g. "8%" → handled as NUM then
    // a following '%' op consumed by the parser's postfix rule).
    const numM = /^\d+(?:[.,]\d+)?/.exec(rest);
    // A number must not be immediately followed by a column-letter+digit
    // pattern that would make it part of a ref — refs never start with a
    // digit, so this is unambiguous.
    if (numM) {
      this.pos += numM[0].length;
      return { t: 'num', v: parseFloat(numM[0].replace(',', '.')) };
    }

    // String literal
    const strM = /^"([^"]*)"/.exec(rest);
    if (strM) {
      this.pos += strM[0].length;
      return { t: 'str', v: strM[1] };
    }

    // Cell / range reference (checked BEFORE bare identifiers — a function
    // name is never immediately followed by a digit, so no ambiguity).
    const refM = REF_RE.exec(rest);
    if (refM) {
      this.pos += refM[0].length;
      const sheet = refM[1] ?? refM[2] ?? null;
      const c1 = colLetterToIndex1(refM[3]);
      const r1 = parseInt(refM[4], 10);
      const isRange = !!refM[5];
      const c2 = refM[5] ? colLetterToIndex1(refM[5]) : c1;
      const r2 = refM[6] ? parseInt(refM[6], 10) : r1;
      return {
        t: 'ref',
        sheet: sheet ? sheet.trim() : null,
        c1: Math.min(c1, c2),
        r1: Math.min(r1, r2),
        c2: Math.max(c1, c2),
        r2: Math.max(r1, r2),
        isRange,
      };
    }

    // Function name: identifier immediately followed by '(' (whitespace
    // tolerated between name and paren).
    const identM = /^[A-Za-z_][A-Za-z0-9_.]*/.exec(rest);
    if (identM) {
      const after = rest.slice(identM[0].length);
      if (/^\s*\(/.test(after)) {
        this.pos += identM[0].length;
        return { t: 'ident', name: identM[0].toUpperCase() };
      }
      // Bare identifier (e.g. a named range) — not supported (see file header),
      // surfaced as a graceful #NAZWA? at eval time instead of a parse crash.
      this.pos += identM[0].length;
      return { t: 'unknown', name: identM[0] };
    }

    // Multi-char operators first
    for (const op of ['<>', '<=', '>=']) {
      if (rest.startsWith(op)) {
        this.pos += op.length;
        return { t: 'op', v: op };
      }
    }
    const ch = rest[0];
    if ('+-*/^%,()&=<>'.includes(ch)) {
      this.pos += 1;
      return { t: 'op', v: ch };
    }

    // Unrecognized character — skip it defensively so one stray glyph
    // doesn't take down the whole formula bar; the parser will most likely
    // then hit an unexpected-token error anyway, mapped to #BŁĄD!.
    this.pos += 1;
    return this.next();
  }
}

// ---------------------------------------------------------------------------
// AST + parser (precedencja rosnąco: porównanie < konkatenacja < addytywne <
// mnożenie < potęga < unarny minus < procent-postfiks < prymitywy).
// ---------------------------------------------------------------------------

type Node =
  | { t: 'num'; v: number }
  | { t: 'str'; v: string }
  | {
      t: 'ref';
      sheet: string | null;
      c1: number;
      r1: number;
      c2: number;
      r2: number;
      isRange: boolean;
    }
  | { t: 'unknown'; name: string }
  | { t: 'call'; name: string; args: Node[] }
  | { t: 'unary'; op: '-'; arg: Node }
  | { t: 'pct'; arg: Node }
  | { t: 'bin'; op: '+' | '-' | '*' | '/' | '^' | '&'; l: Node; r: Node }
  | { t: 'cmp'; op: '=' | '<>' | '<' | '<=' | '>' | '>='; l: Node; r: Node };

class Parser {
  private tokens: Token[] = [];
  private pos = 0;

  constructor(src: string) {
    const lx = new Lexer(src);
    for (;;) {
      const tok = lx.next();
      this.tokens.push(tok);
      if (tok.t === 'eof') break;
      if (this.tokens.length > 5000) break; // perf guard, absurdly long formula
    }
  }

  private peek(): Token {
    return this.tokens[this.pos] ?? { t: 'eof' };
  }
  private advance(): Token {
    return this.tokens[this.pos++] ?? { t: 'eof' };
  }
  private isOp(tok: Token, v: string): tok is Extract<Token, { t: 'op' }> {
    return tok.t === 'op' && tok.v === v;
  }

  parse(): Node {
    const node = this.parseComparison();
    // Trailing garbage is tolerated (best-effort) rather than failing the
    // whole cell — Excel itself is far stricter, but a partial parse that
    // still shows a number beats a blank/crashed cell for this MVP grid.
    return node;
  }

  private parseComparison(): Node {
    let node = this.parseConcat();
    const tok = this.peek();
    const cmpOps = ['=', '<>', '<=', '>=', '<', '>'];
    if (tok.t === 'op' && cmpOps.includes(tok.v)) {
      this.advance();
      const r = this.parseConcat();
      node = { t: 'cmp', op: tok.v as '=' | '<>' | '<' | '<=' | '>' | '>=', l: node, r };
    }
    return node;
  }

  private parseConcat(): Node {
    let node = this.parseAdditive();
    while (this.isOp(this.peek(), '&')) {
      this.advance();
      const r = this.parseAdditive();
      node = { t: 'bin', op: '&', l: node, r };
    }
    return node;
  }

  private parseAdditive(): Node {
    let node = this.parseTerm();
    for (;;) {
      const tok = this.peek();
      if (this.isOp(tok, '+') || this.isOp(tok, '-')) {
        this.advance();
        const r = this.parseTerm();
        node = { t: 'bin', op: tok.v as '+' | '-', l: node, r };
      } else break;
    }
    return node;
  }

  private parseTerm(): Node {
    let node = this.parsePow();
    for (;;) {
      const tok = this.peek();
      if (this.isOp(tok, '*') || this.isOp(tok, '/')) {
        this.advance();
        const r = this.parsePow();
        node = { t: 'bin', op: tok.v as '*' | '/', l: node, r };
      } else break;
    }
    return node;
  }

  private parsePow(): Node {
    let node = this.parseUnary();
    while (this.isOp(this.peek(), '^')) {
      this.advance();
      const r = this.parseUnary();
      node = { t: 'bin', op: '^', l: node, r };
    }
    return node;
  }

  private parseUnary(): Node {
    if (this.isOp(this.peek(), '-')) {
      this.advance();
      return { t: 'unary', op: '-', arg: this.parseUnary() };
    }
    if (this.isOp(this.peek(), '+')) {
      this.advance();
      return this.parseUnary();
    }
    return this.parsePostfix();
  }

  private parsePostfix(): Node {
    let node = this.parsePrimary();
    while (this.isOp(this.peek(), '%')) {
      this.advance();
      node = { t: 'pct', arg: node };
    }
    return node;
  }

  private parsePrimary(): Node {
    const tok = this.advance();
    if (tok.t === 'num') return { t: 'num', v: tok.v };
    if (tok.t === 'str') return { t: 'str', v: tok.v };
    if (tok.t === 'ref')
      return {
        t: 'ref',
        sheet: tok.sheet,
        c1: tok.c1,
        r1: tok.r1,
        c2: tok.c2,
        r2: tok.r2,
        isRange: tok.isRange,
      };
    if (tok.t === 'unknown') return { t: 'unknown', name: tok.name };
    if (tok.t === 'ident') {
      // expect '('
      if (!this.isOp(this.peek(), '(')) throw new FormulaError('#BŁĄD!');
      this.advance();
      const args: Node[] = [];
      if (!this.isOp(this.peek(), ')')) {
        args.push(this.parseComparison());
        while (this.isOp(this.peek(), ',')) {
          this.advance();
          args.push(this.parseComparison());
        }
      }
      if (!this.isOp(this.peek(), ')')) throw new FormulaError('#BŁĄD!');
      this.advance();
      return { t: 'call', name: tok.name, args };
    }
    if (this.isOp(tok, '(')) {
      const inner = this.parseComparison();
      if (!this.isOp(this.peek(), ')')) throw new FormulaError('#BŁĄD!');
      this.advance();
      return inner;
    }
    throw new FormulaError('#BŁĄD!');
  }
}

// ---------------------------------------------------------------------------
// Ewaluacja
// ---------------------------------------------------------------------------

interface SheetIndex {
  key: string; // znormalizowana nazwa
  sheet: FormulaSheet;
  colIndexByKey: Map<string, number>; // key → index0
}

interface EvalCtx {
  sheetsByKey: Map<string, SheetIndex>;
  currentSheetKey: string;
  getCellComputed: (sheetKey: string, colIdx0: number, excelRow: number) => ComputedScalar;
}

function toNumber(v: ComputedScalar): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(String(v).replace(',', '.').replace('%', ''));
  return Number.isFinite(n) ? n : NaN;
}

function toText(v: ComputedScalar): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'PRAWDA' : 'FAŁSZ';
  return String(v);
}

function resolveSheetKey(ctx: EvalCtx, sheetName: string | null): string {
  if (!sheetName) return ctx.currentSheetKey;
  const key = normSheetName(sheetName);
  return ctx.sheetsByKey.has(key) ? key : `__missing__:${key}`;
}

/** Zwraca listę wartości komórek dla node'a REF (pojedyncza komórka → tablica
 *  1-elementowa; zakres → wszystkie komórki w kolejności wiersz-po-wierszu). */
function expandRef(node: Extract<Node, { t: 'ref' }>, ctx: EvalCtx): ComputedScalar[] {
  const sheetKey = resolveSheetKey(ctx, node.sheet);
  const out: ComputedScalar[] = [];
  for (let r = node.r1; r <= node.r2; r++) {
    for (let c = node.c1; c <= node.c2; c++) {
      out.push(ctx.getCellComputed(sheetKey, c - 1, r));
    }
  }
  return out;
}

/** Argumenty funkcji (SUM/MAX/NPV/...) — każdy argument rozwijany do tablicy
 *  (zakres → wiele wartości w kolejności; skalar → jednoelementowa tablica),
 *  po czym KONKATENOWANY w kolejności podania (kolejność ma znaczenie dla
 *  NPV/IRR, gdzie pozycja = numer okresu). */
function evalArgList(node: Node, ctx: EvalCtx): ComputedScalar[] {
  if (node.t === 'ref') return expandRef(node, ctx);
  return [evalScalar(node, ctx)];
}

function evalScalar(node: Node, ctx: EvalCtx): ComputedScalar {
  switch (node.t) {
    case 'num':
      return node.v;
    case 'str':
      return node.v;
    case 'unknown':
      // Domniemana nazwana referencja / nierozpoznany token — patrz komentarz
      // nagłówkowy pliku (nazwane zakresy świadomie nieobsłużone).
      throw new FormulaError('#NAZWA?');
    case 'ref': {
      if (node.isRange && (node.r1 !== node.r2 || node.c1 !== node.c2)) {
        // Zakres w pozycji skalarnej — Excel czasem robi "implicit
        // intersection"; tu prościej i bezpieczniej zgłosić błąd wartości.
        throw new FormulaError('#WARTOŚĆ!');
      }
      const sheetKey = resolveSheetKey(ctx, node.sheet);
      return ctx.getCellComputed(sheetKey, node.c1 - 1, node.r1);
    }
    case 'unary': {
      const v = toNumber(evalScalar(node.arg, ctx));
      return -v;
    }
    case 'pct': {
      const v = toNumber(evalScalar(node.arg, ctx));
      return v / 100;
    }
    case 'bin': {
      if (node.op === '&') return toText(evalScalar(node.l, ctx)) + toText(evalScalar(node.r, ctx));
      const l = toNumber(evalScalar(node.l, ctx));
      const r = toNumber(evalScalar(node.r, ctx));
      switch (node.op) {
        case '+':
          return l + r;
        case '-':
          return l - r;
        case '*':
          return l * r;
        case '/':
          if (r === 0) throw new FormulaError('#DZIEL/0!');
          return l / r;
        case '^':
          return Math.pow(l, r);
      }
      break;
    }
    case 'cmp': {
      const l = evalScalar(node.l, ctx);
      const r = evalScalar(node.r, ctx);
      const bothNumeric = typeof l !== 'string' && typeof r !== 'string';
      const ln = bothNumeric ? toNumber(l) : null;
      const rn = bothNumeric ? toNumber(r) : null;
      const cmpNum = (a: number, b: number, op: string): boolean => {
        switch (op) {
          case '=':
            return a === b;
          case '<>':
            return a !== b;
          case '<':
            return a < b;
          case '<=':
            return a <= b;
          case '>':
            return a > b;
          case '>=':
            return a >= b;
        }
        return false;
      };
      if (ln !== null && rn !== null) return cmpNum(ln, rn, node.op);
      const ls = toText(l).toLowerCase();
      const rs = toText(r).toLowerCase();
      switch (node.op) {
        case '=':
          return ls === rs;
        case '<>':
          return ls !== rs;
        default:
          return ls < rs
            ? node.op === '<' || node.op === '<='
            : ls > rs
              ? node.op === '>' || node.op === '>='
              : node.op === '<=' || node.op === '>=';
      }
    }
    case 'call':
      return evalCall(node, ctx);
  }
  throw new FormulaError('#BŁĄD!');
}

function isFiniteNumberValue(v: ComputedScalar): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function truthy(v: ComputedScalar): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') return v.trim() !== '' && v.trim() !== '0';
  return false;
}

// ---- IRR: Newton-Raphson z fallbackiem bisekcji (patrz komentarz nagłówkowy —
// brak jakiegokolwiek solvera IRR gdziekolwiek w repo, sprawdzone grepem). ----
function computeIrr(cashflows: number[], guess: number): number {
  const npvAt = (rate: number): number =>
    cashflows.reduce((acc, cf, i) => acc + cf / Math.pow(1 + rate, i), 0);
  const dNpvAt = (rate: number): number =>
    cashflows.reduce(
      (acc, cf, i) => (i === 0 ? acc : acc - (i * cf) / Math.pow(1 + rate, i + 1)),
      0
    );

  let rate = Number.isFinite(guess) ? guess : 0.1;
  for (let i = 0; i < 60; i++) {
    const f = npvAt(rate);
    const d = dNpvAt(rate);
    if (Math.abs(d) < 1e-10) break;
    const next = rate - f / d;
    if (!Number.isFinite(next) || next <= -0.999999) break;
    if (Math.abs(next - rate) < 1e-9) return next;
    rate = next;
  }
  if (Number.isFinite(npvAt(rate)) && Math.abs(npvAt(rate)) < 1e-2) return rate;

  // Fallback: bisekcja na poszukiwaniu zmiany znaku NPV(rate) w [-0.99, 10].
  let lo = -0.99;
  let hi = 10;
  let fLo = npvAt(lo);
  let fHi = npvAt(hi);
  if (!Number.isFinite(fLo) || !Number.isFinite(fHi) || fLo * fHi > 0) {
    throw new FormulaError('#LICZBA!');
  }
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    const fMid = npvAt(mid);
    if (Math.abs(fMid) < 1e-7) return mid;
    if (fLo * fMid < 0) {
      hi = mid;
      fHi = fMid;
    } else {
      lo = mid;
      fLo = fMid;
    }
  }
  return (lo + hi) / 2;
}

function matchesCountifCriteria(cellValue: ComputedScalar, criteria: ComputedScalar): boolean {
  if (typeof criteria === 'number') {
    return typeof cellValue === 'number' && cellValue === criteria;
  }
  const s = toText(criteria).trim();
  const m = /^(<=|>=|<>|<|>|=)?\s*(.*)$/.exec(s);
  const op = m?.[1] || '=';
  const rhsRaw = (m?.[2] ?? '').trim();
  const rhsNum = Number(rhsRaw.replace(',', '.'));
  if (rhsRaw !== '' && Number.isFinite(rhsNum)) {
    const cv = typeof cellValue === 'number' ? cellValue : Number(cellValue);
    if (!Number.isFinite(cv)) return op === '<>';
    switch (op) {
      case '=':
        return cv === rhsNum;
      case '<>':
        return cv !== rhsNum;
      case '<':
        return cv < rhsNum;
      case '<=':
        return cv <= rhsNum;
      case '>':
        return cv > rhsNum;
      case '>=':
        return cv >= rhsNum;
    }
  }
  const cvs = toText(cellValue).toLowerCase();
  const rvs = rhsRaw.toLowerCase();
  return op === '<>' ? cvs !== rvs : cvs === rvs;
}

function evalCall(node: Extract<Node, { t: 'call' }>, ctx: EvalCtx): ComputedScalar {
  const { name, args } = node;
  switch (name) {
    case 'SUM': {
      const vals = args.flatMap((a) => evalArgList(a, ctx)).filter(isFiniteNumberValue);
      return vals.reduce((a, b) => a + b, 0);
    }
    case 'MAX': {
      const vals = args.flatMap((a) => evalArgList(a, ctx)).filter(isFiniteNumberValue);
      return vals.length ? Math.max(...vals) : 0;
    }
    case 'IF': {
      if (args.length < 2) throw new FormulaError('#ARG!');
      const cond = truthy(evalScalar(args[0], ctx));
      if (cond) return evalScalar(args[1], ctx);
      return args.length > 2 ? evalScalar(args[2], ctx) : false;
    }
    case 'COUNTIF': {
      if (args.length < 2) throw new FormulaError('#ARG!');
      const range = evalArgList(args[0], ctx);
      const criteria = evalScalar(args[1], ctx);
      return range.filter((v) => matchesCountifCriteria(v, criteria)).length;
    }
    case 'NPV': {
      if (args.length < 2) throw new FormulaError('#ARG!');
      const rate = toNumber(evalScalar(args[0], ctx));
      const values = args
        .slice(1)
        .flatMap((a) => evalArgList(a, ctx))
        .filter(isFiniteNumberValue);
      return values.reduce((acc, v, i) => acc + v / Math.pow(1 + rate, i + 1), 0);
    }
    case 'IRR': {
      if (args.length < 1) throw new FormulaError('#ARG!');
      const raw = evalArgList(args[0], ctx);
      // Puste/niepuste komórki w środku szeregu okresów NIE mogą być pomijane
      // (przesunęłoby to numerację okresu) — traktujemy nieliczbowe jako 0.
      const cashflows = raw.map((v) => (isFiniteNumberValue(v) ? v : 0));
      const guess = args.length > 1 ? toNumber(evalScalar(args[1], ctx)) : 0.1;
      if (cashflows.length < 2) throw new FormulaError('#LICZBA!');
      return computeIrr(cashflows, guess);
    }
    case 'PV': {
      // PV(rate, nper, pmt, [fv], [type])
      const rate = toNumber(evalScalar(args[0], ctx));
      const nper = toNumber(evalScalar(args[1], ctx));
      const pmt = toNumber(evalScalar(args[2], ctx));
      const fv = args.length > 3 ? toNumber(evalScalar(args[3], ctx)) : 0;
      const type = args.length > 4 ? toNumber(evalScalar(args[4], ctx)) : 0;
      if (rate === 0) return -(fv + pmt * nper);
      const factor = Math.pow(1 + rate, nper);
      return -(fv + pmt * (1 + rate * type) * ((factor - 1) / rate)) / factor;
    }
    case 'PMT': {
      // PMT(rate, nper, pv, [fv], [type])
      const rate = toNumber(evalScalar(args[0], ctx));
      const nper = toNumber(evalScalar(args[1], ctx));
      const pv = toNumber(evalScalar(args[2], ctx));
      const fv = args.length > 3 ? toNumber(evalScalar(args[3], ctx)) : 0;
      const type = args.length > 4 ? toNumber(evalScalar(args[4], ctx)) : 0;
      if (rate === 0) return -(pv + fv) / nper;
      const factor = Math.pow(1 + rate, nper);
      return (-(pv * factor + fv) * rate) / ((1 + rate * type) * (factor - 1));
    }
    default:
      throw new FormulaError('#NAZWA?');
  }
}

// ---------------------------------------------------------------------------
// Przeliczenie całego skoroszytu (wszystkie arkusze naraz — formuły
// cross-sheet są normą w naszych szablonach, patrz projectViability.ts).
// ---------------------------------------------------------------------------

const CYCLE_ERROR = '#CYKL!';
const MAX_FORMULA_CACHE = 5000;

export function recalcWorkbook(sheets: FormulaSheet[]): ComputedSheet[] {
  const sheetIndexes: SheetIndex[] = sheets.map((sheet) => {
    const colIndexByKey = new Map<string, number>();
    (sheet.columns ?? []).forEach((c, i) => colIndexByKey.set(c.key, i));
    return { key: normSheetName(sheet.name), sheet, colIndexByKey };
  });
  const sheetsByKey = new Map<string, SheetIndex>();
  sheetIndexes.forEach((si) => sheetsByKey.set(si.key, si));

  // memo: id komórki → wynik (albo błąd zapamiętany jako {error}).
  const memo = new Map<string, { value: ComputedScalar; error?: string }>();
  const callStack = new Set<string>();
  const astCache = new Map<string, Node>();

  function parseFormulaCached(formula: string): Node {
    let ast = astCache.get(formula);
    if (!ast) {
      ast = new Parser(formula).parse();
      if (astCache.size < MAX_FORMULA_CACHE) astCache.set(formula, ast);
    }
    return ast;
  }

  function getCellComputed(sheetKey: string, colIdx0: number, excelRow: number): ComputedScalar {
    const id = `${sheetKey}!${colIdx0}:${excelRow}`;
    const cached = memo.get(id);
    if (cached) {
      if (cached.error) throw new FormulaError(cached.error);
      return cached.value;
    }
    if (callStack.has(id)) {
      // Odkryty cykl w trakcie liczenia TEJ komórki — zapamiętaj i przerwij
      // rekursję (bez tego kliknięcie w komórkę z cyklu zawiesza kartę).
      memo.set(id, { value: null, error: CYCLE_ERROR });
      throw new FormulaError(CYCLE_ERROR);
    }

    const si = sheetsByKey.get(sheetKey);
    if (!si || sheetKey.startsWith('__missing__:')) {
      memo.set(id, { value: null, error: '#REF!' });
      throw new FormulaError('#REF!');
    }
    const rowIndex = dataRowIndexForExcelRow(excelRow);
    const columns = si.sheet.columns ?? [];
    const rows = si.sheet.rows ?? [];
    if (colIdx0 < 0 || colIdx0 >= columns.length || rowIndex < 0 || rowIndex >= rows.length) {
      // Poza zakresem danych → pusta komórka (0/'' w zależności od kontekstu
      // — reprezentowane jako null, kontekst arytmetyczny sam to zrzutuje).
      memo.set(id, { value: null });
      return null;
    }

    const colKey = columns[colIdx0]?.key;
    const cell = colKey ? rows[rowIndex]?.cells?.[colKey] : undefined;

    callStack.add(id);
    try {
      let result: ComputedScalar;
      if (cell && typeof cell.formula === 'string' && cell.formula.trim()) {
        const ctx: EvalCtx = { sheetsByKey, currentSheetKey: sheetKey, getCellComputed };
        const ast = parseFormulaCached(cell.formula.trim());
        result = evalScalar(ast, ctx);
      } else if (cell && cell.value !== undefined && cell.value !== null) {
        result = cell.value;
      } else {
        result = null;
      }
      memo.set(id, { value: result });
      return result;
    } catch (err) {
      const code = err instanceof FormulaError ? err.code : '#BŁĄD!';
      memo.set(id, { value: null, error: code });
      throw err instanceof FormulaError ? err : new FormulaError(code);
    } finally {
      callStack.delete(id);
    }
  }

  return sheetIndexes.map((si) => {
    const columns = si.sheet.columns ?? [];
    const rows = si.sheet.rows ?? [];
    const outRows: ComputedRow[] = rows.map((row, rowIdx) => {
      const excelRow = excelRowForDataRowIndex(rowIdx);
      const cells: Record<string, ComputedCell> = {};
      columns.forEach((col, colIdx) => {
        const raw = row.cells?.[col.key] ?? {};
        const isFormula = typeof raw.formula === 'string' && raw.formula.trim() !== '';
        try {
          const value = getCellComputed(si.key, colIdx, excelRow);
          cells[col.key] = { raw, computed: value, isFormula };
        } catch (err) {
          const code = err instanceof FormulaError ? err.code : '#BŁĄD!';
          cells[col.key] = { raw, computed: null, isFormula, error: code };
        }
      });
      return { cells };
    });
    return { name: si.sheet.name || 'Sheet', columns, rows: outRows };
  });
}

// ---------------------------------------------------------------------------
// Pomocnicze dla UI edycji.
// ---------------------------------------------------------------------------

/** Parsuje to, co użytkownik wpisał w komórkę/pasek formuły, na kształt
 *  zapisywalny do WorkbookSchema (`{value}` albo `{formula}`, nigdy oba). */
export function parseCellInput(raw: string): { value?: ComputedScalar; formula?: string } {
  const trimmed = raw.trim();
  if (trimmed === '') return { value: null };
  if (trimmed.startsWith('=') && trimmed.length > 1) {
    return { formula: trimmed.slice(1).trim() };
  }
  if (/^(prawda|true)$/i.test(trimmed)) return { value: true };
  if (/^(fałsz|falsz|false)$/i.test(trimmed)) return { value: false };
  const isPercent = trimmed.endsWith('%');
  const numCandidate = (isPercent ? trimmed.slice(0, -1) : trimmed)
    .replace(/\s/g, '')
    .replace(',', '.');
  if (numCandidate !== '' && /^[+-]?\d+(\.\d+)?$/.test(numCandidate)) {
    const n = parseFloat(numCandidate);
    return { value: isPercent ? n / 100 : n };
  }
  return { value: trimmed };
}

/** Tekst do wyświetlenia w pasku formuły / przy wejściu w edycję: formuła z
 *  wiodącym "=" (konwencja Excela) albo surowa wartość jako string. */
export function rawCellToEditText(cell: FormulaCellRaw | undefined): string {
  if (!cell) return '';
  if (typeof cell.formula === 'string' && cell.formula.trim()) return `=${cell.formula.trim()}`;
  if (cell.value === undefined || cell.value === null) return '';
  return String(cell.value);
}

/** Tekst wyświetlany w komórce siatki (wynik obliczony, nie formuła). */
export function formatComputedForDisplay(cell: ComputedCell | undefined): string {
  if (!cell) return '';
  if (cell.error) return cell.error;
  const v = cell.computed;
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'PRAWDA' : 'FAŁSZ';
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return '#LICZBA!';
    const rounded = Math.round(v * 100) / 100;
    return rounded.toLocaleString('pl-PL', { maximumFractionDigits: 2 });
  }
  return v;
}
