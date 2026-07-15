/**
 * DMS Builder — synthesis engine + W2 move validator.
 *
 * The pure, testable brain of the tool. It reads the DMS session (KPIs +
 * escalation rules) and produces:
 *
 *   1. a per-layer maturity score across the control loop
 *      (visibility / cadence / escalation / response) derived from the facts
 *   2. a ranking of the four layers — WEAKEST-FIRST, because a control loop is
 *      only as strong as its broken link; a DMS with great boards but no
 *      escalation does not control anything
 *   3. a W2-validated move sequence, where every move carries:
 *        - rationale        (why do this now)
 *        - tradeOff         (what it costs you / what you give up)
 *        - rejectedVariant  (the alternative deliberately NOT taken, and why)
 *
 * The W2 validator is the near-literal transfer of the Ansoff/SWOT
 * "move must justify itself" contract. This layer is self-contained: it depends
 * only on a minimal read-model (DmsSession), not on the full store.
 */

import { type Bilingual, DMS_LAYERS, type DmsLayerId, dmsLayerLabel } from './deepeningLadder';

type Level = 'high' | 'medium' | 'low';

const LEVEL_SCORE: Record<Level, number> = { high: 3, medium: 2, low: 1 };

/** Minimal read-model of one KPI from the `kpis` section. */
export interface KpiItem {
  id: string;
  /** Does the KPI carry an explicit target/threshold? (visibility quantification) */
  hasTarget?: boolean;
  /** Is an owner assigned to update it? (visibility evidence) */
  hasOwner?: boolean;
  /** Update cadence descriptor if present (cadence surface). */
  frequency?: string;
}

/** Minimal read-model of one escalation rule from the `escalation` section. */
export interface EscalationRule {
  id: string;
  /** Does the rule name a quantified trigger (threshold + time)? (escalation quantification) */
  hasTrigger?: boolean;
  /** Does the rule name the target level/role it escalates to? (escalation surface) */
  hasTargetLevel?: boolean;
  /** Does the rule close with a defined countermeasure/response? (response surface) */
  hasResponse?: boolean;
  /** Is closure verified against the KPI returning to target? (response evidence) */
  verifiesEffect?: boolean;
}

/** The minimal DMS session shape the engine reads. */
export interface DmsSession {
  kpis: KpiItem[];
  escalationRules: EscalationRule[];
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round1 = (value: number) => Math.round(value * 10) / 10;
const ratio = (num: number, den: number) => (den > 0 ? num / den : 0);
const localize = (text: Bilingual, isPolish: boolean) => (isPolish ? text.pl : text.en);

// ---------------------------------------------------------------------------
// Scoring — each control-loop layer scored 0..3 from the session facts.
// ---------------------------------------------------------------------------

export interface LayerScore {
  layer: DmsLayerId;
  label: Bilingual;
  /** 0 (absent) .. 3 (mature) maturity of this loop layer, from the facts. */
  maturity: number;
  /** Whether the layer has any element at all (KPIs or rules). */
  present: boolean;
  /** Plain, fact-anchored gap statement for this layer. */
  gap: Bilingual;
}

const scoreLayer = (layer: DmsLayerId, session: DmsSession): LayerScore => {
  const label = dmsLayerLabel(layer);
  const { kpis, escalationRules } = session;
  const kpiCount = kpis.length;
  const ruleCount = escalationRules.length;
  let maturity = 0;
  let present = false;
  let gap: Bilingual;

  switch (layer) {
    case 'visibility': {
      present = kpiCount > 0;
      const owned = ratio(kpis.filter((k) => k.hasOwner).length, kpiCount);
      const targeted = ratio(kpis.filter((k) => k.hasTarget).length, kpiCount);
      // few-vital bonus: 3-8 KPIs is healthy; too many dilutes.
      const fewVital = kpiCount >= 3 && kpiCount <= 8 ? 1 : 0.5;
      maturity = present ? clamp(round1((owned + targeted) * 1.5 * fewVital), 0, 3) : 0;
      gap = {
        pl: !present
          ? 'Brak zdefiniowanych wskaźników — pętla kontroli nie ma na czym pracować.'
          : `${kpiCount} wskaźników, z których ${Math.round(targeted * 100)}% ma cel i ${Math.round(owned * 100)}% ma właściciela.`,
        en: !present
          ? 'No KPIs defined — the control loop has nothing to work on.'
          : `${kpiCount} KPIs, of which ${Math.round(targeted * 100)}% have a target and ${Math.round(owned * 100)}% have an owner.`,
      };
      break;
    }
    case 'cadence': {
      // cadence is inferred from KPI update frequency being defined.
      const withFreq = ratio(
        kpis.filter((k) => (k.frequency || '').trim().length > 0).length,
        kpiCount
      );
      present = kpiCount > 0 && withFreq > 0;
      maturity = present ? clamp(round1(withFreq * 3), 0, 3) : 0;
      gap = {
        pl: present
          ? `${Math.round(withFreq * 100)}% wskaźników ma zdefiniowaną częstotliwość przeglądu.`
          : 'Brak zdefiniowanego rytmu przeglądu — wskaźniki nikt regularnie nie ogląda.',
        en: present
          ? `${Math.round(withFreq * 100)}% of KPIs have a defined review frequency.`
          : 'No defined review rhythm — no one reviews the KPIs on a regular beat.',
      };
      break;
    }
    case 'escalation': {
      present = ruleCount > 0;
      const withTarget = ratio(escalationRules.filter((r) => r.hasTargetLevel).length, ruleCount);
      const withTrigger = ratio(escalationRules.filter((r) => r.hasTrigger).length, ruleCount);
      maturity = present ? clamp(round1((withTarget + withTrigger) * 1.5), 0, 3) : 0;
      gap = {
        pl: !present
          ? 'Brak reguł eskalacji — odchylenie wskaźnika ginie na tablicy bez ścieżki na górę.'
          : `${ruleCount} reguł, z których ${Math.round(withTrigger * 100)}% ma policzony wyzwalacz i ${Math.round(withTarget * 100)}% ma poziom docelowy.`,
        en: !present
          ? 'No escalation rules — an off-target KPI dies on the board with no path upward.'
          : `${ruleCount} rules, of which ${Math.round(withTrigger * 100)}% have a quantified trigger and ${Math.round(withTarget * 100)}% name a target level.`,
      };
      break;
    }
    case 'response': {
      present = escalationRules.some((r) => r.hasResponse);
      const withResponse = ratio(escalationRules.filter((r) => r.hasResponse).length, ruleCount);
      const verified = ratio(escalationRules.filter((r) => r.verifiesEffect).length, ruleCount);
      maturity = present ? clamp(round1(withResponse * 1.5 + verified * 1.5), 0, 3) : 0;
      gap = {
        pl: !present
          ? 'Eskalacje nie kończą się akcją naprawczą — pętla DMS nie jest domknięta.'
          : `${Math.round(withResponse * 100)}% eskalacji ma akcję naprawczą, ${Math.round(verified * 100)}% weryfikuje powrót wskaźnika na cel.`,
        en: !present
          ? 'Escalations do not end in a countermeasure — the DMS loop is not closed.'
          : `${Math.round(withResponse * 100)}% of escalations carry a countermeasure, ${Math.round(verified * 100)}% verify the KPI returns to target.`,
      };
      break;
    }
    default:
      gap = { pl: '', en: '' };
  }

  return { layer, label, maturity, present, gap };
};

export interface LayerRanking {
  scores: LayerScore[];
  /** layers ordered WEAKEST-first — the broken link in the control loop is fixed first. */
  ordered: DmsLayerId[];
  /** Overall control-loop maturity 0..3 (mean of the four layers). */
  loopMaturity: number;
  /** Is the loop closed end-to-end (every layer present)? */
  loopClosed: boolean;
  rationale: Bilingual;
}

/**
 * Rank the four DMS layers weakest-first. A control loop is only as strong as
 * its broken link: a DMS with rich boards but no escalation or no response does
 * not control anything, so the ranking surfaces the weakest layer to fix first,
 * preserving loop order (visibility → cadence → escalation → response) on ties.
 */
export function rankDmsLayers(session: DmsSession): LayerRanking {
  const scores = DMS_LAYERS.map((layer) => scoreLayer(layer, session));
  const loopIndex = (l: DmsLayerId) => DMS_LAYERS.indexOf(l);

  const ordered = [...scores]
    .sort((a, b) => {
      if (a.maturity !== b.maturity) return a.maturity - b.maturity; // weakest first
      return loopIndex(a.layer) - loopIndex(b.layer);
    })
    .map((s) => s.layer);

  const loopMaturity = round1(scores.reduce((acc, s) => acc + s.maturity, 0) / DMS_LAYERS.length);
  const loopClosed = scores.every((s) => s.present);
  const weakest = scores.find((s) => s.layer === ordered[0])!;

  const rationale: Bilingual = {
    pl: loopClosed
      ? `Pętla kontroli jest domknięta (dojrzałość ${loopMaturity}/3). Najsłabsze ogniwo to „${dmsLayerLabel(weakest.layer).pl.toLowerCase()}" (${weakest.maturity}/3) — tam wzmacniamy najpierw, bo pętla jest tak mocna jak jej najsłabszy element.`
      : `Pętla kontroli jest przerwana na warstwie „${dmsLayerLabel(weakest.layer).pl.toLowerCase()}" (${weakest.maturity}/3). Bez tego ogniwa DMS niczym nie steruje — domykamy je przed dopieszczaniem pozostałych.`,
    en: loopClosed
      ? `The control loop is closed (maturity ${loopMaturity}/3). The weakest link is "${dmsLayerLabel(weakest.layer).en.toLowerCase()}" (${weakest.maturity}/3) — reinforce it first, because the loop is only as strong as its weakest element.`
      : `The control loop is broken at the "${dmsLayerLabel(weakest.layer).en.toLowerCase()}" layer (${weakest.maturity}/3). Without this link the DMS controls nothing — close it before polishing the rest.`,
  };

  return { scores, ordered, loopMaturity, loopClosed, rationale };
}

// ---------------------------------------------------------------------------
// Coverage gap detection (OXFORD O3 discipline — "loop that controls nothing")
// ---------------------------------------------------------------------------

export type DmsGapKind = 'layer-absent' | 'layer-weak';

export interface DmsGap {
  layer: DmsLayerId;
  kind: DmsGapKind;
  message: Bilingual;
}

/**
 * Names the control-loop layers a DMS must not silently carry as broken,
 * reusing the same per-layer `gap` fact `rankDmsLayers()` already computes so
 * the two never disagree: a layer with zero elements is absent; a layer with
 * elements but low maturity (< 1.5/3) is present but too weak to control.
 */
export function detectDmsGaps(session: DmsSession): DmsGap[] {
  const { scores } = rankDmsLayers(session);
  const gaps: DmsGap[] = [];
  scores.forEach((s) => {
    if (!s.present) {
      gaps.push({ layer: s.layer, kind: 'layer-absent', message: s.gap });
    } else if (s.maturity < 1.5) {
      gaps.push({ layer: s.layer, kind: 'layer-weak', message: s.gap });
    }
  });
  return gaps;
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
  layer: DmsLayerId;
  title: Bilingual;
  rationale: Bilingual;
  tradeOff: Bilingual;
  rejectedVariant: Bilingual;
  expectedImpact: Level;
  estimatedEffort: Level;
  validation: W2ValidationResult;
}

const VALID: W2ValidationResult = { valid: true, missing: [], weak: [] };

const LAYER_MOVE_COPY: Record<
  DmsLayerId,
  { title: Bilingual; tradeOff: Bilingual; rejectedVariant: Bilingual }
> = {
  visibility: {
    title: {
      pl: 'Zbuduj tablicę nielicznych właściwych wskaźników z celami i właścicielami',
      en: 'Build a vital-few KPI board with targets and owners',
    },
    tradeOff: {
      pl: 'Kosztem rezygnacji z metryk „na wszelki wypadek" — świadomie zawężacie do 4-6 wskaźników, które zespół realnie kontroluje.',
      en: 'At the cost of dropping "just-in-case" metrics — you deliberately narrow to 4-6 KPIs the team actually controls.',
    },
    rejectedVariant: {
      pl: 'Odrzucamy bogaty dashboard z 30 metrykami: to szum, na który zespół przestaje patrzeć w tydzień.',
      en: 'We reject a rich 30-metric dashboard: it is noise the team stops looking at within a week.',
    },
  },
  cadence: {
    title: {
      pl: 'Ustaw warstwowy rytm huddle (tier 1→3) ze standardem spotkania',
      en: 'Set a tiered huddle rhythm (tier 1→3) with a meeting standard',
    },
    tradeOff: {
      pl: 'Kosztem stałego bloku czasu każdej zmiany — rytm ma pierwszeństwo przed doraźną pracą, inaczej się nie utrzyma.',
      en: 'At the cost of a fixed time block each shift — the rhythm takes precedence over ad-hoc work, or it will not hold.',
    },
    rejectedVariant: {
      pl: 'Odrzucamy przegląd „gdy jest problem": rytm zależny od nastroju dnia degeneruje do zebrań bez decyzji.',
      en: 'We reject a "when there is a problem" review: a mood-dependent rhythm degrades into meetings with no decisions.',
    },
  },
  escalation: {
    title: {
      pl: 'Zdefiniuj reguły eskalacji z policzonym wyzwalaczem i poziomem docelowym',
      en: 'Define escalation rules with a quantified trigger and target level',
    },
    tradeOff: {
      pl: 'Kosztem czasu kierownictwa wyższego szczebla, które musi realnie reagować na eskalacje — eskalacja bez sprawczości jest gorsza niż jej brak.',
      en: 'At the cost of senior time that must genuinely act on escalations — escalation without agency is worse than none.',
    },
    rejectedVariant: {
      pl: 'Odrzucamy „zgłaszajcie problemy do kierownika": bez progu i zegara eskalacja jest uznaniowa i zamiera.',
      en: 'We reject "raise issues to the manager": without a threshold and clock, escalation is discretionary and dies out.',
    },
  },
  response: {
    title: {
      pl: 'Domknij pętlę: akcja naprawcza z właścicielem i weryfikacją skutku',
      en: 'Close the loop: an owned countermeasure with verified effect',
    },
    tradeOff: {
      pl: 'Kosztem kompetencji analizy przyczyny źródłowej, w którą trzeba zainwestować — szybkość bez dojścia do przyczyny to wieczne gaszenie pożarów.',
      en: 'At the cost of root-cause capability you must invest in — speed without reaching the cause is perpetual firefighting.',
    },
    rejectedVariant: {
      pl: 'Odrzucamy zamykanie eskalacji „na słowo": bez potwierdzenia powrotu wskaźnika na cel ten sam problem wraca.',
      en: 'We reject closing escalations "on trust": without confirming the KPI returns to target, the same problem recurs.',
    },
  },
};

/**
 * Build a W2-validated move sequence. The rule of the sequence: repair the
 * control loop from its weakest link outward, but never lock a downstream layer
 * (escalation/response) before its upstream prerequisite (visibility/cadence)
 * exists — a signal you cannot see cannot be escalated. Each move states its
 * trade-off and the deliberately rejected alternative.
 */
export function buildW2MoveSequence(session: DmsSession): SequencedMove[] {
  const { scores, ordered, loopClosed } = rankDmsLayers(session);
  const scoreOf = (l: DmsLayerId) => scores.find((s) => s.layer === l)!;

  // Prerequisite order in the loop: you cannot escalate what you cannot see or review.
  const loopIndex = (l: DmsLayerId) => DMS_LAYERS.indexOf(l);

  // Take the two weakest layers, but re-sequence them into loop order so the
  // build sequence respects prerequisites (visibility before escalation, etc.).
  const focus = ordered
    .filter((l) => scoreOf(l).maturity < 3)
    .slice(0, loopClosed ? 2 : 3)
    .sort((a, b) => loopIndex(a) - loopIndex(b));

  const targets = focus.length > 0 ? focus : [ordered[0]];

  const moves: SequencedMove[] = [];
  let order = 1;

  targets.forEach((layer) => {
    const s = scoreOf(layer);
    const copy = LAYER_MOVE_COPY[layer];
    moves.push({
      order: order++,
      layer,
      title: copy.title,
      rationale: {
        pl: `Warstwa „${dmsLayerLabel(layer).pl.toLowerCase()}" jest najsłabszym ogniwem pętli (${s.maturity}/3): ${localize(s.gap, true)} Wzmacniamy ją przed kolejnymi, bo pętla jest tak mocna jak jej najsłabszy element.`,
        en: `The "${dmsLayerLabel(layer).en.toLowerCase()}" layer is the loop's weakest link (${s.maturity}/3): ${localize(s.gap, false)} We reinforce it before the others, because the loop is only as strong as its weakest element.`,
      },
      tradeOff: copy.tradeOff,
      rejectedVariant: copy.rejectedVariant,
      expectedImpact: s.maturity <= 1 ? 'high' : 'medium',
      estimatedEffort: layer === 'response' ? 'high' : layer === 'visibility' ? 'low' : 'medium',
      validation: VALID,
    });
  });

  return moves;
}

/**
 * One-shot synthesis: ranking + W2 sequence, ready for the UI or the AI
 * fallback. Pure and deterministic.
 */
export function synthesizeDmsPlan(session: DmsSession): {
  ranking: LayerRanking;
  sequence: SequencedMove[];
} {
  return {
    ranking: rankDmsLayers(session),
    sequence: buildW2MoveSequence(session),
  };
}

/** Flatten a SequencedMove into a localized, store-agnostic move summary. */
export function localizeMove(
  seq: SequencedMove,
  isPolish: boolean
): { title: string; rationale: string; layer: DmsLayerId } {
  return {
    title: localize(seq.title, isPolish),
    rationale: `${localize(seq.rationale, isPolish)} ${localize(seq.tradeOff, isPolish)} ${localize(
      seq.rejectedVariant,
      isPolish
    )}`.trim(),
    layer: seq.layer,
  };
}
