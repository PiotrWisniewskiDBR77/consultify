/**
 * insightMaterializationService — shared pipeline steps [3]-[5] ("Zbierz wnioski").
 *
 * SSOT: `Harvard/wdrozenie-100/_KONCEPT_CONTENT_ENGINES_2026-07-10.md` §5 (PIPELINE
 * RUNTIME→OUTCOME) + §8 (F14 parasol jakości). Faza 1 — KONTRAKT.
 *
 * Today this distill→validate→repair logic lives ONLY inline in
 * `InterviewInsightService.generateInsight` (see the CARD_CONTENT_FORMULA
 * guardian block, OXFORD O7.3). §5 explicitly says: "rozszerzyć wywołania, nie
 * kopiować" — this module is that shared core, generalized so ANY raw
 * tool/assessment result (not just interview sessions) can go through the same
 * three steps:
 *
 *   [3] SYNTEZA   — LLM distills a raw result (a list of "source items" —
 *                    interview answers, tool wizard fields, assessment
 *                    positions) into ONE Insight-card candidate. Every claim
 *                    carries evidence_refs pointing back to real item ids
 *                    (answer-first, lineage — never invented ids).
 *   [4] BRAMKA F14 — cardContentFormulaValidator (validateInsightCard) scores
 *                    the candidate against docs/standards/CARD_CONTENT_FORMULA.md.
 *                    FAIL → ONE auto-repair pass (same pattern as
 *                    InterviewInsightService) → keep repair only if it scored
 *                    strictly better.
 *   [5] OUTCOME    — return the candidate + verdict to the CALLER. This
 *                    function NEVER persists anything: materialization is
 *                    "jawna i odwracalna" (§5) — the user must see candidates
 *                    before any Insight row is created. Persistence/creation
 *                    is the caller's job.
 *
 * DOWNSTREAM SEEDS (§6, #57/Z60) — "karta Insight = waluta wymiany": every
 * issue/opportunity the distillation produces can ALSO carry a small seed
 * toward its eventual initiative — `{suggestedOwnerRole, horizon, baseline,
 * target, metric}` — so `initiativeGenerationService` INHERITS a starting
 * owner-role and baseline→target instead of guessing one from scratch when it
 * fills the KPI/control cards. Every seed field is OPTIONAL and defaults to
 * `null`: the LLM fills it ONLY when the source items actually ground it,
 * never invents one to satisfy the shape (`normalizeSeedValue` also treats
 * placeholder text like "do ustalenia"/"TBD"/"N/A" as absent — same
 * fail-soft posture as the rest of this module). `deriveInitiativeSeedContext`
 * below is the bridge helper: it collects the seeds off a materialized
 * candidate into the two `GenerationContext` fields
 * (`seedOwnerRole`/`seedKpiSeeds`) that `initiativeGenerationService`'s
 * `buildGroundingBlock` already knows how to surface to the LLM.
 *
 * DESIGN CONTRACT:
 *   - ADVISORY / fail-soft, always. A bad LLM response, a parse failure, or an
 *     unexpected error never throws — it returns `degraded: true` with a
 *     `degradedReason` and an empty candidate list. Callers can safely await
 *     this without a try/catch of their own (though wrapping is still fine).
 *   - Additive: does not touch any existing table, route, or UI. Nothing calls
 *     this automatically yet — see `assessmentInitiativeService.ts`
 *     (`collectInsightCandidatesFromAssessment`) for the one reference wiring.
 *   - `deps.generate` is injectable so tests never need a real LLM call or to
 *     mock the `ai` SDK; the default wraps `llmService.generateResponse`.
 */

import logger from '../utils/Logger.js';
import { llmService } from './ai/llmService.js';
import {
  buildRepairBriefFromVerdict,
  type FormulaVerdict,
  type InsightCardData,
  validateInsightCard,
} from './cardContentFormulaValidator.js';
import {
  deriveConfidence,
  emptyEvidenceContract,
  type EvidenceContract,
  type EvidenceContractSource,
} from './evidence/evidenceContract.js';

const LOG = '[insightMaterializationService]';

// ────────────────────────────────────────────────────────────────────────────
// Public types
// ────────────────────────────────────────────────────────────────────────────

/** Catalog A (Tools) / Catalog B (Assessment) / legacy interview path — §4. */
export type MaterializationSourceType = 'interview' | 'assessment' | 'tool';

/**
 * One addressable "position" inside a raw tool/assessment result — the unit
 * evidence_refs point at. Mirrors an interview answer (`[answer_id: ...]`) but
 * generalized: for Tools this is a wizard field/framework cell, for Assessment
 * a question×area position, for a future caller anything with a stable id.
 */
export interface MaterializationSourceItem {
  /** Stable id inside THIS raw result — evidence_refs must match one of these. */
  id: string;
  /** Optional short label (question text, field name, framework cell name). */
  label?: string;
  /** The actual content the LLM should ground findings in. */
  text: string;
}

export interface MaterializationInput {
  sourceType: MaterializationSourceType;
  /** id of the tool run / assessment / interview-session-group this came from. */
  sourceId: string;
  organizationId: string;
  /** Human-readable context (tool name, assessment type + name, …). */
  title?: string;
  /** Raw result "positions" — step [2] output. Empty → immediate degraded outcome. */
  items: MaterializationSourceItem[];
  /** Optional extra guidance appended to the distillation prompt. */
  customInstructions?: string;
}

export interface InsightCandidateMaterialQuality {
  /** 0-100 — matches CARD_CONTENT_FORMULA's `material_quality.score` contract. */
  score: number;
  answer_quality_posture: 'strong' | 'usable' | 'thin' | 'poor';
  coverage_posture: 'single_source' | 'partial_coverage' | 'good_coverage';
  missing_voices: string[];
  limitations: string[];
  recommended_followups: string[];
}

export interface InsightCandidateTheme {
  title: string;
  description: string;
  evidence_refs: string[];
  strength?: 'weak' | 'moderate' | 'strong';
}

/**
 * §6 downstream seed (#57/Z60) — the "zalążek" toward an eventual initiative.
 * Every field is null unless the source items actually grounded it; NEVER a
 * guess. Attached to issues/opportunities (not themes — themes describe
 * patterns, issues/opportunities are the actionable units an initiative gets
 * born from).
 */
export interface InsightSeedFields {
  /** Suggested owner ROLE (not a person name), e.g. "Head of Operations". */
  suggestedOwnerRole?: string | null;
  /** Realization horizon, e.g. "6 miesięcy" / "Q3 2026". */
  horizon?: string | null;
  /** Numeric-with-unit starting point, e.g. "~40h/mies.". */
  baseline?: string | null;
  /** Numeric-with-unit target, e.g. "10h/mies.". */
  target?: string | null;
  /** What is being measured, e.g. "czas cyklu zatwierdzania zapytań". */
  metric?: string | null;
}

export interface InsightCandidateIssue extends InsightSeedFields {
  title: string;
  description: string;
  severity?: string;
  evidence_refs: string[];
}

export interface InsightCandidateOpportunity extends InsightSeedFields {
  title: string;
  description: string;
  evidence_refs: string[];
}

export interface InsightCandidateEvidenceMapEntry {
  item_id: string;
  answer_snippet: string;
}

/** The card-shaped distillation output — feeds validateInsightCard() directly. */
export interface InsightCandidate {
  title: string;
  executive_summary: string;
  themes: InsightCandidateTheme[];
  issues: InsightCandidateIssue[];
  opportunities: InsightCandidateOpportunity[];
  signals: unknown[];
  evidence_map: InsightCandidateEvidenceMapEntry[];
  missing_data: string[];
  material_quality: InsightCandidateMaterialQuality;
}

export interface MaterializationOutcome {
  /** Always 0 or 1 today (single-candidate distillation); array for future multi-candidate. */
  candidates: InsightCandidate[];
  /** Present only when a candidate was produced (undefined when degraded). */
  verdict?: FormulaVerdict;
  /** True when the auto-repair pass ran AND improved the score. */
  repaired: boolean;
  tokensUsed: number;
  generationTimeMs: number;
  /** True when no usable candidate could be produced (fail-soft path). */
  degraded: boolean;
  degradedReason?: string;
  /**
   * HP-14 Evidence Contract — warstwa dowodowa candidate'a (źródła/założenia/ryzyka/pewność/
   * do-weryfikacji). Wyprowadzana DETERMINISTYCZNIE z evidence_map + material_quality (zero LLM).
   * Zawsze obecna: degraded → pusty kontrakt (confidence 'low').
   */
  evidence: EvidenceContract;
}

export interface GenerateResponseLike {
  content?: string;
  text?: string;
  usage?: { totalTokens?: number; total_tokens?: number; total?: number };
}

export interface GenerateArgs {
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

export type GenerateFn = (args: GenerateArgs) => Promise<GenerateResponseLike>;

export interface MaterializationDeps {
  generate: GenerateFn;
}

// ────────────────────────────────────────────────────────────────────────────
// Default deps — real LLM call via the shared llmService.
// ────────────────────────────────────────────────────────────────────────────

const defaultDeps: MaterializationDeps = {
  generate: async (args) => {
    const response = await llmService.generateResponse({
      prompt: args.prompt,
      systemPrompt: args.systemPrompt,
      temperature: args.temperature ?? 0.3,
      maxTokens: args.maxTokens ?? 3000,
      model: 'standard',
    });
    return response as GenerateResponseLike;
  },
};

const SYSTEM_PROMPT =
  'You are a senior McKinsey-style management consultant distilling a raw tool or assessment ' +
  'result into ONE insight-card candidate. Ground every finding strictly in the provided source ' +
  'items — never invent facts or ids. Write for a busy executive: plain, specific, lead with the ' +
  '"so what". Return ONLY valid JSON matching the requested schema, in Polish.';

// ────────────────────────────────────────────────────────────────────────────
// Pure helpers — unit-testable without any LLM call.
// ────────────────────────────────────────────────────────────────────────────

const CANDIDATE_SCHEMA_HINT = `{
  "title": string (action-title, tytuł-akcja, max 14 słów),
  "executive_summary": string (60-130 słów, answer-first: teza + so-what + poziom pewności),
  "themes": [{ "title": string, "description": string (min 50 słów), "evidence_refs": [item_id, ...], "strength": "weak"|"moderate"|"strong" }],
  "issues": [{ "title": string, "description": string, "severity": "low"|"medium"|"high"|"critical", "evidence_refs": [item_id, ...], "suggestedOwnerRole": string|null, "metric": string|null, "baseline": string|null, "target": string|null, "horizon": string|null }],
  "opportunities": [{ "title": string, "description": string, "evidence_refs": [item_id, ...], "suggestedOwnerRole": string|null, "metric": string|null, "baseline": string|null, "target": string|null, "horizon": string|null }],
  "signals": [],
  "evidence_map": [{ "item_id": string, "answer_snippet": string (max 120 znaków) }],
  "missing_data": [string, ...] (min 2 realne luki danych)
}`;

const SEED_FIELDS_INSTRUCTIONS =
  'Dla KAŻDEGO issue i opportunity spróbuj dodatkowo wypełnić zalążek pod przyszłą inicjatywę: ' +
  '"suggestedOwnerRole" (rola-właściciel, NIE nazwisko), "metric" (co mierzymy), "baseline" (punkt ' +
  'startowy z jednostką), "target" (cel z jednostką), "horizon" (horyzont realizacji). WYPEŁNIAJ TE ' +
  'POLA WYŁĄCZNIE gdy materiał źródłowy je faktycznie sugeruje — w przeciwnym razie zostaw `null`. ' +
  'ZAKAZ zgadywania/wymyślania tych pól "na wszelki wypadek" i zakaz placeholderów typu "do ustalenia"/"TBD".';

/** Pure prompt builder — step [3] "Zbierz wnioski". */
export function buildDistillationPrompt(input: MaterializationInput): string {
  const itemsBlock = input.items
    .map((item) => `[item_id: ${item.id}]${item.label ? ` (${item.label})` : ''}\n${item.text}`)
    .join('\n\n');

  return (
    `Źródło: ${input.sourceType} — ${input.title || input.sourceId}\n` +
    (input.customInstructions ? `Dodatkowe instrukcje: ${input.customInstructions}\n` : '') +
    `\nPoniżej surowy wynik narzędzia/assessmentu, podzielony na pozycje z ID. Zdestyluj go w JEDNĄ ` +
    `kandydacką kartę Insight wg poniższego kontraktu JSON. Każdy evidence_ref MUSI być jednym z ` +
    `pokazanych item_id — zakaz wymyślania ID. Zwróć WYŁĄCZNIE obiekt JSON, bez komentarzy.\n\n` +
    `${SEED_FIELDS_INSTRUCTIONS}\n\n` +
    `KONTRAKT:\n${CANDIDATE_SCHEMA_HINT}\n\n--- POZYCJE WYNIKU ---\n${itemsBlock}`
  );
}

/**
 * Tolerant JSON extraction from a raw LLM response (handles markdown fences and
 * stray prose around the JSON object). Never throws — returns `{}` on failure.
 */
export function parseDistillationResponse(raw: string): Partial<InsightCandidate> {
  const text = String(raw || '').trim();
  if (!text) return {};

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidateText = fenced ? fenced[1] : text;
  const firstBrace = candidateText.indexOf('{');
  const lastBrace = candidateText.lastIndexOf('}');
  const jsonSlice =
    firstBrace >= 0 && lastBrace > firstBrace
      ? candidateText.slice(firstBrace, lastBrace + 1)
      : candidateText;

  try {
    const parsed = JSON.parse(jsonSlice);
    return parsed && typeof parsed === 'object' ? (parsed as Partial<InsightCandidate>) : {};
  } catch (err) {
    logger.warn(
      `${LOG} failed to parse distillation JSON (fail-soft): ${err instanceof Error ? err.message : String(err)}`
    );
    return {};
  }
}

function arrayWithEvidenceRefs<T extends { evidence_refs?: unknown }>(
  value: unknown,
  validIds: Set<string>
): T[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => {
    if (entry && typeof entry === 'object') {
      const rawRefs = (entry as Record<string, unknown>).evidence_refs;
      const refs = Array.isArray(rawRefs)
        ? rawRefs.map((r) => String(r)).filter((r) => validIds.has(r))
        : [];
      return { ...(entry as object), evidence_refs: refs } as T;
    }
    return entry as T;
  });
}

const SEED_FIELD_KEYS = ['suggestedOwnerRole', 'metric', 'baseline', 'target', 'horizon'] as const;

/** Placeholder text the LLM sometimes writes instead of a real `null` — treat as absent. */
const SEED_PLACEHOLDER_RE = /^(null|n\/?a|brak|do ustalenia|do okre[śs]lenia|tbd|unknown|-)$/i;

/**
 * Normalizes ONE raw seed value: a non-empty, non-placeholder string (trimmed,
 * capped) survives; anything else (missing, empty, non-string, placeholder
 * text) becomes `null` — never guessed, never fabricated.
 */
export function normalizeSeedValue(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || SEED_PLACEHOLDER_RE.test(trimmed)) return null;
  return trimmed.slice(0, 200);
}

/**
 * Stamps the 5 downstream-seed fields (§6, #57/Z60) onto ONE issue/opportunity
 * entry, normalizing each to a real value or explicit `null`. Non-object
 * entries pass through untouched (mirrors `arrayWithEvidenceRefs`'s guard).
 */
export function withSeedFields<T>(entry: T): T & InsightSeedFields {
  if (!entry || typeof entry !== 'object') return entry as T & InsightSeedFields;
  const raw = entry as Record<string, unknown>;
  const seeds = {} as InsightSeedFields;
  for (const key of SEED_FIELD_KEYS) {
    seeds[key] = normalizeSeedValue(raw[key]);
  }
  return { ...(entry as object), ...seeds } as T & InsightSeedFields;
}

/**
 * Lineage guard (§5 "lineage obowiązkowy"): strips any evidence_ref/item_id
 * that does not match a real source item — never lets the model fabricate
 * provenance. Tolerant of missing/malformed arrays.
 */
export function reconcileEvidenceRefs(
  candidate: Partial<InsightCandidate>,
  validIds: Set<string>
): Partial<InsightCandidate> {
  const evidenceMap = Array.isArray(candidate.evidence_map)
    ? candidate.evidence_map
        .filter((e) => e && typeof e === 'object' && validIds.has(String((e as any).item_id)))
        .map((e) => ({
          item_id: String((e as any).item_id),
          answer_snippet: String((e as any).answer_snippet ?? '').slice(0, 120),
        }))
    : [];

  return {
    ...candidate,
    themes: arrayWithEvidenceRefs<InsightCandidateTheme>(candidate.themes, validIds),
    // §6 (#57/Z60): issues/opportunities also carry the downstream-seed fields
    // (suggestedOwnerRole/metric/baseline/target/horizon), normalized to a real
    // value or explicit `null` — never left as an unvalidated LLM guess.
    issues: arrayWithEvidenceRefs<InsightCandidateIssue>(candidate.issues, validIds).map(
      withSeedFields
    ),
    opportunities: arrayWithEvidenceRefs<InsightCandidateOpportunity>(
      candidate.opportunities,
      validIds
    ).map(withSeedFields),
    evidence_map: evidenceMap,
  };
}

/**
 * Generic material-quality builder (step [4] input) — deliberately simpler
 * than InterviewInsightService's session/respondent-aware version (there is no
 * notion of "respondent"/"department" for a Tools or Assessment raw result).
 * Keys match `cardContentFormulaValidator`'s MATERIAL_QUALITY_REQUIRED
 * literally (`score`, `limitations`, `missing_voices`, `recommended_followups`).
 */
export function buildGenericMaterialQuality(
  items: MaterializationSourceItem[],
  candidate: Partial<InsightCandidate>
): InsightCandidateMaterialQuality {
  const themes = Array.isArray(candidate.themes) ? candidate.themes : [];
  const issues = Array.isArray(candidate.issues) ? candidate.issues : [];
  const opportunities = Array.isArray(candidate.opportunities) ? candidate.opportunities : [];
  const allClaims = [...themes, ...issues, ...opportunities] as Array<{ evidence_refs?: unknown }>;

  const withEvidence = allClaims.filter(
    (c) => Array.isArray(c?.evidence_refs) && (c.evidence_refs as unknown[]).length > 0
  ).length;
  const evidenceGapCount = Math.max(0, allClaims.length - withEvidence);

  // More raw positions = richer material to ground claims in; caps at 8 (parity
  // with InterviewInsightService's session-count cap logic, just item-based).
  const coverageRatio = items.length > 0 ? Math.min(1, items.length / 8) : 0;
  const score = Math.max(
    0,
    Math.min(100, Math.round(coverageRatio * 40 + withEvidence * 12 - evidenceGapCount * 8))
  );

  const answerQualityPosture: InsightCandidateMaterialQuality['answer_quality_posture'] =
    score >= 80 ? 'strong' : score >= 60 ? 'usable' : score >= 40 ? 'thin' : 'poor';
  const coveragePosture: InsightCandidateMaterialQuality['coverage_posture'] =
    items.length <= 1 ? 'single_source' : items.length >= 5 ? 'good_coverage' : 'partial_coverage';

  const limitations: string[] = [];
  if (evidenceGapCount > 0) {
    limitations.push(`${evidenceGapCount} twierdzeń bez evidence_ref do pozycji wyniku.`);
  }
  if (items.length <= 2) {
    limitations.push(
      'Materiał źródłowy ma bardzo mało pozycji — traktuj jako hipotezę do weryfikacji.'
    );
  }

  return {
    score,
    answer_quality_posture: answerQualityPosture,
    coverage_posture: coveragePosture,
    missing_voices: [],
    limitations,
    recommended_followups: limitations.length
      ? ['Uzupełnij materiał źródłowy przed publikacją karty.']
      : [],
  };
}

/** Step [4] BRAMKA F14 — score a candidate against CARD_CONTENT_FORMULA. Never throws. */
export function runQualityGate(
  candidate: Partial<InsightCandidate>,
  items: MaterializationSourceItem[]
): FormulaVerdict {
  try {
    const materialQuality = buildGenericMaterialQuality(items, candidate);
    const cardForValidation: InsightCardData = {
      title: candidate.title,
      executive_summary: candidate.executive_summary,
      themes: candidate.themes,
      issues: candidate.issues,
      opportunities: candidate.opportunities,
      signals: candidate.signals,
      evidence_map: candidate.evidence_map,
      missing_data: candidate.missing_data,
      material_quality: materialQuality,
    };
    return validateInsightCard(cardForValidation);
  } catch (err) {
    // validateInsightCard is documented tolerant/never-throwing, but this
    // guardian must never be able to break a caller — defensive wrap anyway.
    logger.warn(
      `${LOG} runQualityGate failed unexpectedly (fail-soft): ${err instanceof Error ? err.message : String(err)}`
    );
    return {
      kind: 'insight',
      score: 0,
      pass: false,
      passThreshold: 90,
      violations: [],
      violationCodes: [],
    };
  }
}

function normalizeCandidate(
  candidate: Partial<InsightCandidate>,
  items: MaterializationSourceItem[]
): InsightCandidate {
  return {
    title: String(candidate.title || ''),
    executive_summary: String(candidate.executive_summary || ''),
    themes: Array.isArray(candidate.themes) ? (candidate.themes as InsightCandidateTheme[]) : [],
    issues: Array.isArray(candidate.issues) ? (candidate.issues as InsightCandidateIssue[]) : [],
    opportunities: Array.isArray(candidate.opportunities)
      ? (candidate.opportunities as InsightCandidateOpportunity[])
      : [],
    signals: Array.isArray(candidate.signals) ? candidate.signals : [],
    evidence_map: Array.isArray(candidate.evidence_map)
      ? (candidate.evidence_map as InsightCandidateEvidenceMapEntry[])
      : [],
    missing_data: Array.isArray(candidate.missing_data) ? (candidate.missing_data as string[]) : [],
    material_quality: buildGenericMaterialQuality(items, candidate),
  };
}

/**
 * HP-14: buduje `EvidenceContract` z candidate'a — DETERMINISTYCZNIE, zero LLM.
 * Sygnały pewności są REALNE:
 *   - sourceCount = liczba UNIKALNYCH źródłowych item_id faktycznie zacytowanych
 *     (evidence_map + evidence_refs tematów/issue/opportunity),
 *   - qualityScore = material_quality.score (deterministyczny wynik walidatora karty),
 *   - unresolvedGaps = missing_data + missing_voices (nierozwiązane luki).
 * `toVerify` i `risks` cytują realne braki materiału, nie zgadywanie modelu.
 */
export function buildEvidenceContractFromCandidate(
  candidate: InsightCandidate,
  sourceType: MaterializationSourceType
): EvidenceContract {
  const refIds = new Set<string>();
  candidate.evidence_map.forEach((e) => {
    if (e?.item_id) refIds.add(String(e.item_id));
  });
  const collectRefs = (arr: Array<{ evidence_refs?: string[] }>) =>
    arr.forEach((x) => (x.evidence_refs || []).forEach((r) => r && refIds.add(String(r))));
  collectRefs(candidate.themes);
  collectRefs(candidate.issues);
  collectRefs(candidate.opportunities);

  const snippetByItem = new Map<string, string>();
  candidate.evidence_map.forEach((e) => {
    if (e?.item_id) snippetByItem.set(String(e.item_id), String(e.answer_snippet || ''));
  });

  const sources: EvidenceContractSource[] = Array.from(refIds).map((ref) => ({
    type: sourceType,
    ref,
    snippet: snippetByItem.get(ref) || undefined,
  }));

  const mq = candidate.material_quality;
  const risks: string[] = [...(mq?.limitations || [])];
  if (mq?.coverage_posture === 'single_source') {
    risks.push('Pokrycie jednoźródłowe — wnioski mogą nie generalizować na całą organizację.');
  }
  (mq?.missing_voices || []).forEach((v) => risks.push(`Brak głosu: ${v}`));

  const toVerify: string[] = [
    ...(candidate.missing_data || []),
    ...(mq?.recommended_followups || []),
  ];

  const confidence = deriveConfidence({
    sourceCount: sources.length,
    qualityScore: typeof mq?.score === 'number' ? mq.score : undefined,
    unresolvedGaps: (candidate.missing_data?.length || 0) + (mq?.missing_voices?.length || 0),
  });

  return { sources, assumptions: [], risks, confidence, toVerify };
}

function tokensFromUsage(usage: unknown): number {
  if (!usage || typeof usage !== 'object') return 0;
  const u = usage as Record<string, unknown>;
  const n = Number(u.totalTokens ?? u.total_tokens ?? u.total ?? 0);
  return Number.isFinite(n) ? n : 0;
}

// ────────────────────────────────────────────────────────────────────────────
// Orchestrator — steps [3]-[5]. ADVISORY / fail-soft. NEVER persists.
// ────────────────────────────────────────────────────────────────────────────

/**
 * Distill a raw tool/assessment/interview result into Insight-card candidates,
 * gated by F14 (CARD_CONTENT_FORMULA), with ONE auto-repair pass on failure —
 * the exact pattern already proven in `InterviewInsightService.generateInsight`,
 * generalized so Tools and Assessment can call the SAME core (§5: "rozszerzyć
 * wywołania, nie kopiować").
 *
 * Returns candidates for the CALLER to show the user BEFORE creating anything
 * — materialization stays explicit and reversible. On any failure (empty
 * input, LLM error, unparseable response, unexpected exception) this resolves
 * to `{ candidates: [], degraded: true, degradedReason }` — it never throws
 * and never blocks the caller's own flow.
 */
export async function materializeInsightCandidates(
  input: MaterializationInput,
  deps: MaterializationDeps = defaultDeps
): Promise<MaterializationOutcome> {
  const startTime = Date.now();
  const degradedOutcome = (reason: string): MaterializationOutcome => ({
    candidates: [],
    verdict: undefined,
    repaired: false,
    tokensUsed: 0,
    generationTimeMs: Date.now() - startTime,
    degraded: true,
    degradedReason: reason,
    evidence: emptyEvidenceContract(),
  });

  if (!input || !Array.isArray(input.items) || input.items.length === 0) {
    return degradedOutcome('no_source_items');
  }

  try {
    const validIds = new Set(input.items.map((item) => String(item.id)));
    const prompt = buildDistillationPrompt(input);
    let tokensUsed = 0;

    let response: GenerateResponseLike;
    try {
      response = await deps.generate({
        prompt,
        systemPrompt: SYSTEM_PROMPT,
        temperature: 0.3,
        maxTokens: 3000,
      });
    } catch (genErr) {
      logger.warn(
        `${LOG} distillation LLM call failed (fail-soft, source=${input.sourceType}/${input.sourceId}): ` +
          `${genErr instanceof Error ? genErr.message : String(genErr)}`
      );
      return degradedOutcome('llm_call_failed');
    }

    tokensUsed += tokensFromUsage(response?.usage);
    const rawText = String(response?.content ?? response?.text ?? '');
    let candidate = reconcileEvidenceRefs(parseDistillationResponse(rawText), validIds);

    if (
      !String(candidate.title || '').trim() &&
      !String(candidate.executive_summary || '').trim()
    ) {
      return { ...degradedOutcome('unparseable_response'), tokensUsed };
    }

    let verdict = runQualityGate(candidate, input.items);
    let repaired = false;

    // [4] BRAMKA F14 — ADVISORY: FAIL triggers ONE repair pass, never a block.
    if (!verdict.pass) {
      logger.warn(
        `${LOG} candidate for ${input.sourceType}/${input.sourceId} failed CARD_CONTENT_FORMULA ` +
          `(score ${verdict.score}/100): ${verdict.violationCodes.join(', ')} — attempting 1 auto-repair pass.`
      );
      try {
        const repairBrief = buildRepairBriefFromVerdict(verdict);
        const repairResponse = await deps.generate({
          prompt:
            `${repairBrief}\n\n--- POPRZEDNI KANDYDAT (JSON do poprawy) ---\n${JSON.stringify(candidate)}\n\n` +
            `Zwróć WYŁĄCZNIE poprawiony obiekt JSON w tym samym kontrakcie pól. Evidence_ref MUSI ` +
            `pozostać jednym z dostarczonych item_id.`,
          systemPrompt: SYSTEM_PROMPT,
          temperature: 0.2,
          maxTokens: 3000,
        });
        tokensUsed += tokensFromUsage(repairResponse?.usage);
        const repairedCandidate = reconcileEvidenceRefs(
          parseDistillationResponse(String(repairResponse?.content ?? repairResponse?.text ?? '')),
          validIds
        );
        const repairedVerdict = runQualityGate(repairedCandidate, input.items);
        // Only accept the repair if it scored strictly better (guards regressions).
        if (repairedVerdict.score > verdict.score) {
          const previousScore = verdict.score;
          candidate = repairedCandidate;
          verdict = repairedVerdict;
          repaired = true;
          logger.info(
            `${LOG} auto-repair improved candidate for ${input.sourceType}/${input.sourceId}: ` +
              `${previousScore} → ${repairedVerdict.score}.`
          );
        }
      } catch (repairErr) {
        logger.warn(
          `${LOG} auto-repair failed (fail-soft, source=${input.sourceType}/${input.sourceId}): ` +
            `${repairErr instanceof Error ? repairErr.message : String(repairErr)}`
        );
      }
    }

    const normalized = normalizeCandidate(candidate, input.items);
    const evidence = buildEvidenceContractFromCandidate(normalized, input.sourceType);
    logger.info(
      `${LOG} evidence contract (source=${input.sourceType}/${input.sourceId}): ` +
        `sources=${evidence.sources.length} risks=${evidence.risks.length} ` +
        `toVerify=${evidence.toVerify.length} confidence=${evidence.confidence}`
    );
    return {
      candidates: [normalized],
      verdict,
      repaired,
      tokensUsed,
      generationTimeMs: Date.now() - startTime,
      degraded: false,
      evidence,
    };
  } catch (err) {
    logger.warn(
      `${LOG} materializeInsightCandidates unexpected error (fail-soft, source=${input.sourceType}/${input.sourceId}): ` +
        `${err instanceof Error ? err.message : String(err)}`
    );
    return degradedOutcome('unexpected_error');
  }
}

// ────────────────────────────────────────────────────────────────────────────
// §6 bridge (#57/Z60): InsightCandidate → GenerationContext seed fields.
// ────────────────────────────────────────────────────────────────────────────

/** The two `GenerationContext` fields `initiativeGenerationService` inherits from. */
export interface InitiativeSeedContext {
  /** First grounded owner-role seed found across issues/opportunities, if any. */
  seedOwnerRole?: string;
  /** "metric (baseline → target, horyzont)" seeds, one per grounded entry, joined. */
  seedKpiSeeds?: string;
}

/**
 * Bridge helper (§6, #57/Z60): collects the downstream seeds a materialized
 * Insight candidate carries on its issues/opportunities into the two
 * `GenerationContext` fields `initiativeGenerationService` already knows how
 * to surface via `buildGroundingBlock` (`seedOwnerRole`/`seedKpiSeeds`) — so a
 * caller wiring an Insight into `generateFullInitiative` (or any section
 * generation call) can pass real seeds instead of leaving the generator to
 * guess an owner/KPI from nothing.
 *
 * Pure + fail-soft: a null/undefined candidate, or one with no grounded
 * seeds, returns `{}` (no keys set) — callers can always safely spread the
 * result into a context object without touching existing behavior.
 */
export function deriveInitiativeSeedContext(
  candidate: InsightCandidate | null | undefined
): InitiativeSeedContext {
  if (!candidate) return {};

  const entries: InsightSeedFields[] = [
    ...(Array.isArray(candidate.issues) ? candidate.issues : []),
    ...(Array.isArray(candidate.opportunities) ? candidate.opportunities : []),
  ];

  const seedOwnerRole = entries
    .map((e) => normalizeSeedValue(e?.suggestedOwnerRole))
    .find((v): v is string => v != null);

  const kpiLines = entries
    .map((e) => ({
      metric: normalizeSeedValue(e?.metric),
      baseline: normalizeSeedValue(e?.baseline),
      target: normalizeSeedValue(e?.target),
      horizon: normalizeSeedValue(e?.horizon),
    }))
    // A usable KPI seed needs at least the metric AND one of baseline/target —
    // a bare metric with nothing to anchor it isn't worth surfacing.
    .filter((s) => s.metric && (s.baseline || s.target))
    .map((s) => {
      const range = `${s.baseline ?? '—'} → ${s.target ?? '—'}`;
      return s.horizon ? `${s.metric} (${range}, ${s.horizon})` : `${s.metric} (${range})`;
    });

  const result: InitiativeSeedContext = {};
  if (seedOwnerRole) result.seedOwnerRole = seedOwnerRole;
  if (kpiLines.length) result.seedKpiSeeds = kpiLines.join('; ');
  return result;
}

export default {
  materializeInsightCandidates,
  buildDistillationPrompt,
  parseDistillationResponse,
  reconcileEvidenceRefs,
  buildGenericMaterialQuality,
  runQualityGate,
  deriveInitiativeSeedContext,
};
