/**
 * @vitest-environment node
 *
 * FT-3 / R5 — Table Conditional Formatting (CF) visual preview unit tests.
 *
 * Tests pure functions from:
 *   src/components/MyWork/table/ConditionalFormatting.tsx
 *     - evaluateCondition(value, operator, ruleValue, ruleValue2)
 *     - getCellStyle(fieldId, value, rules)
 *     - getConditionalStyle(rules, fieldId, value)
 *
 * R5 scope: cell-level conditional formatting rules — the VISUAL layer
 * that drives background-color / font-weight / color styling in the table grid.
 */

import { describe, expect, it } from 'vitest';

import {
  evaluateCondition,
  getCellStyle,
  getConditionalStyle,
  type FormatRule,
  type FormatRuleStyle,
} from '../../../src/components/MyWork/table/ConditionalFormatting';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rule(
  fieldId: string,
  operator: FormatRule['operator'],
  value: unknown,
  style: FormatRuleStyle,
  value2?: unknown
): FormatRule {
  return {
    id: `test-rule-${Math.random().toString(36).slice(2, 8)}`,
    fieldId,
    operator,
    value,
    value2,
    style,
  };
}

// ---------------------------------------------------------------------------
// 1. singleSelect field with color hex → cell renders backgroundColor style
// ---------------------------------------------------------------------------

describe('R5 — singleSelect / equals operator → backgroundColor style', () => {
  it('matching value → returns style with backgroundColor', () => {
    const rules: FormatRule[] = [
      rule('status', 'equals', 'Done', { backgroundColor: '#d1fae5' }),
    ];
    const style = getCellStyle('status', 'Done', rules);
    expect(style.backgroundColor).toBe('#d1fae5');
  });

  it('non-matching value → returns empty style {}', () => {
    const rules: FormatRule[] = [
      rule('status', 'equals', 'Done', { backgroundColor: '#d1fae5' }),
    ];
    const style = getCellStyle('status', 'In Progress', rules);
    expect(Object.keys(style)).toHaveLength(0);
  });

  it('different fieldId → rule is ignored', () => {
    const rules: FormatRule[] = [
      rule('priority', 'equals', 'High', { backgroundColor: '#fee2e2' }),
    ];
    const style = getCellStyle('status', 'High', rules);
    expect(Object.keys(style)).toHaveLength(0);
  });

  it('matching value with full style bag → returns all style props', () => {
    const fullStyle: FormatRuleStyle = {
      backgroundColor: '#fee2e2',
      color: '#9b1c1c',
      fontWeight: 'bold',
      fontStyle: 'italic',
    };
    const rules: FormatRule[] = [rule('risk', 'equals', 'Critical', fullStyle)];
    const style = getCellStyle('risk', 'Critical', rules);
    expect(style.backgroundColor).toBe('#fee2e2');
    expect(style.color).toBe('#9b1c1c');
    expect(style.fontWeight).toBe('bold');
    expect(style.fontStyle).toBe('italic');
  });
});

// ---------------------------------------------------------------------------
// 2. evaluateCondition — numeric "greater_than" (currency / number field)
// ---------------------------------------------------------------------------

describe('R5 — numeric operator greater_than / less_than (currency/number fields)', () => {
  it('greater_than: 150000 > 100000 → true', () => {
    expect(evaluateCondition(150000, 'greater_than', 100000)).toBe(true);
  });

  it('greater_than: 90000 > 100000 → false', () => {
    expect(evaluateCondition(90000, 'greater_than', 100000)).toBe(false);
  });

  it('greater_than with string value "200000" → treated as number', () => {
    expect(evaluateCondition('200000', 'greater_than', 100000)).toBe(true);
  });

  it('less_than: 50 < 100 → true', () => {
    expect(evaluateCondition(50, 'less_than', 100)).toBe(true);
  });

  it('less_than: 150 < 100 → false', () => {
    expect(evaluateCondition(150, 'less_than', 100)).toBe(false);
  });

  it('getCellStyle with greater_than → style applied when value exceeds threshold', () => {
    const rules: FormatRule[] = [
      rule('revenue', 'greater_than', 100000, { backgroundColor: '#d1fae5', fontWeight: 'bold' }),
    ];
    expect(getCellStyle('revenue', 150000, rules).backgroundColor).toBe('#d1fae5');
    expect(getCellStyle('revenue', 50000, rules).backgroundColor).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 3. evaluateCondition — percent field (formatted as "85%", "0.85", "85")
// ---------------------------------------------------------------------------

describe('R5 — percent field formatting', () => {
  it('greater_than 50 with value "85" (percent no-symbol) → true', () => {
    expect(evaluateCondition('85', 'greater_than', 50)).toBe(true);
  });

  it('less_than 50 with value "30" → true', () => {
    expect(evaluateCondition('30', 'less_than', 50)).toBe(true);
  });

  it('equals "100%" formatted string match', () => {
    expect(evaluateCondition('100%', 'equals', '100%')).toBe(true);
  });

  it('getCellStyle applies style for low percent', () => {
    const rules: FormatRule[] = [
      rule('completion', 'less_than', 50, { backgroundColor: '#fee2e2', color: '#9b1c1c' }),
    ];
    const styleHigh = getCellStyle('completion', 75, rules);
    const styleLow = getCellStyle('completion', 25, rules);
    expect(styleHigh.backgroundColor).toBeUndefined();
    expect(styleLow.backgroundColor).toBe('#fee2e2');
  });
});

// ---------------------------------------------------------------------------
// 4. evaluateCondition — rating field (star count, values 1-5)
// ---------------------------------------------------------------------------

describe('R5 — rating field (1-5 star range)', () => {
  it('between: value 3 is between 3 and 5 → true', () => {
    expect(evaluateCondition(3, 'between', 3, 5)).toBe(true);
  });

  it('between: value 1 is between 1 and 2 → true', () => {
    expect(evaluateCondition(1, 'between', 1, 2)).toBe(true);
  });

  it('between: value 5 is between 1 and 3 → false', () => {
    expect(evaluateCondition(5, 'between', 1, 3)).toBe(false);
  });

  it('greater_than 3 → 4 and 5 pass, 1-3 fail', () => {
    expect(evaluateCondition(4, 'greater_than', 3)).toBe(true);
    expect(evaluateCondition(5, 'greater_than', 3)).toBe(true);
    expect(evaluateCondition(3, 'greater_than', 3)).toBe(false);
    expect(evaluateCondition(2, 'greater_than', 3)).toBe(false);
  });

  it('getCellStyle applies color for high rating (≥4)', () => {
    const rules: FormatRule[] = [
      rule('rating', 'greater_than', 3, { backgroundColor: '#d1fae5' }),
    ];
    expect(getCellStyle('rating', 5, rules).backgroundColor).toBe('#d1fae5');
    expect(getCellStyle('rating', 2, rules).backgroundColor).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 5. evaluateCondition — date field (locale formatted string)
// ---------------------------------------------------------------------------

describe('R5 — date field (string comparison)', () => {
  it('equals: date string exact match → true', () => {
    expect(evaluateCondition('2025-12-31', 'equals', '2025-12-31')).toBe(true);
  });

  it('equals: date string mismatch → false', () => {
    expect(evaluateCondition('2025-01-01', 'equals', '2025-12-31')).toBe(false);
  });

  it('is_empty: null date → true', () => {
    expect(evaluateCondition(null, 'is_empty')).toBe(true);
  });

  it('is_empty: empty string date → true', () => {
    expect(evaluateCondition('', 'is_empty')).toBe(true);
  });

  it('is_not_empty: filled date → true', () => {
    expect(evaluateCondition('2025-06-15', 'is_not_empty')).toBe(true);
  });

  it('contains: partial date string match → true', () => {
    expect(evaluateCondition('2025-06-15', 'contains', '2025')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 6. No CF rule matching field type → plain text (no style injection)
// ---------------------------------------------------------------------------

describe('R5 — no CF / unmatched rule → empty style (no injection)', () => {
  it('empty rules array → getCellStyle returns {}', () => {
    const style = getCellStyle('col', 'any value', []);
    expect(Object.keys(style)).toHaveLength(0);
  });

  it('rule with non-matching fieldId → getCellStyle returns {}', () => {
    const rules: FormatRule[] = [
      rule('otherField', 'equals', 'x', { backgroundColor: '#fee2e2' }),
    ];
    const style = getCellStyle('myField', 'x', rules);
    expect(Object.keys(style)).toHaveLength(0);
  });

  it('getConditionalStyle: no match → returns undefined', () => {
    const rules: FormatRule[] = [
      rule('field1', 'equals', 'foo', { backgroundColor: '#d1fae5' }),
    ];
    const style = getConditionalStyle(rules, 'field1', 'bar');
    expect(style).toBeUndefined();
  });

  it('getConditionalStyle: matching rule → returns style object', () => {
    const rules: FormatRule[] = [
      rule('field1', 'equals', 'foo', { backgroundColor: '#d1fae5', fontWeight: 'bold' }),
    ];
    const style = getConditionalStyle(rules, 'field1', 'foo');
    expect(style).toBeDefined();
    expect(style!.backgroundColor).toBe('#d1fae5');
    expect(style!.fontWeight).toBe('bold');
  });

  it('evaluateCondition with null value and equals operator → compares to empty string', () => {
    // null → '' when stringified
    expect(evaluateCondition(null, 'equals', '')).toBe(true);
    expect(evaluateCondition(null, 'equals', 'something')).toBe(false);
  });

  it('evaluateCondition: not_equals returns true when values differ', () => {
    expect(evaluateCondition('X', 'not_equals', 'Y')).toBe(true);
    expect(evaluateCondition('X', 'not_equals', 'X')).toBe(false);
  });

  it('evaluateCondition: not_contains returns true when substring absent', () => {
    expect(evaluateCondition('Hello World', 'not_contains', 'goodbye')).toBe(true);
    expect(evaluateCondition('Hello World', 'not_contains', 'hello')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 7. First-match-wins: multiple rules, first match takes precedence
// ---------------------------------------------------------------------------

describe('R5 — first-match-wins rule ordering', () => {
  it('first rule matches → its style returned, second rule ignored', () => {
    const rules: FormatRule[] = [
      rule('priority', 'equals', 'High', { backgroundColor: '#fee2e2' }),
      rule('priority', 'equals', 'High', { backgroundColor: '#d1fae5' }), // would override
    ];
    // getCellStyle iterates rules[] and returns on first match
    const style = getCellStyle('priority', 'High', rules);
    expect(style.backgroundColor).toBe('#fee2e2');
  });

  it('second rule used when first does not match', () => {
    const rules: FormatRule[] = [
      rule('priority', 'equals', 'Low', { backgroundColor: '#d1fae5' }),
      rule('priority', 'equals', 'High', { backgroundColor: '#fee2e2' }),
    ];
    const style = getCellStyle('priority', 'High', rules);
    expect(style.backgroundColor).toBe('#fee2e2');
  });
});
