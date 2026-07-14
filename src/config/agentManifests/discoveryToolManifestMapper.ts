/**
 * Discovery Tool -> Agent Manifest mapper — HP-3 (Harvey-Parity Blok A)
 *
 * Two constructors:
 *   - `buildBuiltToolManifest`: for a tool with a real `src/config/<dir>`, derives
 *     `steps` from the tool's own ladder/question-bank Record (its keys ARE the
 *     methodology's sections), and merges the doctrine-wide sources/outputs
 *     (`consultingToolsStandard.ts`) with any tool-specific extras.
 *   - `buildPlannedToolManifest`: for a tool type listed in
 *     `CONSULTING_TOOL_ROLLOUT_PRIORITY` that has no config dir yet — steps/
 *     sources/outputs stay empty (no guessing), `status: 'planned'`.
 */
import {
  CONSULTING_TOOL_CONTEXT_SOURCES,
  CONSULTING_TOOL_STANDARD_OUTPUTS,
} from '../consultingToolsStandard';
import type { AgentManifest, AgentManifestDisplayName } from './types';

export function buildBuiltToolManifest(args: {
  id: string;
  configDir: string;
  displayName: AgentManifestDisplayName;
  wave: string | null;
  /** The tool's primary Record<sectionId, ...[]> (ladder or question bank) — its
   *  keys become `steps`. Pass an array of ids directly (e.g. valuechain's
   *  activity list) when the tool doesn't expose a Record. */
  stepsSource: Record<string, unknown> | string[];
  extraSources?: string[];
  extraOutputs?: string[];
}): AgentManifest {
  const steps = Array.isArray(args.stepsSource)
    ? [...args.stepsSource]
    : Object.keys(args.stepsSource);

  return {
    id: args.id,
    sourceType: 'discovery_tool',
    status: 'built',
    displayName: args.displayName,
    wave: args.wave,
    configDir: args.configDir,
    steps,
    sources: [...CONSULTING_TOOL_CONTEXT_SOURCES, ...(args.extraSources || [])],
    outputs: [...CONSULTING_TOOL_STANDARD_OUTPUTS, ...(args.extraOutputs || [])],
  };
}

export function buildPlannedToolManifest(args: {
  id: string;
  displayName: AgentManifestDisplayName;
  wave: string | null;
}): AgentManifest {
  return {
    id: args.id,
    sourceType: 'discovery_tool',
    status: 'planned',
    displayName: args.displayName,
    wave: args.wave,
    configDir: null,
    steps: [],
    sources: [],
    outputs: [],
  };
}
