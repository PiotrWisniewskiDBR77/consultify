import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  dbRun: vi.fn(),
  dbAll: vi.fn(),
  dbGet: vi.fn(),
  hybridSearch: vi.fn(),
  generateResponse: vi.fn(),
}));

vi.mock('../../../../server/src/database/Database.js', () => ({
  getDatabase: () => ({
    run: mocks.dbRun,
    all: mocks.dbAll,
    get: mocks.dbGet,
  }),
}));

vi.mock('../../../../server/src/services/ai/llmService.js', () => ({
  llmService: {
    generateResponse: mocks.generateResponse,
  },
}));

vi.mock('../../../../server/src/services/ragService.js', () => ({
  default: {
    hybridSearch: mocks.hybridSearch,
  },
}));

vi.mock('../../../../server/src/services/organizationContext/OrganizationContextService.js', () => ({
  default: {
    listClaims: vi.fn().mockResolvedValue([]),
  },
}));

const { create, listContextLineage } = await import(
  '../../../../server/src/services/InterviewInsightService.js'
);

describe('InterviewInsightService context lineage read model', () => {
  beforeEach(() => {
    mocks.dbRun.mockReset().mockResolvedValue({ success: true });
    mocks.dbGet.mockReset().mockResolvedValue({
      id: 'insight-1',
      organization_id: 'org-1',
      title: 'Insight',
      prompt_type: 'summary',
      source_session_ids: JSON.stringify(['session-1']),
      status: 'generating',
      created_by: 'user-1',
      created_at: '2026-05-03T10:00:00.000Z',
      updated_at: '2026-05-03T10:00:00.000Z',
    });
    mocks.hybridSearch.mockReset().mockResolvedValue([]);
    mocks.generateResponse.mockReset().mockResolvedValue({
      content: JSON.stringify({
        executive_summary: 'Summary',
        themes: [],
        issues: [],
        opportunities: [],
        signals: [],
        evidence_map: [],
        missing_data: [],
      }),
      usage: { totalTokens: 10 },
    });
    mocks.dbAll.mockReset().mockResolvedValue([
      {
        id: 'lineage-1',
        target_type: 'interview_insight',
        target_id: 'insight-1',
        workflow: 'interview_insight_creator',
        event_type: 'interview_insight_completed',
        requested_document_ids_json: JSON.stringify(['doc-1', 'doc-2']),
        selected_document_ids_json: JSON.stringify(['doc-1']),
        used_chunks_json: JSON.stringify([{ documentId: 'doc-1', chunkId: 'chunk-1' }]),
        degraded: 1,
        degraded_reasons_json: JSON.stringify(['some_documents_not_accessible']),
        metadata_json: JSON.stringify({ tokensUsed: 123 }),
        created_at: '2026-05-03T10:00:00.000Z',
      },
    ]);
  });

  it('reads lineage only by organization and insight target', async () => {
    const lineage = await listContextLineage('org-1', 'insight-1');

    expect(mocks.dbAll).toHaveBeenCalledWith(expect.stringContaining('organization_id = ?'), [
      'org-1',
      'insight-1',
    ]);
    expect(lineage).toEqual([
      expect.objectContaining({
        id: 'lineage-1',
        targetId: 'insight-1',
        requestedDocumentIds: ['doc-1', 'doc-2'],
        selectedDocumentIds: ['doc-1'],
        usedChunks: [{ documentId: 'doc-1', chunkId: 'chunk-1' }],
        degraded: true,
        degradedReasons: ['some_documents_not_accessible'],
        metadata: { tokensUsed: 123 },
      }),
    ]);
  });

  it('filters selected context document ids by organization and owner before writing generation context', async () => {
    mocks.dbAll.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM interview_sessions')) {
        return [{ id: 'session-1' }];
      }
      if (sql.includes('FROM knowledge_docs')) {
        return [
          {
            id: 'doc-own',
            filename: 'owned.pdf',
            status: 'ready',
            scope: 'user',
            project_id: null,
            owner_id: 'user-1',
            version: 1,
            created_at: '2026-05-03T10:00:00.000Z',
          },
        ];
      }
      if (sql.includes('FROM knowledge_chunks')) {
        return [
          {
            id: 'chunk-1',
            document_ref: 'doc-own',
            content: 'Owned document chunk',
            chunk_index: 0,
            filename: 'owned.pdf',
          },
        ];
      }
      return [];
    });

    await create({
      organizationId: 'org-1',
      title: 'Scoped insight',
      sessionIds: ['session-1'],
      promptType: 'summary',
      selectedContextDocumentIds: ['doc-own', 'doc-other-tenant'],
      createdBy: 'user-1',
    });

    const knowledgeDocsCall = mocks.dbAll.mock.calls.find(([sql]) =>
      String(sql).includes('FROM knowledge_docs')
    );
    expect(knowledgeDocsCall).toBeTruthy();
    expect(String(knowledgeDocsCall?.[0])).toContain('organization_id = ?');
    expect(String(knowledgeDocsCall?.[0])).toContain("(scope = 'project' OR (scope = 'user' AND owner_id = ?))");
    expect(knowledgeDocsCall?.[1]).toEqual(['doc-own', 'doc-other-tenant', 'org-1', 'user-1']);

    const insertInsightCall = mocks.dbRun.mock.calls.find(([sql]) =>
      String(sql).includes('INSERT INTO interview_insights')
    );
    const generationContext = JSON.parse(String(insertInsightCall?.[1]?.[14] || '{}'));
    expect(generationContext.contextDocuments.requestedIds).toEqual([
      'doc-own',
      'doc-other-tenant',
    ]);
    expect(generationContext.contextDocuments.selectedIds).toEqual(['doc-own']);
    expect(generationContext.contextDocuments.degraded).toBe(true);
    expect(generationContext.contextDocuments.degradedReasons).toContain(
      'some_documents_not_accessible'
    );

    const lineageInsertCall = mocks.dbRun.mock.calls.find(([sql, params]) =>
      String(sql).includes('INSERT INTO organization_context_lineage_events') &&
      Array.isArray(params) &&
      params[6] === 'interview_insight_context_selected'
    );
    expect(JSON.parse(String(lineageInsertCall?.[1]?.[7] || '[]'))).toEqual([
      'doc-own',
      'doc-other-tenant',
    ]);
    expect(JSON.parse(String(lineageInsertCall?.[1]?.[8] || '[]'))).toEqual(['doc-own']);
  });
});
