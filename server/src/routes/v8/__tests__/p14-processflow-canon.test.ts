/**
 * P14 Process Flow Canon — Unit + contract tests.
 *
 * Covers: semantic object types, BPMN interop posture, validation layers,
 * toolbelt, AI proposal rules, anti-duplicate gate, degraded scenarios,
 * acceptance checklist, and helper functions.
 */
import { describe, expect, it } from 'vitest';

import {
  isValidMessageFlow,
  isValidProcessFlowTool,
  isValidSemanticObject,
  P14_ACCEPTANCE_CHECKLIST,
  P14_AI_PROPOSAL_RULES,
  P14_ANTI_DUPLICATE_RULES,
  P14_BPMN_INTEROP_POSTURE,
  P14_DEGRADED_SCENARIOS,
  P14_NODE_KINDS_MAPPING,
  P14_OWNERSHIP,
  P14_SEMANTIC_OBJECT_RULES,
  P14_SEMANTIC_OBJECTS,
  P14_TOOLBELT,
  P14_TOOLBELT_RULES,
  P14_VALIDATION_LAYERS,
  P14_VALIDATION_RULES,
  validateSemanticRule,
} from '../../../services/v8/processFlowCanon.js';

describe('P14 Process Flow Canon', () => {
  // ─── Semantic object types ────────────────────────────────────

  describe('P14_SEMANTIC_OBJECTS', () => {
    it('contains exactly 11 semantic object types', () => {
      expect(P14_SEMANTIC_OBJECTS).toHaveLength(11);
    });

    it('includes all required BPMN-adjacent types', () => {
      const required = [
        'start_event',
        'end_event',
        'task',
        'decision_gateway',
        'parallel_gateway',
        'subprocess',
        'lane',
        'pool',
        'sequence_flow',
        'message_flow',
        'annotation',
      ];
      for (const obj of required) {
        expect(P14_SEMANTIC_OBJECTS).toContain(obj);
      }
    });
  });

  describe('P14_SEMANTIC_OBJECT_RULES', () => {
    it('has a rule for every semantic object', () => {
      for (const obj of P14_SEMANTIC_OBJECTS) {
        expect(P14_SEMANTIC_OBJECT_RULES[obj]).toBeTruthy();
      }
    });

    it('start_event has no incoming flows rule', () => {
      expect(P14_SEMANTIC_OBJECT_RULES.start_event).toContain('no incoming');
    });

    it('end_event has no outgoing flows rule', () => {
      expect(P14_SEMANTIC_OBJECT_RULES.end_event).toContain('no outgoing');
    });

    it('message_flow cannot connect within same pool', () => {
      expect(P14_SEMANTIC_OBJECT_RULES.message_flow).toContain('between pools');
    });
  });

  describe('isValidSemanticObject', () => {
    it('returns true for valid objects', () => {
      expect(isValidSemanticObject('task')).toBe(true);
      expect(isValidSemanticObject('start_event')).toBe(true);
      expect(isValidSemanticObject('lane')).toBe(true);
    });

    it('returns false for invalid objects', () => {
      expect(isValidSemanticObject('timer_event')).toBe(false);
      expect(isValidSemanticObject('')).toBe(false);
      expect(isValidSemanticObject('bpmn_signal')).toBe(false);
    });
  });

  describe('P14_NODE_KINDS_MAPPING', () => {
    it('maps step to task', () => {
      expect(P14_NODE_KINDS_MAPPING.step).toBe('task');
    });

    it('maps decision to decision_gateway', () => {
      expect(P14_NODE_KINDS_MAPPING.decision).toBe('decision_gateway');
    });

    it('maps lane to lane', () => {
      expect(P14_NODE_KINDS_MAPPING.lane).toBe('lane');
    });
  });

  // ─── BPMN interoperability posture ────────────────────────────

  describe('P14_BPMN_INTEROP_POSTURE', () => {
    it('has supported items', () => {
      expect(P14_BPMN_INTEROP_POSTURE.supported.length).toBeGreaterThan(0);
    });

    it('has non-goal items', () => {
      expect(P14_BPMN_INTEROP_POSTURE.nonGoal.length).toBeGreaterThan(0);
    });

    it('declares BPMN-adjacent posture', () => {
      expect(P14_BPMN_INTEROP_POSTURE.posture).toContain('BPMN-adjacent');
    });

    it('non-goals include full BPMN compliance', () => {
      expect(P14_BPMN_INTEROP_POSTURE.nonGoal.some((ng) => ng.includes('Full BPMN'))).toBe(true);
    });

    it('non-goals include execution engine', () => {
      expect(P14_BPMN_INTEROP_POSTURE.nonGoal.some((ng) => ng.includes('execution engine'))).toBe(
        true
      );
    });

    it('supported includes visual semantics alignment', () => {
      expect(P14_BPMN_INTEROP_POSTURE.supported.some((s) => s.includes('Visual semantics'))).toBe(
        true
      );
    });
  });

  // ─── Validation layering ─────────────────────────────────────

  describe('P14_VALIDATION_LAYERS', () => {
    it('has 2 layers in order', () => {
      expect(P14_VALIDATION_LAYERS).toEqual(['semantic_first', 'structural_bounded']);
    });
  });

  describe('P14_VALIDATION_RULES', () => {
    it('semantic_first has rules array', () => {
      expect(P14_VALIDATION_RULES.semantic_first.rules.length).toBeGreaterThan(0);
    });

    it('structural_bounded has rules array', () => {
      expect(P14_VALIDATION_RULES.structural_bounded.rules.length).toBeGreaterThan(0);
    });

    it('semantic rules include start_event constraint', () => {
      expect(P14_VALIDATION_RULES.semantic_first.rules.some((r) => r.includes('start_event'))).toBe(
        true
      );
    });

    it('structural rules include orphan check', () => {
      expect(P14_VALIDATION_RULES.structural_bounded.rules.some((r) => r.includes('orphan'))).toBe(
        true
      );
    });

    it('structural rules include nesting depth limit', () => {
      expect(
        P14_VALIDATION_RULES.structural_bounded.rules.some((r) => r.includes('nesting depth'))
      ).toBe(true);
    });
  });

  describe('validateSemanticRule', () => {
    it('validates start_event with no incoming flows', () => {
      const result = validateSemanticRule('start_event', 0, 1);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects start_event with incoming flows', () => {
      const result = validateSemanticRule('start_event', 1, 1);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('start_event');
    });

    it('validates end_event with no outgoing flows', () => {
      const result = validateSemanticRule('end_event', 1, 0);
      expect(result.valid).toBe(true);
    });

    it('rejects end_event with outgoing flows', () => {
      const result = validateSemanticRule('end_event', 1, 1);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('end_event');
    });

    it('validates decision_gateway with 2+ outgoing flows', () => {
      const result = validateSemanticRule('decision_gateway', 1, 3);
      expect(result.valid).toBe(true);
    });

    it('rejects decision_gateway with less than 2 outgoing flows', () => {
      const result = validateSemanticRule('decision_gateway', 1, 1);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('decision_gateway');
    });

    it('validates task with any flow count', () => {
      const result = validateSemanticRule('task', 2, 1);
      expect(result.valid).toBe(true);
    });
  });

  // ─── Toolbelt ─────────────────────────────────────────────────

  describe('P14_TOOLBELT', () => {
    it('contains exactly 10 tools', () => {
      expect(P14_TOOLBELT).toHaveLength(10);
    });

    it('includes validate tool', () => {
      expect(P14_TOOLBELT).toContain('validate');
    });

    it('includes connector tool', () => {
      expect(P14_TOOLBELT).toContain('connector');
    });

    it('includes auto_layout tool', () => {
      expect(P14_TOOLBELT).toContain('auto_layout');
    });
  });

  describe('P14_TOOLBELT_RULES', () => {
    it('has a rule for every tool', () => {
      for (const tool of P14_TOOLBELT) {
        expect(P14_TOOLBELT_RULES[tool]).toBeTruthy();
      }
    });

    it('validate rule mentions inline results', () => {
      expect(P14_TOOLBELT_RULES.validate).toContain('inline');
    });

    it('connector rule mentions auto-routing', () => {
      expect(P14_TOOLBELT_RULES.connector).toContain('auto-routing');
    });
  });

  describe('isValidProcessFlowTool', () => {
    it('returns true for valid tools', () => {
      expect(isValidProcessFlowTool('select')).toBe(true);
      expect(isValidProcessFlowTool('validate')).toBe(true);
    });

    it('returns false for invalid tools', () => {
      expect(isValidProcessFlowTool('eraser')).toBe(false);
      expect(isValidProcessFlowTool('')).toBe(false);
    });
  });

  // ─── AI proposal rules ───────────────────────────────────────

  describe('P14_AI_PROPOSAL_RULES', () => {
    it('supports text or DSL input', () => {
      expect(P14_AI_PROPOSAL_RULES.textOrDslInput).toContain('text');
      expect(P14_AI_PROPOSAL_RULES.textOrDslInput).toContain('DSL');
    });

    it('requires preview before apply', () => {
      expect(P14_AI_PROPOSAL_RULES.previewBeforeApply).toContain('preview');
    });

    it('requires explicit apply/reject', () => {
      expect(P14_AI_PROPOSAL_RULES.explicitApplyReject).toContain('explicitly');
    });

    it('forbids silent changes', () => {
      expect(P14_AI_PROPOSAL_RULES.noSilentChanges).toContain('preview→apply');
    });

    it('runs validation on apply', () => {
      expect(P14_AI_PROPOSAL_RULES.validationOnApply).toContain('validation');
    });
  });

  // ─── Anti-duplicate gate ─────────────────────────────────────

  describe('P14_ANTI_DUPLICATE_RULES', () => {
    it('prevents parallel process model', () => {
      expect(P14_ANTI_DUPLICATE_RULES.noParallelProcessModel).toContain('CanonicalNode');
    });

    it('prevents BPMN runtime', () => {
      expect(P14_ANTI_DUPLICATE_RULES.noBpmnRuntime).toContain('visual modeling');
    });

    it('enforces single semantic truth', () => {
      expect(P14_ANTI_DUPLICATE_RULES.singleSemanticTruth).toContain('P14_SEMANTIC_OBJECTS');
    });
  });

  // ─── Message flow validation ──────────────────────────────────

  describe('isValidMessageFlow', () => {
    it('allows message flow between different pools', () => {
      const result = isValidMessageFlow('pool-a', 'pool-b');
      expect(result.valid).toBe(true);
    });

    it('rejects message flow within same pool', () => {
      const result = isValidMessageFlow('pool-a', 'pool-a');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('same pool');
    });

    it('rejects message flow with null source pool', () => {
      const result = isValidMessageFlow(null, 'pool-b');
      expect(result.valid).toBe(false);
    });

    it('rejects message flow with null target pool', () => {
      const result = isValidMessageFlow('pool-a', null);
      expect(result.valid).toBe(false);
    });
  });

  // ─── Degraded scenarios ──────────────────────────────────────

  describe('P14_DEGRADED_SCENARIOS', () => {
    it('has at least 10 scenarios', () => {
      expect(P14_DEGRADED_SCENARIOS.length).toBeGreaterThanOrEqual(10);
    });

    it('every scenario has posture and recovery', () => {
      for (const s of P14_DEGRADED_SCENARIOS) {
        expect(s.scenario).toBeTruthy();
        expect(s.posture).toBeTruthy();
        expect(s.recovery).toBeTruthy();
      }
    });

    it('covers validation service error', () => {
      const valScenario = P14_DEGRADED_SCENARIOS.find((s) => s.scenario.includes('Validation'));
      expect(valScenario).toBeTruthy();
    });

    it('covers auto-layout failure', () => {
      const layoutScenario = P14_DEGRADED_SCENARIOS.find((s) => s.scenario.includes('Auto-layout'));
      expect(layoutScenario).toBeTruthy();
    });

    it('covers subprocess nesting limit', () => {
      const nestingScenario = P14_DEGRADED_SCENARIOS.find((s) => s.scenario.includes('nesting'));
      expect(nestingScenario).toBeTruthy();
    });

    it('covers AI service unavailable', () => {
      const aiScenario = P14_DEGRADED_SCENARIOS.find((s) => s.scenario.includes('AI'));
      expect(aiScenario).toBeTruthy();
    });

    it('covers permission denied', () => {
      const permScenario = P14_DEGRADED_SCENARIOS.find((s) => s.scenario.includes('Permission'));
      expect(permScenario).toBeTruthy();
    });
  });

  // ─── Acceptance checklist ────────────────────────────────────

  describe('P14_ACCEPTANCE_CHECKLIST', () => {
    it('has exactly 10 items', () => {
      expect(P14_ACCEPTANCE_CHECKLIST).toHaveLength(10);
    });

    it('all items are testable', () => {
      for (const item of P14_ACCEPTANCE_CHECKLIST) {
        expect(item.testable).toBe(true);
      }
    });

    it('all items have unique IDs', () => {
      const ids = P14_ACCEPTANCE_CHECKLIST.map((c) => c.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('covers semantic objects (AC-02)', () => {
      const ac02 = P14_ACCEPTANCE_CHECKLIST.find((c) => c.id === 'P14-AC-02');
      expect(ac02!.requirement).toContain('Semantic object types');
    });

    it('covers BPMN interop (AC-03)', () => {
      const ac03 = P14_ACCEPTANCE_CHECKLIST.find((c) => c.id === 'P14-AC-03');
      expect(ac03!.requirement).toContain('BPMN');
    });

    it('covers validation layering (AC-04)', () => {
      const ac04 = P14_ACCEPTANCE_CHECKLIST.find((c) => c.id === 'P14-AC-04');
      expect(ac04!.requirement).toContain('Validation');
    });

    it('covers AI proposal (AC-06)', () => {
      const ac06 = P14_ACCEPTANCE_CHECKLIST.find((c) => c.id === 'P14-AC-06');
      expect(ac06!.requirement).toContain('AI');
    });
  });

  // ─── Ownership ───────────────────────────────────────────────

  describe('P14_OWNERSHIP', () => {
    it('declares owner', () => {
      expect(P14_OWNERSHIP.owner).toContain('Process Flow');
    });

    it('lists infrastructure dependencies', () => {
      expect(P14_OWNERSHIP.infrastructure.length).toBeGreaterThanOrEqual(3);
    });

    it('includes Validation Engine as consumer', () => {
      expect(P14_OWNERSHIP.consumers).toContain('Validation Engine');
    });
  });
});
