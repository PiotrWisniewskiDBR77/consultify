/**
 * Evidence Layer routes — H1 Harvey-gap, kontrakt nr 1.
 * SSOT: Harvard/wdrozenie-100/_KONCEPT_RDZEN_2026-07-10.md §3.
 *
 * GET  /api/evidence/:artifactType/:artifactId          → EvidenceEnvelope | null
 * PUT  /api/evidence/:artifactType/:artifactId           → upsert pełnego envelope
 * POST /api/evidence/:artifactType/:artifactId/sources   → dopisz jedno źródło
 *
 * Org-scoped: envelope zawsze czytany/pisany w organizacji z tokena
 * (req.organizationId). RES-011 (2026-08-03): PUT/POST used to reach the
 * evidence service's `getEnvelope`/`upsertEnvelope` with NO organization
 * filter at all — a caller from org B could silently overwrite (and, via the
 * merge-forward of omitted fields, partially read back) org A's evidence
 * envelope just by guessing/observing a KPI id. `evidenceEnvelopeService.ts`
 * now enforces the org scope itself (getEnvelope takes organizationId,
 * upsertEnvelope throws EvidenceEnvelopeForeignOrgError on a cross-org
 * collision) — this file's job is only to map that error to 404, the same
 * "don't confirm a foreign-org artifact exists" convention used elsewhere.
 */
import type { Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';

import type { AuthRequest } from '../middleware/auth.middleware.js';
import { verifyToken } from '../middleware/auth.middleware.js';
import type { EvidenceArtifactType } from '../services/evidence/evidenceEnvelopeService.js';
import evidenceEnvelopeService, {
  EvidenceEnvelopeForeignOrgError,
} from '../services/evidence/evidenceEnvelopeService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.use(verifyToken);

const ARTIFACT_TYPES = [
  'insight',
  'initiative',
  'task',
  'decision',
  'report',
  'deck',
  'document',
  'kpi',
  'finance_number',
  'benefit',
  'canvas',
  'project',
  'source',
  'assessment',
  'other',
] as const;

const ArtifactTypeSchema = z.enum(ARTIFACT_TYPES);

const EvidenceSourceSchema = z.object({
  type: z.enum([
    'interview',
    'document',
    'kb',
    'statement_pack',
    'kpi_series',
    'insight',
    'tool_session',
    'snapshot',
    'benchmark',
  ]),
  ref: z.string().min(1),
  snippet: z.string().max(2000).optional(),
  url: z.string().max(2000).optional(),
});

const EvidenceAssumptionSchema = z.object({
  key: z.string().min(1),
  value: z.unknown(),
  source_type: z.enum(['imported', 'user', 'teresa', 'ai_assumed', 'benchmark']),
  rationale: z.string().max(2000).optional(),
  confidence: z.number().min(0).max(1).optional(),
});

const EvidenceToVerifySchema = z.object({
  claim: z.string().min(1),
  why: z.string().min(1),
  suggested_check: z.string().max(2000).optional(),
});

const UpsertEnvelopeBodySchema = z.object({
  sources: z.array(EvidenceSourceSchema).optional(),
  assumptions: z.array(EvidenceAssumptionSchema).optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
  toVerify: z.array(EvidenceToVerifySchema).optional(),
  computedBy: z
    .object({ service: z.string(), version: z.string().optional(), at: z.string() })
    .nullable()
    .optional(),
});

const AttachSourceBodySchema = z.object({
  source: EvidenceSourceSchema,
});

function parseParams(
  req: AuthRequest,
  res: Response
): { artifactType: EvidenceArtifactType; artifactId: string; orgId: string } | null {
  const orgId = req.organizationId;
  if (!orgId) {
    res.status(401).json({ error: 'Missing organization context' });
    return null;
  }
  const typeResult = ArtifactTypeSchema.safeParse(req.params.artifactType);
  if (!typeResult.success) {
    res.status(400).json({ error: `Unknown artifactType: ${req.params.artifactType}` });
    return null;
  }
  const artifactId = req.params.artifactId;
  if (!artifactId) {
    res.status(400).json({ error: 'Missing artifactId' });
    return null;
  }
  return { artifactType: typeResult.data, artifactId, orgId };
}

/**
 * GET /api/evidence/:artifactType/:artifactId
 * Zwraca envelope lub `{ envelope: null }` gdy artefakt jeszcze go nie ma
 * (brak envelope = stan prawidłowy, NIE 404 — artefakty sprzed Warstwy
 * Dowodowej i artefakty poza bramą F14 nie mają jeszcze wpisu).
 */
router.get(
  '/:artifactType/:artifactId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const parsed = parseParams(req, res);
    if (!parsed) return;
    const envelope = await evidenceEnvelopeService.getEnvelope(
      parsed.artifactType,
      parsed.artifactId,
      parsed.orgId
    );
    // getEnvelope is now org-scoped at the query level (RES-011) — this
    // re-check is redundant defense-in-depth, not the primary guard.
    if (envelope && envelope.organizationId !== parsed.orgId) {
      res.status(404).json({ envelope: null });
      return;
    }
    res.json({ envelope });
  })
);

/**
 * PUT /api/evidence/:artifactType/:artifactId
 * Upsert pełnego envelope. Pola pominięte w body zachowują poprzednią
 * wartość (patrz evidenceEnvelopeService.upsertEnvelope).
 */
router.put(
  '/:artifactType/:artifactId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const parsed = parseParams(req, res);
    if (!parsed) return;
    const bodyResult = UpsertEnvelopeBodySchema.safeParse(req.body);
    if (!bodyResult.success) {
      res.status(400).json({ error: 'Invalid envelope body', details: bodyResult.error.flatten() });
      return;
    }
    let envelope;
    try {
      envelope = await evidenceEnvelopeService.upsertEnvelope({
        organizationId: parsed.orgId,
        artifactType: parsed.artifactType,
        artifactId: parsed.artifactId,
        sources: bodyResult.data.sources,
        assumptions: bodyResult.data.assumptions,
        confidence: bodyResult.data.confidence,
        toVerify: bodyResult.data.toVerify,
        computedBy: bodyResult.data.computedBy,
        createdBy: req.userId ?? null,
      });
    } catch (error) {
      if (error instanceof EvidenceEnvelopeForeignOrgError) {
        res.status(404).json({ error: 'Artifact not found' });
        return;
      }
      throw error;
    }
    res.json({ envelope });
  })
);

/**
 * POST /api/evidence/:artifactType/:artifactId/sources
 * Dopisuje jedno źródło (append), tworzy envelope jeśli brak.
 */
router.post(
  '/:artifactType/:artifactId/sources',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const parsed = parseParams(req, res);
    if (!parsed) return;
    const bodyResult = AttachSourceBodySchema.safeParse(req.body);
    if (!bodyResult.success) {
      res.status(400).json({ error: 'Invalid source body', details: bodyResult.error.flatten() });
      return;
    }
    let envelope;
    try {
      envelope = await evidenceEnvelopeService.attachSource({
        organizationId: parsed.orgId,
        artifactType: parsed.artifactType,
        artifactId: parsed.artifactId,
        source: bodyResult.data.source,
        createdBy: req.userId ?? null,
      });
    } catch (error) {
      if (error instanceof EvidenceEnvelopeForeignOrgError) {
        res.status(404).json({ error: 'Artifact not found' });
        return;
      }
      throw error;
    }
    res.json({ envelope });
  })
);

export default router;
