import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../../../database/Database.js', () => ({
  getDatabase: () => ({ query: vi.fn() }),
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import {
  parseFormula,
  evaluateFormula,
  extractFieldDependencies,
  FormulaError,
  type FormulaAST,
} from '../formulaEngine.js';

describe('FormulaEngine', () => {
  const emptyFieldMap = new Map<string, string>();

  // -----------------------------------------------------------------------
  // Parsing
  // -----------------------------------------------------------------------

  describe('parseFormula', () => {
    it('parses SUM(field1, field2) into a valid AST', () => {
      const ast = parseFormula('SUM(field1, field2)');
      expect(ast.type).toBe('function');
      expect(ast.name).toBe('SUM');
      expect(ast.children).toHaveLength(2);
      expect(ast.children![0]).toEqual({ type: 'fieldRef', name: 'field1' });
      expect(ast.children![1]).toEqual({ type: 'fieldRef', name: 'field2' });
    });

    it('parses arithmetic with correct operator precedence', () => {
      const ast = parseFormula('field1 + field2 * 3');
      expect(ast.type).toBe('operator');
      expect(ast.name).toBe('+');
      expect(ast.children![0]).toEqual({ type: 'fieldRef', name: 'field1' });
      const mulNode = ast.children![1];
      expect(mulNode.type).toBe('operator');
      expect(mulNode.name).toBe('*');
      expect(mulNode.children![0]).toEqual({ type: 'fieldRef', name: 'field2' });
      expect(mulNode.children![1]).toEqual({ type: 'literal', value: 3 });
    });

    it('parses IF(field1 > 10, "high", "low") into a valid AST', () => {
      const ast = parseFormula('IF(field1 > 10, "high", "low")');
      expect(ast.type).toBe('function');
      expect(ast.name).toBe('IF');
      expect(ast.children).toHaveLength(3);
      const condition = ast.children![0];
      expect(condition.type).toBe('operator');
      expect(condition.name).toBe('>');
    });

    it('parses nested ROUND(AVG(field1, field2), 2)', () => {
      const ast = parseFormula('ROUND(AVG(field1, field2), 2)');
      expect(ast.type).toBe('function');
      expect(ast.name).toBe('ROUND');
      expect(ast.children).toHaveLength(2);
      const avgNode = ast.children![0];
      expect(avgNode.type).toBe('function');
      expect(avgNode.name).toBe('AVG');
      expect(avgNode.children).toHaveLength(2);
      expect(ast.children![1]).toEqual({ type: 'literal', value: 2 });
    });

    it('throws FormulaError with position for incomplete SUM(', () => {
      expect(() => parseFormula('SUM(')).toThrow(FormulaError);
      try {
        parseFormula('SUM(');
      } catch (e) {
        expect(e).toBeInstanceOf(FormulaError);
        expect((e as FormulaError).position).toBeDefined();
      }
    });

    it('throws on empty string', () => {
      expect(() => parseFormula('')).toThrow(FormulaError);
    });

    it('parses boolean literals', () => {
      const ast = parseFormula('TRUE');
      expect(ast).toEqual({ type: 'literal', value: true });
    });

    it('parses string literals with single quotes', () => {
      const ast = parseFormula("'hello'");
      expect(ast).toEqual({ type: 'literal', value: 'hello' });
    });

    it('parses comparison operators', () => {
      const ast = parseFormula('field1 >= field2');
      expect(ast.type).toBe('operator');
      expect(ast.name).toBe('>=');
    });
  });

  // -----------------------------------------------------------------------
  // Evaluation
  // -----------------------------------------------------------------------

  describe('evaluateFormula', () => {
    it('evaluates SUM with record data', () => {
      const ast = parseFormula('SUM(a, b, c)');
      const record = { a: 10, b: 20, c: 30 };
      const result = evaluateFormula(ast, record, emptyFieldMap);
      expect(result).toBe(60);
    });

    it('evaluates IF true branch', () => {
      const ast = parseFormula('IF(score > 50, "pass", "fail")');
      const record = { score: 80 };
      const result = evaluateFormula(ast, record, emptyFieldMap);
      expect(result).toBe('pass');
    });

    it('evaluates IF false branch', () => {
      const ast = parseFormula('IF(score > 50, "pass", "fail")');
      const record = { score: 30 };
      const result = evaluateFormula(ast, record, emptyFieldMap);
      expect(result).toBe('fail');
    });

    it('evaluates CONCAT', () => {
      const ast = parseFormula('CONCAT(first, " ", last)');
      const record = { first: 'John', last: 'Doe' };
      const result = evaluateFormula(ast, record, emptyFieldMap);
      expect(result).toBe('John Doe');
    });

    it('evaluates UPPER', () => {
      const ast = parseFormula('UPPER(name)');
      const record = { name: 'hello' };
      const result = evaluateFormula(ast, record, emptyFieldMap);
      expect(result).toBe('HELLO');
    });

    it('evaluates LOWER', () => {
      const ast = parseFormula('LOWER(name)');
      const record = { name: 'WORLD' };
      const result = evaluateFormula(ast, record, emptyFieldMap);
      expect(result).toBe('world');
    });

    it('evaluates DATEDIFF in days', () => {
      const ast = parseFormula('DATEDIFF(start_date, end_date, "days")');
      const record = { start_date: '2025-01-01', end_date: '2025-01-11' };
      const result = evaluateFormula(ast, record, emptyFieldMap);
      expect(result).toBe(10);
    });

    it('evaluates COALESCE with null fallback', () => {
      const ast = parseFormula('COALESCE(primary, secondary, "default")');
      const record = { primary: null, secondary: null };
      const result = evaluateFormula(ast, record, emptyFieldMap);
      expect(result).toBe('default');
    });

    it('evaluates COALESCE returning first non-null', () => {
      const ast = parseFormula('COALESCE(primary, secondary, "default")');
      const record = { primary: null, secondary: 'found' };
      const result = evaluateFormula(ast, record, emptyFieldMap);
      expect(result).toBe('found');
    });

    it('handles missing field gracefully (returns 0 in arithmetic)', () => {
      const ast = parseFormula('SUM(existing, missing)');
      const record = { existing: 42 };
      const result = evaluateFormula(ast, record, emptyFieldMap);
      expect(result).toBe(42);
    });

    it('resolves field via fieldMap', () => {
      const ast = parseFormula('SUM(Amount, Tax)');
      const fieldMap = new Map([
        ['Amount', 'field-id-1'],
        ['Tax', 'field-id-2'],
      ]);
      const record = { 'field-id-1': 100, 'field-id-2': 15 };
      const result = evaluateFormula(ast, record, fieldMap);
      expect(result).toBe(115);
    });

    it('evaluates ROUND', () => {
      const ast = parseFormula('ROUND(AVG(a, b), 2)');
      const record = { a: 10, b: 3 };
      const result = evaluateFormula(ast, record, emptyFieldMap);
      expect(result).toBe(6.5);
    });

    it('evaluates division by zero as null', () => {
      const ast = parseFormula('a / b');
      const record = { a: 10, b: 0 };
      const result = evaluateFormula(ast, record, emptyFieldMap);
      expect(result).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // Dependency extraction
  // -----------------------------------------------------------------------

  describe('extractFieldDependencies', () => {
    it('extracts field references from a formula AST', () => {
      const ast = parseFormula('SUM(field1, field2) + field3');
      const deps = extractFieldDependencies(ast);
      expect(deps).toEqual(expect.arrayContaining(['field1', 'field2', 'field3']));
      expect(deps).toHaveLength(3);
    });

    it('returns empty array for literal-only formula', () => {
      const ast = parseFormula('1 + 2');
      const deps = extractFieldDependencies(ast);
      expect(deps).toHaveLength(0);
    });

    it('deduplicates repeated field references', () => {
      const ast = parseFormula('SUM(x, x)');
      const deps = extractFieldDependencies(ast);
      expect(deps).toEqual(['x']);
    });
  });
});
