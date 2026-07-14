/**
 * DRD Report — LLM narrator (Conclusion Layer, live wiring)
 *
 * Turns the deterministic, engine-grounded `ConclusionInput` into consultant-grade
 * prose by calling an LLM — while enforcing the two hard rules of
 * `docs/standards/CONCLUSION_LAYER_STANDARD.md`:
 *
 *   R5 "liczby TYLKO z silnika": every number that appears in the generated prose
 *      MUST also appear in the engine-supplied `facts`. The `numbers_from_engine`
 *      validator (§4.4) diffs the numeric tokens of the output against the facts;
 *      any invented figure fails the output.
 *   R2 "przyczynowość": every thesis carries `factRefs` pointing at existing facts
 *      (`evidence_link`, §4.4). A thesis whose factRefs are empty or dangling fails.
 *
 * Fail-safe contract (per task): a bad or slow LLM NEVER breaks report generation.
 *   generate → validate → (on fail) retry once → (still bad / error) fall back to
 *   the deterministic stub, tagged `narrative: 'deterministic'`.
 *
 * The LLM is wired through the existing `llmService` (`server/src/services/ai/
 * llmService.ts`). Known pitfalls handled here:
 *   - heavy call → `timeoutMs` override (~120s) so a long generation is not killed
 *     at the default 60s (see llmService.callText).
 *   - we do NOT use tool-calling / maxSteps here (plain `type: 'text'`), so the
 *     `stopWhen: stepCountIs` / empty-stream traps do not apply.
 *
 * Dependency is injected (`LlmLike`) so the browser bundle never imports the
 * server-only llmService, and tests can pass a mock.
 */

import {
  type ConclusionConfidence,
  type ConclusionEvidenceRef,
  type ConclusionInput,
  type ConclusionOutput,
  deterministicNarrator,
  type DrdNarrator,
} from './drdConclusionContract.js';

/** Minimal shape of the injected llmService (`llmService.call`). */
export interface LlmLike {
  call(params: {
    type: string;
    modelConfig: { id?: string; provider?: string; [k: string]: unknown };
    systemPrompt?: string;
    messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
    maxTokens?: number;
    temperature?: number;
    timeoutMs?: number;
    [k: string]: unknown;
  }): Promise<Record<string, unknown>>;
}

export interface DrdLlmNarratorOptions {
  /** Injected LLM client (server: llmService; tests: mock). */
  llm: LlmLike;
  /** Model tier/config. Defaults to the shared 'standard' tier. */
  modelConfig?: { id?: string; provider?: string; [k: string]: unknown };
  /** Per-call timeout. Heavy report prose → default 120s (llmService pitfall). */
  timeoutMs?: number;
  /** Sampling temperature for prose. */
  temperature?: number;
  /** Optional structured logger for validation failures / fallbacks. */
  logger?: { warn?: (msg: string, meta?: unknown) => void };
}

/** The JSON shape we ask the model to return. */
interface LlmNarrativeJson {
  paragraphs?: unknown;
  /** factRefs per thesis — array-of-arrays aligned to paragraphs, OR a flat list. */
  factRefs?: unknown;
  confidence?: unknown;
  limits?: unknown;
}

const VALID_CONFIDENCE: ConclusionConfidence[] = [
  'high',
  'medium',
  'low',
  'insufficient',
  'contradicted',
];

/** Expected paragraph count per kind (matches the deterministic stub / spec). */
function expectedParagraphs(kind: ConclusionInput['kind']): number {
  if (kind === 'executive_summary') return 5; // DRD_REPORT_SPEC §S2
  if (kind === 'gap_card') return 4; // co-jest → co-znaczy → co-robić → efekt
  return 1; // dimension_chapter verdict header + table intro
}

/**
 * Extract every numeric token from a string, NORMALIZED for a tolerant diff.
 * Handles PL/EN decimal separators (comma/dot), thousands separators, and the
 * "3/7" level notation (each side is its own number). Percent signs and level
 * denominators are stripped to bare numbers. Returns a set of canonical strings.
 *
 * Tolerance: trailing ".0" is dropped so "6" and "6.0" match; leading zeros are
 * normalized. This is the `numbers_from_engine` diff basis (§4.4 "tolerancja
 * formatu/zaokrągleń").
 */
export function extractNumbers(text: string): Set<string> {
  const out = new Set<string>();
  if (!text) return out;
  // Match integers/decimals with optional thousands + decimal separators.
  // e.g. 42, 42%, 3/7, 1,2, 1.234,5, 38
  const re = /\d[\d.,]*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const raw = m[0];
    // A token like "1.234,5" (EU) or "1,234.5" (US) → strip grouping, keep decimal.
    const canon = canonicalNumber(raw);
    if (canon !== null) out.add(canon);
  }
  return out;
}

/** Canonicalize a numeric token to a comparable string (or null if not a number). */
function canonicalNumber(raw: string): string | null {
  let s = raw.trim().replace(/[%]/g, '');
  if (!s) return null;
  // Trailing separators (e.g. end-of-sentence "42.") are not part of the number.
  s = s.replace(/[.,]+$/, '');
  if (!s) return null;

  const hasComma = s.includes(',');
  const hasDot = s.includes('.');
  if (hasComma && hasDot) {
    // Both present: the LAST separator is the decimal point.
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      // EU: dot=grouping, comma=decimal
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      // US: comma=grouping, dot=decimal
      s = s.replace(/,/g, '');
    }
  } else if (hasComma) {
    // Only comma: decimal separator (PL) unless it looks like grouping (1,234).
    // Treat a single comma with exactly 3 trailing digits as grouping.
    if (/^\d{1,3}(,\d{3})+$/.test(s)) s = s.replace(/,/g, '');
    else s = s.replace(',', '.');
  }
  // Only dot (or none) → already canonical form for parseFloat.
  const n = Number.parseFloat(s);
  if (!Number.isFinite(n)) return null;
  // Drop trailing zeros: 6.0 → "6", 6.50 → "6.5".
  return String(n);
}

/** Collect every numeric token present in the engine facts (the allow-set). */
export function numbersFromFacts(facts: Record<string, unknown>): Set<string> {
  const out = new Set<string>();
  const visit = (v: unknown) => {
    if (v === null || v === undefined) return;
    if (typeof v === 'number' && Number.isFinite(v)) {
      out.add(String(v));
      // Also register common derived forms the prose may legitimately use:
      // rounded integer and 1-decimal rounding of an engine number.
      out.add(String(Math.round(v)));
      out.add(String(Math.round(v * 10) / 10));
      return;
    }
    if (typeof v === 'string') {
      for (const t of extractNumbers(v)) out.add(t);
      return;
    }
    if (Array.isArray(v)) {
      for (const x of v) visit(x);
      return;
    }
    if (typeof v === 'object') {
      for (const x of Object.values(v as Record<string, unknown>)) visit(x);
    }
  };
  visit(facts);
  return out;
}

export interface NumbersValidation {
  ok: boolean;
  /** Numbers found in prose that are NOT present in the engine facts. */
  offenders: string[];
}

/**
 * `numbers_from_engine` validator (§4.4, HARD). Every number in the prose must
 * appear in the engine facts. Also accepts small-integer "counting words" that
 * the spec text itself uses structurally (e.g. "7 osi", "3 fale") — these are
 * part of the fixed methodology, not client figures, and are always allowed.
 */
export function validateNumbersFromEngine(
  paragraphs: string[],
  facts: Record<string, unknown>
): NumbersValidation {
  const allowed = numbersFromFacts(facts);
  // Structural constants of the DRD methodology / wave model that appear in
  // prose regardless of client data (7 axes, 3 waves F1–F3, 39 areas, scale 1–5/7).
  for (const c of ['1', '2', '3', '4', '5', '6', '7', '8', '39']) allowed.add(c);
  const offenders: string[] = [];
  for (const p of paragraphs) {
    for (const n of extractNumbers(p)) {
      if (!allowed.has(n)) offenders.push(n);
    }
  }
  return { ok: offenders.length === 0, offenders: [...new Set(offenders)] };
}

export interface FactRefsValidation {
  ok: boolean;
  /** factRefs referenced by the model that do not exist in the input evidence/facts. */
  dangling: string[];
  /** true when at least one valid factRef backs the theses (evidence_link). */
  hasAny: boolean;
}

/**
 * `evidence_link` validator (§4.4): every factRef must resolve to a real fact —
 * either an evidence `ref` (area/axis id) or a top-level facts key. At least one
 * valid factRef must back the theses.
 */
export function validateFactRefs(factRefs: string[], input: ConclusionInput): FactRefsValidation {
  const known = new Set<string>();
  for (const e of input.evidence) known.add(String(e.ref));
  for (const k of Object.keys(input.facts)) known.add(k);
  const dangling: string[] = [];
  let valid = 0;
  for (const r of factRefs) {
    const ref = String(r).trim();
    if (!ref) continue;
    if (known.has(ref)) valid++;
    else dangling.push(ref);
  }
  return {
    ok: dangling.length === 0 && valid > 0,
    dangling: [...new Set(dangling)],
    hasAny: valid > 0,
  };
}

/** Flatten the model's factRefs (array-of-arrays or flat) into a string list. */
function flattenFactRefs(raw: unknown): string[] {
  if (!raw) return [];
  const out: string[] = [];
  const push = (v: unknown) => {
    if (typeof v === 'string' || typeof v === 'number') out.push(String(v));
  };
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (Array.isArray(item)) item.forEach(push);
      else push(item);
    }
  }
  return out;
}

/** Build the grounded system + user prompt for a given ConclusionInput. */
export function buildNarratorPrompt(input: ConclusionInput): {
  systemPrompt: string;
  userPrompt: string;
} {
  const isPL = input.language === 'pl';
  const nParas = expectedParagraphs(input.kind);
  const factsJson = JSON.stringify(input.facts, null, 2);
  const evidenceJson = JSON.stringify(
    input.evidence.map((e) => ({ ref: e.ref, type: e.type, excerpt: e.excerpt ?? undefined })),
    null,
    2
  );

  const langRule = isPL
    ? 'Pisz WYŁĄCZNIE po polsku (poza słownikiem terminów: KPI, ROI, ERP, MES, AI, MECE, RACI, CAPEX/OPEX).'
    : 'Write in English.';

  const kindShape = describeKind(input.kind, isPL, nParas);

  const systemPrompt = isPL
    ? `Jesteś partnerem firmy doradczej (HBS, MBA, 10 lat praktyki). Piszesz wniosek, który podpiszesz własnym nazwiskiem przed zarządem ${input.organizationName}.
Standard: docs/standards/CONCLUSION_LAYER_STANDARD.md — formuła K1→K2→K3→K4.

ZASADY TWARDE:
- Liczby WYŁĄCZNIE z podanych "facts" — nie licz, nie szacuj, nie przywołuj statystyk spoza wsadu. Każda liczba w tekście MUSI występować w "facts".
- Grounding zamknięty: tylko "facts" + "evidence". Nic więcej. Zakaz "badań branżowych".
- Każda teza wskazuje dowód: zwróć "factRefs" — klucze z "facts" lub "ref" z "evidence", które podpierają tezy.
- Zakaz ogólników pasujących do każdej firmy. Answer-first (pierwsze zdanie = konkluzja).
- ${langRule}
Zwróć WYŁĄCZNIE JSON: { "paragraphs": string[], "factRefs": string[], "confidence": "high"|"medium"|"low"|"insufficient", "limits": string }. Bez markdown, bez komentarza.`
    : `You are a consulting-firm partner (HBS, MBA, 10 years of practice). You write a conclusion you would sign with your own name before ${input.organizationName}'s board.
Standard: docs/standards/CONCLUSION_LAYER_STANDARD.md — formula K1→K2→K3→K4.

HARD RULES:
- Numbers ONLY from the given "facts" — do not compute, estimate, or cite statistics outside the input. Every number in the text MUST appear in "facts".
- Closed grounding: only "facts" + "evidence". Nothing else. No "industry research".
- Every thesis carries its evidence: return "factRefs" — keys from "facts" or "ref" from "evidence" that back the theses.
- No filler that fits any company. Answer-first (first sentence = the conclusion).
- ${langRule}
Return ONLY JSON: { "paragraphs": string[], "factRefs": string[], "confidence": "high"|"medium"|"low"|"insufficient", "limits": string }. No markdown, no commentary.`;

  const userPrompt = `${kindShape}

facts:
${factsJson}

evidence:
${evidenceJson}`;

  return { systemPrompt, userPrompt };
}

function describeKind(kind: ConclusionInput['kind'], isPL: boolean, nParas: number): string {
  if (kind === 'executive_summary') {
    return isPL
      ? `Napisz streszczenie zarządcze diagnozy DRD. Dokładnie ${nParas} akapitów (paragraphs[${nParas}]), razem ≤ 350 słów: 1) STAN, 2) CO TO ZNACZY, 3) TRZY LUKI, 4) CO NAJPIERW, 5) EFEKT z horyzontem.`
      : `Write the DRD executive summary. Exactly ${nParas} paragraphs (paragraphs[${nParas}]), ≤ 350 words total: 1) STATE, 2) MEANING, 3) THREE GAPS, 4) WHAT FIRST, 5) EFFECT with horizon.`;
  }
  if (kind === 'gap_card') {
    return isPL
      ? `Napisz kartę luki. Dokładnie ${nParas} akapitów (paragraphs[${nParas}]) w kolejności: CO JEST, CO TO ZNACZY, CO ROBIĆ NAJPIERW (z rolą), JAKI EFEKT (z horyzontem).`
      : `Write a gap card. Exactly ${nParas} paragraphs (paragraphs[${nParas}]) in order: WHAT IS, WHAT IT MEANS, WHAT TO DO FIRST (with owner role), WHAT EFFECT (with horizon).`;
  }
  return isPL
    ? `Napisz nagłówek-werdykt osi (paragraphs[${nParas}], ≤ 20 słów, wniosek nie opis) wprowadzający tabelę obszarów.`
    : `Write the axis verdict header (paragraphs[${nParas}], ≤ 20 words, conclusion not description) introducing the area table.`;
}

/** Parse the model's raw text into the narrative JSON (tolerant of ```json fences). */
export function parseNarrativeJson(raw: string): LlmNarrativeJson | null {
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
    return parsed && typeof parsed === 'object' ? (parsed as LlmNarrativeJson) : null;
  } catch {
    return null;
  }
}

function normalizeParagraphs(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((p) => String(p ?? '').trim()).filter(Boolean);
  if (typeof raw === 'string' && raw.trim()) return [raw.trim()];
  return [];
}

function normalizeConfidence(raw: unknown): ConclusionConfidence {
  const s = String(raw ?? '').toLowerCase() as ConclusionConfidence;
  return VALID_CONFIDENCE.includes(s) ? s : 'medium';
}

interface ValidationResult {
  ok: boolean;
  output?: ConclusionOutput;
  reason?: string;
}

/**
 * Validate a parsed model response into a ConclusionOutput, or reject with a
 * reason so the caller can retry / fall back. Runs the `numbers_from_engine`
 * (hard) and `evidence_link` validators.
 */
export function validateNarrative(
  parsed: LlmNarrativeJson | null,
  input: ConclusionInput
): ValidationResult {
  if (!parsed) return { ok: false, reason: 'unparseable_json' };

  const paragraphs = normalizeParagraphs(parsed.paragraphs);
  if (paragraphs.length === 0) return { ok: false, reason: 'empty_paragraphs' };

  const expected = expectedParagraphs(input.kind);
  if (paragraphs.length !== expected) {
    return { ok: false, reason: `paragraph_count:${paragraphs.length}!=${expected}` };
  }

  // numbers_from_engine (HARD) — no invented figures.
  const nums = validateNumbersFromEngine(paragraphs, input.facts);
  if (!nums.ok) {
    return { ok: false, reason: `numbers_from_engine:${nums.offenders.join(',')}` };
  }

  // evidence_link — theses must be backed by ≥1 existing factRef.
  const factRefs = flattenFactRefs(parsed.factRefs);
  const refs = validateFactRefs(factRefs, input);
  if (!refs.ok) {
    return {
      ok: false,
      reason: refs.hasAny ? `dangling_factrefs:${refs.dangling.join(',')}` : 'no_factrefs',
    };
  }

  const output: ConclusionOutput = {
    paragraphs,
    confidence: normalizeConfidence(parsed.confidence),
    limits:
      typeof parsed.limits === 'string' && parsed.limits.trim()
        ? parsed.limits.trim()
        : input.language === 'pl'
          ? 'Interpretacja oparta na danych assessmentu; zaleca się walidację warsztatową.'
          : 'Interpretation based on assessment data; workshop validation recommended.',
    // Evidence carried through, enriched with the validated factRefs.
    evidence: buildEvidence(input.evidence, factRefs),
    aiGenerated: true,
    narrative: 'llm',
  };
  return { ok: true, output };
}

/** Merge input evidence with any additional valid factRefs the model cited. */
function buildEvidence(base: ConclusionEvidenceRef[], factRefs: string[]): ConclusionEvidenceRef[] {
  const byRef = new Map<string, ConclusionEvidenceRef>();
  for (const e of base) byRef.set(String(e.ref), e);
  const out: ConclusionEvidenceRef[] = [...base];
  for (const r of factRefs) {
    const ref = String(r);
    if (!byRef.has(ref)) {
      out.push({ type: 'fact_ref', ref });
      byRef.set(ref, out[out.length - 1]);
    }
  }
  return out;
}

/**
 * Build a live, fail-safe LLM narrator. On any failure (parse, validation twice,
 * or thrown error / timeout) it returns the deterministic stub result — so a
 * broken LLM never breaks report generation.
 */
export function makeLlmNarrator(options: DrdLlmNarratorOptions): DrdNarrator {
  const {
    llm,
    modelConfig = { id: 'standard' },
    timeoutMs = 120_000,
    temperature = 0.4,
    logger,
  } = options;

  return async (input: ConclusionInput): Promise<ConclusionOutput> => {
    const fallback = (): ConclusionOutput => {
      const stub = deterministicNarrator(input);
      // stub is sync for our kinds; guard anyway.
      return stub as ConclusionOutput;
    };

    const { systemPrompt, userPrompt } = buildNarratorPrompt(input);

    const attempt = async (): Promise<ValidationResult> => {
      const result = await llm.call({
        type: 'text',
        modelConfig,
        systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        maxTokens: input.kind === 'executive_summary' ? 1400 : 800,
        temperature,
        timeoutMs,
      });
      const raw = String((result as { content?: unknown })?.content ?? '');
      return validateNarrative(parseNarrativeJson(raw), input);
    };

    try {
      let res = await attempt();
      if (!res.ok) {
        logger?.warn?.('DrdLlmNarrator: validation failed, retrying', {
          kind: input.kind,
          reason: res.reason,
        });
        res = await attempt();
      }
      if (res.ok && res.output) return res.output;
      logger?.warn?.('DrdLlmNarrator: fallback to deterministic stub', {
        kind: input.kind,
        reason: res.reason,
      });
      return fallback();
    } catch (err) {
      logger?.warn?.('DrdLlmNarrator: LLM error, fallback to deterministic stub', {
        kind: input.kind,
        error: (err as Error)?.message,
      });
      return fallback();
    }
  };
}
