/**
 * @vitest-environment node
 *
 * W31 D-j — regression guard for four readers/gates that used values which
 * cannot occur in the seven-code `initiatives.status` column.
 */
import { readFileSync } from 'node:fs';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  INITIATIVE_STAGE_TO_STATUS,
  type InitiativeLifecycleStage,
} from '../../../constants/initiativeLifecycleStages.js';
import { InitiativeStatus } from '../../../constants/initiativeStatuses.js';

const { dbAllMock, findDueReportsMock } = vi.hoisted(() => ({
  dbAllMock: vi.fn(),
  findDueReportsMock: vi.fn(),
}));

vi.mock('../../../utils/DbPromise.js', () => ({
  all: (...args: unknown[]) => dbAllMock(...args),
}));
vi.mock('../../reportCadenceService.js', () => ({
  findDueReports: (...args: unknown[]) => findDueReportsMock(...args),
}));
vi.mock('../../executionDistributionService.js', () => ({
  default: { processReportDistributions: vi.fn() },
}));
vi.mock('../../../utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { runReportCadenceScan } from '../../../cron/ExecutionReportCron.js';
import { normalizeLifecycleBucket } from '../resultsROIService.js';

const transformationSource = readFileSync(
  new URL('../transformationCaseService.ts', import.meta.url),
  'utf8'
);
const planningSource = readFileSync(
  new URL('../planningPortfolioReadService.ts', import.meta.url),
  'utf8'
);

describe('W31 D-j — canonical initiative status consumers', () => {
  beforeEach(() => {
    dbAllMock.mockReset();
    findDueReportsMock.mockReset();
  });

  it('cron selects both held and unheld IN_EXECUTION initiatives through the P12 code', async () => {
    dbAllMock.mockResolvedValue([{ organization_id: 'org-1', on_hold: true }]);
    findDueReportsMock.mockResolvedValue([]);

    await expect(runReportCadenceScan(new Date('2026-09-14T10:00:00Z'))).resolves.toEqual({
      orgs: 1,
      due: 0,
      errors: 0,
    });

    const [sql, params] = dbAllMock.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('COALESCE(on_hold');
    expect(sql).not.toMatch(/'EXECUTING'|'BLOCKED'/);
    expect(params).toEqual([InitiativeStatus.IN_EXECUTION]);
  });

  it('transformation gates derive persisted codes from the lifecycle-stage canon', () => {
    const expected: Array<[InitiativeLifecycleStage, string]> = [
      ['SCHEDULED', 'result.initiative_status'],
      ['IN_EXECUTION', 'initiative.status'],
      ['DELIVERED', 'checkpoint.initiativeStatus'],
    ];

    for (const [stage, subject] of expected) {
      expect(INITIATIVE_STAGE_TO_STATUS[stage]).toBeTruthy();
      expect(transformationSource).toContain(`${subject} !== INITIATIVE_STAGE_TO_STATUS.${stage}`);
    }
    expect(transformationSource).not.toMatch(/initiative_status !== 'SCHEDULED'/);
    expect(transformationSource).not.toMatch(/initiative\.status !== 'EXECUTING'/);
    expect(transformationSource).not.toMatch(/initiativeStatus !== 'DONE'/);
  });

  it('ROI classifies canonical CLOSED as realized while preserving legacy-read compatibility', () => {
    expect(normalizeLifecycleBucket(InitiativeStatus.APPROVED)).toBe('in-realization');
    expect(normalizeLifecycleBucket(InitiativeStatus.IN_EXECUTION)).toBe('in-realization');
    expect(normalizeLifecycleBucket(InitiativeStatus.CLOSED)).toBe('realized');
    expect(normalizeLifecycleBucket('DONE')).toBe('realized');
    expect(normalizeLifecycleBucket(InitiativeStatus.DRAFT)).toBeNull();
  });

  it('planning readiness branches use only InitiativeStatus constants', () => {
    expect(planningSource).toContain('currentStatus === InitiativeStatus.PENDING_APPROVAL');
    expect(planningSource).toContain('currentStatus === InitiativeStatus.APPROVED');
    expect(planningSource).toContain('currentStatus === InitiativeStatus.CLOSED');
    expect(planningSource).not.toMatch(
      /\['PENDING_REVIEW', 'REVIEW', 'PROMOTED', 'PLANNING'\]\.includes\(currentStatus\)/
    );
    expect(planningSource).not.toContain("currentStatus === 'DONE'");
  });
});
