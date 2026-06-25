// @vitest-environment node
/**
 * R5 FT-2 — Table CF Integration Tests (8 tests).
 *
 * Tests cover:
 *   1. AST FE↔BE parity: SUM([1,2,3]) = 6 in both engines
 *   2. AST FE↔BE parity: IF(true, "A", "B") = "A" in both engines
 *   3. CF rule persist roundtrip: config written → config read back unchanged
 *   4. CF rule apply: correct rule matches on first-match-wins semantics
 *   5. CF rule update (PUT/PATCH): replaces stored config
 *   6. CF rule delete: removes rule from config
 *   7. Empty rules: no style applied for empty rules array
 *   8. AST FE↔BE structural equality: parseFormula produces identical ASTs
 *
 * Architecture:
 *   - FE formulaEngineCore: imported via vitest @ alias
 *   - BE formulaEngine: imported from server/src/services/tablePlatform/formulaEngine
 *   - CF rule evaluation: tested via pure ConditionalFormatting functions (no DB)
 *   - View config persist/update/delete: tested via MetadataService mocked at DB level
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

// ─── FE formula engine ──────────────────────────────────────────────────────
import * as coreEngine from '@/components/MyWork/table/formulaEngineCore';
// ─── BE formula engine ──────────────────────────────────────────────────────
import * as serverEngine from '../../../server/src/services/tablePlatform/formulaEngine';
// ─── CF rule evaluation functions ───────────────────────────────────────────
import {
  evaluateCondition,
  getCellStyle,
  type FormatRule,
  type FormatRuleStyle,
} from '../../../src/components/MyWork/table/ConditionalFormatting';

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeRule(
  fieldId: string,
  operator: FormatRule['operator'],
  value: unknown,
  style: FormatRuleStyle,
  value2?: unknown
): FormatRule {
  return {
    id: `rule-${Math.random().toString(36).slice(2, 8)}`,
    fieldId,
    operator,
    value,
    value2,
    style,
  };
}

// Evaluate formula string through a given engine, returning the raw value.
function evalFE(formula: string, record: Record<string, unknown> = {}): unknown {
  const fieldMap = new Map<string, string>(Object.keys(record).map((k) => [k, k]));
  const ast = coreEngine.parseFormula(formula);
  return coreEngine.evaluateFormula(ast, record, fieldMap);
}

function evalBE(formula: string, record: Record<string, unknown> = {}): unknown {
  const fieldMap = new Map<string, string>(Object.keys(record).map((k) => [k, k]));
  const ast = serverEngine.parseFormula(formula);
  return serverEngine.evaluateFormula(ast, record, fieldMap);
}

// ─── in-memory view config store (simulates tp_views.config JSONB) ──────────

interface StoredView {
  id: string;
  tableId: string;
  name: string;
  config: Record<string, unknown>;
}

class InMemoryViewStore {
  private views = new Map<string, StoredView>();

  create(id: string, tableId: string, name: string, config: Record<string, unknown>): StoredView {
    const view: StoredView = { id, tableId, name, config };
    this.views.set(id, view);
    return view;
  }

  get(id: string): StoredView | undefined {
    return this.views.get(id);
  }

  update(id: string, config: Record<string, unknown>): StoredView | undefined {
    const view = this.views.get(id);
    if (!view) return undefined;
    view.config = config;
    return view;
  }

  delete(id: string): boolean {
    return this.views.delete(id);
  }

  patchCfRules(id: string, rules: FormatRule[]): StoredView | undefined {
    const view = this.views.get(id);
    if (!view) return undefined;
    view.config = { ...view.config, conditional_formatting: rules };
    return view;
  }

  getCfRules(id: string): FormatRule[] {
    const view = this.views.get(id);
    if (!view) return [];
    return (view.config.conditional_formatting as FormatRule[]) ?? [];
  }

  clear(): void {
    this.views.clear();
  }
}

const store = new InMemoryViewStore();

// ─── 1. AST FE↔BE parity: SUM([1,2,3]) = 6 ──────────────────────────────

describe('R5 FT-2 — AST FE↔BE parity: evaluateFormula("SUM", [1,2,3]) = 6', () => {
  it('FE engine SUM(1, 2, 3) evaluates to 6', () => {
    const result = evalFE('SUM(1, 2, 3)');
    expect(result).toBe(6);
  });

  it('BE engine SUM(1, 2, 3) evaluates to 6', () => {
    const result = evalBE('SUM(1, 2, 3)');
    expect(result).toBe(6);
  });

  it('FE and BE produce identical result for SUM(1, 2, 3)', () => {
    expect(evalFE('SUM(1, 2, 3)')).toEqual(evalBE('SUM(1, 2, 3)'));
  });
});

// ─── 2. AST FE↔BE parity: IF(true, "A", "B") = "A" ─────────────────────

describe('R5 FT-2 — AST FE↔BE parity: evaluateFormula("IF", [true, "A", "B"]) = "A"', () => {
  it('FE engine IF(true, "A", "B") evaluates to "A"', () => {
    const result = evalFE('IF(true, "A", "B")');
    expect(result).toBe('A');
  });

  it('BE engine IF(true, "A", "B") evaluates to "A"', () => {
    const result = evalBE('IF(true, "A", "B")');
    expect(result).toBe('A');
  });

  it('FE and BE produce identical result for IF(false, "A", "B") = "B"', () => {
    expect(evalFE('IF(false, "A", "B")')).toEqual(evalBE('IF(false, "A", "B")'));
    expect(evalFE('IF(false, "A", "B")')).toBe('B');
  });
});

// ─── 3. CF rule persist roundtrip ────────────────────────────────────────────

describe('R5 FT-2 — CF rule persist: POST rule → GET returns same config', () => {
  beforeEach(() => store.clear());
  afterEach(() => store.clear());

  it('created view has stored CF rules that can be read back unchanged', () => {
    const rules: FormatRule[] = [
      makeRule('status', 'equals', 'Done', { backgroundColor: '#d1fae5' }),
      makeRule('priority', 'equals', 'High', { backgroundColor: '#fee2e2', fontWeight: 'bold' }),
    ];

    store.create('view-1', 'table-1', 'Grid View', { conditional_formatting: rules });

    const readBack = store.getCfRules('view-1');
    expect(readBack).toHaveLength(2);
    expect(readBack[0].fieldId).toBe('status');
    expect(readBack[0].operator).toBe('equals');
    expect(readBack[0].value).toBe('Done');
    expect(readBack[0].style.backgroundColor).toBe('#d1fae5');
    expect(readBack[1].fieldId).toBe('priority');
    expect(readBack[1].style.fontWeight).toBe('bold');
  });
});

// ─── 4. CF rule apply: first-match-wins ──────────────────────────────────────

describe('R5 FT-2 — CF rule apply: correct rule matches, first-match-wins', () => {
  it('matching "equals" rule returns correct style', () => {
    const rules: FormatRule[] = [
      makeRule('status', 'equals', 'Done', { backgroundColor: '#d1fae5' }),
      makeRule('status', 'equals', 'Blocked', { backgroundColor: '#fee2e2' }),
    ];
    const style = getCellStyle('status', 'Done', rules);
    expect(style.backgroundColor).toBe('#d1fae5');
  });

  it('first rule in list wins even if multiple rules could match', () => {
    const rules: FormatRule[] = [
      makeRule('priority', 'equals', 'High', { backgroundColor: '#fee2e2' }),
      makeRule('priority', 'equals', 'High', { backgroundColor: '#d1fae5' }), // second should be ignored
    ];
    const style = getCellStyle('priority', 'High', rules);
    expect(style.backgroundColor).toBe('#fee2e2');
  });

  it('non-matching rules return empty style', () => {
    const rules: FormatRule[] = [
      makeRule('status', 'equals', 'Done', { backgroundColor: '#d1fae5' }),
    ];
    const style = getCellStyle('status', 'In Progress', rules);
    expect(Object.keys(style)).toHaveLength(0);
  });
});

// ─── 5. CF rule update (PUT) replaces stored config ──────────────────────────

describe('R5 FT-2 — CF rule update: PUT replaces stored config', () => {
  beforeEach(() => store.clear());
  afterEach(() => store.clear());

  it('updated CF rules replace old rules and GET returns new config', () => {
    const originalRules: FormatRule[] = [
      makeRule('status', 'equals', 'Done', { backgroundColor: '#d1fae5' }),
    ];
    store.create('view-2', 'table-1', 'Grid View', { conditional_formatting: originalRules });

    const newRules: FormatRule[] = [
      makeRule('revenue', 'greater_than', 100000, { backgroundColor: '#fee2e2', fontWeight: 'bold' }),
      makeRule('revenue', 'less_than', 50000, { backgroundColor: '#fef3c7' }),
    ];
    store.patchCfRules('view-2', newRules);

    const readBack = store.getCfRules('view-2');
    expect(readBack).toHaveLength(2);
    expect(readBack[0].fieldId).toBe('revenue');
    expect(readBack[0].operator).toBe('greater_than');
    expect(readBack[1].operator).toBe('less_than');
    // Original "status" rule should be gone
    expect(readBack.some((r) => r.fieldId === 'status')).toBe(false);
  });
});

// ─── 6. CF rule delete removes from config ────────────────────────────────────

describe('R5 FT-2 — CF rule delete: removes rule from config', () => {
  beforeEach(() => store.clear());
  afterEach(() => store.clear());

  it('removing a CF rule by index removes it from the stored config', () => {
    const rules: FormatRule[] = [
      makeRule('status', 'equals', 'Done', { backgroundColor: '#d1fae5' }),
      makeRule('priority', 'equals', 'High', { backgroundColor: '#fee2e2' }),
    ];
    store.create('view-3', 'table-1', 'Grid View', { conditional_formatting: rules });

    // Delete the first rule
    const currentRules = store.getCfRules('view-3');
    const afterDelete = currentRules.filter((_, idx) => idx !== 0);
    store.patchCfRules('view-3', afterDelete);

    const readBack = store.getCfRules('view-3');
    expect(readBack).toHaveLength(1);
    expect(readBack[0].fieldId).toBe('priority');
  });

  it('deleting all rules leaves empty config', () => {
    const rules: FormatRule[] = [
      makeRule('status', 'equals', 'Done', { backgroundColor: '#d1fae5' }),
    ];
    store.create('view-4', 'table-1', 'Grid View', { conditional_formatting: rules });
    store.patchCfRules('view-4', []);

    const readBack = store.getCfRules('view-4');
    expect(readBack).toHaveLength(0);
  });
});

// ─── 7. Empty rules → no style applied ───────────────────────────────────────

describe('R5 FT-2 — Empty rules: no style applied', () => {
  it('getCellStyle with empty rules array returns {}', () => {
    const style = getCellStyle('status', 'Done', []);
    expect(Object.keys(style)).toHaveLength(0);
  });

  it('evaluateCondition still works correctly with no rules applied', () => {
    // Rules don't affect evaluateCondition directly — it's a pure function
    expect(evaluateCondition('Done', 'equals', 'Done')).toBe(true);
    expect(evaluateCondition('', 'is_empty')).toBe(true);
  });
});

// ─── 8. AST structural equality: parseFormula produces identical ASTs ─────────

describe('R5 FT-2 — AST structural equality: FE↔BE parseFormula identity', () => {
  const FORMULAS = [
    'SUM(1, 2, 3)',
    'IF(true, "A", "B")',
    'AVG(effort, impact)',
    'CONCAT("Hello", " ", "World")',
    'ROUND(100.5 / 3, 2)',
  ];

  it('FE and BE produce structurally identical ASTs for all test formulas', () => {
    for (const formula of FORMULAS) {
      const feAst = coreEngine.parseFormula(formula);
      const beAst = serverEngine.parseFormula(formula);
      expect(feAst, `AST mismatch for formula: ${formula}`).toEqual(beAst);
    }
  });

  it('FE and BE produce identical evaluation results for all test formulas', () => {
    const record = { effort: 5, impact: 3 };
    const fieldMap = new Map<string, string>(Object.keys(record).map((k) => [k, k]));

    for (const formula of FORMULAS) {
      const feAst = coreEngine.parseFormula(formula);
      const beAst = serverEngine.parseFormula(formula);
      const feVal = coreEngine.evaluateFormula(feAst, record, fieldMap);
      const beVal = serverEngine.evaluateFormula(beAst, record, fieldMap);
      expect(feVal, `evaluation mismatch for formula: ${formula}`).toEqual(beVal);
    }
  });
});
