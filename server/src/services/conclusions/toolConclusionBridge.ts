/**
 * Tool → Conclusion bridge (CONCLUSION_LAYER e2e wiring, OXFORD task #41).
 *
 * All 19 discovery tools generate a W2 finishing block (verdict / rationale /
 * tradeoffs / moves / expectedEffect — see src/config/{tool}/conclusionPrompts.ts)
 * that lands in the tool session's `answers.summary`. Until this bridge existed
 * the generated conclusion never reached the Conclusions layer — only the coarse
 * pull-based `ConclusionService.syncToolOutputs()` scraped session snapshots.
 *
 * This module is the ONE generic helper wired into the shared tool flow
 * (`ToolController.updateToolSession` / `approveTool`) instead of 19 per-tool
 * copies:
 *   - `extractToolConclusion` — PURE: reads the tool-agnostic W2 shape out of
 *     `answers`, derives evidenceRefs from ACCEPTED session elements only and a
 *     confidence level from the evidence gate. Returns null when the session has
 *     no generated (non-rejected) conclusion yet.
 *   - `persistToolSessionConclusion` — persists via
 *     `conclusionService.createConclusion` (sourceModule='tool',
 *     status='candidate', idempotent per session).
 *   - `safePersistToolSessionConclusion` — fail-safe wrapper: an error while
 *     persisting the Conclusion MUST NOT break tool output generation/saving.
 */

import {
  type ValidatableConclusion,
  validateNoFiller,
  validateNumbersFromEngine,
} from '../conclusionValidators.js';
import type {
  ArtifactRef,
  ConclusionStatus,
  CreateConclusionParams,
  EvidenceRef,
} from './ConclusionService.js';
import { conclusionService } from './ConclusionService.js';

/** Collections that carry evidence-bearing, acceptable elements across the 19 tool data shapes. */
const EVIDENCE_COLLECTION_KEYS = [
  'items',
  'signals',
  'tensions',
  'correlations',
  'recommendedMoves',
  'moves',
  'priorities',
  'pillars',
  'themes',
  'capabilities',
  'risks',
  'assumptions',
  'scenarios',
  'comparisons',
  'options',
  'insights',
] as const;

const MAX_EVIDENCE_REFS = 40;
const MAX_STATEMENT_LENGTH = 2000;
const MAX_TITLE_LENGTH = 180;
const MAX_EXCERPT_LENGTH = 200;

interface AcceptableElement {
  id?: unknown;
  proposalStatus?: unknown;
  status?: unknown;
  state?: unknown;
  text?: unknown;
  title?: unknown;
  content?: unknown;
  statement?: unknown;
  description?: unknown;
  name?: unknown;
}

export interface ToolConclusionCandidate {
  title: string;
  statement: string;
  sourceRefs: ArtifactRef[];
  confidenceLevel: 'high' | 'medium' | 'low' | 'insufficient';
  limits: string;
  evidenceRefs: EvidenceRef[];
  recommendedNextAction: string | null;
  status: ConclusionStatus;
  contextSummary: string;
}

export interface ExtractToolConclusionParams {
  sessionId: string;
  toolType?: string | null;
  name?: string | null;
  answers: unknown;
  /** Session-level confidence (1-5 scale) from the tool review flow. */
  confidenceAvg?: number | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

/**
 * An element counts as ACCEPTED evidence when it passed the tool's proposal
 * gate. Elements without any acceptance marker (deterministic engine outputs,
 * user-authored entries) are treated as accepted — they were never proposals.
 */
function isAcceptedElement(el: AcceptableElement): boolean {
  const marker = el.proposalStatus ?? el.state ?? el.status;
  if (marker === undefined || marker === null) return true;
  const value = String(marker).toLowerCase();
  if (['ai-proposed', 'rejected', 'rethinking', 'proposed', 'needs-evidence'].includes(value)) {
    return false;
  }
  return true;
}

function elementExcerpt(el: AcceptableElement): string | null {
  const text =
    asNonEmptyString(el.text) ||
    asNonEmptyString(el.title) ||
    asNonEmptyString(el.content) ||
    asNonEmptyString(el.statement) ||
    asNonEmptyString(el.description) ||
    asNonEmptyString(el.name);
  return text ? text.slice(0, MAX_EXCERPT_LENGTH) : null;
}

/**
 * Derive evidence refs from ACCEPTED elements across the tool-agnostic
 * collection keys, including one nesting level for operational tools
 * (`answers.sections = { sectionId: OperationalItem[] }`).
 */
export function collectAcceptedEvidenceRefs(answers: unknown): EvidenceRef[] {
  const data = asRecord(answers);
  if (!data) return [];

  const refs: EvidenceRef[] = [];

  const harvest = (collection: unknown, refType: string) => {
    if (!Array.isArray(collection)) return;
    for (let i = 0; i < collection.length; i += 1) {
      if (refs.length >= MAX_EVIDENCE_REFS) return;
      const el = asRecord(collection[i]) as AcceptableElement | null;
      if (!el || !isAcceptedElement(el)) continue;
      refs.push({
        type: refType,
        ref: asNonEmptyString(el.id) || `${refType}:${i}`,
        excerpt: elementExcerpt(el),
      });
    }
  };

  for (const key of EVIDENCE_COLLECTION_KEYS) {
    harvest(data[key], `tool_${key}`);
  }

  // Ansoff-style quadrant maps: options grouped under named keys.
  const quadrants = asRecord(data.quadrants);
  if (quadrants) {
    for (const [quadrant, list] of Object.entries(quadrants)) {
      harvest(list, `tool_quadrant_${quadrant}`);
    }
  }

  // Operational tools: sections = { sectionId: items[] }.
  const sections = asRecord(data.sections);
  if (sections) {
    for (const [sectionId, list] of Object.entries(sections)) {
      harvest(list, `tool_section_${sectionId}`);
    }
  }

  return refs;
}

/**
 * Evidence gate → confidence level. No accepted evidence = 'insufficient'
 * (the conclusion exists but must not be treated as grounded).
 */
export function deriveToolConfidence(
  evidenceCount: number,
  confidenceAvg: number | null | undefined
): ToolConclusionCandidate['confidenceLevel'] {
  if (evidenceCount === 0) return 'insufficient';
  const avg = Number(confidenceAvg || 0);
  if (avg >= 4 && evidenceCount >= 3) return 'high';
  if (avg >= 3 || evidenceCount >= 3) return 'medium';
  return 'low';
}

/**
 * PURE extraction of the W2 conclusion out of a tool session's answers.
 * Returns null when the session carries no generated conclusion (no summary,
 * empty statement) or the user rejected / is rethinking the proposal —
 * a rejected conclusion must never be persisted as a candidate.
 */
export function extractToolConclusion(
  params: ExtractToolConclusionParams
): ToolConclusionCandidate | null {
  const data = asRecord(params.answers);
  if (!data) return null;

  const summary = asRecord(data.summary);
  if (!summary) return null;

  const proposalStatus = asNonEmptyString(summary.proposalStatus)?.toLowerCase();
  if (proposalStatus === 'rejected' || proposalStatus === 'rethinking') return null;

  const verdict = asNonEmptyString(summary.verdict);
  const executiveSummary =
    asNonEmptyString(summary.executiveSummary) || asNonEmptyString(summary.summary);
  const statementBase = verdict || executiveSummary;
  if (!statementBase) return null;

  // Verdict is answer-first (1-2 sentences); append the executive summary for context.
  const statement =
    verdict && executiveSummary && verdict !== executiveSummary
      ? `${verdict}\n\n${executiveSummary}`.slice(0, MAX_STATEMENT_LENGTH)
      : statementBase.slice(0, MAX_STATEMENT_LENGTH);

  const evidenceRefs = collectAcceptedEvidenceRefs(params.answers);
  const confidenceLevel = deriveToolConfidence(evidenceRefs.length, params.confidenceAvg);

  // Limits: surface the W2 trade-off (what was chosen at the cost of what) when present.
  const tradeoffs = Array.isArray(summary.tradeoffs) ? summary.tradeoffs : [];
  const firstTradeoff = asRecord(tradeoffs[0]);
  const tradeoffText = firstTradeoff
    ? [
        asNonEmptyString(firstTradeoff.chosen) &&
          `chosen: ${asNonEmptyString(firstTradeoff.chosen)}`,
        asNonEmptyString(firstTradeoff.rejected) &&
          `rejected: ${asNonEmptyString(firstTradeoff.rejected)}`,
        asNonEmptyString(firstTradeoff.why) && `why: ${asNonEmptyString(firstTradeoff.why)}`,
      ]
        .filter(Boolean)
        .join('; ')
    : null;
  const limits = tradeoffText
    ? `Tool-derived conclusion (${params.toolType || 'tool'}). Trade-off — ${tradeoffText}.`
    : `Tool-derived conclusion (${params.toolType || 'tool'}); grounded in ${evidenceRefs.length} accepted session element(s). Validate assumptions before converting to execution.`;

  // Next action: first recommended move's first step, else first applied conclusion.
  let recommendedNextAction: string | null = null;
  const moves = Array.isArray(data.recommendedMoves)
    ? data.recommendedMoves
    : Array.isArray(data.moves)
      ? data.moves
      : [];
  const firstMove = asRecord(moves[0]);
  if (firstMove) {
    recommendedNextAction =
      asNonEmptyString(firstMove.firstStep) || asNonEmptyString(firstMove.title);
  }
  if (!recommendedNextAction) {
    const applied = Array.isArray(summary.appliedConclusions) ? summary.appliedConclusions : [];
    recommendedNextAction = asNonEmptyString(applied[0]);
  }

  const title = (asNonEmptyString(params.name) || `${params.toolType || 'Tool'} conclusion`).slice(
    0,
    MAX_TITLE_LENGTH
  );

  return {
    title,
    statement,
    sourceRefs: [
      {
        type: 'tool_session',
        id: params.sessionId,
        title: params.name || null,
        url: `/my-work?tab=ideas&sessionId=${encodeURIComponent(params.sessionId)}`,
      },
    ],
    confidenceLevel,
    limits,
    evidenceRefs,
    recommendedNextAction,
    status: 'candidate',
    contextSummary: executiveSummary || verdict || '',
  };
}

// ---------------------------------------------------------------------------
// SERVER-GAP fix (OXFORD): re-validate a tool candidate BEFORE persisting it.
//
// The extraction above is intentionally PURE — it only reshapes the W2 summary.
// Without a gate, slop (filler prose) or fabricated numbers a W2 tool conclusion
// carries would be server-persisted verbatim, even though the finance/FE report
// path runs the 12-validator gate (`validateConclusion.allHardPass`). But that
// full 12-gate is shaped for K1→K4 REPORT conclusions (it hard-requires a K4
// horizon, an owned 1-3 K3 action set, a non-empty K4 text): a legitimate tool
// verdict has NONE of that shape, so running the full gate would reject EVERY
// tool conclusion (false positive). Priority per spec: block SLOP, not block the
// good. So we apply a LIGHTER, shape-appropriate subset of the SAME real
// validators — the two that actually detect slop in free-form verdict prose:
//   • no_filler            — listed filler phrases ("zoptymalizować procesy", …)
//   • numbers_from_engine  — any number in the verdict must be within ±25% of a
//                            number the engine already produced (grounding); the
//                            "engine facts" pool for a tool = every value in the
//                            session `answers` EXCEPT the summary itself (which
//                            IS the conclusion prose under test).
// Plus a minimal completeness check (statement present & non-trivial ≈ k_complete).
// ---------------------------------------------------------------------------

export interface ToolConclusionQualityVerdict {
  ok: boolean;
  /** Validator names that fired (subset of no_filler | numbers_from_engine | k_complete). */
  failures: string[];
}

/** pl when the prose carries Polish diacritics; en otherwise (product is PL-first). */
function detectConclusionLanguage(text: string): 'pl' | 'en' {
  return /[ąćęłńóśźż]/i.test(text) ? 'pl' : 'en';
}

function firstSentence(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^[^.!?\n]{1,220}[.!?]?/);
  return (match ? match[0] : trimmed).slice(0, 220);
}

/**
 * The "engine facts" pool for a tool conclusion is every value the session
 * produced OUTSIDE `answers.summary` — the summary is the verdict/exec prose we
 * are validating, so grounding numbers against it would be circular. Everything
 * else (accepted items, signals, computed sections, …) is legitimate provenance.
 */
function toolFactsPool(answers: unknown): Record<string, unknown> {
  const data = asRecord(answers);
  if (!data) return {};
  const { summary: _summary, ...rest } = data;
  return rest;
}

/** Map a tool candidate onto the variant-agnostic validator shape (verdict-first). */
function candidateToValidatable(
  candidate: ToolConclusionCandidate,
  answers: unknown
): ValidatableConclusion {
  const proseForLang = `${candidate.statement} ${candidate.contextSummary}`;
  return {
    headline: firstSentence(candidate.statement),
    k1Text: candidate.statement,
    k1FactRefs: [],
    k2Text: candidate.contextSummary || '',
    k2FactRefs: [],
    k3Actions: candidate.recommendedNextAction
      ? [{ action: candidate.recommendedNextAction, whyFirst: '-', ownerRole: '-' }]
      : [],
    k4Text: '',
    k4Horizon: '',
    confidence: candidate.confidenceLevel,
    language: detectConclusionLanguage(proseForLang),
    facts: toolFactsPool(answers),
  };
}

/**
 * LIGHTER quality gate for a tool conclusion candidate — reuses the REAL
 * anti-slop validators (no_filler + numbers_from_engine) plus a minimal
 * completeness check. Returns `ok:false` with the fired validator names when the
 * candidate must NOT be persisted.
 */
export function validateToolConclusionQuality(
  candidate: ToolConclusionCandidate,
  answers: unknown
): ToolConclusionQualityVerdict {
  const vc = candidateToValidatable(candidate, answers);
  const failures: string[] = [];
  if (validateNoFiller(vc) === 'fail') failures.push('no_filler');
  if (validateNumbersFromEngine(vc) === 'fail') failures.push('numbers_from_engine');
  if (candidate.statement.trim().length < 12) failures.push('k_complete');
  return { ok: failures.length === 0, failures };
}

export interface PersistToolConclusionParams extends ExtractToolConclusionParams {
  organizationId: string;
  projectId?: string | null;
  actorUserId: string;
}

interface ConclusionWriter {
  createConclusion(params: CreateConclusionParams): Promise<void>;
}

/**
 * Persist the session's W2 conclusion into the Conclusions layer.
 * Returns true when a conclusion was extracted, PASSED the quality gate, and
 * was written. A candidate that trips the lighter anti-slop gate
 * (`validateToolConclusionQuality`) is NOT persisted (returns false + logs the
 * fired validators) — closing the SERVER-GAP where un-validated slop reached
 * the DB.
 */
export async function persistToolSessionConclusion(
  params: PersistToolConclusionParams,
  writer: ConclusionWriter = conclusionService,
  logger?: { warn: (msg: string, meta?: unknown) => void }
): Promise<boolean> {
  const candidate = extractToolConclusion(params);
  if (!candidate) return false;

  const quality = validateToolConclusionQuality(candidate, params.answers);
  if (!quality.ok) {
    logger?.warn(
      '[ToolConclusionBridge] Tool conclusion rejected by quality gate — not persisted',
      {
        sessionId: params.sessionId,
        toolType: params.toolType ?? null,
        failures: quality.failures,
      }
    );
    return false;
  }

  await writer.createConclusion({
    organizationId: params.organizationId,
    projectId: params.projectId ?? null,
    title: candidate.title,
    statement: candidate.statement,
    sourceModule: 'tool',
    sourceRefs: candidate.sourceRefs,
    confidenceLevel: candidate.confidenceLevel,
    limits: candidate.limits,
    evidenceRefs: candidate.evidenceRefs,
    recommendedNextAction: candidate.recommendedNextAction,
    status: candidate.status,
    createdBy: params.actorUserId,
    contextSummary: candidate.contextSummary,
  });
  return true;
}

/**
 * Fail-safe wrapper for the shared tool flow: a Conclusion write failure is
 * logged by the caller-provided logger and swallowed — it MUST NOT break tool
 * output generation or session persistence.
 */
export async function safePersistToolSessionConclusion(
  params: PersistToolConclusionParams,
  options?: {
    writer?: ConclusionWriter;
    logger?: { warn: (msg: string, meta?: unknown) => void };
  }
): Promise<boolean> {
  try {
    return await persistToolSessionConclusion(
      params,
      options?.writer ?? conclusionService,
      options?.logger
    );
  } catch (error) {
    try {
      options?.logger?.warn('[ToolConclusionBridge] Failed to persist tool conclusion', {
        sessionId: params.sessionId,
        error: error instanceof Error ? error.message : String(error),
      });
    } catch {
      /* even logging must not throw */
    }
    return false;
  }
}
