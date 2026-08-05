/**
 * Interview Insight Service
 *
 * Generates AI-powered insights from completed interview sessions.
 * Supports multiple analysis types: summary, trends, problems, recommendations.
 */

import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import { getTableColumns } from '../utils/dbSchema.js';
import logger from '../utils/Logger.js';
import { flagOn } from '../utils/pgFlags.js';
import {
  buildInsightRepairHints,
  buildInsightTypeGuidanceBlock,
} from './ai/insightTypePromptRegistry.js';
import { llmService } from './ai/llmService.js';
import {
  assertCardMeetsFormula,
  buildRepairBriefFromVerdict,
  type FormulaVerdict,
  validateInsightCard,
} from './cardContentFormulaValidator.js';
import {
  deriveConfidence,
  type EvidenceContract,
  type EvidenceContractSource,
} from './evidence/evidenceContract.js';
import { safePersistEvidenceContract } from './evidence/evidenceContractBridge.js';
import { canonicalizeContextDocumentStatus } from './organizationContext/ContextDocumentService.js';
import organizationContextService from './organizationContext/OrganizationContextService.js';
import { P10_CONFIDENCE_LEVELS, P10_NO_OVERCLAIM_RULES } from './v8/interviewInsightCanon.js';

// ==========================================
// TYPES
// ==========================================

export type InsightPromptType =
  | 'summary'
  | 'general_analysis'
  | 'trends'
  | 'problems'
  | 'recommendations'
  | 'comparison'
  | 'gaps'
  | 'risk_assessment'
  | 'opportunity_scan'
  | 'maturity'
  | 'stakeholder_map'
  | 'between_the_lines';
export type InsightStatus =
  | 'generating'
  | 'completed'
  | 'failed'
  | 'draft'
  | 'in_review'
  | 'published';

/**
 * SEC — statuses that the plain PATCH /insights/:id endpoint is allowed to set
 * directly from the request body. The GATED review states (`in_review`,
 * `published`) MUST NOT be settable here: they are owned by the lifecycle gate
 * (POST /insights/:insightId/lifecycle), which enforces the findings-required,
 * canon-publishable, client-readback, and INTERVIEW_INSIGHTS_PUBLISH checks and
 * server-derives reviewed_by / published_at + fires the publish signal bridge.
 * Letting a body field forge `published`/`in_review` would bypass that whole
 * approval gate (mass-assignment / state-machine bypass). `generating` is a
 * system-only transient state and is excluded too. The remaining values are
 * revert-/edit-style and safe to set ad hoc.
 */
export const INSIGHT_PATCH_SETTABLE_STATUSES: ReadonlySet<InsightStatus> = new Set<InsightStatus>([
  'draft',
  'completed',
  'failed',
]);

// ── Ręczna redakcja sekcji Insightu (n-Type §6.2, właściciel 2026-07-23) ─────
//
// Twarde limity — pole jest wolnym tekstem od użytkownika i ląduje w JEDNEJ
// kolumnie TEXT wspólnej dla wszystkich sekcji, więc bez sufitu jeden wiersz
// mógłby urosnąć bez ograniczeń (i zablokować odczyt całego wniosku).
/** Maks. długość ręcznej treści JEDNEJ sekcji (znaki). */
export const INSIGHT_SECTION_OVERRIDE_MAX_CHARS = 20000;
/** Maks. liczba sekcji z ręczną treścią na jednym wniosku (INSIGHT_SECTIONS ma 32). */
export const INSIGHT_SECTION_OVERRIDE_MAX_SECTIONS = 64;
/** Dozwolony kształt render-id sekcji (`executive-summary`, `issues-risks`, …). */
const INSIGHT_SECTION_ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

export interface InsightSectionOverridesMergeError {
  error: string;
  code:
    | 'INSIGHT_SECTION_OVERRIDES_INVALID'
    | 'INSIGHT_SECTION_ID_INVALID'
    | 'INSIGHT_SECTION_OVERRIDE_TOO_LONG'
    | 'INSIGHT_SECTION_OVERRIDES_TOO_MANY';
}

/**
 * Scala CZĘŚCIOWĄ mapę nadpisań z żądania w mapę zapisaną na wniosku.
 *
 * Semantyka wybrana świadomie (PATCH = łata, nie podmiana całości):
 *  · `{ "themes": "nowa treść" }`               → ustawia/aktualizuje sekcję `themes`,
 *  · `{ "themes": { content: "…" } }`           → to samo (forma obiektowa),
 *  · `{ "themes": null }` lub pusty/biały tekst → USUWA nadpisanie (sekcja wraca
 *                                                 do czystej treści z AI),
 *  · sekcje nieobecne w żądaniu                 → NIETKNIĘTE.
 *
 * Dzięki temu dwie osoby redagujące RÓŻNE sekcje tego samego wniosku nie kasują
 * sobie nawzajem pracy (przy podmianie całej mapy — jak w `sectionCompletions` —
 * kasowałyby). `updatedAt`/`updatedBy` wyprowadza SERWER; klient ich nie podaje.
 */
export function mergeInsightSectionOverrides(
  existing: Record<string, InsightSectionOverride> | null | undefined,
  incoming: unknown,
  userId?: string | null
):
  | { ok: true; value: Record<string, InsightSectionOverride> }
  | ({ ok: false } & InsightSectionOverridesMergeError) {
  let payload: unknown = incoming;
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload);
    } catch {
      return {
        ok: false,
        error: 'sectionOverrides must be a JSON object',
        code: 'INSIGHT_SECTION_OVERRIDES_INVALID',
      };
    }
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {
      ok: false,
      error: 'sectionOverrides must be an object keyed by section id',
      code: 'INSIGHT_SECTION_OVERRIDES_INVALID',
    };
  }

  const next: Record<string, InsightSectionOverride> = { ...(existing || {}) };
  const now = new Date().toISOString();

  for (const [rawId, rawValue] of Object.entries(payload as Record<string, unknown>)) {
    const sectionId = String(rawId);
    if (!INSIGHT_SECTION_ID_RE.test(sectionId)) {
      return {
        ok: false,
        error: `Invalid section id: ${sectionId}`,
        code: 'INSIGHT_SECTION_ID_INVALID',
      };
    }

    let content: string | null;
    if (rawValue === null || rawValue === undefined) {
      content = null;
    } else if (typeof rawValue === 'string') {
      content = rawValue;
    } else if (typeof rawValue === 'object' && typeof (rawValue as any).content === 'string') {
      content = String((rawValue as any).content);
    } else {
      return {
        ok: false,
        error: `Invalid value for section ${sectionId} — expected string, { content } or null`,
        code: 'INSIGHT_SECTION_OVERRIDES_INVALID',
      };
    }

    // Pusty / sam biały znak = świadome cofnięcie redakcji, nie „zapisz pustkę".
    if (content === null || content.trim().length === 0) {
      delete next[sectionId];
      continue;
    }
    if (content.length > INSIGHT_SECTION_OVERRIDE_MAX_CHARS) {
      return {
        ok: false,
        error: `Section ${sectionId} exceeds ${INSIGHT_SECTION_OVERRIDE_MAX_CHARS} characters`,
        code: 'INSIGHT_SECTION_OVERRIDE_TOO_LONG',
      };
    }
    next[sectionId] = { content, updatedAt: now, updatedBy: userId || null };
  }

  if (Object.keys(next).length > INSIGHT_SECTION_OVERRIDE_MAX_SECTIONS) {
    return {
      ok: false,
      error: `Too many edited sections (max ${INSIGHT_SECTION_OVERRIDE_MAX_SECTIONS})`,
      code: 'INSIGHT_SECTION_OVERRIDES_TOO_MANY',
    };
  }

  return { ok: true, value: next };
}

/** Statuses reachable only via the lifecycle gate, never via plain PATCH. */
export const INSIGHT_GATED_STATUSES: ReadonlySet<string> = new Set<string>([
  'in_review',
  'published',
  // defensive: legacy/alias gate states that must also route through the gate
  'approved',
]);

export const INTERVIEW_INSIGHT_GENERATION_SCHEMA_VERSION =
  'interview_insight_generation_v6_report_pack_2026_05_03';

export const INTERVIEW_INSIGHT_GENERATION_SECTIONS = [
  'executive_summary',
  'themes',
  'issues',
  'opportunities',
  'signals',
  'evidence_map',
  'missing_data',
  'material_quality',
] as const;

export function buildInsightGenerationContract(): {
  contract: string;
  schemaVersion: string;
  requiredSections: string[];
} {
  return {
    contract: 'interview_insight_scope_builder_v1',
    schemaVersion: INTERVIEW_INSIGHT_GENERATION_SCHEMA_VERSION,
    requiredSections: [...INTERVIEW_INSIGHT_GENERATION_SECTIONS],
  };
}

export type InsightAnalysisMode =
  | 'general_consulting_synthesis'
  | 'focused_topic_synthesis'
  | 'contradiction_scan'
  | 'initiative_opportunity_scan'
  | 'material_quality_scan'
  | 'hypothesis_validation'
  | 'between_the_lines';

// InsightContextMode includes both Interview Insight legacy values and the 4 Source Of Truth
// workflow modes from docs/product/ORGANIZATION_CONTEXT_ENGINE_SOURCE_OF_TRUTH.md §4.3.
// Legacy mapping: selected_interview_material_only ↔ selected_material_only,
// selected_material_plus_approved_org_knowledge ↔ selected_material_plus_approved_org_context.
export type InsightContextMode =
  | 'selected_interview_material_only'
  | 'selected_material_plus_approved_org_knowledge'
  | 'selected_material_only'
  | 'selected_material_plus_selected_context'
  | 'selected_material_plus_approved_org_context'
  | 'org_context_research_mode';

export const SOURCE_OF_TRUTH_CONTEXT_MODES = [
  'selected_material_only',
  'selected_material_plus_selected_context',
  'selected_material_plus_approved_org_context',
  'org_context_research_mode',
] as const;

export interface InsightContextDocumentSelection {
  requestedIds: string[];
  selectedIds: string[];
}

export interface InsightAnalysisScope {
  source_session_ids: string[];
  source_scope_status: 'approved_only';
  respondent_filters: string[];
  role_filters: string[];
  department_filters: string[];
  template_filters: string[];
  date_range?: { from?: string; to?: string };
  topic_focus: string[];
  analysis_mode: InsightAnalysisMode;
  context_mode: InsightContextMode;
  consultant_note?: string | null;
  leading_question?: string | null;
}

export interface InsightMaterialQuality {
  overall_material_score: number;
  answer_quality_posture: 'strong' | 'usable' | 'thin' | 'poor';
  coverage_posture:
    | 'single_perspective'
    | 'partial_coverage'
    | 'good_coverage'
    | 'strong_cross_function_coverage';
  approved_session_count: number;
  respondent_count: number;
  role_coverage: string[];
  department_coverage: string[];
  thin_answer_count: number;
  missing_voices: string[];
  evidence_gap_count: number;
  contradiction_count: number;
  confidence_downgrade_required: boolean;
  recommendation_posture: 'decision_ready' | 'review_required' | 'hypothesis_only';
  limitations: string[];
  recommended_followups: string[];
}

export interface InsightSourceMaterialSummary {
  requestedSessionCount: number;
  includedSessionCount: number;
  excludedSessionCount: number;
  includedAnswerCount: number;
  includedSessionIds: string[];
  appliedFilters: {
    respondents: string[];
    roles: string[];
    departments: string[];
    templates: string[];
    dateRange?: { from?: string; to?: string };
  };
}

export interface InsightGenerationPreferences {
  outputTypes: string[];
  analysisModes: InsightAnalysisMode[];
}

export interface ApprovedOrgKnowledgePack {
  requested: boolean;
  available: boolean;
  included: boolean;
  degraded: boolean;
  degradedReasons: string[];
  policy: 'accepted_or_approved_context_claims_only';
  sourceCount: number;
  builtAt: string;
  entries: Array<{
    claimPath: string;
    value: unknown;
    confidence: number;
    reviewStatus: string;
    sourceType: string;
    sourceLabel: string | null;
    createdAt: string;
  }>;
}

export interface CreateInsightInput {
  organizationId: string;
  title: string;
  sessionIds: string[];
  promptType: InsightPromptType;
  /**
   * Optional extra instructions appended to the AI prompt.
   * Stored inside `filters` for traceability.
   */
  customPrompt?: string;
  filters?: {
    templateId?: string;
    dateFrom?: string;
    dateTo?: string;
    respondentId?: string;
    respondentIds?: string[];
    roles?: string[];
    departments?: string[];
    topicFocus?: string[];
    outputTypes?: string[];
    analysisModes?: string[];
  };
  analysisScope?: Partial<InsightAnalysisScope>;
  analysisMode?: InsightAnalysisMode;
  contextMode?: InsightContextMode;
  topicFocus?: string[];
  consultantNote?: string;
  leadingQuestion?: string;
  selectedContextDocumentIds?: string[];
  createdBy: string;
}

export interface ContextDocumentPack {
  requestedIds: string[];
  selectedIds: string[];
  degraded: boolean;
  degradedReasons: string[];
  documents: Array<{
    id: string;
    filename: string;
    status: string;
    scope: string;
    projectId: string | null;
    ownerId: string | null;
    version: number;
    uploadedAt: string;
    usedChunks: Array<{
      chunkId: string | null;
      content: string;
      source: string;
      chunkIndex: number | null;
    }>;
  }>;
}

export function buildInsightContextLineagePayload(contextDocumentPack: ContextDocumentPack): {
  requestedDocumentIds: string[];
  selectedDocumentIds: string[];
  usedChunks: Array<{
    documentId: string;
    filename: string;
    version: number;
    chunkId: string | null;
    chunkIndex: number | null;
    source: string;
    excerpt: string;
  }>;
  degraded: boolean;
  degradedReasons: string[];
} {
  return {
    requestedDocumentIds: contextDocumentPack.requestedIds,
    selectedDocumentIds: contextDocumentPack.selectedIds,
    usedChunks: contextDocumentPack.documents.flatMap((doc) =>
      doc.usedChunks.map((chunk) => ({
        documentId: doc.id,
        filename: doc.filename,
        version: doc.version,
        chunkId: chunk.chunkId,
        chunkIndex: chunk.chunkIndex,
        source: chunk.source,
        excerpt: chunk.content.slice(0, 260),
      }))
    ),
    degraded: contextDocumentPack.degraded,
    degradedReasons: contextDocumentPack.degradedReasons,
  };
}

export interface InsightTheme {
  title: string;
  description: string;
  evidence_refs: string[];
  strength: 'strong' | 'moderate' | 'weak';
  crossSessionPattern?: boolean;
  perspective_labels?: string[];
  divergence_note?: string;
}

export interface InsightIssue {
  title: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  evidence_refs: string[];
  crossSessionPattern?: boolean;
  perspective_labels?: string[];
  divergence_note?: string;
}

export interface InsightOpportunity {
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  evidence_refs: string[];
  crossSessionPattern?: boolean;
  perspective_labels?: string[];
  divergence_note?: string;
}

export interface InsightSignal {
  title: string;
  description: string;
  type: 'tension' | 'gap' | 'contradiction' | 'emerging_pattern';
}

export interface InsightEvidenceMapEntry {
  answer_id: string;
  question_text: string;
  answer_snippet: string;
  linked_themes: string[];
  linked_issues: string[];
}

export interface ParsedInsightGenerationData {
  schema_version?: string;
  executive_summary: string;
  themes: InsightTheme[];
  issues: InsightIssue[];
  opportunities: InsightOpportunity[];
  signals: InsightSignal[];
  evidence_map: InsightEvidenceMapEntry[];
  missing_data: string[];
  material_quality?: Partial<InsightMaterialQuality>;
}

export interface InsightEvidenceValidationResult {
  availableAnswerCount: number;
  invalidRefs: string[];
  invalidEvidenceMapRefs: string[];
  degraded: boolean;
  warnings: string[];
}

/**
 * HP-17 follow-up (fala 11b) — buduje `EvidenceContract` dla V6 insight,
 * DETERMINISTYCZNIE, zero LLM, zero I/O. Analogiczne do
 * `buildInitiativeEvidenceContract` (assessmentInitiativeService.ts, HP-16),
 * ale dedykowane kształtowi V6 (`ParsedInsightGenerationData`/
 * `InsightMaterialQuality`) — który różni się od generycznego `InsightCandidate`
 * (insightMaterializationService.ts, ścieżka Tools/Assessment): evidence_map tu
 * niesie `answer_id` (nie `item_id`), a material_quality ma
 * `overall_material_score`/`coverage_posture` z innym zestawem etykiet
 * ('single_perspective' nie 'single_source').
 *
 * Sygnały pewności REALNE, nie zgadywane:
 *   - `sources` = unikalne `answer_id` faktycznie zacytowane (evidence_map +
 *     evidence_refs tematów/issues/opportunities),
 *   - `qualityScore` = `material_quality.overall_material_score` (realny wynik
 *     `buildInsightMaterialQuality`, to samo pole, którego lifecycle-gate używa),
 *   - `unresolvedGaps` = missing_data + missing_voices + evidence_gap_count.
 * `risks`/`toVerify` cytują te same realne braki — nie zgadywanie modelu.
 */
export function buildInterviewInsightEvidenceContract(
  v6Data: ParsedInsightGenerationData,
  materialQuality: InsightMaterialQuality
): EvidenceContract {
  const refIds = new Set<string>();
  const snippetByRef = new Map<string, string>();
  (v6Data.evidence_map || []).forEach((e) => {
    if (e?.answer_id) {
      const ref = String(e.answer_id);
      refIds.add(ref);
      if (e.answer_snippet) snippetByRef.set(ref, String(e.answer_snippet));
    }
  });
  const collectRefs = (arr: Array<{ evidence_refs?: string[] }> | undefined) =>
    (arr || []).forEach((x) => (x.evidence_refs || []).forEach((r) => r && refIds.add(String(r))));
  collectRefs(v6Data.themes);
  collectRefs(v6Data.issues);
  collectRefs(v6Data.opportunities);

  const sources: EvidenceContractSource[] = Array.from(refIds).map((ref) => ({
    type: 'interview',
    ref,
    snippet: snippetByRef.get(ref),
  }));

  const risks: string[] = [...(materialQuality.limitations || [])];
  if (materialQuality.coverage_posture === 'single_perspective') {
    risks.push('Pokrycie jednoosobowe — wnioski mogą nie generalizować na całą organizację.');
  }
  (materialQuality.missing_voices || []).forEach((v) => risks.push(`Brak głosu: ${v}`));

  const toVerify: string[] = [
    ...(v6Data.missing_data || []),
    ...(materialQuality.recommended_followups || []),
  ];

  const confidence = deriveConfidence({
    sourceCount: sources.length,
    qualityScore:
      typeof materialQuality.overall_material_score === 'number'
        ? materialQuality.overall_material_score
        : undefined,
    unresolvedGaps:
      (v6Data.missing_data?.length || 0) +
      (materialQuality.missing_voices?.length || 0) +
      (materialQuality.evidence_gap_count || 0),
  });

  return { sources, assumptions: [], risks, confidence, toVerify };
}

/**
 * Ręczna redakcja treści JEDNEJ sekcji Insightu (standard n-Type §6.2–6.4;
 * decyzja właściciela 2026-07-23). Do dziś treść Insightu była wyłącznie
 * generowana (`content`/`*_json`) i jedyną drogą zmiany była pełna regeneracja.
 * Nadpisanie jest ADDYTYWNE: nie kasuje treści AI, leży obok niej i jest
 * kluczowane render-id sekcji z `INSIGHT_SECTIONS` (ten sam słownik id,
 * którego używa `section_completions`).
 */
export interface InsightSectionOverride {
  content: string;
  updatedAt: string;
  updatedBy?: string | null;
}

export interface Insight {
  id: string;
  organizationId: string;
  title: string;
  promptType: InsightPromptType;
  sourceSessionIds: string[];
  filters?: Record<string, any>;
  content?: string;
  executiveSummary?: string;
  themes?: InsightTheme[];
  issues?: InsightIssue[];
  opportunities?: InsightOpportunity[];
  signals?: InsightSignal[];
  evidenceMap?: InsightEvidenceMapEntry[];
  missingData?: string[];
  analysisScope?: InsightAnalysisScope;
  materialQuality?: InsightMaterialQuality | null;
  contextMode?: InsightContextMode;
  analysisMode?: InsightAnalysisMode;
  topicFocus?: string[];
  generationContext?: Record<string, any>;
  status: InsightStatus;
  reviewStatus?: 'draft' | 'in_review' | 'published';
  publishedAt?: string;
  reviewedBy?: string;
  errorMessage?: string;
  sourceSessionCount: number;
  tokensUsed: number;
  generationTimeMs?: number;
  exportedToTools?: boolean;
  exportedToAssessment?: boolean;
  archivedAt?: string | null;
  sectionCompletions?: Record<string, boolean> | null;
  /** Ręczna redakcja per sekcja (n-Type §6.2). `null` = brak nadpisań. */
  sectionOverrides?: Record<string, InsightSectionOverride> | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// PROMPT TEMPLATES
// ==========================================

/**
 * BCG §0 doctrine + P10 finding contract — shared preamble injected into the
 * live structured-output prompt (and appended to each markdown template body).
 *
 * Source of truth for the doctrine: `_ARTEFAKTY_TRESC_KART_BCG_2026-07-06.md`
 * §0 (BCG hard rules) + §4 (Insight, rule P10). The P10 vocabulary itself is
 * pulled from the canon (`interviewInsightCanon.ts`) so this stays consistent
 * with `P10_CONFIDENCE_LEVELS` / `P10_NO_OVERCLAIM_RULES` rather than duplicating
 * a hand-written copy that could drift.
 *
 * This shapes the CONTENT of the analysis; it does NOT change the output FORMAT
 * (the JSON structured contract below is untouched).
 */
const BCG_P10_PROMPT_DOCTRINE = `BCG-GRADE DOCTRINE (hard rules — a deliverable that breaks these is a FAIL):
1. Answer-first / Pyramid Principle — lead every finding with the conclusion, then the evidence.
2. MECE — themes, issues and opportunities are mutually exclusive and collectively exhaustive; no overlap.
3. Quantify with an explicit assumption — every number carries a source OR an "estimate: [assumption]" tag; never bare numbers.
4. Grounded — use ONLY the interview material and provided context; never invent facts about the company.
5. Zero filler — no "in today's fast-moving world", no ornament; every sentence carries information.
6. Falsifiability — phrase theses testably ("If X, then Y, because Z"), not wishfully.
7. Honest about uncertainty — when the material is thin, single-perspective or contradictory, say so in limits.
8. Client's language — business specifics over gratuitous jargon.

P10 FINDING CONTRACT (every finding — theme / issue / opportunity / signal):
- Each finding MUST carry: a confidence_level (one of: ${P10_CONFIDENCE_LEVELS.join(' | ')}), limits[] (what would break it), and evidence_refs[] (answer_ids).
- "high" confidence requires triangulation: 2+ evidence pointers from different sources/segments with no contradictions. Otherwise cap at "medium" or lower.
- No overclaim: ${P10_NO_OVERCLAIM_RULES.join(' ')}
- Prefer "A correlates with B in this context" over "A causes B" unless confidence is high with explicit evidence.`;

/** BCG §4 structural emphasis per Insight readout section (content, not format). */
const INSIGHT_SECTION_BCG_GUIDANCE = `SECTION-LEVEL EMPHASIS (BCG §4 — Insight):
- Executive Summary: 1 C-level page, BLUF. 3-5 findings, each one answer-first sentence + its implication. No methodology.
- Consulting Readout: full Pyramid readout — situation → key signals → stable vs. fragile → open questions → recommended directions.
- Themes: cross-session patterns (not single utterances); each has confidence, evidence_refs, limits, and a divergence_note when perspectives differ.
- Issues & Risks: pain point + severity + root cause + impact; triangulated — no quote/evidence, no entry.
- Opportunity Spaces: opportunity + impact + "quick win vs. strategic" + feasibility condition.
- Between the Lines (implicit assumptions, silences, power dynamics, consensus/divergence): analytic depth on what was NOT said; usually low confidence → label as hypotheses.
- Evidence Map: map every finding → concrete answer_ids; this is the credibility floor — keep it HIGH confidence.`;

const PROMPT_TEMPLATES_BASE: Record<InsightPromptType, string> = {
  summary: `Analyze the following interview responses and provide a comprehensive summary.

Structure your response as follows:
1. **Executive Summary** - A brief overview of the key findings
2. **Main Themes** - The dominant themes that emerged from the interviews
3. **Key Quotes** - Notable quotes from respondents (anonymized)
4. **Observations** - Additional observations worth noting

Interview Data:
{DATA}

Provide the analysis in a clear, professional consulting format using markdown.`,

  general_analysis: `Analyze the following interview responses and provide a broad, non-targeted consulting readout.

This mode is intentionally open-ended. Do not lock onto one theme only.
Cover the most important observations across operations, people, risks, opportunities, and inconsistencies.

Structure your response as follows:
1. **Overall Situation Snapshot** - neutral readout of what the material says
2. **Key Signals Across Topics** - strongest cross-cutting observations
3. **What Looks Stable vs. What Looks Fragile** - strengths and weak points
4. **Open Questions & Blind Spots** - where evidence is thin or missing
5. **Suggested Next Investigation Directions** - what should be explored next

Interview Data:
{DATA}

Provide the analysis in a clear, professional consulting format using markdown.`,

  trends: `Analyze the following interview responses and identify key trends and patterns.

Structure your response as follows:
1. **Emerging Trends** - New patterns or behaviors observed
2. **Consistent Patterns** - Themes that appear across multiple interviews
3. **Divergent Views** - Areas where opinions differ significantly
4. **Trend Implications** - What these trends mean for the organization

Interview Data:
{DATA}

Provide the analysis in a clear, professional consulting format using markdown.`,

  problems: `Analyze the following interview responses and identify problems, pain points, and challenges.

Structure your response as follows:
1. **Critical Issues** - High-priority problems requiring immediate attention
2. **Recurring Challenges** - Problems mentioned multiple times
3. **Root Causes** - Underlying factors contributing to the issues
4. **Impact Assessment** - How these problems affect operations/outcomes

Interview Data:
{DATA}

Provide the analysis in a clear, professional consulting format using markdown.`,

  recommendations: `Analyze the following interview responses and provide actionable recommendations.

Structure your response as follows:
1. **Quick Wins** - Actions that can be implemented immediately with minimal effort
2. **Strategic Initiatives** - Longer-term improvements requiring planning
3. **Priority Matrix** - Recommendations ranked by impact and effort
4. **Implementation Roadmap** - Suggested sequence for implementation

Interview Data:
{DATA}

Provide the analysis in a clear, professional consulting format using markdown.`,

  comparison: `Analyze and compare the following interview responses from different respondents.

Structure your response as follows:
1. **Alignment Areas** - Topics where respondents agree
2. **Divergent Perspectives** - Areas where opinions differ significantly
3. **Perspective by Role/Department** - How views vary by respondent background
4. **Consensus Opportunities** - Where alignment could be built
5. **Key Differences Table** - Summary comparison matrix

Interview Data:
{DATA}

Provide the analysis in a clear, professional consulting format using markdown. Use tables where appropriate.`,

  gaps: `Analyze the following interview responses to identify information gaps and missing data.

Structure your response as follows:
1. **Critical Information Gaps** - Essential information that is missing
2. **Unanswered Questions** - Questions that were not adequately addressed
3. **Areas Requiring Follow-up** - Topics needing deeper exploration
4. **Low Confidence Answers** - Responses that seem uncertain or incomplete
5. **Recommended Next Steps** - Suggested follow-up interviews or research

Interview Data:
{DATA}

Provide the analysis in a clear, professional consulting format using markdown.`,

  risk_assessment: `Analyze the following interview responses to identify and assess risks.

Structure your response as follows:
1. **Critical Risks** - High-impact, high-probability risks requiring immediate attention
2. **Operational Risks** - Day-to-day operational concerns
3. **Strategic Risks** - Long-term threats to business objectives
4. **People & Change Risks** - Human factors and change management concerns
5. **Risk Matrix** - Summary table with likelihood, impact, and mitigation suggestions

| Risk | Category | Likelihood | Impact | Mitigation |
|------|----------|------------|--------|------------|

Interview Data:
{DATA}

Provide the analysis in a clear, professional consulting format using markdown. Include the risk matrix table.`,

  opportunity_scan: `Analyze the following interview responses to identify opportunities and quick wins.

Structure your response as follows:
1. **Quick Wins** - Low-effort, high-impact opportunities (implement within 30 days)
2. **Growth Opportunities** - Areas for expansion or improvement
3. **Efficiency Gains** - Process improvements and cost savings
4. **Innovation Potential** - New ideas and transformative possibilities
5. **Opportunity Prioritization** - Ranked list by value and feasibility

| Opportunity | Category | Effort | Impact | Timeline |
|-------------|----------|--------|--------|----------|

Interview Data:
{DATA}

Provide the analysis in a clear, professional consulting format using markdown. Be specific and actionable.`,

  maturity: `Analyze the following interview responses to assess organizational maturity.

Structure your response as follows:
1. **Overall Maturity Score** - Rating from 1-5 with justification
2. **Maturity by Dimension**:
   - Strategy & Vision (1-5)
   - Processes & Operations (1-5)
   - Technology & Digital (1-5)
   - People & Culture (1-5)
   - Data & Analytics (1-5)
3. **Strengths** - Areas of high maturity
4. **Development Areas** - Areas requiring improvement
5. **Maturity Roadmap** - Path to next maturity level

**Maturity Scale:**
- 1: Initial/Ad-hoc
- 2: Developing/Reactive
- 3: Defined/Proactive
- 4: Managed/Optimized
- 5: Leading/Innovative

Interview Data:
{DATA}

Provide the analysis in a clear, professional consulting format using markdown. Include radar chart data if possible.`,

  stakeholder_map: `Analyze the following interview responses to map key stakeholders.

Structure your response as follows:
1. **Key Stakeholders Identified** - List of important players mentioned
2. **Influence & Interest Matrix**:
   - High Influence / High Interest (Key Players)
   - High Influence / Low Interest (Keep Satisfied)
   - Low Influence / High Interest (Keep Informed)
   - Low Influence / Low Interest (Monitor)
3. **Stakeholder Positions** - Support, neutral, or resistance to change
4. **Relationships & Dynamics** - How stakeholders interact
5. **Engagement Strategy** - Recommended approach for each stakeholder group

| Stakeholder | Role | Influence | Interest | Position | Strategy |
|-------------|------|-----------|----------|----------|----------|

Interview Data:
{DATA}

Provide the analysis in a clear, professional consulting format using markdown. Include the stakeholder table.`,

  between_the_lines: `Analyze the following interview responses for hidden signals, evasions, contradictions, and unspoken tensions.

Structure your response as follows:
1. **Explicit Claims** - What respondents directly said
2. **Implicit Signals** - What their phrasing, omissions, or contradictions may indicate
3. **Tensions & Evasions** - Topics where answers avoid, soften, or contradict important facts
4. **Confidence Limits** - Where interpretation is weak and needs follow-up
5. **Suggested Follow-up Questions** - Questions that would validate or disprove the interpretation

Interview Data:
{DATA}

Provide the analysis in a clear, professional consulting format using markdown. Label all inferred signals as hypotheses, not facts.`,
};

/**
 * PROMPT_TEMPLATES — each base template enriched with the shared BCG §0 doctrine
 * + P10 finding contract. The FIRST LINE of every template is preserved verbatim
 * (it is used elsewhere as the analysis `focusHint`), and the JSON structured
 * output contract is untouched — this only enriches the content instructions the
 * model is asked to satisfy. The doctrine is inserted right before the
 * `Interview Data:` marker so it applies to the analysis but not the data block.
 */
const PROMPT_TEMPLATES: Record<InsightPromptType, string> = Object.fromEntries(
  (Object.keys(PROMPT_TEMPLATES_BASE) as InsightPromptType[]).map((type) => {
    const base = PROMPT_TEMPLATES_BASE[type];
    const doctrine = `\n\n${BCG_P10_PROMPT_DOCTRINE}\n\n${INSIGHT_SECTION_BCG_GUIDANCE}\n`;
    // Insert before the "Interview Data:" marker when present; otherwise append.
    const marker = 'Interview Data:';
    const enriched = base.includes(marker)
      ? base.replace(marker, `${doctrine.trim()}\n\n${marker}`)
      : `${base}${doctrine}`;
    return [type, enriched];
  })
) as Record<InsightPromptType, string>;

const DEFAULT_ANALYSIS_MODE: InsightAnalysisMode = 'general_consulting_synthesis';
const DEFAULT_CONTEXT_MODE: InsightContextMode = 'selected_interview_material_only';
const VALID_PROMPT_TYPES = new Set<InsightPromptType>(
  Object.keys(PROMPT_TEMPLATES) as InsightPromptType[]
);
const VALID_ANALYSIS_MODES = new Set<InsightAnalysisMode>([
  'general_consulting_synthesis',
  'focused_topic_synthesis',
  'contradiction_scan',
  'initiative_opportunity_scan',
  'material_quality_scan',
  'hypothesis_validation',
  'between_the_lines',
]);

function safeStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item || '').trim()).filter(Boolean) : [];
}

function safeJsonObject<T extends Record<string, any>>(raw: unknown, fallback: T): T {
  if (!raw) return fallback;
  if (typeof raw === 'object') return raw as T;
  if (typeof raw !== 'string' || raw.trim().length === 0) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function safeJsonArray<T>(raw: unknown): T[] | undefined {
  if (!raw || typeof raw !== 'string') return undefined;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function normalizeAnalysisMode(value?: string | null): InsightAnalysisMode {
  switch (String(value || '').trim()) {
    case 'focused_topic_synthesis':
    case 'contradiction_scan':
    case 'initiative_opportunity_scan':
    case 'material_quality_scan':
    case 'hypothesis_validation':
    case 'between_the_lines':
    case 'general_consulting_synthesis':
      return value as InsightAnalysisMode;
    default:
      return DEFAULT_ANALYSIS_MODE;
  }
}

function normalizePromptType(value?: string | null): InsightPromptType {
  const normalized = String(value || '').trim() as InsightPromptType;
  return VALID_PROMPT_TYPES.has(normalized) ? normalized : 'summary';
}

const VALID_INSIGHT_CONTEXT_MODES: ReadonlySet<InsightContextMode> = new Set([
  'selected_interview_material_only',
  'selected_material_plus_approved_org_knowledge',
  'selected_material_only',
  'selected_material_plus_selected_context',
  'selected_material_plus_approved_org_context',
  'org_context_research_mode',
]);

function normalizeContextMode(value?: string | null): InsightContextMode {
  const raw = String(value || '').trim();
  if (raw && VALID_INSIGHT_CONTEXT_MODES.has(raw as InsightContextMode)) {
    return raw as InsightContextMode;
  }
  return DEFAULT_CONTEXT_MODE;
}

export function mapInsightContextModeToWorkflowMode(
  mode: InsightContextMode
):
  | 'selected_material_only'
  | 'selected_material_plus_selected_context'
  | 'selected_material_plus_approved_org_context'
  | 'org_context_research_mode' {
  switch (mode) {
    case 'selected_material_only':
    case 'selected_interview_material_only':
      return 'selected_material_only';
    case 'selected_material_plus_selected_context':
      return 'selected_material_plus_selected_context';
    case 'selected_material_plus_approved_org_knowledge':
    case 'selected_material_plus_approved_org_context':
      return 'selected_material_plus_approved_org_context';
    case 'org_context_research_mode':
      return 'org_context_research_mode';
    default:
      return 'selected_material_only';
  }
}

function normalizeDateBound(value: unknown, bound: 'from' | 'to'): string | undefined {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return bound === 'from' ? `${raw}T00:00:00.000Z` : `${raw}T23:59:59.999Z`;
  }
  return raw;
}

function buildDefaultAnalysisScope(input: {
  sessionIds: string[];
  filters?: CreateInsightInput['filters'] | Record<string, any>;
  analysisScope?: Partial<InsightAnalysisScope>;
  analysisMode?: string | null;
  contextMode?: string | null;
  topicFocus?: string[];
  consultantNote?: string | null;
  leadingQuestion?: string | null;
}): InsightAnalysisScope {
  const filters = input.filters || {};
  const partial = input.analysisScope || {};
  const dateRange =
    partial.date_range ||
    ((filters as any).dateFrom || (filters as any).dateTo
      ? { from: (filters as any).dateFrom || undefined, to: (filters as any).dateTo || undefined }
      : undefined);
  const topicFocus =
    safeStringArray(partial.topic_focus).length > 0
      ? safeStringArray(partial.topic_focus)
      : safeStringArray(input.topicFocus || (filters as any).topicFocus);

  return {
    source_session_ids:
      safeStringArray(partial.source_session_ids).length > 0
        ? safeStringArray(partial.source_session_ids)
        : input.sessionIds,
    source_scope_status: 'approved_only',
    respondent_filters: safeStringArray(
      partial.respondent_filters || (filters as any).respondentIds || (filters as any).respondentId
    ),
    role_filters: safeStringArray(partial.role_filters || (filters as any).roles),
    department_filters: safeStringArray(partial.department_filters || (filters as any).departments),
    template_filters: safeStringArray(
      partial.template_filters || (filters as any).templateIds || (filters as any).templateId
    ),
    ...(dateRange ? { date_range: dateRange } : {}),
    topic_focus: topicFocus,
    analysis_mode: normalizeAnalysisMode(partial.analysis_mode || input.analysisMode),
    context_mode: normalizeContextMode(partial.context_mode || input.contextMode),
    consultant_note: partial.consultant_note ?? input.consultantNote ?? null,
    leading_question: partial.leading_question ?? input.leadingQuestion ?? null,
  };
}

export function buildInsightSourceMaterialSummary(params: {
  requestedSessionIds: string[];
  sessionData: Array<{ id: string; answers?: unknown[] }>;
  analysisScope: InsightAnalysisScope;
}): InsightSourceMaterialSummary {
  const includedSessionIds = params.sessionData.map((session) => String(session.id));
  return {
    requestedSessionCount: safeStringArray(params.requestedSessionIds).length,
    includedSessionCount: includedSessionIds.length,
    excludedSessionCount: Math.max(
      0,
      safeStringArray(params.requestedSessionIds).length - includedSessionIds.length
    ),
    includedAnswerCount: params.sessionData.reduce(
      (count, session) => count + (Array.isArray(session.answers) ? session.answers.length : 0),
      0
    ),
    includedSessionIds,
    appliedFilters: {
      respondents: params.analysisScope.respondent_filters,
      roles: params.analysisScope.role_filters,
      departments: params.analysisScope.department_filters,
      templates: params.analysisScope.template_filters,
      ...(params.analysisScope.date_range ? { dateRange: params.analysisScope.date_range } : {}),
    },
  };
}

export function buildInsightScopeSessionWhereClause(analysisScope?: InsightAnalysisScope): {
  whereSql: string;
  params: unknown[];
} {
  const scopeFilters: string[] = [];
  const scopeParams: unknown[] = [];

  const respondentFilters = safeStringArray(analysisScope?.respondent_filters);
  if (respondentFilters.length > 0) {
    scopeFilters.push(`s.owner_id IN (${respondentFilters.map(() => '?').join(',')})`);
    scopeParams.push(...respondentFilters);
  }

  const roleFilters = safeStringArray(analysisScope?.role_filters);
  if (roleFilters.length > 0) {
    scopeFilters.push(`u.job_title IN (${roleFilters.map(() => '?').join(',')})`);
    scopeParams.push(...roleFilters);
  }

  const departmentFilters = safeStringArray(analysisScope?.department_filters);
  if (departmentFilters.length > 0) {
    scopeFilters.push(`upe.department IN (${departmentFilters.map(() => '?').join(',')})`);
    scopeParams.push(...departmentFilters);
  }

  const templateFilters = safeStringArray(analysisScope?.template_filters);
  if (templateFilters.length > 0) {
    scopeFilters.push(`s.template_id IN (${templateFilters.map(() => '?').join(',')})`);
    scopeParams.push(...templateFilters);
  }

  const dateFrom = normalizeDateBound(analysisScope?.date_range?.from, 'from');
  if (dateFrom) {
    scopeFilters.push(`datetime(s.completed_at) >= datetime(?)`);
    scopeParams.push(dateFrom);
  }

  const dateTo = normalizeDateBound(analysisScope?.date_range?.to, 'to');
  if (dateTo) {
    scopeFilters.push(`datetime(s.completed_at) <= datetime(?)`);
    scopeParams.push(dateTo);
  }

  return {
    whereSql: scopeFilters.length > 0 ? `AND ${scopeFilters.join(' AND ')}` : '',
    params: scopeParams,
  };
}

export function buildInsightGenerationPreferences(params: {
  promptType: InsightPromptType;
  filters?: CreateInsightInput['filters'] | Record<string, unknown>;
  analysisScope: InsightAnalysisScope;
}): InsightGenerationPreferences {
  const filters = params.filters || {};
  const normalizedPromptType = normalizePromptType(params.promptType);
  const outputTypes = safeStringArray((filters as any).outputTypes)
    .filter((type) => VALID_PROMPT_TYPES.has(type as InsightPromptType))
    .map((type) => normalizePromptType(type))
    .filter((type, index, all) => all.indexOf(type) === index);
  const analysisModes = safeStringArray((filters as any).analysisModes)
    .filter((mode) => VALID_ANALYSIS_MODES.has(mode as InsightAnalysisMode))
    .map((mode) => normalizeAnalysisMode(mode))
    .filter((mode, index, all) => all.indexOf(mode) === index);

  return {
    outputTypes: outputTypes.length > 0 ? outputTypes : [normalizedPromptType],
    analysisModes:
      analysisModes.length > 0
        ? analysisModes
        : [normalizeAnalysisMode(params.analysisScope.analysis_mode)],
  };
}

export function validateInsightEvidenceRefs(
  data: ParsedInsightGenerationData,
  availableAnswerIds: string[]
): { data: ParsedInsightGenerationData; result: InsightEvidenceValidationResult } {
  const available = new Set(safeStringArray(availableAnswerIds));
  const invalidRefs = new Set<string>();

  const sanitizeRefs = (refs: unknown): string[] =>
    safeStringArray(refs).filter((ref) => {
      const isValid = available.has(ref);
      if (!isValid) invalidRefs.add(ref);
      return isValid;
    });

  const themes = data.themes.map((theme) => ({
    ...theme,
    evidence_refs: sanitizeRefs(theme.evidence_refs),
  }));
  const issues = data.issues.map((issue) => ({
    ...issue,
    evidence_refs: sanitizeRefs(issue.evidence_refs),
  }));
  const opportunities = data.opportunities.map((opportunity) => ({
    ...opportunity,
    evidence_refs: sanitizeRefs(opportunity.evidence_refs),
  }));

  const invalidEvidenceMapRefs = new Set<string>();
  const evidenceMap = data.evidence_map.filter((entry) => {
    const answerId = String(entry.answer_id || '').trim();
    const isValid = available.has(answerId);
    if (!isValid && answerId) invalidEvidenceMapRefs.add(answerId);
    return isValid;
  });

  const warnings: string[] = [];
  if (invalidRefs.size > 0) {
    warnings.push(
      `Removed invalid evidence_refs that did not match scoped answer IDs: ${Array.from(
        invalidRefs
      ).join(', ')}`
    );
  }
  if (invalidEvidenceMapRefs.size > 0) {
    warnings.push(
      `Removed evidence_map rows with unknown answer IDs: ${Array.from(invalidEvidenceMapRefs).join(
        ', '
      )}`
    );
  }

  return {
    data: {
      ...data,
      themes,
      issues,
      opportunities,
      evidence_map: evidenceMap,
      missing_data: warnings.length > 0 ? [...data.missing_data, ...warnings] : data.missing_data,
    },
    result: {
      availableAnswerCount: available.size,
      invalidRefs: Array.from(invalidRefs),
      invalidEvidenceMapRefs: Array.from(invalidEvidenceMapRefs),
      degraded: warnings.length > 0,
      warnings,
    },
  };
}

export function buildInsightMaterialQuality(
  sessionData: any[],
  v6Data: ParsedInsightGenerationData
): InsightMaterialQuality {
  const answeredTotal = sessionData.reduce(
    (sum, session) => sum + Number(session.answered_questions || session.answers?.length || 0),
    0
  );
  const questionTotal = sessionData.reduce(
    (sum, session) => sum + Number(session.total_questions || session.answers?.length || 0),
    0
  );
  const roles = safeStringArray(sessionData.map((session) => session.job_title));
  const departments = safeStringArray(sessionData.map((session) => session.department));
  const thinAnswers = sessionData
    .flatMap((session) => session.answers || [])
    .filter((answer) => {
      const text = String(answer.answer_text || '').trim();
      return text.length < 80 || (answer.confidence_score && Number(answer.confidence_score) < 3);
    }).length;
  const contradictionCount = (v6Data.signals || []).filter((signal) =>
    /contradiction|tension/i.test(`${signal.type} ${signal.title} ${signal.description}`)
  ).length;
  const evidenceGapCount =
    (v6Data.missing_data || []).length +
    [...(v6Data.themes || []), ...(v6Data.issues || []), ...(v6Data.opportunities || [])].filter(
      (item: any) => !Array.isArray(item.evidence_refs) || item.evidence_refs.length === 0
    ).length;
  const coverageRatio = questionTotal > 0 ? answeredTotal / questionTotal : 0;
  const aiQuality = v6Data.material_quality || {};
  const aiScore = Number((aiQuality as any).overall_material_score);
  const calculatedScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        coverageRatio * 55 +
          Math.min(sessionData.length, 4) * 8 +
          Math.min(roles.length + departments.length, 6) * 3 -
          thinAnswers * 2 -
          evidenceGapCount * 3 -
          contradictionCount * 2
      )
    )
  );
  const score = Number.isFinite(aiScore) ? Math.max(0, Math.min(100, aiScore)) : calculatedScore;

  const answerQuality =
    (aiQuality as any).answer_quality_posture ||
    (score >= 80 ? 'strong' : score >= 60 ? 'usable' : score >= 40 ? 'thin' : 'poor');
  const coveragePosture =
    (aiQuality as any).coverage_posture ||
    (sessionData.length <= 1
      ? 'single_perspective'
      : roles.length >= 3 || departments.length >= 3
        ? 'strong_cross_function_coverage'
        : sessionData.length >= 3
          ? 'good_coverage'
          : 'partial_coverage');
  const missingVoices = safeStringArray((aiQuality as any).missing_voices);
  const derivedMissingVoices = [
    ...(roles.length <= 1 ? ['Additional roles are missing from the evidence base.'] : []),
    ...(departments.length <= 1
      ? ['Additional departments are missing from the evidence base.']
      : []),
  ];
  const confidenceDowngradeRequired =
    score < 70 ||
    answerQuality === 'thin' ||
    answerQuality === 'poor' ||
    coveragePosture === 'single_perspective' ||
    evidenceGapCount > 0;
  const recommendationPosture: InsightMaterialQuality['recommendation_posture'] =
    answerQuality === 'poor' || score < 40
      ? 'hypothesis_only'
      : confidenceDowngradeRequired
        ? 'review_required'
        : 'decision_ready';
  const baseLimitations = safeStringArray((aiQuality as any).limitations || v6Data.missing_data);
  const derivedLimitations = [
    ...(confidenceDowngradeRequired
      ? ['Recommendations must remain evidence-bounded hypotheses until reviewed.']
      : []),
    ...(coveragePosture === 'single_perspective'
      ? [
          'Material represents a single perspective and should not be generalized as organization-wide.',
        ]
      : []),
    ...(thinAnswers > 0
      ? [`${thinAnswers} thin or low-confidence answers reduce recommendation certainty.`]
      : []),
    ...(contradictionCount > 0
      ? [`${contradictionCount} contradictions or tensions require operator review before action.`]
      : []),
  ];
  const recommendedFollowups = safeStringArray((aiQuality as any).recommended_followups);

  return {
    overall_material_score: score,
    answer_quality_posture: answerQuality,
    coverage_posture: coveragePosture,
    approved_session_count: sessionData.length,
    respondent_count: new Set(sessionData.map((session) => session.owner_id || session.id)).size,
    role_coverage: roles,
    department_coverage: departments,
    thin_answer_count: thinAnswers,
    missing_voices: [...missingVoices, ...derivedMissingVoices].filter(
      (item, index, all) => all.indexOf(item) === index
    ),
    evidence_gap_count: evidenceGapCount,
    contradiction_count: contradictionCount,
    confidence_downgrade_required: confidenceDowngradeRequired,
    recommendation_posture: recommendationPosture,
    limitations: [...baseLimitations, ...derivedLimitations].filter(
      (item, index, all) => all.indexOf(item) === index
    ),
    recommended_followups:
      recommendedFollowups.length > 0
        ? recommendedFollowups
        : confidenceDowngradeRequired
          ? [
              'Collect additional interviews or evidence before converting recommendations into actions.',
            ]
          : [],
  };
}

// ==========================================
// SERVICE CLASS
// ==========================================

/**
 * M03R-008 — kasowanie insightu, do którego odwołują się inicjatywy.
 * Nie jest to błąd walidacji wejścia, tylko odmowa rozerwania lineage,
 * dlatego niesie liczbę obiektów trzymających powiązanie.
 */
export class InsightReferencedError extends Error {
  code = 'INSIGHT_REFERENCED_BY_INITIATIVES';
  status = 409;
  insightId: string;
  referencingCount: number;

  constructor(insightId: string, referencingCount: number) {
    super(
      `Insight ${insightId} is referenced by ${referencingCount} initiative(s); deleting it would leave dangling source references`
    );
    this.name = 'InsightReferencedError';
    this.insightId = insightId;
    this.referencingCount = referencingCount;
  }
}

class InterviewInsightService {
  private db: IDatabase | null = null;

  private async getDb(): Promise<IDatabase> {
    if (!this.db) {
      this.db = await getDatabase();
    }
    return this.db;
  }

  private async ensureContextLineageSchema(db: IDatabase): Promise<void> {
    await db.run(
      `CREATE TABLE IF NOT EXISTS organization_context_lineage_events (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        user_id TEXT,
        target_type TEXT NOT NULL,
        target_id TEXT NOT NULL,
        workflow TEXT NOT NULL,
        event_type TEXT NOT NULL,
        requested_document_ids_json TEXT,
        selected_document_ids_json TEXT,
        used_chunks_json TEXT,
        degraded INTEGER DEFAULT 0,
        degraded_reasons_json TEXT,
        metadata_json TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      []
    );
    await db.run(
      `CREATE INDEX IF NOT EXISTS idx_context_lineage_org_target
       ON organization_context_lineage_events(organization_id, target_type, target_id)`,
      []
    );
  }

  private async recordInsightContextLineage(params: {
    insightId: string;
    organizationId: string;
    userId: string;
    eventType: 'interview_insight_context_selected' | 'interview_insight_completed';
    contextDocumentPack: ContextDocumentPack;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    if (
      params.contextDocumentPack.requestedIds.length === 0 &&
      params.contextDocumentPack.selectedIds.length === 0 &&
      params.contextDocumentPack.documents.length === 0
    ) {
      return;
    }

    try {
      const db = await this.getDb();
      await this.ensureContextLineageSchema(db);
      const payload = buildInsightContextLineagePayload(params.contextDocumentPack);
      await db.run(
        `INSERT INTO organization_context_lineage_events
         (id, organization_id, user_id, target_type, target_id, workflow, event_type,
          requested_document_ids_json, selected_document_ids_json, used_chunks_json,
          degraded, degraded_reasons_json, metadata_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          params.organizationId,
          params.userId,
          'interview_insight',
          params.insightId,
          'interview_insight_creator',
          params.eventType,
          JSON.stringify(payload.requestedDocumentIds),
          JSON.stringify(payload.selectedDocumentIds),
          JSON.stringify(payload.usedChunks),
          payload.degraded ? 1 : 0,
          JSON.stringify(payload.degradedReasons),
          JSON.stringify(params.metadata || {}),
          new Date().toISOString(),
        ]
      );
    } catch (error) {
      logger.warn('[InterviewInsightService] Context lineage write failed:', error);
    }
  }

  async listContextLineage(
    organizationId: string,
    insightId: string
  ): Promise<
    Array<{
      id: string;
      targetType: string;
      targetId: string;
      workflow: string;
      eventType: string;
      requestedDocumentIds: string[];
      selectedDocumentIds: string[];
      usedChunks: Array<Record<string, unknown>>;
      degraded: boolean;
      degradedReasons: string[];
      metadata: Record<string, unknown>;
      createdAt: string;
    }>
  > {
    const db = await this.getDb();
    await this.ensureContextLineageSchema(db);
    const rows = await db.all<any>(
      `SELECT id, target_type, target_id, workflow, event_type,
              requested_document_ids_json, selected_document_ids_json, used_chunks_json,
              degraded, degraded_reasons_json, metadata_json, created_at
       FROM organization_context_lineage_events
       WHERE organization_id = ?
         AND target_type = 'interview_insight'
         AND target_id = ?
       ORDER BY created_at ASC`,
      [organizationId, insightId]
    );

    return (rows || []).map((row) => {
      const usedChunks = safeJsonArray<Record<string, unknown>>(row.used_chunks_json) || [];
      return {
        id: String(row.id || ''),
        targetType: String(row.target_type || 'interview_insight'),
        targetId: String(row.target_id || ''),
        workflow: String(row.workflow || 'interview_insight_creator'),
        eventType: String(row.event_type || ''),
        requestedDocumentIds: safeStringArray(
          safeJsonArray<string>(row.requested_document_ids_json) || []
        ),
        selectedDocumentIds: safeStringArray(
          safeJsonArray<string>(row.selected_document_ids_json) || []
        ),
        usedChunks,
        degraded: Boolean(Number(row.degraded || 0)),
        degradedReasons: safeStringArray(safeJsonArray<string>(row.degraded_reasons_json) || []),
        metadata: safeJsonObject<Record<string, unknown>>(row.metadata_json, {}),
        createdAt: String(row.created_at || new Date().toISOString()),
      };
    });
  }

  private buildGenerationContext(params: {
    createdAt: string;
    analysisScope: InsightAnalysisScope;
    generationPreferences?: InsightGenerationPreferences;
    approvedOrgKnowledgePack: ApprovedOrgKnowledgePack;
    contextDocumentPack: ContextDocumentPack;
    sourceMaterialSummary?: InsightSourceMaterialSummary;
    evidenceValidation?: InsightEvidenceValidationResult;
  }): Record<string, any> {
    const generationContract = buildInsightGenerationContract();

    return {
      ...generationContract,
      contextMode: params.analysisScope.context_mode,
      analysisMode: params.analysisScope.analysis_mode,
      topicFocus: params.analysisScope.topic_focus,
      createdAt: params.createdAt,
      ...(params.generationPreferences
        ? { generationPreferences: params.generationPreferences }
        : {}),
      ...(params.sourceMaterialSummary ? { sourceMaterial: params.sourceMaterialSummary } : {}),
      ...(params.evidenceValidation ? { evidenceValidation: params.evidenceValidation } : {}),
      approvedOrgKnowledgePack: {
        requested: params.approvedOrgKnowledgePack.requested,
        available: params.approvedOrgKnowledgePack.available,
        included: params.approvedOrgKnowledgePack.included,
        degraded: params.approvedOrgKnowledgePack.degraded,
        degradedReasons: params.approvedOrgKnowledgePack.degradedReasons,
        policy: params.approvedOrgKnowledgePack.policy,
        sourceCount: params.approvedOrgKnowledgePack.sourceCount,
        builtAt: params.approvedOrgKnowledgePack.builtAt,
        sources: params.approvedOrgKnowledgePack.entries.map((entry) => ({
          claimPath: entry.claimPath,
          sourceType: entry.sourceType,
          sourceLabel: entry.sourceLabel,
          confidence: entry.confidence,
          reviewStatus: entry.reviewStatus,
          createdAt: entry.createdAt,
        })),
      },
      contextDocuments: {
        requestedIds: params.contextDocumentPack.requestedIds,
        selectedIds: params.contextDocumentPack.selectedIds,
        degraded: params.contextDocumentPack.degraded,
        degradedReasons: params.contextDocumentPack.degradedReasons,
        documents: params.contextDocumentPack.documents.map((doc) => ({
          id: doc.id,
          filename: doc.filename,
          status: doc.status,
          scope: doc.scope,
          projectId: doc.projectId,
          ownerId: doc.ownerId,
          version: doc.version,
          uploadedAt: doc.uploadedAt,
          usedChunkCount: doc.usedChunks.length,
          chunks: doc.usedChunks.map((chunk) => ({
            chunkId: chunk.chunkId,
            source: chunk.source,
            chunkIndex: chunk.chunkIndex,
            excerpt: chunk.content.slice(0, 260),
          })),
        })),
      },
      lineageLedger: {
        workflow: 'interview_insight_creator',
        targetType: 'interview_insight',
        eventTable: 'organization_context_lineage_events',
        status: 'write_best_effort',
      },
    };
  }

  private async buildApprovedOrgKnowledgePack(
    organizationId: string,
    contextMode: InsightContextMode
  ): Promise<ApprovedOrgKnowledgePack> {
    const builtAt = new Date().toISOString();
    const base = {
      requested: contextMode === 'selected_material_plus_approved_org_knowledge',
      available: false,
      included: false,
      degraded: false,
      degradedReasons: [] as string[],
      policy: 'accepted_or_approved_context_claims_only' as const,
      sourceCount: 0,
      builtAt,
      entries: [] as ApprovedOrgKnowledgePack['entries'],
    };

    if (!base.requested) {
      return base;
    }

    try {
      const claims = await organizationContextService.listClaims(organizationId, 60);
      const approvedStatuses = new Set(['accepted', 'approved', 'verified', 'confirmed']);
      const entries = (claims || [])
        .filter((claim) => approvedStatuses.has(String(claim.reviewStatus || '').toLowerCase()))
        .filter((claim) => claim.value !== null && claim.value !== undefined && claim.value !== '')
        .slice(0, 25)
        .map((claim) => ({
          claimPath: claim.claimPath,
          value: claim.value,
          confidence: Number(claim.confidence || 0),
          reviewStatus: claim.reviewStatus,
          sourceType: claim.sourceType,
          sourceLabel: claim.sourceLabel,
          createdAt: claim.createdAt,
        }));

      if (entries.length === 0) {
        return {
          ...base,
          degraded: true,
          degradedReasons: ['no_approved_organization_knowledge_available'],
        };
      }

      return {
        ...base,
        available: true,
        included: true,
        sourceCount: entries.length,
        entries,
      };
    } catch (error) {
      logger.warn('[InterviewInsightService] Approved org knowledge pack unavailable:', error);
      return {
        ...base,
        degraded: true,
        degradedReasons: ['approved_organization_knowledge_lookup_failed'],
      };
    }
  }

  private async buildContextDocumentPack(input: {
    organizationId: string;
    userId: string;
    selectedContextDocumentIds?: string[];
    promptType: InsightPromptType;
    analysisScope: InsightAnalysisScope;
    customPrompt?: string;
  }): Promise<ContextDocumentPack> {
    const requestedIds = safeStringArray(input.selectedContextDocumentIds);
    if (requestedIds.length === 0) {
      return {
        requestedIds: [],
        selectedIds: [],
        degraded: false,
        degradedReasons: [],
        documents: [],
      };
    }

    const db = await this.getDb();
    const placeholders = requestedIds.map(() => '?').join(',');
    const rows = await db.all<any>(
      `SELECT id, filename, status, scope, project_id, owner_id, version, created_at
       FROM knowledge_docs
       WHERE id IN (${placeholders})
         AND organization_id = ?
         AND (scope = 'project' OR (scope = 'user' AND owner_id = ?))`,
      [...requestedIds, input.organizationId, input.userId]
    );

    const byId = new Map<string, any>((rows || []).map((row) => [String(row.id), row]));
    const selectedRows = requestedIds.map((id) => byId.get(id)).filter(Boolean);
    const selectedIds = selectedRows.map((row) => String(row.id));

    const degradedReasons: string[] = [];
    if (selectedIds.length !== requestedIds.length) {
      degradedReasons.push('some_documents_not_accessible');
    }
    const notReadyRows = selectedRows.filter(
      (row) => canonicalizeContextDocumentStatus(row.status) !== 'ready'
    );
    if (notReadyRows.length > 0) {
      degradedReasons.push('some_documents_not_ready');
    }

    const readyRows = selectedRows.filter(
      (row) => canonicalizeContextDocumentStatus(row.status) === 'ready'
    );
    if (readyRows.length === 0) {
      return {
        requestedIds,
        selectedIds,
        degraded: degradedReasons.length > 0,
        degradedReasons:
          degradedReasons.length > 0 ? degradedReasons : ['no_ready_documents_selected'],
        documents: selectedRows.map((row) => ({
          id: String(row.id),
          filename: String(row.filename || ''),
          status: canonicalizeContextDocumentStatus(row.status),
          scope: String(row.scope || 'user'),
          projectId: row.project_id ? String(row.project_id) : null,
          ownerId: row.owner_id ? String(row.owner_id) : null,
          version: Number(row.version || 1),
          uploadedAt: String(row.created_at || new Date().toISOString()),
          usedChunks: [],
        })),
      };
    }

    const ragModule = await import('./ragService.js');
    const ragService = (ragModule.default || ragModule) as any;
    const searchQuery = [
      input.promptType,
      input.analysisScope.analysis_mode,
      input.analysisScope.leading_question || '',
      input.analysisScope.topic_focus.join(' '),
      input.customPrompt || '',
    ]
      .join(' ')
      .trim();
    let ragChunks: Array<{ id?: string; content?: string; filename?: string; source?: string }> =
      [];
    try {
      ragChunks = (await ragService.hybridSearch(searchQuery || 'interview insight context', {
        limit: 12,
        organizationId: input.organizationId,
        documentIds: readyRows.map((row) => String(row.id)),
      })) as any[];
    } catch (err) {
      logger.warn('[InterviewInsightService] Context doc RAG failed, fallback to raw chunks', err);
    }

    const usedChunkMap = new Map<string, ContextDocumentPack['documents'][number]['usedChunks']>();
    if (Array.isArray(ragChunks) && ragChunks.length > 0) {
      for (const chunk of ragChunks) {
        const sourceName = String(chunk?.filename || chunk?.source || 'Context document');
        const ownerDoc = readyRows.find((row) => String(row.filename || '') === sourceName);
        const docId = ownerDoc ? String(ownerDoc.id) : String(readyRows[0].id);
        const list = usedChunkMap.get(docId) || [];
        list.push({
          chunkId: chunk?.id ? String(chunk.id) : null,
          content: String(chunk?.content || '').trim(),
          source: sourceName,
          chunkIndex: null,
        });
        usedChunkMap.set(docId, list);
      }
    }

    if (usedChunkMap.size === 0) {
      let chunkRows: any[] = [];
      try {
        chunkRows = await db.all<any>(
          `SELECT c.id, COALESCE(c.doc_id, c.document_id) as document_ref, c.content, c.chunk_index, d.filename
           FROM knowledge_chunks c
           JOIN knowledge_docs d ON (d.id = c.doc_id OR d.id = c.document_id)
           WHERE (c.doc_id IN (${readyRows.map(() => '?').join(',')})
              OR c.document_id IN (${readyRows.map(() => '?').join(',')}))
           ORDER BY document_ref, c.chunk_index
           LIMIT 40`,
          [...readyRows.map((row) => String(row.id)), ...readyRows.map((row) => String(row.id))]
        );
      } catch {
        chunkRows = await db.all<any>(
          `SELECT c.id, c.doc_id as document_ref, c.content, c.chunk_index, d.filename
           FROM knowledge_chunks c
           JOIN knowledge_docs d ON d.id = c.doc_id
           WHERE c.doc_id IN (${readyRows.map(() => '?').join(',')})
           ORDER BY c.doc_id, c.chunk_index
           LIMIT 40`,
          readyRows.map((row) => String(row.id))
        );
      }
      for (const row of chunkRows || []) {
        const docId = String(row.document_ref);
        const list = usedChunkMap.get(docId) || [];
        if (list.length >= 5) continue;
        list.push({
          chunkId: row.id ? String(row.id) : null,
          content: String(row.content || ''),
          source: String(row.filename || 'Context document'),
          chunkIndex: Number(row.chunk_index || 0),
        });
        usedChunkMap.set(docId, list);
      }
    }

    const documents = selectedRows.map((row) => ({
      id: String(row.id),
      filename: String(row.filename || ''),
      status: canonicalizeContextDocumentStatus(row.status),
      scope: String(row.scope || 'user'),
      projectId: row.project_id ? String(row.project_id) : null,
      ownerId: row.owner_id ? String(row.owner_id) : null,
      version: Number(row.version || 1),
      uploadedAt: String(row.created_at || new Date().toISOString()),
      usedChunks: usedChunkMap.get(String(row.id)) || [],
    }));
    if (documents.some((doc) => doc.status === 'ready' && doc.usedChunks.length === 0)) {
      degradedReasons.push('no_chunks_for_ready_documents');
    }

    return {
      requestedIds,
      selectedIds,
      degraded: degradedReasons.length > 0,
      degradedReasons,
      documents,
    };
  }

  // ==========================================
  // CRUD OPERATIONS
  // ==========================================

  /**
   * Create a new insight and start generation
   */
  async create(input: CreateInsightInput): Promise<Insight> {
    const db = await this.getDb();
    const now = new Date().toISOString();
    const id = `ii_${uuidv4()}`;
    const normalizedSessionIds = safeStringArray(input.sessionIds);
    const promptType = normalizePromptType(input.promptType);

    if (normalizedSessionIds.length === 0) {
      throw Object.assign(new Error('sessionId or sessionIds is required'), {
        code: 'INTERVIEW_INSIGHT_SESSION_REQUIRED',
        status: 400,
      });
    }

    const eligibleSessionIds = await this.loadEligibleSessionIds(
      input.organizationId,
      normalizedSessionIds
    );
    const rejectedSessionIds = normalizedSessionIds.filter(
      (sessionId) => !eligibleSessionIds.has(sessionId)
    );
    if (rejectedSessionIds.length > 0) {
      throw Object.assign(
        new Error(
          'Interview Insight can only be generated from approved/completed interview sessions'
        ),
        {
          code: 'INTERVIEW_INSIGHT_SOURCE_NOT_APPROVED',
          status: 409,
          rejectedSessionIds,
        }
      );
    }

    const storedFilters: Record<string, any> | undefined = (() => {
      const base: Record<string, any> = input.filters ? { ...(input.filters as any) } : {};
      const customPrompt = (input.customPrompt || '').trim();
      if (customPrompt) base.customPrompt = customPrompt;
      return Object.keys(base).length > 0 ? base : undefined;
    })();
    const analysisScope = buildDefaultAnalysisScope({
      sessionIds: normalizedSessionIds,
      filters: input.filters,
      analysisScope: input.analysisScope,
      analysisMode: input.analysisMode,
      contextMode: input.contextMode,
      topicFocus: input.topicFocus,
      consultantNote: input.consultantNote,
      leadingQuestion: input.leadingQuestion,
    });
    const generationPreferences = buildInsightGenerationPreferences({
      promptType,
      filters: input.filters,
      analysisScope,
    });
    const approvedOrgKnowledgePack = await this.buildApprovedOrgKnowledgePack(
      input.organizationId,
      analysisScope.context_mode
    );
    const contextDocumentPack = await this.buildContextDocumentPack({
      organizationId: input.organizationId,
      userId: input.createdBy,
      selectedContextDocumentIds: input.selectedContextDocumentIds,
      promptType,
      analysisScope,
      customPrompt: input.customPrompt,
    });
    const generationContext = this.buildGenerationContext({
      createdAt: now,
      analysisScope,
      generationPreferences,
      approvedOrgKnowledgePack,
      contextDocumentPack,
    });

    // Create insight record
    await db.run(
      `INSERT INTO interview_insights
       (id, session_id, organization_id, category, title, prompt_type, source_session_ids, filters,
        status, source_session_count, analysis_scope_json, context_mode, analysis_mode, topic_focus_json,
        generation_context_json, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        normalizedSessionIds?.[0] || null,
        input.organizationId,
        'general',
        input.title,
        promptType,
        JSON.stringify(normalizedSessionIds),
        storedFilters ? JSON.stringify(storedFilters) : null,
        'generating',
        normalizedSessionIds.length,
        JSON.stringify(analysisScope),
        analysisScope.context_mode,
        analysisScope.analysis_mode,
        JSON.stringify(analysisScope.topic_focus),
        JSON.stringify(generationContext),
        input.createdBy,
        now,
        now,
      ]
    );

    await this.recordInsightContextLineage({
      insightId: id,
      organizationId: input.organizationId,
      userId: input.createdBy,
      eventType: 'interview_insight_context_selected',
      contextDocumentPack,
      metadata: {
        promptType,
        analysisMode: analysisScope.analysis_mode,
        contextMode: analysisScope.context_mode,
      },
    });

    // Start async generation (error-bounded — see detachGeneration).
    this.detachGeneration(
      this.generateInsight(
        id,
        normalizedSessionIds,
        input.organizationId,
        promptType,
        input.customPrompt,
        analysisScope,
        approvedOrgKnowledgePack,
        contextDocumentPack,
        input.createdBy,
        generationPreferences
      ),
      id,
      input.organizationId
    );

    return this.getById(id) as Promise<Insight>;
  }

  /**
   * Get insight by ID
   */
  async getById(id: string): Promise<Insight | null> {
    const db = await this.getDb();
    const row = await db.get<any>(`SELECT * FROM interview_insights WHERE id = ?`, [id]);
    return row ? this.mapRowToInsight(row) : null;
  }

  /**
   * List insights for an organization
   */
  async list(
    organizationId: string,
    options?: { limit?: number; offset?: number; scope?: 'active' | 'archived' | 'all' }
  ): Promise<Insight[]> {
    const db = await this.getDb();
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;
    const scope = options?.scope || 'active';

    // Lifecycle scope filter. Caller (controller) ensures archived_at exists first.
    const scopeSql =
      scope === 'archived'
        ? ' AND archived_at IS NOT NULL'
        : scope === 'all'
          ? ''
          : ' AND archived_at IS NULL';

    const rows = await db.all<any>(
      `SELECT * FROM interview_insights
       WHERE organization_id = ?${scopeSql}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [organizationId, limit, offset]
    );

    return (rows || []).map((row) => this.mapRowToInsight(row));
  }

  /**
   * Regenerate an insight
   */
  async regenerate(id: string): Promise<Insight | null> {
    const db = await this.getDb();
    const insight = await this.getById(id);
    if (!insight) return null;

    const now = new Date().toISOString();

    await db.run(
      `UPDATE interview_insights
       SET status = 'generating',
           content = NULL,
           executive_summary = NULL,
           themes_json = NULL,
           issues_json = NULL,
           opportunities_json = NULL,
           signals_json = NULL,
           evidence_map_json = NULL,
           missing_data_json = NULL,
           error_message = NULL,
           updated_at = ?
       WHERE id = ?`,
      [now, id]
    );

    // Restart generation
    const customPrompt =
      typeof (insight.filters as any)?.customPrompt === 'string'
        ? String((insight.filters as any).customPrompt)
        : undefined;
    const generationPreferences = buildInsightGenerationPreferences({
      promptType: insight.promptType,
      filters: insight.filters as Record<string, unknown> | undefined,
      analysisScope: insight.analysisScope || {
        source_session_ids: insight.sourceSessionIds,
        source_scope_status: 'approved_only',
        respondent_filters: [],
        role_filters: [],
        department_filters: [],
        template_filters: [],
        topic_focus: [],
        analysis_mode: insight.analysisMode || 'general_consulting_synthesis',
        context_mode: insight.contextMode || 'selected_interview_material_only',
        consultant_note: 'Recovered default analysis scope during regeneration.',
        leading_question: null,
      },
    });
    this.detachGeneration(
      this.generateInsight(
        id,
        insight.sourceSessionIds,
        insight.organizationId,
        insight.promptType,
        customPrompt,
        insight.analysisScope,
        undefined,
        undefined,
        insight.createdBy,
        generationPreferences
      ),
      id,
      insight.organizationId
    );

    return this.getById(id);
  }

  /**
   * Delete an insight.
   *
   * M03R-008 — strzeżone kasowanie. Do 2026-08-04 to był goły DELETE, więc
   * skasowanie insightu zostawiało w `initiatives` wiersz z `source_id`
   * wskazującym w pustkę. Na demo tak powstało 5 z 7 wiszących wskaźników:
   * `source_id` jest zapisany w 100% draftów, ale rozwiązuje się tylko w 2.
   * W UI wyglądało to jak „brak źródła", bo zerwany wskaźnik i brak wskaźnika
   * renderowały ten sam myślnik.
   *
   * Guard nie kasuje niczego kaskadowo i nie fabrykuje lineage — po prostu
   * odmawia rozerwania żywego powiązania i mówi, ile obiektów je trzyma.
   * Sprzątanie istniejących wiszących wskaźników to osobna, autoryzowana
   * mutacja (plan MUT-02), nie efekt uboczny tego guardu.
   */
  async delete(id: string): Promise<boolean> {
    const db = await this.getDb();

    const referencing = await db.get<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM initiatives
        WHERE source_id = ? AND lower(COALESCE(source_type, '')) LIKE '%interview%'`,
      [id]
    );
    const referencingCount = Number(referencing?.n || 0);
    if (referencingCount > 0) {
      throw new InsightReferencedError(id, referencingCount);
    }

    const result = await db.run(`DELETE FROM interview_insights WHERE id = ?`, [id]);
    return (result as any)?.changes > 0;
  }

  // ==========================================
  // AI GENERATION
  // ==========================================

  /**
   * V6 three-layer truth model prompt.
   * Replaces all per-promptType templates with a single structured JSON output contract.
   */
  private buildV6Prompt(
    promptType: InsightPromptType,
    formattedData: string,
    customPrompt?: string,
    sessionCount = 1,
    analysisScope?: InsightAnalysisScope,
    approvedOrgKnowledgePack?: ApprovedOrgKnowledgePack,
    contextDocumentPack?: ContextDocumentPack,
    generationPreferences?: InsightGenerationPreferences
  ): string {
    const focusHint = PROMPT_TEMPLATES[promptType]?.split('\n')[0] || '';
    const isMultiSession = sessionCount > 1;
    const scope = analysisScope || buildDefaultAnalysisScope({ sessionIds: [], filters: {} });
    const scopeBlock = JSON.stringify(
      {
        analysis_mode: scope.analysis_mode,
        context_mode: scope.context_mode,
        topic_focus: scope.topic_focus,
        leading_question: scope.leading_question,
        consultant_note: scope.consultant_note,
        source_scope_status: scope.source_scope_status,
      },
      null,
      2
    );
    const preferenceBlock = JSON.stringify(
      generationPreferences || {
        outputTypes: [promptType],
        analysisModes: [scope.analysis_mode],
      },
      null,
      2
    );
    const generationContract = buildInsightGenerationContract();
    const generationContractBlock = JSON.stringify(generationContract, null, 2);

    const crossSessionBlock = isMultiSession
      ? `
      "cross_session_pattern": true or false (boolean indicating if this spans multiple sessions),
      "perspective_labels": ["Role / department / respondent lens that supports or challenges this"],
      "divergence_note": "Optional note when roles or respondents see the topic differently"`
      : '';

    const crossSessionInstructions = isMultiSession
      ? `

CROSS-SESSION ANALYSIS (${sessionCount} respondents):
- Identify RECURRING themes that appear across multiple respondents
- Flag CONTRADICTIONS where respondents disagree
- Note CONSENSUS areas where all respondents align
- Distinguish single-respondent observations from cross-session patterns
- In each theme/issue/opportunity, note which sessions support it (by respondent name or session name)
- Add a "cross_session_pattern" boolean to each theme/issue/opportunity indicating if it spans multiple sessions
- Populate "perspective_labels" with the roles, departments, or respondent lenses most relevant to the topic
- Use "divergence_note" when the same topic looks different across roles, departments, or respondents
`
      : '';
    const orgKnowledgeContext = (() => {
      if (!approvedOrgKnowledgePack?.requested) {
        return 'Approved Organization Knowledge: not requested for this insight.';
      }
      if (!approvedOrgKnowledgePack.included || approvedOrgKnowledgePack.entries.length === 0) {
        return `Approved Organization Knowledge: requested but unavailable or degraded.\nReasons: ${
          approvedOrgKnowledgePack.degradedReasons.join(', ') || 'unknown'
        }`;
      }
      return `Approved Organization Knowledge Pack (approved/attributed context only; do not override interview material limitations):\n${JSON.stringify(
        approvedOrgKnowledgePack.entries,
        null,
        2
      )}`;
    })();
    const contextDocumentBlock = (() => {
      if (!contextDocumentPack || contextDocumentPack.requestedIds.length === 0) {
        return 'Organization/Project documents: none selected.';
      }
      const documentsWithChunks = contextDocumentPack.documents.filter(
        (doc) => doc.usedChunks.length > 0
      );
      if (documentsWithChunks.length === 0) {
        return `Organization/Project documents selected but unavailable for retrieval.\nReasons: ${
          contextDocumentPack.degradedReasons.join(', ') || 'unknown'
        }`;
      }
      const chunksText = documentsWithChunks
        .flatMap((doc) =>
          doc.usedChunks.slice(0, 4).map((chunk, index) => ({
            code: `[D:${doc.id}:${index + 1}]`,
            source: doc.filename,
            content: chunk.content,
          }))
        )
        .slice(0, 12)
        .map((item) => `${item.code} ${item.source}\n${item.content}`)
        .join('\n\n');
      return `Organization/Project documents retrieved as RAG chunks (use only these fragments; do not assume full document access):\n${chunksText}`;
    })();

    // Z60/#57 — per-type content formula (§3): thesis-titles, quote-ready evidence,
    // measurable so-whats, correctly-typed signals. This is what makes the six emitted
    // fields feed McKinsey-grade derived sections (Key Findings, Recommendations,
    // Tensions, Patterns, Quote Comparison). SSOT: _FORMULA_TRESCI_INSIGHT §3.
    const insightTypeGuidance = buildInsightTypeGuidanceBlock();

    let prompt = `You are analyzing interview data. Your analysis focus: ${focusHint}

${BCG_P10_PROMPT_DOCTRINE}

${INSIGHT_SECTION_BCG_GUIDANCE}

${insightTypeGuidance}

Insight Scope:
${scopeBlock}

Requested Output And Analysis Lenses:
${preferenceBlock}

Structured Output Contract:
${generationContractBlock}

${orgKnowledgeContext}

${contextDocumentBlock}

Context mode rules:
- If context_mode is "selected_interview_material_only", use only the interview material below.
- If context_mode is "selected_material_plus_approved_org_knowledge", you may use approved organizational knowledge only when it is explicitly available in the provided context; otherwise say that broader organizational knowledge was not available.
- Organization/project documents are optional and user-selected. Use only provided RAG chunks; never invent content outside retrieved fragments.
- Never hide uncertainty. If the material is thin, contradictory, or single-perspective, say so in limits and material_quality.
- A leading_question is optional. If absent, identify the highest-value consulting observations yourself.
- Topic focus may be empty. If empty, create a general consulting synthesis.
- Requested output and analysis lenses shape emphasis inside this insight only. Do not create downstream documents or application objects during insight generation.
- If recommendations or opportunities are requested, express them as evidence-bounded opportunity/recommendation hypotheses with confidence limits, not as approved decisions or execution plans.

Each answer in the data below is tagged with an [answer_id: ...]. Use these IDs in evidence_refs and evidence_map.

Interview Data:
${formattedData}

Return ONLY a valid JSON object (no markdown fences, no commentary outside the JSON) with this exact structure:

{
  "schema_version": "${INTERVIEW_INSIGHT_GENERATION_SCHEMA_VERSION}",
  "executive_summary": "3-5 sentences / 60-130 words. Answer-first (lead with the conclusion), then the so-what implication, then an explicit confidence posture. No methodology, no filler.",
  "themes": [
    {
      "title": "Action-title carrying the conclusion (≤14 words, not a bare topic)",
      "description": "≥3 sentences / ≥50 words. What the pattern is, why it matters, grounded in the cited answers — quote or paraphrase the specific evidence, never generic prose.",
      "evidence_refs": ["answer_id_1", "answer_id_2"],
      "strength": "strong|moderate|weak"${crossSessionBlock}
    }
  ],
  "issues": [
    {
      "title": "Issue title",
      "description": "What the problem is and why it matters",
      "severity": "high|medium|low",
      "evidence_refs": ["answer_id_1"]${crossSessionBlock}
    }
  ],
  "opportunities": [
    {
      "title": "Opportunity title",
      "description": "What the opportunity is and its potential value",
      "impact": "high|medium|low",
      "evidence_refs": ["answer_id_1"]${crossSessionBlock}
    }
  ],
  "signals": [
    {
      "title": "Signal title",
      "description": "Description of the tension, gap, contradiction, or emerging pattern",
      "type": "tension|gap|contradiction|emerging_pattern"
    }
  ],
  "evidence_map": [
    {
      "answer_id": "the_answer_id",
      "question_text": "The original question",
      "answer_snippet": "Key excerpt from the answer (max 120 chars)",
      "linked_themes": ["Theme title 1"],
      "linked_issues": ["Issue title 1"]
    }
  ],
  "missing_data": ["At least 2 concrete gaps: what evidence is missing or which follow-up question would raise confidence"],
  "material_quality": {
    "overall_material_score": 0-100,
    "answer_quality_posture": "strong|usable|thin|poor",
    "coverage_posture": "single_perspective|partial_coverage|good_coverage|strong_cross_function_coverage",
    "missing_voices": ["Which roles/departments/perspectives are missing"],
    "limitations": ["Limits on what can safely be concluded"],
    "recommended_followups": ["Follow-up questions or interviews that would improve confidence"]
  }
}
${crossSessionInstructions}
Rules:
- Ground every theme, issue, and opportunity in specific answer_ids from the data.
- "signals" capture tensions, gaps, contradictions, or emerging patterns that don't fit neatly into themes/issues.
- Include at least one entry in evidence_map for each answer that contributed to a theme or issue.
- Preserve perspective nuance: if executives, managers, frontline users, or departments see a topic differently, encode that in perspective_labels and divergence_note instead of flattening it into one claim.
- Do NOT provide final approved action plans, roadmaps, timelines, owners, or mitigation plans. Recommendation-like content must stay clearly labeled as a hypothesis/opportunity with evidence limits.
- If evidence is weak or incomplete, note it in missing_data.
- Material Quality is not a blocking gate. It is an honest assessment of how far the generated insight can be trusted.
- Minimums for a decision-useful readout: ≥3 themes (each ≥50-word description + ≥1 evidence_ref), ≥2 issues (each with severity + ≥1 evidence_ref), ≥2 missing_data entries, executive_summary 60-130 words across ≥3 sentences.
- Aim for 3-7 themes, 2-5 issues, 2-5 opportunities, 1-4 signals (scale with data volume), but never drop below the minimums above.
`;

    const extra = (customPrompt || '').trim();
    if (extra) {
      prompt += `\nAdditional analysis instructions:\n${extra}\n`;
    }

    return prompt;
  }

  /**
   * Parse the AI JSON response, tolerating markdown fences and minor formatting issues.
   */
  private parseV6Response(raw: string): ParsedInsightGenerationData {
    let cleaned = raw.trim();
    // Strip markdown code fences if present
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }
    const parsed = JSON.parse(cleaned);

    const mapCrossSession = <T extends Record<string, any>>(items: T[]): T[] =>
      items.map((item) => {
        const { cross_session_pattern, perspective_labels, divergence_note, ...rest } = item;
        return {
          ...rest,
          ...('cross_session_pattern' in item
            ? { crossSessionPattern: Boolean(cross_session_pattern) }
            : {}),
          ...('perspective_labels' in item
            ? {
                perspective_labels: Array.isArray(perspective_labels)
                  ? perspective_labels.map((entry) => String(entry || '').trim()).filter(Boolean)
                  : [],
              }
            : {}),
          ...('divergence_note' in item
            ? {
                divergence_note: String(divergence_note || '').trim() || undefined,
              }
            : {}),
        } as unknown as T;
      });

    return {
      schema_version: typeof parsed.schema_version === 'string' ? parsed.schema_version : undefined,
      executive_summary: String(parsed.executive_summary || ''),
      themes: Array.isArray(parsed.themes) ? mapCrossSession(parsed.themes) : [],
      issues: Array.isArray(parsed.issues) ? mapCrossSession(parsed.issues) : [],
      opportunities: Array.isArray(parsed.opportunities)
        ? mapCrossSession(parsed.opportunities)
        : [],
      signals: Array.isArray(parsed.signals) ? parsed.signals : [],
      evidence_map: Array.isArray(parsed.evidence_map) ? parsed.evidence_map : [],
      missing_data: Array.isArray(parsed.missing_data) ? parsed.missing_data : [],
      material_quality:
        parsed.material_quality && typeof parsed.material_quality === 'object'
          ? parsed.material_quality
          : undefined,
    };
  }

  /**
   * Build a markdown rendering of the structured V6 data for the legacy `content` column.
   */
  private renderV6ContentAsMarkdown(data: ParsedInsightGenerationData): string {
    const lines: string[] = [];

    lines.push('## Executive Summary', '', data.executive_summary, '');

    if (data.themes.length > 0) {
      lines.push('## Themes', '');
      for (const t of data.themes) {
        lines.push(`### ${t.title} _(${t.strength})_`, '', t.description, '');
        if (Array.isArray(t.perspective_labels) && t.perspective_labels.length > 0) {
          lines.push(`Perspective lenses: ${t.perspective_labels.join(', ')}`, '');
        }
        if (t.divergence_note) {
          lines.push(`Divergence: ${t.divergence_note}`, '');
        }
      }
    }

    if (data.issues.length > 0) {
      lines.push('## Issues', '');
      for (const i of data.issues) {
        lines.push(`### ${i.title} _(severity: ${i.severity})_`, '', i.description, '');
        if (Array.isArray(i.perspective_labels) && i.perspective_labels.length > 0) {
          lines.push(`Perspective lenses: ${i.perspective_labels.join(', ')}`, '');
        }
        if (i.divergence_note) {
          lines.push(`Divergence: ${i.divergence_note}`, '');
        }
      }
    }

    if (data.opportunities.length > 0) {
      lines.push('## Opportunities', '');
      for (const o of data.opportunities) {
        lines.push(`### ${o.title} _(impact: ${o.impact})_`, '', o.description, '');
        if (Array.isArray(o.perspective_labels) && o.perspective_labels.length > 0) {
          lines.push(`Perspective lenses: ${o.perspective_labels.join(', ')}`, '');
        }
        if (o.divergence_note) {
          lines.push(`Divergence: ${o.divergence_note}`, '');
        }
      }
    }

    if (data.signals.length > 0) {
      lines.push('## Signals', '');
      for (const s of data.signals) {
        lines.push(`- **${s.title}** (${s.type}): ${s.description}`);
      }
      lines.push('');
    }

    if (data.missing_data.length > 0) {
      lines.push('## Missing Data', '');
      for (const m of data.missing_data) {
        lines.push(`- ${m}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  private buildMaterialQuality(
    sessionData: any[],
    v6Data: ReturnType<typeof InterviewInsightService.prototype.parseV6Response>
  ): InsightMaterialQuality {
    return buildInsightMaterialQuality(sessionData, v6Data);
  }

  /**
   * H5.5: Detach background insight generation with an error boundary.
   * generateInsight self-handles its own failures (status → 'failed'), but if
   * that failure-path UPDATE itself throws, the promise would reject with NO
   * handler → an unhandledRejection AND the insight stuck at 'generating'
   * forever. This boundary logs with correlation and makes a last-ditch attempt
   * to move the insight to a terminal 'failed' state.
   */
  private detachGeneration(
    promise: Promise<void>,
    insightId: string,
    organizationId: string
  ): void {
    promise.catch(async (err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(
        `[InterviewInsightService] Background generation crashed insight=${insightId} ` +
          `org=${organizationId}: ${message}`
      );
      try {
        const db = await this.getDb();
        await db.run(
          `UPDATE interview_insights
              SET status = 'failed', error_message = ?, updated_at = ?
            WHERE id = ? AND status = 'generating'`,
          [message.slice(0, 500), new Date().toISOString(), insightId]
        );
      } catch (markErr) {
        logger.warn(
          `[InterviewInsightService] failed to mark insight=${insightId} failed after crash: ${
            markErr instanceof Error ? markErr.message : String(markErr)
          }`
        );
      }
    });
  }

  /**
   * Generate insight content using AI (V6 three-layer truth model)
   */
  private async generateInsight(
    insightId: string,
    sessionIds: string[],
    organizationId: string,
    promptType: InsightPromptType,
    customPrompt?: string,
    analysisScope?: InsightAnalysisScope,
    approvedOrgKnowledgePack?: ApprovedOrgKnowledgePack,
    contextDocumentPack?: ContextDocumentPack,
    userId?: string,
    generationPreferences?: InsightGenerationPreferences
  ): Promise<void> {
    const db = await this.getDb();
    const startTime = Date.now();

    // The card title (§A2) lives on the insight row, not in the generated V6
    // payload. Load it so the CARD_CONTENT_FORMULA guardian scores the real
    // headline instead of hard-failing `insight.title_present` on every card.
    let insightTitle = '';
    try {
      const titleRow = await db.get<{ title?: string }>(
        `SELECT title FROM interview_insights WHERE id = ?`,
        [insightId]
      );
      insightTitle = String(titleRow?.title || '').trim();
    } catch {
      /* fail-soft: title stays empty, guardian still advisory */
    }

    try {
      const scope = analysisScope || buildDefaultAnalysisScope({ sessionIds, filters: {} });
      const sessionData = await this.fetchSessionData(sessionIds, organizationId, scope);

      if (sessionData.length === 0) {
        throw new Error('No scoped session data available for analysis');
      }

      const sourceMaterialSummary = buildInsightSourceMaterialSummary({
        requestedSessionIds: sessionIds,
        sessionData,
        analysisScope: scope,
      });
      const orgKnowledgePack =
        approvedOrgKnowledgePack ||
        (await this.buildApprovedOrgKnowledgePack(organizationId, scope.context_mode));
      const formattedData = this.formatSessionDataForPrompt(sessionData);
      const prompt = this.buildV6Prompt(
        promptType,
        formattedData,
        customPrompt,
        sessionData.length,
        scope,
        orgKnowledgePack,
        contextDocumentPack,
        generationPreferences
      );

      const systemPrompt =
        'You are a senior McKinsey-style management consultant analyzing interview data. ' +
        'Build a sharp, decision-useful narrative: capture what people say explicitly AND what they signal between the lines, ' +
        'reconcile where voices agree vs. diverge, and name the dependencies, tensions and risks a sharp partner would notice. ' +
        'Write for a busy executive — plain, specific and light, no jargon padding; lead with the "so what". ' +
        'Return ONLY valid JSON matching the requested schema. ' +
        'Ground every finding strictly in the provided interview data — never invent facts. ' +
        'Do NOT provide final approved action plans, roadmaps, timelines, owners, or mitigation plans. ' +
        'When recommendations are requested, keep them as evidence-bounded hypotheses or opportunities with clear limits.';

      const response = await llmService.generateResponse({
        prompt,
        temperature: 0.3,
        maxTokens: 4000,
        model: 'standard',
        systemPrompt,
      });

      const rawContent = String((response as any)?.content || (response as any)?.text || '');
      const tokensUsed = Number(
        (response as any)?.usage?.totalTokens ||
          (response as any)?.usage?.total_tokens ||
          (response as any)?.usage?.total ||
          0
      );
      const generationTime = Date.now() - startTime;

      // Parse structured V6 response and make evidence refs match scoped answer IDs.
      const parsedV6Data = this.parseV6Response(rawContent);
      const availableAnswerIds = sessionData.flatMap((session) =>
        Array.isArray(session.answers)
          ? session.answers.map((answer: any) => String(answer.id || '').trim()).filter(Boolean)
          : []
      );
      const evidenceRun = validateInsightEvidenceRefs(parsedV6Data, availableAnswerIds);
      let v6Data = evidenceRun.data;
      let evidenceValidation = evidenceRun.result;

      // CARD_CONTENT_FORMULA guardian (OXFORD O7.3) — score the generated insight
      // against docs/standards/CARD_CONTENT_FORMULA.md. ADVISORY: violations trigger
      // ONE auto-repair pass, never a hard block. Failures here must never break
      // generation, so the whole guardian is wrapped and fail-soft.
      let formulaVerdict: FormulaVerdict | undefined;
      try {
        const materialQualityPreview = this.buildMaterialQuality(sessionData, v6Data);
        formulaVerdict = validateInsightCard({
          title: insightTitle,
          executive_summary: v6Data.executive_summary,
          themes: v6Data.themes,
          issues: v6Data.issues,
          opportunities: v6Data.opportunities,
          signals: v6Data.signals,
          evidence_map: v6Data.evidence_map,
          missing_data: v6Data.missing_data,
          material_quality: materialQualityPreview,
        });

        if (!formulaVerdict.pass) {
          logger.warn(
            `[InterviewInsightService] Insight ${insightId} failed CARD_CONTENT_FORMULA ` +
              `(score ${formulaVerdict.score}/100): ${formulaVerdict.violationCodes.join(', ')} — attempting 1 auto-repair pass.`
          );
          try {
            const repairBrief = buildRepairBriefFromVerdict(formulaVerdict);
            // Z60/#57 — append per-type §3 hints so the repair fixes the SPECIFIC
            // weakness (e.g. bare topic title, unmeasured recommendation) rather
            // than regenerating blindly.
            const typeHints = buildInsightRepairHints(formulaVerdict.violationCodes);
            const repairResponse = await llmService.generateResponse({
              prompt: `${repairBrief}${typeHints ? `\n\n${typeHints}` : ''}\n\n--- POPRZEDNIA KARTA (JSON do poprawy) ---\n${JSON.stringify(
                parsedV6Data
              )}\n\nZwróć WYŁĄCZNIE poprawiony obiekt JSON w tym samym kontrakcie pól.`,
              temperature: 0.2,
              maxTokens: 4000,
              model: 'standard',
              systemPrompt,
            });
            const repairedRaw = String(
              (repairResponse as any)?.content || (repairResponse as any)?.text || ''
            );
            const repairedParsed = this.parseV6Response(repairedRaw);
            const repairedRun = validateInsightEvidenceRefs(repairedParsed, availableAnswerIds);
            const repairedVerdict = validateInsightCard({
              title: insightTitle,
              executive_summary: repairedRun.data.executive_summary,
              themes: repairedRun.data.themes,
              issues: repairedRun.data.issues,
              opportunities: repairedRun.data.opportunities,
              signals: repairedRun.data.signals,
              evidence_map: repairedRun.data.evidence_map,
              missing_data: repairedRun.data.missing_data,
              material_quality: this.buildMaterialQuality(sessionData, repairedRun.data),
            });
            // Only accept the repair if it scored strictly better (guards against regressions).
            if (repairedVerdict.score > formulaVerdict.score) {
              v6Data = repairedRun.data;
              evidenceValidation = repairedRun.result;
              logger.info(
                `[InterviewInsightService] Insight ${insightId} auto-repair improved score ` +
                  `${formulaVerdict.score} → ${repairedVerdict.score}.`
              );
              formulaVerdict = repairedVerdict;
            } else {
              logger.warn(
                `[InterviewInsightService] Insight ${insightId} auto-repair did not improve ` +
                  `(${formulaVerdict.score} → ${repairedVerdict.score}); keeping original.`
              );
            }
          } catch (repairErr: any) {
            logger.warn(
              `[InterviewInsightService] Insight ${insightId} auto-repair failed (fail-soft):`,
              repairErr?.message || repairErr
            );
          }
        }
      } catch (formulaErr: any) {
        logger.warn(
          `[InterviewInsightService] CARD_CONTENT_FORMULA validation skipped (fail-soft):`,
          formulaErr?.message || formulaErr
        );
      }

      // Render markdown for the legacy `content` column (backward compat)
      const markdownContent = this.renderV6ContentAsMarkdown(v6Data);
      const materialQuality = this.buildMaterialQuality(sessionData, v6Data);

      // ── O7.1 TWARDA BRAMA (po doradczej auto-naprawie, PRZED zapisem) ─────────
      // Decyzja Piotra: karta poniżej progu formuły NIE powstaje. Ścieżka AI ma już
      // pętlę re-generacji (auto-repair powyżej z feedbackiem naruszeń). Jeśli po
      // niej karta NADAL niesie naruszenie BLOKUJĄCE (brak tytułu/podsumowania/
      // material_quality, placeholder-filler), assertCardMeetsFormula rzuca
      // CardContentGateError — łapie go zewnętrzny catch (poniżej) i oznacza insight
      // jako 'failed' z czytelnym error_message (karta NIE zapisuje się jako
      // completed). FAIL-OPEN gdy walidator sam rzuci (bug) → karta przechodzi.
      // Zawór: CARD_CONTENT_HARD_GATE (default ON).
      assertCardMeetsFormula(
        'insight',
        {
          title: insightTitle,
          executive_summary: v6Data.executive_summary,
          themes: v6Data.themes,
          issues: v6Data.issues,
          opportunities: v6Data.opportunities,
          signals: v6Data.signals,
          evidence_map: v6Data.evidence_map,
          missing_data: v6Data.missing_data,
          material_quality: materialQuality,
        },
        {
          onValidatorError: (validatorErr) =>
            logger.warn(
              `[InterviewInsightService] hard-gate walidator rzucił wyjątek — FAIL-OPEN, insight przechodzi:`,
              (validatorErr as Error)?.message || validatorErr
            ),
        }
      );

      await db.run(
        `UPDATE interview_insights
         SET status = 'completed',
             content = ?,
             executive_summary = ?,
             themes_json = ?,
             issues_json = ?,
             opportunities_json = ?,
             signals_json = ?,
             evidence_map_json = ?,
             missing_data_json = ?,
             material_quality_json = ?,
             generation_context_json = ?,
             tokens_used = ?,
             generation_time_ms = ?,
             updated_at = ?
         WHERE id = ?`,
        [
          markdownContent,
          v6Data.executive_summary,
          JSON.stringify(v6Data.themes),
          JSON.stringify(v6Data.issues),
          JSON.stringify(v6Data.opportunities),
          JSON.stringify(v6Data.signals),
          JSON.stringify(v6Data.evidence_map),
          JSON.stringify(v6Data.missing_data),
          JSON.stringify(materialQuality),
          JSON.stringify(
            this.buildGenerationContext({
              createdAt: new Date(startTime).toISOString(),
              analysisScope: scope,
              generationPreferences,
              approvedOrgKnowledgePack: orgKnowledgePack,
              contextDocumentPack:
                contextDocumentPack ||
                ({
                  requestedIds: [],
                  selectedIds: [],
                  degraded: false,
                  degradedReasons: [],
                  documents: [],
                } as ContextDocumentPack),
              sourceMaterialSummary,
              evidenceValidation,
            })
          ),
          tokensUsed,
          generationTime,
          new Date().toISOString(),
          insightId,
        ]
      );

      await this.recordInsightContextLineage({
        insightId,
        organizationId,
        userId: userId || 'system',
        eventType: 'interview_insight_completed',
        contextDocumentPack:
          contextDocumentPack ||
          ({
            requestedIds: [],
            selectedIds: [],
            degraded: false,
            degradedReasons: [],
            documents: [],
          } as ContextDocumentPack),
        metadata: {
          promptType,
          generationTimeMs: generationTime,
          tokensUsed,
          status: 'completed',
          sourceMaterialSummary,
          evidenceValidation,
        },
      });

      // HP-17 bridge (follow-up, fala 11b) — persist the inline EvidenceContract
      // (`buildInterviewInsightEvidenceContract`) as an EvidenceEnvelope
      // (`artifact_evidence`, artifactType='insight') so the evidence panel (fala 9,
      // ArtifactRightPanel) has something to render. Previously: the V6 insight had
      // its own evidence validation (`validateInsightEvidenceRefs`) but no HP-14/HP-16
      // EvidenceContract was ever computed or persisted for it — panel showed empty
      // state for insights despite the engine having real evidence_map/themes/issues/
      // opportunities data (same gap as deck/canvas/document, closed in fala 11a, and
      // initiative, closed alongside this change). Fire-and-forget + fail-safe: a
      // write failure NEVER blocks insight generation.
      void safePersistEvidenceContract(
        buildInterviewInsightEvidenceContract(v6Data, materialQuality),
        {
          organizationId,
          artifactType: 'insight',
          artifactId: insightId,
          service: 'InterviewInsightService',
          createdBy: userId ?? null,
        }
      ).catch(() => {});

      logger.info(
        `[InterviewInsightService] Generated V6 insight ${insightId} in ${generationTime}ms ` +
          `(${v6Data.themes.length} themes, ${v6Data.issues.length} issues, ${v6Data.opportunities.length} opportunities)`
      );
    } catch (error) {
      const err = error as Error;
      logger.error(`[InterviewInsightService] Failed to generate insight ${insightId}:`, err);

      await db.run(
        `UPDATE interview_insights
         SET status = 'failed', error_message = ?, updated_at = ?
         WHERE id = ?`,
        [err.message, new Date().toISOString(), insightId]
      );
    }
  }

  /**
   * Fetch interview session data with answers
   */
  private async loadEligibleSessionIds(
    organizationId: string,
    sessionIds: string[]
  ): Promise<Set<string>> {
    const db = await this.getDb();
    const placeholders = sessionIds.map(() => '?').join(',');
    if (!placeholders) return new Set();

    const sessions = await db.all<any>(
      `SELECT s.id
       FROM interview_sessions s
       LEFT JOIN interview_assignments a ON a.id = s.assignment_id AND a.organization_id = ?
       LEFT JOIN projects p ON p.id = s.project_id
       WHERE s.id IN (${placeholders})
         AND (
           p.organization_id = ?
           OR (s.project_id IS NULL AND s.organization_id = ?)
         )
         AND s.status = 'completed'
         AND (s.assignment_id IS NULL OR a.status IN ('approved', 'completed'))`,
      [organizationId, ...sessionIds, organizationId, organizationId]
    );

    return new Set((sessions || []).map((session) => String(session.id)));
  }

  private async fetchSessionData(
    sessionIds: string[],
    organizationId: string,
    analysisScope?: InsightAnalysisScope
  ): Promise<any[]> {
    const db = await this.getDb();
    if (sessionIds.length === 0) return [];

    // D18-A — defensive self-heal: `is_anonymous` is added by every session
    // creation path (InterviewController.createSessionFromTemplate), but a
    // process that generates an insight before any session has been created
    // since deploy could still hit an environment where the column is
    // missing (migration 922 not yet applied). Guard the SELECT below.
    const sessionCols = await getTableColumns('interview_sessions');
    if (!sessionCols.has('is_anonymous')) {
      try {
        await db.query(
          `ALTER TABLE interview_sessions ADD COLUMN is_anonymous BOOLEAN DEFAULT FALSE`
        );
      } catch (err: any) {
        const m = String(err?.message || err).toLowerCase();
        if (!m.includes('already exists') && !m.includes('duplicate column')) {
          logger.warn('[InterviewInsightService] Failed to add is_anonymous column', err);
        }
      }
    }

    const placeholders = sessionIds.map(() => '?').join(',');
    const scopeWhere = buildInsightScopeSessionWhereClause(analysisScope);
    const userProfileCols = await getTableColumns('user_profile_extended');
    const hasUserProfileDepartment =
      userProfileCols.has('user_id') && userProfileCols.has('department');

    const sessions = await db.all<any>(
      `SELECT
        s.id, s.name, s.status, s.completed_at, s.owner_id, s.is_anonymous,
        s.answered_questions, s.total_questions,
        t.name as template_name, t.category as template_category,
        u.job_title, ${hasUserProfileDepartment ? 'upe.department' : 'NULL AS department'},
        COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '') as respondent_name
       FROM interview_sessions s
       LEFT JOIN interview_assignments a ON a.id = s.assignment_id AND a.organization_id = ?
       LEFT JOIN projects p ON p.id = s.project_id
       LEFT JOIN interview_library_templates t ON t.id = s.template_id
       LEFT JOIN users u ON u.id = s.owner_id
       ${hasUserProfileDepartment ? 'LEFT JOIN user_profile_extended upe ON upe.user_id = u.id' : ''}
       WHERE s.id IN (${placeholders})
         AND (
           p.organization_id = ?
           OR (s.project_id IS NULL AND s.organization_id = ?)
         )
         AND s.status = 'completed'
         AND (s.assignment_id IS NULL OR a.status IN ('approved', 'completed'))
         ${scopeWhere.whereSql}`,
      [organizationId, ...sessionIds, organizationId, organizationId, ...scopeWhere.params]
    );

    // Fetch answers for each session
    const sessionDataPromises = (sessions || []).map(async (session: any) => {
      const answers = await db.all<any>(
        `SELECT
          q.id,
          q.question_text,
          q.category,
          q.answer_text,
          q.status,
          q.confidence_score
         FROM interview_questions q
         WHERE q.session_id = ?
           AND q.status = 'answered'
         ORDER BY q.sort_order`,
        [session.id]
      );

      return {
        ...session,
        answers: answers || [],
      };
    });

    const sessionData = await Promise.all(sessionDataPromises);

    // #47b — attach Link/Artifact evidence (interview_evidence, + a KB excerpt
    // when ingested) to each answer so the insight prompt sees more than
    // `answer_text`. Fail-open: any error here must never break insight
    // generation — evidence is a prompt enrichment, not a hard dependency.
    try {
      const allQuestionIds = sessionData.flatMap((session: any) =>
        (session.answers || []).map((a: any) => String(a.id))
      );
      const evidenceByQuestionId = await this.fetchEvidenceForQuestionIds(
        allQuestionIds,
        organizationId
      );
      if (evidenceByQuestionId.size > 0) {
        for (const session of sessionData) {
          for (const answer of session.answers || []) {
            const evidence = evidenceByQuestionId.get(String(answer.id));
            if (evidence && evidence.length > 0) answer.evidence = evidence;
          }
        }
      }
    } catch (err) {
      logger.warn(
        `[InterviewInsightService] Evidence attach skipped (fail-open): ${String((err as Error)?.message || err)}`
      );
    }

    return sessionData;
  }

  /**
   * #47b — fetch attached evidence (Link/Artifact, `interview_evidence`) for a
   * batch of question ids, plus a short KB excerpt when the evidence was
   * ingested into the knowledge base (`knowledge_document_id` set →
   * `ai_knowledge_embeddings`, first chunk only). Returns question_id →
   * evidence[] (capped per question). Fail-open: any failure returns an empty
   * map rather than throwing, so a KB/schema hiccup never blocks insight
   * generation — the prompt just falls back to `answer_text` alone (today's
   * behavior).
   */
  private async fetchEvidenceForQuestionIds(
    questionIds: string[],
    organizationId: string
  ): Promise<Map<string, Array<{ title: string; url: string | null; snippet: string }>>> {
    const EVIDENCE_PER_QUESTION = 3;
    const SNIPPET_MAX_CHARS = 500;
    const result = new Map<string, Array<{ title: string; url: string | null; snippet: string }>>();

    const ids = Array.from(new Set(questionIds.filter(Boolean)));
    if (ids.length === 0) return result;

    try {
      const db = await this.getDb();
      const placeholders = ids.map(() => '?').join(',');
      const rows = await db.all<any>(
        `SELECT id, question_id, title, description, url, file_name,
                evidence_type, transcript_text, knowledge_document_id, created_at
           FROM interview_evidence
          WHERE organization_id = ?
            AND question_id IN (${placeholders})
          ORDER BY created_at ASC`,
        [organizationId, ...ids]
      );
      if (!rows || rows.length === 0) return result;

      // Batch-resolve a first-chunk KB excerpt per distinct knowledge_document_id
      // (best-effort — sqlite/postgres store the chunk text under different
      // column names, see embeddingService.storeChunk).
      const docIds = Array.from(
        new Set(
          rows
            .map((r: any) => r.knowledge_document_id)
            .filter(Boolean)
            .map(String)
        )
      );
      const excerptByDocId = new Map<string, string>();
      if (docIds.length > 0) {
        try {
          const isPg = process.env.DB_TYPE === 'postgres';
          const contentCol = isPg ? 'chunk_text' : 'content';
          const docPlaceholders = docIds.map(() => '?').join(',');
          const chunkRows = await db.all<any>(
            `SELECT document_id, chunk_index, ${contentCol} as content
               FROM ai_knowledge_embeddings
              WHERE document_id IN (${docPlaceholders})
              ORDER BY document_id ASC, chunk_index ASC`,
            docIds
          );
          for (const chunk of chunkRows || []) {
            const docId = String(chunk.document_id);
            if (excerptByDocId.has(docId)) continue; // keep the first chunk only
            const text = String(chunk.content || '').trim();
            if (text) excerptByDocId.set(docId, text);
          }
        } catch (err) {
          logger.warn(
            `[InterviewInsightService] Evidence KB excerpt lookup skipped: ${String((err as Error)?.message || err)}`
          );
        }
      }

      for (const row of rows) {
        const questionId = String(row.question_id || '');
        if (!questionId) continue;
        const list = result.get(questionId) || [];
        if (list.length >= EVIDENCE_PER_QUESTION) continue;

        const kbExcerpt = row.knowledge_document_id
          ? excerptByDocId.get(String(row.knowledge_document_id))
          : undefined;
        const rawSnippet = kbExcerpt || row.transcript_text || row.description || '';
        const snippet = String(rawSnippet).trim().slice(0, SNIPPET_MAX_CHARS);

        list.push({
          title: String(row.title || row.file_name || 'Evidence').trim(),
          url: row.url ? String(row.url) : null,
          snippet,
        });
        result.set(questionId, list);
      }
    } catch (err) {
      logger.warn(
        `[InterviewInsightService] Evidence fetch skipped (fail-open): ${String((err as Error)?.message || err)}`
      );
    }

    return result;
  }

  /**
   * #47b — render an answer's attached evidence as a compact "Evidence:"
   * block (title + optional URL + KB/description snippet). Returns '' when
   * there's no evidence so callers can splice it in without extra blank lines.
   */
  private formatEvidenceBlock(
    evidence?: Array<{ title: string; url: string | null; snippet: string }>
  ): string {
    if (!evidence || evidence.length === 0) return '';
    const lines = evidence.map((item, index) => {
      const link = item.url ? ` (${item.url})` : '';
      const snippet = item.snippet ? `: ${item.snippet}` : '';
      return `  ${index + 1}. ${item.title}${link}${snippet}`;
    });
    return `Evidence:\n${lines.join('\n')}`;
  }

  /**
   * Format session data for the AI prompt
   */
  private formatSessionDataForPrompt(sessionData: any[]): string {
    return sessionData
      .map((session, index) => {
        const answerText = session.answers
          .map((a: any) => {
            const base = `[answer_id: ${a.id}] Q: ${a.question_text}\nA: ${a.answer_text || 'No answer'}${
              a.status ? ` (status: ${a.status})` : ''
            }${a.confidence_score ? ` (confidence: ${a.confidence_score}/5)` : ''}`;
            // #47b — Link/Artifact evidence attached to this question, if any.
            const evidenceBlock = this.formatEvidenceBlock(a.evidence);
            return evidenceBlock ? `${base}\n${evidenceBlock}` : base;
          })
          .join('\n\n');

        // D18-A hard wall — an anonymous session's respondent/role/department
        // labels are never handed to the LLM. The prompt already instructs
        // the model to cite "which sessions support it (by respondent name or
        // session name)" — for anonymous sessions there is no name to give it,
        // so it can only ever cite "Anonymous respondent" / the session index.
        const isAnonymous = flagOn(session.is_anonymous);
        const respondentLabel = isAnonymous
          ? 'Anonymous respondent'
          : session.respondent_name || 'Anonymous';
        const roleLabel = isAnonymous ? 'Withheld (anonymous)' : session.job_title || 'Unknown';
        const departmentLabel = isAnonymous
          ? 'Withheld (anonymous)'
          : session.department || 'Unknown';

        return `
--- Interview ${index + 1} ---
Template: ${session.template_name || 'Unknown'}
Category: ${session.template_category || 'General'}
Respondent: ${respondentLabel}
Role: ${roleLabel}
Department: ${departmentLabel}
Date: ${session.completed_at || 'Unknown'}

${answerText}
`;
      })
      .join('\n\n');
  }

  // ==========================================
  // MAPPING
  // ==========================================

  private mapRowToInsight(row: any): Insight {
    // Support mixed/legacy schemas:
    // - Legacy table (from migration 295) uses `description` + `insight_type`
    // - AI/V2 schema uses `content` + `prompt_type`
    const promptType = (row.prompt_type || row.insight_type || 'summary') as InsightPromptType;
    const content = row.content || row.description || undefined;
    const sourceSessionIdsRaw = row.source_session_ids;
    const sourceSessionIds = (() => {
      try {
        if (typeof sourceSessionIdsRaw === 'string' && sourceSessionIdsRaw.trim().length > 0) {
          const parsed = JSON.parse(sourceSessionIdsRaw);
          if (Array.isArray(parsed)) return parsed.map(String);
        }
      } catch {
        /* ignore */
      }
      // Legacy fallback: a single session_id if present
      if (row.session_id) return [String(row.session_id)];
      return [];
    })();

    const topicFocus = safeJsonArray<string>(row.topic_focus_json) || [];
    const analysisScope = buildDefaultAnalysisScope({
      sessionIds: sourceSessionIds,
      filters: row.filters ? safeJsonObject<Record<string, any>>(row.filters, {}) : undefined,
      analysisScope: safeJsonObject<Partial<InsightAnalysisScope>>(row.analysis_scope_json, {}),
      analysisMode: row.analysis_mode || row.prompt_type,
      contextMode: row.context_mode,
      topicFocus,
      consultantNote: undefined,
      leadingQuestion: undefined,
    });

    return {
      id: row.id,
      organizationId: row.organization_id,
      title: row.title,
      promptType,
      sourceSessionIds,
      filters: row.filters
        ? (() => {
            try {
              return JSON.parse(row.filters);
            } catch {
              return undefined;
            }
          })()
        : undefined,
      content,
      executiveSummary: row.executive_summary || undefined,
      themes: safeJsonArray<InsightTheme>(row.themes_json),
      issues: safeJsonArray<InsightIssue>(row.issues_json),
      opportunities: safeJsonArray<InsightOpportunity>(row.opportunities_json),
      signals: safeJsonArray<InsightSignal>(row.signals_json),
      evidenceMap: safeJsonArray<InsightEvidenceMapEntry>(row.evidence_map_json),
      missingData: safeJsonArray<string>(row.missing_data_json),
      analysisScope,
      materialQuality:
        Object.keys(safeJsonObject<Partial<InsightMaterialQuality>>(row.material_quality_json, {}))
          .length > 0
          ? (safeJsonObject<InsightMaterialQuality>(
              row.material_quality_json,
              {} as InsightMaterialQuality
            ) as InsightMaterialQuality)
          : null,
      contextMode: analysisScope.context_mode,
      analysisMode: analysisScope.analysis_mode,
      topicFocus: analysisScope.topic_focus,
      generationContext: safeJsonObject<Record<string, any>>(row.generation_context_json, {}),
      status: row.status as InsightStatus,
      reviewStatus:
        row.status === 'in_review' || row.status === 'published'
          ? (row.status as 'in_review' | 'published')
          : 'draft',
      publishedAt: row.published_at || undefined,
      reviewedBy: row.reviewed_by || undefined,
      errorMessage: row.error_message || undefined,
      sourceSessionCount:
        typeof row.source_session_count === 'number'
          ? row.source_session_count
          : sourceSessionIds.length,
      tokensUsed: Number(row.tokens_used || 0),
      generationTimeMs: row.generation_time_ms ? Number(row.generation_time_ms) : undefined,
      exportedToTools: flagOn(row.exported_to_tools),
      exportedToAssessment: flagOn(row.exported_to_assessment),
      archivedAt: row.archived_at || null,
      sectionCompletions: row.section_completions
        ? safeJsonObject<Record<string, boolean>>(row.section_completions, {})
        : null,
      // Kolumna `section_overrides` jest ADDYTYWNA i może jeszcze nie istnieć
      // (migracja 931 nieuruchomiona) — `SELECT *` po prostu jej nie zwróci,
      // więc `row.section_overrides` będzie `undefined` ⇒ `null`. Zero rzutów.
      sectionOverrides: row.section_overrides
        ? safeJsonObject<Record<string, InsightSectionOverride>>(row.section_overrides, {})
        : null,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

// Export singleton
const interviewInsightService = new InterviewInsightService();
export default interviewInsightService;

// Named exports
export const create = (input: CreateInsightInput) => interviewInsightService.create(input);
export const getById = (id: string) => interviewInsightService.getById(id);
export const list = (
  organizationId: string,
  options?: { limit?: number; offset?: number; scope?: 'active' | 'archived' | 'all' }
) => interviewInsightService.list(organizationId, options);
export const listContextLineage = (organizationId: string, insightId: string) =>
  interviewInsightService.listContextLineage(organizationId, insightId);
export const regenerate = (id: string) => interviewInsightService.regenerate(id);
export const deleteInsight = (id: string) => interviewInsightService.delete(id);
