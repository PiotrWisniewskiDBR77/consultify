/**
 * canvasMaterialize — single materialization writer shared by both Canvas
 * promote paths (proposal-approval AND save-to-workspace).
 *
 * Why this exists (Canvas M-7):
 * The Canvas → workspace flow had TWO writers that produced the same entity
 * types: `createWorkspaceResource` (in routes/work-canvas.routes.ts, called
 * by /save-to-workspace) and `commitProposalToDomain` (in workCanvasService.ts,
 * called by proposal approval). Each branch had its own bugs (audit exports
 * report — see _CANVAS_EXPORTS_AUDIT.md §4 P1-4 "two writers, two divergent
 * behaviors"). After wave-2 W2-E1..E10 both writers were corrected, but the
 * structural duplication remained — every future bug would have two sites to
 * fix.
 *
 * This module is the single materialization core. Both writers reduce to:
 *   const result = await materializeWorkspaceTarget({...}, ctx)
 * Adding a new target type is a single-place change.
 */

import { randomUUID } from 'node:crypto';

import { getDatabase } from '../database/index.js';
import { insertDynamicTx, type TxQueryFn } from '../utils/dbDynamic.js';
import { all as dbAllGlobal, get as dbGet } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

export type CanvasWorkspaceTarget = 'idea' | 'note' | 'initiative' | 'decision' | 'task';

export interface CanvasMaterializeInput {
  organizationId: string;
  actorUserId: string;
  target: CanvasWorkspaceTarget;
  title: string;
  /** Full markdown body (used by note + as fallback summary). */
  contentMd: string;
  /** Capped summary used by initiative.summary / decision.description / task.description. */
  summary: string;
  /** Optional UUID-validated projectId. Pass `null` when the source has a non-UUID id. */
  projectId: string | null;
  /** Source draft id — written into the materialized entity's provenance fields. */
  sourceDraftId: string;
  /** Source conversation id (idea provenance). May be empty for proposal-approval. */
  sourceConversationId?: string;
  /** Pre-tokenized section list — used to seed an idea's Mind Map (only
   * consulted when `graph` below is absent — see the `idea` branch). */
  sections?: Array<{ heading: string; body: string }>;
  /**
   * Pre-built ReactFlow-ish graph (e.g. from canvasGraphLlm.ts) — when present,
   * the `idea` branch seeds the map with THIS graph (validated/normalized via
   * validateAndNormalizeGraph, same as the client PUT /my-work/my-ideas/:id/map
   * route) instead of deriving a crude "H2 heading star map" from `sections`.
   */
  graph?: { nodes: unknown[]; edges: unknown[]; extensions?: Record<string, unknown> };
  /** Which canvas tool authored `graph` (mindmap/process_flow/table/whiteboard). */
  preferredTool?: string | null;
  /** Idea provenance tag (defaults to 'work_canvas' for the existing Canvas callers). */
  sourceType?: string;
  /** Optional decision type override (canonical enum). Defaults to 'APPROVAL'. */
  decisionType?: 'GO_NO_GO' | 'APPROVAL' | 'RESOURCE_ALLOCATION' | 'OTHER';
  /** Optional task priority + due. */
  taskPriority?: 'low' | 'medium' | 'high' | 'critical';
  taskAssigneeId?: string;
  taskDueDate?: string;
  /** Optional initiative owner override (default actorUserId). */
  ownerId?: string;
  /**
   * M01-P07C — optional caller-supplied idempotency key for the `idea`
   * target. When present, a retry with the SAME (organizationId,
   * idempotencyKey) pair — whether because the caller's own state machine
   * can genuinely invoke this twice for the one logical operation (e.g. a
   * lost-response retry) or because two requests raced — returns the
   * ALREADY-materialized idea/map instead of creating a second one. Omit it
   * to keep today's behavior (every call creates a new idea) — this is a
   * deliberate per-caller choice, not a default: `createCanvasIdea` (a
   * proposal can only ever be approved once) passes `proposal.id`;
   * `createWorkspaceResource` (/save-to-workspace) intentionally does NOT —
   * a user can legitimately click "save as idea" on a draft more than once
   * and expects two ideas, and no per-click nonce exists on that route to
   * distinguish a deliberate repeat click from a network retry (see
   * M01-P07C_MATERIALIZE_ATOMICITY_REPORT.md decision log).
   */
  idempotencyKey?: string;
}

export interface CanvasMaterializeResult {
  type: CanvasWorkspaceTarget;
  id: string;
  title: string;
  /** Entity-detail URL (not list URL — the W2-E2 fix). */
  url: string;
  readBack: Record<string, unknown>;
}

/**
 * C8 — org-scoping guard. The materializer only ever CREATES new rows, but the
 * input can carry references to EXISTING entities: `projectId` (from
 * draft.projectId on save-to-workspace, or proposal.payload.projectId on
 * proposal approval) and `ownerId` / `taskAssigneeId` (proposal payload).
 * Downstream canonical services do not all enforce org membership —
 * decisionService / notebookService / initiativeService persist project_id
 * verbatim, and decisionMakerId / owner_id / assignee_id are never checked —
 * so the validation lives here: the single shared site for both writers.
 */
function crossOrgReferenceError(field: string, value: string): Error {
  return Object.assign(
    new Error(`Referenced ${field} does not exist or belongs to another organization`),
    {
      statusCode: 403,
      code: 'CANVAS_CROSS_ORG_REFERENCE',
      field,
      value,
    }
  );
}

async function assertOrgScopedReferences(input: CanvasMaterializeInput): Promise<void> {
  const { organizationId, actorUserId, projectId, ownerId, taskAssigneeId } = input;

  if (projectId) {
    const project = await dbGet<{ id: string }>(
      'SELECT id FROM projects WHERE id = ? AND organization_id = ?',
      [projectId, organizationId],
      { fallback: false }
    );
    if (!project) throw crossOrgReferenceError('projectId', projectId);
  }

  const userReferences: Array<{ field: string; userId: string }> = [];
  if (ownerId && ownerId !== actorUserId) {
    userReferences.push({ field: 'ownerId', userId: ownerId });
  }
  if (taskAssigneeId && taskAssigneeId !== actorUserId && taskAssigneeId !== ownerId) {
    userReferences.push({ field: 'taskAssigneeId', userId: taskAssigneeId });
  }
  for (const reference of userReferences) {
    const user = await dbGet<{ id: string }>(
      'SELECT id FROM users WHERE id = ? AND organization_id = ?',
      [reference.userId, organizationId],
      { fallback: false }
    );
    if (!user) throw crossOrgReferenceError(reference.field, reference.userId);
  }
}

// ---------------------------------------------------------------------------
// M01-P07C — atomic Idea materialization
// ---------------------------------------------------------------------------
//
// FIX FINDING M01-033 (P1): the `idea` branch below used to issue two
// INDEPENDENT `insertDynamic` calls (my_ideas, then my_idea_maps) — each one
// a SEPARATE round trip through `DbPromise.run()`'s shared connection pool,
// meaning the two writes were NOT guaranteed to land on the same backend
// session, let alone the same transaction. A crash/timeout between the two
// left a real, durable `my_ideas` row with no `my_idea_maps` row behind it —
// an idea a user can open that renders with an empty/broken map, forever
// (nothing re-creates the missing map on its own).
//
// The fix pins ONE PostgreSQL connection (`withPgTransaction`,
// `server/src/database/PostgresDatabase.ts` — `pool.connect()` +
// `BEGIN`/work/`COMMIT`|`ROLLBACK` on that SAME client, `client.release()` in
// a `finally`) for the whole sequence: idea insert, idea-map insert, a
// GENUINE read-back SELECT of both rows (org-scoped — doubles as the
// cross-tenant guard: a row inserted for a different `organization_id` would
// never come back on this filter), and a receipt row recording that the
// operation reached a durable, read-back-confirmed, committed state. Any
// failure at ANY step — including the read-back itself — throws inside the
// callback, which rolls back EVERYTHING (idea + map + receipt); nothing this
// function does can leave an orphaned idea, an orphaned map, or an orphaned
// receipt in an intermediate state.
//
// See `insertDynamicTx` in `../utils/dbDynamic.ts` for why the existing
// `insertDynamic` (built on `DbPromise.run()`'s pooled connections) could not
// be reused for this — it is precisely the mechanism that produced the bug.

/** Postgres error shape carrying a `code`/`constraint` (from the `pg` driver). */
interface PgDriverError {
  code?: string;
  constraint?: string;
}

const IDEA_RECEIPT_IDEMPOTENCY_INDEX = 'idx_canvas_idea_receipts_org_idem';

function isUniqueViolationOn(err: unknown, constraintName: string): boolean {
  if (!err || typeof err !== 'object') return false;
  const pgErr = err as PgDriverError;
  return pgErr.code === '23505' && pgErr.constraint === constraintName;
}

/**
 * REQUIRED_RECEIPT_INDEXES — must stay in sync with
 * `server/migrations/944_canvas_idea_materialization_receipts.sql`, the
 * ONLY place these are created.
 */
const REQUIRED_RECEIPT_INDEXES = [IDEA_RECEIPT_IDEMPOTENCY_INDEX, 'idx_canvas_idea_receipts_idea_id'];

/**
 * Asserts the receipt table and its two indexes already exist — it does
 * NOT create them. DDL for `canvas_idea_materialization_receipts` lives
 * exclusively in `server/migrations/944_canvas_idea_materialization_receipts.sql`.
 *
 * FIX (P07C coordinator review, one point): this used to be
 * `ensureCanvasIdeaReceiptTable()`, which ran `CREATE TABLE IF NOT EXISTS`
 * / `CREATE INDEX IF NOT EXISTS` lazily at runtime on first idea
 * materialization. That is exactly the class of defect the M01 module has
 * already been burned by twice: (1) unverifiable schema parity — a table
 * created only by application code at first-use is invisible to any
 * preflight/`information_schema` sweep of the migrations directory (this is
 * how `conversation_message_attachments` went missing from demo); (2)
 * competing schema authority — if a future migration later declares this
 * table with different column types, whichever runs first (runtime
 * first-call vs. the migration) wins, silently; (3) undocumented DDL on a
 * live database outside migration history — the first production idea
 * materialization would have executed `CREATE TABLE` with zero audit trail.
 * A packet whose entire job is atomicity/auditability must not itself
 * introduce an unaudited schema change.
 *
 * This function only READS `information_schema`/`pg_indexes` and throws a
 * clear, actionable error if the migration was never applied — no DDL
 * fallback, by design (see negative control in
 * canvasIdeaMaterializeAtomicity.p07c.pg.test.ts: dropping the table must
 * produce this exact error, not a silent auto-create). Memoized per
 * process; a transient connectivity error self-heals (drops the memoized
 * promise, retries next call), but a genuinely unapplied migration keeps
 * failing loudly on every call, exactly as it should.
 */
let receiptSchemaVerified: Promise<void> | null = null;
async function assertCanvasIdeaReceiptSchema(): Promise<void> {
  if (!receiptSchemaVerified) {
    receiptSchemaVerified = (async () => {
      const tableRow = await dbGet<{ table_name: string }>(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'canvas_idea_materialization_receipts'`,
        [],
        { fallback: false }
      );
      if (!tableRow) {
        throw new Error(
          'canvas_idea_materialization_receipts table is missing. Apply ' +
            'server/migrations/944_canvas_idea_materialization_receipts.sql before ' +
            'materializing ideas — canvasMaterialize.ts does not create this table at runtime.'
        );
      }

      const indexRows = await dbAllGlobal<{ indexname: string }>(
        `SELECT indexname FROM pg_indexes
         WHERE schemaname = 'public' AND tablename = 'canvas_idea_materialization_receipts'`,
        [],
        { fallback: false }
      );
      const presentIndexNames = new Set(indexRows.map((row) => row.indexname));
      const missingIndexes = REQUIRED_RECEIPT_INDEXES.filter((name) => !presentIndexNames.has(name));
      if (missingIndexes.length > 0) {
        throw new Error(
          `canvas_idea_materialization_receipts is missing required index(es): ` +
            `${missingIndexes.join(', ')}. Apply ` +
            `server/migrations/944_canvas_idea_materialization_receipts.sql before ` +
            `materializing ideas — canvasMaterialize.ts does not create indexes at runtime.`
        );
      }
    })().catch((err: unknown) => {
      receiptSchemaVerified = null;
      throw err;
    });
  }
  return receiptSchemaVerified;
}

interface IdeaReceiptRow {
  id: string;
  idea_id: string;
  map_id: string;
}

/** Build a `CanvasMaterializeResult` from an ALREADY-committed receipt (idempotent replay / race loser), re-confirmed by a genuine org-scoped read. */
async function readBackIdeaFromReceipt(
  query: TxQueryFn,
  organizationId: string,
  receipt: IdeaReceiptRow
): Promise<CanvasMaterializeResult> {
  const ideaRow = await query<{ id: string; title: string }>(
    `SELECT id, title FROM my_ideas WHERE id = $1 AND organization_id = $2`,
    [receipt.idea_id, organizationId]
  );
  const mapRow = await query<{ id: string }>(
    `SELECT id FROM my_idea_maps WHERE id = $1 AND organization_id = $2`,
    [receipt.map_id, organizationId]
  );
  if (!ideaRow.rows[0] || !mapRow.rows[0]) {
    // A receipt exists but its owner objects don't independently confirm —
    // never happens if this function is the only writer, but fail closed
    // (no fabricated success) rather than trust the receipt alone.
    throw new Error(
      `Idea materialization receipt ${receipt.id} could not be confirmed by an independent read-back`
    );
  }
  return {
    type: 'idea',
    id: receipt.idea_id,
    title: ideaRow.rows[0].title,
    url: `/my-work?ideaId=${encodeURIComponent(receipt.idea_id)}`,
    readBack: {
      target: 'idea',
      ideaId: receipt.idea_id,
      mapId: receipt.map_id,
      receiptId: receipt.id,
      status: 'completed',
      idempotentReplay: true,
    },
  };
}

/**
 * Materialize a Canvas promote into its canonical entity. Both
 * `createWorkspaceResource` and `commitProposalToDomain` reduce to this.
 */
export async function materializeWorkspaceTarget(
  input: CanvasMaterializeInput
): Promise<CanvasMaterializeResult> {
  const {
    organizationId,
    actorUserId,
    target,
    title,
    contentMd,
    summary,
    projectId,
    sourceDraftId,
    sourceConversationId,
    sections = [],
    graph,
    preferredTool = null,
    sourceType = 'work_canvas',
    decisionType = 'APPROVAL',
    taskPriority = 'medium',
    taskAssigneeId,
    taskDueDate,
    ownerId,
  } = input;
  // C8 — refuse to mutate when any referenced entity is missing or cross-org.
  await assertOrgScopedReferences(input);
  const now = new Date().toISOString();

  // ---- idea ------------------------------------------------------------
  // M01-P07C (M01-033): idea + idea-map + receipt + read-back, ONE pinned
  // PostgreSQL transaction, ONE client. See the block comment above
  // `assertCanvasIdeaReceiptSchema` for the full rationale.
  if (target === 'idea') {
    const ideaId = `idea-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const mapId = `map-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const receiptId = randomUUID();

    // Graph construction is pure computation (no DB) — safe to run before the
    // transaction opens, same as before.
    let nodes: unknown[];
    let edges: unknown[];
    let extensions: Record<string, unknown>;
    let nodeCount: number;

    if (graph && Array.isArray(graph.nodes) && graph.nodes.length > 0) {
      // Pre-built graph (e.g. an LLM-generated mindmap/process_flow/table/
      // whiteboard from canvasGraphLlm.ts): validate/normalize through the
      // SAME path the client PUT /my-work/my-ideas/:id/map route uses, so the
      // stored shape matches every other read path in the app (list views,
      // metrics, cross-tool transforms) — NOT the ad-hoc star-map shape below.
      const { validateAndNormalizeGraph } =
        await import('../validators/ideaWorkspaceGraph.validators.js');
      const validation = validateAndNormalizeGraph({
        nodes: graph.nodes,
        edges: graph.edges,
        extensions: graph.extensions,
        preferredTool,
      });
      if (!validation.valid) {
        logger.warn('[canvasMaterialize] graph failed validation, seeding empty map', {
          ideaId,
          errors: validation.errors,
        });
      }
      nodes = validation.normalized.nodes;
      edges = validation.normalized.edges;
      extensions = {
        ...(validation.normalized.extensions || {}),
        source: sourceType,
        draftId: sourceDraftId,
      };
      nodeCount = nodes.length;
    } else {
      // Fallback (existing Canvas save-to-workspace / proposal-approval
      // callers, which pass `sections` not `graph`): one node per H2, edges
      // from a synthetic root (W2-E10).
      const cappedSections = sections.slice(0, 8);
      nodes = [
        { id: 'root', label: title, x: 0, y: 0, kind: 'idea' },
        ...cappedSections.map((section, i) => ({
          id: `s${i}`,
          label: section.heading.slice(0, 80) || `Section ${i + 1}`,
          x: 280,
          y: (i - (cappedSections.length - 1) / 2) * 90,
          kind: 'thought',
          note: section.body.slice(0, 280),
        })),
      ];
      edges = cappedSections.map((_, i) => ({
        id: `e${i}`,
        source: 'root',
        target: `s${i}`,
      }));
      extensions = {
        source: sourceType,
        draftId: sourceDraftId,
        seededFromSections: cappedSections.length,
      };
      nodeCount = nodes.length;
    }

    await assertCanvasIdeaReceiptSchema();
    const { withPgTransaction } = await import('../database/PostgresDatabase.js');

    return withPgTransaction<CanvasMaterializeResult>(async (query) => {
      // Idempotency fast path: a caller-supplied key that already has a
      // committed receipt means this exact logical operation already
      // completed — replay it instead of writing a second idea/map. See
      // `CanvasMaterializeInput.idempotencyKey` doc for who passes this.
      if (input.idempotencyKey) {
        const existing = await query<IdeaReceiptRow>(
          `SELECT id, idea_id, map_id FROM canvas_idea_materialization_receipts
           WHERE organization_id = $1 AND idempotency_key = $2`,
          [organizationId, input.idempotencyKey]
        );
        if (existing.rows[0]) {
          return readBackIdeaFromReceipt(query, organizationId, existing.rows[0]);
        }
      }

      // SAVEPOINT wraps all three writes so a unique-violation on the
      // receipt's idempotency index (a concurrent winner for the SAME key —
      // matrix state "równoległe podwójne wykonanie") can be undone WITHOUT
      // aborting the whole transaction: `ROLLBACK TO SAVEPOINT` discards the
      // idea + map + receipt this call attempted, leaving the connection
      // usable to re-read and return the winner's row, then COMMIT cleanly
      // (a no-op commit — nothing new from this call survives).
      await query('SAVEPOINT idea_materialize');
      try {
        await insertDynamicTx(
          query,
          'my_ideas',
          {
            id: ideaId,
            user_id: actorUserId,
            organization_id: organizationId,
            title,
            body: summary,
            seed_text: contentMd,
            stage: 'spark',
            source_type: sourceType,
            source_conversation_id: sourceConversationId || null,
            source_message_id: sourceDraftId,
            created_at: now,
            updated_at: now,
          },
          ['id']
        );

        await insertDynamicTx(
          query,
          'my_idea_maps',
          {
            id: mapId,
            idea_id: ideaId,
            user_id: actorUserId,
            organization_id: organizationId,
            nodes_json: JSON.stringify(nodes),
            edges_json: JSON.stringify(edges),
            schema_version: 3,
            preferred_tool: preferredTool,
            extensions_json: JSON.stringify(extensions),
            // A brand-new map (this idea_id was just minted above) is by
            // definition the only — hence canonical — row for it, matching
            // how my-work.routes.ts's PUT-map route seeds a fresh
            // shared-mode row. insertDynamicTx silently drops columns the
            // current schema lacks, so this is a no-op on deployments
            // without the DP-3 columns.
            is_canonical: true,
            last_editor_user_id: actorUserId,
            created_at: now,
            updated_at: now,
          },
          ['id']
        );

        await query(
          `INSERT INTO canvas_idea_materialization_receipts
             (id, organization_id, actor_user_id, idea_id, map_id, source_draft_id, writer, idempotency_key, status, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'completed', NOW())`,
          [
            receiptId,
            organizationId,
            actorUserId,
            ideaId,
            mapId,
            sourceDraftId,
            sourceType,
            input.idempotencyKey ?? null,
          ]
        );
      } catch (err) {
        if (input.idempotencyKey && isUniqueViolationOn(err, IDEA_RECEIPT_IDEMPOTENCY_INDEX)) {
          await query('ROLLBACK TO SAVEPOINT idea_materialize');
          const winner = await query<IdeaReceiptRow>(
            `SELECT id, idea_id, map_id FROM canvas_idea_materialization_receipts
             WHERE organization_id = $1 AND idempotency_key = $2`,
            [organizationId, input.idempotencyKey]
          );
          if (!winner.rows[0]) {
            // Should be unreachable (the unique-violation proves a row
            // exists) — fail closed rather than silently invent a result.
            throw err;
          }
          return readBackIdeaFromReceipt(query, organizationId, winner.rows[0]);
        }
        throw err;
      }

      // Genuine read-back — NOT a fabricated status object. Org-scoped, so
      // this doubles as the cross-tenant guard: a row that somehow belongs
      // to a different organization_id would not come back here.
      const ideaReadBack = await query<{ id: string; title: string }>(
        `SELECT id, title FROM my_ideas WHERE id = $1 AND organization_id = $2`,
        [ideaId, organizationId]
      );
      const mapReadBack = await query<{ id: string }>(
        `SELECT id FROM my_idea_maps WHERE id = $1 AND organization_id = $2`,
        [mapId, organizationId]
      );
      if (!ideaReadBack.rows[0] || !mapReadBack.rows[0]) {
        throw new Error(
          `Idea materialization read-back failed for ${ideaId} (idea=${Boolean(ideaReadBack.rows[0])}, map=${Boolean(mapReadBack.rows[0])})`
        );
      }

      return {
        type: 'idea',
        id: ideaId,
        title: ideaReadBack.rows[0].title,
        url: `/my-work?ideaId=${encodeURIComponent(ideaId)}`,
        readBack: { target, ideaId, mapId, receiptId, status: 'completed', nodeCount },
      };
    });
  }

  // ---- note ----------------------------------------------------------------
  if (target === 'note') {
    const { default: notebookService } = await import('./notebookService.js');
    const ingest = await notebookService.ingest(organizationId, actorUserId, {
      title,
      contentText: contentMd,
      source: 'api_import',
      tags: ['work-canvas'],
      projectId: projectId || undefined,
      metadata: {
        sourceType: 'work_canvas',
        sourceId: sourceDraftId,
        sourceConversationId,
      },
    });
    return {
      type: 'note',
      id: ingest.pageId,
      title: ingest.title,
      url: `/my-work/notebook/${ingest.pageId}`,
      readBack: { target, noteId: ingest.pageId, status: 'created' },
    };
  }

  // ---- decision ------------------------------------------------------------
  if (target === 'decision') {
    const { default: decisionService } = await import('./decisionService.js');
    const decision = await decisionService.createDecision({
      organizationId,
      projectId: projectId || undefined,
      title,
      description: summary,
      type: decisionType,
      decisionMakerId: ownerId || actorUserId,
      createdBy: actorUserId,
    });
    return {
      type: 'decision',
      id: decision.id,
      title: decision.title,
      url: `/my-work/decisions/${decision.id}`,
      readBack: { target, decisionId: decision.id, status: 'created' },
    };
  }

  // ---- task ----------------------------------------------------------------
  if (target === 'task') {
    const { TaskService } = await import('./TaskService.js');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const taskService = new TaskService(getDatabase() as any);
    const task = await taskService.createTask(
      {
        projectId,
        title,
        description: summary,
        status: 'todo',
        priority: taskPriority,
        assigneeId: taskAssigneeId || undefined,
        dueDate: taskDueDate,
        tags: ['work-canvas', 'ai'],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      actorUserId
    );
    return {
      type: 'task',
      id: task.id,
      title: task.title,
      url: `/my-work?taskId=${encodeURIComponent(task.id)}`,
      readBack: { target, taskId: task.id, status: 'created' },
    };
  }

  // ---- initiative ----------------------------------------------------------
  const { default: initiativeService } = await import('./initiativeService.js');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const initiative = await initiativeService.createInitiative({
    organization_id: organizationId,
    project_id: projectId || undefined,
    title,
    summary,
    status: 'DRAFT',
    owner_id: ownerId || actorUserId,
    market_context: `Created from Work Canvas draft ${sourceDraftId}`,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  return {
    type: 'initiative',
    id: initiative.id,
    title: initiative.title || title,
    url: `/my-work?initiativeId=${encodeURIComponent(initiative.id)}`,
    readBack: { target, initiativeId: initiative.id, status: 'created' },
  };
}

/** Convenience: log + rethrow so caller-side error envelopes stay consistent. */
export async function materializeOrThrow(
  input: CanvasMaterializeInput,
  context: { writer: 'save_to_workspace' | 'proposal_approval' | 'chat_deliverable' }
): Promise<CanvasMaterializeResult> {
  try {
    return await materializeWorkspaceTarget(input);
  } catch (error) {
    logger.error('[canvasMaterialize] failed', {
      writer: context.writer,
      target: input.target,
      sourceDraftId: input.sourceDraftId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
