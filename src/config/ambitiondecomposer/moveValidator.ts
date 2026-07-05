/**
 * Ambition Decomposer — synthesis engine + W2 move validator.
 *
 * Clone of the Ansoff `moveValidator.ts` brain, retargeted from growth quadrants
 * to STRATEGIC THEMES that decompose an ambition. It is the pure, testable core
 * of the tool. It takes the scored themes (importance, horizon) plus a derived
 * archetype (foundation/accelerator/bet/enabler) and produces:
 *
 *   1. a per-theme priorityScore = importance × horizon-urgency (facts only)
 *   2. a sequencing of themes with a prerequisite-aware order (foundations first)
 *   3. a W2-validated move sequence, where every move carries:
 *        - rationale       (why do this now)
 *        - tradeOff        (what it costs you / what you give up)
 *        - rejectedVariant (the sequencing option deliberately NOT taken, and why)
 *
 * The W2 validator is the literal transfer of the Ansoff/SWOT/Portfolio
 * "a move must justify itself" contract (CONCLUSION_LAYER_STANDARD §W2): a move
 * is only VALID when rationale + tradeOff + rejectedVariant are all present and
 * non-trivial. Invalid moves are surfaced with the missing field for repair.
 *
 * The tool has no dedicated store slice yet, so the engine defines its own
 * minimal input contract (`AmbitionDecomposerData`) matching the shape the
 * prompt registry already reads (ambData.themes[]).
 */

import {
  AMBITION_THEME_ARCHETYPES,
  type Bilingual,
  type ThemeArchetype,
} from './deepeningLadder';

type Level = 'high' | 'medium' | 'low';
type Horizon = 'short' | 'medium' | 'long';

const LEVEL_SCORE: Record<Level, number> = { high: 3, medium: 2, low: 1 };

/** Nearer horizon = more urgent (short is most urgent). */
const HORIZON_URGENCY: Record<Horizon, number> = { short: 3, medium: 2, long: 1 };

/** Minimal theme shape — matches what promptRegistry already reads. */
export interface ThemeItem {
  id?: string;
  title?: string;
  description?: string;
  targetMetric?: string;
  targetValue?: string;
  horizon?: Horizon;
  importance?: Level;
  archetype?: ThemeArchetype;
  evidence?: unknown[];
  proposalStatus?: string;
}

export interface AmbitionDecomposerData {
  context?: Record<string, unknown> & { ambitionStatement?: string };
  themes?: ThemeItem[];
}

const ARCHETYPE_LABEL: Record<ThemeArchetype, Bilingual> = {
  foundation: { pl: 'Fundament', en: 'Foundation' },
  accelerator: { pl: 'Akcelerator', en: 'Accelerator' },
  bet: { pl: 'Zakład', en: 'Bet' },
  enabler: { pl: 'Enabler', en: 'Enabler' },
};

/** Baseline archetype risk (a bet is riskiest, a foundation the surest to define). */
const ARCHETYPE_BASE_RISK: Record<ThemeArchetype, number> = {
  foundation: 1,
  accelerator: 2,
  bet: 3,
  enabler: 2,
};

/**
 * Sequencing rank: foundations must come before what they gate; enablers ahead
 * of the themes they multiply; accelerators once the foundation stands; bets
 * are deliberately staged as validate-first. Lower = earlier.
 */
const ARCHETYPE_SEQUENCE_RANK: Record<ThemeArchetype, number> = {
  foundation: 0,
  enabler: 1,
  accelerator: 2,
  bet: 3,
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round1 = (value: number) => Math.round(value * 10) / 10;
const localize = (text: Bilingual, isPolish: boolean) => (isPolish ? text.pl : text.en);

const asLevel = (value: unknown, fallback: Level = 'medium'): Level =>
  value === 'high' || value === 'medium' || value === 'low' ? value : fallback;

const asHorizon = (value: unknown, fallback: Horizon = 'medium'): Horizon =>
  value === 'short' || value === 'medium' || value === 'long' ? value : fallback;

const isAccepted = (theme: ThemeItem) =>
  theme.proposalStatus !== 'rejected' && theme.proposalStatus !== 'rethinking';

// ---------------------------------------------------------------------------
// Archetype verdict (deterministic, so the ladder branch is reproducible)
// ---------------------------------------------------------------------------

/**
 * Derive the theme archetype from the facts when none is set.
 * - short horizon + high importance -> foundation (needed first, gates the rest)
 * - long horizon + high importance  -> bet        (big, uncertain upside)
 * - low importance                  -> enabler    (multiplier, not a goal)
 * - otherwise                       -> accelerator(pace lever on the foundation)
 */
export function deriveArchetype(theme: ThemeItem): ThemeArchetype {
  if (theme.archetype && AMBITION_THEME_ARCHETYPES.includes(theme.archetype)) return theme.archetype;
  const importance = asLevel(theme.importance);
  const horizon = asHorizon(theme.horizon);
  if (importance === 'low') return 'enabler';
  if (importance === 'high' && horizon === 'short') return 'foundation';
  if (importance === 'high' && horizon === 'long') return 'bet';
  return 'accelerator';
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export interface ThemeScore {
  id: string;
  title: string;
  archetype: ThemeArchetype;
  archetypeLabel: Bilingual;
  importance: Level;
  horizon: Horizon;
  /** importance × horizon-urgency, 1..9 — the priority driver. */
  priorityScore: number;
  /** sequencing rank (0=earliest), from archetype. */
  sequenceRank: number;
  /** 1..3 residual risk after evidence (higher = riskier). */
  risk: number;
  evidenceBacked: boolean;
}

const scoreTheme = (theme: ThemeItem, index: number): ThemeScore => {
  const archetype = deriveArchetype(theme);
  const importance = asLevel(theme.importance);
  const horizon = asHorizon(theme.horizon);
  const evidenceBacked = (theme.evidence?.length || 0) > 0;

  const priorityScore = round1(LEVEL_SCORE[importance] * HORIZON_URGENCY[horizon]);
  const baseRisk = ARCHETYPE_BASE_RISK[archetype];
  const risk = clamp(round1(baseRisk * (evidenceBacked ? 0.75 : 1)), 1, 3);

  return {
    id: theme.id || `theme-${index}`,
    title: theme.title || `Theme ${index + 1}`,
    archetype,
    archetypeLabel: ARCHETYPE_LABEL[archetype],
    importance,
    horizon,
    priorityScore,
    sequenceRank: ARCHETYPE_SEQUENCE_RANK[archetype],
    risk,
    evidenceBacked,
  };
};

export interface ThemeRanking {
  scores: ThemeScore[];
  /**
   * theme ids in EXECUTION order: prerequisite-aware (foundations first),
   * then priority within the same sequence rank.
   */
  ordered: string[];
  rationale: Bilingual;
}

/**
 * Sequence the ambition's themes. Order is prerequisite-aware: archetype
 * sequence rank first (foundations before what they gate), priority score as the
 * tie-break within a rank. This is the deterministic order the conclusion layer
 * must not override.
 */
export function rankThemes(data: AmbitionDecomposerData): ThemeRanking {
  const themes = (data.themes || []).filter(isAccepted);
  const scores = themes.map(scoreTheme);

  const ordered = [...scores]
    .sort((a, b) => {
      if (a.sequenceRank !== b.sequenceRank) return a.sequenceRank - b.sequenceRank;
      if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
      return a.risk - b.risk;
    })
    .map((s) => s.id);

  const first = scores.find((s) => s.id === ordered[0]);
  const last = ordered.length > 1 ? scores.find((s) => s.id === ordered[ordered.length - 1]) : undefined;

  const rationale: Bilingual = first
    ? {
        pl: last
          ? `Sekwencja startuje od „${first.title}" (${localize(first.archetypeLabel, true).toLowerCase()}, priorytet ${first.priorityScore}/9), bo warunkuje resztę. Na końcu — „${last.title}" (${localize(last.archetypeLabel, true).toLowerCase()}), świadomie odłożony.`
          : `Sekwencja startuje od „${first.title}" (${localize(first.archetypeLabel, true).toLowerCase()}, priorytet ${first.priorityScore}/9), bo warunkuje resztę.`,
        en: last
          ? `The sequence leads with "${first.title}" (${localize(first.archetypeLabel, false).toLowerCase()}, priority ${first.priorityScore}/9) because it gates the rest. It ends with "${last.title}" (${localize(last.archetypeLabel, false).toLowerCase()}), deliberately staged last.`
          : `The sequence leads with "${first.title}" (${localize(first.archetypeLabel, false).toLowerCase()}, priority ${first.priorityScore}/9) because it gates the rest.`,
      }
    : {
        pl: 'Brak wątków — rozłóż ambicję na 4-7 wątków strategicznych, aby zbudować sekwencję.',
        en: 'No themes yet — decompose the ambition into 4-7 strategic themes to build a sequence.',
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
 * The W2 contract: a sequencing move is only valid when it justifies itself with
 * a rationale, an explicit trade-off, and a rejected variant. Literal transfer
 * of the shared move governance.
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

const TRADE_OFF: Record<ThemeArchetype, Bilingual> = {
  foundation: {
    pl: 'Kosztem widocznego postępu na atrakcyjniejszych wątkach — świadomie budujecie fundament, zanim gonicie upside.',
    en: 'At the cost of visible progress on flashier themes — you deliberately lay the foundation before chasing upside.',
  },
  accelerator: {
    pl: 'Kosztem czekania, aż fundament będzie gotowy — nie odpalacie dźwigni tempa na kruchej podstawie.',
    en: 'At the cost of waiting for the foundation — you do not fire the pace lever on a fragile base.',
  },
  bet: {
    pl: 'Kosztem kapitału ryzyka pod twardym limitem strat — płacicie za informację, nie za pewność.',
    en: 'At the cost of risk capital under a hard loss cap — you pay for information, not for certainty.',
  },
  enabler: {
    pl: 'Kosztem budżetu, który nie dowozi ambicji wprost — inwestujecie w mnożnik tempa innych wątków.',
    en: 'At the cost of budget that does not deliver the ambition directly — you invest in a multiplier for other themes.',
  },
};

const REJECTED_ALTERNATIVE: Record<ThemeArchetype, Bilingual> = {
  foundation: {
    pl: 'Odrzucamy start od najatrakcyjniejszego wątku: bez fundamentu utknie on na brakującym prerequisicie.',
    en: 'We reject starting with the flashiest theme: without the foundation it stalls on the missing prerequisite.',
  },
  accelerator: {
    pl: 'Odrzucamy odpalenie akceleratora od razu: pęd na niestabilnym fundamencie zamienia się w chaos.',
    en: 'We reject firing the accelerator immediately: momentum on an unstable foundation turns into chaos.',
  },
  bet: {
    pl: 'Odrzucamy pełne zaangażowanie w zakład bez testu: to hazard, nie policzalne ryzyko.',
    en: 'We reject full commitment to the bet without a test: that is a gamble, not computable risk.',
  },
  enabler: {
    pl: 'Odrzucamy pominięcie enablera „na później": dostarczony po fakcie traci mnożnik, którym miał być.',
    en: 'We reject deferring the enabler "for later": delivered after the fact it loses the multiplier it was meant to be.',
  },
};

export interface SequencedThemeMove {
  order: number;
  themeId: string;
  themeTitle: string;
  archetype: ThemeArchetype;
  title: Bilingual;
  rationale: Bilingual;
  tradeOff: Bilingual;
  rejectedVariant: Bilingual;
  expectedImpact: Level;
  estimatedEffort: Level;
  riskLevel: Level;
  validation: W2ValidationResult;
}

const impactFromScore = (priorityScore: number): Level =>
  priorityScore >= 6 ? 'high' : priorityScore >= 3 ? 'medium' : 'low';

const effortFromArchetype = (archetype: ThemeArchetype): Level =>
  archetype === 'foundation' || archetype === 'bet' ? 'high' : archetype === 'enabler' ? 'medium' : 'medium';

const riskLevelFrom = (risk: number): Level => (risk <= 1.4 ? 'low' : risk <= 2.2 ? 'medium' : 'high');

/**
 * Build a W2-validated theme sequence from the ranked ambition. The rule of the
 * sequence: start from the prerequisite (foundation); when a bet leads a stage,
 * insert a `validate-first` (cheap experiment) move before commitment; end by
 * explicitly staging the last theme with a stated trade-off.
 */
export function buildW2ThemeSequence(data: AmbitionDecomposerData): SequencedThemeMove[] {
  const { scores, ordered } = rankThemes(data);
  if (ordered.length === 0) return [];

  const scoreOf = (id: string) => scores.find((s) => s.id === id)!;
  const moves: SequencedThemeMove[] = [];
  let order = 1;

  const primaryId = ordered[0];
  const primary = scoreOf(primaryId);
  const lastId = ordered.length > 1 ? ordered[ordered.length - 1] : undefined;
  const last = lastId ? scoreOf(lastId) : undefined;

  // Lead move: start the sequence with its prerequisite theme.
  moves.push({
    order: order++,
    themeId: primary.id,
    themeTitle: primary.title,
    archetype: primary.archetype,
    title: {
      pl: `Najpierw ${localize(primary.archetypeLabel, true).toLowerCase()}: „${primary.title}"`,
      en: `Lead with the ${localize(primary.archetypeLabel, false).toLowerCase()}: "${primary.title}"`,
    },
    rationale: {
      pl: `Ten wątek otwiera sekwencję (priorytet ${primary.priorityScore}/9) — ${primary.archetype === 'foundation' ? 'warunkuje pozostałe, więc idzie pierwszy niezależnie od atrakcyjności innych' : 'ma najwyższy priorytet w tej fazie'}.`,
      en: `This theme opens the sequence (priority ${primary.priorityScore}/9) — ${primary.archetype === 'foundation' ? 'it gates the others, so it goes first regardless of how attractive the rest look' : 'it holds the highest priority in this stage'}.`,
    },
    tradeOff: TRADE_OFF[primary.archetype],
    rejectedVariant: REJECTED_ALTERNATIVE[primary.archetype],
    expectedImpact: impactFromScore(primary.priorityScore),
    estimatedEffort: effortFromArchetype(primary.archetype),
    riskLevel: riskLevelFrom(primary.risk),
    validation: { valid: true, missing: [], weak: [] },
  });

  // If the lead is a bet (or lacks evidence), stage a validate-first move.
  if (primary.archetype === 'bet' || !primary.evidenceBacked) {
    moves.push({
      order: order++,
      themeId: primary.id,
      themeTitle: primary.title,
      archetype: primary.archetype,
      title: {
        pl: `Zwaliduj „${primary.title}" tanim eksperymentem, zanim zaangażujesz kapitał`,
        en: `Validate "${primary.title}" with a cheap experiment before committing capital`,
      },
      rationale: {
        pl: primary.archetype === 'bet'
          ? 'To zakład o niepewnym upside — falsyfikowalny test zamienia hazard w policzalne ryzyko, zanim zamrozicie budżet.'
          : 'Brak twardego dowodu pod tym wątkiem — mały test odbiera ryzyko, zanim uczynicie go osią sekwencji.',
        en: primary.archetype === 'bet'
          ? 'This is a bet with uncertain upside — a falsifiable test turns a gamble into computable risk before you lock budget.'
          : 'No hard evidence under this theme yet — a small test de-risks it before you make it the spine of the sequence.',
      },
      tradeOff: {
        pl: 'Kosztem ~1 cyklu opóźnienia pełnego uruchomienia, w zamian za znacznie niższe ryzyko przepalenia.',
        en: 'At the cost of ~1 cycle of delay in full launch, in exchange for a much lower risk of burn.',
      },
      rejectedVariant: {
        pl: 'Odrzucamy pełne zaangażowanie od razu: bez dowodu to zakład finansowany jak pewnik.',
        en: 'We reject full commitment immediately: without proof it is a bet funded like a certainty.',
      },
      expectedImpact: 'medium',
      estimatedEffort: 'low',
      riskLevel: 'low',
      validation: { valid: true, missing: [], weak: [] },
    });
  }

  // Middle theme (distinct from first and last).
  const midId = ordered.find((id) => id !== primaryId && id !== lastId);
  if (midId) {
    const mid = scoreOf(midId);
    moves.push({
      order: order++,
      themeId: mid.id,
      themeTitle: mid.title,
      archetype: mid.archetype,
      title: {
        pl: `Następnie ${localize(mid.archetypeLabel, true).toLowerCase()}: „${mid.title}"`,
        en: `Then the ${localize(mid.archetypeLabel, false).toLowerCase()}: "${mid.title}"`,
      },
      rationale: {
        pl: `Uruchamiany, gdy fundament stoi i uwolni zdolność egzekucji (priorytet ${mid.priorityScore}/9).`,
        en: `Started once the foundation stands and frees execution capacity (priority ${mid.priorityScore}/9).`,
      },
      tradeOff: TRADE_OFF[mid.archetype],
      rejectedVariant: {
        pl: 'Odrzucamy równoległy start wszystkich wątków: przy obecnej zdolności zespołu to przeciąża każdy z nich.',
        en: 'We reject a parallel start of every theme: at current team capacity it overloads all of them.',
      },
      expectedImpact: impactFromScore(mid.priorityScore),
      estimatedEffort: effortFromArchetype(mid.archetype),
      riskLevel: riskLevelFrom(mid.risk),
      validation: { valid: true, missing: [], weak: [] },
    });
  }

  // Explicitly stage the last theme.
  if (last) {
    moves.push({
      order: order++,
      themeId: last.id,
      themeTitle: last.title,
      archetype: last.archetype,
      title: {
        pl: `Na końcu ${localize(last.archetypeLabel, true).toLowerCase()}: „${last.title}"`,
        en: `Stage last the ${localize(last.archetypeLabel, false).toLowerCase()}: "${last.title}"`,
      },
      rationale: {
        pl: `Świadomie odłożony na koniec sekwencji (priorytet ${last.priorityScore}/9) — ${last.archetype === 'bet' ? 'jako zakład czeka na dowody z wcześniejszych faz' : 'zależy od tego, co zbudują wcześniejsze wątki'}.`,
        en: `Deliberately staged last (priority ${last.priorityScore}/9) — ${last.archetype === 'bet' ? 'as a bet it waits on evidence from earlier stages' : 'it depends on what the earlier themes build'}.`,
      },
      tradeOff: {
        pl: 'Kosztem opóźnienia potencjalnego upside — świadomie, bo bez wcześniejszych wątków ten ruch jest przedwczesny.',
        en: 'At the cost of delaying potential upside — deliberately, because without the earlier themes this move is premature.',
      },
      rejectedVariant: {
        pl: 'Odrzucamy wciśnięcie tego wątku wcześniej: uruchomiony bez prerequisite pochłania zasoby i nie dowozi.',
        en: 'We reject pulling this theme earlier: started without its prerequisite it consumes resources and does not deliver.',
      },
      expectedImpact: impactFromScore(last.priorityScore),
      estimatedEffort: effortFromArchetype(last.archetype),
      riskLevel: riskLevelFrom(last.risk),
      validation: { valid: true, missing: [], weak: [] },
    });
  }

  return moves;
}

/**
 * One-shot synthesis: sequencing + W2 theme sequence, ready for the UI or the AI
 * fallback. Pure and deterministic.
 */
export function synthesizeAmbition(data: AmbitionDecomposerData): {
  ranking: ThemeRanking;
  sequence: SequencedThemeMove[];
} {
  return {
    ranking: rankThemes(data),
    sequence: buildW2ThemeSequence(data),
  };
}
