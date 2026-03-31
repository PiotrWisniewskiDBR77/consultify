/**
 * P13 Whiteboard Canon — Unit + contract tests.
 *
 * Covers: toolbelt, facilitation flow, export/readback assumptions,
 * collaboration boundary, AI co-building rules, anti-duplicate gate,
 * degraded scenarios, acceptance checklist.
 */
import { describe, expect, it } from 'vitest';

import {
  P13_ACCEPTANCE_CHECKLIST,
  P13_AI_COBUILDING_RULES,
  P13_ANTI_DUPLICATE_RULES,
  P13_COLLABORATION_BOUNDARY,
  P13_DEGRADED_SCENARIOS,
  P13_EXPORT_ASSUMPTIONS,
  P13_FACILITATION_FLOW,
  P13_FACILITATION_RULES,
  P13_FACILITATION_TRANSITIONS,
  P13_OWNERSHIP,
  P13_TOOLBELT,
  P13_TOOLBELT_RULES,
  P13_WHITEBOARD_NODE_KINDS,
  isFacilitationTerminal,
  isValidFacilitationTransition,
  isValidToolbeltAction,
} from '../../../services/v8/whiteboardCanon.js';

describe('P13 Whiteboard Canon', () => {
  // ─── Toolbelt ─────────────────────────────────────────────────

  describe('P13_TOOLBELT', () => {
    it('contains exactly 9 tools', () => {
      expect(P13_TOOLBELT).toHaveLength(9);
    });

    it('includes all required tools', () => {
      const required = [
        'select', 'pan_zoom_fit', 'sticky', 'shape', 'text',
        'group_ungroup', 'align_distribute', 'undo_redo', 'export',
      ];
      for (const tool of required) {
        expect(P13_TOOLBELT).toContain(tool);
      }
    });
  });

  describe('P13_TOOLBELT_RULES', () => {
    it('has a rule for every tool', () => {
      for (const tool of P13_TOOLBELT) {
        expect(P13_TOOLBELT_RULES[tool]).toBeTruthy();
      }
    });

    it('select rule mentions click', () => {
      expect(P13_TOOLBELT_RULES.select).toContain('click');
    });

    it('export rule mentions PNG', () => {
      expect(P13_TOOLBELT_RULES.export).toContain('PNG');
    });
  });

  describe('isValidToolbeltAction', () => {
    it('returns true for valid tool', () => {
      expect(isValidToolbeltAction('select')).toBe(true);
      expect(isValidToolbeltAction('sticky')).toBe(true);
    });

    it('returns false for invalid tool', () => {
      expect(isValidToolbeltAction('eraser')).toBe(false);
      expect(isValidToolbeltAction('')).toBe(false);
    });
  });

  describe('P13_WHITEBOARD_NODE_KINDS', () => {
    it('contains 6 whiteboard node kinds', () => {
      expect(P13_WHITEBOARD_NODE_KINDS).toHaveLength(6);
    });

    it('includes sticky and shape', () => {
      expect(P13_WHITEBOARD_NODE_KINDS).toContain('sticky');
      expect(P13_WHITEBOARD_NODE_KINDS).toContain('shape');
    });
  });

  // ─── Facilitation flow ────────────────────────────────────────

  describe('P13_FACILITATION_FLOW', () => {
    it('has 4 phases in order', () => {
      expect(P13_FACILITATION_FLOW).toEqual(['start', 'organize', 'converge', 'handoff']);
    });
  });

  describe('P13_FACILITATION_RULES', () => {
    it('has a rule for every phase', () => {
      for (const phase of P13_FACILITATION_FLOW) {
        expect(P13_FACILITATION_RULES[phase]).toBeTruthy();
      }
    });

    it('start phase allows free sticky creation', () => {
      expect(P13_FACILITATION_RULES.start).toContain('stickies');
    });

    it('handoff phase generates summary', () => {
      expect(P13_FACILITATION_RULES.handoff).toContain('Summary');
    });
  });

  describe('P13_FACILITATION_TRANSITIONS', () => {
    it('start can transition to organize', () => {
      expect(P13_FACILITATION_TRANSITIONS.start).toContain('organize');
    });

    it('organize can go back to start or forward to converge', () => {
      expect(P13_FACILITATION_TRANSITIONS.organize).toContain('converge');
      expect(P13_FACILITATION_TRANSITIONS.organize).toContain('start');
    });

    it('converge can transition to handoff or back to organize', () => {
      expect(P13_FACILITATION_TRANSITIONS.converge).toContain('handoff');
      expect(P13_FACILITATION_TRANSITIONS.converge).toContain('organize');
    });

    it('handoff is terminal', () => {
      expect(P13_FACILITATION_TRANSITIONS.handoff).toHaveLength(0);
    });
  });

  describe('isValidFacilitationTransition', () => {
    it('allows start → organize', () => {
      expect(isValidFacilitationTransition('start', 'organize')).toBe(true);
    });

    it('blocks start → converge', () => {
      expect(isValidFacilitationTransition('start', 'converge')).toBe(false);
    });

    it('blocks start → handoff', () => {
      expect(isValidFacilitationTransition('start', 'handoff')).toBe(false);
    });

    it('allows converge → handoff', () => {
      expect(isValidFacilitationTransition('converge', 'handoff')).toBe(true);
    });

    it('blocks handoff → anything', () => {
      expect(isValidFacilitationTransition('handoff', 'start')).toBe(false);
      expect(isValidFacilitationTransition('handoff', 'organize')).toBe(false);
    });
  });

  describe('isFacilitationTerminal', () => {
    it('handoff is terminal', () => {
      expect(isFacilitationTerminal('handoff')).toBe(true);
    });

    it('start is not terminal', () => {
      expect(isFacilitationTerminal('start')).toBe(false);
    });

    it('organize is not terminal', () => {
      expect(isFacilitationTerminal('organize')).toBe(false);
    });
  });

  // ─── Export/readback assumptions ──────────────────────────────

  describe('P13_EXPORT_ASSUMPTIONS', () => {
    it('supports png and json formats', () => {
      expect(P13_EXPORT_ASSUMPTIONS.formats).toContain('png');
      expect(P13_EXPORT_ASSUMPTIONS.formats).toContain('json');
    });

    it('declares round-trip safety for JSON', () => {
      expect(P13_EXPORT_ASSUMPTIONS.readbackContract).toContain('visually identical');
    });

    it('declares SVG as non-goal for P0', () => {
      expect(P13_EXPORT_ASSUMPTIONS.noSvgInP0).toContain('non-goal');
    });
  });

  // ─── Collaboration boundary ───────────────────────────────────

  describe('P13_COLLABORATION_BOUNDARY', () => {
    it('uses per_workspace room granularity', () => {
      expect(P13_COLLABORATION_BOUNDARY.roomGranularity).toBe('per_workspace');
    });

    it('is surface aware', () => {
      expect(P13_COLLABORATION_BOUNDARY.surfaceAware).toBe(true);
    });

    it('uses advisory_object lock type', () => {
      expect(P13_COLLABORATION_BOUNDARY.lockType).toBe('advisory_object');
    });

    it('supports facilitation', () => {
      expect(P13_COLLABORATION_BOUNDARY.facilitationSupported).toBe(true);
    });

    it('uses queue_and_merge offline policy', () => {
      expect(P13_COLLABORATION_BOUNDARY.offlinePolicy).toBe('queue_and_merge');
    });

    it('has max concurrent editors limit', () => {
      expect(P13_COLLABORATION_BOUNDARY.maxConcurrentEditors).toBeGreaterThan(0);
    });
  });

  // ─── AI co-building rules ────────────────────────────────────

  describe('P13_AI_COBUILDING_RULES', () => {
    it('requires generate → preview → apply flow', () => {
      expect(P13_AI_COBUILDING_RULES.generatePreviewApply).toContain('preview');
    });

    it('forbids silent apply', () => {
      expect(P13_AI_COBUILDING_RULES.noSilentApply).toContain('explicit');
    });

    it('starts as personal draft', () => {
      expect(P13_AI_COBUILDING_RULES.proposalAsPersonalDraft).toContain('personal_draft');
    });

    it('is undoable as one step', () => {
      expect(P13_AI_COBUILDING_RULES.undoableAsOneStep).toContain('single undo step');
    });

    it('is facilitation-aware', () => {
      expect(P13_AI_COBUILDING_RULES.facilitationAware).toContain('facilitator');
    });
  });

  // ─── Anti-duplicate gate ─────────────────────────────────────

  describe('P13_ANTI_DUPLICATE_RULES', () => {
    it('prevents parallel canvas entity', () => {
      expect(P13_ANTI_DUPLICATE_RULES.noParallelCanvas).toContain('surface within IdeaWorkspace');
    });

    it('prevents parallel object model', () => {
      expect(P13_ANTI_DUPLICATE_RULES.noParallelObjectModel).toContain('CanonicalNode');
    });

    it('prevents parallel collaboration layer', () => {
      expect(P13_ANTI_DUPLICATE_RULES.noParallelCollaboration).toContain('toolCollaborationAdapter');
    });

    it('enforces single facilitation session', () => {
      expect(P13_ANTI_DUPLICATE_RULES.singleFacilitationSession).toContain('one active');
    });
  });

  // ─── Degraded scenarios ──────────────────────────────────────

  describe('P13_DEGRADED_SCENARIOS', () => {
    it('has at least 8 scenarios', () => {
      expect(P13_DEGRADED_SCENARIOS.length).toBeGreaterThanOrEqual(8);
    });

    it('every scenario has posture and recovery', () => {
      for (const s of P13_DEGRADED_SCENARIOS) {
        expect(s.scenario).toBeTruthy();
        expect(s.posture).toBeTruthy();
        expect(s.recovery).toBeTruthy();
      }
    });

    it('covers facilitator disconnect', () => {
      const facScenario = P13_DEGRADED_SCENARIOS.find((s) => s.scenario.includes('Facilitator'));
      expect(facScenario).toBeTruthy();
      expect(facScenario!.posture).toContain('paused');
    });

    it('covers AI service unavailable', () => {
      const aiScenario = P13_DEGRADED_SCENARIOS.find((s) => s.scenario.includes('AI'));
      expect(aiScenario).toBeTruthy();
    });

    it('covers permission denied', () => {
      const permScenario = P13_DEGRADED_SCENARIOS.find((s) => s.scenario.includes('Permission'));
      expect(permScenario).toBeTruthy();
    });
  });

  // ─── Acceptance checklist ────────────────────────────────────

  describe('P13_ACCEPTANCE_CHECKLIST', () => {
    it('has exactly 10 items', () => {
      expect(P13_ACCEPTANCE_CHECKLIST).toHaveLength(10);
    });

    it('all items are testable', () => {
      for (const item of P13_ACCEPTANCE_CHECKLIST) {
        expect(item.testable).toBe(true);
      }
    });

    it('all items have unique IDs', () => {
      const ids = P13_ACCEPTANCE_CHECKLIST.map((c) => c.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('covers toolbelt (AC-01)', () => {
      const ac01 = P13_ACCEPTANCE_CHECKLIST.find((c) => c.id === 'P13-AC-01');
      expect(ac01!.requirement).toContain('toolbelt');
    });

    it('covers facilitation (AC-02)', () => {
      const ac02 = P13_ACCEPTANCE_CHECKLIST.find((c) => c.id === 'P13-AC-02');
      expect(ac02!.requirement).toContain('Facilitation');
    });

    it('covers AI co-building (AC-05)', () => {
      const ac05 = P13_ACCEPTANCE_CHECKLIST.find((c) => c.id === 'P13-AC-05');
      expect(ac05!.requirement).toContain('AI');
    });
  });

  // ─── Ownership ───────────────────────────────────────────────

  describe('P13_OWNERSHIP', () => {
    it('declares owner', () => {
      expect(P13_OWNERSHIP.owner).toContain('Whiteboard');
    });

    it('lists infrastructure dependencies', () => {
      expect(P13_OWNERSHIP.infrastructure.length).toBeGreaterThanOrEqual(3);
      expect(P13_OWNERSHIP.infrastructure.some((i) => i.includes('toolCollaborationAdapter'))).toBe(true);
    });

    it('includes Facilitation Engine as consumer', () => {
      expect(P13_OWNERSHIP.consumers).toContain('Facilitation Engine');
    });
  });
});
