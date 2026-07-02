/**
 * R5 FT-1 (unit) — formulaEngineCore: AST builtins + operators + field refs.
 *
 * Verifies the browser-side AST core (port of the server engine) evaluates
 * the canonical builtins (SUM/AVG/IF/CONCAT) and arithmetic correctly, and
 * that `tableTypes.evaluateFormula` delegates to it (no more `new Function`).
 */
import { describe, expect, it } from 'vitest';

import {
  BUILTINS,
  evaluateFormulaString,
  extractFieldDependencies,
  FormulaError,
  parseFormula,
} from '@/components/MyWork/table/formulaEngineCore';
import { evaluateFormula as evaluateFormulaLegacy } from '@/components/MyWork/table/tableTypes';

const NO_MAP = new Map<string, string>();

describe('formulaEngineCore — AST builtins', () => {
  it('SUM aggregates its numeric args', () => {
    expect(evaluateFormulaString('SUM(1, 2, 3, 4)', {})).toBe(10);
  });

  it('AVG averages its numeric args', () => {
    expect(evaluateFormulaString('AVG(2, 4, 6)', {})).toBe(4);
  });

  it('IF branches on a boolean condition', () => {
    expect(evaluateFormulaString('IF(1 > 0, "yes", "no")', {})).toBe('yes');
    expect(evaluateFormulaString('IF(1 < 0, "yes", "no")', {})).toBe('no');
  });

  it('CONCAT joins stringified args', () => {
    expect(evaluateFormulaString('CONCAT("a", "b", "c")', {})).toBe('abc');
  });

  it('resolves {field} references against the record', () => {
    const rec = { effort: 5, impact: 4 };
    expect(evaluateFormulaString('{effort} * {impact}', rec)).toBe(20);
    expect(evaluateFormulaString('SUM({effort}, {impact})', rec)).toBe(9);
  });

  it('resolves bare identifier references against the record', () => {
    expect(evaluateFormulaString('a + b', { a: 3, b: 7 })).toBe(10);
  });

  it('exposes the same BUILTIN set keys expected by the platform', () => {
    for (const fn of ['SUM', 'AVG', 'MIN', 'MAX', 'IF', 'CONCAT', 'ROUND', 'LEN']) {
      expect(typeof BUILTINS[fn]).toBe('function');
    }
  });

  it('extractFieldDependencies finds all referenced fields', () => {
    const ast = parseFormula('SUM({a}, {b}) + c');
    expect(extractFieldDependencies(ast).sort()).toEqual(['a', 'b', 'c']);
  });

  it('throws FormulaError on unknown function', () => {
    expect(() => evaluateFormulaString('NOPE(1)', {})).toThrow(FormulaError);
  });
});

describe('tableTypes.evaluateFormula delegates to the core', () => {
  it('computes arithmetic via the AST engine (rounded to 2dp)', () => {
    expect(evaluateFormulaLegacy('{a} * {b}', { a: 2.5, b: 4 })).toBe(10);
    expect(evaluateFormulaLegacy('{a} / {b}', { a: 1, b: 3 })).toBe(0.33);
  });

  it('returns "—" on a malformed formula instead of throwing', () => {
    expect(evaluateFormulaLegacy('{a} * (', { a: 1 })).toBe('—');
  });

  it('division by zero resolves to "—" (null → dash)', () => {
    expect(evaluateFormulaLegacy('{a} / {b}', { a: 5, b: 0 })).toBe('—');
  });
});
