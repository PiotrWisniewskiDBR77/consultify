/**
 * Integration Diagnostic — config layer barrel.
 *
 * SSOT for the integration-diagnostic methodology content and its deterministic
 * synthesis engine. Cloned from the Inventory Autopilot config pattern
 * (src/config/inventoryautopilot):
 *   - deepeningLadder.ts     : per-lever depth staircase + partner-grade proposal bank (PL/EN)
 *   - integrationEngine.ts   : topology (n(n-1)/2 vs hub) + maturity + re-keying (1-10-100)
 *                              + scoring + W2 System→Process→Experience move sequence
 *   - conclusionPrompts.ts   : insight-first AI prompt builders grounded in the engine output
 *
 * Doctrine SSOT: Harvard/wdrozenie-100/_TOOLS_DOKTRYNA/integration-diagnostic.md
 *
 * Self-contained: the engine reads a minimal IntegrationSession, and this barrel
 * offers a defensive adapter from the store's OperationalToolData sections so
 * callers never have to reach into section internals.
 */

import {
  INTEGRATION_DEEPENING_LADDER,
  INTEGRATION_LADDER_RUNG_ORDER,
  type IntegrationLeverId,
  type LadderRung,
} from './deepeningLadder';
import type {
  IntegrationSession,
  SystemNode,
  IntegrationEdge,
  ManualBridge,
  IntegrationMoveItem,
  IntegrationType,
  IntegrationFrequency,
} from './integrationEngine';

export * from './deepeningLadder';
export * from './integrationEngine';
export * from './conclusionPrompts';

/** A ladder rung with strings resolved to a single language. */
export interface LocalizedRung {
  id: LadderRung['id'];
  depth: LadderRung['depth'];
  label: string;
  question: string;
  rationale: string;
}

/** Resolve a lever's deepening ladder to one language, preserving rung order. */
export function localizeLadder(lever: IntegrationLeverId, isPolish: boolean): LocalizedRung[] {
  const rungs = INTEGRATION_DEEPENING_LADDER[lever];
  return INTEGRATION_LADDER_RUNG_ORDER.map((rungId) => {
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
// Adapter: OperationalToolData sections -> IntegrationSession (defensive, store-agnostic)
// ---------------------------------------------------------------------------

const asType = (raw: unknown): IntegrationType => {
  if (raw === 'api' || raw === 'file' || raw === 'db' || raw === 'manual' || raw === 'none') return raw;
  if (typeof raw === 'string') {
    const s = raw.toLowerCase();
    if (/api|rest|soap|edi/.test(s)) return 'api';
    if (/file|csv|flat|batch.?file/.test(s)) return 'file';
    if (/db|database|shared/.test(s)) return 'db';
    if (/manual|hand|excel|copy|paste|rekey|re-key/.test(s)) return 'manual';
  }
  return 'none';
};

const asFrequency = (raw: unknown): IntegrationFrequency => {
  if (raw === 'realtime' || raw === 'batch' || raw === 'ondemand' || raw === 'manual') return raw;
  if (typeof raw === 'string') {
    const s = raw.toLowerCase();
    if (/real.?time|live|stream/.test(s)) return 'realtime';
    if (/batch|daily|nightly|schedul/.test(s)) return 'batch';
    if (/demand|request|adhoc|ad.?hoc/.test(s)) return 'ondemand';
    if (/manual|hand/.test(s)) return 'manual';
  }
  return 'batch';
};

const asLever = (raw: unknown): IntegrationLeverId | undefined =>
  raw === 'inventory' || raw === 'topology' || raw === 'bridges' || raw === 'apiled' ? raw : undefined;

const asNumber = (raw: unknown): number | undefined =>
  typeof raw === 'number' && Number.isFinite(raw) ? raw : undefined;

const truthy = (raw: unknown): boolean =>
  raw === true || (typeof raw === 'string' && /true|yes|1|y|tak/i.test(raw));

/** Coerce an error-rate that may arrive as 0..1, a percent (0..100), or a "%" string. */
const asRate = (raw: unknown): number | undefined => {
  const n = asNumber(raw);
  if (n === undefined) {
    if (typeof raw === 'string') {
      const parsed = parseFloat(raw.replace('%', '').trim());
      if (Number.isFinite(parsed)) return parsed > 1 ? parsed / 100 : parsed;
    }
    return undefined;
  }
  return n > 1 ? n / 100 : n;
};

/**
 * Extract an IntegrationSession from the operational tool's `sections`. Reads
 * `systems`, `integrations` (or `edges`), `bridges` (or `manual`) and `moves`
 * defensively; unknown values fall back to sane defaults (type none, batch
 * frequency, point-to-point true) rather than throwing.
 *
 * Convention on OperationalItem:
 *  - systems:      `category` = 'core' marks a core system; `hasApi`/`owned` flags;
 *                  `target` name.
 *  - integrations: `from`/`to` system ids; `category` = mechanism (api/file/db/manual);
 *                  `frequency` = cadence; boolean flags pointToPoint/critical/spof/
 *                  documented/monitored/reusesApi; `mttrHours` numeric.
 *  - bridges:      `people`, `hoursPerMonth`, `errorRate` numeric; `critical`/`bothHaveApi` flags.
 *  - moves:        `category` = lever; impact/effort/evidence carry the scoring facts.
 */
export function toIntegrationSession(
  sections: Record<string, unknown[]> | undefined
): IntegrationSession {
  const rawSystems = ((sections?.['systems'] || sections?.['applications'] || []) as unknown[]) as Array<
    Record<string, unknown>
  >;
  const rawEdges = ((sections?.['integrations'] || sections?.['edges'] || []) as unknown[]) as Array<
    Record<string, unknown>
  >;
  const rawBridges = ((sections?.['bridges'] || sections?.['manual'] || []) as unknown[]) as Array<
    Record<string, unknown>
  >;
  const rawMoves = ((sections?.['moves'] || sections?.['initiatives'] || []) as unknown[]) as Array<
    Record<string, unknown>
  >;

  const systems: SystemNode[] = rawSystems.map((item, idx) => ({
    id: String(item.id ?? `sys-${idx}`),
    name: typeof item.name === 'string' ? item.name : typeof item.target === 'string' ? item.target : undefined,
    core: item.category === 'core' || truthy(item.core),
    hasApi: truthy(item.hasApi) || truthy(item.api),
    owned: truthy(item.owned) || truthy(item.owner),
  }));

  const integrations: IntegrationEdge[] = rawEdges.map((item, idx) => ({
    id: String(item.id ?? `edge-${idx}`),
    from: typeof item.from === 'string' ? item.from : undefined,
    to: typeof item.to === 'string' ? item.to : undefined,
    type: asType(item.type ?? item.category),
    frequency: asFrequency(item.frequency),
    // default point-to-point true unless explicitly routed via a hub
    pointToPoint: item.pointToPoint === false || truthy(item.viaHub) ? false : true,
    critical: truthy(item.critical),
    spof: truthy(item.spof),
    documented: truthy(item.documented),
    monitored: truthy(item.monitored),
    reusesApi: truthy(item.reusesApi) || truthy(item.reuse),
    mttrHours: asNumber(item.mttrHours),
  }));

  const bridges: ManualBridge[] = rawBridges.map((item, idx) => ({
    id: String(item.id ?? `bridge-${idx}`),
    people: asNumber(item.people),
    hoursPerMonth: asNumber(item.hoursPerMonth) ?? asNumber(item.hours),
    errorRate: asRate(item.errorRate),
    critical: truthy(item.critical),
    bothHaveApi: truthy(item.bothHaveApi) || truthy(item.bothApi),
  }));

  const moves: IntegrationMoveItem[] = rawMoves.map((item, idx) => ({
    id: String(item.id ?? `move-${idx}`),
    lever: asLever(item.category ?? item.lever),
    impact: (item.impact as IntegrationMoveItem['impact']) ?? undefined,
    effort: (item.effort as IntegrationMoveItem['effort']) ?? undefined,
    evidence: Array.isArray(item.evidence) ? (item.evidence as string[]) : [],
  }));

  return { systems, integrations, bridges, moves };
}
