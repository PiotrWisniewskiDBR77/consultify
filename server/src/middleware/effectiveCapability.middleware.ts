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

const shouldEnforceEffectiveAccess = () => process.env.EFFECTIVE_ACCESS_ENFORCE === 'true';
const shouldShadowEffectiveAccess = () => process.env.EFFECTIVE_ACCESS_SHADOW === 'true';

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (Array.isArray(value) && typeof value[0] === 'string' && value[0].trim()) {
      return value[0].trim();
    }
  }
  return null;
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
  return firstString(
    req.params?.projectId,
    req.params?.id,
    req.body?.projectId,
    req.body?.project_id,
    req.query?.projectId,
    req.query?.project_id
  );
}

export async function resolveTaskProjectId(req: AuthRequest): Promise<string | null> {
  const taskId = firstString(
    req.params?.taskId,
    req.params?.id,
    req.body?.taskId,
    req.body?.task_id
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

export function requireProjectCapability(
  capability: string,
  resolveProjectId: ProjectResolver = resolveProjectIdFromRequest,
  options: CapabilityOptions = {}
) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const { userId, organizationId, applicationRole, isImpersonating } = getUserContext(req);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
      return;
    }
    if (!shouldEnforceEffectiveAccess() && !shouldShadowEffectiveAccess()) {
      next();
      return;
    }

    const projectId = (await resolveProjectId(req)) || null;
    if (!projectId && !options.allowWithoutProject) {
      if (!shouldEnforceEffectiveAccess()) {
        logger.warn('[effectiveCapability] shadow missing project context', {
          capability,
          path: req.path,
        });
        next();
        return;
      }
      res.status(400).json({
        error: 'Project context is required',
        code: 'PROJECT_CONTEXT_REQUIRED',
        required: capability,
        reason: options.reason || 'missing_project_context',
      });
      return;
    }

    const access = await resolveEffectiveAccess({
      userId,
      organizationId,
      applicationRole,
      projectId,
      isImpersonating,
    });

    if (!hasEffectiveCapability(access, capability)) {
      if (!shouldEnforceEffectiveAccess()) {
        logger.warn('[effectiveCapability] shadow capability mismatch', {
          capability,
          projectId,
          path: req.path,
        });
        (req as AuthRequest & { effectiveAccess?: unknown }).effectiveAccess = access;
        next();
        return;
      }
      res.status(403).json({
        error: 'Capability required',
        code: 'CAPABILITY_REQUIRED',
        required: capability,
        projectId,
        reason: options.reason || 'missing_capability_or_scope',
      });
      return;
    }

    (req as AuthRequest & { effectiveAccess?: unknown }).effectiveAccess = access;
    next();
  };
}

export function requireAnyProjectCapability(
  capabilities: string[],
  resolveProjectId: ProjectResolver = resolveProjectIdFromRequest,
  options: CapabilityOptions = {}
) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const { userId, organizationId, applicationRole, isImpersonating } = getUserContext(req);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
      return;
    }
    if (!shouldEnforceEffectiveAccess() && !shouldShadowEffectiveAccess()) {
      next();
      return;
    }

    const projectId = (await resolveProjectId(req)) || null;
    if (!projectId && !options.allowWithoutProject) {
      if (!shouldEnforceEffectiveAccess()) {
        logger.warn('[effectiveCapability] shadow missing project context', {
          capabilities,
          path: req.path,
        });
        next();
        return;
      }
      res.status(400).json({
        error: 'Project context is required',
        code: 'PROJECT_CONTEXT_REQUIRED',
        required: capabilities,
        reason: options.reason || 'missing_project_context',
      });
      return;
    }

    const access = await resolveEffectiveAccess({
      userId,
      organizationId,
      applicationRole,
      projectId,
      isImpersonating,
    });

    if (!capabilities.some((capability) => hasEffectiveCapability(access, capability))) {
      if (!shouldEnforceEffectiveAccess()) {
        logger.warn('[effectiveCapability] shadow capability mismatch', {
          capabilities,
          projectId,
          path: req.path,
        });
        (req as AuthRequest & { effectiveAccess?: unknown }).effectiveAccess = access;
        next();
        return;
      }
      res.status(403).json({
        error: 'Capability required',
        code: 'CAPABILITY_REQUIRED',
        required: capabilities,
        projectId,
        reason: options.reason || 'missing_capability_or_scope',
      });
      return;
    }

    (req as AuthRequest & { effectiveAccess?: unknown }).effectiveAccess = access;
    next();
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
