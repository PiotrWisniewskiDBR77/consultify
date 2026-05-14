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
};

const INVALID_CAPABILITY_RESPONSE = {
  error: 'Invalid capability configuration',
  code: 'CAPABILITY_INVALID',
  reason: 'capability_must_be_non_empty_string',
} as const;

const isEnvFlagTrue = (value: unknown): boolean =>
  typeof value === 'string' && value.trim().toLowerCase() === 'true';
const shouldEnforceEffectiveAccess = () =>
  isEnvFlagTrue(safeRead(() => process.env.EFFECTIVE_ACCESS_ENFORCE, ''));
const shouldShadowEffectiveAccess = () =>
  isEnvFlagTrue(safeRead(() => process.env.EFFECTIVE_ACCESS_SHADOW, ''));

function safeRead<T>(reader: () => T, fallback: T): T {
  try {
    return reader();
  } catch {
    return fallback;
  }
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (Array.isArray(value) && typeof value[0] === 'string' && value[0].trim()) {
      return value[0].trim();
    }
  }
  return null;
}
const LOOKUP_ID_MAX_CHARS = 128;
const getSingleScalarString = (value: unknown): string | null => {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    if (value.length !== 1) return null;
    const first = value[0];
    if (typeof first === 'string' && first.trim()) return first.trim();
  }
  return null;
};
const normalizeLookupId = (value: unknown): string | null => {
  const normalized = getSingleScalarString(value);
  if (!normalized) return null;
  if (normalized.length > LOOKUP_ID_MAX_CHARS) return null;
  return normalized;
};

function getUserContext(req: AuthRequest) {
  return {
    userId: firstString(
      safeRead(() => req.user?.id, undefined as unknown),
      safeRead(() => req.userId, undefined as unknown)
    ),
    organizationId: firstString(
      safeRead(() => req.user?.organizationId, undefined as unknown),
      safeRead(() => req.organizationId, undefined as unknown)
    ),
    applicationRole: firstString(
      safeRead(() => req.userRole, undefined as unknown),
      safeRead(() => req.user?.role, undefined as unknown)
    ),
    isImpersonating: safeRead(() => req.user?.impersonatorId, undefined as unknown) != null,
  };
}

function getRequestPath(req: AuthRequest): string {
  return firstString(safeRead(() => req.path, undefined as unknown)) || '';
}

const normalizeCapability = (capability: unknown): string | null =>
  typeof capability === 'string' && capability.trim() ? capability.trim() : null;

const responseWriteBlocked = (res: Response): boolean =>
  safeRead(
    () =>
      res.headersSent ||
      (res as Response & { finished?: boolean }).finished === true ||
      (res as Response & { writableFinished?: boolean }).writableFinished === true ||
      (res as Response & { writableEnded?: boolean; destroyed?: boolean }).writableEnded === true ||
      (res as Response & { writableEnded?: boolean; destroyed?: boolean }).destroyed === true,
    true
  );

const invokeNextSafely = (
  req: AuthRequest,
  next: NextFunction,
  logContext: Record<string, unknown>
): void => {
  if (typeof next !== 'function') {
    logger.error('[effectiveCapability] invalid next handler', {
      path: getRequestPath(req),
      ...logContext,
    });
    return;
  }
  try {
    const nextResult = next();
    const isThenable =
      nextResult !== null &&
      (typeof nextResult === 'object' || typeof nextResult === 'function') &&
      typeof (nextResult as PromiseLike<unknown>).then === 'function';
    if (isThenable) {
      void Promise.resolve(nextResult).catch((err) => {
        logger.error('[effectiveCapability] next() returned rejected promise', {
          err,
          path: getRequestPath(req),
          ...logContext,
        });
        try {
          next(err as Error);
        } catch {
          // Do not throw from access middleware on downstream next-handler failures.
        }
      });
    }
  } catch (err) {
    logger.error('[effectiveCapability] next() threw synchronously', {
      err,
      path: getRequestPath(req),
      ...logContext,
    });
    try {
      next(err as Error);
    } catch {
      // Do not throw from access middleware on downstream next-handler failures.
    }
  }
};

const sendJsonIfOpen = (
  req: AuthRequest,
  res: Response,
  status: number,
  payload: Record<string, unknown>,
  logContext: Record<string, unknown>
): void => {
  const statusWriter = safeRead(() => (res as Response & { status?: unknown }).status, undefined);
  const jsonWriter = safeRead(() => (res as Response & { json?: unknown }).json, undefined);
  if (typeof statusWriter !== 'function' || typeof jsonWriter !== 'function') {
    logger.error('[effectiveCapability] response object missing status/json handlers', {
      status,
      path: getRequestPath(req),
      ...logContext,
    });
    return;
  }
  if (responseWriteBlocked(res)) {
    logger.warn('[effectiveCapability] response already committed; skipping json write', {
      status,
      path: getRequestPath(req),
      ...logContext,
    });
    return;
  }
  try {
    if (responseWriteBlocked(res)) {
      logger.warn('[effectiveCapability] response committed before json write; skipping', {
        status,
        path: getRequestPath(req),
        ...logContext,
      });
      return;
    }
    res.status(status).json(payload);
  } catch (err) {
    logger.error('[effectiveCapability] failed to write json response', {
      err,
      status,
      path: getRequestPath(req),
      ...logContext,
    });
  }
};

export async function resolveProjectIdFromRequest(req: AuthRequest): Promise<string | null> {
  const params = safeRead(() => req.params, undefined as unknown);
  const body = safeRead(() => req.body, undefined as unknown);
  const query = safeRead(() => req.query, undefined as unknown);
  const paramProjectId = getSingleScalarString(safeRead(() => (params as any)?.projectId, undefined as unknown));
  const paramId = getSingleScalarString(safeRead(() => (params as any)?.id, undefined as unknown));
  const bodyProjectId = getSingleScalarString(safeRead(() => (body as any)?.projectId, undefined as unknown));
  const bodyProjectIdLegacy = getSingleScalarString(
    safeRead(() => (body as any)?.project_id, undefined as unknown)
  );
  const queryProjectId = getSingleScalarString(safeRead(() => (query as any)?.projectId, undefined as unknown));
  const queryProjectIdLegacy = getSingleScalarString(
    safeRead(() => (query as any)?.project_id, undefined as unknown)
  );
  return firstString(
    paramProjectId,
    paramId,
    bodyProjectId,
    bodyProjectIdLegacy,
    queryProjectId,
    queryProjectIdLegacy
  );
}

export async function resolveTaskProjectId(req: AuthRequest): Promise<string | null> {
  const params = safeRead(() => req.params, undefined as unknown);
  const body = safeRead(() => req.body, undefined as unknown);
  const taskId = normalizeLookupId(
    firstString(
    safeRead(() => (params as any)?.taskId, undefined as unknown),
    safeRead(() => (params as any)?.id, undefined as unknown),
    safeRead(() => (body as any)?.taskId, undefined as unknown),
    safeRead(() => (body as any)?.task_id, undefined as unknown)
    )
  );
  if (!taskId) return await resolveProjectIdFromRequest(req);
  const row = await queryHelpers
    .queryOne<{
      project_id?: string;
    }>(`SELECT project_id FROM tasks WHERE id = ? LIMIT 1`, [taskId])
    .catch(() => null);
  return firstString(row?.project_id, await resolveProjectIdFromRequest(req));
}

export async function resolveInitiativeProjectId(req: AuthRequest): Promise<string | null> {
  const params = safeRead(() => req.params, undefined as unknown);
  const body = safeRead(() => req.body, undefined as unknown);
  const initiativeId = normalizeLookupId(
    firstString(
    safeRead(() => (params as any)?.initiativeId, undefined as unknown),
    safeRead(() => (params as any)?.id, undefined as unknown),
    safeRead(() => (body as any)?.initiativeId, undefined as unknown),
    safeRead(() => (body as any)?.initiative_id, undefined as unknown)
    )
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
  const params = safeRead(() => req.params, undefined as unknown);
  const body = safeRead(() => req.body, undefined as unknown);
  const query = safeRead(() => req.query, undefined as unknown);
  const assignmentId = normalizeLookupId(
    firstString(
    safeRead(() => (params as any)?.assignmentId, undefined as unknown),
    safeRead(() => (params as any)?.id, undefined as unknown)
    )
  );
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

  const sessionId = normalizeLookupId(
    firstString(
    safeRead(() => (params as any)?.sessionId, undefined as unknown),
    safeRead(() => (body as any)?.sessionId, undefined as unknown),
    safeRead(() => (query as any)?.sessionId, undefined as unknown)
    )
  );
  if (sessionId) {
    const row = await queryHelpers
      .queryOne<{
        project_id?: string;
      }>(`SELECT project_id FROM interview_sessions WHERE id = ? LIMIT 1`, [sessionId])
      .catch(() => null);
    return firstString(row?.project_id, await resolveProjectIdFromRequest(req));
  }

  const insightId = normalizeLookupId(
    firstString(
    safeRead(() => (params as any)?.insightId, undefined as unknown),
    safeRead(() => (params as any)?.id, undefined as unknown),
    safeRead(() => (body as any)?.insightId, undefined as unknown)
    )
  );
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

export function requireProjectCapability(
  capability: string,
  resolveProjectId: ProjectResolver = resolveProjectIdFromRequest,
  options: CapabilityOptions = {}
) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const normalizedCapability = normalizeCapability(capability);
    if (!normalizedCapability) {
      sendJsonIfOpen(req, res, 400, INVALID_CAPABILITY_RESPONSE, {
        capability,
      });
      return;
    }

    const { userId, organizationId, applicationRole, isImpersonating } = getUserContext(req);
    if (!userId || !organizationId) {
      sendJsonIfOpen(req, res, 401, { error: 'Authentication required', code: 'AUTH_REQUIRED' }, {});
      return;
    }
    const enforce = shouldEnforceEffectiveAccess();
    const shadow = shouldShadowEffectiveAccess();
    if (!enforce && !shadow) {
      invokeNextSafely(req, next, { phase: 'bypass', capability: normalizedCapability });
      return;
    }

    let projectId: string | null = null;
    try {
      projectId = firstString(await resolveProjectId(req));
    } catch (err) {
      logger.error('[effectiveCapability] resolveProjectId failed', {
        err,
        capability: normalizedCapability,
        path: getRequestPath(req),
      });
      if (enforce) {
        sendJsonIfOpen(
          req,
          res,
          503,
          {
            error: 'Authorization check failed',
            code: 'EFFECTIVE_ACCESS_CHECK_FAILED',
          },
          { capability: normalizedCapability, phase: 'resolveProjectId' }
        );
        return;
      }
      invokeNextSafely(req, next, { phase: 'resolveProjectId_shadow', capability: normalizedCapability });
      return;
    }
    if (!projectId && !options.allowWithoutProject) {
      if (!enforce) {
        logger.warn('[effectiveCapability] shadow missing project context', {
          capability: normalizedCapability,
          path: getRequestPath(req),
        });
        invokeNextSafely(req, next, { phase: 'missingProject_shadow', capability: normalizedCapability });
        return;
      }
      sendJsonIfOpen(
        req,
        res,
        400,
        {
          error: 'Project context is required',
          code: 'PROJECT_CONTEXT_REQUIRED',
          required: normalizedCapability,
          reason: options.reason || 'missing_project_context',
        },
        { capability: normalizedCapability, phase: 'missingProject' }
      );
      return;
    }

    let access: unknown;
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
        err,
        capability: normalizedCapability,
        projectId,
        path: getRequestPath(req),
      });
      if (enforce) {
        sendJsonIfOpen(
          req,
          res,
          503,
          {
            error: 'Authorization check failed',
            code: 'EFFECTIVE_ACCESS_CHECK_FAILED',
          },
          { capability: normalizedCapability, projectId, phase: 'resolveAccess' }
        );
        return;
      }
      invokeNextSafely(req, next, { phase: 'resolveAccess_shadow', capability: normalizedCapability });
      return;
    }

    let hasCapability = false;
    try {
      hasCapability = hasEffectiveCapability(access, normalizedCapability);
    } catch (err) {
      logger.error('[effectiveCapability] hasEffectiveCapability failed', {
        err,
        capability: normalizedCapability,
        projectId,
        path: getRequestPath(req),
      });
      if (enforce) {
        sendJsonIfOpen(
          req,
          res,
          503,
          {
            error: 'Authorization check failed',
            code: 'EFFECTIVE_ACCESS_CHECK_FAILED',
          },
          { capability: normalizedCapability, projectId, phase: 'capabilityCheck' }
        );
        return;
      }
      invokeNextSafely(req, next, { phase: 'capabilityCheck_shadow', capability: normalizedCapability });
      return;
    }

    if (!hasCapability) {
      if (!enforce) {
        logger.warn('[effectiveCapability] shadow capability mismatch', {
          capability: normalizedCapability,
          projectId,
          path: getRequestPath(req),
        });
        (req as AuthRequest & { effectiveAccess?: unknown }).effectiveAccess = access;
        invokeNextSafely(req, next, { phase: 'deny_shadow', capability: normalizedCapability, projectId });
        return;
      }
      sendJsonIfOpen(
        req,
        res,
        403,
        {
          error: 'Capability required',
          code: 'CAPABILITY_REQUIRED',
          required: normalizedCapability,
          projectId,
          reason: options.reason || 'missing_capability_or_scope',
        },
        { capability: normalizedCapability, projectId, phase: 'deny' }
      );
      return;
    }

    (req as AuthRequest & { effectiveAccess?: unknown }).effectiveAccess = access;
    invokeNextSafely(req, next, { phase: 'allow', capability: normalizedCapability, projectId });
  };
}

export function requireAnyProjectCapability(
  capabilities: string[],
  resolveProjectId: ProjectResolver = resolveProjectIdFromRequest,
  options: CapabilityOptions = {}
) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!Array.isArray(capabilities) || capabilities.length === 0) {
      sendJsonIfOpen(
        req,
        res,
        400,
        {
          error: 'Invalid capability configuration',
          code: 'CAPABILITY_LIST_INVALID',
          reason: 'capabilities_must_be_non_empty_array',
        },
        { capabilities }
      );
      return;
    }
    const normalizedCapabilities = capabilities
      .map((capability) => normalizeCapability(capability))
      .filter((capability): capability is string => capability !== null);
    if (normalizedCapabilities.length === 0) {
      sendJsonIfOpen(req, res, 400, INVALID_CAPABILITY_RESPONSE, { capabilities });
      return;
    }

    const { userId, organizationId, applicationRole, isImpersonating } = getUserContext(req);
    if (!userId || !organizationId) {
      sendJsonIfOpen(req, res, 401, { error: 'Authentication required', code: 'AUTH_REQUIRED' }, {});
      return;
    }
    const enforce = shouldEnforceEffectiveAccess();
    const shadow = shouldShadowEffectiveAccess();
    if (!enforce && !shadow) {
      invokeNextSafely(req, next, { phase: 'bypass', capabilities: normalizedCapabilities });
      return;
    }

    let projectId: string | null = null;
    try {
      projectId = firstString(await resolveProjectId(req));
    } catch (err) {
      logger.error('[effectiveCapability] resolveProjectId failed', {
        err,
        capabilities: normalizedCapabilities,
        path: getRequestPath(req),
      });
      if (enforce) {
        sendJsonIfOpen(
          req,
          res,
          503,
          {
            error: 'Authorization check failed',
            code: 'EFFECTIVE_ACCESS_CHECK_FAILED',
          },
          { capabilities: normalizedCapabilities, phase: 'resolveProjectId' }
        );
        return;
      }
      invokeNextSafely(req, next, {
        phase: 'resolveProjectId_shadow',
        capabilities: normalizedCapabilities,
      });
      return;
    }
    if (!projectId && !options.allowWithoutProject) {
      if (!enforce) {
        logger.warn('[effectiveCapability] shadow missing project context', {
          capabilities: normalizedCapabilities,
          path: getRequestPath(req),
        });
        invokeNextSafely(req, next, { phase: 'missingProject_shadow', capabilities: normalizedCapabilities });
        return;
      }
      sendJsonIfOpen(
        req,
        res,
        400,
        {
          error: 'Project context is required',
          code: 'PROJECT_CONTEXT_REQUIRED',
          required: normalizedCapabilities,
          reason: options.reason || 'missing_project_context',
        },
        { capabilities: normalizedCapabilities, phase: 'missingProject' }
      );
      return;
    }

    let access: unknown;
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
        err,
        capabilities: normalizedCapabilities,
        projectId,
        path: getRequestPath(req),
      });
      if (enforce) {
        sendJsonIfOpen(
          req,
          res,
          503,
          {
            error: 'Authorization check failed',
            code: 'EFFECTIVE_ACCESS_CHECK_FAILED',
          },
          { capabilities: normalizedCapabilities, projectId, phase: 'resolveAccess' }
        );
        return;
      }
      invokeNextSafely(req, next, { phase: 'resolveAccess_shadow', capabilities: normalizedCapabilities });
      return;
    }

    let hasAnyCapability = false;
    try {
      hasAnyCapability = normalizedCapabilities.some((requiredCapability) =>
        hasEffectiveCapability(access, requiredCapability)
      );
    } catch (err) {
      logger.error('[effectiveCapability] hasEffectiveCapability failed', {
        err,
        capabilities: normalizedCapabilities,
        projectId,
        path: getRequestPath(req),
      });
      if (enforce) {
        sendJsonIfOpen(
          req,
          res,
          503,
          {
            error: 'Authorization check failed',
            code: 'EFFECTIVE_ACCESS_CHECK_FAILED',
          },
          { capabilities: normalizedCapabilities, projectId, phase: 'capabilityCheck' }
        );
        return;
      }
      invokeNextSafely(req, next, {
        phase: 'capabilityCheck_shadow',
        capabilities: normalizedCapabilities,
      });
      return;
    }

    if (!hasAnyCapability) {
      if (!enforce) {
        logger.warn('[effectiveCapability] shadow capability mismatch', {
          capabilities: normalizedCapabilities,
          projectId,
          path: getRequestPath(req),
        });
        (req as AuthRequest & { effectiveAccess?: unknown }).effectiveAccess = access;
        invokeNextSafely(req, next, {
          phase: 'deny_shadow',
          capabilities: normalizedCapabilities,
          projectId,
        });
        return;
      }
      sendJsonIfOpen(
        req,
        res,
        403,
        {
          error: 'Capability required',
          code: 'CAPABILITY_REQUIRED',
          required: normalizedCapabilities,
          projectId,
          reason: options.reason || 'missing_capability_or_scope',
        },
        { capabilities: normalizedCapabilities, projectId, phase: 'deny' }
      );
      return;
    }

    (req as AuthRequest & { effectiveAccess?: unknown }).effectiveAccess = access;
    invokeNextSafely(req, next, { phase: 'allow', capabilities: normalizedCapabilities, projectId });
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

export const requireAnyInitiativeCapability = (
  capabilities: string[],
  options?: CapabilityOptions
) => requireAnyProjectCapability(capabilities, resolveInitiativeProjectId, options);

export const requireSupportCapability = (capability: string, options?: CapabilityOptions) =>
  requireProjectCapability(capability, async () => null, { ...options, allowWithoutProject: true });

export const requireBillingCapability = (capability: string, options?: CapabilityOptions) =>
  requireProjectCapability(capability, async () => null, { ...options, allowWithoutProject: true });
