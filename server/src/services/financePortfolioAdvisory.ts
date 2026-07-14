/**
 * financePortfolioAdvisory — Initiative INTERDEPENDENCIES (W3)
 * ============================================================================
 * `portfolioPrioritizationService` ranks initiatives into quadrants by NPV/
 * risk — a per-initiative view. But a portfolio decision is about how the
 * initiatives RELATE: what must go first (prerequisites), what amplifies what
 * (synergies), and whether the plan fits the budget envelope. This layer turns
 * those relationships into an advisory: a funded SEQUENCE + named synergies +
 * a budget verdict, expressed as a W3-style conclusion (co jest → co znaczy →
 * co robić najpierw → jaki efekt).
 *
 * It consumes engine-computed economics (npv, capex, effort) + a dependency/
 * synergy graph the caller supplies; it never recomputes financials. The
 * sequence is a deterministic topological order weighted by risk-adjusted NPV
 * per unit effort, so "what first" is JUSTIFIED (prerequisites first, then
 * highest value-per-effort), never asserted (§1 K3, R6 owner+horizon).
 *
 * Pure functions only. No I/O, no LLM.
 */

import type { FinanceLanguage } from './financeConclusionService.js';

export interface PortfolioItemInput {
  id: string;
  name: string;
  /** Net present value (engine). */
  npv: number;
  /** Up-front capital outlay (engine). */
  capex: number;
  /** Relative effort / nakład (engine or estimate). Drives value-per-effort. */
  effort: number;
  /** Risk 0..1 (engine). Higher = riskier. */
  risk?: number;
  /** Ids of items that MUST complete before this one can start (prerequisites). */
  dependsOn?: string[];
}

/** A synergy: doing A and B together yields extra value beyond A + B alone. */
export interface SynergyInput {
  a: string;
  b: string;
  /** Extra NPV unlocked only when both are funded (engine/estimate). */
  bonusNpv: number;
  /** Why they reinforce each other (grounding, R2). */
  rationale?: string;
}

export interface SequencedItem {
  id: string;
  name: string;
  /** 1-based execution order. */
  order: number;
  /** Risk-adjusted value per unit effort — the ranking key within a tier. */
  valuePerEffort: number;
  /** Prerequisites that forced this item's tier (for the "why first"). */
  blockedBy: string[];
  /** Cumulative capex through this item — vs. the budget envelope. */
  cumulativeCapex: number;
  /** Does this item fit within the budget when its turn comes? */
  withinBudget: boolean;
}

export interface ResolvedSynergy extends SynergyInput {
  /** True when BOTH items are in the funded sequence (else synergy is latent). */
  captured: boolean;
}

export type BudgetVerdict = 'fits' | 'tight' | 'over';

export interface PortfolioAdvisory {
  sequence: SequencedItem[];
  synergies: ResolvedSynergy[];
  /** Total capex of the funded sequence. */
  totalCapex: number;
  /** The budget envelope the caller passed (0 = unconstrained). */
  budget: number;
  budgetVerdict: BudgetVerdict;
  /** Items pushed out of the budget window (funded later / deferred). */
  deferred: string[];
  /** answer-first conclusion (co jest → co znaczy → co robić → efekt). */
  conclusion: string;
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : Number.isFinite(v) ? v : 0);

/**
 * Kahn-style topological ordering that respects prerequisites, breaking ties
 * within each "ready" tier by risk-adjusted value-per-effort (descending).
 * Cyclic/broken deps are tolerated: any items never satisfied are appended at
 * the end (so the function is total and never throws).
 */
function topoOrder(items: PortfolioItemInput[]): PortfolioItemInput[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  const remaining = new Set(items.map((i) => i.id));
  const done = new Set<string>();
  const out: PortfolioItemInput[] = [];

  const vpe = (i: PortfolioItemInput): number => {
    const riskAdj = num(i.npv) * (1 - clamp01(num(i.risk)));
    const eff = num(i.effort);
    return eff > 0 ? riskAdj / eff : riskAdj;
  };

  while (remaining.size > 0) {
    const ready = [...remaining]
      .map((id) => byId.get(id)!)
      .filter((i) => (i.dependsOn || []).every((d) => done.has(d) || !byId.has(d)));

    if (ready.length === 0) {
      // Unsatisfiable deps (cycle / missing) → append the rest in vpe order.
      const rest = [...remaining].map((id) => byId.get(id)!).sort((a, b) => vpe(b) - vpe(a));
      out.push(...rest);
      break;
    }

    ready.sort((a, b) => vpe(b) - vpe(a));
    const next = ready[0];
    out.push(next);
    done.add(next.id);
    remaining.delete(next.id);
  }
  return out;
}

/**
 * Build the portfolio advisory: a funded, prerequisite-respecting sequence,
 * captured/latent synergies, and a budget verdict — with a W3 conclusion.
 *
 * `budget` = capex envelope (0 or negative = unconstrained). Items whose
 * cumulative capex exceeds the budget are marked out-of-window (deferred) but
 * still ranked, so the advisory shows what the money buys and what waits.
 */
export function buildPortfolioAdvisory(
  items: PortfolioItemInput[],
  synergies: SynergyInput[],
  budget: number,
  language: FinanceLanguage
): PortfolioAdvisory {
  const isPL = language === 'pl';
  const clean = (items || []).filter((i) => i && i.id);
  const ordered = topoOrder(clean);
  const byId = new Map(clean.map((i) => [i.id, i]));

  const vpe = (i: PortfolioItemInput): number => {
    const riskAdj = num(i.npv) * (1 - clamp01(num(i.risk)));
    const eff = num(i.effort);
    return eff > 0 ? riskAdj / eff : riskAdj;
  };

  const hasBudget = num(budget) > 0;
  let cumulative = 0;
  const deferred: string[] = [];
  const sequence: SequencedItem[] = ordered.map((i, idx) => {
    const capex = num(i.capex);
    cumulative += capex;
    const within = !hasBudget || cumulative <= num(budget);
    if (!within) deferred.push(i.id);
    return {
      id: i.id,
      name: i.name,
      order: idx + 1,
      valuePerEffort: Math.round(vpe(i) * 100) / 100,
      blockedBy: (i.dependsOn || []).filter((d) => byId.has(d)),
      cumulativeCapex: cumulative,
      withinBudget: within,
    };
  });

  const fundedIds = new Set(sequence.filter((s) => s.withinBudget).map((s) => s.id));
  const resolvedSynergies: ResolvedSynergy[] = (synergies || [])
    .filter((s) => s && byId.has(s.a) && byId.has(s.b))
    .map((s) => ({ ...s, captured: fundedIds.has(s.a) && fundedIds.has(s.b) }));

  const totalCapex = sequence.reduce((a, s) => a + num(byId.get(s.id)?.capex), 0);
  let budgetVerdict: BudgetVerdict = 'fits';
  if (hasBudget) {
    if (totalCapex > num(budget)) budgetVerdict = 'over';
    else if (totalCapex > num(budget) * 0.9) budgetVerdict = 'tight';
  }

  const conclusion = narratePortfolio(
    {
      sequence,
      synergies: resolvedSynergies,
      totalCapex,
      budget: num(budget),
      budgetVerdict,
      deferred,
    },
    isPL
  );

  return {
    sequence,
    synergies: resolvedSynergies,
    totalCapex,
    budget: num(budget),
    budgetVerdict,
    deferred,
    conclusion,
  };
}

function narratePortfolio(a: Omit<PortfolioAdvisory, 'conclusion'>, isPL: boolean): string {
  const fmt = (n: number): string =>
    new Intl.NumberFormat(isPL ? 'pl-PL' : 'en-US', { maximumFractionDigits: 0 }).format(
      Math.round(n)
    );

  if (a.sequence.length === 0) {
    return isPL
      ? 'Brak inicjatyw w portfelu — sekwencja do ustalenia.'
      : 'No initiatives in the portfolio — sequence to be established.';
  }

  const first = a.sequence[0];
  const firstReason = first.blockedBy.length
    ? isPL
      ? `poprzedza pozostałe zależne od niej pozycje`
      : `it precedes the items that depend on it`
    : isPL
      ? `ma najwyższą wartość na jednostkę nakładu`
      : `it has the highest value per unit of effort`;

  const capturedSyn = a.synergies.filter((s) => s.captured);
  const latentSyn = a.synergies.filter((s) => !s.captured);

  const synTxt = capturedSyn.length
    ? isPL
      ? ` Sfinansowana sekwencja domyka ${capturedSyn.length} synergię/e (dodatkowy NPV ${fmt(capturedSyn.reduce((x, s) => x + num(s.bonusNpv), 0))}).`
      : ` The funded sequence captures ${capturedSyn.length} synergy/ies (extra NPV ${fmt(capturedSyn.reduce((x, s) => x + num(s.bonusNpv), 0))}).`
    : '';

  const latentTxt = latentSyn.length
    ? isPL
      ? ` Uwaga: ${latentSyn.length} synergia/e pozostaje poza budżetem — rozdzielenie tych inicjatyw niszczy wartość łączną.`
      : ` Note: ${latentSyn.length} synergy/ies fall outside the budget — splitting those initiatives destroys combined value.`
    : '';

  const budgetTxt =
    a.budget > 0
      ? isPL
        ? a.budgetVerdict === 'over'
          ? `Portfel przekracza budżet (${fmt(a.totalCapex)} vs. ${fmt(a.budget)}): ${a.deferred.length} pozycji przechodzi do kolejnej fali.`
          : a.budgetVerdict === 'tight'
            ? `Portfel mieści się w budżecie, ale napięcie jest realne (${fmt(a.totalCapex)} z ${fmt(a.budget)}) — brak rezerwy na poślizg.`
            : `Portfel mieści się w budżecie (${fmt(a.totalCapex)} z ${fmt(a.budget)}) z rezerwą.`
        : a.budgetVerdict === 'over'
          ? `The portfolio exceeds the budget (${fmt(a.totalCapex)} vs. ${fmt(a.budget)}): ${a.deferred.length} item(s) move to the next wave.`
          : a.budgetVerdict === 'tight'
            ? `The portfolio fits the budget but the tension is real (${fmt(a.totalCapex)} of ${fmt(a.budget)}) — no slack for slippage.`
            : `The portfolio fits the budget (${fmt(a.totalCapex)} of ${fmt(a.budget)}) with headroom.`
      : isPL
        ? `Budżet nieograniczony — sekwencja porządkuje wykonanie, nie finansowanie.`
        : `Budget unconstrained — the sequence orders execution, not funding.`;

  return isPL
    ? `Zacznij od „${first.name}", bo ${firstReason}. ${budgetTxt}${synTxt}${latentTxt} Efekt: fala 1 realizuje wartość w kolejności wpływ/nakład, a zależności nie blokują późniejszych inicjatyw.`
    : `Start with "${first.name}", because ${firstReason}. ${budgetTxt}${synTxt}${latentTxt} Effect: wave 1 realises value in impact/effort order, and dependencies don't block later initiatives.`;
}
