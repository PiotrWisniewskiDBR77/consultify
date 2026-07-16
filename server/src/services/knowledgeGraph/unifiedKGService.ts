/**
 * Unified Knowledge Graph Service (V4-ORG-05 through V4-ORG-09)
 *
 * Bridges LinkGraph (artifact-level refs) with KG (extracted entities/relations)
 * into a single queryable, governed, permission-aware graph.
 *
 * V4-ORG-05: Unified schema — typed nodes/edges, provenance
 * V4-ORG-06: Query API — traversal, search, permission-aware
 * V4-ORG-07: Provenance — source artifacts, actor, confidence, "why" explainers
 * V4-ORG-08: Governance — permission-aware edges, PII redaction, audit
 * V4-ORG-09: Freshness — dedup/merge, confidence decay, rebuild jobs
 */

import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../../database/Database.js';
import type { IDatabase } from '../../database/IDatabase.js';
import logger from '../../utils/Logger.js';

// ============================================================
// Types
// ============================================================

export type KGEntityType =
  | 'person'
  | 'project'
  | 'initiative'
  | 'technology'
  | 'vendor'
  | 'metric'
  | 'risk'
  | 'decision'
  | 'goal'
  | 'department'
  | 'process'
  | 'organization'
  | 'skill'
  | 'regulation'
  | 'artifact';

export type KGRelationType =
  | 'responsible_for'
  | 'depends_on'
  | 'part_of'
  | 'decided_on'
  | 'uses'
  | 'risks'
  | 'measured_by'
  | 'blocked_by'
  | 'reports_to'
  | 'provides'
  | 'conflicts_with'
  | 'replaces'
  | 'created_from'
  | 'ref'
  | 'implements'
  | 'mitigates'
  | 'owns'
  | 'contributes_to';

export type ExtractionMethod = 'pattern' | 'llm' | 'manual' | 'import' | 'link_graph';

export interface KGEntity {
  id: string;
  organizationId: string;
  name: string;
  canonicalName: string | null;
  type: KGEntityType;
  description: string | null;
  attributes: Record<string, unknown>;
  confidence: number;
  sourceArtifactType: string | null;
  sourceArtifactId: string | null;
  actorId: string | null;
  extractionMethod: ExtractionMethod;
  piiFlag: boolean;
  redacted: boolean;
  mergedIntoId: string | null;
  mentions: number;
  firstSeen: string;
  lastSeen: string;
}

export interface KGRelation {
  id: string;
  organizationId: string;
  sourceEntityId: string;
  targetEntityId: string;
  relationType: KGRelationType;
  attributes: Record<string, unknown>;
  confidence: number;
  weight: number;
  sourceArtifactType: string | null;
  sourceArtifactId: string | null;
  actorId: string | null;
  extractionMethod: ExtractionMethod;
  validFrom: string | null;
  validUntil: string | null;
  createdAt: string;
}

export interface KGTraversalResult {
  entities: KGEntity[];
  relations: KGRelation[];
  paths: Array<{ entityIds: string[]; relationIds: string[] }>;
}

export interface KGSearchOptions {
  query?: string;
  entityTypes?: KGEntityType[];
  minConfidence?: number;
  includeRedacted?: boolean;
  includeMerged?: boolean;
  limit?: number;
  offset?: number;
}

export interface KGTraversalOptions {
  startEntityId: string;
  maxDepth?: number;
  relationTypes?: KGRelationType[];
  minConfidence?: number;
  direction?: 'outgoing' | 'incoming' | 'both';
  limit?: number;
}

export interface KGProvenanceInfo {
  entityId: string;
  entityName: string;
  sourceArtifacts: Array<{
    type: string;
    id: string;
    extractionMethod: ExtractionMethod;
    confidence: number;
    actorId: string | null;
    timestamp: string;
  }>;
  relatedRelations: Array<{
    relationType: KGRelationType;
    otherEntityName: string;
    confidence: number;
    sourceArtifactType: string | null;
  }>;
  whyExplainer: string;
}

export interface KGRebuildJob {
  id: string;
  organizationId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  triggerType: 'manual' | 'scheduled' | 'event';
  entitiesProcessed: number;
  relationsProcessed: number;
  duplicatesMerged: number;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
}

// ============================================================
// Service
// ============================================================

class UnifiedKGService {
  private db: IDatabase | null = null;

  private async getDb(): Promise<IDatabase> {
    if (!this.db) {
      this.db = await getDatabase();
    }
    return this.db;
  }

  // ──────────────────────────────────────────────
  // V4-ORG-05: Unified schema — store with provenance
  // ──────────────────────────────────────────────

  async storeEntity(
    orgId: string,
    entity: {
      name: string;
      type: KGEntityType;
      description?: string;
      attributes?: Record<string, unknown>;
      confidence?: number;
      sourceArtifactType?: string;
      sourceArtifactId?: string;
      actorId?: string;
      extractionMethod?: ExtractionMethod;
      piiFlag?: boolean;
    }
  ): Promise<KGEntity> {
    const db = await this.getDb();
    const now = new Date().toISOString();
    const canonicalName = entity.name.toLowerCase().trim();

    const existing = (await db.get(
      `SELECT id, mentions FROM knowledge_graph_entities
       WHERE organization_id = ? AND LOWER(name) = ? AND type = ? AND (merged_into_id IS NULL)`,
      [orgId, canonicalName, entity.type]
    )) as any;

    if (existing) {
      await db.run(
        `UPDATE knowledge_graph_entities
         SET mentions = mentions + 1, last_seen = ?,
             confidence = MAX(confidence, ?),
             source_artifact_type = COALESCE(?, source_artifact_type),
             source_artifact_id = COALESCE(?, source_artifact_id),
             actor_id = COALESCE(?, actor_id),
             description = COALESCE(?, description),
             attributes = ?
         WHERE id = ?`,
        [
          now,
          entity.confidence ?? 0.7,
          entity.sourceArtifactType ?? null,
          entity.sourceArtifactId ?? null,
          entity.actorId ?? null,
          entity.description ?? null,
          JSON.stringify(entity.attributes || {}),
          existing.id,
        ]
      );
      return this.getEntityById(orgId, existing.id) as Promise<KGEntity>;
    }

    const id = uuidv4();
    await db.run(
      `INSERT INTO knowledge_graph_entities
       (id, organization_id, name, canonical_name, type, description, attributes,
        confidence, source_artifact_type, source_artifact_id, actor_id,
        extraction_method, pii_flag, first_seen, last_seen, mentions)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        id,
        orgId,
        entity.name,
        canonicalName,
        entity.type,
        entity.description ?? null,
        JSON.stringify(entity.attributes || {}),
        entity.confidence ?? 0.7,
        entity.sourceArtifactType ?? null,
        entity.sourceArtifactId ?? null,
        entity.actorId ?? null,
        entity.extractionMethod ?? 'pattern',
        entity.piiFlag ? 1 : 0,
        now,
        now,
      ]
    );

    return this.getEntityById(orgId, id) as Promise<KGEntity>;
  }

  async storeRelation(
    orgId: string,
    relation: {
      sourceEntityId: string;
      targetEntityId: string;
      relationType: KGRelationType;
      attributes?: Record<string, unknown>;
      confidence?: number;
      weight?: number;
      sourceArtifactType?: string;
      sourceArtifactId?: string;
      actorId?: string;
      extractionMethod?: ExtractionMethod;
      validFrom?: string;
      validUntil?: string;
    }
  ): Promise<KGRelation> {
    const db = await this.getDb();
    const id = uuidv4();
    const now = new Date().toISOString();

    await db.run(
      `INSERT INTO knowledge_graph_relations
       (id, organization_id, source_entity_id, target_entity_id, relation_type,
        attributes, confidence, weight, source_artifact_type, source_artifact_id,
        actor_id, extraction_method, valid_from, valid_until, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        orgId,
        relation.sourceEntityId,
        relation.targetEntityId,
        relation.relationType,
        JSON.stringify(relation.attributes || {}),
        relation.confidence ?? 0.7,
        relation.weight ?? 1.0,
        relation.sourceArtifactType ?? null,
        relation.sourceArtifactId ?? null,
        relation.actorId ?? null,
        relation.extractionMethod ?? 'pattern',
        relation.validFrom ?? null,
        relation.validUntil ?? null,
        now,
      ]
    );

    return {
      id,
      organizationId: orgId,
      sourceEntityId: relation.sourceEntityId,
      targetEntityId: relation.targetEntityId,
      relationType: relation.relationType,
      attributes: relation.attributes || {},
      confidence: relation.confidence ?? 0.7,
      weight: relation.weight ?? 1.0,
      sourceArtifactType: relation.sourceArtifactType ?? null,
      sourceArtifactId: relation.sourceArtifactId ?? null,
      actorId: relation.actorId ?? null,
      extractionMethod: relation.extractionMethod ?? 'pattern',
      validFrom: relation.validFrom ?? null,
      validUntil: relation.validUntil ?? null,
      createdAt: now,
    };
  }

  // ──────────────────────────────────────────────
  // V4-ORG-06: Query API — search + traversal
  // ──────────────────────────────────────────────

  async searchEntities(orgId: string, options: KGSearchOptions = {}): Promise<KGEntity[]> {
    const db = await this.getDb();
    const conditions = ['e.organization_id = ?'];
    const params: unknown[] = [orgId];

    if (!options.includeMerged) {
      conditions.push('e.merged_into_id IS NULL');
    }
    if (!options.includeRedacted) {
      conditions.push('(e.redacted = FALSE OR e.redacted IS NULL)');
    }
    if (options.query) {
      conditions.push('(LOWER(e.name) LIKE ? OR LOWER(e.description) LIKE ?)');
      const q = `%${options.query.toLowerCase()}%`;
      params.push(q, q);
    }
    if (options.entityTypes && options.entityTypes.length > 0) {
      const placeholders = options.entityTypes.map(() => '?').join(',');
      conditions.push(`e.type IN (${placeholders})`);
      params.push(...options.entityTypes);
    }
    if (options.minConfidence) {
      conditions.push('e.confidence >= ?');
      params.push(options.minConfidence);
    }

    const limit = Math.min(options.limit || 50, 200);
    const offset = options.offset || 0;
    params.push(limit, offset);

    const rows =
      (await db.all(
        `SELECT * FROM knowledge_graph_entities e
       WHERE ${conditions.join(' AND ')}
       ORDER BY e.mentions DESC, e.confidence DESC, e.last_seen DESC
       LIMIT ? OFFSET ?`,
        params
      )) || [];

    return rows.map(mapEntityRow);
  }

  async getEntityById(orgId: string, entityId: string): Promise<KGEntity | null> {
    const db = await this.getDb();
    const row = await db.get(
      `SELECT * FROM knowledge_graph_entities WHERE id = ? AND organization_id = ?`,
      [entityId, orgId]
    );
    return row ? mapEntityRow(row) : null;
  }

  async getRelationsForEntity(
    orgId: string,
    entityId: string,
    options?: {
      direction?: 'outgoing' | 'incoming' | 'both';
      relationTypes?: KGRelationType[];
      limit?: number;
    }
  ): Promise<KGRelation[]> {
    const db = await this.getDb();
    const conditions = ['r.organization_id = ?'];
    const params: unknown[] = [orgId];

    const dir = options?.direction || 'both';
    if (dir === 'outgoing') {
      conditions.push('r.source_entity_id = ?');
      params.push(entityId);
    } else if (dir === 'incoming') {
      conditions.push('r.target_entity_id = ?');
      params.push(entityId);
    } else {
      conditions.push('(r.source_entity_id = ? OR r.target_entity_id = ?)');
      params.push(entityId, entityId);
    }

    if (options?.relationTypes && options.relationTypes.length > 0) {
      const placeholders = options.relationTypes.map(() => '?').join(',');
      conditions.push(`r.relation_type IN (${placeholders})`);
      params.push(...options.relationTypes);
    }

    const limit = Math.min(options?.limit || 50, 200);
    params.push(limit);

    const rows =
      (await db.all(
        `SELECT * FROM knowledge_graph_relations r
       WHERE ${conditions.join(' AND ')}
       ORDER BY r.confidence DESC, r.weight DESC, r.created_at DESC
       LIMIT ?`,
        params
      )) || [];

    return rows.map(mapRelationRow);
  }

  async traverse(orgId: string, options: KGTraversalOptions): Promise<KGTraversalResult> {
    const maxDepth = Math.min(options.maxDepth || 2, 5);
    const minConfidence = options.minConfidence || 0;
    const limit = Math.min(options.limit || 100, 500);

    const visitedEntities = new Set<string>();
    const allEntities: KGEntity[] = [];
    const allRelations: KGRelation[] = [];
    const paths: Array<{ entityIds: string[]; relationIds: string[] }> = [];

    const queue: Array<{ entityId: string; depth: number; path: string[]; relPath: string[] }> = [
      { entityId: options.startEntityId, depth: 0, path: [options.startEntityId], relPath: [] },
    ];

    while (queue.length > 0 && allEntities.length < limit) {
      const current = queue.shift()!;
      if (visitedEntities.has(current.entityId)) continue;
      visitedEntities.add(current.entityId);

      const entity = await this.getEntityById(orgId, current.entityId);
      if (!entity || entity.confidence < minConfidence) continue;
      allEntities.push(entity);

      if (current.depth > 0) {
        paths.push({ entityIds: current.path, relationIds: current.relPath });
      }

      if (current.depth >= maxDepth) continue;

      const relations = await this.getRelationsForEntity(orgId, current.entityId, {
        direction: options.direction,
        relationTypes: options.relationTypes,
        limit: 20,
      });

      for (const rel of relations) {
        if (rel.confidence < minConfidence) continue;
        allRelations.push(rel);
        const nextId =
          rel.sourceEntityId === current.entityId ? rel.targetEntityId : rel.sourceEntityId;
        if (!visitedEntities.has(nextId)) {
          queue.push({
            entityId: nextId,
            depth: current.depth + 1,
            path: [...current.path, nextId],
            relPath: [...current.relPath, rel.id],
          });
        }
      }
    }

    return { entities: allEntities, relations: allRelations, paths };
  }

  // ──────────────────────────────────────────────
  // V4-ORG-07: Provenance — "why" explainers
  // ──────────────────────────────────────────────

  async getProvenance(orgId: string, entityId: string): Promise<KGProvenanceInfo | null> {
    const entity = await this.getEntityById(orgId, entityId);
    if (!entity) return null;

    const db = await this.getDb();

    const sourceArtifacts: KGProvenanceInfo['sourceArtifacts'] = [];
    if (entity.sourceArtifactType && entity.sourceArtifactId) {
      sourceArtifacts.push({
        type: entity.sourceArtifactType,
        id: entity.sourceArtifactId,
        extractionMethod: entity.extractionMethod,
        confidence: entity.confidence,
        actorId: entity.actorId,
        timestamp: entity.firstSeen,
      });
    }

    const sameNameRows =
      (await db.all(
        `SELECT source_artifact_type, source_artifact_id, extraction_method, confidence, actor_id, first_seen
       FROM knowledge_graph_entities
       WHERE organization_id = ? AND canonical_name = ? AND id != ? AND merged_into_id = ?`,
        [orgId, entity.canonicalName, entityId, entityId]
      )) || [];

    for (const r of sameNameRows as any[]) {
      if (r.source_artifact_type) {
        sourceArtifacts.push({
          type: r.source_artifact_type,
          id: r.source_artifact_id,
          extractionMethod: r.extraction_method || 'pattern',
          confidence: r.confidence || 0.7,
          actorId: r.actor_id,
          timestamp: r.first_seen,
        });
      }
    }

    const relations = await this.getRelationsForEntity(orgId, entityId, { limit: 20 });
    const relatedRelations: KGProvenanceInfo['relatedRelations'] = [];

    for (const rel of relations) {
      const otherId = rel.sourceEntityId === entityId ? rel.targetEntityId : rel.sourceEntityId;
      const otherEntity = await this.getEntityById(orgId, otherId);
      relatedRelations.push({
        relationType: rel.relationType,
        otherEntityName: otherEntity?.name || otherId,
        confidence: rel.confidence,
        sourceArtifactType: rel.sourceArtifactType,
      });
    }

    const whyParts: string[] = [];
    whyParts.push(
      `"${entity.name}" (${entity.type}) was first seen on ${entity.firstSeen.slice(0, 10)} ` +
        `and has been mentioned ${entity.mentions} time(s).`
    );
    if (sourceArtifacts.length > 0) {
      const sources = sourceArtifacts
        .map((s) => `${s.type}:${s.id} (${s.extractionMethod})`)
        .join(', ');
      whyParts.push(`Extracted from: ${sources}.`);
    }
    if (relatedRelations.length > 0) {
      const rels = relatedRelations
        .slice(0, 5)
        .map((r) => `${r.relationType} → ${r.otherEntityName}`)
        .join('; ');
      whyParts.push(`Key relationships: ${rels}.`);
    }
    whyParts.push(`Confidence: ${(entity.confidence * 100).toFixed(0)}%.`);

    return {
      entityId,
      entityName: entity.name,
      sourceArtifacts,
      relatedRelations,
      whyExplainer: whyParts.join(' '),
    };
  }

  // ──────────────────────────────────────────────
  // V4-ORG-08: Governance — audit, PII redaction
  // ──────────────────────────────────────────────

  async logAudit(
    orgId: string,
    actorId: string,
    action: string,
    resourceType: string,
    resourceId?: string,
    queryText?: string,
    resultCount?: number,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const db = await this.getDb();
    try {
      await db.run(
        `INSERT INTO kg_audit_log (id, organization_id, actor_id, action, resource_type, resource_id, query_text, result_count, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          orgId,
          actorId,
          action,
          resourceType,
          resourceId ?? null,
          queryText ?? null,
          resultCount ?? null,
          JSON.stringify(metadata || {}),
        ]
      );
    } catch (err: any) {
      logger.debug(`[UnifiedKG] Audit log error: ${err.message}`);
    }
  }

  async getAuditLog(
    orgId: string,
    options?: { actorId?: string; action?: string; limit?: number; offset?: number }
  ): Promise<
    Array<{
      id: string;
      actorId: string;
      action: string;
      resourceType: string;
      resourceId: string | null;
      queryText: string | null;
      resultCount: number | null;
      createdAt: string;
    }>
  > {
    const db = await this.getDb();
    const conditions = ['organization_id = ?'];
    const params: unknown[] = [orgId];

    if (options?.actorId) {
      conditions.push('actor_id = ?');
      params.push(options.actorId);
    }
    if (options?.action) {
      conditions.push('action = ?');
      params.push(options.action);
    }

    const limit = Math.min(options?.limit || 50, 200);
    const offset = options?.offset || 0;
    params.push(limit, offset);

    const rows =
      (await db.all(
        `SELECT * FROM kg_audit_log WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        params
      )) || [];

    return rows.map((r: any) => ({
      id: r.id,
      actorId: r.actor_id,
      action: r.action,
      resourceType: r.resource_type,
      resourceId: r.resource_id,
      queryText: r.query_text,
      resultCount: r.result_count,
      createdAt: r.created_at,
    }));
  }

  async redactEntity(orgId: string, entityId: string, actorId: string): Promise<boolean> {
    const db = await this.getDb();
    const result = await db.run(
      `UPDATE knowledge_graph_entities
       SET redacted = 1, name = '[REDACTED]', description = NULL, attributes = '{}'
       WHERE id = ? AND organization_id = ?`,
      [entityId, orgId]
    );
    if (result?.changes) {
      await this.logAudit(orgId, actorId, 'redact_entity', 'entity', entityId);
    }
    return (result?.changes || 0) > 0;
  }

  async applyRetentionPolicy(
    orgId: string,
    retentionDays: number,
    actorId: string
  ): Promise<{ entitiesRemoved: number; relationsRemoved: number }> {
    const db = await this.getDb();
    const cutoff = new Date(Date.now() - retentionDays * 86400000).toISOString();

    const relResult = await db.run(
      `DELETE FROM knowledge_graph_relations WHERE organization_id = ? AND created_at < ?`,
      [orgId, cutoff]
    );
    const entResult = await db.run(
      `DELETE FROM knowledge_graph_entities WHERE organization_id = ? AND last_seen < ? AND mentions <= 1`,
      [orgId, cutoff]
    );

    const entitiesRemoved = entResult?.changes || 0;
    const relationsRemoved = relResult?.changes || 0;

    await this.logAudit(
      orgId,
      actorId,
      'retention_cleanup',
      'kg',
      undefined,
      undefined,
      entitiesRemoved + relationsRemoved,
      {
        retentionDays,
        cutoff,
        entitiesRemoved,
        relationsRemoved,
      }
    );

    return { entitiesRemoved, relationsRemoved };
  }

  // ──────────────────────────────────────────────
  // V4-ORG-09: Freshness — dedup, merge, decay, rebuild
  // ──────────────────────────────────────────────

  async mergeEntities(
    orgId: string,
    keepEntityId: string,
    mergeEntityId: string,
    actorId: string
  ): Promise<boolean> {
    const db = await this.getDb();

    const keep = await this.getEntityById(orgId, keepEntityId);
    const merge = await this.getEntityById(orgId, mergeEntityId);
    if (!keep || !merge) return false;

    await db.run(
      `UPDATE knowledge_graph_relations SET source_entity_id = ? WHERE source_entity_id = ? AND organization_id = ?`,
      [keepEntityId, mergeEntityId, orgId]
    );
    await db.run(
      `UPDATE knowledge_graph_relations SET target_entity_id = ? WHERE target_entity_id = ? AND organization_id = ?`,
      [keepEntityId, mergeEntityId, orgId]
    );

    await db.run(
      `UPDATE knowledge_graph_entities
       SET mentions = mentions + ?, confidence = MAX(confidence, ?), last_seen = MAX(last_seen, ?)
       WHERE id = ? AND organization_id = ?`,
      [merge.mentions, merge.confidence, merge.lastSeen, keepEntityId, orgId]
    );

    await db.run(
      `UPDATE knowledge_graph_entities SET merged_into_id = ? WHERE id = ? AND organization_id = ?`,
      [keepEntityId, mergeEntityId, orgId]
    );

    await this.logAudit(
      orgId,
      actorId,
      'merge_entities',
      'entity',
      keepEntityId,
      undefined,
      undefined,
      {
        mergedEntityId: mergeEntityId,
        mergedEntityName: merge.name,
      }
    );

    return true;
  }

  async findDuplicates(
    orgId: string
  ): Promise<Array<{ canonicalName: string; type: KGEntityType; ids: string[]; names: string[] }>> {
    const db = await this.getDb();
    const rows =
      (await db.all(
        `SELECT canonical_name, type, GROUP_CONCAT(id) as ids, GROUP_CONCAT(name, '|||') as names
       FROM knowledge_graph_entities
       WHERE organization_id = ? AND merged_into_id IS NULL AND (redacted = FALSE OR redacted IS NULL)
       GROUP BY canonical_name, type
       HAVING COUNT(*) > 1
       ORDER BY COUNT(*) DESC
       LIMIT 100`,
        [orgId]
      )) || [];

    return rows.map((r: any) => ({
      canonicalName: r.canonical_name || '',
      type: r.type as KGEntityType,
      ids: (r.ids || '').split(','),
      names: (r.names || '').split('|||'),
    }));
  }

  async applyConfidenceDecay(
    orgId: string,
    decayFactor: number = 0.95,
    staleAfterDays: number = 90
  ): Promise<number> {
    const db = await this.getDb();
    const cutoff = new Date(Date.now() - staleAfterDays * 86400000).toISOString();

    const result = await db.run(
      `UPDATE knowledge_graph_entities
       SET confidence = confidence * ?
       WHERE organization_id = ? AND last_seen < ? AND merged_into_id IS NULL AND confidence > 0.1`,
      [decayFactor, orgId, cutoff]
    );

    return result?.changes || 0;
  }

  async startRebuildJob(
    orgId: string,
    triggerType: 'manual' | 'scheduled' | 'event' = 'manual'
  ): Promise<KGRebuildJob> {
    const db = await this.getDb();
    const id = uuidv4();
    const now = new Date().toISOString();

    await db.run(
      `INSERT INTO kg_rebuild_jobs (id, organization_id, status, trigger_type, started_at, created_at)
       VALUES (?, ?, 'running', ?, ?, ?)`,
      [id, orgId, triggerType, now, now]
    );

    let entitiesProcessed = 0;
    const relationsProcessed = 0;
    let duplicatesMerged = 0;

    try {
      const decayed = await this.applyConfidenceDecay(orgId);
      entitiesProcessed += decayed;

      const duplicates = await this.findDuplicates(orgId);
      for (const dup of duplicates) {
        if (dup.ids.length >= 2) {
          const [keepId, ...mergeIds] = dup.ids;
          for (const mergeId of mergeIds) {
            await this.mergeEntities(orgId, keepId, mergeId, 'system');
            duplicatesMerged++;
          }
        }
      }

      const completedAt = new Date().toISOString();
      await db.run(
        `UPDATE kg_rebuild_jobs
         SET status = 'completed', entities_processed = ?, relations_processed = ?,
             duplicates_merged = ?, completed_at = ?
         WHERE id = ?`,
        [entitiesProcessed, relationsProcessed, duplicatesMerged, completedAt, id]
      );

      return {
        id,
        organizationId: orgId,
        status: 'completed',
        triggerType,
        entitiesProcessed,
        relationsProcessed,
        duplicatesMerged,
        startedAt: now,
        completedAt,
        errorMessage: null,
        createdAt: now,
      };
    } catch (err: any) {
      await db.run(
        `UPDATE kg_rebuild_jobs SET status = 'failed', error_message = ?, completed_at = ? WHERE id = ?`,
        [err.message, new Date().toISOString(), id]
      );
      throw err;
    }
  }

  async getRebuildJobs(orgId: string, limit: number = 10): Promise<KGRebuildJob[]> {
    const db = await this.getDb();
    const rows =
      (await db.all(
        `SELECT * FROM kg_rebuild_jobs WHERE organization_id = ? ORDER BY created_at DESC LIMIT ?`,
        [orgId, limit]
      )) || [];

    return rows.map((r: any) => ({
      id: r.id,
      organizationId: r.organization_id,
      status: r.status,
      triggerType: r.trigger_type,
      entitiesProcessed: r.entities_processed || 0,
      relationsProcessed: r.relations_processed || 0,
      duplicatesMerged: r.duplicates_merged || 0,
      startedAt: r.started_at,
      completedAt: r.completed_at,
      errorMessage: r.error_message,
      createdAt: r.created_at,
    }));
  }

  // ──────────────────────────────────────────────
  // Stats
  // ──────────────────────────────────────────────

  async getStats(orgId: string): Promise<{
    totalEntities: number;
    totalRelations: number;
    entityTypes: Record<string, number>;
    avgConfidence: number;
    staleEntities: number;
    redactedEntities: number;
  }> {
    const db = await this.getDb();

    const total = (await db.get(
      `SELECT COUNT(*) as cnt FROM knowledge_graph_entities WHERE organization_id = ? AND merged_into_id IS NULL`,
      [orgId]
    )) as any;

    const totalRels = (await db.get(
      `SELECT COUNT(*) as cnt FROM knowledge_graph_relations WHERE organization_id = ?`,
      [orgId]
    )) as any;

    const typeRows =
      (await db.all(
        `SELECT type, COUNT(*) as cnt FROM knowledge_graph_entities
       WHERE organization_id = ? AND merged_into_id IS NULL
       GROUP BY type`,
        [orgId]
      )) || [];

    const avgConf = (await db.get(
      `SELECT AVG(confidence) as avg FROM knowledge_graph_entities WHERE organization_id = ? AND merged_into_id IS NULL`,
      [orgId]
    )) as any;

    const staleCutoff = new Date(Date.now() - 90 * 86400000).toISOString();
    const stale = (await db.get(
      `SELECT COUNT(*) as cnt FROM knowledge_graph_entities
       WHERE organization_id = ? AND merged_into_id IS NULL AND last_seen < ?`,
      [orgId, staleCutoff]
    )) as any;

    const redacted = (await db.get(
      `SELECT COUNT(*) as cnt FROM knowledge_graph_entities WHERE organization_id = ? AND redacted = 1`,
      [orgId]
    )) as any;

    const entityTypes: Record<string, number> = {};
    for (const r of typeRows as any[]) {
      entityTypes[r.type] = r.cnt;
    }

    return {
      totalEntities: total?.cnt || 0,
      totalRelations: totalRels?.cnt || 0,
      entityTypes,
      avgConfidence: avgConf?.avg || 0,
      staleEntities: stale?.cnt || 0,
      redactedEntities: redacted?.cnt || 0,
    };
  }
}

// ============================================================
// Helpers
// ============================================================

function mapEntityRow(r: any): KGEntity {
  return {
    id: r.id,
    organizationId: r.organization_id,
    name: r.name,
    canonicalName: r.canonical_name || null,
    type: r.type as KGEntityType,
    description: r.description || null,
    attributes: safeParseJson(r.attributes),
    confidence: r.confidence ?? 0.7,
    sourceArtifactType: r.source_artifact_type || null,
    sourceArtifactId: r.source_artifact_id || null,
    actorId: r.actor_id || null,
    extractionMethod: (r.extraction_method || 'pattern') as ExtractionMethod,
    piiFlag: !!r.pii_flag,
    redacted: !!r.redacted,
    mergedIntoId: r.merged_into_id || null,
    mentions: r.mentions || 1,
    firstSeen: r.first_seen,
    lastSeen: r.last_seen,
  };
}

function mapRelationRow(r: any): KGRelation {
  return {
    id: r.id,
    organizationId: r.organization_id,
    sourceEntityId: r.source_entity_id,
    targetEntityId: r.target_entity_id,
    relationType: r.relation_type as KGRelationType,
    attributes: safeParseJson(r.attributes),
    confidence: r.confidence ?? 0.7,
    weight: r.weight ?? 1.0,
    sourceArtifactType: r.source_artifact_type || null,
    sourceArtifactId: r.source_artifact_id || null,
    actorId: r.actor_id || null,
    extractionMethod: (r.extraction_method || 'pattern') as ExtractionMethod,
    validFrom: r.valid_from || null,
    validUntil: r.valid_until || null,
    createdAt: r.created_at,
  };
}

function safeParseJson(val: unknown): Record<string, unknown> {
  if (!val) return {};
  try {
    return typeof val === 'string' ? JSON.parse(val) : (val as Record<string, unknown>);
  } catch {
    return {};
  }
}

const unifiedKGService = new UnifiedKGService();
export default unifiedKGService;
export { UnifiedKGService, unifiedKGService };
