/**
 * R0 Smoke: V4-IDEA-01 — Idea Schema (Table OS)
 * Verifies: PROPERTY_REGISTRY contains all expected column types
 */

import type { ColumnType } from '../../../../src/components/MyWork/table/tableTypes';
import { PROPERTY_REGISTRY } from '../../../../src/components/MyWork/table/PropertyRegistry';

describe('V4-IDEA-01: Idea Schema — Property Registry', () => {
  it('PROPERTY_REGISTRY contains all core column types', () => {
    const coreTypes: ColumnType[] = [
      'text', 'number', 'select', 'multiselect', 'checkbox',
      'date', 'person', 'url', 'email', 'phone', 'rating',
    ];
    for (const t of coreTypes) {
      expect(PROPERTY_REGISTRY[t]).toBeDefined();
      expect(PROPERTY_REGISTRY[t].label).toBeTruthy();
    }
  });

  it('PROPERTY_REGISTRY contains V4 types (status, relation, rollup, formula)', () => {
    const v4Types: ColumnType[] = ['status', 'relation', 'rollup', 'formula'];
    for (const t of v4Types) {
      expect(PROPERTY_REGISTRY[t]).toBeDefined();
    }
  });

  it('PROPERTY_REGISTRY contains system-managed types', () => {
    const systemTypes: ColumnType[] = [
      'created_time', 'created_by', 'last_edited_time', 'last_edited_by',
    ];
    for (const t of systemTypes) {
      expect(PROPERTY_REGISTRY[t]).toBeDefined();
    }
  });

  it('each property spec has label, icon, and defaultWidth', () => {
    for (const [, spec] of Object.entries(PROPERTY_REGISTRY)) {
      expect(spec.label).toBeTruthy();
      expect(spec.icon).toBeTruthy();
      expect(typeof spec.defaultWidth).toBe('number');
      expect(spec.defaultWidth).toBeGreaterThan(0);
    }
  });
});
