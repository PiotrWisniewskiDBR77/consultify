import type { Response } from 'express';
import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { requirePermission } from '../../middleware/permission.middleware.js';
import { getV8Context } from '../../middleware/v8Auth.middleware.js';
import type { InsightStatus } from '../../services/InterviewInsightService.js';
import { getById as getInsightById } from '../../services/InterviewInsightService.js';
import notificationService from '../../services/notificationService.js';
import {
  organizationContextService,
  rebuildOrganizationContextSnapshot,
} from '../../services/organizationContext/OrganizationContextService.js';
import { hasPermission } from '../../services/permissionService.js';
import { onInsightPublished } from '../../services/v8/insightSignalBridgeService.js';
import { buildInsightAnalysis } from '../../services/v8/interviewInsightAnalysisService.js';
import {
  type CandidateTriageAction,
  listCandidates,
  promoteCandidateToFinding,
  triageCandidate,
} from '../../services/v8/interviewInsightCandidateService.js';
import { canPublishFinding } from '../../services/v8/interviewInsightCanon.js';
import {
  addEvidencePointer,
  addFinding,
  buildHandoffPayload,
  buildSourcePack,
  getFinding,
  type InsightLifecycleAction,
  listFindings,
  recordHandoff,
  removeEvidencePointer,
  updateFinding,
  updateFindingReadback,
  validateLifecycleTransition,
} from '../../services/v8/interviewInsightFindingsService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { fireAndForget } from '../../utils/fireAndForget.js';
import logger from '../../utils/Logger.js';
import * as queryHelpers from '../../utils/queryHelpers.js';

const router = Router();

export const V8_INTERVIEW_INSIGHTS_CONTRACT = 'interview_insights_p10_v1';

function insightsMeta() {
  return { version: 'v8' as const, contract: V8_INTERVIEW_INSIGHTS_CONTRACT };
}

const LIFECYCLE_ACTIONS: InsightLifecycleAction[] = [
  'submit_for_review',
  'approve',
  'publish',
  'reject',
  'revert_to_draft',
];

async function getOrgAdminUserIds(organizationId: string): Promise<string[]> {
  try {
    const rows = await queryHelpers.queryAll(
      `SELECT user_id, role FROM organization_members WHERE organization_id = ?`,
      [organizationId]
    );
    const admins = (rows || []).filter((r: any) => {
      const role = String(r.role || '').toLowerCase();
      return role === 'owner' || role === 'admin' || role === 'administrator';
    });
    return admins.map((r: any) => String(r.user_id));
  } catch {
    return [];
  }
}

function emitInsightLifecycleNotifications(
  organizationId: string,
  insightId: string,
  insightTitle: string,
  action: InsightLifecycleAction,
  actorUserId: string,
  createdBy?: string
): void {
  const fire = async () => {
    try {
      if (action === 'submit_for_review') {
        const adminIds = await getOrgAdminUserIds(organizationId);
        const recipients = adminIds.filter((uid) => uid !== actorUserId);
        if (recipients.length === 0) return;

        await Promise.allSettled(
          recipients.map((uid) =>
            notificationService.send({
              userId: uid,
              organizationId,
              type: 'insight_review_requested',
              title: 'Insight requires review',
              body: `Insight "${insightTitle}" has been submitted for review and awaits your approval.`,
              entityType: 'interview_insight',
              entityId: insightId,
              actionUrl: `/interview?artifact=insight:${insightId}`,
              priority: 'high',
              actorId: actorUserId,
              isActionable: true,
            })
          )
        );
      }

      if (action === 'approve' || action === 'publish') {
        const notifyUserId = createdBy && createdBy !== actorUserId ? createdBy : null;
        if (!notifyUserId) return;

        await notificationService.send({
          userId: notifyUserId,
          organizationId,
          type: 'insight_published',
          title: 'Your insight has been published',
          body: `Insight "${insightTitle}" has been approved and published.`,
          entityType: 'interview_insight',
          entityId: insightId,
          actionUrl: `/interview?artifact=insight:${insightId}`,
          priority: 'normal',
          actorId: actorUserId,
        });
      }
    } catch (err) {
      logger.warn('[InsightLifecycle] Failed to emit notification', err);
    }
  };

  fireAndForget(fire(), 'InsightLifecycle notification');
}

router.post(
  '/insights/:insightId/lifecycle',
  requirePermission('INTERVIEW_INSIGHTS_REVIEW'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId, userRole } = getV8Context(req);
    const { insightId } = req.params as { insightId: string };
    const { action } = req.body as { action?: string };

    if (!action || !LIFECYCLE_ACTIONS.includes(action as InsightLifecycleAction)) {
      return res.status(400).json({
        error: `Invalid action. Must be one of: ${LIFECYCLE_ACTIONS.join(', ')}`,
        code: 'P10_INVALID_LIFECYCLE_ACTION',
      });
    }

    const insight = await getInsightById(insightId);
    if (!insight || insight.organizationId !== organizationId) {
      return res.status(404).json({ error: 'Insight not found' });
    }

    const typedAction = action as InsightLifecycleAction;

    if (typedAction === 'publish' || typedAction === 'approve') {
      const canPublish = await hasPermission(
        userId,
        organizationId,
        'INTERVIEW_INSIGHTS_PUBLISH',
        userRole as any
      );
      if (!canPublish) {
        return res.status(403).json({
          error: 'Permission denied',
          required: 'INTERVIEW_INSIGHTS_PUBLISH',
          code: 'PERMISSION_DENIED',
        });
      }
    }

    if (typedAction === 'publish' || typedAction === 'approve') {
      const findings = await listFindings(insightId);
      if (findings.length === 0) {
        return res.status(422).json({
          error: 'At least one finding is required before publish',
          code: 'P10_FINDINGS_REQUIRED',
        });
      }
      for (const f of findings) {
        const check = canPublishFinding({
          confidenceLevel: f.confidence_level,
          evidencePointers: f.evidence_pointers,
          limits: f.limits,
          nextAction: f.next_action,
        });
        if (!check.allowed) {
          return res.status(422).json({
            error: `Finding "${f.id}" blocks publish: ${check.reason}`,
            code: 'P10_FINDING_NOT_PUBLISHABLE',
            findingId: f.id,
          });
        }
        if (f.readback_status !== 'confirmed_by_client') {
          return res.status(422).json({
            error: `Finding "${f.id}" blocks publish: client readback confirmation is required`,
            code: 'P10_READBACK_REQUIRED',
            findingId: f.id,
            readbackStatus: f.readback_status,
          });
        }
      }
    }

    const transition = validateLifecycleTransition(insight.status, typedAction);
    if (!transition.allowed) {
      return res.status(409).json({
        error: transition.reason,
        code: 'P10_INVALID_STATE_TRANSITION',
        currentStatus: insight.status,
      });
    }

    const now = new Date().toISOString();
    const updates: Record<string, unknown> = {
      status: transition.targetStatus,
      updated_at: now,
    };

    if (transition.targetStatus === 'published') {
      updates.published_at = now;
    }
    if (typedAction === 'approve' || typedAction === 'submit_for_review') {
      updates.reviewed_by = userId;
    }

    const setClauses = Object.keys(updates)
      .map((k) => `${k} = ?`)
      .join(', ');
    const values = [...Object.values(updates), insightId, organizationId];

    await queryHelpers.run(
      `UPDATE interview_insights SET ${setClauses} WHERE id = ? AND organization_id = ?`,
      values
    );

    if (transition.targetStatus === 'published') {
      fireAndForget(
        rebuildOrganizationContextSnapshot(organizationId),
        'rebuildOrgContextSnapshot'
      );

      const freshInsight = await getInsightById(insightId);
      if (freshInsight) {
        onInsightPublished(freshInsight, organizationId).catch((err) => {
          logger.warn('[InsightLifecycle] onInsightPublished hook failed', err);
        });
      }
    }

    emitInsightLifecycleNotifications(
      organizationId,
      insightId,
      insight.title,
      typedAction,
      userId,
      insight.createdBy
    );

    return res.json({
      data: {
        insightId,
        previousStatus: insight.status,
        newStatus: transition.targetStatus,
        action: typedAction,
        updatedAt: now,
      },
      meta: insightsMeta(),
    });
  })
);

router.get(
  '/insights/:insightId/source-pack',
  requirePermission('INTERVIEW_INSIGHTS_VIEW'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const { insightId } = req.params as { insightId: string };

    const insight = await getInsightById(insightId);
    if (!insight || insight.organizationId !== organizationId) {
      return res.status(404).json({ error: 'Insight not found' });
    }

    const sourcePack = await buildSourcePack(insightId);
    if (!sourcePack) {
      return res.status(404).json({ error: 'Source pack not found', code: 'P10_SOURCE_PACK_NOT_FOUND' });
    }

    return res.json({
      data: { sourcePack, insightId },
      meta: insightsMeta(),
    });
  })
);

router.get(
  '/insights/:insightId/candidates',
  requirePermission('INTERVIEW_INSIGHTS_VIEW'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const { insightId } = req.params as { insightId: string };

    const insight = await getInsightById(insightId);
    if (!insight || insight.organizationId !== organizationId) {
      return res.status(404).json({ error: 'Insight not found' });
    }

    const candidates = await listCandidates(insightId);
    return res.json({
      data: { candidates, insightId },
      meta: insightsMeta(),
    });
  })
);

router.post(
  '/insights/:insightId/candidates/:candidateId/triage',
  requirePermission('INTERVIEW_INSIGHTS_REVIEW'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const { insightId, candidateId } = req.params as { insightId: string; candidateId: string };
    const {
      action,
      candidate_statement,
      rationale,
      followup_recommendation,
      confidence_level,
      limits,
      next_action,
    } = req.body as {
      action?: CandidateTriageAction;
      candidate_statement?: string;
      rationale?: string;
      followup_recommendation?: string;
      confidence_level?: 'high' | 'medium' | 'low' | 'insufficient' | 'contradicted';
      limits?: string;
      next_action?: string;
    };

    const insight = await getInsightById(insightId);
    if (!insight || insight.organizationId !== organizationId) {
      return res.status(404).json({ error: 'Insight not found' });
    }

    if (!action) {
      return res
        .status(400)
        .json({ error: 'action is required', code: 'P10_CANDIDATE_ACTION_REQUIRED' });
    }

    if (action === 'promote_to_finding') {
      const result = await promoteCandidateToFinding(
        insightId,
        candidateId,
        {
          finding_statement: candidate_statement,
          confidence_level,
          limits,
          next_action,
        },
        {
          actorUserId: userId,
          organizationId,
        }
      );
      if (result.error) {
        return res.status(400).json({ error: result.error, code: 'P10_CANDIDATE_PROMOTE_FAILED' });
      }
      return res.json({
        data: {
          candidate: result.candidate,
          finding: result.finding,
          insightId,
          candidateId,
        },
        meta: insightsMeta(),
      });
    }

    const result = await triageCandidate(
      insightId,
      candidateId,
      {
        action,
        candidate_statement,
        rationale,
        followup_recommendation,
      },
      userId
    );
    if (result.error) {
      return res.status(400).json({ error: result.error, code: 'P10_CANDIDATE_TRIAGE_FAILED' });
    }

    return res.json({
      data: {
        candidate: result.candidate,
        insightId,
        candidateId,
      },
      meta: insightsMeta(),
    });
  })
);

router.get(
  '/insights/:insightId/analysis',
  requirePermission('INTERVIEW_INSIGHTS_VIEW'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const { insightId } = req.params as { insightId: string };

    const insight = await getInsightById(insightId);
    if (!insight || insight.organizationId !== organizationId) {
      return res.status(404).json({ error: 'Insight not found' });
    }

    const analysis = await buildInsightAnalysis(insightId);
    if (!analysis) {
      return res
        .status(404)
        .json({ error: 'Insight analysis not found', code: 'P10_ANALYSIS_NOT_FOUND' });
    }

    return res.json({
      data: { analysis, insightId },
      meta: insightsMeta(),
    });
  })
);

router.get(
  '/insights/:insightId/findings',
  requirePermission('INTERVIEW_INSIGHTS_VIEW'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const { insightId } = req.params as { insightId: string };

    const insight = await getInsightById(insightId);
    if (!insight || insight.organizationId !== organizationId) {
      return res.status(404).json({ error: 'Insight not found' });
    }

    const findings = await listFindings(insightId);

    return res.json({
      data: { findings, insightId },
      meta: insightsMeta(),
    });
  })
);

router.post(
  '/insights/:insightId/findings',
  requirePermission('INTERVIEW_INSIGHTS_CREATE'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const { insightId } = req.params as { insightId: string };

    const insight = await getInsightById(insightId);
    if (!insight || insight.organizationId !== organizationId) {
      return res.status(404).json({ error: 'Insight not found' });
    }

    const { finding_statement, confidence_level, limits, next_action, evidence_pointers } =
      req.body as {
        finding_statement?: string;
        confidence_level?: string;
        limits?: string;
        next_action?: string;
        evidence_pointers?: Array<{
          type: string;
          sourceRef: string;
          sourceFingerprint: string;
          capturedExcerpt?: string | null;
        }>;
      };

    if (!finding_statement || !confidence_level || !limits || !next_action) {
      return res.status(400).json({
        error: 'finding_statement, confidence_level, limits, and next_action are required',
        code: 'P10_MISSING_FIELDS',
      });
    }

    const result = await addFinding(
      insightId,
      {
        finding_statement,
        confidence_level,
        limits,
        next_action,
        evidence_pointers,
      },
      {
        organizationId,
        actorUserId: userId,
      }
    );

    if (result.error) {
      return res.status(400).json({ error: result.error, code: 'P10_FINDING_VALIDATION_ERROR' });
    }

    return res.status(201).json({
      data: { finding: result.finding },
      meta: insightsMeta(),
    });
  })
);

router.patch(
  '/insights/:insightId/findings/:findingId',
  requirePermission('INTERVIEW_INSIGHTS_REVIEW'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const { insightId, findingId } = req.params as { insightId: string; findingId: string };

    const insight = await getInsightById(insightId);
    if (!insight || insight.organizationId !== organizationId) {
      return res.status(404).json({ error: 'Insight not found' });
    }

    const body = req.body as {
      finding_statement?: string;
      confidence_level?: string;
      limits?: string;
      next_action?: string;
      add_evidence_pointers?: Array<{
        type: string;
        sourceRef: string;
        sourceFingerprint: string;
        capturedExcerpt?: string | null;
      }>;
      remove_evidence_pointers?: Array<{
        pointerId: string;
        removal_reason: string;
      }>;
    };

    const finding = await getFinding(insightId, findingId);
    if (!finding) {
      return res.status(404).json({ error: 'Finding not found', code: 'P10_FINDING_NOT_FOUND' });
    }

    if (
      body.finding_statement !== undefined ||
      body.confidence_level !== undefined ||
      body.limits !== undefined ||
      body.next_action !== undefined
    ) {
      const updateResult = await updateFinding(
        insightId,
        findingId,
        {
          finding_statement: body.finding_statement,
          confidence_level: body.confidence_level,
          limits: body.limits,
          next_action: body.next_action,
        },
        userId
      );
      if (updateResult.error) {
        return res
          .status(400)
          .json({ error: updateResult.error, code: 'P10_FINDING_VALIDATION_ERROR' });
      }
    }

    const pointerErrors: string[] = [];

    if (body.add_evidence_pointers) {
      for (const ptr of body.add_evidence_pointers) {
        const result = await addEvidencePointer(insightId, findingId, ptr, userId);
        if (result.error) pointerErrors.push(result.error);
      }
    }

    if (body.remove_evidence_pointers) {
      for (const ptr of body.remove_evidence_pointers) {
        const result = await removeEvidencePointer(insightId, findingId, ptr, userId);
        if (result.error) pointerErrors.push(result.error);
      }
    }

    const updated = await getFinding(insightId, findingId);

    return res.json({
      data: {
        finding: updated,
        ...(pointerErrors.length > 0 ? { pointer_warnings: pointerErrors } : {}),
      },
      meta: insightsMeta(),
    });
  })
);

router.patch(
  '/insights/:insightId/findings/:findingId/readback',
  requirePermission('INTERVIEW_INSIGHTS_REVIEW'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const { insightId, findingId } = req.params as { insightId: string; findingId: string };
    const { readback_status, readback_summary } = req.body as {
      readback_status?: string;
      readback_summary?: string | null;
    };

    const insight = await getInsightById(insightId);
    if (!insight || insight.organizationId !== organizationId) {
      return res.status(404).json({ error: 'Insight not found' });
    }
    if (!readback_status) {
      return res.status(400).json({
        error: 'readback_status is required',
        code: 'P10_READBACK_STATUS_REQUIRED',
      });
    }

    const result = await updateFindingReadback(
      insightId,
      findingId,
      { readback_status, readback_summary },
      userId
    );
    if (result.error) {
      return res.status(400).json({ error: result.error, code: 'P10_READBACK_UPDATE_FAILED' });
    }

    return res.json({
      data: { finding: result.finding, insightId, findingId },
      meta: insightsMeta(),
    });
  })
);

router.post(
  '/insights/:insightId/findings/:findingId/handoff',
  requirePermission('INTERVIEW_INSIGHTS_HANDOFF'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const { insightId, findingId } = req.params as { insightId: string; findingId: string };
    const { target_initiative_id } = req.body as { target_initiative_id?: string };

    const insight = await getInsightById(insightId);
    if (!insight || insight.organizationId !== organizationId) {
      return res.status(404).json({ error: 'Insight not found' });
    }

    const finding = await getFinding(insightId, findingId);
    if (!finding) {
      return res.status(404).json({ error: 'Finding not found', code: 'P10_FINDING_NOT_FOUND' });
    }

    const publishCheck = canPublishFinding(
      {
        confidenceLevel: finding.confidence_level,
        evidencePointers: finding.evidence_pointers,
        limits: finding.limits,
        nextAction: finding.next_action,
      },
      'handoff'
    );
    if (!publishCheck.allowed) {
      return res.status(422).json({
        error: `Cannot handoff: ${publishCheck.reason}`,
        code: 'P10_HANDOFF_BLOCKED',
      });
    }

    const handoffResult = await buildHandoffPayload(insightId, findingId);
    if (handoffResult.error || !handoffResult.payload) {
      return res.status(422).json({
        error: handoffResult.error ?? 'Failed to build handoff payload',
        code: 'P10_HANDOFF_BUILD_FAILED',
      });
    }

    const payload = handoffResult.payload;
    let initiativeRef: { id: string; type: 'linked' | 'handoff_request' };

    if (target_initiative_id) {
      const existing = await queryHelpers.queryOne(
        `SELECT id FROM initiatives WHERE id = ? AND organization_id = ?`,
        [target_initiative_id, organizationId]
      );
      if (!existing) {
        return res.status(404).json({
          error: 'Target initiative not found',
          code: 'P10_TARGET_INITIATIVE_NOT_FOUND',
        });
      }
      initiativeRef = { id: target_initiative_id, type: 'linked' };
    } else {
      initiativeRef = { id: `handoff_req_${uuidv4()}`, type: 'handoff_request' };
    }

    await recordHandoff(insightId, findingId, payload, target_initiative_id, {
      organizationId,
      actorUserId: userId,
      targetRefType: target_initiative_id ? 'linked' : 'handoff_request',
      status: target_initiative_id ? 'linked' : 'pending',
    });

    organizationContextService
      .recordContextSource({
        organizationId,
        sourceType: 'interview_finding_handoff',
        sourceId: findingId,
        authorUserId: userId,
        channel: 'interview',
        sourceLabel: `Finding handoff: ${finding.finding_statement.slice(0, 80)}`,
        content: {
          insightId,
          findingId,
          findingStatement: finding.finding_statement,
          confidenceLevel: finding.confidence_level,
          limits: finding.limits,
          nextAction: finding.next_action,
          targetInitiativeId: target_initiative_id || null,
          initiativeRefType: initiativeRef.type,
        },
        isExplicit: true,
        claims: [
          {
            claimPath: 'signals.interviewFindings',
            value: {
              findingStatement: finding.finding_statement,
              confidenceLevel: finding.confidence_level,
              limits: finding.limits,
              nextAction: finding.next_action,
              evidenceCount: finding.evidence_pointers.filter((p) => !p.isTombstone).length,
              insightId,
              handoffTarget: target_initiative_id || initiativeRef.id,
            },
            confidence:
              finding.confidence_level === 'high'
                ? 0.95
                : finding.confidence_level === 'medium'
                  ? 0.75
                  : 0.55,
          },
        ],
      })
      .catch((err: unknown) => logger.warn('[InsightHandoff] artifact registration failed', err));

    return res.json({
      data: {
        handoff_payload: payload,
        initiative: initiativeRef,
        findingId,
        insightId,
      },
      meta: insightsMeta(),
    });
  })
);

export default router;
