/**
 * Knowledge Graph API Routes (V4-ORG-05 through V4-ORG-09)
 *
 * Unified KG: search, traverse, provenance, governance, freshness.
 * All endpoints are permission-aware (org-scoped) and audit-logged.
 */

import { type Response, Router } from 'express';
import { z } from 'zod';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import type {
  ExtractionMethod,
  KGEntityType,
  KGRelationType,
} from '../services/knowledgeGraph/unifiedKGService.js';
import { unifiedKGService } from '../services/knowledgeGraph/unifiedKGService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

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

const router = Router();
router.use(verifyToken);

// ============================================================
// V4-ORG-06: Query API — search entities
// ============================================================

router.get(
  '/entities',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { orgId, userId } = identity;

    const query = req.query.q ? String(req.query.q) : undefined;
    const types = req.query.types
      ? (String(req.query.types).split(',') as KGEntityType[])
      : undefined;
    const minConfidence = req.query.minConfidence ? Number(req.query.minConfidence) : undefined;
    const limit = req.query.limit ? Math.min(Number(req.query.limit), 200) : 50;
    const offset = req.query.offset ? Number(req.query.offset) : 0;

    const entities = await unifiedKGService.searchEntities(orgId, {
      query,
      entityTypes: types,
      minConfidence,
      limit,
      offset,
    });

    await unifiedKGService.logAudit(
      orgId,
      userId,
      'search_entities',
      'entity',
      undefined,
      query,
      entities.length
    );

    res.json({ entities, total: entities.length });
  })
);

// ============================================================
// V4-ORG-06: Get single entity
// ============================================================

router.get(
  '/entities/:entityId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { orgId, userId } = identity;

    const entity = await unifiedKGService.getEntityById(orgId, req.params.entityId);
    if (!entity) {
      res.status(404).json({ error: 'Entity not found' });
      return;
    }

    await unifiedKGService.logAudit(orgId, userId, 'read_entity', 'entity', entity.id);
    res.json(entity);
  })
);

// ============================================================
// V4-ORG-05: Store entity with provenance
// ============================================================

const storeEntitySchema = z.object({
  name: z.string().min(1).max(200),
  type: z.string().min(1) as z.ZodType<KGEntityType>,
  description: z.string().max(2000).optional(),
  attributes: z.record(z.string(), z.unknown()).optional(),
  confidence: z.number().min(0).max(1).optional(),
  sourceArtifactType: z.string().optional(),
  sourceArtifactId: z.string().optional(),
  extractionMethod: z
    .enum(['pattern', 'llm', 'manual', 'import', 'link_graph'])
    .optional() as z.ZodType<ExtractionMethod | undefined>,
  piiFlag: z.boolean().optional(),
});

router.post(
  '/entities',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { orgId, userId } = identity;

    const parsed = storeEntitySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const entity = await unifiedKGService.storeEntity(orgId, {
      ...parsed.data,
      actorId: userId,
    });

    await unifiedKGService.logAudit(orgId, userId, 'create_entity', 'entity', entity.id);
    res.status(201).json(entity);
  })
);

// ============================================================
// V4-ORG-06: Get relations for entity
// ============================================================

router.get(
  '/entities/:entityId/relations',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { orgId, userId } = identity;

    const direction = (req.query.direction as 'outgoing' | 'incoming' | 'both') || 'both';
    const relationTypes = req.query.relationTypes
      ? (String(req.query.relationTypes).split(',') as KGRelationType[])
      : undefined;
    const limit = req.query.limit ? Math.min(Number(req.query.limit), 200) : 50;

    const relations = await unifiedKGService.getRelationsForEntity(orgId, req.params.entityId, {
      direction,
      relationTypes,
      limit,
    });

    await unifiedKGService.logAudit(
      orgId,
      userId,
      'read_relations',
      'entity',
      req.params.entityId,
      undefined,
      relations.length
    );
    res.json({ relations });
  })
);

// ============================================================
// V4-ORG-05: Store relation with provenance
// ============================================================

const storeRelationSchema = z.object({
  sourceEntityId: z.string().min(1),
  targetEntityId: z.string().min(1),
  relationType: z.string().min(1) as z.ZodType<KGRelationType>,
  attributes: z.record(z.string(), z.unknown()).optional(),
  confidence: z.number().min(0).max(1).optional(),
  weight: z.number().min(0).optional(),
  sourceArtifactType: z.string().optional(),
  sourceArtifactId: z.string().optional(),
  extractionMethod: z
    .enum(['pattern', 'llm', 'manual', 'import', 'link_graph'])
    .optional() as z.ZodType<ExtractionMethod | undefined>,
  validFrom: z.string().optional(),
  validUntil: z.string().optional(),
});

router.post(
  '/relations',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { orgId, userId } = identity;

    const parsed = storeRelationSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const relation = await unifiedKGService.storeRelation(orgId, {
      ...parsed.data,
      actorId: userId,
    });

    await unifiedKGService.logAudit(orgId, userId, 'create_relation', 'relation', relation.id);
    res.status(201).json(relation);
  })
);

// ============================================================
// V4-ORG-06: Graph traversal
// ============================================================

const traverseSchema = z.object({
  startEntityId: z.string().min(1),
  maxDepth: z.number().int().min(1).max(5).optional(),
  relationTypes: z.array(z.string() as z.ZodType<KGRelationType>).optional(),
  minConfidence: z.number().min(0).max(1).optional(),
  direction: z.enum(['outgoing', 'incoming', 'both']).optional(),
  limit: z.number().int().min(1).max(500).optional(),
});

router.post(
  '/traverse',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { orgId, userId } = identity;

    const parsed = traverseSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const result = await unifiedKGService.traverse(orgId, parsed.data);

    await unifiedKGService.logAudit(
      orgId,
      userId,
      'traverse',
      'graph',
      parsed.data.startEntityId,
      undefined,
      result.entities.length
    );
    res.json(result);
  })
);

// ============================================================
// V4-ORG-07: Provenance — "why" explainer
// ============================================================

router.get(
  '/entities/:entityId/provenance',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { orgId, userId } = identity;

    const provenance = await unifiedKGService.getProvenance(orgId, req.params.entityId);
    if (!provenance) {
      res.status(404).json({ error: 'Entity not found' });
      return;
    }

    await unifiedKGService.logAudit(
      orgId,
      userId,
      'read_provenance',
      'entity',
      req.params.entityId
    );
    res.json(provenance);
  })
);

// ============================================================
// V4-ORG-08: Governance — redact entity
// ============================================================

router.post(
  '/entities/:entityId/redact',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { orgId, userId } = identity;

    const success = await unifiedKGService.redactEntity(orgId, req.params.entityId, userId);
    if (!success) {
      res.status(404).json({ error: 'Entity not found' });
      return;
    }

    res.json({ ok: true });
  })
);

// ============================================================
// V4-ORG-08: Governance — retention policy
// ============================================================

router.post(
  '/governance/retention',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { orgId, userId } = identity;

    const schema = z.object({ retentionDays: z.number().int().min(1) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const result = await unifiedKGService.applyRetentionPolicy(
      orgId,
      parsed.data.retentionDays,
      userId
    );
    res.json(result);
  })
);

// ============================================================
// V4-ORG-08: Governance — audit log
// ============================================================

router.get(
  '/governance/audit',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { orgId } = identity;

    const actorId = req.query.actorId ? String(req.query.actorId) : undefined;
    const action = req.query.action ? String(req.query.action) : undefined;
    const limit = req.query.limit ? Math.min(Number(req.query.limit), 200) : 50;
    const offset = req.query.offset ? Number(req.query.offset) : 0;

    const logs = await unifiedKGService.getAuditLog(orgId, { actorId, action, limit, offset });
    res.json({ logs, total: logs.length });
  })
);

// ============================================================
// V4-ORG-09: Freshness — find duplicates
// ============================================================

router.get(
  '/freshness/duplicates',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { orgId } = identity;

    const duplicates = await unifiedKGService.findDuplicates(orgId);
    res.json({ duplicates });
  })
);

// ============================================================
// V4-ORG-09: Freshness — merge entities
// ============================================================

router.post(
  '/freshness/merge',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { orgId, userId } = identity;

    const schema = z.object({
      keepEntityId: z.string().min(1),
      mergeEntityId: z.string().min(1),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const success = await unifiedKGService.mergeEntities(
      orgId,
      parsed.data.keepEntityId,
      parsed.data.mergeEntityId,
      userId
    );
    if (!success) {
      res.status(404).json({ error: 'One or both entities not found' });
      return;
    }

    res.json({ ok: true });
  })
);

// ============================================================
// V4-ORG-09: Freshness — rebuild (dedup + decay)
// ============================================================

router.post(
  '/freshness/rebuild',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { orgId } = identity;

    const job = await unifiedKGService.startRebuildJob(orgId, 'manual');
    res.json(job);
  })
);

// ============================================================
// V4-ORG-09: Freshness — rebuild jobs history
// ============================================================

router.get(
  '/freshness/jobs',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { orgId } = identity;

    const limit = req.query.limit ? Math.min(Number(req.query.limit), 50) : 10;
    const jobs = await unifiedKGService.getRebuildJobs(orgId, limit);
    res.json({ jobs });
  })
);

// ============================================================
// Stats
// ============================================================

router.get(
  '/stats',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { orgId } = identity;

    const stats = await unifiedKGService.getStats(orgId);
    res.json(stats);
  })
);

export default router;
