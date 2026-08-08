/**
 * Report Builder Service
 *
 * Handles report creation, section management, and AI content generation.
 * Generic service designed to work with multiple source types (Assessment, Interview, Tool).
 */

import { v4 as uuidv4 } from 'uuid';

import { DRD_STRUCTURE } from '../data/drdStructure.js';
import type { IDatabase } from '../database/IDatabase.js';
import { getDatabase } from '../database/index.js';
import logger from '../utils/Logger.js';
import { parseMaybeJson } from '../utils/pgFlags.js';
import { createPinnedClientContext } from '../utils/pinnedTransactionClient.js';
import type { PgTransactionClient } from '../utils/queryHelpers.js';
import { upsertAssessmentReportForBuilder } from './assessmentReportBuilderLinkService.js';
import * as artifactRegistryService from './v8/artifactRegistryService.js';

// ==========================================
// TYPES
// ==========================================

export type ReportSourceType =
  | 'ASSESSMENT'
  | 'INTERVIEW'
  | 'TOOL'
  | 'INITIATIVE'
  | 'UPLOAD_BUNDLE'
  | 'FINANCIAL_ANALYSIS'
  | 'VALUATION'
  | 'RESULTS_KPI_REPORT'
  // P1-3 — Canvas-promoted reports get their own discriminant so report-list
  // filters can distinguish "narrative drafts promoted from Canvas" from
  // "actual upload bundles" (the W2-E4 fix used UPLOAD_BUNDLE as the least-
  // wrong existing value; this closes the audit's "right discriminant but
  // wrong sub-semantic" finding).
  | 'WORK_CANVAS'
  // PM2 (flagowy raport 3 osi, `_KONCEPT_PROGRAM_MANAGEMENT_2026-07-10.md` §6) —
  // dedykowany discriminant zamiast przeciążania RESULTS_KPI_REPORT/INITIATIVE;
  // sourceId = projectId|programId|organizationId (patrz threeAxisReportService.ts).
  | 'PROGRAM_3AXIS'
  // Finance report section (silnik→raport, `_KONCEPT_FINANCE_2026-07-10.md` §3/§5) —
  // wskaźniki (financeRatioFamilyCatalog) + reconcile R1-R8 (reconciliationService,
  // shadow) + koszyk EV (valuationBasketService). Osobny discriminant z tego samego
  // powodu co PROGRAM_3AXIS: 'FINANCIAL_ANALYSIS'/'VALUATION' są starszymi silnikami
  // (financialAnalysisService / raw valuationService), nie tym kompozytem.
  // sourceId = statementPackId (patrz financeReportSectionService.ts).
  | 'FINANCE_SECTION'
  // D12+D13 (raporty PM na start — `_DECYZJE_PIOTRA_2026-07-12.md`) — 3 pakiety
  // (Sponsor One-Pager / Steering / PMO Weekly), każdy własny report_type, ten sam
  // discriminant. Kompozyt nad PROGRAM_3AXIS + istniejące read-modele (ryzyka,
  // decyzje, capacity, cycle-time) — patrz `programManagementReportsService.ts`.
  // sourceId = projectId|programId|organizationId (jak PROGRAM_3AXIS).
  | 'PROGRAM_MANAGEMENT'
  // U02 — Transformation final outputs. The native Report Builder artifact is the
  // canonical, editable truth for the closing report; DOCX is only its export.
  // sourceId = transformation_case_id (patrz transformationFinalOutputService.ts).
  | 'TRANSFORMATION_CASE';
export type ReportStatus =
  | 'DRAFT'
  | 'CONFIGURING'
  | 'GENERATING'
  | 'GENERATED'
  | 'IN_REVIEW'
  | 'APPROVED'
  | 'SENT_INTERNAL'
  | 'SENT_EXTERNAL'
  | 'UTILIZED';
export type SectionLength = 'short' | 'medium' | 'long';
export type SectionLanguage = 'technical' | 'business' | 'general';
export type SectionType =
  | 'cover'
  | 'summary'
  | 'methodology'
  | 'matrix'
  | 'axis_analysis'
  | 'list'
  | 'recommendations'
  | 'action_plan'
  | 'initiatives'
  | 'appendix'
  | 'custom';

export type ReportTypeV3 = 'R1' | 'R2' | 'R3' | 'R4' | 'custom';
export type CommunicationRegister = 'executive' | 'professional' | 'technical' | 'narrative';
export type ReportDensity = 'concise' | 'standard' | 'detailed' | 'comprehensive';
export type ReportForm = 'strategic' | 'operational' | 'technical' | 'investment';
export type DataLevel = 'data-heavy' | 'balanced' | 'narrative-heavy';
export type Confidentiality = 'confidential' | 'internal' | 'public';
export type GoalV3 = 'inform' | 'decide' | 'sell' | 'align';
export type RagStatus = 'green' | 'amber' | 'red';

export interface SourceRef {
  artifact_id: string;
  artifact_type: string;
  artifact_name: string;
}

export interface ReportRecord {
  id: string;
  organizationId: string;
  projectId?: string;
  templateId?: string;
  sourceType: ReportSourceType;
  sourceId: string;
  sourceName?: string;
  sourceFramework?: string;
  title: string;
  description?: string;
  reportType: string;
  config?: Record<string, unknown>;
  companyContext?: Record<string, unknown>;
  status: ReportStatus;
  createdBy: string;
  /** @deprecated DB column name - use createdBy */
  created_by?: string;
  createdAt: string;
  updatedAt: string;
  generatedAt?: string;
  approvedAt?: string;
  approvedBy?: string;
  version: number;
  // Archive (#68e) — orthogonal to `status`; archivedAt set means hidden from default
  // listReports() results but the underlying workflow status is preserved for restore.
  archivedAt?: string;
  archivedBy?: string;
  // V3 Report Definition Layer
  reportTypeV3?: ReportTypeV3;
  periodFrom?: string;
  periodTo?: string;
  communicationRegister?: CommunicationRegister;
  density?: ReportDensity;
  form?: ReportForm;
  dataLevel?: DataLevel;
  confidentiality?: Confidentiality;
  themeId?: string;
  contextPackSnapshot?: string;
  goalV3?: GoalV3;
  sourceRefs?: SourceRef[];
}

export interface SectionRecord {
  id: string;
  reportId: string;
  sectionKey: string;
  sectionType: SectionType;
  title: string;
  orderIndex: number;
  enabled: boolean;
  required: boolean;
  length: SectionLength;
  language: SectionLanguage;
  customPrompt?: string;
  blockTypeId?: string;
  blockConfig?: Record<string, unknown>;
  renderKind?: string;
  generatedContent?: string;
  editedContent?: string;
  contentFormat: string;
  tiptapContent?: string;
  sourceDataSnapshot?: string;
  generatedAt?: string;
  tokensUsed?: number;
  editedAt?: string;
  editedBy?: string;
  repeatFor?: string;
  repeatKey?: string;
  repeatName?: string;
  repeatData?: string;
  chapterKey?: string;
  chapterTitle?: string;
  // V3 fields
  rag?: RagStatus;
  summary?: string;
  sourceRefs?: SourceRef[];
  isRefreshable?: boolean;
  lastDataTimestamp?: string;
}

export interface CreateReportParams {
  organizationId: string;
  sourceType: ReportSourceType;
  sourceId: string;
  sourceName?: string;
  title: string;
  description?: string;
  /**
   * Report-level configuration snapshot captured before generation.
   * Used for "intent" (audience/goal/scope/etc) and invocation profile selection.
   */
  config?: Record<string, unknown>;
  createdBy: string;
  templateId?: string;
  reportTypeV3?: ReportTypeV3;
  goalV3?: GoalV3;
  communicationRegister?: CommunicationRegister;
  density?: ReportDensity;
  periodFrom?: string;
  periodTo?: string;
  confidentiality?: string;
}

export interface GenerateFromTemplateOptions {
  assessmentId?: string;
  projectId?: string;
  title?: string;
  description?: string;
  config?: Record<string, unknown>;
}

export interface UpdateSectionConfigParams {
  sectionKey: string;
  enabled?: boolean;
  orderIndex?: number;
  length?: SectionLength;
  language?: SectionLanguage;
  customPrompt?: string;
  title?: string;
  chapterKey?: string | null;
  chapterTitle?: string | null;
  isRefreshable?: boolean;
  lastDataTimestamp?: string | null;
}

export interface GenerateSectionParams {
  reportId: string;
  sectionKey: string;
  regenerate?: boolean;
}

export type BlockRenderKind = 'markdown' | 'callout' | 'table' | 'chart' | 'matrix' | 'json';

export type BlockCategory = 'content' | 'data' | 'visual';

export interface BlockTypeRecord {
  id: string;
  organizationId?: string | null;
  name: string;
  description?: string | null;
  sourceTypes?: string[] | null;
  renderKind: BlockRenderKind;
  promptTemplate?: string | null;
  inputSchema?: Record<string, unknown> | null;
  defaultLength?: SectionLength;
  defaultLanguage?: SectionLanguage;
  isSystem?: boolean;
  isActive?: boolean;
  category?: BlockCategory;
  displayOrder?: number;
  /** Explicit slide intent for PPTX v2 pipeline (from migration 525) */
  slideIntent?: string | null;
  /** PPTX-specific prompt that generates structured JSON (from migration 525) */
  pptxPromptTemplate?: string | null;
  /** JSON Schema for validating PPTX prompt output (from migration 525) */
  pptxOutputSchema?: Record<string, unknown> | null;
  createdBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

// ==========================================
// DATABASE HELPERS
// ==========================================

let db: IDatabase = getDatabase();

export function setDependencies(newDeps: { db?: IDatabase } = {}): void {
  if (newDeps.db) db = newDeps.db;
}

/**
 * Referencja do artefaktu w kontrakcie `contextPackBuilder.SourceRef`.
 * ⚠ NIE mylić z `source_refs_json` prezentacji — tam ta sama nazwa kolumny trzyma
 * metadane pochodzenia (`{source:'blank_manual'}`), a nie tablicę referencji.
 */
type ReportSourceRef = { artifact_id: string; artifact_type: string; artifact_name: string };

/**
 * OGNIWO 8 (tor MVP, 2026-07-28) — most między raportem a danymi systemu.
 *
 * PRZYCZYNA: `source_refs_json` w module raportów był czytany w 13 miejscach i
 * zapisywany w ZERO. Skutek łańcuchowy w `reportGenerationService.ts:974`:
 * pusta lista źródeł → contextPack zawsze „lightweight" → raport bez ani jednej
 * liczby z systemu → konsultant przepisywał dane ręcznie.
 *
 * MODEL (wytyczna Piotra 2026-07-28): assessment, wywiad i narzędzie to trzy
 * PRZYCZYNKI do budowy inicjatyw. Dlatego wartość raportu z assessmentu leży nie
 * w samym assessmencie, lecz w inicjatywach, które z niego wyrosły — i to je
 * podajemy do ContextPacka. To także wyjaśnia, dlaczego `buildContextPack` nie ma
 * typu „assessment": nie jest mu potrzebny.
 *
 * FAIL-SOFT: każdy błąd → pusta lista. Most nigdy nie może zablokować powstania
 * raportu; brak referencji oznacza tylko powrót do dotychczasowego zachowania.
 */
async function resolveReportSourceRefs(
  sourceType: string,
  sourceId: string | null | undefined,
  organizationId: string
): Promise<ReportSourceRef[]> {
  const refs: ReportSourceRef[] = [];
  const st = String(sourceType || '').toUpperCase();
  const sid = sourceId ? String(sourceId) : '';
  if (!sid || !organizationId) return refs;

  // Sam obiekt źródłowy — TYLKO gdy ContextPack zna ten typ (patrz
  // `contextPackBuilder.ts:221-260`). Dla ASSESSMENT/WORK_CANVAS nie zna, więc
  // nie dokładamy referencji, której builder i tak by nie obsłużył.
  if (st === 'TOOL') {
    refs.push({ artifact_id: sid, artifact_type: 'tool_session', artifact_name: 'Tool session' });
  }

  // Inicjatywy zrodzone z tego przyczynku. `source_type` inicjatywy używa innego
  // słownika niż `source_type` raportu (assessment/tool/interview_insight vs
  // ASSESSMENT/TOOL/INTERVIEW) — stąd jawne mapowanie zamiast porównania wprost.
  const initiativeSourceType =
    st === 'ASSESSMENT'
      ? 'assessment'
      : st === 'TOOL'
        ? 'tool'
        : st === 'INTERVIEW'
          ? 'interview_insight'
          : null;

  try {
    const rows = await queryAll<{ id: string; title: string }>(
      `SELECT id, title FROM initiatives
        WHERE organization_id = ?
          AND (
            source_assessment_id = ?
            OR source_report_id = ?
            OR (source_id = ? AND lower(coalesce(source_type, '')) = ?)
          )
        LIMIT 50`,
      [organizationId, sid, sid, sid, initiativeSourceType || '']
    );
    for (const r of rows) {
      if (!r?.id) continue;
      refs.push({
        artifact_id: String(r.id),
        artifact_type: 'initiative',
        artifact_name: String(r.title || 'Initiative'),
      });
    }
  } catch (err) {
    logger.warn('[ReportBuilder] resolveReportSourceRefs: initiatives lookup failed', {
      error: err,
      sourceType: st,
    });
  }

  // WYWIAD — przeskok przez insighty (2026-07-28, po zmianie zakresu MVP na ścieżkę
  // wywiadu). Zapytanie powyżej dla `INTERVIEW` nie trafi NIGDY: raport z wywiadu
  // wskazuje **sesję**, a inicjatywa wskazuje **insight**. Łańcuch jest dwuczłonowy:
  //   raport.source_id = sesja → interview_insights.session_id → initiatives.source_id
  // Samych insightów nie dokładamy — `buildContextPack` nie zna takiego typu; wartość
  // wywiadu materializuje się w inicjatywach (ta sama zasada co przy assessmencie).
  // Pomijamy zarchiwizowane insighty: 27.07 zarchiwizowano 14 z 15 jako śmieci testowe,
  // a mimo to miały pod sobą inicjatywy — raport nie może się karmić śmieciami.
  if (st === 'INTERVIEW') {
    try {
      const viaInsights = await queryAll<{ id: string; title: string }>(
        `SELECT i.id, i.title
           FROM initiatives i
           JOIN interview_insights ii ON i.source_id = ii.id
          WHERE i.organization_id = ?
            AND ii.session_id = ?
            AND ii.archived_at IS NULL
          LIMIT 50`,
        [organizationId, sid]
      );
      const juzMamy = new Set(refs.map((r) => r.artifact_id));
      for (const r of viaInsights) {
        if (!r?.id || juzMamy.has(String(r.id))) continue;
        refs.push({
          artifact_id: String(r.id),
          artifact_type: 'initiative',
          artifact_name: String(r.title || 'Initiative'),
        });
      }
    } catch (err) {
      logger.warn('[ReportBuilder] resolveReportSourceRefs: interview insight hop failed', {
        error: err,
      });
    }
  }

  return refs;
}

/**
 * U02 — transaction pinning for the Report Builder owner module.
 *
 * An orchestrator that already owns a `withPgTransaction` client (today: the
 * Transformation final-output publisher) donates it here, and every query below
 * runs on that transaction instead of the pooled handle. Without a donated
 * client the behaviour is byte-for-byte the previous pooled behaviour, so all
 * existing callers are unaffected.
 */
const reportBuilderTransaction = createPinnedClientContext('report_builder');

export function withReportBuilderClient<T>(
  client: PgTransactionClient,
  fn: () => Promise<T>
): Promise<T> {
  return reportBuilderTransaction.withClient(client, fn);
}

export function isReportBuilderTransactionPinned(): boolean {
  return reportBuilderTransaction.isPinned();
}

function queryAll<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const pinned = reportBuilderTransaction.current();
  if (pinned) return pinned.query<T>(sql, params).then((result) => result.rows || []);
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err: Error | null, rows: T[]) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

function queryOne<T>(sql: string, params: unknown[] = []): Promise<T | null> {
  const pinned = reportBuilderTransaction.current();
  if (pinned) return pinned.query<T>(sql, params).then((result) => result.rows[0] ?? null);
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err: Error | null, row: T | null) => {
      if (err) reject(err);
      else resolve(row || null);
    });
  });
}

function queryRun(
  sql: string,
  params: unknown[] = []
): Promise<{ changes: number; lastID: number }> {
  const pinned = reportBuilderTransaction.current();
  if (pinned)
    return pinned.query(sql, params).then((result) => ({ changes: result.rowCount ?? 0, lastID: 0 }));
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (this: { changes: number; lastID: number }, err: Error | null) {
      if (err) reject(err);
      else resolve({ changes: this.changes, lastID: this.lastID });
    });
  });
}

// ==========================================
// ASSESSMENT SOURCE ADAPTER
// ==========================================

interface AssessmentSourceData {
  id: string;
  name: string;
  assessmentType: string;
  status: string;
  projectId?: string;
  organizationName: string;
  answers: Record<string, unknown>;
  scores: Record<string, unknown>;
  context: Record<string, unknown>;
  approvedAt: string;
  createdByName: string;
}

async function getAssessmentSourceData(sourceId: string): Promise<AssessmentSourceData | null> {
  const row = await queryOne<{
    id: string;
    name: string;
    assessment_type: string;
    status: string;
    organization_id: string;
    project_id?: string;
    answers_json: string;
    score_summary: string;
    context_snapshot: string;
    approved_at: string;
    created_by: string;
  }>(
    `
    SELECT a.*, o.name as org_name, u.first_name || ' ' || u.last_name as created_by_name
    FROM assessments a
    LEFT JOIN organizations o ON a.organization_id = o.id
    LEFT JOIN users u ON a.created_by = u.id
    WHERE a.id = ?
  `,
    [sourceId]
  );

  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    assessmentType: row.assessment_type,
    status: row.status,
    projectId: (row as any).project_id,
    organizationName: (row as any).org_name || 'Unknown',
    answers: JSON.parse(row.answers_json || '{}'),
    scores: JSON.parse(row.score_summary || '{}'),
    context: JSON.parse(row.context_snapshot || '{}'),
    approvedAt: row.approved_at,
    createdByName: (row as any).created_by_name || 'Unknown',
  };
}

// ==========================================
// FINANCE SOURCE ADAPTERS (FINANCIAL_ANALYSIS + T054 model via config.sourceSubType)
// ==========================================

interface FinancialAnalysisSourceData {
  id: string;
  title: string;
  status: string;
  projectId?: string | null;
  currency: string;
  periods: string[];
  sourceStatementIds: string[];
  ratiosCount: number;
  insightsCount: number;
  updatedAt?: string | null;
}

async function getFinancialAnalysisSourceData(
  organizationId: string,
  sourceId: string
): Promise<FinancialAnalysisSourceData | null> {
  const row = await queryOne<any>(
    `
    SELECT id, organization_id, project_id, title, status, periods, currency, source_statement_ids, updated_at
    FROM financial_analyses
    WHERE id = ? AND organization_id = ?
  `,
    [sourceId, organizationId]
  );
  if (!row) return null;

  const ratiosCountRow = await queryOne<{ c: number }>(
    `SELECT COUNT(*) as c FROM financial_analysis_ratios WHERE analysis_id = ?`,
    [sourceId]
  );
  const insightsCountRow = await queryOne<{ c: number }>(
    `SELECT COUNT(*) as c FROM financial_analysis_insights WHERE analysis_id = ?`,
    [sourceId]
  );

  return {
    id: row.id,
    title: row.title,
    status: row.status,
    projectId: row.project_id || null,
    currency: row.currency || 'PLN',
    periods: (() => {
      try {
        const p = parseMaybeJson(row.periods, []);
        return Array.isArray(p) ? p : [];
      } catch {
        return [];
      }
    })(),
    sourceStatementIds: (() => {
      try {
        const ids = parseMaybeJson(row.source_statement_ids, []);
        return Array.isArray(ids) ? ids : [];
      } catch {
        return [];
      }
    })(),
    ratiosCount: Number((ratiosCountRow as any)?.c || 0),
    insightsCount: Number((insightsCountRow as any)?.c || 0),
    updatedAt: row.updated_at || null,
  };
}

interface FinancialModelSourceData {
  id: string;
  name: string;
  status: string;
  projectId?: string | null;
  currency: string;
  granularity: string;
  scenario: string;
  horizonMonths: number;
  startDate: string;
  version: number;
  updatedAt?: string | null;
}

async function getFinancialModelSourceData(
  organizationId: string,
  modelId: string
): Promise<FinancialModelSourceData | null> {
  const row = await queryOne<any>(
    `
    SELECT id, organization_id, project_id, name, status, currency, granularity, scenario,
           horizon_months, start_date, version, updated_at
    FROM financial_models
    WHERE id = ? AND organization_id = ?
  `,
    [modelId, organizationId]
  );
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    projectId: row.project_id || null,
    currency: row.currency || 'PLN',
    granularity: row.granularity || 'monthly',
    scenario: row.scenario || 'base',
    horizonMonths: Number(row.horizon_months || 0),
    startDate: String(row.start_date || ''),
    version: Number(row.version || 1),
    updatedAt: row.updated_at || null,
  };
}

function extractAxisData(
  answers: Record<string, unknown>,
  axisId: string
): Record<string, unknown> {
  const drdAnswers = (answers as any)?.drd?.areas || {};
  const axisAreas: Record<string, unknown> = {};

  // Find areas for this axis (e.g., axis 1 has areas 1A, 1B, 1C...)
  for (const [areaId, areaData] of Object.entries(drdAnswers)) {
    if (areaId.startsWith(axisId)) {
      axisAreas[areaId] = areaData;
    }
  }

  return axisAreas;
}

// ==========================================
// CORE SERVICE FUNCTIONS
// ==========================================

/**
 * List available assessment sources (approved only)
 */
export async function listAssessmentSources(organizationId: string): Promise<
  Array<{
    id: string;
    name: string;
    type: string;
    status: string;
    framework: string;
    approvedAt: string;
  }>
> {
  const rows = await queryAll<{
    id: string;
    name: string;
    assessment_type: string;
    status: string;
    approved_at: string;
  }>(
    `
    SELECT id, name, assessment_type, status, approved_at
    FROM assessments
    WHERE organization_id = ? AND status = 'APPROVED'
    ORDER BY approved_at DESC
    LIMIT 50
  `,
    [organizationId]
  );

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    type: 'ASSESSMENT',
    status: r.status,
    framework: r.assessment_type,
    approvedAt: r.approved_at,
  }));
}

/**
 * Get template for source type
 */
export async function getTemplateForSource(
  sourceType: ReportSourceType,
  framework?: string,
  organizationId?: string
): Promise<{ id: string; sections: unknown[] } | null> {
  const reportType = framework ? `${sourceType}_${framework}` : sourceType;
  // P1-3 — WORK_CANVAS has no dedicated template yet; fall back to INTERVIEW
  // (same fallback UPLOAD_BUNDLE uses) so Canvas-promoted reports render with
  // a sensible default section set until a Canvas-specific template lands.
  const fallbackSourceType =
    sourceType === 'UPLOAD_BUNDLE' || sourceType === 'WORK_CANVAS' ? 'INTERVIEW' : sourceType;

  let row: { id: string; sections_json: string } | null = null;
  try {
    row = await queryOne<{ id: string; sections_json: string }>(
      `
      SELECT id, sections_json
      FROM report_builder_templates
      WHERE (source_type = ? OR source_type = ?)
        AND (report_type = ? OR report_type = ? OR report_type IS NULL)
        AND (organization_id IS NULL OR organization_id = ?)
        AND is_default = 1
      ORDER BY
        CASE WHEN source_type = ? THEN 0 ELSE 1 END,
        CASE WHEN report_type = ? THEN 0 WHEN report_type = ? THEN 1 ELSE 2 END
      LIMIT 1
    `,
      [
        sourceType,
        fallbackSourceType,
        reportType,
        fallbackSourceType,
        organizationId || null,
        sourceType,
        reportType,
        fallbackSourceType,
      ]
    );
  } catch (err: any) {
    // Graceful degradation: in some local SQLite DBs this optional table may not exist yet.
    // Returning null lets the route respond 404 instead of crashing the whole UI with 500.
    const msg = String(err?.message || '').toLowerCase();
    const code = String(err?.code || '').toUpperCase();
    if (code === 'SQLITE_ERROR' && msg.includes('no such table: report_builder_templates')) {
      return null;
    }
    throw err;
  }

  if (!row) {
    // Second pass: any is_default template for this source_type, ignoring specific report_type.
    // Handles cases like TOOL where templates use named report_types (tool_evaluation, etc.)
    // but the caller passes no framework so the exact match on report_type fails.
    try {
      row = await queryOne<{ id: string; sections_json: string }>(
        `
        SELECT id, sections_json
        FROM report_builder_templates
        WHERE (source_type = ? OR source_type = ?)
          AND (organization_id IS NULL OR organization_id = ?)
          AND is_default = 1
        ORDER BY CASE WHEN source_type = ? THEN 0 ELSE 1 END
        LIMIT 1
      `,
        [sourceType, fallbackSourceType, organizationId || null, sourceType]
      );
    } catch {
      // ignore — outer null return handles missing templates gracefully
    }
  }

  if (!row) {
    // Production datasets created before the default-template seed may contain
    // valid source templates with no row marked `is_default`. Do not make a
    // durable output impossible because of that metadata drift: select one
    // visible template deterministically, preferring the tenant-owned row.
    row = await queryOne<{ id: string; sections_json: string }>(
      `
      SELECT id, sections_json
      FROM report_builder_templates
      WHERE (source_type = ? OR source_type = ?)
        AND (organization_id IS NULL OR organization_id = ?)
      ORDER BY
        CASE WHEN organization_id = ? THEN 0 ELSE 1 END,
        CASE WHEN source_type = ? THEN 0 ELSE 1 END,
        id ASC
      LIMIT 1
    `,
      [sourceType, fallbackSourceType, organizationId || null, organizationId || null, sourceType]
    );
  }

  if (!row) return null;

  return {
    id: row.id,
    sections: JSON.parse(row.sections_json || '[]'),
  };
}

/**
 * Create a new report from source
 */
// ==========================================
// U02 — NATIVE (DETERMINISTIC) REPORT CREATION
// ==========================================

export interface NativeReportSectionInput {
  sectionKey: string;
  sectionType: SectionType;
  title: string;
  orderIndex: number;
  /** Already-rendered markdown. Deterministic: no template lookup, no LLM. */
  content: string;
  required?: boolean;
  renderKind?: string;
  sourceRefs?: ReportSourceRef[];
}

export interface CreateNativeReportParams {
  organizationId: string;
  projectId?: string | null;
  sourceType: ReportSourceType;
  sourceId: string;
  sourceName?: string | null;
  title: string;
  description?: string | null;
  reportType: string;
  status: ReportStatus;
  createdBy: string;
  createdAt: string;
  config?: Record<string, unknown>;
  sourceRefs?: ReportSourceRef[];
  sections: NativeReportSectionInput[];
  /** Registry receipt is required by U02; callers may disable it for pure unit contracts. */
  registerArtifact?: boolean;
  contextSnapshotId?: string | null;
  executionRunId?: string | null;
  originSummary?: Record<string, unknown>;
}

export interface CreateNativeReportResult {
  reportId: string;
  sectionIds: string[];
  registryArtifactId: string | null;
}

/**
 * U02 — create a Report Builder artifact from a caller-supplied, deterministic
 * section list.
 *
 * Deliberately NOT `createReport`: that path resolves a template, reads the
 * source module (assessment/finance/…) and derives content, none of which is
 * reproducible for a governed publication. Here the caller has already frozen
 * the numeric truth (the Transformation facts snapshot), so the same facts must
 * always yield the same rows.
 *
 * Every write goes through `queryRun`, so when the caller pinned a transaction
 * via `withReportBuilderClient` the report, its sections and the registry
 * receipt live or die with the caller's COMMIT. That is why this function has
 * no compensating DELETEs: hand-rolled compensation is what a real transaction
 * boundary replaces.
 */
export async function createNativeReport(
  params: CreateNativeReportParams
): Promise<CreateNativeReportResult> {
  if (!params.organizationId) throw new Error('native_report_organization_required');
  if (!params.sections.length) throw new Error('native_report_sections_required');

  const reportId = uuidv4();
  const now = params.createdAt;
  const projectId = params.projectId ?? null;
  const sourceRefs = params.sourceRefs && params.sourceRefs.length ? params.sourceRefs : null;

  await queryRun(
    `
      INSERT INTO report_builder_reports (
        id, organization_id, project_id, source_type, source_id, source_name, source_framework,
        title, description, report_type, template_id, config_json, company_context_json, status,
        created_by, created_at, updated_at, generated_at, version, source_refs_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    `,
    [
      reportId,
      params.organizationId,
      projectId,
      params.sourceType,
      params.sourceId,
      params.sourceName ?? null,
      null,
      params.title,
      params.description ?? null,
      params.reportType,
      null,
      params.config ? JSON.stringify(params.config) : null,
      null,
      params.status,
      params.createdBy,
      now,
      now,
      now,
      sourceRefs ? JSON.stringify(sourceRefs) : null,
    ]
  );

  const sectionIds: string[] = [];
  for (const section of params.sections) {
    const sectionId = uuidv4();
    sectionIds.push(sectionId);
    await queryRun(
      `
        INSERT INTO report_builder_sections (
          id, report_id, section_key, section_type, title, order_index,
          enabled, required, length, language, content_format,
          generated_content, generated_at, render_kind, source_refs_json,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'medium', 'business', 'markdown', ?, ?, ?, ?, ?, ?)
      `,
      [
        sectionId,
        reportId,
        section.sectionKey,
        section.sectionType,
        section.title,
        section.orderIndex,
        true,
        section.required ?? true,
        section.content,
        now,
        section.renderKind ?? 'markdown',
        section.sourceRefs && section.sourceRefs.length
          ? JSON.stringify(section.sourceRefs)
          : sourceRefs
            ? JSON.stringify(sourceRefs)
            : null,
        now,
        now,
      ]
    );
  }

  let registryArtifactId: string | null = null;
  if (params.registerArtifact !== false) {
    const artifact = await artifactRegistryService.registerArtifactOrigin({
      organizationId: params.organizationId,
      outputType: 'report',
      artifactFamily: 'document',
      originRuntime: 'report',
      originRecordId: reportId,
      titleSnapshot: params.title,
      ownerUserId: params.createdBy,
      createdBy: params.createdBy,
      deliveryState: artifactRegistryService.mapReportStatusToDeliveryState(params.status),
      visibilityScope: artifactRegistryService.deriveArtifactVisibilityScope({
        outputType: 'report',
        projectId,
        ownerUserId: params.createdBy,
      }),
      projectId,
      contextSnapshotId: params.contextSnapshotId ?? undefined,
      executionRunId: params.executionRunId ?? undefined,
      originSummary: {
        sourceType: params.sourceType,
        sourceId: params.sourceId,
        reportType: params.reportType,
        nativeStatus: params.status,
        sourceTable: 'report_builder_reports',
        ...(params.originSummary ?? {}),
      },
    });
    if (!artifact) throw new Error('native_report_artifact_registration_failed');
    registryArtifactId = artifact.artifactId;
  }

  return { reportId, sectionIds, registryArtifactId };
}

export async function createReport(params: CreateReportParams): Promise<{
  report: ReportRecord;
  sections: SectionRecord[];
}> {
  const {
    organizationId,
    sourceType,
    sourceId,
    sourceName: sourceNameInput,
    title,
    description,
    config,
    createdBy,
    templateId,
  } = params;

  // Get source data
  let sourceName = sourceNameInput || '';
  let sourceFramework = '';
  let projectId: string | null = null;
  let companyContext: Record<string, unknown> = {};

  if (sourceType === 'ASSESSMENT') {
    const assessment = await getAssessmentSourceData(sourceId);
    if (!assessment) throw new Error('Assessment not found');
    if (assessment.status !== 'APPROVED') throw new Error('Assessment is not approved');

    sourceName = assessment.name;
    sourceFramework = assessment.assessmentType;
    projectId = assessment.projectId ? String(assessment.projectId) : null;
    companyContext = {
      organizationName: assessment.organizationName,
      assessmentType: assessment.assessmentType,
      ...assessment.context,
    };
  }

  if (sourceType === 'FINANCIAL_ANALYSIS') {
    // Support both: (a) true financial analysis artifact, (b) T054 model export routed through FINANCIAL_ANALYSIS
    const subType = String((config as any)?.sourceSubType || '').toLowerCase();
    if (subType === 'financial_model') {
      const model = await getFinancialModelSourceData(organizationId, sourceId);
      if (!model) throw new Error('Financial model not found');
      sourceName = model.name;
      projectId = model.projectId ? String(model.projectId) : null;
      companyContext = {
        financeSourceType: 'financial_model',
        model: {
          id: model.id,
          name: model.name,
          status: model.status,
          currency: model.currency,
          granularity: model.granularity,
          scenario: model.scenario,
          horizonMonths: model.horizonMonths,
          startDate: model.startDate,
          version: model.version,
          updatedAt: model.updatedAt,
        },
      };
    } else {
      const fa = await getFinancialAnalysisSourceData(organizationId, sourceId);
      if (!fa) throw new Error('Financial analysis not found');
      sourceName = fa.title;
      projectId = fa.projectId ? String(fa.projectId) : null;
      companyContext = {
        financeSourceType: 'financial_analysis',
        analysis: {
          id: fa.id,
          title: fa.title,
          status: fa.status,
          currency: fa.currency,
          periods: fa.periods,
          sourceStatementIds: fa.sourceStatementIds,
          ratiosCount: fa.ratiosCount,
          insightsCount: fa.insightsCount,
          updatedAt: fa.updatedAt,
        },
      };
    }
  }

  // Get template
  const derivedReportType = sourceFramework ? `${sourceType}_${sourceFramework}` : sourceType;

  let templateIdToUse: string | undefined;
  let templateSections: unknown[] = [];

  if (templateId) {
    const tpl = await getTemplateById(templateId, organizationId);
    if (!tpl) throw new Error('Template not found');

    // Validate compatibility
    const tplSourceType = String((tpl as any).source_type || '').toUpperCase();
    const tplReportType = (tpl as any).report_type ? String((tpl as any).report_type) : null;
    const isUploadBundleTemplateFallback =
      sourceType === 'UPLOAD_BUNDLE' && (tplSourceType === 'INTERVIEW' || tplSourceType === 'TOOL');
    if (tplSourceType && tplSourceType !== sourceType && !isUploadBundleTemplateFallback) {
      throw new Error('Template source type mismatch');
    }
    const isUploadBundleReportTypeFallback =
      sourceType === 'UPLOAD_BUNDLE' && (tplReportType === 'INTERVIEW' || tplReportType === 'TOOL');
    if (tplReportType && tplReportType !== derivedReportType && !isUploadBundleReportTypeFallback) {
      throw new Error('Template report type mismatch');
    }

    templateIdToUse = String((tpl as any).id);
    templateSections = (tpl as any).sections_json
      ? JSON.parse(String((tpl as any).sections_json || '[]'))
      : [];
  } else {
    const template = await getTemplateForSource(sourceType, sourceFramework, organizationId);
    if (!template) throw new Error('No template found for this source type');
    templateIdToUse = template.id;
    templateSections = template.sections || [];
  }

  const reportId = uuidv4();
  const reportType = derivedReportType;
  const now = new Date().toISOString();

  // OGNIWO 8 (tor MVP): referencje do artefaktów, z których raport ma czerpać
  // liczby. Bez tego zapisu `reportGenerationService` zawsze schodzi na pusty
  // contextPack — patrz komentarz przy `resolveReportSourceRefs`.
  const resolvedSourceRefs = await resolveReportSourceRefs(sourceType, sourceId, organizationId);
  if (resolvedSourceRefs.length === 0) {
    logger.info('[ReportBuilder] Brak referencji zrodlowych dla raportu', {
      reportId,
      sourceType,
      hint: 'contextPack bedzie lightweight — raport bez danych z systemu',
    });
  }

  const baseReportValues = [
    reportId,
    organizationId,
    projectId,
    sourceType,
    sourceId,
    sourceName,
    sourceFramework,
    title,
    description,
    reportType,
    templateIdToUse || null,
    config ? JSON.stringify(config) : null,
    JSON.stringify(companyContext),
    createdBy,
    now,
    now,
  ];
  const hasV3Configuration = Boolean(
    params.reportTypeV3 ||
    params.goalV3 ||
    params.communicationRegister ||
    params.density ||
    params.periodFrom ||
    params.periodTo ||
    params.confidentiality
  );

  // Older, otherwise valid Report Builder schemas do not have the optional V3
  // columns. Standard reports must not fail merely because those unused fields
  // are absent. V3 reports still use the strict extended insert and therefore
  // fail closed when their required schema has not been migrated.
  if (!hasV3Configuration) {
    await queryRun(
      `
      INSERT INTO report_builder_reports (
        id, organization_id, project_id, source_type, source_id, source_name, source_framework,
        title, description, report_type, template_id, config_json, company_context_json, status,
        created_by, created_at, updated_at, version, source_refs_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CONFIGURING', ?, ?, ?, 1, ?)
    `,
      [
        ...baseReportValues,
        resolvedSourceRefs.length > 0 ? JSON.stringify(resolvedSourceRefs) : null,
      ]
    );
  } else {
    await queryRun(
      `
      INSERT INTO report_builder_reports (
        id, organization_id, project_id, source_type, source_id, source_name, source_framework,
        title, description, report_type, template_id, config_json, company_context_json, status,
        created_by, created_at, updated_at, version,
        report_type_v3, goal_v3, communication_register, density, period_from, period_to, confidentiality,
        source_refs_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CONFIGURING', ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        ...baseReportValues,
        params.reportTypeV3 || null,
        params.goalV3 || null,
        params.communicationRegister || null,
        params.density || null,
        params.periodFrom || null,
        params.periodTo || null,
        params.confidentiality || null,
        resolvedSourceRefs.length > 0 ? JSON.stringify(resolvedSourceRefs) : null,
      ]
    );
  }

  // Create sections from template
  const typedTemplateSections = templateSections as Array<{
    key: string;
    type: SectionType;
    title: string;
    required: boolean;
    order: number;
    defaultLength?: SectionLength;
    defaultLanguage?: SectionLanguage;
    repeatFor?: string;
    repeatKey?: string;
  }>;

  const sections: SectionRecord[] = [];

  for (const tplSection of typedTemplateSections) {
    const sectionId = uuidv4();

    await queryRun(
      `
      INSERT INTO report_builder_sections (
        id, report_id, section_key, section_type, title, order_index,
        enabled, required, length, language, content_format,
        custom_prompt, block_type_id, block_config_json, render_kind,
        repeat_for, repeat_key, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'markdown', ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        sectionId,
        reportId,
        tplSection.key,
        tplSection.type,
        tplSection.title,
        tplSection.order,
        true,
        tplSection.required,
        tplSection.defaultLength || 'medium',
        tplSection.defaultLanguage || 'business',
        (tplSection as any).customPrompt || (tplSection as any).promptHints || null,
        (tplSection as any).blockTypeId || null,
        (() => {
          const cfg = (tplSection as any).blockSettings || (tplSection as any).config || null;
          const extras: any = {};
          if ((tplSection as any).description) extras.description = (tplSection as any).description;
          if ((tplSection as any).dataSource) extras.dataSource = (tplSection as any).dataSource;
          if ((tplSection as any).includeVisuals !== undefined)
            extras.includeVisuals = Boolean((tplSection as any).includeVisuals);
          const merged = cfg && typeof cfg === 'object' ? { ...(cfg as any), ...extras } : extras;
          return Object.keys(merged || {}).length > 0 ? JSON.stringify(merged) : null;
        })(),
        (tplSection as any).renderKind || null,
        tplSection.repeatFor || null,
        tplSection.repeatKey || null,
        now,
        now,
      ]
    );

    sections.push({
      id: sectionId,
      reportId,
      sectionKey: tplSection.key,
      sectionType: tplSection.type,
      title: tplSection.title,
      orderIndex: tplSection.order,
      enabled: true,
      required: tplSection.required,
      length: (tplSection.defaultLength || 'medium') as SectionLength,
      language: (tplSection.defaultLanguage || 'business') as SectionLanguage,
      contentFormat: 'markdown',
      repeatFor: tplSection.repeatFor,
      repeatKey: tplSection.repeatKey,
    });
  }

  // Log activity
  await logActivity(reportId, 'CREATED', createdBy, { sourceType, sourceId });

  const configSourcesLedger = (config as any)?.sourcesLedger;
  const sourcesLedger =
    Array.isArray(configSourcesLedger) && configSourcesLedger.length > 0
      ? configSourcesLedger
      : [
          {
            sourceType,
            sourceId,
            sourceName: sourceName || null,
            sourceFramework: sourceFramework || null,
          },
        ];
  const degradedFlags =
    config && typeof (config as any).degradedFlags === 'object' && (config as any).degradedFlags
      ? (config as any).degradedFlags
      : null;

  try {
    await artifactRegistryService.registerArtifactOrigin({
      organizationId,
      outputType: 'report',
      artifactFamily: 'document',
      originRuntime: 'report',
      originRecordId: reportId,
      titleSnapshot: title,
      ownerUserId: createdBy,
      createdBy,
      deliveryState: artifactRegistryService.mapReportStatusToDeliveryState('CONFIGURING'),
      visibilityScope: artifactRegistryService.deriveArtifactVisibilityScope({
        outputType: 'report',
        projectId,
        ownerUserId: createdBy,
      }),
      projectId,
      originSummary: {
        sourceType,
        sourceId,
        reportType,
        templateId: templateIdToUse || null,
        sourcesLedger,
        degradedFlags,
        nativeStatus: 'CONFIGURING',
        sourceTable: 'report_builder_reports',
      },
    });
  } catch (err) {
    await queryRun(`DELETE FROM report_builder_sections WHERE report_id = ?`, [reportId]);
    await queryRun(`DELETE FROM report_builder_reports WHERE id = ? AND organization_id = ?`, [
      reportId,
      organizationId,
    ]);
    throw err;
  }

  const report: ReportRecord = {
    id: reportId,
    organizationId,
    projectId: projectId || undefined,
    templateId: templateIdToUse,
    sourceType,
    sourceId,
    sourceName,
    sourceFramework,
    title,
    description,
    reportType,
    config: config || undefined,
    companyContext,
    status: 'CONFIGURING',
    createdBy,
    createdAt: now,
    updatedAt: now,
    version: 1,
    sourceRefs: resolvedSourceRefs.length > 0 ? resolvedSourceRefs : undefined,
  };

  return { report, sections };
}

/**
 * Generate a new report from a template.
 *
 * Used by `ScheduledReportService` when executing recurring schedules.
 * This creates the report structure (report + sections). Content generation is a separate step.
 */
export async function generateFromTemplate(
  templateId: string | undefined,
  organizationId: string,
  userId: string,
  options?: GenerateFromTemplateOptions
): Promise<ReportRecord> {
  const tpl = templateId
    ? await getTemplateById(templateId, organizationId)
    : await getTemplateForSource('ASSESSMENT', undefined, organizationId);

  if (!tpl) throw new Error('Template not found');

  const sourceType = String(
    (tpl as any).source_type || 'ASSESSMENT'
  ).toUpperCase() as ReportSourceType;

  // Scheduler provides sourceAssessmentId/sourceProjectId in options. We store it as report.source_id.
  const sourceId = options?.assessmentId || options?.projectId || '';
  if (!sourceId) {
    throw new Error('Missing sourceId for template generation (assessmentId/projectId required)');
  }

  const title =
    options?.title ||
    `${String((tpl as any).name || 'Report')} • ${new Date().toISOString().slice(0, 10)}`;

  const created = await createReport({
    organizationId,
    sourceType,
    sourceId,
    title,
    description: options?.description || String((tpl as any).description || ''),
    config: options?.config,
    createdBy: userId,
    templateId: String((tpl as any).id || templateId || ''),
  });

  return created.report;
}

/**
 * Get report with sections
 */
export async function getReport(
  reportId: string,
  organizationId: string
): Promise<{
  report: ReportRecord;
  sections: SectionRecord[];
} | null> {
  const row = await queryOne<any>(
    `
    SELECT r.*, u.first_name || ' ' || u.last_name as created_by_name
    FROM report_builder_reports r
    LEFT JOIN users u ON r.created_by = u.id
    WHERE r.id = ? AND r.organization_id = ?
  `,
    [reportId, organizationId]
  );

  if (!row) return null;

  const sections = await queryAll<any>(
    `
    SELECT * FROM report_builder_sections
    WHERE report_id = ?
    ORDER BY order_index ASC
  `,
    [reportId]
  );

  return {
    report: {
      id: row.id,
      organizationId: row.organization_id,
      projectId: row.project_id,
      templateId: row.template_id || undefined,
      sourceType: row.source_type,
      sourceId: row.source_id,
      sourceName: row.source_name,
      sourceFramework: row.source_framework,
      title: row.title,
      description: row.description,
      reportType: row.report_type,
      config: row.config_json ? JSON.parse(row.config_json) : undefined,
      companyContext: row.company_context_json ? JSON.parse(row.company_context_json) : undefined,
      status: row.status,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      generatedAt: row.generated_at,
      approvedAt: row.approved_at,
      approvedBy: row.approved_by,
      version: row.version,
      archivedAt: row.archived_at || undefined,
      archivedBy: row.archived_by || undefined,
      // OGNIWO 8 (dopełnienie, 2026-07-28): `createReport` zapisuje `source_refs_json`
      // od commitu 2947865eeb, ale `getReport()` nigdy nie odczytywał go z powrotem
      // do `ReportRecord.sourceRefs` — więc `reportGenerationService.ts:952` zawsze
      // widział `report.sourceRefs` jako `undefined` i `buildContextPack` się nie
      // wywoływał mimo poprawnego zapisu w bazie. Zapis bez odczytu = ten sam efekt
      // co brak zapisu.
      sourceRefs: row.source_refs_json
        ? (parseMaybeJson(row.source_refs_json, []) as SourceRef[])
        : undefined,
    },
    sections: sections.map((s) => ({
      id: s.id,
      reportId: s.report_id,
      sectionKey: s.section_key,
      sectionType: s.section_type,
      title: s.title,
      orderIndex: s.order_index,
      enabled: Boolean(s.enabled),
      required: Boolean(s.required),
      length: s.length,
      language: s.language,
      customPrompt: s.custom_prompt,
      blockTypeId: (s as any).block_type_id || undefined,
      blockConfig: (s as any).block_config_json
        ? JSON.parse((s as any).block_config_json)
        : undefined,
      renderKind: (s as any).render_kind || undefined,
      generatedContent: s.generated_content,
      editedContent: s.edited_content,
      contentFormat: s.content_format,
      tiptapContent: s.tiptap_content,
      sourceDataSnapshot: s.source_data_snapshot,
      generatedAt: s.generated_at,
      tokensUsed: s.tokens_used,
      editedAt: s.edited_at,
      editedBy: s.edited_by,
      repeatFor: s.repeat_for,
      repeatKey: s.repeat_key,
      repeatName: s.repeat_name,
      repeatData: s.repeat_data,
      chapterKey: (s as any).chapter_key || undefined,
      chapterTitle: (s as any).chapter_title || undefined,
      isRefreshable: Boolean((s as any).is_refreshable),
      lastDataTimestamp: (s as any).last_data_timestamp || undefined,
      // Sekcje dziś nie zapisują własnego source_refs_json (tylko raport-poziom
      // to robi, patrz `createReport`), ale odczyt trzyma się tego samego wzorca
      // co `report-builder.routes.ts:3168`, żeby nie powielić luki zapis≠odczyt.
      sourceRefs: (s as any).source_refs_json
        ? (parseMaybeJson((s as any).source_refs_json, []) as SourceRef[])
        : undefined,
    })),
  };
}

/**
 * List reports for organization
 */
export async function listReports(
  organizationId: string,
  filters?: {
    status?: ReportStatus;
    statusIn?: ReportStatus[];
    sourceType?: ReportSourceType;
    sourceId?: string;
    search?: string;
    /** true = only archived reports; false/undefined = only active (default) */
    archived?: boolean;
    /** true = no filter on archived_at, return both active and archived */
    includeArchived?: boolean;
  }
): Promise<ReportRecord[]> {
  let sql = `
    SELECT r.*, u.first_name || ' ' || u.last_name as created_by_name,
      COALESCE(ini.total_initiatives, 0) as initiatives_count
    FROM report_builder_reports r
    LEFT JOIN users u ON r.created_by = u.id
    LEFT JOIN (
      SELECT b.assessment_id, SUM(b.initiatives_count) as total_initiatives
      FROM assessment_initiative_batches b
      GROUP BY b.assessment_id
    ) ini ON r.source_type = 'ASSESSMENT' AND ini.assessment_id = r.source_id
    WHERE r.organization_id = ?
  `;
  const params: unknown[] = [organizationId];

  if (filters?.status) {
    sql += ` AND r.status = ?`;
    params.push(filters.status);
  }
  if (filters?.statusIn && filters.statusIn.length > 0) {
    sql += ` AND r.status IN (${filters.statusIn.map(() => '?').join(', ')})`;
    params.push(...filters.statusIn);
  }
  if (filters?.sourceType) {
    sql += ` AND r.source_type = ?`;
    params.push(filters.sourceType);
  }
  if (filters?.sourceId) {
    sql += ` AND r.source_id = ?`;
    params.push(filters.sourceId);
  }
  if (filters?.search) {
    sql += ` AND r.title LIKE ?`;
    params.push(`%${filters.search}%`);
  }
  if (!filters?.includeArchived) {
    if (filters?.archived) {
      sql += ` AND r.archived_at IS NOT NULL`;
    } else {
      sql += ` AND r.archived_at IS NULL`;
    }
  }

  sql += ` ORDER BY r.created_at DESC LIMIT 100`;

  const rows = await queryAll<any>(sql, params);

  return rows.map((row) => ({
    id: row.id,
    organizationId: row.organization_id,
    projectId: row.project_id,
    templateId: row.template_id || undefined,
    sourceType: row.source_type,
    sourceId: row.source_id,
    sourceName: row.source_name,
    sourceFramework: row.source_framework,
    title: row.title,
    description: row.description,
    reportType: row.report_type,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    generatedAt: row.generated_at,
    approvedAt: row.approved_at,
    version: row.version,
    archivedAt: row.archived_at || undefined,
    archivedBy: row.archived_by || undefined,
    initiativesCount: Number(row.initiatives_count || 0),
    createdByName: row.created_by_name || undefined,
    config: row.config_json ? JSON.parse(row.config_json) : undefined,
  }));
}

// ==========================================
// BLOCK TYPES (Library)
// ==========================================

export async function listBlockTypes(organizationId: string): Promise<BlockTypeRecord[]> {
  const rows = await queryAll<any>(
    `
    SELECT *
    FROM report_builder_block_types
    WHERE is_active = 1 AND (organization_id IS NULL OR organization_id = ?)
    ORDER BY COALESCE(display_order, 999) ASC, is_system DESC, name ASC
  `,
    [organizationId]
  );

  return rows.map((r) => ({
    id: r.id,
    organizationId: r.organization_id,
    name: r.name,
    description: r.description,
    sourceTypes: r.source_types_json ? JSON.parse(r.source_types_json) : null,
    renderKind: (r.render_kind || 'markdown') as BlockRenderKind,
    promptTemplate: r.prompt_template,
    inputSchema: r.input_schema_json ? JSON.parse(r.input_schema_json) : null,
    defaultLength: (r.default_length || 'medium') as SectionLength,
    defaultLanguage: (r.default_language || 'business') as SectionLanguage,
    isSystem: Boolean(r.is_system),
    isActive: Boolean(r.is_active),
    category: (r.category || 'content') as BlockCategory,
    displayOrder: r.display_order ?? 999,
    slideIntent: r.slide_intent || null,
    pptxPromptTemplate: r.pptx_prompt_template || null,
    pptxOutputSchema: r.pptx_output_schema ? JSON.parse(r.pptx_output_schema) : null,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export async function createBlockType(params: {
  organizationId: string;
  userId: string;
  name: string;
  description?: string;
  sourceTypes?: string[];
  renderKind: BlockRenderKind;
  promptTemplate?: string;
  inputSchema?: Record<string, unknown> | null;
  defaultLength?: SectionLength;
  defaultLanguage?: SectionLanguage;
}): Promise<BlockTypeRecord> {
  const id = uuidv4();
  const now = new Date().toISOString();
  await queryRun(
    `
    INSERT INTO report_builder_block_types (
      id, organization_id, name, description,
      source_types_json, render_kind, prompt_template, input_schema_json,
      default_length, default_language,
      is_system, is_active,
      created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, ?, ?, ?)
  `,
    [
      id,
      params.organizationId,
      params.name,
      params.description || null,
      params.sourceTypes ? JSON.stringify(params.sourceTypes) : null,
      params.renderKind,
      params.promptTemplate || null,
      params.inputSchema ? JSON.stringify(params.inputSchema) : null,
      params.defaultLength || 'medium',
      params.defaultLanguage || 'business',
      params.userId,
      now,
      now,
    ]
  );

  return {
    id,
    organizationId: params.organizationId,
    name: params.name,
    description: params.description || null,
    sourceTypes: params.sourceTypes || null,
    renderKind: params.renderKind,
    promptTemplate: params.promptTemplate || null,
    inputSchema: params.inputSchema || null,
    defaultLength: params.defaultLength || 'medium',
    defaultLanguage: params.defaultLanguage || 'business',
    isSystem: false,
    isActive: true,
    createdBy: params.userId,
    createdAt: now,
    updatedAt: now,
  };
}

export async function updateBlockType(
  blockTypeId: string,
  organizationId: string,
  userId: string,
  patch: Partial<{
    name: string;
    description: string | null;
    sourceTypes: string[] | null;
    renderKind: BlockRenderKind;
    promptTemplate: string | null;
    inputSchema: Record<string, unknown> | null;
    defaultLength: SectionLength;
    defaultLanguage: SectionLanguage;
    isActive: boolean;
  }>
): Promise<void> {
  const existing = await queryOne<any>(
    `SELECT * FROM report_builder_block_types WHERE id = ? AND organization_id = ?`,
    [blockTypeId, organizationId]
  );
  if (!existing) throw new Error('Block type not found');
  if (existing.is_system) throw new Error('System block types cannot be modified');

  const sets: string[] = ['updated_at = ?'];
  const params: unknown[] = [new Date().toISOString()];

  const push = (col: string, value: unknown) => {
    sets.push(`${col} = ?`);
    params.push(value);
  };

  if (patch.name !== undefined) push('name', patch.name);
  if (patch.description !== undefined) push('description', patch.description);
  if (patch.sourceTypes !== undefined)
    push('source_types_json', patch.sourceTypes ? JSON.stringify(patch.sourceTypes) : null);
  if (patch.renderKind !== undefined) push('render_kind', patch.renderKind);
  if (patch.promptTemplate !== undefined) push('prompt_template', patch.promptTemplate);
  if (patch.inputSchema !== undefined)
    push('input_schema_json', patch.inputSchema ? JSON.stringify(patch.inputSchema) : null);
  if (patch.defaultLength !== undefined) push('default_length', patch.defaultLength);
  if (patch.defaultLanguage !== undefined) push('default_language', patch.defaultLanguage);
  if (patch.isActive !== undefined) push('is_active', patch.isActive ? 1 : 0);

  params.push(blockTypeId, organizationId);

  await queryRun(
    `
    UPDATE report_builder_block_types
    SET ${sets.join(', ')}
    WHERE id = ? AND organization_id = ?
  `,
    params
  );
  void userId; // reserved for future auditing
}

export async function deactivateBlockType(
  blockTypeId: string,
  organizationId: string,
  userId: string
): Promise<void> {
  const existing = await queryOne<any>(
    `SELECT * FROM report_builder_block_types WHERE id = ? AND organization_id = ?`,
    [blockTypeId, organizationId]
  );
  if (!existing) throw new Error('Block type not found');
  if (existing.is_system) throw new Error('System block types cannot be deactivated');

  await queryRun(
    `
    UPDATE report_builder_block_types
    SET is_active = 0, updated_at = ?
    WHERE id = ? AND organization_id = ?
  `,
    [new Date().toISOString(), blockTypeId, organizationId]
  );
  void userId; // reserved for future auditing
}

/**
 * Update section configuration
 */
export async function updateSectionConfig(
  reportId: string,
  updates: UpdateSectionConfigParams[]
): Promise<SectionRecord[]> {
  const now = new Date().toISOString();

  for (const update of updates) {
    const setClauses: string[] = ['updated_at = ?'];
    const params: unknown[] = [now];

    if (update.enabled !== undefined) {
      setClauses.push('enabled = ?');
      params.push(update.enabled ? 1 : 0);
    }
    if (update.orderIndex !== undefined) {
      setClauses.push('order_index = ?');
      params.push(update.orderIndex);
    }
    if (update.length !== undefined) {
      setClauses.push('length = ?');
      params.push(update.length);
    }
    if (update.language !== undefined) {
      setClauses.push('language = ?');
      params.push(update.language);
    }
    if (update.customPrompt !== undefined) {
      setClauses.push('custom_prompt = ?');
      params.push(update.customPrompt);
    }
    if (update.title !== undefined) {
      setClauses.push('title = ?');
      params.push(update.title);
    }
    if (update.chapterKey !== undefined) {
      setClauses.push('chapter_key = ?');
      params.push(update.chapterKey);
    }
    if (update.chapterTitle !== undefined) {
      setClauses.push('chapter_title = ?');
      params.push(update.chapterTitle);
    }
    if (update.isRefreshable !== undefined) {
      setClauses.push('is_refreshable = ?');
      params.push(update.isRefreshable ? 1 : 0);
    }
    if (update.lastDataTimestamp !== undefined) {
      setClauses.push('last_data_timestamp = ?');
      params.push(update.lastDataTimestamp);
    }

    params.push(reportId, update.sectionKey);

    await queryRun(
      `
      UPDATE report_builder_sections
      SET ${setClauses.join(', ')}
      WHERE report_id = ? AND section_key = ?
    `,
      params
    );
  }

  const sections = await queryAll<any>(
    `
    SELECT * FROM report_builder_sections
    WHERE report_id = ?
    ORDER BY order_index ASC
  `,
    [reportId]
  );

  return sections.map((s) => ({
    id: s.id,
    reportId: s.report_id,
    sectionKey: s.section_key,
    sectionType: s.section_type,
    title: s.title,
    orderIndex: s.order_index,
    enabled: Boolean(s.enabled),
    required: Boolean(s.required),
    length: s.length,
    language: s.language,
    customPrompt: s.custom_prompt,
    blockTypeId: (s as any).block_type_id || undefined,
    blockConfig: (s as any).block_config_json
      ? JSON.parse((s as any).block_config_json)
      : undefined,
    renderKind: (s as any).render_kind || undefined,
    generatedContent: s.generated_content,
    editedContent: s.edited_content,
    contentFormat: s.content_format,
    tiptapContent: s.tiptap_content,
    generatedAt: s.generated_at,
    tokensUsed: s.tokens_used,
    editedAt: s.edited_at,
    repeatFor: s.repeat_for,
    repeatKey: s.repeat_key,
    repeatName: s.repeat_name,
    chapterKey: (s as any).chapter_key || undefined,
    chapterTitle: (s as any).chapter_title || undefined,
    isRefreshable: Boolean((s as any).is_refreshable),
    lastDataTimestamp: (s as any).last_data_timestamp || undefined,
  }));
}

/**
 * Add custom section to report
 */
export async function addCustomSection(
  reportId: string,
  params: {
    title: string;
    sectionType?: SectionType;
    afterSectionKey?: string;
    length?: SectionLength;
    language?: SectionLanguage;
    blockTypeId?: string;
    blockConfig?: Record<string, unknown> | null;
    renderKind?: string;
  }
): Promise<SectionRecord> {
  const {
    title,
    sectionType = 'custom',
    afterSectionKey,
    length = 'medium',
    language = 'business',
    blockTypeId,
    blockConfig,
    renderKind,
  } = params;

  // Get current max order
  let orderIndex = 50;
  if (afterSectionKey) {
    const afterSection = await queryOne<{ order_index: number }>(
      `
      SELECT order_index FROM report_builder_sections
      WHERE report_id = ? AND section_key = ?
    `,
      [reportId, afterSectionKey]
    );
    if (afterSection) {
      orderIndex = afterSection.order_index + 1;
      // Shift other sections
      await queryRun(
        `
        UPDATE report_builder_sections
        SET order_index = order_index + 1
        WHERE report_id = ? AND order_index >= ?
      `,
        [reportId, orderIndex]
      );
    }
  } else {
    const maxOrder = await queryOne<{ max_order: number }>(
      `
      SELECT MAX(order_index) as max_order FROM report_builder_sections WHERE report_id = ?
    `,
      [reportId]
    );
    orderIndex = (maxOrder?.max_order || 0) + 1;
  }

  const sectionId = uuidv4();
  const sectionKey = `custom_${sectionId.slice(0, 8)}`;
  const now = new Date().toISOString();

  const hasSourceData = Boolean(
    blockConfig &&
    ((blockConfig as any).dataSource ||
      (blockConfig as any)._sourceContext ||
      (blockConfig as any).sourceRefs)
  );

  await queryRun(
    `
    INSERT INTO report_builder_sections (
      id, report_id, section_key, section_type, title, order_index,
      enabled, required, length, language, content_format,
      block_type_id, block_config_json, render_kind,
      is_refreshable, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 1, 0, ?, ?, 'markdown', ?, ?, ?, ?, ?, ?)
  `,
    [
      sectionId,
      reportId,
      sectionKey,
      sectionType,
      title,
      orderIndex,
      length,
      language,
      blockTypeId || null,
      blockConfig ? JSON.stringify(blockConfig) : null,
      renderKind || null,
      hasSourceData ? 1 : 0,
      now,
      now,
    ]
  );

  return {
    id: sectionId,
    reportId,
    sectionKey,
    sectionType,
    title,
    orderIndex,
    enabled: true,
    required: false,
    length,
    language,
    blockTypeId: blockTypeId || undefined,
    blockConfig: blockConfig || undefined,
    renderKind: renderKind || undefined,
    contentFormat: 'markdown',
    isRefreshable: hasSourceData,
  };
}

/**
 * Remove section from report
 */
export async function removeSection(reportId: string, sectionKey: string): Promise<boolean> {
  // Check if section is required
  const section = await queryOne<{ required: number }>(
    `
    SELECT required FROM report_builder_sections WHERE report_id = ? AND section_key = ?
  `,
    [reportId, sectionKey]
  );

  if (!section) return false;
  if (section.required) throw new Error('Cannot remove required section');

  await queryRun(
    `
    DELETE FROM report_builder_sections WHERE report_id = ? AND section_key = ?
  `,
    [reportId, sectionKey]
  );

  return true;
}

/**
 * Update section content (edited by user)
 */
export async function updateSectionContent(
  reportId: string,
  sectionKey: string,
  content: string,
  userId: string,
  contentFormat: 'markdown' | 'tiptap' = 'markdown'
): Promise<void> {
  const now = new Date().toISOString();

  if (contentFormat === 'tiptap') {
    await queryRun(
      `
      UPDATE report_builder_sections
      SET tiptap_content = ?, edited_content = ?, edited_at = ?, edited_by = ?, updated_at = ?
      WHERE report_id = ? AND section_key = ?
    `,
      [content, content, now, userId, now, reportId, sectionKey]
    );
  } else {
    await queryRun(
      `
      UPDATE report_builder_sections
      SET edited_content = ?, edited_at = ?, edited_by = ?, updated_at = ?
      WHERE report_id = ? AND section_key = ?
    `,
      [content, now, userId, now, reportId, sectionKey]
    );
  }
}

/**
 * Activity logging
 */
async function logActivity(
  reportId: string,
  actionType: string,
  actionBy: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await queryRun(
    `
    INSERT INTO report_builder_activity (id, report_id, action_type, action_by, action_at, metadata)
    VALUES (?, ?, ?, ?, ?, ?)
  `,
    [
      uuidv4(),
      reportId,
      actionType,
      actionBy,
      new Date().toISOString(),
      metadata ? JSON.stringify(metadata) : null,
    ]
  );
}

/**
 * Update report status
 */
export async function updateReportStatus(
  reportId: string,
  status: ReportStatus,
  userId: string
): Promise<void> {
  const now = new Date().toISOString();

  let additionalFields = '';
  const params: unknown[] = [status, now, userId];

  if (status === 'GENERATED') {
    additionalFields = ', generated_at = ?';
    params.push(now);
  } else if (status === 'IN_REVIEW') {
    additionalFields = ', submitted_at = ?';
    params.push(now);
  } else if (status === 'APPROVED') {
    additionalFields = ', approved_at = ?, approved_by = ?';
    params.push(now, userId);
  } else if (status === 'SENT_INTERNAL') {
    additionalFields = ', sent_internal_at = ?, sent_internal_by = ?';
    params.push(now, userId);
  } else if (status === 'SENT_EXTERNAL') {
    additionalFields = ', sent_external_at = ?, sent_external_by = ?';
    params.push(now, userId);
  } else if (status === 'UTILIZED') {
    additionalFields = ', utilized_at = ?';
    params.push(now);
  }

  params.push(reportId);

  await queryRun(
    `
    UPDATE report_builder_reports
    SET status = ?, updated_at = ?, updated_by = ?${additionalFields}
    WHERE id = ?
  `,
    params
  );

  await logActivity(reportId, `STATUS_${status}`, userId);

  // Best-effort projection into Assessment module list (when report is sourced from assessment)
  try {
    const row = await queryOne<{
      organization_id: string;
      source_type: string;
      source_id: string;
      project_id: string | null;
      title: string;
      status: string;
      template_id?: string | null;
    }>(
      `SELECT organization_id, source_type, source_id, project_id, title, status, template_id
       FROM report_builder_reports
       WHERE id = ?`,
      [reportId]
    );

    if (row && String(row.source_type || '').toUpperCase() === 'ASSESSMENT') {
      await upsertAssessmentReportForBuilder({
        organizationId: String(row.organization_id),
        assessmentId: String(row.source_id),
        projectId: row.project_id ? String(row.project_id) : null,
        builderReportId: reportId,
        name: String(row.title || 'Report'),
        templateId: (row as any).template_id ? String((row as any).template_id) : null,
        rbStatus: String(row.status || status),
        userId,
      });
    }
  } catch (err: any) {
    logger.warn('[ReportBuilder] Failed to sync assessment report projection (status)', {
      reportId,
      message: err?.message,
    });
  }
}

/**
 * Archive a report (#68e). Orthogonal to `status` — the workflow status (DRAFT..UTILIZED)
 * is preserved so unarchive restores the report exactly where it left off. Archived reports
 * are excluded from listReports() by default (see `archived`/`includeArchived` filters).
 */
export async function archiveReport(
  reportId: string,
  organizationId: string,
  userId: string
): Promise<{ id: string; archivedAt: string; archivedBy: string } | null> {
  const existing = await queryOne<{ id: string; archived_at: string | null }>(
    `SELECT id, archived_at FROM report_builder_reports WHERE id = ? AND organization_id = ?`,
    [reportId, organizationId]
  );
  if (!existing) return null;
  if (existing.archived_at) {
    return { id: reportId, archivedAt: existing.archived_at, archivedBy: userId };
  }

  const now = new Date().toISOString();
  await queryRun(
    `
    UPDATE report_builder_reports
    SET archived_at = ?, archived_by = ?, updated_at = ?, updated_by = ?
    WHERE id = ? AND organization_id = ?
  `,
    [now, userId, now, userId, reportId, organizationId]
  );

  await logActivity(reportId, 'ARCHIVED', userId);

  // Snapshot the pre-archive state so the version history stays legible for restore/audit.
  try {
    await createVersion(reportId, organizationId, userId, {
      changeType: 'archive',
      changeSummary: 'Report archived',
    });
  } catch (err: any) {
    logger.warn('[ReportBuilder] Failed to snapshot version on archive (non-fatal)', {
      reportId,
      message: err?.message,
    });
  }

  return { id: reportId, archivedAt: now, archivedBy: userId };
}

/**
 * Unarchive a report (#68e). Restores default-list visibility; `status` is untouched.
 */
export async function unarchiveReport(
  reportId: string,
  organizationId: string,
  userId: string
): Promise<{ id: string } | null> {
  const existing = await queryOne<{ id: string; archived_at: string | null }>(
    `SELECT id, archived_at FROM report_builder_reports WHERE id = ? AND organization_id = ?`,
    [reportId, organizationId]
  );
  if (!existing) return null;
  if (!existing.archived_at) {
    return { id: reportId };
  }

  const now = new Date().toISOString();
  await queryRun(
    `
    UPDATE report_builder_reports
    SET archived_at = NULL, archived_by = NULL, updated_at = ?, updated_by = ?
    WHERE id = ? AND organization_id = ?
  `,
    [now, userId, reportId, organizationId]
  );

  await logActivity(reportId, 'UNARCHIVED', userId);

  try {
    await createVersion(reportId, organizationId, userId, {
      changeType: 'archive',
      changeSummary: 'Report unarchived',
    });
  } catch (err: any) {
    logger.warn('[ReportBuilder] Failed to snapshot version on unarchive (non-fatal)', {
      reportId,
      message: err?.message,
    });
  }

  return { id: reportId };
}

/**
 * Update report metadata (title, description) without changing status
 */
export async function updateReportMetadata(
  reportId: string,
  organizationId: string,
  userId: string,
  updates: { title?: string; description?: string }
): Promise<void> {
  const setClauses: string[] = ['updated_at = ?', 'updated_by = ?'];
  const params: unknown[] = [new Date().toISOString(), userId];

  if (updates.title !== undefined) {
    setClauses.push('title = ?');
    params.push(updates.title);
  }
  if (updates.description !== undefined) {
    setClauses.push('description = ?');
    params.push(updates.description);
  }

  params.push(reportId, organizationId);

  await queryRun(
    `
    UPDATE report_builder_reports
    SET ${setClauses.join(', ')}
    WHERE id = ? AND organization_id = ?
  `,
    params
  );

  await logActivity(reportId, 'METADATA_UPDATED', userId, updates);

  // Best-effort: keep Assessment module list name in sync (when linked)
  try {
    const row = await queryOne<{
      organization_id: string;
      source_type: string;
      source_id: string;
      project_id: string | null;
      title: string;
      template_id?: string | null;
    }>(
      `SELECT organization_id, source_type, source_id, project_id, title, template_id
       FROM report_builder_reports
       WHERE id = ? AND organization_id = ?`,
      [reportId, organizationId]
    );

    if (row && String(row.source_type || '').toUpperCase() === 'ASSESSMENT') {
      await upsertAssessmentReportForBuilder({
        organizationId: String(row.organization_id),
        assessmentId: String(row.source_id),
        projectId: row.project_id ? String(row.project_id) : null,
        builderReportId: reportId,
        name: String(row.title || updates.title || 'Report'),
        templateId: (row as any).template_id ? String((row as any).template_id) : null,
        // rbStatus omitted → don't overwrite assessment report status
        userId,
      });
    }
  } catch (err: any) {
    logger.warn('[ReportBuilder] Failed to sync assessment report projection (metadata)', {
      reportId,
      message: err?.message,
    });
  }
}

/**
 * Update report-level configuration (intent, invocation profile, etc.).
 * Does not change report status by itself (caller decides).
 */
export async function updateReportConfig(
  reportId: string,
  organizationId: string,
  config: Record<string, unknown> | null,
  userId: string
): Promise<void> {
  const now = new Date().toISOString();
  await queryRun(
    `
    UPDATE report_builder_reports
    SET config_json = ?, updated_at = ?, updated_by = ?
    WHERE id = ? AND organization_id = ?
  `,
    [config ? JSON.stringify(config) : null, now, userId, reportId, organizationId]
  );
  await logActivity(reportId, 'CONFIG_UPDATED', userId);
}

/**
 * Duplicate report
 */
export async function duplicateReport(
  reportId: string,
  organizationId: string,
  userId: string,
  newTitle?: string
): Promise<{ report: ReportRecord; sections: SectionRecord[] }> {
  const original = await getReport(reportId, organizationId);
  if (!original) throw new Error('Report not found');

  const newReportId = uuidv4();
  const now = new Date().toISOString();

  await queryRun(
    `
    INSERT INTO report_builder_reports (
      id, organization_id, project_id, source_type, source_id, source_name, source_framework,
      title, description, report_type, template_id, config_json, company_context_json, status,
      created_by, created_at, updated_at, version, parent_report_id
    )
    SELECT 
      ?, organization_id, project_id, source_type, source_id, source_name, source_framework,
      ?, description, report_type, template_id, config_json, company_context_json, 'DRAFT',
      ?, ?, ?, 1, ?
    FROM report_builder_reports WHERE id = ?
  `,
    [
      newReportId,
      newTitle || `${original.report.title} (Copy)`,
      userId,
      now,
      now,
      reportId,
      reportId,
    ]
  );

  // Copy sections
  const sections: SectionRecord[] = [];
  for (const section of original.sections) {
    const newSectionId = uuidv4();

    await queryRun(
      `
      INSERT INTO report_builder_sections (
        id, report_id, section_key, section_type, title, order_index,
        enabled, required, length, language, custom_prompt,
        generated_content, edited_content, content_format, tiptap_content,
        source_data_snapshot, repeat_for, repeat_key, repeat_name, repeat_data,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        newSectionId,
        newReportId,
        section.sectionKey,
        section.sectionType,
        section.title,
        section.orderIndex,
        section.enabled ? 1 : 0,
        section.required ? 1 : 0,
        section.length,
        section.language,
        section.customPrompt,
        section.generatedContent,
        section.editedContent,
        section.contentFormat,
        section.tiptapContent,
        section.sourceDataSnapshot,
        section.repeatFor,
        section.repeatKey,
        section.repeatName,
        section.repeatData,
        now,
        now,
      ]
    );

    sections.push({
      ...section,
      id: newSectionId,
      reportId: newReportId,
    });
  }

  await logActivity(newReportId, 'DUPLICATED', userId, { originalReportId: reportId });

  try {
    await artifactRegistryService.registerArtifactOrigin({
      organizationId,
      outputType: 'report',
      artifactFamily: 'document',
      originRuntime: 'report',
      originRecordId: newReportId,
      titleSnapshot: newTitle || `${original.report.title} (Copy)`,
      ownerUserId: userId,
      createdBy: userId,
      deliveryState: artifactRegistryService.mapReportStatusToDeliveryState('DRAFT'),
      visibilityScope: artifactRegistryService.deriveArtifactVisibilityScope({
        outputType: 'report',
        projectId: original.report.projectId || null,
        ownerUserId: userId,
      }),
      projectId: original.report.projectId || null,
      originSummary: {
        sourceType: original.report.sourceType,
        sourceId: original.report.sourceId,
        reportType: original.report.reportType,
        templateId: original.report.templateId || null,
        nativeStatus: 'DRAFT',
        sourceTable: 'report_builder_reports',
        duplicatedFrom: reportId,
      },
    });
  } catch (err) {
    await queryRun(`DELETE FROM report_builder_sections WHERE report_id = ?`, [newReportId]);
    await queryRun(`DELETE FROM report_builder_reports WHERE id = ? AND organization_id = ?`, [
      newReportId,
      organizationId,
    ]);
    throw err;
  }

  return {
    report: {
      ...original.report,
      id: newReportId,
      title: newTitle || `${original.report.title} (Copy)`,
      status: 'DRAFT',
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
      generatedAt: undefined,
      approvedAt: undefined,
      version: 1,
    },
    sections,
  };
}

/**
 * Get source data for report (assessment)
 */
export async function getSourceDataForReport(
  reportId: string,
  organizationId: string
): Promise<{
  assessment: AssessmentSourceData | null;
  axesData: Record<string, unknown>;
} | null> {
  const report = await getReport(reportId, organizationId);
  if (!report) return null;

  if (report.report.sourceType !== 'ASSESSMENT') {
    return { assessment: null, axesData: {} };
  }

  const assessment = await getAssessmentSourceData(report.report.sourceId);
  if (!assessment) return null;

  // Extract per-axis data from DRD answers
  const axesData: Record<string, unknown> = {};
  const drdAnswers = (assessment.answers as any)?.drd?.areas || {};

  // DRD axis names for richer AI context
  const DRD_AXIS_NAMES: Record<string, string> = {
    '1': 'Digital Processes',
    '2': 'Digital Products & Services',
    '3': 'Digital Business Models',
    '4': 'Data & Analytics',
    '5': 'Organizational Culture',
    '6': 'Cybersecurity & Risk',
    '7': 'AI & Machine Learning',
  };

  // Group by axis and compute per-axis summary
  for (let i = 1; i <= 7; i++) {
    const axisKey = String(i);
    const axisAreas: Record<string, unknown> = {};
    let totalAchieved = 0;
    let totalTarget = 0;
    let areaCount = 0;

    for (const [areaId, areaData] of Object.entries(drdAnswers)) {
      if (areaId.startsWith(axisKey)) {
        axisAreas[areaId] = areaData;
        const area = areaData as any;
        if (area?.achievedLevel != null) {
          totalAchieved += area.achievedLevel;
          totalTarget += area.targetLevel || area.achievedLevel;
          areaCount++;
        }
      }
    }

    if (Object.keys(axisAreas).length > 0) {
      axesData[axisKey] = {
        areas: axisAreas,
        axisName: DRD_AXIS_NAMES[axisKey] || `Axis ${axisKey}`,
        areaCount,
        averageScore: areaCount > 0 ? Math.round((totalAchieved / areaCount) * 10) / 10 : 0,
        averageTarget: areaCount > 0 ? Math.round((totalTarget / areaCount) * 10) / 10 : 0,
        gap: areaCount > 0 ? Math.round(((totalTarget - totalAchieved) / areaCount) * 10) / 10 : 0,
      };
    }
  }

  // Ensure assessment.scores is populated — compute from answers if empty
  if (
    !assessment.scores ||
    Object.keys(assessment.scores).length === 0 ||
    !(assessment.scores as any).axes
  ) {
    const computedAxes: any[] = [];
    for (const [axisKey, axisInfo] of Object.entries(axesData) as [string, any][]) {
      computedAxes.push({
        axisId: axisKey,
        axisName: axisInfo.axisName,
        score: axisInfo.averageScore,
        maxScore: 7,
        target: axisInfo.averageTarget,
        gap: axisInfo.gap,
        fullMark: 7,
      });
    }
    if (computedAxes.length > 0) {
      const overallAvg = computedAxes.reduce((s, a) => s + a.score, 0) / computedAxes.length;
      assessment.scores = {
        axes: computedAxes,
        overallScore: Math.round(overallAvg * 10) / 10,
        maxScore: 7,
        assessmentType: assessment.assessmentType,
      };
    }
  }

  return { assessment, axesData };
}

// ==========================================
// EXPORT & SHARE TYPES
// ==========================================

export interface ReportExportRecord {
  id: string;
  reportId: string;
  reportType: string;
  format: 'pdf' | 'pptx' | 'docx' | 'xlsx' | 'notion';
  filePath?: string;
  fileSize?: number;
  language: string;
  exportedBy: string;
  exportedAt: string;
  downloadCount: number;
  lastDownloadAt?: string;
}

export interface PublicLinkRecord {
  id: string;
  reportId: string;
  reportType: string;
  organizationId: string;
  linkToken: string;
  passwordHash?: string;
  expiresAt?: string;
  showCompanyLogo: boolean;
  showConsultifyBranding: boolean;
  customMessage?: string;
  viewCount: number;
  lastViewedAt?: string;
  createdBy: string;
  createdAt: string;
  revokedAt?: string;
}

// ==========================================
// EXPORT FUNCTIONS
// ==========================================

/**
 * Create export record for a report
 */
export async function createExportRecord(params: {
  reportId: string;
  reportType: string;
  format: 'pdf' | 'pptx' | 'docx' | 'xlsx' | 'notion';
  filePath: string;
  fileSize: number;
  language?: string;
  exportedBy: string;
}): Promise<ReportExportRecord> {
  const id = uuidv4();
  const now = new Date().toISOString();

  // Additive self-heal for installations where the Report Builder tables
  // predate export history. The exported file is not reported as successful
  // unless its durable audit row can be written.
  await queryRun(`
    CREATE TABLE IF NOT EXISTS report_exports (
      id TEXT PRIMARY KEY,
      report_id TEXT NOT NULL,
      report_type TEXT NOT NULL,
      format TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER NOT NULL DEFAULT 0,
      language TEXT NOT NULL DEFAULT 'en',
      exported_by TEXT NOT NULL,
      exported_at TIMESTAMP NOT NULL,
      download_count INTEGER NOT NULL DEFAULT 0,
      last_download_at TIMESTAMP
    )
  `);

  try {
    await queryRun(
      `
      INSERT INTO report_exports (
        id, report_id, report_type, format, file_path, file_size,
        language, exported_by, exported_at, download_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `,
      [
        id,
        params.reportId,
        params.reportType,
        params.format,
        params.filePath,
        params.fileSize,
        params.language || 'en',
        params.exportedBy,
        now,
      ]
    );
  } catch (error) {
    // Some callback-style PostgreSQL adapters can report an error after the
    // statement has committed. Accept only a verified exact read-back; all
    // genuine write failures still propagate.
    const persisted = await queryOne<{ id: string }>(
      `SELECT id FROM report_exports WHERE id = ? AND report_id = ?`,
      [id, params.reportId]
    ).catch(() => null);
    if (!persisted) throw error;
  }

  return {
    id,
    reportId: params.reportId,
    reportType: params.reportType,
    format: params.format,
    filePath: params.filePath,
    fileSize: params.fileSize,
    language: params.language || 'en',
    exportedBy: params.exportedBy,
    exportedAt: now,
    downloadCount: 0,
  };
}

/**
 * Get export records for a report
 */
export async function getExportRecords(reportId: string): Promise<ReportExportRecord[]> {
  const rows = await queryAll<any>(
    `
    SELECT * FROM report_exports
    WHERE report_id = ?
    ORDER BY exported_at DESC
  `,
    [reportId]
  );

  return rows.map((r) => ({
    id: r.id,
    reportId: r.report_id,
    reportType: r.report_type,
    format: r.format,
    filePath: r.file_path,
    fileSize: r.file_size,
    language: r.language,
    exportedBy: r.exported_by,
    exportedAt: r.exported_at,
    downloadCount: r.download_count,
    lastDownloadAt: r.last_download_at,
  }));
}

/**
 * Increment download count for an export
 */
export async function incrementExportDownload(exportId: string): Promise<void> {
  await queryRun(
    `
    UPDATE report_exports
    SET download_count = download_count + 1, last_download_at = ?
    WHERE id = ?
  `,
    [new Date().toISOString(), exportId]
  );
}

// ==========================================
// PUBLIC LINK FUNCTIONS
// ==========================================

/**
 * Create a public share link for a report
 */
export async function createPublicLink(params: {
  reportId: string;
  reportType: string;
  organizationId: string;
  createdBy: string;
  passwordHash?: string;
  expiresAt?: string;
  showCompanyLogo?: boolean;
  showConsultifyBranding?: boolean;
  customMessage?: string;
}): Promise<PublicLinkRecord> {
  const id = uuidv4();
  const linkToken = uuidv4().replace(/-/g, ''); // Clean token for URL
  const now = new Date().toISOString();

  await queryRun(
    `
    INSERT INTO report_public_links (
      id, report_id, report_type, organization_id, link_token,
      password_hash, expires_at, show_company_logo, show_consultify_branding,
      custom_message, view_count, created_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
  `,
    [
      id,
      params.reportId,
      params.reportType,
      params.organizationId,
      linkToken,
      params.passwordHash || null,
      params.expiresAt || null,
      params.showCompanyLogo !== false ? 1 : 0,
      params.showConsultifyBranding !== false ? 1 : 0,
      params.customMessage || null,
      params.createdBy,
      now,
    ]
  );

  return {
    id,
    reportId: params.reportId,
    reportType: params.reportType,
    organizationId: params.organizationId,
    linkToken,
    passwordHash: params.passwordHash,
    expiresAt: params.expiresAt,
    showCompanyLogo: params.showCompanyLogo !== false,
    showConsultifyBranding: params.showConsultifyBranding !== false,
    customMessage: params.customMessage,
    viewCount: 0,
    createdBy: params.createdBy,
    createdAt: now,
  };
}

/**
 * Get public links for a report
 */
export async function getPublicLinks(
  reportId: string,
  organizationId: string
): Promise<PublicLinkRecord[]> {
  const rows = await queryAll<any>(
    `
    SELECT * FROM report_public_links
    WHERE report_id = ? AND organization_id = ? AND revoked_at IS NULL
    ORDER BY created_at DESC
  `,
    [reportId, organizationId]
  );

  return rows.map((r) => ({
    id: r.id,
    reportId: r.report_id,
    reportType: r.report_type,
    organizationId: r.organization_id,
    linkToken: r.link_token,
    passwordHash: r.password_hash,
    expiresAt: r.expires_at,
    showCompanyLogo: Boolean(r.show_company_logo),
    showConsultifyBranding: Boolean(r.show_consultify_branding),
    customMessage: r.custom_message,
    viewCount: r.view_count,
    lastViewedAt: r.last_viewed_at,
    createdBy: r.created_by,
    createdAt: r.created_at,
    revokedAt: r.revoked_at,
  }));
}

/**
 * Get public link by token (for public access)
 */
export async function getPublicLinkByToken(linkToken: string): Promise<{
  link: PublicLinkRecord;
  report: ReportRecord;
  sections: SectionRecord[];
} | null> {
  const linkRow = await queryOne<any>(
    `
    SELECT * FROM report_public_links
    WHERE link_token = ? AND revoked_at IS NULL
  `,
    [linkToken]
  );

  if (!linkRow) return null;

  // Check expiration
  if (linkRow.expires_at && new Date(linkRow.expires_at) < new Date()) {
    return null;
  }

  // Get report data
  const reportData = await getReport(linkRow.report_id, linkRow.organization_id);
  if (!reportData) return null;

  // Increment view count
  await queryRun(
    `
    UPDATE report_public_links
    SET view_count = view_count + 1, last_viewed_at = ?
    WHERE id = ?
  `,
    [new Date().toISOString(), linkRow.id]
  );

  return {
    link: {
      id: linkRow.id,
      reportId: linkRow.report_id,
      reportType: linkRow.report_type,
      organizationId: linkRow.organization_id,
      linkToken: linkRow.link_token,
      passwordHash: linkRow.password_hash,
      expiresAt: linkRow.expires_at,
      showCompanyLogo: Boolean(linkRow.show_company_logo),
      showConsultifyBranding: Boolean(linkRow.show_consultify_branding),
      customMessage: linkRow.custom_message,
      viewCount: linkRow.view_count + 1,
      lastViewedAt: new Date().toISOString(),
      createdBy: linkRow.created_by,
      createdAt: linkRow.created_at,
      revokedAt: linkRow.revoked_at,
    },
    report: reportData.report,
    sections: reportData.sections,
  };
}

/**
 * Revoke a public link
 */
export async function revokePublicLink(linkId: string, organizationId: string): Promise<boolean> {
  const result = await queryRun(
    `
    UPDATE report_public_links
    SET revoked_at = ?
    WHERE id = ? AND organization_id = ? AND revoked_at IS NULL
  `,
    [new Date().toISOString(), linkId, organizationId]
  );

  return result.changes > 0;
}

// ==========================================
// TEMPLATE MARKETPLACE FUNCTIONS
// ==========================================

/**
 * List all templates (system + organization)
 */
export async function listTemplates(
  organizationId: string,
  options?: { sourceType?: string; isPublic?: boolean; isSystem?: boolean }
): Promise<any[]> {
  // NOTE: is_public / is_system are BOOLEAN columns in Postgres and are NOT
  // covered by the SQLite-0/1 → TRUE/FALSE normalization in PostgresDatabase
  // (only is_active/is_default are). Using `= 1` here threw
  // `operator does not exist: boolean = integer` → 500 on every listTemplates
  // call, blocking assessment/report template selection. Use TRUE/FALSE
  // literals (valid in both Postgres and SQLite).
  let sql = `
    SELECT * FROM report_builder_templates
    WHERE (organization_id IS NULL OR organization_id = ? OR is_public = TRUE)
  `;
  const params: any[] = [organizationId];

  if (options?.sourceType) {
    sql += ` AND source_type = ?`;
    params.push(options.sourceType);
  }

  if (options?.isSystem) {
    sql += ` AND is_system = TRUE`;
  }

  if (options?.isPublic) {
    sql += ` AND is_public = TRUE`;
  }

  sql += ` ORDER BY is_system DESC, name ASC`;

  const rows = await queryAll<any>(sql, params);
  return rows.map((row) => ({
    ...row,
    sections: row.sections_json ? JSON.parse(row.sections_json) : [],
    defaultOptions: row.default_options_json ? JSON.parse(row.default_options_json) : null,
  }));
}

/**
 * Get template by ID
 */
export async function getTemplateById(
  templateId: string,
  organizationId: string
): Promise<any | null> {
  const row = await queryOne<any>(
    `
    SELECT * FROM report_builder_templates
    WHERE id = ? AND (organization_id IS NULL OR organization_id = ? OR is_public = TRUE)
  `,
    [templateId, organizationId]
  );

  return row;
}

/**
 * Create a new template
 */
export async function createTemplate(params: {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  sourceType: string;
  reportType?: string;
  sections: any[];
  defaultOptions?: any;
  isPublic?: boolean;
  createdBy: string;
}): Promise<any> {
  const now = new Date().toISOString();

  await queryRun(
    `
    INSERT INTO report_builder_templates (
      id, organization_id, name, description, source_type, report_type,
      sections_json, default_options_json, is_system, is_default, is_public,
      created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?)
  `,
    [
      params.id,
      params.organizationId,
      params.name,
      params.description || null,
      params.sourceType,
      params.reportType || null,
      JSON.stringify(params.sections),
      params.defaultOptions ? JSON.stringify(params.defaultOptions) : null,
      params.isPublic ? 1 : 0,
      params.createdBy,
      now,
      now,
    ]
  );

  return getTemplateById(params.id, params.organizationId);
}

/**
 * Update a template
 */
export async function updateTemplate(
  templateId: string,
  organizationId: string,
  updates: {
    name?: string;
    description?: string;
    sections?: any[];
    defaultOptions?: any;
    isPublic?: boolean;
  }
): Promise<any | null> {
  // Check if template exists and is editable (not system)
  const existing = await queryOne<any>(
    `SELECT * FROM report_builder_templates WHERE id = ? AND organization_id = ? AND is_system = FALSE`,
    [templateId, organizationId]
  );

  if (!existing) return null;

  const setClauses: string[] = [];
  const params: any[] = [];

  if (updates.name !== undefined) {
    setClauses.push('name = ?');
    params.push(updates.name);
  }
  if (updates.description !== undefined) {
    setClauses.push('description = ?');
    params.push(updates.description);
  }
  if (updates.sections !== undefined) {
    setClauses.push('sections_json = ?');
    params.push(JSON.stringify(updates.sections));
  }
  if (updates.defaultOptions !== undefined) {
    setClauses.push('default_options_json = ?');
    params.push(JSON.stringify(updates.defaultOptions));
  }
  if (updates.isPublic !== undefined) {
    setClauses.push('is_public = ?');
    params.push(updates.isPublic ? 1 : 0);
  }

  if (setClauses.length === 0) return existing;

  setClauses.push('updated_at = ?');
  params.push(new Date().toISOString());
  params.push(templateId);
  params.push(organizationId);

  await queryRun(
    `UPDATE report_builder_templates SET ${setClauses.join(', ')} WHERE id = ? AND organization_id = ?`,
    params
  );

  return getTemplateById(templateId, organizationId);
}

/**
 * Delete a template
 */
export async function deleteTemplate(templateId: string, organizationId: string): Promise<boolean> {
  const result = await queryRun(
    `DELETE FROM report_builder_templates WHERE id = ? AND organization_id = ? AND is_system = FALSE`,
    [templateId, organizationId]
  );

  return result.changes > 0;
}

/**
 * Duplicate a template
 */
export async function duplicateTemplate(
  templateId: string,
  organizationId: string,
  userId: string,
  newName?: string
): Promise<any | null> {
  const original = await getTemplateById(templateId, organizationId);
  if (!original) return null;

  const newId = uuidv4();
  const name = newName || `${original.name} (Copy)`;

  return createTemplate({
    id: newId,
    organizationId,
    name,
    description: original.description,
    sourceType: original.source_type,
    reportType: original.report_type,
    sections: original.sections_json ? JSON.parse(original.sections_json) : [],
    defaultOptions: original.default_options_json
      ? JSON.parse(original.default_options_json)
      : null,
    isPublic: false,
    createdBy: userId,
  });
}

// ==========================================
// VERSION HISTORY FUNCTIONS
// ==========================================

/**
 * Create a version snapshot of a report
 */
export async function createVersion(
  reportId: string,
  organizationId: string,
  userId: string,
  options?: {
    changeType?: 'auto' | 'manual' | 'rollback' | 'archive';
    changeSummary?: string;
    previousStatus?: string;
    newStatus?: string;
  }
): Promise<any> {
  // Get current report with sections
  const reportData = await getReport(reportId, organizationId);
  if (!reportData) throw new Error('Report not found');

  // Get next version number
  const lastVersion = await queryOne<{ max_version: number }>(
    `SELECT MAX(version_number) as max_version FROM report_builder_versions WHERE report_id = ?`,
    [reportId]
  );
  const versionNumber = (lastVersion?.max_version || 0) + 1;

  const versionId = uuidv4();
  const snapshot = {
    report: reportData.report,
    sections: reportData.sections,
    snapshotAt: new Date().toISOString(),
  };

  await queryRun(
    `
    INSERT INTO report_builder_versions (
      id, report_id, version_number, snapshot_json,
      change_summary, change_type, previous_status, new_status,
      created_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
    [
      versionId,
      reportId,
      versionNumber,
      JSON.stringify(snapshot),
      options?.changeSummary || null,
      options?.changeType || 'manual',
      options?.previousStatus || null,
      options?.newStatus || null,
      userId,
      new Date().toISOString(),
    ]
  );

  logger.info('[ReportBuilder] Version created', { reportId, versionNumber, userId });

  return {
    id: versionId,
    reportId,
    versionNumber,
    changeType: options?.changeType || 'manual',
    changeSummary: options?.changeSummary,
    createdBy: userId,
    createdAt: new Date().toISOString(),
  };
}

/**
 * List versions for a report
 */
export async function listVersions(reportId: string, organizationId: string): Promise<any[]> {
  // Verify report belongs to organization
  const report = await queryOne<any>(
    `SELECT id FROM report_builder_reports WHERE id = ? AND organization_id = ?`,
    [reportId, organizationId]
  );
  if (!report) return [];

  const rows = await queryAll<any>(
    `
    SELECT v.*, u.first_name || ' ' || u.last_name as created_by_name
    FROM report_builder_versions v
    LEFT JOIN users u ON v.created_by = u.id
    WHERE v.report_id = ?
    ORDER BY v.version_number DESC
  `,
    [reportId]
  );

  return rows.map((row) => ({
    id: row.id,
    reportId: row.report_id,
    versionNumber: row.version_number,
    changeType: row.change_type,
    changeSummary: row.change_summary,
    previousStatus: row.previous_status,
    newStatus: row.new_status,
    createdBy: row.created_by,
    createdByName: row.created_by_name,
    createdAt: row.created_at,
  }));
}

/**
 * Get a specific version
 */
export async function getVersion(versionId: string, organizationId: string): Promise<any | null> {
  const row = await queryOne<any>(
    `
    SELECT v.*, r.organization_id
    FROM report_builder_versions v
    JOIN report_builder_reports r ON v.report_id = r.id
    WHERE v.id = ? AND r.organization_id = ?
  `,
    [versionId, organizationId]
  );

  if (!row) return null;

  return {
    id: row.id,
    reportId: row.report_id,
    versionNumber: row.version_number,
    snapshot: row.snapshot_json ? JSON.parse(row.snapshot_json) : null,
    changeType: row.change_type,
    changeSummary: row.change_summary,
    previousStatus: row.previous_status,
    newStatus: row.new_status,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

/**
 * Compare two versions
 */
export async function compareVersions(
  versionId1: string,
  versionId2: string,
  organizationId: string
): Promise<any | null> {
  const v1 = await getVersion(versionId1, organizationId);
  const v2 = await getVersion(versionId2, organizationId);

  if (!v1 || !v2) return null;
  if (v1.reportId !== v2.reportId) return null;

  // Calculate differences
  const differences: any[] = [];

  // Compare report-level fields
  const r1 = v1.snapshot?.report || {};
  const r2 = v2.snapshot?.report || {};

  const reportFields = ['title', 'description', 'status'];
  for (const field of reportFields) {
    if (r1[field] !== r2[field]) {
      differences.push({
        type: 'report',
        field,
        oldValue: r1[field],
        newValue: r2[field],
      });
    }
  }

  // Compare sections
  const s1 = v1.snapshot?.sections || [];
  const s2 = v2.snapshot?.sections || [];

  const s1Map = new Map(s1.map((s: any) => [s.section_key, s]));
  const s2Map = new Map(s2.map((s: any) => [s.section_key, s]));

  // Check for added/removed sections
  for (const [key, section] of s2Map) {
    if (!s1Map.has(key)) {
      differences.push({
        type: 'section_added',
        sectionKey: key,
        title: (section as any).title,
      });
    }
  }

  for (const [key, section] of s1Map) {
    if (!s2Map.has(key)) {
      differences.push({
        type: 'section_removed',
        sectionKey: key,
        title: (section as any).title,
      });
    }
  }

  // Check for modified sections
  for (const [key, section1] of s1Map) {
    const section2 = s2Map.get(key);
    if (section2) {
      const s1Content = (section1 as any).generated_content || '';
      const s2Content = (section2 as any).generated_content || '';
      if (s1Content !== s2Content) {
        differences.push({
          type: 'section_modified',
          sectionKey: key,
          title: (section1 as any).title,
          oldLength: s1Content.length,
          newLength: s2Content.length,
        });
      }
    }
  }

  return {
    version1: {
      id: v1.id,
      versionNumber: v1.versionNumber,
      createdAt: v1.createdAt,
    },
    version2: {
      id: v2.id,
      versionNumber: v2.versionNumber,
      createdAt: v2.createdAt,
    },
    differences,
    totalChanges: differences.length,
  };
}

/**
 * Rollback to a specific version
 */
export async function rollbackToVersion(
  versionId: string,
  organizationId: string,
  userId: string
): Promise<any | null> {
  const version = await getVersion(versionId, organizationId);
  if (!version || !version.snapshot) return null;

  const reportId = version.reportId;
  const snapshot = version.snapshot;

  // Create a new version before rollback
  await createVersion(reportId, organizationId, userId, {
    changeType: 'rollback',
    changeSummary: `Rollback to version ${version.versionNumber}`,
    previousStatus: snapshot.report?.status,
    newStatus: snapshot.report?.status,
  });

  // Update report
  await queryRun(
    `
    UPDATE report_builder_reports
    SET title = ?, description = ?, status = ?, updated_at = ?
    WHERE id = ? AND organization_id = ?
  `,
    [
      snapshot.report?.title,
      snapshot.report?.description,
      snapshot.report?.status,
      new Date().toISOString(),
      reportId,
      organizationId,
    ]
  );

  // Delete existing sections and recreate from snapshot
  await queryRun(`DELETE FROM report_builder_sections WHERE report_id = ?`, [reportId]);

  for (const section of snapshot.sections || []) {
    await queryRun(
      `
      INSERT INTO report_builder_sections (
        id, report_id, section_key, section_type, title, order_index,
        enabled, required, length, language, custom_prompt,
        block_type_id, block_config_json, render_kind,
        generated_content, edited_content, content_format,
        tiptap_content, source_data_snapshot, generated_at,
        tokens_used, edited_at, edited_by,
        repeat_for, repeat_key, repeat_name, repeat_data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        uuidv4(),
        reportId,
        section.section_key,
        section.section_type,
        section.title,
        section.order_index,
        section.enabled ? 1 : 0,
        section.required ? 1 : 0,
        section.length,
        section.language,
        section.custom_prompt,
        section.block_type_id,
        section.block_config_json,
        section.render_kind,
        section.generated_content,
        section.edited_content,
        section.content_format || 'markdown',
        section.tiptap_content,
        section.source_data_snapshot,
        section.generated_at,
        section.tokens_used,
        section.edited_at,
        section.edited_by,
        section.repeat_for,
        section.repeat_key,
        section.repeat_name,
        section.repeat_data,
      ]
    );
  }

  logger.info('[ReportBuilder] Rollback completed', {
    reportId,
    toVersion: version.versionNumber,
    userId,
  });

  return getReport(reportId, organizationId);
}

// ==========================================
// REFRESHABLE BLOCKS
// ==========================================

/**
 * Get a single section by report ID and section key
 */
export async function getSection(
  reportId: string,
  sectionKey: string
): Promise<SectionRecord | null> {
  const s = await queryOne<any>(
    `SELECT * FROM report_builder_sections WHERE report_id = ? AND section_key = ?`,
    [reportId, sectionKey]
  );
  if (!s) return null;
  return {
    id: s.id,
    reportId: s.report_id,
    sectionKey: s.section_key,
    sectionType: s.section_type,
    title: s.title,
    orderIndex: s.order_index,
    enabled: Boolean(s.enabled),
    required: Boolean(s.required),
    length: s.length,
    language: s.language,
    customPrompt: s.custom_prompt,
    blockTypeId: s.block_type_id || undefined,
    blockConfig: s.block_config_json ? JSON.parse(s.block_config_json) : undefined,
    renderKind: s.render_kind || undefined,
    generatedContent: s.generated_content,
    editedContent: s.edited_content,
    contentFormat: s.content_format,
    tiptapContent: s.tiptap_content,
    sourceDataSnapshot: s.source_data_snapshot,
    generatedAt: s.generated_at,
    tokensUsed: s.tokens_used,
    editedAt: s.edited_at,
    editedBy: s.edited_by,
    repeatFor: s.repeat_for,
    repeatKey: s.repeat_key,
    repeatName: s.repeat_name,
    repeatData: s.repeat_data,
    chapterKey: s.chapter_key || undefined,
    chapterTitle: s.chapter_title || undefined,
    sourceRefs: s.source_refs_json ? JSON.parse(s.source_refs_json) : undefined,
    isRefreshable: Boolean(s.is_refreshable),
    lastDataTimestamp: s.last_data_timestamp || undefined,
  };
}

/**
 * Get all refreshable sections for a report
 */
export async function getRefreshableSections(reportId: string): Promise<SectionRecord[]> {
  const rows = await queryAll<any>(
    `SELECT * FROM report_builder_sections WHERE report_id = ? AND is_refreshable = 1 AND enabled = 1 ORDER BY order_index ASC`,
    [reportId]
  );
  return rows.map((s) => ({
    id: s.id,
    reportId: s.report_id,
    sectionKey: s.section_key,
    sectionType: s.section_type,
    title: s.title,
    orderIndex: s.order_index,
    enabled: Boolean(s.enabled),
    required: Boolean(s.required),
    length: s.length,
    language: s.language,
    customPrompt: s.custom_prompt,
    blockTypeId: s.block_type_id || undefined,
    blockConfig: s.block_config_json ? JSON.parse(s.block_config_json) : undefined,
    renderKind: s.render_kind || undefined,
    generatedContent: s.generated_content,
    editedContent: s.edited_content,
    contentFormat: s.content_format,
    tiptapContent: s.tiptap_content,
    generatedAt: s.generated_at,
    tokensUsed: s.tokens_used,
    isRefreshable: Boolean(s.is_refreshable),
    lastDataTimestamp: s.last_data_timestamp || undefined,
  }));
}

/**
 * Accept a refresh proposal — overwrite edited_content and update last_data_timestamp
 */
export async function acceptRefreshContent(
  reportId: string,
  sectionKey: string,
  newContent: string,
  userId: string
): Promise<void> {
  const now = new Date().toISOString();
  await queryRun(
    `UPDATE report_builder_sections
     SET edited_content = ?, last_data_timestamp = ?, edited_at = ?, edited_by = ?, updated_at = ?
     WHERE report_id = ? AND section_key = ?`,
    [newContent, now, now, userId, now, reportId, sectionKey]
  );
}

// ==========================================
// REPORT SESSIONS (Dynamic Menu)
// ==========================================

export interface ReportSessionRecord {
  id: string;
  reportId: string;
  userId: string;
  organizationId: string;
  openedAt: string;
  closedAt?: string | null;
  lastActivityAt: string;
  navigationState?: Record<string, unknown> | null;
  report?: Pick<ReportRecord, 'id' | 'title' | 'status' | 'sourceType' | 'sourceFramework'>;
}

/**
 * List open report sessions (dynamic menu) for a user.
 * Hard limit: max 6 open sessions, newest first.
 */
export async function listOpenSessions(
  organizationId: string,
  userId: string
): Promise<ReportSessionRecord[]> {
  const rows = await queryAll<any>(
    `
    SELECT
      s.*,
      r.title as report_title,
      r.status as report_status,
      r.source_type as report_source_type,
      r.source_framework as report_source_framework
    FROM report_builder_sessions s
    JOIN report_builder_reports r ON s.report_id = r.id
    WHERE s.user_id = ? AND s.organization_id = ? AND s.closed_at IS NULL
    ORDER BY s.last_activity_at DESC
    LIMIT 6
  `,
    [userId, organizationId]
  );

  const safeParse = (v: string | null | undefined): any => {
    if (!v) return null;
    try {
      return JSON.parse(v);
    } catch {
      return null;
    }
  };

  return rows.map((row) => ({
    id: row.id,
    reportId: row.report_id,
    userId: row.user_id,
    organizationId: row.organization_id,
    openedAt: row.opened_at,
    closedAt: row.closed_at,
    lastActivityAt: row.last_activity_at,
    navigationState: safeParse(row.navigation_state),
    report: {
      id: row.report_id,
      title: row.report_title,
      status: row.report_status,
      sourceType: row.report_source_type,
      sourceFramework: row.report_source_framework,
    },
  }));
}

/**
 * Open a report session (upsert). Enforces max 6 open sessions by auto-closing oldest.
 */
export async function openSession(params: {
  organizationId: string;
  userId: string;
  reportId: string;
  navigationState?: Record<string, unknown> | null;
}): Promise<ReportSessionRecord> {
  const id = uuidv4();
  const now = new Date().toISOString();
  const nav = params.navigationState ? JSON.stringify(params.navigationState) : null;

  // Upsert on (report_id, user_id)
  await queryRun(
    `
    INSERT INTO report_builder_sessions (
      id, report_id, user_id, organization_id,
      opened_at, closed_at, last_activity_at, navigation_state
    ) VALUES (?, ?, ?, ?, ?, NULL, ?, ?)
    ON CONFLICT(report_id, user_id) DO UPDATE SET
      organization_id = excluded.organization_id,
      opened_at = COALESCE(report_builder_sessions.opened_at, excluded.opened_at),
      closed_at = NULL,
      last_activity_at = excluded.last_activity_at,
      navigation_state = excluded.navigation_state
  `,
    [id, params.reportId, params.userId, params.organizationId, now, now, nav]
  );

  // Enforce max 6: close anything beyond the newest 6
  const openRows = await queryAll<{ id: string }>(
    `
    SELECT id
    FROM report_builder_sessions
    WHERE user_id = ? AND organization_id = ? AND closed_at IS NULL
    ORDER BY last_activity_at DESC
  `,
    [params.userId, params.organizationId]
  );

  const toClose = openRows.slice(6).map((r) => r.id);
  if (toClose.length > 0) {
    await queryRun(
      `UPDATE report_builder_sessions SET closed_at = ?, last_activity_at = ? WHERE id IN (${toClose
        .map(() => '?')
        .join(', ')})`,
      [now, now, ...toClose]
    );
  }

  const sessions = await listOpenSessions(params.organizationId, params.userId);
  const match = sessions.find((s) => s.reportId === params.reportId);
  if (!match) {
    // Fallback: return first session (should not happen unless DB constraints differ)
    return sessions[0] as ReportSessionRecord;
  }
  return match;
}

/**
 * Close a report session for a user (no-op if already closed).
 */
export async function closeSession(params: {
  organizationId: string;
  userId: string;
  reportId: string;
}): Promise<boolean> {
  const now = new Date().toISOString();
  const result = await queryRun(
    `
    UPDATE report_builder_sessions
    SET closed_at = ?, last_activity_at = ?
    WHERE report_id = ? AND user_id = ? AND organization_id = ? AND closed_at IS NULL
  `,
    [now, now, params.reportId, params.userId, params.organizationId]
  );
  return result.changes > 0;
}

// ==========================================
// EXPORTS
// ==========================================

const ReportBuilderService = {
  setDependencies,
  listAssessmentSources,
  getTemplateForSource,
  createReport,
  generateFromTemplate,
  getReport,
  listReports,
  listBlockTypes,
  createBlockType,
  updateBlockType,
  deactivateBlockType,
  updateSectionConfig,
  addCustomSection,
  removeSection,
  updateSectionContent,
  updateReportStatus,
  updateReportMetadata,
  updateReportConfig,
  archiveReport,
  unarchiveReport,
  duplicateReport,
  getSourceDataForReport,
  // Export functions
  createExportRecord,
  getExportRecords,
  incrementExportDownload,
  // Public link functions
  createPublicLink,
  getPublicLinks,
  getPublicLinkByToken,
  revokePublicLink,
  // Template marketplace functions
  listTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  duplicateTemplate,
  // Version history functions
  createVersion,
  listVersions,
  getVersion,
  compareVersions,
  rollbackToVersion,
  // Refreshable blocks
  getSection,
  getRefreshableSections,
  acceptRefreshContent,
  // Sessions (dynamic menu)
  listOpenSessions,
  openSession,
  closeSession,
};

export default ReportBuilderService;
