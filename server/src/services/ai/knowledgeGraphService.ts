/**
 * Knowledge Graph Service (R8)
 *
 * Extracts entities and relationships from AI conversations and documents,
 * building a structured knowledge graph per organization.
 *
 * This enables:
 * - "Who is responsible for X?"
 * - "What decisions were made about Y?"
 * - "How does initiative A relate to technology B?"
 * - Temporal tracking: "Last quarter you said X, but now..."
 *
 * Storage: PostgreSQL JSON columns (no Neo4j needed at this scale)
 *
 * @version 1.0.0
 */

import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../../database/Database.js';
import type { IDatabase } from '../../database/IDatabase.js';
import logger from '../../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

export interface KnowledgeEntity {
  id: string;
  organizationId: string;
  name: string;
  type: EntityType;
  attributes: Record<string, any>;
  firstSeen: string;
  lastSeen: string;
  mentions: number;
}

export type EntityType =
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
  | 'process';

export interface KnowledgeRelation {
  id: string;
  organizationId: string;
  sourceEntityId: string;
  targetEntityId: string;
  relationType: RelationType;
  attributes: Record<string, any>;
  confidence: number;
  createdAt: string;
}

export type RelationType =
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
  | 'replaces';

export interface ExtractionResult {
  entities: Array<{ name: string; type: EntityType; attributes?: Record<string, any> }>;
  relations: Array<{
    source: string;
    target: string;
    type: RelationType;
    confidence?: number;
  }>;
}

// ==========================================
// EXTRACTION PATTERNS
// ==========================================

const ENTITY_PATTERNS: Array<{ type: EntityType; patterns: RegExp[] }> = [
  {
    type: 'person',
    patterns: [
      /(?:pan|pani|mr\.?|mrs\.?|dr\.?)\s+([A-ZŁŚŻŹĆŃ][a-złśżźćńóęą]+(?:\s+[A-ZŁŚŻŹĆŃ][a-złśżźćńóęą]+)?)/gi,
      /(?:odpowiedzialny|owner|responsible|lead|manager|director):\s*([A-ZŁŚŻŹĆŃ][a-złśżźćńóęą]+(?:\s+[A-ZŁŚŻŹĆŃ][a-złśżźćńóęą]+)?)/gi,
    ],
  },
  {
    type: 'technology',
    patterns: [
      /\b(SAP|ERP|CRM|MES|SCADA|PLC|IoT|AI|ML|RPA|BI|ETL|API|AWS|Azure|GCP|Docker|Kubernetes)\b/g,
      /(?:system|platforma|narzędzie|tool|software|framework)\s+([A-Z][A-Za-z0-9]+(?:\s+[A-Z][A-Za-z0-9]+)?)/g,
    ],
  },
  {
    type: 'metric',
    patterns: [
      /\b(OEE|ROI|NPV|IRR|KPI|SLA|MTTR|MTBF|NPS|CAC|LTV|MRR|ARR|EBITDA)\b/g,
      /(?:wskaźnik|metric|measure|indicator)\s+([A-Za-z_]+)/gi,
    ],
  },
  {
    type: 'vendor',
    patterns: [
      /(?:vendor|dostawca|supplier|partner|integrator):\s*([A-ZŁŚŻŹĆŃ][A-Za-złśżźćńóęą]+(?:\s+[A-Za-złśżźćńóęą]+)*)/gi,
    ],
  },
  {
    type: 'risk',
    patterns: [
      /(?:ryzyko|risk|zagrożenie|threat):\s*(.{10,80}?)(?:\.|$)/gim,
    ],
  },
];

const RELATION_PATTERNS: Array<{
  type: RelationType;
  pattern: RegExp;
  sourceGroup: number;
  targetGroup: number;
}> = [
  {
    type: 'responsible_for',
    pattern: /([A-ZŁŚŻŹĆŃ][a-złśżźćńóęą]+(?:\s+[A-ZŁŚŻŹĆŃ][a-złśżźćńóęą]+)?)\s+(?:jest odpowiedzialny za|is responsible for|owns|zarządza)\s+(.{5,60})/gi,
    sourceGroup: 1,
    targetGroup: 2,
  },
  {
    type: 'depends_on',
    pattern: /(.{5,40})\s+(?:zależy od|depends on|wymaga|requires|is blocked by)\s+(.{5,40})/gi,
    sourceGroup: 1,
    targetGroup: 2,
  },
  {
    type: 'uses',
    pattern: /(.{5,40})\s+(?:używa|uses|wykorzystuje|employs|korzysta z)\s+([A-Z][A-Za-z0-9]+)/gi,
    sourceGroup: 1,
    targetGroup: 2,
  },
];

// ==========================================
// SERVICE
// ==========================================

class KnowledgeGraphService {
  private db: IDatabase | null = null;

  private async getDb(): Promise<IDatabase> {
    if (!this.db) {
      this.db = await getDatabase();
    }
    return this.db;
  }

  /**
   * Extract entities and relationships from text (conversation/document).
   * Uses pattern matching for fast extraction (no LLM needed).
   */
  extractFromText(text: string): ExtractionResult {
    const entities: ExtractionResult['entities'] = [];
    const relations: ExtractionResult['relations'] = [];
    const seenEntities = new Set<string>();

    // Extract entities
    for (const { type, patterns } of ENTITY_PATTERNS) {
      for (const pattern of patterns) {
        // Reset regex state
        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(text)) !== null) {
          const name = (match[1] || match[0]).trim();
          const key = `${type}:${name.toLowerCase()}`;
          if (!seenEntities.has(key) && name.length > 1 && name.length < 80) {
            seenEntities.add(key);
            entities.push({ name, type });
          }
        }
      }
    }

    // Extract relations
    for (const { type, pattern, sourceGroup, targetGroup } of RELATION_PATTERNS) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const source = match[sourceGroup]?.trim();
        const target = match[targetGroup]?.trim();
        if (source && target && source !== target) {
          relations.push({
            source,
            target,
            type,
            confidence: 0.7,
          });
        }
      }
    }

    return { entities, relations };
  }

  /**
   * Store extracted entities and relations for an organization.
   * Upserts entities (increments mentions), creates new relations.
   */
  async storeExtraction(
    organizationId: string,
    extraction: ExtractionResult
  ): Promise<{ entitiesStored: number; relationsStored: number }> {
    const db = await this.getDb();
    const now = new Date().toISOString();
    let entitiesStored = 0;
    let relationsStored = 0;

    // Ensure tables exist
    await this.ensureTables(db);

    for (const entity of extraction.entities) {
      try {
        const existing = await db.get(
          `SELECT id, mentions FROM knowledge_graph_entities
           WHERE organization_id = ? AND LOWER(name) = LOWER(?) AND type = ?`,
          [organizationId, entity.name, entity.type]
        ) as any;

        if (existing) {
          await db.run(
            `UPDATE knowledge_graph_entities SET mentions = mentions + 1, last_seen = ?, attributes = ?
             WHERE id = ?`,
            [now, JSON.stringify(entity.attributes || {}), existing.id]
          );
        } else {
          await db.run(
            `INSERT INTO knowledge_graph_entities (id, organization_id, name, type, attributes, first_seen, last_seen, mentions)
             VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
            [uuidv4(), organizationId, entity.name, entity.type, JSON.stringify(entity.attributes || {}), now, now]
          );
        }
        entitiesStored++;
      } catch (err: any) {
        logger.debug(`[KnowledgeGraph] Entity store error: ${err.message}`);
      }
    }

    for (const relation of extraction.relations) {
      try {
        // Find source and target entity IDs
        const sourceEntity = await db.get(
          `SELECT id FROM knowledge_graph_entities
           WHERE organization_id = ? AND LOWER(name) = LOWER(?)`,
          [organizationId, relation.source]
        ) as any;

        const targetEntity = await db.get(
          `SELECT id FROM knowledge_graph_entities
           WHERE organization_id = ? AND LOWER(name) = LOWER(?)`,
          [organizationId, relation.target]
        ) as any;

        if (sourceEntity && targetEntity) {
          await db.run(
            `INSERT INTO knowledge_graph_relations (id, organization_id, source_entity_id, target_entity_id, relation_type, attributes, confidence, created_at)
             VALUES (?, ?, ?, ?, ?, '{}', ?, ?)`,
            [uuidv4(), organizationId, sourceEntity.id, targetEntity.id, relation.type, relation.confidence || 0.7, now]
          );
          relationsStored++;
        }
      } catch (err: any) {
        logger.debug(`[KnowledgeGraph] Relation store error: ${err.message}`);
      }
    }

    logger.info(`[KnowledgeGraph] Stored ${entitiesStored} entities, ${relationsStored} relations for org ${organizationId}`);
    return { entitiesStored, relationsStored };
  }

  /**
   * Query entities for an organization, optionally filtered by type.
   */
  async getEntities(
    organizationId: string,
    options?: { type?: EntityType; limit?: number; minMentions?: number }
  ): Promise<KnowledgeEntity[]> {
    const db = await this.getDb();
    await this.ensureTables(db);

    const conditions = ['organization_id = ?'];
    const params: any[] = [organizationId];

    if (options?.type) {
      conditions.push('type = ?');
      params.push(options.type);
    }
    if (options?.minMentions) {
      conditions.push('mentions >= ?');
      params.push(options.minMentions);
    }

    const limit = options?.limit || 50;
    const rows = await db.all(
      `SELECT * FROM knowledge_graph_entities
       WHERE ${conditions.join(' AND ')}
       ORDER BY mentions DESC, last_seen DESC
       LIMIT ?`,
      [...params, limit]
    );

    return (rows || []).map((r: any) => ({
      id: r.id,
      organizationId: r.organization_id,
      name: r.name,
      type: r.type,
      attributes: safeParseJson(r.attributes),
      firstSeen: r.first_seen,
      lastSeen: r.last_seen,
      mentions: r.mentions,
    }));
  }

  /**
   * Get relations for an entity.
   */
  async getRelations(
    organizationId: string,
    entityId: string
  ): Promise<KnowledgeRelation[]> {
    const db = await this.getDb();
    await this.ensureTables(db);

    const rows = await db.all(
      `SELECT * FROM knowledge_graph_relations
       WHERE organization_id = ? AND (source_entity_id = ? OR target_entity_id = ?)
       ORDER BY confidence DESC, created_at DESC
       LIMIT 30`,
      [organizationId, entityId, entityId]
    );

    return (rows || []).map((r: any) => ({
      id: r.id,
      organizationId: r.organization_id,
      sourceEntityId: r.source_entity_id,
      targetEntityId: r.target_entity_id,
      relationType: r.relation_type,
      attributes: safeParseJson(r.attributes),
      confidence: r.confidence,
      createdAt: r.created_at,
    }));
  }

  /**
   * Build a context addon from the knowledge graph for AI prompts.
   */
  async buildGraphContext(organizationId: string, limit: number = 15): Promise<string> {
    try {
      const entities = await this.getEntities(organizationId, { limit, minMentions: 2 });
      if (entities.length === 0) return '';

      const grouped = new Map<EntityType, KnowledgeEntity[]>();
      for (const e of entities) {
        if (!grouped.has(e.type)) grouped.set(e.type, []);
        grouped.get(e.type)!.push(e);
      }

      const parts: string[] = ['## KNOWLEDGE GRAPH (Organization Intelligence)'];
      for (const [type, ents] of grouped) {
        parts.push(`### ${type.charAt(0).toUpperCase() + type.slice(1)}s:`);
        for (const e of ents.slice(0, 5)) {
          parts.push(`- ${e.name} (mentioned ${e.mentions}x, last: ${e.lastSeen.slice(0, 10)})`);
        }
      }

      return parts.join('\n');
    } catch (err: any) {
      logger.debug(`[KnowledgeGraph] buildGraphContext error: ${err.message}`);
      return '';
    }
  }

  /**
   * Process a conversation turn: extract and store entities/relations.
   */
  async processConversation(
    organizationId: string,
    userMessage: string,
    aiResponse: string
  ): Promise<void> {
    try {
      const fullText = `${userMessage}\n\n${aiResponse}`;
      const extraction = this.extractFromText(fullText);

      if (extraction.entities.length > 0 || extraction.relations.length > 0) {
        await this.storeExtraction(organizationId, extraction);
      }
    } catch (err: any) {
      // Non-critical — log and continue
      logger.debug(`[KnowledgeGraph] processConversation error: ${err.message}`);
    }
  }

  // ==========================================
  // TABLE MANAGEMENT
  // ==========================================

  private async ensureTables(db: IDatabase): Promise<void> {
    try {
      await db.run(`CREATE TABLE IF NOT EXISTS knowledge_graph_entities (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        attributes TEXT DEFAULT '{}',
        first_seen TEXT NOT NULL,
        last_seen TEXT NOT NULL,
        mentions INTEGER DEFAULT 1
      )`);

      await db.run(`CREATE TABLE IF NOT EXISTS knowledge_graph_relations (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        source_entity_id TEXT NOT NULL,
        target_entity_id TEXT NOT NULL,
        relation_type TEXT NOT NULL,
        attributes TEXT DEFAULT '{}',
        confidence REAL DEFAULT 0.7,
        created_at TEXT NOT NULL
      )`);

      await db.run(`CREATE INDEX IF NOT EXISTS idx_kg_entities_org ON knowledge_graph_entities(organization_id)`);
      await db.run(`CREATE INDEX IF NOT EXISTS idx_kg_relations_org ON knowledge_graph_relations(organization_id)`);
    } catch {
      // Tables may already exist
    }
  }
}

function safeParseJson(val: any): Record<string, any> {
  if (!val) return {};
  try { return typeof val === 'string' ? JSON.parse(val) : val; } catch { return {}; }
}

const knowledgeGraphService = new KnowledgeGraphService();
export default knowledgeGraphService;
export { KnowledgeGraphService, knowledgeGraphService };
