/**
 * Initiative Generator BRAIN (F1 · D1/D2/D10/D12).
 *
 * The "fast track": a brief → a *fully-filled* initiative (not a shallow draft).
 * This module is pure ORCHESTRATION — it composes the already-built pieces:
 *
 *   1. proposeCards(type, sourceType, context)
 *        Deterministic mapping type → which cards to fill: the 6 mandatory CORE
 *        cards (D10) + a type-driven set of optional cards from the library (D2).
 *        An LLM seam is marked but the function is fully testable WITHOUT an LLM.
 *
 *   2. generateFullInitiative(deps, { initiativeId, brief, sourceType, language })
 *        For each chosen card it calls the EXISTING per-section generator
 *        (`initiativeGenerationService.generateSectionContent(..., { withReview:true })`),
 *        collects the content, and AUTO-HEALS (D12): if the advisory review score
 *        is below REVIEW_PASS_THRESHOLD it regenerates that ONE card exactly once.
 *        FAIL-SOFT per card — one failing card never aborts the whole fill.
 *
 * Dependencies are INJECTED (`GeneratorDeps`) so unit tests mock the generation
 * service and never touch an LLM or a database. A `defaultDeps()` factory wires
 * the real singleton for production callers (routes / Teresa).
 *
 * NOTE (scope): this file is purely additive. It does NOT edit
 * initiativeGenerationService, routes, controllers, or the Gateway.
 */

import initiativeGenerationService, {
  REVIEW_PASS_THRESHOLD,
  type GenerationContext,
  type GenerationResult,
} from '../initiativeGenerationService.js';
import logger from '../../utils/Logger.js';

// ==========================================
// CARD TAXONOMY (D10 core + D2 optional library)
// ==========================================

/**
 * The 6 MANDATORY core cards (D10: Problem · Teza · KPI · Zakres · Właściciel ·
 * Business case), expressed as REAL componentKeys from
 * `src/components/Initiatives/sections/registry.ts` (verified against
 * `migrations/529_initiative_section_types.sql`):
 *
 *   Problem        → problemDefinition
 *   Teza (hypoth.) → targetState        (falsifiable target + success criteria)
 *   KPI            → kpis
 *   Zakres         → scope              (scope + kill criteria)
 *   Właściciel     → control            (owner/sponsor control panel)
 *   Ryzyka (RAID)  → raid               (risk register → hydrates key_risks; see below)
 *   Business case  → financialImpact    (the live business-case card; financialAnalysis enum is dead per F0)
 *
 * NOTE (FIX 1a, naprawa-r4Struct): `raid` was measured EMPTY on live demo —
 * `key_risks` (mapped from the raid card in cardColumnHydration) stayed null
 * because the raid card was NEVER generated in the core-fill (it lived only in
 * OPTIONAL_LIBRARY_KEYS and was proposed for some types, not guaranteed). Adding
 * it to the core makes the risk register a MANDATORY generated card so key_risks
 * populates on every fast-track initiative. `raid` is a verified section key
 * (member of OPTIONAL_LIBRARY_KEYS below + has a real prompt in
 * initiativeGenerationService: RISK_FORMULA_HINTS.raid / SECTION registry).
 *
 * Order is the canonical reading order of an initiative document.
 */
export const CORE_SECTION_KEYS = [
  'problemDefinition', // Problem
  'targetState', // Teza / hypothesis (falsifiable target state)
  'kpis', // KPI
  'scope', // Zakres
  'control', // Właściciel (owner/sponsor)
  'raid', // Ryzyka (RAID) → key_risks
  'financialImpact', // Business case
] as const;

export type CoreSectionKey = (typeof CORE_SECTION_KEYS)[number];

/**
 * Initiative "type" buckets the deterministic optional-card mapping keys off.
 * These are coarse and intentionally forgiving — any unknown type falls back to
 * the GENERAL set. (The string is matched case-insensitively + by substring so
 * callers can pass e.g. "regulatory-compliance" or "Pilot Program".)
 */
export type InitiativeType =
  | 'general'
  | 'regulatory'
  | 'pilot'
  | 'transformation'
  | 'cost'
  | 'technology'
  | 'people';

/**
 * Library of OPTIONAL cards (the 26 system section types minus the 6 core),
 * expressed as componentKeys. Used as the universe `proposeCards` draws from.
 */
export const OPTIONAL_LIBRARY_KEYS = [
  'overview',
  'tasks',
  'decisions',
  'raid',
  'gates',
  'financialAnalysis',
  'competencyRequirements',
  'skillsGap',
  'pilot',
  'team',
  'timeline',
  'resources',
  'stakeholders',
  'dependencies',
] as const;

export type OptionalSectionKey = (typeof OPTIONAL_LIBRARY_KEYS)[number];

/**
 * DETERMINISTIC type → suggested optional cards (D2). No LLM required: the map
 * is the testable default the LLM seam may later refine. Every listed key is a
 * member of OPTIONAL_LIBRARY_KEYS (never a core card — those are always present).
 */
const TYPE_OPTIONAL_MAP: Record<InitiativeType, OptionalSectionKey[]> = {
  general: ['overview', 'tasks', 'raid', 'timeline', 'stakeholders'],
  regulatory: ['overview', 'raid', 'gates', 'decisions', 'dependencies', 'stakeholders'],
  pilot: ['overview', 'pilot', 'tasks', 'raid', 'timeline'],
  transformation: ['overview', 'tasks', 'raid', 'gates', 'timeline', 'stakeholders', 'dependencies'],
  cost: ['overview', 'financialAnalysis', 'tasks', 'resources', 'timeline'],
  technology: ['overview', 'tasks', 'dependencies', 'skillsGap', 'competencyRequirements', 'raid'],
  people: ['overview', 'skillsGap', 'competencyRequirements', 'team', 'stakeholders', 'tasks'],
};

/** Normalize a free-form type string into one of the InitiativeType buckets. */
export function normalizeInitiativeType(type?: string | null): InitiativeType {
  const t = String(type || '').toLowerCase().trim();
  if (!t) return 'general';
  if (/regulat|complian|legal|audit|risk/.test(t)) return 'regulatory';
  if (/pilot|poc|proof|experiment|mvp/.test(t)) return 'pilot';
  if (/transform|strateg|change|reorg/.test(t)) return 'transformation';
  if (/cost|saving|efficien|opex|capex|financ|budget/.test(t)) return 'cost';
  if (/tech|digital|automat|system|platform|software|ai|data/.test(t)) return 'technology';
  if (/people|talent|skill|competenc|hr|culture|training/.test(t)) return 'people';
  return 'general';
}

// ==========================================
// proposeCards
// ==========================================

export interface ProposeCardsResult {
  /** The 6 mandatory core card keys (always filled). */
  core: CoreSectionKey[];
  /** Optional cards suggested for this type (deduped, never overlapping core). */
  proposed: OptionalSectionKey[];
  /** Resolved type bucket the proposal was derived from. */
  type: InitiativeType;
}

/**
 * Propose which cards a fast-track initiative should contain.
 *
 * Deterministic: `core` is always the 6 D10 cards; `proposed` is the optional
 * library subset mapped from the (normalized) type. `sourceType`/`context` are
 * accepted so a future LLM pass can refine the proposal — the LLM SEAM is marked
 * below — but the function returns a stable, testable result with no LLM call.
 */
export function proposeCards(
  type?: string | null,
  sourceType?: string | null,
  context?: { brief?: string; [k: string]: unknown },
): ProposeCardsResult {
  const resolved = normalizeInitiativeType(type);
  const core = [...CORE_SECTION_KEYS];

  // Deterministic base set from the type map.
  const proposedSet = new Set<OptionalSectionKey>(TYPE_OPTIONAL_MAP[resolved]);

  // Deterministic source-driven nudges (still no LLM): an audit/assessment source
  // benefits from a gate-readiness card; a pilot source from the pilot card.
  const src = String(sourceType || '').toLowerCase();
  if (/audit|assessment/.test(src)) proposedSet.add('gates');
  if (/pilot/.test(src)) proposedSet.add('pilot');

  // ── LLM SEAM (D2) ───────────────────────────────────────────────────────
  // A future enhancement may call an LLM with { type, sourceType, context.brief,
  // OPTIONAL_LIBRARY_KEYS } to refine `proposedSet`. It MUST only ever add/remove
  // members of OPTIONAL_LIBRARY_KEYS (never touch `core`) so this contract holds.
  // Intentionally not wired here: proposeCards stays deterministic + testable.

  // Never propose a core card as "optional".
  const coreSet = new Set<string>(core);
  const proposed = [...proposedSet].filter((k) => !coreSet.has(k));

  return { core, proposed, type: resolved };
}

// ==========================================
// generateFullInitiative
// ==========================================

/**
 * Minimal surface of the section generator the brain depends on. Injected so
 * tests can supply a mock and never reach an LLM/DB. Matches the default export's
 * `generateSectionContent` signature.
 */
export interface SectionGenerator {
  generateSectionContent(
    sectionKey: string,
    context: GenerationContext,
    organizationId?: string,
    options?: { withReview?: boolean },
  ): Promise<GenerationResult>;
}

export interface GeneratorDeps {
  generationService: SectionGenerator;
  /** PASS threshold for auto-heal (D12). Defaults to REVIEW_PASS_THRESHOLD. */
  passThreshold?: number;
}

/** Production wiring: the real singleton + canonical threshold. */
export function defaultDeps(): GeneratorDeps {
  return {
    generationService: initiativeGenerationService as SectionGenerator,
    passThreshold: REVIEW_PASS_THRESHOLD,
  };
}

export interface GenerateFullInput {
  initiativeId: string;
  /** Free-form brief from the user / Teresa — seeds the generation context. */
  brief?: string;
  /** Lineage source type (audit/assessment/interview_insight/idea/teresa_chat…). */
  sourceType?: string;
  /** Optional explicit initiative type to drive card proposal (else inferred). */
  initiativeType?: string;
  language?: 'en' | 'pl';
  /** Optional org id forwarded to the section generator (for org-custom types). */
  organizationId?: string;
  /** Override which cards to fill (else = proposeCards(...).core). */
  cardKeys?: string[];
  /**
   * §6 downstream Insight seeds (#57/Z60) — owner-role/KPI seeds inherited
   * from a materialized Insight candidate (see `insightMaterializationService.
   * deriveInitiativeSeedContext`), merged into the base `GenerationContext` so
   * the KPI/control cards INHERIT instead of guessing. Optional/additive —
   * omitting it (the existing brief-only flow) leaves generation unchanged.
   */
  insightSeeds?: { seedOwnerRole?: string; seedKpiSeeds?: string };
}

export interface CardOutcome {
  key: string;
  /** Final content (after a possible heal), or null when the card failed. */
  content: string | null;
  /** True when generation threw and was swallowed (fail-soft). */
  failed: boolean;
  /** True when the card was regenerated once because the first review was sub-threshold. */
  healed: boolean;
  /** Advisory review score of the FINAL attempt, when available. */
  score?: number;
  /** Error message captured when failed. */
  error?: string;
}

export interface QualitySummary {
  total: number;
  filled: number;
  failed: number;
  healed: number;
  /** Mean review score across cards that produced a score. */
  averageScore: number | null;
  /** Keys whose final review still sat below threshold after the heal attempt. */
  belowThreshold: string[];
}

export interface GenerateFullResult {
  initiativeId: string;
  language: 'en' | 'pl';
  /** key → final content (null entries dropped). */
  cards: Record<string, string>;
  /** Per-card outcomes (incl. failed/healed), in fill order. */
  outcomes: CardOutcome[];
  qualitySummary: QualitySummary;
}

/** Pull a numeric review score off a GenerationResult, when present. */
function reviewScore(result: GenerationResult | undefined): number | undefined {
  const s = result?.review?.score;
  return typeof s === 'number' ? s : undefined;
}

/**
 * Orchestrate the fast track: fill every chosen card, auto-heal sub-threshold
 * cards once, and return the assembled cards + a quality summary.
 *
 * Pure orchestration with injected deps. FAIL-SOFT per card.
 */
export async function generateFullInitiative(
  deps: GeneratorDeps,
  input: GenerateFullInput,
): Promise<GenerateFullResult> {
  const language: 'en' | 'pl' = input.language === 'pl' ? 'pl' : input.language === 'en' ? 'en' : 'pl';
  const passThreshold =
    typeof deps.passThreshold === 'number' ? deps.passThreshold : REVIEW_PASS_THRESHOLD;

  // Decide which cards to fill: explicit override → else the 6 core (D10).
  const keys =
    input.cardKeys && input.cardKeys.length
      ? input.cardKeys
      : proposeCards(input.initiativeType, input.sourceType).core;

  const baseContext: GenerationContext = {
    initiativeId: input.initiativeId,
    initiativeName: '',
    language,
    ...(input.brief ? { summary: input.brief } : {}),
    ...(input.sourceType ? { sourceLineage: input.sourceType } : {}),
    // §6 downstream Insight seeds (#57/Z60) — additive: absent when the caller
    // didn't supply insightSeeds, so the existing brief-only flow is unchanged.
    ...(input.insightSeeds?.seedOwnerRole ? { seedOwnerRole: input.insightSeeds.seedOwnerRole } : {}),
    ...(input.insightSeeds?.seedKpiSeeds ? { seedKpiSeeds: input.insightSeeds.seedKpiSeeds } : {}),
  };

  // Generate ONE section with a bounded retry on a HARD failure (thrown error).
  // Root cause of the "cicho pada" bug (demo 2026-07): all 6 cards were fired
  // CONCURRENTLY (Promise.all) and each then triggered a review + heal call — a
  // burst of up to ~24 premium LLM calls. A single provider rate-limit / 429
  // then made EVERY card throw fail-soft → cards={} → nothing persisted →
  // ai_generated_sections stayed NULL and the whole §1 looked empty. We now
  // (a) fill SEQUENTIALLY (below) and (b) retry a thrown section once here, so a
  // transient hiccup on one card no longer wipes the initiative.
  const HARD_RETRY = 1;
  const generateWithRetry = async (
    key: (typeof keys)[number],
  ): Promise<GenerationResult> => {
    let lastErr: any;
    for (let attempt = 0; attempt <= HARD_RETRY; attempt++) {
      try {
        return await deps.generationService.generateSectionContent(
          key,
          baseContext,
          input.organizationId,
          { withReview: true },
        );
      } catch (err: any) {
        lastErr = err;
        if (attempt < HARD_RETRY) {
          logger.warn(
            `[GeneratorBrain] section "${key}" threw (attempt ${attempt + 1}/${
              HARD_RETRY + 1
            }) — retrying:`,
            err?.message || err,
          );
        }
      }
    }
    throw lastErr;
  };

  // Fill ONE card (generate → advisory review → optional auto-heal).
  const fillCard = async (key: (typeof keys)[number]): Promise<CardOutcome> => {
    const outcome: CardOutcome = { key, content: null, failed: false, healed: false };
    try {
      // First pass — always with review so we can decide whether to heal (D12).
      const first = await generateWithRetry(key);
      let finalResult = first;
      const firstScore = reviewScore(first);

      // AUTO-HEAL (D12): regenerate ONCE when the advisory score is sub-threshold.
      if (typeof firstScore === 'number' && firstScore < passThreshold) {
        try {
          const second = await deps.generationService.generateSectionContent(
            key,
            baseContext,
            input.organizationId,
            { withReview: true },
          );
          outcome.healed = true;
          finalResult = second;
        } catch (healErr: any) {
          // Heal failed → keep the first (still-usable) attempt; not a hard failure.
          logger.warn(
            `[GeneratorBrain] auto-heal failed for "${key}" — keeping first attempt:`,
            healErr?.message || healErr,
          );
        }
      }

      // R3 enablement: when a section emitted STRUCTURED JSON (parsedContent),
      // store the CLEAN field-shaped JSON (no markdown fences) so typed-column
      // hydration (cardColumnHydration) can populate the authoritative columns
      // (problem_statement/scope_in/…). Prose sections keep their text. The
      // `ai_generated_sections` sink is not rendered as prose in the FE, so
      // normalizing JSON sections here is display-safe and strictly helps R3.
      const parsed = finalResult?.parsedContent;
      outcome.content =
        parsed && typeof parsed === 'object'
          ? JSON.stringify(parsed)
          : String(finalResult?.content ?? '');
      const finalScore = reviewScore(finalResult);
      if (typeof finalScore === 'number') outcome.score = finalScore;
    } catch (err: any) {
      // FAIL-SOFT: one card throwing never aborts the whole initiative fill.
      // LOUD: this is logged at ERROR (not warn) — the demo bug was invisible
      // precisely because every card failed quietly at warn level.
      outcome.failed = true;
      outcome.error = err?.message || String(err);
      logger.error(`[GeneratorBrain] card "${key}" failed after retry (fail-soft):`, outcome.error);
    }
    return outcome;
  };

  // Fill cards SEQUENTIALLY (was Promise.all). Concurrent bursts of premium LLM
  // calls (6 sections × review × heal) tripped provider rate-limits and made the
  // WHOLE fill fail silently (see generateWithRetry note above). Sequential is
  // slower but each section already has a generous 150s timeout and the fill runs
  // in the BACKGROUND (fire-and-forget in the Teresa tool), so wall time no longer
  // blocks the chat stream. Correctness (cards actually get filled) beats speed.
  const outcomes: CardOutcome[] = [];
  for (const key of keys) {
    // eslint-disable-next-line no-await-in-loop
    outcomes.push(await fillCard(key));
  }

  // Assemble cards map (only successfully-filled cards) + quality summary.
  const cards: Record<string, string> = {};
  for (const o of outcomes) {
    if (!o.failed && o.content != null) cards[o.key] = o.content;
  }

  const scored = outcomes.filter((o) => typeof o.score === 'number');
  const averageScore = scored.length
    ? Math.round((scored.reduce((sum, o) => sum + (o.score as number), 0) / scored.length) * 10) / 10
    : null;
  const belowThreshold = outcomes
    .filter((o) => typeof o.score === 'number' && (o.score as number) < passThreshold)
    .map((o) => o.key);

  const qualitySummary: QualitySummary = {
    total: outcomes.length,
    filled: Object.keys(cards).length,
    failed: outcomes.filter((o) => o.failed).length,
    healed: outcomes.filter((o) => o.healed).length,
    averageScore,
    belowThreshold,
  };

  // LOUD SUMMARY: make the outcome visible in logs regardless of success. A fully
  // empty fill (filled=0) is an ERROR — it means the whole §1 (all core cards)
  // came back empty, which is exactly the "cicho pada" failure we are hunting.
  if (qualitySummary.filled === 0 && qualitySummary.total > 0) {
    logger.error(
      `[GeneratorBrain] initiative ${input.initiativeId}: ZERO cards filled ` +
        `(${qualitySummary.failed}/${qualitySummary.total} failed). Errors: ` +
        outcomes
          .filter((o) => o.failed)
          .map((o) => `${o.key}=${o.error || 'unknown'}`)
          .join(' | '),
    );
  } else {
    logger.info(
      `[GeneratorBrain] initiative ${input.initiativeId}: filled ${qualitySummary.filled}/${qualitySummary.total} ` +
        `(failed=${qualitySummary.failed}, healed=${qualitySummary.healed}, avg=${qualitySummary.averageScore ?? 'n/a'})`,
    );
  }

  return { initiativeId: input.initiativeId, language, cards, outcomes, qualitySummary };
}

export default { proposeCards, generateFullInitiative, defaultDeps, CORE_SECTION_KEYS };
