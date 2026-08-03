/**
 * Deck — CONCLUSION LAYER slide (Oxford O2.5).
 *
 * PROBLEM (audit): a deck generated from chat is a SECTION COLLAGE — cover,
 * exec-summary, key-messages, source-driven charts, next-steps. The
 * `key_messages` slide lists generic findings; nothing builds the CONCLUSION
 * layer (`docs/standards/CONCLUSION_LAYER_STANDARD.md` §W5 deck variant):
 * a "Wnioski" slide whose body is the K1→K4 chain — WERDYKT (co jest) →
 * DLACZEGO (co to znaczy) → CO ROBIĆ (max 3 akcje z rolą) → HORYZONT (jaki
 * efekt, z terminem). Per §W5 a management deck ends on "Co robić najpierw"
 * (K3) + "Czego oczekiwać" (K4) — never a "Thank you" slide.
 *
 * This module builds exactly that slide, ADDITIVELY:
 *   - It reuses an EXISTING slide shape (`intent: 'key_messages'`) so the whole
 *     downstream pipeline (PPTX renderer, DeckDocument normalizer, FE) renders
 *     it with ZERO type changes — the K-structure lives in the message content
 *     plus a machine-readable `_conclusion` envelope on the slide (same pattern
 *     as the existing `_narrative_enrichment` field).
 *   - GROUNDING ("liczby tylko z wejścia"): every number in the prose must come
 *     from the deck's own facts (artifactData + ContextPack). This is enforced
 *     by the SAME server twin used by the report/finance conclusion paths —
 *     `validateConclusion` (`conclusionValidators.ts`, the K1→K4 lint).
 *   - The DETERMINISTIC builder is the fail-safe: it composes a grounded K1→K4
 *     purely from facts and passes every hard validator by construction. An
 *     optional LLM elevation (injected `LlmLike`, mirrors `drdLlmNarrator`)
 *     rewrites the prose consultant-grade; on parse/validation failure OR any
 *     provider error it falls back to the deterministic conclusion — a broken
 *     or slow model NEVER breaks deck generation.
 */

import {
  type ConclusionValidationReport,
  type ValidatableConclusion,
  validateConclusion,
} from '../conclusionValidators.js';

// ---------------------------------------------------------------------------
// Injected LLM client (structural — the browser bundle never imports the
// server-only llmService; tests pass a mock or omit it entirely).
// ---------------------------------------------------------------------------

export interface DeckConclusionLlm {
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

// ---------------------------------------------------------------------------
// Facts — the grounded, engine-supplied context (numbers-from-engine pool).
// ---------------------------------------------------------------------------

export interface DeckConclusionKpiFact {
  label: string;
  value: number | string;
  unit?: string;
  target?: number | string;
  trend?: string;
}

export interface DeckConclusionFacts {
  orgName: string;
  language: 'pl' | 'en';
  keyFindings: string[];
  kpis: DeckConclusionKpiFact[];
  recommendation: string | null;
  overallScore: number | null;
  maxScore: number | null;
  initiativesCount: number;
  risksCount: number;
}

/** A K3 action: verb + object + responsible role + why-it-is-first. */
export interface DeckConclusionAction {
  action: string;
  whyFirst: string;
  ownerRole: string;
}

/** The K1→K4 conclusion the slide renders. */
export interface DeckConclusion {
  headline: string;
  k1Text: string;
  k2Text: string;
  k3Actions: DeckConclusionAction[];
  k4Text: string;
  k4Horizon: string;
  confidence: 'high' | 'medium' | 'low' | 'insufficient';
  factRefs: string[];
  source: 'llm' | 'deterministic';
}

const LOG_PREFIX = '[DeckConclusion]';

function num(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value.replace(',', '.')) : Number(value);
  return Number.isFinite(n) ? n : null;
}

function nonEmpty(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

// ---------------------------------------------------------------------------
// 1) FACTS — gather the grounded pool from the deck's own inputs.
// ---------------------------------------------------------------------------

/**
 * Build the grounded facts pool from the deck's `artifactData` (loaded by
 * `loadArtifactData`) and the ContextPack. Numbers here are the ONLY numbers the
 * conclusion prose is allowed to use.
 */
export function buildDeckConclusionFacts(params: {
  language: 'pl' | 'en';
  artifactData: Record<string, unknown>;
  contextPack?: {
    key_points?: string[];
    data_points?: ReadonlyArray<{
      label?: unknown;
      value?: unknown;
      unit?: unknown;
      trend?: unknown;
    }>;
  } | null;
}): DeckConclusionFacts {
  const a = params.artifactData || {};
  const cp = params.contextPack || {};

  const keyFindings: string[] = [];
  if (Array.isArray(a._keyFindings)) {
    for (const f of a._keyFindings) {
      const s = nonEmpty(typeof f === 'string' ? f : ((f as any)?.text ?? (f as any)?.title));
      if (s) keyFindings.push(s);
    }
  }
  if (keyFindings.length === 0 && Array.isArray(cp.key_points)) {
    for (const kp of cp.key_points) {
      const s = nonEmpty(kp);
      if (s) keyFindings.push(s);
    }
  }

  const kpis: DeckConclusionKpiFact[] = [];
  const rawKpis = Array.isArray(a._kpis)
    ? a._kpis
    : Array.isArray(a._performanceKpis)
      ? a._performanceKpis
      : [];
  for (const k of rawKpis as Array<Record<string, unknown>>) {
    const label = nonEmpty(k?.label) || nonEmpty(k?.name);
    if (!label) continue;
    kpis.push({
      label,
      value: (k?.value as number | string) ?? '',
      unit: nonEmpty(k?.unit) || undefined,
      target: (k?.target as number | string) ?? undefined,
      trend: nonEmpty(k?.trend) || undefined,
    });
  }
  if (kpis.length === 0 && Array.isArray(cp.data_points)) {
    for (const dp of cp.data_points) {
      const label = nonEmpty(dp?.label);
      if (!label) continue;
      kpis.push({
        label,
        value: (dp?.value as number | string) ?? '',
        unit: nonEmpty(dp?.unit) || undefined,
        trend: nonEmpty(dp?.trend) || undefined,
      });
    }
  }

  const initiativesCount = Array.isArray(a._initiatives) ? a._initiatives.length : 0;
  const risksCount = Array.isArray(a._risks) ? a._risks.length : 0;

  return {
    orgName: nonEmpty(a._orgName) || 'Organization',
    language: params.language,
    keyFindings: keyFindings.slice(0, 5),
    kpis: kpis.slice(0, 4),
    recommendation: nonEmpty(a._recommendation),
    overallScore: num(a._overallScore),
    maxScore: num(a._maxScore),
    initiativesCount,
    risksCount,
  };
}

/**
 * The numbers-from-engine pool the validator diffs prose numbers against
 * (`numbers_from_engine`). It carries EVERY engine-originated fact the
 * conclusion may quote verbatim — not just bare numeric fields but the full KPI
 * objects (incl. `label`), the key findings, and the recommendation. This is
 * deliberate: those strings come straight from the DB/engine, so a digit that
 * rides inside one (e.g. a KPI named "CO2 emissions" or "ISO 27001") is
 * legitimately "from the engine", never a fabricated figure. flattenFactNumbers
 * walks the strings and registers those digits, so embedding an engine label in
 * prose can never be misread as an invented number.
 */
function factsPool(facts: DeckConclusionFacts): Record<string, unknown> {
  return {
    initiativesCount: facts.initiativesCount,
    risksCount: facts.risksCount,
    findingsCount: facts.keyFindings.length,
    overallScore: facts.overallScore,
    maxScore: facts.maxScore,
    kpis: facts.kpis,
    keyFindings: facts.keyFindings,
    recommendation: facts.recommendation,
    orgName: facts.orgName,
  };
}

/** Fact keys that back the interpretation (evidence_link). */
function factRefs(facts: DeckConclusionFacts): string[] {
  const refs: string[] = ['initiativesCount', 'risksCount'];
  if (facts.overallScore !== null) refs.push('overallScore');
  if (facts.keyFindings.length > 0) refs.push('keyFindings');
  if (facts.kpis.length > 0) refs.push('kpis');
  return refs;
}

// ---------------------------------------------------------------------------
// 2) DETERMINISTIC builder — grounded K1→K4, passes every hard validator.
// ---------------------------------------------------------------------------

function deriveConfidence(facts: DeckConclusionFacts): DeckConclusion['confidence'] {
  const signals =
    facts.keyFindings.length + facts.kpis.length + facts.initiativesCount + facts.risksCount;
  if (signals === 0) return 'insufficient';
  if (facts.initiativesCount >= 3 || facts.keyFindings.length >= 3 || facts.kpis.length >= 2)
    return 'medium';
  return 'low';
}

export function buildDeterministicDeckConclusion(facts: DeckConclusionFacts): DeckConclusion {
  const isPl = facts.language === 'pl';
  const confidence = deriveConfidence(facts);
  const weak = confidence === 'low' || confidence === 'insufficient';
  const topFinding = facts.keyFindings[0] || null;
  const topKpi = facts.kpis[0] || null;

  // Hedge phrase required by `confidence_honest` when confidence is weak.
  const hedge = isPl
    ? ' Wnioski wg deklaracji, do potwierdzenia warsztatem.'
    : ' Findings are declared, to be confirmed in a workshop.';

  const scorePart =
    facts.overallScore !== null && facts.maxScore !== null
      ? isPl
        ? ` Ocena dojrzałości: ${facts.overallScore}/${facts.maxScore}.`
        : ` Maturity score: ${facts.overallScore}/${facts.maxScore}.`
      : '';

  const headline = isPl
    ? 'Priorytetem jest uruchomienie Fali 1 i domknięcie luk, które dziś blokują postęp.'
    : 'The priority is to launch Wave 1 and close the gaps that block progress today.';

  const k1Text = isPl
    ? `Diagnoza objęła portfel ${facts.initiativesCount} inicjatyw i ${facts.risksCount} ryzyk.${scorePart} ${
        topFinding ? `Wiodące ustalenie: ${topFinding}.` : 'Materiał źródłowy jest częściowy.'
      }`
    : `The diagnosis covered a portfolio of ${facts.initiativesCount} initiatives and ${facts.risksCount} risks.${scorePart} ${
        topFinding ? `Leading finding: ${topFinding}.` : 'The source material is partial.'
      }`;

  const kpiClause = topKpi
    ? isPl
      ? ` Wskaźnik ${topKpi.label} pozostaje pod presją.`
      : ` The ${topKpi.label} indicator stays under pressure.`
    : '';

  const k2Text =
    (isPl
      ? `Rozłożenie postępu na ${facts.initiativesCount} inicjatyw bez domknięcia luk o najwyższej dźwigni wydłuża czas do efektu i rozprasza zasoby zespołu.${kpiClause}`
      : `Spreading progress across ${facts.initiativesCount} initiatives without closing the highest-leverage gaps lengthens time-to-impact and scatters the team's resources.${kpiClause}`) +
    (weak ? hedge : '');

  const k3Actions: DeckConclusionAction[] = [
    isPl
      ? {
          action: 'Uruchom Falę 1 dla luk o najwyższym wpływie',
          whyFirst: 'bo odblokowuje kolejne inicjatywy zależne',
          ownerRole: 'PMO',
        }
      : {
          action: 'Launch Wave 1 for the highest-impact gaps',
          whyFirst: 'because it unblocks the dependent initiatives',
          ownerRole: 'PMO',
        },
    facts.recommendation
      ? isPl
        ? {
            action: `Wdroż rekomendację: ${facts.recommendation}`,
            whyFirst: 'bo bez właściciela rekomendacja pozostaje życzeniem',
            ownerRole: 'Sponsor',
          }
        : {
            action: `Execute the recommendation: ${facts.recommendation}`,
            whyFirst: 'because without an owner a recommendation stays a wish',
            ownerRole: 'Sponsor',
          }
      : isPl
        ? {
            action: 'Wyznacz właścicieli i terminy dla trzech priorytetowych luk',
            whyFirst: 'bo bez właściciela i terminu rekomendacja pozostaje życzeniem',
            ownerRole: 'Sponsor',
          }
        : {
            action: 'Assign owners and deadlines to the three priority gaps',
            whyFirst: 'because without an owner and a date a recommendation stays a wish',
            ownerRole: 'Sponsor',
          },
  ];
  if (facts.risksCount > 0) {
    k3Actions.push(
      isPl
        ? {
            action: `Zaadresuj ${facts.risksCount} otwartych ryzyk planem mitygacji`,
            whyFirst: 'bo materializacja ryzyka cofa postęp Fali 1',
            ownerRole: 'Zespół transformacji',
          }
        : {
            action: `Address ${facts.risksCount} open risks with a mitigation plan`,
            whyFirst: 'because a materialized risk reverses Wave 1 progress',
            ownerRole: 'Transformation team',
          }
    );
  }

  const k4Text = isPl
    ? 'W horyzoncie Fali 1 organizacja domknie priorytetowe luki i pokaże mierzalny postęp inicjatyw, przechodząc od diagnozy do egzekucji.'
    : 'Within the Wave 1 horizon the organization will close the priority gaps and show measurable initiative progress, moving from diagnosis to execution.';
  const k4Horizon = isPl ? 'Fala 1 — do 6 miesięcy' : 'Wave 1 — within 6 months';

  return {
    headline,
    k1Text,
    k2Text,
    k3Actions: k3Actions.slice(0, 3),
    k4Text,
    k4Horizon,
    confidence,
    factRefs: factRefs(facts),
    source: 'deterministic',
  };
}

// ---------------------------------------------------------------------------
// 3) VALIDATION — the K1→K4 server twin, shaped for the deck conclusion.
// ---------------------------------------------------------------------------

export function conclusionToValidatable(
  conclusion: DeckConclusion,
  facts: DeckConclusionFacts
): ValidatableConclusion {
  return {
    headline: conclusion.headline,
    k1Text: conclusion.k1Text,
    k1FactRefs: conclusion.factRefs,
    k2Text: conclusion.k2Text,
    k2FactRefs: conclusion.factRefs,
    k3Actions: conclusion.k3Actions,
    k4Text: conclusion.k4Text,
    k4Horizon: conclusion.k4Horizon,
    confidence: conclusion.confidence,
    language: facts.language,
    facts: factsPool(facts),
  };
}

export function validateDeckConclusion(
  conclusion: DeckConclusion,
  facts: DeckConclusionFacts
): ConclusionValidationReport {
  return validateConclusion(conclusionToValidatable(conclusion, facts));
}

// ---------------------------------------------------------------------------
// 4) LLM elevation — consultant-grade prose, grounded + validated, fail-safe.
// ---------------------------------------------------------------------------

interface LlmConclusionJson {
  headline?: unknown;
  k1?: unknown;
  k2?: unknown;
  k3?: unknown;
  k4?: unknown;
  k4Horizon?: unknown;
  confidence?: unknown;
}

/** Build the grounded system + user prompt (server twin of tool conclusionPrompts / §4.2). */
export function buildDeckConclusionPrompt(facts: DeckConclusionFacts): {
  systemPrompt: string;
  userPrompt: string;
} {
  const isPl = facts.language === 'pl';
  const factsJson = JSON.stringify(
    {
      organization: facts.orgName,
      initiativesCount: facts.initiativesCount,
      risksCount: facts.risksCount,
      overallScore: facts.overallScore,
      maxScore: facts.maxScore,
      kpis: facts.kpis,
      keyFindings: facts.keyFindings,
      recommendation: facts.recommendation,
    },
    null,
    2
  );

  const systemPrompt = isPl
    ? `Jesteś partnerem firmy doradczej (HBS, MBA, 10 lat praktyki). Piszesz slajd „Wnioski", który podpiszesz nazwiskiem przed zarządem ${facts.orgName}.
Standard: docs/standards/CONCLUSION_LAYER_STANDARD.md — formuła K1→K2→K3→K4.

ZASADY TWARDE:
- Liczby WYŁĄCZNIE z "facts" — nie licz, nie szacuj, nie przywołuj statystyk spoza wsadu. Każda liczba w tekście MUSI występować w "facts".
- Grounding zamknięty: tylko "facts". Nic więcej. Zakaz „badań branżowych".
- K1 CO JEST: fakty/liczby ze silnika. K2 CO TO ZNACZY: konsekwencja biznesowa, każda teza oparta o fakt. K3 CO ROBIĆ: maks. 3 akcje, każda = czasownik + przedmiot + rola odpowiedzialna + dlaczego akurat teraz. K4 EFEKT: rezultat z HORYZONTEM czasowym.
- Zakaz ogólników pasujących do każdej firmy. Answer-first. Pisz po polsku (poza terminami: KPI, ROI, PMO, MECE).
Zwróć WYŁĄCZNIE JSON: { "headline": string, "k1": string, "k2": string, "k3": [{ "action": string, "whyFirst": string, "ownerRole": string }], "k4": string, "k4Horizon": string, "confidence": "high"|"medium"|"low"|"insufficient" }. Bez markdown, bez komentarza.`
    : `You are a consulting-firm partner (HBS, MBA, 10 years of practice). You write the "Conclusions" slide you would sign before ${facts.orgName}'s board.
Standard: docs/standards/CONCLUSION_LAYER_STANDARD.md — formula K1→K2→K3→K4.

HARD RULES:
- Numbers ONLY from "facts" — do not compute, estimate, or cite outside statistics. Every number in the text MUST appear in "facts".
- Closed grounding: only "facts". Nothing else. No "industry research".
- K1 WHAT IS: engine facts/numbers. K2 WHAT IT MEANS: business consequence, every thesis backed by a fact. K3 WHAT TO DO: max 3 actions, each = verb + object + responsible role + why now. K4 EFFECT: result with a time HORIZON.
- No filler that fits any company. Answer-first. Write in English.
Return ONLY JSON: { "headline": string, "k1": string, "k2": string, "k3": [{ "action": string, "whyFirst": string, "ownerRole": string }], "k4": string, "k4Horizon": string, "confidence": "high"|"medium"|"low"|"insufficient" }. No markdown, no commentary.`;

  const userPrompt = `facts:\n${factsJson}`;
  return { systemPrompt, userPrompt };
}

function parseLlmConclusionJson(raw: string): LlmConclusionJson | null {
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
    return parsed && typeof parsed === 'object' ? (parsed as LlmConclusionJson) : null;
  } catch {
    return null;
  }
}

function normalizeConfidence(raw: unknown): DeckConclusion['confidence'] {
  const s = String(raw ?? '').toLowerCase();
  return s === 'high' || s === 'medium' || s === 'low' || s === 'insufficient'
    ? (s as DeckConclusion['confidence'])
    : 'medium';
}

/** Map a parsed LLM response into a DeckConclusion, or null when malformed. */
function llmJsonToConclusion(
  parsed: LlmConclusionJson | null,
  facts: DeckConclusionFacts
): DeckConclusion | null {
  if (!parsed) return null;
  const headline = nonEmpty(parsed.headline);
  const k1 = nonEmpty(parsed.k1);
  const k2 = nonEmpty(parsed.k2);
  const k4 = nonEmpty(parsed.k4);
  if (!headline || !k1 || !k2 || !k4) return null;

  const rawActions = Array.isArray(parsed.k3) ? parsed.k3 : [];
  const k3Actions: DeckConclusionAction[] = [];
  for (const ra of rawActions.slice(0, 3)) {
    const action = nonEmpty((ra as any)?.action);
    const whyFirst = nonEmpty((ra as any)?.whyFirst);
    const ownerRole = nonEmpty((ra as any)?.ownerRole);
    if (action && whyFirst && ownerRole) k3Actions.push({ action, whyFirst, ownerRole });
  }
  if (k3Actions.length === 0) return null;

  return {
    headline,
    k1Text: k1,
    k2Text: k2,
    k3Actions,
    k4Text: k4,
    k4Horizon:
      nonEmpty(parsed.k4Horizon) ||
      (facts.language === 'pl' ? 'Fala 1 — do 6 miesięcy' : 'Wave 1 — within 6 months'),
    confidence: normalizeConfidence(parsed.confidence),
    factRefs: factRefs(facts),
    source: 'llm',
  };
}

// ---------------------------------------------------------------------------
// 5) SLIDE — assemble the additive UnifiedSlide (key_messages shape + envelope).
// ---------------------------------------------------------------------------

export interface DeckConclusionSlide {
  intent: 'key_messages';
  key_message: string;
  content: {
    type: 'key_messages';
    messages: Array<{ title: string; description: string }>;
  };
  /**
   * Machine-readable CONCLUSION LAYER envelope. Additive, mirrors the existing
   * `_narrative_enrichment` slide side-channel — the FE / exporters ignore
   * unknown fields, but consumers (and the acceptance harness) can read the raw
   * K1→K4 structure + its validation report straight off the persisted slide.
   */
  _conclusion: {
    version: 1;
    structure: 'K1-K4';
    k1: string;
    k2: string;
    k3: DeckConclusionAction[];
    k4: string;
    k4Horizon: string;
    confidence: DeckConclusion['confidence'];
    source: DeckConclusion['source'];
    validation: ConclusionValidationReport;
  };
}

function conclusionToSlide(
  conclusion: DeckConclusion,
  facts: DeckConclusionFacts,
  validation: ConclusionValidationReport
): DeckConclusionSlide {
  const isPl = facts.language === 'pl';
  const t = (pl: string, en: string) => (isPl ? pl : en);

  const k3Description = conclusion.k3Actions
    .map((a, i) => `${i + 1}. ${a.action} (${a.ownerRole}) — ${a.whyFirst}`)
    .join(' ');

  const messages = [
    { title: t('Werdykt — co jest', 'Verdict — what is'), description: conclusion.k1Text },
    { title: t('Co to znaczy', 'What it means'), description: conclusion.k2Text },
    { title: t('Co robić najpierw', 'What to do first'), description: k3Description },
    {
      title: t('Czego oczekiwać', 'What to expect'),
      description: `${conclusion.k4Text} (${conclusion.k4Horizon})`,
    },
  ];

  return {
    intent: 'key_messages',
    key_message: conclusion.headline,
    content: { type: 'key_messages', messages },
    _conclusion: {
      version: 1,
      structure: 'K1-K4',
      k1: conclusion.k1Text,
      k2: conclusion.k2Text,
      k3: conclusion.k3Actions,
      k4: conclusion.k4Text,
      k4Horizon: conclusion.k4Horizon,
      confidence: conclusion.confidence,
      source: conclusion.source,
      validation,
    },
  };
}

// ---------------------------------------------------------------------------
// 6) ORCHESTRATOR — deterministic first, LLM elevation optional, always valid.
// ---------------------------------------------------------------------------

export interface BuildDeckConclusionSlideParams {
  language: 'pl' | 'en';
  artifactData: Record<string, unknown>;
  contextPack?: {
    key_points?: string[];
    data_points?: ReadonlyArray<{
      label?: unknown;
      value?: unknown;
      unit?: unknown;
      trend?: unknown;
    }>;
  } | null;
  /** Optional injected LLM client. When omitted, only the deterministic path runs. */
  llm?: DeckConclusionLlm | null;
  modelConfig?: { id?: string; provider?: string; [k: string]: unknown };
  timeoutMs?: number;
  temperature?: number;
  logger?: {
    info?: (m: string, meta?: unknown) => void;
    warn?: (m: string, meta?: unknown) => void;
  };
}

export interface BuildDeckConclusionSlideResult {
  slide: DeckConclusionSlide;
  validation: ConclusionValidationReport;
  source: DeckConclusion['source'];
}

/**
 * Build the deck's CONCLUSION slide. Never throws: on any LLM failure the
 * grounded deterministic conclusion (which passes every hard validator by
 * construction) is used, so deck generation is never blocked.
 */
export async function buildDeckConclusionSlide(
  params: BuildDeckConclusionSlideParams
): Promise<BuildDeckConclusionSlideResult> {
  const facts = buildDeckConclusionFacts({
    language: params.language,
    artifactData: params.artifactData,
    contextPack: params.contextPack ?? null,
  });

  const deterministic = buildDeterministicDeckConclusion(facts);

  let chosen: DeckConclusion = deterministic;

  if (params.llm) {
    const { systemPrompt, userPrompt } = buildDeckConclusionPrompt(facts);
    const attempt = async (): Promise<DeckConclusion | null> => {
      const result = await params.llm!.call({
        type: 'text',
        modelConfig: params.modelConfig || { id: 'standard' },
        systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        maxTokens: 900,
        temperature: params.temperature ?? 0.4,
        timeoutMs: params.timeoutMs ?? 120_000,
      });
      const raw = String((result as { content?: unknown })?.content ?? '');
      const candidate = llmJsonToConclusion(parseLlmConclusionJson(raw), facts);
      if (!candidate) return null;
      const report = validateConclusion(conclusionToValidatable(candidate, facts));
      return report.allHardPass ? candidate : null;
    };
    try {
      let llmConclusion = await attempt();
      if (!llmConclusion) llmConclusion = await attempt();
      if (llmConclusion) {
        chosen = llmConclusion;
        params.logger?.info?.(`${LOG_PREFIX} LLM conclusion accepted (validated K1-K4)`);
      } else {
        params.logger?.warn?.(
          `${LOG_PREFIX} LLM conclusion rejected — using deterministic fallback`
        );
      }
    } catch (err) {
      params.logger?.warn?.(`${LOG_PREFIX} LLM error — using deterministic fallback`, {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const validation = validateDeckConclusion(chosen, facts);
  const slide = conclusionToSlide(chosen, facts, validation);
  return { slide, validation, source: chosen.source };
}
