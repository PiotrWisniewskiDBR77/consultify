/**
 * Covers canon test 8 (DB-backed half): a new freeze marks previously
 * `current` Report Snapshots and Initiative Drafts as `superseded`, while
 * their content columns are never part of the UPDATE statement that does it.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { KernelTestDbHandle } from '../../__tests__/kernelTestDb.js';

let testDb: KernelTestDbHandle;

vi.mock('../../../utils/DbPromise.js', async () => {
  const { createKernelTestDb } = await import('../../__tests__/kernelTestDb.js');
  testDb = createKernelTestDb();
  return { ...testDb, default: testDb };
});

const { MethodOutputService } = await import('../MethodOutputService.js');
const { MethodReportSnapshotService } = await import('../MethodReportSnapshotService.js');
const { MethodInitiativeDraftService } = await import('../MethodInitiativeDraftService.js');
const { makeFreezeInput, makeFindingInput } = await import('./testFixtures.js');

const organizationId = 'org-1';
const sessionId = 'session-1';

describe('Supersession on new freeze (test 8)', () => {
  let outputs: InstanceType<typeof MethodOutputService>;
  let reports: InstanceType<typeof MethodReportSnapshotService>;
  let drafts: InstanceType<typeof MethodInitiativeDraftService>;

  beforeEach(() => {
    testDb.reset();
    outputs = new MethodOutputService();
    reports = new MethodReportSnapshotService();
    drafts = new MethodInitiativeDraftService();
  });

  it('marks a previously current ReportSnapshot as superseded, content columns untouched', async () => {
    const outputV1 = await outputs.freezeOutput(makeFreezeInput({ sessionId }));
    const report = await reports.create({
      organizationId,
      outputId: outputV1.id,
      sessionId,
      title: 'DRD Assessment Report v1',
      content: { executiveSummary: 'v1 summary', findings: ['f1'] },
      contentHash: 'hash-v1',
    });
    const reportRowBefore = { ...testDb.getRows('method_report_snapshots')[0] };

    const outputV2 = await outputs.freezeOutput(
      makeFreezeInput({ sessionId, revisionOfOutputId: outputV1.id })
    );
    const touched = await reports.supersedeCurrentForSession(organizationId, sessionId, outputV2.id);

    expect(touched).toBe(1);

    const rows = testDb.getRows('method_report_snapshots');
    const reportRowAfter = rows.find((r) => r.id === report.id)!;

    expect(reportRowAfter.status).toBe('superseded');
    expect(reportRowAfter.superseded_by_output_id).toBe(outputV2.id);
    expect(reportRowAfter.superseded_at).toBeTruthy();

    // Content columns are BIT-FOR-BIT unchanged.
    expect(reportRowAfter.content_json).toEqual(reportRowBefore.content_json);
    expect(reportRowAfter.content_hash).toBe(reportRowBefore.content_hash);
    expect(reportRowAfter.title).toBe(reportRowBefore.title);

    // Re-fetching the record confirms the same via the service API too.
    const reread = (await reports.listBySession(organizationId, sessionId)).find(
      (r) => r.id === report.id
    )!;
    expect(reread.content).toEqual({ executiveSummary: 'v1 summary', findings: ['f1'] });
    expect(reread.status).toBe('superseded');
  });

  it('marks a previously current InitiativeProposalDraft as superseded, content columns untouched', async () => {
    const outputV1 = await outputs.freezeOutput(makeFreezeInput({ sessionId }));
    const draft = await drafts.create({
      organizationId,
      outputId: outputV1.id,
      sessionId,
      title: 'Assign accountable data owners per domain',
      summary: 'Grouped from 2 findings on data ownership.',
      findingIds: ['finding-a', 'finding-b'],
      rationale: 'Both findings share the same root cause.',
      expectedOutcome: 'Faster cross-team decisions.',
      confidence: 'medium',
    });
    const draftRowBefore = { ...testDb.getRows('method_initiative_drafts')[0] };

    const outputV2 = await outputs.freezeOutput(
      makeFreezeInput({ sessionId, revisionOfOutputId: outputV1.id })
    );
    const touched = await drafts.supersedeCurrentForSession(organizationId, sessionId, outputV2.id);

    expect(touched).toBe(1);

    const rows = testDb.getRows('method_initiative_drafts');
    const draftRowAfter = rows.find((r) => r.id === draft.id)!;

    expect(draftRowAfter.status).toBe('superseded');
    expect(draftRowAfter.superseded_by_output_id).toBe(outputV2.id);
    expect(draftRowAfter.finding_ids_json).toEqual(draftRowBefore.finding_ids_json);
    expect(draftRowAfter.rationale).toBe(draftRowBefore.rationale);
    expect(draftRowAfter.title).toBe(draftRowBefore.title);
  });

  it('a draft/report belonging to the NEW output itself is not marked superseded by its own freeze', async () => {
    const outputV1 = await outputs.freezeOutput(makeFreezeInput({ sessionId }));
    const outputV2 = await outputs.freezeOutput(
      makeFreezeInput({ sessionId, revisionOfOutputId: outputV1.id })
    );
    const reportOnV2 = await reports.create({
      organizationId,
      outputId: outputV2.id,
      sessionId,
      title: 'DRD Assessment Report v2',
      content: { executiveSummary: 'v2 summary' },
      contentHash: 'hash-v2',
    });

    await reports.supersedeCurrentForSession(organizationId, sessionId, outputV2.id);

    const reread = (await reports.listBySession(organizationId, sessionId)).find(
      (r) => r.id === reportOnV2.id
    )!;
    expect(reread.status).toBe('current');
  });

  it('the underlying method_outputs row for v1 is never UPDATEd by supersession of its deliverables', async () => {
    const outputV1 = await outputs.freezeOutput(makeFreezeInput({ sessionId }));
    const outputRowBefore = { ...testDb.getRows('method_outputs')[0] };

    await reports.create({
      organizationId,
      outputId: outputV1.id,
      sessionId,
      title: 'Report',
      content: {},
      contentHash: 'hash-v1',
    });
    const outputV2 = await outputs.freezeOutput(
      makeFreezeInput({ sessionId, revisionOfOutputId: outputV1.id })
    );
    await reports.supersedeCurrentForSession(organizationId, sessionId, outputV2.id);

    const outputRowAfter = testDb.getRows('method_outputs').find((r) => r.id === outputV1.id)!;
    expect(outputRowAfter).toEqual(outputRowBefore);
  });
});
