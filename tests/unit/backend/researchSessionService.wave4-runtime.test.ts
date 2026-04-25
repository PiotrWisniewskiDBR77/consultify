import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

type Row = Record<string, any>;

const db = vi.hoisted(() => ({
  sessions: new Map<string, Row>(),
  events: [] as Row[],
  evidence: [] as Row[],
  artifacts: new Map<string, Row>(),
  uuidCounter: 0,
}));
const researchDeps = vi.hoisted(() => ({
  runtimeSearch: vi.fn().mockResolvedValue({ results: [], answer: null }),
  modelSelect: vi.fn().mockResolvedValue({
    provider: 'openai',
    id: 'gpt-test',
    endpoint: null,
    apiKey: null,
  }),
  llmCall: vi.fn().mockResolvedValue({ content: '{"queries":[]}' }),
  conductDeepResearch: vi.fn(async (_topic: string, _options: any, dependencies: any) => {
    dependencies?.onProgress?.({ stage: 'searching', queries: [], round: 1, totalRounds: 1 });
    return {
      topic: 'AI operating model',
      queries: [],
      results: [],
      synthesis: 'Executive summary with evidence [1]. However, one source signals risk [2].',
      citations: [
        {
          id: 'c1',
          sourceIndex: 0,
          text: 'AI governance improves control and repeatability.',
          title: 'Governance source',
          url: 'https://example.com/governance',
        },
        {
          id: 'c2',
          sourceIndex: 1,
          text: 'However adoption can conflict with legacy controls.',
          title: 'Risk source',
          url: 'https://example.com/risk',
        },
      ],
      sources: [
        {
          url: 'https://example.com/governance',
          title: 'Governance source',
          domain: 'example.com',
          relevanceScore: 0.92,
          snippets: ['AI governance improves control and repeatability.'],
          accessedAt: new Date().toISOString(),
        },
        {
          url: 'https://example.com/risk',
          title: 'Risk source',
          domain: 'example.com',
          relevanceScore: 0.7,
          snippets: ['However adoption can conflict with legacy controls.'],
          accessedAt: '2020-01-01T00:00:00.000Z',
        },
      ],
      metadata: {
        totalSources: 2,
        uniqueDomains: 1,
        averageConfidence: 0.81,
        researchDuration: 10,
        queriesExecuted: 1,
        rounds: 1,
        citationCount: 2,
        evidenceCoverage: 1,
        unsupportedClaimRate: 0,
      },
    };
  }),
}));

function resetDb() {
  db.sessions.clear();
  db.events.length = 0;
  db.evidence.length = 0;
  db.artifacts.clear();
  db.uuidCounter = 0;
}

function nextUuid() {
  db.uuidCounter += 1;
  return `wave4-id-${db.uuidCounter}`;
}

vi.mock('uuid', () => ({
  v4: () => nextUuid(),
}));

vi.mock('../../../server/src/services/ai/deepResearchService.js', () => ({
  conductDeepResearch: researchDeps.conductDeepResearch,
}));

vi.mock('../../../server/src/services/ai/runtimeWebSearchService.js', () => ({
  RuntimeWebSearchService: class RuntimeWebSearchService {
    search(query: string, options: any) {
      return researchDeps.runtimeSearch(query, options);
    }
  },
}));

vi.mock('../../../server/src/services/ai/modelRouter.js', () => ({
  default: {
    select: (...args: any[]) => researchDeps.modelSelect(...args),
  },
  modelRouter: {
    select: (...args: any[]) => researchDeps.modelSelect(...args),
  },
}));

vi.mock('../../../server/src/services/ai/llmService.js', () => ({
  default: {
    call: (...args: any[]) => researchDeps.llmCall(...args),
  },
  llmService: {
    call: (...args: any[]) => researchDeps.llmCall(...args),
  },
}));

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  run: async (sql: string, params: any[] = []) => {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    if (normalized.startsWith('CREATE TABLE') || normalized.startsWith('CREATE INDEX')) {
      return { changes: 0 };
    }
    if (normalized.startsWith('INSERT INTO research_sessions')) {
      const [
        sessionId,
        organizationId,
        userId,
        projectId,
        conversationId,
        mission,
        scope,
        questionsJson,
        allowedSourcesJson,
        budgetJson,
        expectedOutput,
        attachmentDocIdsJson,
        progressJson,
      ] = params;
      db.sessions.set(sessionId, {
        session_id: sessionId,
        organization_id: organizationId,
        user_id: userId,
        project_id: projectId,
        conversation_id: conversationId,
        status: 'planned',
        mission,
        scope,
        questions_json: questionsJson,
        allowed_sources_json: allowedSourcesJson,
        budget_json: budgetJson,
        expected_output: expectedOutput,
        attachment_doc_ids_json: attachmentDocIdsJson,
        progress_json: progressJson,
        final_artifact_id: null,
        error: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      return { changes: 1 };
    }
    if (normalized.startsWith('INSERT INTO research_session_events')) {
      const [id, sessionId, organizationId, actorUserId, eventType, status, detailsJson] = params;
      db.events.push({
        id,
        session_id: sessionId,
        organization_id: organizationId,
        actor_user_id: actorUserId,
        event_type: eventType,
        status,
        details_json: detailsJson,
        created_at: new Date().toISOString(),
      });
      return { changes: 1 };
    }
    if (normalized.startsWith('UPDATE research_sessions SET status = ?')) {
      const [status, progressJson, statusForArchive, sessionId] = params;
      const session = db.sessions.get(sessionId);
      Object.assign(session, {
        status,
        progress_json: progressJson,
        archived_at: statusForArchive === 'archived' ? new Date().toISOString() : session.archived_at,
        updated_at: new Date().toISOString(),
      });
      return { changes: 1 };
    }
    if (normalized.includes("SET status = 'running'")) {
      const [progressJson, sessionId] = params;
      Object.assign(db.sessions.get(sessionId), {
        status: 'running',
        progress_json: progressJson,
        error: null,
        updated_at: new Date().toISOString(),
      });
      return { changes: 1 };
    }
    if (normalized.startsWith('UPDATE research_sessions SET progress_json')) {
      const [progressJson, sessionId] = params;
      Object.assign(db.sessions.get(sessionId), { progress_json: progressJson });
      return { changes: 1 };
    }
    if (normalized.startsWith('INSERT INTO research_evidence_graph')) {
      const [
        nodeId,
        sessionId,
        organizationId,
        sourceClass,
        sourceId,
        sourceTitle,
        sourceUrl,
        quote,
        claim,
        confidence,
        contradiction,
        freshness,
      ] = params;
      db.evidence.push({
        node_id: nodeId,
        session_id: sessionId,
        organization_id: organizationId,
        source_class: sourceClass,
        source_id: sourceId,
        source_title: sourceTitle,
        source_url: sourceUrl,
        quote,
        claim,
        confidence,
        contradiction,
        freshness,
        created_at: new Date().toISOString(),
      });
      return { changes: 1 };
    }
    if (normalized.startsWith('INSERT INTO research_report_artifacts')) {
      const [
        artifactId,
        sessionId,
        organizationId,
        title,
        contentMarkdown,
        citationsJson,
        evidenceNodeIdsJson,
        createdBy,
      ] = params;
      db.artifacts.set(artifactId, {
        artifact_id: artifactId,
        session_id: sessionId,
        organization_id: organizationId,
        artifact_type: 'research_report',
        title,
        content_markdown: contentMarkdown,
        citations_json: citationsJson,
        evidence_node_ids_json: evidenceNodeIdsJson,
        created_by: createdBy,
        created_at: new Date().toISOString(),
      });
      return { changes: 1 };
    }
    if (normalized.includes("SET status = 'completed'")) {
      const [progressJson, artifactId, sessionId] = params;
      Object.assign(db.sessions.get(sessionId), {
        status: 'completed',
        progress_json: progressJson,
        final_artifact_id: artifactId,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      return { changes: 1 };
    }
    if (normalized.includes("SET status = 'failed'")) {
      const [error, progressJson, sessionId] = params;
      Object.assign(db.sessions.get(sessionId), {
        status: 'failed',
        error,
        progress_json: progressJson,
        updated_at: new Date().toISOString(),
      });
      return { changes: 1 };
    }
    if (normalized.includes("SET status = 'paused'")) {
      const [progressJson, sessionId] = params;
      Object.assign(db.sessions.get(sessionId), {
        status: 'paused',
        progress_json: progressJson,
        updated_at: new Date().toISOString(),
      });
      return { changes: 1 };
    }
    throw new Error(`Unhandled dbRun SQL: ${normalized}`);
  },
  get: async (sql: string, params: any[] = []) => {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    if (normalized.includes('FROM research_sessions')) {
      return db.sessions.get(params[0]) || null;
    }
    if (normalized.includes('FROM research_report_artifacts')) {
      return db.artifacts.get(params[0]) || null;
    }
    throw new Error(`Unhandled dbGet SQL: ${normalized}`);
  },
  all: async (sql: string, params: any[] = []) => {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    if (normalized.includes('FROM research_session_events')) {
      return db.events.filter(
        (event) => event.session_id === params[0] && event.organization_id === params[1]
      );
    }
    if (normalized.includes('FROM research_evidence_graph')) {
      return db.evidence.filter(
        (node) => node.session_id === params[0] && node.organization_id === params[1]
      );
    }
    if (normalized.includes('FROM knowledge_docs')) {
      return [
        {
          doc_id: params[0],
          filename: 'Uploaded board memo.pdf',
          filepath: null,
          content: 'Attachment evidence confirms operating controls.',
          chunk_index: 0,
        },
      ];
    }
    if (normalized.includes('FROM research_sessions')) {
      return Array.from(db.sessions.values());
    }
    throw new Error(`Unhandled dbAll SQL: ${normalized}`);
  },
}));

describe('ResearchSession Wave 4 runtime lifecycle', () => {
  beforeEach(() => {
    resetDb();
    researchDeps.runtimeSearch.mockClear();
    researchDeps.modelSelect.mockClear();
    researchDeps.llmCall.mockClear();
    researchDeps.conductDeepResearch.mockClear();
  });

  it('plans, approves, runs and materializes a cited research report artifact', async () => {
    const {
      planResearchSession,
      transitionResearchSession,
      runResearchSession,
      getResearchSession,
    } = await import('../../../server/src/services/researchSessionService.js');

    const planned = await planResearchSession({
      organizationId: 'org-1',
      userId: 'user-1',
      mission: 'Assess AI operating model',
      scope: 'Board-ready research',
      questions: ['What controls are required?'],
      allowedSources: ['web', 'attachment', 'org'],
      attachmentDocIds: ['doc-1'],
    });

    expect(planned.status).toBe('planned');
    expect(planned.allowedSources).toEqual(['web', 'attachment', 'org']);

    const approved = await transitionResearchSession({
      sessionId: planned.sessionId,
      organizationId: 'org-1',
      actorUserId: 'user-1',
      status: 'approved',
    });
    expect(approved.status).toBe('approved');

    const completed = await runResearchSession({
      sessionId: planned.sessionId,
      organizationId: 'org-1',
      actorUserId: 'user-1',
    });

    expect(completed.status).toBe('completed');
    expect(completed.evidenceGraph).toHaveLength(3);
    expect(completed.evidenceGraph[0]).toEqual(
      expect.objectContaining({
        sourceClass: 'web',
        confidence: 0.92,
        freshness: 'fresh',
      })
    );
    expect(completed.evidenceGraph[1].contradiction).toBe(true);
    expect(completed.evidenceGraph[2]).toEqual(
      expect.objectContaining({
        sourceClass: 'attachment',
        sourceTitle: 'Uploaded board memo.pdf',
        confidence: 0.78,
      })
    );
    expect(completed.finalArtifact).toEqual(
      expect.objectContaining({
        artifactType: 'research_report',
        contentMarkdown: expect.stringContaining('## Citations'),
      })
    );
    expect(completed.events.map((event: any) => event.eventType)).toEqual([
      'planned',
      'approved',
      'started',
      'completed',
    ]);

    const reloaded = await getResearchSession(planned.sessionId, 'org-1');
    expect(reloaded.finalArtifact.contentMarkdown).toContain('## Evidence');
  });

  it('keeps cancelled sessions resumable without losing identity', async () => {
    const { planResearchSession, transitionResearchSession, cancelResearchSession } = await import(
      '../../../server/src/services/researchSessionService.js'
    );

    const planned = await planResearchSession({
      organizationId: 'org-1',
      userId: 'user-1',
      mission: 'Research cancellation',
      allowedSources: ['web'],
    });
    await transitionResearchSession({
      sessionId: planned.sessionId,
      organizationId: 'org-1',
      actorUserId: 'user-1',
      status: 'approved',
    });
    const paused = await cancelResearchSession({
      sessionId: planned.sessionId,
      organizationId: 'org-1',
      actorUserId: 'user-1',
    });

    expect(paused.sessionId).toBe(planned.sessionId);
    expect(paused.status).toBe('paused');
    expect(paused.events.at(-1)).toEqual(
      expect.objectContaining({ eventType: 'cancelled', status: 'paused' })
    );
  });

  it('queues approved research in the background without blocking for completion', async () => {
    const {
      planResearchSession,
      transitionResearchSession,
      beginResearchSessionInBackground,
    } = await import('../../../server/src/services/researchSessionService.js');
    let queuedWork: (() => Promise<void>) | null = null;
    const setImmediateSpy = vi
      .spyOn(globalThis, 'setImmediate')
      .mockImplementation(((cb: (...args: any[]) => void) => {
        queuedWork = async () => {
          await cb();
        };
        return 1 as any;
      }) as any);

    const planned = await planResearchSession({
      organizationId: 'org-1',
      userId: 'user-1',
      mission: 'Background research',
      allowedSources: ['web'],
    });
    await transitionResearchSession({
      sessionId: planned.sessionId,
      organizationId: 'org-1',
      actorUserId: 'user-1',
      status: 'approved',
    });

    const queued = await beginResearchSessionInBackground({
      sessionId: planned.sessionId,
      organizationId: 'org-1',
      actorUserId: 'user-1',
    });

    expect(queued.status).toBe('running');
    expect(queued.progress).toEqual(expect.objectContaining({ stage: 'queued', background: true }));
    expect(db.artifacts.size).toBe(0);
    expect(db.events.map((event) => event.event_type)).toContain('background_queued');

    expect(queuedWork).toBeTypeOf('function');
    await queuedWork!();
    setImmediateSpy.mockRestore();

    expect(researchDeps.modelSelect).toHaveBeenCalledWith(
      expect.objectContaining({ capability: 'chat_complex', organizationId: 'org-1' })
    );
    expect(researchDeps.conductDeepResearch).toHaveBeenCalledWith(
      'Background research',
      expect.any(Object),
      expect.objectContaining({
        webSearchService: expect.objectContaining({ search: expect.any(Function) }),
        llmClient: expect.objectContaining({ chat: expect.any(Object) }),
      })
    );
    expect(db.artifacts.size).toBe(1);
  });

  it('keeps the research API mounted as a production route, not a stub route', () => {
    const gateway = readFileSync('server/src/Gateway.ts', 'utf8');
    expect(gateway).toContain("app.use('/api/research', researchRoutes)");
    expect(gateway).not.toContain("mountStub('/api/research'");
    expect(gateway).toContain('recoverInterruptedResearchSessions');
  });

  it('enforces allowedSources by disabling web research and web evidence', async () => {
    const { planResearchSession, transitionResearchSession, runResearchSession } = await import(
      '../../../server/src/services/researchSessionService.js'
    );

    const planned = await planResearchSession({
      organizationId: 'org-1',
      userId: 'user-1',
      mission: 'Attachment-only research',
      allowedSources: ['attachment'],
      attachmentDocIds: ['doc-1'],
    });
    await transitionResearchSession({
      sessionId: planned.sessionId,
      organizationId: 'org-1',
      actorUserId: 'user-1',
      status: 'approved',
    });

    const completed = await runResearchSession({
      sessionId: planned.sessionId,
      organizationId: 'org-1',
      actorUserId: 'user-1',
    });

    const dependencies = researchDeps.conductDeepResearch.mock.calls.at(-1)?.[2];
    expect(dependencies.webSearchService).toBeUndefined();
    expect(completed.evidenceGraph).toHaveLength(1);
    expect(completed.evidenceGraph[0].sourceClass).toBe('attachment');
  });

  it('pauses an active run cooperatively when cancel is requested', async () => {
    const {
      planResearchSession,
      transitionResearchSession,
      runResearchSession,
      cancelResearchSession,
    } = await import('../../../server/src/services/researchSessionService.js');

    const planned = await planResearchSession({
      organizationId: 'org-1',
      userId: 'user-1',
      mission: 'Runtime cancel',
      allowedSources: ['web'],
    });
    await transitionResearchSession({
      sessionId: planned.sessionId,
      organizationId: 'org-1',
      actorUserId: 'user-1',
      status: 'approved',
    });
    researchDeps.conductDeepResearch.mockImplementationOnce(
      async (_topic: string, _options: any, dependencies: any) => {
        await cancelResearchSession({
          sessionId: planned.sessionId,
          organizationId: 'org-1',
          actorUserId: 'user-1',
        });
        dependencies?.onProgress?.({ stage: 'searching', queries: [], round: 1, totalRounds: 1 });
        throw new Error('should not reach after cancellation');
      }
    );

    const paused = await runResearchSession({
      sessionId: planned.sessionId,
      organizationId: 'org-1',
      actorUserId: 'user-1',
    });

    expect(paused.status).toBe('paused');
    expect(paused.events.map((event: any) => event.eventType)).toContain('cancel_requested');
    expect(paused.events.map((event: any) => event.eventType)).toContain('cancelled');
  });

  it('recovers interrupted background sessions after process restart', async () => {
    const {
      planResearchSession,
      transitionResearchSession,
      beginResearchSessionInBackground,
      recoverInterruptedResearchSessions,
    } = await import('../../../server/src/services/researchSessionService.js');
    const setImmediateSpy = vi
      .spyOn(globalThis, 'setImmediate')
      .mockImplementation(((_cb: (...args: any[]) => void) => 1 as any) as any);

    const planned = await planResearchSession({
      organizationId: 'org-1',
      userId: 'user-1',
      mission: 'Recoverable background research',
      allowedSources: ['web'],
    });
    await transitionResearchSession({
      sessionId: planned.sessionId,
      organizationId: 'org-1',
      actorUserId: 'user-1',
      status: 'approved',
    });
    await beginResearchSessionInBackground({
      sessionId: planned.sessionId,
      organizationId: 'org-1',
      actorUserId: 'user-1',
    });

    setImmediateSpy.mockClear();
    const recovered = await recoverInterruptedResearchSessions();
    setImmediateSpy.mockRestore();

    expect(recovered.recovered).toBe(1);
    expect(db.events.map((event) => event.event_type)).toContain('background_recovered');
  });

  it('exposes Wave 4 dock controls for create-session and accepted background polling', () => {
    const dock = readFileSync('src/components/AIChat/ResearchSessionsDock.tsx', 'utf8');
    expect(dock).toContain('Api.createResearchSession');
    expect(dock).toContain('Create planned session');
    expect(dock).toContain('window.setInterval');
    expect(dock).toContain('Background job accepted');
  });
});
