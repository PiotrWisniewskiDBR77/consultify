/**
 * Tests for ConditionalFormatting — rule evaluation and style application.
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ConditionalFormatting,
  type FormatRule,
  getConditionalStyle,
} from '@/components/MyWork/table/ConditionalFormatting';
import type { ColumnDef } from '@/components/MyWork/table/tableTypes';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
}));

afterEach(cleanup);

describe('getConditionalStyle', () => {
  const rules: FormatRule[] = [
    {
      id: 'r1',
      column: 'status',
      condition: 'equals',
      value: 'Done',
      style: { backgroundColor: '#dcfce7', textColor: '#166534', fontWeight: 'bold' },
    },
    {
      id: 'r2',
      column: 'name',
      condition: 'contains',
      value: 'urgent',
      style: { backgroundColor: '#fef2f2', textColor: '#991b1b', fontWeight: 'normal' },
    },
    {
      id: 'r3',
      column: 'score',
      condition: 'gt',
      value: '80',
      style: { backgroundColor: '#eff6ff', textColor: '#1e40af', fontWeight: 'bold' },
    },
    {
      id: 'r4',
      column: 'score',
      condition: 'lt',
      value: '20',
      style: { backgroundColor: '#fef9c3', textColor: '#854d0e', fontWeight: 'normal' },
    },
    {
      id: 'r5',
      column: 'notes',
      condition: 'is_empty',
      value: '',
      style: { backgroundColor: '#f1f5f9', textColor: '#64748b', fontWeight: 'normal' },
    },
    {
      id: 'r6',
      column: 'description',
      condition: 'not_empty',
      value: '',
      style: { backgroundColor: '#f0fdf4', textColor: '#15803d', fontWeight: 'normal' },
    },
  ];

  it('matches "equals" condition', () => {
    const style = getConditionalStyle(rules, 'status', 'Done');
    expect(style).toBeDefined();
    expect(style?.backgroundColor).toBe('#dcfce7');
    expect(style?.color).toBe('#166534');
    expect(style?.fontWeight).toBe('bold');
  });

  it('returns undefined for non-matching "equals"', () => {
    const style = getConditionalStyle(rules, 'status', 'In Progress');
    expect(style).toBeUndefined();
  });

  it('matches "contains" condition', () => {
    const style = getConditionalStyle(rules, 'name', 'This is urgent!');
    expect(style).toBeDefined();
    expect(style?.backgroundColor).toBe('#fef2f2');
  });

  it('matches "contains" case-insensitively', () => {
    const style = getConditionalStyle(rules, 'name', 'URGENT task');
    expect(style).toBeDefined();
  });

  it('returns undefined for non-matching "contains"', () => {
    const style = getConditionalStyle(rules, 'name', 'normal task');
    expect(style).toBeUndefined();
  });

  it('matches "gt" (greater than) condition', () => {
    const style = getConditionalStyle(rules, 'score', 95);
    expect(style).toBeDefined();
    expect(style?.backgroundColor).toBe('#eff6ff');
  });

  it('does not match "gt" for equal value', () => {
    const style = getConditionalStyle(rules, 'score', 80);
    expect(style).toBeUndefined();
  });

  it('matches "lt" (less than) condition', () => {
    const style = getConditionalStyle(rules, 'score', 10);
    expect(style).toBeDefined();
    expect(style?.backgroundColor).toBe('#fef9c3');
  });

  it('does not match "lt" for equal value', () => {
    const style = getConditionalStyle(rules, 'score', 20);
    expect(style).toBeUndefined();
  });

  it('matches "is_empty" condition for empty string', () => {
    const style = getConditionalStyle(rules, 'notes', '');
    expect(style).toBeDefined();
    expect(style?.backgroundColor).toBe('#f1f5f9');
  });

  it('matches "is_empty" condition for null', () => {
    const style = getConditionalStyle(rules, 'notes', null);
    expect(style).toBeDefined();
  });

  it('does not match "is_empty" for non-empty value', () => {
    const style = getConditionalStyle(rules, 'notes', 'Some note');
    expect(style).toBeUndefined();
  });

  it('matches "not_empty" condition', () => {
    const style = getConditionalStyle(rules, 'description', 'Has content');
    expect(style).toBeDefined();
    expect(style?.backgroundColor).toBe('#f0fdf4');
  });

  it('does not match "not_empty" for empty string', () => {
    const style = getConditionalStyle(rules, 'description', '');
    expect(style).toBeUndefined();
  });

  it('returns undefined for unmatched column', () => {
    const style = getConditionalStyle(rules, 'unknown_column', 'anything');
    expect(style).toBeUndefined();
  });

  it('returns undefined for empty rules', () => {
    const style = getConditionalStyle([], 'status', 'Done');
    expect(style).toBeUndefined();
  });

  it('returns first matching rule (priority order)', () => {
    const multiRules: FormatRule[] = [
      {
        id: 'first',
        column: 'x',
        condition: 'equals',
        value: 'a',
        style: { backgroundColor: '#111', textColor: '#222', fontWeight: 'bold' },
      },
      {
        id: 'second',
        column: 'x',
        condition: 'equals',
        value: 'a',
        style: { backgroundColor: '#333', textColor: '#444', fontWeight: 'normal' },
      },
    ];
    const style = getConditionalStyle(multiRules, 'x', 'a');
    expect(style?.backgroundColor).toBe('#111');
  });

  it('style includes borderRadius and padding', () => {
    const style = getConditionalStyle(rules, 'status', 'Done');
    expect(style?.borderRadius).toBe('6px');
    expect(style?.padding).toBe('0 4px');
  });
});

describe('ConditionalFormatting component', () => {
  const columns: ColumnDef[] = [
    { key: 'status', header: 'Status', type: 'status', visible: true, width: 140 },
    { key: 'name', header: 'Name', type: 'text', visible: true, width: 200 },
  ];

  it('renders when open', () => {
    render(
      <ConditionalFormatting
        open={true}
        onClose={vi.fn()}
        rules={[]}
        onRulesChange={vi.fn()}
        columns={columns}
      />
    );
    expect(document.body.textContent).toBeTruthy();
  });

  it('does not render when closed', () => {
    const { container } = render(
      <ConditionalFormatting
        open={false}
        onClose={vi.fn()}
        rules={[]}
        onRulesChange={vi.fn()}
        columns={columns}
      />
    );
    expect(container.firstChild).toBeFalsy();
  });
});
