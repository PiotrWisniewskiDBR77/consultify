/**
 * P12 Mindmap Canon — Unit + contract tests.
 *
 * Covers: node operations, CALM loop rules, cycle detection,
 * delete anchor resolution, export formats, AI co-building rules,
 * undo/redo posture, degraded scenarios, acceptance checklist.
 */
import { describe, expect, it } from 'vitest';

import {
  P12_ACCEPTANCE_CHECKLIST,
  P12_AI_COBUILDING_RULES,
  P12_CALM_LOOP_RULES,
  P12_DEGRADED_SCENARIOS,
  P12_EXPORT_FORMATS,
  P12_EXPORT_RULES,
  P12_NODE_KINDS,
  P12_NODE_OPERATIONS,
  P12_OWNERSHIP,
  P12_UNDO_REDO_RULES,
  exportToMarkdown,
  resolveDeleteAnchor,
  wouldCreateCycle,
} from '../../../services/v8/mindmapCanon.js';

describe('P12 Mindmap Canon', () => {
  // ─── Node operations ──────────────────────────────────────────

  describe('P12_NODE_OPERATIONS', () => {
    it('contains exactly 8 canonical operations', () => {
      expect(P12_NODE_OPERATIONS).toHaveLength(8);
    });

    it('includes all required operations', () => {
      const required = ['create_root', 'add_child', 'add_sibling', 'rename', 'move', 'delete', 'collapse', 'expand'];
      for (const op of required) {
        expect(P12_NODE_OPERATIONS).toContain(op);
      }
    });
  });

  describe('P12_NODE_KINDS', () => {
    it('contains exactly 7 mindmap node kinds', () => {
      expect(P12_NODE_KINDS).toHaveLength(7);
    });

    it('includes topic and subtopic as core kinds', () => {
      expect(P12_NODE_KINDS).toContain('topic');
      expect(P12_NODE_KINDS).toContain('subtopic');
    });
  });

  // ─── CALM loop rules ─────────────────────────────────────────

  describe('P12_CALM_LOOP_RULES', () => {
    it('defines selection-after-create rule', () => {
      expect(P12_CALM_LOOP_RULES.selectionAfterCreate).toBeTruthy();
      expect(P12_CALM_LOOP_RULES.selectionAfterCreate).toContain('selected');
    });

    it('defines selection-after-move rule', () => {
      expect(P12_CALM_LOOP_RULES.selectionAfterMove).toBeTruthy();
      expect(P12_CALM_LOOP_RULES.selectionAfterMove).toContain('retains selection');
    });

    it('defines anchor-after-delete rule', () => {
      expect(P12_CALM_LOOP_RULES.anchorAfterDelete).toBeTruthy();
      expect(P12_CALM_LOOP_RULES.anchorAfterDelete).toContain('parent');
    });

    it('defines cycle detection rule', () => {
      expect(P12_CALM_LOOP_RULES.cycleDetection).toBeTruthy();
      expect(P12_CALM_LOOP_RULES.cycleDetection).toContain('blocked');
    });

    it('defines collapse preserves data rule', () => {
      expect(P12_CALM_LOOP_RULES.collapsePreservesData).toContain('never deletes data');
    });

    it('defines root constraint', () => {
      expect(P12_CALM_LOOP_RULES.rootConstraint).toContain('exactly one root');
    });
  });

  // ─── Cycle detection helper ───────────────────────────────────

  describe('wouldCreateCycle', () => {
    it('detects self-reparent as cycle', () => {
      const parentMap = new Map<string, string | null>([['a', null]]);
      expect(wouldCreateCycle('a', 'a', parentMap)).toBe(true);
    });

    it('detects reparent to own child as cycle', () => {
      const parentMap = new Map<string, string | null>([
        ['root', null],
        ['child', 'root'],
        ['grandchild', 'child'],
      ]);
      expect(wouldCreateCycle('root', 'child', parentMap)).toBe(true);
    });

    it('detects reparent to own grandchild as cycle', () => {
      const parentMap = new Map<string, string | null>([
        ['root', null],
        ['child', 'root'],
        ['grandchild', 'child'],
      ]);
      expect(wouldCreateCycle('root', 'grandchild', parentMap)).toBe(true);
    });

    it('allows valid reparent (no cycle)', () => {
      const parentMap = new Map<string, string | null>([
        ['root', null],
        ['a', 'root'],
        ['b', 'root'],
        ['c', 'a'],
      ]);
      expect(wouldCreateCycle('c', 'b', parentMap)).toBe(false);
    });

    it('allows reparent to root', () => {
      const parentMap = new Map<string, string | null>([
        ['root', null],
        ['a', 'root'],
        ['b', 'a'],
      ]);
      expect(wouldCreateCycle('b', 'root', parentMap)).toBe(false);
    });

    it('handles disconnected nodes gracefully', () => {
      const parentMap = new Map<string, string | null>([
        ['a', null],
        ['b', null],
      ]);
      expect(wouldCreateCycle('a', 'b', parentMap)).toBe(false);
    });
  });

  // ─── Delete anchor resolution ─────────────────────────────────

  describe('resolveDeleteAnchor', () => {
    it('returns parent when parent exists', () => {
      expect(resolveDeleteAnchor('child', 'parent', ['sibling'], 'root')).toBe('parent');
    });

    it('returns sibling when parent is the deleted node', () => {
      expect(resolveDeleteAnchor('node', 'node', ['sibling1', 'sibling2'], 'root')).toBe('sibling1');
    });

    it('returns root when no parent or sibling', () => {
      expect(resolveDeleteAnchor('node', null, [], 'root')).toBe('root');
    });

    it('returns null when deleting the only node', () => {
      expect(resolveDeleteAnchor('root', null, [], 'root')).toBe(null);
    });

    it('skips deleted node in sibling list', () => {
      expect(resolveDeleteAnchor('node', 'node', ['node', 'other'], 'root')).toBe('other');
    });
  });

  // ─── Export formats ───────────────────────────────────────────

  describe('P12_EXPORT_FORMATS', () => {
    it('supports json and markdown', () => {
      expect(P12_EXPORT_FORMATS).toContain('json');
      expect(P12_EXPORT_FORMATS).toContain('markdown');
      expect(P12_EXPORT_FORMATS).toHaveLength(2);
    });
  });

  describe('P12_EXPORT_RULES', () => {
    it('defines hierarchy preservation rule', () => {
      expect(P12_EXPORT_RULES.hierarchyPreserved).toContain('parent-child');
    });

    it('defines round-trip rule for JSON', () => {
      expect(P12_EXPORT_RULES.roundTrip).toContain('idempotent');
    });
  });

  describe('exportToMarkdown', () => {
    it('exports single root as h1', () => {
      const nodes = [{ id: 'root', label: 'Root Topic', parentId: null }];
      const md = exportToMarkdown(nodes);
      expect(md).toBe('# Root Topic');
    });

    it('exports root with children as indented list', () => {
      const nodes = [
        { id: 'root', label: 'Root', parentId: null },
        { id: 'c1', label: 'Child 1', parentId: 'root' },
        { id: 'c2', label: 'Child 2', parentId: 'root' },
      ];
      const md = exportToMarkdown(nodes);
      expect(md).toContain('# Root');
      expect(md).toContain('- Child 1');
      expect(md).toContain('- Child 2');
    });

    it('exports nested hierarchy with proper indentation', () => {
      const nodes = [
        { id: 'root', label: 'Root', parentId: null },
        { id: 'c1', label: 'Child', parentId: 'root' },
        { id: 'gc1', label: 'Grandchild', parentId: 'c1' },
      ];
      const md = exportToMarkdown(nodes);
      expect(md).toContain('# Root');
      expect(md).toContain('- Child');
      expect(md).toContain('  - Grandchild');
    });

    it('handles untitled nodes', () => {
      const nodes = [{ id: 'root', parentId: null }];
      const md = exportToMarkdown(nodes);
      expect(md).toContain('(untitled)');
    });

    it('returns empty string for empty graph', () => {
      expect(exportToMarkdown([])).toBe('');
    });
  });

  // ─── AI co-building rules ────────────────────────────────────

  describe('P12_AI_COBUILDING_RULES', () => {
    it('requires preview diff before apply', () => {
      expect(P12_AI_COBUILDING_RULES.previewDiff).toContain('diff overlay');
    });

    it('requires explicit accept/reject', () => {
      expect(P12_AI_COBUILDING_RULES.explicitAcceptReject).toContain('explicitly');
    });

    it('requires undoable as one step', () => {
      expect(P12_AI_COBUILDING_RULES.undoableAsOneStep).toContain('single undo step');
    });

    it('forbids silent edits', () => {
      expect(P12_AI_COBUILDING_RULES.noSilentEdits).toContain('preview→accept');
    });
  });

  // ─── Undo/redo posture ───────────────────────────────────────

  describe('P12_UNDO_REDO_RULES', () => {
    it('declares all operations undoable', () => {
      expect(P12_UNDO_REDO_RULES.allOperationsUndoable).toContain('undoable');
    });

    it('declares AI accept as one undo step', () => {
      expect(P12_UNDO_REDO_RULES.batchAI).toContain('one undo step');
    });
  });

  // ─── Degraded scenarios ──────────────────────────────────────

  describe('P12_DEGRADED_SCENARIOS', () => {
    it('has at least 8 scenarios', () => {
      expect(P12_DEGRADED_SCENARIOS.length).toBeGreaterThanOrEqual(8);
    });

    it('every scenario has posture and recovery', () => {
      for (const s of P12_DEGRADED_SCENARIOS) {
        expect(s.scenario).toBeTruthy();
        expect(s.posture).toBeTruthy();
        expect(s.recovery).toBeTruthy();
      }
    });

    it('covers AI service unavailable', () => {
      const aiScenario = P12_DEGRADED_SCENARIOS.find((s) => s.scenario.includes('AI'));
      expect(aiScenario).toBeTruthy();
      expect(aiScenario!.posture).toContain('disabled');
    });

    it('covers permission denied', () => {
      const permScenario = P12_DEGRADED_SCENARIOS.find((s) => s.scenario.includes('Permission'));
      expect(permScenario).toBeTruthy();
      expect(permScenario!.posture).toContain('view-only');
    });

    it('covers cycle detection', () => {
      const cycleScenario = P12_DEGRADED_SCENARIOS.find((s) => s.scenario.includes('Cycle'));
      expect(cycleScenario).toBeTruthy();
      expect(cycleScenario!.posture).toContain('blocked');
    });
  });

  // ─── Acceptance checklist ────────────────────────────────────

  describe('P12_ACCEPTANCE_CHECKLIST', () => {
    it('has exactly 10 items', () => {
      expect(P12_ACCEPTANCE_CHECKLIST).toHaveLength(10);
    });

    it('all items are testable', () => {
      for (const item of P12_ACCEPTANCE_CHECKLIST) {
        expect(item.testable).toBe(true);
      }
    });

    it('all items have unique IDs', () => {
      const ids = P12_ACCEPTANCE_CHECKLIST.map((c) => c.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('covers create/child/sibling (AC-01)', () => {
      const ac01 = P12_ACCEPTANCE_CHECKLIST.find((c) => c.id === 'P12-AC-01');
      expect(ac01!.requirement).toContain('root');
      expect(ac01!.requirement).toContain('child');
      expect(ac01!.requirement).toContain('sibling');
    });

    it('covers cycle detection (AC-07)', () => {
      const ac07 = P12_ACCEPTANCE_CHECKLIST.find((c) => c.id === 'P12-AC-07');
      expect(ac07!.requirement).toContain('cycle');
    });

    it('covers AI co-building (AC-10)', () => {
      const ac10 = P12_ACCEPTANCE_CHECKLIST.find((c) => c.id === 'P12-AC-10');
      expect(ac10!.requirement).toContain('AI');
    });
  });

  // ─── Ownership ───────────────────────────────────────────────

  describe('P12_OWNERSHIP', () => {
    it('declares owner', () => {
      expect(P12_OWNERSHIP.owner).toContain('Mindmap');
    });

    it('lists infrastructure dependencies', () => {
      expect(P12_OWNERSHIP.infrastructure.length).toBeGreaterThanOrEqual(3);
      expect(P12_OWNERSHIP.infrastructure.some((i) => i.includes('toolCollaborationAdapter'))).toBe(true);
      expect(P12_OWNERSHIP.infrastructure.some((i) => i.includes('multiplayerHardening'))).toBe(true);
    });
  });
});
