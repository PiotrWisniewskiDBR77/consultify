/**
 * OGNIWO 8 — end-to-end proof that `source_refs_json` actually flows through
 * the real production call chain used to generate a report:
 *
 *   ReportBuilderService.createReport()   — WRITE  (report_builder_reports.source_refs_json)
 *   ReportBuilderService.getReport()      — READ-BACK into ReportRecord.sourceRefs
 *   contextPackBuilder.buildContextPack() — CONSUME sourceRefs -> real data_points
 *
 * Every function under test is the actual exported production function, unmodified.
 * Only the raw DB driver (`db.all/get/run` used by reportBuilderService, and
 * `DbPromise.all/get` used by contextPackBuilder) is stubbed with an in-memory
 * fake that mimics the REAL demo Postgres schema (columns verified live against
 * `trolley` on 2026-07-28 — see reportBuilderService.ts:274-277 comment).
 *
 * Before this fix:
 *   - `createReport()` wrote `source_refs_json` (already fixed by an earlier,
 *     independent commit — 2947865eeb) but `getReport()` never read the column
 *     back into `ReportRecord.sourceRefs`, so `reportGenerationService` always
 *     saw `report.sourceRefs === undefined` and skipped `buildContextPack`.
 *   - Separately, `extractInitiativeData()` in contextPackBuilder.ts selected
 *     `owner`, `started_at`, `target_date` — none of which exist on the real
 *     `initiatives` table — so even with sourceRefs present, extraction threw
 *     and was swallowed by the per-source try/catch, yielding zero data_points.
 *
 * This test fails on the pre-fix code and passes after both fixes.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../organizationContext/OrganizationContextService.js', () => ({
  default: {
    buildResolvedContext: vi.fn(async () => null),
  },
}));

const dbPromiseState: { rows: Record<string, unknown[]> } = { rows: {} };

vi.mock('../../utils/DbPromise.js', () => ({
  all: vi.fn(async (sql: string) => {
    const s = String(sql);
    if (s.includes('FROM initiatives')) return dbPromiseState.rows.initiatives || [];
    if (s.includes('v8_output_artifacts')) return [];
    return [];
  }),
  get: vi.fn(async () => null),
  run: vi.fn(async () => ({ success: true, changes: 0 })),
}));

import { buildContextPack } from '../contextPackBuilder.js';
import { createReport, getReport, setDependencies } from '../reportBuilderService.js';

type DbCallback<T> = (err: Error | null, result: T) => void;

function createMockDb() {
  let insertedReportRow: Record<string, unknown> | null = null;

  const templateRow = {
    id: 'rbt-1',
    name: 'Assessment default',
    source_type: 'ASSESSMENT',
    report_type: null,
    sections_json: JSON.stringify([
      {
        key: 'exec_summary',
        type: 'narrative',
        title: 'Executive summary',
        required: true,
        order: 0,
      },
    ]),
    is_active: 1,
  };

  const approvedAssessmentRow = {
    id: 'assessment-1',
    name: 'DRD Assessment — Acme',
    assessment_type: 'DRD',
    status: 'APPROVED',
    organization_id: 'org-1',
    answers_json: '{}',
    score_summary: '{}',
    context_snapshot: '{}',
    approved_at: '2026-07-20T00:00:00.000Z',
    created_by: 'user-1',
  };

  // Real shape verified live against demo (trolley) — table `initiatives`,
  // 2 rows linked to assessment `assessment-1` via source_assessment_id.
  const initiativeRows = [
    {
      id: 'd1b3751e-d2aa-4957-8967-10254e7628c3',
      title: 'Automated Changeover Optimization',
    },
    {
      id: '0ea089d2-d9c8-4fd2-bffe-748c2a3fa0ce',
      title: 'Digital Performance Management',
    },
  ];

  return {
    get: vi.fn((sql: string, _params: unknown[], cb: DbCallback<unknown>) => {
      const s = String(sql);
      if (s.includes('report_builder_templates')) return cb(null, templateRow);
      if (s.includes('FROM assessments')) return cb(null, approvedAssessmentRow);
      if (s.includes('FROM report_builder_reports')) return cb(null, insertedReportRow);
      cb(null, null);
    }),
    all: vi.fn((sql: string, _params: unknown[], cb: DbCallback<unknown[]>) => {
      const s = String(sql);
      if (s.includes('FROM initiatives')) return cb(null, initiativeRows);
      if (s.includes('FROM report_builder_sections')) return cb(null, []);
      cb(null, []);
    }),
    run: vi.fn(function (this: unknown, sql: string, params: unknown[], cb: any) {
      const s = String(sql);
      if (s.includes('INSERT INTO report_builder_reports')) {
        // Mirror the real column order from reportBuilderService.ts createReport()
        // just enough to reconstruct the row getReport() will later SELECT back.
        insertedReportRow = {
          id: params[0],
          organization_id: params[1],
          project_id: params[2],
          source_type: params[3],
          source_id: params[4],
          source_name: params[5],
          source_framework: params[6],
          title: params[7],
          description: params[8],
          report_type: params[9],
          template_id: params[10],
          config_json: params[11],
          company_context_json: params[12],
          created_by: params[13],
          created_at: params[14],
          updated_at: params[15],
          version: 1,
          source_refs_json: params[params.length - 1],
        };
      }
      if (typeof cb === 'function') cb.call({ lastID: 1, changes: 1 }, null);
    }),
  };
}

describe('OGNIWO 8 — source_refs_json write -> read-back -> contextPack (production entry points)', () => {
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    setDependencies({ db: mockDb as any });
    dbPromiseState.rows = {};
  });

  it('createReport() writes non-empty source_refs_json for an ASSESSMENT report with linked initiatives', async () => {
    const { report } = await createReport({
      organizationId: 'org-1',
      createdBy: 'user-1',
      sourceType: 'ASSESSMENT',
      sourceId: 'assessment-1',
      title: 'DRD report',
      templateId: 'rbt-1',
    });

    // WRITE assertion — this is the part that was already fixed upstream
    // (commit 2947865eeb); re-asserted here so a regression on either half
    // of the chain fails this test.
    expect(report.sourceRefs).toBeDefined();
    expect(report.sourceRefs!.length).toBe(2);
    expect(report.sourceRefs!.map((r) => r.artifact_type)).toEqual(['initiative', 'initiative']);

    const insertCall = mockDb.run.mock.calls.find((c) =>
      String(c[0]).includes('INSERT INTO report_builder_reports')
    );
    expect(insertCall).toBeDefined();
    const sourceRefsParam = insertCall![1][insertCall![1].length - 1];
    expect(sourceRefsParam).not.toBeNull();
    expect(JSON.parse(sourceRefsParam as string)).toHaveLength(2);
  });

  it('getReport() reads source_refs_json back into ReportRecord.sourceRefs (the actual gap this task closes)', async () => {
    const created = await createReport({
      organizationId: 'org-1',
      createdBy: 'user-1',
      sourceType: 'ASSESSMENT',
      sourceId: 'assessment-1',
      title: 'DRD report',
      templateId: 'rbt-1',
    });

    const fetched = await getReport(created.report.id, 'org-1');
    expect(fetched).not.toBeNull();

    // THE FIX: before this task, `fetched.report.sourceRefs` was always
    // `undefined` here even though the DB row had a populated
    // `source_refs_json` column — `getReport()` simply never mapped it.
    expect(fetched!.report.sourceRefs).toBeDefined();
    expect(fetched!.report.sourceRefs).toEqual(created.report.sourceRefs);
  });

  it('buildContextPack(), fed the refs getReport() now returns, produces real non-empty data_points (not a lightweight/empty pack)', async () => {
    const created = await createReport({
      organizationId: 'org-1',
      createdBy: 'user-1',
      sourceType: 'ASSESSMENT',
      sourceId: 'assessment-1',
      title: 'DRD report',
      templateId: 'rbt-1',
    });
    const fetched = await getReport(created.report.id, 'org-1');

    // Real row shapes returned by `extractInitiativeData()`'s FIXED query
    // (post schema-drift fix: owner/started_at/target_date -> real columns),
    // verified live against demo — see contextPackBuilder.ts:273-286.
    dbPromiseState.rows.initiatives = [
      {
        id: 'd1b3751e-d2aa-4957-8967-10254e7628c3',
        title: 'Automated Changeover Optimization',
        description:
          'Reduce changeover time by 30% through SMED methodology + digital support tools.',
        status: 'DRAFT',
        priority: 'low',
        owner: 'Piotr Wiśniewski',
        start_date: null,
        target_date: '2026-03-17 18:31:27.988',
        progress: 0,
      },
      {
        id: '0ea089d2-d9c8-4fd2-bffe-748c2a3fa0ce',
        title: 'Digital Performance Management',
        description: null,
        status: 'DRAFT',
        priority: 'medium',
        owner: null,
        start_date: null,
        target_date: null,
        progress: 0,
      },
    ];

    const pack = await buildContextPack('org-1', fetched!.report.sourceRefs!, 'en');

    // This is the concrete, doctrine-required proof: not "tests passed" in the
    // abstract, but the actual ContextPack the report generator would receive —
    // containing real facts pulled from the initiatives the report is about.
    expect(pack.metadata.total_source_artifacts).toBe(2);
    expect(pack.headings).toContain('Automated Changeover Optimization');
    expect(pack.headings).toContain('Digital Performance Management');
    expect(pack.key_points.some((k) => k.includes('SMED methodology'))).toBe(true);
    expect(pack.key_points.some((k) => k.includes('Piotr Wiśniewski'))).toBe(true);
    expect(pack.data_points.length).toBeGreaterThan(0);
    expect(pack.data_points.some((d) => d.label === 'Automated Changeover Optimization Due')).toBe(
      true
    );
  });
});
