// @ts-nocheck
/**
 * Stakeholder Registry Controller (Zwornik Delta A)
 *
 * SSOT: Harvard/wdrozenie-100/_KONCEPT_ZWORNIK_2026-07-10.md, §3.
 * Thin HTTP layer over `stakeholderRegistryService`. Confidentiality gate
 * (§3.5, P-2): influence/interest/status/notes are stripped from responses
 * unless the caller has `stakeholder.assessment.view`.
 */

import type { Response } from 'express';

import {
  hasEffectiveCapability,
  resolveEffectiveAccess,
} from '../services/effectiveAccessService.js';
import * as stakeholderRegistryService from '../services/stakeholderRegistryService.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import logger from '../utils/Logger.js';

/**
 * Resolve whether the requester can see confidential assessment fields
 * (influence/interest/engagement_status/notes) for a given project context.
 * `projectId: null` resolves org-level baseline visibility (registry
 * managers only). This check always runs — it is independent of the
 * EFFECTIVE_ACCESS_ENFORCE/SHADOW rollout flags gating capability
 * *mutations* elsewhere, because data exposure is a confidentiality concern,
 * not a rollout concern.
 */
async function canViewAssessment(
  req: AuthenticatedRequest,
  projectId: string | null
): Promise<boolean> {
  try {
    const userId = req.user?.id;
    const organizationId = req.user?.organizationId;
    if (!userId || !organizationId) return false;
    const access = await resolveEffectiveAccess({
      userId,
      organizationId,
      applicationRole: req.user?.role,
      projectId,
    });
    return (
      hasEffectiveCapability(access, 'stakeholder.assessment.view') ||
      hasEffectiveCapability(access, 'stakeholder.registry.manage')
    );
  } catch (err) {
    logger.warn('[StakeholderRegistryController] canViewAssessment check failed', {
      error: (err as Error)?.message,
    });
    // Fail-closed on assessment visibility: confidential by default.
    return false;
  }
}

class StakeholderRegistryController {
  // ==========================================
  // REGISTRY (identity, org-level)
  // ==========================================

  static list = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const rows = await stakeholderRegistryService.listRegistry(orgId);
    const canView = await canViewAssessment(req, null);
    res.json({ stakeholders: stakeholderRegistryService.stripConfidential(rows, canView) });
  });

  static getOne = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const entry = await stakeholderRegistryService.getRegistryEntry(orgId, req.params.id);
      if (!entry) {
        res.status(404).json({ error: 'Stakeholder not found' });
        return;
      }
      const canView = await canViewAssessment(req, null);
      res.json({ stakeholder: stakeholderRegistryService.stripConfidential(entry, canView) });
    }
  );

  static create = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const actorId = req.user?.id;
      if (!orgId || !actorId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      try {
        const entry = await stakeholderRegistryService.createRegistryEntry(
          orgId,
          actorId,
          req.body || {}
        );
        // D11 defense-in-depth: the route's write-capability gate
        // (requireStakeholderWrite) is itself a no-op unless
        // EFFECTIVE_ACCESS_ENFORCE/SHADOW is set — so redact the response the
        // same way every read path does, rather than trusting the mutation
        // gate alone to keep confidential fields from a caller who lacks
        // stakeholder.assessment.view.
        const canView = await canViewAssessment(req, null);
        res
          .status(201)
          .json({ success: true, stakeholder: stakeholderRegistryService.stripConfidential(entry, canView) });
      } catch (err: any) {
        res.status(err?.status || 400).json({ error: err?.message || 'Failed to create stakeholder' });
      }
    }
  );

  static update = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const entry = await stakeholderRegistryService.updateRegistryEntry(
        orgId,
        req.params.id,
        req.body || {}
      );
      if (!entry) {
        res.status(404).json({ error: 'Stakeholder not found' });
        return;
      }
      // D11 defense-in-depth (see `create` above): redact before echoing the
      // merged row back — it can carry pre-existing confidential fields the
      // caller of THIS request never set (e.g. a PATCH that only touches
      // orgUnit still echoes defaultInfluence/defaultInterest set earlier by
      // someone else).
      const canView = await canViewAssessment(req, null);
      res.json({
        success: true,
        stakeholder: stakeholderRegistryService.stripConfidential(entry, canView),
      });
    }
  );

  static remove = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const deleted = await stakeholderRegistryService.deleteRegistryEntry(orgId, req.params.id);
      if (!deleted) {
        res.status(404).json({ error: 'Stakeholder not found' });
        return;
      }
      res.json({ success: true });
    }
  );

  // ==========================================
  // ENGAGEMENTS (assessment, per context)
  // ==========================================

  static listEngagements = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const rows = await stakeholderRegistryService.listEngagements(orgId, req.params.id);
      // Mixed contexts in one list (org + several projects) — gate per row.
      const results = await Promise.all(
        rows.map(async (row: any) => {
          const canView = await canViewAssessment(req, row.projectId || null);
          return stakeholderRegistryService.stripConfidential(row, canView);
        })
      );
      res.json({ engagements: results });
    }
  );

  static upsertEngagement = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const actorId = req.user?.id;
      if (!orgId || !actorId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      try {
        const engagementId = await stakeholderRegistryService.upsertEngagement(
          orgId,
          req.params.id,
          actorId,
          req.body || {}
        );
        res.status(201).json({ success: true, id: engagementId });
      } catch (err: any) {
        res
          .status(err?.status || 400)
          .json({ error: err?.message || 'Failed to save engagement' });
      }
    }
  );

  static updateEngagement = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const engagement = await stakeholderRegistryService.updateEngagement(
        orgId,
        req.params.engagementId,
        req.body || {}
      );
      if (!engagement) {
        res.status(404).json({ error: 'Engagement not found' });
        return;
      }
      // D11 defense-in-depth (see `update` above): the merged row can carry
      // confidential fields (influence/interest/status/notes) that predate
      // this request and belong to the engagement's OWN project context, not
      // necessarily the org-level baseline — gate on that project.
      const canView = await canViewAssessment(req, engagement.projectId ?? null);
      res.json({
        success: true,
        engagement: stakeholderRegistryService.stripConfidential(engagement, canView),
      });
    }
  );

  static deleteEngagement = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const deleted = await stakeholderRegistryService.deleteEngagement(
        orgId,
        req.params.engagementId
      );
      if (!deleted) {
        res.status(404).json({ error: 'Engagement not found' });
        return;
      }
      res.json({ success: true });
    }
  );

  // ==========================================
  // EFFECTIVE / INHERITANCE READ-MODELS (§3.3) + F12 PREFILL HOOK
  // ==========================================

  static getProjectEffective = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const rows = await stakeholderRegistryService.getProjectEffectiveStakeholders(
        orgId,
        req.params.projectId
      );
      const canView = await canViewAssessment(req, req.params.projectId);
      res.json({ stakeholders: stakeholderRegistryService.stripConfidential(rows, canView) });
    }
  );

  static getInitiativeEffective = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      try {
        const rows = await stakeholderRegistryService.getInitiativeEffectiveStakeholders(
          orgId,
          req.params.initiativeId
        );
        // Best-effort: assessment visibility follows the initiative's project
        // context when present; org-level otherwise.
        const canView = await canViewAssessment(req, req.query.projectId as string | null);
        res.json({ stakeholders: stakeholderRegistryService.stripConfidential(rows, canView) });
      } catch (err: any) {
        res
          .status(err?.status || 400)
          .json({ error: err?.message || 'Failed to load effective stakeholders' });
      }
    }
  );

  static getProjectPrefill = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const candidates = await stakeholderRegistryService.getProjectPrefillCandidates(
        orgId,
        req.params.projectId
      );
      const canView = await canViewAssessment(req, req.params.projectId);
      res.json({ candidates: stakeholderRegistryService.stripConfidential(candidates, canView) });
    }
  );
}

export default StakeholderRegistryController;
