/**
 * Assessment AI-Guidance Service (per-question, live during scoring)
 *
 * OXFORD R2 #5 — while a consultant is scoring a maturity assessment (DRD / SIRI /
 * ADMA / LEAN), this service answers, per dimension × level, the three questions a
 * good facilitator hears in their head:
 *
 *   1. "why does this question matter"      → whyItMatters   (K2 — meaning)
 *   2. "how do I read this level"           → levelInterpretation (K1+K2)
 *   3. "what does the methodology say here" → canonContext   (K1 — canon fact)
 *
 * The output is a small, substantive object — not a wall of prose — that the runtime
 * can drop next to the level cell. It is grounded ONLY in the framework knowledge base
 * (`getFrameworkKnowledge` — canon questions, worked example, evidence guidance, common
 * mistakes) plus the org profile the caller passes in. Nothing else. This honours the
 * two hard rules of `docs/standards/CONCLUSION_LAYER_STANDARD.md`:
 *   - R5 (numbers only from the engine): the grounding carries no invented figures and
 *     the prompt forbids the model from inventing statistics.
 *   - R1/R4 (no filler, consultant voice, answer-first): validated post-hoc.
 *
 * Fail-safe contract (per task — guidance NEVER blocks scoring):
 *   generate → validate → (on fail) retry once → (still bad / error / timeout)
 *   fall back to a DETERMINISTIC guidance built purely from the knowledge base.
 * A broken or slow LLM degrades to canon-derived guidance; it never throws to the caller.
 *
 * The LLM is INJECTED (`GuidanceLlm`) so:
 *   - the browser bundle never imports the server-only llmService,
 *   - the runtime can wire the existing client wrapper (`sendMessageToAI`, which routes
 *     to the backend AIPipeline) or the server can wire `llmService.call`,
 *   - tests pass a mock.
 *
 * See `assessmentGuidanceRuntime.ts` for the ready-made client wiring.
 */

import { getADMAKnowledge } from './admaKnowledge';
import { getDRDKnowledge } from './drdKnowledge';
import { type FrameworkLevelKnowledge, getFrameworkKnowledge } from './index';
import { getSIRIKnowledge } from './siriKnowledge';

// ============================================================================
// PUBLIC TYPES
// ============================================================================

export type GuidanceFramework = 'DRD' | 'SIRI' | 'ADMA' | 'LEAN' | string;

export type GuidanceConfidence = 'high' | 'medium' | 'low';

/** Source of the returned guidance — telemetry + UI can badge it. */
export type GuidanceSource = 'llm' | 'deterministic';

/** Optional organisation context that sharpens the interpretation (K2 grounding). */
export interface GuidanceOrgContext {
  /** Organisation / client name. */
  name?: string;
  /** Industry segment, e.g. "discrete manufacturing", "process industry". */
  industrySegment?: string;
  /** Size band, e.g. "SME", "mid-market", "enterprise". */
  sizeBand?: string;
}

export interface AssessmentGuidanceInput {
  /** Framework id. Case-insensitive; unknown → generic knowledge fallback. */
  framework: GuidanceFramework;
  /**
   * Dimension / area id as used by the framework knowledge base.
   * DRD → area id ("1A"). SIRI → dimension id ("operations"). ADMA → ("digital_strategy").
   * LEAN → "PHASE#PROCESS" composite.
   */
  dimensionId: string;
  /** Human-readable dimension / area name (for prose grounding). */
  dimensionName?: string;
  /** The level currently in focus (1-based within the framework scale). */
  levelNumber: number;
  /** Level title from canon (e.g. "Integrated", "Level III"). */
  levelTitle?: string;
  /** Level description from canon. */
  levelDescription?: string;
  /** Output language. Defaults to 'pl'. */
  language?: 'pl' | 'en';
  /** Optional org context that grounds the "what it means for THIS firm" angle. */
  org?: GuidanceOrgContext;
}

export interface AssessmentGuidanceOutput {
  /** Answer-first: why this question/dimension matters for the transformation (K2). */
  whyItMatters: string;
  /** How to read / confirm THIS level — evidence to look for, not aspirations (K1+K2). */
  levelInterpretation: string;
  /** Canon context: what the methodology says at this dimension × level (K1). */
  canonContext: string;
  /** Up to 3 canon validation questions (verbatim from the knowledge base). */
  validationQuestions: string[];
  /** Common mis-scoring traps to avoid at this dimension (if the framework has them). */
  pitfalls: string[];
  confidence: GuidanceConfidence;
  source: GuidanceSource;
}

// ============================================================================
// INJECTED LLM
// ============================================================================

/**
 * Minimal LLM contract. Implementations:
 *   - client: wrap `sendMessageToAI(history, message, systemInstruction)` → string.
 *   - server: wrap `llmService.call({ type:'text', ... })` → `{ content }`.
 * Returns the raw assistant text. Any throw / timeout is caught by the service and
 * degrades to the deterministic fallback.
 */
export type GuidanceLlm = (params: {
  systemPrompt: string;
  userPrompt: string;
  /** Soft timeout hint; implementations may honour or ignore it. */
  timeoutMs?: number;
}) => Promise<string>;

export interface AssessmentGuidanceOptions {
  /** Injected LLM. When omitted, the service is deterministic-only. */
  llm?: GuidanceLlm;
  /** Per-call timeout hint (default 20s — interactive; fail fast to fallback). */
  timeoutMs?: number;
  /** Optional structured logger for validation failures / fallbacks. */
  logger?: { warn?: (msg: string, meta?: unknown) => void };
}

// ============================================================================
// GROUNDING
// ============================================================================

/** Richer knowledge shape that SIRI/ADMA expose beyond the universal base. */
interface RichKnowledge extends FrameworkLevelKnowledge {
  evidenceGuidance?: string;
  commonMistakes?: string[];
  levelMeaning?: string;
}

/**
 * Pull the framework knowledge, defensively (never throws).
 *
 * We call the framework-SPECIFIC getters (not only the universal
 * `getFrameworkKnowledge`) because SIRI/ADMA expose the richer fields
 * (`evidenceGuidance`, `levelMeaning`, `commonMistakes`) that the universal
 * getter flattens away — and those fields make the grounding + deterministic
 * fallback substantive rather than generic.
 */
export function resolveKnowledge(
  framework: GuidanceFramework,
  dimensionId: string,
  levelNumber: number
): RichKnowledge {
  const fw = String(framework || '').toLowerCase();
  try {
    if (fw === 'siri') return getSIRIKnowledge(dimensionId, levelNumber) as RichKnowledge;
    if (fw === 'adma') return getADMAKnowledge(dimensionId, levelNumber) as RichKnowledge;
    if (fw === 'drd') return getDRDKnowledge(dimensionId, levelNumber) as RichKnowledge;
    return getFrameworkKnowledge(framework, dimensionId, levelNumber) as RichKnowledge;
  } catch {
    return {
      questions: ['Is this level achieved?', 'Do we have evidence?', 'Is it consistently applied?'],
      example: 'Provide evidence confirming this maturity level.',
      suggestedTechnologies: [],
    };
  }
}

function orgLine(org: GuidanceOrgContext | undefined, isPL: boolean): string {
  if (!org || (!org.name && !org.industrySegment && !org.sizeBand)) {
    return isPL ? 'Organizacja: nieokreślona.' : 'Organisation: unspecified.';
  }
  const parts = [org.name, org.industrySegment, org.sizeBand].filter(Boolean);
  return (isPL ? 'Organizacja: ' : 'Organisation: ') + parts.join(' · ');
}

// ============================================================================
// PROMPT
// ============================================================================

export function buildGuidancePrompt(
  input: AssessmentGuidanceInput,
  knowledge: RichKnowledge
): { systemPrompt: string; userPrompt: string } {
  const isPL = (input.language ?? 'pl') === 'pl';
  const dimName = input.dimensionName || input.dimensionId;
  const levelLabel = input.levelTitle
    ? `${input.levelNumber} (${input.levelTitle})`
    : String(input.levelNumber);

  const groundingLines = [
    `${isPL ? 'Framework' : 'Framework'}: ${String(input.framework).toUpperCase()}`,
    `${isPL ? 'Wymiar' : 'Dimension'}: ${dimName} (${input.dimensionId})`,
    `${isPL ? 'Poziom' : 'Level'}: ${levelLabel}`,
    input.levelDescription
      ? `${isPL ? 'Opis poziomu (kanon)' : 'Level description (canon)'}: ${input.levelDescription}`
      : '',
    knowledge.levelMeaning
      ? `${isPL ? 'Znaczenie poziomu (kanon)' : 'Level meaning (canon)'}: ${knowledge.levelMeaning}`
      : '',
    `${isPL ? 'Przykład potwierdzający (kanon)' : 'Worked example (canon)'}: ${knowledge.example}`,
    knowledge.evidenceGuidance
      ? `${isPL ? 'Czego szukać jako dowodu (kanon)' : 'Evidence to look for (canon)'}: ${knowledge.evidenceGuidance}`
      : '',
    `${isPL ? 'Pytania walidacyjne (kanon)' : 'Validation questions (canon)'}: ${knowledge.questions.join(' | ')}`,
    Array.isArray(knowledge.commonMistakes) && knowledge.commonMistakes.length
      ? `${isPL ? 'Częste błędy oceny (kanon)' : 'Common scoring mistakes (canon)'}: ${knowledge.commonMistakes.join(' | ')}`
      : '',
    orgLine(input.org, isPL),
  ]
    .filter(Boolean)
    .join('\n');

  const systemPrompt = isPL
    ? `Jesteś partnerem firmy doradczej (HBS, MBA, 10 lat praktyki) prowadzącym ocenę dojrzałości cyfrowej. Konsultant właśnie ocenia jeden wymiar na jednym poziomie i potrzebuje krótkiej, MERYTORYCZNEJ podpowiedzi — nie ogólników.
Standard: docs/standards/CONCLUSION_LAYER_STANDARD.md.

ZASADY TWARDE:
- Grounding zamknięty: TYLKO podany kanon i profil organizacji. Nie przywołuj statystyk, benchmarków ani "badań branżowych" spoza wsadu. Nie wymyślaj liczb.
- Answer-first: pierwsze zdanie każdego pola to konkluzja, nie wstęp.
- Zakaz ogólników pasujących do każdej firmy ("popraw procesy", "warto rozważyć", "kluczowe znaczenie"). Konkret: proces, rola, artefakt, dowód.
- Interpretacja poziomu opisuje, jaki DOWÓD potwierdza ten poziom (nie aspiracje) i jak odróżnić go od poziomu niżej/wyżej.
- Zwięźle: whyItMatters ≤ 45 słów, levelInterpretation ≤ 55 słów, canonContext ≤ 45 słów.
- Pisz po polsku (poza słownikiem: KPI, ROI, ERP, MES, WMS, QMS, CMMS, AI, MECE, RACI).
Zwróć WYŁĄCZNIE JSON: { "whyItMatters": string, "levelInterpretation": string, "canonContext": string, "confidence": "high"|"medium"|"low" }. Bez markdown, bez komentarza.`
    : `You are a consulting-firm partner (HBS, MBA, 10 years) running a digital-maturity assessment. A consultant is scoring one dimension at one level and needs a short, SUBSTANTIVE hint — not platitudes.
Standard: docs/standards/CONCLUSION_LAYER_STANDARD.md.

HARD RULES:
- Closed grounding: ONLY the canon and org profile below. Do not cite statistics, benchmarks, or "industry research" outside the input. Do not invent numbers.
- Answer-first: each field opens with the conclusion, not a preamble.
- No filler that fits any company ("improve processes", "worth considering", "is key"). Be concrete: process, role, artefact, evidence.
- The level interpretation must state what EVIDENCE confirms this level (not aspirations) and how to tell it apart from the level below/above.
- Concise: whyItMatters ≤ 45 words, levelInterpretation ≤ 55 words, canonContext ≤ 45 words.
Return ONLY JSON: { "whyItMatters": string, "levelInterpretation": string, "canonContext": string, "confidence": "high"|"medium"|"low" }. No markdown, no commentary.`;

  const userPrompt = `${isPL ? 'KANON I KONTEKST' : 'CANON AND CONTEXT'}:\n${groundingLines}`;

  return { systemPrompt, userPrompt };
}

// ============================================================================
// PARSE + VALIDATE
// ============================================================================

interface RawGuidanceJson {
  whyItMatters?: unknown;
  levelInterpretation?: unknown;
  canonContext?: unknown;
  confidence?: unknown;
}

/** Filler phrases that auto-fail a field (CONCLUSION_LAYER R1). */
const FILLER_PATTERNS: RegExp[] = [
  /popraw(i[cć]|\b)\s+(komunikacj|proces)/i,
  /zoptymalizowa[cć]\s+proces/i,
  /warto\s+(rozwa[zż]y[cć]|zwr[oó]ci[cć])/i,
  /nale[zż]y\s+rozwa[zż]y[cć]/i,
  /kluczowe\s+znaczenie\s+ma/i,
  /w\s+dzisiejszych\s+czasach/i,
  /improve\s+(communication|processes)/i,
  /optimi[sz]e\s+processes/i,
  /worth\s+considering/i,
  /is\s+key\b/i,
  /in\s+today'?s\s+world/i,
];

function hasFiller(text: string): boolean {
  return FILLER_PATTERNS.some((re) => re.test(text));
}

export function parseGuidanceJson(raw: string): RawGuidanceJson | null {
  if (!raw) return null;
  const unfenced = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '');
  const start = unfenced.indexOf('{');
  const end = unfenced.lastIndexOf('}');
  const candidate = start >= 0 && end > start ? unfenced.slice(start, end + 1) : unfenced;
  try {
    const parsed = JSON.parse(candidate);
    return parsed && typeof parsed === 'object' ? (parsed as RawGuidanceJson) : null;
  } catch {
    return null;
  }
}

const VALID_CONFIDENCE: GuidanceConfidence[] = ['high', 'medium', 'low'];

function normConfidence(raw: unknown): GuidanceConfidence {
  const s = String(raw ?? '').toLowerCase() as GuidanceConfidence;
  return VALID_CONFIDENCE.includes(s) ? s : 'medium';
}

interface ValidateResult {
  ok: boolean;
  reason?: string;
  fields?: {
    whyItMatters: string;
    levelInterpretation: string;
    canonContext: string;
    confidence: GuidanceConfidence;
  };
}

/** Validate the parsed model output. Rejects empty/too-short/filler fields. */
export function validateGuidance(parsed: RawGuidanceJson | null): ValidateResult {
  if (!parsed) return { ok: false, reason: 'unparseable_json' };
  const why = String(parsed.whyItMatters ?? '').trim();
  const interp = String(parsed.levelInterpretation ?? '').trim();
  const canon = String(parsed.canonContext ?? '').trim();

  if (!why || !interp || !canon) return { ok: false, reason: 'empty_field' };
  // Guard against one-word / non-answers.
  if (why.length < 12 || interp.length < 12 || canon.length < 12) {
    return { ok: false, reason: 'too_short' };
  }
  for (const [name, text] of [
    ['whyItMatters', why],
    ['levelInterpretation', interp],
    ['canonContext', canon],
  ] as const) {
    if (hasFiller(text)) return { ok: false, reason: `filler:${name}` };
  }
  return {
    ok: true,
    fields: {
      whyItMatters: why,
      levelInterpretation: interp,
      canonContext: canon,
      confidence: normConfidence(parsed.confidence),
    },
  };
}

// ============================================================================
// DETERMINISTIC FALLBACK (canon-derived; never empty, never generic-only)
// ============================================================================

/**
 * Build guidance purely from the knowledge base. Substantive because the knowledge
 * base itself is canon-sourced (worked example, evidence guidance, validation
 * questions, common mistakes). Used when no LLM is wired or the LLM fails.
 */
export function deterministicGuidance(
  input: AssessmentGuidanceInput,
  knowledge: RichKnowledge
): AssessmentGuidanceOutput {
  const isPL = (input.language ?? 'pl') === 'pl';
  const dimName = input.dimensionName || input.dimensionId;
  const levelLabel = input.levelTitle
    ? `${input.levelNumber} — ${input.levelTitle}`
    : String(input.levelNumber);

  const evidence =
    knowledge.evidenceGuidance ||
    (isPL
      ? 'Szukaj udokumentowanego procesu, systemu w realnym użyciu i mierzalnego wyniku — nie deklaracji.'
      : 'Look for a documented process, a system in real use, and a measurable outcome — not declarations.');

  const meaning =
    knowledge.levelMeaning ||
    (input.levelDescription
      ? input.levelDescription
      : isPL
        ? `Poziom ${levelLabel} w wymiarze „${dimName}".`
        : `Level ${levelLabel} in dimension "${dimName}".`);

  const whyItMatters = isPL
    ? `„${dimName}" decyduje o zdolności organizacji na tym odcinku transformacji; poziom oceny wprost przekłada się na to, które inicjatywy są realne, a które przedwczesne. Oceniaj po dowodzie, nie po ambicji.`
    : `"${dimName}" gates the organisation's capability on this stretch of the transformation; the score directly determines which initiatives are feasible vs premature. Score on evidence, not ambition.`;

  const levelInterpretation = isPL
    ? `Aby potwierdzić poziom ${levelLabel}: ${evidence} Przykład: ${knowledge.example}`
    : `To confirm level ${levelLabel}: ${evidence} Example: ${knowledge.example}`;

  const canonContext = isPL
    ? `Wg kanonu ${String(input.framework).toUpperCase()}: ${meaning}`
    : `Per ${String(input.framework).toUpperCase()} canon: ${meaning}`;

  const pitfalls =
    Array.isArray(knowledge.commonMistakes) && knowledge.commonMistakes.length
      ? knowledge.commonMistakes.slice(0, 3)
      : isPL
        ? [
            'Oceniaj stan faktyczny, nie plany.',
            'Weryfikuj dowodem, nie percepcją zarządu.',
            'Sprawdź spójność w całej organizacji, nie w jednym zespole.',
          ]
        : [
            'Score actual practice, not plans.',
            'Verify with evidence, not management perception.',
            'Check consistency across the whole org, not one team.',
          ];

  return {
    whyItMatters,
    levelInterpretation,
    canonContext,
    validationQuestions: (knowledge.questions || []).slice(0, 3),
    pitfalls,
    confidence: knowledge.evidenceGuidance || knowledge.levelMeaning ? 'medium' : 'low',
    source: 'deterministic',
  };
}

// ============================================================================
// PUBLIC ENTRY
// ============================================================================

/**
 * Get per-question AI guidance for one dimension × level. Never throws.
 * With an injected LLM: generate → validate → retry once → deterministic fallback.
 * Without an LLM: deterministic guidance from the knowledge base.
 */
export async function getAssessmentGuidance(
  input: AssessmentGuidanceInput,
  options: AssessmentGuidanceOptions = {}
): Promise<AssessmentGuidanceOutput> {
  const { llm, timeoutMs = 20_000, logger } = options;
  const knowledge = resolveKnowledge(input.framework, input.dimensionId, input.levelNumber);
  const fallback = () => deterministicGuidance(input, knowledge);

  if (!llm) return fallback();

  const { systemPrompt, userPrompt } = buildGuidancePrompt(input, knowledge);

  const attempt = async (): Promise<ValidateResult> => {
    const raw = await llm({ systemPrompt, userPrompt, timeoutMs });
    return validateGuidance(parseGuidanceJson(String(raw ?? '')));
  };

  try {
    let res = await attempt();
    if (!res.ok) {
      logger?.warn?.('AssessmentGuidance: validation failed, retrying', {
        framework: input.framework,
        dimensionId: input.dimensionId,
        level: input.levelNumber,
        reason: res.reason,
      });
      res = await attempt();
    }
    if (res.ok && res.fields) {
      return {
        whyItMatters: res.fields.whyItMatters,
        levelInterpretation: res.fields.levelInterpretation,
        canonContext: res.fields.canonContext,
        validationQuestions: (knowledge.questions || []).slice(0, 3),
        pitfalls:
          Array.isArray(knowledge.commonMistakes) && knowledge.commonMistakes.length
            ? knowledge.commonMistakes.slice(0, 3)
            : deterministicGuidance(input, knowledge).pitfalls,
        confidence: res.fields.confidence,
        source: 'llm',
      };
    }
    logger?.warn?.('AssessmentGuidance: fallback to deterministic', {
      framework: input.framework,
      reason: res.reason,
    });
    return fallback();
  } catch (err) {
    logger?.warn?.('AssessmentGuidance: LLM error, fallback to deterministic', {
      framework: input.framework,
      error: (err as Error)?.message,
    });
    return fallback();
  }
}
