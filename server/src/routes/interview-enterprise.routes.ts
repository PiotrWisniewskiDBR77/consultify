/**
 * Interview Enterprise Routes (V4-INTV-01 through V4-INTV-07)
 *
 * Extended interview API: segments, quotas, distribution, evidence audit,
 * diagnostics, findings pipeline, anonymity, company context versioning.
 *
 * Base interview CRUD remains in interview.routes.ts via InterviewController.
 */

import { type Response, Router } from 'express';
import { z } from 'zod';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { demoContextMiddleware } from '../middleware/demoGuard.middleware.js';
import { interviewPublicAnswerRateLimiter } from '../middleware/rateLimiting.middleware.js';
import {
  InterviewDistributionError,
  interviewEnterpriseService,
} from '../services/interviewEnterpriseService.js';
import {
  PUBLIC_ANSWER_STATUS,
  completeDistributionByToken,
  savePublicAnswer,
} from '../services/interviewPublicAnswerService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.get(
  '/public/distributions/:token',
  asyncHandler(async (req, res) => {
    try {
      const invite = await interviewEnterpriseService.resolveActiveDistributionByToken(
        req.params.token
      );
      res.json({
        distributionId: invite.id,
        sessionId: invite.sessionId,
        status: invite.status,
        anonymityMode: invite.anonymityMode,
        expiresAt: invite.expiresAt,
      });
    } catch (error) {
      if (error instanceof InterviewDistributionError) {
        res.status(error.statusCode).json({ error: error.code });
        return;
      }
      throw error;
    }
  })
);

/**
 * Package A — the public WRITE half of the invite flow.
 *
 * These two routes are the only public mutations in this router and they sit
 * here, above `router.use(verifyToken)`, on purpose: the respondent is external
 * and has no account. Everything that would normally come from an authenticated
 * session — tenant, interview session, permission to touch this question — is
 * derived server-side from the invite token, never from the request. A caller
 * cannot name an organization, and cannot reach a question outside the session
 * their invite is bound to.
 *
 * `PublicAnswerSchema` deliberately declares every field the service reads.
 * `validateBody` replaces `req.body` with the parsed result, so a field absent
 * from the schema silently never reaches the handler.
 */
const PublicAnswerSchema = z.object({
  answerText: z.string().max(20_000).optional().nullable(),
  contextNote: z.string().max(5_000).optional().nullable(),
  // Mandatory on the public path — see interviewPublicAnswerService for why an
  // anonymous respondent may not last-write-wins.
  expectedUpdatedAt: z.string().min(1).optional().nullable(),
  idempotencyKey: z.string().min(8).max(200).optional().nullable(),
});

router.post(
  '/public/distributions/:token/answers/:questionId',
  interviewPublicAnswerRateLimiter,
  asyncHandler(async (req, res) => {
    const parsed = PublicAnswerSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: 'INVALID_BODY' });
      return;
    }
    try {
      // Resolving the token also enforces expiry/revocation and flips the
      // invite to 'opened'; a revoked or expired token throws here.
      const distribution = await interviewEnterpriseService.resolveActiveDistributionByToken(
        req.params.token
      );
      const result = await savePublicAnswer({
        distributionId: distribution.id,
        questionId: req.params.questionId,
        answerText: parsed.data.answerText ?? null,
        contextNote: parsed.data.contextNote ?? null,
        expectedUpdatedAt: parsed.data.expectedUpdatedAt ?? null,
        idempotencyKey: parsed.data.idempotencyKey ?? '',
      });
      if (!result.ok) {
        res.status(PUBLIC_ANSWER_STATUS[result.code]).json({ error: result.code });
        return;
      }
      // The response carries the new CAS token and nothing else — no tenant id,
      // no respondent identity, no session internals.
      res.status(200).json({ updatedAt: result.updatedAt, replayed: result.replayed });
    } catch (error) {
      if (error instanceof InterviewDistributionError) {
        res.status(error.statusCode).json({ error: error.code });
        return;
      }
      throw error;
    }
  })
);

router.post(
  '/public/distributions/:token/complete',
  interviewPublicAnswerRateLimiter,
  asyncHandler(async (req, res) => {
    try {
      const distribution = await interviewEnterpriseService.resolveActiveDistributionByToken(
        req.params.token
      );
      const result = await completeDistributionByToken(distribution.id);
      res.status(200).json({ completed: result.completed, alreadyComplete: result.alreadyComplete });
    } catch (error) {
      if (error instanceof InterviewDistributionError) {
        res.status(error.statusCode).json({ error: error.code });
        return;
      }
      throw error;
    }
  })
);

router.use(verifyToken);
router.use(demoContextMiddleware);

const requireUser = (req: AuthRequest, res: Response): { userId: string; orgId: string } | null => {
  const userId = req.user?.id || req.userId;
  const orgId =
    req.user?.organizationId ||
    req.organizationId ||
    (req.headers['x-organization-id'] as string) ||
    (req.query.organizationId as string);
  if (!userId || !orgId) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }
  return { userId, orgId };
};

// ============================================================
// V4-INTV-01: Segments + Quotas
// ============================================================

router.post(
  '/sessions/:sessionId/segments',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const schema = z.object({
      segmentName: z.string().min(1).max(200),
      criteria: z.record(z.string(), z.unknown()).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const segment = await interviewEnterpriseService.createSegment(
      identity.orgId,
      req.params.sessionId,
      { ...parsed.data, criteria: parsed.data.criteria || {} }
    );
    res.status(201).json(segment);
  })
);

router.get(
  '/sessions/:sessionId/segments',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const segments = await interviewEnterpriseService.getSegments(
      identity.orgId,
      req.params.sessionId
    );
    res.json({ segments });
  })
);

router.post(
  '/sessions/:sessionId/quotas',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const schema = z.object({
      segmentId: z.string().optional(),
      targetCount: z.number().int().min(1),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const quota = await interviewEnterpriseService.createQuota(
      identity.orgId,
      req.params.sessionId,
      parsed.data
    );
    res.status(201).json(quota);
  })
);

router.get(
  '/sessions/:sessionId/quotas',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const quotas = await interviewEnterpriseService.getQuotas(identity.orgId, req.params.sessionId);
    res.json({ quotas });
  })
);

// ============================================================
// V4-INTV-02: Distribution
// ============================================================

router.post(
  '/sessions/:sessionId/distributions',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const schema = z.object({
      channel: z.enum(['email', 'link', 'webhook']),
      recipientEmail: z.string().email().optional(),
      recipientName: z.string().max(200).optional(),
      anonymityMode: z.enum(['identified', 'anonymous', 'pseudonymous']).optional(),
      expiresAt: z.string().datetime().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const dist = await interviewEnterpriseService.createDistribution(
      identity.orgId,
      req.params.sessionId,
      parsed.data
    );
    res.status(201).json(dist);
  })
);

router.get(
  '/sessions/:sessionId/distributions',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const distributions = await interviewEnterpriseService.getDistributions(
      identity.orgId,
      req.params.sessionId
    );
    res.json({ distributions });
  })
);

router.get(
  '/sessions/:sessionId/distribution-stats',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const stats = await interviewEnterpriseService.getDistributionStats(
      identity.orgId,
      req.params.sessionId
    );
    res.json(stats);
  })
);

router.post(
  '/distributions/:distributionId/send',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const ok = await interviewEnterpriseService.markDistributionSent(
      identity.orgId,
      req.params.distributionId
    );
    if (!ok) {
      res.status(404).json({ error: 'Distribution not found' });
      return;
    }
    res.json({ ok: true });
  })
);

router.post(
  '/distributions/:distributionId/revoke',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const ok = await interviewEnterpriseService.revokeDistribution(
      identity.orgId,
      req.params.distributionId,
      identity.userId
    );
    if (!ok) {
      res.status(404).json({ error: 'Distribution not found or already revoked' });
      return;
    }
    res.json({ ok: true });
  })
);

router.post(
  '/sessions/:sessionId/reminder-schedules',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const schema = z.object({
      reminderType: z.string().optional(),
      sendAfterHours: z.number().int().min(1).optional(),
      maxReminders: z.number().int().min(1).max(10).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const schedule = await interviewEnterpriseService.createReminderSchedule(
      identity.orgId,
      req.params.sessionId,
      parsed.data
    );
    res.status(201).json(schedule);
  })
);

// ============================================================
// V4-INTV-03: Evidence access audit
// ============================================================

router.get(
  '/evidence/:evidenceId/access-log',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const limit = req.query.limit ? Math.min(Number(req.query.limit), 200) : 50;
    const logs = await interviewEnterpriseService.getEvidenceAccessLog(
      identity.orgId,
      req.params.evidenceId,
      limit
    );
    res.json({ logs });
  })
);

// ============================================================
// V4-INTV-04: Diagnostics
// ============================================================

router.post(
  '/sessions/:sessionId/diagnostics',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const schema = z.object({
      snapshotType: z.enum(['themes', 'sentiment', 'trends', 'segments', 'drivers']),
      data: z.record(z.string(), z.unknown()),
      generatedBy: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const snapshot = await interviewEnterpriseService.createDiagnosticsSnapshot(
      identity.orgId,
      req.params.sessionId,
      parsed.data
    );
    res.status(201).json(snapshot);
  })
);

router.get(
  '/sessions/:sessionId/diagnostics',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const snapshotType = req.query.type ? String(req.query.type) : undefined;
    const snapshots = await interviewEnterpriseService.getDiagnosticsSnapshots(
      identity.orgId,
      req.params.sessionId,
      snapshotType
    );
    res.json({ snapshots });
  })
);

// ============================================================
// V4-INTV-05: Findings pipeline
// ============================================================

router.post(
  '/sessions/:sessionId/findings',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const schema = z.object({
      insightId: z.string().optional(),
      findingType: z.enum(['gap', 'strength', 'risk', 'opportunity']),
      title: z.string().min(1).max(500),
      description: z.string().max(5000).optional(),
      severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
      evidenceRefs: z.array(z.string()).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const finding = await interviewEnterpriseService.createFinding(
      identity.orgId,
      req.params.sessionId,
      parsed.data
    );
    res.status(201).json(finding);
  })
);

router.get(
  '/sessions/:sessionId/findings',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const status = req.query.status ? String(req.query.status) : undefined;
    const findings = await interviewEnterpriseService.getFindings(
      identity.orgId,
      req.params.sessionId,
      status
    );
    res.json({ findings });
  })
);

router.post(
  '/findings/:findingId/promote',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const schema = z.object({ initiativeId: z.string().min(1) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const ok = await interviewEnterpriseService.promoteFindingToInitiative(
      identity.orgId,
      req.params.findingId,
      parsed.data.initiativeId
    );
    if (!ok) {
      res.status(404).json({ error: 'Finding not found' });
      return;
    }
    res.json({ ok: true });
  })
);

router.patch(
  '/findings/:findingId/status',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const schema = z.object({
      status: z.enum(['identified', 'recommended', 'initiative_created', 'dismissed']),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const ok = await interviewEnterpriseService.updateFindingStatus(
      identity.orgId,
      req.params.findingId,
      parsed.data.status
    );
    if (!ok) {
      res.status(404).json({ error: 'Finding not found' });
      return;
    }
    res.json({ ok: true });
  })
);

// ============================================================
// V4-INTV-06: Anonymity — cohort check + export gating
// ============================================================

router.get(
  '/sessions/:sessionId/cohort-check',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const segmentId = req.query.segmentId ? String(req.query.segmentId) : undefined;
    const result = await interviewEnterpriseService.checkCohortSize(
      identity.orgId,
      req.params.sessionId,
      segmentId
    );
    res.json(result);
  })
);

router.get(
  '/sessions/:sessionId/export-gating',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const result = await interviewEnterpriseService.checkExportGating(
      identity.orgId,
      req.params.sessionId
    );
    res.json(result);
  })
);

// ============================================================
// V4-INTV-07: Company context versions
// ============================================================

router.post(
  '/context/versions',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const schema = z.object({
      contextData: z.record(z.string(), z.unknown()),
      confidenceScores: z.record(z.string(), z.number()).optional(),
      sourceCitations: z
        .array(
          z.object({
            sessionId: z.string(),
            questionId: z.string().optional(),
            snippet: z.string(),
          })
        )
        .optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const version = await interviewEnterpriseService.createContextVersion(
      identity.orgId,
      identity.userId,
      parsed.data
    );
    res.status(201).json(version);
  })
);

router.get(
  '/context/versions',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const limit = req.query.limit ? Math.min(Number(req.query.limit), 50) : 20;
    const versions = await interviewEnterpriseService.getContextVersions(identity.orgId, limit);
    res.json({ versions });
  })
);

router.get(
  '/context/versions/:version',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const version = await interviewEnterpriseService.getContextVersion(
      identity.orgId,
      Number(req.params.version)
    );
    if (!version) {
      res.status(404).json({ error: 'Version not found' });
      return;
    }
    res.json(version);
  })
);

router.post(
  '/context/versions/:versionId/sign-off',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const ok = await interviewEnterpriseService.signOffContextVersion(
      identity.orgId,
      req.params.versionId,
      identity.userId
    );
    if (!ok) {
      res.status(404).json({ error: 'Version not found' });
      return;
    }
    res.json({ ok: true });
  })
);

router.get(
  '/context/versions/:fromVersion/diff/:toVersion',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const diff = await interviewEnterpriseService.diffContextVersions(
      identity.orgId,
      Number(req.params.fromVersion),
      Number(req.params.toVersion)
    );
    res.json(diff);
  })
);

export default router;
