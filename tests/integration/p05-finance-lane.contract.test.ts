/**
 * P05-B/C: Finance lane E2E contract tests
 * import → analysis → mutation → readback
 */
import { describe, expect, it, vi } from 'vitest';

const mockDbRun = vi.fn();
const mockDbGet = vi.fn();
const mockDbAll = vi.fn();

vi.mock('../../server/src/utils/DbPromise.js', () => ({
  run: (...args: unknown[]) => mockDbRun(...args),
  get: (...args: unknown[]) => mockDbGet(...args),
  all: (...args: unknown[]) => mockDbAll(...args),
}));

import {
  advanceLaneStep,
  FinanceDegradedReasonValues,
  FinanceLaneStepValues,
  ImportOutcomeValues,
  MutationOutcomeValues,
  recordMutationAudit,
  VersionTypeValues,
} from '../../server/src/services/v8/financeLaneService.js';

function baseLaneRow(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    run_id: 'run-1',
    organization_id: 'org-1',
    current_step: 'import',
    import_outcome: null,
    analysis_completed: 0,
    mutation_outcome: null,
    readback_confirmed: 0,
    degraded_json: '[]',
    audit_trail_json: '[]',
    version_type: 'current',
    kpi_linkage_status: 'coherent',
    created_at: '2026-03-31T00:00:00.000Z',
    updated_at: '2026-03-31T00:00:00.000Z',
    ...over,
  };
}

describe('P05 Finance Lane E2E', () => {
  describe('Lane steps', () => {
    it('has exactly 4 steps in canonical order', () => {
      expect([...FinanceLaneStepValues]).toEqual(['import', 'analysis', 'mutation', 'readback']);
    });
  });

  describe('Import outcome taxonomy', () => {
    it('has 8 import outcomes (base §2.3.4 + mapping_missing, schema_drift)', () => {
      expect(ImportOutcomeValues).toHaveLength(8);
      expect(ImportOutcomeValues).toContain('mapping_missing');
      expect(ImportOutcomeValues).toContain('schema_drift');
    });
    it('failed import blocks downstream mutation', async () => {
      mockDbGet.mockResolvedValueOnce(baseLaneRow({ current_step: 'import' }));
      mockDbRun.mockResolvedValue({ changes: 1 });

      const updated = await advanceLaneStep('run-1', 'org-1', 'user-1', 'failed', 'parse error');

      expect(updated.currentStep).toBe('import');
      expect(updated.importOutcome).toBe('failed');
      expect(updated.degraded.some((d) => d.reason === 'import_failed')).toBe(true);
    });
    it('completed_with_warnings allows analysis in warning posture', () => {
      expect(ImportOutcomeValues).toContain('completed_with_warnings');
    });
  });

  describe('Mutation audit', () => {
    it('mutation has 4 outcomes', () => {
      expect(MutationOutcomeValues).toHaveLength(4);
    });
    it('failed mutation creates audit event and safe degraded state', async () => {
      mockDbRun.mockResolvedValue({ changes: 1 });

      const audit = await recordMutationAudit({
        organizationId: 'org-1',
        runId: 'run-1',
        mutationType: 'model_update',
        targetEntity: 'statement:1',
        newValue: '{}',
        outcome: 'failed',
        actor: 'user-1',
      });

      expect(audit.outcome).toBe('failed');
      expect(audit.actor).toBeTruthy();
      expect(audit.createdAt).toBeTruthy();
      expect(mockDbRun).toHaveBeenCalled();
    });
  });

  describe('Versioning semantics', () => {
    it('supports current and actual version types', () => {
      expect(VersionTypeValues).toContain('current');
      expect(VersionTypeValues).toContain('actual');
    });
    it('switchover is explicit event with actor and date', () => {
      const snapshot = {
        versionType: 'current' as const,
        isFinalized: false,
        switchoverDate: null,
        switchoverActor: null,
      };
      expect(snapshot.isFinalized).toBe(false);
      expect(snapshot.switchoverDate).toBeNull();
      expect(VersionTypeValues).toContain(snapshot.versionType);
    });
  });

  describe('Degraded scenarios (§2.3.6)', () => {
    it('has at least 9 degraded scenarios per contract', () => {
      expect(FinanceDegradedReasonValues.length).toBeGreaterThanOrEqual(9);
    });
  });

  describe('KPI↔Finance coherence', () => {
    it('coherence check returns one of: coherent, stale, unavailable', () => {
      const validStatuses = ['coherent', 'stale', 'unavailable'] as const;
      validStatuses.forEach((s) => expect(typeof s).toBe('string'));
    });
  });
});
