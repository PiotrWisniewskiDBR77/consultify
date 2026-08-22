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
 * The server returns a numeric version on create/GET and requires
 * `expectedVersion` on every PUT. A stale writer receives 409 with the
 * authoritative current version; callers must reconcile rather than
 * silently overwrite newer state.
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
  version: number;
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
  version: number;
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
  expectedVersion: number;
}

export interface UpdateToolSessionResult {
  id: string;
  status: string;
  updatedAt: string;
  version: number;
}

export const toolSessionApi = {
  async create(input: CreateToolSessionInput): Promise<CreateToolSessionResult> {
    return Api.createToolSession(input);
  },

  async get(toolId: string): Promise<ToolSessionApiRecord> {
    return Api.getToolSession(toolId);
  },

  async update(toolId: string, input: UpdateToolSessionInput): Promise<UpdateToolSessionResult> {
    return Api.updateToolSession(toolId, input);
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
