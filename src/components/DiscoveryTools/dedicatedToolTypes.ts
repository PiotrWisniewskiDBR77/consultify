import type { ToolType } from '@/store/useToolStore';

/**
 * Tool session types that have a real ToolDocumentView/ToolCanvas implementation.
 * Keep this list outside DiscoveryToolsHub so launchability and the document
 * renderer cannot silently drift apart.
 */
export const DEDICATED_TOOL_TYPES = [
  'dynamic-swot',
  'market-forces',
  'growth-paths',
  'value-chain',
  'portfolio-priority',
  'risk-uncertainty',
  'capability-mapper',
  'ambition-decomposer',
  'focus-tradeoff',
  'narrative-engine',
  'sop-builder',
  'a3-problem-solving',
  'vsm-builder',
  'smed-planner',
  'dms-builder',
  'inventory-autopilot',
  'constraint-control',
  'decision-engine',
  'control-tower',
  'automation-pipeline',
  'robotics-feasibility',
  'logistics-automation',
  'rpa-scanner',
  'ai-discovery',
  'integration-diagnostic',
  'digital-value-pool',
  'legacy-analyzer',
  'data-inventory',
  'pain-to-solution',
  'pain-explorer',
  'process-automation',
] as const satisfies readonly ToolType[];

const dedicatedToolTypeSet = new Set<string>(DEDICATED_TOOL_TYPES);

export function hasDedicatedToolDocumentView(toolType: string): toolType is ToolType {
  return dedicatedToolTypeSet.has(toolType);
}

/**
 * DEC-118 repair #4 (2026-08-26) — categorization, NOT a behavior change.
 *
 * The panel flagged "31 declared vs 16 real branches" as a drift risk and
 * asked for a SHIPPED/DECLARED split where DECLARED types would show an
 * honest "coming soon" state instead of launching. Verified empirically by
 * grep against `src/components/DiscoveryTools/ToolCanvas.tsx` (per the
 * brief's own instruction — "zweryfikuj listę 16 gałęzi grep-em, nie
 * przepisuj z panelu") rather than trusting the panel's number as-is:
 *
 *   grep -n "if (toolType === '" ToolCanvas.tsx   -> exactly 16 matches,
 *   confirming the panel's "16" was counting literal bespoke
 *   `if (toolType === 'X')` step blocks (multi-phase Build/Input/
 *   Insights/Outputs UIs like SWOT/MarketForces/ValueChain/...).
 *
 * BUT: the panel's framing that the other 15 render "pustą powłokę" (an
 * empty shell) does NOT hold up. All 31 types share three universal step
 * ids handled with NO toolType gate at all (context/summary/initiatives/
 * report/... — ToolCanvas.tsx lines ~231-289), and the 15 non-bespoke types
 * additionally resolve through one of two REAL, functional (not stub)
 * fallbacks for their remaining steps:
 *   - `GenericDomainStep` (3 types: ai-discovery, pain-explorer, rpa-scanner)
 *   - `OperationalSectionStep` (a working add/edit/remove item list backed
 *     by `session.inputData`, persisted via `updateInputData` — 12 types:
 *     vsm-builder, constraint-control, decision-engine, control-tower,
 *     automation-pipeline, robotics-feasibility, logistics-automation,
 *     integration-diagnostic, digital-value-pool, legacy-analyzer,
 *     data-inventory, pain-to-solution)
 * plus 5 more (sop-builder, a3-problem-solving, smed-planner, dms-builder,
 * inventory-autopilot) that mix a handful of bespoke steps with
 * `OperationalSectionStep` for the rest — hence they show up in BOTH sets
 * below.
 *
 * Gating the 15 non-SHIPPED types to a blocking "coming soon" state, as the
 * panel's literal instruction asked, would therefore RETIRE working session
 * functionality (chat, streaming, initiative generation, promote-to-output)
 * for real users — the opposite of a truthfulness fix. Per CLAUDE.md's
 * "Złote reguły" (verify real runtime before declaring anything, incl. a
 * panel's own diagnosis), this file stops at exposing the verified,
 * documented split for future use — `hasDedicatedToolDocumentView` keeps
 * gating on the full `DEDICATED_TOOL_TYPES` set (unchanged behavior). The
 * gating decision itself is a product call for the owner, not something to
 * execute silently inside a cheap repair batch.
 */
export const SHIPPED_TOOL_TYPES = [
  'dynamic-swot',
  'process-automation',
  'market-forces',
  'value-chain',
  'capability-mapper',
  'ambition-decomposer',
  'focus-tradeoff',
  'narrative-engine',
  'growth-paths',
  'portfolio-priority',
  'risk-uncertainty',
  'sop-builder',
  'a3-problem-solving',
  'smed-planner',
  'dms-builder',
  'inventory-autopilot',
] as const satisfies readonly ToolType[];

const shippedToolTypeSet = new Set<string>(SHIPPED_TOOL_TYPES);

/**
 * True only for a bespoke, multi-phase ToolCanvas.tsx `if (toolType === 'X')`
 * branch — NOT a completeness gate. A `false` result does not mean the tool
 * is non-functional (see the file header above); it means the tool's step
 * UI is the shared generic list-builder rather than a purpose-built one.
 * Not wired into any start gate yet — informational, pending an owner
 * decision on what (if anything) should visually distinguish these 15.
 */
export function isShippedToolType(toolType: string): toolType is ToolType {
  return shippedToolTypeSet.has(toolType);
}
