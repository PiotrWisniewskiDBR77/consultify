/**
 * Consulting Benchmark LLM Judge Service (Consultify Bench, Blok E / HP-18…21, task E1)
 *
 * Domain-generalized clone of `presentationBenchmarkJudgeService.ts`: same
 * architecture (adapter-injection, never-throws, strict JSON validation,
 * token-cap, 1.0-5.0 half-step scale), applied to "consulting task answer"
 * instead of "deck". See `PROJEKT_BENCHMARK.md` §1.2-1.3 for the spec this
 * file implements.
 *
 * Two grading modes per task (mirrors Harvey's BigLaw Bench):
 *  - Binary all-pass (`gradeAllPass`): task-specific criteria, PASS only if
 *    every criterion passes. This is the headline verdict.
 *  - 5-dimension scale (1.0-5.0, McKinsey-grade quality trend): answer_first,
 *    mece_structure, grounding, actionability, evidence_discipline.
 *
 * CRITICAL invariants (see PROJEKT_BENCHMARK.md §4.3, anti-contamination):
 *  - never throws — all errors are returned via the typed `JudgeResult`
 *  - LLM judge responses are validated strictly before scoring (no
 *    half-parsed JSON, no fabricated dimensions/criteria)
 *  - inputs are token-capped for cost safety
 *  - `buildProductPromptPayload` is the ONLY sanctioned way to derive what
 *    the model-under-test may see from a `JudgeTaskInput`. It emits solely
 *    `{ prompt, context }` — `binaryCriteria` / `scaleRubrics` / `goldNotes`
 *    must NEVER reach the product prompt. The judge (this service) is the
 *    only consumer allowed to see the full task including gold material.
 *  - a verdict/aggregate is only ever populated when the judge actually
 *    ran and parsed successfully (`status === 'ok'`) — no fabricated scores
 *    when the LLM is unavailable/misconfigured (noop adapter, missing keys).
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type ConsultingDimension =
  | 'answer_first'
  | 'mece_structure'
  | 'grounding'
  | 'actionability'
  | 'evidence_discipline';

export interface ConsultingRubric {
  dimension: ConsultingDimension;
  description: string;
  /** 1-line "what 1/3/5 looks like". */
  scoringGuidance: string;
  /** 0..1, defaults to equal weighting across dimensions. */
  weight: number;
}

/** Task-specific binary pass/fail criterion (BigLaw Bench style all-pass). */
export interface BinaryCriterion {
  /** Stable id, unique within the task (e.g. "cites-example-evidence"). */
  id: string;
  /** What the criterion checks. */
  description: string;
  /** 1-line guidance for the judge on what satisfies this criterion. */
  guidance: string;
}

export interface BinaryCriterionResult {
  id: string;
  pass: boolean;
  rationale: string;
}

/**
 * What the JUDGE sees for one task. This is a superset of what the
 * model-under-test may see — see `buildProductPromptPayload` for the
 * anti-contamination firewall that strips this down for the product call.
 */
export interface JudgeTaskInput {
  taskId: string;
  /** What the model-under-test was given as the task. */
  prompt: string;
  /** Input material (company situation, data) — no gold answer inside. */
  context?: string;
  /** The model-under-test's actual answer being graded. */
  modelAnswer: string;
  /** Task-specific binary criteria for the all-pass verdict. */
  binaryCriteria: BinaryCriterion[];
  /** Scale rubric to use; defaults to DEFAULT_CONSULTING_RUBRICS. */
  scaleRubrics?: ConsultingRubric[];
  /** Expert reference notes — judge-only, NEVER sent to the product model. */
  goldNotes?: string;
  archetype?: 'diagnostic' | 'synthetic' | 'real-anon';
  domain?: string;
  lang?: 'pl' | 'en';
  metadata?: Record<string, unknown>;
}

/** Anti-contamination firewall output: the ONLY fields the model-under-test may see. */
export interface ProductPromptPayload {
  prompt: string;
  context?: string;
}

export interface DimensionScoreResult {
  dimension: ConsultingDimension;
  /** 1.0..5.0 in 0.5 increments. */
  score: number;
  /** 1-3 sentences summarizing the verdict for this dimension. */
  rationale: string;
  /** Quotes from the model answer supporting the score. */
  evidence: string[];
  confidence: 'low' | 'medium' | 'high';
}

export interface JudgeAggregate {
  answerFirst: number;
  meceStructure: number;
  grounding: number;
  actionability: number;
  evidenceDiscipline: number;
}

export interface GradeAllPassResult {
  verdict: 'PASS' | 'FAIL';
  /** ids of binary criteria that did not pass (or were not returned at all). */
  failedCriteria: string[];
  totalCriteria: number;
  passedCriteria: number;
}

export interface JudgeResult {
  status: 'ok' | 'unavailable' | 'invalid_response' | 'rate_limited' | 'timeout';
  scores?: DimensionScoreResult[];
  aggregate?: JudgeAggregate;
  binaryResults?: BinaryCriterionResult[];
  /** Only populated when status === 'ok' — see gradeAllPass. */
  verdict?: 'PASS' | 'FAIL';
  failedCriteria?: string[];
  rationale?: string;
  modelId?: string;
  durationMs?: number;
  reason?: string;
}

export interface LlmJudgeAdapterCallInput {
  systemPrompt: string;
  userPrompt: string;
  expectsJson: true;
}

export interface LlmJudgeAdapterCallOutput {
  status: 'ok' | 'rate_limited' | 'timeout' | 'unavailable';
  rawText?: string;
  modelId?: string;
  reason?: string;
}

export interface LlmJudgeAdapter {
  judge(input: LlmJudgeAdapterCallInput): Promise<LlmJudgeAdapterCallOutput>;
}

export interface BuildJudgePromptInput {
  task: JudgeTaskInput;
  scaleRubrics: ConsultingRubric[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const CONSULTING_DIMENSIONS: ReadonlyArray<ConsultingDimension> = [
  'answer_first',
  'mece_structure',
  'grounding',
  'actionability',
  'evidence_discipline',
];

// NOTE: weight for `grounding` is proposed to be raised above equal-weighting
// per PROJEKT_BENCHMARK.md §5 ("integralność = rdzeń tezy") — pending Piotr's
// decision. Kept at equal 0.2 default here until that decision lands; callers
// may pass a custom `scaleRubrics` array to `judgeConsultingTask` to override.
export const DEFAULT_CONSULTING_RUBRICS: ConsultingRubric[] = [
  {
    dimension: 'answer_first',
    description:
      'Minto pyramid discipline: thesis / recommendation stated up front, not buried under analysis.',
    scoringGuidance:
      '1=no clear thesis or buried at the end; 3=thesis present but late/diluted; 5=leads with a clear, decision-ready recommendation.',
    weight: 0.2,
  },
  {
    dimension: 'mece_structure',
    description:
      'Completeness and mutual exclusivity of the analysis: no gaps, no overlapping buckets.',
    scoringGuidance:
      '1=disorganized or overlapping categories; 3=mostly structured with minor gaps; 5=fully MECE breakdown of the problem.',
    weight: 0.2,
  },
  {
    dimension: 'grounding',
    description:
      'Every claim is traceable to the provided context; no hallucinated facts, figures, or sources.',
    scoringGuidance:
      '1=fabricated or unsupported claims; 3=mostly grounded with minor unsupported claims; 5=every claim traceable to the given context.',
    weight: 0.2,
  },
  {
    dimension: 'actionability',
    description:
      'The recommendation is executable: who does what, by when — not a generic platitude.',
    scoringGuidance:
      '1=generic advice with no owner/timing; 3=actionable but vague on owner or timing; 5=fully specified who/what/when.',
    weight: 0.2,
  },
  {
    dimension: 'evidence_discipline',
    description:
      'Requests or cites the right evidence for the claim made; does not overstate confidence beyond what the data supports.',
    scoringGuidance:
      '1=no evidence discipline, confident overstatement; 3=some evidence cited inconsistently; 5=rigorous evidence citation with appropriate caveats.',
    weight: 0.2,
  },
];

const VALID_SCORES = new Set<number>([1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]);

const CONFIDENCE_VALUES = new Set<DimensionScoreResult['confidence']>(['low', 'medium', 'high']);

/** Hard cap (chars) for the task prompt as serialized into the judge prompt. */
const MAX_PROMPT_CHARS = 4_000;
/** Hard cap (chars) for the input context/material. */
const MAX_CONTEXT_CHARS = 8_000;
/** Hard cap (chars) for the model-under-test's answer being graded. */
const MAX_MODEL_ANSWER_CHARS = 10_000;
/** Hard cap (chars) for expert gold notes shown only to the judge. */
const MAX_GOLD_NOTES_CHARS = 4_000;
/** Hard cap (chars) for any single binary criterion description/guidance. */
const MAX_CRITERION_CHARS = 300;
/** Soft cap on number of binary criteria serialized into the prompt (cost safety). */
const MAX_BINARY_CRITERIA = 25;

const DEFAULT_TIMEOUT_MS = 60_000;

// ---------------------------------------------------------------------------
// Adapters
// ---------------------------------------------------------------------------

/**
 * Default adapter used when no LLM client is configured. The judge service
 * remains importable and callable in environments without API keys —
 * callers get an explicit `unavailable` status, never a fabricated score.
 */
export const noopLlmAdapter: LlmJudgeAdapter = {
  async judge(): Promise<LlmJudgeAdapterCallOutput> {
    return { status: 'unavailable', reason: 'No LLM adapter configured' };
  },
};

/**
 * Test/dev adapter that returns a predefined judge result, serialized as the
 * JSON payload the real LLM is expected to produce. Keeps tests offline and
 * decoupled from any provider keys.
 */
export function mockLlmAdapter(
  predefined: {
    scores?: DimensionScoreResult[];
    binaryResults?: BinaryCriterionResult[];
    rationale?: string;
    rawText?: string;
    status?: LlmJudgeAdapterCallOutput['status'];
    modelId?: string;
    reason?: string;
  } = {}
): LlmJudgeAdapter {
  return {
    async judge(): Promise<LlmJudgeAdapterCallOutput> {
      const status = predefined.status ?? 'ok';
      if (status !== 'ok') {
        return {
          status,
          modelId: predefined.modelId,
          reason: predefined.reason,
        };
      }

      let rawText = predefined.rawText;
      if (!rawText) {
        const scores = predefined.scores ?? [];
        const binaryResults = predefined.binaryResults ?? [];
        rawText = JSON.stringify({
          rationale: predefined.rationale ?? 'mocked rationale',
          dimensions: scores.map((s) => ({
            dimension: s.dimension,
            score: s.score,
            rationale: s.rationale,
            evidence: s.evidence,
            confidence: s.confidence,
          })),
          binaryResults: binaryResults.map((b) => ({
            id: b.id,
            pass: b.pass,
            rationale: b.rationale,
          })),
        });
      }

      return {
        status: 'ok',
        rawText,
        modelId: predefined.modelId ?? 'mock-judge-1',
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function safeString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (value == null) return fallback;
  return String(value);
}

function clampString(value: string, maxLen: number): string {
  if (value.length <= maxLen) return value;
  return `${value.slice(0, Math.max(0, maxLen - 1))}…`;
}

function safeBinaryCriteria(input: unknown): BinaryCriterion[] {
  if (!Array.isArray(input)) return [];
  const out: BinaryCriterion[] = [];
  const seen = new Set<string>();
  for (const entry of input) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Partial<BinaryCriterion>;
    const id = typeof e.id === 'string' ? e.id.trim() : '';
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      description: clampString(safeString(e.description), MAX_CRITERION_CHARS),
      guidance: clampString(safeString(e.guidance), MAX_CRITERION_CHARS),
    });
    if (out.length >= MAX_BINARY_CRITERIA) break;
  }
  return out;
}

function safeScaleRubrics(rubrics: ConsultingRubric[] | undefined | null): ConsultingRubric[] {
  if (!Array.isArray(rubrics) || rubrics.length === 0) return DEFAULT_CONSULTING_RUBRICS;
  const seen = new Set<ConsultingDimension>();
  const out: ConsultingRubric[] = [];
  for (const entry of rubrics) {
    if (!entry || typeof entry !== 'object') continue;
    const dim = entry.dimension as ConsultingDimension;
    if (!CONSULTING_DIMENSIONS.includes(dim)) continue;
    if (seen.has(dim)) continue;
    seen.add(dim);
    out.push({
      dimension: dim,
      description: safeString(entry.description, ''),
      scoringGuidance: safeString(entry.scoringGuidance, ''),
      weight:
        typeof entry.weight === 'number' && Number.isFinite(entry.weight) && entry.weight >= 0
          ? Math.min(1, entry.weight)
          : 0.2,
    });
  }
  if (out.length === 0) return DEFAULT_CONSULTING_RUBRICS;
  for (const fallback of DEFAULT_CONSULTING_RUBRICS) {
    if (!seen.has(fallback.dimension)) out.push(fallback);
  }
  out.sort(
    (a, b) => CONSULTING_DIMENSIONS.indexOf(a.dimension) - CONSULTING_DIMENSIONS.indexOf(b.dimension)
  );
  return out;
}

function safeTask(task: JudgeTaskInput | undefined | null): JudgeTaskInput {
  if (!task || typeof task !== 'object') {
    return { taskId: '', prompt: '', modelAnswer: '', binaryCriteria: [] };
  }
  return {
    taskId: safeString(task.taskId),
    prompt: clampString(safeString(task.prompt), MAX_PROMPT_CHARS),
    context:
      typeof task.context === 'string'
        ? clampString(task.context, MAX_CONTEXT_CHARS)
        : undefined,
    modelAnswer: clampString(safeString(task.modelAnswer), MAX_MODEL_ANSWER_CHARS),
    binaryCriteria: safeBinaryCriteria(task.binaryCriteria),
    scaleRubrics: Array.isArray(task.scaleRubrics) ? task.scaleRubrics : undefined,
    goldNotes:
      typeof task.goldNotes === 'string'
        ? clampString(task.goldNotes, MAX_GOLD_NOTES_CHARS)
        : undefined,
    archetype: task.archetype,
    domain: typeof task.domain === 'string' ? task.domain : undefined,
    lang: task.lang === 'pl' || task.lang === 'en' ? task.lang : undefined,
    metadata:
      task.metadata && typeof task.metadata === 'object'
        ? (task.metadata as Record<string, unknown>)
        : undefined,
  };
}

function round2(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

function isHalfStepInRange(value: unknown): value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return false;
  if (value < 1 || value > 5) return false;
  return VALID_SCORES.has(value);
}

// ---------------------------------------------------------------------------
// Anti-contamination firewall
// ---------------------------------------------------------------------------

/**
 * The ONLY sanctioned way to derive what the model-under-test may see from a
 * `JudgeTaskInput`. Deliberately allow-lists `{ prompt, context }` and
 * ignores every other field on the input object — including ones an
 * upstream bug (or a malicious/contaminated task file) might attach, such as
 * `goldNotes`, `binaryCriteria`, or `scaleRubrics`. See PROJEKT_BENCHMARK.md
 * §4.3: leaking gold material into the product prompt makes the benchmark
 * worthless (the model would "know the test").
 */
export function buildProductPromptPayload(
  task: JudgeTaskInput | Record<string, unknown> | undefined | null
): ProductPromptPayload {
  const t = (task ?? {}) as Partial<JudgeTaskInput>;
  const payload: ProductPromptPayload = { prompt: safeString(t.prompt) };
  if (typeof t.context === 'string') payload.context = t.context;
  return payload;
}

// ---------------------------------------------------------------------------
// Prompt construction (judge-side; includes gold material — never reused for
// the product-under-test call, see buildProductPromptPayload above)
// ---------------------------------------------------------------------------

export function buildJudgeSystemPrompt(): string {
  return [
    'You are an impartial benchmark judge for AI-generated management-consulting task answers.',
    'You will receive a task prompt, optional context material, the answer produced by the model under test,',
    'a set of task-specific binary pass/fail criteria, and (optionally) expert gold reference notes.',
    'Grade the model answer against BOTH: (1) each binary criterion — pass only if fully satisfied by the answer,',
    'and (2) five fixed quality dimensions on a 1.0 to 5.0 scale in 0.5 increments only.',
    'Allowed score values: 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5.',
    'Return JSON only — no markdown, no commentary outside the JSON object.',
    'For every scale dimension you MUST include: dimension, score, rationale (1-3 sentences),',
    'evidence (an array of short quotes from the model answer), confidence (low|medium|high).',
    'For every binary criterion you MUST include: id (must match exactly), pass (boolean), rationale (1-2 sentences).',
    'Quote evidence verbatim from the model answer rather than paraphrasing.',
    'Never invent facts, sources, or figures that are not present in the context or the model answer.',
    'Gold reference notes (if provided) are for your calibration only — do not quote them back verbatim as if the model produced them.',
    'If you cannot evaluate a dimension, still return a score with confidence "low" rather than omitting it.',
    'Top-level JSON shape: { "rationale": string, "dimensions": [ ... ], "binaryResults": [ ... ] }.',
  ].join(' ');
}

export function buildJudgeUserPrompt(input: BuildJudgePromptInput): string {
  const task = safeTask(input?.task);
  const rubrics = safeScaleRubrics(input?.scaleRubrics ?? task.scaleRubrics);
  const criteria = task.binaryCriteria;

  const lines: string[] = [];
  lines.push(`Task id: ${task.taskId || '(untitled)'}`);
  if (task.domain) lines.push(`Domain: ${task.domain}`);
  if (task.archetype) lines.push(`Archetype: ${task.archetype}`);
  lines.push('');

  lines.push('Task prompt given to the model under test:');
  lines.push(task.prompt || '(empty prompt)');
  lines.push('');

  if (task.context) {
    lines.push('Context material given to the model under test:');
    lines.push(task.context);
    lines.push('');
  }

  lines.push('Model answer being graded:');
  lines.push(task.modelAnswer || '(empty answer)');
  lines.push('');

  if (task.goldNotes) {
    lines.push('Expert gold reference notes (judge calibration only, NOT produced by the model):');
    lines.push(task.goldNotes);
    lines.push('');
  }

  lines.push('Binary pass/fail criteria (all must be satisfied for an overall PASS):');
  if (criteria.length === 0) {
    lines.push('(no binary criteria for this task)');
  } else {
    for (const c of criteria) {
      lines.push(`- id="${c.id}": ${c.description}`);
      lines.push(`  guidance: ${c.guidance}`);
    }
  }
  lines.push('');

  lines.push('Scale rubric (score each on 1.0-5.0 in 0.5 steps):');
  for (const rubric of rubrics) {
    lines.push(`- ${rubric.dimension}: ${rubric.description}`);
    lines.push(`  guidance: ${rubric.scoringGuidance}`);
  }
  lines.push('');

  lines.push('Respond with JSON only. Required "dimensions" entries:');
  for (const rubric of rubrics) lines.push(`- ${rubric.dimension}`);
  lines.push('Required "binaryResults" entries (must match ids exactly, one per criterion above):');
  if (criteria.length === 0) {
    lines.push('- (none — return an empty array)');
  } else {
    for (const c of criteria) lines.push(`- ${c.id}`);
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Response parsing
// ---------------------------------------------------------------------------

export interface ParseJudgeResponseResult {
  status: 'ok' | 'invalid_response';
  scores?: DimensionScoreResult[];
  binaryResults?: BinaryCriterionResult[];
  rationale?: string;
  reason?: string;
}

function stripJsonFences(rawText: string): string {
  const trimmed = rawText.trim();
  const fenceMatch = trimmed.match(/^```(?:json|JSON)?\s*([\s\S]*?)\s*```$/);
  if (fenceMatch && fenceMatch[1]) return fenceMatch[1].trim();
  return trimmed;
}

function extractJsonObject(rawText: string): string | null {
  const stripped = stripJsonFences(rawText);
  if (stripped.startsWith('{')) return stripped;
  const start = stripped.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < stripped.length; i++) {
    const ch = stripped[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === '\\') {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return stripped.slice(start, i + 1);
    }
  }
  return null;
}

export function parseJudgeResponse(
  rawText: string,
  scaleRubrics: ConsultingRubric[] = DEFAULT_CONSULTING_RUBRICS,
  binaryCriteria: BinaryCriterion[] = []
): ParseJudgeResponseResult {
  if (typeof rawText !== 'string' || rawText.trim().length === 0) {
    return { status: 'invalid_response', reason: 'empty_response' };
  }

  const jsonStr = extractJsonObject(rawText);
  if (!jsonStr) {
    return { status: 'invalid_response', reason: 'no_json_object' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (error) {
    const message = (error as { message?: unknown })?.message ?? String(error);
    return { status: 'invalid_response', reason: `json_parse_error: ${String(message)}` };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { status: 'invalid_response', reason: 'top_level_not_object' };
  }

  const obj = parsed as Record<string, unknown>;

  // --- scale dimensions ---
  const dimensionsRaw = obj.dimensions ?? obj.scores;
  if (!Array.isArray(dimensionsRaw)) {
    return { status: 'invalid_response', reason: 'missing_dimensions_array' };
  }

  const safeRubric = safeScaleRubrics(scaleRubrics);
  const expectedDims = new Set<ConsultingDimension>(safeRubric.map((r) => r.dimension));
  const seenDims = new Map<ConsultingDimension, DimensionScoreResult>();

  for (const entry of dimensionsRaw) {
    if (!entry || typeof entry !== 'object') {
      return { status: 'invalid_response', reason: 'dimension_entry_not_object' };
    }
    const e = entry as Record<string, unknown>;
    const dim = e.dimension;
    if (typeof dim !== 'string' || !expectedDims.has(dim as ConsultingDimension)) {
      return {
        status: 'invalid_response',
        reason: `unknown_dimension: ${typeof dim === 'string' ? dim : 'missing'}`,
      };
    }
    if (!isHalfStepInRange(e.score)) {
      return {
        status: 'invalid_response',
        reason: `invalid_score_for_${dim}: ${typeof e.score === 'number' ? String(e.score) : 'missing'}`,
      };
    }

    const rationale = typeof e.rationale === 'string' ? e.rationale.trim() : '';
    if (!rationale) {
      return { status: 'invalid_response', reason: `missing_rationale_for_${dim}` };
    }

    const evidenceRaw = Array.isArray(e.evidence) ? e.evidence : [];
    const evidence: string[] = [];
    for (const item of evidenceRaw) {
      if (typeof item === 'string' && item.trim().length > 0) evidence.push(item.trim());
    }

    const confidenceRaw = typeof e.confidence === 'string' ? e.confidence.toLowerCase() : 'medium';
    const confidence = (
      CONFIDENCE_VALUES.has(confidenceRaw as DimensionScoreResult['confidence'])
        ? confidenceRaw
        : 'medium'
    ) as DimensionScoreResult['confidence'];

    seenDims.set(dim as ConsultingDimension, {
      dimension: dim as ConsultingDimension,
      score: e.score as number,
      rationale,
      evidence,
      confidence,
    });
  }

  for (const dim of expectedDims) {
    if (!seenDims.has(dim)) {
      return { status: 'invalid_response', reason: `missing_dimension: ${dim}` };
    }
  }

  const orderedScores: DimensionScoreResult[] = [];
  for (const rubric of safeRubric) {
    const item = seenDims.get(rubric.dimension);
    if (item) orderedScores.push(item);
  }

  // --- binary criteria ---
  const binaryRaw = obj.binaryResults;
  if (!Array.isArray(binaryRaw)) {
    return { status: 'invalid_response', reason: 'missing_binaryResults_array' };
  }

  const expectedCriteria = safeBinaryCriteria(binaryCriteria);
  const expectedIds = new Set(expectedCriteria.map((c) => c.id));
  const seenBinary = new Map<string, BinaryCriterionResult>();

  for (const entry of binaryRaw) {
    if (!entry || typeof entry !== 'object') {
      return { status: 'invalid_response', reason: 'binary_entry_not_object' };
    }
    const e = entry as Record<string, unknown>;
    const id = e.id;
    if (typeof id !== 'string' || !expectedIds.has(id)) {
      return {
        status: 'invalid_response',
        reason: `unknown_binary_criterion: ${typeof id === 'string' ? id : 'missing'}`,
      };
    }
    if (typeof e.pass !== 'boolean') {
      return { status: 'invalid_response', reason: `invalid_pass_for_${id}` };
    }
    const rationale = typeof e.rationale === 'string' ? e.rationale.trim() : '';
    if (!rationale) {
      return { status: 'invalid_response', reason: `missing_rationale_for_${id}` };
    }
    seenBinary.set(id, { id, pass: e.pass, rationale });
  }

  for (const id of expectedIds) {
    if (!seenBinary.has(id)) {
      return { status: 'invalid_response', reason: `missing_binary_result: ${id}` };
    }
  }

  const orderedBinary: BinaryCriterionResult[] = [];
  for (const c of expectedCriteria) {
    const item = seenBinary.get(c.id);
    if (item) orderedBinary.push(item);
  }

  const rationale = typeof obj.rationale === 'string' ? obj.rationale.trim() : undefined;

  return { status: 'ok', scores: orderedScores, binaryResults: orderedBinary, rationale };
}

// ---------------------------------------------------------------------------
// Aggregation (scale dimensions)
// ---------------------------------------------------------------------------

export function aggregateScores(scores: DimensionScoreResult[] | undefined | null): JudgeAggregate {
  const empty: JudgeAggregate = {
    answerFirst: 0,
    meceStructure: 0,
    grounding: 0,
    actionability: 0,
    evidenceDiscipline: 0,
  };
  if (!Array.isArray(scores) || scores.length === 0) return empty;

  const map = new Map<ConsultingDimension, number>();
  for (const entry of scores) {
    if (!entry || typeof entry !== 'object') continue;
    if (!CONSULTING_DIMENSIONS.includes(entry.dimension)) continue;
    if (!isHalfStepInRange(entry.score)) continue;
    map.set(entry.dimension, entry.score);
  }

  return {
    answerFirst: round2(map.get('answer_first') ?? 0),
    meceStructure: round2(map.get('mece_structure') ?? 0),
    grounding: round2(map.get('grounding') ?? 0),
    actionability: round2(map.get('actionability') ?? 0),
    evidenceDiscipline: round2(map.get('evidence_discipline') ?? 0),
  };
}

// ---------------------------------------------------------------------------
// Binary all-pass grading (BigLaw Bench style)
// ---------------------------------------------------------------------------

/**
 * Computes the headline PASS/FAIL verdict for a task: PASS only if every
 * expected binary criterion is present in `binaryResults` AND its `pass`
 * flag is `true`. A missing result is treated the same as a failed one —
 * we never assume a criterion passed just because the judge omitted it
 * (zero fabrykowanych wyników).
 *
 * A task with zero binary criteria defined (pure scale-graded task)
 * vacuously PASSes the all-pass gate — there is nothing to fail.
 */
export function gradeAllPass(
  binaryResults: BinaryCriterionResult[] | undefined | null,
  criteria: BinaryCriterion[] | undefined | null
): GradeAllPassResult {
  const expected = safeBinaryCriteria(criteria ?? []);
  const totalCriteria = expected.length;

  if (totalCriteria === 0) {
    return { verdict: 'PASS', failedCriteria: [], totalCriteria: 0, passedCriteria: 0 };
  }

  const resultMap = new Map<string, boolean>();
  if (Array.isArray(binaryResults)) {
    for (const r of binaryResults) {
      if (!r || typeof r !== 'object') continue;
      if (typeof r.id !== 'string') continue;
      if (typeof r.pass !== 'boolean') continue;
      resultMap.set(r.id, r.pass);
    }
  }

  const failedCriteria: string[] = [];
  let passedCriteria = 0;
  for (const c of expected) {
    if (resultMap.get(c.id) === true) {
      passedCriteria++;
    } else {
      failedCriteria.push(c.id);
    }
  }

  return {
    verdict: failedCriteria.length === 0 ? 'PASS' : 'FAIL',
    failedCriteria,
    totalCriteria,
    passedCriteria,
  };
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

export interface JudgeConsultingTaskInput {
  adapter: LlmJudgeAdapter;
  task: JudgeTaskInput;
  scaleRubrics?: ConsultingRubric[];
  /** Hard wall-clock cap for the whole judge call. Defaults to 60s. */
  timeoutMs?: number;
}

type GuardSentinel = { __sentinel: 'timeout' } | { __sentinel: 'error'; message: string };

function timeoutGuard<T>(promise: Promise<T>, ms: number): Promise<T | GuardSentinel> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve({ __sentinel: 'timeout' });
    }, ms);
    promise
      .then((value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error: unknown) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        const message = (error as { message?: unknown })?.message ?? String(error);
        resolve({ __sentinel: 'error', message: String(message) });
      });
  });
}

function isGuardSentinel(value: unknown): value is GuardSentinel {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as { __sentinel?: unknown }).__sentinel === 'string'
  );
}

export async function judgeConsultingTask(input: JudgeConsultingTaskInput): Promise<JudgeResult> {
  const startedAt = Date.now();
  if (
    !input ||
    typeof input !== 'object' ||
    !input.adapter ||
    typeof input.adapter.judge !== 'function'
  ) {
    return {
      status: 'unavailable',
      reason: 'No LLM adapter provided',
      durationMs: 0,
    };
  }

  const task = safeTask(input.task);
  const scaleRubrics = safeScaleRubrics(input.scaleRubrics ?? task.scaleRubrics);
  const systemPrompt = buildJudgeSystemPrompt();
  const userPrompt = buildJudgeUserPrompt({ task, scaleRubrics });
  const timeoutMs =
    typeof input.timeoutMs === 'number' && Number.isFinite(input.timeoutMs) && input.timeoutMs > 0
      ? Math.max(1_000, Math.floor(input.timeoutMs))
      : DEFAULT_TIMEOUT_MS;

  let adapterResult: LlmJudgeAdapterCallOutput;
  try {
    const guarded = await timeoutGuard(
      input.adapter.judge({ systemPrompt, userPrompt, expectsJson: true }),
      timeoutMs
    );
    if (isGuardSentinel(guarded)) {
      if (guarded.__sentinel === 'timeout') {
        return {
          status: 'timeout',
          reason: `LLM call exceeded ${timeoutMs}ms`,
          durationMs: Date.now() - startedAt,
        };
      }
      return {
        status: 'unavailable',
        reason: `adapter_error: ${guarded.message}`,
        durationMs: Date.now() - startedAt,
      };
    }
    adapterResult = guarded;
  } catch (error) {
    const message = (error as { message?: unknown })?.message ?? String(error);
    return {
      status: 'unavailable',
      reason: `adapter_error: ${String(message)}`,
      durationMs: Date.now() - startedAt,
    };
  }

  if (!adapterResult || typeof adapterResult !== 'object') {
    return {
      status: 'invalid_response',
      reason: 'adapter_returned_non_object',
      durationMs: Date.now() - startedAt,
    };
  }

  if (adapterResult.status === 'rate_limited') {
    return {
      status: 'rate_limited',
      reason: adapterResult.reason ?? 'adapter reported rate_limited',
      modelId: adapterResult.modelId,
      durationMs: Date.now() - startedAt,
    };
  }
  if (adapterResult.status === 'timeout') {
    return {
      status: 'timeout',
      reason: adapterResult.reason ?? 'adapter reported timeout',
      modelId: adapterResult.modelId,
      durationMs: Date.now() - startedAt,
    };
  }
  if (adapterResult.status === 'unavailable') {
    return {
      status: 'unavailable',
      reason: adapterResult.reason ?? 'adapter reported unavailable',
      modelId: adapterResult.modelId,
      durationMs: Date.now() - startedAt,
    };
  }

  if (adapterResult.status !== 'ok' || typeof adapterResult.rawText !== 'string') {
    return {
      status: 'invalid_response',
      reason: 'adapter_missing_raw_text',
      modelId: adapterResult.modelId,
      durationMs: Date.now() - startedAt,
    };
  }

  const parsed = parseJudgeResponse(adapterResult.rawText, scaleRubrics, task.binaryCriteria);
  if (parsed.status !== 'ok' || !parsed.scores || !parsed.binaryResults) {
    return {
      status: 'invalid_response',
      reason: parsed.reason ?? 'parse_failed',
      modelId: adapterResult.modelId,
      durationMs: Date.now() - startedAt,
    };
  }

  const allPass = gradeAllPass(parsed.binaryResults, task.binaryCriteria);

  return {
    status: 'ok',
    scores: parsed.scores,
    aggregate: aggregateScores(parsed.scores),
    binaryResults: parsed.binaryResults,
    verdict: allPass.verdict,
    failedCriteria: allPass.failedCriteria,
    rationale: parsed.rationale,
    modelId: adapterResult.modelId,
    durationMs: Date.now() - startedAt,
  };
}
