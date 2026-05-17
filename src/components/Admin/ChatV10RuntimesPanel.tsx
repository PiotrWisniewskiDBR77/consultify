import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  AgentSchedulePanel,
  type V10RuntimeReadiness,
  V10RuntimeWorkspace,
  V10RuntimeWorkspaceBlock,
} from '@/components/v10';
import {
  useConnectorsRuntime,
  useOnboardingRuntime,
  useOutcomeRuntime,
  useResearchRuntime,
} from '@/hooks/v10';
import { buildDefaultOnboardTelemetryProps } from '@/models/onboarding/OnboardTelemetry';
import type { OnboardingResumeSnapshot } from '@/models/onboarding/ResumeOnAbandonment';
import { fetchWithRetry, handleResponse } from '@/services/api/baseClient';
import {
  type ConnectorsCatalogResponse,
  type ConnectorsSessionListResponse,
} from '@/services/api/v10';
import { cn } from '@/utils/cn';
import { isAgentScheduleDefinitionEnabled } from '@/utils/v10/agentScheduleDefinitionFlag';
import { isAgentScheduleRegistryEnabled } from '@/utils/v10/agentScheduleRegistryFlag';
import {
  bucketItemsCount,
  emitLearningLoopDashboardLoaded,
  emitLearningLoopFeedbackSubmitted,
  emitLearningLoopIncidentReported,
  emitLearningLoopRetentionPreviewed,
  emitLearningLoopStewardshipLoaded,
  emitLearningLoopStewardshipResolved,
} from '@/utils/v10/learningLoopTelemetry';
import {
  bucketAcceptedCount,
  bucketMetricsCount,
  emitOutcomeAcceptanceResolved,
  emitOutcomeBusinessLinked,
  emitOutcomeKpiAcceptancePreviewed,
  emitOutcomeSignalIngested,
} from '@/utils/v10/outcomeFlowTelemetry';
import { isPipelinesAgentSchedulePipelineEnabled } from '@/utils/v10/pipelinesAgentSchedulePipelineFlag';
import { isPipelinesArtifactMutationPipelineEnabled } from '@/utils/v10/pipelinesArtifactMutationPipelineFlag';
import { isPipelinesLearningFeedbackPipelineEnabled } from '@/utils/v10/pipelinesLearningFeedbackPipelineFlag';
import { isPipelinesReasoningFastChatPipelineEnabled } from '@/utils/v10/pipelinesReasoningFastChatPipelineFlag';
import {
  bucketEventsCount,
  bucketMaxSources,
  emitReasoningDelegatedResearchPlan,
  emitResearchMissionPlanned,
  emitResearchMissionSummaryLoaded,
  emitResearchMissionWatchedDelta,
} from '@/utils/v10/researchFlowTelemetry';
import {
  bucketHttpStatus,
  bucketLatencyMs,
  emitConnectorAuthCompleted,
  emitConnectorAuthStarted,
  emitConnectorSessionConnected,
  emitConnectorSessionDisconnected,
  emitConnectorSourceRead,
  emitConnectorSourceSearched,
  emitConnectorsRegistryLoaded,
  emitConnectorsRuntimeFailed,
  emitConnectorsRuntimeStarted,
  emitConnectorsRuntimeSucceeded,
  emitConnectorTokenRefreshed,
  // runtime telemetry only
  emitLearningRuntimeFailed,
  emitLearningRuntimeStarted,
  emitLearningRuntimeSucceeded,
  emitOnboardRuntimeFailed,
  emitOnboardRuntimeStarted,
  emitOnboardRuntimeSucceeded,
  emitOnboardTelemetryEvent,
  emitOutcomeRuntimeFailed,
  emitOutcomeRuntimeStarted,
  emitOutcomeRuntimeSucceeded,
  emitReasoningRuntimeFailed,
  emitReasoningRuntimeStarted,
  emitReasoningRuntimeSucceeded,
  emitResearchRuntimeFailed,
  emitResearchRuntimeStarted,
  emitResearchRuntimeSucceeded,
  inferFailReason,
} from '@/utils/v10/v10RuntimeTelemetry';

type PanelResult = { ok: true; payload: unknown } | { ok: false; error: string };
const CONNECTOR_PERSONA_OPTIONS = [
  '',
  'Partner',
  'CFO',
  'CEO',
  'COO',
  'CISO',
  'Transformation Officer',
] as const;

function unwrapData(payload: unknown): any {
  if (!payload || typeof payload !== 'object') return null;
  if ('data' in (payload as Record<string, unknown>)) return (payload as any).data;
  return payload;
}

function unwrapV10Data(payload: unknown): any {
  // Many server endpoints return { data: <payload>, meta: {..} }.
  const root = unwrapData(payload);
  if (root && typeof root === 'object' && 'data' in (root as Record<string, unknown>)) {
    return (root as any).data;
  }
  return root;
}

function outcomeSignalKindFromDomain(
  domain: 'revenue' | 'retention' | 'cost' | 'time'
): 'time_saved' | 'decision_shipped' | 'revenue' | 'margin' | 'risk_avoided' | 'quality' {
  switch (domain) {
    case 'time':
      return 'time_saved';
    case 'cost':
      return 'margin';
    case 'revenue':
      return 'revenue';
    case 'retention':
    default:
      return 'quality';
  }
}

async function postJson(path: string, body: unknown): Promise<PanelResult> {
  try {
    const res = await fetchWithRetry(path, { method: 'POST', body: JSON.stringify(body) });
    const payload = await handleResponse(res, 'Request failed');
    return { ok: true, payload };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function postJsonInstrumented(args: {
  readonly path: string;
  readonly body: unknown;
  readonly enabled: boolean;
  readonly emitStarted: () => void;
  readonly emitSucceeded: (meta: { latencyMs: number | null; httpStatus: number | null }) => void;
  readonly emitFailed: (meta: {
    latencyMs: number | null;
    httpStatus: number | null;
    error: unknown;
  }) => void;
}): Promise<PanelResult> {
  const start = typeof performance !== 'undefined' ? performance.now() : null;
  args.emitStarted();
  try {
    const res = await fetchWithRetry(args.path, {
      method: 'POST',
      body: JSON.stringify(args.body),
    });
    const end = typeof performance !== 'undefined' ? performance.now() : null;
    const latencyMs = start === null || end === null ? null : Math.max(0, end - start);
    const payload = await handleResponse(res, 'Request failed');
    args.emitSucceeded({
      latencyMs,
      httpStatus: typeof res?.status === 'number' ? res.status : null,
    });
    return { ok: true, payload };
  } catch (error) {
    const end = typeof performance !== 'undefined' ? performance.now() : null;
    const latencyMs = start === null || end === null ? null : Math.max(0, end - start);
    const httpStatus = typeof (error as any)?.status === 'number' ? (error as any).status : null;
    args.emitFailed({ latencyMs, httpStatus, error });
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function postConnectorsRuntimeFetch(args: {
  readonly body: { url: string };
  readonly enabled: boolean;
  readonly perform: (body: { url: string }) => Promise<{ httpStatus: number | null }>;
  readonly emitStarted: () => void;
  readonly emitSucceeded: (meta: { latencyMs: number | null; httpStatus: number | null }) => void;
  readonly emitFailed: (meta: {
    latencyMs: number | null;
    httpStatus: number | null;
    error: unknown;
  }) => void;
}): Promise<PanelResult> {
  const start = typeof performance !== 'undefined' ? performance.now() : null;
  args.emitStarted();
  try {
    const payload = await args.perform(args.body);
    const end = typeof performance !== 'undefined' ? performance.now() : null;
    const latencyMs = start === null || end === null ? null : Math.max(0, end - start);
    args.emitSucceeded({ latencyMs, httpStatus: payload.httpStatus });
    return { ok: true, payload };
  } catch (error) {
    const end = typeof performance !== 'undefined' ? performance.now() : null;
    const latencyMs = start === null || end === null ? null : Math.max(0, end - start);
    const httpStatus = typeof (error as any)?.status === 'number' ? (error as any).status : null;
    args.emitFailed({ latencyMs, httpStatus, error });
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function SectionShell({
  title,
  enabled,
  children,
}: {
  title: string;
  enabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
      <div className="flex items-center justify-between gap-3">
        <div className="text-base font-semibold text-slate-900 dark:text-white">{title}</div>
        <span
          className={cn(
            'px-2.5 py-1 rounded-full text-xs font-medium',
            enabled
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200'
              : 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300'
          )}
        >
          {enabled ? 'Enabled' : 'Flagged off'}
        </span>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function ResultBox({ result }: { result: PanelResult | null }) {
  if (!result) return null;
  return (
    <pre
      className={cn(
        'mt-3 max-h-64 overflow-auto rounded-xl border px-3 py-2 text-xs',
        result.ok
          ? 'border-slate-200 bg-slate-50 text-slate-700 dark:border-white/10 dark:bg-black/20 dark:text-slate-200'
          : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/40 dark:bg-rose-900/15 dark:text-rose-200'
      )}
    >
      {result.ok ? JSON.stringify(result.payload, null, 2) : result.error}
    </pre>
  );
}

function ArtifactPipelinePreflightChecks({ result }: { result: PanelResult | null }) {
  if (!result || !result.ok) return null;
  const data = unwrapData(result.payload);
  const checks = Array.isArray(data?.checks) ? (data.checks as any[]) : null;
  if (!checks || checks.length === 0) return null;

  const badge = (status: string) =>
    status === 'pass'
      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200'
      : status === 'warn'
        ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200'
        : 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-200';

  return (
    <div className="mt-3 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 dark:border-white/10 dark:bg-black/20 dark:text-slate-200">
      <div className="font-semibold">Preflight checks</div>
      <ul className="space-y-1">
        {checks.map((check, idx) => (
          <li key={idx} className="flex items-start justify-between gap-3">
            <span className="truncate">{String(check?.id ?? 'check')}</span>
            <span className="flex items-center gap-2">
              <span
                className={cn(
                  'px-2 py-0.5 rounded-full text-[11px] font-medium',
                  badge(String(check?.status))
                )}
              >
                {String(check?.status)}
              </span>
              {check?.message ? (
                <span className="text-slate-500 dark:text-slate-400">{String(check.message)}</span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ArtifactPipelineTimeline({ result }: { result: PanelResult | null }) {
  if (!result || !result.ok) return null;
  const data = unwrapData(result.payload);
  const timeline = Array.isArray(data?.timeline) ? (data.timeline as any[]) : null;
  const summary = data?.summary ?? null;
  if (!timeline || timeline.length === 0) return null;

  return (
    <div className="mt-3 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 dark:border-white/10 dark:bg-black/20 dark:text-slate-200">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">Timeline</span>
        {summary?.artifactId ? (
          <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 dark:border-white/10 dark:bg-white/5">
            artifact: {String(summary.artifactId)}
          </span>
        ) : null}
        {summary?.toVersionId ? (
          <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 dark:border-white/10 dark:bg-white/5">
            version: {String(summary.toVersionId)}
          </span>
        ) : null}
        {summary?.reviewState ? (
          <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 dark:border-white/10 dark:bg-white/5">
            state: {String(summary.reviewState)}
          </span>
        ) : null}
      </div>
      <ul className="space-y-1">
        {timeline.map((entry, idx) => (
          <li key={idx} className="flex items-start justify-between gap-3">
            <span className="font-medium">{String(entry?.kind ?? 'step')}</span>
            <span className="text-slate-500 dark:text-slate-400">
              {String(entry?.detail ?? '')}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LearningStewardshipQueue({
  result,
  onResolve,
}: {
  result: PanelResult | null;
  onResolve: (itemId: string) => void | Promise<void>;
}) {
  if (!result || !result.ok) return null;
  const data = unwrapV10Data(result.payload);
  const items = Array.isArray(data?.items) ? (data.items as any[]) : null;
  if (!items || items.length === 0) return null;

  return (
    <div className="mt-3 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 dark:border-white/10 dark:bg-black/20 dark:text-slate-200">
      <div className="flex items-center justify-between">
        <div className="font-semibold">Stewardship queue</div>
        <div className="text-slate-500 dark:text-slate-400">{items.length} items</div>
      </div>
      <div className="max-h-56 overflow-auto space-y-2">
        {items.slice(0, 30).map((item) => {
          const itemId = String(item?.itemId ?? '');
          const status = String(item?.status ?? '');
          const isOpen = status === 'open';
          return (
            <div
              key={itemId || Math.random()}
              className="rounded-lg border border-slate-200 bg-white p-2 dark:border-white/10 dark:bg-white/5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">
                    {String(item?.kind ?? 'item')} · {String(item?.summary ?? '')}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {itemId}
                  </div>
                </div>
                {isOpen ? (
                  <button
                    className="shrink-0 px-2 py-1 rounded-lg text-[11px] font-medium bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => onResolve(itemId)}
                  >
                    Resolve
                  </button>
                ) : (
                  <span className="shrink-0 px-2 py-1 rounded-lg text-[11px] font-medium bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300">
                    resolved
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function resolveReadiness(primary: boolean, secondary?: boolean): V10RuntimeReadiness {
  if (secondary === undefined) return primary ? 'ready' : 'flagged_off';
  if (primary && secondary) return 'ready';
  if (primary || secondary) return 'partial';
  return 'flagged_off';
}

export function ChatV10RuntimesPanel() {
  const { t } = useTranslation();

  const [artifactCommand, setArtifactCommand] = useState(
    'Create or update artifact content based on the proposal preview.'
  );
  const [artifactLoadRunId, setArtifactLoadRunId] = useState('');
  const [artifactLoadResult, setArtifactLoadResult] = useState<PanelResult | null>(null);
  const [artifactPublishResult, setArtifactPublishResult] = useState<PanelResult | null>(null);
  const [artifactPreflightResult, setArtifactPreflightResult] = useState<PanelResult | null>(null);
  const [artifactRunResult, setArtifactRunResult] = useState<PanelResult | null>(null);

  const [learningFeedbackRating, setLearningFeedbackRating] = useState(5);
  const [learningFeedbackComment, setLearningFeedbackComment] = useState(
    'Great answer, accurate and clear.'
  );
  const [learningFeedbackResult, setLearningFeedbackResult] = useState<PanelResult | null>(null);
  const [learningRetentionText, setLearningRetentionText] = useState(
    'This summary contains no PII.'
  );
  const [learningRetentionResult, setLearningRetentionResult] = useState<PanelResult | null>(null);
  const [learningQueueResult, setLearningQueueResult] = useState<PanelResult | null>(null);
  const [learningStewardNote, setLearningStewardNote] = useState('Reviewed and resolved.');
  const [learningResolveResult, setLearningResolveResult] = useState<PanelResult | null>(null);
  const [learningDashboardResult, setLearningDashboardResult] = useState<PanelResult | null>(null);
  const [learningIncidentKind, setLearningIncidentKind] = useState<'drift' | 'incident'>('drift');
  const [learningIncidentSeverity, setLearningIncidentSeverity] = useState<
    'low' | 'medium' | 'high'
  >('medium');
  const [learningIncidentSummary, setLearningIncidentSummary] = useState(
    'Answer quality drift detected on finance Q&A.'
  );
  const [learningIncidentResult, setLearningIncidentResult] = useState<PanelResult | null>(null);

  const [reasoningPrompt, setReasoningPrompt] = useState('Summarize what V10 blocks are.');
  const [reasoningResult, setReasoningResult] = useState<PanelResult | null>(null);

  const [researchQuery, setResearchQuery] = useState('Market overview for AI copilots in 2026.');
  const [researchResult, setResearchResult] = useState<PanelResult | null>(null);
  const [researchMissionId, setResearchMissionId] = useState<string>('');
  const [researchCursor, setResearchCursor] = useState(0);
  const [researchPlanResult, setResearchPlanResult] = useState<PanelResult | null>(null);
  const [researchWatchResult, setResearchWatchResult] = useState<PanelResult | null>(null);
  const [researchSummaryResult, setResearchSummaryResult] = useState<PanelResult | null>(null);
  const [researchDelegatePlanResult, setResearchDelegatePlanResult] = useState<PanelResult | null>(
    null
  );

  const [connectorUrl, setConnectorUrl] = useState('https://example.com');
  const [connectorsResult, setConnectorsResult] = useState<PanelResult | null>(null);
  const [connectorsPersona, setConnectorsPersona] = useState<string>('CFO');
  const [connectorsActionConnectorId, setConnectorsActionConnectorId] = useState<string | null>(
    null
  );
  const [connectorsSearchQuery, setConnectorsSearchQuery] = useState('board materials');
  const [connectorsSearchResult, setConnectorsSearchResult] = useState<PanelResult | null>(null);

  const [learningSignal, setLearningSignal] = useState('user_feedback: thumbs_up');
  const [learningResult, setLearningResult] = useState<PanelResult | null>(null);

  const [outcomeAnalysisSummary, setOutcomeAnalysisSummary] = useState(
    'Analysis indicates that weekly KPI review can be automated with a curated artifact and approval loop.'
  );
  const [outcomeBusinessGoal, setOutcomeBusinessGoal] = useState(
    'Reduce finance reporting cycle time.'
  );
  const [outcomeHypothesis, setOutcomeHypothesis] = useState(
    'If the team adopts the proposed workflow, reporting time should drop within one review cycle.'
  );
  const [outcomeMetricLabel, setOutcomeMetricLabel] = useState('Reporting cycle time');
  const [outcomeMetricDomain, setOutcomeMetricDomain] = useState<
    'revenue' | 'retention' | 'cost' | 'time'
  >('time');
  const [outcomeMetricBaseline, setOutcomeMetricBaseline] = useState(8);
  const [outcomeMetricTarget, setOutcomeMetricTarget] = useState(3);
  const [outcomeMetricObserved, setOutcomeMetricObserved] = useState(5);
  const [outcomeAnalysisId, setOutcomeAnalysisId] = useState('analysis-outcome-1');
  const [outcomeArtifactId, setOutcomeArtifactId] = useState('artifact-outcome-1');
  const [outcomeContractId, setOutcomeContractId] = useState('');
  const [outcomeDecision, setOutcomeDecision] = useState<
    'accepted' | 'rejected' | 'needs_revision'
  >('accepted');
  const [outcomePreviewResult, setOutcomePreviewResult] = useState<PanelResult | null>(null);
  const [outcomeSignalResult, setOutcomeSignalResult] = useState<PanelResult | null>(null);
  const [outcomeAcceptanceResult, setOutcomeAcceptanceResult] = useState<PanelResult | null>(null);
  const [outcomeLinkResult, setOutcomeLinkResult] = useState<PanelResult | null>(null);

  const [persona, setPersona] = useState('consultant');
  const [onboardingId, setOnboardingId] = useState('');
  const [resumeToken, setResumeToken] = useState('');
  const [onboardingStep, setOnboardingStep] = useState('connector_validation');
  const [onboardingResult, setOnboardingResult] = useState<PanelResult | null>(null);
  const [onboardingKpiResult, setOnboardingKpiResult] = useState<PanelResult | null>(null);

  const researchRuntime = useResearchRuntime();
  const connectorsRuntime = useConnectorsRuntime({
    persona: connectorsPersona || null,
    includePlanned: true,
  });
  const outcomeRuntime = useOutcomeRuntime();
  const onboardingRuntime = useOnboardingRuntime();

  const enabled = useMemo(
    () => ({
      artifactPipeline: isPipelinesArtifactMutationPipelineEnabled(),
      agentDefinition: isAgentScheduleDefinitionEnabled(),
      agentRegistry: isAgentScheduleRegistryEnabled(),
      agentPipeline: isPipelinesAgentSchedulePipelineEnabled(),
      agent:
        isAgentScheduleDefinitionEnabled() ||
        isAgentScheduleRegistryEnabled() ||
        isPipelinesAgentSchedulePipelineEnabled(),
      learningLoop: isPipelinesLearningFeedbackPipelineEnabled(),
      reasoning: isPipelinesReasoningFastChatPipelineEnabled(),
      research: researchRuntime.isEnabled,
      connectors: connectorsRuntime.isEnabled,
      learning: isPipelinesLearningFeedbackPipelineEnabled(),
      outcome: outcomeRuntime.isEnabled,
      onboarding: onboardingRuntime.isEnabled,
    }),
    [
      connectorsRuntime.isEnabled,
      onboardingRuntime.isEnabled,
      outcomeRuntime.isEnabled,
      researchRuntime.isEnabled,
    ]
  );

  const workspaceBlocks = useMemo<readonly V10RuntimeWorkspaceBlock[]>(
    () => [
      {
        id: 'artifact',
        title: 'Artifact',
        description:
          'Runtime artifacts, preflight validation, materialization and outputs handoff.',
        readiness: resolveReadiness(enabled.artifactPipeline),
        flags: ['ff.pipelines_artifact_mutation_pipeline'],
        sections: ['Artifact Pipeline'],
      },
      {
        id: 'agent',
        title: 'Agent',
        description:
          'Schedules, registry state, trigger surface and run timeline in one block host.',
        readiness: resolveReadiness(
          enabled.agentDefinition || enabled.agentPipeline,
          enabled.agentRegistry
        ),
        flags: [
          'ff.agent_schedule_definition',
          'ff.agent_schedule_registry',
          'ff.pipelines_agent_schedule_pipeline',
        ],
        sections: ['Agent Runtime'],
      },
      {
        id: 'onboarding',
        title: 'Onboarding',
        description: 'Persona capture, resume path and KPI summary surfaces.',
        readiness: resolveReadiness(enabled.onboarding),
        flags: ['ff.onboard_persona_capture'],
        sections: ['Onboarding Runtime'],
      },
      {
        id: 'reasoning',
        title: 'Reasoning',
        description: 'Fast-chat reasoning runner and the bridge to downstream runtimes.',
        readiness: resolveReadiness(enabled.reasoning),
        flags: ['ff.pipelines_reasoning_fast_chat_pipeline'],
        sections: ['Reasoning Runtime'],
      },
      {
        id: 'learning',
        title: 'Learning',
        description: 'Signal ingest plus stewardship, retention and quality loop surfaces.',
        readiness: resolveReadiness(enabled.learning, enabled.learningLoop),
        flags: ['ff.pipelines_learning_feedback_pipeline'],
        sections: ['Learning Runtime', 'Learning Loop'],
      },
      {
        id: 'research',
        title: 'Research',
        description: 'Mission planning, execution, watch delta and summary contract in one place.',
        readiness: resolveReadiness(enabled.research),
        flags: ['ff.pipelines_research_mission_pipeline', 'ff.research_telemetry'],
        sections: ['Research Runtime'],
      },
      {
        id: 'connectors',
        title: 'Connectors',
        description: 'Fetch runtime for external sources and integration readiness checks.',
        readiness: resolveReadiness(enabled.connectors),
        flags: ['ff.pipelines_connectors_ingest_pipeline'],
        sections: ['Connectors Runtime'],
      },
      {
        id: 'outcome',
        title: 'Outcome',
        description: 'KPI acceptance, outcome signals and business-effect linkage contracts.',
        readiness: resolveReadiness(enabled.outcome),
        flags: ['ff.pipelines_outcome_rollup_pipeline', 'ff.outcome_telemetry'],
        sections: ['Outcome Runtime'],
      },
    ],
    [enabled]
  );

  const workspaceBlockMap = useMemo(
    () =>
      Object.fromEntries(workspaceBlocks.map((block) => [block.id, block])) as Record<
        V10RuntimeWorkspaceBlock['id'],
        V10RuntimeWorkspaceBlock
      >,
    [workspaceBlocks]
  );

  const connectorsCatalog: ConnectorsCatalogResponse | null =
    connectorsRuntime.catalogQuery.data ?? null;
  const connectorsCatalogLoading =
    connectorsRuntime.catalogQuery.isLoading || connectorsRuntime.catalogQuery.isFetching;
  const connectorsCatalogError = connectorsRuntime.catalogQuery.error?.message ?? null;
  const connectorsSessions: ConnectorsSessionListResponse | null =
    connectorsRuntime.sessionsQuery.data ?? null;
  const connectorsSessionsLoading =
    connectorsRuntime.sessionsQuery.isLoading || connectorsRuntime.sessionsQuery.isFetching;
  const connectorsSessionsError = connectorsRuntime.sessionsQuery.error?.message ?? null;

  useEffect(() => {
    if (!enabled.connectors || !connectorsCatalog) return;
    emitConnectorsRegistryLoaded({
      source: 'admin_panel',
      total: connectorsCatalog.summary.total,
      available: connectorsCatalog.summary.available,
      planned: connectorsCatalog.summary.planned,
    });
  }, [connectorsCatalog, enabled.connectors]);

  const connectorSessionById = useMemo(() => {
    const entries = connectorsSessions?.sessions || [];
    return new Map(entries.map((session) => [session.connectorId, session]));
  }, [connectorsSessions]);

  const onboardingSnapshot = useMemo<OnboardingResumeSnapshot>(
    () => ({
      persona,
      personaConfidence: 'high',
      overrideHistory: [],
      connectorTarget: 'google_drive',
      connectorScopes: ['drive.readonly', 'userinfo.email'],
      uploadedFiles: onboardingId
        ? [
            {
              id: `${onboardingId}-source`,
              name: 'buyer-ledger.xlsx',
              hash: `hash-${persona.toLowerCase()}`,
              storedAt: new Date().toISOString(),
            },
          ]
        : [],
      currentDraft: `Draft memo for ${persona}`,
      approvalHistory: [],
      trustBanner: {
        viewedAt: new Date().toISOString(),
        acknowledged: true,
      },
      unresolvedValidationBlockers: [],
      currentStep: onboardingStep,
      deltaHint: null,
    }),
    [onboardingId, onboardingStep, persona]
  );

  const artifactPipelineBody = useMemo(() => {
    const now = new Date().toISOString();
    const artifactId = 'artifact_demo_001';
    const currentVersionId = 'version_demo_001';
    const proposalId = 'proposal_demo_001';

    return {
      command: artifactCommand,
      now,
      artifact: {
        id: artifactId,
        tenantId: 'tenant_demo',
        type: 'memo',
        ownerId: 'user_demo',
        permissionPolicyId: 'policy_demo',
        dataClassification: 'Internal',
        retentionPolicyId: 'retention_demo',
        reviewState: 'draft',
        currentVersionId,
        lineageRootId: null,
        parentArtifactId: null,
        derivedFromVersionId: null,
        createdAt: now,
        updatedAt: now,
        archivedAt: null,
        exportRecords: [],
        evidenceRefs: [],
        content: { title: 'Demo memo', blocks: [{ kind: 'paragraph', text: 'Hello artifact.' }] },
      },
      proposal: {
        id: proposalId,
        artifactId,
        declaredArtifactType: 'memo',
        baseVersionId: currentVersionId,
        intent: 'update_artifact',
        sourceSet: [],
        ops: [
          {
            kind: 'json_patch',
            path: '/title',
            before: 'Demo memo',
            after: 'Demo memo (updated)',
          },
        ],
        rationale: 'Demo pipeline run from Admin panel.',
        citations: [],
        trustBundleHash: 'trust_demo',
        reversibleTxnId: 'txn_demo',
        preview: {
          title: 'Demo memo (updated)',
          blocks: [{ kind: 'paragraph', text: 'Hello artifact.' }],
        },
        createdAt: now,
        proposedBy: 'actor_demo',
        approvalRequired: false,
        approvalMode: 'inline',
      },
      selectionContext: { artifactId, selection: { kind: 'empty' } },
      selectedOpIndices: [0],
      reviewEvent: 'submit_for_review',
    };
  }, [artifactCommand]);

  const latestRunId = useMemo(() => {
    if (!artifactRunResult || !artifactRunResult.ok) return null;
    const data = unwrapData(artifactRunResult.payload);
    const runId = typeof data?.runId === 'string' ? data.runId : null;
    return runId && runId.trim() ? runId.trim() : null;
  }, [artifactRunResult]);

  return (
    <V10RuntimeWorkspace blocks={workspaceBlocks}>
      <V10RuntimeWorkspaceBlock block={workspaceBlockMap.artifact} className="order-1">
        <SectionShell title="Artifact Pipeline" enabled={enabled.artifactPipeline}>
          <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Command</label>
          <textarea
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-black/20 dark:text-white"
            rows={3}
            value={artifactCommand}
            onChange={(e) => setArtifactCommand(e.target.value)}
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              className={cn(
                'px-3 py-2 rounded-xl text-sm font-medium',
                enabled.artifactPipeline
                  ? 'bg-violet-600 hover:bg-violet-700 text-white'
                  : 'bg-slate-200 text-slate-500 dark:bg-white/10 dark:text-slate-400 cursor-not-allowed'
              )}
              disabled={!enabled.artifactPipeline}
              onClick={async () =>
                setArtifactPreflightResult(
                  await postJson('/api/v10/artifact-pipeline/preflight', artifactPipelineBody)
                )
              }
            >
              Preflight
            </button>
            <button
              className={cn(
                'px-3 py-2 rounded-xl text-sm font-medium',
                enabled.artifactPipeline
                  ? 'bg-violet-600 hover:bg-violet-700 text-white'
                  : 'bg-slate-200 text-slate-500 dark:bg-white/10 dark:text-slate-400 cursor-not-allowed'
              )}
              disabled={!enabled.artifactPipeline}
              onClick={async () =>
                setArtifactRunResult(
                  await postJson('/api/v10/artifact-pipeline/run', {
                    ...artifactPipelineBody,
                    materialize: true,
                  })
                )
              }
            >
              Run + materialize (preview)
            </button>
            <button
              className={cn(
                'px-3 py-2 rounded-xl text-sm font-medium',
                enabled.artifactPipeline && latestRunId
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-slate-200 text-slate-500 dark:bg-white/10 dark:text-slate-400 cursor-not-allowed'
              )}
              disabled={!enabled.artifactPipeline || !latestRunId}
              onClick={async () => {
                if (!latestRunId) return;
                try {
                  const res = await fetchWithRetry(
                    `/api/v10/artifact-pipeline/runs/${encodeURIComponent(latestRunId)}/publish`,
                    { method: 'POST', body: JSON.stringify({}) }
                  );
                  const payload = await handleResponse(res, 'Request failed');
                  setArtifactPublishResult({ ok: true, payload });
                } catch (err) {
                  setArtifactPublishResult({
                    ok: false,
                    error: err instanceof Error ? err.message : String(err),
                  });
                }
              }}
            >
              Publish to Outputs Library
            </button>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto]">
            <input
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-black/20 dark:text-white"
              placeholder="Run ID (paste from run response) to load"
              value={artifactLoadRunId}
              onChange={(e) => setArtifactLoadRunId(e.target.value)}
            />
            <button
              className={cn(
                'px-3 py-2 rounded-xl text-sm font-medium',
                enabled.artifactPipeline && artifactLoadRunId.trim()
                  ? 'bg-slate-900 hover:bg-slate-800 text-white dark:bg-white/20 dark:hover:bg-white/25'
                  : 'bg-slate-200 text-slate-500 dark:bg-white/10 dark:text-slate-400 cursor-not-allowed'
              )}
              disabled={!enabled.artifactPipeline || !artifactLoadRunId.trim()}
              onClick={async () => {
                try {
                  const res = await fetchWithRetry(
                    `/api/v10/artifact-pipeline/runs/${encodeURIComponent(artifactLoadRunId.trim())}`,
                    {
                      method: 'GET',
                    }
                  );
                  const payload = await handleResponse(res, 'Request failed');
                  setArtifactLoadResult({ ok: true, payload });
                } catch (err) {
                  setArtifactLoadResult({
                    ok: false,
                    error: err instanceof Error ? err.message : String(err),
                  });
                }
              }}
            >
              Load run
            </button>
          </div>
          <ArtifactPipelineTimeline result={artifactRunResult} />
          <ArtifactPipelinePreflightChecks result={artifactPreflightResult} />
          <ResultBox result={artifactPreflightResult} />
          <ResultBox result={artifactRunResult} />
          <ResultBox result={artifactLoadResult} />
          <ResultBox result={artifactPublishResult} />
        </SectionShell>
      </V10RuntimeWorkspaceBlock>

      <V10RuntimeWorkspaceBlock block={workspaceBlockMap.agent} className="order-2">
        <SectionShell title="Agent Runtime" enabled={enabled.agent}>
          <AgentSchedulePanel />
        </SectionShell>
      </V10RuntimeWorkspaceBlock>

      <V10RuntimeWorkspaceBlock block={workspaceBlockMap.learning} className="order-5">
        <SectionShell title="Learning Loop" enabled={enabled.learningLoop}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Feedback submission
              </div>
              <label className="text-xs text-slate-500 dark:text-slate-400">Rating (1-5)</label>
              <input
                type="number"
                min={1}
                max={5}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-black/20 dark:text-white"
                value={learningFeedbackRating}
                onChange={(e) =>
                  setLearningFeedbackRating(Math.max(1, Math.min(5, Number(e.target.value) || 1)))
                }
              />
              <label className="text-xs text-slate-500 dark:text-slate-400">Comment</label>
              <textarea
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-black/20 dark:text-white"
                rows={3}
                value={learningFeedbackComment}
                onChange={(e) => setLearningFeedbackComment(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  className={cn(
                    'px-3 py-2 rounded-xl text-sm font-medium',
                    enabled.learningLoop
                      ? 'bg-violet-600 hover:bg-violet-700 text-white'
                      : 'bg-slate-200 text-slate-500 dark:bg-white/10 dark:text-slate-400 cursor-not-allowed'
                  )}
                  disabled={!enabled.learningLoop}
                  onClick={async () => {
                    const result = await postJson('/api/v10/learning-loop/feedback/submit', {
                      rating: learningFeedbackRating,
                      comment: learningFeedbackComment,
                      targetType: 'chat',
                      tags: ['admin_panel'],
                    });
                    setLearningFeedbackResult(result);
                    if (result.ok) {
                      const data = unwrapV10Data(result.payload);
                      emitLearningLoopFeedbackSubmitted({
                        source: 'admin_panel',
                        rating: Math.max(1, Math.min(5, learningFeedbackRating)) as
                          | 1
                          | 2
                          | 3
                          | 4
                          | 5,
                        targetType: 'chat',
                        queuedForStewardship: Boolean(data?.queuedForStewardship),
                      });
                    }
                  }}
                >
                  Submit feedback
                </button>
                <button
                  className={cn(
                    'px-3 py-2 rounded-xl text-sm font-medium',
                    enabled.learningLoop
                      ? 'bg-slate-900 hover:bg-slate-800 text-white dark:bg-white/20 dark:hover:bg-white/25'
                      : 'bg-slate-200 text-slate-500 dark:bg-white/10 dark:text-slate-400 cursor-not-allowed'
                  )}
                  disabled={!enabled.learningLoop}
                  onClick={async () => {
                    const result = await (async () => {
                      try {
                        const res = await fetchWithRetry(
                          '/api/v10/learning-loop/stewardship/queue',
                          {
                            method: 'GET',
                          }
                        );
                        const payload = await handleResponse(res, 'Request failed');
                        return { ok: true as const, payload };
                      } catch (err) {
                        return {
                          ok: false as const,
                          error: err instanceof Error ? err.message : String(err),
                        };
                      }
                    })();
                    setLearningQueueResult(result);
                    if (result.ok) {
                      const data = unwrapV10Data(result.payload);
                      emitLearningLoopStewardshipLoaded({
                        source: 'admin_panel',
                        itemsCountBucket: bucketItemsCount(
                          Array.isArray(data?.items) ? data.items.length : 0
                        ),
                      });
                    }
                  }}
                >
                  Load stewardship queue
                </button>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-500 dark:text-slate-400">Resolve note</label>
                <input
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-black/20 dark:text-white"
                  value={learningStewardNote}
                  onChange={(e) => setLearningStewardNote(e.target.value)}
                />
              </div>
              <ResultBox result={learningFeedbackResult} />
              <LearningStewardshipQueue
                result={learningQueueResult}
                onResolve={async (itemId) => {
                  const res = await postJson(
                    `/api/v10/learning-loop/stewardship/${encodeURIComponent(itemId)}/resolve`,
                    { note: learningStewardNote }
                  );
                  setLearningResolveResult(res);
                  if (res.ok) {
                    emitLearningLoopStewardshipResolved({ source: 'admin_panel' });
                  }
                  // Refresh queue (best-effort)
                  try {
                    const q = await (async () => {
                      const r = await fetchWithRetry('/api/v10/learning-loop/stewardship/queue', {
                        method: 'GET',
                      });
                      const payload = await handleResponse(r, 'Request failed');
                      return { ok: true as const, payload };
                    })();
                    setLearningQueueResult(q);
                  } catch {
                    // ignore
                  }
                }}
              />
              <ResultBox result={learningResolveResult} />
            </div>

            <div className="space-y-2">
              <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Retention preview
              </div>
              <textarea
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-black/20 dark:text-white"
                rows={4}
                value={learningRetentionText}
                onChange={(e) => setLearningRetentionText(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  className={cn(
                    'px-3 py-2 rounded-xl text-sm font-medium',
                    enabled.learningLoop
                      ? 'bg-violet-600 hover:bg-violet-700 text-white'
                      : 'bg-slate-200 text-slate-500 dark:bg-white/10 dark:text-slate-400 cursor-not-allowed'
                  )}
                  disabled={!enabled.learningLoop}
                  onClick={async () => {
                    const result = await postJson('/api/v10/learning-loop/retention/preview', {
                      text: learningRetentionText,
                      contextHint: 'admin_panel',
                    });
                    setLearningRetentionResult(result);
                    if (result.ok) {
                      const data = unwrapV10Data(result.payload);
                      emitLearningLoopRetentionPreviewed({
                        source: 'admin_panel',
                        decision: data?.retain ? 'retain' : 'deny',
                      });
                    }
                  }}
                >
                  Preview retention
                </button>
                <button
                  className={cn(
                    'px-3 py-2 rounded-xl text-sm font-medium',
                    enabled.learningLoop
                      ? 'bg-slate-900 hover:bg-slate-800 text-white dark:bg-white/20 dark:hover:bg-white/25'
                      : 'bg-slate-200 text-slate-500 dark:bg-white/10 dark:text-slate-400 cursor-not-allowed'
                  )}
                  disabled={!enabled.learningLoop}
                  onClick={async () =>
                    setLearningDashboardResult(
                      await (async () => {
                        try {
                          const res = await fetchWithRetry(
                            '/api/v10/learning-loop/quality/dashboard',
                            { method: 'GET' }
                          );
                          const payload = await handleResponse(res, 'Request failed');
                          emitLearningLoopDashboardLoaded({ source: 'admin_panel' });
                          return { ok: true as const, payload };
                        } catch (err) {
                          return {
                            ok: false as const,
                            error: err instanceof Error ? err.message : String(err),
                          };
                        }
                      })()
                    )
                  }
                >
                  Load dashboard
                </button>
              </div>
              <ResultBox result={learningRetentionResult} />
              <ResultBox result={learningDashboardResult} />
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Drift / incidents
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <select
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-black/20 dark:text-white"
                  value={learningIncidentKind}
                  onChange={(e) => setLearningIncidentKind(e.target.value as any)}
                >
                  <option value="drift">drift</option>
                  <option value="incident">incident</option>
                </select>
                <select
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-black/20 dark:text-white"
                  value={learningIncidentSeverity}
                  onChange={(e) => setLearningIncidentSeverity(e.target.value as any)}
                >
                  <option value="low">low</option>
                  <option value="medium">medium</option>
                  <option value="high">high</option>
                </select>
              </div>
              <input
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-black/20 dark:text-white"
                value={learningIncidentSummary}
                onChange={(e) => setLearningIncidentSummary(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  className={cn(
                    'px-3 py-2 rounded-xl text-sm font-medium',
                    enabled.learningLoop
                      ? 'bg-rose-600 hover:bg-rose-700 text-white'
                      : 'bg-slate-200 text-slate-500 dark:bg-white/10 dark:text-slate-400 cursor-not-allowed'
                  )}
                  disabled={!enabled.learningLoop}
                  onClick={async () => {
                    const result = await postJson('/api/v10/learning-loop/incidents/report', {
                      kind: learningIncidentKind,
                      severity: learningIncidentSeverity,
                      summary: learningIncidentSummary,
                      tags: ['admin_panel'],
                    });
                    setLearningIncidentResult(result);
                    if (result.ok) {
                      emitLearningLoopIncidentReported({
                        source: 'admin_panel',
                        kind: learningIncidentKind,
                        severity: learningIncidentSeverity,
                      });
                    }
                  }}
                >
                  Report
                </button>
                <button
                  className={cn(
                    'px-3 py-2 rounded-xl text-sm font-medium',
                    enabled.learningLoop
                      ? 'bg-slate-900 hover:bg-slate-800 text-white dark:bg-white/20 dark:hover:bg-white/25'
                      : 'bg-slate-200 text-slate-500 dark:bg-white/10 dark:text-slate-400 cursor-not-allowed'
                  )}
                  disabled={!enabled.learningLoop}
                  onClick={async () => {
                    try {
                      const res = await fetchWithRetry('/api/v10/learning-loop/incidents', {
                        method: 'GET',
                      });
                      const payload = await handleResponse(res, 'Request failed');
                      setLearningIncidentResult({ ok: true, payload });
                    } catch (err) {
                      setLearningIncidentResult({
                        ok: false,
                        error: err instanceof Error ? err.message : String(err),
                      });
                    }
                  }}
                >
                  Load incidents
                </button>
                <button
                  className={cn(
                    'px-3 py-2 rounded-xl text-sm font-medium',
                    enabled.learningLoop
                      ? 'bg-slate-900 hover:bg-slate-800 text-white dark:bg-white/20 dark:hover:bg-white/25'
                      : 'bg-slate-200 text-slate-500 dark:bg-white/10 dark:text-slate-400 cursor-not-allowed'
                  )}
                  disabled={!enabled.learningLoop}
                  onClick={async () => {
                    try {
                      const res = await fetchWithRetry('/api/v10/learning-loop/coverage/summary', {
                        method: 'GET',
                      });
                      const payload = await handleResponse(res, 'Request failed');
                      setLearningDashboardResult({ ok: true, payload });
                    } catch (err) {
                      setLearningDashboardResult({
                        ok: false,
                        error: err instanceof Error ? err.message : String(err),
                      });
                    }
                  }}
                >
                  Coverage summary
                </button>
              </div>
              <ResultBox result={learningIncidentResult} />
              <ResultBox result={learningQueueResult} />
            </div>
          </div>
        </SectionShell>
        <SectionShell title="Learning Runtime" enabled={enabled.learning}>
          <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Signal</label>
          <input
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-black/20 dark:text-white"
            value={learningSignal}
            onChange={(e) => setLearningSignal(e.target.value)}
          />
          <div className="mt-3 flex items-center gap-2">
            <button
              className={cn(
                'px-3 py-2 rounded-xl text-sm font-medium',
                enabled.learning
                  ? 'bg-violet-600 hover:bg-violet-700 text-white'
                  : 'bg-slate-200 text-slate-500 dark:bg-white/10 dark:text-slate-400 cursor-not-allowed'
              )}
              disabled={!enabled.learning}
              onClick={async () =>
                setLearningResult(
                  await postJsonInstrumented({
                    path: '/api/v10/learning-runtime/ingest',
                    body: { signal: learningSignal },
                    enabled: enabled.learning,
                    emitStarted: () => emitLearningRuntimeStarted({ source: 'admin_panel' }),
                    emitSucceeded: ({ latencyMs, httpStatus }) =>
                      emitLearningRuntimeSucceeded({
                        source: 'admin_panel',
                        latencyBucketMs: bucketLatencyMs(latencyMs),
                        httpStatusBucket: bucketHttpStatus(httpStatus),
                      }),
                    emitFailed: ({ latencyMs, httpStatus, error }) =>
                      emitLearningRuntimeFailed({
                        source: 'admin_panel',
                        latencyBucketMs: bucketLatencyMs(latencyMs),
                        httpStatusBucket: bucketHttpStatus(httpStatus),
                        reason: inferFailReason({ enabled: enabled.learning, httpStatus, error }),
                      }),
                  })
                )
              }
            >
              Run
            </button>
          </div>
          <ResultBox result={learningResult} />
        </SectionShell>
      </V10RuntimeWorkspaceBlock>

      <V10RuntimeWorkspaceBlock block={workspaceBlockMap.reasoning} className="order-4">
        <SectionShell title="Reasoning Runtime" enabled={enabled.reasoning}>
          <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
            {t('aiChat.prompt', 'Prompt')}
          </label>
          <textarea
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-black/20 dark:text-white"
            rows={3}
            value={reasoningPrompt}
            onChange={(e) => setReasoningPrompt(e.target.value)}
          />
          <div className="mt-3 flex items-center gap-2">
            <button
              className={cn(
                'px-3 py-2 rounded-xl text-sm font-medium',
                enabled.reasoning
                  ? 'bg-violet-600 hover:bg-violet-700 text-white'
                  : 'bg-slate-200 text-slate-500 dark:bg-white/10 dark:text-slate-400 cursor-not-allowed'
              )}
              disabled={!enabled.reasoning}
              onClick={async () =>
                setReasoningResult(
                  await postJsonInstrumented({
                    path: '/api/v10/reasoning-runtime/fast-chat',
                    body: { prompt: reasoningPrompt },
                    enabled: enabled.reasoning,
                    emitStarted: () => emitReasoningRuntimeStarted({ source: 'admin_panel' }),
                    emitSucceeded: ({ latencyMs, httpStatus }) =>
                      emitReasoningRuntimeSucceeded({
                        source: 'admin_panel',
                        latencyBucketMs: bucketLatencyMs(latencyMs),
                        httpStatusBucket: bucketHttpStatus(httpStatus),
                      }),
                    emitFailed: ({ latencyMs, httpStatus, error }) =>
                      emitReasoningRuntimeFailed({
                        source: 'admin_panel',
                        latencyBucketMs: bucketLatencyMs(latencyMs),
                        httpStatusBucket: bucketHttpStatus(httpStatus),
                        reason: inferFailReason({ enabled: enabled.reasoning, httpStatus, error }),
                      }),
                  })
                )
              }
            >
              Run
            </button>
          </div>
          <ResultBox result={reasoningResult} />
        </SectionShell>
      </V10RuntimeWorkspaceBlock>

      <V10RuntimeWorkspaceBlock block={workspaceBlockMap.research} className="order-6">
        <SectionShell title="Research Runtime" enabled={enabled.research}>
          <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Query</label>
          <input
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-black/20 dark:text-white"
            value={researchQuery}
            onChange={(e) => setResearchQuery(e.target.value)}
          />
          <div className="mt-3 flex items-center gap-2">
            <button
              className={cn(
                'px-3 py-2 rounded-xl text-sm font-medium',
                researchRuntime.capabilities.planMission
                  ? 'bg-slate-900 hover:bg-slate-800 text-white dark:bg-white/20 dark:hover:bg-white/25'
                  : 'bg-slate-200 text-slate-500 dark:bg-white/10 dark:text-slate-400 cursor-not-allowed'
              )}
              disabled={!researchRuntime.capabilities.planMission || researchRuntime.isWorking}
              onClick={async () => {
                try {
                  const payload = await researchRuntime.planMission({
                    query: researchQuery,
                    depth: 'standard',
                    maxSources: 8,
                  });
                  setResearchMissionId(payload.missionId);
                  setResearchCursor(0);
                  setResearchPlanResult({ ok: true, payload: { data: payload } });
                  emitResearchMissionPlanned({
                    source: 'admin_panel',
                    depth: 'standard',
                    maxSourcesBucket: bucketMaxSources(8),
                  });
                } catch (err) {
                  setResearchPlanResult({
                    ok: false,
                    error: err instanceof Error ? err.message : String(err),
                  });
                }
              }}
            >
              {researchRuntime.planMissionMutation.isPending ? 'Planning...' : 'Plan'}
            </button>
            <button
              className={cn(
                'px-3 py-2 rounded-xl text-sm font-medium',
                researchRuntime.capabilities.startMission
                  ? 'bg-violet-600 hover:bg-violet-700 text-white'
                  : 'bg-slate-200 text-slate-500 dark:bg-white/10 dark:text-slate-400 cursor-not-allowed'
              )}
              disabled={!researchRuntime.capabilities.startMission || researchRuntime.isWorking}
              onClick={async () => {
                const startedAt =
                  typeof performance !== 'undefined' ? performance.now() : Date.now();
                emitResearchRuntimeStarted({ source: 'admin_panel' });
                try {
                  const payload = await researchRuntime.startMission({
                    missionId: researchMissionId.trim() || undefined,
                    query: researchQuery,
                  });
                  setResearchMissionId(payload.missionId);
                  setResearchResult({ ok: true, payload: { data: payload } });
                  const endedAt =
                    typeof performance !== 'undefined' ? performance.now() : Date.now();
                  emitResearchRuntimeSucceeded({
                    source: 'admin_panel',
                    latencyBucketMs: bucketLatencyMs(Math.max(0, Math.round(endedAt - startedAt))),
                    httpStatusBucket: '2xx',
                  });
                } catch (error) {
                  setResearchResult({
                    ok: false,
                    error: error instanceof Error ? error.message : String(error),
                  });
                  const endedAt =
                    typeof performance !== 'undefined' ? performance.now() : Date.now();
                  const httpStatus =
                    typeof (error as any)?.status === 'number'
                      ? Number((error as any).status)
                      : null;
                  emitResearchRuntimeFailed({
                    source: 'admin_panel',
                    latencyBucketMs: bucketLatencyMs(Math.max(0, Math.round(endedAt - startedAt))),
                    httpStatusBucket: bucketHttpStatus(httpStatus),
                    reason: inferFailReason({
                      enabled: enabled.research,
                      httpStatus,
                      error,
                    }),
                  });
                }
              }}
            >
              {researchRuntime.startMissionMutation.isPending ? 'Running...' : 'Run'}
            </button>
            <button
              className={cn(
                'px-3 py-2 rounded-xl text-sm font-medium',
                researchRuntime.capabilities.watchMission && researchMissionId.trim()
                  ? 'bg-slate-900 hover:bg-slate-800 text-white dark:bg-white/20 dark:hover:bg-white/25'
                  : 'bg-slate-200 text-slate-500 dark:bg-white/10 dark:text-slate-400 cursor-not-allowed'
              )}
              disabled={
                !researchRuntime.capabilities.watchMission ||
                !researchMissionId.trim() ||
                researchRuntime.isWorking
              }
              onClick={async () => {
                try {
                  const payload = await researchRuntime.watchMission({
                    missionId: researchMissionId.trim(),
                    cursor: researchCursor,
                  });
                  setResearchCursor(payload.nextCursor);
                  setResearchWatchResult({ ok: true, payload: { data: payload } });
                  emitResearchMissionWatchedDelta({
                    source: 'admin_panel',
                    eventsCountBucket: bucketEventsCount(payload.events?.length ?? 0),
                    completed: Boolean(payload.completed),
                  });
                } catch (err) {
                  setResearchWatchResult({
                    ok: false,
                    error: err instanceof Error ? err.message : String(err),
                  });
                }
              }}
            >
              {researchRuntime.watchMissionMutation.isPending ? 'Watching...' : 'Watch Δ'}
            </button>
            <button
              className={cn(
                'px-3 py-2 rounded-xl text-sm font-medium',
                researchRuntime.capabilities.summary && researchMissionId.trim()
                  ? 'bg-slate-900 hover:bg-slate-800 text-white dark:bg-white/20 dark:hover:bg-white/25'
                  : 'bg-slate-200 text-slate-500 dark:bg-white/10 dark:text-slate-400 cursor-not-allowed'
              )}
              disabled={
                !researchRuntime.capabilities.summary ||
                !researchMissionId.trim() ||
                researchRuntime.isWorking
              }
              onClick={async () => {
                try {
                  const payload = await researchRuntime.getSummary({
                    missionId: researchMissionId.trim(),
                  });
                  setResearchSummaryResult({ ok: true, payload: { data: payload } });
                  emitResearchMissionSummaryLoaded({
                    source: 'admin_panel',
                    status: payload.status,
                  });
                } catch (err) {
                  setResearchSummaryResult({
                    ok: false,
                    error: err instanceof Error ? err.message : String(err),
                  });
                }
              }}
            >
              {researchRuntime.summaryMutation.isPending ? 'Loading...' : 'Summary'}
            </button>
            <button
              className={cn(
                'px-3 py-2 rounded-xl text-sm font-medium',
                researchRuntime.capabilities.delegatePlan
                  ? 'bg-slate-900 hover:bg-slate-800 text-white dark:bg-white/20 dark:hover:bg-white/25'
                  : 'bg-slate-200 text-slate-500 dark:bg-white/10 dark:text-slate-400 cursor-not-allowed'
              )}
              disabled={!researchRuntime.capabilities.delegatePlan || researchRuntime.isWorking}
              onClick={async () => {
                try {
                  const payload = await researchRuntime.delegatePlanFromReasoning({
                    query: researchQuery,
                    depth: 'standard',
                    maxSources: 8,
                  });
                  setResearchDelegatePlanResult({ ok: true, payload: { data: payload } });
                  emitReasoningDelegatedResearchPlan({ source: 'admin_panel', depth: 'standard' });
                } catch (err) {
                  setResearchDelegatePlanResult({
                    ok: false,
                    error: err instanceof Error ? err.message : String(err),
                  });
                }
              }}
            >
              {researchRuntime.delegatePlanMutation.isPending
                ? 'Delegating...'
                : 'Delegate plan (Reasoning→Research)'}
            </button>
          </div>
          {researchMissionId ? (
            <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              missionId: {researchMissionId}
            </div>
          ) : null}
          <ResultBox result={researchPlanResult} />
          <ResultBox result={researchResult} />
          <ResultBox result={researchWatchResult} />
          <ResultBox result={researchSummaryResult} />
          <ResultBox result={researchDelegatePlanResult} />
        </SectionShell>
      </V10RuntimeWorkspaceBlock>

      <V10RuntimeWorkspaceBlock block={workspaceBlockMap.connectors} className="order-7">
        <SectionShell title="Connectors Runtime" enabled={enabled.connectors}>
          <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 dark:border-white/10 dark:bg-black/20 dark:text-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-semibold">Connector registry</div>
                <div className="text-slate-500 dark:text-slate-400">
                  Catalog shared by onboarding, runtime routing, and future auth/session flows.
                </div>
              </div>
              <div className="flex items-center gap-2">
                <select
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-white/10 dark:bg-black/20 dark:text-white"
                  value={connectorsPersona}
                  onChange={(e) => setConnectorsPersona(e.target.value)}
                >
                  {CONNECTOR_PERSONA_OPTIONS.map((option) => (
                    <option key={option || 'all'} value={option}>
                      {option || 'All personas'}
                    </option>
                  ))}
                </select>
                <button
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium dark:border-white/10 dark:bg-white/5 dark:text-white"
                  disabled={!connectorsRuntime.capabilities.catalog || connectorsRuntime.isFetching}
                  onClick={() => {
                    void connectorsRuntime.refetchCatalog();
                    void connectorsRuntime.refetchSessions();
                  }}
                >
                  {connectorsRuntime.isFetching ? 'Refreshing...' : 'Refresh catalog'}
                </button>
              </div>
            </div>

            {connectorsCatalog ? (
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-slate-200 bg-white px-2 py-1 dark:border-white/10 dark:bg-white/5">
                  total: {connectorsCatalog.summary.total}
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-2 py-1 dark:border-white/10 dark:bg-white/5">
                  available: {connectorsCatalog.summary.available}
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-2 py-1 dark:border-white/10 dark:bg-white/5">
                  planned: {connectorsCatalog.summary.planned}
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-2 py-1 dark:border-white/10 dark:bg-white/5">
                  external: {connectorsCatalog.summary.external}
                </span>
                {connectorsSessions ? (
                  <span className="rounded-full border border-slate-200 bg-white px-2 py-1 dark:border-white/10 dark:bg-white/5">
                    connected sessions: {connectorsSessions.summary.connected}
                  </span>
                ) : null}
              </div>
            ) : null}

            {connectorsCatalogLoading ? (
              <div className="text-slate-500 dark:text-slate-400">Loading connector catalog...</div>
            ) : null}
            {connectorsCatalogError ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-rose-800 dark:border-rose-900/40 dark:bg-rose-900/15 dark:text-rose-200">
                {connectorsCatalogError}
              </div>
            ) : null}
            {connectorsSessionsLoading ? (
              <div className="text-slate-500 dark:text-slate-400">
                Loading connector sessions...
              </div>
            ) : null}
            {connectorsSessionsError ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-rose-800 dark:border-rose-900/40 dark:bg-rose-900/15 dark:text-rose-200">
                {connectorsSessionsError}
              </div>
            ) : null}

            {connectorsCatalog?.connectors?.length ? (
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {connectorsCatalog.connectors.slice(0, 6).map((connector) => {
                  const session = connectorSessionById.get(connector.id) || null;
                  const isBusy =
                    connectorsActionConnectorId === connector.id || connectorsRuntime.isWorking;
                  const requiresAuth = !['manual_upload', 'none'].includes(connector.authStrategy);
                  return (
                    <div
                      key={connector.id}
                      className="rounded-xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-white/5"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {connector.name}
                        </div>
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[11px] font-medium',
                            connector.availability === 'available'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200'
                          )}
                        >
                          {connector.availability}
                        </span>
                        {connector.recommended ? (
                          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-medium text-violet-800 dark:bg-violet-900/30 dark:text-violet-200">
                            recommended
                          </span>
                        ) : null}
                        {session ? (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-800 dark:bg-white/10 dark:text-slate-200">
                            session: {session.status}
                          </span>
                        ) : null}
                        {session ? (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-800 dark:bg-white/10 dark:text-slate-200">
                            token: {session.tokenStatus}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 text-slate-500 dark:text-slate-400">
                        {connector.description}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 dark:border-white/10 dark:bg-black/20">
                          {connector.kind}
                        </span>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 dark:border-white/10 dark:bg-black/20">
                          {connector.authStrategy}
                        </span>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 dark:border-white/10 dark:bg-black/20">
                          {connector.wave}
                        </span>
                      </div>
                      <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                        capabilities: {connector.capabilities.join(', ')}
                      </div>
                      {session?.tokenExpiresAt ? (
                        <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                          token expires: {session.tokenExpiresAt}
                        </div>
                      ) : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          className={cn(
                            'rounded-xl px-3 py-2 text-xs font-medium',
                            session?.status === 'connected'
                              ? 'bg-slate-200 text-slate-500 dark:bg-white/10 dark:text-slate-400 cursor-not-allowed'
                              : 'bg-violet-600 text-white hover:bg-violet-700'
                          )}
                          disabled={isBusy || session?.status === 'connected'}
                          onClick={async () => {
                            setConnectorsActionConnectorId(connector.id);
                            const requestedScopes =
                              connector.readScopes.length > 0
                                ? [...connector.readScopes]
                                : undefined;
                            try {
                              const payload = await connectorsRuntime.connect({
                                connectorId: connector.id,
                                requiresAuth,
                                requestedScopes,
                              });
                              setConnectorsResult({ ok: true, payload });
                              if (requiresAuth) {
                                emitConnectorAuthStarted({
                                  source: 'admin_panel',
                                  connectorId: connector.id,
                                });
                              } else {
                                emitConnectorSessionConnected({
                                  source: 'admin_panel',
                                  connectorId: connector.id,
                                  status: 'connected',
                                });
                              }
                            } catch (error) {
                              setConnectorsResult({
                                ok: false,
                                error: error instanceof Error ? error.message : String(error),
                              });
                            } finally {
                              setConnectorsActionConnectorId(null);
                            }
                          }}
                        >
                          {isBusy ? 'Working...' : requiresAuth ? 'Start auth' : 'Connect'}
                        </button>
                        {requiresAuth ? (
                          <button
                            className={cn(
                              'rounded-xl px-3 py-2 text-xs font-medium',
                              session?.status === 'pending'
                                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                : 'bg-slate-200 text-slate-500 dark:bg-white/10 dark:text-slate-400 cursor-not-allowed'
                            )}
                            disabled={isBusy || session?.status !== 'pending'}
                            onClick={async () => {
                              setConnectorsActionConnectorId(connector.id);
                              try {
                                const payload = await connectorsRuntime.completeAuth({
                                  connectorId: connector.id,
                                  result: 'authorized',
                                  authorizationCode: 'admin-panel-stub-code',
                                });
                                setConnectorsResult({ ok: true, payload });
                                emitConnectorAuthCompleted({
                                  source: 'admin_panel',
                                  connectorId: connector.id,
                                  status: 'completed',
                                });
                              } catch (error) {
                                setConnectorsResult({
                                  ok: false,
                                  error: error instanceof Error ? error.message : String(error),
                                });
                              } finally {
                                setConnectorsActionConnectorId(null);
                              }
                            }}
                          >
                            Complete auth
                          </button>
                        ) : null}
                        <button
                          className={cn(
                            'rounded-xl px-3 py-2 text-xs font-medium',
                            session?.tokenStatus === 'stored'
                              ? 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 dark:bg-white/5 dark:border-white/10 dark:text-white'
                              : 'bg-slate-200 text-slate-500 dark:bg-white/10 dark:text-slate-400 cursor-not-allowed'
                          )}
                          disabled={isBusy || !session || session.tokenStatus !== 'stored'}
                          onClick={async () => {
                            setConnectorsActionConnectorId(connector.id);
                            try {
                              const payload = await connectorsRuntime.refreshTokens({
                                connectorId: connector.id,
                                reason: 'admin_panel_refresh',
                              });
                              setConnectorsResult({ ok: true, payload });
                              emitConnectorTokenRefreshed({
                                source: 'admin_panel',
                                connectorId: connector.id,
                                status:
                                  payload.tokenStatus === 'revoked' ? 'disconnected' : 'stored',
                              });
                            } catch (error) {
                              setConnectorsResult({
                                ok: false,
                                error: error instanceof Error ? error.message : String(error),
                              });
                            } finally {
                              setConnectorsActionConnectorId(null);
                            }
                          }}
                        >
                          Refresh token
                        </button>
                        <button
                          className={cn(
                            'rounded-xl px-3 py-2 text-xs font-medium',
                            session
                              ? 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 dark:bg-white/5 dark:border-white/10 dark:text-white'
                              : 'bg-slate-200 text-slate-500 dark:bg-white/10 dark:text-slate-400 cursor-not-allowed'
                          )}
                          disabled={isBusy || !session || session.status === 'disconnected'}
                          onClick={async () => {
                            setConnectorsActionConnectorId(connector.id);
                            try {
                              const payload = await connectorsRuntime.disconnect({
                                connectorId: connector.id,
                                reason: 'admin_panel_disconnect',
                              });
                              setConnectorsResult({ ok: true, payload });
                              emitConnectorSessionDisconnected({
                                source: 'admin_panel',
                                connectorId: connector.id,
                              });
                            } catch (error) {
                              setConnectorsResult({
                                ok: false,
                                error: error instanceof Error ? error.message : String(error),
                              });
                            } finally {
                              setConnectorsActionConnectorId(null);
                            }
                          }}
                        >
                          Disconnect
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-black/20">
            <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Federated source search
            </div>
            <input
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-black/20 dark:text-white"
              value={connectorsSearchQuery}
              onChange={(e) => setConnectorsSearchQuery(e.target.value)}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                className={cn(
                  'px-3 py-2 rounded-xl text-sm font-medium',
                  connectorsRuntime.capabilities.search
                    ? 'bg-violet-600 hover:bg-violet-700 text-white'
                    : 'bg-slate-200 text-slate-500 dark:bg-white/10 dark:text-slate-400 cursor-not-allowed'
                )}
                disabled={!connectorsRuntime.capabilities.search || connectorsRuntime.isWorking}
                onClick={async () => {
                  try {
                    const payload = await connectorsRuntime.search({
                      query: connectorsSearchQuery,
                      limit: 6,
                    });
                    setConnectorsSearchResult({ ok: true, payload });
                    emitConnectorSourceSearched({
                      source: 'admin_panel',
                      connectorCount: payload.diagnostics.length,
                      sourceCount: payload.sources.length,
                    });
                  } catch (error) {
                    setConnectorsSearchResult({
                      ok: false,
                      error: error instanceof Error ? error.message : String(error),
                    });
                  }
                }}
              >
                {connectorsRuntime.searchMutation.isPending ? 'Searching...' : 'Search sources'}
              </button>
              <button
                className={cn(
                  'px-3 py-2 rounded-xl text-sm font-medium',
                  connectorsSearchResult?.ok
                    ? 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 dark:bg-white/5 dark:border-white/10 dark:text-white'
                    : 'bg-slate-200 text-slate-500 dark:bg-white/10 dark:text-slate-400 cursor-not-allowed'
                )}
                disabled={
                  !connectorsRuntime.capabilities.readSource ||
                  !connectorsSearchResult ||
                  !connectorsSearchResult.ok ||
                  connectorsRuntime.isWorking
                }
                onClick={async () => {
                  const payload = (
                    connectorsSearchResult && connectorsSearchResult.ok
                      ? (connectorsSearchResult.payload as any)
                      : null
                  ) as any;
                  const firstSource = payload?.sources?.[0];
                  if (!firstSource?.connectorId || !firstSource?.sourceId) return;
                  try {
                    const readPayload = await connectorsRuntime.readSource({
                      connectorId: String(firstSource.connectorId),
                      sourceId: String(firstSource.sourceId),
                    });
                    setConnectorsResult({ ok: true, payload: readPayload });
                    emitConnectorSourceRead({
                      source: 'admin_panel',
                      connectorId: String(firstSource.connectorId),
                    });
                  } catch (error) {
                    setConnectorsResult({
                      ok: false,
                      error: error instanceof Error ? error.message : String(error),
                    });
                  }
                }}
              >
                {connectorsRuntime.readSourceMutation.isPending
                  ? 'Reading...'
                  : 'Read first result'}
              </button>
            </div>
            <ResultBox result={connectorsSearchResult} />
          </div>

          <label className="text-xs font-medium text-slate-600 dark:text-slate-300">URL</label>
          <input
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-black/20 dark:text-white"
            value={connectorUrl}
            onChange={(e) => setConnectorUrl(e.target.value)}
          />
          <div className="mt-3 flex items-center gap-2">
            <button
              className={cn(
                'px-3 py-2 rounded-xl text-sm font-medium',
                connectorsRuntime.capabilities.fetch
                  ? 'bg-violet-600 hover:bg-violet-700 text-white'
                  : 'bg-slate-200 text-slate-500 dark:bg-white/10 dark:text-slate-400 cursor-not-allowed'
              )}
              disabled={!connectorsRuntime.capabilities.fetch || connectorsRuntime.isWorking}
              onClick={async () =>
                setConnectorsResult(
                  await postConnectorsRuntimeFetch({
                    body: { url: connectorUrl },
                    enabled: enabled.connectors,
                    perform: connectorsRuntime.fetch,
                    emitStarted: () => emitConnectorsRuntimeStarted({ source: 'admin_panel' }),
                    emitSucceeded: ({ latencyMs, httpStatus }) =>
                      emitConnectorsRuntimeSucceeded({
                        source: 'admin_panel',
                        latencyBucketMs: bucketLatencyMs(latencyMs),
                        httpStatusBucket: bucketHttpStatus(httpStatus),
                      }),
                    emitFailed: ({ latencyMs, httpStatus, error }) =>
                      emitConnectorsRuntimeFailed({
                        source: 'admin_panel',
                        latencyBucketMs: bucketLatencyMs(latencyMs),
                        httpStatusBucket: bucketHttpStatus(httpStatus),
                        reason: inferFailReason({ enabled: enabled.connectors, httpStatus, error }),
                      }),
                  })
                )
              }
            >
              {connectorsRuntime.fetchMutation.isPending ? 'Running...' : 'Run'}
            </button>
          </div>
          <ResultBox result={connectorsResult} />
        </SectionShell>
      </V10RuntimeWorkspaceBlock>

      <V10RuntimeWorkspaceBlock block={workspaceBlockMap.outcome} className="order-8">
        <SectionShell title="Outcome Runtime" enabled={enabled.outcome}>
          <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
            Analysis summary
          </label>
          <textarea
            className="mt-1 min-h-[88px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-black/20 dark:text-white"
            value={outcomeAnalysisSummary}
            onChange={(e) => setOutcomeAnalysisSummary(e.target.value)}
          />
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Business goal
              </label>
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-black/20 dark:text-white"
                value={outcomeBusinessGoal}
                onChange={(e) => setOutcomeBusinessGoal(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Hypothesis
              </label>
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-black/20 dark:text-white"
                value={outcomeHypothesis}
                onChange={(e) => setOutcomeHypothesis(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                KPI label
              </label>
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-black/20 dark:text-white"
                value={outcomeMetricLabel}
                onChange={(e) => setOutcomeMetricLabel(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                KPI domain
              </label>
              <select
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-black/20 dark:text-white"
                value={outcomeMetricDomain}
                onChange={(e) =>
                  setOutcomeMetricDomain(
                    e.target.value as 'revenue' | 'retention' | 'cost' | 'time'
                  )
                }
              >
                <option value="time">time</option>
                <option value="cost">cost</option>
                <option value="revenue">revenue</option>
                <option value="retention">retention</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Baseline
              </label>
              <input
                type="number"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-black/20 dark:text-white"
                value={outcomeMetricBaseline}
                onChange={(e) => setOutcomeMetricBaseline(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Target
              </label>
              <input
                type="number"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-black/20 dark:text-white"
                value={outcomeMetricTarget}
                onChange={(e) => setOutcomeMetricTarget(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Observed
              </label>
              <input
                type="number"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-black/20 dark:text-white"
                value={outcomeMetricObserved}
                onChange={(e) => setOutcomeMetricObserved(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Analysis ID
              </label>
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-black/20 dark:text-white"
                value={outcomeAnalysisId}
                onChange={(e) => setOutcomeAnalysisId(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Artifact ID
              </label>
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-black/20 dark:text-white"
                value={outcomeArtifactId}
                onChange={(e) => setOutcomeArtifactId(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Contract ID
              </label>
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-black/20 dark:text-white"
                value={outcomeContractId}
                onChange={(e) => setOutcomeContractId(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Decision
              </label>
              <select
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-black/20 dark:text-white"
                value={outcomeDecision}
                onChange={(e) =>
                  setOutcomeDecision(e.target.value as 'accepted' | 'rejected' | 'needs_revision')
                }
              >
                <option value="accepted">accepted</option>
                <option value="rejected">rejected</option>
                <option value="needs_revision">needs_revision</option>
              </select>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              className={cn(
                'px-3 py-2 rounded-xl text-sm font-medium',
                outcomeRuntime.capabilities.previewAcceptance
                  ? 'bg-violet-600 hover:bg-violet-700 text-white'
                  : 'bg-slate-200 text-slate-500 dark:bg-white/10 dark:text-slate-400 cursor-not-allowed'
              )}
              disabled={!outcomeRuntime.capabilities.previewAcceptance || outcomeRuntime.isWorking}
              onClick={async () => {
                const metric = {
                  id: 'outcome-kpi-1',
                  label: outcomeMetricLabel,
                  domain: outcomeMetricDomain,
                  unit:
                    outcomeMetricDomain === 'revenue'
                      ? 'USD'
                      : outcomeMetricDomain === 'retention'
                        ? '%'
                        : 'hours',
                  baselineValue: outcomeMetricBaseline,
                  targetValue: outcomeMetricTarget,
                  observedValue: outcomeMetricObserved,
                };
                const start = typeof performance !== 'undefined' ? performance.now() : null;
                emitOutcomeRuntimeStarted({ source: 'admin_panel' });
                try {
                  const payload = await outcomeRuntime.previewAcceptance({
                    analysisSummary: outcomeAnalysisSummary,
                    businessGoal: outcomeBusinessGoal,
                    metrics: [metric],
                    evidence: { analysisId: outcomeAnalysisId, artifactId: outcomeArtifactId },
                  });
                  const end = typeof performance !== 'undefined' ? performance.now() : null;
                  const latencyMs =
                    start === null || end === null ? null : Math.max(0, end - start);
                  emitOutcomeRuntimeSucceeded({
                    source: 'admin_panel',
                    latencyBucketMs: bucketLatencyMs(latencyMs),
                    httpStatusBucket: bucketHttpStatus(200),
                  });
                  emitOutcomeKpiAcceptancePreviewed({
                    source: 'admin_panel',
                    metricsCountBucket: bucketMetricsCount(payload.metrics.length),
                  });
                  setOutcomeContractId(payload.acceptanceContract.contractId);
                  setOutcomePreviewResult({ ok: true, payload: { data: payload } });
                } catch (error) {
                  const end = typeof performance !== 'undefined' ? performance.now() : null;
                  const latencyMs =
                    start === null || end === null ? null : Math.max(0, end - start);
                  emitOutcomeRuntimeFailed({
                    source: 'admin_panel',
                    latencyBucketMs: bucketLatencyMs(latencyMs),
                    httpStatusBucket: bucketHttpStatus(null),
                    reason: inferFailReason({ enabled: enabled.outcome, httpStatus: null, error }),
                  });
                  setOutcomePreviewResult({
                    ok: false,
                    error: error instanceof Error ? error.message : String(error),
                  });
                }
              }}
            >
              {outcomeRuntime.previewAcceptanceMutation.isPending
                ? 'Previewing...'
                : 'KPI acceptance preview'}
            </button>
            <button
              className={cn(
                'px-3 py-2 rounded-xl text-sm font-medium',
                outcomeRuntime.capabilities.ingestSignal
                  ? 'bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900'
                  : 'bg-slate-200 text-slate-500 dark:bg-white/10 dark:text-slate-400 cursor-not-allowed'
              )}
              disabled={!outcomeRuntime.capabilities.ingestSignal || outcomeRuntime.isWorking}
              onClick={async () => {
                const kind = outcomeSignalKindFromDomain(outcomeMetricDomain);
                const start = typeof performance !== 'undefined' ? performance.now() : null;
                emitOutcomeRuntimeStarted({ source: 'admin_panel' });
                try {
                  const payload = await outcomeRuntime.ingestSignal({
                    source: 'analysis_link',
                    kind,
                    magnitude: {
                      value: Math.abs(outcomeMetricTarget - outcomeMetricBaseline),
                      unit:
                        outcomeMetricDomain === 'revenue'
                          ? 'USD'
                          : outcomeMetricDomain === 'retention'
                            ? '%'
                            : 'hours',
                    },
                    evidence: {
                      analysisId: outcomeAnalysisId,
                      artifactId: outcomeArtifactId,
                      acceptanceContractId: outcomeContractId || undefined,
                    },
                    note: outcomeBusinessGoal,
                  });
                  const end = typeof performance !== 'undefined' ? performance.now() : null;
                  const latencyMs =
                    start === null || end === null ? null : Math.max(0, end - start);
                  emitOutcomeRuntimeSucceeded({
                    source: 'admin_panel',
                    latencyBucketMs: bucketLatencyMs(latencyMs),
                    httpStatusBucket: bucketHttpStatus(200),
                  });
                  emitOutcomeSignalIngested({ source: 'admin_panel', kind });
                  setOutcomeSignalResult({ ok: true, payload: { data: payload } });
                } catch (error) {
                  const end = typeof performance !== 'undefined' ? performance.now() : null;
                  const latencyMs =
                    start === null || end === null ? null : Math.max(0, end - start);
                  emitOutcomeRuntimeFailed({
                    source: 'admin_panel',
                    latencyBucketMs: bucketLatencyMs(latencyMs),
                    httpStatusBucket: bucketHttpStatus(null),
                    reason: inferFailReason({ enabled: enabled.outcome, httpStatus: null, error }),
                  });
                  setOutcomeSignalResult({
                    ok: false,
                    error: error instanceof Error ? error.message : String(error),
                  });
                }
              }}
            >
              {outcomeRuntime.ingestSignalMutation.isPending ? 'Emitting...' : 'Emit signal'}
            </button>
            <button
              className={cn(
                'px-3 py-2 rounded-xl text-sm font-medium',
                outcomeRuntime.capabilities.resolveAcceptance
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-slate-200 text-slate-500 dark:bg-white/10 dark:text-slate-400 cursor-not-allowed'
              )}
              disabled={
                !outcomeRuntime.capabilities.resolveAcceptance ||
                !outcomeContractId.trim() ||
                outcomeRuntime.isWorking
              }
              onClick={async () => {
                const start = typeof performance !== 'undefined' ? performance.now() : null;
                emitOutcomeRuntimeStarted({ source: 'admin_panel' });
                try {
                  const payload = await outcomeRuntime.resolveAcceptance({
                    contractId: outcomeContractId.trim(),
                    decision: outcomeDecision,
                    acceptedMetricIds: outcomeDecision === 'accepted' ? ['outcome-kpi-1'] : [],
                  });
                  const end = typeof performance !== 'undefined' ? performance.now() : null;
                  const latencyMs =
                    start === null || end === null ? null : Math.max(0, end - start);
                  emitOutcomeRuntimeSucceeded({
                    source: 'admin_panel',
                    latencyBucketMs: bucketLatencyMs(latencyMs),
                    httpStatusBucket: bucketHttpStatus(200),
                  });
                  emitOutcomeAcceptanceResolved({
                    source: 'admin_panel',
                    decision: outcomeDecision,
                    acceptedCountBucket: bucketAcceptedCount(payload.acceptedMetricIds.length),
                  });
                  setOutcomeAcceptanceResult({ ok: true, payload: { data: payload } });
                } catch (error) {
                  const end = typeof performance !== 'undefined' ? performance.now() : null;
                  const latencyMs =
                    start === null || end === null ? null : Math.max(0, end - start);
                  emitOutcomeRuntimeFailed({
                    source: 'admin_panel',
                    latencyBucketMs: bucketLatencyMs(latencyMs),
                    httpStatusBucket: bucketHttpStatus(null),
                    reason: inferFailReason({ enabled: enabled.outcome, httpStatus: null, error }),
                  });
                  setOutcomeAcceptanceResult({
                    ok: false,
                    error: error instanceof Error ? error.message : String(error),
                  });
                }
              }}
            >
              {outcomeRuntime.resolveAcceptanceMutation.isPending
                ? 'Resolving...'
                : 'Resolve acceptance'}
            </button>
            <button
              className={cn(
                'px-3 py-2 rounded-xl text-sm font-medium',
                outcomeRuntime.capabilities.linkAnalysis
                  ? 'bg-amber-500 hover:bg-amber-600 text-white'
                  : 'bg-slate-200 text-slate-500 dark:bg-white/10 dark:text-slate-400 cursor-not-allowed'
              )}
              disabled={!outcomeRuntime.capabilities.linkAnalysis || outcomeRuntime.isWorking}
              onClick={async () => {
                const metric = {
                  id: 'outcome-kpi-1',
                  label: outcomeMetricLabel,
                  domain: outcomeMetricDomain,
                  unit:
                    outcomeMetricDomain === 'revenue'
                      ? 'USD'
                      : outcomeMetricDomain === 'retention'
                        ? '%'
                        : 'hours',
                  baselineValue: outcomeMetricBaseline,
                  targetValue: outcomeMetricTarget,
                  observedValue: outcomeMetricObserved,
                };
                const start = typeof performance !== 'undefined' ? performance.now() : null;
                emitOutcomeRuntimeStarted({ source: 'admin_panel' });
                try {
                  const payload = await outcomeRuntime.linkAnalysisToBusinessOutcome({
                    analysisSummary: outcomeAnalysisSummary,
                    businessGoal: outcomeBusinessGoal,
                    hypothesis: outcomeHypothesis,
                    metrics: [metric],
                    evidence: { analysisId: outcomeAnalysisId, artifactId: outcomeArtifactId },
                  });
                  const end = typeof performance !== 'undefined' ? performance.now() : null;
                  const latencyMs =
                    start === null || end === null ? null : Math.max(0, end - start);
                  emitOutcomeRuntimeSucceeded({
                    source: 'admin_panel',
                    latencyBucketMs: bucketLatencyMs(latencyMs),
                    httpStatusBucket: bucketHttpStatus(200),
                  });
                  emitOutcomeBusinessLinked({
                    source: 'admin_panel',
                    metricsCountBucket: bucketMetricsCount(payload.linkedMetricIds.length),
                    strongestSignalKind: payload.strongestSignalKind,
                  });
                  setOutcomeLinkResult({ ok: true, payload: { data: payload } });
                } catch (error) {
                  const end = typeof performance !== 'undefined' ? performance.now() : null;
                  const latencyMs =
                    start === null || end === null ? null : Math.max(0, end - start);
                  emitOutcomeRuntimeFailed({
                    source: 'admin_panel',
                    latencyBucketMs: bucketLatencyMs(latencyMs),
                    httpStatusBucket: bucketHttpStatus(null),
                    reason: inferFailReason({ enabled: enabled.outcome, httpStatus: null, error }),
                  });
                  setOutcomeLinkResult({
                    ok: false,
                    error: error instanceof Error ? error.message : String(error),
                  });
                }
              }}
            >
              {outcomeRuntime.linkAnalysisMutation.isPending
                ? 'Linking...'
                : 'Link analysis → outcome'}
            </button>
          </div>
          <ResultBox result={outcomePreviewResult} />
          <ResultBox result={outcomeSignalResult} />
          <ResultBox result={outcomeAcceptanceResult} />
          <ResultBox result={outcomeLinkResult} />
        </SectionShell>
      </V10RuntimeWorkspaceBlock>

      <V10RuntimeWorkspaceBlock block={workspaceBlockMap.onboarding} className="order-3">
        <SectionShell title="Onboarding Runtime" enabled={enabled.onboarding}>
          <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Persona</label>
          <input
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-black/20 dark:text-white"
            value={persona}
            onChange={(e) => setPersona(e.target.value)}
          />
          <label className="mt-3 block text-xs font-medium text-slate-600 dark:text-slate-300">
            Current step
          </label>
          <input
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-black/20 dark:text-white"
            value={onboardingStep}
            onChange={(e) => setOnboardingStep(e.target.value)}
          />
          {(onboardingId || resumeToken) && (
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-500 dark:text-slate-400">
              {onboardingId ? (
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 dark:border-white/10 dark:bg-black/20">
                  onboardingId: {onboardingId}
                </span>
              ) : null}
              {resumeToken ? (
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 dark:border-white/10 dark:bg-black/20">
                  resumeToken: {resumeToken}
                </span>
              ) : null}
            </div>
          )}
          <div className="mt-3 flex items-center gap-2">
            <button
              className={cn(
                'px-3 py-2 rounded-xl text-sm font-medium',
                onboardingRuntime.capabilities.capturePersona
                  ? 'bg-violet-600 hover:bg-violet-700 text-white'
                  : 'bg-slate-200 text-slate-500 dark:bg-white/10 dark:text-slate-400 cursor-not-allowed'
              )}
              disabled={
                !onboardingRuntime.capabilities.capturePersona || onboardingRuntime.isWorking
              }
              onClick={async () => {
                const startedAt =
                  typeof performance !== 'undefined' ? performance.now() : Date.now();
                emitOnboardRuntimeStarted({ source: 'admin_panel' });
                try {
                  const payload = await onboardingRuntime.capturePersona({
                    onboardingId: onboardingId || undefined,
                    persona,
                    personaConfidence: 'high',
                  });
                  const endedAt =
                    typeof performance !== 'undefined' ? performance.now() : Date.now();
                  emitOnboardRuntimeSucceeded({
                    source: 'admin_panel',
                    latencyBucketMs: bucketLatencyMs(Math.max(0, Math.round(endedAt - startedAt))),
                    httpStatusBucket: '2xx',
                  });
                  setOnboardingId(String(payload.onboardingId || onboardingId || ''));
                  setResumeToken(String(payload.resumeToken || resumeToken || ''));
                  setOnboardingResult({ ok: true, payload: { data: payload } });
                } catch (error) {
                  const endedAt =
                    typeof performance !== 'undefined' ? performance.now() : Date.now();
                  const httpStatus =
                    typeof (error as any)?.status === 'number'
                      ? Number((error as any).status)
                      : null;
                  emitOnboardRuntimeFailed({
                    source: 'admin_panel',
                    latencyBucketMs: bucketLatencyMs(Math.max(0, Math.round(endedAt - startedAt))),
                    httpStatusBucket: bucketHttpStatus(httpStatus),
                    reason: inferFailReason({ enabled: enabled.onboarding, httpStatus, error }),
                  });
                  setOnboardingResult({
                    ok: false,
                    error: error instanceof Error ? error.message : String(error),
                  });
                }
              }}
            >
              {onboardingRuntime.capturePersonaMutation.isPending
                ? 'Capturing...'
                : 'Capture persona'}
            </button>
            <button
              className="px-3 py-2 rounded-xl text-sm font-medium bg-slate-100 text-slate-800 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-100 dark:hover:bg-white/15"
              disabled={
                !onboardingRuntime.capabilities.saveSnapshot ||
                !onboardingId ||
                onboardingRuntime.isWorking
              }
              onClick={async () => {
                if (!onboardingId) return;
                try {
                  const payload = await onboardingRuntime.saveSnapshot({
                    onboardingId,
                    snapshot: onboardingSnapshot,
                    status: 'abandoned',
                    reason: 'admin_panel_pause',
                  });
                  setOnboardingResult({ ok: true, payload });
                } catch (error) {
                  setOnboardingResult({
                    ok: false,
                    error: error instanceof Error ? error.message : String(error),
                  });
                }
              }}
            >
              {onboardingRuntime.saveSnapshotMutation.isPending ? 'Saving...' : 'Save snapshot'}
            </button>
            <button
              className="px-3 py-2 rounded-xl text-sm font-medium bg-slate-100 text-slate-800 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-100 dark:hover:bg-white/15"
              disabled={
                !onboardingRuntime.capabilities.resume ||
                (!resumeToken && !onboardingId) ||
                onboardingRuntime.isWorking
              }
              onClick={async () => {
                try {
                  const payload = await onboardingRuntime.resume({
                    onboardingId: onboardingId || undefined,
                    resumeToken: resumeToken || undefined,
                    currentSourceHashes: onboardingId
                      ? {
                          [`${onboardingId}-source`]: `hash-${persona.toLowerCase()}`,
                        }
                      : undefined,
                  });
                  setOnboardingResult({ ok: true, payload });
                } catch (error) {
                  setOnboardingResult({
                    ok: false,
                    error: error instanceof Error ? error.message : String(error),
                  });
                }
              }}
            >
              {onboardingRuntime.resumeMutation.isPending ? 'Resuming...' : 'Resume'}
            </button>
            <button
              className="px-3 py-2 rounded-xl text-sm font-medium bg-slate-100 text-slate-800 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-100 dark:hover:bg-white/15"
              disabled={
                !onboardingRuntime.capabilities.recordEvent ||
                !onboardingId ||
                onboardingRuntime.isWorking
              }
              onClick={async () => {
                if (!onboardingId) return;
                const baseProps = buildDefaultOnboardTelemetryProps({
                  persona,
                  sourceType: 'upload',
                  trustMode: 'guardrailed',
                  residencyRegion: 'eu',
                  approvalRequired: true,
                  artifactType: 'memo',
                });
                const bundle = [
                  {
                    eventName: 'onboard.artifact_first_draft_rendered' as const,
                    props: { ...baseProps, secondsSinceStart: 90, validationStatus: 'passed' },
                  },
                  {
                    eventName: 'onboard.connector_oauth_succeeded' as const,
                    props: { ...baseProps, secondsSinceStart: 60, ahaReached: true },
                  },
                  {
                    eventName: 'onboard.artifact_approved' as const,
                    props: { ...baseProps, secondsSinceStart: 150, ahaReached: true },
                  },
                  {
                    eventName: 'onboard.artifact_saved' as const,
                    props: { ...baseProps, secondsSinceStart: 170, ahaReached: true },
                  },
                  {
                    eventName: 'onboard.activation_reached' as const,
                    props: { ...baseProps, secondsSinceStart: 170, ahaReached: true },
                  },
                ];
                try {
                  for (const item of bundle) {
                    emitOnboardTelemetryEvent(item.eventName, item.props);
                    await onboardingRuntime.recordEvent({
                      onboardingId,
                      eventName: item.eventName,
                      props: item.props,
                    });
                  }
                  setOnboardingResult({
                    ok: true,
                    payload: { onboardingId, emittedEvents: bundle.map((item) => item.eventName) },
                  });
                } catch (error) {
                  setOnboardingResult({
                    ok: false,
                    error: error instanceof Error ? error.message : String(error),
                  });
                }
              }}
            >
              {onboardingRuntime.recordEventMutation.isPending
                ? 'Emitting...'
                : 'Emit activation bundle'}
            </button>
            <button
              className="px-3 py-2 rounded-xl text-sm font-medium bg-slate-100 text-slate-800 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-100 dark:hover:bg-white/15"
              disabled={!onboardingRuntime.capabilities.kpiSummary || onboardingRuntime.isWorking}
              onClick={async () => {
                try {
                  const result = await onboardingRuntime.loadKpiSummary();
                  if (result.error) {
                    throw result.error;
                  }
                  setOnboardingKpiResult({ ok: true, payload: result.data });
                } catch (error) {
                  setOnboardingKpiResult({
                    ok: false,
                    error: error instanceof Error ? error.message : String(error),
                  });
                }
              }}
            >
              {onboardingRuntime.kpiSummaryQuery.isFetching ? 'Loading...' : 'Load KPI summary'}
            </button>
          </div>
          <ResultBox result={onboardingResult} />
          <ResultBox result={onboardingKpiResult} />
        </SectionShell>
      </V10RuntimeWorkspaceBlock>
    </V10RuntimeWorkspace>
  );
}

export default ChatV10RuntimesPanel;
