/**
 * Canonical persistence for `tool_outputs` (migration 946/947).
 *
 * AUTHORITATIVE SOURCE OF TRUTH (read this before touching promoteToOutput):
 *   `tool_outputs` IS the canonical, immutable snapshot of an approved tool
 *   session. Report / Presentation / Initiative promotion all read FROM the
 *   snapshot returned by `ensureToolOutputSnapshot`, never from a fresh
 *   `session.answers_json` parse — that is exactly the L8 gap this migration
 *   closes (see 946's header comment).
 *
 *   `tool_initiative_links` remains a COMPATIBILITY / LINEAGE PROJECTION.
 *   Existing consumers of `tool_initiative_links` (getGeneratedInitiatives,
 *   the batch_id-keyed dedup in promoteToOutput) keep working unchanged —
 *   this module does not touch that table. It is not a second source of
 *   truth: it is a thin, pre-existing index from session -> created record,
 *   kept for backward compatibility while `tool_outputs` carries the actual
 *   content, hash, approval trail and revision history.
 *
 * Idempotency: a partial UNIQUE index (947_tool_outputs_idempotency_guard.sql)
 * on `tool_outputs (tool_session_id) WHERE status <> 'superseded'` makes "one
 * active snapshot per session" a DATABASE guarantee, not just an application
 * convention — closing the class of race the project's own characterization
 * tests proved exists on `tool_initiative_links` (C15/C16 in
 * tests/integration/tools-promote-characterization.realdb.test.ts).
 *
 * Reuses the existing domain layer in `src/toolOutputs/*` for hashing
 * (`contentHash`), state transitions (`outputLifecycle`) and the one real
 * engine bridge that exists (`buildSwotOutput`, dynamic-swot only) — this
 * module does not reimplement any of that. It only maps ToolOutput <-> rows
 * and drives the transaction.
 *
 * KNOWN GAP (stated explicitly, not swept under the rug): only `dynamic-swot`
 * has a real engine bridge (`buildSwotOutput`, grounded in
 * `swotTensionEngine`). The other 18 RUNTIME_ELIGIBLE_TOOL_TYPES
 * (server/src/services/toolAvailability.ts) fall back to
 * `buildGenericToolOutput`, which produces a structurally valid, hashed,
 * versioned snapshot with EMPTY items/tensions/conclusions — it does not
 * fabricate K1 facts for tools with no engine. Promotion still works and the
 * immutability/idempotency/lineage properties still hold; the content is
 * just honestly empty until each tool gets its own build*Output bridge.
 */

import type { PoolClient } from 'pg';
import { v4 as uuidv4 } from 'uuid';

import logger from '../../utils/Logger.js';
import * as queryHelpers from '../../utils/queryHelpers.js';
// Server-side bridge into the shared, engine-grounded domain layer. Path is
// relative (not the `@/*` alias) because server/tsconfig.json's `@/*` maps to
// server/src/*, not the repo-root src/*. Files in this shared dependency must
// also use relative imports so the backend can execute them directly via tsx.
import { buildSwotOutput, SWOT_ENGINE_VERSION } from '../../sharedRuntime/toolOutputs/buildSwotOutput.js';
import { computeOutputHash } from '../../sharedRuntime/toolOutputs/outputLifecycle.js';
import {
  approve as approveOutput,
  reopen as reopenOutput,
  submitForReview,
} from '../../sharedRuntime/toolOutputs/outputLifecycle.js';
import { renderToolReport, REPORT_RENDERER_VERSION } from '../../sharedRuntime/toolOutputs/renderReport.js';
import type {
  OutputConclusion,
  OutputEvidenceItem,
  OutputTension,
  ToolOutput,
  ToolReportKind,
} from '../../sharedRuntime/toolOutputs/types.js';
import type { StructuredSlideInput } from '../presentationDeckDocumentService.js';

/** Minimal shape this module needs from a `tool_sessions` row. */
export interface ToolOutputSourceSession {
  id: string;
  organization_id: string;
  project_id?: string | null;
  tool_type: string;
  name: string;
  answers_json?: string | null;
  version?: number | null;
}

export interface Actor {
  id: string;
}

const safeParse = <T,>(value: string | null | undefined, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

/** Row shape of `tool_outputs`, snake_case as it comes back from Postgres. */
interface ToolOutputRow {
  id: string;
  organization_id: string;
  project_id: string | null;
  tool_session_id: string;
  tool_type: string;
  method_pack_version: string;
  version: number;
  supersedes_id: string | null;
  title: string;
  payload_json: unknown;
  content_hash: string;
  status: ToolOutput['status'];
  created_by: string | null;
  created_at: string;
  approved_by: string | null;
  approved_at: string | null;
  frozen_at: string | null;
}

interface OutputPayload {
  items: OutputEvidenceItem[];
  tensions: OutputTension[];
  conclusions: OutputConclusion[];
  sourceRevision?: number;
  engineVersion?: string;
}

function rowToOutput(row: ToolOutputRow): ToolOutput {
  const payload =
    (typeof row.payload_json === 'string'
      ? safeParse<OutputPayload>(row.payload_json, { items: [], tensions: [], conclusions: [] })
      : (row.payload_json as OutputPayload)) ?? { items: [], tensions: [], conclusions: [] };

  return {
    id: row.id,
    organizationId: row.organization_id,
    toolSessionId: row.tool_session_id,
    toolType: row.tool_type,
    methodPackVersion: row.method_pack_version,
    version: row.version,
    supersedesId: row.supersedes_id ?? undefined,
    title: row.title,
    status: row.status,
    items: payload.items ?? [],
    tensions: payload.tensions ?? [],
    conclusions: payload.conclusions ?? [],
    createdAt: row.created_at,
    createdBy: row.created_by ?? undefined,
    approvedBy: row.approved_by ?? undefined,
    approvedAt: row.approved_at ?? undefined,
    contentHash: row.content_hash,
    sourceRevision: payload.sourceRevision,
    engineVersion: payload.engineVersion,
  };
}

function outputPayload(output: ToolOutput): OutputPayload {
  return {
    items: output.items,
    tensions: output.tensions,
    conclusions: output.conclusions,
    sourceRevision: output.sourceRevision,
    engineVersion: output.engineVersion,
  };
}

/** Generic engine version tag for tool types with no dedicated build*Output bridge yet. */
const GENERIC_ENGINE_VERSION = 'generic-fallback-1.0.0';

/**
 * TLS-BVP-001 — NONEMPTY LINEAGE GUARD.
 *
 * Thrown from `buildOutputForSession` (below), BEFORE `submitForReview` /
 * `approveOutput` run and before any `tool_outputs` row is written — this is
 * the freeze/approve chokepoint: `ensureToolOutputSnapshot` is the ONLY
 * place a `tool_outputs` row is created (see this module's header), and it
 * is itself called from exactly one call site,
 * `ToolController.promoteToOutput` (server/src/controllers/ToolController.ts,
 * `POST /:toolId/promote` — the only route wired to it). Every promotion
 * path (initiative/report/presentation/idea) goes through that one function,
 * so a guard here cannot be bypassed by any caller.
 *
 * WHY HERE, NOT IN `requireDoD`/`getPromotionBlockers` (ToolController.ts):
 * those gates check `completion_percent`/`confidence_avg` and runtime DoD
 * items — neither ever inspects items/tensions/conclusions length (the
 * exact gap TLS-BVP-001 closes). They also run on every session-approval
 * path (`approveTool`, `requestReview`, `approveDoDGate`), which is a wider
 * surface than "about to freeze an immutable snapshot" — adding a
 * content-shape check there would also gate flows that never touch
 * `tool_outputs` at all. The freeze boundary is the narrowest point every
 * promotion path actually funnels through.
 *
 * SCOPE (deliberate, stated plainly — not a silent global block): enforced
 * ONLY for `dynamic-swot`, the one MVP tool with a real engine bridge
 * (`buildSwotOutput`). Blast radius: promoting a dynamic-swot session whose
 * accepted items/tensions never produced a move that clears the W2 gate
 * (zero conclusions) is now refused with 409 EMPTY_TOOL_OUTPUT; every other
 * dynamic-swot promotion is unaffected. The other RUNTIME_ELIGIBLE_TOOL_TYPES
 * fall through to the generic branch below, which this module's own header
 * (see top of file) already documents as producing a structurally valid but
 * "honestly empty" snapshot — those tools have no engine to derive a
 * conclusion FROM, so blocking them here would fail EVERY one of their
 * promotions, not just the genuinely-empty ones; that is a separate,
 * larger decision (give each tool its own build*Output bridge) outside
 * this task's scope. Left visibly deferred, not silently allowed: the
 * generic branch logs every empty snapshot it creates (see
 * `logger.warn(...)` below) so this gap stays observable until each tool
 * gets its own bridge.
 */
export class EmptyToolOutputError extends Error {
  public readonly code = 'EMPTY_TOOL_OUTPUT';
  public readonly status = 409;
  constructor(toolSessionId: string, toolType: string) {
    super(
      `Tool session ${toolSessionId} (${toolType}) produced zero conclusions — an ` +
        'approved/frozen output must have nonempty lineage (TLS-BVP-001). Accept at ' +
        'least one recommended move that clears the W2 gate before promoting.'
    );
    this.name = 'EmptyToolOutputError';
  }
}

/**
 * Builds a draft ToolOutput from the session's CURRENT state. Called at most
 * once per session per promotion cycle — after this, the session may change
 * freely and the snapshot will not follow, by design (immutability property).
 */
function buildOutputForSession(
  session: ToolOutputSourceSession,
  outputId: string,
  now: string,
  actor: Actor
): ToolOutput {
  const answers = safeParse<Record<string, unknown>>(session.answers_json, {});
  const sourceRevision = session.version ?? undefined;

  if (session.tool_type === 'dynamic-swot') {
    const items = Array.isArray(answers.items) ? (answers.items as never[]) : [];
    const tensions = Array.isArray(answers.tensions) ? (answers.tensions as never[]) : [];
    const moves = Array.isArray(answers.recommendedMoves) ? (answers.recommendedMoves as never[]) : [];

    const { output } = buildSwotOutput({
      id: outputId,
      organizationId: session.organization_id,
      toolSessionId: session.id,
      // No pinned Method Pack version model exists yet for Tools (unlike
      // Assessment); '1.0.0' is the one and only pack version emitted today.
      // Recorded explicitly so a future pack bump doesn't silently reinterpret
      // history — that's the whole point of the column.
      methodPackVersion: '1.0.0',
      title: session.name,
      createdAt: now,
      items,
      tensions,
      moves,
      sourceRevision,
      createdBy: actor.id,
    });
    // TLS-BVP-001: dynamic-swot is the one tool type this guard is scoped
    // to (see EmptyToolOutputError's doc comment above for why here, and
    // the exact blast radius). Zero conclusions means no move cleared the
    // W2 gate — no traceable business value to freeze, even though items/
    // tensions may be nonempty. Checked BEFORE submitForReview/approveOutput
    // and before any DB write, so a refusal never leaves a tool_outputs row
    // behind.
    if (output.conclusions.length === 0) {
      throw new EmptyToolOutputError(session.id, session.tool_type);
    }
    return output;
  }

  // GAP (see module header): no engine bridge for this tool_type yet.
  // Structurally valid, hashed, versioned — honestly empty, not fabricated.
  const draft: Omit<ToolOutput, 'contentHash'> = {
    id: outputId,
    organizationId: session.organization_id,
    toolSessionId: session.id,
    toolType: session.tool_type,
    methodPackVersion: '1.0.0',
    version: 1,
    title: session.name,
    status: 'draft',
    items: [],
    tensions: [],
    conclusions: [],
    createdAt: now,
    createdBy: actor.id,
    sourceRevision,
    engineVersion: GENERIC_ENGINE_VERSION,
  };
  // TLS-BVP-001 SCOPE NOTE: the nonempty-lineage guard is NOT applied here —
  // see EmptyToolOutputError's doc comment for why. Left visible (not
  // silent): every empty generic-fallback snapshot logs a warning so this
  // deferred gap stays observable instead of disappearing into "it worked".
  logger.warn(
    `[toolOutputSnapshotService] TLS-BVP-001 scope: freezing an EMPTY output for ` +
      `tool_type=${session.tool_type} (no engine bridge yet — nonempty-lineage ` +
      'enforcement is deliberately NOT applied to this tool_type, see ' +
      'EmptyToolOutputError doc comment).',
    { toolSessionId: session.id, organizationId: session.organization_id }
  );
  return { ...draft, contentHash: computeOutputHash(draft) };
}

async function insertApproval(
  client: PoolClient,
  args: {
    organizationId: string;
    toolOutputId: string;
    action: 'submitted' | 'approved';
    actorUserId: string;
    now: string;
  }
): Promise<void> {
  await client.query(
    `INSERT INTO tool_output_approvals
       (id, organization_id, tool_output_id, action, actor_kind, actor_user_id, comment, created_at)
     VALUES ($1,$2,$3,$4,'human',$5,NULL,$6)`,
    [uuidv4(), args.organizationId, args.toolOutputId, args.action, args.actorUserId, args.now]
  );
}

async function insertSessionEvent(
  client: PoolClient,
  args: {
    organizationId: string;
    toolSessionId: string;
    eventType: 'OUTPUT_CREATED' | 'OUTPUT_APPROVED' | 'REPORT_REQUESTED' | 'INITIATIVE_PROPOSED';
    actorUserId: string;
    methodPackVersion: string;
    payload: unknown;
    idempotencyKey: string;
    now: string;
  }
): Promise<void> {
  await client.query(
    `INSERT INTO tool_session_events
       (id, organization_id, tool_session_id, event_type, unit_id, level, actor_kind,
        actor_user_id, method_pack_version, payload_json, supersedes_id, idempotency_key, created_at)
     VALUES ($1,$2,$3,$4,NULL,NULL,'human',$5,$6,$7,NULL,$8,$9)
     ON CONFLICT (tool_session_id, idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING`,
    [
      uuidv4(),
      args.organizationId,
      args.toolSessionId,
      args.eventType,
      args.actorUserId,
      args.methodPackVersion,
      JSON.stringify(args.payload),
      args.idempotencyKey,
      args.now,
    ]
  );
}

/**
 * Recognizes "the table this function needs simply doesn't exist here" across
 * both engines this codebase touches: Postgres reports `42P01`
 * (undefined_table); the mocked-SQLite harness in
 * tests/integration/tools/tool-session-roundtrip.contract.test.ts surfaces a
 * driver message containing "no such table". Anything else is a real error
 * and must propagate.
 */
const isMissingTableError = (err: unknown): boolean => {
  const code = (err as { code?: unknown } | undefined)?.code;
  if (code === '42P01') return true;
  const message = String((err as { message?: unknown } | undefined)?.message ?? err ?? '');
  return /no such table/i.test(message);
};

/**
 * Idempotently ensures a canonical, APPROVED `tool_outputs` snapshot exists
 * for this session and returns it.
 *
 * Called from `promoteToOutput` — by the time this runs, the session has
 * already passed the human approval gate (status APPROVED/GENERATED/FINALIZED
 * + zero promotion blockers), so building draft -> in_review -> approved here
 * is a single system-driven pass through the SAME kernel state machine
 * (`src/toolOutputs/outputLifecycle.ts`), not a shortcut around it. The human
 * who triggers promotion is recorded as the approving actor on both
 * `tool_output_approvals` rows.
 *
 * Idempotency, two layers deep:
 *  1. Read-first: if a non-superseded snapshot already exists for this
 *     session, return it untouched (covers the common sequential
 *     retry/duplicate-click case with zero writes).
 *  2. Insert races through the partial UNIQUE index
 *     (uq_tool_outputs_active_snapshot_per_session); on conflict we re-SELECT
 *     the winner instead of erroring, so concurrent promote requests still
 *     converge on exactly one snapshot.
 *
 * MERGE NOTE (controller-merge reconciliation, 2026-08-13): `tool_outputs`
 * and `withRawPgTransaction` (a real `pg` PoolClient transaction) exist on
 * every REAL environment — production, demo, and this task's own
 * RUN_DB_TESTS=1 real-Postgres suites — because migration 946/947 and the
 * app's Postgres pool are both always present there. The ONE place that is
 * not true is `tests/integration/tools/tool-session-roundtrip.contract.test.ts`,
 * which backs `queryHelpers` with an in-memory SQLite database that never
 * runs the numbered migration set (only `ToolController.ensureToolsSchema()`'s
 * own minimal bootstrap) and does not mock `withRawPgTransaction` at all. On
 * that harness — and only there — this function degrades to an IN-MEMORY,
 * UNPERSISTED snapshot: built through the exact same `buildOutputForSession`
 * -> `submitForReview` -> `approveOutput` pipeline as the durable path, so
 * `promoteToOutput` still renders downstream content from ONE frozen object
 * and never re-reads `session.answers_json` — it just isn't durably written
 * to a table that doesn't exist on that harness. This mirrors the existing
 * `try { ... } catch { /* Table may not exist *\/ }` convention already used
 * elsewhere in ToolController.ts for the same reason (presentation/idea
 * writes).
 */
export async function ensureToolOutputSnapshot(
  session: ToolOutputSourceSession,
  actor: Actor,
  now: string
): Promise<ToolOutput> {
  let existing: ToolOutputRow | null = null;
  try {
    existing = await queryHelpers.queryOne<ToolOutputRow>(
      `SELECT * FROM tool_outputs
        WHERE tool_session_id = ? AND organization_id = ? AND status <> 'superseded'
        ORDER BY version DESC LIMIT 1`,
      [session.id, session.organization_id]
    );
  } catch (err) {
    if (!isMissingTableError(err)) throw err;
  }
  if (existing) return rowToOutput(existing);

  const outputId = uuidv4();
  let built = buildOutputForSession(session, outputId, now, actor);
  built = submitForReview(built);
  built = approveOutput(built, actor.id, now);

  // NOTE: this property access is deliberately wrapped in its own try/catch,
  // separate from the persistSnapshot() one below — vi.mock()'d modules
  // (tool-session-roundtrip.contract.test.ts mocks `queryHelpers` wholesale
  // via `vi.mock('.../queryHelpers.js', () => ({ queryAll, queryOne,
  // queryRun, getTableColumns }))`) THROW on accessing any export the mock
  // factory didn't return, rather than yielding `undefined` — a plain
  // `typeof queryHelpers.withRawPgTransaction !== 'function'` check crashes
  // instead of detecting absence.
  let hasRawPgTransaction: boolean;
  try {
    hasRawPgTransaction = typeof queryHelpers.withRawPgTransaction === 'function';
  } catch {
    hasRawPgTransaction = false;
  }
  if (!hasRawPgTransaction) {
    // No real Postgres transaction helper on this harness (see MERGE NOTE
    // above) — return the computed-but-unpersisted snapshot.
    return built;
  }

  try {
    return await persistSnapshot(session, actor, now, built);
  } catch (err) {
    if (!isMissingTableError(err)) throw err;
    return built;
  }
}

async function persistSnapshot(
  session: ToolOutputSourceSession,
  actor: Actor,
  now: string,
  built: ToolOutput
): Promise<ToolOutput> {
  return queryHelpers.withRawPgTransaction(async (client) => {
    const insertResult = await client.query(
      `INSERT INTO tool_outputs
         (id, organization_id, project_id, tool_session_id, tool_type, method_pack_version,
          version, supersedes_id, title, payload_json, content_hash, status,
          created_by, created_at, approved_by, approved_at, frozen_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,NULL,$8,$9,$10,$11,$12,$13,$14,$15,$15)
       ON CONFLICT (tool_session_id) WHERE status <> 'superseded' DO NOTHING
       RETURNING *`,
      [
        built.id,
        session.organization_id,
        session.project_id ?? null,
        session.id,
        built.toolType,
        built.methodPackVersion,
        built.version,
        built.title,
        JSON.stringify(outputPayload(built)),
        built.contentHash,
        built.status,
        actor.id,
        built.createdAt,
        built.approvedBy ?? null,
        built.approvedAt ?? null,
      ]
    );

    if (insertResult.rows.length === 0) {
      // Lost the race — another concurrent promote already created the
      // canonical snapshot. Read it back; do NOT write approvals/events for
      // an output we did not create (would double the trail).
      const race = await client.query(
        `SELECT * FROM tool_outputs
          WHERE tool_session_id = $1 AND organization_id = $2 AND status <> 'superseded'
          ORDER BY version DESC LIMIT 1`,
        [session.id, session.organization_id]
      );
      if (race.rows.length === 0) {
        // Should be unreachable (conflict implies a row exists), but never
        // silently return nothing — surface it loudly instead of a phantom.
        throw new Error(
          `ensureToolOutputSnapshot: insert conflicted but no active snapshot found for session ${session.id}`
        );
      }
      return rowToOutput(race.rows[0] as ToolOutputRow);
    }

    const row = insertResult.rows[0] as ToolOutputRow;

    await insertApproval(client, {
      organizationId: session.organization_id,
      toolOutputId: row.id,
      action: 'submitted',
      actorUserId: actor.id,
      now,
    });
    await insertApproval(client, {
      organizationId: session.organization_id,
      toolOutputId: row.id,
      action: 'approved',
      actorUserId: actor.id,
      now,
    });

    await insertSessionEvent(client, {
      organizationId: session.organization_id,
      toolSessionId: session.id,
      eventType: 'OUTPUT_CREATED',
      actorUserId: actor.id,
      methodPackVersion: row.method_pack_version,
      payload: { outputId: row.id, sourceRevision: built.sourceRevision ?? null },
      idempotencyKey: `output-created:${session.id}:${built.sourceRevision ?? 'unversioned'}`,
      now,
    });
    await insertSessionEvent(client, {
      organizationId: session.organization_id,
      toolSessionId: session.id,
      eventType: 'OUTPUT_APPROVED',
      actorUserId: actor.id,
      methodPackVersion: row.method_pack_version,
      payload: { outputId: row.id },
      idempotencyKey: `output-approved:${session.id}:${built.sourceRevision ?? 'unversioned'}`,
      now,
    });

    return rowToOutput(row);
  });
}

/** Reads the current active (non-superseded) snapshot for a session, if any. */
export async function getActiveToolOutput(
  toolSessionId: string,
  organizationId: string
): Promise<ToolOutput | null> {
  const row = await queryHelpers.queryOne<ToolOutputRow>(
    `SELECT * FROM tool_outputs
      WHERE tool_session_id = ? AND organization_id = ? AND status <> 'superseded'
      ORDER BY version DESC LIMIT 1`,
    [toolSessionId, organizationId]
  );
  return row ? rowToOutput(row) : null;
}

/** Reads a specific snapshot by id, org-scoped. Used to prove read-idempotency (reopen/refetch). */
export async function getToolOutputById(
  id: string,
  organizationId: string
): Promise<ToolOutput | null> {
  const row = await queryHelpers.queryOne<ToolOutputRow>(
    `SELECT * FROM tool_outputs WHERE id = ? AND organization_id = ?`,
    [id, organizationId]
  );
  return row ? rowToOutput(row) : null;
}

/**
 * Renders markdown for one report section FROM the immutable snapshot — this
 * is the replacement for the old ad-hoc `renderToolReportSection`, which read
 * `session.answers_json` directly (exactly the "ad-hoc session reads" the
 * task calls out). Content model mirrors the old function's sections
 * (cover / recommendations / findings / default) so the legacy
 * report_builder_sections consumer sees no format change, only a different,
 * canonical, frozen source.
 */
export function renderToolReportSectionFromOutput(
  sectionTitle: string,
  sectionKey: string,
  sessionName: string,
  output: ToolOutput
): string {
  const itemLines = output.items
    .slice(0, 20)
    .map((i) => `- **${i.bucket}:** ${i.label}`);
  const moveLines = output.conclusions
    .slice(0, 12)
    .map((c) => `- **${c.k3Actions[0] ?? c.k1Fact}** — ${c.k2Meaning}`);
  const tensionLines = output.tensions
    .slice(0, 12)
    .map((t) => `- **${t.title}** — postawa: ${t.posture}, waga: ${t.priority}`);

  const base = [
    `# ${sectionTitle}`,
    '',
    `Source: ${sessionName} (${output.toolType}) — Output ${output.id} v${output.version}`,
    '',
    output.conclusions[0]?.k1Fact ?? 'Zatwierdzony snapshot narzędzia.',
  ];

  if (sectionKey === 'cover') {
    return [`# ${sessionName}`, '', 'Tool Evaluation Report', '', `Zatwierdzony Output: ${output.id}`].join(
      '\n'
    );
  }
  if (sectionKey.includes('recommend') || sectionKey.includes('next')) {
    return [
      ...base,
      '',
      '## Recommended actions',
      ...(moveLines.length ? moveLines : ['- No explicit actions were recorded in the snapshot.']),
    ].join('\n');
  }
  if (sectionKey.includes('finding') || sectionKey.includes('gap') || sectionKey.includes('overview')) {
    return [
      ...base,
      '',
      '## Approved findings',
      ...(itemLines.length ? itemLines : ['- No structured findings were recorded in the snapshot.']),
    ].join('\n');
  }
  return [
    ...base,
    '',
    '## Strategic tensions',
    ...(tensionLines.length ? tensionLines : ['- No explicit strategic tensions were recorded.']),
    '',
    '## Recommended actions',
    ...(moveLines.length ? moveLines : ['- No explicit actions were recorded in the snapshot.']),
  ].join('\n');
}

/**
 * Deterministic slide breakdown of an approved Output, for a promoted
 * presentation's ACTUAL `presentation_decks` content (not just its
 * lineage record — see `persistCanonicalReport` below for that).
 *
 * Same renderer contract as `renderToolReportSectionFromOutput` /
 * `renderReport.ts`'s `buildSection`: no model call, content comes only
 * from `output`, deterministic (same Output -> same slides every time).
 * Feeds `buildDeckDocumentFromStructuredSlides` (presentationDeckDocumentService.ts),
 * the canonical `schemaVersion: 1` builder MAT-007/009 introduced so a
 * created deck's `deck_json` is never empty relative to its card count.
 */
export function buildPresentationSlidesFromOutput(output: ToolOutput): StructuredSlideInput[] {
  const slides: StructuredSlideInput[] = [
    {
      type: 'title',
      content: {
        title: output.title,
        subtitle: `${output.toolType} — zatwierdzony Output ${output.id}`,
      },
    },
  ];

  const tensions = [...output.tensions].sort(
    (a, b) => b.priority - a.priority || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
  if (tensions.length > 0) {
    slides.push({
      type: 'content',
      content: {
        title: 'Napięcia strategiczne',
        items: tensions
          .slice(0, 4)
          .map((t) => `${t.title} (postawa: ${t.posture}, waga: ${t.priority})`),
      },
    });
  }

  const conclusions = output.conclusions.slice(0, 6);
  conclusions.forEach((c, idx) => {
    slides.push({
      type: idx === conclusions.length - 1 ? 'next_steps' : 'content',
      content: {
        title: c.k3Actions[0] || c.k2Meaning || `Wniosek ${idx + 1}`,
        body: c.k1Fact,
        items: c.k3Actions,
      },
    });
  });

  if (slides.length === 1) {
    // KNOWN GAP tools this module already documents (header comment,
    // "only dynamic-swot has a real engine bridge"): a generic-fallback
    // Output has empty items/tensions/conclusions. Rather than promote a
    // 1-slide deck with no explanation, say so explicitly on the slide.
    slides.push({
      type: 'content',
      content: {
        title: 'Brak zarejestrowanych wniosków',
        body: 'Ten Output nie zawiera jeszcze ustrukturyzowanych wniosków K1-K4.',
      },
    });
  }

  return slides;
}

/**
 * Persists the CANONICAL report/presentation document (946's `tool_reports` +
 * `tool_report_sources`) rendered deterministically from the approved
 * snapshot via the shared domain renderer. This is additive alongside the
 * legacy `report_builder_reports`/`v8_artifact_runs` writes in
 * ToolController — it does not replace them (no route reads `tool_reports`
 * yet; see gap notes in the final report) but it is the lineage-accurate
 * record: `tool_report_sources` points at the exact `tool_outputs` row that
 * fed this document, which the legacy tables cannot express.
 */
export async function persistCanonicalReport(args: {
  output: ToolOutput;
  kind: ToolReportKind;
  title: string;
  organizationId: string;
  projectId: string | null;
  createdBy: string;
  now: string;
}): Promise<{ id: string; contentHash: string }> {
  const { output, kind, title, organizationId, projectId, createdBy, now } = args;
  const doc = renderToolReport([output], {
    id: uuidv4(),
    organizationId,
    kind,
    title,
  });

  await queryHelpers.queryRun(
    `INSERT INTO tool_reports
       (id, organization_id, project_id, kind, title, renderer_version, theme,
        payload_json, content_hash, status, generation_attempts, last_error,
        created_by, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      doc.id,
      organizationId,
      projectId,
      kind,
      title,
      REPORT_RENDERER_VERSION,
      doc.theme,
      JSON.stringify(doc),
      doc.contentHash,
      'approved',
      1,
      null,
      createdBy,
      now,
      now,
    ]
  );

  await queryHelpers.queryRun(
    `INSERT INTO tool_report_sources
       (id, organization_id, tool_report_id, tool_output_id, sort_order, created_at)
     VALUES (?,?,?,?,?,?)`,
    [uuidv4(), organizationId, doc.id, output.id, 0, now]
  );

  return { id: doc.id, contentHash: doc.contentHash };
}

/**
 * Records the traceable link from a snapshot's K1-K4 conclusion to the
 * initiative a human decided to create from it (946's
 * `tool_output_initiative_proposals`). Skipped when the snapshot has no
 * conclusions (generic-fallback tool types, or a SWOT session where every
 * move was rejected by the W2 gate) — there is no conclusion id to point at,
 * and fabricating one would defeat the traceability this table exists for.
 */
export async function recordInitiativeProposal(args: {
  output: ToolOutput;
  initiativeId: string;
  actorUserId: string;
  now: string;
}): Promise<void> {
  const { output, initiativeId, actorUserId, now } = args;
  const conclusion = output.conclusions[0];
  if (!conclusion) {
    logger.info(
      `[toolOutputSnapshotService] skipping tool_output_initiative_proposals for output ${output.id}: no conclusions in snapshot`
    );
    return;
  }
  await queryHelpers.queryRun(
    `INSERT INTO tool_output_initiative_proposals
       (id, organization_id, tool_output_id, source_conclusion_id, proposed_title, rationale,
        status, initiative_id, created_by, created_at, decided_by, decided_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      uuidv4(),
      output.organizationId,
      output.id,
      conclusion.id,
      conclusion.k3Actions[0] ?? conclusion.k1Fact,
      conclusion.k2Meaning,
      'accepted',
      initiativeId,
      actorUserId,
      now,
      actorUserId,
      now,
    ]
  );
}

/**
 * Correction flow: reopens an APPROVED snapshot into a NEW draft revision
 * (never mutates the approved row in place — `outputLifecycle.reopen`),
 * applies the given conclusion edits, then re-approves the new revision.
 * The original row is only ever touched to flip `status -> 'superseded'`;
 * its `payload_json`/`content_hash` are never rewritten.
 *
 * NOT wired to an HTTP route yet — exported for direct use (and for the
 * immutability test proving "a correction creates a NEW revision, never a
 * mutation"). Exposing this as a product action needs a route + permission
 * check, out of this task's scope; noted as a gap in the final report.
 */
export async function correctToolOutput(args: {
  approvedOutputId: string;
  organizationId: string;
  actor: Actor;
  now: string;
  nextConclusions: OutputConclusion[];
}): Promise<{ superseded: ToolOutput; revision: ToolOutput }> {
  const { approvedOutputId, organizationId, actor, now, nextConclusions } = args;
  const current = await getToolOutputById(approvedOutputId, organizationId);
  if (!current) throw new Error(`tool_outputs ${approvedOutputId} not found for org ${organizationId}`);
  const currentRow = await queryHelpers.queryOne<{ project_id: string | null }>(
    `SELECT project_id FROM tool_outputs WHERE id = ? AND organization_id = ?`,
    [approvedOutputId, organizationId]
  );

  const revisionId = uuidv4();
  const { superseded, revision } = reopenOutput(current, revisionId, now);
  const editedRevision = { ...revision, conclusions: nextConclusions };
  const approvedRevision = approveOutput(submitForReview(editedRevision), actor.id, now);

  return queryHelpers.withRawPgTransaction(async (client) => {
    await client.query(`UPDATE tool_outputs SET status = 'superseded' WHERE id = $1 AND organization_id = $2`, [
      superseded.id,
      organizationId,
    ]);

    // Explicit 1:1 column/value pairing on purpose — this table's INSERT has
    // 17 columns and a prior draft of this function silently dropped
    // `approved_by` by reusing positional params across a subquery. Keep it
    // boringly literal rather than clever.
    await client.query(
      `INSERT INTO tool_outputs
         (id, organization_id, project_id, tool_session_id, tool_type, method_pack_version,
          version, supersedes_id, title, payload_json, content_hash, status,
          created_by, created_at, approved_by, approved_at, frozen_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
      [
        approvedRevision.id,
        organizationId,
        currentRow?.project_id ?? null,
        approvedRevision.toolSessionId,
        approvedRevision.toolType,
        approvedRevision.methodPackVersion,
        approvedRevision.version,
        superseded.id,
        approvedRevision.title,
        JSON.stringify(outputPayload(approvedRevision)),
        approvedRevision.contentHash,
        approvedRevision.status,
        actor.id,
        approvedRevision.createdAt,
        approvedRevision.approvedBy ?? null,
        approvedRevision.approvedAt ?? null,
        approvedRevision.approvedAt ?? null,
      ]
    );

    await insertApproval(client, {
      organizationId,
      toolOutputId: superseded.id,
      action: 'submitted',
      actorUserId: actor.id,
      now,
    });
    await insertApproval(client, {
      organizationId,
      toolOutputId: approvedRevision.id,
      action: 'approved',
      actorUserId: actor.id,
      now,
    });

    return { superseded, revision: approvedRevision };
  });
}
