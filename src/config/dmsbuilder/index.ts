/**
 * DMS Builder (Daily Management System) — config layer barrel.
 *
 * SSOT for the DMS methodology content and its deterministic synthesis engine.
 * Cloned from the Ansoff config pattern (src/config/ansoff):
 *   - deepeningLadder.ts           : per-layer depth staircase + partner-grade proposal bank (PL/EN)
 *   - managementSystemEngine.ts    : control-loop maturity scoring + W2 move sequencing
 *   - conclusionPrompts.ts         : AI prompt builders grounded in the engine output
 *
 * Self-contained: the engine reads a minimal DmsSession, and this barrel offers
 * a defensive adapter from the store's OperationalToolData sections so callers
 * never have to reach into section internals.
 */

import {
  DMS_DEEPENING_LADDER,
  DMS_LADDER_RUNG_ORDER,
  type DmsLayerId,
  type LadderRung,
} from './deepeningLadder';
import type { DmsSession, EscalationRule, KpiItem } from './managementSystemEngine';

export * from './conclusionPrompts';
export * from './deepeningLadder';
export * from './managementSystemEngine';

/** A ladder rung with strings resolved to a single language. */
export interface LocalizedRung {
  id: LadderRung['id'];
  depth: LadderRung['depth'];
  label: string;
  question: string;
  rationale: string;
}

/** Resolve a layer's deepening ladder to one language, preserving rung order. */
export function localizeLadder(layer: DmsLayerId, isPolish: boolean): LocalizedRung[] {
  const rungs = DMS_DEEPENING_LADDER[layer];
  return DMS_LADDER_RUNG_ORDER.map((rungId) => {
    const rung = rungs.find((r) => r.id === rungId)!;
    return {
      id: rung.id,
      depth: rung.depth,
      label: isPolish ? rung.label.pl : rung.label.en,
      question: isPolish ? rung.question.pl : rung.question.en,
      rationale: isPolish ? rung.rationale.pl : rung.rationale.en,
    };
  });
}

// ---------------------------------------------------------------------------
// Adapter: OperationalToolData sections -> DmsSession (defensive, store-agnostic)
// ---------------------------------------------------------------------------

const truthy = (raw: unknown): boolean =>
  raw === true || (typeof raw === 'string' && raw.trim().length > 0);

/**
 * Extract a DmsSession from the operational tool's `sections`. Reads `kpis` and
 * `escalation` defensively.
 *
 * Convention on OperationalItem for KPIs: `target` present => hasTarget;
 * `owner` present => hasOwner; `frequency` present => cadence defined.
 * For escalation rules: `threshold` present => hasTrigger; `target` (target level/role)
 * present => hasTargetLevel; `description` present => hasResponse; the item flag
 * `frequency` containing "verif" (or a boolean `verifiesEffect`) => verifiesEffect.
 */
export function toDmsSession(sections: Record<string, unknown[]> | undefined): DmsSession {
  const rawKpis = (sections?.['kpis'] || []) as Array<Record<string, unknown>>;
  const rawEscalation = (sections?.['escalation'] || []) as Array<Record<string, unknown>>;

  const kpis: KpiItem[] = rawKpis.map((item, idx) => ({
    id: String(item.id ?? `kpi-${idx}`),
    hasTarget: truthy(item.target) || truthy(item.threshold),
    hasOwner: truthy(item.owner),
    frequency: typeof item.frequency === 'string' ? item.frequency : undefined,
  }));

  const escalationRules: EscalationRule[] = rawEscalation.map((item, idx) => ({
    id: String(item.id ?? `esc-${idx}`),
    hasTrigger: truthy(item.threshold),
    hasTargetLevel: truthy(item.target) || truthy(item.owner),
    hasResponse: truthy(item.description),
    verifiesEffect:
      item.verifiesEffect === true ||
      (typeof item.frequency === 'string' && /verif|potwierdz|check/i.test(item.frequency)),
  }));

  return { kpis, escalationRules };
}
