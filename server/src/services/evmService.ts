/**
 * M14/F2 — Earned Value Management (ANSI-748 / PMBOK).
 *
 * Pure, side-effect-free EVM core + a derivation layer that turns an initiative's
 * schedule + budget + progress into PV / EV / AC. Per the CEO decision, EV is
 * milestone-weighted when milestones exist, else falls back to % complete × BAC.
 *
 * This is the foundation for replacing `avgProgress`-based "health" with a real
 * schedule/cost measurement (SPI/CPI). Wiring into the health score + signals is
 * a follow-up; the math + derivation are isolated and fully unit-tested here.
 */

export interface EvmInputs {
  /** Budget at completion (total planned cost). */
  bac: number;
  /** Planned value — budgeted cost of work scheduled by the as-of date. */
  pv: number;
  /** Earned value — budgeted cost of work actually performed. */
  ev: number;
  /** Actual cost incurred. */
  ac: number;
}

export interface EvmResult {
  bac: number;
  pv: number;
  ev: number;
  ac: number;
  /** Schedule Performance Index = EV / PV. null when PV = 0. */
  spi: number | null;
  /** Cost Performance Index = EV / AC. null when AC = 0. */
  cpi: number | null;
  /** Schedule Variance = EV − PV. */
  sv: number;
  /** Cost Variance = EV − AC. */
  cv: number;
  /** Estimate At Completion = BAC / CPI (current performance continues). */
  eac: number | null;
  /** Variance At Completion = BAC − EAC. */
  vac: number | null;
  /** To-Complete Performance Index = (BAC − EV) / (BAC − AC). */
  tcpi: number | null;
  /** EV / BAC. */
  percentComplete: number | null;
  /** AC / BAC. */
  percentSpent: number | null;
  /** RAG from SPI/CPI thresholds (worst of the two). */
  rag: 'GREEN' | 'AMBER' | 'RED' | 'NA';
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** RAG from a performance index: ≥0.95 GREEN, ≥0.85 AMBER, else RED. */
function indexRag(idx: number | null): 'GREEN' | 'AMBER' | 'RED' | 'NA' {
  if (idx === null || !Number.isFinite(idx)) return 'NA';
  if (idx >= 0.95) return 'GREEN';
  if (idx >= 0.85) return 'AMBER';
  return 'RED';
}

const worse = (a: string, b: string): string => {
  const order = ['RED', 'AMBER', 'GREEN', 'NA'];
  return order.indexOf(a) <= order.indexOf(b) ? a : b;
};

/** Pure EVM computation. */
export function computeEvm({ bac, pv, ev, ac }: EvmInputs): EvmResult {
  const spi = pv > 0 ? ev / pv : null;
  const cpi = ac > 0 ? ev / ac : null;
  const eac = cpi && cpi > 0 ? bac / cpi : null;
  const vac = eac !== null ? bac - eac : null;
  const tcpi = bac - ac !== 0 ? (bac - ev) / (bac - ac) : null;
  const schedRag = indexRag(spi);
  const costRag = indexRag(cpi);
  return {
    bac: round2(bac),
    pv: round2(pv),
    ev: round2(ev),
    ac: round2(ac),
    spi: spi === null ? null : round2(spi),
    cpi: cpi === null ? null : round2(cpi),
    sv: round2(ev - pv),
    cv: round2(ev - ac),
    eac: eac === null ? null : round2(eac),
    vac: vac === null ? null : round2(vac),
    tcpi: tcpi === null ? null : round2(tcpi),
    percentComplete: bac > 0 ? round2(ev / bac) : null,
    percentSpent: bac > 0 ? round2(ac / bac) : null,
    rag: worse(schedRag, costRag) as EvmResult['rag'],
  };
}

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

/**
 * M14/2.4 — EVM-driven schedule health (0–100) from SPI.
 *
 * SPI 1.0 (on schedule) → 100; SPI 0.8 (20% behind) → 80; capped 0–100. This is
 * the PMBOK schedule-performance read that replaces naive avg-progress in the
 * portfolio health score when the EXECUTION_EVM_HEALTH flag is on. Returns null
 * when SPI is unknown (no baseline coverage) so callers can fall back to progress.
 */
export function evmScheduleHealth(spi: number | null | undefined): number | null {
  if (spi == null || !Number.isFinite(spi)) return null;
  return Math.max(0, Math.min(100, Math.round(spi * 100)));
}

export interface InitiativeEvmSource {
  bac: number; // cost_capex + cost_opex
  plannedStart?: string | null;
  plannedEnd?: string | null;
  /** 0–100 self-reported progress (EV fallback when no milestones). */
  progressPct?: number | null;
  /** Actual cost to date. */
  actualCost?: number | null;
  /** Milestones with a budget weight (0–1, summing ~1) and a done flag. */
  milestones?: Array<{ weight: number; done: boolean }>;
}

/**
 * Derive PV/EV/AC for one initiative as of `asOf`, then run EVM.
 * - PV = BAC × planned schedule fraction elapsed (linear time-phasing).
 * - EV = BAC × Σ(done milestone weights) if milestones, else BAC × progress%.
 * - AC = actualCost.
 * Returns null when there is no cost baseline (BAC ≤ 0) — EVM is undefined.
 */
export function deriveInitiativeEvm(src: InitiativeEvmSource, asOf: number): EvmResult | null {
  const bac = Number(src.bac) || 0;
  if (bac <= 0) return null;

  // PV — linear time-phasing of the cost baseline across the schedule.
  let pvFraction = 0;
  const start = src.plannedStart ? new Date(src.plannedStart).getTime() : NaN;
  const end = src.plannedEnd ? new Date(src.plannedEnd).getTime() : NaN;
  if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
    pvFraction = clamp01((asOf - start) / (end - start));
  } else if (Number.isFinite(end) && asOf >= end) {
    pvFraction = 1;
  }
  const pv = bac * pvFraction;

  // EV — milestone-weighted when milestones exist, else % complete.
  let evFraction: number;
  if (src.milestones && src.milestones.length > 0) {
    const totalWeight = src.milestones.reduce((s, m) => s + (Number(m.weight) || 0), 0) || 1;
    const doneWeight = src.milestones
      .filter((m) => m.done)
      .reduce((s, m) => s + (Number(m.weight) || 0), 0);
    evFraction = clamp01(doneWeight / totalWeight);
  } else {
    evFraction = clamp01((Number(src.progressPct) || 0) / 100);
  }
  const ev = bac * evFraction;

  const ac = Number(src.actualCost) || 0;
  return computeEvm({ bac, pv, ev, ac });
}

/**
 * Portfolio EVM roll-up: aggregate PV/EV/AC/BAC across initiatives (each derived
 * via deriveInitiativeEvm), then run EVM on the totals. Initiatives without a
 * cost baseline are skipped. Returns null when no initiative has a baseline, plus
 * `coverage` = share of initiatives that contributed (data-honesty signal).
 */
export function derivePortfolioEvm(
  sources: InitiativeEvmSource[],
  asOf: number
): (EvmResult & { coverage: number; contributing: number }) | null {
  let bac = 0;
  let pv = 0;
  let ev = 0;
  let ac = 0;
  let contributing = 0;
  for (const s of sources) {
    const r = deriveInitiativeEvm(s, asOf);
    if (!r) continue;
    bac += r.bac;
    pv += r.pv;
    ev += r.ev;
    ac += r.ac;
    contributing += 1;
  }
  if (contributing === 0) return null;
  return {
    ...computeEvm({ bac, pv, ev, ac }),
    contributing,
    coverage: sources.length > 0 ? Math.round((contributing / sources.length) * 100) / 100 : 0,
  };
}
