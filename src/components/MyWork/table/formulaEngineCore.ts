/**
 * formulaEngineCore — Pure (browser-safe) port of the server formula engine.
 *
 * R5 / W2: this is a VERBATIM port of the pure parts of
 * `server/src/services/tablePlatform/formulaEngine.ts`:
 *   tokenize / Parser / parseFormula / extractFieldDependencies /
 *   evaluateFormula / BUILTINS / FormulaError / FormulaAST / FormulaContext
 *
 * The server-only pieces (Database, Logger, DependencyGraph,
 * recomputeAffectedFields, validateFormula) are intentionally NOT ported —
 * they have no place in the browser. The FE never imports the server module.
 *
 * INVARIANT: every expression must evaluate to the SAME result in this core
 * and in the server engine. The `tests/integration/table` suite asserts this
 * by importing both engines and comparing outputs. If you change behaviour
 * here, mirror it in the server file (or vice-versa) and keep the parity test
 * green.
 */

// ---------------------------------------------------------------------------
// AST types
// ---------------------------------------------------------------------------

export interface FormulaAST {
  type: 'function' | 'operator' | 'fieldRef' | 'literal';
  name?: string;
  value?: unknown;
  children?: FormulaAST[];
}

// ---------------------------------------------------------------------------
// Token types
// ---------------------------------------------------------------------------

type TokenType =
  | 'NUMBER'
  | 'STRING'
  | 'BOOLEAN'
  | 'IDENTIFIER'
  | 'OPERATOR'
  | 'COMPARISON'
  | 'LPAREN'
  | 'RPAREN'
  | 'COMMA'
  | 'LBRACKET'
  | 'RBRACKET'
  | 'EOF';

interface Token {
  type: TokenType;
  value: string;
  pos: number;
}

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

const OPERATOR_CHARS = new Set(['+', '-', '*', '/']);

export class FormulaError extends Error {
  constructor(
    message: string,
    public readonly position?: number
  ) {
    super(message);
    this.name = 'FormulaError';
  }
}

function tokenize(formula: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const len = formula.length;

  while (i < len) {
    const ch = formula[i];

    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    if (ch === '(') {
      tokens.push({ type: 'LPAREN', value: '(', pos: i });
      i++;
      continue;
    }
    if (ch === ')') {
      tokens.push({ type: 'RPAREN', value: ')', pos: i });
      i++;
      continue;
    }
    if (ch === '[') {
      tokens.push({ type: 'LBRACKET', value: '[', pos: i });
      i++;
      continue;
    }
    if (ch === ']') {
      tokens.push({ type: 'RBRACKET', value: ']', pos: i });
      i++;
      continue;
    }
    if (ch === ',') {
      tokens.push({ type: 'COMMA', value: ',', pos: i });
      i++;
      continue;
    }

    // String literals (double or single quotes)
    if (ch === '"' || ch === "'") {
      const quote = ch;
      const start = i;
      i++;
      let str = '';
      while (i < len && formula[i] !== quote) {
        if (formula[i] === '\\' && i + 1 < len) {
          str += formula[i + 1];
          i += 2;
        } else {
          str += formula[i];
          i++;
        }
      }
      if (i >= len) {
        throw new FormulaError(`Unterminated string literal starting at position ${start}`, start);
      }
      i++; // skip closing quote
      tokens.push({ type: 'STRING', value: str, pos: start });
      continue;
    }

    // Comparison operators (multi-char first)
    const twoChar = formula.slice(i, i + 2);
    if (['>=', '<=', '!='].includes(twoChar)) {
      tokens.push({ type: 'COMPARISON', value: twoChar, pos: i });
      i += 2;
      continue;
    }
    if (['>', '<', '='].includes(ch)) {
      tokens.push({ type: 'COMPARISON', value: ch, pos: i });
      i++;
      continue;
    }

    // Arithmetic operators
    if (OPERATOR_CHARS.has(ch)) {
      tokens.push({ type: 'OPERATOR', value: ch, pos: i });
      i++;
      continue;
    }

    // Numbers
    if (/[0-9]/.test(ch) || (ch === '.' && i + 1 < len && /[0-9]/.test(formula[i + 1]))) {
      const start = i;
      while (i < len && /[0-9]/.test(formula[i])) i++;
      if (i < len && formula[i] === '.') {
        i++;
        while (i < len && /[0-9]/.test(formula[i])) i++;
      }
      tokens.push({ type: 'NUMBER', value: formula.slice(start, i), pos: start });
      continue;
    }

    // Identifiers / keywords / field references
    if (/[a-zA-Z_]/.test(ch)) {
      const start = i;
      while (i < len && /[a-zA-Z0-9_]/.test(formula[i])) i++;
      const word = formula.slice(start, i);

      if (word === 'TRUE' || word === 'true' || word === 'FALSE' || word === 'false') {
        tokens.push({ type: 'BOOLEAN', value: word, pos: start });
      } else if (word === 'AND' || word === 'OR' || word === 'NOT') {
        tokens.push({ type: 'OPERATOR', value: word, pos: start });
      } else {
        tokens.push({ type: 'IDENTIFIER', value: word, pos: start });
      }
      continue;
    }

    // Field reference with braces: {fieldName}
    if (ch === '{') {
      const start = i;
      i++;
      let fieldName = '';
      while (i < len && formula[i] !== '}') {
        fieldName += formula[i];
        i++;
      }
      if (i >= len) {
        throw new FormulaError(`Unterminated field reference starting at position ${start}`, start);
      }
      i++; // skip }
      tokens.push({ type: 'IDENTIFIER', value: fieldName, pos: start });
      continue;
    }

    throw new FormulaError(`Unexpected character '${ch}' at position ${i}`, i);
  }

  tokens.push({ type: 'EOF', value: '', pos: i });
  return tokens;
}

// ---------------------------------------------------------------------------
// Recursive-descent parser
// ---------------------------------------------------------------------------

class Parser {
  private tokens: Token[];
  private pos = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token {
    return this.tokens[this.pos];
  }

  private advance(): Token {
    const t = this.tokens[this.pos];
    this.pos++;
    return t;
  }

  private expect(type: TokenType, value?: string): Token {
    const t = this.peek();
    if (t.type !== type || (value !== undefined && t.value !== value)) {
      throw new FormulaError(
        `Expected ${type}${value ? ` '${value}'` : ''} but got ${t.type} '${t.value}' at position ${t.pos}`,
        t.pos
      );
    }
    return this.advance();
  }

  parse(): FormulaAST {
    const ast = this.parseExpression();
    if (this.peek().type !== 'EOF') {
      const t = this.peek();
      throw new FormulaError(`Unexpected token '${t.value}' at position ${t.pos}`, t.pos);
    }
    return ast;
  }

  private parseExpression(): FormulaAST {
    return this.parseOr();
  }

  private parseOr(): FormulaAST {
    let left = this.parseAnd();
    while (this.peek().type === 'OPERATOR' && this.peek().value === 'OR') {
      this.advance();
      const right = this.parseAnd();
      left = { type: 'operator', name: 'OR', children: [left, right] };
    }
    return left;
  }

  private parseAnd(): FormulaAST {
    let left = this.parseNot();
    while (this.peek().type === 'OPERATOR' && this.peek().value === 'AND') {
      this.advance();
      const right = this.parseNot();
      left = { type: 'operator', name: 'AND', children: [left, right] };
    }
    return left;
  }

  private parseNot(): FormulaAST {
    if (this.peek().type === 'OPERATOR' && this.peek().value === 'NOT') {
      this.advance();
      const operand = this.parseComparison();
      return { type: 'operator', name: 'NOT', children: [operand] };
    }
    return this.parseComparison();
  }

  private parseComparison(): FormulaAST {
    let left = this.parseAddSub();
    while (this.peek().type === 'COMPARISON') {
      const op = this.advance().value;
      const right = this.parseAddSub();
      left = { type: 'operator', name: op, children: [left, right] };
    }
    return left;
  }

  private parseAddSub(): FormulaAST {
    let left = this.parseMulDiv();
    while (
      this.peek().type === 'OPERATOR' &&
      (this.peek().value === '+' || this.peek().value === '-')
    ) {
      const op = this.advance().value;
      const right = this.parseMulDiv();
      left = { type: 'operator', name: op, children: [left, right] };
    }
    return left;
  }

  private parseMulDiv(): FormulaAST {
    let left = this.parseUnary();
    while (
      this.peek().type === 'OPERATOR' &&
      (this.peek().value === '*' || this.peek().value === '/')
    ) {
      const op = this.advance().value;
      const right = this.parseUnary();
      left = { type: 'operator', name: op, children: [left, right] };
    }
    return left;
  }

  private parseUnary(): FormulaAST {
    if (this.peek().type === 'OPERATOR' && this.peek().value === '-') {
      this.advance();
      const operand = this.parsePrimary();
      return {
        type: 'operator',
        name: '*',
        children: [{ type: 'literal', value: -1 }, operand],
      };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): FormulaAST {
    const t = this.peek();

    if (t.type === 'NUMBER') {
      this.advance();
      return { type: 'literal', value: parseFloat(t.value) };
    }

    if (t.type === 'STRING') {
      this.advance();
      return { type: 'literal', value: t.value };
    }

    if (t.type === 'BOOLEAN') {
      this.advance();
      return { type: 'literal', value: t.value === 'TRUE' || t.value === 'true' };
    }

    if (t.type === 'LPAREN') {
      this.advance();
      const expr = this.parseExpression();
      this.expect('RPAREN');
      return expr;
    }

    if (t.type === 'IDENTIFIER') {
      const name = this.advance().value;

      // Function call: IDENTIFIER(...)
      if (this.peek().type === 'LPAREN') {
        this.advance(); // consume (
        const args: FormulaAST[] = [];
        if (this.peek().type !== 'RPAREN') {
          args.push(this.parseExpression());
          while (this.peek().type === 'COMMA') {
            this.advance();
            args.push(this.parseExpression());
          }
        }
        this.expect('RPAREN');
        return { type: 'function', name: name.toUpperCase(), children: args };
      }

      // Otherwise it's a field reference
      return { type: 'fieldRef', name };
    }

    throw new FormulaError(`Unexpected token '${t.value}' at position ${t.pos}`, t.pos);
  }
}

// ---------------------------------------------------------------------------
// Public: parseFormula
// ---------------------------------------------------------------------------

export function parseFormula(formula: string): FormulaAST {
  if (!formula || typeof formula !== 'string') {
    throw new FormulaError('Formula must be a non-empty string');
  }
  const trimmed = formula.trim();
  if (trimmed.length === 0) {
    throw new FormulaError('Formula must be a non-empty string');
  }
  const tokens = tokenize(trimmed);
  const parser = new Parser(tokens);
  return parser.parse();
}

// ---------------------------------------------------------------------------
// Public: extractFieldDependencies
// ---------------------------------------------------------------------------

export function extractFieldDependencies(ast: FormulaAST): string[] {
  const deps = new Set<string>();

  function walk(node: FormulaAST): void {
    if (node.type === 'fieldRef' && node.name) {
      deps.add(node.name);
    }
    if (node.children) {
      for (const child of node.children) {
        walk(child);
      }
    }
  }

  walk(ast);
  return Array.from(deps);
}

// ---------------------------------------------------------------------------
// Evaluator helpers
// ---------------------------------------------------------------------------

function toNumber(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

function toBoolean(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') return v.length > 0 && v.toLowerCase() !== 'false';
  return v != null;
}

function toDateSafe(v: unknown): Date | null {
  if (v instanceof Date) return v;
  if (typeof v === 'string' || typeof v === 'number') {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Built-in functions
// ---------------------------------------------------------------------------

export interface FormulaContext {
  recordId?: string;
  createdTime?: string;
}

type BuiltinFn = (args: unknown[], ctx?: FormulaContext) => unknown;

export const BUILTINS: Record<string, BuiltinFn> = {
  SUM: (args) => args.reduce((acc: number, v) => acc + toNumber(v), 0),

  AVG: (args) => {
    const nums = args.map(toNumber);
    return nums.length === 0 ? 0 : nums.reduce((a, b) => a + b, 0) / nums.length;
  },

  MIN: (args) => {
    const nums = args.map(toNumber);
    return nums.length === 0 ? 0 : Math.min(...nums);
  },

  MAX: (args) => {
    const nums = args.map(toNumber);
    return nums.length === 0 ? 0 : Math.max(...nums);
  },

  CONCAT: (args) => args.map((v) => (v == null ? '' : String(v))).join(''),

  IF: (args) => {
    const [condition, trueVal, falseVal] = args;
    return toBoolean(condition) ? trueVal : (falseVal ?? null);
  },

  LEN: (args) => {
    const s = args[0];
    return s == null ? 0 : String(s).length;
  },

  ROUND: (args) => {
    const num = toNumber(args[0]);
    const decimals = toNumber(args[1]);
    const factor = Math.pow(10, Math.max(0, Math.round(decimals)));
    return Math.round(num * factor) / factor;
  },

  UPPER: (args) => (args[0] == null ? '' : String(args[0]).toUpperCase()),

  LOWER: (args) => (args[0] == null ? '' : String(args[0]).toLowerCase()),

  NOW: () => new Date().toISOString(),

  TODAY: () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

  YEAR: (args) => {
    const d = toDateSafe(args[0]);
    return d ? d.getFullYear() : null;
  },

  MONTH: (args) => {
    const d = toDateSafe(args[0]);
    return d ? d.getMonth() + 1 : null;
  },

  DAY: (args) => {
    const d = toDateSafe(args[0]);
    return d ? d.getDate() : null;
  },

  DATEDIFF: (args) => {
    const d1 = toDateSafe(args[0]);
    const d2 = toDateSafe(args[1]);
    if (!d1 || !d2) return null;
    const unit = String(args[2] ?? 'days').toLowerCase();
    const diffMs = d2.getTime() - d1.getTime();
    switch (unit) {
      case 'days':
        return Math.floor(diffMs / (1000 * 60 * 60 * 24));
      case 'months': {
        return (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
      }
      case 'years':
        return d2.getFullYear() - d1.getFullYear();
      default:
        return Math.floor(diffMs / (1000 * 60 * 60 * 24));
    }
  },

  COALESCE: (args) => {
    for (const a of args) {
      if (a !== null && a !== undefined && a !== '') return a;
    }
    return null;
  },

  // ── Text functions ──────────────────────────────────────────────────────

  TRIM: (args) => (args[0] == null ? '' : String(args[0]).trim()),

  LEFT: (args) => {
    const text = args[0] == null ? '' : String(args[0]);
    const count = Math.max(0, toNumber(args[1]));
    return text.slice(0, count);
  },

  RIGHT: (args) => {
    const text = args[0] == null ? '' : String(args[0]);
    const count = Math.max(0, toNumber(args[1]));
    return count === 0 ? '' : text.slice(-count);
  },

  MID: (args) => {
    const text = args[0] == null ? '' : String(args[0]);
    const start = Math.max(0, toNumber(args[1]));
    const count = Math.max(0, toNumber(args[2]));
    return text.slice(start, start + count);
  },

  SUBSTITUTE: (args) => {
    const text = args[0] == null ? '' : String(args[0]);
    const oldStr = args[1] == null ? '' : String(args[1]);
    const newStr = args[2] == null ? '' : String(args[2]);
    if (oldStr === '') return text;
    return text.split(oldStr).join(newStr);
  },

  SEARCH: (args) => {
    const needle = args[0] == null ? '' : String(args[0]).toLowerCase();
    const haystack = args[1] == null ? '' : String(args[1]).toLowerCase();
    if (needle === '') return 0;
    const idx = haystack.indexOf(needle);
    return idx === -1 ? 0 : idx + 1;
  },

  REPT: (args) => {
    const text = args[0] == null ? '' : String(args[0]);
    const count = Math.max(0, Math.floor(toNumber(args[1])));
    if (count > 10000) return text; // safety limit
    return text.repeat(count);
  },

  T: (args) => {
    if (args[0] == null) return '';
    return typeof args[0] === 'string' ? args[0] : String(args[0]);
  },

  ENCODE_URL_COMPONENT: (args) => {
    const text = args[0] == null ? '' : String(args[0]);
    return encodeURIComponent(text);
  },

  // ── Numeric functions ───────────────────────────────────────────────────

  ABS: (args) => Math.abs(toNumber(args[0])),

  CEILING: (args) => {
    const num = toNumber(args[0]);
    const sig = args[1] != null ? toNumber(args[1]) : 1;
    if (sig === 0) return 0;
    return Math.ceil(num / sig) * sig;
  },

  FLOOR: (args) => {
    const num = toNumber(args[0]);
    const sig = args[1] != null ? toNumber(args[1]) : 1;
    if (sig === 0) return 0;
    return Math.floor(num / sig) * sig;
  },

  MOD: (args) => {
    const num = toNumber(args[0]);
    const divisor = toNumber(args[1]);
    if (divisor === 0) return null;
    return num % divisor;
  },

  POWER: (args) => Math.pow(toNumber(args[0]), toNumber(args[1])),

  SQRT: (args) => {
    const num = toNumber(args[0]);
    return num < 0 ? null : Math.sqrt(num);
  },

  LOG: (args) => {
    const num = toNumber(args[0]);
    if (num <= 0) return null;
    const base = args[1] != null ? toNumber(args[1]) : 10;
    if (base <= 0 || base === 1) return null;
    return Math.log(num) / Math.log(base);
  },

  INT: (args) => Math.trunc(toNumber(args[0])),

  EVEN: (args) => {
    const num = toNumber(args[0]);
    const ceil = Math.ceil(Math.abs(num));
    const even = ceil % 2 === 0 ? ceil : ceil + 1;
    return num < 0 ? -even : even;
  },

  ODD: (args) => {
    const num = toNumber(args[0]);
    const ceil = Math.ceil(Math.abs(num));
    const odd = ceil % 2 === 1 ? ceil : ceil + 1;
    return num < 0 ? -odd : odd;
  },

  VALUE: (args) => {
    if (args[0] == null) return 0;
    const n = Number(args[0]);
    return isNaN(n) ? null : n;
  },

  // ── Date functions ──────────────────────────────────────────────────────

  DATEADD: (args) => {
    const d = toDateSafe(args[0]);
    if (!d) return null;
    const count = toNumber(args[1]);
    const unit = String(args[2] ?? 'days').toLowerCase();
    const result = new Date(d.getTime());
    switch (unit) {
      case 'days':
        result.setDate(result.getDate() + count);
        break;
      case 'months':
        result.setMonth(result.getMonth() + count);
        break;
      case 'years':
        result.setFullYear(result.getFullYear() + count);
        break;
      case 'hours':
        result.setHours(result.getHours() + count);
        break;
      case 'minutes':
        result.setMinutes(result.getMinutes() + count);
        break;
      default:
        result.setDate(result.getDate() + count);
    }
    return result.toISOString();
  },

  DATETIME_FORMAT: (args) => {
    const d = toDateSafe(args[0]);
    if (!d) return null;
    const fmt = args[1] != null ? String(args[1]) : 'YYYY-MM-DD';
    return fmt
      .replace('YYYY', String(d.getFullYear()))
      .replace('MM', String(d.getMonth() + 1).padStart(2, '0'))
      .replace('DD', String(d.getDate()).padStart(2, '0'))
      .replace('HH', String(d.getHours()).padStart(2, '0'))
      .replace('mm', String(d.getMinutes()).padStart(2, '0'))
      .replace('ss', String(d.getSeconds()).padStart(2, '0'));
  },

  DATETIME_PARSE: (args) => {
    const text = args[0] == null ? '' : String(args[0]);
    const d = new Date(text);
    return isNaN(d.getTime()) ? null : d.toISOString();
  },

  WEEKDAY: (args) => {
    const d = toDateSafe(args[0]);
    return d ? d.getDay() : null;
  },

  WEEKNUM: (args) => {
    const d = toDateSafe(args[0]);
    if (!d) return null;
    const start = new Date(d.getFullYear(), 0, 1);
    const diff = d.getTime() - start.getTime();
    const oneWeek = 7 * 24 * 60 * 60 * 1000;
    return Math.ceil(diff / oneWeek + start.getDay() / 7);
  },

  SET_TIMEZONE: (args) => {
    const d = toDateSafe(args[0]);
    if (!d) return null;
    const tz = args[1] != null ? String(args[1]) : 'UTC';
    try {
      return d.toLocaleString('en-US', { timeZone: tz });
    } catch {
      return d.toISOString();
    }
  },

  LAST_MODIFIED_TIME: () => new Date().toISOString(),

  // ── Logical functions ───────────────────────────────────────────────────

  SWITCH: (args) => {
    if (args.length < 2) return null;
    const expr = args[0];
    for (let i = 1; i + 1 < args.length; i += 2) {
      if (expr == args[i]) return args[i + 1]; // eslint-disable-line eqeqeq
    }
    return args.length % 2 === 0 ? args[args.length - 1] : null;
  },

  AND: (args) => args.every((a) => toBoolean(a)),

  OR: (args) => args.some((a) => toBoolean(a)),

  BLANK: () => null,

  ERROR: (args) => {
    const msg = args[0] != null ? String(args[0]) : 'Error';
    throw new FormulaError(msg);
  },

  // ── Record context functions ────────────────────────────────────────────

  RECORD_ID: (_args, ctx) => ctx?.recordId ?? null,

  CREATED_TIME: (_args, ctx) => ctx?.createdTime ?? null,
};

// ---------------------------------------------------------------------------
// Public: evaluateFormula
// ---------------------------------------------------------------------------

export function evaluateFormula(
  ast: FormulaAST,
  record: Record<string, unknown>,
  fieldMap: Map<string, string>,
  context?: FormulaContext
): unknown {
  return evalNode(ast, record, fieldMap, context);
}

function resolveFieldValue(
  fieldRef: string,
  record: Record<string, unknown>,
  fieldMap: Map<string, string>
): unknown {
  // fieldMap maps field name → field id (or id → id)
  const fieldId = fieldMap.get(fieldRef) ?? fieldRef;
  return record[fieldId] ?? record[fieldRef] ?? null;
}

function evalNode(
  node: FormulaAST,
  record: Record<string, unknown>,
  fieldMap: Map<string, string>,
  context?: FormulaContext
): unknown {
  switch (node.type) {
    case 'literal':
      return node.value;

    case 'fieldRef':
      return resolveFieldValue(node.name!, record, fieldMap);

    case 'function': {
      const fnName = node.name!;
      const fn = BUILTINS[fnName];
      if (!fn) {
        throw new FormulaError(`Unknown function: ${fnName}`);
      }
      const args = (node.children ?? []).map((c) => evalNode(c, record, fieldMap, context));
      return fn(args, context);
    }

    case 'operator': {
      const op = node.name!;
      const children = node.children ?? [];

      if (op === 'NOT') {
        return !toBoolean(evalNode(children[0], record, fieldMap, context));
      }

      const left = evalNode(children[0], record, fieldMap, context);
      const right =
        children.length > 1 ? evalNode(children[1], record, fieldMap, context) : undefined;

      switch (op) {
        case '+':
          if (typeof left === 'string' || typeof right === 'string') {
            return String(left ?? '') + String(right ?? '');
          }
          return toNumber(left) + toNumber(right);
        case '-':
          return toNumber(left) - toNumber(right);
        case '*':
          return toNumber(left) * toNumber(right);
        case '/': {
          const divisor = toNumber(right);
          if (divisor === 0) return null;
          return toNumber(left) / divisor;
        }
        case '=':
          return left == right; // eslint-disable-line eqeqeq
        case '!=':
          return left != right; // eslint-disable-line eqeqeq
        case '>':
          return toNumber(left) > toNumber(right);
        case '<':
          return toNumber(left) < toNumber(right);
        case '>=':
          return toNumber(left) >= toNumber(right);
        case '<=':
          return toNumber(left) <= toNumber(right);
        case 'AND':
          return toBoolean(left) && toBoolean(right);
        case 'OR':
          return toBoolean(left) || toBoolean(right);
        default:
          throw new FormulaError(`Unknown operator: ${op}`);
      }
    }

    default:
      throw new FormulaError(`Unknown AST node type: ${node.type}`);
  }
}

// ---------------------------------------------------------------------------
// Convenience: evaluate a raw formula string against a flat record.
// (Browser-side helper; the server uses parse + evaluate separately.)
// ---------------------------------------------------------------------------

export function evaluateFormulaString(
  formula: string,
  record: Record<string, unknown>,
  fieldMap?: Map<string, string>,
  context?: FormulaContext
): unknown {
  const ast = parseFormula(formula);
  return evaluateFormula(ast, record, fieldMap ?? new Map(), context);
}
