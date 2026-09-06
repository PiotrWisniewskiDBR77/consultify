import { v4 as uuidv4 } from 'uuid';

import logger from '../../utils/Logger.js';
import * as queryHelpers from '../../utils/queryHelpers.js';
import {
  safePersistAuditReportConclusion,
  type AuditReportDocumentLike,
} from './auditReportConclusionBridge.js';

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

export interface SourcePack {
  id: string;
  organizationId: string;
  projectId?: string | null;
  sourceModule: string;
  sourceArtifactRefs: ArtifactRef[];
  evidenceRefs: EvidenceRef[];
  contextSummary: string;
  limitations: string[];
  capturedAt: string;
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

interface SourcePackRow {
  id: string;
  organization_id: string;
  project_id?: string | null;
  source_module: string;
  source_artifact_refs_json?: string | null;
  evidence_refs_json?: string | null;
  context_summary: string;
  limitations_json?: string | null;
  captured_at: string;
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
  if (
    confidence === 'insufficient' ||
    evidenceCount === 0 ||
    readbackStatus === 'needs_more_evidence'
  ) {
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

function rowToSourcePack(row: SourcePackRow): SourcePack {
  return {
    id: row.id,
    organizationId: row.organization_id,
    projectId: row.project_id ?? null,
    sourceModule: row.source_module,
    sourceArtifactRefs: safeJsonArray<ArtifactRef>(row.source_artifact_refs_json),
    evidenceRefs: safeJsonArray<EvidenceRef>(row.evidence_refs_json),
    contextSummary: row.context_summary,
    limitations: safeJsonArray<string>(row.limitations_json),
    capturedAt: row.captured_at,
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
    .filter(
      (ptr: any) => ptr && typeof ptr === 'object' && (ptr.source_ref || ptr.sourceRef || ptr.id)
    )
    .map((ptr: any) => ({
      type: String(ptr.pointer_type || ptr.type || 'evidence'),
      ref: String(ptr.source_ref || ptr.sourceRef || ptr.id || ''),
      excerpt: ptr.captured_excerpt || ptr.capturedExcerpt || null,
    }));
  const sourcePackId = `sp_interview_${findingId}`;
  const status = deriveConclusionStatus(row);
  const title = String(row.insight_title || row.finding_statement || 'Interview finding').slice(
    0,
    180
  );
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

async function upsertExternalConclusion(params: {
  organizationId: string;
  projectId?: string | null;
  title: string;
  statement: string;
  sourceModule: string;
  sourceRefs: ArtifactRef[];
  confidenceLevel: string;
  limits: string;
  evidenceRefs: EvidenceRef[];
  recommendedNextAction?: string | null;
  status?: ConclusionStatus;
  createdBy: string;
  contextSummary: string;
}): Promise<void> {
  const now = new Date().toISOString();
  const sourceRefsJson = JSON.stringify(params.sourceRefs);
  const sourcePackId = `sp_${params.sourceModule}_${params.sourceRefs[0]?.id || uuidv4()}`;

  await queryHelpers.queryRun(
    `INSERT INTO conclusion_source_packs (
      id, organization_id, project_id, source_module, source_artifact_refs_json,
      evidence_refs_json, context_summary, limitations_json, captured_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      evidence_refs_json = excluded.evidence_refs_json,
      context_summary = excluded.context_summary,
      limitations_json = excluded.limitations_json,
      updated_at = excluded.updated_at`,
    [
      sourcePackId,
      params.organizationId,
      params.projectId ?? null,
      params.sourceModule,
      sourceRefsJson,
      JSON.stringify(params.evidenceRefs),
      params.contextSummary,
      JSON.stringify([params.limits]),
      now,
      now,
      now,
    ]
  );

  const existing = await queryHelpers.queryOne<{ id: string }>(
    `SELECT id FROM conclusions
     WHERE organization_id = ? AND source_module = ? AND source_artifact_refs_json = ?
     LIMIT 1`,
    [params.organizationId, params.sourceModule, sourceRefsJson]
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
        params.projectId ?? null,
        params.title,
        params.statement,
        sourcePackId,
        normalizeConfidence(params.confidenceLevel),
        params.limits,
        JSON.stringify(params.evidenceRefs),
        params.recommendedNextAction ?? null,
        params.status || 'candidate',
        now,
        existing.id,
        params.organizationId,
      ]
    );
    return;
  }

  await queryHelpers.queryRun(
    `INSERT INTO conclusions (
      id, organization_id, project_id, title, statement, source_module, source_artifact_refs_json,
      source_pack_id, confidence_level, limits_text, evidence_refs_json, recommended_next_action,
      status, owner_id, reviewer_id, sponsor_id, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?, ?)`,
    [
      uuidv4(),
      params.organizationId,
      params.projectId ?? null,
      params.title,
      params.statement,
      params.sourceModule,
      sourceRefsJson,
      sourcePackId,
      normalizeConfidence(params.confidenceLevel),
      params.limits,
      JSON.stringify(params.evidenceRefs),
      params.recommendedNextAction ?? null,
      params.status || 'candidate',
      params.createdBy,
      now,
      now,
    ]
  );
}

export interface CreateConclusionParams {
  organizationId: string;
  projectId?: string | null;
  title: string;
  statement: string;
  sourceModule: string;
  sourceRefs: ArtifactRef[];
  confidenceLevel: string;
  limits: string;
  evidenceRefs: EvidenceRef[];
  recommendedNextAction?: string | null;
  status?: ConclusionStatus;
  createdBy: string;
  contextSummary: string;
}

export class ConclusionService {
  async ensureReady(): Promise<void> {
    await ensureTables();
  }

  /**
   * Push-based CONCLUSION_LAYER entry point: persist (upsert) a conclusion
   * produced by a live generation flow (tool W2 finishing block, DRD/SIRI/ADMA
   * report conclusion models, ...). Idempotent per
   * (organizationId, sourceModule, sourceRefs) — regenerating a conclusion for
   * the same source updates the existing row instead of duplicating it, and a
   * 'converted' conclusion is never demoted.
   */
  async createConclusion(params: CreateConclusionParams): Promise<void> {
    await ensureTables();
    await upsertExternalConclusion(params);
  }

  async syncInterviewFindings(organizationId: string, actorUserId: string): Promise<number> {
    await ensureTables();
    const rows = await queryHelpers
      .queryAll<any>(
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
        s.project_id,
        NULL AS reviewed_by
       FROM interview_insight_findings f
       JOIN interview_insights i ON i.id = f.insight_id AND i.organization_id = f.organization_id
       LEFT JOIN interview_sessions s
         ON s.id = i.session_id AND s.organization_id = i.organization_id
       WHERE f.organization_id = ?
       ORDER BY f.updated_at DESC`,
        [organizationId]
      )
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(`[ConclusionService] Interview finding sync query failed: ${message}`);
        throw error;
      });

    for (const row of rows) {
      const evidenceRows = await queryHelpers
        .queryAll<any>(
          `SELECT id, pointer_type, source_ref, captured_excerpt, pointer_state
         FROM interview_insight_evidence_pointers
         WHERE finding_id = ? AND insight_id = ? AND organization_id = ?`,
          [row.finding_id, row.insight_id, organizationId]
        )
        .catch(() => []);
      const activeEvidenceRows = evidenceRows.filter(
        (ptr) => String(ptr.pointer_state || '') !== 'removed'
      );
      row.evidence_json = JSON.stringify(activeEvidenceRows);
      row.evidence_count = activeEvidenceRows.length;
      await upsertInterviewFindingConclusion(row, actorUserId);
    }
    return rows.length;
  }

  async syncAssessmentReports(organizationId: string, actorUserId: string): Promise<number> {
    await ensureTables();
    // 1.1-Z3 #2: this query used to select `title`/`report_type`, neither of
    // which exist on `assessment_reports` (real columns: `name`, no
    // report-type column at all — verified against the live Postgres schema).
    // On Postgres that made the whole SELECT throw, and the `.catch(() => [])`
    // below swallowed it in total silence: syncAssessmentReports() always
    // returned 0, so approved/finalized assessment reports never produced a
    // Conclusion. Fixed to the real schema (`name`); the "report type" the
    // caller cares about is carried as the constant `sourceRefs[].type =
    // 'assessment_report'` below (there is no per-row report-type column to
    // read it from). Failures are now logged instead of swallowed.
    const rows = await queryHelpers
      .queryAll<any>(
        `SELECT id, organization_id, project_id, name, executive_summary,
              recommendations, detailed_analysis, status, created_by, created_at, updated_at
       FROM assessment_reports
       WHERE organization_id = ?
       ORDER BY updated_at DESC
       LIMIT 100`,
        [organizationId]
      )
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        logger.warn(`[ConclusionService] Assessment report sync query failed: ${message}`);
        return [];
      });

    for (const row of rows) {
      const recommendations = safeJsonArray<any>(row.recommendations);
      const firstRecommendation =
        recommendations.find((item) => typeof item === 'string' || item?.title || item?.text) ||
        null;
      const statement =
        typeof firstRecommendation === 'string'
          ? firstRecommendation
          : firstRecommendation?.text ||
            firstRecommendation?.title ||
            row.executive_summary ||
            row.name ||
            'Assessment recommendation';
      await upsertExternalConclusion({
        organizationId,
        projectId: row.project_id ?? null,
        title: String(row.name || 'Assessment recommendation').slice(0, 180),
        statement: String(statement).slice(0, 2000),
        sourceModule: 'assessment',
        sourceRefs: [
          {
            type: 'assessment_report',
            id: String(row.id),
            title: row.name || null,
            url: `/assessment?reportId=${encodeURIComponent(String(row.id))}`,
          },
        ],
        confidenceLevel: row.status === 'approved' ? 'medium' : 'low',
        limits:
          'Assessment conclusion derived from report-level recommendations; validate source evidence before execution.',
        evidenceRefs: [
          {
            type: 'assessment_report',
            ref: String(row.id),
            excerpt: row.executive_summary || null,
          },
        ],
        recommendedNextAction:
          typeof firstRecommendation === 'string'
            ? firstRecommendation
            : firstRecommendation?.nextAction || firstRecommendation?.text || null,
        status: row.status === 'approved' ? 'published' : 'needs_review',
        createdBy: row.created_by || actorUserId,
        contextSummary: row.executive_summary || row.detailed_analysis || row.name || '',
      });
    }

    return rows.length;
  }

  async syncToolOutputs(organizationId: string, actorUserId: string): Promise<number> {
    await ensureTables();
    // H3: output_json is NOT part of the base tool_sessions schema (it is added
    // lazily / by demo seeds). Selecting a missing column makes the whole query
    // throw, and the .catch(() => []) below then silently drops EVERY tool
    // conclusion for the org ("subquery optional column = silent empty").
    // Probe the schema and only select the column when it actually exists.
    const hasOutputJson = await queryHelpers
      .getTableColumns('tool_sessions')
      .then((cols) => (cols || []).some((col) => col?.name === 'output_json'))
      .catch(() => false);
    const outputJsonSelect = hasOutputJson ? 'output_json,' : `NULL as output_json,`;
    const rows = await queryHelpers
      .queryAll<any>(
        `SELECT id, organization_id, project_id, name, tool_type, status, confidence_avg,
              ${outputJsonSelect} answers_json, context_snapshot, created_by, updated_at
       FROM tool_sessions
       WHERE organization_id = ?
         AND UPPER(COALESCE(status, '')) IN ('APPROVED', 'GENERATED', 'REVIEW')
       ORDER BY updated_at DESC
       LIMIT 100`,
        [organizationId]
      )
      .catch(() => []);

    for (const row of rows) {
      // Skip sessions whose live W2 conclusion was already pushed by the tool
      // conclusion bridge (sourceModule='tool') — the push-based conclusion is
      // grounded in the session's accepted elements and must not be shadowed by
      // this coarse session-level sync.
      const pushed = await queryHelpers
        .queryOne<{ id: string }>(
          `SELECT id FROM conclusions
           WHERE organization_id = ? AND source_module = 'tool'
             AND source_artifact_refs_json LIKE ?
           LIMIT 1`,
          [organizationId, `%"id":"${String(row.id)}"%`]
        )
        .catch(() => null);
      if (pushed?.id) continue;

      const output =
        safeJsonArray<any>(row.output_json)[0] || row.output_json || row.context_snapshot;
      // H3: prefer the consultant-facing summary generated inside the session
      // answers over dumping a raw JSON snapshot as the conclusion statement.
      let answersSummary: string | null = null;
      try {
        const answers = row.answers_json ? JSON.parse(row.answers_json) : null;
        const summary = answers && typeof answers === 'object' ? (answers as any).summary : null;
        const candidate = summary?.executiveSummary || summary?.verdict;
        if (typeof candidate === 'string' && candidate.trim()) {
          answersSummary = candidate.trim();
        }
      } catch {
        // answers_json unreadable — fall through to legacy fallbacks
      }
      const statement =
        answersSummary ||
        (typeof output === 'string'
          ? output
          : row.context_snapshot || row.name || 'Tool output recommendation');
      await upsertExternalConclusion({
        organizationId,
        projectId: row.project_id ?? null,
        title: String(row.name || `${row.tool_type || 'Tool'} output`).slice(0, 180),
        statement: String(statement).slice(0, 2000),
        sourceModule: 'tools',
        sourceRefs: [
          {
            type: 'tool_session',
            id: String(row.id),
            title: row.name || null,
            url: `/my-work?tab=ideas&sessionId=${encodeURIComponent(String(row.id))}`,
          },
        ],
        confidenceLevel: Number(row.confidence_avg || 0) >= 0.7 ? 'medium' : 'low',
        limits:
          'Tool-derived conclusion; validate assumptions and source inputs before converting to execution.',
        evidenceRefs: [
          { type: 'tool_session', ref: String(row.id), excerpt: row.context_snapshot || null },
        ],
        recommendedNextAction: row.name || null,
        status:
          String(row.status || '').toUpperCase() === 'APPROVED' ? 'published' : 'needs_review',
        createdBy: row.created_by || actorUserId,
        contextSummary: row.context_snapshot || row.answers_json || '',
      });
    }

    return rows.length;
  }

  /**
   * WNIOSKI Z AUDYTU (DEC-417e, 1.1-A4). Do 06.09 `syncAllSources()` znało trzy
   * źródła — wywiad, ocenę i narzędzia. Moduł Audyty produkował raporty
   * (`audit_reports`) i nikt ich w warstwie Wniosków nie widział, więc zakładka
   * „Wnioski" Audytów byłaby pusta z definicji.
   *
   * Reguła mapowania jest JEDNA i mieszka w moście (`auditReportConclusionBridge`)
   * — ta sama, której używa jawny `POST /api/audits/reports/:id/conclusion`,
   * żeby sync i przycisk nigdy nie produkowały dwóch różnych wniosków z tego
   * samego raportu (upsert po rodowodzie dokłada resztę).
   *
   * Fail-safe: `audit_reports` nie istnieje w każdej instalacji (moduł Audytów
   * ma własną migrację), a brak tabeli nie może wywrócić synchronizacji
   * pozostałych źródeł.
   */
  async syncAuditReports(organizationId: string, actorUserId: string): Promise<number> {
    await ensureTables();
    const rows = await queryHelpers
      .queryAll<any>(
        `SELECT r.id, r.program_id, r.title, r.status, r.version, r.report_kind, r.payload,
                r.created_by, p.name AS program_name
           FROM audit_reports r
           LEFT JOIN audit_programs p ON p.id = r.program_id
          WHERE r.organization_id = ?
          ORDER BY r.updated_at DESC
          LIMIT 100`,
        [organizationId]
      )
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        logger.warn(`[ConclusionService] Audit report sync query failed: ${message}`);
        return [];
      });

    let written = 0;
    for (const row of rows) {
      // `payload` bywa obiektem (JSONB w Postgresie) albo tekstem (SQLite).
      let document: AuditReportDocumentLike | null = null;
      if (row.payload && typeof row.payload === 'object') {
        document = row.payload as AuditReportDocumentLike;
      } else if (typeof row.payload === 'string') {
        try {
          document = JSON.parse(row.payload) as AuditReportDocumentLike;
        } catch {
          document = null;
        }
      }
      if (!document) continue;

      const persisted = await safePersistAuditReportConclusion(
        {
          organizationId,
          actorUserId: row.created_by || actorUserId,
          document,
          source: {
            reportId: String(row.id),
            reportTitle: row.title || null,
            reportStatus: row.status || null,
            reportVersion: row.version ?? null,
            programId: row.program_id ? String(row.program_id) : null,
            programName: row.program_name || null,
            projectId: null,
          },
        },
        {
          // Piszemy przez TĘ instancję, nie przez singleton z modułu — most i
          // ten serwis importują się nawzajem, a sięganie po `conclusionService`
          // w cyklu ESM to proszenie się o TDZ przy pierwszym wywołaniu.
          writer: this,
          logger: { warn: (msg: string, meta?: unknown) => logger.warn(msg, meta) },
        }
      );
      if (persisted) written += 1;
    }

    return written;
  }

  async syncAllSources(
    organizationId: string,
    actorUserId: string
  ): Promise<Record<string, number>> {
    const [interview, assessment, tools, audit] = await Promise.all([
      this.syncInterviewFindings(organizationId, actorUserId),
      this.syncAssessmentReports(organizationId, actorUserId),
      this.syncToolOutputs(organizationId, actorUserId),
      this.syncAuditReports(organizationId, actorUserId),
    ]);
    return { interview, assessment, tools, audit };
  }

  async listConclusions(params: {
    organizationId: string;
    actorUserId: string;
    status?: string;
    sourceModule?: string;
    projectId?: string;
  }): Promise<Conclusion[]> {
    // 1.1-Z2 #3 (DECYZJA CTO): odczyt nie może pisać. Do 06.09 ten GET wołał
    // syncAllSources() na KAŻDYM odczycie, co dopisywało konkluzje `tools`
    // (i innych modułów) do bazy przy zwykłym otwarciu zakładki Conclusions —
    // zmierzone na żywo (4 nowe wiersze `source_module='tools'` po samym GET
    // /api/conclusions). Synchronizacja przeniesiona do jawnego wywołania:
    // `POST /api/conclusions/sync` (ten sam strażnik uprawnień co
    // dotychczasowy `POST /api/conclusions` — `conclusions.routes.ts`) i do
    // `ensureReady()`-podobnego wejścia w miejscach, które dawniej polegały
    // na tym efekcie ubocznym. `ensureTables()` — jedyny efekt uboczny, jaki
    // odczyt może mieć — zostaje (idempotentny DDL/no-op po pierwszym razie,
    // nie zapis danych organizacji).
    await ensureTables();

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
    // 1.1-Z2 #3 — patrz komentarz w listConclusions() powyżej: GET nie
    // synchronizuje już przy odczycie. `actorUserId` zostaje w sygnaturze
    // (wołający w conclusions.routes.ts go przekazuje) żeby nie zmieniać
    // kształtu wywołania — obecnie nieużywany w tej metodzie.
    void actorUserId;
    await ensureTables();
    const row = await queryHelpers.queryOne<ConclusionRow>(
      `SELECT * FROM conclusions WHERE id = ? AND organization_id = ?`,
      [conclusionId, organizationId]
    );
    return row ? rowToConclusion(row) : null;
  }

  async getSourcePack(organizationId: string, sourcePackId: string): Promise<SourcePack | null> {
    await ensureTables();
    const row = await queryHelpers.queryOne<SourcePackRow>(
      `SELECT * FROM conclusion_source_packs WHERE id = ? AND organization_id = ?`,
      [sourcePackId, organizationId]
    );
    return row ? rowToSourcePack(row) : null;
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
