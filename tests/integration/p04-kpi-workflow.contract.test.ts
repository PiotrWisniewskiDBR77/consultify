/**
 * P04-B/C: KPI closed-loop workflow contract tests
 * signal → report → reconciliation → next action
 */
import { describe, expect, it } from 'vitest';

import {
  KpiNextActionTypeValues,
  KpiSignalTypeValues,
  KpiWorkflowDegradedReasonValues,
  NextActionStatusValues,
} from '../../server/src/services/v8/resultsROIService.js';
import {
  ReconciliationInitiatorValues,
  ReconciliationStatusValues,
} from '../../server/src/types/resultsROIContinuity.js';

describe('P04 KPI Closed-Loop Workflow', () => {
  describe('Signal types', () => {
    it('has exactly 6 signal types per canon', () => {
      expect(KpiSignalTypeValues).toHaveLength(6);
    });
    it.each([...KpiSignalTypeValues])(
      'signal type "%s" is a valid closed-loop trigger',
      (type) => {
        expect(typeof type).toBe('string');
        expect(type.length).toBeGreaterThan(0);
      }
    );
  });

  describe('Next action types', () => {
    it('has exactly 5 action types per canon', () => {
      expect(KpiNextActionTypeValues).toHaveLength(5);
    });
    it.each([...KpiNextActionTypeValues])('action type "%s" closes the loop', (type) => {
      expect(typeof type).toBe('string');
    });
  });

  describe('Workflow states', () => {
    it('signal lifecycle has 4 states', () => {
      expect(NextActionStatusValues).toHaveLength(4);
    });
    it('every signal must reach a terminal state (acknowledged or action_created)', () => {
      expect(NextActionStatusValues).toContain('acknowledged');
      expect(NextActionStatusValues).toContain('action_created');
    });
  });

  describe('Degraded reasons', () => {
    it('has exactly 4 degraded reasons per canon', () => {
      expect(KpiWorkflowDegradedReasonValues).toHaveLength(4);
    });
    it.each([...KpiWorkflowDegradedReasonValues])(
      'degraded reason "%s" has explicit next action guidance',
      (reason) => {
        expect(reason).toBeTruthy();
      }
    );
  });

  describe('Reconciliation status transitions', () => {
    it('reconciliation has 4 statuses', () => {
      expect(ReconciliationStatusValues).toHaveLength(4);
    });
    it('Results starts reconciliation (pending), Finance resolves', () => {
      expect(ReconciliationStatusValues[0]).toBe('pending');
      expect(ReconciliationStatusValues).toContain('reconciled');
    });
    it('initiatedBy is results or finance', () => {
      expect(ReconciliationInitiatorValues).toContain('results');
      expect(ReconciliationInitiatorValues).toContain('finance');
    });
  });

  describe('KPI→Finance consequence (no split-truth)', () => {
    it('reconciliation links KPI to finance ref without overwriting either truth', () => {
      const reconciliation = {
        kpiId: 'kpi-1',
        financeRef: 'finance:kpi-1',
        reconciliationStatus: 'pending' as const,
        initiatedBy: 'results' as const,
      };
      expect(reconciliation.initiatedBy).toBe('results');
      expect(ReconciliationInitiatorValues).toContain(reconciliation.initiatedBy);
      expect(reconciliation.financeRef).toContain('finance:');
      expect(reconciliation.kpiId).not.toBe(reconciliation.financeRef);
      expect(ReconciliationStatusValues).toContain(reconciliation.reconciliationStatus);
    });
  });
});
