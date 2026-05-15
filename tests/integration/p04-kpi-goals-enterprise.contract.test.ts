/**
 * P04-E/F/G/H: KPI Goals/Scorecards + Enterprise surfaces contract tests
 *
 * Verifies that the canonical exports and types required by the extended P04
 * contract (goals API, enterprise services, unified degraded states, extended
 * permission matrix, and extended acceptance checklist) are consistent.
 */
import { describe, expect, it } from 'vitest';

import {
  KPI_WORKFLOW_STATES,
  KPI_WORKFLOW_DEGRADED_REASONS,
  KPI_DEGRADED_POSTURE_VALUES,
  KPI_PERMISSION_MATRIX,
  P04_ACCEPTANCE_CHECKLIST,
  LINKAGE_PATTERNS,
  KPI_ANTI_DUPLICATE_RULES,
} from '../../server/src/services/v8/kpiWorkflowCanon.js';

import {
  KpiWorkflowDegradedReasonValues,
} from '../../server/src/services/v8/resultsROIService.js';

describe('P04 Extended Contract — Goals, Enterprise & Unified Canon', () => {
  describe('Unified degraded state system', () => {
    it('KPI_WORKFLOW_DEGRADED_REASONS is the canonical source', () => {
      expect(KPI_WORKFLOW_DEGRADED_REASONS).toHaveLength(4);
      expect([...KPI_WORKFLOW_DEGRADED_REASONS]).toEqual([
        'missing_data', 'discrepancy_unresolved',
        'linkage_unavailable', 'permission_denied',
      ]);
    });

    it('KpiWorkflowDegradedReasonValues re-exports from canon', () => {
      expect(KpiWorkflowDegradedReasonValues).toBe(KPI_WORKFLOW_DEGRADED_REASONS);
    });

    it('KPI_DEGRADED_POSTURE_VALUES is superset including nominal and stale_data', () => {
      expect(KPI_DEGRADED_POSTURE_VALUES).toHaveLength(6);
      for (const reason of KPI_WORKFLOW_DEGRADED_REASONS) {
        expect(KPI_DEGRADED_POSTURE_VALUES).toContain(reason);
      }
      expect(KPI_DEGRADED_POSTURE_VALUES).toContain('nominal');
      expect(KPI_DEGRADED_POSTURE_VALUES).toContain('stale_data');
    });
  });

  describe('Extended KPI_PERMISSION_MATRIX', () => {
    it('includes original core actions', () => {
      expect(KPI_PERMISSION_MATRIX).toHaveProperty('edit_definition');
      expect(KPI_PERMISSION_MATRIX).toHaveProperty('edit_targets');
      expect(KPI_PERMISSION_MATRIX).toHaveProperty('view');
      expect(KPI_PERMISSION_MATRIX).toHaveProperty('comment');
      expect(KPI_PERMISSION_MATRIX).toHaveProperty('create_signal');
      expect(KPI_PERMISSION_MATRIX).toHaveProperty('create_next_action');
      expect(KPI_PERMISSION_MATRIX).toHaveProperty('manage_reconciliation');
    });

    it('includes new P04-extended actions', () => {
      expect(KPI_PERMISSION_MATRIX).toHaveProperty('delete_kpi');
      expect(KPI_PERMISSION_MATRIX).toHaveProperty('record_measurement');
      expect(KPI_PERMISSION_MATRIX).toHaveProperty('create_report');
      expect(KPI_PERMISSION_MATRIX).toHaveProperty('manage_deviation');
    });

    it('viewer cannot perform any write action', () => {
      const writeActions = [
        'edit_definition', 'edit_targets', 'delete_kpi',
        'record_measurement', 'create_report', 'manage_deviation',
        'create_signal', 'create_next_action', 'manage_reconciliation',
      ];
      for (const action of writeActions) {
        expect(KPI_PERMISSION_MATRIX[action]).not.toContain('viewer');
      }
    });

    it('viewer can view', () => {
      expect(KPI_PERMISSION_MATRIX.view).toContain('viewer');
    });
  });

  describe('P04_ACCEPTANCE_CHECKLIST — 21 items', () => {
    it('has exactly 21 items', () => {
      expect(P04_ACCEPTANCE_CHECKLIST).toHaveLength(21);
    });

    it('item IDs are sequential 1-21', () => {
      const ids = P04_ACCEPTANCE_CHECKLIST.map(c => c.id);
      expect(ids).toEqual(Array.from({ length: 21 }, (_, i) => i + 1));
    });

    it('covers P04-D items (13-16)', () => {
      const dItems = P04_ACCEPTANCE_CHECKLIST.filter(c => c.section === 'P04-D');
      expect(dItems).toHaveLength(4);
    });

    it('covers P04-E items (17-18)', () => {
      const eItems = P04_ACCEPTANCE_CHECKLIST.filter(c => c.section === 'P04-E');
      expect(eItems).toHaveLength(2);
    });

    it('covers P04-F item (19)', () => {
      const fItems = P04_ACCEPTANCE_CHECKLIST.filter(c => c.section === 'P04-F');
      expect(fItems).toHaveLength(1);
    });

    it('covers P04-G item (20)', () => {
      const gItems = P04_ACCEPTANCE_CHECKLIST.filter(c => c.section === 'P04-G');
      expect(gItems).toHaveLength(1);
    });

    it('covers P04-H item (21)', () => {
      const hItems = P04_ACCEPTANCE_CHECKLIST.filter(c => c.section === 'P04-H');
      expect(hItems).toHaveLength(1);
    });
  });

  describe('KPI_WORKFLOW_STATES — full list', () => {
    it('has exactly 6 canonical states', () => {
      expect(KPI_WORKFLOW_STATES).toHaveLength(6);
    });

    it('starts with signal_detected and ends with resolved', () => {
      expect(KPI_WORKFLOW_STATES[0]).toBe('signal_detected');
      expect(KPI_WORKFLOW_STATES[KPI_WORKFLOW_STATES.length - 1]).toBe('resolved');
    });
  });

  describe('Anti-duplicate rules', () => {
    it('has exactly 4 rules', () => {
      expect(Object.keys(KPI_ANTI_DUPLICATE_RULES)).toHaveLength(4);
    });
  });

  describe('Linkage patterns', () => {
    it('has exactly 4 patterns', () => {
      expect(LINKAGE_PATTERNS).toHaveLength(4);
    });
  });
});
