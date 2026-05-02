import { v4 as uuidv4 } from 'uuid';

import * as queryHelpers from '../../utils/queryHelpers.js';

export type ConclusionStatus =
  | 'candidate'
  | 'needs_evidence'
  | 'needs_review'
  | 'ready_for_readout'
  | 'published'
  | 'converted'
  | 'rejected';

export interface ArtifactRef {
  type: string;
  id: string;
  title?: string | null;
  url?: string | null;
}

export interface EvidenceRef {
  type: string;
  ref: string;
  excerpt?: string | null;
}

export interface Conclusion {
  id: string;
  organizationId: string;
  projectId?: string | null;
  title: string;
  statement: string;
  sourceModule: string;
  sourceArtifactRefs: ArtifactRef[];
  sourcePackId?: string | null;
  confidenceLevel: string;
  limits: string;
  evidenceRefs: EvidenceRef[];
  recommendedNextAction?: string | null;
  status: ConclusionStatus;
  ownerId?: string | null;
  reviewerId?: string | null;
  sponsorId?: string | null;
  sourceInsightId?: string | null;
  sourceInsightTitle?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface ConclusionRow {
  id: string;
  organization_id: string;
  project_id?: string | null;
  title: string;
  statement: string;
  source_module: string;
  source_artifact_refs_json?: string | null;
  source_pack_id?: string | null;
  confidence_level: string;
  limits_text: string;
  evidence_refs_json?: string | null;
  recommended_next_action?: string | null;
  status: ConclusionStatus;
  owner_id?: string | null;
  reviewer_id?: string | null;
  sponsor_id?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

let ensureTablesPromise: Promise<void> | null = null;

function safeJsonArray<T>(raw: string | null | undefined): T[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function normalizeConfidence(raw: string | null | undefined): string {
  const value = String(raw || 'insufficient').toLowerCase();
  return ['high', 'medium', 'low', 'insufficient', 'contradicted'].includes(value)
    ? value
    : 'insufficient';
}

function deriveConclusionStatus(row: any): ConclusionStatus {
  const reviewStatus = String(row.finding_review_status || row.insight_status || '').toLowerCase();
  const readbackStatus = String(row.readback_status || '').toLowerCase();
  const confidence = normalizeConfidence(row.confidence_level);
  const evidenceCount = Number(row.evidence_count || 0);

  if (reviewStatus === 'published' || row.insight_status === 'published') return 'published';
  if (confidence === 'insufficient' || evidenceCount === 0 || readbackStatus === 'needs_more_evidence') {
    return 'needs_evidence';
  }
  if (confidence === 'contradicted' || readbackStatus === 'challenged_by_client') {
    return 'needs_review';
  }
  if (readbackStatus === 'confirmed_by_client' || readbackStatus === 'partially_confirmed') {
    return 'ready_for_readout';
  }
  return 'needs_review';
}

function rowToConclusion(row: ConclusionRow): Conclusion {
  return {
    id: row.id,
    organizationId: row.organization_id,
    projectId: row.project_id ?? null,
    title: row.title,
    statement: row.statement,
    sourceModule: row.source_module,
    sourceArtifactRefs: safeJsonArray<ArtifactRef>(row.source_artifact_refs_json),
    sourcePackId: row.source_pack_id ?? null,
    confidenceLevel: row.confidence_level,
    limits: row.limits_text,
    evidenceRefs: safeJsonArray<EvidenceRef>(row.evidence_refs_json),
    recommendedNextAction: row.recommended_next_action ?? null,
    status: row.status,
    ownerId: row.owner_id ?? null,
    reviewerId: row.reviewer_id ?? null,
    sponsorId: row.sponsor_id ?? null,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function ensureTables(): Promise<void> {
  if (!ensureTablesPromise) {
    ensureTablesPromise = (async () => {
      await queryHelpers.queryRun(
        `CREATE TABLE IF NOT EXISTS conclusions (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL,
          project_id TEXT,
          title TEXT NOT NULL,
          statement TEXT NOT NULL,
          source_module TEXT NOT NULL,
          source_artifact_refs_json TEXT NOT NULL DEFAULT '[]',
          source_pack_id TEXT,
          confidence_level TEXT NOT NULL DEFAULT 'insufficient',
          limits_text TEXT NOT NULL,
          evidence_refs_json TEXT NOT NULL DEFAULT '[]',
          recommended_next_action TEXT,
          status TEXT NOT NULL DEFAULT 'candidate',
          owner_id TEXT,
          reviewer_id TEXT,
          sponsor_id TEXT,
          created_by TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
      );
      await queryHelpers.queryRun(
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_conclusions_source_unique
         ON conclusions(organization_id, source_module, source_artifact_refs_json)`
      );
      await queryHelpers.queryRun(
        `CREATE INDEX IF NOT EXISTS idx_conclusions_org_status ON conclusions(organization_id, status)`
      );
      await queryHelpers.queryRun(
        `CREATE INDEX IF NOT EXISTS idx_conclusions_org_project ON conclusions(organization_id, project_id)`
      );
      await queryHelpers.queryRun(
        `CREATE TABLE IF NOT EXISTS conclusion_source_packs (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL,
          project_id TEXT,
          source_module TEXT NOT NULL,
          source_artifact_refs_json TEXT NOT NULL DEFAULT '[]',
          evidence_refs_json TEXT NOT NULL DEFAULT '[]',
          context_summary TEXT NOT NULL DEFAULT '',
          limitations_json TEXT NOT NULL DEFAULT '[]',
          captured_at TIMESTAMP NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
      );
      await queryHelpers.queryRun(
        `CREATE TABLE IF NOT EXISTS artifact_conversion_events (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL,
          conversion_id TEXT,
          event_type TEXT NOT NULL,
          actor_id TEXT,
          payload_json TEXT NOT NULL DEFAULT '{}',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
      );
    })();
  }
  return ensureTablesPromise;
}

async function upsertInterviewFindingConclusion(row: any, actorUserId: string): Promise<void> {
  const now = new Date().toISOString();
  const findingId = String(row.finding_id);
  const insightId = String(row.insight_id);
  const sourceRefs: ArtifactRef[] = [
    {
      type: 'interview_finding',
      id: findingId,
      title: String(row.finding_statement || '').slice(0, 120),
      url: `/interview?artifact=insight:${encodeURIComponent(insightId)}`,
    },
    {
      type: 'interview_insight',
      id: insightId,
      title: row.insight_title || null,
      url: `/interview?artifact=insight:${encodeURIComponent(insightId)}`,
    },
  ];
  const evidenceRefs: EvidenceRef[] = safeJsonArray<any>(row.evidence_json)
    .filter((ptr: any) => ptr && typeof ptr === 'object' && (ptr.source_ref || ptr.sourceRef || ptr.id))
    .map((ptr: any) => ({
      type: String(ptr.pointer_type || ptr.type || 'evidence'),
      ref: String(ptr.source_ref || ptr.sourceRef || ptr.id || ''),
      excerpt: ptr.captured_excerpt || ptr.capturedExcerpt || null,
    }));
  const sourcePackId = `sp_interview_${findingId}`;
  const status = deriveConclusionStatus(row);
  const title = String(row.insight_title || row.finding_statement || 'Interview finding').slice(0, 180);
  const projectId = row.project_id || null;
  const sourceRefsJson = JSON.stringify(sourceRefs);

  await queryHelpers.queryRun(
    `INSERT INTO conclusion_source_packs (
      id, organization_id, project_id, source_module, source_artifact_refs_json,
      evidence_refs_json, context_summary, limitations_json, captured_at, created_at, updated_at
    ) VALUES (?, ?, ?, 'interview', ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      evidence_refs_json = excluded.evidence_refs_json,
      context_summary = excluded.context_summary,
      limitations_json = excluded.limitations_json,
      updated_at = excluded.updated_at`,
    [
      sourcePackId,
      row.organization_id,
      projectId,
      sourceRefsJson,
      JSON.stringify(evidenceRefs),
      `Interview insight: ${row.insight_title || insightId}`,
      JSON.stringify([row.limits_text || '']),
      now,
      now,
      now,
    ]
  );

  const existing = await queryHelpers.queryOne<{ id: string }>(
    `SELECT id FROM conclusions
     WHERE organization_id = ? AND source_module = 'interview' AND source_artifact_refs_json = ?
     LIMIT 1`,
    [row.organization_id, sourceRefsJson]
  );

  if (existing?.id) {
    await queryHelpers.queryRun(
      `UPDATE conclusions SET
        project_id = ?,
        title = ?,
        statement = ?,
        source_pack_id = ?,
        confidence_level = ?,
        limits_text = ?,
        evidence_refs_json = ?,
        recommended_next_action = ?,
        status = CASE WHEN status = 'converted' THEN status ELSE ? END,
        updated_at = ?
       WHERE id = ? AND organization_id = ?`,
      [
        projectId,
        title,
        row.finding_statement,
        sourcePackId,
        normalizeConfidence(row.confidence_level),
        row.limits_text || 'No limits provided.',
        JSON.stringify(evidenceRefs),
        row.next_action_text || null,
        status,
        now,
        existing.id,
        row.organization_id,
      ]
    );
    return;
  }

  await queryHelpers.queryRun(
    `INSERT INTO conclusions (
      id, organization_id, project_id, title, statement, source_module, source_artifact_refs_json,
      source_pack_id, confidence_level, limits_text, evidence_refs_json, recommended_next_action,
      status, owner_id, reviewer_id, sponsor_id, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'interview', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uuidv4(),
      row.organization_id,
      projectId,
      title,
      row.finding_statement,
      sourceRefsJson,
      sourcePackId,
      normalizeConfidence(row.confidence_level),
      row.limits_text || 'No limits provided.',
      JSON.stringify(evidenceRefs),
      row.next_action_text || null,
      status,
      row.created_by || null,
      row.reviewed_by || null,
      null,
      actorUserId,
      now,
      now,
    ]
  );
}

export class ConclusionService {
  async ensureReady(): Promise<void> {
    await ensureTables();
  }

  async syncInterviewFindings(organizationId: string, actorUserId: string): Promise<number> {
    await ensureTables();
    const rows = await queryHelpers.queryAll<any>(
      `SELECT
        f.id AS finding_id,
        f.organization_id,
        f.insight_id,
        f.finding_statement,
        f.confidence_level,
        f.limits_text,
        f.next_action_text,
        f.review_status AS finding_review_status,
        f.readback_status,
        f.created_by,
        i.title AS insight_title,
        i.status AS insight_status,
        i.project_id,
        i.reviewed_by,
        COALESCE(
          json_group_array(
            CASE
              WHEN p.id IS NOT NULL THEN json_object(
                'id', p.id,
                'pointer_type', p.pointer_type,
                'source_ref', p.source_ref,
                'captured_excerpt', p.captured_excerpt,
                'is_tombstone', p.pointer_state = 'removed'
              )
            END
          ),
          '[]'
        ) AS evidence_json,
        SUM(CASE WHEN p.id IS NOT NULL AND p.pointer_state <> 'removed' THEN 1 ELSE 0 END) AS evidence_count
       FROM interview_insight_findings f
       JOIN interview_insights i ON i.id = f.insight_id AND i.organization_id = f.organization_id
       LEFT JOIN interview_insight_evidence_pointers p
         ON p.finding_id = f.id AND p.insight_id = f.insight_id AND p.organization_id = f.organization_id
       WHERE f.organization_id = ?
       GROUP BY f.id
       ORDER BY f.updated_at DESC`,
      [organizationId]
    ).catch(() => []);

    for (const row of rows) {
      await upsertInterviewFindingConclusion(row, actorUserId);
    }
    return rows.length;
  }

  async listConclusions(params: {
    organizationId: string;
    actorUserId: string;
    status?: string;
    sourceModule?: string;
    projectId?: string;
  }): Promise<Conclusion[]> {
    await this.syncInterviewFindings(params.organizationId, params.actorUserId);

    const clauses = ['organization_id = ?'];
    const values: unknown[] = [params.organizationId];
    if (params.status) {
      clauses.push('status = ?');
      values.push(params.status);
    }
    if (params.sourceModule) {
      clauses.push('source_module = ?');
      values.push(params.sourceModule);
    }
    if (params.projectId) {
      clauses.push('project_id = ?');
      values.push(params.projectId);
    }

    const rows = await queryHelpers.queryAll<ConclusionRow>(
      `SELECT * FROM conclusions WHERE ${clauses.join(' AND ')} ORDER BY updated_at DESC`,
      values
    );
    return rows.map(rowToConclusion);
  }

  async getConclusion(
    organizationId: string,
    conclusionId: string,
    actorUserId: string
  ): Promise<Conclusion | null> {
    await this.syncInterviewFindings(organizationId, actorUserId);
    const row = await queryHelpers.queryOne<ConclusionRow>(
      `SELECT * FROM conclusions WHERE id = ? AND organization_id = ?`,
      [conclusionId, organizationId]
    );
    return row ? rowToConclusion(row) : null;
  }

  async markConverted(params: {
    organizationId: string;
    conclusionId: string;
    actorUserId: string;
  }): Promise<void> {
    await ensureTables();
    await queryHelpers.queryRun(
      `UPDATE conclusions SET status = 'converted', updated_at = ? WHERE id = ? AND organization_id = ?`,
      [new Date().toISOString(), params.conclusionId, params.organizationId]
    );
    await queryHelpers.queryRun(
      `INSERT INTO artifact_conversion_events (id, organization_id, conversion_id, event_type, actor_id, payload_json, created_at)
       VALUES (?, ?, NULL, 'conclusion.converted', ?, ?, ?)`,
      [
        uuidv4(),
        params.organizationId,
        params.actorUserId,
        JSON.stringify({ conclusionId: params.conclusionId }),
        new Date().toISOString(),
      ]
    );
  }
}

export const conclusionService = new ConclusionService();
