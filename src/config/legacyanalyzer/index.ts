/**
 * Legacy Analyzer — config layer barrel.
 *
 * SSOT for the legacy-portfolio-rationalization methodology content and its
 * deterministic synthesis engine. Cloned from the Inventory Autopilot config
 * pattern (src/config/inventoryautopilot):
 *   - deepeningLadder.ts   : per-dimension depth staircase + partner-grade proposal bank (PL/EN)
 *   - legacyEngine.ts      : TIME matrix + 6R + tech-debt scoring + dependency-graph roadmap
 *   - conclusionPrompts.ts : INSIGHT-FIRST AI prompt builders grounded in the engine output
 *
 * Self-contained: the engine reads a minimal LegacySession, and this barrel
 * offers a defensive adapter from the store's OperationalToolData sections so
 * callers never have to reach into section internals.
 */

import {
  LEGACY_DEEPENING_LADDER,
  LEGACY_LADDER_RUNG_ORDER,
  type LadderRung,
  type LegacyDimensionId,
} from './deepeningLadder';
import type {
  DependencyEdge,
  LegacyApp,
  LegacySession,
  SupportStatus,
} from './legacyEngine';

export * from './deepeningLadder';
export * from './legacyEngine';
export * from './conclusionPrompts';

/** A ladder rung with strings resolved to a single language. */
export interface LocalizedRung {
  id: LadderRung['id'];
  depth: LadderRung['depth'];
  label: string;
  question: string;
  rationale: string;
}

/** Resolve a dimension's deepening ladder to one language, preserving rung order. */
export function localizeLadder(dimension: LegacyDimensionId, isPolish: boolean): LocalizedRung[] {
  const rungs = LEGACY_DEEPENING_LADDER[dimension];
  return LEGACY_LADDER_RUNG_ORDER.map((rungId) => {
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
// Adapter: OperationalToolData sections -> LegacySession (defensive, store-agnostic)
// ---------------------------------------------------------------------------

const asNumber = (raw: unknown): number | undefined =>
  typeof raw === 'number' && Number.isFinite(raw)
    ? raw
    : typeof raw === 'string' && raw.trim() !== '' && Number.isFinite(Number(raw))
      ? Number(raw)
      : undefined;

const truthy = (raw: unknown): boolean =>
  raw === true || (typeof raw === 'string' && /^(true|yes|tak|1|dead|gap|duplicate)/i.test(raw.trim()));

const asSupportStatus = (raw: unknown): SupportStatus | undefined => {
  if (raw === 'active' || raw === 'expiring' || raw === 'none') return raw;
  if (typeof raw === 'string') {
    const s = raw.trim().toLowerCase();
    if (/none|brak|eol|ended|wygasł/.test(s)) return 'none';
    if (/expir|wygasa|soon|kończy/.test(s)) return 'expiring';
    if (/active|aktywn|supported/.test(s)) return 'active';
  }
  return undefined;
};

/**
 * Extract a LegacySession from the operational tool's `sections`. Reads
 * `apps` (or `applications` / `systems`) and `dependencies` (or `edges` /
 * `integrations`) defensively; missing numeric facts stay undefined so the
 * engine applies its axis/risk defaults rather than throwing.
 *
 * Convention on OperationalItem for applications: numeric axis fields carry the
 * 1-5 business-value / technical-health averages; cost fields carry TCO /
 * replacement / remediation; flags (`hasBusinessOwner`, `complianceGap`,
 * `commoditized`, `duplicatedElsewhere`) mark qualifiers; `supportStatus` /
 * `supportEndsInMonths` / `busFactor` / `busFactorPrev` / `knownCves` /
 * `activeUsers` carry the risk facts. For dependencies: `from` depends on
 * `to`; `documented` marks whether the integration is known.
 */
export function toLegacySession(
  sections: Record<string, unknown[]> | undefined,
  meta?: { itBudgetPerYear?: number; regulated?: boolean }
): LegacySession {
  const rawApps = ((sections?.['apps'] ||
    sections?.['applications'] ||
    sections?.['systems'] ||
    []) as unknown[]) as Array<Record<string, unknown>>;
  const rawDeps = ((sections?.['dependencies'] ||
    sections?.['edges'] ||
    sections?.['integrations'] ||
    []) as unknown[]) as Array<Record<string, unknown>>;

  const apps: LegacyApp[] = rawApps.map((item, idx) => ({
    id: String(item.id ?? item.name ?? `app-${idx}`),
    name: typeof item.name === 'string' ? item.name : undefined,
    businessValue: asNumber(item.businessValue),
    technicalHealth: asNumber(item.technicalHealth),
    tcoPerYear: asNumber(item.tcoPerYear),
    replacementValue: asNumber(item.replacementValue),
    remediationCost: asNumber(item.remediationCost),
    activeUsers: asNumber(item.activeUsers),
    hasBusinessOwner: item.hasBusinessOwner === undefined ? undefined : truthy(item.hasBusinessOwner),
    busFactor: asNumber(item.busFactor),
    busFactorPrev: asNumber(item.busFactorPrev),
    supportStatus: asSupportStatus(item.supportStatus),
    supportEndsInMonths: asNumber(item.supportEndsInMonths),
    knownCves: asNumber(item.knownCves),
    complianceGap: item.complianceGap === undefined ? undefined : truthy(item.complianceGap),
    commoditized: item.commoditized === undefined ? undefined : truthy(item.commoditized),
    duplicatedElsewhere:
      item.duplicatedElsewhere === undefined ? undefined : truthy(item.duplicatedElsewhere),
  }));

  const validIds = new Set(apps.map((a) => a.id));
  const dependencies: DependencyEdge[] = rawDeps
    .map((item) => ({
      from: String(item.from ?? item.source ?? ''),
      to: String(item.to ?? item.target ?? ''),
      documented: item.documented === undefined ? undefined : truthy(item.documented),
    }))
    // Keep only edges whose endpoints exist in the inventory.
    .filter((e) => e.from !== '' && e.to !== '' && validIds.has(e.from) && validIds.has(e.to));

  return {
    apps,
    dependencies,
    itBudgetPerYear: meta?.itBudgetPerYear,
    regulated: meta?.regulated,
  };
}
