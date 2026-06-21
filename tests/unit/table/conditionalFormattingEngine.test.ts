/**
 * R5 FT-1 (unit) — getConditionalStyle: per-operator cell colouring.
 *
 * Exercises every FormatOperator so a regression in the operator switch
 * (used by both PlatformGridView and the DataGrid) is caught.
 */
import { describe, expect, it } from 'vitest';

import {
  getConditionalStyle,
  type FormatRule,
} from '@/components/MyWork/table/ConditionalFormatting';

const STYLE = { backgroundColor: '#fee2e2', color: '#991b1b' };

function rule(partial: Partial<FormatRule>): FormatRule {
  return {
    id: 'r1',
    fieldId: 'status',
    operator: 'equals',
    value: '',
    style: STYLE,
    ...partial,
  } as FormatRule;
}

describe('getConditionalStyle — per operator', () => {
  it('equals → matches exact value', () => {
    const r = [rule({ operator: 'equals', value: 'Done' })];
    expect(getConditionalStyle(r, 'status', 'Done')).toEqual(STYLE);
    expect(getConditionalStyle(r, 'status', 'Todo')).toBeUndefined();
  });

  it('not_equals → matches everything but the value', () => {
    const r = [rule({ operator: 'not_equals', value: 'Done' })];
    expect(getConditionalStyle(r, 'status', 'Todo')).toEqual(STYLE);
    expect(getConditionalStyle(r, 'status', 'Done')).toBeUndefined();
  });

  it('contains / not_contains → substring (case-insensitive)', () => {
    expect(
      getConditionalStyle([rule({ operator: 'contains', value: 'gent' })], 'status', 'Urgent')
    ).toEqual(STYLE);
    expect(
      getConditionalStyle([rule({ operator: 'not_contains', value: 'gent' })], 'status', 'Low')
    ).toEqual(STYLE);
  });

  it('is_empty / is_not_empty', () => {
    expect(getConditionalStyle([rule({ operator: 'is_empty' })], 'status', '')).toEqual(STYLE);
    expect(getConditionalStyle([rule({ operator: 'is_empty' })], 'status', null)).toEqual(STYLE);
    expect(getConditionalStyle([rule({ operator: 'is_not_empty' })], 'status', 'x')).toEqual(STYLE);
    expect(getConditionalStyle([rule({ operator: 'is_not_empty' })], 'status', '')).toBeUndefined();
  });

  it('greater_than / less_than → numeric comparison', () => {
    expect(
      getConditionalStyle([rule({ operator: 'greater_than', value: 10 })], 'status', 15)
    ).toEqual(STYLE);
    expect(getConditionalStyle([rule({ operator: 'less_than', value: 10 })], 'status', 5)).toEqual(
      STYLE
    );
    expect(
      getConditionalStyle([rule({ operator: 'greater_than', value: 10 })], 'status', 5)
    ).toBeUndefined();
  });

  it('between → inclusive numeric range', () => {
    const r = [rule({ operator: 'between', value: 10, value2: 20 })];
    expect(getConditionalStyle(r, 'status', 10)).toEqual(STYLE);
    expect(getConditionalStyle(r, 'status', 15)).toEqual(STYLE);
    expect(getConditionalStyle(r, 'status', 20)).toEqual(STYLE);
    expect(getConditionalStyle(r, 'status', 21)).toBeUndefined();
  });

  it('only applies to the matching fieldId', () => {
    const r = [rule({ fieldId: 'priority', operator: 'equals', value: 'High' })];
    expect(getConditionalStyle(r, 'status', 'High')).toBeUndefined();
    expect(getConditionalStyle(r, 'priority', 'High')).toEqual(STYLE);
  });

  it('first matching rule wins (precedence)', () => {
    const r = [
      rule({ id: 'a', operator: 'equals', value: 'Done', style: { backgroundColor: '#aaa' } }),
      rule({ id: 'b', operator: 'equals', value: 'Done', style: { backgroundColor: '#bbb' } }),
    ];
    expect(getConditionalStyle(r, 'status', 'Done')).toEqual({ backgroundColor: '#aaa' });
  });
});
