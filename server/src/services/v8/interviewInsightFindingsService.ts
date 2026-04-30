import { v4 as uuidv4 } from 'uuid';

import logger from '../../utils/Logger.js';
import * as queryHelpers from '../../utils/queryHelpers.js';
import type {
  Insight,
  InsightIssue,
  InsightOpportunity,
  InsightStatus,
  InsightTheme,
} from '../InterviewInsightService.js';
import { getById as getInsightById } from '../InterviewInsightService.js';
import {
  buildP10HandoffToInitiativesSkeleton,
  canPublishFinding,
  isValidP10ConfidenceLevel,
  isValidP10EvidencePointerType,
  isValidP10ReadbackStatus,
  type P10ConfidenceLevel,
  type P10EvidencePointer,
  type P10EvidencePointerType,
  type P10HandoffToInitiativesPayload,
  type P10ReadbackStatus,
} from './interviewInsightCanon.js';

export const NOTEBOOK_REF_PREFIX = 'notebook://';

export interface NotebookRefResolution {
  valid: boolean;
  pageId: string | null;
  title?: string;
  error?: string;
}

export function parseNotebookSourceRef(sourceRef: string): string | null {
  if (!sourceRef.startsWith(NOTEBOOK_REF_PREFIX)) return null;
  const pageId = sourceRef.slice(NOTEBOOK_REF_PREFIX.length).trim();
  return pageId.length > 0 ? pageId : null;
}

export function isNotebookSourceRef(sourceRef: string): boolean {
  return sourceRef.startsWith(NOTEBOOK_REF_PREFIX);
}

export async function resolveNotebookReference(sourceRef: string): Promise<NotebookRefResolution> {
  const pageId = parseNotebookSourceRef(sourceRef);
  if (!pageId) {
    return {
      valid: false,
      pageId: null,
      error: 'Invalid notebook reference format. Expected notebook://<pageId>',
    };
  }

  try {
    const { get } = await import('../../utils/DbPromise.js');
    const row: any = await get(`SELECT id, title FROM notebook_pages WHERE id = ? LIMIT 1`, [
      pageId,
    ]);
    if (!row) {
      return { valid: false, pageId, error: `Notebook page not found: ${pageId}` };
    }
    return { valid: true, pageId, title: row.title || undefined };
  } catch {
    return { valid: true, pageId, title: undefined };
  }
}

export { type P10ConfidenceLevel, type P10EvidencePointer };

export interface P10Finding {
  id: string;
  insightId: string;
  organizationId: string;
  finding_statement: string;
  confidence_level: P10ConfidenceLevel;
  limits: string;
  next_action: string;
  evidence_pointers: P10EvidencePointer[];
  source_section_type: string;
  source_section_index?: number | null;
  source_key?: string | null;
  review_status?: 'draft' | 'in_review' | 'published';
  readback_status: P10ReadbackStatus;
  readback_summary?: string | null;
  readback_updated_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateFindingInput {
  finding_statement: string;
  confidence_level: string;
  limits: string;
  next_action: string;
  evidence_pointers?: Array<{
    type: string;
    sourceRef: string;
    sourceFingerprint: string;
    capturedExcerpt?: string | null;
  }>;
}

export interface UpdateFindingInput {
  finding_statement?: string;
  confidence_level?: string;
  limits?: string;
  next_action?: string;
}

export interface AddPointerInput {
  type: string;
  sourceRef: string;
  sourceFingerprint: string;
  capturedExcerpt?: string | null;
}

export interface RemovePointerInput {
  pointerId: string;
  removal_reason: string;
}

export type InsightLifecycleAction =
  | 'submit_for_review'
  | 'approve'
  | 'publish'
  | 'reject'
  | 'revert_to_draft';

export interface HandoffLogEntry {
  id: string;
  findingId: string;
  payload: P10HandoffToInitiativesPayload;
  targetInitiativeId?: string;
  targetRefType?: string;
  status?: string;
  createdAt: string;
}

export interface P10SourcePackEntry {
  answerId: string;
  questionText: string;
  answerSnippet: string;
  respondentLabel?: string | null;
  respondentRole?: string | null;
  department?: string | null;
  sourceSessionId?: string | null;
  linkedThemes: string[];
  linkedIssues: string[];
  linkedOpportunities: string[];
  capturedPointers: P10EvidencePointer[];
  degradedReason?: 'missing_pointer' | 'source_unavailable';
}

export interface P10SourcePack {
  insightId: string;
  sourceSessionIds: string[];
  entries: P10SourcePackEntry[];
  degraded: boolean;
  degradedReasons: string[];
  activePointerCount: number;
}

interface FindingRow {
  id: string;
  organization_id: string;
  insight_id: string;
  source_section_type: string;
  source_section_index?: number | null;
  source_key?: string | null;
  finding_statement: string;
  confidence_level: string;
  limits_text: string;
  next_action_text: string;
  review_status?: 'draft' | 'in_review' | 'published';
  readback_status?: string | null;
  readback_summary?: string | null;
  readback_updated_at?: string | null;
  created_at: string;
  updated_at: string;
}

const VALID_TRANSITIONS: Record<string, InsightStatus[]> = {
  draft: ['in_review'],
  completed: ['draft', 'in_review'],
  in_review: ['published', 'draft'],
  published: ['draft'],
  failed: ['draft'],
  generating: [],
};

const ACTION_TO_TARGET: Record<InsightLifecycleAction, InsightStatus> = {
  submit_for_review: 'in_review',
  approve: 'published',
  publish: 'published',
  reject: 'draft',
  revert_to_draft: 'draft',
};

let ensureTablesPromise: Promise<void> | null = null;

function dedupeKey(pointer: { sourceRef: string; sourceFingerprint: string }): string {
  return `${pointer.sourceRef}::${pointer.sourceFingerprint}`;
}

function splitLines(value?: string | string[] | null): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }
  return String(value)
    .split(/\r?\n|;\s+/)
    .map((item) => item.replace(/^[-*]\s+/, '').trim())
    .filter(Boolean);
}

function deriveThemeConfidence(theme: InsightTheme): P10ConfidenceLevel {
  const raw = (theme as any).confidence;
  if (raw && isValidP10ConfidenceLevel(raw)) return raw;
  switch (theme.strength) {
    case 'strong':
      return 'high';
    case 'moderate':
      return 'medium';
    case 'weak':
    default:
      return 'low';
  }
}

function deriveFallbackConfidence(raw?: string): P10ConfidenceLevel {
  return raw && isValidP10ConfidenceLevel(raw) ? raw : 'insufficient';
}

function defaultLimitsForSection(
  sectionType: 'theme' | 'issue' | 'opportunity' | 'manual',
  confidenceLevel: P10ConfidenceLevel
): string {
  if (confidenceLevel === 'insufficient') {
    return 'Operator review required to confirm confidence, boundaries, and representativeness before publish or handoff.';
  }
  if (sectionType === 'theme') {
    return 'Derived from generated interview synthesis; verify respondent coverage and business scope before downstream use.';
  }
  if (sectionType === 'issue') {
    return 'Issue framing is generated from interview data; confirm severity, scope, and causality before acting on it.';
  }
  if (sectionType === 'opportunity') {
    return 'Opportunity framing is directional; validate feasibility, value, and ownership before handoff.';
  }
  return 'Manual finding requires explicit confirmation of scope, assumptions, and remaining unknowns.';
}

function defaultNextActionForSection(
  sectionType: 'theme' | 'issue' | 'opportunity' | 'manual'
): string {
  switch (sectionType) {
    case 'theme':
      return 'Review pattern with an operator, confirm evidence coverage, and decide whether it should move to publish.';
    case 'issue':
      return 'Validate severity with a reviewer and define whether the issue should be investigated or converted into action.';
    case 'opportunity':
      return 'Validate expected value and owner, then prepare a bounded downstream handoff if confirmed.';
    default:
      return 'Review, refine, and prepare bounded downstream action if confidence and evidence are sufficient.';
  }
}

function buildEvidenceSnippetMap(insight: Insight): Record<string, string> {
  const map: Record<string, string> = {};
  for (const entry of insight.evidenceMap || []) {
    if (entry?.answer_id && entry?.answer_snippet) {
      map[String(entry.answer_id)] = String(entry.answer_snippet);
    }
  }
  return map;
}

function buildBackfillPointers(params: {
  insight: Insight;
  evidenceRefs?: string[];
  evidenceSnippets?: Record<string, string>;
}): CreateFindingInput['evidence_pointers'] {
  const refs = Array.isArray(params.evidenceRefs) ? params.evidenceRefs : [];
  if (refs.length > 0) {
    return refs.map((ref) => ({
      type: 'question_answer',
      sourceRef: `answer:${ref}`,
      sourceFingerprint: `answer:${ref}`,
      capturedExcerpt: params.evidenceSnippets?.[ref] ?? null,
    }));
  }

  return params.insight.sourceSessionIds.map((sessionId) => ({
    type: 'interview_session',
    sourceRef: `session:${sessionId}`,
    sourceFingerprint: `session:${sessionId}`,
    capturedExcerpt: null,
  }));
}

async function ensureTables(): Promise<void> {
  if (!ensureTablesPromise) {
    ensureTablesPromise = (async () => {
      await queryHelpers.queryRun(
        `CREATE TABLE IF NOT EXISTS interview_insight_findings (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL,
          insight_id TEXT NOT NULL,
          source_section_type TEXT NOT NULL DEFAULT 'manual',
          source_section_index INTEGER,
          source_key TEXT,
          finding_statement TEXT NOT NULL,
          confidence_level TEXT NOT NULL DEFAULT 'insufficient',
          limits_text TEXT NOT NULL,
          limits_json TEXT DEFAULT '[]',
          next_action_text TEXT NOT NULL,
          next_action_json TEXT DEFAULT '[]',
          review_status TEXT NOT NULL DEFAULT 'draft',
          readback_status TEXT NOT NULL DEFAULT 'draft_interpretation',
          readback_summary TEXT,
          readback_updated_at TIMESTAMP,
          created_by TEXT,
          updated_by TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
      );
      await queryHelpers.queryRun(
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_interview_insight_findings_source_key
         ON interview_insight_findings(insight_id, source_key)`
      );
      await queryHelpers
        .queryRun(
          `ALTER TABLE interview_insight_findings ADD COLUMN readback_status TEXT NOT NULL DEFAULT 'draft_interpretation'`
        )
        .catch(() => {});
      await queryHelpers
        .queryRun(`ALTER TABLE interview_insight_findings ADD COLUMN readback_summary TEXT`)
        .catch(() => {});
      await queryHelpers
        .queryRun(`ALTER TABLE interview_insight_findings ADD COLUMN readback_updated_at TIMESTAMP`)
        .catch(() => {});
      await queryHelpers.queryRun(
        `CREATE INDEX IF NOT EXISTS idx_interview_insight_findings_insight
         ON interview_insight_findings(insight_id)`
      );
      await queryHelpers.queryRun(
        `CREATE TABLE IF NOT EXISTS interview_insight_evidence_pointers (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL,
          insight_id TEXT NOT NULL,
          finding_id TEXT NOT NULL,
          pointer_type TEXT NOT NULL,
          source_ref TEXT NOT NULL,
          source_fingerprint TEXT NOT NULL,
          captured_excerpt TEXT,
          captured_at TIMESTAMP NOT NULL,
          pointer_state TEXT NOT NULL DEFAULT 'active',
          removal_reason TEXT,
          removed_at TIMESTAMP,
          duplicate_observed_count INTEGER NOT NULL DEFAULT 0,
          metadata_json TEXT DEFAULT '{}',
          created_by TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
      );
      await queryHelpers.queryRun(
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_interview_insight_evidence_dedupe
         ON interview_insight_evidence_pointers(finding_id, source_ref, source_fingerprint)`
      );
      await queryHelpers.queryRun(
        `CREATE TABLE IF NOT EXISTS interview_insight_handoffs (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL,
          insight_id TEXT NOT NULL,
          finding_id TEXT NOT NULL,
          target_kind TEXT NOT NULL DEFAULT 'initiative',
          target_id TEXT,
          target_ref_type TEXT NOT NULL DEFAULT 'handoff_request',
          status TEXT NOT NULL DEFAULT 'pending',
          payload_json TEXT NOT NULL,
          operator_decision_json TEXT DEFAULT '{}',
          created_by TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
      );
      await queryHelpers.queryRun(
        `CREATE TABLE IF NOT EXISTS interview_insight_audit_log (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL,
          insight_id TEXT NOT NULL,
          finding_id TEXT,
          entity_type TEXT NOT NULL,
          entity_id TEXT,
          action TEXT NOT NULL,
          actor_user_id TEXT,
          detail_json TEXT DEFAULT '{}',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
      );
    })().catch((error) => {
      ensureTablesPromise = null;
      throw error;
    });
  }

  await ensureTablesPromise;
}

async function recordAuditEvent(params: {
  organizationId: string;
  insightId: string;
  findingId?: string | null;
  entityType: string;
  entityId?: string | null;
  action: string;
  actorUserId?: string | null;
  detail?: Record<string, unknown>;
}): Promise<void> {
  await ensureTables();
  await queryHelpers.queryRun(
    `INSERT INTO interview_insight_audit_log
     (id, organization_id, insight_id, finding_id, entity_type, entity_id, action, actor_user_id, detail_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uuidv4(),
      params.organizationId,
      params.insightId,
      params.findingId || null,
      params.entityType,
      params.entityId || null,
      params.action,
      params.actorUserId || null,
      JSON.stringify(params.detail || {}),
      new Date().toISOString(),
    ]
  );
}

async function loadFindingRows(insightId: string): Promise<FindingRow[]> {
  await ensureTables();
  const rows = await queryHelpers.queryAll<FindingRow>(
    `SELECT id, organization_id, insight_id, source_section_type, source_section_index, source_key,
            finding_statement, confidence_level, limits_text, next_action_text, review_status,
            readback_status, readback_summary, readback_updated_at, created_at, updated_at
     FROM interview_insight_findings
     WHERE insight_id = ?
     ORDER BY created_at ASC, source_section_index ASC, id ASC`,
    [insightId]
  );
  return Array.isArray(rows) ? rows : [];
}

async function loadPointersByFinding(
  insightId: string
): Promise<Record<string, P10EvidencePointer[]>> {
  await ensureTables();
  const rows = await queryHelpers.queryAll<any>(
    `SELECT id, finding_id, pointer_type, source_ref, source_fingerprint, captured_excerpt, captured_at,
            pointer_state, removal_reason
     FROM interview_insight_evidence_pointers
     WHERE insight_id = ?
     ORDER BY created_at ASC, id ASC`,
    [insightId]
  );
  const safeRows = Array.isArray(rows) ? rows : [];
  return safeRows.reduce<Record<string, P10EvidencePointer[]>>((acc, row) => {
    const findingId = String(row.finding_id);
    const list = acc[findingId] || [];
    list.push({
      pointerId: String(row.id),
      type: String(row.pointer_type) as P10EvidencePointerType,
      sourceRef: String(row.source_ref),
      capturedAt: String(row.captured_at),
      sourceFingerprint: String(row.source_fingerprint),
      capturedExcerpt: row.captured_excerpt ?? null,
      removalReason: row.removal_reason ?? null,
      isTombstone: String(row.pointer_state) !== 'active',
    });
    acc[findingId] = list;
    return acc;
  }, {});
}

async function mapFindingRows(insightId: string): Promise<P10Finding[]> {
  const [rows, pointerMap] = await Promise.all([
    loadFindingRows(insightId),
    loadPointersByFinding(insightId),
  ]);
  return rows.map((row) => ({
    id: String(row.id),
    insightId: String(row.insight_id),
    organizationId: String(row.organization_id),
    finding_statement: String(row.finding_statement),
    confidence_level: String(row.confidence_level) as P10ConfidenceLevel,
    limits: String(row.limits_text || ''),
    next_action: String(row.next_action_text || ''),
    evidence_pointers: pointerMap[String(row.id)] || [],
    source_section_type: String(row.source_section_type || 'manual'),
    source_section_index:
      row.source_section_index === undefined || row.source_section_index === null
        ? null
        : Number(row.source_section_index),
    source_key: row.source_key ?? null,
    review_status: row.review_status || 'draft',
    readback_status: isValidP10ReadbackStatus(String(row.readback_status || ''))
      ? (row.readback_status as P10ReadbackStatus)
      : 'draft_interpretation',
    readback_summary: row.readback_summary ?? null,
    readback_updated_at: row.readback_updated_at ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  }));
}

async function resolveInsightMeta(
  insightId: string,
  fallback?: { organizationId?: string; actorUserId?: string | null }
): Promise<{ insight: Insight | null; organizationId: string | null; actorUserId: string | null }> {
  const insight = await getInsightById(insightId).catch(() => null);
  return {
    insight,
    organizationId: insight?.organizationId || fallback?.organizationId || null,
    actorUserId: fallback?.actorUserId || insight?.createdBy || null,
  };
}

async function insertPointer(
  params: {
    organizationId: string;
    insightId: string;
    findingId: string;
    actorUserId?: string | null;
  },
  input: AddPointerInput
): Promise<{ pointer?: P10EvidencePointer; error?: string }> {
  if (!isValidP10EvidencePointerType(input.type)) {
    return { error: `Invalid evidence pointer type: ${input.type}` };
  }

  const existing = await queryHelpers.queryOne<any>(
    `SELECT id, pointer_state, source_ref, source_fingerprint, captured_excerpt, captured_at
     FROM interview_insight_evidence_pointers
     WHERE finding_id = ? AND source_ref = ? AND source_fingerprint = ?
     LIMIT 1`,
    [params.findingId, input.sourceRef, input.sourceFingerprint]
  );

  if (existing) {
    const now = new Date().toISOString();
    await queryHelpers.queryRun(
      `UPDATE interview_insight_evidence_pointers
       SET pointer_state = 'active',
           removal_reason = NULL,
           removed_at = NULL,
           duplicate_observed_count = COALESCE(duplicate_observed_count, 0) + 1,
           updated_at = ?
       WHERE id = ?`,
      [now, existing.id]
    );
    return {
      pointer: {
        pointerId: String(existing.id),
        type: input.type as P10EvidencePointerType,
        sourceRef: String(existing.source_ref),
        capturedAt: String(existing.captured_at),
        sourceFingerprint: String(existing.source_fingerprint),
        capturedExcerpt: existing.captured_excerpt ?? null,
        isTombstone: false,
      },
    };
  }

  const now = new Date().toISOString();
  const pointerId = `ptr_${uuidv4()}`;
  await queryHelpers.queryRun(
    `INSERT INTO interview_insight_evidence_pointers
     (id, organization_id, insight_id, finding_id, pointer_type, source_ref, source_fingerprint, captured_excerpt, captured_at, pointer_state, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
    [
      pointerId,
      params.organizationId,
      params.insightId,
      params.findingId,
      input.type,
      input.sourceRef,
      input.sourceFingerprint,
      input.capturedExcerpt ?? null,
      now,
      params.actorUserId || null,
      now,
      now,
    ]
  );
  return {
    pointer: {
      pointerId,
      type: input.type as P10EvidencePointerType,
      sourceRef: input.sourceRef,
      capturedAt: now,
      sourceFingerprint: input.sourceFingerprint,
      capturedExcerpt: input.capturedExcerpt ?? null,
      isTombstone: false,
    },
  };
}

async function ensureBackfilledFindings(
  insightId: string,
  insight?: Insight | null
): Promise<void> {
  await ensureTables();
  const countRow = await queryHelpers.queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM interview_insight_findings WHERE insight_id = ?`,
    [insightId]
  );
  if ((countRow?.count || 0) > 0) return;

  const resolvedInsight = insight ?? (await getInsightById(insightId).catch(() => null));
  if (!resolvedInsight || resolvedInsight.status === 'generating') return;

  const evidenceSnippets = buildEvidenceSnippetMap(resolvedInsight);
  const candidates: Array<{
    sectionType: 'theme' | 'issue' | 'opportunity';
    sectionIndex: number;
    sourceKey: string;
    statement: string;
    confidence: P10ConfidenceLevel;
    limits: string;
    nextAction: string;
    pointers?: CreateFindingInput['evidence_pointers'];
  }> = [];

  (resolvedInsight.themes || []).forEach((theme: InsightTheme, index) => {
    const confidence = deriveThemeConfidence(theme);
    candidates.push({
      sectionType: 'theme',
      sectionIndex: index,
      sourceKey: `theme:${index}`,
      statement: String(theme.description || theme.title || '').trim(),
      confidence,
      limits:
        splitLines((theme as any).limits).join('\n') ||
        defaultLimitsForSection('theme', confidence),
      nextAction: defaultNextActionForSection('theme'),
      pointers: buildBackfillPointers({
        insight: resolvedInsight,
        evidenceRefs: theme.evidence_refs,
        evidenceSnippets,
      }),
    });
  });

  (resolvedInsight.issues || []).forEach((issue: InsightIssue, index) => {
    const confidence = deriveFallbackConfidence((issue as any).confidence);
    candidates.push({
      sectionType: 'issue',
      sectionIndex: index,
      sourceKey: `issue:${index}`,
      statement: String(issue.description || issue.title || '').trim(),
      confidence,
      limits:
        splitLines((issue as any).limits).join('\n') ||
        defaultLimitsForSection('issue', confidence),
      nextAction: defaultNextActionForSection('issue'),
      pointers: buildBackfillPointers({
        insight: resolvedInsight,
        evidenceRefs: issue.evidence_refs,
        evidenceSnippets,
      }),
    });
  });

  (resolvedInsight.opportunities || []).forEach((opportunity: InsightOpportunity, index) => {
    const confidence = deriveFallbackConfidence((opportunity as any).confidence);
    candidates.push({
      sectionType: 'opportunity',
      sectionIndex: index,
      sourceKey: `opportunity:${index}`,
      statement: String(opportunity.description || opportunity.title || '').trim(),
      confidence,
      limits:
        splitLines((opportunity as any).limits).join('\n') ||
        defaultLimitsForSection('opportunity', confidence),
      nextAction: defaultNextActionForSection('opportunity'),
      pointers: buildBackfillPointers({
        insight: resolvedInsight,
        evidenceRefs: opportunity.evidence_refs,
        evidenceSnippets,
      }),
    });
  });

  for (const candidate of candidates.filter((item) => item.statement)) {
    await addFinding(
      insightId,
      {
        finding_statement: candidate.statement,
        confidence_level: candidate.confidence,
        limits: candidate.limits,
        next_action: candidate.nextAction,
        evidence_pointers: candidate.pointers,
      },
      {
        organizationId: resolvedInsight.organizationId,
        actorUserId: resolvedInsight.createdBy,
        sourceSectionType: candidate.sectionType,
        sourceSectionIndex: candidate.sectionIndex,
        sourceKey: candidate.sourceKey,
        auditAction: 'backfilled_from_generated',
      }
    );
  }
}

export function validateLifecycleTransition(
  currentStatus: InsightStatus,
  action: InsightLifecycleAction
): { allowed: boolean; targetStatus?: InsightStatus; reason?: string } {
  const target = ACTION_TO_TARGET[action];
  if (!target) {
    return { allowed: false, reason: `Unknown action: ${action}` };
  }

  const allowed = VALID_TRANSITIONS[currentStatus] ?? [];
  if (!allowed.includes(target)) {
    return {
      allowed: false,
      reason: `Cannot transition from '${currentStatus}' to '${target}' via '${action}'`,
    };
  }

  return { allowed: true, targetStatus: target };
}

export async function listFindings(insightId: string): Promise<P10Finding[]> {
  const insight = await getInsightById(insightId).catch(() => null);
  if (insight) {
    await ensureBackfilledFindings(insightId, insight);
  }
  return mapFindingRows(insightId);
}

export async function getFinding(
  insightId: string,
  findingId: string
): Promise<P10Finding | undefined> {
  const findings = await listFindings(insightId);
  return findings.find((item) => item.id === findingId);
}

export async function addFinding(
  insightId: string,
  input: CreateFindingInput,
  options?: {
    organizationId?: string;
    actorUserId?: string | null;
    sourceSectionType?: string;
    sourceSectionIndex?: number | null;
    sourceKey?: string | null;
    auditAction?: string;
  }
): Promise<{ finding?: P10Finding; error?: string }> {
  await ensureTables();
  if (!isValidP10ConfidenceLevel(input.confidence_level)) {
    return { error: `Invalid confidence level: ${input.confidence_level}` };
  }
  if (!input.finding_statement?.trim()) return { error: 'finding_statement is required' };
  if (!input.limits?.trim()) return { error: 'limits is required' };
  if (!input.next_action?.trim()) return { error: 'next_action is required' };

  const meta = await resolveInsightMeta(insightId, {
    organizationId: options?.organizationId,
    actorUserId: options?.actorUserId || null,
  });
  if (!meta.organizationId) return { error: 'Insight not found' };

  const existingByKey = options?.sourceKey
    ? await queryHelpers.queryOne<{ id: string }>(
        `SELECT id FROM interview_insight_findings WHERE insight_id = ? AND source_key = ? LIMIT 1`,
        [insightId, options.sourceKey]
      )
    : null;

  const findingId = existingByKey?.id || `finding_${uuidv4()}`;
  const now = new Date().toISOString();

  if (!existingByKey?.id) {
    await queryHelpers.queryRun(
      `INSERT INTO interview_insight_findings
       (id, organization_id, insight_id, source_section_type, source_section_index, source_key, finding_statement, confidence_level, limits_text, limits_json, next_action_text, next_action_json, review_status, created_by, updated_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?)`,
      [
        findingId,
        meta.organizationId,
        insightId,
        options?.sourceSectionType || 'manual',
        options?.sourceSectionIndex ?? null,
        options?.sourceKey ?? null,
        input.finding_statement.trim(),
        input.confidence_level,
        input.limits.trim(),
        JSON.stringify(splitLines(input.limits)),
        input.next_action.trim(),
        JSON.stringify(splitLines(input.next_action)),
        meta.actorUserId,
        meta.actorUserId,
        now,
        now,
      ]
    );
  } else {
    await queryHelpers.queryRun(
      `UPDATE interview_insight_findings
       SET finding_statement = ?,
           confidence_level = ?,
           limits_text = ?,
           limits_json = ?,
           next_action_text = ?,
           next_action_json = ?,
           updated_by = ?,
           updated_at = ?
       WHERE id = ?`,
      [
        input.finding_statement.trim(),
        input.confidence_level,
        input.limits.trim(),
        JSON.stringify(splitLines(input.limits)),
        input.next_action.trim(),
        JSON.stringify(splitLines(input.next_action)),
        meta.actorUserId,
        now,
        findingId,
      ]
    );
  }

  const seenKeys = new Set<string>();
  for (const raw of input.evidence_pointers ?? []) {
    const dedupe = dedupeKey(raw);
    if (seenKeys.has(dedupe)) continue;
    seenKeys.add(dedupe);
    const result = await insertPointer(
      {
        organizationId: meta.organizationId,
        insightId,
        findingId,
        actorUserId: meta.actorUserId,
      },
      raw
    );
    if (result.error) return { error: result.error };
  }

  await recordAuditEvent({
    organizationId: meta.organizationId,
    insightId,
    findingId,
    entityType: 'finding',
    entityId: findingId,
    action: options?.auditAction || 'created',
    actorUserId: meta.actorUserId,
    detail: {
      sourceSectionType: options?.sourceSectionType || 'manual',
      sourceSectionIndex: options?.sourceSectionIndex ?? null,
      confidenceLevel: input.confidence_level,
      evidenceCount: input.evidence_pointers?.length || 0,
    },
  });

  return { finding: await getFinding(insightId, findingId) };
}

export async function updateFinding(
  insightId: string,
  findingId: string,
  input: UpdateFindingInput,
  actorUserId?: string | null
): Promise<{ finding?: P10Finding; error?: string }> {
  const finding = await getFinding(insightId, findingId);
  if (!finding) return { error: 'Finding not found' };

  if (input.confidence_level !== undefined && !isValidP10ConfidenceLevel(input.confidence_level)) {
    return { error: `Invalid confidence level: ${input.confidence_level}` };
  }

  const nextStatement =
    input.finding_statement !== undefined
      ? input.finding_statement.trim()
      : finding.finding_statement;
  const nextLimits = input.limits !== undefined ? input.limits.trim() : finding.limits;
  const nextAction =
    input.next_action !== undefined ? input.next_action.trim() : finding.next_action;

  if (!nextStatement) return { error: 'finding_statement cannot be empty' };
  if (!nextLimits) return { error: 'limits cannot be empty' };
  if (!nextAction) return { error: 'next_action cannot be empty' };

  const now = new Date().toISOString();
  await queryHelpers.queryRun(
    `UPDATE interview_insight_findings
     SET finding_statement = ?,
         confidence_level = ?,
         limits_text = ?,
         limits_json = ?,
         next_action_text = ?,
         next_action_json = ?,
         updated_by = ?,
         updated_at = ?
     WHERE id = ? AND insight_id = ?`,
    [
      nextStatement,
      input.confidence_level ?? finding.confidence_level,
      nextLimits,
      JSON.stringify(splitLines(nextLimits)),
      nextAction,
      JSON.stringify(splitLines(nextAction)),
      actorUserId || null,
      now,
      findingId,
      insightId,
    ]
  );

  await recordAuditEvent({
    organizationId: finding.organizationId,
    insightId,
    findingId,
    entityType: 'finding',
    entityId: findingId,
    action: 'updated',
    actorUserId: actorUserId || null,
    detail: {
      changedFields: Object.keys(input).filter(
        (key) => (input as Record<string, unknown>)[key] !== undefined
      ),
    },
  });

  return { finding: await getFinding(insightId, findingId) };
}

export async function updateFindingReadback(
  insightId: string,
  findingId: string,
  input: {
    readback_status: string;
    readback_summary?: string | null;
  },
  actorUserId?: string | null
): Promise<{ finding?: P10Finding; error?: string }> {
  const finding = await getFinding(insightId, findingId);
  if (!finding) return { error: 'Finding not found' };
  if (!isValidP10ReadbackStatus(input.readback_status)) {
    return { error: `Invalid readback status: ${input.readback_status}` };
  }
  const summary = String(input.readback_summary || '').trim();
  if (
    (input.readback_status === 'confirmed_by_client' ||
      input.readback_status === 'partially_confirmed' ||
      input.readback_status === 'challenged_by_client' ||
      input.readback_status === 'needs_more_evidence') &&
    !summary
  ) {
    return { error: 'readback_summary is required for this readback status' };
  }

  const now = new Date().toISOString();
  await queryHelpers.queryRun(
    `UPDATE interview_insight_findings
     SET readback_status = ?,
         readback_summary = ?,
         readback_updated_at = ?,
         updated_by = ?,
         updated_at = ?
     WHERE id = ? AND insight_id = ?`,
    [input.readback_status, summary || null, now, actorUserId || null, now, findingId, insightId]
  );

  await recordAuditEvent({
    organizationId: finding.organizationId,
    insightId,
    findingId,
    entityType: 'finding',
    entityId: findingId,
    action: 'readback_updated',
    actorUserId: actorUserId || null,
    detail: {
      readbackStatus: input.readback_status,
      hasSummary: Boolean(summary),
    },
  });

  return { finding: await getFinding(insightId, findingId) };
}

export async function addEvidencePointer(
  insightId: string,
  findingId: string,
  input: AddPointerInput,
  actorUserId?: string | null
): Promise<{ pointer?: P10EvidencePointer; error?: string }> {
  const finding = await getFinding(insightId, findingId);
  if (!finding) return { error: 'Finding not found' };

  if (input.type === 'operator_note' && isNotebookSourceRef(input.sourceRef)) {
    const pageId = parseNotebookSourceRef(input.sourceRef);
    if (!pageId) {
      return { error: 'Invalid notebook reference format. Expected notebook://<pageId>' };
    }
  }

  if (input.type === 'survey_linkage') {
    scheduleSurveyLinkageValidation(insightId, findingId, input.sourceRef);
  }

  const result = await insertPointer(
    {
      organizationId: finding.organizationId,
      insightId,
      findingId,
      actorUserId: actorUserId || null,
    },
    input
  );
  if (result.error) return result;

  await queryHelpers.queryRun(
    `UPDATE interview_insight_findings SET updated_at = ?, updated_by = ? WHERE id = ?`,
    [new Date().toISOString(), actorUserId || null, findingId]
  );
  await recordAuditEvent({
    organizationId: finding.organizationId,
    insightId,
    findingId,
    entityType: 'evidence_pointer',
    entityId: result.pointer?.pointerId || null,
    action: 'added',
    actorUserId: actorUserId || null,
    detail: {
      type: input.type,
      sourceRef: input.sourceRef,
    },
  });

  return result;
}

export async function addNotebookEvidencePointer(
  insightId: string,
  findingId: string,
  notebookPageId: string,
  opts?: { sourceFingerprint?: string; capturedExcerpt?: string | null }
): Promise<{ pointer?: P10EvidencePointer; notebookRef?: NotebookRefResolution; error?: string }> {
  const sourceRef = `${NOTEBOOK_REF_PREFIX}${notebookPageId}`;
  const resolution = await resolveNotebookReference(sourceRef);
  if (!resolution.valid) {
    return { error: resolution.error, notebookRef: resolution };
  }

  const result = await addEvidencePointer(insightId, findingId, {
    type: 'operator_note',
    sourceRef,
    sourceFingerprint: opts?.sourceFingerprint || `notebook_page:${notebookPageId}`,
    capturedExcerpt: opts?.capturedExcerpt ?? null,
  });

  return { ...result, notebookRef: resolution };
}

export async function removeEvidencePointer(
  insightId: string,
  findingId: string,
  input: RemovePointerInput,
  actorUserId?: string | null
): Promise<{ success: boolean; error?: string }> {
  const finding = await getFinding(insightId, findingId);
  if (!finding) return { success: false, error: 'Finding not found' };

  const pointer = finding.evidence_pointers.find((item) => item.pointerId === input.pointerId);
  if (!pointer) return { success: false, error: 'Pointer not found' };
  if (pointer.isTombstone) return { success: false, error: 'Pointer is already tombstoned' };
  if (!input.removal_reason?.trim()) {
    return { success: false, error: 'removal_reason is required for pointer removal' };
  }

  const now = new Date().toISOString();
  await queryHelpers.queryRun(
    `UPDATE interview_insight_evidence_pointers
     SET pointer_state = 'removed',
         removal_reason = ?,
         removed_at = ?,
         updated_at = ?
     WHERE id = ? AND finding_id = ?`,
    [input.removal_reason.trim(), now, now, input.pointerId, findingId]
  );
  await queryHelpers.queryRun(
    `UPDATE interview_insight_findings SET updated_at = ?, updated_by = ? WHERE id = ?`,
    [now, actorUserId || null, findingId]
  );
  await recordAuditEvent({
    organizationId: finding.organizationId,
    insightId,
    findingId,
    entityType: 'evidence_pointer',
    entityId: input.pointerId,
    action: 'tombstoned',
    actorUserId: actorUserId || null,
    detail: { removalReason: input.removal_reason.trim() },
  });

  return { success: true };
}

export async function buildHandoffPayload(
  insightId: string,
  findingId: string
): Promise<{ payload?: P10HandoffToInitiativesPayload; error?: string }> {
  const finding = await getFinding(insightId, findingId);
  if (!finding) return { error: 'Finding not found' };

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
    return { error: `Cannot handoff: ${publishCheck.reason}` };
  }
  if (finding.readback_status !== 'confirmed_by_client') {
    return { error: 'Client readback confirmation is required before handoff' };
  }

  const payload = buildP10HandoffToInitiativesSkeleton({
    insightArtifactId: insightId,
    findingId: finding.id,
    findingStatement: finding.finding_statement,
    confidenceLevel: (finding.confidence_level === 'insufficient'
      ? 'unknown'
      : finding.confidence_level) as any,
    limits: finding.limits,
    nextAction: finding.next_action,
    evidencePointers: finding.evidence_pointers.filter((pointer) => !pointer.isTombstone),
  });

  return { payload };
}

function collectLinkedOpportunities(insight: Insight, answerId: string): string[] {
  return (insight.opportunities || [])
    .filter((item) => (item.evidence_refs || []).includes(answerId))
    .map((item) => String(item.title || '').trim())
    .filter(Boolean);
}

async function loadAnswerSourceMetadata(
  answerIds: string[]
): Promise<Record<string, { sessionId?: string; respondentLabel?: string; respondentRole?: string; department?: string }>> {
  if (answerIds.length === 0) return {};
  const placeholders = answerIds.map(() => '?').join(', ');
  const rows = await queryHelpers.queryAll<any>(
    `SELECT
       q.id as answer_id,
       q.session_id,
       COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '') AS respondent_label,
       u.job_title,
       u.department
     FROM interview_questions q
     LEFT JOIN interview_sessions s ON s.id = q.session_id
     LEFT JOIN users u ON u.id = s.owner_id
     WHERE q.id IN (${placeholders})`,
    answerIds
  );
  return (rows || []).reduce<Record<string, { sessionId?: string; respondentLabel?: string; respondentRole?: string; department?: string }>>(
    (acc, row) => {
      const answerId = String(row.answer_id || '').trim();
      if (!answerId) return acc;
      acc[answerId] = {
        sessionId: row.session_id ? String(row.session_id) : undefined,
        respondentLabel: String(row.respondent_label || '').trim() || undefined,
        respondentRole: row.job_title ? String(row.job_title) : undefined,
        department: row.department ? String(row.department) : undefined,
      };
      return acc;
    },
    {}
  );
}

export async function buildSourcePack(insightId: string): Promise<P10SourcePack | null> {
  await ensureTables();
  const insight = await getInsightById(insightId);
  if (!insight) return null;
  const findings = await listFindings(insightId);
  const pointerByAnswer = new Map<string, P10EvidencePointer[]>();
  let activePointerCount = 0;
  findings.forEach((finding) => {
    finding.evidence_pointers.forEach((pointer) => {
      if (!pointer.isTombstone) activePointerCount += 1;
      if (pointer.isTombstone || !pointer.sourceRef.startsWith('answer:')) return;
      const answerId = pointer.sourceRef.slice('answer:'.length);
      const existing = pointerByAnswer.get(answerId) || [];
      existing.push(pointer);
      pointerByAnswer.set(answerId, existing);
    });
  });
  const answerIds = (insight.evidenceMap || [])
    .map((entry) => String(entry.answer_id || '').trim())
    .filter(Boolean);
  const sourceMeta = await loadAnswerSourceMetadata(answerIds).catch(() => ({}));
  const entries = (insight.evidenceMap || []).map((entry) => {
    const answerId = String(entry.answer_id || '').trim();
    const capturedPointers = pointerByAnswer.get(answerId) || [];
    const meta = sourceMeta[answerId] || {};
    return {
      answerId,
      questionText: String(entry.question_text || ''),
      answerSnippet: String(entry.answer_snippet || ''),
      respondentLabel: meta.respondentLabel || null,
      respondentRole: meta.respondentRole || null,
      department: meta.department || null,
      sourceSessionId: meta.sessionId || null,
      linkedThemes: Array.isArray(entry.linked_themes) ? entry.linked_themes.map(String) : [],
      linkedIssues: Array.isArray(entry.linked_issues) ? entry.linked_issues.map(String) : [],
      linkedOpportunities: collectLinkedOpportunities(insight, answerId),
      capturedPointers,
      degradedReason: capturedPointers.length === 0 ? 'missing_pointer' : undefined,
    } satisfies P10SourcePackEntry;
  });
  const degradedReasons = Array.from(
    new Set(entries.map((entry) => entry.degradedReason).filter(Boolean) as string[])
  );
  return {
    insightId,
    sourceSessionIds: insight.sourceSessionIds || [],
    entries,
    degraded: degradedReasons.length > 0,
    degradedReasons,
    activePointerCount,
  };
}

export async function recordHandoff(
  insightId: string,
  findingId: string,
  payload: P10HandoffToInitiativesPayload,
  targetInitiativeId?: string,
  options?: {
    organizationId?: string;
    actorUserId?: string | null;
    targetRefType?: string;
    status?: string;
  }
): Promise<void> {
  const finding = await getFinding(insightId, findingId);
  const organizationId = options?.organizationId || finding?.organizationId;
  if (!organizationId) return;

  const existing = targetInitiativeId
    ? await queryHelpers.queryOne<{ id: string }>(
        `SELECT id FROM interview_insight_handoffs
         WHERE insight_id = ? AND finding_id = ? AND target_kind = 'initiative' AND target_id = ?
         LIMIT 1`,
        [insightId, findingId, targetInitiativeId]
      )
    : null;
  if (existing?.id) return;

  const now = new Date().toISOString();
  await queryHelpers.queryRun(
    `INSERT INTO interview_insight_handoffs
     (id, organization_id, insight_id, finding_id, target_kind, target_id, target_ref_type, status, payload_json, operator_decision_json, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'initiative', ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uuidv4(),
      organizationId,
      insightId,
      findingId,
      targetInitiativeId || null,
      options?.targetRefType || (targetInitiativeId ? 'linked' : 'handoff_request'),
      options?.status || 'pending',
      JSON.stringify(payload),
      JSON.stringify({ linkedToExisting: Boolean(targetInitiativeId) }),
      options?.actorUserId || null,
      now,
      now,
    ]
  );
  await recordAuditEvent({
    organizationId,
    insightId,
    findingId,
    entityType: 'handoff',
    entityId: findingId,
    action: 'created',
    actorUserId: options?.actorUserId || null,
    detail: {
      targetInitiativeId: targetInitiativeId || null,
      targetRefType: options?.targetRefType || (targetInitiativeId ? 'linked' : 'handoff_request'),
    },
  });
}

export async function getHandoffLog(insightId: string): Promise<HandoffLogEntry[]> {
  await ensureTables();
  const rows = await queryHelpers.queryAll<any>(
    `SELECT id, finding_id, payload_json, target_id, target_ref_type, status, created_at
     FROM interview_insight_handoffs
     WHERE insight_id = ?
     ORDER BY created_at DESC`,
    [insightId]
  );
  return rows.map((row) => ({
    id: String(row.id),
    findingId: String(row.finding_id),
    payload: JSON.parse(String(row.payload_json || '{}')) as P10HandoffToInitiativesPayload,
    targetInitiativeId: row.target_id ? String(row.target_id) : undefined,
    targetRefType: row.target_ref_type ? String(row.target_ref_type) : undefined,
    status: row.status ? String(row.status) : undefined,
    createdAt: String(row.created_at),
  }));
}

function scheduleSurveyLinkageValidation(
  insightId: string,
  findingId: string,
  sourceRef: string
): void {
  void (async () => {
    try {
      const { validateSurveyLinkage } = await import('./insightSignalBridgeService.js');
      const result = await validateSurveyLinkage(sourceRef);
      if (!result.valid) {
        logger.warn(
          `[InsightFindings] survey_linkage validation warning for finding ${findingId} in insight ${insightId}: ${result.reason}`
        );
      }
    } catch {
      // non-blocking by design
    }
  })();
}
