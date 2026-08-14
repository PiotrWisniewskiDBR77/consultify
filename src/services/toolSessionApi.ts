/**
 * toolSessionApi — thin, typed HTTP adapter for tool session persistence.
 *
 * SOURCE OF TRUTH for a tool session (e.g. Dynamic SWOT) is the server —
 * the `tool_sessions` row in PostgreSQL — reached through the real,
 * already-implemented endpoints in `server/src/routes/tools.routes.ts`:
 *   POST /api/tools                -> createToolSession
 *   GET  /api/tools/:toolId        -> getToolSession
 *   PUT  /api/tools/:toolId        -> updateToolSession
 *
 * This module never calls `fetch` directly. It wraps the existing `Api`
 * service (`src/services/api.ts`) methods, per the documented project trap
 * ("patch Api METHODS, not window.fetch" — see MEMORY.md
 * gendeck-genexcel-nadganianie-2026-07-23): tests must mock these named
 * exports, not the global fetch, or a dev-render harness silently keeps
 * hitting the real network.
 *
 * ---------------------------------------------------------------------
 * Known gap — server `version` column is not wired end-to-end (2026-08-13)
 * ---------------------------------------------------------------------
 * `tool_sessions.version` exists in Postgres (INTEGER NOT NULL DEFAULT 1,
 * bumped on every `answers_json` write — see
 * `server/src/controllers/ToolController.ts:1290`) but, verified by
 * reading that file directly:
 *   - `GET /api/tools/:toolId` does NOT return it — the handler builds its
 *     JSON response by hand and never lists `version`
 *     (`ToolController.ts:1129-1153`).
 *   - `PUT /api/tools/:toolId` does NOT accept an `expectedVersion` and
 *     does NOT perform a conditional `WHERE version = ?` update for a
 *     normal save (`ToolController.ts:1157-1369`) — that CAS pattern
 *     exists ONLY for the SWOT-proposal-accept path
 *     (`ToolController.ts:3045-3055`), a different endpoint entirely.
 *
 * `ToolController.ts` is owned by another workstream for the duration of
 * this session, so it could not be extended here (see
 * `docs/program/METHOD_TOOLS_2026-08-13/SESSION_HTTP_INVENTORY.md` for the
 * full inventory and a flagged follow-up). This adapter is written to be
 * forward-compatible with that gap being closed later:
 *   - every response is read defensively for an optional `version` field;
 *   - every update sends `expectedVersion` (silently ignored by today's
 *     server, wired for free once the server checks it);
 *   - ANY HTTP 409 from the update endpoint is treated as "conflict,
 *     needs reconciliation" — which is already correct today (the
 *     endpoint returns 409 for a locked/approved session, an invalid
 *     status transition, or a failed DoD gate) and will remain correct
 *     once a real stale-version 409 is added.
 */
import { Api } from '@/services/api';

export interface ToolSessionMissingItem {
  id: string;
  label: string;
  severity?: string;
  stepId?: string;
  resolved?: boolean;
}

/** Shape returned by GET /api/tools/:toolId (server/src/controllers/ToolController.ts:1129). */
export interface ToolSessionApiRecord {
  id: string;
  name?: string;
  toolType?: string;
  status?: string;
  progress?: number;
  confidenceAvg?: number;
  projectId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  answers?: Record<string, unknown>;
  contextSnapshot?: Record<string, unknown>;
  wizardState?: { currentStep?: string } | Record<string, unknown> | null;
  missingItems?: ToolSessionMissingItem[];
  completionPercent?: number;
  failureReason?: string | null;
  lastGenerationBatchId?: string | null;
  /** Loosely typed on purpose — shape owned by ToolController, not this adapter. */
  generatedInitiatives?: Array<{ id: string; title?: string; status?: string; batch_id?: string }>;
  /** Loosely typed on purpose — shape owned by ToolController, not this adapter. */
  decisions?: Array<Record<string, unknown>>;
  permissions?: {
    canRequestReview?: boolean;
    canApproveTool?: boolean;
    canGenerate?: boolean;
  };
  /**
   * Not actually sent by the server today — see the "Known gap" note
   * above. Read defensively so the adapter starts using it for free the
   * moment ToolController is extended, without another frontend change.
   */
  version?: number;
  [key: string]: unknown;
}

export interface CreateToolSessionInput {
  toolType: string;
  name: string;
  projectId?: string | null;
}

export interface CreateToolSessionResult {
  id: string;
  status: string;
}

export interface UpdateToolSessionInput {
  answers?: Record<string, unknown>;
  completionPercent?: number;
  confidenceAvg?: number;
  contextSnapshot?: Record<string, unknown>;
  wizardState?: Record<string, unknown>;
  missingItems?: ToolSessionMissingItem[];
  status?: string;
  failureReason?: string;
  /**
   * Forward-compatible optimistic-concurrency token. Ignored by the
   * server today (see file header) — sending it is harmless and costs
   * nothing; once ToolController checks it, stale saves start failing
   * with a real 409 with no further frontend change required.
   */
  expectedVersion?: number;
}

export interface UpdateToolSessionResult {
  id: string;
  status: string;
  updatedAt: string;
  /** See "Known gap" — undefined until the server sends it back. */
  version?: number;
}

export const toolSessionApi = {
  async create(input: CreateToolSessionInput): Promise<CreateToolSessionResult> {
    return Api.createToolSession(input);
  },

  async get(toolId: string): Promise<ToolSessionApiRecord> {
    return Api.getToolSession(toolId);
  },

  async update(toolId: string, input: UpdateToolSessionInput): Promise<UpdateToolSessionResult> {
    // `Api.updateToolSession`'s payload type predates `expectedVersion`;
    // cast at this single boundary rather than widening the shared,
    // 21k-line api.ts service (out of this stream's scope).
    return Api.updateToolSession(toolId, input as Parameters<typeof Api.updateToolSession>[1]);
  },
};

/**
 * `fetch()` throws a plain `TypeError` (no `.status`) when the network is
 * unreachable — as opposed to the `Error` with `.status` that
 * `src/services/api.ts`'s `handleResponse` throws for any HTTP response it
 * actually received (see `api.ts:1026-1029`, `err.status = res.status`).
 * That distinction is what lets the adapter tell "server said no" apart
 * from "we never reached the server".
 */
export function isOfflineError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const err = error as { status?: unknown; name?: unknown; message?: unknown };
  if (err.status !== undefined) return false;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  const name = String(err.name || '');
  const message = String(err.message || '');
  return name === 'TypeError' && /fetch|network|failed to fetch/i.test(message);
}

export function isConflictError(error: unknown): boolean {
  return (
    Boolean(error) && typeof error === 'object' && (error as { status?: unknown }).status === 409
  );
}

export function isNotFoundError(error: unknown): boolean {
  return (
    Boolean(error) && typeof error === 'object' && (error as { status?: unknown }).status === 404
  );
}

export function getErrorMessage(error: unknown, fallback = 'Request failed'): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
