/**
 * P27-B Integration Tests — Tools Session → Result → Promotion
 *
 * Tests cover:
 * 1. Session lifecycle (DRAFT → IN_PROGRESS → REVIEW → FINALIZED)
 * 2. Status transition validation (invalid transitions rejected)
 * 3. Finalize gating (unresolved blockers block FINALIZED)
 * 4. Wizard state + missing items persistence
 * 5. Failure state + retry
 * 6. Idempotent initiative generation
 * 7. Promotion to report/presentation with traceability
 * 8. Regression: existing CRUD + governance flow
 */

import express, { type Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const sqliteCtx = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const sqlite3 = require('sqlite3') as typeof import('sqlite3');
  return { db: new sqlite3.Database(':memory:') };
});
const sqlAll = <T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> =>
  new Promise((resolve, reject) => sqliteCtx.db.all(sql, params, (e, rows) => e ? reject(e) : resolve((rows || []) as T[])));
const sqlGet = <T = unknown>(sql: string, params: unknown[] = []): Promise<T | null> =>
  new Promise((resolve, reject) => sqliteCtx.db.get(sql, params, (e, row) => e ? reject(e) : resolve((row || null) as T | null)));
const sqlRun = (sql: string, params: unknown[] = []): Promise<{ changes: number }> =>
  new Promise((resolve, reject) => sqliteCtx.db.run(sql, params, function (this: { changes: number }, e) { e ? reject(e) : resolve({ changes: this.changes }); }));

vi.mock('../../../server/src/utils/queryHelpers.js', () => ({
  queryAll: (sql: string, params: unknown[] = []) => sqlAll(sql, params),
  queryOne: (sql: string, params: unknown[] = []) => sqlGet(sql, params),
  queryRun: (sql: string, params: unknown[] = []) => sqlRun(sql, params),
  getTableColumns: (table: string) => sqlAll<{ name: string }>(`PRAGMA table_info(${String(table).replace(/[^a-zA-Z0-9_]/g, '')})`),
}));
vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  default: (req: any, _res: any, next: () => void) => { req.user = { id: 'p27-user', role: 'ADMIN', organizationId: 'p27-org', isSuperAdmin: false }; req.userId = 'p27-user'; req.organizationId = 'p27-org'; next(); },
  verifyToken: (req: any, _res: any, next: () => void) => { req.user = { id: 'p27-user', role: 'ADMIN', organizationId: 'p27-org', isSuperAdmin: false }; req.userId = 'p27-user'; req.organizationId = 'p27-org'; next(); },
}));
vi.mock('../../../server/src/middleware/rbac.middleware.js', () => ({ requireOrgAccess: () => (_req: any, _res: any, next: () => void) => next() }));
vi.mock('../../../server/src/middleware/demoGuard.middleware.js', () => ({ demoContextMiddleware: (_req: any, _res: any, next: () => void) => next() }));
vi.mock('../../../server/src/middleware/rateLimiting.middleware.js', () => ({ apiAuthRateLimiter: (_req: any, _res: any, next: () => void) => next() }));
vi.mock('../../../server/src/services/KnownToolsService.js', () => ({ default: { getKnownToolAvailability: vi.fn().mockResolvedValue({ exists: false, isActive: false }), listKnownTools: vi.fn().mockResolvedValue({ items: [], total: 0 }) } }));
vi.mock('../../../server/src/services/organizationContext/OrganizationContextService.js', () => ({ default: { recordToolSession: vi.fn().mockResolvedValue(undefined) } }));
vi.mock('../../../server/src/services/permissionService.js', () => ({ hasPermission: vi.fn().mockResolvedValue(true) }));
vi.mock('../../../server/src/services/conclusions/toolConclusionBridge.js', () => ({ safePersistToolSessionConclusion: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../../server/src/services/ToolInitiativeService.js', () => ({ default: { generateFromSession: vi.fn().mockResolvedValue([]), persistInitiatives: vi.fn().mockResolvedValue([]) } }));
vi.mock('../../../server/src/services/initiative/createInitiativeService.js', () => ({ createInitiative: vi.fn().mockResolvedValue({ id: 'p27-initiative' }) }));
vi.mock('../../../server/src/services/v8/artifactRegistryService.js', () => ({
  registerArtifactOrigin: vi.fn().mockImplementation(async (input: any) => ({ id: input.originRecordId })),
  mapPresentationStatusToDeliveryState: vi.fn().mockReturnValue('ready'),
  deriveArtifactVisibilityScope: vi.fn().mockReturnValue('organization'),
}));
vi.mock('../../../server/src/services/reportBuilderService.js', () => ({
  createReport: vi.fn().mockImplementation(async (input: any) => ({
    report: { id: 'p27-report', organizationId: input.organizationId, title: input.title },
    sections: (input.sections || []).map((section: any, index: number) => ({
      id: `p27-report-section-${index}`,
      reportId: 'p27-report',
      ...section,
    })),
  })),
  getReport: vi.fn().mockResolvedValue({ id: 'p27-report' }),
}));

let app: Express;
const previousDbType = process.env.DB_TYPE;
const previousDatabaseUrl = process.env.DATABASE_URL;

const post = async (path: string, body?: any) => {
  const res = await request(app).post(`/api${path}`).send(body);
  return { status: res.status, data: res.body };
};

const put = async (path: string, body: any) => {
  // Production updates are CAS-protected. This legacy suite predates the
  // version field, so resolve the mounted route's current version before each
  // write instead of silently exercising the old unconditional-update shape.
  const toolId = path.split('/')[2];
  const current = await sqlGet<{ version: number; status: string; tool_type: string }>(
    `SELECT version, status, tool_type FROM tool_sessions WHERE id = ?`,
    [toolId]
  );
  const payload = { ...body };
  if (payload.status === current?.status) delete payload.status;
  if (current?.tool_type === 'dynamic-swot' && payload.status === 'FINALIZED' && payload.answers) {
    const items = (payload.answers.items || []).map((item: any, index: number) => ({
      ...item,
      id: item.id || `p27-item-${index}`,
      text: item.text || item.content,
      impact: item.impact || 'high',
      proposalStatus: 'accepted',
      evidenceStatus: 'confirmed',
    }));
    payload.answers = {
      ...payload.answers,
      items,
      tensions: [{ id: 'p27-tension', title: 'Strategic response', type: 'attack', linkedItemIds: items.map((item: any) => item.id), linkedCorrelationIds: [], insight: 'Use confirmed strengths to address the opportunity.' }],
      recommendedMoves: [{ id: 'p27-move', title: 'Execute bounded response', category: 'quick-win', rationale: 'The confirmed evidence supports a bounded response.', linkedTensionIds: ['p27-tension'], linkedItemIds: items.map((item: any) => item.id), expectedImpact: 'high', estimatedEffort: 'medium', firstStep: 'Assign an owner and success measure.', ownerRole: 'Strategy Lead', tradeoff: { chosen: 'Bounded response', deferred: 'Broad rollout', cost: 'Focused capacity' }, rejectedAlternative: { option: 'Do nothing', reason: 'Leaves confirmed opportunity unused' } }],
    };
  }
  const res = await request(app)
    .put(`/api${path}`)
    .send({ ...payload, expectedVersion: body.expectedVersion ?? Number(current?.version ?? 1) });
  return { status: res.status, data: res.body };
};

const get = async (path: string) => {
  const res = await request(app).get(`/api${path}`);
  return { status: res.status, data: res.body };
};

describe('P27-B: Tools Session → Result → Promotion', () => {
  let strategicSessionId: string;
  let operationalSessionId: string;

  beforeAll(async () => {
    process.env.DB_TYPE = 'sqlite';
    delete process.env.DATABASE_URL;
    await sqlRun(`CREATE TABLE permissions (key TEXT PRIMARY KEY, description TEXT, category TEXT)`);
    await sqlRun(`CREATE TABLE role_permissions (id TEXT PRIMARY KEY, role TEXT, permission_key TEXT)`);
    await sqlRun(`CREATE TABLE decisions (id TEXT PRIMARY KEY, organization_id TEXT, project_id TEXT, initiative_id TEXT, task_id TEXT, title TEXT, description TEXT, type TEXT, decision_maker_id TEXT, deadline TEXT, escalation_deadline TEXT, status TEXT, created_by TEXT, priority TEXT, impact TEXT, escalation_level TEXT, pmo_domain TEXT, required INTEGER, created_at TEXT, updated_at TEXT)`);
    await sqlRun(`CREATE TABLE decision_history (id TEXT PRIMARY KEY, decision_id TEXT, action TEXT, old_status TEXT, new_status TEXT, changed_by TEXT, details TEXT)`);
    await sqlRun(`CREATE TABLE initiatives (id TEXT PRIMARY KEY, organization_id TEXT, project_id TEXT, name TEXT, title TEXT, summary TEXT, status TEXT, axis TEXT, source_type TEXT, source_id TEXT, priority_order INTEGER, created_at TEXT, updated_at TEXT)`);
    await sqlRun(`CREATE TABLE my_ideas (id TEXT PRIMARY KEY, user_id TEXT, organization_id TEXT, title TEXT, body TEXT, tags TEXT, source_type TEXT, source_pack_json TEXT, created_at TEXT, updated_at TEXT)`);
    await sqlRun(`CREATE TABLE tool_outputs (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, project_id TEXT, tool_session_id TEXT NOT NULL, tool_type TEXT NOT NULL, method_pack_version TEXT NOT NULL, version INTEGER DEFAULT 1, supersedes_id TEXT, title TEXT NOT NULL, payload_json TEXT NOT NULL, content_hash TEXT NOT NULL, status TEXT DEFAULT 'draft', created_by TEXT, created_at TEXT, approved_by TEXT, approved_at TEXT, frozen_at TEXT)`);
    await sqlRun(`CREATE TABLE tool_output_approvals (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, tool_output_id TEXT NOT NULL, action TEXT NOT NULL, actor_kind TEXT, actor_user_id TEXT, comment TEXT, created_at TEXT)`);
    await sqlRun(`CREATE TABLE tool_output_initiative_proposals (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, tool_output_id TEXT NOT NULL, source_conclusion_id TEXT NOT NULL, proposed_title TEXT NOT NULL, rationale TEXT, status TEXT, initiative_id TEXT, created_by TEXT, created_at TEXT, decided_by TEXT, decided_at TEXT)`);
    await sqlRun(`CREATE TABLE tool_reports (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, project_id TEXT, kind TEXT, title TEXT, renderer_version TEXT, theme TEXT, payload_json TEXT, content_hash TEXT, status TEXT, generation_attempts INTEGER, last_error TEXT, created_by TEXT, created_at TEXT, updated_at TEXT)`);
    await sqlRun(`CREATE TABLE tool_report_sources (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, tool_report_id TEXT, tool_output_id TEXT, sort_order INTEGER, created_at TEXT)`);
    await sqlRun(`CREATE TABLE report_builder_reports (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, project_id TEXT, source_type TEXT, source_id TEXT, source_name TEXT, source_framework TEXT, title TEXT, description TEXT, report_type TEXT, config_json TEXT, company_context_json TEXT, status TEXT, created_by TEXT, created_at TEXT, updated_at TEXT, updated_by TEXT, version INTEGER DEFAULT 1)`);
    await sqlRun(`CREATE TABLE report_builder_sections (id TEXT PRIMARY KEY, report_id TEXT NOT NULL, section_key TEXT, section_type TEXT, title TEXT, order_index INTEGER, enabled INTEGER, required INTEGER, length TEXT, language TEXT, content_format TEXT, generated_content TEXT, edited_content TEXT, generated_at TEXT, render_kind TEXT, source_refs_json TEXT, created_at TEXT, updated_at TEXT)`);
    await sqlRun(`CREATE TABLE presentation_decks (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, project_id TEXT, title TEXT, description TEXT, deck_type TEXT, theme TEXT, slide_count INTEGER, status TEXT, source_type TEXT, source_id TEXT, source_refs_json TEXT, deck_json TEXT, unified_json TEXT, created_by TEXT, generated_by TEXT, version INTEGER, created_at TEXT, updated_at TEXT)`);
    await sqlRun(`CREATE TABLE presentation_cards (id TEXT PRIMARY KEY, deck_id TEXT, card_index INTEGER, intent TEXT, blocks_json TEXT, created_at TEXT, updated_at TEXT)`);
    const { default: toolsRoutes } = await import('../../../server/src/routes/tools.routes.js');
    app = express();
    app.use(express.json());
    app.use('/api/tools', toolsRoutes);
    app.use((error: any, _req: any, res: any, _next: any) => res.status(Number(error?.status) || 500).json({ error: String(error?.message || 'Unexpected test server failure'), code: error?.code }));
  });

  afterAll(async () => {
    if (previousDbType === undefined) delete process.env.DB_TYPE;
    else process.env.DB_TYPE = previousDbType;
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
    await new Promise<void>((resolve) => sqliteCtx.db.close(() => resolve()));
  });

  // ─────────────────────────────────────────────
  // Archetype 1: Strategic tool (dynamic-swot)
  // ─────────────────────────────────────────────

  describe('Archetype 1: Strategic (dynamic-swot)', () => {
    it('creates a new tool session in DRAFT status', async () => {
      const { status, data } = await post('/tools', {
        toolType: 'dynamic-swot',
        name: 'P27-B Test SWOT Session',
      });
      expect(status, JSON.stringify(data)).toBe(200);
      expect(data.id).toBeTruthy();
      expect(data.status).toBe('DRAFT');
      strategicSessionId = data.id;
    });

    it('transitions DRAFT → IN_PROGRESS with wizard state', async () => {
      const { status, data } = await put(`/tools/${strategicSessionId}`, {
        answers: { context: { goal: 'Test strategic question' } },
        completionPercent: 20,
        confidenceAvg: 2,
        status: 'IN_PROGRESS',
        wizardState: { currentStep: 'input', completedSteps: ['mission'] },
      });
      expect(status, JSON.stringify(data)).toBe(200);
      expect(data.status).toBe('IN_PROGRESS');
    });

    it('persists wizard state and missing items', async () => {
      const { status, data } = await put(`/tools/${strategicSessionId}`, {
        answers: { context: { goal: 'Test', scope: 'Global' } },
        completionPercent: 50,
        confidenceAvg: 3,
        status: 'IN_PROGRESS',
        wizardState: { currentStep: 'swot', completedSteps: ['mission', 'input'] },
        missingItems: [
          { id: 'mi-1', label: 'Missing SWOT items', severity: 'blocker', resolved: false },
          { id: 'mi-2', label: 'Needs more evidence', severity: 'warning', resolved: true },
        ],
      });
      expect(status, JSON.stringify(data)).toBe(200);

      const { data: session } = await get(`/tools/${strategicSessionId}`);
      expect(session.wizardState).toBeTruthy();
      expect(session.wizardState.currentStep).toBe('swot');
      expect(session.missingItems).toHaveLength(2);
      expect(session.missingItems[0].severity).toBe('blocker');
    });

    it('blocks FINALIZED when unresolved blockers exist', async () => {
      const { status, data } = await put(`/tools/${strategicSessionId}`, {
        answers: { context: { goal: 'Test', scope: 'Global' } },
        completionPercent: 100,
        confidenceAvg: 4,
        status: 'FINALIZED',
        missingItems: [
          { id: 'mi-1', label: 'Missing SWOT items', severity: 'blocker', resolved: false },
        ],
      });
      expect(status).toBe(409);
      expect(data.error).toContain('unresolved missing items');
      expect(data.unresolvedMissingItems).toHaveLength(1);
    });

    it('blocks FINALIZED when any missing item remains unresolved', async () => {
      const { status, data } = await put(`/tools/${strategicSessionId}`, {
        answers: {
          context: { goal: 'Test strategic question', scope: 'Global', successSignal: 'KPI up' },
          signals: [{ id: 's1', content: 'Market growth' }],
          items: [
            { quadrant: 'strengths', content: 'Strong brand' },
            { quadrant: 'weaknesses', content: 'High costs' },
            { quadrant: 'opportunities', content: 'New market' },
            { quadrant: 'threats', content: 'Competition' },
          ],
        },
        completionPercent: 100,
        confidenceAvg: 4,
        status: 'FINALIZED',
        missingItems: [
          { id: 'mi-1', label: 'Needs evidence', severity: 'warning', resolved: false },
        ],
      });
      expect(status).toBe(409);
      expect(data.unresolvedMissingItems).toHaveLength(1);
    });

    it('allows FINALIZED when all missing items are resolved', async () => {
      const { status, data } = await put(`/tools/${strategicSessionId}`, {
        answers: {
          context: { goal: 'Test strategic question', scope: 'Global', successSignal: 'KPI up' },
          signals: [{ id: 's1', content: 'Market growth' }],
          items: [
            { quadrant: 'strengths', content: 'Strong brand' },
            { quadrant: 'weaknesses', content: 'High costs' },
            { quadrant: 'opportunities', content: 'New market' },
            { quadrant: 'threats', content: 'Competition' },
          ],
        },
        completionPercent: 100,
        confidenceAvg: 4,
        status: 'FINALIZED',
        missingItems: [
          { id: 'mi-1', label: 'Missing SWOT items', severity: 'blocker', resolved: true },
          { id: 'mi-2', label: 'Needs evidence', severity: 'warning', resolved: true },
        ],
      });
      expect(status, JSON.stringify(data)).toBe(200);
      expect(data.status).toBe('FINALIZED');
    });

    it('rejects invalid status transitions', async () => {
      const { status, data } = await put(`/tools/${strategicSessionId}`, {
        answers: {},
        completionPercent: 100,
        confidenceAvg: 4,
        status: 'DRAFT',
      });
      expect(status).toBe(409);
      expect(data.error).toContain('Invalid status transition');
    });
  });

  // ─────────────────────────────────────────────
  // Archetype 2: Operational tool (sop-builder)
  // ─────────────────────────────────────────────

  describe('Archetype 2: Operational (sop-builder)', () => {
    it('creates an operational tool session', async () => {
      const { status, data } = await post('/tools', {
        toolType: 'sop-builder',
        name: 'P27-B Test SOP Session',
      });
      expect(status, JSON.stringify(data)).toBe(200);
      expect(data.id).toBeTruthy();
      operationalSessionId = data.id;
    });

    it('full lifecycle: DRAFT → IN_PROGRESS → REVIEW → back to DRAFT → REVIEW', async () => {
      // DRAFT → IN_PROGRESS
      let result = await put(`/tools/${operationalSessionId}`, {
        answers: { context: { goal: 'Standardize onboarding', scope: 'HR dept' } },
        completionPercent: 30,
        confidenceAvg: 2,
        status: 'IN_PROGRESS',
      });
      expect(result.status).toBe(200);
      expect(result.data.status).toBe('IN_PROGRESS');

      // IN_PROGRESS → REVIEW
      result = await put(`/tools/${operationalSessionId}`, {
        answers: {
          context: { goal: 'Standardize onboarding', scope: 'HR dept' },
          sections: { steps: ['Step 1', 'Step 2'] },
        },
        completionPercent: 100,
        confidenceAvg: 4,
        status: 'REVIEW',
      });
      expect(result.status).toBe(200);
      expect(result.data.status).toBe('REVIEW');

      // REVIEW → DRAFT (send back)
      result = await put(`/tools/${operationalSessionId}`, {
        answers: {
          context: { goal: 'Standardize onboarding', scope: 'HR dept' },
          sections: { steps: ['Step 1', 'Step 2'] },
        },
        completionPercent: 100,
        confidenceAvg: 4,
        status: 'DRAFT',
      });
      expect(result.status).toBe(200);
      expect(result.data.status).toBe('DRAFT');
    });
  });

  // ─────────────────────────────────────────────
  // Failure + Retry
  // ─────────────────────────────────────────────

  describe('Failure state + retry', () => {
    let failSessionId: string;

    it('creates session and transitions to FAILED', async () => {
      const { data } = await post('/tools', {
        toolType: 'dynamic-swot',
        name: 'P27-B Failure Test',
      });
      failSessionId = data.id;

      const result = await put(`/tools/${failSessionId}`, {
        answers: {},
        completionPercent: 50,
        confidenceAvg: 2,
        status: 'FAILED',
        failureReason: 'AI generation timed out',
      });
      expect(result.status).toBe(200);
      expect(result.data.status).toBe('FAILED');
    });

    it('persists failure reason', async () => {
      const { data } = await get(`/tools/${failSessionId}`);
      expect(data.status).toBe('FAILED');
      expect(data.failureReason).toBe('AI generation timed out');
    });

    it('retries from FAILED → IN_PROGRESS', async () => {
      const { status, data } = await post(`/tools/${failSessionId}/retry`);
      expect(status, JSON.stringify(data)).toBe(200);
      expect(data.status).toBe('IN_PROGRESS');
    });

    it('retry clears failure reason', async () => {
      const { data } = await get(`/tools/${failSessionId}`);
      expect(data.status).toBe('IN_PROGRESS');
      expect(data.failureReason).toBeNull();
    });

    it('rejects retry when not in FAILED state', async () => {
      const { status, data } = await post(`/tools/${failSessionId}/retry`);
      expect(status).toBe(409);
      expect(data.error).toContain('not in FAILED state');
    });
  });

  // ─────────────────────────────────────────────
  // Promotion to report/presentation
  // ─────────────────────────────────────────────

  describe('Promotion to downstream outputs', () => {
    it('rejects promotion for non-approved session', async () => {
      const { data } = await post('/tools', {
        toolType: 'dynamic-swot',
        name: 'P27-B Promotion Test',
      });
      const { status, data: result } = await post(`/tools/${data.id}/promote`, {
        outputType: 'report',
        title: 'Test Report',
      });
      expect(status).toBe(409);
      expect(result.error).toContain('approved/finalized');
    });

    it('promotes FINALIZED session to report with traceability', async () => {
      const { status, data } = await post(`/tools/${strategicSessionId}/promote`, {
        outputType: 'report',
        title: 'SWOT Analysis Report',
        description: 'Generated from strategic SWOT session',
      });
      expect(status, JSON.stringify(data)).toBe(200);
      expect(data.id).toBeTruthy();
      expect(data.outputType).toBe('report');
      expect(data.sourceSessionId).toBe(strategicSessionId);
      expect(data.sourceToolType).toBe('dynamic-swot');
    });

    it('promotes FINALIZED session to presentation', async () => {
      const { status, data } = await post(`/tools/${strategicSessionId}/promote`, {
        outputType: 'presentation',
        title: 'SWOT Strategy Deck',
      });
      expect(status, JSON.stringify(data)).toBe(200);
      expect(data.outputType).toBe('presentation');
      expect(data.sourceSessionId).toBe(strategicSessionId);
    });

    it('blocks promotion when unresolved missing items reappear', async () => {
      const { data: createdSession } = await post('/tools', {
        toolType: 'dynamic-swot',
        name: 'P27-B Promotion Gate Test',
      });
      const gatedSessionId = createdSession.id;

      const started = await put(`/tools/${gatedSessionId}`, {
        answers: { context: { goal: 'Test strategic question' } },
        completionPercent: 20,
        confidenceAvg: 2,
        status: 'IN_PROGRESS',
      });
      expect(started.status).toBe(200);

      const update = await put(`/tools/${gatedSessionId}`, {
        answers: {
          context: { goal: 'Test strategic question', scope: 'Global', successSignal: 'KPI up' },
          items: [
            { quadrant: 'strengths', content: 'Strong brand' },
            { quadrant: 'weaknesses', content: 'High costs' },
            { quadrant: 'opportunities', content: 'New market' },
            { quadrant: 'threats', content: 'Competition' },
          ],
        },
        completionPercent: 100,
        confidenceAvg: 4,
        status: 'FINALIZED',
        missingItems: [{ id: 'mi-x', label: 'Resolve open issue', severity: 'blocker', resolved: true }],
      });
      expect(update.status, JSON.stringify(update.data)).toBe(200);

      const reopen = await put(`/tools/${gatedSessionId}`, {
        answers: {
          context: { goal: 'Test strategic question', scope: 'Global', successSignal: 'KPI up' },
          items: [
            { quadrant: 'strengths', content: 'Strong brand' },
            { quadrant: 'weaknesses', content: 'High costs' },
            { quadrant: 'opportunities', content: 'New market' },
            { quadrant: 'threats', content: 'Competition' },
          ],
        },
        completionPercent: 100,
        confidenceAvg: 4,
        status: 'FINALIZED',
        missingItems: [{ id: 'mi-x', label: 'Resolve open issue', severity: 'blocker', resolved: false }],
      });
      expect(reopen.status).toBe(409);

      const afterRejectedWrite = await get(`/tools/${gatedSessionId}`);
      expect(afterRejectedWrite.status).toBe(200);
      expect(afterRejectedWrite.data.missingItems[0].resolved).toBe(true);
    });

    it('promotes FINALIZED session to initiative idempotently with traceability', async () => {
      const first = await post(`/tools/${strategicSessionId}/promote`, {
        outputType: 'initiative',
        title: 'SWOT Initiative',
        description: 'Generated from wizard-compatible finalized tool session',
      });
      expect(first.status, JSON.stringify(first.data)).toBe(200);
      expect(first.data.outputType).toBe('initiative');
      expect(first.data.sourceSessionId).toBe(strategicSessionId);
      expect(first.data.sourceVersion).toBeGreaterThanOrEqual(1);

      const second = await post(`/tools/${strategicSessionId}/promote`, {
        outputType: 'initiative',
        title: 'SWOT Initiative',
        description: 'Generated from wizard-compatible finalized tool session',
      });
      expect(second.status).toBe(200);
      expect(second.data.id).toBe(first.data.id);
      expect(second.data.deduplicated).toBe(true);
    });

    it('rejects invalid outputType', async () => {
      const { status } = await post(`/tools/${strategicSessionId}/promote`, {
        outputType: 'spreadsheet',
        title: 'Invalid',
      });
      expect(status).toBe(400);
    });
  });

  // ─────────────────────────────────────────────
  // Regression: existing CRUD + governance
  // ─────────────────────────────────────────────

  describe('Regression: existing endpoints', () => {
    it('GET /tools returns session list', async () => {
      const { status, data } = await get('/tools');
      expect(status).toBe(200);
      expect(data.items).toBeDefined();
      expect(data.total).toBeGreaterThanOrEqual(0);
    });

    it('GET /tools/hub returns sessions + library', async () => {
      const { status, data } = await get('/tools/hub');
      expect(status).toBe(200);
      expect(data.sessions).toBeDefined();
      expect(data.library).toBeDefined();
    });

    it('GET /tools/:id returns full session with new P27-B fields', async () => {
      if (!strategicSessionId) return;
      const { status, data } = await get(`/tools/${strategicSessionId}`);
      expect(status, JSON.stringify(data)).toBe(200);
      expect(data.id).toBe(strategicSessionId);
      expect(data).toHaveProperty('wizardState');
      expect(data).toHaveProperty('missingItems');
      expect(data).toHaveProperty('failureReason');
      expect(data).toHaveProperty('lastGenerationBatchId');
    });

    it('GET /tools/:id/dod-check returns DoD status', async () => {
      if (!strategicSessionId) return;
      const { status, data } = await get(`/tools/${strategicSessionId}/dod-check`);
      expect(status).toBe(200);
      expect(data).toHaveProperty('passed');
      expect(data).toHaveProperty('missing');
    });

    it('returns 404 for non-existent session', async () => {
      const { status } = await get('/tools/non-existent-id');
      expect(status).toBe(404);
    });
  });

  // ─────────────────────────────────────────────
  // Session reopen (context preserved)
  // ─────────────────────────────────────────────

  describe('Session reopen (context preserved)', () => {
    it('reopened session preserves all data', async () => {
      if (!strategicSessionId) return;
      const { data } = await get(`/tools/${strategicSessionId}`);
      expect(data.answers).toBeTruthy();
      expect(data.answers.context?.goal).toBeTruthy();
      expect(data.wizardState).toBeTruthy();
      expect(data.progress).toBe(100);
      expect(data.confidenceAvg).toBe(4);
    });
  });
});
