import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: any) => {
    const userId = String(req.headers['x-user-id'] || 'user-1');
    const organizationId = String(req.headers['x-org-id'] || 'org-1');
    const role = String(req.headers['x-user-role'] || 'ADMIN');
    req.userId = userId;
    req.organizationId = organizationId;
    req.userRole = role;
    req.user = { id: userId, organizationId, role };
    req.can = (capability: string) => req.headers['x-deny-capability'] !== capability;
    next();
  },
}));

const dbGetMock = vi.fn();
const dbAllMock = vi.fn();
const dbRunMock = vi.fn();

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  get: (...args: any[]) => dbGetMock(...args),
  all: (...args: any[]) => dbAllMock(...args),
  run: (...args: any[]) => dbRunMock(...args),
}));

// SEC-M02-3 (L-10a): canvas capability checks now resolve through
// effectiveAccessService (the SSOT the panel consults), not legacy req.can.
// Default-allow; individual tests drive `hasEffectiveCapability` to deny.
const hasEffectiveCapabilityMock = vi.fn((_access: any, _capability: string) => true);
vi.mock('../../../server/src/services/effectiveAccessService.js', () => ({
  resolveEffectiveAccess: vi.fn(async () => ({ capabilities: [] })),
  hasEffectiveCapability: (...args: any[]) => hasEffectiveCapabilityMock(...args),
}));

// M01-P07C (M01-033, "atomic Idea materialization"): idea materialization
// (services/canvasMaterialize.ts's `materializeWorkspaceTarget`, used by both
// POST /drafts/:id/save-to-workspace and POST /proposals/:id/approve for
// target=idea) now pins ONE PostgreSQL connection via `withPgTransaction`
// instead of going through DbPromise.run()'s pool, so the idea + idea-map +
// receipt writes are genuinely atomic (see dbDynamic.ts's insertDynamicTx
// doc comment for the M01-033 bug this closes: two independent pool
// connections meant a crash between the two INSERTs could leave an idea
// with no map). That path is invisible to the dbGetMock/dbAllMock/dbRunMock
// triad above — without this mock, any target=idea write here hits a real
// pg.Pool.connect() with no live database, which is what turns into a 500.
// This is a lightweight in-memory relational fake, not a rewrite of the
// real thing: it understands exactly the statement shapes
// materializeWorkspaceTarget's idea branch issues (SAVEPOINT / ROLLBACK TO
// SAVEPOINT, generic INSERT INTO <table> (...), and the specific SELECTs it
// runs for idempotency replay + read-back) — enough to exercise the real
// route/service/materializer code honestly, without a live Postgres.
const pgTxQueryMock = vi.fn();
vi.mock('../../../server/src/database/PostgresDatabase.js', () => ({
  withPgTransaction: async (fn: (query: typeof pgTxQueryMock) => Promise<unknown>) =>
    fn(pgTxQueryMock),
}));

const tableColumns: Record<string, string[]> = {
  my_ideas: [
    'id',
    'user_id',
    'organization_id',
    'title',
    'body',
    'seed_text',
    'stage',
    'source_type',
    'source_conversation_id',
    'source_message_id',
    'created_at',
    'updated_at',
  ],
  my_idea_maps: [
    'id',
    'idea_id',
    'user_id',
    'organization_id',
    'nodes_json',
    'edges_json',
    'schema_version',
    'extensions_json',
    'created_at',
    'updated_at',
  ],
  notebook_pages: [
    'id',
    'owner_user_id',
    'organization_id',
    'visibility',
    'title',
    'content_json',
    'content_text',
    'tags_json',
    'status',
    'capture_source',
    'capture_metadata',
    'created_at',
    'updated_at',
  ],
  initiatives: [
    'id',
    'organization_id',
    'created_by',
    'name',
    'summary',
    'status',
    'source_type',
    'source_id',
    'created_at',
    'updated_at',
  ],
  presentation_decks: [
    'id',
    'organization_id',
    'created_by',
    'title',
    'deck_type',
    'theme',
    'slide_count',
    'status',
    'source_id',
    'source_refs_json',
    'created_at',
    'updated_at',
  ],
  presentation_cards: [
    'id',
    'deck_id',
    'card_index',
    'intent',
    'blocks_json',
    'created_at',
    'updated_at',
  ],
};

vi.mock('../../../server/src/utils/dbSchema.js', () => ({
  getTableColumns: (table: string) => new Set(tableColumns[table] || ['id']),
}));

import workCanvasRouter from '../../../server/src/routes/work-canvas.routes.js';

const draftRow = {
  id: 'draft-1',
  organization_id: 'org-1',
  created_by: 'user-1',
  conversation_id: 'conv-1',
  kind: 'document',
  title: 'Canvas Strategy',
  content_json: JSON.stringify('# Canvas Strategy\n\n## Context\n\nBuild the operating workspace.'),
  canonical_format: 'markdown',
  content_md: '# Canvas Strategy\n\n## Context\n\nBuild the operating workspace.',
  content_json_native: null,
  blocks_json: null,
  content_schema_version: null,
  markdown_projection_status: 'synced',
  markdown_projected_at: null,
  projection_error: null,
  sources_json: '[]',
  provenance_json: '{}',
  project_id: null,
  owner_id: 'user-1',
  research_session_id: null,
  artifact_id: null,
  artifact_run_id: null,
  artifact_version: null,
  save_state: 'saved',
  lifecycle_state: 'draft',
  dirty_state: 'clean',
  visibility: 'private',
  audit_status: 'not_required',
  created_at: '2026-05-03T00:00:00.000Z',
  updated_at: '2026-05-03T00:00:00.000Z',
};

const proposalRow = {
  id: 'proposal-1',
  draft_id: 'draft-1',
  organization_id: 'org-1',
  created_by: 'user-1',
  target: 'idea',
  title: 'Idea: Canvas Strategy',
  summary: 'Proposal generated from canvas draft draft-1.',
  status: 'proposed',
  payload_json: '{}',
  required_capability: 'canvas.convert.idea',
  target_object_id: null,
  read_back_json: null,
  audit_event_id: null,
  created_at: '2026-05-03T00:00:00.000Z',
  updated_at: '2026-05-03T00:00:00.000Z',
};

describe('work canvas routes', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/work-canvas', workCanvasRouter);

  // In-memory tables the pgTxQueryMock (idea materialization) writes to and
  // reads back from — reset every test so idempotency-key replay tests don't
  // leak rows into the next test.
  let pgTables: Record<string, Array<Record<string, unknown>>>;

  // Stateful `work_canvas_proposals` row, seeded fresh from `proposalRow`
  // every test and mutated by the UPDATE statements approveProposal() issues
  // (claim -> executing, decided -> approved, or revert -> proposed on
  // failure). approveProposal() legitimately re-fetches the proposal via
  // getProposal() THREE times in the happy path — once in the route
  // handler's capability check, once as `existing` at the top of
  // approveProposal, and once as `decided` (the row actually returned to the
  // caller) after the final UPDATE — exactly like a real Postgres connection
  // would give read-your-writes consistency across all three SELECTs. A
  // single `dbGetMock.mockResolvedValueOnce(proposalRow)` only ever answers
  // the FIRST of those three calls; the 2nd and 3rd used to silently fall
  // through to the unrelated `draftRow` default below, corrupting `target`/
  // `status`/`readBack` on the object the test actually asserts against.
  // This stateful table (mirroring the pgTables pattern already used for
  // pgTxQueryMock) makes every SELECT see the same, up-to-date row instead.
  let proposalsTable: Record<string, unknown>;

  beforeEach(() => {
    vi.clearAllMocks();
    proposalsTable = { ...proposalRow };
    // assertCanvasIdeaReceiptSchema() (canvasMaterialize.ts) runs a plain
    // dbGet/dbAllGlobal preflight — through this same DbPromise mock, NOT
    // pgTxQueryMock — checking the receipt table + its two indexes exist
    // before any idea materialization proceeds. Real dbGetMock/dbAllMock
    // calls are otherwise driven per-test via mockResolvedValueOnce, which
    // takes priority over these defaults; only the first-ever idea
    // materialization in the whole file actually exercises this preflight
    // (it memoizes module-globally in canvasMaterialize.ts), but every test
    // must tolerate the possibility of being that first one.
    dbGetMock.mockImplementation(async (sql: unknown, params: unknown[] = []) => {
      if (
        typeof sql === 'string' &&
        sql.includes('information_schema.tables') &&
        sql.includes('canvas_idea_materialization_receipts')
      ) {
        return { table_name: 'canvas_idea_materialization_receipts' };
      }
      // approveProposal()'s three getProposal() calls (route capability
      // check, `existing`, `decided`) all land here — see proposalsTable's
      // doc comment above for why this must be read-your-writes stateful
      // rather than a one-shot queued value.
      if (typeof sql === 'string' && sql.includes('FROM work_canvas_proposals')) {
        const [proposalId, organizationId] = params as [string, string];
        if (proposalId === proposalsTable.id && organizationId === proposalsTable.organization_id) {
          return { ...proposalsTable };
        }
        return null;
      }
      // confirmTargetObjectReadBack('idea', ...) — the independent,
      // post-materialize confirmation approveProposal() runs before ever
      // reporting a proposal 'approved' (see workCanvasService.ts's
      // CANVAS_HANDOFF_READBACK_MISSING comment). In production this reads
      // `my_ideas` over a genuinely different pooled connection than the
      // pinned `withPgTransaction` connection that wrote it — the mock
      // reflects that same split (dbGetMock vs. pgTxQueryMock) while still
      // sourcing from the ONE shared `pgTables.my_ideas` fake, so this
      // confirmation is a real check against what was actually inserted,
      // not a vacuous pass against an unrelated fixture row.
      if (typeof sql === 'string' && sql.includes('FROM my_ideas WHERE')) {
        const [id, organizationId] = params as [string, string];
        const match = pgTables.my_ideas.find(
          (r) => r.id === id && r.organization_id === organizationId
        );
        return match ? { id: match.id } : null;
      }
      return draftRow;
    });
    dbAllMock.mockImplementation(async (sql: unknown) => {
      if (
        typeof sql === 'string' &&
        sql.includes('pg_indexes') &&
        sql.includes('canvas_idea_materialization_receipts')
      ) {
        return [
          { indexname: 'idx_canvas_idea_receipts_org_idem' },
          { indexname: 'idx_canvas_idea_receipts_idea_id' },
        ];
      }
      return [];
    });
    dbRunMock.mockImplementation(async (sql: unknown, params: unknown[] = []) => {
      // Mirrors the three UPDATE work_canvas_proposals statements
      // approveProposal() issues (claim to 'executing', final decided
      // update to 'approved', or revert back to 'proposed' on failure) onto
      // proposalsTable, so the next dbGetMock read-your-writes SELECT above
      // sees the mutation — same rationale as proposalsTable's doc comment.
      if (typeof sql === 'string') {
        // \s+ (not literal spaces) between tokens: approveProposal()'s final
        // "decided" UPDATE wraps SET onto its own line
        // (`UPDATE work_canvas_proposals\n     SET status = ?, ...`), unlike
        // the single-line CAS claim UPDATE — a literal-space regex silently
        // matches the claim UPDATE but not this one, leaving proposalsTable
        // stuck at 'executing' with a null readBack after a real 200
        // response (caught by this file's own negative-control instinct:
        // the claim-only case was NOT a false pass, it just masked this one).
        const updateMatch = sql.match(/^UPDATE\s+work_canvas_proposals\s+SET\s+(.+?)\s+WHERE/is);
        if (updateMatch) {
          let paramIdx = 0;
          for (const assignment of updateMatch[1].split(',')) {
            const [rawCol, rawVal] = assignment.split('=').map((s) => s.trim());
            proposalsTable[rawCol] = rawVal === '?' ? params[paramIdx++] : rawVal.replace(/^'(.*)'$/, '$1');
          }
        }
      }
      return { changes: 1 };
    });
    hasEffectiveCapabilityMock.mockReturnValue(true);

    pgTables = {
      canvas_idea_materialization_receipts: [],
      my_ideas: [],
      my_idea_maps: [],
    };
    pgTxQueryMock.mockReset();
    pgTxQueryMock.mockImplementation(async (sql: string, params: unknown[] = []) => {
      const trimmed = sql.trim();
      if (/^SAVEPOINT\b/i.test(trimmed) || /^ROLLBACK TO SAVEPOINT\b/i.test(trimmed)) {
        return { rows: [], rowCount: 0 };
      }
      const insertMatch = trimmed.match(/^INSERT INTO (\w+)\s*\(([^)]+)\)/i);
      if (insertMatch) {
        const table = insertMatch[1];
        const columns = insertMatch[2].split(',').map((c) => c.trim());
        const row: Record<string, unknown> = {};
        columns.forEach((col, i) => {
          row[col] = params[i];
        });
        (pgTables[table] ||= []).push(row);
        return { rows: [], rowCount: 1 };
      }
      if (/FROM canvas_idea_materialization_receipts/i.test(trimmed)) {
        const [organizationId, idempotencyKey] = params as [string, string];
        const match = pgTables.canvas_idea_materialization_receipts.find(
          (r) => r.organization_id === organizationId && r.idempotency_key === idempotencyKey
        );
        return { rows: match ? [match] : [], rowCount: match ? 1 : 0 };
      }
      if (/FROM my_ideas WHERE/i.test(trimmed)) {
        const [id, organizationId] = params as [string, string];
        const match = pgTables.my_ideas.find(
          (r) => r.id === id && r.organization_id === organizationId
        );
        return { rows: match ? [match] : [], rowCount: match ? 1 : 0 };
      }
      if (/FROM my_idea_maps WHERE/i.test(trimmed)) {
        const [id, organizationId] = params as [string, string];
        const match = pgTables.my_idea_maps.find(
          (r) => r.id === id && r.organization_id === organizationId
        );
        return { rows: match ? [match] : [], rowCount: match ? 1 : 0 };
      }
      throw new Error(`work-canvas.routes.test.ts pgTxQueryMock: unhandled query: ${trimmed}`);
    });
  });

  it('persists researchSessionId when creating a research Canvas draft', async () => {
    const response = await request(app)
      .post('/api/work-canvas/drafts')
      .send({
        conversationId: 'conv-1',
        kind: 'research',
        title: 'Market Research Brief',
        contentMd: '# Market Research Brief',
        researchSessionId: 'rs-canvas-1',
      })
      .expect(201);

    expect(response.body.data).toMatchObject({
      kind: 'research',
      title: 'Market Research Brief',
      researchSessionId: 'rs-canvas-1',
    });
    expect(dbRunMock).toHaveBeenCalledWith(
      expect.stringContaining('research_session_id'),
      expect.arrayContaining(['rs-canvas-1']),
      { fallback: false }
    );
  });

  it('rejects stale Canvas draft saves with a recoverable conflict', async () => {
    const response = await request(app)
      .put('/api/work-canvas/drafts/draft-1')
      .send({
        baseUpdatedAt: '2026-05-02T00:00:00.000Z',
        title: 'Stale save',
        contentMd: '# Stale save',
      })
      .expect(409);

    expect(response.body).toMatchObject({
      code: 'CANVAS_DRAFT_CONFLICT',
      recoverable: true,
      action: 'save_draft',
      data: {
        currentDraft: {
          id: 'draft-1',
          updatedAt: draftRow.updated_at,
        },
        baseUpdatedAt: '2026-05-02T00:00:00.000Z',
      },
    });
    const mutationCalls = dbRunMock.mock.calls.filter(([sql]) =>
      /^\s*(INSERT|UPDATE|DELETE)\b/i.test(String(sql))
    );
    expect(mutationCalls).toEqual([]);
  });

  it('rejects stale Canvas operations before applying mutations', async () => {
    const response = await request(app)
      .post('/api/work-canvas/drafts/draft-1/operations')
      .send({
        baseUpdatedAt: '2026-05-02T00:00:00.000Z',
        operation: {
          type: 'append_section',
          heading: 'Next',
          contentMd: 'Should not apply',
        },
      })
      .expect(409);

    expect(response.body).toMatchObject({
      code: 'CANVAS_DRAFT_CONFLICT',
      recoverable: true,
      action: 'apply_operation',
    });
    expect(dbRunMock).not.toHaveBeenCalled();
  });

  it('rejects stale Canvas version restore requests before restoring', async () => {
    const response = await request(app)
      .post('/api/work-canvas/drafts/draft-1/versions/version-1/restore')
      .send({ baseUpdatedAt: '2026-05-02T00:00:00.000Z' })
      .expect(409);

    expect(response.body).toMatchObject({
      code: 'CANVAS_DRAFT_CONFLICT',
      recoverable: true,
      action: 'restore_version',
    });
    expect(dbRunMock).not.toHaveBeenCalled();
  });

  it('rejects stale workflow actions before mutating workflow provenance', async () => {
    const response = await request(app)
      .post('/api/work-canvas/drafts/draft-1/workflows')
      .send({
        baseUpdatedAt: '2026-05-02T00:00:00.000Z',
        template: 'market_research_to_report',
      })
      .expect(409);

    expect(response.body).toMatchObject({
      code: 'CANVAS_DRAFT_CONFLICT',
      recoverable: true,
      action: 'start_workflow',
      data: {
        currentDraft: {
          id: 'draft-1',
          updatedAt: draftRow.updated_at,
        },
        baseUpdatedAt: '2026-05-02T00:00:00.000Z',
      },
    });
    expect(dbRunMock).not.toHaveBeenCalled();
  });

  it('does not allow reading a private draft from another user in the same organization', async () => {
    await request(app).get('/api/work-canvas/drafts/draft-1').set('x-user-id', 'user-2').expect(404);
  });

  it('saves a Canvas draft to a workspace idea with read-back', async () => {
    const response = await request(app)
      .post('/api/work-canvas/drafts/draft-1/save-to-workspace')
      .send({ target: 'idea' })
      .expect(200);

    expect(response.body.data.linkedResource.type).toBe('idea');
    // canvasMaterialize.ts's idea branch always reports status 'completed' —
    // both the fresh-write path (line ~546: `status: 'completed'`) and the
    // idempotent-replay path (readBackIdeaFromReceipt, line ~301: also
    // 'completed'). There is no 'created' status anywhere in the idea
    // materializer; 'created' is what OTHER targets (note/decision/task/
    // initiative) report from their own branches in the same file.
    expect(response.body.data.readBack.status).toBe('completed');
    // M01-P07C: the idea INSERT moved off DbPromise.run() (dbRunMock) onto
    // the pinned-connection pgTxQueryMock — see the mock's doc comment above
    // beforeEach for why. The idea was genuinely persisted into the
    // in-memory pgTables fake, not just claimed by the response envelope.
    expect(pgTxQueryMock).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO my_ideas'),
      expect.any(Array)
    );
    expect(pgTables.my_ideas).toHaveLength(1);
    expect(dbRunMock).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO work_canvas_versions'),
      expect.any(Array),
      expect.any(Object)
    );
  });

  // SEC-M02 (L-08): convert/output endpoints must enforce the canvas.* capability
  // the panel gates on, server-side — a direct API call cannot bypass the UI gate.
  it('refuses save-to-workspace without canvas.convert.<target> (L-08)', async () => {
    hasEffectiveCapabilityMock.mockImplementation(
      (_a: any, cap: string) => cap !== 'canvas.convert.initiative'
    );
    const res = await request(app)
      .post('/api/work-canvas/drafts/draft-1/save-to-workspace')
      .send({ target: 'initiative' })
      .expect(403);
    expect(res.body.code).toBe('CANVAS_CAPABILITY_REQUIRED');
    expect(res.body.required).toBe('canvas.convert.initiative');
    expect(dbRunMock).not.toHaveBeenCalled();
  });

  it('refuses create-output without canvas.output.<type> (L-08)', async () => {
    hasEffectiveCapabilityMock.mockImplementation(
      (_a: any, cap: string) => cap !== 'canvas.output.presentation'
    );
    const res = await request(app)
      .post('/api/work-canvas/drafts/draft-1/create-output')
      .send({ outputType: 'presentation' })
      .expect(403);
    expect(res.body.required).toBe('canvas.output.presentation');
    expect(dbRunMock).not.toHaveBeenCalled();
  });

  it('refuses send-to-document-studio without canvas.output.report (L-08)', async () => {
    hasEffectiveCapabilityMock.mockImplementation(
      (_a: any, cap: string) => cap !== 'canvas.output.report'
    );
    const res = await request(app)
      .post('/api/work-canvas/drafts/draft-1/send-to-document-studio')
      .send({})
      .expect(403);
    expect(res.body.required).toBe('canvas.output.report');
    expect(dbRunMock).not.toHaveBeenCalled();
  });

  it('creates a presentation output from a Canvas draft', async () => {
    const response = await request(app)
      .post('/api/work-canvas/drafts/draft-1/create-output')
      .send({ outputType: 'presentation' })
      .expect(200);

    expect(response.body.data.outputResource.type).toBe('presentation');
    expect(response.body.data.readBack.status).toBe('created');
    expect(response.body.data.outputResource.metadata).toMatchObject({
      ownerId: 'user-1',
      lifecycleState: 'draft',
      approvedFinalStatus: 'draft',
      source: {
        type: 'work_canvas',
        draftId: 'draft-1',
        versionId: response.body.data.version.id,
      },
      artifactRuntimeHint: {
        runtime: 'wave5',
        suggestedArtifactType: 'slide_deck',
        conversationId: 'conv-1',
        projectId: null,
        researchSessionId: null,
        sourceRefsTemplate: [
          expect.objectContaining({
            sourceClass: 'work_canvas',
            draftId: 'draft-1',
            canvasVersionId: response.body.data.version.id,
            outputResourceType: 'presentation',
            outputResourceId: response.body.data.outputResource.id,
          }),
        ],
      },
      openInSourceCanvasUrl: '/work-canvas?draftId=draft-1',
    });
    expect(dbRunMock).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO presentation_decks'),
      expect.any(Array),
      expect.any(Object)
    );
    expect(dbRunMock).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO presentation_cards'),
      expect.any(Array),
      expect.any(Object)
    );
  });

  it('enforces proposal requiredCapability before approving (effective access — SEC-M02-3)', async () => {
    dbGetMock.mockResolvedValueOnce(proposalRow);
    // Deny ONLY the proposal's required capability via the effective-access SSOT
    // (not the legacy req.can role-fallback). Approval must 403 before mutating.
    hasEffectiveCapabilityMock.mockImplementation(
      (_access: any, capability: string) => capability !== 'canvas.convert.idea'
    );

    const response = await request(app)
      .post('/api/work-canvas/proposals/proposal-1/approve')
      .send({})
      .expect(403);

    expect(response.body).toMatchObject({
      code: 'CANVAS_PROPOSAL_CAPABILITY_REQUIRED',
      recoverable: true,
      requiredCapability: 'canvas.convert.idea',
    });
    expect(hasEffectiveCapabilityMock).toHaveBeenCalledWith(
      expect.anything(),
      'canvas.convert.idea'
    );
    const mutationCalls = dbRunMock.mock.calls.filter(([sql]) =>
      /^\s*(INSERT|UPDATE|DELETE)\b/i.test(String(sql))
    );
    expect(mutationCalls).toEqual([]);
  });

  it('materializes a real idea when approving an idea proposal', async () => {
    // proposalsTable is already seeded from proposalRow (target: 'idea',
    // status: 'proposed') in beforeEach — no per-test dbGetMock override
    // needed; see proposalsTable's doc comment above beforeEach for why a
    // one-shot mockResolvedValueOnce cannot answer approveProposal()'s three
    // getProposal() re-fetches correctly.
    const response = await request(app)
      .post('/api/work-canvas/proposals/proposal-1/approve')
      .send({})
      .expect(200);

    expect(response.body.data).toMatchObject({
      id: 'proposal-1',
      status: 'approved',
      requiredCapability: 'canvas.convert.idea',
      readBack: expect.objectContaining({
        target: 'idea',
        status: 'approved',
        entityStatus: 'created',
      }),
    });
    // Approval now produces a real target object id (no longer a placeholder).
    expect(response.body.data.targetObjectId).toEqual(expect.any(String));
    expect(response.body.data.readBack.targetObjectId).toEqual(expect.any(String));
    // The idea was actually inserted — through the M01-P07C pinned-connection
    // transaction (pgTxQueryMock), not DbPromise.run() (dbRunMock).
    expect(pgTxQueryMock).toHaveBeenCalledWith(
      expect.stringContaining('my_ideas'),
      expect.any(Array)
    );
    expect(pgTables.my_ideas).toHaveLength(1);
    // The final `decided`-producing UPDATE (approveProposal(), the one whose
    // SET list includes 'approved') is called with just (sql, params) — no
    // options object — unlike the earlier CAS claim UPDATE ('proposed' ->
    // 'executing'), which does pass `{ fallback: false }`. Asserting a third
    // arg here would check for an options object that call never receives.
    expect(dbRunMock).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE work_canvas_proposals'),
      expect.arrayContaining(['approved'])
    );
  });

  // History (see full derivation in the M01-PTEST closure report): this test
  // originally (commit d85b7afdc1, 2026-06-17) asserted a 422
  // CANVAS_TARGET_NOT_YET_SUPPORTED for target='project_brief'. That was
  // wrong even at the time — 'project_brief' has routed through the real
  // V8-artifact-runtime pipeline (saveDraftAsArtifact) since the M-7 unify
  // commit (81b5ea82ca, 2026-06-05, an ANCESTOR of d85b7afdc1) — and no
  // 'target_not_yet_supported' / CANVAS_TARGET_NOT_YET_SUPPORTED code path
  // exists anywhere in workCanvasService.ts today. Every value in the typed
  // WorkCanvasTarget union (note/table/idea/initiative/task/project_brief/
  // decision/research_report/client_deliverable/kpi_roi_artifact) is
  // explicitly handled by commitProposalToDomain's switch; the only thing
  // that still reaches its `default:` branch is a target string OUTSIDE that
  // union — e.g. stale/corrupted data, since `target` is stored and read as
  // a bare string, not enum-checked at the DB boundary. The genuinely
  // "honest" current behavior for that case is not a placeholder OR a 422:
  // `default:` always falls back to createCanvasIdea(...), the same real,
  // fully-materializing writer 'materializes a real idea...' above proves —
  // i.e. an unrecognized target still lands as a REAL idea, never a silent
  // fake-success placeholder with a null targetObjectId (that pattern —
  // status 'approved_with_placeholder' / entityStatus
  // 'placeholder_pending_conversion' / targetObjectId: null — was removed by
  // commit 234b101b5f, 2026-06-02, before this test was ever written).
  it('materializes a real idea as the honest fallback for an unrecognized target', async () => {
    // Mutate the shared stateful proposalsTable (seeded from proposalRow in
    // beforeEach) rather than queuing a one-shot dbGetMock override — see
    // proposalsTable's doc comment above beforeEach: approveProposal() reads
    // this row three times over the request, and a one-shot value only ever
    // answers the first of those three reads.
    proposalsTable.target = 'unrecognized_target_xyz';

    const response = await request(app)
      .post('/api/work-canvas/proposals/proposal-1/approve')
      .send({})
      .expect(200);

    expect(response.body.data).toMatchObject({
      id: 'proposal-1',
      status: 'approved',
      readBack: expect.objectContaining({
        // commitProposalToDomain's default branch always resolves to the
        // real 'idea' materializer, regardless of the unrecognized input.
        // createCanvasIdea() itself reports status: 'created', but
        // approveProposal() unconditionally overwrites that with
        // `approvedReadBack = { ...readBack, status: 'approved', ... }`
        // before it ever reaches the wire — the same override the sibling
        // 'materializes a real idea...' test above observes for the exact
        // same code path (default branch -> createCanvasIdea ->
        // approveProposal's approvedReadBack wrapper). 'created' survives
        // only as entityStatus below, not as the outer readBack.status.
        target: 'idea',
        status: 'approved',
        entityStatus: 'created',
      }),
    });
    expect(response.body.data.targetObjectId).toEqual(expect.any(String));
    // A real entity table WAS written — the fallback is honest, not a
    // no-op placeholder.
    expect(pgTxQueryMock).toHaveBeenCalledWith(
      expect.stringContaining('my_ideas'),
      expect.any(Array)
    );
    expect(pgTables.my_ideas).toHaveLength(1);
  });

  it('records artifact promotion read-back when saving as artifact', async () => {
    const response = await request(app)
      .post('/api/work-canvas/drafts/draft-1/save-as-artifact')
      .send({})
      .expect(200);

    expect(response.body.data).toMatchObject({
      artifactId: expect.stringMatching(/^artifact-/),
      artifactRunId: expect.stringMatching(/^run-/),
      artifactVersion: 1,
      auditStatus: 'logged',
    });
    expect(response.body.readBack).toMatchObject({
      target: 'artifact',
      runtime: 'wave5',
      status: 'promotion_recorded',
      artifactVersion: 1,
      sourceDraftId: 'draft-1',
      promotionStatus: 'promotion_recorded',
    });
    expect(dbRunMock).toHaveBeenCalledWith(
      expect.stringContaining('provenance_json'),
      expect.arrayContaining([expect.stringContaining('artifactPromotion')]),
      { fallback: false }
    );
  });

  it('finalizes a research report with evidence lineage read-back', async () => {
    dbGetMock.mockResolvedValueOnce({
      ...draftRow,
      kind: 'research',
      research_session_id: 'rs-1',
      blocks_json: JSON.stringify([
        {
          id: 'research-block-1',
          kind: 'research',
          schemaVersion: 'canvas-block/v1',
          title: 'Market findings',
          status: 'ready',
          capabilities: ['view'],
          data: {
            findings: ['Demand is rising'],
            sources: ['Interview transcript'],
            confidence: 'high',
          },
          provenance: { source: 'assistant', conversationId: 'conv-1' },
          markdownProjection: '### Market findings',
          markdownProjectionStatus: 'synced',
        },
      ]),
    });

    const response = await request(app)
      .post('/api/work-canvas/drafts/draft-1/research/finalize-report')
      .send({})
      .expect(200);

    expect(response.body.data.reportResource).toMatchObject({
      type: 'report',
      id: expect.any(String),
      title: expect.stringContaining('Report:'),
    });
    expect(response.body.data.readBack).toMatchObject({
      target: 'research_final_report',
      status: 'promotion_recorded',
      sourceDraftId: 'draft-1',
      researchSessionId: 'rs-1',
      reportDraftId: expect.any(String),
      evidenceSummary: [
        expect.objectContaining({
          blockId: 'research-block-1',
          sourceCount: 1,
          confidence: 'high',
        }),
      ],
    });
  });

  it('exports Canvas drafts as Markdown, CSV and metadata JSON with source lineage', async () => {
    const markdownResponse = await request(app)
      .get('/api/work-canvas/drafts/draft-1/export?format=markdown')
      .expect(200);

    expect(markdownResponse.headers['content-type']).toContain('text/markdown');
    expect(markdownResponse.text).toContain('Source Canvas: draft-1');
    expect(markdownResponse.text).toContain('# Canvas Strategy');

    const csvResponse = await request(app)
      .get('/api/work-canvas/drafts/draft-1/export?format=csv')
      .expect(200);

    expect(csvResponse.headers['content-type']).toContain('text/csv');
    expect(csvResponse.text).toContain('Topic,Detail,Source');
    expect(csvResponse.text).toContain('Context');

    const jsonResponse = await request(app)
      .get('/api/work-canvas/drafts/draft-1/export?format=json')
      .expect(200);

    expect(jsonResponse.body).toMatchObject({
      schemaVersion: 'work-canvas-export/v1',
      metadata: {
        ownerId: 'user-1',
        source: { draftId: 'draft-1' },
        openInSourceCanvasUrl: '/work-canvas?draftId=draft-1',
      },
      draft: { id: 'draft-1', title: 'Canvas Strategy' },
    });
  });

  it('exports heavy Canvas formats through adapter-backed responses', async () => {
    const binaryExport = (format: string) =>
      request(app)
        .get(`/api/work-canvas/drafts/draft-1/export?format=${format}`)
        .buffer(true)
        .parse((res, callback) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
          res.on('end', () => callback(null, Buffer.concat(chunks)));
        });

    const pdfResponse = await binaryExport('pdf').expect(200);

    expect(pdfResponse.headers['content-type']).toContain('application/pdf');
    expect(pdfResponse.headers['x-canvas-source-draft']).toBe('draft-1');
    expect(Buffer.isBuffer(pdfResponse.body)).toBe(true);
    expect(pdfResponse.body.subarray(0, 4).toString()).toBe('%PDF');

    const docxResponse = await binaryExport('docx').expect(200);
    expect(docxResponse.headers['content-type']).toContain(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    expect(Buffer.isBuffer(docxResponse.body)).toBe(true);
    expect(docxResponse.body.subarray(0, 2).toString()).toBe('PK');

    const xlsxResponse = await binaryExport('xlsx').expect(200);
    expect(xlsxResponse.headers['content-type']).toContain(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    expect(Buffer.isBuffer(xlsxResponse.body)).toBe(true);
    expect(xlsxResponse.body.subarray(0, 2).toString()).toBe('PK');

    const pptxResponse = await binaryExport('pptx').expect(200);
    expect(pptxResponse.headers['content-type']).toContain(
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    );
    expect(Buffer.isBuffer(pptxResponse.body)).toBe(true);
    expect(pptxResponse.body.subarray(0, 2).toString()).toBe('PK');
  });

  it('opens the source Canvas from an output draft lineage', async () => {
    dbGetMock
      .mockResolvedValueOnce({
        ...draftRow,
        id: 'output-1',
        title: 'Report: Canvas Strategy',
        provenance_json: JSON.stringify({
          source: 'work_canvas_create_output',
          sourceDraftId: 'draft-1',
          metadata: {
            source: {
              draftId: 'draft-1',
              versionId: 'version-1',
            },
          },
        }),
      })
      .mockResolvedValueOnce(draftRow);

    const response = await request(app)
      .get('/api/work-canvas/drafts/output-1/source-canvas')
      .expect(200);

    expect(response.body.data).toMatchObject({
      sourceDraft: {
        id: 'draft-1',
        title: 'Canvas Strategy',
        url: '/work-canvas?draftId=draft-1',
      },
      sourceVersionId: 'version-1',
      openInSourceCanvasUrl: '/work-canvas?draftId=draft-1',
    });
  });

  it('applies replace_selection operation with a version snapshot and diff', async () => {
    const response = await request(app)
      .post('/api/work-canvas/drafts/draft-1/operations')
      .send({
        operation: {
          type: 'replace_selection',
          selectedText: 'Build the operating workspace.',
          replacementMd: 'Build the operating workspace with selected context.',
        },
      })
      .expect(200);

    expect(response.body.data.draft.contentMd).toContain('selected context');
    expect(response.body.data.version.operationType).toBe('replace_selection');
    expect(response.body.data.diff.summary).toContain('lines added');
    expect(response.body.data.diff.addedLineSamples).toContain(
      'Build the operating workspace with selected context.'
    );
    expect(response.body.data.diff.removedLineSamples).toContain('Build the operating workspace.');
    expect(dbRunMock).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO work_canvas_versions'),
      expect.any(Array),
      expect.any(Object)
    );
    expect(dbRunMock).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE work_canvas_drafts'),
      expect.any(Array),
      expect.any(Object)
    );
  });

  it('appends a Canvas section through the operations endpoint', async () => {
    const response = await request(app)
      .post('/api/work-canvas/drafts/draft-1/operations')
      .send({
        operation: {
          type: 'append_section',
          heading: 'Next Steps',
          contentMd: '- Wire autosave',
        },
      })
      .expect(200);

    expect(response.body.data.draft.contentMd).toContain('## Next Steps');
    expect(response.body.data.draft.contentMd).toContain('- Wire autosave');
    expect(response.body.data.version.operationType).toBe('append_section');
  });

  it('previews a block transformation without mutating the Canvas draft', async () => {
    const response = await request(app)
      .post('/api/work-canvas/drafts/draft-1/operations')
      .send({
        previewOnly: true,
        operation: {
          type: 'generate_block_from_selection',
          kind: 'table',
          selectedText: 'Risk: Supply delay',
          title: 'Risk Table',
        },
      })
      .expect(200);

    expect(response.body.data.preview).toMatchObject({
      proposedChange: 'Create table block "Risk Table" from selected Canvas text',
      approvalRequired: true,
    });
    expect(response.body.data.draft.blocks).toEqual([]);
  });

  it('requires approval before applying a durable block transformation', async () => {
    const response = await request(app)
      .post('/api/work-canvas/drafts/draft-1/operations')
      .send({
        operation: {
          type: 'generate_block_from_selection',
          kind: 'table',
          selectedText: 'Risk: Supply delay',
          title: 'Risk Table',
        },
      })
      .expect(409);

    expect(response.body.error).toContain('requires approval');
    expect(response.body.data.preview.approvalRequired).toBe(true);
  });

  it('applies an approved block transformation with version snapshot and preview metadata', async () => {
    const response = await request(app)
      .post('/api/work-canvas/drafts/draft-1/operations')
      .send({
        operation: {
          type: 'generate_block_from_selection',
          kind: 'table',
          selectedText: 'Risk: Supply delay',
          title: 'Risk Table',
          approved: true,
        },
      })
      .expect(200);

    expect(response.body.data.draft.blocks).toHaveLength(1);
    expect(response.body.data.draft.blocks[0]).toMatchObject({
      kind: 'table',
      title: 'Risk Table',
      markdownProjectionStatus: 'synced',
    });
    expect(response.body.data.preview).toMatchObject({
      approvalRequired: true,
      validationResult: { status: 'passed' },
    });
    expect(dbRunMock).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO work_canvas_versions'),
      expect.arrayContaining(['generate_block_from_selection']),
      expect.any(Object)
    );
    expect(dbRunMock).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE work_canvas_drafts'),
      expect.arrayContaining([expect.stringContaining('Risk Table')]),
      expect.any(Object)
    );
  });

  it('converts an approved table block into a chart block', async () => {
    dbGetMock.mockResolvedValueOnce({
      ...draftRow,
      blocks_json: JSON.stringify([
        {
          id: 'table-1',
          kind: 'table',
          schemaVersion: 'canvas-block/v1',
          title: 'Risk Table',
          status: 'ready',
          capabilities: ['view', 'convert'],
          data: { columns: ['Risk'], rows: [{ Risk: 'Supply delay' }] },
          provenance: { source: 'assistant', conversationId: 'conv-1' },
          markdownProjection: '### Risk Table\n\n| Risk |\n|---|\n| Supply delay |',
          markdownProjectionStatus: 'synced',
        },
      ]),
    });

    const response = await request(app)
      .post('/api/work-canvas/drafts/draft-1/operations')
      .send({
        operation: {
          type: 'convert_block',
          blockId: 'table-1',
          targetKind: 'chart',
          approved: true,
        },
      })
      .expect(200);

    expect(response.body.data.draft.blocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'table-1', kind: 'table' }),
        expect.objectContaining({ kind: 'chart', title: 'Chart from Risk Table' }),
      ])
    );
    expect(response.body.data.preview.affectedBlocks).toHaveLength(2);
  });

  it('previews and applies a dataset dashboard operation with profile limitations', async () => {
    const dataset = {
      filename: 'pipeline.csv',
      format: 'csv',
      content: 'Stage,Revenue,Owner\nQualified,100,Ada\nProposal,250,Tom\nWon,400,Ada',
    };

    const preview = await request(app)
      .post('/api/work-canvas/drafts/draft-1/operations')
      .send({
        previewOnly: true,
        operation: {
          type: 'generate_artifact_from_dataset',
          artifactKind: 'dashboard',
          dataset,
          title: 'Pipeline Dashboard',
        },
      })
      .expect(200);

    expect(preview.body.data.preview).toMatchObject({
      proposedChange: 'Create dashboard block "Pipeline Dashboard" from dataset "pipeline.csv"',
      approvalRequired: true,
    });
    expect(preview.body.data.draft.blocks).toEqual([]);

    const response = await request(app)
      .post('/api/work-canvas/drafts/draft-1/operations')
      .send({
        operation: {
          type: 'generate_artifact_from_dataset',
          artifactKind: 'dashboard',
          dataset,
          title: 'Pipeline Dashboard',
          approved: true,
        },
      })
      .expect(200);

    expect(response.body.data.draft.blocks[0]).toMatchObject({
      kind: 'dashboard',
      title: 'Pipeline Dashboard',
      data: expect.objectContaining({
        kpis: expect.arrayContaining([expect.objectContaining({ label: 'Rows', value: 3 })]),
        limitations: expect.arrayContaining([
          'Stage 7 uses deterministic server-side profiling only; no arbitrary code execution was run.',
        ]),
      }),
      provenance: expect.objectContaining({
        source: 'import',
        filename: 'pipeline.csv',
        draftId: 'draft-1',
      }),
    });
    expect(response.body.data.draft.blocks[0].markdownProjection).toContain('Data limitations:');
    expect(dbRunMock).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO work_canvas_versions'),
      expect.arrayContaining(['generate_artifact_from_dataset']),
      expect.any(Object)
    );
  });

  it('generates a dashboard from an uploaded XLSX dataset with source lineage', async () => {
    const XLSX = await import('xlsx');
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet([
      { Stage: 'Qualified', Revenue: 100, Owner: 'Ada' },
      { Stage: 'Won', Revenue: 400, Owner: 'Ada' },
    ]);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Pipeline');
    const content = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });

    const response = await request(app)
      .post('/api/work-canvas/drafts/draft-1/operations')
      .send({
        operation: {
          type: 'generate_artifact_from_dataset',
          artifactKind: 'dashboard',
          dataset: {
            filename: 'pipeline.xlsx',
            format: 'xlsx',
            content,
          },
          title: 'Pipeline XLSX Dashboard',
          approved: true,
        },
      })
      .expect(200);

    expect(response.body.data.draft.blocks[0]).toMatchObject({
      kind: 'dashboard',
      title: 'Pipeline XLSX Dashboard',
      data: expect.objectContaining({
        kpis: expect.arrayContaining([expect.objectContaining({ label: 'Rows', value: 2 })]),
        insights: expect.arrayContaining(['Dataset "pipeline.xlsx" has 2 rows and 3 columns.']),
      }),
      provenance: expect.objectContaining({
        filename: 'pipeline.xlsx',
        draftId: 'draft-1',
      }),
    });
  });

  it('generates an approved aggregate analysis chart from a dataset', async () => {
    const dataset = {
      filename: 'pipeline.csv',
      format: 'csv',
      content: 'Owner,Revenue\nAda,100\nTom,250\nAda,400',
    };

    const preview = await request(app)
      .post('/api/work-canvas/drafts/draft-1/operations')
      .send({
        previewOnly: true,
        operation: {
          type: 'generate_artifact_from_dataset',
          artifactKind: 'chart',
          dataset,
          analysis: { kind: 'aggregate_numeric' },
          title: 'Aggregate Chart: pipeline.csv',
        },
      })
      .expect(200);

    expect(preview.body.data.preview).toMatchObject({
      proposedChange:
        'Create chart block "Aggregate Chart: pipeline.csv" from dataset "pipeline.csv"',
      approvalRequired: true,
    });
    expect(preview.body.data.draft.blocks).toEqual([]);

    const response = await request(app)
      .post('/api/work-canvas/drafts/draft-1/operations')
      .send({
        operation: {
          type: 'generate_artifact_from_dataset',
          artifactKind: 'chart',
          dataset,
          analysis: { kind: 'aggregate_numeric' },
          title: 'Aggregate Chart: pipeline.csv',
          approved: true,
        },
      })
      .expect(200);

    expect(response.body.data.draft.blocks[0]).toMatchObject({
      kind: 'chart',
      title: 'Aggregate Chart: pipeline.csv',
      data: expect.objectContaining({
        analysis: 'Aggregated Revenue by Owner.',
        metrics: expect.arrayContaining([
          expect.objectContaining({ label: 'Ada', value: 500 }),
          expect.objectContaining({ label: 'Tom', value: 250 }),
        ]),
      }),
      provenance: expect.objectContaining({
        analysisKind: 'aggregate_numeric',
        source: 'import',
      }),
    });
  });

  it('generates a research block with confidence and visible source lineage', async () => {
    const response = await request(app)
      .post('/api/work-canvas/drafts/draft-1/operations')
      .send({
        operation: {
          type: 'generate_block_from_selection',
          kind: 'research',
          selectedText: 'Market demand is increasing\nCompetitors are moving upmarket',
          title: 'Market Evidence',
          approved: true,
        },
      })
      .expect(200);

    expect(response.body.data.draft.blocks[0]).toMatchObject({
      kind: 'research',
      title: 'Market Evidence',
      data: expect.objectContaining({
        confidence: 'medium',
        sources: ['Canvas selection'],
        gaps: ['Needs source validation'],
      }),
    });
    expect(response.body.data.draft.blocks[0].markdownProjection).toContain('Confidence: medium');
    expect(response.body.data.draft.blocks[0].markdownProjection).toContain('Sources:');
  });

  it('generates a decision block with recommendation, risks and assumptions', async () => {
    const response = await request(app)
      .post('/api/work-canvas/drafts/draft-1/operations')
      .send({
        operation: {
          type: 'generate_block_from_selection',
          kind: 'decision',
          selectedText: 'Choose Partner A\nKeep Partner B as fallback',
          title: 'Partner Decision',
          approved: true,
        },
      })
      .expect(200);

    expect(response.body.data.draft.blocks[0]).toMatchObject({
      kind: 'decision',
      title: 'Partner Decision',
      data: expect.objectContaining({
        recommendation: 'Choose Partner A',
        approvalStatus: 'draft',
        risks: ['Needs owner review before approval'],
      }),
    });
    expect(response.body.data.draft.blocks[0].markdownProjection).toContain(
      'Recommendation: Choose Partner A'
    );
    expect(response.body.data.draft.blocks[0].markdownProjection).toContain('Assumptions:');
  });

  it('creates a share token on the Canvas draft provenance', async () => {
    const response = await request(app)
      .post('/api/work-canvas/drafts/draft-1/share')
      .send({})
      .expect(200);

    expect(response.body.data.share.token).toEqual(expect.any(String));
    // Share URL migrated to /public/artifacts/:token (canonical artifact viewer route).
    expect(response.body.data.share.url).toContain('/public/artifacts/');
    expect(response.body.data.share.expiresAt).toEqual(expect.any(String));
    expect(dbRunMock).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE work_canvas_drafts'),
      expect.arrayContaining([expect.stringContaining('"share"')]),
      expect.any(Object)
    );
  });

  it('resolves a shared draft token when link is active', async () => {
    // Real canvas share tokens are 32-char hex (randomUUID without dashes);
    // SEC-M02-4 rejects anything else before the lookup, so use a valid shape.
    const shareToken = 'a1b2c3d4e5f600112233445566778899';
    dbAllMock.mockResolvedValueOnce([
      {
        ...draftRow,
        provenance_json: JSON.stringify({
          share: {
            token: shareToken,
            url: `/work-canvas/shared/${shareToken}`,
            title: 'Canvas Strategy',
            createdAt: '2026-05-03T00:00:00.000Z',
            expiresAt: '2099-01-01T00:00:00.000Z',
          },
        }),
      },
    ]);

    const response = await request(app)
      .get(`/api/work-canvas/shared/${shareToken}`)
      .send({})
      .expect(200);

    expect(response.body.data).toMatchObject({
      draftId: 'draft-1',
      title: 'Canvas Strategy',
      share: {
        token: shareToken,
      },
    });
  });

  // S6 (M02/L-15): once a share is revoked, provenance no longer carries a
  // `share` object — the public viewer must resolve to 404, not leak the draft.
  it('returns 404 for a revoked share token (S6 revoke)', async () => {
    const shareToken = 'a1b2c3d4e5f600112233445566778899';
    // A draft that matched the LIKE scan but whose share was revoked (removed).
    dbAllMock.mockResolvedValueOnce([
      { ...draftRow, provenance_json: JSON.stringify({ materializedTo: [] }) },
    ]);

    await request(app).get(`/api/work-canvas/shared/${shareToken}`).expect(404);
  });

  // S6 (M02/L-15): an active share whose window has passed resolves to 410.
  it('returns 410 for an expired share token (S6 expiry)', async () => {
    const shareToken = 'b1b2c3d4e5f600112233445566778899';
    dbAllMock.mockResolvedValueOnce([
      {
        ...draftRow,
        provenance_json: JSON.stringify({
          share: {
            token: shareToken,
            url: `/work-canvas/shared/${shareToken}`,
            title: 'Canvas Strategy',
            createdAt: '2020-01-01T00:00:00.000Z',
            expiresAt: '2020-01-08T00:00:00.000Z',
          },
        }),
      },
    ]);

    await request(app).get(`/api/work-canvas/shared/${shareToken}`).expect(410);
  });

  it('creates and resumes a governed Canvas workflow ledger without losing context', async () => {
    const createResponse = await request(app)
      .post('/api/work-canvas/drafts/draft-1/workflows')
      .send({ template: 'market_research_to_report' })
      .expect(201);

    expect(createResponse.body.data.workflowRun).toMatchObject({
      draftId: 'draft-1',
      conversationId: 'conv-1',
      template: 'market_research_to_report',
      status: 'active',
      approvals: [expect.objectContaining({ status: 'pending' })],
      events: [
        expect.objectContaining({ type: 'created', actorId: 'user-1' }),
        expect.objectContaining({ type: 'approval_required', actorId: 'user-1' }),
      ],
    });
    expect(createResponse.body.data.workflowRun.steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'teresa_action', status: 'completed' }),
        expect.objectContaining({
          kind: 'user_approval',
          status: 'pending',
          approvalRequired: true,
        }),
      ])
    );
    expect(createResponse.body.data.readBack).toMatchObject({
      draftId: 'draft-1',
      conversationId: 'conv-1',
      approvalRequired: true,
    });

    const workflowRun = createResponse.body.data.workflowRun;
    dbGetMock.mockResolvedValueOnce({
      ...draftRow,
      provenance_json: JSON.stringify({ workflowRuns: [workflowRun] }),
    });

    const resumeResponse = await request(app)
      .post(`/api/work-canvas/drafts/draft-1/workflows/${workflowRun.id}/resume`)
      .send({ note: 'Continue with current source Canvas.' })
      .expect(200);

    expect(resumeResponse.body.data.workflowRun.steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'teresa_action',
          title: 'Resume workflow',
          summary: 'Continue with current source Canvas.',
        }),
      ])
    );
    expect(resumeResponse.body.data.workflowRun.events).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'resumed', actorId: 'user-1' })])
    );
    expect(resumeResponse.body.data.readBack).toMatchObject({
      status: 'resumed',
      draftId: 'draft-1',
      conversationId: 'conv-1',
    });

    dbGetMock.mockResolvedValueOnce({
      ...draftRow,
      provenance_json: JSON.stringify({ workflowRuns: [workflowRun] }),
    });

    const approvalRequiredResponse = await request(app)
      .post(`/api/work-canvas/drafts/draft-1/workflows/${workflowRun.id}/run-next`)
      .send({})
      .expect(409);

    expect(approvalRequiredResponse.body).toMatchObject({
      code: 'CANVAS_WORKFLOW_APPROVAL_REQUIRED',
      recoverable: true,
    });

    dbGetMock.mockResolvedValueOnce({
      ...draftRow,
      provenance_json: JSON.stringify({ workflowRuns: [workflowRun] }),
    });

    const runResponse = await request(app)
      .post(`/api/work-canvas/drafts/draft-1/workflows/${workflowRun.id}/run-next`)
      .send({ approved: true })
      .expect(200);

    expect(runResponse.body.data.workflowRun).toMatchObject({
      status: 'completed',
      approvals: [expect.objectContaining({ status: 'approved' })],
      outputs: [expect.objectContaining({ type: 'report', title: 'Report: Canvas Strategy' })],
      events: expect.arrayContaining([
        expect.objectContaining({ type: 'approved', actorId: 'user-1' }),
        expect.objectContaining({ type: 'output_created', actorId: 'user-1' }),
      ]),
    });
    expect(runResponse.body.data.readBack).toMatchObject({
      status: 'completed',
      outputType: 'report',
    });
    expect(runResponse.body.data.outputResource.metadata).toMatchObject({
      artifactRuntimeHint: {
        runtime: 'wave5',
        suggestedArtifactType: 'report',
        sourceRefsTemplate: [
          expect.objectContaining({
            sourceClass: 'work_canvas',
            draftId: 'draft-1',
            outputResourceType: 'report',
            // outputResourceId tracks the output work_canvas_drafts row id (not the
            // report_builder_reports id returned as outputResource.id — different uuid).
            outputResourceId: expect.any(String),
          }),
        ],
      },
    });

    dbGetMock.mockResolvedValueOnce({
      ...draftRow,
      provenance_json: JSON.stringify({ workflowRuns: [runResponse.body.data.workflowRun] }),
    });
    const terminalStateResponse = await request(app)
      .post(`/api/work-canvas/drafts/draft-1/workflows/${workflowRun.id}/run-next`)
      .send({ approved: true })
      .expect(409);

    expect(terminalStateResponse.body).toMatchObject({
      code: 'CANVAS_WORKFLOW_TERMINAL_STATE',
      recoverable: true,
      data: expect.objectContaining({
        workflowRunId: workflowRun.id,
        status: 'completed',
        outputCount: 1,
      }),
    });

    dbGetMock.mockResolvedValueOnce({
      ...draftRow,
      provenance_json: JSON.stringify({ workflowRuns: [workflowRun] }),
    });
    const collaborationResponse = await request(app)
      .patch(`/api/work-canvas/drafts/draft-1/workflows/${workflowRun.id}/collaboration`)
      .send({ reviewerId: 'reviewer-1', lifecycle: 'in_review' })
      .expect(200);

    expect(collaborationResponse.body.data.workflowRun.collaboration).toMatchObject({
      ownerId: 'user-1',
      reviewerId: 'reviewer-1',
      lifecycle: 'in_review',
    });
    expect(collaborationResponse.body.data.workflowRun.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'collaboration_updated', actorId: 'user-1' }),
      ])
    );

    dbGetMock.mockResolvedValueOnce({
      ...draftRow,
      provenance_json: JSON.stringify({
        workflowRuns: [collaborationResponse.body.data.workflowRun],
      }),
    });
    const reviewRequiredResponse = await request(app)
      .post(`/api/work-canvas/drafts/draft-1/workflows/${workflowRun.id}/run-next`)
      .send({ approved: true })
      .expect(409);

    expect(reviewRequiredResponse.body).toMatchObject({
      code: 'CANVAS_WORKFLOW_REVIEW_REQUIRED',
      recoverable: true,
      data: expect.objectContaining({
        workflowRunId: workflowRun.id,
        lifecycle: 'in_review',
        reviewerId: 'reviewer-1',
      }),
    });

    dbGetMock.mockResolvedValueOnce({
      ...draftRow,
      provenance_json: JSON.stringify({
        workflowRuns: [collaborationResponse.body.data.workflowRun],
      }),
    });
    const commentResponse = await request(app)
      .post(`/api/work-canvas/drafts/draft-1/workflows/${workflowRun.id}/comments`)
      .send({ body: 'Please review revenue assumptions.' })
      .expect(201);

    expect(commentResponse.body.data.workflowRun.collaboration.comments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          authorId: 'user-1',
          body: 'Please review revenue assumptions.',
        }),
      ])
    );
    expect(commentResponse.body.data.workflowRun.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'comment_added', actorId: 'user-1' }),
      ])
    );
  });

  it('creates distinct governed workflow plans for different templates', async () => {
    const deckResponse = await request(app)
      .post('/api/work-canvas/drafts/draft-1/workflows')
      .send({ template: 'client_proposal_to_deck' })
      .expect(201);

    expect(deckResponse.body.data.workflowRun).toMatchObject({
      template: 'client_proposal_to_deck',
      title: 'Client proposal to deck',
      approvals: [expect.objectContaining({ status: 'pending' })],
    });
    expect(deckResponse.body.data.workflowRun.steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: 'Extract proposal storyline', status: 'completed' }),
        expect.objectContaining({ title: 'Approve deck outline', approvalRequired: true }),
        expect.objectContaining({ title: 'Generate proposal deck' }),
      ])
    );

    const workflowRun = deckResponse.body.data.workflowRun;
    dbGetMock.mockResolvedValueOnce({
      ...draftRow,
      provenance_json: JSON.stringify({ workflowRuns: [workflowRun] }),
    });

    const runResponse = await request(app)
      .post(`/api/work-canvas/drafts/draft-1/workflows/${workflowRun.id}/run-next`)
      .send({ approved: true })
      .expect(200);

    expect(runResponse.body.data.workflowRun.outputs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'presentation', title: 'Presentation: Canvas Strategy' }),
      ])
    );
    expect(runResponse.body.data.readBack).toMatchObject({
      status: 'completed',
      outputType: 'presentation',
    });
  });

  it('creates a Canvas draft with typed artifact blocks and readable projections', async () => {
    const response = await request(app)
      .post('/api/work-canvas/drafts')
      .send({
        conversationId: 'conv-1',
        kind: 'document',
        title: 'Business Review',
        contentMd: '# Business Review',
        blocks: [
          {
            id: 'block-table-1',
            kind: 'table',
            schemaVersion: 'canvas-block/v1',
            title: 'Risks',
            status: 'ready',
            capabilities: ['view', 'sort'],
            data: {
              columns: ['Risk', 'Owner'],
              rows: [{ Risk: 'Supply delay', Owner: 'Ops' }],
            },
            provenance: { source: 'assistant', conversationId: 'conv-1' },
            markdownProjectionStatus: 'synced',
          },
        ],
      })
      .expect(201);

    expect(response.body.data.blocks).toHaveLength(1);
    expect(response.body.data.blocks[0].markdownProjection).toContain('| Risk | Owner |');
    expect(response.body.data.blocks[0].markdownProjection).not.toContain('"Risk"');
    expect(dbRunMock).toHaveBeenCalledWith(
      expect.stringContaining('blocks_json'),
      expect.arrayContaining([expect.stringContaining('block-table-1')]),
      expect.any(Object)
    );
  });

  it('restores a Canvas version with a snapshot and clean projection state', async () => {
    const restoredBlocksJson = JSON.stringify([
      {
        id: 'research-1',
        kind: 'research',
        schemaVersion: 'canvas-block/v1',
        title: 'Market findings',
        status: 'ready',
        capabilities: ['view'],
        data: { findings: ['Demand is growing'] },
        provenance: { source: 'assistant' },
        markdownProjectionStatus: 'synced',
      },
    ]);
    dbGetMock
      .mockResolvedValueOnce(draftRow)
      .mockResolvedValueOnce({
        id: 'version-1',
        draft_id: 'draft-1',
        operation_type: 'manual_save',
        summary: 'Previous stable content',
        content_md: '# Restored Strategy\n\nRecovered context.',
        content_json_native: null,
        blocks_json: restoredBlocksJson,
        created_by: 'user-1',
        created_at: '2026-05-03T01:00:00.000Z',
      })
      // M01-P06 §8 — restore now does a read-back SELECT after the atomic
      // `UPDATE ... WHERE updated_at = ?` guard (proves the write landed
      // before answering 200), a THIRD dbGet the mock must also satisfy.
      .mockResolvedValueOnce({
        ...draftRow,
        content_json: JSON.stringify('# Restored Strategy\n\nRecovered context.'),
        content_md: '# Restored Strategy\n\nRecovered context.',
        blocks_json: restoredBlocksJson,
        markdown_projection_status: 'synced',
        save_state: 'saved',
        dirty_state: 'clean',
        updated_at: '2026-05-03T01:05:00.000Z',
      });

    const response = await request(app)
      .post('/api/work-canvas/drafts/draft-1/versions/version-1/restore')
      .send({})
      .expect(200);

    expect(response.body.data.draft.id).toBe('draft-1');
    expect(response.body.data.draft.contentMd).toContain('Recovered context');
    expect(response.body.data.draft.blocks[0].markdownProjection).toContain('Demand is growing');
    expect(response.body.data.draft.markdownProjectionStatus).toBe('synced');
    expect(response.body.data.restoredVersion.id).toBe('version-1');
    expect(dbRunMock).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO work_canvas_versions'),
      expect.arrayContaining(['restore_version']),
      expect.any(Object)
    );
    expect(dbRunMock).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE work_canvas_drafts'),
      expect.arrayContaining(['# Restored Strategy\n\nRecovered context.']),
      expect.any(Object)
    );
  });

  // SEC-M02-4 (M02/L-10): GET /shared/:token must reject malformed tokens with a
  // 404 BEFORE running the `provenance_json LIKE '%<token>%'` scan, so a caller
  // cannot probe the org share corpus with a wildcard or fragment.
  it('rejects a malformed share token before the LIKE scan (SEC-M02-4)', async () => {
    for (const bad of ['%', 'abc', 'not-a-token', 'g'.repeat(32), 'a'.repeat(31), 'a'.repeat(33)]) {
      dbAllMock.mockClear();
      await request(app)
        .get(`/api/work-canvas/shared/${encodeURIComponent(bad)}`)
        .expect(404);
      // The DB LIKE scan must never run for a malformed token.
      expect(dbAllMock).not.toHaveBeenCalled();
    }
  });

  it('runs the lookup for a well-formed 32-hex token (then 404 on no match)', async () => {
    dbAllMock.mockClear();
    dbAllMock.mockResolvedValue([]);
    const goodToken = 'a'.repeat(32);
    await request(app).get(`/api/work-canvas/shared/${goodToken}`).expect(404);
    // A valid-shape token passes the guard and reaches the lookup.
    expect(dbAllMock).toHaveBeenCalled();
  });
});
