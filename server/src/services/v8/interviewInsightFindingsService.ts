import { v4 as uuidv4 } from 'uuid';

import type { InsightStatus } from '../InterviewInsightService.js';
import {
  type P10ConfidenceLevel,
  type P10EvidencePointer,
  type P10EvidencePointerType,
  type P10HandoffToInitiativesPayload,
  isValidP10ConfidenceLevel,
  isValidP10EvidencePointerType,
  canPublishFinding,
  buildP10HandoffToInitiativesSkeleton,
} from './interviewInsightCanon.js';

// ────────────────────────────────────────────────────────────────
// L7.2 — Notebook linkage for operator_note evidence pointers
// ────────────────────────────────────────────────────────────────

export const NOTEBOOK_REF_PREFIX = 'notebook://';

export interface NotebookRefResolution {
  valid: boolean;
  pageId: string | null;
  title?: string;
  error?: string;
}

/**
 * Parse a sourceRef that uses the `notebook://<pageId>` convention.
 * Returns the extracted pageId or null if the format doesn't match.
 */
export function parseNotebookSourceRef(sourceRef: string): string | null {
  if (!sourceRef.startsWith(NOTEBOOK_REF_PREFIX)) return null;
  const pageId = sourceRef.slice(NOTEBOOK_REF_PREFIX.length).trim();
  return pageId.length > 0 ? pageId : null;
}

/**
 * Check whether a sourceRef points to a notebook entry.
 */
export function isNotebookSourceRef(sourceRef: string): boolean {
  return sourceRef.startsWith(NOTEBOOK_REF_PREFIX);
}

/**
 * Resolve a notebook reference by looking up the page in the database.
 * Falls back gracefully if the notebook_pages table doesn't exist yet.
 */
export async function resolveNotebookReference(sourceRef: string): Promise<NotebookRefResolution> {
  const pageId = parseNotebookSourceRef(sourceRef);
  if (!pageId) {
    return { valid: false, pageId: null, error: 'Invalid notebook reference format. Expected notebook://<pageId>' };
  }

  try {
    const { get } = await import('../../utils/DbPromise.js');
    const row: any = await get(
      `SELECT id, title FROM notebook_pages WHERE id = ? LIMIT 1`,
      [pageId]
    );

    if (!row) {
      return { valid: false, pageId, error: `Notebook page not found: ${pageId}` };
    }

    return { valid: true, pageId, title: row.title || undefined };
  } catch {
    // notebook_pages table may not exist — treat as valid (non-blocking)
    return { valid: true, pageId, title: undefined };
  }
}

export { type P10ConfidenceLevel, type P10EvidencePointer };

export interface P10Finding {
  id: string;
  insightId: string;
  finding_statement: string;
  confidence_level: P10ConfidenceLevel;
  limits: string;
  next_action: string;
  evidence_pointers: P10EvidencePointer[];
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

const findingsStore = new Map<string, P10Finding[]>();
const handoffLog = new Map<string, Array<{ findingId: string; payload: P10HandoffToInitiativesPayload; targetInitiativeId?: string; createdAt: string }>>();

function dedupeKey(pointer: { sourceRef: string; sourceFingerprint: string }): string {
  return `${pointer.sourceRef}::${pointer.sourceFingerprint}`;
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

export function listFindings(insightId: string): P10Finding[] {
  return findingsStore.get(insightId) ?? [];
}

export function getFinding(insightId: string, findingId: string): P10Finding | undefined {
  return listFindings(insightId).find((f) => f.id === findingId);
}

export function addFinding(insightId: string, input: CreateFindingInput): { finding?: P10Finding; error?: string } {
  if (!isValidP10ConfidenceLevel(input.confidence_level)) {
    return { error: `Invalid confidence level: ${input.confidence_level}` };
  }
  if (!input.finding_statement?.trim()) {
    return { error: 'finding_statement is required' };
  }
  if (!input.limits?.trim()) {
    return { error: 'limits is required' };
  }
  if (!input.next_action?.trim()) {
    return { error: 'next_action is required' };
  }

  const now = new Date().toISOString();
  const pointers: P10EvidencePointer[] = [];
  const seenKeys = new Set<string>();

  for (const raw of input.evidence_pointers ?? []) {
    if (!isValidP10EvidencePointerType(raw.type)) {
      return { error: `Invalid evidence pointer type: ${raw.type}` };
    }
    const key = dedupeKey(raw);
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);

    pointers.push({
      pointerId: `ptr_${uuidv4()}`,
      type: raw.type as P10EvidencePointerType,
      sourceRef: raw.sourceRef,
      capturedAt: now,
      sourceFingerprint: raw.sourceFingerprint,
      capturedExcerpt: raw.capturedExcerpt ?? null,
      isTombstone: false,
    });
  }

  const finding: P10Finding = {
    id: `finding_${uuidv4()}`,
    insightId,
    finding_statement: input.finding_statement.trim(),
    confidence_level: input.confidence_level as P10ConfidenceLevel,
    limits: input.limits.trim(),
    next_action: input.next_action.trim(),
    evidence_pointers: pointers,
    created_at: now,
    updated_at: now,
  };

  const existing = findingsStore.get(insightId) ?? [];
  existing.push(finding);
  findingsStore.set(insightId, existing);

  return { finding };
}

export function updateFinding(
  insightId: string,
  findingId: string,
  input: UpdateFindingInput
): { finding?: P10Finding; error?: string } {
  const findings = findingsStore.get(insightId);
  if (!findings) return { error: 'Insight not found' };

  const idx = findings.findIndex((f) => f.id === findingId);
  if (idx === -1) return { error: 'Finding not found' };

  const finding = findings[idx];

  if (input.confidence_level !== undefined) {
    if (!isValidP10ConfidenceLevel(input.confidence_level)) {
      return { error: `Invalid confidence level: ${input.confidence_level}` };
    }
    finding.confidence_level = input.confidence_level as P10ConfidenceLevel;
  }
  if (input.finding_statement !== undefined) {
    if (!input.finding_statement.trim()) return { error: 'finding_statement cannot be empty' };
    finding.finding_statement = input.finding_statement.trim();
  }
  if (input.limits !== undefined) {
    if (!input.limits.trim()) return { error: 'limits cannot be empty' };
    finding.limits = input.limits.trim();
  }
  if (input.next_action !== undefined) {
    if (!input.next_action.trim()) return { error: 'next_action cannot be empty' };
    finding.next_action = input.next_action.trim();
  }

  finding.updated_at = new Date().toISOString();
  findings[idx] = finding;

  return { finding };
}

export function addEvidencePointer(
  insightId: string,
  findingId: string,
  input: AddPointerInput
): { pointer?: P10EvidencePointer; error?: string } {
  const finding = getFinding(insightId, findingId);
  if (!finding) return { error: 'Finding not found' };

  if (!isValidP10EvidencePointerType(input.type)) {
    return { error: `Invalid evidence pointer type: ${input.type}` };
  }

  // L7.2: Validate notebook reference format for operator_note pointers
  if (input.type === 'operator_note' && isNotebookSourceRef(input.sourceRef)) {
    const pageId = parseNotebookSourceRef(input.sourceRef);
    if (!pageId) {
      return { error: 'Invalid notebook reference format. Expected notebook://<pageId>' };
    }
  }

  // L7.1: Schedule async survey linkage validation for survey_linkage pointers
  if (input.type === 'survey_linkage') {
    scheduleSurveyLinkageValidation(insightId, findingId, input.sourceRef);
  }

  const key = dedupeKey(input);
  const existing = finding.evidence_pointers.find(
    (p) => !p.isTombstone && dedupeKey({ sourceRef: p.sourceRef, sourceFingerprint: p.sourceFingerprint }) === key
  );
  if (existing) {
    return { pointer: existing };
  }

  const now = new Date().toISOString();
  const pointer: P10EvidencePointer = {
    pointerId: `ptr_${uuidv4()}`,
    type: input.type as P10EvidencePointerType,
    sourceRef: input.sourceRef,
    capturedAt: now,
    sourceFingerprint: input.sourceFingerprint,
    capturedExcerpt: input.capturedExcerpt ?? null,
    isTombstone: false,
  };

  finding.evidence_pointers.push(pointer);
  finding.updated_at = now;

  return { pointer };
}

/**
 * L7.2: Add an operator_note evidence pointer that links to a notebook entry.
 * Resolves the notebook reference asynchronously and returns the created pointer.
 */
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

  const result = addEvidencePointer(insightId, findingId, {
    type: 'operator_note',
    sourceRef,
    sourceFingerprint: opts?.sourceFingerprint || `notebook_page:${notebookPageId}`,
    capturedExcerpt: opts?.capturedExcerpt ?? null,
  });

  return { ...result, notebookRef: resolution };
}

export function removeEvidencePointer(
  insightId: string,
  findingId: string,
  input: RemovePointerInput
): { success: boolean; error?: string } {
  const finding = getFinding(insightId, findingId);
  if (!finding) return { success: false, error: 'Finding not found' };

  const pointer = finding.evidence_pointers.find((p) => p.pointerId === input.pointerId);
  if (!pointer) return { success: false, error: 'Pointer not found' };
  if (pointer.isTombstone) return { success: false, error: 'Pointer is already tombstoned' };

  if (!input.removal_reason?.trim()) {
    return { success: false, error: 'removal_reason is required for pointer removal' };
  }

  pointer.isTombstone = true;
  pointer.removalReason = input.removal_reason.trim();
  finding.updated_at = new Date().toISOString();

  return { success: true };
}

export function buildHandoffPayload(
  insightId: string,
  findingId: string
): { payload?: P10HandoffToInitiativesPayload; error?: string } {
  const finding = getFinding(insightId, findingId);
  if (!finding) return { error: 'Finding not found' };

  const publishCheck = canPublishFinding({
    confidenceLevel: finding.confidence_level,
    evidencePointers: finding.evidence_pointers,
    limits: finding.limits,
  });

  if (!publishCheck.allowed) {
    return { error: `Cannot handoff: ${publishCheck.reason}` };
  }

  const activePointers = finding.evidence_pointers.filter((p) => !p.isTombstone);

  const payload = buildP10HandoffToInitiativesSkeleton({
    insightArtifactId: insightId,
    findingId: finding.id,
    findingStatement: finding.finding_statement,
    confidenceLevel: finding.confidence_level,
    limits: finding.limits,
    nextAction: finding.next_action,
    evidencePointers: activePointers,
  });

  return { payload };
}

export function recordHandoff(
  insightId: string,
  findingId: string,
  payload: P10HandoffToInitiativesPayload,
  targetInitiativeId?: string
): void {
  const log = handoffLog.get(insightId) ?? [];
  log.push({
    findingId,
    payload,
    targetInitiativeId,
    createdAt: new Date().toISOString(),
  });
  handoffLog.set(insightId, log);
}

export function getHandoffLog(insightId: string) {
  return handoffLog.get(insightId) ?? [];
}

// ==========================================
// L7.1 — Survey linkage validation (async, non-blocking)
// ==========================================

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
        const { default: loggerMod } = await import('../../utils/Logger.js');
        loggerMod.warn(
          `[InsightFindings] survey_linkage validation warning for finding ${findingId} ` +
            `in insight ${insightId}: ${result.reason}`
        );
      }
    } catch {
      // Non-blocking — validation failure does not block pointer creation per §2.3.3
    }
  })();
}
