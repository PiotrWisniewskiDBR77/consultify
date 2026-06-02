import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryOneMock = vi.fn();
const queryAllMock = vi.fn();
const queryRunMock = vi.fn();

vi.mock('../../../../server/src/utils/queryHelpers.js', () => ({
  queryOne: (...args: unknown[]) => queryOneMock(...args),
  queryAll: (...args: unknown[]) => queryAllMock(...args),
  queryRun: (...args: unknown[]) => queryRunMock(...args),
}));

import {
  buildInterviewReportPackExportManifest,
  buildInterviewReportPackMarkdownExport,
  buildInterviewReportPackDraft,
  createInterviewReportPackDraft,
  createInterviewReportPackRevision,
  evaluateInterviewReportPackReadiness,
  InterviewReportPackExportBlockedError,
  InterviewReportPackMutationBlockedError,
  InterviewReportPackRevisionBlockedError,
  publishInterviewReportPack,
  REQUIRED_INTERVIEW_REPORT_WORKSHEETS,
  submitInterviewReportPackForReview,
  updateInterviewReportWorksheet,
} from '../../../../server/src/services/interviewInsightReportPackService.js';

describe('interviewInsightReportPackService', () => {
  beforeEach(() => {
    queryOneMock.mockReset();
    queryAllMock.mockReset();
    queryRunMock.mockReset();
    queryRunMock.mockResolvedValue({ changes: 1 });
    queryAllMock.mockResolvedValue([]);
    queryOneMock.mockResolvedValue(null);
  });

  it('builds every required worksheet from an insight draft', () => {
    const pack = buildInterviewReportPackDraft({
      id: 'insight-1',
      title: 'Operations discovery',
      executiveSummary: 'Operations summary.',
      sourceSessionIds: ['session-1', 'session-2'],
      analysisScope: {
        source_session_ids: ['session-1', 'session-2'],
        topic_focus: ['process_and_operations'],
      },
      materialQuality: {
        overall_material_score: 76,
        answer_quality_posture: 'usable',
      },
      themes: [
        {
          title: 'Handoffs are unclear',
          description: 'Teams describe unclear accountability.',
          evidence_refs: ['answer-1'],
          strength: 'strong',
          perspective_labels: ['Operations'],
        },
      ],
      issues: [
        {
          title: 'Escalation path is missing',
          description: 'Respondents cannot explain escalation.',
          evidence_refs: ['answer-2'],
          severity: 'high',
        },
      ],
      opportunities: [
        {
          title: 'Clarify ownership model',
          description: 'Create a lightweight RACI.',
          evidence_refs: ['answer-1', 'answer-2'],
          impact: 'high',
        },
      ],
      signals: [
        {
          title: 'Different views of ownership',
          description: 'Operations and IT disagree.',
          type: 'contradiction',
        },
      ],
      evidenceMap: [
        {
          answer_id: 'answer-1',
          answer_snippet: 'Nobody owns the handoff.',
        },
      ],
      missingData: ['Validate with IT owner.'],
      generationContext: {
        sourceMaterial: {
          includedSessionIds: ['session-1', 'session-2'],
          includedAnswerCount: 6,
        },
      },
    });

    expect(pack.id).toBe('irp_insight-1');
    expect(pack.worksheets.map((worksheet) => worksheet.key)).toEqual(
      REQUIRED_INTERVIEW_REPORT_WORKSHEETS.map((worksheet) => worksheet.key)
    );
    expect(pack.worksheets.find((worksheet) => worksheet.key === 'executive_summary')?.status).toBe(
      'generated'
    );
    expect(
      pack.worksheets.find((worksheet) => worksheet.key === 'opportunities')?.rows
    ).toHaveLength(1);
    expect(
      pack.worksheets.find((worksheet) => worksheet.key === 'recommendations_and_action_plan')?.rows
    ).toEqual([expect.objectContaining({ recommendationType: 'hypothesis' })]);
  });

  it('keeps incomplete or invalid evidence posture honest through degraded worksheets', () => {
    const pack = buildInterviewReportPackDraft({
      id: 'insight-2',
      title: 'Thin material',
      sourceSessionIds: ['session-1'],
      evidenceMap: [],
      generationContext: {
        evidenceValidation: {
          degraded: true,
          warnings: ['Removed invalid evidence_refs that did not match scoped answer IDs: ghost'],
        },
      },
    });

    const materialQuality = pack.worksheets.find(
      (worksheet) => worksheet.key === 'material_quality'
    );
    const evidenceRegister = pack.worksheets.find(
      (worksheet) => worksheet.key === 'evidence_register'
    );
    const appendix = pack.worksheets.find((worksheet) => worksheet.key === 'appendix_provenance');

    expect(materialQuality?.status).toBe('degraded');
    expect(evidenceRegister?.status).toBe('degraded');
    expect(appendix?.status).toBe('degraded');
    expect(pack.degraded).toBe(true);
    expect(pack.degradedReasons.join('\n')).toContain('Material Quality was not generated.');
    expect(pack.degradedReasons.join('\n')).toContain('Removed invalid evidence_refs');
  });

  it('degrades material quality and recommendations when confidence downgrade is required', () => {
    const pack = buildInterviewReportPackDraft({
      id: 'insight-thin',
      title: 'Thin material',
      sourceSessionIds: ['session-1'],
      materialQuality: {
        overall_material_score: 38,
        answer_quality_posture: 'poor',
        coverage_posture: 'single_perspective',
        confidence_downgrade_required: true,
        recommendation_posture: 'hypothesis_only',
      },
      opportunities: [
        {
          title: 'Clarify ownership',
          description: 'Clarify ownership model.',
          evidence_refs: ['answer-1'],
          impact: 'high',
        },
      ],
    });

    const materialQuality = pack.worksheets.find(
      (worksheet) => worksheet.key === 'material_quality'
    );
    const recommendations = pack.worksheets.find(
      (worksheet) => worksheet.key === 'recommendations_and_action_plan'
    );

    expect(materialQuality?.status).toBe('degraded');
    expect(recommendations?.status).toBe('degraded');
    expect(recommendations?.rows[0]).toEqual(
      expect.objectContaining({
        recommendationType: 'hypothesis',
        recommendationPosture: 'hypothesis_only',
        confidenceDowngradeRequired: true,
      })
    );
    expect(pack.degradedReasons.join('\n')).toContain('Recommendation posture is hypothesis_only');
  });

  it('projects organization context document lineage into source register and provenance', () => {
    const pack = buildInterviewReportPackDraft({
      id: 'insight-context',
      title: 'Context lineage',
      sourceSessionIds: ['session-1'],
      executiveSummary: 'Summary',
      materialQuality: {
        overall_material_score: 82,
        answer_quality_posture: 'strong',
        coverage_posture: 'good_coverage',
        confidence_downgrade_required: false,
        recommendation_posture: 'decision_ready',
      },
      generationContext: {
        contextDocuments: {
          requestedIds: ['doc-used', 'doc-selected', 'doc-missing'],
          selectedIds: ['doc-used', 'doc-selected'],
          degraded: true,
          degradedReasons: ['some_documents_not_accessible'],
          documents: [
            {
              id: 'doc-used',
              filename: 'strategy.pdf',
              status: 'ready',
              scope: 'project',
              projectId: 'project-1',
              ownerId: 'user-1',
              version: 2,
              uploadedAt: '2026-05-03T10:00:00.000Z',
              usedChunkCount: 1,
              chunks: [{ chunkId: 'chunk-1', excerpt: 'Strategy excerpt' }],
            },
            {
              id: 'doc-selected',
              filename: 'policy.pdf',
              status: 'ready',
              scope: 'project',
              projectId: 'project-1',
              ownerId: 'user-1',
              version: 1,
              uploadedAt: '2026-05-03T11:00:00.000Z',
              usedChunkCount: 0,
              chunks: [],
            },
          ],
        },
      },
    });

    const sourceRegister = pack.worksheets.find((worksheet) => worksheet.key === 'source_register');
    const appendix = pack.worksheets.find((worksheet) => worksheet.key === 'appendix_provenance');

    expect(sourceRegister?.status).toBe('degraded');
    expect(sourceRegister?.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceType: 'organization_context_document',
          documentId: 'doc-used',
          usageStatus: 'used_in_generation',
          usedChunkCount: 1,
        }),
        expect.objectContaining({
          sourceType: 'organization_context_document',
          documentId: 'doc-selected',
          usageStatus: 'selected_not_used',
          usedChunkCount: 0,
        }),
        expect.objectContaining({
          sourceType: 'organization_context_document',
          documentId: 'doc-missing',
          usageStatus: 'not_used',
        }),
      ])
    );
    expect(appendix?.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceType: 'organization_context_document',
          documentId: 'doc-used',
        }),
      ])
    );
    expect(pack.degradedReasons.join('\n')).toContain('some_documents_not_accessible');
    expect(pack.degradedReasons.join('\n')).toContain('selected but no chunks were used');
  });

  it('persists a report pack draft once and returns existing drafts without overwriting worksheets', async () => {
    queryOneMock.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: 'irp_existing',
      organization_id: 'org-1',
      insight_id: 'insight-3',
      title: 'Edited report pack',
      status: 'draft',
      completeness_score: 42,
      degraded: 1,
      degraded_reasons_json: '["Operator edited worksheet"]',
    });
    queryAllMock.mockResolvedValueOnce([
      {
        worksheet_key: 'executive_summary',
        title: 'Executive Summary',
        required: 1,
        status: 'partial',
        completeness_score: 70,
        warnings_json: '["Operator edited worksheet"]',
        rows_json: '[{"saved":true}]',
        markdown: null,
        sort_order: 0,
      },
    ]);

    const created = await createInterviewReportPackDraft({
      organizationId: 'org-1',
      insight: {
        id: 'insight-3',
        title: 'Operations',
        executiveSummary: 'Summary',
      },
      createdBy: 'user-1',
    });

    const existing = await createInterviewReportPackDraft({
      organizationId: 'org-1',
      insight: {
        id: 'insight-3',
        title: 'Operations updated',
        executiveSummary: 'New summary that should not overwrite existing draft.',
      },
      createdBy: 'user-1',
    });

    const insertStatements = queryRunMock.mock.calls
      .map(([sql]) => String(sql))
      .filter((sql) => sql.includes('INSERT INTO interview_report_pack_worksheets'));

    expect(created.id).toBe('irp_insight-3');
    expect(insertStatements).toHaveLength(REQUIRED_INTERVIEW_REPORT_WORKSHEETS.length);
    expect(existing.id).toBe('irp_existing');
    expect(existing.title).toBe('Edited report pack');
    expect(existing.worksheets).toEqual([
      expect.objectContaining({
        key: 'executive_summary',
        status: 'partial',
        rows: [{ saved: true }],
      }),
    ]);
  });

  it('updates one worksheet and recalculates pack completeness and degraded reasons', async () => {
    queryOneMock
      .mockResolvedValueOnce({
        id: 'irp_insight-4',
        organization_id: 'org-1',
        insight_id: 'insight-4',
        title: 'Report Pack',
        status: 'draft',
        completeness_score: 50,
        degraded: 0,
        degraded_reasons_json: '[]',
      })
      .mockResolvedValueOnce({
        worksheet_key: 'evidence_register',
        title: 'Evidence Register',
        required: 1,
        status: 'generated',
        completeness_score: 100,
        warnings_json: '[]',
        rows_json: '[]',
        markdown: null,
        sort_order: 0,
      });
    queryAllMock.mockResolvedValueOnce([
      {
        worksheet_key: 'evidence_register',
        title: 'Evidence Register',
        required: 1,
        status: 'degraded',
        completeness_score: 40,
        warnings_json: '["Evidence was manually marked incomplete"]',
        rows_json: '[{"answer_id":"a1"}]',
        markdown: null,
        sort_order: 0,
      },
      {
        worksheet_key: 'appendix_provenance',
        title: 'Appendix: Provenance',
        required: 1,
        status: 'generated',
        completeness_score: 100,
        warnings_json: '[]',
        rows_json: '[]',
        markdown: null,
        sort_order: 1,
      },
    ]);

    const pack = await updateInterviewReportWorksheet({
      organizationId: 'org-1',
      insightId: 'insight-4',
      worksheetKey: 'evidence_register',
      actorUserId: 'user-1',
      updates: {
        status: 'degraded',
        completenessScore: 40,
        warnings: ['Evidence was manually marked incomplete'],
        rows: [{ answer_id: 'a1' }],
      },
    });

    expect(pack?.completenessScore).toBe(70);
    expect(pack?.degraded).toBe(true);
    expect(pack?.degradedReasons).toEqual(['Evidence was manually marked incomplete']);
    expect(
      queryRunMock.mock.calls.some(([sql]) => String(sql).includes('UPDATE interview_report_packs'))
    ).toBe(true);
    expect(
      queryRunMock.mock.calls.some(([sql, params]) => {
        const values = params as unknown[];
        return (
          String(sql).includes('INSERT INTO interview_insight_audit_log') &&
          values.includes('interview_report_worksheet') &&
          values.includes('worksheet_updated') &&
          values.includes('user-1')
        );
      })
    ).toBe(true);
  });

  it('blocks worksheet updates after report pack publication and audits the attempt', async () => {
    queryOneMock.mockResolvedValueOnce({
      id: 'irp_insight-published',
      organization_id: 'org-1',
      insight_id: 'insight-published',
      title: 'Published Report Pack',
      status: 'published',
      completeness_score: 100,
      degraded: 0,
      degraded_reasons_json: '[]',
    });

    await expect(
      updateInterviewReportWorksheet({
        organizationId: 'org-1',
        insightId: 'insight-published',
        worksheetKey: 'executive_summary',
        actorUserId: 'user-1',
        updates: {
          status: 'partial',
          completenessScore: 70,
          warnings: ['Attempted edit after publish'],
        },
      })
    ).rejects.toBeInstanceOf(InterviewReportPackMutationBlockedError);

    expect(queryOneMock).toHaveBeenCalledTimes(1);
    expect(
      queryRunMock.mock.calls.some(([sql, params]) => {
        const values = params as unknown[];
        return (
          String(sql).includes('INSERT INTO interview_insight_audit_log') &&
          values.includes('worksheet_update_blocked') &&
          values.includes('interview_report_worksheet')
        );
      })
    ).toBe(true);
  });

  it('blocks readiness when required worksheets are empty, degraded, or below completeness gate', () => {
    const pack = buildInterviewReportPackDraft({
      id: 'insight-5',
      title: 'Thin material',
      executiveSummary: 'Summary',
      evidenceMap: [],
      generationContext: {
        evidenceValidation: {
          degraded: true,
          warnings: ['Evidence validation degraded'],
        },
      },
    });

    const readiness = evaluateInterviewReportPackReadiness(pack);

    expect(readiness.status).toBe('blocked');
    expect(readiness.completenessScore).toBe(pack.completenessScore);
    expect(readiness.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ worksheetKey: 'evidence_register', severity: 'blocker' }),
        expect.objectContaining({ worksheetKey: 'appendix_provenance', severity: 'blocker' }),
      ])
    );
  });

  it('allows review with warnings when all worksheets are present but partial', () => {
    const pack = buildInterviewReportPackDraft({
      id: 'insight-6',
      title: 'Ready material',
    });
    const readyPack = {
      ...pack,
      completenessScore: 95,
      worksheets: pack.worksheets.map((worksheet, index) => ({
        ...worksheet,
        status: index === 0 ? ('partial' as const) : ('generated' as const),
        completenessScore: index === 0 ? 85 : 100,
        rows: worksheet.rows.length > 0 ? worksheet.rows : [{ generated: true }],
        warnings: index === 0 ? ['Needs consultant review'] : [],
      })),
    };

    const readiness = evaluateInterviewReportPackReadiness(readyPack);

    expect(readiness.status).toBe('ready_with_warnings');
    expect(readiness.blockers).toHaveLength(0);
    expect(readiness.warnings).toEqual([
      expect.objectContaining({ worksheetKey: 'executive_summary', severity: 'warning' }),
    ]);
  });

  it('blocks submit for review and audits the attempt when readiness has blockers', async () => {
    queryOneMock.mockResolvedValueOnce({
      id: 'irp_insight-7',
      organization_id: 'org-1',
      insight_id: 'insight-7',
      title: 'Report Pack',
      status: 'draft',
      completeness_score: 40,
      degraded: 1,
      degraded_reasons_json: '["Missing evidence"]',
    });
    queryAllMock.mockResolvedValueOnce([
      {
        worksheet_key: 'evidence_register',
        title: 'Evidence Register',
        required: 1,
        status: 'empty',
        completeness_score: 0,
        warnings_json: '[]',
        rows_json: '[]',
        markdown: null,
        sort_order: 0,
      },
    ]);

    const result = await submitInterviewReportPackForReview({
      organizationId: 'org-1',
      insightId: 'insight-7',
      actorUserId: 'user-1',
    });

    expect(result?.blocked).toBe(true);
    expect(result?.submitted).toBe(false);
    expect(result?.readiness.status).toBe('blocked');
    expect(
      queryRunMock.mock.calls.some(([sql, params]) => {
        const values = params as unknown[];
        return (
          String(sql).includes('INSERT INTO interview_insight_audit_log') &&
          values.includes('report_pack_review_blocked') &&
          values.includes('interview_report_pack')
        );
      })
    ).toBe(true);
    expect(
      queryRunMock.mock.calls.some(([sql]) => String(sql).includes('UPDATE interview_report_packs'))
    ).toBe(false);
  });

  it('submits a ready report pack for review and audits the status transition', async () => {
    queryOneMock.mockResolvedValueOnce({
      id: 'irp_insight-8',
      organization_id: 'org-1',
      insight_id: 'insight-8',
      title: 'Report Pack',
      status: 'draft',
      completeness_score: 100,
      degraded: 0,
      degraded_reasons_json: '[]',
    });
    queryAllMock.mockResolvedValueOnce(
      REQUIRED_INTERVIEW_REPORT_WORKSHEETS.map((worksheet, index) => ({
        worksheet_key: worksheet.key,
        title: worksheet.title,
        required: 1,
        status: 'generated',
        completeness_score: 100,
        warnings_json: '[]',
        rows_json: '[{"ready":true}]',
        markdown: null,
        sort_order: index,
      }))
    );

    const result = await submitInterviewReportPackForReview({
      organizationId: 'org-1',
      insightId: 'insight-8',
      actorUserId: 'user-1',
    });

    expect(result?.blocked).toBe(false);
    expect(result?.submitted).toBe(true);
    expect(result?.reportPack.status).toBe('in_review');
    expect(
      queryRunMock.mock.calls.some(([sql, params]) => {
        const values = params as unknown[];
        return (
          String(sql).includes('UPDATE interview_report_packs') && values.includes('in_review')
        );
      })
    ).toBe(true);
    expect(
      queryRunMock.mock.calls.some(([sql, params]) => {
        const values = params as unknown[];
        return (
          String(sql).includes('INSERT INTO interview_insight_audit_log') &&
          values.includes('report_pack_submitted_for_review')
        );
      })
    ).toBe(true);
  });

  it('blocks publish when the report pack has not been submitted for review', async () => {
    queryOneMock.mockResolvedValueOnce({
      id: 'irp_insight-9',
      organization_id: 'org-1',
      insight_id: 'insight-9',
      title: 'Report Pack',
      status: 'draft',
      completeness_score: 100,
      degraded: 0,
      degraded_reasons_json: '[]',
    });
    queryAllMock.mockResolvedValueOnce(
      REQUIRED_INTERVIEW_REPORT_WORKSHEETS.map((worksheet, index) => ({
        worksheet_key: worksheet.key,
        title: worksheet.title,
        required: 1,
        status: 'generated',
        completeness_score: 100,
        warnings_json: '[]',
        rows_json: '[{"ready":true}]',
        markdown: null,
        sort_order: index,
      }))
    );

    const result = await publishInterviewReportPack({
      organizationId: 'org-1',
      insightId: 'insight-9',
      actorUserId: 'user-1',
    });

    expect(result?.blocked).toBe(true);
    expect(result?.published).toBe(false);
    expect(result?.readiness.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: 'Report pack must be submitted for review before publish.',
        }),
      ])
    );
    expect(
      queryRunMock.mock.calls.some(([sql, params]) => {
        const values = params as unknown[];
        return (
          String(sql).includes('INSERT INTO interview_insight_audit_log') &&
          values.includes('report_pack_publish_blocked')
        );
      })
    ).toBe(true);
  });

  it('publishes an in-review report pack that has full readiness PASS', async () => {
    queryOneMock.mockResolvedValueOnce({
      id: 'irp_insight-10',
      organization_id: 'org-1',
      insight_id: 'insight-10',
      title: 'Report Pack',
      status: 'in_review',
      completeness_score: 100,
      degraded: 0,
      degraded_reasons_json: '[]',
    });
    queryAllMock.mockResolvedValueOnce(
      REQUIRED_INTERVIEW_REPORT_WORKSHEETS.map((worksheet, index) => ({
        worksheet_key: worksheet.key,
        title: worksheet.title,
        required: 1,
        status: 'generated',
        completeness_score: 100,
        warnings_json: '[]',
        rows_json: '[{"ready":true}]',
        markdown: null,
        sort_order: index,
      }))
    );

    const result = await publishInterviewReportPack({
      organizationId: 'org-1',
      insightId: 'insight-10',
      actorUserId: 'user-1',
    });

    expect(result?.blocked).toBe(false);
    expect(result?.published).toBe(true);
    expect(result?.reportPack.status).toBe('published');
    expect(
      queryRunMock.mock.calls.some(([sql, params]) => {
        const values = params as unknown[];
        return (
          String(sql).includes('UPDATE interview_report_packs') && values.includes('published')
        );
      })
    ).toBe(true);
    expect(
      queryRunMock.mock.calls.some(([sql, params]) => {
        const values = params as unknown[];
        return (
          String(sql).includes('INSERT INTO interview_insight_audit_log') &&
          values.includes('report_pack_published')
        );
      })
    ).toBe(true);
  });

  it('blocks client-ready export when report pack is not published', async () => {
    queryOneMock.mockResolvedValueOnce({
      id: 'irp_insight-11',
      organization_id: 'org-1',
      insight_id: 'insight-11',
      title: 'Report Pack',
      status: 'in_review',
      completeness_score: 100,
      degraded: 0,
      degraded_reasons_json: '[]',
    });
    queryAllMock.mockResolvedValueOnce([]);

    await expect(
      buildInterviewReportPackExportManifest({
        organizationId: 'org-1',
        insightId: 'insight-11',
      })
    ).rejects.toBeInstanceOf(InterviewReportPackExportBlockedError);
  });

  it('builds a client-ready export manifest for a published report pack', async () => {
    queryOneMock.mockResolvedValueOnce({
      id: 'irp_insight-12',
      organization_id: 'org-1',
      insight_id: 'insight-12',
      title: 'Published Report Pack',
      status: 'published',
      completeness_score: 100,
      degraded: 0,
      degraded_reasons_json: '[]',
    });
    queryAllMock.mockResolvedValueOnce(
      REQUIRED_INTERVIEW_REPORT_WORKSHEETS.map((worksheet, index) => ({
        worksheet_key: worksheet.key,
        title: worksheet.title,
        required: 1,
        status: 'generated',
        completeness_score: 100,
        warnings_json: '[]',
        rows_json: '[{"ready":true}]',
        markdown: null,
        sort_order: index,
      }))
    );

    const manifest = await buildInterviewReportPackExportManifest({
      organizationId: 'org-1',
      insightId: 'insight-12',
    });

    expect(manifest?.status).toBe('published');
    expect(manifest?.manifestHash).toMatch(/^[a-f0-9]{64}$/);
    expect(manifest?.worksheetCount).toBe(REQUIRED_INTERVIEW_REPORT_WORKSHEETS.length);
    expect(manifest?.readiness.status).toBe('ready_for_review');
    expect(manifest?.worksheets[0]).toEqual(
      expect.objectContaining({ key: 'executive_summary', status: 'generated' })
    );
  });

  it('builds a client-ready Markdown export for a published report pack', async () => {
    queryOneMock.mockResolvedValueOnce({
      id: 'irp_insight-12-md',
      organization_id: 'org-1',
      insight_id: 'insight-12-md',
      title: 'Published Markdown Report Pack',
      status: 'published',
      completeness_score: 100,
      degraded: 0,
      degraded_reasons_json: '[]',
    });
    queryAllMock.mockResolvedValueOnce(
      REQUIRED_INTERVIEW_REPORT_WORKSHEETS.map((worksheet, index) => ({
        worksheet_key: worksheet.key,
        title: worksheet.title,
        required: 1,
        status: 'generated',
        completeness_score: 100,
        warnings_json: '[]',
        rows_json: index === 0 ? '[{"summary":"ready"}]' : '[{"ready":true}]',
        markdown: index === 0 ? 'Executive summary markdown.' : null,
        sort_order: index,
      }))
    );

    const markdownExport = await buildInterviewReportPackMarkdownExport({
      organizationId: 'org-1',
      insightId: 'insight-12-md',
    });

    expect(markdownExport?.status).toBe('published');
    expect(markdownExport?.format).toBe('markdown');
    expect(markdownExport?.sourceManifestHash).toMatch(/^[a-f0-9]{64}$/);
    expect(markdownExport?.exportHash).toMatch(/^[a-f0-9]{64}$/);
    expect(markdownExport?.filename).toBe('irp_insight-12-md-client-report.md');
    expect(markdownExport?.markdown).toContain('# Published Markdown Report Pack');
    expect(markdownExport?.markdown).toContain('## Executive Summary');
    expect(markdownExport?.markdown).toContain('Source manifest hash:');
  });

  it('blocks revision creation when the report pack is not published', async () => {
    queryOneMock.mockResolvedValueOnce({
      id: 'irp_insight-13',
      organization_id: 'org-1',
      insight_id: 'insight-13',
      title: 'Draft Report Pack',
      status: 'draft',
      completeness_score: 100,
      degraded: 0,
      degraded_reasons_json: '[]',
    });
    queryAllMock.mockResolvedValueOnce([]);

    await expect(
      createInterviewReportPackRevision({
        organizationId: 'org-1',
        insightId: 'insight-13',
        actorUserId: 'user-1',
      })
    ).rejects.toBeInstanceOf(InterviewReportPackRevisionBlockedError);
  });

  it('creates an editable draft revision from a published report pack snapshot', async () => {
    const packRow = {
      id: 'irp_insight-14',
      organization_id: 'org-1',
      insight_id: 'insight-14',
      title: 'Published Report Pack',
      status: 'published',
      completeness_score: 100,
      degraded: 0,
      degraded_reasons_json: '[]',
    };
    const worksheetRows = REQUIRED_INTERVIEW_REPORT_WORKSHEETS.map((worksheet, index) => ({
      worksheet_key: worksheet.key,
      title: worksheet.title,
      required: 1,
      status: 'generated',
      completeness_score: 100,
      warnings_json: '[]',
      rows_json: '[{"ready":true}]',
      markdown: null,
      sort_order: index,
    }));
    queryOneMock
      .mockResolvedValueOnce(packRow)
      .mockResolvedValueOnce(packRow)
      .mockResolvedValueOnce({ next_version: 3 });
    queryAllMock.mockResolvedValueOnce(worksheetRows).mockResolvedValueOnce(worksheetRows);

    const result = await createInterviewReportPackRevision({
      organizationId: 'org-1',
      insightId: 'insight-14',
      actorUserId: 'user-1',
    });

    expect(result?.reportPack.status).toBe('draft');
    expect(result?.revision.version).toBe(3);
    expect(result?.revision.manifestHash).toMatch(/^[a-f0-9]{64}$/);
    expect(
      queryRunMock.mock.calls.some(([sql, params]) => {
        const values = params as unknown[];
        return (
          String(sql).includes('INSERT INTO interview_report_pack_revisions') && values.includes(3)
        );
      })
    ).toBe(true);
    expect(
      queryRunMock.mock.calls.some(([sql, params]) => {
        const values = params as unknown[];
        return String(sql).includes('UPDATE interview_report_packs') && values.includes('draft');
      })
    ).toBe(true);
    expect(
      queryRunMock.mock.calls.some(([sql, params]) => {
        const values = params as unknown[];
        return (
          String(sql).includes('INSERT INTO interview_insight_audit_log') &&
          values.includes('report_pack_revision_created')
        );
      })
    ).toBe(true);
  });
});
