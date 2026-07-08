/**
 * Automation Pipeline — config layer barrel.
 *
 * SSOT for the Intelligent Automation / hyperautomation methodology content and
 * its deterministic synthesis engine. Cloned from the RPA Scanner / inventory
 * config pattern (src/config/rpascanner, src/config/inventoryautopilot):
 *   - deepeningLadder.ts            : per-lever depth staircase + partner-grade proposal bank (PL/EN)
 *   - automationPipelineEngine.ts   : tech-tier selection + effort×impact matrix + redesign-first
 *                                     detection + hidden-volume/TCO + lever scoring + W2 wave sequence
 *   - conclusionPrompts.ts          : insight-first AI prompt builders grounded in the engine output
 *
 * Self-contained: the engine reads a minimal AutomationPipelineSession, and this
 * barrel offers a defensive adapter from the store's OperationalToolData sections
 * so callers never have to reach into section internals.
 */

import {
  PIPELINE_DEEPENING_LADDER,
  PIPELINE_LADDER_RUNG_ORDER,
  type PipelineLeverId,
  type LadderRung,
} from './deepeningLadder';
import type {
  AutomationPipelineSession,
  AutomationMoveItem,
  DataStructure,
  ProcessCandidate,
} from './automationPipelineEngine';

export * from './deepeningLadder';
export * from './automationPipelineEngine';
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
export function localizeLadder(lever: PipelineLeverId, isPolish: boolean): LocalizedRung[] {
  const rungs = PIPELINE_DEEPENING_LADDER[lever];
  return PIPELINE_LADDER_RUNG_ORDER.map((rungId) => {
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
// Adapter: OperationalToolData sections -> AutomationPipelineSession (defensive)
// ---------------------------------------------------------------------------

const LEVER_IDS: PipelineLeverId[] = [
  'discover',
  'profile',
  'technology',
  'prioritize',
  'sequence',
];

const asLever = (raw: unknown): PipelineLeverId | undefined =>
  typeof raw === 'string' && (LEVER_IDS as string[]).includes(raw)
    ? (raw as PipelineLeverId)
    : undefined;

const asLevel = (raw: unknown): 'high' | 'medium' | 'low' | undefined =>
  raw === 'high' || raw === 'medium' || raw === 'low' ? raw : undefined;

const asDataStructure = (raw: unknown): DataStructure | undefined =>
  raw === 'system' || raw === 'structured-doc' || raw === 'unstructured-doc' || raw === 'free-text'
    ? raw
    : undefined;

const asNumber = (raw: unknown): number | undefined =>
  typeof raw === 'number' && Number.isFinite(raw) ? raw : undefined;

/** Parse a 0..1 share, accepting either a fraction (0.3) or a percent (30). */
const asShare = (raw: unknown): number | undefined => {
  const n = asNumber(raw);
  if (n === undefined) return undefined;
  return n > 1 ? Math.min(1, n / 100) : Math.max(0, n);
};

const truthy = (raw: unknown): boolean =>
  raw === true || (typeof raw === 'string' && /^(true|yes|1|ready|api)$/i.test(raw.trim()));

const asSource = (raw: unknown): ProcessCandidate['source'] =>
  raw === 'process-mining' || raw === 'task-mining' || raw === 'top-down' ? raw : undefined;

/**
 * Extract an AutomationPipelineSession from the operational tool's `sections`.
 * Reads `process-candidates` (or `candidates`/`processes`) and `moves` (or
 * `automation-ideas`/`ideas`) defensively; unknown fields fall back to sane
 * defaults rather than throwing.
 *
 * Convention on OperationalItem for candidates: `category` carries the lever;
 * `ruleness`/`stability`/`errorRisk` carry the Level facts; `dataStructure`
 * carries the data profile; numeric fields carry volume/handling/exception/
 * concentration; `apiAvailable`/`ownerReady`/`measured` carry the flags;
 * `source` carries how the candidate was discovered. For moves: `category`
 * carries the lever; impact/effort/evidence carry the scoring facts.
 */
export function toAutomationPipelineSession(
  sections: Record<string, unknown[]> | undefined
): AutomationPipelineSession {
  const rawCandidates = ((sections?.['process-candidates'] ||
    sections?.['candidates'] ||
    sections?.['processes'] ||
    []) as unknown[]) as Array<Record<string, unknown>>;
  const rawMoves = ((sections?.['moves'] ||
    sections?.['automation-ideas'] ||
    sections?.['ideas'] ||
    []) as unknown[]) as Array<Record<string, unknown>>;

  const candidates: ProcessCandidate[] = rawCandidates.map((item, idx) => ({
    id: String(item.id ?? item.name ?? `proc-${idx}`),
    lever: asLever(item.lever ?? item.category),
    ruleness: asLevel(item.ruleness ?? item.standardization),
    dataStructure: asDataStructure(item.dataStructure),
    stability: asLevel(item.stability),
    volumePerMonth: asNumber(item.volumePerMonth) ?? asNumber(item.volume),
    handlingMinutes: asNumber(item.handlingMinutes) ?? asNumber(item.handlingTime),
    exceptionRate: asShare(item.exceptionRate),
    pathConcentration: asShare(item.pathConcentration),
    apiAvailable:
      item.apiAvailable === undefined ? undefined : truthy(item.apiAvailable),
    errorRisk: asLevel(item.errorRisk),
    ownerReady: item.ownerReady === undefined ? undefined : truthy(item.ownerReady),
    measured:
      item.measured === undefined
        ? asNumber(item.volumePerMonth) !== undefined || asNumber(item.volume) !== undefined
        : truthy(item.measured),
    source: asSource(item.source),
    evidence: Array.isArray(item.evidence) ? (item.evidence as string[]) : [],
  }));

  const moves: AutomationMoveItem[] = rawMoves.map((item, idx) => ({
    id: String(item.id ?? `move-${idx}`),
    lever: asLever(item.lever ?? item.category),
    processId: item.processId !== undefined ? String(item.processId) : undefined,
    impact: asLevel(item.impact),
    effort: asLevel(item.effort),
    evidence: Array.isArray(item.evidence) ? (item.evidence as string[]) : [],
  }));

  return { candidates, moves };
}
