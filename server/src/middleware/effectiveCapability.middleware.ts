import type { NextFunction, Response } from 'express';

import {
  hasEffectiveCapability,
  resolveEffectiveAccess,
} from '../services/effectiveAccessService.js';
import logger from '../utils/Logger.js';
import * as queryHelpers from '../utils/queryHelpers.js';
import type { AuthRequest } from './auth.middleware.js';

type ProjectResolver = (
  req: AuthRequest
) => Promise<string | null | undefined> | string | null | undefined;

type CapabilityOptions = {
  reason?: string;
  allowWithoutProject?: boolean;
  /**
   * SHADOW ENFORCEMENT (2026-07-10) — opt a caller into the capability
   * enforcement rollout governed by the `CAPABILITY_ENFORCE` env flag.
   *
   * When `shadow: true` and `CAPABILITY_ENFORCE` is unset or `shadow`
   * (the default), the middleware NEVER blocks: it resolves effective access,
   * logs `{ userId, capability, route, method, projectId, wouldAllow }` and
   * always calls `next()`. This is pure telemetry — we collect "who WOULD get a
   * 403" so the switch to real enforcement can be made from data, not a guess.
   *
   * When `CAPABILITY_ENFORCE=enforce`, the same shadow-tagged gates start
   * returning real 401/400/403/503 responses. The legacy `EFFECTIVE_ACCESS_*`
   * flags are untouched (kept for the pre-existing, still-unwired callers).
   */
  shadow?: boolean;
};

const shouldEnforceEffectiveAccess = () =>
  (process.env.EFFECTIVE_ACCESS_ENFORCE ?? '').trim().toLowerCase() === 'true';
const shouldShadowEffectiveAccess = () =>
  (process.env.EFFECTIVE_ACCESS_SHADOW ?? '').trim().toLowerCase() === 'true';

// Governs the shadow-tagged capability gates (options.shadow === true).
// Default = 'shadow' (log-only, zero blocking). Set CAPABILITY_ENFORCE=enforce
// to turn the collected shadow signals into real 403s.
const capabilityEnforceMode = (): 'shadow' | 'enforce' =>
  (process.env.CAPABILITY_ENFORCE ?? 'shadow').trim().toLowerCase() === 'enforce'
    ? 'enforce'
    : 'shadow';

type ShadowVerdict =
  | { status: 'no_auth' }
  | { status: 'no_project' }
  | { status: 'error' }
  | {
      status: 'evaluated';
      wouldAllow: boolean;
      projectId: string | null;
      projectRole: string | null;
    };

/**
 * Resolve effective access and compute whether the caller WOULD pass the
 * capability check — without ever writing a response or throwing. Used by the
 * shadow branch of the capability middlewares. `capabilities` is an array so a
 * single implementation serves both the single- and any-of- variants
 * (wouldAllow = at least one capability granted).
 */
async function runCapabilityShadow(
  req: AuthRequest,
  capabilities: string[],
  resolveProjectId: ProjectResolver,
  options: CapabilityOptions
): Promise<ShadowVerdict> {
  try {
    const { userId, organizationId, applicationRole, isImpersonating } = getUserContext(req);
    if (!userId || !organizationId) return { status: 'no_auth' };

    let projectId: string | null = null;
    try {
      projectId = firstString(await resolveProjectId(req));
    } catch {
      projectId = null;
    }
    if (!projectId && !options.allowWithoutProject) return { status: 'no_project' };

    const access = await resolveEffectiveAccess({
      userId,
      organizationId,
      applicationRole,
      projectId,
      isImpersonating,
    });
    const wouldAllow = capabilities.some((cap) => hasEffectiveCapability(access, cap));
    return {
      status: 'evaluated',
      wouldAllow,
      projectId,
      projectRole: (access as { projectRole?: string | null }).projectRole ?? null,
    };
  } catch {
    return { status: 'error' };
  }
}

/**
 * Shadow-branch handler shared by both capability middlewares. In `shadow`
 * mode it ALWAYS calls next() (guaranteed zero blocking) after logging the
 * verdict. In `enforce` mode it converts the verdict into the same
 * 401/400/403/503 responses the legacy enforce path would produce.
 *
 * Returns true if it fully handled the request (caller must return).
 */
async function handleShadowCapability(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
  capabilities: string[],
  resolveProjectId: ProjectResolver,
  options: CapabilityOptions
): Promise<void> {
  const mode = capabilityEnforceMode();
  const verdict = await runCapabilityShadow(req, capabilities, resolveProjectId, options);
  const capLabel = capabilities.length === 1 ? capabilities[0] : capabilities;
  const route = safePath(req);
  const method = (() => {
    try {
      return (req as AuthRequest & { method?: string }).method ?? '';
    } catch {
      return '';
    }
  })();
  const userId = firstString(req.user?.id, req.userId);

  // Always emit the telemetry line (log-only doctrine).
  logger.info('[capabilityShadow]', {
    mode,
    capability: capLabel,
    route,
    method,
    userId,
    status: verdict.status,
    wouldAllow: verdict.status === 'evaluated' ? verdict.wouldAllow : null,
    projectId: verdict.status === 'evaluated' ? verdict.projectId : null,
    projectRole: verdict.status === 'evaluated' ? verdict.projectRole : null,
  });

  if (mode === 'shadow') {
    // ZERO blocking — collect data only, never touch the response.
    safeNext(next, 'shadow', capLabel);
    return;
  }

  // enforce mode: turn verdict into real responses.
  if (verdict.status === 'no_auth') {
    safeWriteJson(
      res,
      401,
      { error: 'Authentication required', code: 'AUTH_REQUIRED' },
      'auth',
      {}
    );
    return;
  }
  if (verdict.status === 'no_project') {
    safeWriteJson(
      res,
      400,
      {
        error: 'Project context is required',
        code: 'PROJECT_CONTEXT_REQUIRED',
        required: capLabel,
        reason: options.reason || 'missing_project_context',
      },
      'deny',
      { capability: capLabel }
    );
    return;
  }
  if (verdict.status === 'error') {
    safeWriteJson(
      res,
      503,
      { error: 'Capability check failed', code: 'EFFECTIVE_ACCESS_CHECK_FAILED' },
      'error',
      { capability: capLabel }
    );
    return;
  }
  if (!verdict.wouldAllow) {
    safeWriteJson(
      res,
      403,
      {
        error: 'Capability required',
        code: 'CAPABILITY_REQUIRED',
        required: capLabel,
        projectId: verdict.projectId,
        reason: options.reason || 'missing_capability_or_scope',
      },
      'deny',
      { capability: capLabel, path: route }
    );
    return;
  }
  (req as AuthRequest & { effectiveAccess?: unknown }).effectiveAccess = undefined;
  safeNext(next, 'allow', capLabel);
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function safePath(req: AuthRequest): string {
  try {
    return req.path ?? '';
  } catch {
    return '';
  }
}

function isResponseCommitted(res: Response): boolean {
  try {
    if ((res as any).headersSent) return true;
    if ((res as any).writableFinished) return true;
    if ((res as any).finished) return true;
    return false;
  } catch {
    return true;
  }
}

function safeWriteJson(
  res: Response,
  status: number,
  body: object,
  phase: string,
  extra: Record<string, unknown>
): void {
  if (isResponseCommitted(res)) {
    logger.warn('[effectiveCapability] response already committed; skipping json write', {
      status,
      phase,
      ...extra,
    });
    return;
  }
  if (isResponseCommitted(res)) {
    logger.warn('[effectiveCapability] response committed before json write; skipping', {
      status,
      phase,
      ...extra,
    });
    return;
  }
  if (typeof (res as any).status !== 'function' || typeof (res as any).json !== 'function') {
    logger.error('[effectiveCapability] response object missing status/json handlers', {
      status,
      phase,
      ...extra,
    });
    return;
  }
  try {
    res.status(status).json(body);
  } catch (writeErr) {
    logger.error('[effectiveCapability] failed to write json response', {
      status,
      phase,
      error: (writeErr as Error).message,
      ...extra,
    });
  }
}

function safeNext(next: NextFunction, phase: string, capability: string | string[]): void {
  let result: unknown;
  try {
    result = next();
  } catch (syncErr) {
    logger.error('[effectiveCapability] next() threw synchronously', { phase, capability });
    next(syncErr as Error);
    return;
  }
  if (result instanceof Promise) {
    result.catch((asyncErr: unknown) => {
      logger.error('[effectiveCapability] next() returned rejected promise', { phase, capability });
      next(asyncErr as Error);
    });
  }
}

function getUserContext(req: AuthRequest) {
  return {
    userId: firstString(req.user?.id, req.userId),
    organizationId: firstString(req.user?.organizationId, req.organizationId),
    applicationRole: firstString(req.userRole, req.user?.role),
    isImpersonating: Boolean(req.user?.impersonatorId),
  };
}

export async function resolveProjectIdFromRequest(req: AuthRequest): Promise<string | null> {
  try {
    return firstString(
      req.params?.projectId,
      req.params?.id,
      req.body?.projectId,
      req.body?.project_id,
      req.query?.projectId,
      req.query?.project_id
    );
  } catch {
    return null;
  }
}

export async function resolveTaskProjectId(req: AuthRequest): Promise<string | null> {
  const taskId = firstString(
    req.params?.taskId,
    req.params?.id,
    req.body?.taskId,
    req.body?.task_id
  );
  if (!taskId || taskId.length > 128) return await resolveProjectIdFromRequest(req);
  const row = await queryHelpers
    .queryOne<{
      project_id?: string;
    }>(`SELECT project_id FROM tasks WHERE id = ? LIMIT 1`, [taskId])
    .catch(() => null);
  return firstString(row?.project_id, await resolveProjectIdFromRequest(req));
}

export async function resolveInitiativeProjectId(req: AuthRequest): Promise<string | null> {
  const initiativeId = firstString(
    req.params?.initiativeId,
    req.params?.id,
    req.body?.initiativeId,
    req.body?.initiative_id
  );
  if (!initiativeId) return await resolveProjectIdFromRequest(req);
  const row = await queryHelpers
    .queryOne<{
      project_id?: string;
    }>(`SELECT project_id FROM initiatives WHERE id = ? LIMIT 1`, [initiativeId])
    .catch(() => null);
  return firstString(row?.project_id, await resolveProjectIdFromRequest(req));
}

export async function resolveInterviewProjectId(req: AuthRequest): Promise<string | null> {
  const assignmentId = firstString(req.params?.assignmentId, req.params?.id);
  if (assignmentId) {
    const row = await queryHelpers
      .queryOne<{ project_id?: string; session_project_id?: string }>(
        `SELECT ia.project_id, s.project_id as session_project_id
         FROM interview_assignments ia
         LEFT JOIN interview_sessions s ON s.id = ia.session_id
         WHERE ia.id = ?
         LIMIT 1`,
        [assignmentId]
      )
      .catch(() => null);
    const projectId = firstString(row?.project_id, row?.session_project_id);
    if (projectId) return projectId;
  }

  const sessionId = firstString(req.params?.sessionId, req.body?.sessionId, req.query?.sessionId);
  if (sessionId) {
    const row = await queryHelpers
      .queryOne<{
        project_id?: string;
      }>(`SELECT project_id FROM interview_sessions WHERE id = ? LIMIT 1`, [sessionId])
      .catch(() => null);
    return firstString(row?.project_id, await resolveProjectIdFromRequest(req));
  }

  const insightId = firstString(req.params?.insightId, req.params?.id, req.body?.insightId);
  if (insightId) {
    const row = await queryHelpers
      .queryOne<{
        project_id?: string;
      }>(`SELECT project_id FROM interview_insights WHERE id = ? LIMIT 1`, [insightId])
      .catch(() => null);
    return firstString(row?.project_id, await resolveProjectIdFromRequest(req));
  }

  return await resolveProjectIdFromRequest(req);
}

export async function resolveDecisionProjectId(req: AuthRequest): Promise<string | null> {
  const decisionId = firstString(
    req.params?.decisionId,
    req.params?.id,
    req.body?.decisionId,
    req.body?.decision_id
  );
  if (!decisionId || decisionId.length > 128) return await resolveProjectIdFromRequest(req);
  const row = await queryHelpers
    .queryOne<{
      project_id?: string;
    }>(`SELECT project_id FROM decisions WHERE id = ? LIMIT 1`, [decisionId])
    .catch(() => null);
  return firstString(row?.project_id, await resolveProjectIdFromRequest(req));
}

export function requireProjectCapability(
  capability: string,
  resolveProjectId: ProjectResolver = resolveProjectIdFromRequest,
  options: CapabilityOptions = {}
) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!capability || !capability.trim()) {
      safeWriteJson(
        res,
        400,
        { error: 'Capability name is required', code: 'CAPABILITY_INVALID' },
        'validate',
        {}
      );
      return;
    }

    // Shadow-enforcement rollout: log-only by default, never blocks.
    if (options.shadow) {
      await handleShadowCapability(req, res, next, [capability], resolveProjectId, options);
      return;
    }

    let userId: string | null,
      organizationId: string | null,
      applicationRole: string | null,
      isImpersonating: boolean;
    try {
      ({ userId, organizationId, applicationRole, isImpersonating } = getUserContext(req));
    } catch {
      safeWriteJson(
        res,
        401,
        { error: 'Authentication required', code: 'AUTH_REQUIRED' },
        'auth',
        {}
      );
      return;
    }
    if (!userId || !organizationId) {
      safeWriteJson(
        res,
        401,
        { error: 'Authentication required', code: 'AUTH_REQUIRED' },
        'auth',
        {}
      );
      return;
    }
    if (!shouldEnforceEffectiveAccess() && !shouldShadowEffectiveAccess()) {
      safeNext(next, 'allow', capability);
      return;
    }

    let projectId: string | null;
    try {
      projectId = firstString(await resolveProjectId(req));
    } catch (err) {
      logger.error('[effectiveCapability] resolveProjectId failed', {
        capability,
        error: (err as Error).message,
      });
      if (!shouldEnforceEffectiveAccess()) {
        safeNext(next, 'allow', capability);
        return;
      }
      safeWriteJson(
        res,
        503,
        { error: 'Capability check failed', code: 'EFFECTIVE_ACCESS_CHECK_FAILED' },
        'error',
        { capability }
      );
      return;
    }
    if (!projectId && !options.allowWithoutProject) {
      if (!shouldEnforceEffectiveAccess()) {
        logger.warn('[effectiveCapability] shadow missing project context', {
          capability,
          path: safePath(req),
        });
        safeNext(next, 'allow', capability);
        return;
      }
      safeWriteJson(
        res,
        400,
        {
          error: 'Project context is required',
          code: 'PROJECT_CONTEXT_REQUIRED',
          required: capability,
          reason: options.reason || 'missing_project_context',
        },
        'deny',
        { capability }
      );
      return;
    }

    let access: Awaited<ReturnType<typeof resolveEffectiveAccess>> | undefined;
    try {
      access = await resolveEffectiveAccess({
        userId,
        organizationId,
        applicationRole,
        projectId,
        isImpersonating,
      });
    } catch (err) {
      logger.error('[effectiveCapability] resolveEffectiveAccess failed', {
        capability,
        error: (err as Error).message,
      });
      if (!shouldEnforceEffectiveAccess()) {
        safeNext(next, 'allow', capability);
        return;
      }
      safeWriteJson(
        res,
        503,
        { error: 'Capability check failed', code: 'EFFECTIVE_ACCESS_CHECK_FAILED' },
        'error',
        { capability }
      );
      return;
    }

    let capable: boolean;
    try {
      capable = hasEffectiveCapability(access, capability);
    } catch (err) {
      logger.error('[effectiveCapability] capability evaluator failed', {
        capability,
        error: (err as Error).message,
      });
      if (!shouldEnforceEffectiveAccess()) {
        safeNext(next, 'allow', capability);
        return;
      }
      safeWriteJson(
        res,
        503,
        { error: 'Capability check failed', code: 'EFFECTIVE_ACCESS_CHECK_FAILED' },
        'error',
        { capability }
      );
      return;
    }

    if (!capable) {
      if (!shouldEnforceEffectiveAccess()) {
        logger.warn('[effectiveCapability] shadow capability mismatch', {
          capability,
          projectId,
          path: safePath(req),
        });
        (req as AuthRequest & { effectiveAccess?: unknown }).effectiveAccess = access;
        safeNext(next, 'allow', capability);
        return;
      }
      safeWriteJson(
        res,
        403,
        {
          error: 'Capability required',
          code: 'CAPABILITY_REQUIRED',
          required: capability,
          projectId,
          reason: options.reason || 'missing_capability_or_scope',
        },
        'deny',
        { capability, path: safePath(req) }
      );
      return;
    }

    (req as AuthRequest & { effectiveAccess?: unknown }).effectiveAccess = access;
    safeNext(next, 'allow', capability);
  };
}

export function requireAnyProjectCapability(
  capabilities: string[],
  resolveProjectId: ProjectResolver = resolveProjectIdFromRequest,
  options: CapabilityOptions = {}
) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!capabilities.length) {
      safeWriteJson(
        res,
        400,
        { error: 'At least one capability is required', code: 'CAPABILITY_LIST_INVALID' },
        'validate',
        {}
      );
      return;
    }

    // Shadow-enforcement rollout: log-only by default, never blocks.
    if (options.shadow) {
      await handleShadowCapability(req, res, next, capabilities, resolveProjectId, options);
      return;
    }

    let userId: string | null,
      organizationId: string | null,
      applicationRole: string | null,
      isImpersonating: boolean;
    try {
      ({ userId, organizationId, applicationRole, isImpersonating } = getUserContext(req));
    } catch {
      safeWriteJson(
        res,
        401,
        { error: 'Authentication required', code: 'AUTH_REQUIRED' },
        'auth',
        {}
      );
      return;
    }
    if (!userId || !organizationId) {
      safeWriteJson(
        res,
        401,
        { error: 'Authentication required', code: 'AUTH_REQUIRED' },
        'auth',
        {}
      );
      return;
    }
    if (!shouldEnforceEffectiveAccess() && !shouldShadowEffectiveAccess()) {
      safeNext(next, 'allow', capabilities);
      return;
    }

    let projectId: string | null;
    try {
      projectId = firstString(await resolveProjectId(req));
    } catch (err) {
      logger.error('[effectiveCapability] resolveProjectId failed', {
        capabilities,
        error: (err as Error).message,
      });
      if (!shouldEnforceEffectiveAccess()) {
        safeNext(next, 'allow', capabilities);
        return;
      }
      safeWriteJson(
        res,
        503,
        { error: 'Capability check failed', code: 'EFFECTIVE_ACCESS_CHECK_FAILED' },
        'error',
        { capabilities }
      );
      return;
    }
    if (!projectId && !options.allowWithoutProject) {
      if (!shouldEnforceEffectiveAccess()) {
        logger.warn('[effectiveCapability] shadow missing project context', {
          capabilities,
          path: safePath(req),
        });
        safeNext(next, 'allow', capabilities);
        return;
      }
      safeWriteJson(
        res,
        400,
        {
          error: 'Project context is required',
          code: 'PROJECT_CONTEXT_REQUIRED',
          required: capabilities,
          reason: options.reason || 'missing_project_context',
        },
        'deny',
        { capabilities }
      );
      return;
    }

    let access: Awaited<ReturnType<typeof resolveEffectiveAccess>> | undefined;
    try {
      access = await resolveEffectiveAccess({
        userId,
        organizationId,
        applicationRole,
        projectId,
        isImpersonating,
      });
    } catch (err) {
      logger.error('[effectiveCapability] resolveEffectiveAccess failed', {
        capabilities,
        error: (err as Error).message,
      });
      if (!shouldEnforceEffectiveAccess()) {
        safeNext(next, 'allow', capabilities);
        return;
      }
      safeWriteJson(
        res,
        503,
        { error: 'Capability check failed', code: 'EFFECTIVE_ACCESS_CHECK_FAILED' },
        'error',
        { capabilities }
      );
      return;
    }

    let capable: boolean;
    try {
      capable = capabilities.some((cap) => hasEffectiveCapability(access, cap));
    } catch (err) {
      logger.error('[effectiveCapability] capability evaluator failed', {
        capabilities,
        error: (err as Error).message,
      });
      if (!shouldEnforceEffectiveAccess()) {
        safeNext(next, 'allow', capabilities);
        return;
      }
      safeWriteJson(
        res,
        503,
        { error: 'Capability check failed', code: 'EFFECTIVE_ACCESS_CHECK_FAILED' },
        'error',
        { capabilities }
      );
      return;
    }

    if (!capable) {
      if (!shouldEnforceEffectiveAccess()) {
        logger.warn('[effectiveCapability] shadow capability mismatch', {
          capabilities,
          projectId,
          path: safePath(req),
        });
        (req as AuthRequest & { effectiveAccess?: unknown }).effectiveAccess = access;
        safeNext(next, 'allow', capabilities);
        return;
      }
      safeWriteJson(
        res,
        403,
        {
          error: 'Capability required',
          code: 'CAPABILITY_REQUIRED',
          required: capabilities,
          projectId,
          reason: options.reason || 'missing_capability_or_scope',
        },
        'deny',
        { capabilities }
      );
      return;
    }

    (req as AuthRequest & { effectiveAccess?: unknown }).effectiveAccess = access;
    safeNext(next, 'allow', capabilities);
  };
}

export const requireTaskCapability = (capability: string, options?: CapabilityOptions) =>
  requireProjectCapability(capability, resolveTaskProjectId, options);

export const requireInterviewCapability = (capability: string, options?: CapabilityOptions) =>
  requireProjectCapability(capability, resolveInterviewProjectId, options);

export const requireAnyInterviewCapability = (
  capabilities: string[],
  options?: CapabilityOptions
) => requireAnyProjectCapability(capabilities, resolveInterviewProjectId, options);

export const requireInitiativeCapability = (capability: string, options?: CapabilityOptions) =>
  requireProjectCapability(capability, resolveInitiativeProjectId, options);

export const requireDecisionCapability = (capability: string, options?: CapabilityOptions) =>
  requireProjectCapability(capability, resolveDecisionProjectId, options);

export const requireAnyInitiativeCapability = (
  capabilities: string[],
  options?: CapabilityOptions
) => requireAnyProjectCapability(capabilities, resolveInitiativeProjectId, options);

export const requireSupportCapability = (capability: string, options?: CapabilityOptions) =>
  requireProjectCapability(capability, async () => null, { ...options, allowWithoutProject: true });

export const requireBillingCapability = (capability: string, options?: CapabilityOptions) =>
  requireProjectCapability(capability, async () => null, { ...options, allowWithoutProject: true });
