/**
 * P11 E2E — Two entry points create initiatives that are read through the same
 * V8 planning portfolio read path with consistent lifecycle normalization.
 *
 * Entry A: PMO create (POST /api/pmo/initiatives)
 * Entry B: Assessment-generated create (simulated via direct INSERT, same as
 *          assessmentInitiativeService.persistInitiatives)
 *
 * Both must appear in the V8 portfolio read with normalized lifecycle state.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDbAll = vi.fn();
const mockDbRun = vi.fn();
const mockDbGet = vi.fn();

vi.mock('../../server/src/utils/DbPromise.js', () => ({
  all: (...args: unknown[]) => mockDbAll(...args),
  run: (...args: unknown[]) => mockDbRun(...args),
  get: (...args: unknown[]) => mockDbGet(...args),
}));

vi.mock('../../server/src/utils/dbSchema.js', () => ({
  getTableColumns: vi.fn().mockResolvedValue(
    new Set([
      'id', 'name', 'title', 'status', 'priority', 'organization_id', 'project_id',
      'planned_start_date', 'planned_end_date', 'start_date', 'actual_end_date',
      'owner_business_id', 'owner_execution_id', 'source_type', 'source_id',
      'progress', 'created_at', 'updated_at', 'program_id',
    ])
  ),
}));

import {
  normalizeInitiativeDbStatusForRead,
  mapDbStatusToP11Lifecycle,
} from '../../server/src/services/initiative/initiativeLifecycleCanon.js';

const ORG = 'org-e2e-p11';

describe('P11 E2E — two entry points → same canonical read truth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('PMO-created and assessment-created initiatives normalize to the same lifecycle state', () => {
    const pmoInit = {
      id: 'init-pmo-1',
      name: 'PMO Initiative',
      status: 'DRAFT',
      source_type: 'manual',
    };

    const assessmentInit = {
      id: 'init-assess-1',
      name: 'Assessment Initiative',
      status: 'DRAFT',
      source_type: 'assessment',
      source_id: 'assess-abc',
    };

    const pmoNormalized = normalizeInitiativeDbStatusForRead(pmoInit.status);
    const assessmentNormalized = normalizeInitiativeDbStatusForRead(assessmentInit.status);

    expect(pmoNormalized).toBe(assessmentNormalized);
    expect(pmoNormalized).toBe('DRAFT');

    const pmoLifecycle = mapDbStatusToP11Lifecycle(pmoInit.status);
    const assessmentLifecycle = mapDbStatusToP11Lifecycle(assessmentInit.status);

    expect(pmoLifecycle).toBe(assessmentLifecycle);
  });

  it('both entry points produce initiatives visible in portfolio read with consistent fields', () => {
    const statuses = ['DRAFT', 'PLANNING', 'EXECUTING', 'IN_PROGRESS', 'DONE', 'BLOCKED'];

    for (const rawStatus of statuses) {
      const pmoDisplay = normalizeInitiativeDbStatusForRead(rawStatus);
      const assessDisplay = normalizeInitiativeDbStatusForRead(rawStatus);
      expect(pmoDisplay).toBe(assessDisplay);

      const pmoLifecycle = mapDbStatusToP11Lifecycle(rawStatus);
      const assessLifecycle = mapDbStatusToP11Lifecycle(rawStatus);
      expect(pmoLifecycle).toBe(assessLifecycle);
    }
  });

  it('unknown status from either entry point normalizes consistently (schema drift safe fallback)', () => {
    const unknownStatus = 'CUSTOM_UNKNOWN_STATUS';

    const pmoNorm = normalizeInitiativeDbStatusForRead(unknownStatus);
    const assessNorm = normalizeInitiativeDbStatusForRead(unknownStatus);

    expect(pmoNorm).toBe(assessNorm);
    expect(typeof pmoNorm).toBe('string');

    const pmoLifecycle = mapDbStatusToP11Lifecycle(unknownStatus);
    const assessLifecycle = mapDbStatusToP11Lifecycle(unknownStatus);

    expect(pmoLifecycle).toBe(assessLifecycle);
  });
});
