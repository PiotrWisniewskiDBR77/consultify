import { describe, expect, it } from 'vitest';

import {
  evaluateHandoff,
  moduleForStatus,
  handoffBoundary,
  type HandoffPayload,
} from '../../../server/src/services/initiative/stageHandoffService.js';

const READY: HandoffPayload = {
  hasDates: true,
  hasMilestone: true,
  hasKpi: true,
  hasOwner: true,
};

describe('stageHandoffService (Uspójnienie F2.1)', () => {
  // ============================================
  // evaluateHandoff
  // ============================================
  describe('evaluateHandoff — VALID_TRANSITIONS guard', () => {
    it('blocks a transition not present in VALID_TRANSITIONS', () => {
      const r = evaluateHandoff('DRAFT', 'EXECUTING');
      expect(r.allowed).toBe(false);
      expect(r.reasons.join(' ')).toMatch(/VALID_TRANSITIONS/);
    });

    it('blocks an unknown source status', () => {
      const r = evaluateHandoff('NONSENSE', 'DRAFT');
      expect(r.allowed).toBe(false);
      expect(r.reasons.join(' ')).toMatch(/Unknown source status/);
    });

    it('allows a simple valid transition with no readiness contract', () => {
      // DRAFT → PENDING_REVIEW has no readiness gate
      const r = evaluateHandoff('DRAFT', 'PENDING_REVIEW');
      expect(r.allowed).toBe(true);
      expect(r.reasons).toEqual([]);
      expect(r.missing).toEqual([]);
    });

    it('is case-insensitive on status input', () => {
      const r = evaluateHandoff('draft', 'pending_review');
      expect(r.allowed).toBe(true);
    });
  });

  describe('evaluateHandoff — ready-for-execution contract (→SCHEDULED)', () => {
    it('allows APPROVED → SCHEDULED when full contract met', () => {
      const r = evaluateHandoff('APPROVED', 'SCHEDULED', READY);
      expect(r.allowed).toBe(true);
      expect(r.missing).toEqual([]);
    });

    it('blocks APPROVED → SCHEDULED listing every missing readiness item', () => {
      const r = evaluateHandoff('APPROVED', 'SCHEDULED', {});
      expect(r.allowed).toBe(false);
      expect(r.missing).toEqual(['hasDates', 'hasMilestone', 'hasKpi', 'hasOwner']);
      expect(r.reasons.join(' ')).toMatch(/Ready-for-execution/);
    });

    it('blocks when only one readiness item is missing', () => {
      const r = evaluateHandoff('APPROVED', 'SCHEDULED', { ...READY, hasKpi: false });
      expect(r.allowed).toBe(false);
      expect(r.missing).toEqual(['hasKpi']);
    });
  });

  describe('evaluateHandoff — ready-for-execution contract (→EXECUTING)', () => {
    it('allows SCHEDULED → EXECUTING when full contract met', () => {
      const r = evaluateHandoff('SCHEDULED', 'EXECUTING', READY);
      expect(r.allowed).toBe(true);
    });

    it('blocks SCHEDULED → EXECUTING when contract missing', () => {
      const r = evaluateHandoff('SCHEDULED', 'EXECUTING', { hasDates: true });
      expect(r.allowed).toBe(false);
      expect(r.missing).toContain('hasMilestone');
      expect(r.missing).toContain('hasKpi');
      expect(r.missing).toContain('hasOwner');
    });
  });

  describe('evaluateHandoff — closure contract (→TRACKING)', () => {
    it('allows DONE → TRACKING when gateApproved', () => {
      const r = evaluateHandoff('DONE', 'TRACKING', { gateApproved: true });
      expect(r.allowed).toBe(true);
      expect(r.missing).toEqual([]);
    });

    it('blocks DONE → TRACKING without gateApproved', () => {
      const r = evaluateHandoff('DONE', 'TRACKING', {});
      expect(r.allowed).toBe(false);
      expect(r.missing).toEqual(['gateApproved']);
      expect(r.reasons.join(' ')).toMatch(/Closure gate/);
    });
  });

  // ============================================
  // moduleForStatus
  // ============================================
  describe('moduleForStatus', () => {
    it('maps draft-phase statuses to tools', () => {
      expect(moduleForStatus('DRAFT')).toBe('tools');
      expect(moduleForStatus('PENDING_REVIEW')).toBe('tools');
    });

    it('maps planning statuses to initiatives', () => {
      expect(moduleForStatus('REVIEW')).toBe('initiatives');
      expect(moduleForStatus('PROMOTED')).toBe('initiatives');
      expect(moduleForStatus('APPROVED')).toBe('initiatives');
    });

    it('maps SCHEDULED to execution (ready-for-execution boundary)', () => {
      expect(moduleForStatus('SCHEDULED')).toBe('execution');
    });

    it('maps execution statuses to execution', () => {
      expect(moduleForStatus('EXECUTING')).toBe('execution');
      expect(moduleForStatus('BLOCKED')).toBe('execution');
      expect(moduleForStatus('DONE')).toBe('execution');
    });

    it('maps TRACKING to benefits (results)', () => {
      expect(moduleForStatus('TRACKING')).toBe('benefits');
    });

    it('maps terminal statuses to terminal', () => {
      expect(moduleForStatus('CANCELLED')).toBe('terminal');
      expect(moduleForStatus('ARCHIVED')).toBe('terminal');
    });

    it('returns unknown for garbage', () => {
      expect(moduleForStatus('XYZ')).toBe('unknown');
    });
  });

  // ============================================
  // handoffBoundary — 5 granic
  // ============================================
  describe('handoffBoundary — 5 boundaries', () => {
    it('1) analysis_to_initiative (PENDING_REVIEW → REVIEW)', () => {
      expect(handoffBoundary('PENDING_REVIEW', 'REVIEW')).toBe('analysis_to_initiative');
    });

    it('2) initiative_to_execution (APPROVED → SCHEDULED)', () => {
      expect(handoffBoundary('APPROVED', 'SCHEDULED')).toBe('initiative_to_execution');
    });

    it('3) execution_to_results (DONE → TRACKING)', () => {
      expect(handoffBoundary('DONE', 'TRACKING')).toBe('execution_to_results');
    });

    it('4) results_to_finance (TRACKING → ARCHIVED)', () => {
      expect(handoffBoundary('TRACKING', 'ARCHIVED')).toBe('results_to_finance');
    });

    it('5) within_module (REVIEW → PROMOTED both in initiatives)', () => {
      expect(handoffBoundary('REVIEW', 'PROMOTED')).toBe('within_module');
    });

    it('returns unknown when a status has no module', () => {
      expect(handoffBoundary('XYZ', 'DRAFT')).toBe('unknown');
    });
  });
});
