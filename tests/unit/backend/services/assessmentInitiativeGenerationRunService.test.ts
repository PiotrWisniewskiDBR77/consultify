import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../server/src/utils/queryHelpers.js', () => {
  return {
    queryRun: vi.fn(),
    queryOne: vi.fn(),
    queryAll: vi.fn(),
  };
});

vi.mock('../../../../server/src/services/assessmentInitiativeService.js', () => {
  return {
    default: {
      generateFromAssessment: vi.fn(),
      persistInitiatives: vi.fn(),
    },
  };
});

import * as queryHelpers from '../../../../server/src/utils/queryHelpers.js';
import AssessmentInitiativeService from '../../../../server/src/services/assessmentInitiativeService.js';
import AssessmentInitiativeGenerationRunService from '../../../../server/src/services/assessmentInitiativeGenerationRunService.js';

describe('AssessmentInitiativeGenerationRunService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('replays the same generation run for a tenant-scoped idempotency key', async () => {
    (queryHelpers.queryOne as any).mockResolvedValueOnce({ id: 'run-existing' });

    await expect(
      AssessmentInitiativeGenerationRunService.createAndStart({
        assessmentId: 'assessment-1',
        organizationId: 'org-1',
        userId: 'user-1',
        mode: 'REPORT_ONLY',
        methodologyId: 'DRD',
        requestedCount: 5,
        batchSize: 5,
        includeChatContext: false,
        reportId: 'report-1',
        idempotencyKey: 'retry-1',
      })
    ).resolves.toEqual({ runId: 'run-existing' });

    expect(queryHelpers.queryOne).toHaveBeenCalledWith(
      expect.stringContaining('organization_id = ? AND idempotency_key = ?'),
      ['org-1', 'retry-1']
    );
    expect(queryHelpers.queryRun).not.toHaveBeenCalled();
  });

  it('processRun splits into 7-sized batches and persists', async () => {
    const runId = 'run-1';
    const orgId = 'org-1';
    const assessmentId = 'a-1';
    const userId = 'u-1';

    // PRAGMA columns for batch inserts
    (queryHelpers.queryAll as any).mockImplementation(async (sql: string) => {
      if (sql.includes('PRAGMA table_info(assessment_initiative_batches)')) {
        return [
          { name: 'id' },
          { name: 'assessment_id' },
          { name: 'methodology_id' },
          { name: 'initiatives_count' },
          { name: 'include_chat_context' },
          { name: 'generated_by' },
          { name: 'created_at' },
          { name: 'report_id' },
          { name: 'run_id' },
        ];
      }
      // existing initiatives list
      return [];
    });

    // queryOne router: run row, assessment row, counts
    (queryHelpers.queryOne as any).mockImplementation(async (sql: string, params: any[]) => {
      if (sql.includes('FROM assessment_initiative_generation_runs') && params?.[0] === runId) {
        return {
          id: runId,
          assessment_id: assessmentId,
          organization_id: orgId,
          created_by: userId,
          mode: 'ASSESSMENT_REPORT',
          methodology_id: 'impact-feasibility',
          requested_count: 15,
          batch_size: 7,
          status: 'RUNNING',
          inputs_json: JSON.stringify({
            includeChatContext: true,
            templateId: 'tpl-card-standard',
          }),
          stats_json: JSON.stringify({}),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      }
      if (sql.includes('FROM assessments') && params?.[0] === assessmentId) {
        return {
          id: assessmentId,
          organization_id: orgId,
          status: 'APPROVED',
          assessment_type: 'DRD',
          answers_json: JSON.stringify({ ok: true }),
          score_summary: JSON.stringify({}),
          context_snapshot: JSON.stringify({}),
        };
      }
      // progress counts (not used in this test)
      if (sql.includes('COUNT(*)')) return { c: 0 };
      return null;
    });

    (queryHelpers.queryRun as any).mockResolvedValue(undefined);

    (AssessmentInitiativeService.generateFromAssessment as any).mockImplementation(
      async ({ count }: any) => {
        return Array.from({ length: count }, (_, i) => ({
          title: `Init ${i + 1}`,
          description: 'desc',
          category: 'PROCESS',
          priority: 'MEDIUM',
          risk: 'LOW',
          impact: 3,
          effort: 2,
        }));
      }
    );

    let idCounter = 0;
    (AssessmentInitiativeService.persistInitiatives as any).mockImplementation(
      async ({ initiatives }: any) => {
        return (initiatives || []).map(() => {
          idCounter += 1;
          return { id: `i-${idCounter}`, title: 'x', status: 'DRAFT' };
        });
      }
    );

    // Invoke private method via bracket access (TS private is runtime-accessible)
    await (AssessmentInitiativeGenerationRunService as any).processRun(runId);

    expect(AssessmentInitiativeService.generateFromAssessment).toHaveBeenCalledTimes(3);
    expect(AssessmentInitiativeService.persistInitiatives).toHaveBeenCalledTimes(3);

    // batch insert should happen 3 times
    const insertBatchCalls = (queryHelpers.queryRun as any).mock.calls.filter((c: any[]) =>
      String(c[0]).includes('INSERT INTO assessment_initiative_batches')
    );
    expect(insertBatchCalls.length).toBe(3);

    // template application should run at least once
    const templateUpdateCalls = (queryHelpers.queryRun as any).mock.calls.filter((c: any[]) =>
      String(c[0]).includes('UPDATE initiatives SET initiative_template_id')
    );
    expect(templateUpdateCalls.length).toBeGreaterThan(0);
  });
});
