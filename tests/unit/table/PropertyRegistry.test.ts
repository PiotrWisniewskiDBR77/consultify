/**
 * Behavior-based tests for PropertyRegistry.
 * Tests: all column types registered, validation, coercion, helpers.
 */
import { describe, expect, it } from 'vitest';

import {
  coerceValue,
  getDefaultValue,
  getFilterOperators,
  getPropertyGroups,
  getPropertySpec,
  PROPERTY_REGISTRY,
  validateValue,
} from '@/components/MyWork/table/PropertyRegistry';
import type { ColumnType } from '@/components/MyWork/table/tableTypes';

const ALL_TYPES: ColumnType[] = [
  'text', 'number', 'select', 'multiselect', 'status', 'date', 'checkbox',
  'rating', 'person', 'url', 'progress', 'formula', 'ai_generated', 'file',
  'relation', 'rollup', 'emoji', 'color', 'currency', 'phone', 'email',
  'created_time', 'created_by', 'last_edited_time', 'last_edited_by',
];

describe('PropertyRegistry', () => {
  it('has entries for all ColumnType values', () => {
    for (const type of ALL_TYPES) {
      expect(PROPERTY_REGISTRY[type]).toBeDefined();
      expect(PROPERTY_REGISTRY[type].type).toBe(type);
    }
  });

  it('every entry has required fields', () => {
    for (const spec of Object.values(PROPERTY_REGISTRY)) {
      expect(spec.label.en).toBeTruthy();
      expect(spec.label.pl).toBeTruthy();
      expect(spec.icon).toBeTruthy();
      expect(spec.defaultWidth).toBeGreaterThan(0);
      expect(typeof spec.validate).toBe('function');
      expect(typeof spec.coerce).toBe('function');
      expect(spec.filterOperators.length).toBeGreaterThan(0);
      expect(['basic', 'rich', 'computed', 'linked']).toContain(spec.group);
    }
  });

  it('status type defaults to "todo"', () => {
    expect(getDefaultValue('status')).toBe('todo');
  });

  it('coerces number values', () => {
    expect(coerceValue('number', '42')).toBe(42);
    expect(coerceValue('number', null)).toBeNull();
    expect(coerceValue('number', '')).toBeNull();
  });

  it('coerces progress to 0-100 range', () => {
    expect(coerceValue('progress', 150)).toBe(100);
    expect(coerceValue('progress', -10)).toBe(0);
    expect(coerceValue('progress', 50)).toBe(50);
  });

  it('validates rating values', () => {
    expect(validateValue('rating', 5)).toBe(true);
    expect(validateValue('rating', 11)).toBe(false);
    expect(validateValue('rating', -1)).toBe(false);
    expect(validateValue('rating', null)).toBe(true);
  });

  it('coerces multiselect to array', () => {
    expect(coerceValue('multiselect', null)).toEqual([]);
    expect(coerceValue('multiselect', 'single')).toEqual(['single']);
    expect(coerceValue('multiselect', ['a', 'b'])).toEqual(['a', 'b']);
  });

  it('getPropertySpec falls back to text for unknown type', () => {
    const spec = getPropertySpec('unknown_type' as any);
    expect(spec.type).toBe('text');
  });

  it('getFilterOperators returns operators for each type', () => {
    for (const type of ALL_TYPES) {
      const ops = getFilterOperators(type);
      expect(ops.length).toBeGreaterThan(0);
    }
  });

  it('getPropertyGroups returns 4 groups', () => {
    const groups = getPropertyGroups();
    expect(groups.length).toBe(4);
    expect(groups.map((g) => g.key)).toEqual(['basic', 'rich', 'computed', 'linked']);
  });

  it('system-managed fields are in computed group', () => {
    expect(getPropertySpec('created_time').group).toBe('computed');
    expect(getPropertySpec('created_by').group).toBe('computed');
    expect(getPropertySpec('last_edited_time').group).toBe('computed');
    expect(getPropertySpec('last_edited_by').group).toBe('computed');
  });
});
