/**
 * M14 — Execution Intelligence (server-side, UI-binding).
 *
 * Pure, DB-free composition layer that fuses the three execution analytics
 * primitives into ONE forward-looking read for the ExecutionHub cockpit:
 *   - evmService.deriveInitiativeEvm     → SPI / CPI (schedule + cost indices)
 *   - executionPredictionService.predictInitiative → per-initiative risk level
 *   - executionTriageService.triageSignals → grounded, prioritized at-risk list
 *
 * The route layer gathers org-scoped rows and hands them here; this module does
 * the math + shaping only. No DB, no LLM, fully deterministic = unit-testable in
 * isolation. Only EXECUTING / BLOCKED initiatives are in-flight enough to score;
 * everything else (DONE / PLANNING / CANCELLED / ARCHIVED) is skipped.
 */

import { deriveInitiativeEvm } from './evmService.js';
import { predictInitiative, type RiskLevel } from './executionPredictionService.js';
import { triageSignals, type Signal, type TriageResult } from './executionTriageService.js';

/** One raw initiative row as it arrives from the DB (snake_case). */
export interface IntelligenceInitiative {
  id: string;
  name?: string | null;
  status?: string | null;
  progress?: number | null;
  cost_capex?: number | null;
  cost_opex?: number | null;
  planned_start_date?: string | null;
  planned_end_date?: string | null;
  actual_cost?: number | null;
}

export interface ExecutionIntelligenceInput {
  initiatives: IntelligenceInitiative[];
  /** open BLOCKED task count, keyed by initiative id. */
  blockedTaskCountByInitiative?: Record<string, number>;
  /** open high-severity RISK count, keyed by initiative id. */
  openHighRiskCountByInitiative?: Record<string, number>;
}

export interface IntelligencePrediction {
  initiativeId: string;
  name: string;
  overall: RiskLevel;
  reasons: string[];
  spi: number | null;
  cpi: number | null;
  slipDays: number;
}

export interface ExecutionIntelligenceResult {
  predictions: IntelligencePrediction[];
  triage: TriageResult;
  summary: {
    countByLevel: Record<RiskLevel, number>;
    /** number of initiatives predicted HIGH or CRITICAL. */
    atRisk: number;
  };
}

const MS_PER_DAY = 86_400_000;

/** Statuses that are in-flight enough to carry a forward-looking prediction. */
const SCORABLE_STATUSES = new Set(['EXECUTING', 'BLOCKED']);

const AT_RISK_LEVELS = new Set<RiskLevel>(['HIGH', 'CRITICAL']);

/**
 * Fuse EVM + prediction + triage for an org's execution portfolio.
 *
 * @param input      org-scoped initiatives + per-initiative blocker / high-risk counts
 * @param now        as-of timestamp (ms) — pass Date.now() in prod, fixed in tests
 */
export function buildExecutionIntelligence(
  input: ExecutionIntelligenceInput,
  now: number
): ExecutionIntelligenceResult {
  const initiatives = Array.isArray(input?.initiatives) ? input.initiatives : [];
  const blockedBy = input?.blockedTaskCountByInitiative ?? {};
  const highRiskBy = input?.openHighRiskCountByInitiative ?? {};

  const predictions: IntelligencePrediction[] = [];

  for (const init of initiatives) {
    const status = (init.status ?? '').toUpperCase();
    if (!SCORABLE_STATUSES.has(status)) continue;

    const name = init.name ?? init.id;
    const bac = (Number(init.cost_capex) || 0) + (Number(init.cost_opex) || 0);

    // SPI / CPI — null when there's no cost baseline (BAC ≤ 0).
    const evm =
      bac > 0
        ? deriveInitiativeEvm(
            {
              bac,
              plannedStart: init.planned_start_date,
              plannedEnd: init.planned_end_date,
              progressPct: init.progress,
              actualCost: init.actual_cost,
            },
            now
          )
        : null;
    const spi = evm?.spi ?? null;
    const cpi = evm?.cpi ?? null;

    // Slip — days past the planned end while not yet complete.
    const progress = Number(init.progress) || 0;
    let slipDays = 0;
    if (init.planned_end_date && progress < 100) {
      const end = new Date(init.planned_end_date).getTime();
      if (Number.isFinite(end)) {
        slipDays = Math.max(0, (now - end) / MS_PER_DAY);
      }
    }

    const blockers = Number(blockedBy[init.id]) || 0;
    const openHighRisks = Number(highRiskBy[init.id]) || 0;
    const percentComplete = progress / 100;

    const prediction = predictInitiative({
      spi,
      cpi,
      slipDays,
      blockers,
      openHighRisks,
      percentComplete,
    });

    predictions.push({
      initiativeId: init.id,
      name,
      overall: prediction.overall,
      reasons: prediction.reasons,
      spi,
      cpi,
      slipDays,
    });
  }

  // Triage — build a grounded signal only for at-risk (HIGH/CRITICAL) predictions.
  const signals: Signal[] = predictions
    .filter((p) => AT_RISK_LEVELS.has(p.overall))
    .map((p) => ({
      id: p.initiativeId,
      type: 'PREDICTED_RISK',
      severity: p.overall,
      title: `${p.name}${p.reasons.length ? ` — ${p.reasons[0]}` : ''}`,
      initiativeId: p.initiativeId,
    }));
  const triage = triageSignals(signals);

  // Summary — per-level counts + at-risk total.
  const countByLevel: Record<RiskLevel, number> = {
    LOW: 0,
    MEDIUM: 0,
    HIGH: 0,
    CRITICAL: 0,
  };
  for (const p of predictions) {
    countByLevel[p.overall] += 1;
  }
  const atRisk = countByLevel.HIGH + countByLevel.CRITICAL;

  return {
    predictions,
    triage,
    summary: { countByLevel, atRisk },
  };
}
