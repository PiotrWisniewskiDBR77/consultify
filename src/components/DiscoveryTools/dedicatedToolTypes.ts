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
