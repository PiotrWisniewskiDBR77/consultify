/**
 * Supply Chain Control Tower — config layer barrel.
 *
 * SSOT for the control-tower methodology content and its deterministic synthesis
 * engine. Cloned from the Inventory Autopilot config pattern
 * (src/config/inventoryautopilot):
 *   - deepeningLadder.ts      : per-lever depth staircase + partner-grade proposal bank (PL/EN)
 *   - controlTowerEngine.ts   : maturity diagnosis + blind spots + detection lag + risk
 *                               concentration + alert fatigue + W2 move sequencing
 *   - conclusionPrompts.ts    : INSIGHT-FIRST AI prompt builders grounded in the engine output
 *
 * Self-contained: the engine reads a minimal ControlTowerSession, and this barrel
 * offers a defensive adapter from the store's OperationalToolData sections so
 * callers never have to reach into section internals.
 */

import {
  CONTROL_TOWER_DEEPENING_LADDER,
  CONTROL_TOWER_LADDER_RUNG_ORDER,
  type ControlTowerLeverId,
  type LadderRung,
} from './deepeningLadder';
import type {
  ChainNode,
  ControlTowerMoveItem,
  ControlTowerSession,
  ExceptionItem,
  MaturityLevel,
} from './controlTowerEngine';

export * from './deepeningLadder';
export * from './controlTowerEngine';
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
export function localizeLadder(lever: ControlTowerLeverId, isPolish: boolean): LocalizedRung[] {
  const rungs = CONTROL_TOWER_DEEPENING_LADDER[lever];
  return CONTROL_TOWER_LADDER_RUNG_ORDER.map((rungId) => {
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
// Adapter: OperationalToolData sections -> ControlTowerSession (defensive, store-agnostic)
// ---------------------------------------------------------------------------

const asLever = (raw: unknown): ControlTowerLeverId | undefined =>
  raw === 'visibility' || raw === 'exceptions' || raw === 'response' || raw === 'maturity'
    ? raw
    : undefined;

const asNumber = (raw: unknown): number | undefined =>
  typeof raw === 'number' && Number.isFinite(raw)
    ? raw
    : typeof raw === 'string' && raw.trim() !== '' && Number.isFinite(Number(raw))
      ? Number(raw)
      : undefined;

const truthy = (raw: unknown): boolean =>
  raw === true || (typeof raw === 'string' && /^(true|yes|tak|1|integrated|owned)$/i.test(raw.trim()));

/** Coerce a 0..1 ratio; also accepts a 0..100 percentage. */
const asRatio = (raw: unknown): number | undefined => {
  const n = asNumber(raw);
  if (n === undefined) return undefined;
  return n > 1 ? Math.min(1, n / 100) : Math.max(0, n);
};

const asMaturityLevel = (raw: unknown): MaturityLevel | undefined => {
  const n = asNumber(raw);
  return n === 1 || n === 2 || n === 3 || n === 4 || n === 5 ? (n as MaturityLevel) : undefined;
};

/**
 * Extract a ControlTowerSession from the operational tool's `sections`. Reads
 * `nodes` (chain systems/partners), `exceptions` (tracked disruption types) and
 * `moves` (candidate initiatives) defensively; unknown fields fall back to sane
 * defaults rather than throwing.
 *
 * Convention on OperationalItem:
 *  - NODES:      `category`/`kind` = node type; `integrated`/`owner` truthy = has a
 *                feed; `threshold` = feed lag (hours); `target` = flow value.
 *  - EXCEPTIONS: `category` = lever; `target`/`volume` = fire count;
 *                `threshold` = detection lag (hours); `frequency` = closed-no-action
 *                ratio; `hasThreshold`/`hasOwner`/`dynamicThreshold` flags;
 *                `source`/`owner` = the source/route/supplier it concentrates on.
 *  - MOVES:      `category` = lever; impact/effort/evidence carry the scoring facts.
 */
export function toControlTowerSession(
  sections: Record<string, unknown[]> | undefined
): ControlTowerSession {
  const rawNodes = ((sections?.['nodes'] || sections?.['sources'] || []) as unknown[]) as Array<
    Record<string, unknown>
  >;
  const rawExceptions = ((sections?.['exceptions'] ||
    sections?.['kpis'] ||
    []) as unknown[]) as Array<Record<string, unknown>>;
  const rawMoves = ((sections?.['moves'] || sections?.['initiatives'] || []) as unknown[]) as Array<
    Record<string, unknown>
  >;

  const nodes: ChainNode[] = rawNodes.map((item, idx) => ({
    id: String(item.id ?? item.name ?? `node-${idx}`),
    kind: typeof item.kind === 'string' ? item.kind : typeof item.category === 'string' ? item.category : 'node',
    integrated: truthy(item.integrated ?? item.owner),
    feedLagHours: asNumber(item.feedLagHours) ?? asNumber(item.threshold),
    flowValue: asNumber(item.flowValue) ?? asNumber(item.target),
  }));

  const exceptions: ExceptionItem[] = rawExceptions.map((item, idx) => ({
    id: String(item.id ?? item.name ?? `exc-${idx}`),
    lever: asLever(item.category),
    volume: asNumber(item.volume) ?? asNumber(item.target),
    detectionLagHours: asNumber(item.detectionLagHours) ?? asNumber(item.threshold),
    closedNoActionRatio: asRatio(item.closedNoActionRatio ?? item.frequency),
    hasThreshold: truthy(item.hasThreshold),
    hasOwner: truthy(item.hasOwner ?? item.owner),
    dynamicThreshold: truthy(item.dynamicThreshold),
    sourceId:
      typeof item.source === 'string'
        ? item.source
        : typeof item.owner === 'string'
          ? item.owner
          : undefined,
  }));

  const moves: ControlTowerMoveItem[] = rawMoves.map((item, idx) => ({
    id: String(item.id ?? `move-${idx}`),
    lever: asLever(item.category),
    impact: (item.impact as ControlTowerMoveItem['impact']) ?? undefined,
    effort: (item.effort as ControlTowerMoveItem['effort']) ?? undefined,
    evidence: Array.isArray(item.evidence) ? (item.evidence as string[]) : [],
  }));

  return { nodes, exceptions, moves, declaredLevel: asMaturityLevel(sections?.['declaredLevel']) };
}
