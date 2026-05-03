import { describe, expect, it } from 'vitest';

import {
  buildInsightGenerationPreferences,
  buildInsightScopeSessionWhereClause,
  buildInsightSourceMaterialSummary,
  buildInsightContextLineagePayload,
  validateInsightEvidenceRefs,
  type ContextDocumentPack,
  type InsightAnalysisScope,
  type ParsedInsightGenerationData,
} from '../../../../server/src/services/InterviewInsightService.js';

describe('InterviewInsightService context lineage payload', () => {
  it('projects selected context documents and used chunks into an audit-safe lineage payload', () => {
    const pack: ContextDocumentPack = {
      requestedIds: ['doc-1', 'doc-2'],
      selectedIds: ['doc-1'],
      degraded: true,
      degradedReasons: ['some_documents_not_accessible'],
      documents: [
        {
          id: 'doc-1',
          filename: 'strategy.pdf',
          status: 'ready',
          scope: 'project',
          projectId: 'project-1',
          ownerId: 'user-1',
          version: 2,
          uploadedAt: '2026-05-03T10:00:00.000Z',
          usedChunks: [
            {
              chunkId: 'chunk-1',
              content: 'A'.repeat(320),
              source: 'strategy.pdf',
              chunkIndex: 4,
            },
          ],
        },
      ],
    };

    const payload = buildInsightContextLineagePayload(pack);

    expect(payload.requestedDocumentIds).toEqual(['doc-1', 'doc-2']);
    expect(payload.selectedDocumentIds).toEqual(['doc-1']);
    expect(payload.degraded).toBe(true);
    expect(payload.degradedReasons).toEqual(['some_documents_not_accessible']);
    expect(payload.usedChunks).toEqual([
      expect.objectContaining({
        documentId: 'doc-1',
        filename: 'strategy.pdf',
        version: 2,
        chunkId: 'chunk-1',
        chunkIndex: 4,
        source: 'strategy.pdf',
      }),
    ]);
    expect(payload.usedChunks[0].excerpt).toHaveLength(260);
  });
});

describe('InterviewInsightService scope material helpers', () => {
  const analysisScope: InsightAnalysisScope = {
    source_session_ids: ['session-1', 'session-2', 'session-3'],
    source_scope_status: 'approved_only',
    respondent_filters: ['user-1'],
    role_filters: ['COO'],
    department_filters: ['Operations'],
    template_filters: ['template-1'],
    date_range: { from: '2026-05-01', to: '2026-05-31' },
    topic_focus: ['process and operations'],
    analysis_mode: 'general_consulting_synthesis',
    context_mode: 'selected_interview_material_only',
  };

  it('builds a server-side SQL scope filter for the exact source material used in generation', () => {
    const where = buildInsightScopeSessionWhereClause(analysisScope);

    expect(where.whereSql).toContain('s.owner_id IN (?)');
    expect(where.whereSql).toContain('u.job_title IN (?)');
    expect(where.whereSql).toContain('upe.department IN (?)');
    expect(where.whereSql).toContain('s.template_id IN (?)');
    expect(where.whereSql).toContain('datetime(s.completed_at) >= datetime(?)');
    expect(where.whereSql).toContain('datetime(s.completed_at) <= datetime(?)');
    expect(where.params).toEqual([
      'user-1',
      'COO',
      'Operations',
      'template-1',
      '2026-05-01T00:00:00.000Z',
      '2026-05-31T23:59:59.999Z',
    ]);
  });

  it('summarizes included source material for generation-context audit', () => {
    const summary = buildInsightSourceMaterialSummary({
      requestedSessionIds: analysisScope.source_session_ids,
      analysisScope,
      sessionData: [
        { id: 'session-1', answers: [{ id: 'answer-1' }, { id: 'answer-2' }] },
        { id: 'session-3', answers: [{ id: 'answer-3' }] },
      ],
    });

    expect(summary).toMatchObject({
      requestedSessionCount: 3,
      includedSessionCount: 2,
      excludedSessionCount: 1,
      includedAnswerCount: 3,
      includedSessionIds: ['session-1', 'session-3'],
      appliedFilters: {
        respondents: ['user-1'],
        roles: ['COO'],
        departments: ['Operations'],
        templates: ['template-1'],
        dateRange: { from: '2026-05-01', to: '2026-05-31' },
      },
    });
  });

  it('normalizes selected output types and analysis lenses so UI choices affect generation', () => {
    const preferences = buildInsightGenerationPreferences({
      promptType: 'summary',
      analysisScope,
      filters: {
        outputTypes: ['summary', 'recommendations'],
        analysisModes: ['contradiction_scan', 'between_the_lines', 'unknown_mode'],
      },
    });

    expect(preferences.outputTypes).toEqual(['summary', 'recommendations']);
    expect(preferences.analysisModes).toEqual(['contradiction_scan', 'between_the_lines']);
  });

  it('removes invalid evidence refs so generated claims cannot cite out-of-scope answers', () => {
    const data: ParsedInsightGenerationData = {
      executive_summary: 'Summary',
      themes: [
        {
          title: 'Theme',
          description: 'Description',
          strength: 'strong',
          evidence_refs: ['answer-1', 'missing-answer'],
        },
      ],
      issues: [],
      opportunities: [
        {
          title: 'Opportunity',
          description: 'Description',
          impact: 'medium',
          evidence_refs: ['answer-2'],
        },
      ],
      signals: [],
      evidence_map: [
        {
          answer_id: 'answer-1',
          question_text: 'Q1',
          answer_snippet: 'A1',
          linked_themes: ['Theme'],
          linked_issues: [],
        },
        {
          answer_id: 'ghost-answer',
          question_text: 'Q2',
          answer_snippet: 'A2',
          linked_themes: ['Theme'],
          linked_issues: [],
        },
      ],
      missing_data: [],
    };

    const validation = validateInsightEvidenceRefs(data, ['answer-1', 'answer-2']);

    expect(validation.data.themes[0].evidence_refs).toEqual(['answer-1']);
    expect(validation.data.opportunities[0].evidence_refs).toEqual(['answer-2']);
    expect(validation.data.evidence_map).toHaveLength(1);
    expect(validation.result.degraded).toBe(true);
    expect(validation.result.invalidRefs).toEqual(['missing-answer']);
    expect(validation.result.invalidEvidenceMapRefs).toEqual(['ghost-answer']);
    expect(validation.data.missing_data.join('\n')).toContain('Removed invalid evidence_refs');
  });
});
