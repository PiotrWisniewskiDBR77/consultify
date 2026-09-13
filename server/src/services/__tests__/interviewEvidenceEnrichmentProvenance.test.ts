import { afterEach, describe, expect, it, vi } from 'vitest';
import service from '../InterviewInsightService.js';
import type { InsightEvidenceEnrichment } from '../InterviewInsightService.js';
import { llmService } from '../ai/llmService.js';

vi.mock('../evidence/evidenceContractBridge.js', () => ({
  safePersistEvidenceContract: vi.fn().mockResolvedValue(undefined),
}));

afterEach(() => vi.restoreAllMocks());
describe('Interview actual enrichment collector provenance', () => {
  it.each(['empty', 'linked KB', 'plain evidence', 'lookup error'])(
    'records %s without granting KB authority or altering prompt behavior',
    async (variant) => {
      const all = vi.fn(async (sql: string) => {
        if (variant === 'lookup error') throw Error('controlled lookup failure');
        if (sql.includes('interview_evidence'))
          return variant === 'empty'
            ? []
            : [
                {
                  id: 'e',
                  question_id: 'q',
                  title: 'Evidence',
                  description: 'DESCRIPTION',
                  knowledge_document_id: variant === 'linked KB' ? 'private-doc' : null,
                },
              ];
        if (sql.includes('ai_knowledge_embeddings'))
          return [{ document_id: 'private-doc', content: 'KB_PRIVATE_SENTINEL' }];
        throw Error('Unexpected SQL');
      });
      vi.spyOn(service as any, 'getDb').mockResolvedValue({ all });
      const p: InsightEvidenceEnrichment = {
        version: 1,
        lookupComplete: false,
        questionIds: [],
        evidenceIds: [],
        knowledgeDocumentIds: [],
      };
      const result = await (service as any).fetchEvidenceForQuestionIds(['q', 'q'], 'org', p);
      expect(p).toEqual({
        version: 1,
        lookupComplete: variant !== 'lookup error',
        questionIds: ['q'],
        evidenceIds: ['linked KB', 'plain evidence'].includes(variant) ? ['e'] : [],
        knowledgeDocumentIds: variant === 'linked KB' ? ['private-doc'] : [],
      });
      if (variant === 'linked KB') expect(result.get('q')[0].snippet).toBe('KB_PRIVATE_SENTINEL');
      if (variant === 'plain evidence') expect(result.get('q')[0].snippet).toBe('DESCRIPTION');
      if (variant === 'empty' || variant === 'lookup error') expect(result.size).toBe(0);
      const context = (service as any).buildGenerationContext({
        createdAt: '2026-09-12',
        generationRun: {
          version: 1,
          runId: 'run',
          status: 'completed',
          startedAt: '2026-09-12',
          completedAt: '2026-09-12',
        },
        analysisScope: {
          context_mode: 'selected_interview_material_only',
          analysis_mode: 'summary',
          topic_focus: [],
        },
        approvedOrgKnowledgePack: { entries: [] },
        contextDocumentPack: { documents: [] },
        evidenceEnrichment: p,
      });
      expect(JSON.parse(JSON.stringify(context)).evidenceEnrichment).toEqual(p);
      expect(JSON.stringify(context.evidenceEnrichment)).not.toContain('KB_PRIVATE_SENTINEL');
    }
  );
});

describe('Interview generation writer run ownership', () => {
  const runContext = (runId: string, status: 'generating' | 'completed') =>
    JSON.stringify({
      generationRun: {
        version: 1,
        runId,
        status,
        startedAt: '2026-09-13T00:00:00.000Z',
        ...(status === 'completed' ? { completedAt: '2026-09-13T00:01:00.000Z' } : {}),
      },
      evidenceEnrichment: {
        version: 1,
        lookupComplete: status === 'completed',
        questionIds: ['q'],
        evidenceIds: [],
        knowledgeDocumentIds: [],
      },
    });

  it('regeneration start replaces the prior complete enrichment stamp with a generating run', async () => {
    const state = { status: 'completed', contextJson: runContext('old', 'completed') };
    const run = vi.fn(async (sql: string, params: unknown[]) => {
      if (sql.includes("SET status = 'generating'")) {
        state.status = 'generating';
        if (sql.includes('generation_context_json = ?')) state.contextJson = String(params[0]);
      }
      return { changes: 1 };
    });
    vi.spyOn(service as any, 'getDb').mockResolvedValue({ run });
    vi.spyOn(service as any, 'getById').mockResolvedValue({
      id: 'i',
      organizationId: 'org',
      promptType: 'summary',
      sourceSessionIds: ['s'],
      filters: {},
      analysisScope: {
        source_session_ids: ['s'],
        source_scope_status: 'approved_only',
        respondent_filters: [],
        role_filters: [],
        department_filters: [],
        template_filters: [],
        topic_focus: [],
        analysis_mode: 'general_consulting_synthesis',
        context_mode: 'selected_interview_material_only',
        consultant_note: null,
        leading_question: null,
      },
      contextMode: 'selected_interview_material_only',
      analysisMode: 'general_consulting_synthesis',
      generationContext: JSON.parse(state.contextJson),
      createdBy: 'user',
    });
    vi.spyOn(service as any, 'generateInsight').mockResolvedValue(undefined);
    vi.spyOn(service as any, 'detachGeneration').mockImplementation(() => undefined);

    await service.regenerate('i');

    const persisted = JSON.parse(state.contextJson);
    expect(persisted.generationRun.status).toBe('generating');
    expect(persisted.generationRun.runId).not.toBe('old');
    expect(persisted.evidenceEnrichment.lookupComplete).toBe(false);
    expect(persisted.evidenceEnrichment.evidenceIds).toEqual([]);
    expect(persisted.evidenceEnrichment.knowledgeDocumentIds).toEqual([]);
  });

  it('current run failure persists a failed run stamp with incomplete enrichment', async () => {
    const runAContext = runContext('run-a', 'generating');
    const state = { status: 'generating', contextJson: runAContext, error: null as string | null };
    const run = vi.fn(async (sql: string, params: unknown[]) => {
      if (!sql.includes("SET status = 'failed'")) return { changes: 1 };
      const expectedContext = String(params.at(-1));
      if (state.status !== 'generating' || state.contextJson !== expectedContext)
        return { changes: 0 };
      state.status = 'failed';
      state.error = String(params[0]);
      state.contextJson = String(params[1]);
      return { changes: 1 };
    });
    vi.spyOn(service as any, 'getDb').mockResolvedValue({
      get: vi.fn().mockResolvedValue({ title: 'Insight' }),
      run,
    });
    vi.spyOn(service as any, 'fetchSessionData').mockRejectedValue(Error('current run failure'));

    await (service as any).generateInsight(
      'i',
      ['s'],
      'org',
      'summary',
      undefined,
      undefined,
      undefined,
      undefined,
      'user',
      undefined,
      {
        runId: 'run-a',
        startedAt: '2026-09-13T00:00:00.000Z',
        expectedContextJson: runAContext,
      }
    );

    const failed = JSON.parse(state.contextJson);
    expect(state.status).toBe('failed');
    expect(state.error).toBe('current run failure');
    expect(failed.generationRun).toMatchObject({ runId: 'run-a', status: 'failed' });
    expect(failed.generationRun.failedAt).toEqual(expect.any(String));
    expect(failed.evidenceEnrichment).toEqual({
      version: 1,
      lookupComplete: false,
      questionIds: [],
      evidenceIds: [],
      knowledgeDocumentIds: [],
    });
  });

  it('completed run B publishes once while late completion and failure from run A cannot overwrite it', async () => {
    const runAContext = runContext('run-a', 'generating');
    const runBStartContext = runContext('run-b', 'generating');
    const state = {
      status: 'generating',
      contextJson: runBStartContext,
      error: null as string | null,
    };
    const run = vi.fn(async (sql: string, params: unknown[]) => {
      if (sql.includes("SET status = 'completed'")) {
        const expectedContext = String(params.at(-1));
        if (state.status !== 'generating' || state.contextJson !== expectedContext)
          return { changes: 0 };
        state.status = 'completed';
        state.contextJson = String(params[9]);
        state.error = null;
        return { changes: 1 };
      }
      if (!sql.includes("SET status = 'failed'")) return { changes: 1 };
      const hasRunCas = sql.includes('generation_context_json = ?');
      const expectedContext = hasRunCas ? String(params.at(-1)) : undefined;
      if (hasRunCas && (state.status !== 'generating' || state.contextJson !== expectedContext))
        return { changes: 0 };
      state.status = 'failed';
      state.error = String(params[0]);
      if (hasRunCas) state.contextJson = String(params[1]);
      return { changes: 1 };
    });
    vi.spyOn(service as any, 'getDb').mockResolvedValue({
      get: vi.fn().mockResolvedValue({ title: 'Insight' }),
      run,
    });
    vi.spyOn(service as any, 'fetchSessionData')
      .mockResolvedValueOnce([{ id: 's', answers: [{ id: 'q', answer_text: 'ANSWER' }] }])
      .mockResolvedValueOnce([{ id: 's', answers: [{ id: 'q', answer_text: 'ANSWER' }] }])
      .mockRejectedValueOnce(Error('late run A failure'));
    vi.spyOn(service as any, 'formatSessionDataForPrompt').mockReturnValue('ANSWER');
    vi.spyOn(service as any, 'buildV6Prompt').mockReturnValue('PROMPT');
    const lineage = vi
      .spyOn(service as any, 'recordInsightContextLineage')
      .mockResolvedValue(undefined);
    vi.spyOn(llmService, 'generateResponse').mockResolvedValue({
      content: JSON.stringify({
        executive_summary: 'Bounded summary.',
        themes: [],
        issues: [],
        opportunities: [],
        signals: [],
        evidence_map: [],
        missing_data: [],
      }),
      usage: { totalTokens: 1 },
    } as never);
    const scope = {
      source_session_ids: ['s'],
      source_scope_status: 'approved_only',
      respondent_filters: [],
      role_filters: [],
      department_filters: [],
      template_filters: [],
      topic_focus: [],
      analysis_mode: 'general_consulting_synthesis',
      context_mode: 'selected_interview_material_only',
      consultant_note: null,
      leading_question: null,
    };
    const knowledge = {
      requested: false,
      available: false,
      included: false,
      degraded: false,
      degradedReasons: [],
      policy: 'accepted_or_approved_context_claims_only',
      sourceCount: 0,
      builtAt: '2026-09-13T00:00:00.000Z',
      entries: [],
    };
    const documents = {
      requestedIds: [],
      selectedIds: [],
      degraded: false,
      degradedReasons: [],
      documents: [],
    };
    const previousHardGate = process.env.CARD_CONTENT_HARD_GATE;
    process.env.CARD_CONTENT_HARD_GATE = 'false';

    await (service as any).generateInsight(
      'i',
      ['s'],
      'org',
      'summary',
      undefined,
      scope,
      knowledge,
      documents,
      'user',
      undefined,
      {
        runId: 'run-b',
        startedAt: '2026-09-13T00:00:00.000Z',
        expectedContextJson: runBStartContext,
      }
    );

    const completedRunBContext = state.contextJson;
    expect(state.status).toBe('completed');
    expect(JSON.parse(completedRunBContext).generationRun).toMatchObject({
      runId: 'run-b',
      status: 'completed',
    });
    expect(lineage).toHaveBeenCalledTimes(1);

    await (service as any).generateInsight(
      'i',
      ['s'],
      'org',
      'summary',
      undefined,
      scope,
      knowledge,
      documents,
      'user',
      undefined,
      {
        runId: 'run-a',
        startedAt: '2026-09-13T00:00:00.000Z',
        expectedContextJson: runAContext,
      }
    );
    expect(state).toEqual({ status: 'completed', contextJson: completedRunBContext, error: null });
    expect(lineage).toHaveBeenCalledTimes(1);

    await (service as any).generateInsight(
      'i',
      ['s'],
      'org',
      'summary',
      undefined,
      undefined,
      undefined,
      undefined,
      'user',
      undefined,
      {
        runId: 'run-a',
        startedAt: '2026-09-13T00:00:00.000Z',
        expectedContextJson: runAContext,
      }
    );

    if (previousHardGate === undefined) delete process.env.CARD_CONTENT_HARD_GATE;
    else process.env.CARD_CONTENT_HARD_GATE = previousHardGate;
    expect(state).toEqual({ status: 'completed', contextJson: completedRunBContext, error: null });
    expect(lineage).toHaveBeenCalledTimes(1);
  });
});
