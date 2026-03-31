/**
 * P12 mindmap builder — contract tests against real canon + mindmap service.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAll = vi.fn();
const mockGet = vi.fn();
const mockRun = vi.fn();
const mockTableExists = vi.fn();

vi.mock('../../server/src/utils/DbPromise.js', () => ({
  all: (...args: unknown[]) => mockAll(...args),
  get: (...args: unknown[]) => mockGet(...args),
  run: (...args: unknown[]) => mockRun(...args),
  transaction: vi.fn().mockResolvedValue({ success: true, results: [] }),
  tableExists: (...args: unknown[]) => mockTableExists(...args),
  exec: vi.fn().mockResolvedValue({ success: true }),
}));

import {
  P12_ACCEPTANCE_CHECKLIST,
  P12_AI_COBUILDING_RULES,
  P12_CALM_LOOP_RULES,
  P12_DEGRADED_SCENARIOS,
  P12_EXPORT_FORMATS,
  P12_NODE_KINDS,
  P12_NODE_OPERATIONS,
  P12_UNDO_REDO_RULES,
  exportToMarkdown,
  resolveDeleteAnchor,
  wouldCreateCycle,
} from '../../server/src/services/v8/mindmapCanon.js';
import { getContract, validateOperation } from '../../server/src/services/v8/mindmapService.js';

function nodeRow(
  id: string,
  mindmapId: string,
  organizationId: string,
  parentId: string | null,
  label: string
) {
  return {
    id,
    mindmap_id: mindmapId,
    organization_id: organizationId,
    parent_id: parentId,
    label,
    kind: 'topic',
    position_index: 0,
    collapsed: 0,
    metadata: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockTableExists.mockResolvedValue(true);
  mockAll.mockResolvedValue([]);
  mockGet.mockResolvedValue(null);
  mockRun.mockResolvedValue({ success: true, changes: 1 });
});

describe('P12 mindmap builder contract', () => {
  describe('Canon structure', () => {
    it('P12_NODE_OPERATIONS has 8 operations', () => {
      expect(P12_NODE_OPERATIONS).toHaveLength(8);
    });

    it('P12_NODE_KINDS has 7 kinds', () => {
      expect(P12_NODE_KINDS).toHaveLength(7);
    });

    it('P12_CALM_LOOP_RULES has 8 rules (named keys)', () => {
      const keys = Object.keys(P12_CALM_LOOP_RULES) as (keyof typeof P12_CALM_LOOP_RULES)[];
      expect(keys).toHaveLength(8);
      expect(keys).toEqual(
        expect.arrayContaining([
          'selectionAfterCreate',
          'selectionAfterMove',
          'anchorAfterDelete',
          'cycleDetection',
          'collapsePreservesData',
          'collapseStateVisible',
          'renameInPlace',
          'rootConstraint',
        ])
      );
    });

    it('P12_EXPORT_FORMATS has 2 formats (json, markdown)', () => {
      expect(P12_EXPORT_FORMATS).toHaveLength(2);
      expect([...P12_EXPORT_FORMATS].sort()).toEqual(['json', 'markdown']);
    });

    it('P12_AI_COBUILDING_RULES has 6 rules', () => {
      expect(Object.keys(P12_AI_COBUILDING_RULES)).toHaveLength(6);
    });

    it('P12_UNDO_REDO_RULES has 4 rules', () => {
      expect(Object.keys(P12_UNDO_REDO_RULES)).toHaveLength(4);
    });

    it('P12_DEGRADED_SCENARIOS has >= 8 scenarios', () => {
      expect(P12_DEGRADED_SCENARIOS.length).toBeGreaterThanOrEqual(8);
    });

    it('P12_ACCEPTANCE_CHECKLIST has 10 items, all testable', () => {
      expect(P12_ACCEPTANCE_CHECKLIST).toHaveLength(10);
      expect(P12_ACCEPTANCE_CHECKLIST.every((i) => i.testable === true)).toBe(true);
    });
  });

  describe('Cycle detection', () => {
    it('detects self-reparent', () => {
      const map = new Map<string, string | null>([
        ['a', null],
        ['b', 'a'],
      ]);
      expect(wouldCreateCycle('a', 'a', map)).toBe(true);
    });

    it('detects reparent to descendant', () => {
      const map = new Map<string, string | null>([
        ['root', null],
        ['a', 'root'],
        ['b', 'a'],
        ['c', 'b'],
      ]);
      expect(wouldCreateCycle('a', 'c', map)).toBe(true);
    });

    it('allows valid reparent', () => {
      const map = new Map<string, string | null>([
        ['root', null],
        ['a', 'root'],
        ['b', 'a'],
      ]);
      expect(wouldCreateCycle('b', 'root', map)).toBe(false);
    });
  });

  describe('Delete anchor', () => {
    it('returns parent when available', () => {
      expect(resolveDeleteAnchor('n', 'p', [], 'root')).toBe('p');
    });

    it('returns sibling when parent is deleted', () => {
      expect(resolveDeleteAnchor('n', null, ['s1', 'n'], 'root')).toBe('s1');
    });

    it('returns root as fallback', () => {
      expect(resolveDeleteAnchor('leaf', null, [], 'root')).toBe('root');
    });

    it('returns null when only node', () => {
      expect(resolveDeleteAnchor('only', null, [], 'only')).toBeNull();
    });
  });

  describe('Export', () => {
    it('single root exports as h1', () => {
      const md = exportToMarkdown([{ id: '1', label: 'Root', parentId: null }]);
      expect(md).toMatch(/^# Root$/m);
    });

    it('nested hierarchy preserves indentation', () => {
      const md = exportToMarkdown([
        { id: 'a', label: 'A', parentId: null },
        { id: 'b', label: 'B', parentId: 'a' },
        { id: 'c', label: 'C', parentId: 'b' },
      ]);
      expect(md).toContain('# A');
      expect(md).toMatch(/^\s*-\s+B$/m);
      expect(md).toMatch(/^\s{2,}-\s+C$/m);
    });

    it('empty graph returns empty string', () => {
      expect(exportToMarkdown([])).toBe('');
    });
  });

  describe('Service contract', () => {
    it('getContract returns canon data', () => {
      const c = getContract();
      expect(c.nodeOperations).toEqual(P12_NODE_OPERATIONS);
      expect(c.nodeKinds).toEqual(P12_NODE_KINDS);
      expect(c.calmLoopRules).toBe(P12_CALM_LOOP_RULES);
      expect(c.acceptanceChecklist).toEqual(P12_ACCEPTANCE_CHECKLIST);
      expect(c.degradedScenarios).toEqual(P12_DEGRADED_SCENARIOS);
    });

    it('validateOperation rejects cycle move', async () => {
      const org = 'org-test';
      const mm = 'mm-1';
      mockAll.mockResolvedValueOnce([
        nodeRow('a', mm, org, null, 'A'),
        nodeRow('b', mm, org, 'a', 'B'),
        nodeRow('c', mm, org, 'b', 'C'),
      ]);
      const r = await validateOperation('move', 'a', mm, org, { newParentId: 'c' });
      expect(r.valid).toBe(false);
      expect(r.reason?.toLowerCase()).toContain('cycle');
    });

    it('validateOperation allows valid operations', async () => {
      const org = 'org-test';
      const mm = 'mm-1';
      mockAll.mockResolvedValueOnce([
        nodeRow('a', mm, org, null, 'A'),
        nodeRow('b', mm, org, 'a', 'B'),
      ]);
      const moveOk = await validateOperation('move', 'b', mm, org, { newParentId: 'a' });
      expect(moveOk.valid).toBe(true);

      mockAll.mockResolvedValueOnce([
        nodeRow('a', mm, org, null, 'A'),
        nodeRow('b', mm, org, 'a', 'B'),
      ]);
      const renameOk = await validateOperation('rename', 'b', mm, org);
      expect(renameOk.valid).toBe(true);
    });
  });
});
