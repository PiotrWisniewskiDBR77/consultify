/**
 * P10 Final V8 — Interview insight artifact canon.
 *
 * §2.3.1 Artifact structure (frozen): finding / evidence / limits / next_action
 * §2.3.2 Confidence semantics (levels + meaning + UI rules; no-overclaim)
 * §2.3.3 Evidence pointer rules (types + source loss prevention + duplicate robustness)
 * §2.3.4 Frozen handoff payload to Inicjatywy (P11)
 * §2.3.5 Anti-duplicate gate
 * §2.3.6 Error / degraded posture (10 scenarios)
 * §2.3.7 Acceptance checklist (12 points)
 *
 * This module bridges the P10 contract vocabulary to the existing
 * InterviewInsightService runtime types.
 */

import type {
  InsightEvidenceMapEntry,
  InsightIssue,
  InsightOpportunity,
  InsightSignal,
  InsightTheme,
} from '../InterviewInsightService.js';

export {
  type InsightEvidenceMapEntry,
  type InsightIssue,
  type InsightOpportunity,
  type InsightSignal,
  type InsightTheme,
};

export const P10_INSIGHT_ARTIFACT_CONTRACT = 'interview_insight_artifact_v1';

// ────────────────────────────────────────────────────────────────
// §2.3.1 — Artifact structure (frozen)
// ────────────────────────────────────────────────────────────────

export const P10_INSIGHT_ARTIFACT_STRUCTURE = {
  finding: {
    description: 'Unit of insight: 1-3 sentence statement of what we claim',
    required_fields: ['finding_statement', 'evidence', 'limits', 'next_action', 'confidence_level'],
  },
  evidence: {
    description: 'List of evidence pointers + short description of supporting data',
    required_fields: ['pointers', 'summary'],
  },
  limits: {
    description: 'Explicit boundaries: what we do not know, did not measure, or may be wrong',
    required_fields: ['description'],
  },
  next_action: {
    description: '1-3 concrete next steps (decision/test/initiative), linked to confidence',
    required_fields: ['actions'],
  },
  artifact_header: {
    description: 'Context, ownership, and summary for the published artifact',
    required_fields: ['context', 'ownership', 'summary_bullets'],
    rules: 'Summary is 3-7 bullets; no new findings absent from the body',
  },
} as const;

export const P10_ARTIFACT_RULE_NO_FINDING_WITHOUT_CONFIDENCE =
  'No finding may exist without (a) confidence_level and (b) limits';

// ────────────────────────────────────────────────────────────────
// §2.3.2 — Confidence semantics (frozen levels)
// ────────────────────────────────────────────────────────────────

export const P10_CONFIDENCE_LEVELS = [
  'high',
  'medium',
  'low',
  'insufficient',
  'contradicted',
] as const;

export type P10ConfidenceLevel = (typeof P10_CONFIDENCE_LEVELS)[number];

export const P10_CONFIDENCE_SEMANTICS: Record<
  P10ConfidenceLevel,
  {
    meaning: string;
    minimumEvidence: string;
    uiRule: string;
    overclaim_guard: string;
  }
> = {
  high: {
    meaning: 'Well-supported within defined context; still has boundaries',
    // Decyzja Master Codex 2026-08-04 (M03R-012). Egzekwuje `evaluateConfidence()`
    // w `interviewConfidenceEvaluator.ts` — ten napis jest opisem tamtej reguły,
    // nie drugim, niezależnym progiem.
    minimumEvidence:
      '2+ pointers from different sources or materially different segments, OR clear triangulation; no unresolved material contradiction',
    uiRule:
      'May show "High confidence" badge; must still expose limits; default next action can be "execute"',
    overclaim_guard: 'No overclaim beyond scope (e.g. no market generalization from org-only data)',
  },
  medium: {
    meaning: 'Credible pattern, but lacks triangulation or full representativeness',
    // Rozróżnienie względem `high`: te same 2+ pointery, ale w JEDNYM źródle
    // lub segmencie. Wcześniej oba poziomy deklarowały "2+ pointers" i były
    // nierozróżnialne.
    minimumEvidence:
      '2+ pointers within a single source/segment OR 1 pointer + strong artifact (e.g. transcript excerpt); no cross-source triangulation',
    uiRule:
      'UI shows "Assumptions" + "Limits" always visible without scroll-trap; handoff to initiative allowed with visible limits',
    overclaim_guard: 'No "root cause" claims without evidence',
  },
  low: {
    meaning: 'Hypothesis / signal; may be accurate but easily wrong',
    minimumEvidence: '1+ pointer, but narrow / singular',
    uiRule:
      'Label "Hypothesis"; warning shown; handoff to initiative only as "investigate", not "execute"',
    overclaim_guard: 'Forbidden: language like "certainly / always / everyone"',
  },
  insufficient: {
    meaning: 'No assessment; finding is not ready',
    minimumEvidence: 'None',
    uiRule: 'Must look like draft; block publish/handoff',
    overclaim_guard: 'Publication without confidence is forbidden',
  },
  contradicted: {
    meaning: 'Evidence points in conflicting directions for this claim in this context',
    minimumEvidence: 'At least two credible pointers that materially disagree',
    uiRule:
      'Show contradiction explicitly; no single narrative; next action must be "resolve / validate"',
    overclaim_guard: 'Forbidden: picking one side without new evidence or scope change',
  },
} as const;

export const P10_EXTENDED_CONFIDENCE_LEVELS = [
  'unknown',
  'low',
  'medium',
  'high',
  'contradicted',
] as const;

export type P10ExtendedConfidenceLevel = (typeof P10_EXTENDED_CONFIDENCE_LEVELS)[number];

export const P10_NO_OVERCLAIM_RULES = [
  'Confidence applies to THIS context (artifact header), not the world',
  'UI must never render findings as "facts" without showing confidence + limits',
  'Causality claims (A causes B) allowed only at "high" with supporting evidence; otherwise language must be probabilistic',
] as const;

// ────────────────────────────────────────────────────────────────
// §2.3.3 — Evidence pointer types (7 types, frozen)
// ────────────────────────────────────────────────────────────────

export const P10_EVIDENCE_POINTER_TYPES = [
  'interview_session',
  'question_answer',
  'transcript_excerpt',
  'survey_linkage',
  'attachment',
  'export_artifact',
  'operator_note',
] as const;

export type P10EvidencePointerType = (typeof P10_EVIDENCE_POINTER_TYPES)[number];

export interface P10EvidencePointer {
  pointerId: string;
  type: P10EvidencePointerType;
  sourceRef: string;
  capturedAt: string;
  sourceFingerprint: string;
  capturedExcerpt?: string | null;
  removalReason?: string | null;
  isTombstone: boolean;
}

// ────────────────────────────────────────────────────────────────
// §2.3.3 — Source loss prevention rules
// ────────────────────────────────────────────────────────────────

export const P10_SOURCE_LOSS_RULES = {
  append_only_default: 'Evidence set is append-only by default; adding a pointer is always allowed',
  removal_requires_tombstone:
    'Removing a pointer requires removal_reason and leaves a tombstone (pointer visible in audit as "removed")',
  pointer_stores: [
    'stable source_ref (id + type)',
    'captured_excerpt (if applicable) + captured_at',
    'source_fingerprint (hash/etag/version) to detect drift or source replacement',
  ] as const,
  edit_does_not_remove_pointers:
    'Editing finding statement / limits / next action NEVER removes pointers automatically',
  broken_reference_handling:
    'When source disappears (deleted/redacted/permission loss), pointer remains as broken reference with clear UI: "source unavailable"',
} as const;

// ────────────────────────────────────────────────────────────────
// §2.3.4 — Frozen handoff payload to Inicjatywy (P11)
// ────────────────────────────────────────────────────────────────

export interface P10HandoffToInitiativesPayload {
  source_insight_artifact_id: string;
  source_insight_artifact_deep_link: string;
  source_finding_id: string;
  source_finding_deep_link: string;
  finding_statement: string;
  confidence_level: P10ExtendedConfidenceLevel;
  limits: string;
  evidence_pointers: P10EvidencePointer[];
  next_action: string;
  assumptions?: string | null;
  tags?: string[];
  owner_suggestion?: string | null;
}

export const P10_HANDOFF_TO_INITIATIVES = {
  required_fields: [
    'source_insight_artifact_id',
    'source_insight_artifact_deep_link',
    'source_finding_id',
    'source_finding_deep_link',
    'finding_statement',
    'confidence_level',
    'limits',
    'evidence_pointers',
    'next_action',
  ] as const,
  optional_fields: ['assumptions', 'tags', 'owner_suggestion'] as const,
  rule: 'Initiative must be able to reconstruct context via links-first (max 5 links in context pack), without copying full transcripts',
} as const;

export const P10_READBACK_STATUSES = [
  'draft_interpretation',
  'shared_for_readback',
  'confirmed_by_client',
  'partially_confirmed',
  'challenged_by_client',
  'needs_more_evidence',
] as const;

export type P10ReadbackStatus = (typeof P10_READBACK_STATUSES)[number];

// ────────────────────────────────────────────────────────────────
// §2.3.5 — Anti-duplicate gate
// ────────────────────────────────────────────────────────────────

export const P10_ANTI_DUPLICATE_RULES = {
  not_collection_engine:
    'Insight is not an engine collecting data; source of truth for input remains upstream (Interview, Ankiety / P09)',
  no_parallel_answer_store:
    'Insight does not create a parallel answer store; stores only pointers + minimal captured excerpts for audit',
  single_handoff_channel:
    'Handoff to initiatives is ONE channel: prefer link-to-existing initiative; creation goes through canonical P11 flow',
  no_parallel_initiative_truth:
    'Forbidden: parallel "Initiatives created by insights" screen as alternative to P11',
  dedupe_pointers:
    'Evidence pointers must have dedupe key (source_ref + source_fingerprint); same source cannot multiply into multiple identical links',
} as const;

// ────────────────────────────────────────────────────────────────
// §2.3.6 — Error / degraded posture (10 scenarios)
// ────────────────────────────────────────────────────────────────

export const P10_DEGRADED_SCENARIOS: ReadonlyArray<{
  id: number;
  scenario: string;
  degradedReason: string;
  userVisibleState: string;
  nextAction: string;
}> = [
  {
    id: 1,
    scenario: 'Missing evidence (finding without pointers)',
    degradedReason: 'missing_evidence',
    userVisibleState: 'Publish/handoff blocked; UI indicates missing evidence',
    nextAction: 'Attach evidence pointers before publish',
  },
  {
    id: 2,
    scenario: 'Broken pointer (source deleted / no permissions)',
    degradedReason: 'broken_pointer',
    userVisibleState: 'Pointer stays, marked "source unavailable"; UI does not hide gap',
    nextAction: 'Operator decides: re-capture, annotate, or accept with known gap',
  },
  {
    id: 3,
    scenario: 'Source drift (fingerprint changed)',
    degradedReason: 'source_drift',
    userVisibleState: '"Source changed since capture" warning shown',
    nextAction: 'Operator decides on re-capture',
  },
  {
    id: 4,
    scenario: 'Duplicate input observed (at-least-once)',
    degradedReason: 'duplicate_input',
    userVisibleState: 'Dedupe pointers; audit records duplicate',
    nextAction: 'Show 1 pointer + "duplicate observed" metadata',
  },
  {
    id: 5,
    scenario: 'Contradictory evidence',
    degradedReason: 'contradictory_evidence',
    userVisibleState: 'Confidence set to "contradicted"; contradiction callout enforced',
    nextAction:
      'Block automatic handoff; require operator decision: split/resolve/keep-with-warning',
  },
  {
    id: 6,
    scenario: 'Handoff denied (no permission to Inicjatywy)',
    degradedReason: 'handoff_denied',
    userVisibleState: '"Permission denied" shown; export/link-only offered',
    nextAction: 'Offer export or link-only path; suggest permission escalation',
  },
  {
    id: 7,
    scenario: 'Initiative creation/link failure (downstream error)',
    degradedReason: 'initiative_link_failure',
    userVisibleState: 'Finding preserves payload draft + retry policy; no ghost initiative',
    nextAction: 'Retry handoff; preserve draft payload',
  },
  {
    id: 8,
    scenario: 'Partial artifact state (draft vs published mismatch)',
    degradedReason: 'partial_artifact',
    userVisibleState: 'UI does not allow pretending "published"; explicit status badge',
    nextAction: 'Complete review/publish flow before downstream consumption',
  },
  {
    id: 9,
    scenario: 'Redaction event (transcript excerpt redacted)',
    degradedReason: 'redaction_event',
    userVisibleState: 'Pointer remains with tombstone; UI shows "redacted"',
    nextAction: 'Pointer preserved for audit; content marked unavailable',
  },
  {
    id: 10,
    scenario: 'Offline / transient network during publish/handoff',
    degradedReason: 'network_transient',
    userVisibleState: 'UI has retry/backoff; no duplicate initiatives created',
    nextAction: 'Retry with idempotency; surface failure state to operator',
  },
] as const;

// ────────────────────────────────────────────────────────────────
// §2.3.7 — Acceptance checklist (12 items)
// ────────────────────────────────────────────────────────────────

export const P10_ACCEPTANCE_CHECKLIST = [
  {
    id: 1,
    requirement: 'Insight artifact has frozen structure: finding/evidence/limits/next_action',
    section: '§2.3.1',
  },
  {
    id: 2,
    requirement: 'Each finding requires explicit confidence_level and explicit limits',
    section: '§2.3.1',
  },
  {
    id: 3,
    requirement: 'Confidence semantics has fixed levels + meaning + UI rules + no-overclaim',
    section: '§2.3.2',
  },
  {
    id: 4,
    requirement:
      'Evidence pointer types frozen (7 types: session/Q&A/transcript/survey/attachment/export/operator_note)',
    section: '§2.3.3',
  },
  {
    id: 5,
    requirement:
      'Source loss blocked: evidence set append-only by default; removal → tombstone + reason',
    section: '§2.3.3',
  },
  {
    id: 6,
    requirement:
      'Pointer stores source_ref + captured_at + fingerprint; drift/broken source explicit in UI',
    section: '§2.3.3',
  },
  {
    id: 7,
    requirement:
      'System resistant to upstream duplicates (at-least-once): dedupe pointers, no link multiplication',
    section: '§2.3.3',
  },
  {
    id: 8,
    requirement:
      'Frozen handoff payload to Inicjatywy is explicitly defined (fields + required/optional) with back-links',
    section: '§2.3.4',
  },
  {
    id: 9,
    requirement:
      'Anti-duplicate gate explicit: no collection engine; no parallel initiative truth; prefer link-to-existing',
    section: '§2.3.5',
  },
  {
    id: 10,
    requirement: 'Error/degraded posture has min 8 scenarios with audit + operator next action',
    section: '§2.3.6',
  },
  {
    id: 11,
    requirement: 'EXECUTION_INDEX updated to reflect P10 status',
    section: '§2.3.7',
  },
  {
    id: 12,
    requirement: 'Evidence ledger row P10 filled with commit ref after closeout',
    section: '§2.3.7',
  },
] as const;

/**
 * Validate that a confidence level is within the canonical set.
 */
export function isValidP10ConfidenceLevel(level: string): level is P10ConfidenceLevel {
  return (P10_CONFIDENCE_LEVELS as readonly string[]).includes(level);
}

/**
 * Validate that an evidence pointer type is within the canonical set.
 */
export function isValidP10EvidencePointerType(type: string): type is P10EvidencePointerType {
  return (P10_EVIDENCE_POINTER_TYPES as readonly string[]).includes(type);
}

export function isValidP10ReadbackStatus(status: string): status is P10ReadbackStatus {
  return (P10_READBACK_STATUSES as readonly string[]).includes(status);
}

/**
 * Check if a finding can be published based on confidence rules.
 */
export function canPublishFinding(
  finding: {
    confidenceLevel: string;
    evidencePointers: Array<{ isTombstone: boolean }>;
    limits?: string;
    nextAction?: string;
  },
  mode: 'publish' | 'handoff' = 'publish'
): { allowed: boolean; reason?: string } {
  if (!isValidP10ConfidenceLevel(finding.confidenceLevel)) {
    return { allowed: false, reason: 'Invalid confidence level' };
  }

  if (finding.confidenceLevel === 'insufficient') {
    return { allowed: false, reason: 'Insufficient confidence blocks publish' };
  }

  if (mode === 'handoff' && finding.confidenceLevel === 'contradicted') {
    return { allowed: false, reason: 'Contradicted evidence blocks automatic handoff' };
  }

  if (mode === 'handoff' && finding.confidenceLevel === 'low') {
    const nextAction = String(finding.nextAction || '').toLowerCase();
    if (!/(investigat|validat|review|verify|confirm|zbadaj|zweryfik|potwierd)/i.test(nextAction)) {
      return {
        allowed: false,
        reason: 'Low-confidence findings can only hand off investigation or validation work',
      };
    }
  }

  const activePointers = finding.evidencePointers.filter((p) => !p.isTombstone);
  if (activePointers.length === 0) {
    return { allowed: false, reason: 'No active evidence pointers' };
  }

  if (!finding.limits || finding.limits.trim().length === 0) {
    return { allowed: false, reason: 'Limits are required for every finding' };
  }

  return { allowed: true };
}

/**
 * Build a minimal handoff payload skeleton for P11 (Inicjatywy).
 */
export function buildP10HandoffToInitiativesSkeleton(params: {
  insightArtifactId: string;
  findingId: string;
  findingStatement: string;
  confidenceLevel: P10ExtendedConfidenceLevel;
  limits: string;
  nextAction: string;
  evidencePointers: P10EvidencePointer[];
}): P10HandoffToInitiativesPayload {
  return {
    source_insight_artifact_id: params.insightArtifactId,
    source_insight_artifact_deep_link: `/insights/${params.insightArtifactId}`,
    source_finding_id: params.findingId,
    source_finding_deep_link: `/insights/${params.insightArtifactId}/findings/${params.findingId}`,
    finding_statement: params.findingStatement,
    confidence_level: params.confidenceLevel,
    limits: params.limits,
    evidence_pointers: params.evidencePointers,
    next_action: params.nextAction,
  };
}
