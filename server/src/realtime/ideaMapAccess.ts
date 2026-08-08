/**
 * DP-3 shared idea maps — membership + canonical-row access (T3).
 *
 * Single point of truth for "can this user read/write this idea's map" and
 * "which my_idea_maps row is canonical for this idea", shared by the HTTP
 * routes (T4) and the collab WS gateway (T5) once ENABLE_SHARED_IDEA_MAPS
 * is on. See Harvard/wdrozenie-100/_M06_DP3_MULTIPLAYER_PLAN_2026-07-04.md
 * §2 (Uprawnienia) and §5 (Kompatybilność).
 *
 * IMPORTANT — placeholder style: every query in this module uses `?`
 * placeholders. PostgresDatabase.ts:377 translates `?` → `$1, $2, ...`
 * SEQUENTIALLY per query; never mix `?` and `$n` in the same SQL string.
 */
import { featureFlags } from '../config/FeatureFlags.js';
import type { IDatabase } from '../database/IDatabase.js';
import { getTableColumns } from '../utils/dbSchema.js';

export interface IdeaMembership {
  /** True when the idea exists in the org AND the user is an ACTIVE org member. */
  canRead: boolean;
  /** Same gate as canRead today (T3 scope). Kept separate so T4/T5 can layer
   *  additional write-only restrictions (e.g. per-node locks) without
   *  touching the membership check itself. */
  canWrite: boolean;
}

const NO_ACCESS: IdeaMembership = { canRead: false, canWrite: false };

/**
 * Checks that `ideaId` belongs to `organizationId` AND that `userId` is an
 * ACTIVE member of that organization. Both conditions must hold for any
 * access; there is no cross-org fallback.
 *
 * Query pattern mirrors the existing org-scope gate in
 * ideaCollabWs.gateway.ts (`SELECT id FROM my_ideas WHERE id = ? AND
 * organization_id = ?`) plus a second query against organization_members.
 */
export async function assertIdeaMembership(
  db: IDatabase,
  organizationId: string,
  userId: string,
  ideaId: string
): Promise<IdeaMembership> {
  if (!db || !organizationId || !userId || !ideaId) return NO_ACCESS;

  const idea = await db.get<{ id: string }>(
    'SELECT id FROM my_ideas WHERE id = ? AND organization_id = ?',
    [ideaId, organizationId]
  );
  if (!idea) return NO_ACCESS;

  const member = await db.get<{ id: string }>(
    // Porównanie bez wielkości liter: w bazie trafiły się wiersze ze statusem
    // 'active' zamiast 'ACTIVE' (2 na 1140). Dokładne porównanie odcinało
    // takiemu użytkownikowi zapis mapy — każdy PUT /map kończył się 404
    // „Idea not found", mimo że był OWNER-em swojej organizacji.
    "SELECT id FROM organization_members WHERE organization_id = ? AND user_id = ? AND UPPER(status) = 'ACTIVE'",
    [organizationId, userId]
  );
  if (!member) return NO_ACCESS;

  // T3 scope: membership alone gates both read and write. Finer-grained
  // write restrictions (e.g. role-based) are out of scope for DP-3 Wave 1.
  return { canRead: true, canWrite: true };
}

export interface CanonicalMapRow {
  id: string;
  ideaId: string;
  organizationId: string;
  version: number;
  [key: string]: unknown;
}

/**
 * Selects the canonical `my_idea_maps` row for `ideaId` (is_canonical = TRUE).
 *
 * Returns `null` when:
 *   - the `is_canonical` column doesn't exist yet in this environment
 *     (schema not migrated, or mock DB fallback list not yet aware of it —
 *     see server/src/utils/dbSchema.ts MOCK_TABLE_FALLBACK_COLUMNS); the
 *     caller MUST fall back to the legacy per-user row selection in this case.
 *   - no canonical row exists for the idea (e.g. data migration T2 hasn't
 *     run yet, or the idea has no map at all).
 */
export async function selectCanonicalMapRow(
  db: IDatabase,
  ideaId: string,
  organizationId: string
): Promise<CanonicalMapRow | null> {
  if (!db || !ideaId || !organizationId) return null;

  const mapCols = await getTableColumns('my_idea_maps');
  if (!mapCols.has('is_canonical')) return null;

  const row = await db.get<CanonicalMapRow>(
    `SELECT id, idea_id as "ideaId", organization_id as "organizationId", version
     FROM my_idea_maps
     WHERE idea_id = ? AND organization_id = ? AND is_canonical = TRUE
     LIMIT 1`,
    [ideaId, organizationId]
  );
  return row ?? null;
}

/**
 * True when shared/canonical idea maps are BOTH enabled by flag AND
 * physically available (the `is_canonical` column exists). Mirrors
 * `selectCanonicalMapRow`'s own column guard so every caller in this module
 * agrees on when the canonical-row strategy applies.
 */
export function isSharedIdeaMapsActive(mapCols: { has(col: string): boolean }): boolean {
  return featureFlags.ENABLE_SHARED_IDEA_MAPS === true && mapCols.has('is_canonical');
}

/**
 * RV-008 — single, tenant/user-scoped read-side resolver for "which
 * `my_idea_maps` row is truthful for this idea", used by BOTH the Ideas list
 * (the "Tool" badge) and `GET /my-ideas/:id/map` (Open). Before this, the
 * list resolved a row with a tolerant `is_canonical DESC NULLS LAST` fallback
 * while `GET /map` required a strict `is_canonical = TRUE` match with no
 * fallback — so a Table-labelled idea whose map was never flagged canonical
 * (e.g. before the DP-3 T2 migration ran) opened as Mind Map instead. Both
 * call sites now resolve through this one function so they can never diverge
 * again: `null` means "no truthful row exists yet" for BOTH surfaces, which
 * must show/open the same honest default (Mind Map) rather than one of them
 * guessing.
 *
 * `columnsSql` lets each caller select only the columns it needs (the list
 * only wants `preferred_tool`; `GET /map` wants the full row) while sharing
 * the exact same WHERE-clause/scoping logic.
 */
export async function selectReadableMapRow<T = Record<string, unknown>>(
  db: IDatabase,
  ideaId: string,
  ownerUserId: string | null,
  organizationId: string,
  columnsSql: string
): Promise<T | null> {
  if (!db || !ideaId || !organizationId) return null;

  const mapCols = await getTableColumns('my_idea_maps');

  if (isSharedIdeaMapsActive(mapCols)) {
    const row = await db.get<T>(
      `SELECT ${columnsSql} FROM my_idea_maps
       WHERE idea_id = ? AND organization_id = ? AND is_canonical = TRUE
       LIMIT 1`,
      [ideaId, organizationId]
    );
    return row ?? null;
  }

  // Legacy/fallback mode: the idea OWNER's row (same row PUT/sync writes to
  // — see resolveCanonicalMapOwner in my-work.routes.ts). Requires a real
  // owner id; without one there is no safe row to read.
  if (!ownerUserId) return null;
  const row = await db.get<T>(
    `SELECT ${columnsSql} FROM my_idea_maps
     WHERE idea_id = ? AND user_id = ? AND organization_id = ?
     LIMIT 1`,
    [ideaId, ownerUserId, organizationId]
  );
  return row ?? null;
}

// ---------------------------------------------------------------------------
// T5 — sequential canonical persist for WS graph_patch
// ---------------------------------------------------------------------------

/** A single graph-patch operation, mirroring the client wire format
 *  (src/components/MyWork/whiteboard/useWhiteboardCollab.ts): `{ op, data }`
 *  where `data.id` identifies the node/edge. Idempotent, last-write-wins per
 *  field. */
export interface GraphPatchOp {
  op: string;
  data?: { id?: string; [key: string]: unknown } | null;
}

export interface GraphPersistResult {
  /** The new canonical version (previous + 1). */
  version: number;
}

interface GraphNode {
  id?: string;
  [key: string]: unknown;
}
interface GraphEdge {
  id?: string;
  [key: string]: unknown;
}

/**
 * Single-writer queue per ideaId. Every persist for a given idea chains onto
 * the previous one, so concurrent `graph_patch` messages for the same idea are
 * serialized end-to-end (read-modify-write never interleaves). Different ideas
 * run in parallel. The chain is best-effort cleaned up when it drains.
 */
const persistQueues = new Map<string, Promise<unknown>>();

function parseGraphArray<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Applies patch ops to in-memory node/edge arrays. Idempotent and
 * last-write-wins per field:
 *   - add_node / add_edge: insert if absent, else shallow-merge (idempotent
 *     re-add doesn't duplicate).
 *   - update_node / update_edge: shallow-merge onto the matching id (no-op if
 *     absent — a lost add + late update simply doesn't resurrect a ghost).
 *   - remove_node / remove_edge: drop the matching id (idempotent).
 * Unknown ops are ignored. Ops without a `data.id` are skipped.
 */
function applyOpsToGraph(
  nodes: GraphNode[],
  edges: GraphEdge[],
  ops: GraphPatchOp[]
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  let nextNodes = nodes;
  let nextEdges = edges;

  for (const op of ops) {
    const data = op?.data;
    const id = data?.id != null ? String(data.id) : '';
    if (!id) continue;

    switch (op.op) {
      case 'add_node': {
        const idx = nextNodes.findIndex((n) => String(n.id) === id);
        if (idx === -1) nextNodes = [...nextNodes, data as GraphNode];
        else nextNodes = nextNodes.map((n) => (String(n.id) === id ? { ...n, ...data } : n));
        break;
      }
      case 'update_node': {
        nextNodes = nextNodes.map((n) => (String(n.id) === id ? { ...n, ...data } : n));
        break;
      }
      case 'remove_node': {
        nextNodes = nextNodes.filter((n) => String(n.id) !== id);
        break;
      }
      case 'add_edge': {
        const idx = nextEdges.findIndex((e) => String(e.id) === id);
        if (idx === -1) nextEdges = [...nextEdges, data as GraphEdge];
        else nextEdges = nextEdges.map((e) => (String(e.id) === id ? { ...e, ...data } : e));
        break;
      }
      case 'update_edge': {
        nextEdges = nextEdges.map((e) => (String(e.id) === id ? { ...e, ...data } : e));
        break;
      }
      case 'remove_edge': {
        nextEdges = nextEdges.filter((e) => String(e.id) !== id);
        break;
      }
      default:
        break;
    }
  }

  return { nodes: nextNodes, edges: nextEdges };
}

/**
 * The actual read-modify-write against the canonical row, wrapped in a DB
 * transaction. Runs only from inside the single-writer queue, so it never
 * races another writer for the same idea.
 */
async function persistCanonicalPatch(
  db: IDatabase,
  ideaId: string,
  organizationId: string,
  userId: string,
  ops: GraphPatchOp[]
): Promise<GraphPersistResult> {
  const canonical = await selectCanonicalMapRowFull(db, ideaId, organizationId);
  if (!canonical) {
    throw new Error(`No canonical map row for idea ${ideaId} in org ${organizationId}`);
  }

  const nodes = parseGraphArray<GraphNode>(canonical.nodes_json);
  const edges = parseGraphArray<GraphEdge>(canonical.edges_json);
  const applied = applyOpsToGraph(nodes, edges, ops);

  const currentVersion = Number(canonical.version || 1);
  const nextVersion = currentVersion + 1;
  const now = new Date().toISOString();

  let inTx = false;
  try {
    await db.exec('BEGIN');
    inTx = true;
    await db.run(
      `UPDATE my_idea_maps
       SET nodes_json = ?, edges_json = ?, version = ?, last_editor_user_id = ?, updated_at = ?
       WHERE id = ?`,
      [
        JSON.stringify(applied.nodes),
        JSON.stringify(applied.edges),
        nextVersion,
        userId,
        now,
        canonical.id,
      ]
    );
    await db.exec('COMMIT');
    inTx = false;
  } catch (err) {
    if (inTx) {
      try {
        await db.exec('ROLLBACK');
      } catch {
        /* best effort */
      }
    }
    throw err;
  }

  return { version: nextVersion };
}

/** Full canonical row read (includes nodes_json/edges_json), used by the
 *  persist path. Distinct from selectCanonicalMapRow() which returns only the
 *  lightweight membership/version view. Returns null when the is_canonical
 *  column is absent (schema not migrated) or no canonical row exists. */
async function selectCanonicalMapRowFull(
  db: IDatabase,
  ideaId: string,
  organizationId: string
): Promise<{ id: string; version: number; nodes_json: unknown; edges_json: unknown } | null> {
  const mapCols = await getTableColumns('my_idea_maps');
  if (!mapCols.has('is_canonical')) return null;

  const row = await db.get<{
    id: string;
    version: number;
    nodes_json: unknown;
    edges_json: unknown;
  }>(
    `SELECT id, version, nodes_json, edges_json
     FROM my_idea_maps
     WHERE idea_id = ? AND organization_id = ? AND is_canonical = TRUE
     LIMIT 1`,
    [ideaId, organizationId]
  );
  return row ?? null;
}

/**
 * Sequentially persists a graph_patch into the canonical `my_idea_maps` row.
 *
 * Concurrency model (plan §3): a per-ideaId in-memory promise chain
 * (single-writer). Each call enqueues behind the previous persist for the same
 * idea, so read-modify-write of the canonical row never interleaves and
 * versions increment strictly (n+1, n+2, …). Different ideas persist in
 * parallel.
 *
 * Returns `{ version }` — the new canonical version — so the gateway can
 * broadcast `{ type: 'graph_version', version }` to the whole room.
 *
 * Throws when there is no canonical row (data migration T2 not run for this
 * idea, or is_canonical column absent). The gateway logs the error and messages
 * the author, but the relay still happens (rehydration reconciles).
 */
export async function applyGraphPatchToCanonical(
  db: IDatabase,
  ideaId: string,
  organizationId: string,
  userId: string,
  ops: GraphPatchOp[]
): Promise<GraphPersistResult> {
  const prev = persistQueues.get(ideaId) ?? Promise.resolve();

  // Chain onto the previous persist regardless of whether it resolved or
  // rejected — we must not let one failed write break the queue for the idea.
  const next = prev
    .catch(() => undefined)
    .then(() => persistCanonicalPatch(db, ideaId, organizationId, userId, ops));

  persistQueues.set(ideaId, next);

  // Best-effort cleanup: once this is the tail of the chain and it settles,
  // drop the entry so the map doesn't grow unbounded across ideas.
  void next
    .catch(() => undefined)
    .finally(() => {
      if (persistQueues.get(ideaId) === next) persistQueues.delete(ideaId);
    });

  return next;
}
