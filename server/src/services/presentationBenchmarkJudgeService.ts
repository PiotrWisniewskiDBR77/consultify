/**
 * Presentation Benchmark LLM Judge Service (Epic H1, Sprint 16)
 *
 * Pure-logic core for the LLM-assisted dimension scoring judge that
 * complements the manual Sprint 15 scorecard pipeline (see
 * `presentationBenchmarkScorecardService.ts`).
 *
 * The service is offline-testable via `mockLlmAdapter` and remains usable
 * even without configured LLM keys via `noopLlmAdapter`. Real callers
 * inject an `LlmJudgeAdapter` that wraps the project's existing
 * `llmService.call(...)` (Vercel AI SDK + circuit breaker stack); the
 * adapter is constructed in `server/scripts/run-benchmark-judge.ts` so
 * this service stays decoupled from concrete provider wiring.
 *
 * CRITICAL invariants:
 *  - never throws — all errors are returned via the typed `JudgeResult`
 *  - LLM responses are validated strictly before scoring (no
 *    half-parsed JSON, no fabricated dimensions)
 *  - inputs are token-capped (slide bullet truncation) for cost safety
 */

import type { DeckScoreInput } from './presentationBenchmarkScorecardService.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type BenchmarkDimension =
  | 'content_quality'
  | 'visual_design'
  | 'long_context_processing'
  | 'api_automation'
  | 'conversational_editing';

export interface JudgeRubric {
  dimension: BenchmarkDimension;
  description: string;
  /** 1-line "what 1/3/5 looks like". */
  scoringGuidance: string;
  /** 0..1, defaults to equal weighting across dimensions. */
  weight: number;
}

export interface JudgeDeckInput {
  deckId: string;
  deckTitle: string;
  slideSummaries: Array<{
    index: number;
    title: string;
    bullets: string[];
    layoutHint?: string;
  }>;
  brandKit?: {
    primaryColor?: string;
    theme?: string;
  };
  templateName?: string;
  metadata?: Record<string, unknown>;
}

export interface DimensionScoreResult {
  dimension: BenchmarkDimension;
  /** 1.0..5.0 in 0.5 increments. */
  score: number;
  /** 1-3 sentences summarizing the verdict for this dimension. */
  rationale: string;
  /** Bullet quotes from the deck supporting the score. */
  evidence: string[];
  confidence: 'low' | 'medium' | 'high';
}

export interface JudgeAggregate {
  contentQuality: number;
  visualDesign: number;
  longContextProcessing: number;
  apiAutomation: number;
  conversationalEditing: number;
}

export interface JudgeResult {
  status: 'ok' | 'unavailable' | 'invalid_response' | 'rate_limited' | 'timeout';
  scores?: DimensionScoreResult[];
  aggregate?: JudgeAggregate;
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
  deck: JudgeDeckInput;
  rubrics: JudgeRubric[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const BENCHMARK_DIMENSIONS: ReadonlyArray<BenchmarkDimension> = [
  'content_quality',
  'visual_design',
  'long_context_processing',
  'api_automation',
  'conversational_editing',
];

export const DEFAULT_RUBRICS: JudgeRubric[] = [
  {
    dimension: 'content_quality',
    description:
      'Thesis clarity, narrative flow, evidence cited, and absence of placeholders or filler bullets across the deck.',
    scoringGuidance:
      '1=incoherent or empty placeholders; 3=clear thesis with mixed evidence; 5=tight narrative with cited, decision-ready insights.',
    weight: 0.2,
  },
  {
    dimension: 'visual_design',
    description:
      'Visual hierarchy, spacing, layout consistency across slide families, and on-brand use of colour and typography.',
    scoringGuidance:
      '1=broken layouts and inconsistent styling; 3=usable layouts with minor drift; 5=publication-grade hierarchy and brand consistency.',
    weight: 0.2,
  },
  {
    dimension: 'long_context_processing',
    description:
      'Quality of synthesis when long source material is consumed: cross-slide consistency, traceability to upstream evidence, and absence of contradictions.',
    scoringGuidance:
      '1=contradictions or dropped sections; 3=mostly consistent but partial coverage; 5=full coverage with traceable cross-references.',
    weight: 0.2,
  },
  {
    dimension: 'api_automation',
    description:
      'Suitability for automated regeneration via the deck JSON / API surface: structured layout hints, deterministic content blocks, no manual cleanup required.',
    scoringGuidance:
      '1=requires hand editing to render; 3=mostly automatable with small fixes; 5=fully automatable from the deck JSON without follow-ups.',
    weight: 0.2,
  },
  {
    dimension: 'conversational_editing',
    description:
      'Readiness for incremental conversational edits: stable section boundaries, addressable slide IDs, clear delta opportunities surfaced for an operator chat.',
    scoringGuidance:
      '1=monolithic slides hard to address; 3=addressable but coarse-grained; 5=section-aware with clean delta hooks for chat-driven edits.',
    weight: 0.2,
  },
];

const VALID_SCORES = new Set<number>([1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]);

const CONFIDENCE_VALUES = new Set<DimensionScoreResult['confidence']>(['low', 'medium', 'high']);

/** Soft cap for slide bullets per slide before truncation. */
const MAX_BULLETS_PER_SLIDE = 5;
/** Soft cap for slides we serialize into the prompt (for cost protection). */
const MAX_SLIDES_IN_PROMPT = 60;
/** Hard cap (in characters) for any single bullet line in the serialized prompt. */
const MAX_BULLET_CHARS = 240;
/** Hard cap (in characters) for any single slide title in the serialized prompt. */
const MAX_TITLE_CHARS = 160;

const DEFAULT_TIMEOUT_MS = 60_000;

// ---------------------------------------------------------------------------
// Adapters
// ---------------------------------------------------------------------------

/**
 * Default adapter used when no LLM client is configured. The judge service
 * remains importable and callable in environments without API keys.
 */
export const noopLlmAdapter: LlmJudgeAdapter = {
  async judge(): Promise<LlmJudgeAdapterCallOutput> {
    return { status: 'unavailable', reason: 'No LLM adapter configured' };
  },
};

/**
 * Test/dev adapter that returns a predefined judge result, serialized as the
 * JSON payload the real LLM is expected to produce. This keeps tests offline
 * and decoupled from any provider keys.
 */
export function mockLlmAdapter(
  predefined: Partial<JudgeResult> & {
    rawText?: string;
    status?: LlmJudgeAdapterCallOutput['status'];
    modelId?: string;
    reason?: string;
  }
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
        rawText = JSON.stringify({
          rationale: predefined.rationale ?? 'mocked rationale',
          dimensions: scores.map((s) => ({
            dimension: s.dimension,
            score: s.score,
            rationale: s.rationale,
            evidence: s.evidence,
            confidence: s.confidence,
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

function safeBullets(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  for (const entry of input) {
    if (typeof entry !== 'string') continue;
    const trimmed = entry.trim();
    if (!trimmed) continue;
    out.push(clampString(trimmed, MAX_BULLET_CHARS));
  }
  return out;
}

function safeSlides(input: unknown): JudgeDeckInput['slideSummaries'] {
  if (!Array.isArray(input)) return [];
  const out: JudgeDeckInput['slideSummaries'] = [];
  for (let i = 0; i < input.length; i++) {
    const raw = input[i];
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Partial<JudgeDeckInput['slideSummaries'][number]>;
    out.push({
      index: typeof r.index === 'number' && Number.isFinite(r.index) ? r.index : i,
      title: clampString(safeString(r.title, `Slide ${i + 1}`), MAX_TITLE_CHARS),
      bullets: safeBullets(r.bullets),
      layoutHint: typeof r.layoutHint === 'string' ? r.layoutHint : undefined,
    });
  }
  return out;
}

function safeDeck(deck: JudgeDeckInput | undefined | null): JudgeDeckInput {
  if (!deck || typeof deck !== 'object') {
    return { deckId: '', deckTitle: '', slideSummaries: [] };
  }
  return {
    deckId: safeString(deck.deckId),
    deckTitle: safeString(deck.deckTitle),
    slideSummaries: safeSlides(deck.slideSummaries),
    brandKit:
      deck.brandKit && typeof deck.brandKit === 'object'
        ? {
            primaryColor:
              typeof deck.brandKit.primaryColor === 'string'
                ? deck.brandKit.primaryColor
                : undefined,
            theme: typeof deck.brandKit.theme === 'string' ? deck.brandKit.theme : undefined,
          }
        : undefined,
    templateName: typeof deck.templateName === 'string' ? deck.templateName : undefined,
    metadata:
      deck.metadata && typeof deck.metadata === 'object'
        ? (deck.metadata as Record<string, unknown>)
        : undefined,
  };
}

function safeRubrics(rubrics: JudgeRubric[] | undefined | null): JudgeRubric[] {
  if (!Array.isArray(rubrics) || rubrics.length === 0) return DEFAULT_RUBRICS;
  const seen = new Set<BenchmarkDimension>();
  const out: JudgeRubric[] = [];
  for (const entry of rubrics) {
    if (!entry || typeof entry !== 'object') continue;
    const dim = entry.dimension as BenchmarkDimension;
    if (!BENCHMARK_DIMENSIONS.includes(dim)) continue;
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
  if (out.length === 0) return DEFAULT_RUBRICS;
  // Backfill any missing dimensions from defaults so the prompt always covers
  // every dimension expected by the scorecard pipeline.
  for (const fallback of DEFAULT_RUBRICS) {
    if (!seen.has(fallback.dimension)) out.push(fallback);
  }
  out.sort(
    (a, b) => BENCHMARK_DIMENSIONS.indexOf(a.dimension) - BENCHMARK_DIMENSIONS.indexOf(b.dimension)
  );
  return out;
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
// Prompt construction
// ---------------------------------------------------------------------------

export function buildJudgeSystemPrompt(): string {
  return [
    'You are an impartial benchmark judge for AI-generated consulting decks.',
    'Score each rubric dimension on a 1.0 to 5.0 scale in 0.5 increments only.',
    'Allowed score values: 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5.',
    'Return JSON only — no markdown, no commentary outside the JSON object.',
    'For every dimension you MUST include: dimension, score, rationale (1-3 sentences),',
    'evidence (an array of short quoted bullets from the deck content), confidence (low|medium|high).',
    'Quote evidence verbatim from the deck rather than paraphrasing.',
    'Never invent slides, brand details, or sources that are not present in the deck.',
    'If you cannot evaluate a dimension, still return a score with confidence "low".',
    'Top-level JSON shape: { "rationale": string, "dimensions": [ ... per-dimension objects ... ] }.',
  ].join(' ');
}

export function buildJudgeUserPrompt(input: BuildJudgePromptInput): string {
  const deck = safeDeck(input?.deck);
  const rubrics = safeRubrics(input?.rubrics);

  const lines: string[] = [];
  lines.push(`Deck title: ${deck.deckTitle || '(untitled)'}`);
  if (deck.deckId) lines.push(`Deck id: ${deck.deckId}`);
  if (deck.templateName) lines.push(`Template: ${deck.templateName}`);
  if (deck.brandKit) {
    const brandParts: string[] = [];
    if (deck.brandKit.primaryColor) brandParts.push(`primaryColor=${deck.brandKit.primaryColor}`);
    if (deck.brandKit.theme) brandParts.push(`theme=${deck.brandKit.theme}`);
    if (brandParts.length > 0) lines.push(`Brand: ${brandParts.join(', ')}`);
  }
  lines.push('');

  lines.push('Rubric (score each on 1.0-5.0 in 0.5 steps):');
  for (const rubric of rubrics) {
    lines.push(`- ${rubric.dimension}: ${rubric.description}`);
    lines.push(`  guidance: ${rubric.scoringGuidance}`);
  }
  lines.push('');

  lines.push('Slides:');
  const slides = deck.slideSummaries.slice(0, MAX_SLIDES_IN_PROMPT);
  if (slides.length === 0) {
    lines.push('(no slides provided)');
  } else {
    for (const slide of slides) {
      const layoutCell = slide.layoutHint ? ` [${slide.layoutHint}]` : '';
      lines.push(`Slide ${slide.index + 1}: ${slide.title}${layoutCell}`);
      const bullets = slide.bullets.slice(0, MAX_BULLETS_PER_SLIDE);
      for (const bullet of bullets) lines.push(`  - ${bullet}`);
      if (slide.bullets.length > MAX_BULLETS_PER_SLIDE) {
        lines.push(`  - …(${slide.bullets.length - MAX_BULLETS_PER_SLIDE} more bullets truncated)`);
      }
    }
    if (deck.slideSummaries.length > MAX_SLIDES_IN_PROMPT) {
      lines.push(
        `(…${deck.slideSummaries.length - MAX_SLIDES_IN_PROMPT} additional slides truncated for cost safety)`
      );
    }
  }
  lines.push('');

  lines.push('Respond with JSON only. Required dimensions in the dimensions array:');
  for (const rubric of rubrics) lines.push(`- ${rubric.dimension}`);

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Response parsing
// ---------------------------------------------------------------------------

export interface ParseJudgeResponseResult {
  status: 'ok' | 'invalid_response';
  scores?: DimensionScoreResult[];
  rationale?: string;
  reason?: string;
}

function stripJsonFences(rawText: string): string {
  const trimmed = rawText.trim();
  // Strip ```json ... ``` or ``` ... ``` fences if present.
  const fenceMatch = trimmed.match(/^```(?:json|JSON)?\s*([\s\S]*?)\s*```$/);
  if (fenceMatch && fenceMatch[1]) return fenceMatch[1].trim();
  return trimmed;
}

function extractJsonObject(rawText: string): string | null {
  const stripped = stripJsonFences(rawText);
  if (stripped.startsWith('{')) return stripped;
  // Best-effort: find the first balanced JSON object.
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
  rubrics: JudgeRubric[] = DEFAULT_RUBRICS
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
  const dimensionsRaw = obj.dimensions ?? obj.scores;
  if (!Array.isArray(dimensionsRaw)) {
    return { status: 'invalid_response', reason: 'missing_dimensions_array' };
  }

  const safeRubric = safeRubrics(rubrics);
  const expected = new Set<BenchmarkDimension>(safeRubric.map((r) => r.dimension));
  const seen = new Map<BenchmarkDimension, DimensionScoreResult>();

  for (const entry of dimensionsRaw) {
    if (!entry || typeof entry !== 'object') {
      return { status: 'invalid_response', reason: 'dimension_entry_not_object' };
    }
    const e = entry as Record<string, unknown>;
    const dim = e.dimension;
    if (typeof dim !== 'string' || !expected.has(dim as BenchmarkDimension)) {
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

    seen.set(dim as BenchmarkDimension, {
      dimension: dim as BenchmarkDimension,
      score: e.score as number,
      rationale,
      evidence,
      confidence,
    });
  }

  for (const dim of expected) {
    if (!seen.has(dim)) {
      return { status: 'invalid_response', reason: `missing_dimension: ${dim}` };
    }
  }

  // Preserve rubric order in the output.
  const ordered: DimensionScoreResult[] = [];
  for (const rubric of safeRubric) {
    const item = seen.get(rubric.dimension);
    if (item) ordered.push(item);
  }

  const rationale = typeof obj.rationale === 'string' ? obj.rationale.trim() : undefined;

  return { status: 'ok', scores: ordered, rationale };
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

export function aggregateScores(scores: DimensionScoreResult[] | undefined | null): JudgeAggregate {
  const empty: JudgeAggregate = {
    contentQuality: 0,
    visualDesign: 0,
    longContextProcessing: 0,
    apiAutomation: 0,
    conversationalEditing: 0,
  };
  if (!Array.isArray(scores) || scores.length === 0) return empty;

  const map = new Map<BenchmarkDimension, number>();
  for (const entry of scores) {
    if (!entry || typeof entry !== 'object') continue;
    if (!BENCHMARK_DIMENSIONS.includes(entry.dimension)) continue;
    if (!isHalfStepInRange(entry.score)) continue;
    map.set(entry.dimension, entry.score);
  }

  return {
    contentQuality: round2(map.get('content_quality') ?? 0),
    visualDesign: round2(map.get('visual_design') ?? 0),
    longContextProcessing: round2(map.get('long_context_processing') ?? 0),
    apiAutomation: round2(map.get('api_automation') ?? 0),
    conversationalEditing: round2(map.get('conversational_editing') ?? 0),
  };
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

export interface JudgeDeckBenchmarkInput {
  adapter: LlmJudgeAdapter;
  deck: JudgeDeckInput;
  rubrics?: JudgeRubric[];
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

export async function judgeDeckBenchmark(input: JudgeDeckBenchmarkInput): Promise<JudgeResult> {
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

  const rubrics = safeRubrics(input.rubrics);
  const deck = safeDeck(input.deck);
  const systemPrompt = buildJudgeSystemPrompt();
  const userPrompt = buildJudgeUserPrompt({ deck, rubrics });
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
      // Adapter rejected — degrade to `unavailable` so callers can branch
      // safely without crashing the pipeline.
      return {
        status: 'unavailable',
        reason: `adapter_error: ${guarded.message}`,
        durationMs: Date.now() - startedAt,
      };
    }
    adapterResult = guarded;
  } catch (error) {
    // Belt-and-braces: timeoutGuard already wraps adapter rejections, but if
    // anything unexpected escapes (e.g. synchronous throw), swallow it.
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

  const parsed = parseJudgeResponse(adapterResult.rawText, rubrics);
  if (parsed.status !== 'ok' || !parsed.scores) {
    return {
      status: 'invalid_response',
      reason: parsed.reason ?? 'parse_failed',
      modelId: adapterResult.modelId,
      durationMs: Date.now() - startedAt,
    };
  }

  return {
    status: 'ok',
    scores: parsed.scores,
    aggregate: aggregateScores(parsed.scores),
    rationale: parsed.rationale,
    modelId: adapterResult.modelId,
    durationMs: Date.now() - startedAt,
  };
}

// ---------------------------------------------------------------------------
// Mapping into the Sprint 15 scorecard input
// ---------------------------------------------------------------------------

export function judgeResultToDeckScoreInput(
  result: JudgeResult,
  deckId: string,
  deckTitle: string
): DeckScoreInput | null {
  if (!result || result.status !== 'ok' || !result.aggregate) return null;
  const safeId = safeString(deckId).trim();
  const safeTitle = safeString(deckTitle).trim();
  if (!safeId) return null;

  const notesParts: string[] = [];
  if (result.rationale) notesParts.push(result.rationale);
  if (result.modelId) notesParts.push(`(model=${result.modelId})`);
  const notes = notesParts.length > 0 ? notesParts.join(' ') : undefined;

  return {
    deckId: safeId,
    deckTitle: safeTitle || safeId,
    contentQuality: result.aggregate.contentQuality,
    visualDesign: result.aggregate.visualDesign,
    longContextProcessing: result.aggregate.longContextProcessing,
    apiAutomation: result.aggregate.apiAutomation,
    conversationalEditing: result.aggregate.conversationalEditing,
    notes,
  };
}
