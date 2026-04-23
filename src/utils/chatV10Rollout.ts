import {
  CHAT_V10_BLOCKS,
  CHAT_V10_FLAGS,
  type ChatV10Block,
  type ChatV10FlagSnapshotEntry,
  findChatV10Flag,
  getChatV10FlagSnapshot,
} from './chatV10FeatureFlags';

export type ChatV10RolloutReadiness = 'ready' | 'partial' | 'flagged_off';
export type ChatV10RolloutPhase = 1 | 2 | 3;

export interface ChatV10RolloutFunctionDefinition {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly phase: ChatV10RolloutPhase;
  readonly flagIds: readonly string[];
}

export interface ChatV10RolloutBlockDefinition {
  readonly block: ChatV10Block;
  readonly title: string;
  readonly description: string;
  readonly gateFlagIds: readonly string[];
  readonly functions: readonly ChatV10RolloutFunctionDefinition[];
}

export interface ChatV10RolloutFunctionSnapshot extends ChatV10RolloutFunctionDefinition {
  readonly readiness: ChatV10RolloutReadiness;
  readonly enabledFlags: number;
  readonly totalFlags: number;
  readonly defaultOffFlags: number;
}

export interface ChatV10RolloutBlockSnapshot extends ChatV10RolloutBlockDefinition {
  readonly readiness: ChatV10RolloutReadiness;
  readonly enabledGateFlags: number;
  readonly totalGateFlags: number;
  readonly defaultOffGateFlags: number;
  readonly functions: readonly ChatV10RolloutFunctionSnapshot[];
}

export interface ChatV10RolloutSummary {
  readonly totalBlocks: number;
  readonly readyBlocks: number;
  readonly partialBlocks: number;
  readonly flaggedOffBlocks: number;
  readonly totalFunctions: number;
  readonly readyFunctions: number;
  readonly partialFunctions: number;
  readonly flaggedOffFunctions: number;
  readonly totalFlags: number;
  readonly defaultOffFlags: number;
}

export const CHAT_V10_ROLLOUT_BLOCKS: readonly ChatV10RolloutBlockDefinition[] = [
  {
    block: 'artifact',
    title: 'Artifact',
    description: 'Artifacts, review flow and materialization/export handoff.',
    gateFlagIds: ['pipelines-artifact-mutation'],
    functions: [
      {
        id: 'artifact-contracts',
        title: 'Artifact contracts',
        description: 'Unified model and typed runtime contracts.',
        phase: 1,
        flagIds: ['artifact-unified-model', 'artifact-type-registry', 'artifact-typed-ops'],
      },
      {
        id: 'artifact-review-preflight',
        title: 'Review and preflight',
        description: 'Validation, approval flow and no-silent-write safety rails.',
        phase: 2,
        flagIds: ['artifact-no-silent-writes', 'artifact-approve-edit-reject', 'artifact-partial-acceptance'],
      },
      {
        id: 'artifact-materialization',
        title: 'Materialization and handoff',
        description: 'Export/materialization path into downstream outputs surfaces.',
        phase: 3,
        flagIds: ['pipelines-artifact-export', 'artifact-export-manifest', 'artifact-template-fingerprint'],
      },
    ],
  },
  {
    block: 'agent_runtime',
    title: 'Agent',
    description: 'Schedule definitions, execution controls and operator pipeline.',
    gateFlagIds: ['agent-schedule-definition', 'agent-schedule-registry', 'pipelines-agent-schedule'],
    functions: [
      {
        id: 'agent-scheduling',
        title: 'Schedule registry',
        description: 'Definition and registry primitives for the agent runtime.',
        phase: 1,
        flagIds: ['agent-schedule-definition', 'agent-schedule-registry'],
      },
      {
        id: 'agent-run-controls',
        title: 'Run controls',
        description: 'Approval, diff preview and durable run ledger controls.',
        phase: 2,
        flagIds: ['agent-approval-mode', 'agent-diff-preview-v1', 'agent-run-ledger'],
      },
      {
        id: 'agent-operator-pipeline',
        title: 'Operator pipeline',
        description: 'Shared pipeline that hosts agent schedule operations end to end.',
        phase: 3,
        flagIds: ['pipelines-agent-schedule'],
      },
    ],
  },
  {
    block: 'onboarding',
    title: 'Onboarding',
    description: 'Persona capture, activation journey and conservative rollout defaults.',
    gateFlagIds: ['onboard-persona-capture', 'pipelines-onboarding-persona'],
    functions: [
      {
        id: 'onboarding-persona',
        title: 'Persona capture',
        description: 'Persona collection and guided routing into V10.',
        phase: 1,
        flagIds: ['onboard-persona-capture', 'pipelines-onboarding-persona'],
      },
      {
        id: 'onboarding-activation',
        title: 'Activation and resume',
        description: 'Resume-abandonment flow and activation KPI surfaces.',
        phase: 2,
        flagIds: ['onboard-resume-abandonment', 'onboard-activation-kpi-dashboard'],
      },
      {
        id: 'onboarding-safe-defaults',
        title: 'Conservative defaults',
        description: 'Safe rollout defaults for memory and first-run experience.',
        phase: 3,
        flagIds: ['onboard-conservative-defaults', 'onboard-memory-layer-opt-in'],
      },
    ],
  },
  {
    block: 'reasoning',
    title: 'Reasoning',
    description: 'Core reasoning router, chat pipelines and operator diagnostics.',
    gateFlagIds: ['pipelines-reasoning-fast-chat'],
    functions: [
      {
        id: 'reasoning-core',
        title: 'Reasoning core',
        description: 'Registry and execution loop for the reasoning runtime.',
        phase: 1,
        flagIds: ['reasoning-workload-class-registry', 'reasoning-execution-loop'],
      },
      {
        id: 'reasoning-chat-pipelines',
        title: 'Chat pipelines',
        description: 'Fast and grounded chat paths under rollout control.',
        phase: 2,
        flagIds: ['pipelines-reasoning-fast-chat', 'pipelines-reasoning-grounded-chat'],
      },
      {
        id: 'reasoning-operator-surfaces',
        title: 'Operator surfaces',
        description: 'Presentation layer and telemetry for rollout diagnostics.',
        phase: 3,
        flagIds: ['reasoning-presentation-layer', 'reasoning-telemetry'],
      },
    ],
  },
  {
    block: 'learning',
    title: 'Learning',
    description: 'Signal ingest, stewardship governance and rollout observability.',
    gateFlagIds: ['pipelines-learning-feedback'],
    functions: [
      {
        id: 'learning-signal-ingest',
        title: 'Signal ingest',
        description: 'Feedback submission and typed signal collection.',
        phase: 1,
        flagIds: ['learning-feedback-signal', 'learning-feedback-collector'],
      },
      {
        id: 'learning-governance',
        title: 'Governance',
        description: 'Audit, drift detection and operational learning controls.',
        phase: 2,
        flagIds: ['learning-drift-detection', 'learning-audit-export'],
      },
      {
        id: 'learning-operator-pipeline',
        title: 'Operator pipeline',
        description: 'Telemetry and shared feedback pipeline for staged rollout.',
        phase: 3,
        flagIds: ['learning-telemetry', 'pipelines-learning-feedback'],
      },
    ],
  },
  {
    block: 'research',
    title: 'Research',
    description: 'Mission planning, watch flow and operator telemetry.',
    gateFlagIds: ['pipelines-research-mission'],
    functions: [
      {
        id: 'research-mission-contracts',
        title: 'Mission contracts',
        description: 'Research mission type, plan and execution contract.',
        phase: 1,
        flagIds: ['research-mission', 'research-mission-plan-formulator'],
      },
      {
        id: 'research-live-ops',
        title: 'Live research ops',
        description: 'Mission execution, watch pipeline and delta reporting.',
        phase: 2,
        flagIds: ['pipelines-research-mission', 'pipelines-research-watch', 'research-watch-delta-report'],
      },
      {
        id: 'research-telemetry-ops',
        title: 'Operator telemetry',
        description: 'Telemetry and cost-monitoring rollout surfaces.',
        phase: 3,
        flagIds: ['research-telemetry', 'research-cost-dashboard'],
      },
    ],
  },
  {
    block: 'connectors',
    title: 'Connectors',
    description: 'Connector registry, ingest path and operational hygiene.',
    gateFlagIds: ['pipelines-connectors-ingest'],
    functions: [
      {
        id: 'connectors-registry-auth',
        title: 'Registry and auth',
        description: 'Connector registry and OAuth/token foundations.',
        phase: 1,
        flagIds: ['connectors-registry', 'connectors-oauth-layer'],
      },
      {
        id: 'connectors-ingest',
        title: 'Ingest and freshness',
        description: 'Ingest pipeline, incremental sync and freshness SLOs.',
        phase: 2,
        flagIds: ['pipelines-connectors-ingest', 'connectors-incremental-sync', 'connectors-freshness-slo'],
      },
      {
        id: 'connectors-ops',
        title: 'Operational hygiene',
        description: 'Health dashboard and telemetry controls for safe rollout.',
        phase: 3,
        flagIds: ['connectors-health-dashboard', 'connectors-telemetry-full'],
      },
    ],
  },
  {
    block: 'outcome',
    title: 'Outcome',
    description: 'Outcome contracts, acceptance flow and rollout analytics.',
    gateFlagIds: ['pipelines-outcome-rollup'],
    functions: [
      {
        id: 'outcome-contracts',
        title: 'Outcome contracts',
        description: 'Signal and record primitives for business outcomes.',
        phase: 1,
        flagIds: ['outcome-signal', 'outcome-record'],
      },
      {
        id: 'outcome-acceptance',
        title: 'Acceptance flow',
        description: 'KPI acceptance and lineage binding for result verification.',
        phase: 2,
        flagIds: ['outcome-kpi-accept-outcome', 'outcome-lineage-binding'],
      },
      {
        id: 'outcome-analytics',
        title: 'Outcome analytics',
        description: 'Rollup pipeline, telemetry and quality dashboard.',
        phase: 3,
        flagIds: ['pipelines-outcome-rollup', 'outcome-telemetry', 'outcome-quality-dashboard'],
      },
    ],
  },
] as const;

function countEnabled(entries: readonly ChatV10FlagSnapshotEntry[]): number {
  return entries.filter((entry) => entry.enabled).length;
}

function countDefaultOff(entries: readonly ChatV10FlagSnapshotEntry[]): number {
  return entries.filter((entry) => entry.default === false).length;
}

function resolveReadiness(entries: readonly ChatV10FlagSnapshotEntry[]): ChatV10RolloutReadiness {
  if (entries.length === 0) return 'flagged_off';
  const enabled = countEnabled(entries);
  if (enabled === 0) return 'flagged_off';
  if (enabled === entries.length) return 'ready';
  return 'partial';
}

function pickSnapshotEntries(
  snapshotById: ReadonlyMap<string, ChatV10FlagSnapshotEntry>,
  flagIds: readonly string[],
): ChatV10FlagSnapshotEntry[] {
  return flagIds
    .map((flagId) => snapshotById.get(flagId))
    .filter((entry): entry is ChatV10FlagSnapshotEntry => Boolean(entry));
}

export function getChatV10RolloutSnapshot(): ChatV10RolloutBlockSnapshot[] {
  const snapshot = getChatV10FlagSnapshot();
  const snapshotById = new Map(snapshot.map((entry) => [entry.id, entry]));

  return CHAT_V10_ROLLOUT_BLOCKS.map((block) => {
    const gateEntries = pickSnapshotEntries(snapshotById, block.gateFlagIds);
    const functions = block.functions.map((feature) => {
      const entries = pickSnapshotEntries(snapshotById, feature.flagIds);
      return {
        ...feature,
        readiness: resolveReadiness(entries),
        enabledFlags: countEnabled(entries),
        totalFlags: entries.length,
        defaultOffFlags: countDefaultOff(entries),
      };
    });

    return {
      ...block,
      readiness: resolveReadiness(gateEntries),
      enabledGateFlags: countEnabled(gateEntries),
      totalGateFlags: gateEntries.length,
      defaultOffGateFlags: countDefaultOff(gateEntries),
      functions,
    };
  });
}

export function getChatV10RolloutSummary(): ChatV10RolloutSummary {
  const blocks = getChatV10RolloutSnapshot();
  const functions = blocks.flatMap((block) => block.functions);

  return {
    totalBlocks: blocks.length,
    readyBlocks: blocks.filter((block) => block.readiness === 'ready').length,
    partialBlocks: blocks.filter((block) => block.readiness === 'partial').length,
    flaggedOffBlocks: blocks.filter((block) => block.readiness === 'flagged_off').length,
    totalFunctions: functions.length,
    readyFunctions: functions.filter((feature) => feature.readiness === 'ready').length,
    partialFunctions: functions.filter((feature) => feature.readiness === 'partial').length,
    flaggedOffFunctions: functions.filter((feature) => feature.readiness === 'flagged_off').length,
    totalFlags: CHAT_V10_FLAGS.length,
    defaultOffFlags: CHAT_V10_FLAGS.filter((flag) => flag.default === false).length,
  };
}

export function findChatV10RolloutBlock(block: ChatV10Block): ChatV10RolloutBlockDefinition | undefined {
  return CHAT_V10_ROLLOUT_BLOCKS.find((entry) => entry.block === block);
}

export function getChatV10RolloutBlocksForAudit(): readonly ChatV10RolloutBlockDefinition[] {
  return CHAT_V10_ROLLOUT_BLOCKS;
}

export interface BuildChatV10FlagSnapshotTextOptions {
  readonly now?: Date;
  readonly label?: string;
}

export function buildChatV10FlagSnapshotText(
  options: BuildChatV10FlagSnapshotTextOptions = {},
): string {
  const now = options.now ?? new Date();
  const snapshot = getChatV10FlagSnapshot();
  const snapshotById = new Map(snapshot.map((entry) => [entry.id, entry]));
  const labelPrefix = options.label ? `Chat V10 flags snapshot · ${options.label}` : 'Chat V10 flags snapshot';
  const header = `${labelPrefix} · ${now.toISOString()}`;
  const overridesCount = snapshot.filter((entry) => !entry.matchesDefault).length;
  const summary = `${CHAT_V10_FLAGS.length} flags, ${overridesCount} overrides, ${
    CHAT_V10_FLAGS.filter((flag) => flag.default === false).length
  } default-off.`;

  const headerRow =
    '| Ticket | ID | Block | State | Default | Matches default | Storage key | Test ID |';
  const dividerRow = '|---|---|---|---|---|---|---|---|';

  const rows = CHAT_V10_FLAGS.map((flag) => {
    const entry = snapshotById.get(flag.id);
    const state = entry?.enabled ? 'on' : 'off';
    const defaultCell = flag.default ? 'on' : 'off';
    const matchesDefault = entry?.matchesDefault ? 'yes' : 'no';
    return `| ${flag.ticketId} | \`${flag.id}\` | ${flag.block} | ${state} | ${defaultCell} | ${matchesDefault} | \`${flag.keys.localStorage}\` | ${
      flag.testId ? `\`${flag.testId}\`` : '—'
    } |`;
  });

  return [header, '', summary, '', headerRow, dividerRow, ...rows].join('\n');
}

export function getChatV10RolloutFlagIds(): string[] {
  const ids = new Set<string>();
  for (const block of CHAT_V10_ROLLOUT_BLOCKS) {
    for (const flagId of block.gateFlagIds) ids.add(flagId);
    for (const feature of block.functions) {
      for (const flagId of feature.flagIds) ids.add(flagId);
    }
  }
  return [...ids];
}

export function getChatV10RolloutMissingFlagIds(): string[] {
  return getChatV10RolloutFlagIds().filter((flagId) => !findChatV10Flag(flagId));
}

export function getChatV10BlockOrderForRollout(): readonly ChatV10Block[] {
  return CHAT_V10_BLOCKS;
}
