/**
 * P07 §2.3.6 — Notebook handoff builder
 *
 * Structured payloads for handing off notebook notes to Radar (P06), Inicjatywy (P11), and Teresa (P08).
 */

import { all as dbAll, get as dbGet } from '../../utils/DbPromise.js';
import { getTableColumns } from '../../utils/dbSchema.js';
import logger from '../../utils/Logger.js';
import { parseNotebookAttachments } from '../notebookAttachmentService.js';
import { parseNotebookCaptureMetadata } from '../notebookSourceFileService.js';
import {
  P07_HANDOFF_COMMON_FIELDS,
  P07_HANDOFF_TARGETS,
  P07_PROVENANCE_LANGUAGE,
  type P07Provenance,
} from './notebookCanon.js';

const LOG_PREFIX = '[P07-NotebookHandoff]';

// Re-export provenance canon for consumers that validate or display capture lineage.
export const NOTEBOOK_HANDOFF_PROVENANCE_VALUES = P07_PROVENANCE_LANGUAGE;
export type NotebookHandoffProvenance = P07Provenance;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NotebookHandoffCommon {
  origin: 'notebook';
  note_id: string;
  note_deeplink: string;
  title: string;
  summary: string[];
  tags: string[];
  status: string;
  maturity: string;
  note_type: string | null;
  capture_source: string | null;
  capture_metadata: Record<string, unknown> | null;
  linked_artifacts: Array<{ type: string; id: string; deeplink: string }>;
  attachments: Array<{
    attachment_id: string;
    filename: string;
    status: string;
    download_ref: string;
  }>;
  evidence_pointers: Array<{ block_ref?: string; attachment_ref?: string }>;
  uncertainty_boundary: { missing_inputs: string[]; open_questions: string[] } | null;
  missing_inputs: string[];
  owner: string;
  last_updated_at: string;
}

export interface RadarSignalSuggestion {
  category: string;
  why_now: string;
  priority_hint: string;
  evidence_pointers: string[];
  open_questions: string[];
  missing_inputs: string[];
}

export interface InitiativeSeed {
  problem_statement: string;
  proposed_outcome: string;
  assumptions: string[];
  risks: string[];
  next_steps: string[];
  time_window: string | null;
}

export interface AssistantContext {
  user_intent: string;
  constraints: string[];
  do_not_assume: string[];
  allowed_actions: string[];
  citations: string[];
}

export interface NotebookToRadarPayload extends NotebookHandoffCommon {
  radar_signal_suggestion: RadarSignalSuggestion;
}

export interface NotebookToInitiativePayload extends NotebookHandoffCommon {
  initiative_seed: InitiativeSeed;
}

export interface NotebookToTeresaPayload extends NotebookHandoffCommon {
  assistant_context: AssistantContext;
}

export class NotebookHandoffError extends Error {
  readonly code: 'NOTEBOOK_PAGE_NOT_FOUND' | 'NOTEBOOK_TABLE_NOT_CONFIGURED';

  readonly statusCode: number;

  constructor(
    message: string,
    code: 'NOTEBOOK_PAGE_NOT_FOUND' | 'NOTEBOOK_TABLE_NOT_CONFIGURED',
    statusCode = 404
  ) {
    super(message);
    this.name = 'NotebookHandoffError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const NOTEBOOK_SOURCE_TYPES = new Set(['notebook_page', 'notebook']);

function colExpr(cols: Set<string>, name: string, literalSql: string): string {
  return cols.has(name) ? name : literalSql;
}

function buildNotebookHandoffSelectList(cols: Set<string>): string {
  const base = [
    'id',
    'organization_id',
    'owner_user_id',
    'title',
    'content_text',
    'tags_json',
    'created_at',
    'updated_at',
    `${colExpr(cols, 'status', "'active'")} AS status`,
    `${colExpr(cols, 'maturity', "'seed'")} AS maturity`,
    `${colExpr(cols, 'note_type', 'NULL')} AS note_type`,
    `${colExpr(cols, 'capture_source', 'NULL')} AS capture_source`,
    `${colExpr(cols, 'capture_metadata', 'NULL')} AS capture_metadata`,
    `${colExpr(cols, 'summary', 'NULL')} AS summary`,
    `${colExpr(cols, 'attachments_json', "'[]'")} AS attachments_json`,
  ];
  return base.join(', ');
}

interface NotebookRow {
  id: string;
  organization_id: string;
  owner_user_id: string;
  title: string | null;
  content_text: string | null;
  tags_json: string | null;
  created_at: string | Date | null;
  updated_at: string | Date | null;
  status: string | null;
  maturity: string | null;
  note_type: string | null;
  capture_source: string | null;
  capture_metadata: string | null;
  summary: string | null;
  attachments_json: string | null;
}

function toIsoString(value: string | Date | null | undefined): string {
  if (!value) return new Date(0).toISOString();
  if (value instanceof Date) return value.toISOString();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toISOString();
}

function parseTagsJson(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((t) => String(t)).filter(Boolean);
  } catch {
    return [];
  }
}

function buildSummaryLines(row: NotebookRow): string[] {
  if (row.summary && String(row.summary).trim()) {
    return String(row.summary)
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  const text = String(row.content_text || '').trim();
  if (!text) return [];
  const chunks = text
    .split(/\n\s*\n/)
    .map((c) => c.trim())
    .filter(Boolean);
  if (chunks.length > 0) {
    return chunks.slice(0, 5);
  }
  return text.length > 400 ? [text.slice(0, 400).trim() + '…'] : [text];
}

function buildNoteDeeplink(noteId: string): string {
  return `/my-work/notebook/${noteId}`;
}

function buildAttachmentDownloadRef(noteId: string, attachmentId: string): string {
  return `/api/v8/my-work/notebook/pages/${noteId}/attachments/${attachmentId}/download`;
}

function buildLinkedArtifactDeeplink(artifactType: string, artifactId: string): string {
  const t = String(artifactType || 'artifact').replace(/^\//, '');
  return `/${encodeURIComponent(t)}/${encodeURIComponent(artifactId)}`;
}

function isNotebookRef(type: string, id: string, noteId: string): boolean {
  return NOTEBOOK_SOURCE_TYPES.has(type) && String(id) === String(noteId);
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((x) => String(x).trim()).filter((s) => s.length > 0);
}

function extractUncertaintyAndMissing(captureMeta: Record<string, unknown> | null): {
  uncertainty_boundary: { missing_inputs: string[]; open_questions: string[] } | null;
  missing_inputs: string[];
} {
  if (!captureMeta) {
    return { uncertainty_boundary: null, missing_inputs: [] };
  }
  const rawUb = captureMeta.uncertainty_boundary;
  let uncertainty_boundary: { missing_inputs: string[]; open_questions: string[] } | null = null;
  if (rawUb && typeof rawUb === 'object' && !Array.isArray(rawUb)) {
    const o = rawUb as Record<string, unknown>;
    uncertainty_boundary = {
      missing_inputs: normalizeStringArray(o.missing_inputs),
      open_questions: normalizeStringArray(o.open_questions),
    };
  }
  const topMissing = normalizeStringArray(captureMeta.missing_inputs);
  const missing_inputs =
    topMissing.length > 0
      ? topMissing
      : uncertainty_boundary?.missing_inputs?.length
        ? [...uncertainty_boundary.missing_inputs]
        : [];
  return { uncertainty_boundary, missing_inputs };
}

function evidencePointersToStrings(pointers: NotebookHandoffCommon['evidence_pointers']): string[] {
  return pointers.map((p) => {
    if (p.block_ref) return `block:${p.block_ref}`;
    if (p.attachment_ref) return `attachment:${p.attachment_ref}`;
    return 'pointer:unknown';
  });
}

interface LinkGraphRow {
  source_type: string;
  source_id: string;
  target_type: string;
  target_id: string;
  block_id: string | null;
}

async function loadLinkedArtifactsAndEvidence(
  organizationId: string,
  noteId: string
): Promise<{
  linked_artifacts: NotebookHandoffCommon['linked_artifacts'];
  evidence_pointers: NotebookHandoffCommon['evidence_pointers'];
}> {
  const sql = `
    SELECT source_type, source_id, target_type, target_id, block_id
    FROM link_graph_edges
    WHERE organization_id = ?
      AND (
        (source_type IN ('notebook_page', 'notebook') AND source_id = ?)
        OR (target_type IN ('notebook_page', 'notebook') AND target_id = ?)
        OR (container_type = 'notebook_page' AND container_id = ?)
      )
  `;

  const rows = await dbAll<LinkGraphRow>(sql, [organizationId, noteId, noteId, noteId], {
    fallback: true,
  });

  const artifactKeys = new Set<string>();
  const linked_artifacts: NotebookHandoffCommon['linked_artifacts'] = [];
  const evidence_pointers: NotebookHandoffCommon['evidence_pointers'] = [];

  const pushArtifact = (type: string, id: string) => {
    const t = String(type || '').trim();
    const i = String(id || '').trim();
    if (!t || !i || isNotebookRef(t, i, noteId)) return;
    const key = `${t}:${i}`;
    if (artifactKeys.has(key)) return;
    artifactKeys.add(key);
    linked_artifacts.push({
      type: t,
      id: i,
      deeplink: buildLinkedArtifactDeeplink(t, i),
    });
  };

  for (const row of rows || []) {
    if (row.block_id) {
      evidence_pointers.push({ block_ref: String(row.block_id) });
    }
    pushArtifact(row.source_type, row.source_id);
    pushArtifact(row.target_type, row.target_id);
  }

  return { linked_artifacts, evidence_pointers };
}

async function loadNotebookRow(
  noteId: string,
  organizationId: string
): Promise<NotebookRow | null> {
  const cols = await getTableColumns('notebook_pages');
  if (!cols || cols.size === 0) {
    logger.warn(`${LOG_PREFIX} notebook_pages table missing or empty schema`);
    return null;
  }

  const selectList = buildNotebookHandoffSelectList(cols);
  const sql = `SELECT ${selectList} FROM notebook_pages WHERE id = ? AND organization_id = ? LIMIT 1`;

  return dbGet<NotebookRow>(sql, [noteId, organizationId], { fallback: false });
}

function mapAttachmentsForHandoff(
  noteId: string,
  attachmentsJson: string | null | undefined
): NotebookHandoffCommon['attachments'] {
  const parsed = parseNotebookAttachments(attachmentsJson ?? null);
  return parsed.map((a) => ({
    attachment_id: a.id,
    filename: a.name || 'attachment',
    status: a.storageKey ? 'available' : 'failed',
    download_ref: buildAttachmentDownloadRef(noteId, a.id),
  }));
}

function captureMetadataRecord(row: NotebookRow): Record<string, unknown> | null {
  const parsed = parseNotebookCaptureMetadata(row.capture_metadata);
  if (!parsed) return null;
  return { ...parsed } as Record<string, unknown>;
}

/** Required keys may use `null` for optional JSON columns (P07 common payload). */
const COMMON_NULLABLE_KEYS = new Set<string>([
  'note_type',
  'capture_source',
  'capture_metadata',
  'uncertainty_boundary',
]);

function commonFieldMissing(key: string, value: unknown): boolean {
  if (value === undefined) return true;
  if (value === null) return !COMMON_NULLABLE_KEYS.has(key);
  return false;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function buildHandoffCommon(
  noteId: string,
  organizationId: string
): Promise<NotebookHandoffCommon> {
  const row = await loadNotebookRow(noteId, organizationId);
  if (!row) {
    const cols = await getTableColumns('notebook_pages');
    if (!cols || cols.size === 0) {
      throw new NotebookHandoffError(
        'Notebook pages table is not configured',
        'NOTEBOOK_TABLE_NOT_CONFIGURED',
        503
      );
    }
    throw new NotebookHandoffError('Notebook page not found', 'NOTEBOOK_PAGE_NOT_FOUND', 404);
  }

  const capture_metadata = captureMetadataRecord(row);
  const { uncertainty_boundary, missing_inputs } = extractUncertaintyAndMissing(capture_metadata);

  const { linked_artifacts, evidence_pointers: edgeEvidence } =
    await loadLinkedArtifactsAndEvidence(organizationId, noteId);

  const attachmentEvidence: NotebookHandoffCommon['evidence_pointers'] = mapAttachmentsForHandoff(
    noteId,
    row.attachments_json
  ).map((a) => ({ attachment_ref: a.attachment_id }));

  const evidence_pointers = [...edgeEvidence, ...attachmentEvidence];

  const common: NotebookHandoffCommon = {
    origin: 'notebook',
    note_id: String(row.id),
    note_deeplink: buildNoteDeeplink(String(row.id)),
    title: String(row.title || 'Untitled'),
    summary: buildSummaryLines(row),
    tags: parseTagsJson(row.tags_json),
    status: String(row.status || 'active'),
    maturity: String(row.maturity || 'seed'),
    note_type: row.note_type != null && String(row.note_type).trim() ? String(row.note_type) : null,
    capture_source: row.capture_source != null ? String(row.capture_source) : null,
    capture_metadata,
    linked_artifacts,
    attachments: mapAttachmentsForHandoff(noteId, row.attachments_json),
    evidence_pointers,
    uncertainty_boundary,
    missing_inputs,
    owner: String(row.owner_user_id || ''),
    last_updated_at: toIsoString(row.updated_at),
  };

  logger.debug(`${LOG_PREFIX} built common handoff`, {
    noteId: common.note_id,
    organizationId,
    linkedCount: common.linked_artifacts.length,
    attachmentCount: common.attachments.length,
  });

  return common;
}

export async function buildRadarHandoff(
  noteId: string,
  organizationId: string,
  suggestion: Partial<RadarSignalSuggestion> = {}
): Promise<NotebookToRadarPayload> {
  const common = await buildHandoffCommon(noteId, organizationId);
  const ub = common.uncertainty_boundary;

  const defaults: RadarSignalSuggestion = {
    category: 'general',
    why_now: common.summary[0] || common.title,
    priority_hint: 'medium',
    evidence_pointers: evidencePointersToStrings(common.evidence_pointers),
    open_questions: ub?.open_questions?.length ? [...ub.open_questions] : [],
    missing_inputs: common.missing_inputs.length ? [...common.missing_inputs] : [],
  };

  const radar_signal_suggestion: RadarSignalSuggestion = {
    category: suggestion.category ?? defaults.category,
    why_now: suggestion.why_now ?? defaults.why_now,
    priority_hint: suggestion.priority_hint ?? defaults.priority_hint,
    evidence_pointers:
      suggestion.evidence_pointers !== undefined
        ? [...suggestion.evidence_pointers]
        : defaults.evidence_pointers,
    open_questions:
      suggestion.open_questions !== undefined
        ? [...suggestion.open_questions]
        : defaults.open_questions,
    missing_inputs:
      suggestion.missing_inputs !== undefined
        ? [...suggestion.missing_inputs]
        : defaults.missing_inputs,
  };

  return { ...common, radar_signal_suggestion };
}

export async function buildInitiativeHandoff(
  noteId: string,
  organizationId: string,
  seed: Partial<InitiativeSeed> = {}
): Promise<NotebookToInitiativePayload> {
  const common = await buildHandoffCommon(noteId, organizationId);

  const defaults: InitiativeSeed = {
    problem_statement: common.title,
    proposed_outcome: common.summary[0] || '',
    assumptions: [],
    risks: [],
    next_steps: common.summary.slice(1, 6),
    time_window: null,
  };

  const initiative_seed: InitiativeSeed = {
    problem_statement: seed.problem_statement ?? defaults.problem_statement,
    proposed_outcome: seed.proposed_outcome ?? defaults.proposed_outcome,
    assumptions: seed.assumptions !== undefined ? [...seed.assumptions] : defaults.assumptions,
    risks: seed.risks !== undefined ? [...seed.risks] : defaults.risks,
    next_steps: seed.next_steps !== undefined ? [...seed.next_steps] : defaults.next_steps,
    time_window: seed.time_window !== undefined ? seed.time_window : defaults.time_window,
  };

  return { ...common, initiative_seed };
}

export async function buildTeresaHandoff(
  noteId: string,
  organizationId: string,
  context: Partial<AssistantContext> = {}
): Promise<NotebookToTeresaPayload> {
  const common = await buildHandoffCommon(noteId, organizationId);

  const defaults: AssistantContext = {
    user_intent: `Continue from notebook note: ${common.title}`,
    constraints: [],
    do_not_assume: common.missing_inputs.length ? [...common.missing_inputs] : [],
    allowed_actions: ['read_note', 'summarize', 'propose_draft'],
    citations: [common.note_deeplink],
  };

  const assistant_context: AssistantContext = {
    user_intent: context.user_intent ?? defaults.user_intent,
    constraints:
      context.constraints !== undefined ? [...context.constraints] : defaults.constraints,
    do_not_assume:
      context.do_not_assume !== undefined ? [...context.do_not_assume] : defaults.do_not_assume,
    allowed_actions:
      context.allowed_actions !== undefined
        ? [...context.allowed_actions]
        : defaults.allowed_actions,
    citations: context.citations !== undefined ? [...context.citations] : defaults.citations,
  };

  return { ...common, assistant_context };
}

export function validateHandoffPayload(
  target: 'radar' | 'inicjatywy' | 'teresa',
  payload: Record<string, unknown>
): { valid: boolean; missingFields: string[] } {
  const config = P07_HANDOFF_TARGETS[target] as any;
  const missingFields: string[] = [];

  const requireNestedKeys = (
    obj: unknown,
    keys: readonly string[],
    prefix: string,
    nullableKeys?: Set<string>
  ) => {
    if (!isPlainObject(obj)) {
      for (const k of keys) {
        missingFields.push(`${prefix}.${k}`);
      }
      return;
    }
    for (const k of keys) {
      if (!(k in obj)) {
        missingFields.push(`${prefix}.${k}`);
        continue;
      }
      const v = obj[k];
      if (v === undefined) {
        missingFields.push(`${prefix}.${k}`);
        continue;
      }
      if (v === null && !nullableKeys?.has(k)) {
        missingFields.push(`${prefix}.${k}`);
      }
    }
  };

  for (const field of config.requiredFields) {
    if (!(field in payload) || commonFieldMissing(field, payload[field])) {
      missingFields.push(field);
    }
  }

  if (target === 'radar') {
    requireNestedKeys(
      payload.radar_signal_suggestion,
      config.signalSuggestionFields,
      'radar_signal_suggestion'
    );
  } else if (target === 'inicjatywy') {
    requireNestedKeys(
      payload.initiative_seed,
      config.initiativeSeedFields,
      'initiative_seed',
      new Set(['time_window'])
    );
  } else {
    requireNestedKeys(
      payload.assistant_context,
      config.assistantContextFields,
      'assistant_context'
    );
  }

  if (missingFields.length === 0) {
    for (const f of P07_HANDOFF_COMMON_FIELDS) {
      const v = payload[f];
      if (commonFieldMissing(f, v)) {
        missingFields.push(f);
        continue;
      }
      if (f === 'summary' || f === 'tags' || f === 'linked_artifacts' || f === 'attachments') {
        if (!Array.isArray(v)) missingFields.push(f);
      }
      if (f === 'capture_metadata' && v !== null && !isPlainObject(v)) {
        missingFields.push(f);
      }
      if (f === 'evidence_pointers' && !Array.isArray(v)) {
        missingFields.push(f);
      }
      if (f === 'missing_inputs' && !Array.isArray(v)) {
        missingFields.push(f);
      }
      if (f === 'uncertainty_boundary' && v !== null && !isPlainObject(v)) {
        missingFields.push(f);
      }
    }
  }

  const valid = missingFields.length === 0;
  return { valid, missingFields };
}

export function getHandoffTargets(): typeof P07_HANDOFF_TARGETS {
  return P07_HANDOFF_TARGETS;
}
