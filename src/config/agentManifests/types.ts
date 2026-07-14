/**
 * Agent Manifest — HP-3 (Harvey-Parity Blok A)
 *
 * A read-only, data-only description of what a Discovery Tool WOULD look like as
 * an agent: its steps (deepening ladder / question bank sections), the evidence
 * sources it draws on, and the outputs it can hand off. This is metadata for
 * future agent composition (HP-4 "Plan mode" UI) — it does NOT execute anything.
 *
 * Placement note (audit decision, flag for Piotr): this lives in the FRONTEND
 * tree (`src/config/agentManifests/`), not `server/src/services/ai/agentRuntime/`
 * (HP-2), because the 31 Discovery Tools' source-of-truth content
 * (`src/config/<tool>/deepeningLadder.ts` etc.) is frontend-only code — the
 * server package has its own `rootDir`/tsconfig scoped to `server/src`, so a
 * cross-tree import would break the build. If a server-side agent needs this
 * data at runtime later, expose it via an API/route rather than importing
 * frontend source directly into `server/`.
 */

export type AgentManifestSourceType = 'discovery_tool';

/** 'built' = real config (`src/config/<dir>`) exists and was introspected.
 *  'planned' = the tool type is defined in `CONSULTING_TOOL_ROLLOUT_PRIORITY`
 *  (doctrine) but has no `src/config/<dir>` yet — steps/sources/outputs are
 *  intentionally empty rather than guessed. */
export type AgentManifestStatus = 'built' | 'planned';

export interface AgentManifestDisplayName {
  pl: string;
  en: string;
}

export interface AgentManifest {
  /** Canonical tool type id, e.g. 'a3-problem-solving' (matches `ToolType` / `CONSULTING_TOOL_ROLLOUT_PRIORITY`). */
  id: string;
  sourceType: AgentManifestSourceType;
  status: AgentManifestStatus;
  displayName: AgentManifestDisplayName;
  /** Rollout wave from `CONSULTING_TOOL_ROLLOUT_PRIORITY`, or 'reference' for the
   *  already-shipped reference tool (dynamic-swot), or null if not classified. */
  wave: string | null;
  /** `src/config/<dir>` this manifest was introspected from, or null when planned. */
  configDir: string | null;
  /** Ordered step ids the tool walks the user through (ladder sections / question
   *  bank tracks / value-chain activities — whichever primary Record/array the
   *  tool's config exposes). Empty for 'planned' tools. */
  steps: string[];
  /** Evidence sources the tool can draw on. Always includes the doctrine-wide
   *  `CONSULTING_TOOL_CONTEXT_SOURCES` for 'built' tools, plus any tool-specific
   *  extras found in its config (e.g. portfolio's org-initiatives import). */
  sources: string[];
  /** Output types the tool can hand off. Always includes the doctrine-wide
   *  `CONSULTING_TOOL_STANDARD_OUTPUTS` for 'built' tools, plus any tool-specific
   *  extras (e.g. risk-uncertainty's RAID handoff). */
  outputs: string[];
}
