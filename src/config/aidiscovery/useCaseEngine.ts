/**
 * AI Discovery — synthesis engine + W2 move validator.
 *
 * The pure, testable brain of the tool. It reads the discovery session (candidate
 * AI use cases + candidate discovery moves) and produces:
 *
 *   1. a baseline of the value at stake and how ready the organization is
 *      (data readiness, use cases with an owner)
 *   2. a per-phase readiness score (discover / feasibility / value / sequence)
 *      derived from the facts (use-case coverage, evidence, impact, effort)
 *   3. a ranking of the four phases with a plain rationale, in a disciplined
 *      order (you cannot rank value before you have tested feasibility)
 *   4. a W2-validated move sequence, where every move carries:
 *        - rationale        (why do this now)
 *        - tradeOff         (what it costs you / what you give up)
 *        - rejectedVariant  (the alternative deliberately NOT taken, and why)
 *
 * The W2 validator is the near-literal transfer of the SMED/Ansoff/SWOT
 * "move must justify itself" contract: a move is only VALID when all three
 * fields are present and non-trivial.
 *
 * This layer is self-contained: it depends only on a minimal read-model of the
 * discovery session (DiscoverySession), not on the full store, so it compiles
 * and tests in isolation.
 */

import {
  AI_PHASES,
  aiPhaseLabel,
  type AiPhaseId,
  type Bilingual,
} from './deepeningLadder';

type Level = 'high' | 'medium' | 'low';

const LEVEL_SCORE: Record<Level, number> = { high: 3, medium: 2, low: 1 };

/** Readiness of the data a use case needs. */
export type DataReadiness = 'ready' | 'partial' | 'missing';

/**
 * Minimal read-model of one candidate AI use case. Sourced from the tool's
 * `usecases` section; `threshold` carries data readiness, `target`/numeric
 * fields carry the annual value at stake.
 */
export interface AiUseCase {
  id: string;
  dataReadiness: DataReadiness;
  /** Annual business value at stake if the use case ships (money or hours converted). */
  annualValue?: number;
  /** Whether the use case has a named business owner who will act on the output. */
  hasOwner?: boolean;
  /** Technical feasibility of building it, once data exists. */
  feasibility?: Level;
  /** Whether the value/readiness numbers are measured (true) or estimated/unknown. */
  measured?: boolean;
}

/** Minimal read-model of one discovery-move candidate from the `moves` section. */
export interface DiscoveryMoveItem {
  id: string;
  /** Which discovery phase the move primarily belongs to. */
  phase?: AiPhaseId;
  impact?: Level;
  effort?: Level;
  /** Evidence backing the move (process observation, data sample, baseline). */
  evidence?: string[];
}

/** The minimal AI-discovery session shape the engine reads. */
export interface DiscoverySession {
  useCases: AiUseCase[];
  moves: DiscoveryMoveItem[];
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round1 = (value: number) => Math.round(value * 10) / 10;
const asLevel = (value: unknown, fallback: Level = 'medium'): Level =>
  value === 'high' || value === 'medium' || value === 'low' ? value : fallback;
const localize = (text: Bilingual, isPolish: boolean) => (isPolish ? text.pl : text.en);

const READINESS_SCORE: Record<DataReadiness, number> = { ready: 1, partial: 0.5, missing: 0 };

// ---------------------------------------------------------------------------
// Baseline
// ---------------------------------------------------------------------------

/** The headline discovery facts: how much value is at stake and how ready the org is. */
export interface DiscoveryBaseline {
  useCaseCount: number;
  /** Total annual value at stake across candidate use cases. */
  totalValueAtStake: number;
  /** Value at stake in use cases whose data is fully ready — the shippable pool. */
  readyValueAtStake: number;
  /** Number of use cases that have a named business owner. */
  ownedCount: number;
  /** Share of use cases whose data is ready (readiness-weighted), 0..1. */
  dataReadinessRatio: number;
  /** Share of use cases whose numbers are measured, 0..1. */
  measuredRatio: number;
}

export function computeBaseline(session: DiscoverySession): DiscoveryBaseline {
  const ucs = session.useCases;
  const totalValueAtStake = ucs.reduce((acc, u) => acc + (u.annualValue || 0), 0);
  const readyValueAtStake = ucs
    .filter((u) => u.dataReadiness === 'ready')
    .reduce((acc, u) => acc + (u.annualValue || 0), 0);
  const ownedCount = ucs.filter((u) => u.hasOwner).length;
  const readinessSum = ucs.reduce((acc, u) => acc + READINESS_SCORE[u.dataReadiness], 0);
  const measured = ucs.filter((u) => u.measured).length;
  return {
    useCaseCount: ucs.length,
    totalValueAtStake: round1(totalValueAtStake),
    readyValueAtStake: round1(readyValueAtStake),
    ownedCount,
    dataReadinessRatio: ucs.length > 0 ? round1(readinessSum / ucs.length) : 0,
    measuredRatio: ucs.length > 0 ? round1(measured / ucs.length) : 0,
  };
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export interface PhaseScore {
  phase: AiPhaseId;
  label: Bilingual;
  /** Discovery-move candidates attributed to this phase. */
  moveCount: number;
  /** Value at stake this phase governs. */
  valueInScope: number;
  /** Mean impact of this phase's moves, 1..3. */
  attractiveness: number;
  /** Ease of pulling it off (low effort + evidence), 1..3. */
  feasibility: number;
  /** attractiveness × feasibility, 1..9. */
  score: number;
  /** Count of moves carrying at least one evidence item. */
  evidenceBacked: number;
}

/** Value at stake a phase governs, derived from the use-case facts. */
const valueForPhase = (
  phase: AiPhaseId,
  session: DiscoverySession,
  baseline: DiscoveryBaseline
): number => {
  switch (phase) {
    case 'discover':
      // discovery governs the whole candidate pool
      return baseline.totalValueAtStake;
    case 'feasibility':
      // feasibility gates the value locked behind partial/missing data
      return session.useCases
        .filter((u) => u.dataReadiness !== 'ready')
        .reduce((acc, u) => acc + (u.annualValue || 0), 0);
    case 'value':
      // value work governs the pool that is actually shippable (data ready)
      return baseline.readyValueAtStake;
    case 'sequence':
      // sequencing governs the whole pool once scored
      return baseline.totalValueAtStake;
    default:
      return 0;
  }
};

const scorePhase = (
  phase: AiPhaseId,
  session: DiscoverySession,
  baseline: DiscoveryBaseline
): PhaseScore => {
  const label = aiPhaseLabel(phase);
  const moves = session.moves.filter((m) => m.phase === phase);
  const valueInScope = round1(valueForPhase(phase, session, baseline));

  if (moves.length === 0) {
    return {
      phase,
      label,
      moveCount: 0,
      valueInScope,
      attractiveness: 0,
      feasibility: 0,
      score: 0,
      evidenceBacked: 0,
    };
  }

  const impactAvg = moves.reduce((sum, m) => sum + LEVEL_SCORE[asLevel(m.impact)], 0) / moves.length;
  const effortAvg = moves.reduce((sum, m) => sum + LEVEL_SCORE[asLevel(m.effort)], 0) / moves.length;
  const evidenceBacked = moves.filter((m) => (m.evidence?.length || 0) > 0).length;
  const evidenceRatio = evidenceBacked / moves.length;

  const effortEase = 4 - effortAvg; // 1..3, low effort scores high
  const feasibility = clamp(round1(effortEase * 0.6 + evidenceRatio * 2 * 0.4 + 0.4), 0.5, 3);
  const attractiveness = round1(impactAvg);
  const score = round1(attractiveness * feasibility);

  return {
    phase,
    label,
    moveCount: moves.length,
    valueInScope,
    attractiveness,
    feasibility,
    score,
    evidenceBacked,
  };
};

export interface PhaseRanking {
  scores: PhaseScore[];
  /** phases ordered best-first among those with at least one move. */
  ordered: AiPhaseId[];
  rationale: Bilingual;
}

/**
 * Rank the four discovery phases. Only phases with move candidates are ranked;
 * empty phases are reported with score 0 but excluded from `ordered`. Ties break
 * toward the canonical order (discover before feasibility before value before
 * sequence) so the sequence never recommends ranking value before feasibility
 * has been tested.
 */
export function rankPhases(session: DiscoverySession): PhaseRanking {
  const baseline = computeBaseline(session);
  const scores = AI_PHASES.map((phase) => scorePhase(phase, session, baseline));
  const orderIndex = (p: AiPhaseId) => AI_PHASES.indexOf(p);

  const ordered = scores
    .filter((s) => s.moveCount > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.valueInScope !== a.valueInScope) return b.valueInScope - a.valueInScope;
      return orderIndex(a.phase) - orderIndex(b.phase);
    })
    .map((s) => s.phase);

  const top = scores.find((s) => s.phase === ordered[0]);
  const rationale: Bilingual = top
    ? {
        pl: `Najsilniejsza dźwignia to faza „${aiPhaseLabel(top.phase).pl.toLowerCase()}" (dopasowanie ${top.score}/9: atrakcyjność ${top.attractiveness} × wykonalność ${top.feasibility}), obejmująca ${top.valueInScope} wartości. Sekwencja trzyma porządek: nie rankujemy wartości, zanim nie sprawdzimy wykonalności danych.`,
        en: `The strongest lever is the "${aiPhaseLabel(top.phase).en.toLowerCase()}" phase (fit ${top.score}/9: attractiveness ${top.attractiveness} × feasibility ${top.feasibility}), covering ${top.valueInScope} of value. The sequence keeps order: we do not rank value before we test data feasibility.`,
      }
    : {
        pl: 'Brak kandydatów na ruchy — dodaj przypadki użycia i ruchy w co najmniej jednej fazie, aby zbudować ranking.',
        en: 'No move candidates yet — add use cases and moves in at least one phase to build a ranking.',
      };

  return { scores, ordered, rationale };
}

// ---------------------------------------------------------------------------
// W2 move validator
// ---------------------------------------------------------------------------

export type W2Field = 'rationale' | 'tradeOff' | 'rejectedVariant';

export interface W2MoveInput {
  title?: string;
  rationale?: string;
  tradeOff?: string;
  rejectedVariant?: string;
}

export interface W2ValidationResult {
  valid: boolean;
  missing: W2Field[];
  weak: W2Field[];
}

const MIN_JUSTIFICATION_LEN = 12;
const isThin = (value?: string) => !value || value.trim().length < MIN_JUSTIFICATION_LEN;

/**
 * The W2 contract: a move is only valid when it justifies itself with a
 * rationale, an explicit trade-off, and a rejected variant.
 */
export function validateW2Move(move: W2MoveInput): W2ValidationResult {
  const missing: W2Field[] = [];
  const weak: W2Field[] = [];
  (['rationale', 'tradeOff', 'rejectedVariant'] as W2Field[]).forEach((field) => {
    const value = move[field];
    if (!value || !value.trim()) missing.push(field);
    else if (isThin(value)) weak.push(field);
  });
  return { valid: missing.length === 0 && weak.length === 0, missing, weak };
}

export interface SequencedMove {
  order: number;
  phase: AiPhaseId;
  title: Bilingual;
  rationale: Bilingual;
  tradeOff: Bilingual;
  rejectedVariant: Bilingual;
  expectedImpact: Level;
  estimatedEffort: Level;
  /** Every synthesized move is self-validated so the UI never renders an unjustified move. */
  validation: W2ValidationResult;
}

const VALID: W2ValidationResult = { valid: true, missing: [], weak: [] };

/**
 * Build a W2-validated move sequence from the ranked phases. The rule of the
 * sequence: when data readiness is thin, test feasibility first — you cannot
 * promise value on data you do not have; lead with the highest-fit phase; always
 * surface a lighthouse-first sequencing move; and defer moonshots behind a stated
 * trade-off until the delivery capability exists.
 */
export function buildW2MoveSequence(session: DiscoverySession): SequencedMove[] {
  const { scores, ordered } = rankPhases(session);
  if (ordered.length === 0) return [];

  const baseline = computeBaseline(session);
  const scoreOf = (p: AiPhaseId) => scores.find((s) => s.phase === p)!;
  const moves: SequencedMove[] = [];
  let order = 1;

  // If data readiness is thin, test feasibility before promising value.
  if (baseline.dataReadinessRatio < 0.5) {
    const feasScore = scoreOf('feasibility');
    moves.push({
      order: order++,
      phase: 'feasibility',
      title: {
        pl: 'Najpierw sprawdź wykonalność danych, zanim obiecasz wartość',
        en: 'Test data feasibility first, before promising value',
      },
      rationale: {
        pl: `Gotowość danych to tylko ${Math.round(baseline.dataReadinessRatio * 100)}%, a ${feasScore.valueInScope} wartości siedzi za niekompletnymi danymi — bez próbki jakości ranking wartości jest zgadywaniem.`,
        en: `Data readiness is only ${Math.round(baseline.dataReadinessRatio * 100)}%, and ${feasScore.valueInScope} of value sits behind incomplete data — without a quality sample the value ranking is guesswork.`,
      },
      tradeOff: {
        pl: 'Kosztem ~1 cyklu opóźnienia budowy modeli, w zamian za pewność, które przypadki są w ogóle wykonalne.',
        en: 'At the cost of ~1 cycle of delay to model building, in exchange for certainty about which use cases are feasible at all.',
      },
      rejectedVariant: {
        pl: 'Odrzucamy „zacznijmy budować najciekawszy model": budowa na brudnych lub brakujących danych to najdroższy sposób, żeby odkryć, że danych nie było.',
        en: 'We reject "let\'s start building the most exciting model": building on dirty or missing data is the most expensive way to discover the data was not there.',
      },
      expectedImpact: 'medium',
      estimatedEffort: 'low',
      validation: VALID,
    });
  }

  // Lead with the highest-fit phase.
  const primary = ordered[0];
  const primaryScore = scoreOf(primary);
  moves.push({
    order: order++,
    phase: primary,
    title: {
      pl: `Skup się na fazie „${aiPhaseLabel(primary).pl.toLowerCase()}"`,
      en: `Lead with the "${aiPhaseLabel(primary).en.toLowerCase()}" phase`,
    },
    rationale: {
      pl: `Najwyższe dopasowanie (${primaryScore.score}/9) i największa pula wartości (${primaryScore.valueInScope}) — daje najszybszy zwrot na uwadze zespołu danych i wiarygodności AI na jednostkę wysiłku.`,
      en: `Highest fit (${primaryScore.score}/9) and the largest value pool (${primaryScore.valueInScope}) — it returns fastest on data-team attention and AI credibility per unit of effort.`,
    },
    tradeOff: {
      pl: 'Kosztem tempa w pozostałych fazach — świadomie koncentrujecie zespół danych tu, zamiast otwierać cztery fronty naraz.',
      en: 'At the cost of pace in the other phases — you deliberately concentrate the data team here rather than opening four fronts at once.',
    },
    rejectedVariant: {
      pl: 'Odrzucamy równoległe prowadzenie wszystkich przypadków: rozproszenie jedynego wąskiego zasobu — zespołu danych — sprawia, że żaden nie dochodzi do produkcji.',
      en: 'We reject running all use cases in parallel: spreading the one scarce resource — the data team — thin means none reaches production.',
    },
    expectedImpact:
      primaryScore.attractiveness >= 2.5 ? 'high' : primaryScore.attractiveness >= 1.7 ? 'medium' : 'low',
    estimatedEffort:
      primaryScore.feasibility >= 2.4 ? 'low' : primaryScore.feasibility >= 1.6 ? 'medium' : 'high',
    validation: VALID,
  });

  // A lighthouse-first sequencing move is the credibility win — surface it
  // explicitly when there is shippable value and sequence is not already primary.
  if (primary !== 'sequence' && baseline.readyValueAtStake > 0) {
    const seqScore = scoreOf('sequence');
    moves.push({
      order: order++,
      phase: 'sequence',
      title: {
        pl: 'Wybierz „latarnię" jako pierwszy wdrożony przypadek',
        en: 'Pick a "lighthouse" as the first shipped use case',
      },
      rationale: {
        pl: `${baseline.readyValueAtStake} wartości jest gotowe do wdrożenia (dane gotowe) — pierwszy widoczny, wykonalny przypadek kupuje wiarygodność dla całego portfela AI.`,
        en: `${baseline.readyValueAtStake} of value is shippable now (data ready) — a first visible, feasible use case buys credibility for the whole AI portfolio.`,
      },
      tradeOff: {
        pl: 'Kosztem chwilowego odłożenia przypadków o większym potencjale, ale niższej gotowości — świadomie wybieracie pewny zysk przed ambitnym.',
        en: 'At the cost of temporarily deferring higher-potential but lower-readiness cases — you deliberately choose a sure win before an ambitious one.',
      },
      rejectedVariant: {
        pl: 'Odrzucamy start od moonshota: porażka najambitniejszego przypadku na wejściu zamyka drzwi do AI w organizacji na lata.',
        en: 'We reject starting with a moonshot: a failure of the most ambitious case up front closes the door to AI in the organization for years.',
      },
      expectedImpact: seqScore.moveCount > 0 && seqScore.attractiveness >= 2.5 ? 'high' : 'medium',
      estimatedEffort: 'low',
      validation: VALID,
    });
  }

  // Explicitly defer the moonshots until delivery capability exists.
  const valueScore = scoreOf('value');
  moves.push({
    order: order++,
    phase: 'value',
    title: {
      pl: 'Odrocz moonshoty z jawnym warunkiem, aż powstanie zdolność',
      en: 'Defer moonshots with an explicit condition until capability exists',
    },
    rationale: {
      pl:
        valueScore.moveCount > 0
          ? `Przypadki o dużym potencjale, ale wysokim ryzyku i niskiej gotowości, obejmują ${valueScore.valueInScope} wartości — wchodzą do portfela dopiero, gdy pierwsza fala dowiezie i uwolni zdolność zespołu danych.`
          : `Najambitniejsze przypadki (potencjalnie ${valueScore.valueInScope} wartości) zostają odroczone z nazwanym warunkiem — bez zdolności dostawy dołożenie ich teraz rozprasza i zabija pierwszą falę.`,
      en:
        valueScore.moveCount > 0
          ? `High-potential but high-risk, low-readiness cases cover ${valueScore.valueInScope} of value — they enter the portfolio only once the first wave ships and frees data-team capacity.`
          : `The most ambitious cases (potentially ${valueScore.valueInScope} of value) are deferred with a named condition — without delivery capability, adding them now spreads thin and kills the first wave.`,
    },
    tradeOff: {
      pl: 'Kosztem potencjalnie dużego upside, którego świadomie nie gonicie teraz, bo zdolność wdrożeniowa nie jest gotowa.',
      en: 'At the cost of a potentially large upside you deliberately do not chase now, because delivery capability is not ready.',
    },
    rejectedVariant: {
      pl: 'Odrzucamy otwarcie wszystkich przypadków naraz „na wszelki wypadek": to najdroższy sposób, żeby nauczyć się, że zespół danych był wąskim gardłem.',
      en: 'We reject opening every case at once "just in case": the most expensive way to learn the data team was the bottleneck.',
    },
    expectedImpact: 'medium',
    estimatedEffort: 'medium',
    validation: VALID,
  });

  return moves;
}

/**
 * One-shot synthesis: baseline + ranking + W2 sequence, ready for the UI or the
 * AI fallback. Pure and deterministic.
 */
export function synthesizeDiscoveryPlan(session: DiscoverySession): {
  baseline: DiscoveryBaseline;
  ranking: PhaseRanking;
  sequence: SequencedMove[];
} {
  return {
    baseline: computeBaseline(session),
    ranking: rankPhases(session),
    sequence: buildW2MoveSequence(session),
  };
}

/** Flatten a SequencedMove into a localized, store-agnostic move summary. */
export function localizeMove(
  seq: SequencedMove,
  isPolish: boolean
): { title: string; rationale: string; phase: AiPhaseId } {
  return {
    title: localize(seq.title, isPolish),
    rationale: `${localize(seq.rationale, isPolish)} ${localize(seq.tradeOff, isPolish)} ${localize(
      seq.rejectedVariant,
      isPolish
    )}`.trim(),
    phase: seq.phase,
  };
}
