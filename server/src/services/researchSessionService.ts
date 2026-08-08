import { v4 as uuidv4 } from 'uuid';

import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';
import {
  conductDeepResearch,
  type DeepResearchOutput,
  type Source as ResearchSource,
} from './ai/deepResearchService.js';
import {
  buildQaResearchChatResponse,
  buildQaWebSearchResults,
  isQaAiMode,
} from './ai/qaAiRuntime.js';
import { createArtifactContentEnvelope } from './artifacts/contentProjectionService.js';
import { createWave5Artifact } from './wave5ArtifactRuntimeService.js';

export type ResearchSessionStatus =
  | 'planned'
  | 'approved'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'archived';

export interface ResearchSessionPlanInput {
  organizationId: string;
  userId: string;
  projectId?: string | null;
  conversationId?: string | null;
  mission: string;
  scope?: string | null;
  questions?: string[];
  allowedSources?: Array<'web' | 'attachment' | 'product' | 'org'>;
  budget?: Record<string, unknown> | null;
  expectedOutput?: string | null;
  attachmentDocIds?: string[];
}

let schemaReady: Promise<void> | null = null;
const activeResearchControllers = new Map<string, AbortController>();

async function runRequired(sql: string, params: unknown[] = [], label: string): Promise<void> {
  const result = await dbRun(sql, params, { fallback: false });
  if (result && result.success === false) {
    throw new Error(`${label} failed: ${result.error || 'database write was not applied'}`);
  }
}

class ResearchSessionCancelledError extends Error {
  constructor() {
    super('Research session paused by user');
    this.name = 'ResearchSessionCancelledError';
  }
}

function safeJsonParse<T>(raw: unknown, fallback: T): T {
  if (raw == null) return fallback;
  if (typeof raw === 'object') return raw as T;
  try {
    return JSON.parse(String(raw)) as T;
  } catch {
    return fallback;
  }
}

function safeJsonStringify(value: unknown): string {
  try {
    return JSON.stringify(value ?? null);
  } catch {
    return 'null';
  }
}

function normalizeSources(input?: Array<'web' | 'attachment' | 'product' | 'org'>): string[] {
  const allowed = new Set(['web', 'attachment', 'product', 'org']);
  const sources = Array.isArray(input) ? input.filter((item) => allowed.has(item)) : [];
  return sources.length > 0 ? sources : ['web', 'attachment', 'product', 'org'];
}

async function createDefaultResearchDependencies(params: {
  organizationId: string;
}): Promise<NonNullable<Parameters<typeof conductDeepResearch>[2]>> {
  if (isQaAiMode()) {
    return {
      webSearchService: {
        search: async (query: string) => buildQaWebSearchResults(query),
      },
      llmClient: {
        chat: {
          completions: {
            create: async (request: any) => ({
              choices: [{ message: { content: buildQaResearchChatResponse(request) } }],
            }),
          },
        },
      },
    };
  }

  const [{ RuntimeWebSearchService }, modelRouterModule, llmServiceModule] = await Promise.all([
    import('./ai/runtimeWebSearchService.js'),
    import('./ai/modelRouter.js'),
    import('./ai/llmService.js'),
  ]);
  const runtimeSearch = new RuntimeWebSearchService();
  const modelRouter = modelRouterModule.default || modelRouterModule.modelRouter;
  const llmService = llmServiceModule.llmService || llmServiceModule.default;
  const modelCfg = await modelRouter.select({
    capability: 'chat_complex',
    organizationId: params.organizationId,
    options: { tier: 'STANDARD' },
  } as any);

  return {
    webSearchService: {
      search: async (query: string, options: any) => runtimeSearch.search(query, options),
    },
    llmClient: {
      chat: {
        completions: {
          create: async (request: any) => {
            const result = (await llmService.call({
              type: 'chat',
              modelConfig: {
                provider: modelCfg.provider,
                id: modelCfg.id,
                endpoint: (modelCfg as any).endpoint,
                apiKey: (modelCfg as any).apiKey,
              },
              systemPrompt: '',
              messages: request.messages,
              maxTokens: request.max_tokens || 4000,
              temperature: request.temperature ?? 0.35,
            })) as any;

            return {
              choices: [{ message: { content: result?.content || String(result || '') } }],
            };
          },
        },
      },
    },
  };
}

function buildResearchReportMarkdown(params: {
  session: any;
  output: DeepResearchOutput;
  evidenceGraph: any[];
}): string {
  const output = params.output;
  const evidence = params.evidenceGraph;
  const citations = Array.isArray(output.citations) ? output.citations : [];
  const assumptions =
    output.metadata.unsupportedClaimRate && output.metadata.unsupportedClaimRate > 0
      ? ['Some synthesized claims require verification because citation coverage is incomplete.']
      : ['Cited findings are grounded in the evidence listed below.'];
  const risks = evidence
    .filter((node) => node.contradiction)
    .map((node) => `- Potential contradiction: ${node.claim || node.quote || node.sourceTitle}`);

  return [
    `# Research Report: ${params.session.mission}`,
    '',
    '## Executive Summary',
    output.synthesis || output.tavilyAnswer || 'Research completed. See evidence below.',
    '',
    '## Evidence',
    ...evidence.slice(0, 24).map((node, index) => {
      const source = node.sourceUrl || node.sourceTitle || node.sourceId;
      return `${index + 1}. ${node.claim || node.quote || node.sourceTitle} (${node.sourceClass}, confidence ${Math.round((node.confidence || 0) * 100)}%)${source ? ` - ${source}` : ''}`;
    }),
    '',
    '## Assumptions',
    ...assumptions.map((item) => `- ${item}`),
    '',
    '## Risks',
    ...(risks.length > 0
      ? risks
      : ['- No explicit contradictions detected in the collected evidence.']),
    '',
    '## Recommendations',
    '- Review high-confidence evidence first.',
    '- Validate stale or uncited claims before executive use.',
    '- Convert approved findings into Wave 5 artifacts if follow-up work is needed.',
    '',
    '## Citations',
    ...citations.map(
      (citation) => `- [${citation.sourceIndex + 1}] ${citation.title}: ${citation.url}`
    ),
  ].join('\n');
}

function detectContradiction(text: string): boolean {
  return /\b(contradict|conflict|however|although|but|decline|risk|dispute|inconsistent)\b/i.test(
    text
  );
}

function sourceFreshness(source: any): 'fresh' | 'dated' | 'unknown' {
  const raw = source?.publishedDate || source?.accessedAt || null;
  if (!raw) return 'unknown';
  const ts = new Date(raw).getTime();
  if (!Number.isFinite(ts)) return 'unknown';
  const days = Math.abs(Date.now() - ts) / (1000 * 60 * 60 * 24);
  return days <= 365 ? 'fresh' : 'dated';
}

function assertNotCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) throw new ResearchSessionCancelledError();
}

function hasAllowedSource(session: any, source: 'web' | 'attachment' | 'product' | 'org'): boolean {
  const allowed = Array.isArray(session?.allowedSources) ? session.allowedSources : [];
  return allowed.length === 0 || allowed.includes(source);
}

export async function ensureResearchSessionSchema(): Promise<void> {
  if (schemaReady) return schemaReady;
  schemaReady = (async () => {
    await dbRun(`
      CREATE TABLE IF NOT EXISTS research_sessions (
        session_id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        project_id TEXT,
        conversation_id TEXT,
        status TEXT NOT NULL,
        mission TEXT NOT NULL,
        scope TEXT,
        questions_json TEXT NOT NULL DEFAULT '[]',
        allowed_sources_json TEXT NOT NULL DEFAULT '[]',
        budget_json TEXT NOT NULL DEFAULT '{}',
        expected_output TEXT,
        attachment_doc_ids_json TEXT NOT NULL DEFAULT '[]',
        progress_json TEXT NOT NULL DEFAULT '{}',
        final_artifact_id TEXT,
        error TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        completed_at TEXT,
        archived_at TEXT
      )
    `);
    await dbRun(`
      CREATE TABLE IF NOT EXISTS research_session_events (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        organization_id TEXT NOT NULL,
        actor_user_id TEXT,
        event_type TEXT NOT NULL,
        status TEXT NOT NULL,
        details_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await dbRun(`
      CREATE TABLE IF NOT EXISTS research_evidence_graph (
        node_id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        organization_id TEXT NOT NULL,
        source_class TEXT NOT NULL,
        source_id TEXT,
        source_title TEXT,
        source_url TEXT,
        quote TEXT,
        claim TEXT,
        confidence REAL NOT NULL DEFAULT 0.5,
        contradiction INTEGER NOT NULL DEFAULT 0,
        freshness TEXT NOT NULL DEFAULT 'unknown',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await dbRun(`
      CREATE TABLE IF NOT EXISTS research_report_artifacts (
        artifact_id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        organization_id TEXT NOT NULL,
        artifact_type TEXT NOT NULL DEFAULT 'research_report',
        title TEXT NOT NULL,
        content_markdown TEXT NOT NULL,
        citations_json TEXT NOT NULL DEFAULT '[]',
        evidence_node_ids_json TEXT NOT NULL DEFAULT '[]',
        wave5_artifact_id TEXT,
        created_by TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await dbRun(
      `ALTER TABLE research_sessions ADD COLUMN IF NOT EXISTS final_artifact_id TEXT`
    ).catch(() => undefined);
    await dbRun(`ALTER TABLE research_sessions ADD COLUMN IF NOT EXISTS error TEXT`).catch(
      () => undefined
    );
    await dbRun(`ALTER TABLE research_sessions ADD COLUMN IF NOT EXISTS completed_at TEXT`).catch(
      () => undefined
    );
    await dbRun(`ALTER TABLE research_sessions ADD COLUMN IF NOT EXISTS archived_at TEXT`).catch(
      () => undefined
    );
    await dbRun(
      `ALTER TABLE research_report_artifacts ADD COLUMN IF NOT EXISTS wave5_artifact_id TEXT`
    ).catch(() => undefined);
    const contentContractColumns = [
      "ALTER TABLE research_report_artifacts ADD COLUMN IF NOT EXISTS canonical_format TEXT DEFAULT 'markdown'",
      'ALTER TABLE research_report_artifacts ADD COLUMN IF NOT EXISTS content_json_native TEXT',
      'ALTER TABLE research_report_artifacts ADD COLUMN IF NOT EXISTS content_schema_version TEXT',
      "ALTER TABLE research_report_artifacts ADD COLUMN IF NOT EXISTS markdown_projection_status TEXT DEFAULT 'synced'",
      'ALTER TABLE research_report_artifacts ADD COLUMN IF NOT EXISTS markdown_projected_at TEXT',
      'ALTER TABLE research_report_artifacts ADD COLUMN IF NOT EXISTS projection_error TEXT',
    ];
    for (const statement of contentContractColumns) {
      await dbRun(statement).catch(() => undefined);
    }
    await dbRun(
      `CREATE INDEX IF NOT EXISTS idx_research_sessions_org_status ON research_sessions(organization_id, status)`
    );
    await dbRun(
      `CREATE INDEX IF NOT EXISTS idx_research_evidence_session ON research_evidence_graph(session_id)`
    );
  })().catch((err) => {
    schemaReady = null;
    throw err;
  });
  return schemaReady;
}

async function recordEvent(params: {
  sessionId: string;
  organizationId: string;
  actorUserId?: string | null;
  eventType: string;
  status: ResearchSessionStatus;
  details?: Record<string, unknown>;
}): Promise<void> {
  await dbRun(
    `INSERT INTO research_session_events
      (id, session_id, organization_id, actor_user_id, event_type, status, details_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      uuidv4(),
      params.sessionId,
      params.organizationId,
      params.actorUserId || null,
      params.eventType,
      params.status,
      safeJsonStringify(params.details || {}),
    ]
  );
}

function mapSession(row: any, events: any[] = [], evidence: any[] = [], artifact: any = null): any {
  if (!row) return null;
  return {
    sessionId: row.session_id,
    organizationId: row.organization_id,
    userId: row.user_id,
    projectId: row.project_id || null,
    conversationId: row.conversation_id || null,
    status: row.status,
    mission: row.mission,
    scope: row.scope || null,
    questions: safeJsonParse<string[]>(row.questions_json, []),
    allowedSources: safeJsonParse<string[]>(row.allowed_sources_json, []),
    budget: safeJsonParse<Record<string, unknown>>(row.budget_json, {}),
    expectedOutput: row.expected_output || null,
    attachmentDocIds: safeJsonParse<string[]>(row.attachment_doc_ids_json, []),
    progress: safeJsonParse<Record<string, unknown>>(row.progress_json, {}),
    finalArtifactId: row.final_artifact_id || null,
    error: row.error || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at || null,
    archivedAt: row.archived_at || null,
    events,
    evidenceGraph: evidence,
    finalArtifact: artifact,
  };
}

export async function planResearchSession(input: ResearchSessionPlanInput): Promise<any> {
  if (!input.organizationId || !input.userId) {
    throw new Error('Research session requires organizationId and userId');
  }
  await ensureResearchSessionSchema();
  const sessionId = `rs-${uuidv4()}`;
  await runRequired(
    `INSERT INTO research_sessions (
      session_id, organization_id, user_id, project_id, conversation_id, status,
      mission, scope, questions_json, allowed_sources_json, budget_json,
      expected_output, attachment_doc_ids_json, progress_json
    ) VALUES (?, ?, ?, ?, ?, 'planned', ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      sessionId,
      input.organizationId,
      input.userId,
      input.projectId || null,
      input.conversationId || null,
      input.mission,
      input.scope || null,
      safeJsonStringify(input.questions || []),
      safeJsonStringify(normalizeSources(input.allowedSources)),
      safeJsonStringify(input.budget || {}),
      input.expectedOutput || 'research_report',
      safeJsonStringify(input.attachmentDocIds || []),
      safeJsonStringify({ stage: 'planned', percent: 0 }),
    ],
    'insert research_session'
  );
  await recordEvent({
    sessionId,
    organizationId: input.organizationId,
    actorUserId: input.userId,
    eventType: 'planned',
    status: 'planned',
    details: { mission: input.mission, allowedSources: normalizeSources(input.allowedSources) },
  });
  const session = await getResearchSession(sessionId, input.organizationId);
  if (!session) {
    throw new Error('Research session was created but could not be read back');
  }
  return session;
}

export async function transitionResearchSession(params: {
  sessionId: string;
  organizationId: string;
  actorUserId: string;
  status: ResearchSessionStatus;
  eventType?: string;
  details?: Record<string, unknown>;
}): Promise<any> {
  await ensureResearchSessionSchema();
  const current = await getResearchSession(params.sessionId, params.organizationId);
  if (!current) throw new Error('Research session not found');
  await dbRun(
    `UPDATE research_sessions
     SET status = ?, progress_json = ?, error = NULL, updated_at = CURRENT_TIMESTAMP
     WHERE session_id = ? AND organization_id = ?`,
    [
      params.status,
      safeJsonStringify({ ...(current.progress || {}), stage: params.status }),
      params.sessionId,
      params.organizationId,
    ]
  );
  if (params.status === 'archived') {
    await dbRun(
      `UPDATE research_sessions
       SET archived_at = CURRENT_TIMESTAMP
       WHERE session_id = ? AND organization_id = ?`,
      [params.sessionId, params.organizationId]
    ).catch((err: any) => {
      logger.warn(
        '[ResearchSession] Failed to persist archived_at during archive transition',
        err?.message || String(err)
      );
    });
  }
  await recordEvent({
    sessionId: params.sessionId,
    organizationId: params.organizationId,
    actorUserId: params.actorUserId,
    eventType: params.eventType || params.status,
    status: params.status,
    details: params.details,
  });
  return getResearchSession(params.sessionId, params.organizationId);
}

export async function runResearchSession(params: {
  sessionId: string;
  organizationId: string;
  actorUserId: string;
  dependencies?: Parameters<typeof conductDeepResearch>[2];
  alreadyQueued?: boolean;
  signal?: AbortSignal;
}): Promise<any> {
  await ensureResearchSessionSchema();
  const session = await getResearchSession(params.sessionId, params.organizationId);
  if (!session) throw new Error('Research session not found');
  if (!['approved', 'paused', 'failed'].includes(session.status) && !params.alreadyQueued) {
    throw new Error(`Research session is ${session.status}, not approved/runnable`);
  }
  if (session.status === 'running' && !params.alreadyQueued) {
    throw new Error('Research session is already running');
  }

  const controller = params.signal ? null : new AbortController();
  const signal = params.signal || controller?.signal;
  if (controller) activeResearchControllers.set(params.sessionId, controller);
  const baseDependencies =
    params.dependencies ||
    (await createDefaultResearchDependencies({
      organizationId: params.organizationId,
    }));
  const effectiveDependencies = { ...baseDependencies };
  if (!hasAllowedSource(session, 'web')) {
    delete (effectiveDependencies as any).webSearchService;
  }

  await dbRun(
    `UPDATE research_sessions
     SET status = 'running', progress_json = ?, error = NULL, updated_at = CURRENT_TIMESTAMP
     WHERE session_id = ? AND organization_id = ?`,
    [
      safeJsonStringify({
        ...(session.progress || {}),
        stage: 'running',
        percent: 10,
        background: Boolean((session.progress || {}).background),
        heartbeatAt: new Date().toISOString(),
      }),
      params.sessionId,
      params.organizationId,
    ]
  );
  await recordEvent({
    sessionId: params.sessionId,
    organizationId: params.organizationId,
    actorUserId: params.actorUserId,
    eventType:
      session.status === 'paused' ? 'resumed' : session.status === 'failed' ? 'retried' : 'started',
    status: 'running',
  });

  try {
    assertNotCancelled(signal);
    const output = await conductDeepResearch(
      session.mission,
      {
        clarificationAnswers: Object.fromEntries(
          (session.questions || []).map((question: string, index: number) => [
            `q${index + 1}`,
            question,
          ])
        ),
      },
      {
        ...effectiveDependencies,
        onProgress: (progress) => {
          assertNotCancelled(signal);
          baseDependencies?.onProgress?.(progress);
          dbRun(
            `UPDATE research_sessions SET progress_json = ?, updated_at = CURRENT_TIMESTAMP
             WHERE session_id = ? AND organization_id = ?`,
            [
              safeJsonStringify({
                ...progress,
                stage: progress.stage || 'running',
                heartbeatAt: new Date().toISOString(),
              }),
              params.sessionId,
              params.organizationId,
            ]
          ).catch((err: any) =>
            logger.warn('[ResearchSession] Failed to persist progress', err?.message || String(err))
          );
        },
      }
    );
    assertNotCancelled(signal);
    const evidenceGraph = await persistEvidenceGraph({
      sessionId: params.sessionId,
      organizationId: params.organizationId,
      output,
      includeWeb: hasAllowedSource(session, 'web'),
    });
    const attachmentEvidenceGraph = hasAllowedSource(session, 'attachment')
      ? await persistAttachmentEvidenceNodes({
          session,
          organizationId: params.organizationId,
        })
      : [];
    const combinedEvidenceGraph = [...evidenceGraph, ...attachmentEvidenceGraph];
    const artifact = await createFinalResearchArtifact({
      session,
      output,
      evidenceGraph: combinedEvidenceGraph,
      actorUserId: params.actorUserId,
    });
    await dbRun(
      `UPDATE research_sessions
       SET status = 'completed', progress_json = ?, final_artifact_id = ?,
           completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE session_id = ? AND organization_id = ?`,
      [
        safeJsonStringify({
          stage: 'complete',
          percent: 100,
          totalSources: output.metadata.totalSources,
          citationCount: output.metadata.citationCount,
        }),
        artifact.artifactId,
        params.sessionId,
        params.organizationId,
      ]
    );
    await recordEvent({
      sessionId: params.sessionId,
      organizationId: params.organizationId,
      actorUserId: params.actorUserId,
      eventType: 'completed',
      status: 'completed',
      details: { artifactId: artifact.artifactId, evidenceNodes: combinedEvidenceGraph.length },
    });
    return getResearchSession(params.sessionId, params.organizationId);
  } catch (err: any) {
    if (err instanceof ResearchSessionCancelledError || signal?.aborted) {
      await dbRun(
        `UPDATE research_sessions
         SET status = 'paused', progress_json = ?, updated_at = CURRENT_TIMESTAMP
         WHERE session_id = ? AND organization_id = ?`,
        [
          safeJsonStringify({
            ...(session.progress || {}),
            stage: 'paused',
            percent: Number((session.progress || {}).percent || 10),
            cancelledAt: new Date().toISOString(),
            resumable: true,
          }),
          params.sessionId,
          params.organizationId,
        ]
      );
      await recordEvent({
        sessionId: params.sessionId,
        organizationId: params.organizationId,
        actorUserId: params.actorUserId,
        eventType: 'cancelled',
        status: 'paused',
        details: { resumable: true, runtimeAbort: true },
      });
      return getResearchSession(params.sessionId, params.organizationId);
    }
    await dbRun(
      `UPDATE research_sessions
       SET status = 'failed', error = ?, progress_json = ?, updated_at = CURRENT_TIMESTAMP
       WHERE session_id = ? AND organization_id = ?`,
      [
        err?.message || String(err),
        safeJsonStringify({ stage: 'failed', error: err?.message || String(err) }),
        params.sessionId,
        params.organizationId,
      ]
    );
    await recordEvent({
      sessionId: params.sessionId,
      organizationId: params.organizationId,
      actorUserId: params.actorUserId,
      eventType: 'failed',
      status: 'failed',
      details: { error: err?.message || String(err) },
    });
    throw err;
  } finally {
    activeResearchControllers.delete(params.sessionId);
  }
}

export async function cancelResearchSession(params: {
  sessionId: string;
  organizationId: string;
  actorUserId: string;
}): Promise<any> {
  const controller = activeResearchControllers.get(params.sessionId);
  controller?.abort();
  return transitionResearchSession({
    ...params,
    status: 'paused',
    eventType: controller ? 'cancel_requested' : 'cancelled',
    details: { resumable: true, runtimeAbort: Boolean(controller) },
  });
}

export async function beginResearchSessionInBackground(params: {
  sessionId: string;
  organizationId: string;
  actorUserId: string;
  dependencies?: Parameters<typeof conductDeepResearch>[2];
}): Promise<any> {
  await ensureResearchSessionSchema();
  const session = await getResearchSession(params.sessionId, params.organizationId);
  if (!session) throw new Error('Research session not found');
  if (!['approved', 'paused', 'failed'].includes(session.status)) {
    throw new Error(`Research session is ${session.status}, not approved/runnable`);
  }

  await dbRun(
    `UPDATE research_sessions
     SET status = 'running', progress_json = ?, error = NULL, updated_at = CURRENT_TIMESTAMP
     WHERE session_id = ? AND organization_id = ?`,
    [
      safeJsonStringify({
        stage: 'queued',
        percent: 5,
        background: true,
        jobId: `research-job-${uuidv4()}`,
        queuedAt: new Date().toISOString(),
        heartbeatAt: new Date().toISOString(),
      }),
      params.sessionId,
      params.organizationId,
    ]
  );
  await recordEvent({
    sessionId: params.sessionId,
    organizationId: params.organizationId,
    actorUserId: params.actorUserId,
    eventType: 'background_queued',
    status: 'running',
    details: { background: true },
  });

  setImmediate(async () => {
    try {
      const dependencies =
        params.dependencies ||
        (await createDefaultResearchDependencies({
          organizationId: params.organizationId,
        }));
      await runResearchSession({ ...params, dependencies, alreadyQueued: true });
    } catch (err: any) {
      await dbRun(
        `UPDATE research_sessions
         SET status = 'failed', error = ?, progress_json = ?, updated_at = CURRENT_TIMESTAMP
         WHERE session_id = ? AND organization_id = ?`,
        [
          err?.message || String(err),
          safeJsonStringify({ stage: 'failed', error: err?.message || String(err) }),
          params.sessionId,
          params.organizationId,
        ]
      ).catch(() => undefined);
      await recordEvent({
        sessionId: params.sessionId,
        organizationId: params.organizationId,
        actorUserId: params.actorUserId,
        eventType: 'failed',
        status: 'failed',
        details: { error: err?.message || String(err), phase: 'background_start' },
      }).catch(() => undefined);
      logger.error('[ResearchSession] Background run failed', {
        sessionId: params.sessionId,
        error: err?.message || String(err),
      });
    }
  });

  return getResearchSession(params.sessionId, params.organizationId);
}

export async function recoverInterruptedResearchSessions(): Promise<{ recovered: number }> {
  await ensureResearchSessionSchema();
  const rows = await dbAll(
    `SELECT * FROM research_sessions
     WHERE status = 'running'
     ORDER BY updated_at ASC
     LIMIT 25`,
    []
  ).catch(() => []);
  let recovered = 0;
  for (const row of rows || []) {
    const session = mapSession(row);
    const progress = session?.progress || {};
    if (!session || !progress.background || activeResearchControllers.has(session.sessionId)) {
      continue;
    }
    recovered += 1;
    await recordEvent({
      sessionId: session.sessionId,
      organizationId: session.organizationId,
      actorUserId: 'system',
      eventType: 'background_recovered',
      status: 'running',
      details: { previousJobId: progress.jobId || null },
    });
    setImmediate(async () => {
      try {
        const dependencies = await createDefaultResearchDependencies({
          organizationId: session.organizationId,
        });
        await runResearchSession({
          sessionId: session.sessionId,
          organizationId: session.organizationId,
          actorUserId: 'system',
          dependencies,
          alreadyQueued: true,
        });
      } catch (err: any) {
        logger.error('[ResearchSession] Recovery run failed', {
          sessionId: session.sessionId,
          error: err?.message || String(err),
        });
      }
    });
  }
  return { recovered };
}

export async function persistEvidenceGraph(params: {
  sessionId: string;
  organizationId: string;
  output: DeepResearchOutput;
  includeWeb?: boolean;
}): Promise<any[]> {
  const nodes: any[] = [];
  if (params.includeWeb === false) return nodes;
  const sources = Array.isArray(params.output.sources) ? params.output.sources : [];
  const citations = Array.isArray(params.output.citations) ? params.output.citations : [];
  for (const citation of citations.length > 0
    ? citations
    : sources.map((source, index) => ({
        sourceIndex: index,
        text: source.snippets?.[0] || source.title,
        title: source.title,
        url: source.url,
      }))) {
    const source: Partial<ResearchSource> = sources[citation.sourceIndex] || {};
    const quote = String(citation.text || source.snippets?.[0] || source.title || '').slice(
      0,
      1200
    );
    const claim = quote || String(source.title || 'Evidence source');
    const node = {
      nodeId: `eg-${uuidv4()}`,
      sessionId: params.sessionId,
      organizationId: params.organizationId,
      sourceClass: source.url ? 'web' : 'attachment',
      sourceId: source.url || source.title || null,
      sourceTitle: citation.title || source.title || null,
      sourceUrl: citation.url || source.url || null,
      quote,
      claim,
      confidence: Math.max(0.1, Math.min(1, Number(source.relevanceScore || 0.7))),
      contradiction: detectContradiction(`${claim} ${quote}`),
      freshness: sourceFreshness(source),
    };
    await dbRun(
      `INSERT INTO research_evidence_graph (
        node_id, session_id, organization_id, source_class, source_id, source_title,
        source_url, quote, claim, confidence, contradiction, freshness
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        node.nodeId,
        node.sessionId,
        node.organizationId,
        node.sourceClass,
        node.sourceId,
        node.sourceTitle,
        node.sourceUrl,
        node.quote,
        node.claim,
        node.confidence,
        node.contradiction ? 1 : 0,
        node.freshness,
      ]
    );
    nodes.push(node);
  }
  return nodes;
}

export async function persistAttachmentEvidenceNodes(params: {
  session: any;
  organizationId: string;
}): Promise<any[]> {
  const attachmentDocIds = Array.isArray(params.session.attachmentDocIds)
    ? params.session.attachmentDocIds
    : [];
  if (attachmentDocIds.length === 0) return [];

  const nodes: any[] = [];
  for (const docId of attachmentDocIds) {
    const rows = await dbAll(
      `SELECT d.id AS doc_id, d.filename, d.filepath, c.content, c.chunk_index
       FROM knowledge_docs d
       LEFT JOIN knowledge_chunks c ON c.doc_id = d.id
       WHERE d.id = ?
       ORDER BY c.chunk_index ASC
       LIMIT 20`,
      [docId]
    ).catch(() => []);
    const effectiveRows =
      rows && rows.length > 0
        ? rows
        : [
            {
              doc_id: docId,
              filename: `Attachment ${docId}`,
              filepath: null,
              content:
                'Attachment was included in the research scope but no extractable chunk was found.',
              chunk_index: 0,
            },
          ];

    for (const row of effectiveRows as any[]) {
      const quote = String(row.content || '').slice(0, 1200);
      const node = {
        nodeId: `eg-${uuidv4()}`,
        sessionId: params.session.sessionId,
        organizationId: params.organizationId,
        sourceClass: 'attachment',
        sourceId: row.doc_id || docId,
        sourceTitle: row.filename || `Attachment ${docId}`,
        sourceUrl: row.filepath || null,
        quote,
        claim: quote || row.filename || `Attachment ${docId}`,
        confidence: quote ? 0.78 : 0.35,
        contradiction: detectContradiction(quote),
        freshness: 'unknown',
      };
      await dbRun(
        `INSERT INTO research_evidence_graph (
          node_id, session_id, organization_id, source_class, source_id, source_title,
          source_url, quote, claim, confidence, contradiction, freshness
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          node.nodeId,
          node.sessionId,
          node.organizationId,
          node.sourceClass,
          node.sourceId,
          node.sourceTitle,
          node.sourceUrl,
          node.quote,
          node.claim,
          node.confidence,
          node.contradiction ? 1 : 0,
          node.freshness,
        ]
      );
      nodes.push(node);
    }
  }
  return nodes;
}

export async function createFinalResearchArtifact(params: {
  session: any;
  output: DeepResearchOutput;
  evidenceGraph: any[];
  actorUserId: string;
}): Promise<any> {
  const artifactId = `research-artifact-${uuidv4()}`;
  const title = `Research Report: ${params.session.mission}`.slice(0, 240);
  const content = buildResearchReportMarkdown(params);
  const contentEnvelope = createArtifactContentEnvelope({
    artifactType: 'research_report',
    canonicalFormat: 'markdown',
    contentMd: content,
  });
  await dbRun(
    `INSERT INTO research_report_artifacts (
      artifact_id, session_id, organization_id, artifact_type, title,
      content_markdown, canonical_format, content_schema_version, markdown_projection_status,
      markdown_projected_at, projection_error, citations_json, evidence_node_ids_json, created_by
    ) VALUES (?, ?, ?, 'research_report', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      artifactId,
      params.session.sessionId,
      params.session.organizationId,
      title,
      content,
      contentEnvelope.canonicalFormat,
      contentEnvelope.contentSchemaVersion || null,
      contentEnvelope.markdownProjectionStatus,
      contentEnvelope.markdownProjectedAt || null,
      contentEnvelope.projectionError || null,
      safeJsonStringify(params.output.citations || []),
      safeJsonStringify(params.evidenceGraph.map((node) => node.nodeId)),
      params.actorUserId,
    ]
  );
  const wave5Artifact = await createWave5Artifact({
    organizationId: params.session.organizationId,
    userId: params.actorUserId,
    artifactType: 'research_report',
    title,
    content,
    canonicalFormat: 'markdown',
    contentMd: content,
    researchSessionId: params.session.sessionId,
    citations: params.output.citations || [],
    sourceRefs: params.evidenceGraph.map((node) => ({
      sourceClass: node.sourceClass,
      sourceId: node.sourceId,
      sourceTitle: node.sourceTitle,
      sourceUrl: node.sourceUrl,
      evidenceNodeId: node.nodeId,
    })),
    metadata: {
      mirroredFrom: 'research_report_artifacts',
      researchArtifactId: artifactId,
    },
    externalArtifactId: artifactId,
  });
  await dbRun(`UPDATE research_report_artifacts SET wave5_artifact_id = ? WHERE artifact_id = ?`, [
    wave5Artifact.artifactId,
    artifactId,
  ]);
  return {
    artifactId,
    wave5ArtifactId: wave5Artifact.artifactId,
    artifactType: 'research_report',
    title,
    contentMarkdown: content,
    contentEnvelope,
    citations: params.output.citations || [],
    evidenceNodeIds: params.evidenceGraph.map((node) => node.nodeId),
  };
}

export async function getResearchSession(
  sessionId: string,
  organizationId: string
): Promise<any | null> {
  await ensureResearchSessionSchema();
  const row = await dbGet(
    `SELECT * FROM research_sessions WHERE session_id = ? AND organization_id = ?`,
    [sessionId, organizationId]
  );
  if (!row) return null;
  const events = await dbAll(
    `SELECT id, event_type, status, actor_user_id, details_json, created_at
     FROM research_session_events
     WHERE session_id = ? AND organization_id = ?
     ORDER BY created_at ASC`,
    [sessionId, organizationId]
  );
  const evidence = await dbAll(
    `SELECT node_id, source_class, source_id, source_title, source_url, quote, claim,
            confidence, contradiction, freshness, created_at
     FROM research_evidence_graph
     WHERE session_id = ? AND organization_id = ?
     ORDER BY created_at ASC`,
    [sessionId, organizationId]
  );
  const artifact = row.final_artifact_id
    ? await dbGet(
        `SELECT artifact_id, artifact_type, title, content_markdown, canonical_format,
                content_json_native, content_schema_version, markdown_projection_status,
                markdown_projected_at, projection_error, citations_json,
                evidence_node_ids_json, wave5_artifact_id, created_at
         FROM research_report_artifacts
         WHERE artifact_id = ? AND organization_id = ?`,
        [row.final_artifact_id, organizationId]
      )
    : null;
  return mapSession(
    row,
    (events || []).map((event: any) => ({
      id: event.id,
      eventType: event.event_type,
      status: event.status,
      actorUserId: event.actor_user_id,
      details: safeJsonParse<Record<string, unknown>>(event.details_json, {}),
      createdAt: event.created_at,
    })),
    (evidence || []).map((node: any) => ({
      nodeId: node.node_id,
      sourceClass: node.source_class,
      sourceId: node.source_id,
      sourceTitle: node.source_title,
      sourceUrl: node.source_url,
      quote: node.quote,
      claim: node.claim,
      confidence: Number(node.confidence || 0),
      contradiction: Number(node.contradiction || 0) === 1,
      freshness: node.freshness,
      createdAt: node.created_at,
    })),
    artifact
      ? (() => {
          const contentEnvelope = createArtifactContentEnvelope({
            artifactType: (artifact as any).artifact_type,
            canonicalFormat: (artifact as any).canonical_format || 'markdown',
            contentMd: (artifact as any).content_markdown,
            contentJson: safeJsonParse((artifact as any).content_json_native, undefined),
            contentSchemaVersion: (artifact as any).content_schema_version || undefined,
          });
          return {
            artifactId: (artifact as any).artifact_id,
            artifactType: (artifact as any).artifact_type,
            title: (artifact as any).title,
            contentMarkdown: (artifact as any).content_markdown,
            contentEnvelope,
            canonicalFormat: contentEnvelope.canonicalFormat,
            contentMd: contentEnvelope.contentMd,
            contentJson: contentEnvelope.contentJson,
            markdownProjectionStatus:
              (artifact as any).markdown_projection_status ||
              contentEnvelope.markdownProjectionStatus,
            markdownProjectedAt:
              (artifact as any).markdown_projected_at ||
              contentEnvelope.markdownProjectedAt ||
              null,
            projectionError:
              (artifact as any).projection_error || contentEnvelope.projectionError || null,
            citations: safeJsonParse((artifact as any).citations_json, []),
            evidenceNodeIds: safeJsonParse((artifact as any).evidence_node_ids_json, []),
            wave5ArtifactId: (artifact as any).wave5_artifact_id || null,
            createdAt: (artifact as any).created_at,
          };
        })()
      : null
  );
}

export async function listResearchSessions(params: {
  organizationId: string;
  userId?: string | null;
  status?: string | null;
  limit?: number;
}): Promise<any[]> {
  await ensureResearchSessionSchema();
  const filters = ['organization_id = ?'];
  const values: unknown[] = [params.organizationId];
  if (params.userId) {
    filters.push('user_id = ?');
    values.push(params.userId);
  }
  if (params.status) {
    filters.push('status = ?');
    values.push(params.status);
  }
  values.push(Math.min(Math.max(params.limit || 50, 1), 200));
  const rows = await dbAll(
    `SELECT * FROM research_sessions
     WHERE ${filters.join(' AND ')}
     ORDER BY updated_at DESC
     LIMIT ?`,
    values
  );
  return (rows || []).map((row: any) => mapSession(row));
}
