import type { Response } from 'express';
import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { requirePermission } from '../../middleware/permission.middleware.js';
import { getV8Context } from '../../middleware/v8Auth.middleware.js';
import { EmbeddingService } from '../../services/ai/embeddingService.js';
import { checkSimilarInitiatives } from '../../services/initiativeSimilarityService.js';
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

// ---------------------------------------------------------------------------
// #28e — Insight similarity scoring (server-backed duplicate detection)
//
// Mirrors initiativeSimilarityService: primary semantic cosine similarity over
// OpenAI embeddings, deterministic token-Jaccard fallback when embeddings are
// unavailable / fail. The initiative service loads from the `initiatives` table
// directly so it cannot be reused as-is for insights; we replicate the same
// scoring primitives and verdict thresholds inline here.
// ---------------------------------------------------------------------------

const insightEmbeddingService = new EmbeddingService();

// Cap comparison set to keep embedding cost / latency bounded.
const MAX_EXISTING_INSIGHTS = 200;

// Verdict thresholds (cosine similarity or normalized Jaccard, both 0..1).
const SIMILARITY_DUPLICATE_THRESHOLD = 0.7;
const SIMILARITY_SIMILAR_THRESHOLD = 0.5;
const SIMILARITY_RELATED_THRESHOLD = 0.3;
const SIMILARITY_MAX_MATCHES = 5;

type SimilarityVerdict = 'duplicate' | 'similar' | 'related' | 'new';

function similarityVerdictForScore(score: number): SimilarityVerdict {
  if (score >= SIMILARITY_DUPLICATE_THRESHOLD) return 'duplicate';
  if (score >= SIMILARITY_SIMILAR_THRESHOLD) return 'similar';
  if (score >= SIMILARITY_RELATED_THRESHOLD) return 'related';
  return 'new';
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || !b.length || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  const sim = dot / (Math.sqrt(normA) * Math.sqrt(normB));
  if (sim < 0) return 0;
  if (sim > 1) return 1;
  return sim;
}

const SIMILARITY_STOPWORDS = new Set<string>([
  // PL
  'i',
  'oraz',
  'lub',
  'w',
  'na',
  'do',
  'dla',
  'z',
  'ze',
  'o',
  'aby',
  'jako',
  'przez',
  'po',
  'od',
  'analiza',
  'analizy',
  'raport',
  'wnioski',
  'wniosek',
  // EN
  'the',
  'this',
  'and',
  'or',
  'of',
  'to',
  'for',
  'with',
  'in',
  'on',
  'an',
  'by',
  'as',
  'at',
  'analysis',
  'insight',
  'report',
]);

function similarityTokenize(text: string): Set<string> {
  const tokens = text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics so combining marks are removed
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((tok) => tok.length > 2 && !SIMILARITY_STOPWORDS.has(tok));
  return new Set(tokens);
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const tok of a) {
    if (b.has(tok)) intersection++;
  }
  const union = a.size + b.size - intersection;
  if (union === 0) return 0;
  return intersection / union;
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

// #26b — managers + owners/admins. "Submit for Information" sends an insight
// to the org's management circle as a notification. It does NOT change the
// insight's lifecycle status and does NOT require any approval gate.
async function getOrgManagerUserIds(organizationId: string): Promise<string[]> {
  try {
    const rows = await queryHelpers.queryAll(
      `SELECT user_id, role FROM organization_members WHERE organization_id = ?`,
      [organizationId]
    );
    const recipients = (rows || []).filter((r: any) => {
      const role = String(r.role || '').toLowerCase();
      return (
        role === 'owner' ||
        role === 'admin' ||
        role === 'administrator' ||
        role === 'manager' ||
        role === 'lead'
      );
    });
    return recipients.map((r: any) => String(r.user_id));
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

// #26b — POST /v8/interview/insights/:insightId/submit-for-information
// Org-scoped + auth. Sends the insight to the org's managers/owners (or a
// single recipient passed in the body) as a notification. This is purely
// informational: it does NOT lock the insight, change its status, or require
// review/approval. Available to anyone who can view the insight.
router.post(
  '/insights/:insightId/submit-for-information',
  requirePermission('INTERVIEW_INSIGHTS_VIEW'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const { insightId } = req.params as { insightId: string };
    const { recipientUserId, note } = req.body as {
      recipientUserId?: string;
      note?: string;
    };

    const insight = await getInsightById(insightId);
    if (!insight || insight.organizationId !== organizationId) {
      return res.status(404).json({ error: 'Insight not found' });
    }

    // Resolve recipients: an explicit recipient (validated to be in the org) or
    // all managers/owners/admins. The actor never notifies themselves.
    let recipients: string[];
    if (recipientUserId) {
      const member = await queryHelpers.queryOne(
        `SELECT user_id FROM organization_members WHERE organization_id = ? AND user_id = ?`,
        [organizationId, recipientUserId]
      );
      if (!member) {
        return res.status(400).json({
          error: 'Recipient is not a member of this organization',
          code: 'P10_INVALID_RECIPIENT',
        });
      }
      recipients = [recipientUserId];
    } else {
      recipients = await getOrgManagerUserIds(organizationId);
    }
    recipients = Array.from(new Set(recipients.filter((uid) => uid && uid !== userId)));

    const trimmedNote = typeof note === 'string' ? note.trim().slice(0, 500) : '';

    if (recipients.length > 0) {
      const fire = async () => {
        await Promise.allSettled(
          recipients.map((uid) =>
            notificationService.send({
              userId: uid,
              organizationId,
              type: 'insight_shared_for_information',
              title: 'Insight shared for your information',
              body: trimmedNote
                ? `Insight "${insight.title}" was shared with you for information: ${trimmedNote}`
                : `Insight "${insight.title}" was shared with you for information.`,
              entityType: 'interview_insight',
              entityId: insightId,
              actionUrl: `/interview?artifact=insight:${insightId}`,
              priority: 'normal',
              actorId: userId,
              isActionable: false,
            })
          )
        );
      };
      fireAndForget(fire(), 'InsightSubmitForInformation notification');
    }

    return res.json({
      data: {
        insightId,
        recipientCount: recipients.length,
        recipients,
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
      return res
        .status(404)
        .json({ error: 'Source pack not found', code: 'P10_SOURCE_PACK_NOT_FOUND' });
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
    const {
      target_initiative_id,
      target_type: rawTargetType,
      project_id: bodyProjectId,
    } = req.body as {
      target_initiative_id?: string;
      target_type?: string;
      project_id?: string;
    };
    // D5 — when no existing target is linked, create a REAL canonical entity
    // (initiative | decision | task) from the finding instead of minting an
    // orphan `handoff_req_<uuid>` placeholder that nothing materialized.
    const targetType: 'initiative' | 'decision' | 'task' =
      rawTargetType === 'decision' || rawTargetType === 'task' ? rawTargetType : 'initiative';

    const insight = await getInsightById(insightId);
    if (!insight || insight.organizationId !== organizationId) {
      return res.status(404).json({ error: 'Insight not found' });
    }

    const finding = await getFinding(insightId, findingId);
    if (!finding) {
      return res.status(404).json({ error: 'Finding not found', code: 'P10_FINDING_NOT_FOUND' });
    }
    if (finding.readback_status !== 'confirmed_by_client') {
      return res.status(422).json({
        error: 'Cannot handoff: client readback confirmation is required',
        code: 'P10_READBACK_REQUIRED',
        findingId,
        readbackStatus: finding.readback_status,
      });
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
    let initiativeRef: {
      id: string;
      type: 'linked' | 'created';
      targetType?: 'initiative' | 'decision' | 'task';
      url?: string;
    };
    // #59 — dedup parity with the canonical AI Initiative Wizard (POST
    // /initiatives/similarity-check) and the Tools→Initiatives generator
    // (#68b): before materializing a new initiative from a finding, compare
    // it against the org/project's existing active initiatives. Informational
    // only, same doctrine as the other two callers of checkSimilarInitiatives
    // — never blocks creation, isolated try/catch so a similarity-service
    // outage never fails the handoff.
    let duplicateWarning: {
      verdict: 'duplicate' | 'similar';
      topMatch: { id: string; title: string; status: string; score: number } | null;
    } | null = null;

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
      initiativeRef = { id: target_initiative_id, type: 'linked', targetType: 'initiative' };
    } else {
      // D5 — materialize a real canonical entity from the finding. Title =
      // finding statement; body = limits + next action + evidence summary.
      const title = String(finding.finding_statement || 'Interview finding').slice(0, 200);
      const activeEvidence = finding.evidence_pointers.filter((p) => !p.isTombstone);
      const summary = [
        finding.finding_statement,
        finding.limits ? `\n\nLimits: ${finding.limits}` : '',
        finding.next_action ? `\n\nRecommended next action: ${finding.next_action}` : '',
        activeEvidence.length
          ? `\n\nEvidence (${activeEvidence.length}):\n${activeEvidence
              .slice(0, 8)
              .map((p) => `- ${String(p.capturedExcerpt || p.sourceRef || '').slice(0, 240)}`)
              .join('\n')}`
          : '',
      ]
        .filter(Boolean)
        .join('');
      // SECURITY (cross-org tenant fix — M03 Interview V4): `project_id` comes
      // from the request body and was only shape-checked against a UUID regex.
      // A well-formed UUID says nothing about ownership. The value then reached
      // `decisionService.createDecision` (which stamps the caller's org but
      // trusts projectId as given) and, worse, `TaskService.createTask`, which
      // takes NO organizationId at all — so the created task was tenanted purely
      // by its projectId. A caller passing another org's project id therefore
      // planted a real task inside the victim tenant's project, visible on the
      // victim's board. Verify ownership the same way `target_initiative_id` is
      // verified a few lines above, and the same way DecisionController's
      // `validateCrossEntityRefs` does it.
      const projectIdShapeOk =
        !!bodyProjectId &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bodyProjectId);
      if (projectIdShapeOk) {
        const ownedProject = await queryHelpers.queryOne(
          `SELECT id FROM projects WHERE id = ? AND organization_id = ?`,
          [bodyProjectId, organizationId]
        );
        if (!ownedProject) {
          // 404, not 403: "not yours" must be indistinguishable from "not there".
          return res.status(404).json({
            error: 'Target project not found',
            code: 'P10_TARGET_PROJECT_NOT_FOUND',
          });
        }
      }
      const validProjectId = projectIdShapeOk ? bodyProjectId : null;

      try {
        if (targetType === 'decision') {
          const { default: decisionService } = await import('../../services/decisionService.js');
          const decision = await decisionService.createDecision({
            organizationId,
            projectId: validProjectId || undefined,
            title,
            description: summary,
            type: 'APPROVAL',
            decisionMakerId: userId,
            createdBy: userId,
          });

          // V-A S3 — mirror the initiative branch: tag the decision with its
          // interview-insight source so the Interview hub can surface it. The
          // canonical createDecision INSERT doesn't write source_type/source_id,
          // so set them in a column-aware follow-up UPDATE (the columns are
          // optional — guard on their existence; failure must not break create).
          try {
            const { getTableColumns } = await import('../../utils/dbSchema.js');
            const cols = await getTableColumns('decisions');
            if (cols.has('source_type') && cols.has('source_id')) {
              await queryHelpers.queryRun(
                `UPDATE decisions SET source_type = ?, source_id = ? WHERE id = ?`,
                ['interview_insight', findingId, decision.id]
              );
            }
          } catch (tagErr) {
            logger.warn('[InsightHandoff] source-tag UPDATE skipped', tagErr);
          }

          initiativeRef = {
            id: decision.id,
            type: 'created',
            targetType: 'decision',
            url: `/my-work/decisions/${decision.id}`,
          };
        } else if (targetType === 'task') {
          const { TaskService } = await import('../../services/TaskService.js');
          const { getDatabase } = await import('../../database/index.js');
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const taskService = new TaskService(getDatabase() as any);
          const task = await taskService.createTask(
            {
              projectId: validProjectId,
              title,
              description: summary,
              status: 'todo',
              priority: 'medium',
              tags: ['interview', 'finding'],
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any,
            userId
          );

          // V-A S3 — mirror the initiative branch: tag the task with its
          // interview-insight source so the Interview hub can surface it. The
          // canonical createTask INSERT doesn't write source_type/source_id, so
          // set them in a column-aware follow-up UPDATE (the columns are
          // optional — guard on their existence; failure must not break create).
          try {
            const { getTableColumns } = await import('../../utils/dbSchema.js');
            const cols = await getTableColumns('tasks');
            if (cols.has('source_type') && cols.has('source_id')) {
              await queryHelpers.queryRun(
                `UPDATE tasks SET source_type = ?, source_id = ? WHERE id = ?`,
                ['interview_insight', findingId, task.id]
              );
            }
          } catch (tagErr) {
            logger.warn('[InsightHandoff] source-tag UPDATE skipped', tagErr);
          }

          initiativeRef = {
            id: task.id,
            type: 'created',
            targetType: 'task',
            url: `/my-work?taskId=${encodeURIComponent(task.id)}`,
          };
        } else {
          try {
            const similarity = await checkSimilarInitiatives({
              orgId: organizationId,
              projectId: validProjectId || null,
              candidates: [{ title, description: summary }],
            });
            const r = similarity.results[0];
            if (r && (r.verdict === 'duplicate' || r.verdict === 'similar')) {
              duplicateWarning = {
                verdict: r.verdict,
                topMatch: r.matches[0]
                  ? {
                      id: r.matches[0].id,
                      title: r.matches[0].title,
                      status: r.matches[0].status,
                      score: r.matches[0].score,
                    }
                  : null,
              };
            }
          } catch (similarityError: unknown) {
            logger.warn('[InsightHandoff] similarity-check unavailable (non-blocking):', {
              findingId,
              error:
                similarityError instanceof Error
                  ? similarityError.message
                  : String(similarityError),
            });
          }

          const { default: initiativeService } =
            await import('../../services/initiativeService.js');
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const initiative = await initiativeService.createInitiative({
            organization_id: organizationId,
            project_id: validProjectId || undefined,
            title,
            summary,
            status: 'DRAFT',
            owner_id: userId,
            market_context: `Created from interview finding ${findingId}`,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any);

          // V-A S3 — tag the initiative with its interview-insight source so it
          // appears in the Interview > Initiatives tab (which filters on
          // source_type='interview_insight'). The canonical createInitiative
          // INSERT doesn't write source_type/source_id, so set them in a
          // column-aware follow-up UPDATE (the columns are optional — added by
          // a later migration — so guard on their existence). Without this the
          // handoff created a real-but-untraceable initiative invisible in the
          // tab that's supposed to show it.
          try {
            const { getTableColumns } = await import('../../utils/dbSchema.js');
            const cols = await getTableColumns('initiatives');
            if (cols.has('source_type') && cols.has('source_id')) {
              await queryHelpers.queryRun(
                `UPDATE initiatives SET source_type = ?, source_id = ? WHERE id = ?`,
                ['interview_insight', findingId, initiative.id]
              );
            }
          } catch (tagErr) {
            logger.warn('[InsightHandoff] source-tag UPDATE skipped', tagErr);
          }

          initiativeRef = {
            id: initiative.id,
            type: 'created',
            targetType: 'initiative',
            url: `/my-work?initiativeId=${encodeURIComponent(initiative.id)}`,
          };
        }
      } catch (createErr) {
        logger.error('[InsightHandoff] entity creation failed', createErr);
        return res.status(500).json({
          error: 'Failed to create target entity from finding',
          code: 'P10_HANDOFF_CREATE_FAILED',
        });
      }
    }

    // D5 — record the real target (linked existing OR newly created entity),
    // not an orphan placeholder. The handoff is now 'linked' in both branches
    // because a real row always exists downstream.
    await recordHandoff(insightId, findingId, payload, initiativeRef.id, {
      organizationId,
      actorUserId: userId,
      targetRefType: 'linked',
      status: 'linked',
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
          targetInitiativeId: target_initiative_id || initiativeRef.id,
          initiativeRefType: initiativeRef.type,
          targetEntityType: initiativeRef.targetType || 'initiative',
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
        // #59 — informational duplicate/similar warning against the live
        // portfolio, null when the created target isn't a new initiative or
        // when nothing similar was found.
        duplicateWarning,
      },
      meta: insightsMeta(),
    });
  })
);

// #28e — POST /v8/interview/insights/similarity-check
// Org-scoped + auth. Given a prospective insight (title + optional summary +
// themes), returns whether an existing insight in the org already duplicates /
// closely resembles it. Informational only — never mutates state or blocks the
// insight generator. Mirrors POST /initiatives/similarity-check.
router.post(
  '/insights/similarity-check',
  requirePermission('INTERVIEW_INSIGHTS_VIEW'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const { title, summary, themes } = req.body as {
      title?: string;
      summary?: string;
      themes?: string[];
    };

    const candidateTitle = typeof title === 'string' ? title.trim() : '';
    if (!candidateTitle) {
      return res.status(400).json({
        error: 'title is required',
        code: 'P10_SIMILARITY_TITLE_REQUIRED',
      });
    }

    const candidateText = [
      candidateTitle,
      typeof summary === 'string' ? summary.trim() : '',
      Array.isArray(themes) ? themes.filter((t) => typeof t === 'string').join(' ') : '',
    ]
      .filter(Boolean)
      .join(' ')
      .trim();

    // Load the org's existing insights (title + content snippet). Robust to a
    // missing/odd schema: fall back to title-only on any query error.
    interface ExistingInsightRow {
      id?: string | null;
      title?: string | null;
      content?: string | null;
    }
    let rows: ExistingInsightRow[] = [];
    try {
      rows = await queryHelpers.queryAll<ExistingInsightRow>(
        `SELECT id, title, content
           FROM interview_insights
          WHERE organization_id = ?
            AND COALESCE(status, '') != 'failed'
          ORDER BY updated_at DESC
          LIMIT ?`,
        [organizationId, MAX_EXISTING_INSIGHTS + 1]
      );
    } catch (err) {
      logger.warn('[InsightSimilarity] content-select failed, retrying title-only', err);
      try {
        rows = await queryHelpers.queryAll<ExistingInsightRow>(
          `SELECT id, title FROM interview_insights WHERE organization_id = ? LIMIT ?`,
          [organizationId, MAX_EXISTING_INSIGHTS + 1]
        );
      } catch (err2) {
        logger.warn('[InsightSimilarity] title-only select failed', err2);
        rows = [];
      }
    }

    const existing = rows
      .map((row) => ({
        id: String(row.id || ''),
        title: String(row.title || 'Insight'),
        text: [String(row.title || ''), String(row.content || '').slice(0, 2000)].join(' ').trim(),
      }))
      .filter((item) => item.id && item.text.length > 0);

    const truncated = existing.length > MAX_EXISTING_INSIGHTS;
    const comparison = truncated ? existing.slice(0, MAX_EXISTING_INSIGHTS) : existing;

    // No existing insights → everything is "new" by definition.
    if (comparison.length === 0) {
      return res.json({
        data: {
          verdict: 'new' as SimilarityVerdict,
          topScore: 0,
          matches: [] as Array<{
            id: string;
            title: string;
            score: number;
            verdict: SimilarityVerdict;
          }>,
          method: 'token-overlap' as const,
          comparedCount: 0,
          truncated: false,
        },
        meta: insightsMeta(),
      });
    }

    // Primary: embeddings cosine. Fallback: token Jaccard overlap.
    let method: 'embeddings' | 'token-overlap';
    let scoreFor: (existingIndex: number) => number;

    try {
      const [candidateEmbedding, existingEmbeddings] = await Promise.all([
        insightEmbeddingService.generateEmbedding(candidateText),
        Promise.all(comparison.map((item) => insightEmbeddingService.generateEmbedding(item.text))),
      ]);
      method = 'embeddings';
      scoreFor = (ei) => cosineSimilarity(candidateEmbedding, existingEmbeddings[ei]);
    } catch (embErr) {
      logger.warn(
        '[InsightSimilarity] embeddings unavailable, falling back to token overlap',
        (embErr as Error)?.message
      );
      const candidateTokens = similarityTokenize(candidateText);
      const existingTokens = comparison.map((item) => similarityTokenize(item.text));
      method = 'token-overlap';
      scoreFor = (ei) => jaccardSimilarity(candidateTokens, existingTokens[ei]);
    }

    const matches = comparison
      .map((item, index) => ({
        id: item.id,
        title: item.title,
        score: Number(scoreFor(index).toFixed(4)),
      }))
      .filter((match) => match.score >= SIMILARITY_RELATED_THRESHOLD)
      .sort((a, b) => b.score - a.score)
      .slice(0, SIMILARITY_MAX_MATCHES)
      .map((match) => ({ ...match, verdict: similarityVerdictForScore(match.score) }));

    const topScore = matches.length > 0 ? matches[0].score : 0;

    return res.json({
      data: {
        verdict: similarityVerdictForScore(topScore),
        topScore,
        matches,
        method,
        comparedCount: comparison.length,
        truncated,
      },
      meta: insightsMeta(),
    });
  })
);

export default router;
