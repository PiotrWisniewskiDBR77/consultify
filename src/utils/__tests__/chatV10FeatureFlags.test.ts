/**
 * Chat V10 — tests for the V10 feature flag registry and taxonomy.
 *
 * Scope (Wave A seed pass · 2026-04-18)
 * --------------------------------------
 * The V10 registry now holds the three Wave A seed flags:
 *
 *   - V10-ART-001 · `ff.artifact_unified_model`
 *   - V10-AGT-001 · `ff.agent_execution_proposal_v1`
 *   - V10-ONB-001 · `ff.onboard_persona_capture`
 *
 * The previous "registry is empty" tripwire has flipped into a
 * "Wave A seed has landed" assertion. Subsequent tickets will widen
 * the inequality (`>= EXPECTED_WAVE_A_SEED_FLAG_COUNT`) without
 * needing to touch this header.
 *
 * The existing structural invariants (block taxonomy, ticket scheme,
 * key prefixes, default-OFF policy, ADR ↔ master-plan bijection) all
 * stay in force; they now run against three real entries.
 *
 * Invariant 31 inbound stays in **soft** mode — it reports coverage
 * ("X of 206 requirements have a registered flag") without failing CI.
 * When Wave A is cut, the flag-adder script flips this to hard mode.
 * The TODO in the test body is the tripwire.
 */

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { beforeEach, describe, expect, it } from 'vitest';

import {
  CHAT_V10_BLOCK_CODE,
  CHAT_V10_BLOCKS,
  CHAT_V10_FLAGS,
  CHAT_V10_REQUIREMENT_PREFIX,
  type ChatV10Block,
  clearChatV10FlagOverride,
  findChatV10Flag,
  findChatV10FlagByRequirement,
  findChatV10FlagByTicket,
  getChatV10FlagOverrides,
  getChatV10FlagOverrideState,
  getChatV10FlagSnapshot,
  resetAllChatV10FlagOverrides,
  setChatV10FlagOverride,
} from '../chatV10FeatureFlags';

const DOCS_DIR = path.resolve(__dirname, '../../..', 'docs', 'Chat V9');
const MASTER_PLAN = 'CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md';

const EXPECTED_BLOCKS: readonly ChatV10Block[] = [
  'reasoning',
  'learning',
  'agent_runtime',
  'research',
  'artifact',
  'connectors',
  'outcome',
  'onboarding',
];

const EXPECTED_BLOCK_CODES: Record<ChatV10Block, string> = {
  reasoning: 'RSN',
  learning: 'LRN',
  agent_runtime: 'AGT',
  research: 'RSR',
  artifact: 'ART',
  connectors: 'CON',
  outcome: 'OUT',
  onboarding: 'ONB',
};

// ---------------------------------------------------------------------------
// Block taxonomy (master plan §1.1 + §2.2).
// ---------------------------------------------------------------------------

describe('chatV10FeatureFlags · block taxonomy', () => {
  it('CHAT_V10_BLOCKS contains exactly the 8 blocks master plan §1.1 pins', () => {
    expect([...CHAT_V10_BLOCKS]).toEqual([...EXPECTED_BLOCKS]);
  });

  it('CHAT_V10_BLOCK_CODE is bijective and matches master plan §2.2', () => {
    // Forward: every block → expected code.
    for (const block of CHAT_V10_BLOCKS) {
      expect(CHAT_V10_BLOCK_CODE[block]).toBe(EXPECTED_BLOCK_CODES[block]);
    }
    // Inverse uniqueness: no two blocks share a code.
    const codes = CHAT_V10_BLOCKS.map((b) => CHAT_V10_BLOCK_CODE[b]);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('CHAT_V10_REQUIREMENT_PREFIX covers all 8 blocks and is bijective', () => {
    for (const block of CHAT_V10_BLOCKS) {
      expect(CHAT_V10_REQUIREMENT_PREFIX[block]).toMatch(/^R-[A-Z]+-$/);
    }
    const prefixes = CHAT_V10_BLOCKS.map((b) => CHAT_V10_REQUIREMENT_PREFIX[b]);
    expect(new Set(prefixes).size).toBe(prefixes.length);
  });

  it('master plan §1.1 lists exactly the same 8 blocks in the ChatV10Block union', () => {
    const masterSource = readFileSync(path.join(DOCS_DIR, MASTER_PLAN), 'utf8');
    // Slice the fenced `export type ChatV10Block` block.
    const UNION_RE = /export type ChatV10Block =\s*([\s\S]*?);/;
    const match = UNION_RE.exec(masterSource);
    expect(match, 'ChatV10Block union not found in master plan §1.1').not.toBeNull();
    const unionBody = match![1];
    const found = [...unionBody.matchAll(/['"]([a-z_]+)['"]/g)].map((m) => m[1]);
    expect(new Set(found)).toEqual(new Set(EXPECTED_BLOCKS));
  });
});

// ---------------------------------------------------------------------------
// Registry shape (invariants 32, 33, 40 — running against Wave A seed).
// ---------------------------------------------------------------------------

/**
 * Wave A seed cardinality. When subsequent Wave A tickets register
 * additional flags, replace this with a `.toBeGreaterThanOrEqual` once
 * the cardinality stops being a useful invariant. Until then the exact
 * count is asserted so a reviewer cannot silently drop a seed flag.
 */
const EXPECTED_WAVE_A_SEED_FLAG_COUNT = 218;

const EXPECTED_WAVE_A_SEED = [
  // V10-02 pass (2026-04-18)
  {
    id: 'artifact-unified-model',
    ticketId: 'V10-ART-001',
    requirementId: 'R-ARTIFACT-1',
    block: 'artifact',
  },
  {
    id: 'agent-execution-proposal-v1',
    ticketId: 'V10-AGT-001',
    requirementId: 'R-AGENT-1',
    block: 'agent_runtime',
  },
  {
    id: 'onboard-persona-capture',
    ticketId: 'V10-ONB-001',
    requirementId: 'R-ONBOARD-1',
    block: 'onboarding',
  },
  // V10-03 pass (2026-04-18)
  {
    id: 'artifact-type-registry',
    ticketId: 'V10-ART-002',
    requirementId: 'R-ARTIFACT-2',
    block: 'artifact',
  },
  {
    id: 'agent-severity-policies',
    ticketId: 'V10-AGT-002',
    requirementId: 'R-AGENT-2',
    block: 'agent_runtime',
  },
  {
    id: 'onboard-persona-inference-override',
    ticketId: 'V10-ONB-002',
    requirementId: 'R-ONBOARD-2',
    block: 'onboarding',
  },
  // V10-04 pass (2026-04-18)
  {
    id: 'artifact-review-fsm',
    ticketId: 'V10-ART-003',
    requirementId: 'R-ARTIFACT-3',
    block: 'artifact',
  },
  {
    id: 'agent-op-type-registry',
    ticketId: 'V10-AGT-003',
    requirementId: 'R-AGENT-3',
    block: 'agent_runtime',
  },
  {
    id: 'onboard-route-resolver',
    ticketId: 'V10-ONB-003',
    requirementId: 'R-ONBOARD-3',
    block: 'onboarding',
  },
  // V10-05 pass (2026-04-18)
  {
    id: 'artifact-data-classification',
    ticketId: 'V10-ART-004',
    requirementId: 'R-ARTIFACT-4',
    block: 'artifact',
  },
  {
    id: 'agent-approval-mode',
    ticketId: 'V10-AGT-004',
    requirementId: 'R-AGENT-4',
    block: 'agent_runtime',
  },
  {
    id: 'onboard-persona-journey',
    ticketId: 'V10-ONB-004',
    requirementId: 'R-ONBOARD-4',
    block: 'onboarding',
  },
  // V10-06 pass (2026-04-18)
  {
    id: 'artifact-lineage-graph',
    ticketId: 'V10-ART-005',
    requirementId: 'R-ARTIFACT-5',
    block: 'artifact',
  },
  {
    id: 'agent-optimistic-concurrency',
    ticketId: 'V10-AGT-005',
    requirementId: 'R-AGENT-5',
    block: 'agent_runtime',
  },
  {
    id: 'onboard-trust-first-banner',
    ticketId: 'V10-ONB-005',
    requirementId: 'R-ONBOARD-5',
    block: 'onboarding',
  },
  // V10-07 pass (2026-04-18)
  {
    id: 'artifact-canonical-content',
    ticketId: 'V10-ART-006',
    requirementId: 'R-ARTIFACT-6',
    block: 'artifact',
  },
  {
    id: 'agent-navigation-intent',
    ticketId: 'V10-AGT-006',
    requirementId: 'R-AGENT-6',
    block: 'agent_runtime',
  },
  {
    id: 'onboard-five-minute-sla',
    ticketId: 'V10-ONB-006',
    requirementId: 'R-ONBOARD-6',
    block: 'onboarding',
  },
  // V10-08 pass (2026-04-18)
  {
    id: 'artifact-mutation-proposal',
    ticketId: 'V10-ART-007',
    requirementId: 'R-ARTIFACT-7',
    block: 'artifact',
  },
  {
    id: 'agent-budget-v1',
    ticketId: 'V10-AGT-007',
    requirementId: 'R-AGENT-7',
    block: 'agent_runtime',
  },
  {
    id: 'onboard-buyer-data-only',
    ticketId: 'V10-ONB-007',
    requirementId: 'R-ONBOARD-7',
    block: 'onboarding',
  },
  // V10-09 pass (2026-04-18)
  {
    id: 'artifact-typed-ops',
    ticketId: 'V10-ART-008',
    requirementId: 'R-ARTIFACT-8',
    block: 'artifact',
  },
  {
    id: 'agent-diff-preview-v1',
    ticketId: 'V10-AGT-008',
    requirementId: 'R-AGENT-8',
    block: 'agent_runtime',
  },
  {
    id: 'onboard-connector-ranking',
    ticketId: 'V10-ONB-008',
    requirementId: 'R-ONBOARD-8',
    block: 'onboarding',
  },
  // V10-10 pass (2026-04-18)
  {
    id: 'artifact-citation-v1',
    ticketId: 'V10-ART-009',
    requirementId: 'R-ARTIFACT-9',
    block: 'artifact',
  },
  {
    id: 'agent-severity-s0',
    ticketId: 'V10-AGT-009',
    requirementId: 'R-AGENT-9',
    block: 'agent_runtime',
  },
  {
    id: 'onboard-connector-validation',
    ticketId: 'V10-ONB-009',
    requirementId: 'R-ONBOARD-9',
    block: 'onboarding',
  },
  // V10-11 pass (2026-04-18)
  {
    id: 'artifact-no-silent-writes',
    ticketId: 'V10-ART-010',
    requirementId: 'R-ARTIFACT-10',
    block: 'artifact',
  },
  {
    id: 'agent-severity-s1',
    ticketId: 'V10-AGT-010',
    requirementId: 'R-AGENT-10',
    block: 'agent_runtime',
  },
  {
    id: 'onboard-no-ghost-caps',
    ticketId: 'V10-ONB-010',
    requirementId: 'R-ONBOARD-10',
    block: 'onboarding',
  },
  // V10-12 pass (2026-04-18)
  {
    id: 'artifact-approve-edit-reject',
    ticketId: 'V10-ART-011',
    requirementId: 'R-ARTIFACT-11',
    block: 'artifact',
  },
  {
    id: 'agent-severity-s2',
    ticketId: 'V10-AGT-011',
    requirementId: 'R-AGENT-11',
    block: 'agent_runtime',
  },
  {
    id: 'onboard-first-mutation-envelope',
    ticketId: 'V10-ONB-011',
    requirementId: 'R-ONBOARD-11',
    block: 'onboarding',
  },
  // V10-13 pass (2026-04-18)
  {
    id: 'artifact-partial-acceptance',
    ticketId: 'V10-ART-012',
    requirementId: 'R-ARTIFACT-12',
    block: 'artifact',
  },
  {
    id: 'agent-severity-s3',
    ticketId: 'V10-AGT-012',
    requirementId: 'R-AGENT-12',
    block: 'agent_runtime',
  },
  {
    id: 'onboard-provenance-panel',
    ticketId: 'V10-ONB-012',
    requirementId: 'R-ONBOARD-12',
    block: 'onboarding',
  },
  // V10-14 pass (2026-04-18)
  {
    id: 'artifact-one-step-undo',
    ticketId: 'V10-ART-013',
    requirementId: 'R-ARTIFACT-13',
    block: 'artifact',
  },
  {
    id: 'agent-severity-s4',
    ticketId: 'V10-AGT-013',
    requirementId: 'R-AGENT-13',
    block: 'agent_runtime',
  },
  {
    id: 'onboard-approval-audit',
    ticketId: 'V10-ONB-013',
    requirementId: 'R-ONBOARD-13',
    block: 'onboarding',
  },
  // V10-15 pass (2026-04-18)
  {
    id: 'artifact-selection-aware',
    ticketId: 'V10-ART-014',
    requirementId: 'R-ARTIFACT-14',
    block: 'artifact',
  },
  {
    id: 'agent-run-ledger',
    ticketId: 'V10-AGT-014',
    requirementId: 'R-AGENT-14',
    block: 'agent_runtime',
  },
  {
    id: 'onboard-library-save',
    ticketId: 'V10-ONB-014',
    requirementId: 'R-ONBOARD-14',
    block: 'onboarding',
  },
  // V10-16 pass (2026-04-18)
  {
    id: 'artifact-cross-transform',
    ticketId: 'V10-ART-015',
    requirementId: 'R-ARTIFACT-15',
    block: 'artifact',
  },
  {
    id: 'agent-queue-executor',
    ticketId: 'V10-AGT-015',
    requirementId: 'R-AGENT-15',
    block: 'agent_runtime',
  },
  {
    id: 'onboard-first-export-manifest',
    ticketId: 'V10-ONB-015',
    requirementId: 'R-ONBOARD-15',
    block: 'onboarding',
  },
  // V10-17 pass (2026-04-18)
  {
    id: 'artifact-slide-deck-schema',
    ticketId: 'V10-ART-016',
    requirementId: 'R-ARTIFACT-16',
    block: 'artifact',
  },
  {
    id: 'agent-checkpoint-store',
    ticketId: 'V10-AGT-016',
    requirementId: 'R-AGENT-16',
    block: 'agent_runtime',
  },
  {
    id: 'onboard-research-cost-cap-gate',
    ticketId: 'V10-ONB-016',
    requirementId: 'R-ONBOARD-16',
    block: 'onboarding',
  },
  {
    id: 'artifact-memo-rich-doc',
    ticketId: 'V10-ART-017',
    requirementId: 'R-ARTIFACT-17',
    block: 'artifact',
  },
  {
    id: 'agent-atomic-bundle',
    ticketId: 'V10-AGT-017',
    requirementId: 'R-AGENT-17',
    block: 'agent_runtime',
  },
  {
    id: 'onboard-memory-layer-opt-in',
    ticketId: 'V10-ONB-017',
    requirementId: 'R-ONBOARD-17',
    block: 'onboarding',
  },
  {
    id: 'artifact-spreadsheet-lineage',
    ticketId: 'V10-ART-018',
    requirementId: 'R-ARTIFACT-18',
    block: 'artifact',
  },
  {
    id: 'agent-saga-sequence',
    ticketId: 'V10-AGT-018',
    requirementId: 'R-AGENT-18',
    block: 'agent_runtime',
  },
  {
    id: 'onboard-tenant-bootstrap',
    ticketId: 'V10-ONB-018',
    requirementId: 'R-ONBOARD-18',
    block: 'onboarding',
  },
  {
    id: 'artifact-decision-doc',
    ticketId: 'V10-ART-019',
    requirementId: 'R-ARTIFACT-19',
    block: 'artifact',
  },
  {
    id: 'agent-approval-barrier',
    ticketId: 'V10-AGT-019',
    requirementId: 'R-AGENT-19',
    block: 'agent_runtime',
  },
  {
    id: 'onboard-conservative-defaults',
    ticketId: 'V10-ONB-019',
    requirementId: 'R-ONBOARD-19',
    block: 'onboarding',
  },
  {
    id: 'artifact-research-report',
    ticketId: 'V10-ART-020',
    requirementId: 'R-ARTIFACT-20',
    block: 'artifact',
  },
  {
    id: 'agent-fan-out-fan-in',
    ticketId: 'V10-AGT-020',
    requirementId: 'R-AGENT-20',
    block: 'agent_runtime',
  },
  {
    id: 'onboard-oauth-fallback',
    ticketId: 'V10-ONB-020',
    requirementId: 'R-ONBOARD-20',
    block: 'onboarding',
  },
  {
    id: 'artifact-comments-annotations',
    ticketId: 'V10-ART-021',
    requirementId: 'R-ARTIFACT-21',
    block: 'artifact',
  },
  {
    id: 'agent-schedule-definition',
    ticketId: 'V10-AGT-021',
    requirementId: 'R-AGENT-21',
    block: 'agent_runtime',
  },
  {
    id: 'onboard-citation-validation-fallback',
    ticketId: 'V10-ONB-021',
    requirementId: 'R-ONBOARD-21',
    block: 'onboarding',
  },
  {
    id: 'artifact-store-contract',
    ticketId: 'V10-ART-022',
    requirementId: 'R-ARTIFACT-22',
    block: 'artifact',
  },
  {
    id: 'agent-schedule-registry',
    ticketId: 'V10-AGT-022',
    requirementId: 'R-AGENT-22',
    block: 'agent_runtime',
  },
  {
    id: 'onboard-resume-abandonment',
    ticketId: 'V10-ONB-022',
    requirementId: 'R-ONBOARD-22',
    block: 'onboarding',
  },
  // V10-24 pass (2026-04-18)
  {
    id: 'artifact-immutable-audit',
    ticketId: 'V10-ART-023',
    requirementId: 'R-ARTIFACT-23',
    block: 'artifact',
  },
  {
    id: 'agent-swarm-definition',
    ticketId: 'V10-AGT-023',
    requirementId: 'R-AGENT-23',
    block: 'agent_runtime',
  },
  {
    id: 'onboard-telemetry',
    ticketId: 'V10-ONB-023',
    requirementId: 'R-ONBOARD-23',
    block: 'onboarding',
  },
  // V10-25 Wave-A completion sprint (2026-04-18, parallel dispatch)
  {
    id: 'artifact-export-manifest',
    ticketId: 'V10-ART-024',
    requirementId: 'R-ARTIFACT-24',
    block: 'artifact',
  },
  {
    id: 'artifact-provenance-footer',
    ticketId: 'V10-ART-025',
    requirementId: 'R-ARTIFACT-25',
    block: 'artifact',
  },
  {
    id: 'artifact-library-folders',
    ticketId: 'V10-ART-026',
    requirementId: 'R-ARTIFACT-26',
    block: 'artifact',
  },
  {
    id: 'artifact-template-fingerprint',
    ticketId: 'V10-ART-027',
    requirementId: 'R-ARTIFACT-27',
    block: 'artifact',
  },
  {
    id: 'agent-interrupt-verbs',
    ticketId: 'V10-AGT-024',
    requirementId: 'R-AGENT-24',
    block: 'agent_runtime',
  },
  {
    id: 'agent-research-phase-machine',
    ticketId: 'V10-AGT-025',
    requirementId: 'R-AGENT-25',
    block: 'agent_runtime',
  },
  {
    id: 'agent-trace-collector',
    ticketId: 'V10-AGT-026',
    requirementId: 'R-AGENT-26',
    block: 'agent_runtime',
  },
  {
    id: 'agent-notification-broker',
    ticketId: 'V10-AGT-027',
    requirementId: 'R-AGENT-27',
    block: 'agent_runtime',
  },
  {
    id: 'onboard-activation-kpi-dashboard',
    ticketId: 'V10-ONB-024',
    requirementId: 'R-ONBOARD-24',
    block: 'onboarding',
  },
  {
    id: 'onboard-team-invite-after-aha',
    ticketId: 'V10-ONB-025',
    requirementId: 'R-ONBOARD-25',
    block: 'onboarding',
  },
  // V10-26 Wave-A final close-out (2026-04-18, ART + AGT only; ONB seed completed in V10-25)
  {
    id: 'artifact-role-based-approval-gates',
    ticketId: 'V10-ART-028',
    requirementId: 'R-ARTIFACT-28',
    block: 'artifact',
  },
  {
    id: 'agent-anti-patterns',
    ticketId: 'V10-AGT-029',
    requirementId: 'R-AGENT-29',
    block: 'agent_runtime',
  },
  // V10-27 Wave-A 5-blocks opening sprint (2026-04-19) — 4 parallel sub-agents:
  //   Agent RSN → reasoning V10-RSN-001..004 (170 tests)
  //   Agent LRN → learning  V10-LRN-001..004 (141 tests)
  //   Agent RSR → research  V10-RSR-001..004 (146 tests)
  //   Agent CON+OUT → connectors V10-CON-001..002 + outcome V10-OUT-001..002 (161 tests)
  //   Central merge: 16 flags, bumps count from 81 → 97.
  {
    id: 'reasoning-workload-class-registry',
    ticketId: 'V10-RSN-001',
    requirementId: 'R-REASON-1',
    block: 'reasoning',
  },
  {
    id: 'reasoning-intent-classifier',
    ticketId: 'V10-RSN-002',
    requirementId: 'R-REASON-2',
    block: 'reasoning',
  },
  {
    id: 'reasoning-scope-resolver',
    ticketId: 'V10-RSN-003',
    requirementId: 'R-REASON-3',
    block: 'reasoning',
  },
  {
    id: 'reasoning-plan-formulator',
    ticketId: 'V10-RSN-004',
    requirementId: 'R-REASON-4',
    block: 'reasoning',
  },
  {
    id: 'learning-typed-consent',
    ticketId: 'V10-LRN-001',
    requirementId: 'R-LEARN-1',
    block: 'learning',
  },
  {
    id: 'learning-feedback-signal',
    ticketId: 'V10-LRN-002',
    requirementId: 'R-LEARN-2',
    block: 'learning',
  },
  {
    id: 'learning-feedback-collector',
    ticketId: 'V10-LRN-003',
    requirementId: 'R-LEARN-3',
    block: 'learning',
  },
  {
    id: 'learning-behavioural-signals',
    ticketId: 'V10-LRN-004',
    requirementId: 'R-LEARN-4',
    block: 'learning',
  },
  {
    id: 'research-mission',
    ticketId: 'V10-RSR-001',
    requirementId: 'R-RESEARCH-1',
    block: 'research',
  },
  {
    id: 'research-mission-scope',
    ticketId: 'V10-RSR-002',
    requirementId: 'R-RESEARCH-2',
    block: 'research',
  },
  {
    id: 'research-retrieval-policy',
    ticketId: 'V10-RSR-003',
    requirementId: 'R-RESEARCH-3',
    block: 'research',
  },
  {
    id: 'research-source-allow-block-list',
    ticketId: 'V10-RSR-004',
    requirementId: 'R-RESEARCH-4',
    block: 'research',
  },
  {
    id: 'connectors-connector-interface',
    ticketId: 'V10-CON-001',
    requirementId: 'R-CONNECT-1',
    block: 'connectors',
  },
  {
    id: 'connectors-registry',
    ticketId: 'V10-CON-002',
    requirementId: 'R-CONNECT-2',
    block: 'connectors',
  },
  { id: 'outcome-signal', ticketId: 'V10-OUT-001', requirementId: 'R-OUTCOME-1', block: 'outcome' },
  { id: 'outcome-record', ticketId: 'V10-OUT-002', requirementId: 'R-OUTCOME-2', block: 'outcome' },
  // V10-28 Wave-A 5-blocks pass 2 (2026-04-19) — 4 parallel sub-agents:
  //   Agent RSN → V10-RSN-005..008 (154 tests)
  //   Agent LRN → V10-LRN-005..008 (148 tests)
  //   Agent RSR → V10-RSR-005..008 (165 tests)
  //   Agent CON+OUT → V10-CON-003..004 + V10-OUT-003..004 (160 tests)
  //   Central merge: 16 flags, bumps count from 97 → 113.
  {
    id: 'reasoning-tool-call-registry',
    ticketId: 'V10-RSN-005',
    requirementId: 'R-REASON-5',
    block: 'reasoning',
  },
  {
    id: 'reasoning-retrieval-layer',
    ticketId: 'V10-RSN-006',
    requirementId: 'R-REASON-6',
    block: 'reasoning',
  },
  {
    id: 'reasoning-execution-loop',
    ticketId: 'V10-RSN-007',
    requirementId: 'R-REASON-7',
    block: 'reasoning',
  },
  {
    id: 'reasoning-claim-extraction',
    ticketId: 'V10-RSN-008',
    requirementId: 'R-REASON-8',
    block: 'reasoning',
  },
  {
    id: 'learning-outcome-signals',
    ticketId: 'V10-LRN-005',
    requirementId: 'R-LEARN-5',
    block: 'learning',
  },
  {
    id: 'learning-memory-pack',
    ticketId: 'V10-LRN-006',
    requirementId: 'R-LEARN-6',
    block: 'learning',
  },
  {
    id: 'learning-ttl-forgetting',
    ticketId: 'V10-LRN-007',
    requirementId: 'R-LEARN-7',
    block: 'learning',
  },
  {
    id: 'learning-revocation',
    ticketId: 'V10-LRN-008',
    requirementId: 'R-LEARN-8',
    block: 'learning',
  },
  {
    id: 'research-mission-plan-formulator',
    ticketId: 'V10-RSR-005',
    requirementId: 'R-RESEARCH-5',
    block: 'research',
  },
  {
    id: 'research-mission-budget',
    ticketId: 'V10-RSR-006',
    requirementId: 'R-RESEARCH-6',
    block: 'research',
  },
  {
    id: 'research-executor',
    ticketId: 'V10-RSR-007',
    requirementId: 'R-RESEARCH-7',
    block: 'research',
  },
  {
    id: 'research-source-fetcher',
    ticketId: 'V10-RSR-008',
    requirementId: 'R-RESEARCH-8',
    block: 'research',
  },
  {
    id: 'connectors-oauth-layer',
    ticketId: 'V10-CON-003',
    requirementId: 'R-CONNECT-3',
    block: 'connectors',
  },
  {
    id: 'connectors-token-vault',
    ticketId: 'V10-CON-004',
    requirementId: 'R-CONNECT-4',
    block: 'connectors',
  },
  {
    id: 'outcome-taxonomy',
    ticketId: 'V10-OUT-003',
    requirementId: 'R-OUTCOME-3',
    block: 'outcome',
  },
  {
    id: 'outcome-attribution-policy',
    ticketId: 'V10-OUT-004',
    requirementId: 'R-OUTCOME-4',
    block: 'outcome',
  },
  // V10-29 (2026-04-19) — 4 parallel sub-agents × 4 tickets = 16 flags, 561 tests green.
  //   Agent RSN → V10-RSN-009..012 (165 tests)
  //   Agent LRN → V10-LRN-009..012 (113 tests)
  //   Agent RSR → V10-RSR-009..012 (126 tests)
  //   Agent CON+OUT → V10-CON-005..006 + V10-OUT-005..006 (157 tests)
  //   Central merge bumps count 113 → 129.
  {
    id: 'reasoning-citation-binder',
    ticketId: 'V10-RSN-009',
    requirementId: 'R-REASON-9',
    block: 'reasoning',
  },
  {
    id: 'reasoning-evidence-coverage-scorer',
    ticketId: 'V10-RSN-010',
    requirementId: 'R-REASON-10',
    block: 'reasoning',
  },
  {
    id: 'reasoning-hedging-calibration',
    ticketId: 'V10-RSN-011',
    requirementId: 'R-REASON-11',
    block: 'reasoning',
  },
  {
    id: 'reasoning-hallucination-filter',
    ticketId: 'V10-RSN-012',
    requirementId: 'R-REASON-12',
    block: 'reasoning',
  },
  {
    id: 'learning-routing-adjustment',
    ticketId: 'V10-LRN-009',
    requirementId: 'R-LEARN-9',
    block: 'learning',
  },
  {
    id: 'learning-pii-redaction',
    ticketId: 'V10-LRN-010',
    requirementId: 'R-LEARN-10',
    block: 'learning',
  },
  {
    id: 'learning-never-override-invariants',
    ticketId: 'V10-LRN-011',
    requirementId: 'R-LEARN-11',
    block: 'learning',
  },
  {
    id: 'learning-telemetry',
    ticketId: 'V10-LRN-012',
    requirementId: 'R-LEARN-12',
    block: 'learning',
  },
  {
    id: 'research-curated-web-source-provider',
    ticketId: 'V10-RSR-009',
    requirementId: 'R-RESEARCH-9',
    block: 'research',
  },
  {
    id: 'research-content-extractor',
    ticketId: 'V10-RSR-010',
    requirementId: 'R-RESEARCH-10',
    block: 'research',
  },
  {
    id: 'research-dedup-near-duplicate',
    ticketId: 'V10-RSR-011',
    requirementId: 'R-RESEARCH-11',
    block: 'research',
  },
  {
    id: 'research-evidence-graph',
    ticketId: 'V10-RSR-012',
    requirementId: 'R-RESEARCH-12',
    block: 'research',
  },
  {
    id: 'connectors-token-refresh-revocation',
    ticketId: 'V10-CON-005',
    requirementId: 'R-CONNECT-5',
    block: 'connectors',
  },
  {
    id: 'connectors-session',
    ticketId: 'V10-CON-006',
    requirementId: 'R-CONNECT-6',
    block: 'connectors',
  },
  {
    id: 'outcome-lineage-binding',
    ticketId: 'V10-OUT-005',
    requirementId: 'R-OUTCOME-5',
    block: 'outcome',
  },
  {
    id: 'outcome-time-saved-calibration',
    ticketId: 'V10-OUT-006',
    requirementId: 'R-OUTCOME-6',
    block: 'outcome',
  },
  // V10-30 (2026-04-19) — 4 parallel × 4 tickets = 16 flags, 552 tests green. 129 → 145.
  {
    id: 'reasoning-trust-bundle',
    ticketId: 'V10-RSN-013',
    requirementId: 'R-REASON-13',
    block: 'reasoning',
  },
  {
    id: 'reasoning-trust-bundle-hash',
    ticketId: 'V10-RSN-014',
    requirementId: 'R-REASON-14',
    block: 'reasoning',
  },
  {
    id: 'reasoning-fast-chat',
    ticketId: 'V10-RSN-015',
    requirementId: 'R-REASON-15',
    block: 'reasoning',
  },
  {
    id: 'reasoning-grounded-chat',
    ticketId: 'V10-RSN-016',
    requirementId: 'R-REASON-16',
    block: 'reasoning',
  },
  {
    id: 'learning-adaptive-coverage-threshold',
    ticketId: 'V10-LRN-013',
    requirementId: 'R-LEARN-13',
    block: 'learning',
  },
  {
    id: 'learning-tenant-prompt-snippets',
    ticketId: 'V10-LRN-014',
    requirementId: 'R-LEARN-14',
    block: 'learning',
  },
  {
    id: 'learning-connector-ranking',
    ticketId: 'V10-LRN-015',
    requirementId: 'R-LEARN-15',
    block: 'learning',
  },
  {
    id: 'learning-drift-detection',
    ticketId: 'V10-LRN-016',
    requirementId: 'R-LEARN-16',
    block: 'learning',
  },
  {
    id: 'research-claim-node-source-edge',
    ticketId: 'V10-RSR-013',
    requirementId: 'R-RESEARCH-13',
    block: 'research',
  },
  {
    id: 'research-support-contradict-edges',
    ticketId: 'V10-RSR-014',
    requirementId: 'R-RESEARCH-14',
    block: 'research',
  },
  {
    id: 'research-synthesis',
    ticketId: 'V10-RSR-015',
    requirementId: 'R-RESEARCH-15',
    block: 'research',
  },
  {
    id: 'research-claim-validator',
    ticketId: 'V10-RSR-016',
    requirementId: 'R-RESEARCH-16',
    block: 'research',
  },
  {
    id: 'connectors-read-write-scopes',
    ticketId: 'V10-CON-007',
    requirementId: 'R-CONNECT-7',
    block: 'connectors',
  },
  {
    id: 'connectors-source-ref-provenance',
    ticketId: 'V10-CON-008',
    requirementId: 'R-CONNECT-8',
    block: 'connectors',
  },
  {
    id: 'outcome-user-confirmation-surface',
    ticketId: 'V10-OUT-007',
    requirementId: 'R-OUTCOME-7',
    block: 'outcome',
  },
  {
    id: 'outcome-passive-outcome-emission',
    ticketId: 'V10-OUT-008',
    requirementId: 'R-OUTCOME-8',
    block: 'outcome',
  },
  // V10-31 (2026-04-19) — 4 parallel × 4 tickets = 16 flags, 656 tests green. 145 → 161.
  {
    id: 'reasoning-on-workspace',
    ticketId: 'V10-RSN-017',
    requirementId: 'R-REASON-17',
    block: 'reasoning',
  },
  {
    id: 'reasoning-decision-review',
    ticketId: 'V10-RSN-018',
    requirementId: 'R-REASON-18',
    block: 'reasoning',
  },
  {
    id: 'reasoning-artifact-build',
    ticketId: 'V10-RSN-019',
    requirementId: 'R-REASON-19',
    block: 'reasoning',
  },
  {
    id: 'reasoning-deep-research-stub',
    ticketId: 'V10-RSN-020',
    requirementId: 'R-REASON-20',
    block: 'reasoning',
  },
  {
    id: 'learning-audit-export',
    ticketId: 'V10-LRN-017',
    requirementId: 'R-LEARN-17',
    block: 'learning',
  },
  {
    id: 'learning-per-tenant-kill-switch',
    ticketId: 'V10-LRN-018',
    requirementId: 'R-LEARN-18',
    block: 'learning',
  },
  {
    id: 'research-disagreement-presentation',
    ticketId: 'V10-RSR-017',
    requirementId: 'R-RESEARCH-17',
    block: 'research',
  },
  {
    id: 'research-hedging-calibration',
    ticketId: 'V10-RSR-018',
    requirementId: 'R-RESEARCH-18',
    block: 'research',
  },
  {
    id: 'research-report-artifact',
    ticketId: 'V10-RSR-019',
    requirementId: 'R-RESEARCH-19',
    block: 'research',
  },
  {
    id: 'research-mission-trust-bundle',
    ticketId: 'V10-RSR-020',
    requirementId: 'R-RESEARCH-20',
    block: 'research',
  },
  {
    id: 'research-mission-interrupt-verbs',
    ticketId: 'V10-RSR-021',
    requirementId: 'R-RESEARCH-21',
    block: 'research',
  },
  {
    id: 'research-mission-resume',
    ticketId: 'V10-RSR-022',
    requirementId: 'R-RESEARCH-22',
    block: 'research',
  },
  {
    id: 'connectors-acl-probe',
    ticketId: 'V10-CON-009',
    requirementId: 'R-CONNECT-9',
    block: 'connectors',
  },
  {
    id: 'connectors-federated-search',
    ticketId: 'V10-CON-010',
    requirementId: 'R-CONNECT-10',
    block: 'connectors',
  },
  {
    id: 'outcome-decision-shipped-detector',
    ticketId: 'V10-OUT-009',
    requirementId: 'R-OUTCOME-9',
    block: 'outcome',
  },
  {
    id: 'outcome-kpi-accept-outcome',
    ticketId: 'V10-OUT-010',
    requirementId: 'R-OUTCOME-10',
    block: 'outcome',
  },
  // V10-32 (2026-04-19) — 4 parallel × 4 tickets = 16 flags, 595 tests green. 161 → 177.
  {
    id: 'reasoning-background-agent-stub',
    ticketId: 'V10-RSN-021',
    requirementId: 'R-REASON-21',
    block: 'reasoning',
  },
  {
    id: 'reasoning-presentation-layer',
    ticketId: 'V10-RSN-022',
    requirementId: 'R-REASON-22',
    block: 'reasoning',
  },
  {
    id: 'reasoning-telemetry',
    ticketId: 'V10-RSN-023',
    requirementId: 'R-REASON-23',
    block: 'reasoning',
  },
  {
    id: 'reasoning-edge-case-matrix',
    ticketId: 'V10-RSN-024',
    requirementId: 'R-REASON-24',
    block: 'reasoning',
  },
  {
    id: 'research-mission-audit-log',
    ticketId: 'V10-RSR-023',
    requirementId: 'R-RESEARCH-23',
    block: 'research',
  },
  {
    id: 'research-telemetry',
    ticketId: 'V10-RSR-024',
    requirementId: 'R-RESEARCH-24',
    block: 'research',
  },
  {
    id: 'research-cost-dashboard',
    ticketId: 'V10-RSR-025',
    requirementId: 'R-RESEARCH-25',
    block: 'research',
  },
  {
    id: 'research-scheduled-watches',
    ticketId: 'V10-RSR-026',
    requirementId: 'R-RESEARCH-26',
    block: 'research',
  },
  {
    id: 'connectors-incremental-sync',
    ticketId: 'V10-CON-011',
    requirementId: 'R-CONNECT-11',
    block: 'connectors',
  },
  {
    id: 'connectors-freshness-slo',
    ticketId: 'V10-CON-012',
    requirementId: 'R-CONNECT-12',
    block: 'connectors',
  },
  {
    id: 'connectors-rate-limit-backoff',
    ticketId: 'V10-CON-013',
    requirementId: 'R-CONNECT-13',
    block: 'connectors',
  },
  {
    id: 'connectors-acl-propagation',
    ticketId: 'V10-CON-014',
    requirementId: 'R-CONNECT-14',
    block: 'connectors',
  },
  {
    id: 'outcome-double-count-guard',
    ticketId: 'V10-OUT-011',
    requirementId: 'R-OUTCOME-11',
    block: 'outcome',
  },
  {
    id: 'outcome-reversal',
    ticketId: 'V10-OUT-012',
    requirementId: 'R-OUTCOME-12',
    block: 'outcome',
  },
  {
    id: 'outcome-per-team-roi-dashboard',
    ticketId: 'V10-OUT-013',
    requirementId: 'R-OUTCOME-13',
    block: 'outcome',
  },
  {
    id: 'outcome-per-persona-breakdown',
    ticketId: 'V10-OUT-014',
    requirementId: 'R-OUTCOME-14',
    block: 'outcome',
  },
  // V10-33 (2026-04-19) — 4 parallel × 4 tickets = 16 flags. 177 → 193.
  {
    id: 'reasoning-quality-dashboard',
    ticketId: 'V10-RSN-025',
    requirementId: 'R-REASON-25',
    block: 'reasoning',
  },
  {
    id: 'research-watch-delta-report',
    ticketId: 'V10-RSR-027',
    requirementId: 'R-RESEARCH-27',
    block: 'research',
  },
  {
    id: 'research-cross-mission-memory',
    ticketId: 'V10-RSR-028',
    requirementId: 'R-RESEARCH-28',
    block: 'research',
  },
  {
    id: 'research-comparative-mission-mode',
    ticketId: 'V10-RSR-029',
    requirementId: 'R-RESEARCH-29',
    block: 'research',
  },
  {
    id: 'research-quality-dashboard',
    ticketId: 'V10-RSR-030',
    requirementId: 'R-RESEARCH-30',
    block: 'research',
  },
  {
    id: 'connectors-health-dashboard',
    ticketId: 'V10-CON-015',
    requirementId: 'R-CONNECT-15',
    block: 'connectors',
  },
  {
    id: 'connectors-google-drive',
    ticketId: 'V10-CON-016',
    requirementId: 'R-CONNECT-16',
    block: 'connectors',
  },
  {
    id: 'connectors-slack',
    ticketId: 'V10-CON-017',
    requirementId: 'R-CONNECT-17',
    block: 'connectors',
  },
  {
    id: 'connectors-notion-connector',
    ticketId: 'V10-CON-018',
    requirementId: 'R-CONNECT-18',
    block: 'connectors',
  },
  {
    id: 'connectors-email-connector',
    ticketId: 'V10-CON-019',
    requirementId: 'R-CONNECT-19',
    block: 'connectors',
  },
  {
    id: 'connectors-calendar-connector',
    ticketId: 'V10-CON-020',
    requirementId: 'R-CONNECT-20',
    block: 'connectors',
  },
  {
    id: 'connectors-connector-governance-ui',
    ticketId: 'V10-CON-021',
    requirementId: 'R-CONNECT-21',
    block: 'connectors',
  },
  {
    id: 'outcome-per-workload-breakdown',
    ticketId: 'V10-OUT-015',
    requirementId: 'R-OUTCOME-15',
    block: 'outcome',
  },
  {
    id: 'outcome-cfo-narrative-export',
    ticketId: 'V10-OUT-016',
    requirementId: 'R-OUTCOME-16',
    block: 'outcome',
  },
  {
    id: 'outcome-audit-log',
    ticketId: 'V10-OUT-017',
    requirementId: 'R-OUTCOME-17',
    block: 'outcome',
  },
  {
    id: 'outcome-telemetry',
    ticketId: 'V10-OUT-018',
    requirementId: 'R-OUTCOME-18',
    block: 'outcome',
  },
  // V10-34 (2026-04-19) — 3 parallel × 3 tickets = 9 flags. 193 → 202. Wave-A seed CLOSED.
  {
    id: 'connectors-user-disconnect',
    ticketId: 'V10-CON-022',
    requirementId: 'R-CONNECT-22',
    block: 'connectors',
  },
  {
    id: 'connectors-telemetry-full',
    ticketId: 'V10-CON-023',
    requirementId: 'R-CONNECT-23',
    block: 'connectors',
  },
  {
    id: 'connectors-write-framework',
    ticketId: 'V10-CON-024',
    requirementId: 'R-CONNECT-24',
    block: 'connectors',
  },
  {
    id: 'outcome-never-invent-metric',
    ticketId: 'V10-OUT-019',
    requirementId: 'R-OUTCOME-19',
    block: 'outcome',
  },
  {
    id: 'outcome-admin-overrides',
    ticketId: 'V10-OUT-020',
    requirementId: 'R-OUTCOME-20',
    block: 'outcome',
  },
  {
    id: 'outcome-revenue-margin-attribution',
    ticketId: 'V10-OUT-021',
    requirementId: 'R-OUTCOME-21',
    block: 'outcome',
  },
  {
    id: 'outcome-risk-avoided',
    ticketId: 'V10-OUT-022',
    requirementId: 'R-OUTCOME-22',
    block: 'outcome',
  },
  {
    id: 'outcome-cohort-benchmark',
    ticketId: 'V10-OUT-023',
    requirementId: 'R-OUTCOME-23',
    block: 'outcome',
  },
  {
    id: 'outcome-quality-dashboard',
    ticketId: 'V10-OUT-024',
    requirementId: 'R-OUTCOME-24',
    block: 'outcome',
  },
  // V10-35 (2026-04-19) — Wave-B bridge: 4 gap seeds (AGT-028 + ART-029..031)
  // + 12 cross-block integration pipelines. 202 → 218.
  {
    id: 'agent-runtime-time-travel-replay',
    ticketId: 'V10-AGT-028',
    requirementId: 'R-AGENT-28',
    block: 'agent_runtime',
  },
  {
    id: 'artifact-crdt-replicated-state',
    ticketId: 'V10-ART-029',
    requirementId: 'R-ARTIFACT-29',
    block: 'artifact',
  },
  {
    id: 'artifact-presence',
    ticketId: 'V10-ART-030',
    requirementId: 'R-ARTIFACT-30',
    block: 'artifact',
  },
  {
    id: 'artifact-cross-replica-merge',
    ticketId: 'V10-ART-031',
    requirementId: 'R-ARTIFACT-31',
    block: 'artifact',
  },
  {
    id: 'pipelines-reasoning-fast-chat',
    ticketId: 'V10-PIP-001',
    requirementId: 'R-PIPELINE-1',
    block: 'reasoning',
  },
  {
    id: 'pipelines-reasoning-grounded-chat',
    ticketId: 'V10-PIP-002',
    requirementId: 'R-PIPELINE-2',
    block: 'reasoning',
  },
  {
    id: 'pipelines-research-mission',
    ticketId: 'V10-PIP-003',
    requirementId: 'R-PIPELINE-3',
    block: 'research',
  },
  {
    id: 'pipelines-research-watch',
    ticketId: 'V10-PIP-004',
    requirementId: 'R-PIPELINE-4',
    block: 'research',
  },
  {
    id: 'pipelines-artifact-mutation',
    ticketId: 'V10-PIP-005',
    requirementId: 'R-PIPELINE-5',
    block: 'artifact',
  },
  {
    id: 'pipelines-artifact-export',
    ticketId: 'V10-PIP-006',
    requirementId: 'R-PIPELINE-6',
    block: 'artifact',
  },
  {
    id: 'pipelines-agent-execution',
    ticketId: 'V10-PIP-007',
    requirementId: 'R-PIPELINE-7',
    block: 'agent_runtime',
  },
  {
    id: 'pipelines-agent-schedule',
    ticketId: 'V10-PIP-008',
    requirementId: 'R-PIPELINE-8',
    block: 'agent_runtime',
  },
  {
    id: 'pipelines-outcome-rollup',
    ticketId: 'V10-PIP-009',
    requirementId: 'R-PIPELINE-9',
    block: 'outcome',
  },
  {
    id: 'pipelines-learning-feedback',
    ticketId: 'V10-PIP-010',
    requirementId: 'R-PIPELINE-10',
    block: 'learning',
  },
  {
    id: 'pipelines-connectors-ingest',
    ticketId: 'V10-PIP-011',
    requirementId: 'R-PIPELINE-11',
    block: 'connectors',
  },
  {
    id: 'pipelines-onboarding-persona',
    ticketId: 'V10-PIP-012',
    requirementId: 'R-PIPELINE-12',
    block: 'onboarding',
  },
] as const;

/**
 * V10 CI invariant 23 mirror — "on-by-construction" allowlist.
 *
 * Master plan §4.3 and ADR-V10-002 pin the set of V10 flags allowed
 * to ship with `default: true`. Everything else must default-OFF.
 *
 * Membership rationale
 * --------------------
 *   - `ff.onboard_trust_first_banner` (V10-ONB-005) — trust-first
 *     disclosure before any prompt / connector CTA.
 *   - `ff.onboard_conservative_defaults` (V10-ONB-019) — Internal /
 *     30d draft / memory off / approval on export (not yet landed).
 *   - `ff.artifact_no_silent_writes` (V10-ART-010) — no direct writes
 *     outside the canonical mutation applier.
 *   - `ff.onboard_no_ghost_caps` (V10-ONB-010) — unavailable CTAs are
 *     never rendered.
 *   - `ff.agent_run_ledger` (V10-AGT-014) — durable Run Ledger. The
 *     dev plan pins this as a safety-critical audit surface; the
 *     flag is an incident-response kill switch only.
 *   - `ff.onboard_first_export_manifest` (V10-ONB-015) — first-export
 *     manifest preview + SHA-256 gate. The dev plan pins "100% of
 *     first exports require manifest preview"; disabling is
 *     incident-response only (hotfix manifest-computation bugs).
 *   - `ff.onboard_research_cost_cap_gate` (V10-ONB-016) — first-
 *     research cost cap + source policy confirmation gate. The dev
 *     plan pins "100% of first research runs require explicit cap +
 *     source-policy confirmation"; disabling would let an onboarding
 *     research run bypass its cost cap, which is a P0 breach.
 *
 * Any addition requires an ADR (master plan §10.1) plus a row in
 * this allowlist.
 */
const ON_BY_CONSTRUCTION_ALLOWLIST: ReadonlySet<string> = new Set([
  'ff.onboard_trust_first_banner',
  'ff.onboard_conservative_defaults',
  'ff.artifact_no_silent_writes',
  'ff.onboard_no_ghost_caps',
  'ff.agent_run_ledger',
  'ff.onboard_first_export_manifest',
  'ff.onboard_research_cost_cap_gate',
  'ff.onboard_memory_layer_opt_in',
]);

describe('chatV10FeatureFlags · registry shape', () => {
  it('the Wave A seed has landed (V10-02 pass): registry holds the 3 seed flags', () => {
    // Tripwire flipped from `===0` (scaffolding) to `===3` (Wave A
    // seed). When a follow-up Wave A ticket registers another flag,
    // bump `EXPECTED_WAVE_A_SEED_FLAG_COUNT` and add the row above.
    expect(CHAT_V10_FLAGS.length).toBe(EXPECTED_WAVE_A_SEED_FLAG_COUNT);
  });

  it('every Wave A seed flag (id / ticketId / requirementId / block) is registered exactly once', () => {
    for (const expected of EXPECTED_WAVE_A_SEED) {
      const byId = findChatV10Flag(expected.id);
      expect(byId, `seed flag ${expected.id} not found`).toBeDefined();
      expect(byId!.ticketId).toBe(expected.ticketId);
      expect(byId!.requirementId).toBe(expected.requirementId);
      expect(byId!.block).toBe(expected.block);
    }
  });

  it('every registered flag has a ticketId matching V10-<CODE>-<nnn> (invariant 32)', () => {
    // PIP = cross-block integration pipelines introduced in V10-35 Wave-B bridge.
    const TICKET_RE = /^V10-(RSN|LRN|AGT|RSR|ART|CON|OUT|ONB|PIP)-\d{3}$/;
    for (const flag of CHAT_V10_FLAGS) {
      expect(flag.ticketId).toMatch(TICKET_RE);
    }
  });

  it('every registered flag has a requirementId matching R-<BLOCK>-<n> (invariant 31 outbound)', () => {
    // PIPELINE = cross-block integration pipelines introduced in V10-35 Wave-B bridge.
    const REQ_RE =
      /^R-(REASON|LEARN|AGENT|RESEARCH|ARTIFACT|CONNECT|OUTCOME|ONBOARD|PIPELINE)-\d+$/;
    for (const flag of CHAT_V10_FLAGS) {
      expect(flag.requirementId).toMatch(REQ_RE);
    }
  });

  it('every registered flag has block in the 8-value union (invariant 33)', () => {
    const allowed = new Set<ChatV10Block>([...CHAT_V10_BLOCKS]);
    for (const flag of CHAT_V10_FLAGS) {
      expect(allowed.has(flag.block)).toBe(true);
    }
  });

  it('every registered flag has unique id, ticketId, requirementId and localStorage key', () => {
    const ids = CHAT_V10_FLAGS.map((f) => f.id);
    const tickets = CHAT_V10_FLAGS.map((f) => f.ticketId);
    const reqs = CHAT_V10_FLAGS.map((f) => f.requirementId);
    const lsKeys = CHAT_V10_FLAGS.map((f) => f.keys.localStorage);

    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(tickets).size).toBe(tickets.length);
    expect(new Set(reqs).size).toBe(reqs.length);
    expect(new Set(lsKeys).size).toBe(lsKeys.length);
  });

  it('every registered flag uses the ff./ff_/VITE_ key prefixes', () => {
    for (const flag of CHAT_V10_FLAGS) {
      expect(flag.keys.localStorage.startsWith('ff.')).toBe(true);
      expect(flag.keys.query.startsWith('ff_')).toBe(true);
      expect(flag.keys.env.startsWith('VITE_')).toBe(true);
    }
  });

  it('every registered flag declares a boolean default', () => {
    for (const flag of CHAT_V10_FLAGS) {
      expect(typeof flag.default).toBe('boolean');
    }
  });

  // ---------------------------------------------------------------------
  // V10 CI invariant 23 mirror — on-by-construction allowlist.
  //
  // Master plan §4.3 pins the set of V10 flags that may ship with
  // `default: true` to a documented allowlist. Any flag with
  // `default: true` must be in `ON_BY_CONSTRUCTION_ALLOWLIST`. Every
  // flag NOT in the allowlist must have `default: false`.
  //
  // This is the V10 mirror of CI invariant 23 (V9 flag safety policy).
  // ---------------------------------------------------------------------
  it('every `default: true` flag is a member of the on-by-construction allowlist', () => {
    const defaultTrueKeys = CHAT_V10_FLAGS.filter((f) => f.default === true).map(
      (f) => f.keys.localStorage
    );
    for (const key of defaultTrueKeys) {
      expect(ON_BY_CONSTRUCTION_ALLOWLIST.has(key)).toBe(true);
    }
  });

  it('every flag NOT in the on-by-construction allowlist is default-OFF', () => {
    for (const flag of CHAT_V10_FLAGS) {
      if (ON_BY_CONSTRUCTION_ALLOWLIST.has(flag.keys.localStorage)) continue;
      expect(flag.default).toBe(false);
    }
  });

  it('the trust-first banner (V10-ONB-005) is default-ON (R-ONBOARD-5)', () => {
    const trustBanner = CHAT_V10_FLAGS.find((f) => f.ticketId === 'V10-ONB-005');
    expect(trustBanner, 'V10-ONB-005 must be registered').toBeDefined();
    expect(trustBanner?.default).toBe(true);
    expect(trustBanner?.keys.localStorage).toBe('ff.onboard_trust_first_banner');
  });

  it('at most allowlist-size V10 flags may be on-by-construction', () => {
    const defaultTrue = CHAT_V10_FLAGS.filter((f) => f.default === true);
    expect(defaultTrue.length).toBeLessThanOrEqual(ON_BY_CONSTRUCTION_ALLOWLIST.size);
  });

  it('every registered flag exposes a non-throwing isEnabled()', () => {
    for (const flag of CHAT_V10_FLAGS) {
      expect(typeof flag.isEnabled).toBe('function');
      expect(() => flag.isEnabled()).not.toThrow();
    }
  });
});

// ---------------------------------------------------------------------------
// Accessors.
// ---------------------------------------------------------------------------

describe('chatV10FeatureFlags · accessors', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear();
    }
  });

  it('getChatV10FlagSnapshot returns one entry per registered flag', () => {
    const snapshot = getChatV10FlagSnapshot();
    expect(snapshot).toHaveLength(CHAT_V10_FLAGS.length);
    for (const entry of snapshot) {
      expect(typeof entry.enabled).toBe('boolean');
      expect(typeof entry.default).toBe('boolean');
      expect(entry.matchesDefault).toBe(entry.enabled === entry.default);
    }
  });

  it('getChatV10FlagOverrides returns an empty array when no flag is overridden', () => {
    // jsdom resets localStorage between tests; no override has been
    // written so every flag should resolve to its hardcoded default.
    expect(getChatV10FlagOverrides()).toEqual([]);
  });

  it('findChatV10Flag finds every seed flag by id and returns undefined for unknowns', () => {
    for (const seed of EXPECTED_WAVE_A_SEED) {
      const found = findChatV10Flag(seed.id);
      expect(found?.id).toBe(seed.id);
    }
    expect(findChatV10Flag('not-a-real-v10-flag')).toBeUndefined();
  });

  it('findChatV10FlagByTicket finds every seed flag by ticket id and returns undefined for unknowns', () => {
    for (const seed of EXPECTED_WAVE_A_SEED) {
      const found = findChatV10FlagByTicket(seed.ticketId);
      expect(found?.ticketId).toBe(seed.ticketId);
    }
    expect(findChatV10FlagByTicket('V10-RSN-999')).toBeUndefined();
  });

  it('findChatV10FlagByRequirement finds every seed flag by requirement id and returns undefined for unknowns', () => {
    for (const seed of EXPECTED_WAVE_A_SEED) {
      const found = findChatV10FlagByRequirement(seed.requirementId);
      expect(found?.requirementId).toBe(seed.requirementId);
    }
    expect(findChatV10FlagByRequirement('R-REASON-999')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Write-side (shared helpers via chatFlagsShared).
// ---------------------------------------------------------------------------

describe('chatV10FeatureFlags · write-side', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear();
    }
  });

  it('setChatV10FlagOverride returns false for unknown flag ids', () => {
    expect(setChatV10FlagOverride('not-a-flag', 'on')).toBe(false);
    expect(setChatV10FlagOverride('not-a-flag', 'off')).toBe(false);
    expect(setChatV10FlagOverride('not-a-flag', null)).toBe(false);
  });

  it('clearChatV10FlagOverride returns false for unknown flag ids', () => {
    expect(clearChatV10FlagOverride('not-a-flag')).toBe(false);
  });

  it('getChatV10FlagOverrideState returns null for unknown flag ids', () => {
    expect(getChatV10FlagOverrideState('not-a-flag')).toBeNull();
  });

  it('resetAllChatV10FlagOverrides clears overrides for every Wave A seed flag without throwing', () => {
    // No overrides set in this test → every flag's clear is a no-op
    // that still returns true (write succeeded against jsdom
    // localStorage). Returns the registered-flag count.
    const cleared = resetAllChatV10FlagOverrides();
    expect(cleared).toBe(CHAT_V10_FLAGS.length);
  });

  it('round-trips a localStorage override for every Wave A seed flag', () => {
    for (const seed of EXPECTED_WAVE_A_SEED) {
      // Initial state — no override.
      expect(getChatV10FlagOverrideState(seed.id)).toBeNull();

      // Set ON, observe.
      expect(setChatV10FlagOverride(seed.id, 'on')).toBe(true);
      expect(getChatV10FlagOverrideState(seed.id)).toBe('on');

      // Set OFF, observe.
      expect(setChatV10FlagOverride(seed.id, 'off')).toBe(true);
      expect(getChatV10FlagOverrideState(seed.id)).toBe('off');

      // Clear, observe.
      expect(clearChatV10FlagOverride(seed.id)).toBe(true);
      expect(getChatV10FlagOverrideState(seed.id)).toBeNull();
    }
  });

  it('every Wave A seed flag has spec-doc paths that resolve on disk (invariant 5 V10 mirror)', () => {
    for (const flag of CHAT_V10_FLAGS) {
      expect(flag.specDocs.length, `${flag.id} has zero specDocs`).toBeGreaterThan(0);
      for (const spec of flag.specDocs) {
        const abs = path.resolve(__dirname, '../../..', spec);
        // readFileSync throws if missing; existence check via readdirSync of parent.
        const parent = path.dirname(abs);
        const base = path.basename(abs);
        expect(
          readdirSync(parent),
          `specDoc ${spec} (referenced by ${flag.id}) not on disk`
        ).toContain(base);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Dev plan discoverability (invariant 47).
// ---------------------------------------------------------------------------

describe('chatV10FeatureFlags · dev plan discoverability (invariant 47)', () => {
  it('every §7 dev plan stub in the master plan resolves to a file on disk', () => {
    const masterSource = readFileSync(path.join(DOCS_DIR, MASTER_PLAN), 'utf8');
    // Match backticked dev-plan filenames referenced by the master plan.
    // The §7 stub section lists them as `NAME_DEVELOPMENT_PLAN_YYYY-MM-DD.md`.
    const PLAN_RE = /`([A-Z0-9_]+_DEVELOPMENT_PLAN_\d{4}-\d{2}-\d{2}\.md)`/g;
    const cited = new Set<string>();
    for (const match of masterSource.matchAll(PLAN_RE)) {
      cited.add(match[1]);
    }
    expect(cited.size, 'expected ≥8 dev plan references in master plan').toBeGreaterThanOrEqual(8);

    const onDisk = new Set(
      readdirSync(DOCS_DIR).filter((f) => /_DEVELOPMENT_PLAN_\d{4}-\d{2}-\d{2}\.md$/.test(f))
    );

    const missing: string[] = [];
    for (const plan of cited) {
      if (!onDisk.has(plan)) missing.push(plan);
    }
    expect(
      missing,
      `dev plans cited by master plan but missing on disk:\n${missing.join('\n')}`
    ).toEqual([]);
  });

  it('every V10 dev plan on disk is cited by the master plan', () => {
    const masterSource = readFileSync(path.join(DOCS_DIR, MASTER_PLAN), 'utf8');
    const onDisk = readdirSync(DOCS_DIR).filter((f) =>
      /_DEVELOPMENT_PLAN_\d{4}-\d{2}-\d{2}\.md$/.test(f)
    );

    // Filter to V10 dev plans only. V9 dev plans exist in the same
    // folder and are cited separately from the README; the master plan
    // only knows about V10 plans. The §7 stubs reference each plan
    // verbatim by filename, so we assert substring presence.
    const V10_PLAN_NAMES = new Set<string>([
      'ONBOARDING_ACTIVATION_DEVELOPMENT_PLAN_2026-04-18.md',
      'ARTIFACT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md',
      'AGENT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md',
      'REASONING_ROUTER_DEVELOPMENT_PLAN_2026-04-18.md',
      'ENTERPRISE_INTEGRATIONS_DEVELOPMENT_PLAN_2026-04-18.md',
      'FEEDBACK_SELF_LEARNING_DEVELOPMENT_PLAN_2026-04-18.md',
      'DEEP_RESEARCH_DEVELOPMENT_PLAN_2026-04-18.md',
      'ROI_LIFECYCLE_DEVELOPMENT_PLAN_2026-04-18.md',
    ]);

    const uncited: string[] = [];
    for (const plan of onDisk) {
      if (V10_PLAN_NAMES.has(plan) && !masterSource.includes(plan)) {
        uncited.push(plan);
      }
    }
    expect(
      uncited,
      `V10 dev plans on disk but never cited in master plan:\n${uncited.join('\n')}`
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// ADR ↔ master-plan bijection (master plan §10 + §10.1, ADR-V10 folder).
// ---------------------------------------------------------------------------
// The §10 table lists D-1..D-N decisions with a link-column pointing at
// `./adr/ADR-V10-<nnn>-<slug>.md`. Every row must link to a file on disk,
// every file on disk (except the folder README) must match a row, and
// the filename must be in canonical form. These three checks together
// make the ADR folder a durable backstop: a future pass of the master
// plan cannot silently drop a decision.

describe('chatV10FeatureFlags · ADR ↔ master-plan bijection', () => {
  const ADR_DIR = path.join(DOCS_DIR, 'adr');
  const ADR_FILENAME_RE = /^ADR-V10-\d{3}-[a-z0-9-]+\.md$/;

  it('adr/ folder exists and contains at least the D-1..D-10 ADR files', () => {
    const entries = readdirSync(ADR_DIR);
    const adrFiles = entries.filter((f) => ADR_FILENAME_RE.test(f));
    expect(adrFiles.length, 'expected ≥10 ADR files for D-1..D-10').toBeGreaterThanOrEqual(10);
  });

  it('every ADR file in adr/ matches the canonical filename format', () => {
    const entries = readdirSync(ADR_DIR);
    // `README.md` is the index and is allowed; every other file must be
    // a canonical ADR.
    const violations: string[] = [];
    for (const f of entries) {
      if (!f.endsWith('.md')) continue;
      if (f === 'README.md') continue;
      if (!ADR_FILENAME_RE.test(f)) {
        violations.push(f);
      }
    }
    expect(
      violations,
      `ADR files that do not match /^ADR-V10-\\d{3}-[a-z0-9-]+\\.md$/:\n${violations.join('\n')}`
    ).toEqual([]);
  });

  it('every master-plan §10 D-n row links to an ADR file that exists on disk', () => {
    const masterSource = readFileSync(path.join(DOCS_DIR, MASTER_PLAN), 'utf8');
    // Slice the §10 table (between `## 10.` heading and the `### 10.1`
    // subsection that follows). This keeps us from accidentally matching
    // `D-n` strings elsewhere in the master plan.
    const TABLE_RE = /## 10\. Resolved decisions[\s\S]*?(?=\n### 10\.1)/;
    const tableMatch = TABLE_RE.exec(masterSource);
    expect(tableMatch, 'master plan §10 table not found').not.toBeNull();
    const table = tableMatch![0];

    // Extract `D-<n>` row -> linked ADR filename pairs.
    // Row shape: `| D-<n> | … | … | … | [`ADR-V10-<nnn>`](./adr/ADR-V10-<nnn>-<slug>.md) |`
    const ROW_RE = /\|\s*D-(\d+)\s*\|[\s\S]*?\(\.\/adr\/(ADR-V10-\d{3}-[a-z0-9-]+\.md)\)/g;
    const pairs: Array<{ decision: string; adrFile: string }> = [];
    for (const match of table.matchAll(ROW_RE)) {
      pairs.push({ decision: `D-${match[1]}`, adrFile: match[2] });
    }

    expect(pairs.length, 'expected at least D-1..D-10 linked in §10 table').toBeGreaterThanOrEqual(
      10
    );

    const adrOnDisk = new Set(readdirSync(ADR_DIR).filter((f) => ADR_FILENAME_RE.test(f)));
    const missing: string[] = [];
    for (const { decision, adrFile } of pairs) {
      if (!adrOnDisk.has(adrFile)) {
        missing.push(`${decision} → ${adrFile} (file missing)`);
      }
    }
    expect(
      missing,
      `master plan rows whose linked ADR is missing on disk:\n${missing.join('\n')}`
    ).toEqual([]);
  });

  it('every ADR file on disk is referenced by exactly one master-plan §10 row', () => {
    const masterSource = readFileSync(path.join(DOCS_DIR, MASTER_PLAN), 'utf8');
    const adrOnDisk = readdirSync(ADR_DIR).filter((f) => ADR_FILENAME_RE.test(f));

    // Count occurrences of each ADR filename in the master plan.
    // An ADR can appear > 1 time only if it supersedes another ADR or
    // is cross-referenced — for D-1..D-10 baseline, each should appear
    // exactly once in the §10 table. If an ADR exists on disk but is
    // never referenced, it's a ghost file. If it's referenced twice,
    // it's a copy-paste bug in the table.
    const orphans: string[] = [];
    const duplicates: string[] = [];
    for (const f of adrOnDisk) {
      const occurrences = masterSource.split(f).length - 1;
      if (occurrences === 0) orphans.push(f);
      else if (occurrences > 1) duplicates.push(`${f} (${occurrences}×)`);
    }

    expect(
      orphans,
      `ADR files on disk but never referenced by the master plan:\n${orphans.join('\n')}`
    ).toEqual([]);
    expect(
      duplicates,
      `ADR files referenced more than once in the master plan (copy-paste bug?):\n${duplicates.join('\n')}`
    ).toEqual([]);
  });

  it('every ADR file has the mandatory headings (Context, Decision, Rationale, Consequences)', () => {
    const entries = readdirSync(ADR_DIR).filter((f) => ADR_FILENAME_RE.test(f));
    const REQUIRED = ['## Context', '## Decision', '## Rationale', '## Consequences'];
    const violations: string[] = [];
    for (const f of entries) {
      const src = readFileSync(path.join(ADR_DIR, f), 'utf8');
      const missing = REQUIRED.filter((heading) => !src.includes(heading));
      if (missing.length > 0) {
        violations.push(`${f}: missing headings ${missing.join(', ')}`);
      }
    }
    expect(violations, `ADR files missing required headings:\n${violations.join('\n')}`).toEqual(
      []
    );
  });

  it('every ADR file declares a Status line and links back to the master plan §10 anchor', () => {
    const entries = readdirSync(ADR_DIR).filter((f) => ADR_FILENAME_RE.test(f));
    const violations: string[] = [];
    for (const f of entries) {
      const src = readFileSync(path.join(ADR_DIR, f), 'utf8');
      if (!/\*\*Status:\*\*/.test(src)) {
        violations.push(`${f}: no Status line`);
      }
      if (!src.includes('#sec-10-open-decisions')) {
        violations.push(`${f}: no link back to master plan §10 anchor`);
      }
    }
    expect(violations, `ADR Status/backlink violations:\n${violations.join('\n')}`).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Soft coverage report (invariant 31 inbound — reports, does not fail).
// ---------------------------------------------------------------------------

describe('chatV10FeatureFlags · requirement coverage report (invariant 31 inbound, soft mode)', () => {
  it('reports how many research-doc R-* requirements currently have a flag (no failure until Wave A cut)', () => {
    // Walk each DEEP_RESEARCH_*.md, collect every `R-<BLOCK>-<n>`
    // occurrence in a line of the form `| R-BLOCK-N |` (the canonical
    // requirement-table row shape used by every authoritative research
    // doc). Count how many are covered by the V10 registry.
    //
    // TODO(V10-wave-a-gate): flip this test from soft to hard when the
    // first V10 flag lands AND the on-call team signs off. Until then
    // this block exists as a forcing function: the printed coverage
    // number appears in CI logs so forward progress is visible.
    const researchFiles = readdirSync(DOCS_DIR).filter((f) =>
      /^DEEP_RESEARCH_.+_\d{4}-\d{2}-\d{2}\.md$/.test(f)
    );
    const requirementIds = new Set<`R-${string}-${number}`>();
    const REQ_TABLE_RE = /\|\s*(R-[A-Z]+-\d+)\s*\|/g;
    for (const file of researchFiles) {
      const src = readFileSync(path.join(DOCS_DIR, file), 'utf8');
      for (const match of src.matchAll(REQ_TABLE_RE)) {
        requirementIds.add(match[1] as `R-${string}-${number}`);
      }
    }

    const covered = CHAT_V10_FLAGS.map((f) => f.requirementId);
    const coveredSet = new Set(covered);
    const missing = [...requirementIds].filter((id) => !coveredSet.has(id));

    // Soft mode: log coverage, never fail. When the gate flips this
    // becomes `expect(missing).toEqual([])`.
    // eslint-disable-next-line no-console
    console.info(
      `[V10 coverage] ${covered.length} / ${requirementIds.size} requirements covered; ` +
        `${missing.length} pending.`
    );
    expect(requirementIds.size).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// Telemetry contract sync (Phase 4: V10 runtime MVP events).
// ---------------------------------------------------------------------------

describe('chatV10FeatureFlags · telemetry contract sync', () => {
  it('every declared V10 telemetry event exists in FunnelEventName', () => {
    const repoRoot = path.resolve(__dirname, '../../..');
    const funnelSource = readFileSync(
      path.join(repoRoot, 'src', 'services', 'funnelAnalytics.ts'),
      'utf8'
    );
    const FUNNEL_EVENT_RE = /^\s*\|\s*'([a-z0-9_.]+)'/gm;
    const knownEvents = new Set<string>();
    for (const match of funnelSource.matchAll(FUNNEL_EVENT_RE)) knownEvents.add(match[1]);
    expect(knownEvents.size, 'failed to parse FunnelEventName union').toBeGreaterThan(50);

    const orphans: string[] = [];
    for (const flag of CHAT_V10_FLAGS) {
      for (const ev of flag.telemetry) {
        if (!knownEvents.has(ev)) orphans.push(`${flag.id} → ${ev}`);
      }
    }
    expect(
      orphans,
      `V10 flags declare telemetry events not in FunnelEventName:\n${orphans.join('\n')}`
    ).toEqual([]);
  });

  it('every declared V10 telemetry event has a heading in the telemetry contract doc', () => {
    const contractSource = readFileSync(
      path.join(DOCS_DIR, 'CHAT_V10_TELEMETRY_CONTRACT_2026-04-18.md'),
      'utf8'
    );

    const headingSet = new Set<string>();
    const HEADING_RE = /^#{2,3}\s+`?([a-z][a-z0-9_.]*)`?\s*$/gm;
    for (const match of contractSource.matchAll(HEADING_RE)) headingSet.add(match[1]);
    expect(
      headingSet.size,
      'failed to parse event headings from telemetry contract doc'
    ).toBeGreaterThan(5);

    const undocumented: string[] = [];
    for (const flag of CHAT_V10_FLAGS) {
      for (const ev of flag.telemetry) {
        if (!headingSet.has(ev)) undocumented.push(`${flag.id} → ${ev}`);
      }
    }
    expect(
      undocumented,
      `V10 flags declare telemetry events missing from the contract doc:\n${undocumented.join('\n')}`
    ).toEqual([]);
  });
});
