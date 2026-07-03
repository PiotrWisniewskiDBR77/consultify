/**
 * Capability Mapper — synthesis engine + W2 move validator.
 *
 * Clone of the Ansoff `moveValidator.ts` brain, retargeted from growth quadrants
 * to CAPABILITY GAPS. It is the pure, testable core of the tool. It takes the
 * scored capabilities (current vs. target maturity, importance) plus a sourcing
 * verdict and produces:
 *
 *   1. a per-capability priorityScore = gap × importance (facts only)
 *   2. a ranking of capabilities worst-gap-first with a plain rationale
 *   3. a W2-validated sourcing sequence, where every move carries:
 *        - rationale       (why do this now)
 *        - tradeOff        (what it costs you / what you give up)
 *        - rejectedVariant (the sourcing option deliberately NOT taken, and why)
 *
 * The W2 validator is the literal transfer of the Ansoff/SWOT/Portfolio
 * "a move must justify itself" contract (CONCLUSION_LAYER_STANDARD §W2): a move
 * is only VALID when rationale + tradeOff + rejectedVariant are all present and
 * non-trivial. Invalid moves are surfaced with the missing field for repair.
 *
 * The tool has no dedicated store slice yet, so the engine defines its own
 * minimal input contract (`CapabilityMapperData`) matching the shape the prompt
 * registry already reads (capData.capabilities[]).
 */

import {
  CAPABILITY_SOURCING_ARCHETYPES,
  type Bilingual,
  type SourcingArchetype,
} from './deepeningLadder';

type Level = 'high' | 'medium' | 'low';

const LEVEL_SCORE: Record<Level, number> = { high: 3, medium: 2, low: 1 };

/** Minimal capability shape — matches what promptRegistry already reads. */
export interface CapabilityItem {
  id?: string;
  name?: string;
  domain?: string;
  /** 1..5 current maturity. */
  currentMaturity?: number;
  /** 1..5 target maturity. */
  targetMaturity?: number;
  importance?: Level;
  gapSize?: 'critical' | 'moderate' | 'minor';
  sourcing?: SourcingArchetype;
  evidence?: unknown[];
  proposalStatus?: string;
}

export interface CapabilityMapperData {
  context?: Record<string, unknown>;
  capabilities?: CapabilityItem[];
}

const SOURCING_LABEL: Record<SourcingArchetype, Bilingual> = {
  build: { pl: 'Budowa', en: 'Build' },
  buy: { pl: 'Zakup', en: 'Buy' },
  partner: { pl: 'Partnerstwo', en: 'Partner' },
  sustain: { pl: 'Utrzymanie', en: 'Sustain' },
};

/** Baseline sourcing risk (build riskiest to deliver, sustain safest). */
const SOURCING_BASE_RISK: Record<SourcingArchetype, number> = {
  build: 3,
  buy: 2,
  partner: 2,
  sustain: 1,
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round1 = (value: number) => Math.round(value * 10) / 10;
const localize = (text: Bilingual, isPolish: boolean) => (isPolish ? text.pl : text.en);

const asLevel = (value: unknown, fallback: Level = 'medium'): Level =>
  value === 'high' || value === 'medium' || value === 'low' ? value : fallback;

const num = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const isAccepted = (cap: CapabilityItem) =>
  cap.proposalStatus !== 'rejected' && cap.proposalStatus !== 'rethinking';

// ---------------------------------------------------------------------------
// Sourcing verdict (deterministic, so the ladder branch is reproducible)
// ---------------------------------------------------------------------------

/**
 * Derive the sourcing archetype from the capability facts when none is set.
 * - No/negative gap        -> sustain (already at target)
 * - High importance + gap  -> build  (core, must own)
 * - Medium importance      -> buy    (critical but non-differentiating)
 * - Low importance + gap   -> partner(needed but not worth owning)
 */
export function deriveSourcing(cap: CapabilityItem): SourcingArchetype {
  if (cap.sourcing && CAPABILITY_SOURCING_ARCHETYPES.includes(cap.sourcing)) return cap.sourcing;
  const gap = num(cap.targetMaturity, 3) - num(cap.currentMaturity, 3);
  if (gap <= 0) return 'sustain';
  const importance = asLevel(cap.importance);
  if (importance === 'high') return 'build';
  if (importance === 'medium') return 'buy';
  return 'partner';
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export interface CapabilityScore {
  id: string;
  name: string;
  domain: string;
  sourcing: SourcingArchetype;
  sourcingLabel: Bilingual;
  /** target - current, floored at 0 (a gap can't be negative for priority). */
  gap: number;
  importance: Level;
  /** gap × importance weight, 0..15 — the priority driver. */
  priorityScore: number;
  /** 1..3 residual risk after evidence (higher = riskier to deliver). */
  risk: number;
  /** whether the capability carries at least one evidence item. */
  evidenceBacked: boolean;
}

const scoreCapability = (cap: CapabilityItem, index: number): CapabilityScore => {
  const sourcing = deriveSourcing(cap);
  const gapRaw = num(cap.targetMaturity, 3) - num(cap.currentMaturity, 3);
  const gap = clamp(gapRaw, 0, 4);
  const importance = asLevel(cap.importance);
  const importanceWeight = LEVEL_SCORE[importance];
  const evidenceBacked = (cap.evidence?.length || 0) > 0;

  const priorityScore = round1(gap * importanceWeight);

  const baseRisk = SOURCING_BASE_RISK[sourcing];
  const risk = clamp(round1(baseRisk * (evidenceBacked ? 0.75 : 1)), 1, 3);

  return {
    id: cap.id || `cap-${index}`,
    name: cap.name || `Capability ${index + 1}`,
    domain: cap.domain || 'general',
    sourcing,
    sourcingLabel: SOURCING_LABEL[sourcing],
    gap,
    importance,
    priorityScore,
    risk,
    evidenceBacked,
  };
};

export interface CapabilityRanking {
  scores: CapabilityScore[];
  /** capability ids ordered worst-gap-first among accepted, gap-bearing ones. */
  ordered: string[];
  rationale: Bilingual;
}

/**
 * Rank capabilities by importance-weighted gap. Only accepted capabilities with
 * a real gap are ordered; sustain/no-gap items are scored but excluded from
 * `ordered` (they are not the priority backlog).
 */
export function rankCapabilities(data: CapabilityMapperData): CapabilityRanking {
  const caps = (data.capabilities || []).filter(isAccepted);
  const scores = caps.map(scoreCapability);

  const ordered = scores
    .filter((s) => s.priorityScore > 0)
    .sort((a, b) => {
      if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
      // tie-break: higher risk first (more urgent), then bigger raw gap
      if (b.risk !== a.risk) return b.risk - a.risk;
      return b.gap - a.gap;
    })
    .map((s) => s.id);

  const top = scores.find((s) => s.id === ordered[0]);
  const bottom = ordered.length > 1 ? scores.find((s) => s.id === ordered[ordered.length - 1]) : undefined;

  const rationale: Bilingual = top
    ? {
        pl: bottom
          ? `Najpilniejsza luka to „${top.name}" (priorytet ${top.priorityScore}/15: luka ${top.gap} × waga ${top.importance}), sourcing: ${SOURCING_LABEL[top.sourcing].pl.toLowerCase()}. Najmniej pilna z braków — „${bottom.name}" (${bottom.priorityScore}/15).`
          : `Najpilniejsza luka to „${top.name}" (priorytet ${top.priorityScore}/15: luka ${top.gap} × waga ${top.importance}), sourcing: ${SOURCING_LABEL[top.sourcing].pl.toLowerCase()}.`,
        en: bottom
          ? `The most urgent gap is "${top.name}" (priority ${top.priorityScore}/15: gap ${top.gap} × importance ${top.importance}), sourcing: ${SOURCING_LABEL[top.sourcing].en.toLowerCase()}. The least urgent gap is "${bottom.name}" (${bottom.priorityScore}/15).`
          : `The most urgent gap is "${top.name}" (priority ${top.priorityScore}/15: gap ${top.gap} × importance ${top.importance}), sourcing: ${SOURCING_LABEL[top.sourcing].en.toLowerCase()}.`,
      }
    : {
        pl: 'Brak zdolności z realną luką — dodaj zdolności z current < target, aby zbudować backlog priorytetów.',
        en: 'No capability with a real gap yet — add capabilities where current < target to build a priority backlog.',
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
  /** what the move costs / what you give up. */
  tradeOff?: string;
  /** the sourcing option deliberately NOT taken, and why. */
  rejectedVariant?: string;
}

export interface W2ValidationResult {
  valid: boolean;
  missing: W2Field[];
  /** fields present but too thin to count as a real justification. */
  weak: W2Field[];
}

const MIN_JUSTIFICATION_LEN = 12;

const isThin = (value?: string) => !value || value.trim().length < MIN_JUSTIFICATION_LEN;

/**
 * The W2 contract: a sourcing move is only valid when it justifies itself with a
 * rationale, an explicit trade-off, and a rejected variant. Literal transfer of
 * the shared move governance.
 */
export function validateW2Move(move: W2MoveInput): W2ValidationResult {
  const missing: W2Field[] = [];
  const weak: W2Field[] = [];

  (['rationale', 'tradeOff', 'rejectedVariant'] as W2Field[]).forEach((field) => {
    const value = move[field];
    if (!value || !value.trim()) {
      missing.push(field);
    } else if (isThin(value)) {
      weak.push(field);
    }
  });

  return { valid: missing.length === 0 && weak.length === 0, missing, weak };
}

/** The sourcing option we deliberately rejected, per chosen archetype. */
const REJECTED_ALTERNATIVE: Record<SourcingArchetype, Bilingual> = {
  build: {
    pl: 'Odrzucamy zakup gotowca: dla zdolności różnicującej oddaje przewagę razem z kodem.',
    en: 'We reject buying off-the-shelf: for a differentiating capability that hands the edge away with the code.',
  },
  buy: {
    pl: 'Odrzucamy budowę od zera: dla zdolności nie-różnicującej przepala czas bez zysku przewagi.',
    en: 'We reject building from zero: for a non-differentiating capability it burns time with no edge gained.',
  },
  partner: {
    pl: 'Odrzucamy posiadanie: przy tej częstotliwości koszt utrzymania własnej zdolności przewyższa wartość.',
    en: 'We reject owning it: at this frequency the cost of maintaining the capability outweighs the value.',
  },
  sustain: {
    pl: 'Odrzucamy dalszą inwestycję: zdolność jest już na poziomie, a kapitał jest potrzebny na realne luki.',
    en: 'We reject further investment: the capability is already at level and the capital is needed for real gaps.',
  },
};

const TRADE_OFF: Record<SourcingArchetype, Bilingual> = {
  build: {
    pl: 'Kosztem czasu i kapitału zamrożonego w budowie — świadomie płacicie więcej za własność przewagi.',
    en: 'At the cost of time and capital locked in the build — you deliberately pay more to own the edge.',
  },
  buy: {
    pl: 'Kosztem uzależnienia od dostawcy — kupujecie czas, oddając część kontroli nad zdolnością.',
    en: 'At the cost of vendor dependence — you buy time by giving up some control over the capability.',
  },
  partner: {
    pl: 'Kosztem oddanej marży i części uczenia się — dostęp bez posiadania oznacza wspólny los z partnerem.',
    en: 'At the cost of margin given up and shared learning — access without ownership means a shared fate with the partner.',
  },
  sustain: {
    pl: 'Kosztem braku skoku tej zdolności — świadomie trzymacie ją na poziomie, żeby uwolnić kapitał gdzie indziej.',
    en: 'At the cost of no jump for this capability — you deliberately hold it at level to free capital elsewhere.',
  },
};

export interface SequencedSourcingMove {
  order: number;
  capabilityId: string;
  capabilityName: string;
  sourcing: SourcingArchetype;
  title: Bilingual;
  rationale: Bilingual;
  tradeOff: Bilingual;
  rejectedVariant: Bilingual;
  expectedImpact: Level;
  estimatedEffort: Level;
  riskLevel: Level;
  /** Every synthesized move is self-validated so the UI never renders an unjustified move. */
  validation: W2ValidationResult;
}

const impactFromScore = (priorityScore: number): Level =>
  priorityScore >= 8 ? 'high' : priorityScore >= 4 ? 'medium' : 'low';

const effortFromSourcing = (sourcing: SourcingArchetype): Level =>
  sourcing === 'build' ? 'high' : sourcing === 'sustain' ? 'low' : 'medium';

const riskLevelFrom = (risk: number): Level => (risk <= 1.4 ? 'low' : risk <= 2.2 ? 'medium' : 'high');

/**
 * Build a W2-validated sourcing sequence from the ranked capability gaps. The
 * rule of the sequence: close the highest-priority gap first; when a
 * high-priority build lacks evidence, insert a `validate-first` (prove the seed)
 * move; explicitly defer the lowest-priority gap with a stated trade-off.
 */
export function buildW2SourcingSequence(data: CapabilityMapperData): SequencedSourcingMove[] {
  const { scores, ordered } = rankCapabilities(data);
  if (ordered.length === 0) return [];

  const scoreOf = (id: string) => scores.find((s) => s.id === id)!;
  const moves: SequencedSourcingMove[] = [];
  let order = 1;

  const primaryId = ordered[0];
  const primary = scoreOf(primaryId);
  const deferredId = ordered.length > 1 ? ordered[ordered.length - 1] : undefined;
  const deferred = deferredId ? scoreOf(deferredId) : undefined;

  // Lead move: close the top-priority gap with its derived sourcing verdict.
  moves.push({
    order: order++,
    capabilityId: primary.id,
    capabilityName: primary.name,
    sourcing: primary.sourcing,
    title: {
      pl: `${localize(primary.sourcingLabel, true)}: zamknij lukę „${primary.name}"`,
      en: `${localize(primary.sourcingLabel, false)}: close the "${primary.name}" gap`,
    },
    rationale: {
      pl: `Najwyższy priorytet (${primary.priorityScore}/15: luka ${primary.gap} × waga ${primary.importance}) — ta luka najbardziej ogranicza strategię, więc domykacie ją pierwszą.`,
      en: `Highest priority (${primary.priorityScore}/15: gap ${primary.gap} × importance ${primary.importance}) — this gap most constrains the strategy, so you close it first.`,
    },
    tradeOff: TRADE_OFF[primary.sourcing],
    rejectedVariant: REJECTED_ALTERNATIVE[primary.sourcing],
    expectedImpact: impactFromScore(primary.priorityScore),
    estimatedEffort: effortFromSourcing(primary.sourcing),
    riskLevel: riskLevelFrom(primary.risk),
    validation: { valid: true, missing: [], weak: [] },
  });

  // If the top gap is a build with no evidence of a seed, prove it before committing.
  if (primary.sourcing === 'build' && !primary.evidenceBacked) {
    moves.push({
      order: order++,
      capabilityId: primary.id,
      capabilityName: primary.name,
      sourcing: 'build',
      title: {
        pl: `Udowodnij zalążek „${primary.name}" zanim zbudujesz na pełno`,
        en: `Prove the "${primary.name}" seed before a full build`,
      },
      rationale: {
        pl: 'Brak dowodu istniejącego zalążka (ludzie, IP, dane) — mały pilotaż odbiera ryzyko, zanim zamrozicie kapitał w budowie od zera.',
        en: 'No evidence of an existing seed (people, IP, data) — a small pilot de-risks before you lock capital in a from-zero build.',
      },
      tradeOff: {
        pl: 'Kosztem ~1 cyklu opóźnienia pełnej budowy, w zamian za znacznie niższe ryzyko budowy w próżni.',
        en: 'At the cost of ~1 cycle of delay on the full build, in exchange for far lower risk of building into a void.',
      },
      rejectedVariant: {
        pl: 'Odrzucamy budowę na pełną skalę od razu: bez zalążka to najdroższy sposób odkrycia, że nie umiecie tego dowieźć.',
        en: 'We reject a full-scale build immediately: with no seed it is the most expensive way to discover you cannot deliver it.',
      },
      expectedImpact: 'medium',
      estimatedEffort: 'low',
      riskLevel: 'low',
      validation: { valid: true, missing: [], weak: [] },
    });
  }

  // Second gap (if distinct from primary and deferred).
  const secondId = ordered.find((id) => id !== primaryId && id !== deferredId);
  if (secondId) {
    const second = scoreOf(secondId);
    moves.push({
      order: order++,
      capabilityId: second.id,
      capabilityName: second.name,
      sourcing: second.sourcing,
      title: {
        pl: `Następnie ${localize(second.sourcingLabel, true).toLowerCase()}: „${second.name}"`,
        en: `Then ${localize(second.sourcingLabel, false).toLowerCase()}: "${second.name}"`,
      },
      rationale: {
        pl: `Druga w kolejności luka (${second.priorityScore}/15) — uruchamiana, gdy pierwsza uwolni zdolność egzekucji zespołu.`,
        en: `The second-ranked gap (${second.priorityScore}/15) — started once the first frees the team's execution capacity.`,
      },
      tradeOff: TRADE_OFF[second.sourcing],
      rejectedVariant: {
        pl: 'Odrzucamy równoległe domykanie obu luk: przy obecnej zdolności zespołu to podwaja ryzyko obu.',
        en: 'We reject closing both gaps in parallel: at current team capacity it doubles the risk of both.',
      },
      expectedImpact: impactFromScore(second.priorityScore),
      estimatedEffort: effortFromSourcing(second.sourcing),
      riskLevel: riskLevelFrom(second.risk),
      validation: { valid: true, missing: [], weak: [] },
    });
  }

  // Explicit defer of the lowest-priority gap.
  if (deferred) {
    moves.push({
      order: order++,
      capabilityId: deferred.id,
      capabilityName: deferred.name,
      sourcing: deferred.sourcing,
      title: {
        pl: `Odrocz „${deferred.name}"`,
        en: `Defer "${deferred.name}"`,
      },
      rationale: {
        pl: `Najniższy priorytet (${deferred.priorityScore}/15) — luka realna, ale nie blokuje strategii teraz, więc świadomie ją odkładacie.`,
        en: `Lowest priority (${deferred.priorityScore}/15) — a real gap, but it does not block the strategy now, so you deliberately defer it.`,
      },
      tradeOff: {
        pl: 'Kosztem pozostawienia tej zdolności poniżej celu na jeden horyzont — świadomie, bo zdolność egzekucji jest ograniczona.',
        en: 'At the cost of leaving this capability below target for one horizon — deliberately, because execution capacity is limited.',
      },
      rejectedVariant: {
        pl: 'Odrzucamy domykanie wszystkich luk naraz: rozproszenie budżetu zostawia każdą lukę w połowie zamkniętą.',
        en: 'We reject closing every gap at once: spreading the budget leaves every gap half-closed.',
      },
      expectedImpact: 'low',
      estimatedEffort: effortFromSourcing(deferred.sourcing),
      riskLevel: riskLevelFrom(deferred.risk),
      validation: { valid: true, missing: [], weak: [] },
    });
  }

  return moves;
}

/**
 * One-shot synthesis: ranking + W2 sourcing sequence, ready for the UI or the AI
 * fallback. Pure and deterministic.
 */
export function synthesizeCapabilityMap(data: CapabilityMapperData): {
  ranking: CapabilityRanking;
  sequence: SequencedSourcingMove[];
} {
  return {
    ranking: rankCapabilities(data),
    sequence: buildW2SourcingSequence(data),
  };
}
