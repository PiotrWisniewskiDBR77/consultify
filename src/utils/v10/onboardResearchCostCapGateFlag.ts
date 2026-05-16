/**
 * Chat V10 / V10-ONB-016 — feature flag for the first-research cost
 * cap + source policy confirmation gate.
 *
 * Contract is **on-by-construction** (same posture as
 * `ff.onboard_first_export_manifest` and `ff.onboard_no_ghost_caps`):
 * no research run may start without a confirmation record. Callers
 * therefore cannot meaningfully turn the gate off — disabling it
 * would let a first research run bypass its cost cap, which the dev
 * plan calls a P0 breach. The flag is still registered in the V10
 * flag registry so policy tooling can read it and so the CI mirror
 * (V10 invariant 23) enforces its default-ON position.
 *
 * Runtime contract lives in
 * `src/models/onboarding/ResearchCostCapGate.ts`.
 */

const LS_KEY = 'ff.onboard_research_cost_cap_gate';
const QUERY_KEY = 'ff_onboard_research_cost_cap_gate';
const ENV_KEY = 'VITE_ONBOARD_RESEARCH_COST_CAP_GATE';

/**
 * Always returns `true`: the gate is a hard safety invariant. The
 * `AGENTS.md` CI mirror + `ON_BY_CONSTRUCTION_ALLOWLIST` guard ensure
 * no one disables it from the central registry.
 */
export function isOnboardResearchCostCapGateEnabled(): boolean {
  return true;
}

export const ONBOARD_RESEARCH_COST_CAP_GATE_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
