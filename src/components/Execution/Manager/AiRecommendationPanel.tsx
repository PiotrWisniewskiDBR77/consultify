/**
 * AiRecommendationPanel — local right-side workspace panel for Management lanes.
 *
 * This panel lives inside the module canvas. It does not cover Menu 2 / Menu 3
 * and replaces the narrow preview pane only within the work area.
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Loader2,
  Scale,
  Shield,
  Sparkles,
  Users,
  X,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ErrorState, LoadingState } from '@/components/ui/primitives';

import {
  type V8AiRecommendation,
  type V8AiStep,
  type V8AiTriageResult,
  V8ExecutionControlApi,
  type V8LaneAnalysisResponse,
} from '../../../services/api/v8/execution-control';
import type { ManagerProblemRow } from './types';

export type ManagementWorkspaceMode =
  | 'recommend'
  | 'triage'
  | 'action-plan'
  | 'due-soon'
  | 'decision-pack'
  | 'recovery-plan'
  | 'watchlist'
  | 'rebalance'
  | 'ownership-fix';

interface AiRecommendationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  mode: ManagementWorkspaceMode;
  laneId: string;
  problemId?: string;
  projectId?: string;
  rows: ManagerProblemRow[];
  onSelectProblem?: (problemId: string) => void;
}

const SEVERITY_COLORS: Record<string, { dot: string; bg: string; text: string }> = {
  critical: {
    dot: 'bg-danger-500',
    bg: 'bg-danger-50 dark:bg-danger-900/20',
    text: 'text-danger-700 dark:text-danger-400',
  },
  warning: {
    dot: 'bg-amber-500',
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    text: 'text-amber-700 dark:text-amber-400',
  },
  info: {
    dot: 'bg-sky-500',
    bg: 'bg-sky-50 dark:bg-sky-900/20',
    text: 'text-sky-700 dark:text-sky-400',
  },
  ok: {
    dot: 'bg-emerald-500',
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    text: 'text-emerald-700 dark:text-emerald-400',
  },
};

const FEASIBILITY_COLORS: Record<string, string> = {
  immediate: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400',
  manager_decision: 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
  leadership_decision:
    'bg-primary-100 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400',
  not_feasible_now: 'bg-slate-100 text-slate-600 dark:bg-navy-800 dark:text-slate-300',
};

const MODE_TITLES: Record<ManagementWorkspaceMode, string> = {
  recommend: 'AI Recommendation',
  triage: 'AI Triage',
  'action-plan': 'Action Plan',
  'due-soon': 'Due Soon',
  'decision-pack': 'Decision Pack',
  'recovery-plan': 'Recovery Plan',
  watchlist: 'Watchlist',
  rebalance: 'Rebalance',
  'ownership-fix': 'Ownership Fix',
};

const MODE_SUBTITLES: Record<ManagementWorkspaceMode, string> = {
  recommend: 'Single-problem guidance with practical next steps.',
  triage: 'What requires attention first and why.',
  'action-plan': 'Operational moves, decisions, and execution follow-up.',
  'due-soon': 'Items that are about to turn into active execution issues.',
  'decision-pack': 'Fast-track decisions and approvals that block flow.',
  'recovery-plan': 'Recover blocked work with concrete unblock scenarios.',
  watchlist: 'Early warnings worth monitoring before they become critical.',
  rebalance: 'Reduce overload and restore a workable distribution of tasks.',
  'ownership-fix': 'Close owner, sponsor, dates, and accountability gaps.',
};

function normalizeErrorMessage(err: unknown) {
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const maybeMessage = (err as { message?: unknown }).message;
    if (typeof maybeMessage === 'string' && maybeMessage.trim()) return maybeMessage;
    try {
      return JSON.stringify(err);
    } catch {
      return 'Workspace analysis failed. Please try again.';
    }
  }
  return 'Workspace analysis failed. Please try again.';
}

const StepCard: React.FC<{ step: V8AiStep }> = ({ step }) => (
  <div className="flex gap-3 rounded-lg border border-slate-200/70 p-3 dark:border-white/[0.06]">
    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[11px] font-bold text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
      {step.order}
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-[12px] font-medium text-slate-900 dark:text-white">{step.action}</p>
      <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-slate-500 dark:text-slate-400">
        <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 dark:bg-navy-800">
          Owner: {step.owner}
        </span>
        <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 dark:bg-navy-800">
          Timeframe: {step.timeframe}
        </span>
      </div>
      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Outcome: {step.outcome}</p>
    </div>
  </div>
);

const ConfidenceBadge: React.FC<{ value: number }> = ({ value }) => {
  const color =
    value >= 75
      ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20'
      : value >= 50
        ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20'
        : 'text-danger-600 dark:text-danger-400 bg-danger-50 dark:bg-danger-900/20';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${color}`}
    >
      AI Confidence: {value}%
    </span>
  );
};

const SeverityBadge: React.FC<{ severity: string }> = ({ severity }) => {
  const c = SEVERITY_COLORS[severity] || SEVERITY_COLORS.info;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${c.bg} ${c.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {severity}
    </span>
  );
};

const CollapsibleSection: React.FC<{
  title: string;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, defaultOpen = true, badge, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-slate-200 dark:border-white/[0.04]">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left"
      >
        {open ? (
          <ChevronDown size={14} className="text-slate-600" />
        ) : (
          <ChevronRight size={14} className="text-slate-600" />
        )}
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {title}
        </span>
        {badge}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const SummaryCallout: React.FC<{ severity: string; children: React.ReactNode }> = ({
  severity,
  children,
}) => {
  const styles = SEVERITY_COLORS[severity] || SEVERITY_COLORS.info;
  return (
    <div className={`rounded-lg border px-3 py-2.5 ${styles.bg} ${styles.text} border-current/10`}>
      <p className="text-[12px] leading-relaxed">{children}</p>
    </div>
  );
};

const FocusList: React.FC<{
  rows: ManagerProblemRow[];
  emptyText: string;
  onSelectProblem?: (problemId: string) => void;
}> = ({ rows, emptyText, onSelectProblem }) => {
  if (rows.length === 0) {
    return <p className="text-[12px] text-slate-500 dark:text-slate-400">{emptyText}</p>;
  }

  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <button
          key={row.id}
          type="button"
          onClick={() => onSelectProblem?.(row.id)}
          className="w-full rounded-lg border border-slate-200/70 p-3 text-left transition-colors hover:bg-slate-50 dark:border-white/[0.06] dark:hover:bg-white/[0.03]"
        >
          <div className="mb-1.5 flex items-center gap-2">
            <SeverityBadge severity={row.severity} />
            <span className="text-[10px] uppercase tracking-wide text-slate-600 dark:text-slate-500">
              {row.problemType.replace(/_/g, ' ')}
            </span>
          </div>
          <p className="text-[12px] font-medium text-slate-900 dark:text-white">{row.title}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
            {row.rootCause}
          </p>
        </button>
      ))}
    </div>
  );
};

const SuggestionCard: React.FC<{
  suggestion: V8LaneAnalysisResponse['suggestions'][number];
  decisionState?: string;
  busy?: boolean;
  onApprove?: () => void;
  onDefer?: () => void;
  approveLabel?: string;
  /** A11/DEC-120: applyManagerSuggestion/submitLaneDecision post through the
      retired legacy execution-control writer (409 on every non-GET). Passing
      a reason disables both actions with a visible, honest explanation
      instead of leaving an active button that always errors. */
  disabledReason?: string;
}> = ({
  suggestion,
  decisionState,
  busy = false,
  onApprove,
  onDefer,
  approveLabel = 'Approve',
  disabledReason,
}) => (
  <div className="rounded-lg border border-slate-200/70 p-3 dark:border-white/[0.06]">
    <div className="mb-2 flex flex-wrap items-center gap-2">
      <span className="text-[12px] font-semibold text-slate-900 dark:text-white">
        {suggestion.action}
      </span>
      <span
        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
          FEASIBILITY_COLORS[suggestion.feasibility]
        }`}
      >
        {suggestion.feasibility.replace(/_/g, ' ')}
      </span>
      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-navy-800 dark:text-slate-300">
        {suggestion.category}
      </span>
      {decisionState ? (
        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
          {decisionState.replace(/_/g, ' ')}
        </span>
      ) : null}
    </div>
    <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
      {suggestion.reason}
    </p>
    <div className="mt-2 rounded bg-slate-50 px-2.5 py-2 text-[11px] text-slate-600 dark:bg-white/[0.03] dark:text-slate-300">
      Expected outcome: {suggestion.expectedOutcome}
    </div>
    <div className="mt-2 flex items-center justify-between gap-2">
      <span className="text-[10px] text-slate-600 dark:text-slate-500">
        Cost: {suggestion.cost}
        {suggestion.recommendedOwner ? ` | Suggested owner: ${suggestion.recommendedOwner}` : ''}
      </span>
      <div className="flex items-center gap-1.5">
        {onDefer ? (
          <button
            type="button"
            onClick={onDefer}
            disabled={busy || Boolean(disabledReason)}
            title={disabledReason}
            className="rounded-full border border-slate-200/70 px-2.5 py-1 text-[10px] font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed dark:border-white/[0.08] dark:text-slate-300 dark:hover:bg-white/[0.03]"
          >
            Defer
          </button>
        ) : null}
        {onApprove ? (
          <button
            type="button"
            onClick={onApprove}
            disabled={busy || Boolean(disabledReason)}
            title={disabledReason}
            className="rounded-full bg-blue-500/10 px-2.5 py-1 text-[10px] font-semibold text-blue-700 transition-colors hover:bg-blue-500/15 disabled:opacity-40 disabled:cursor-not-allowed dark:text-blue-200"
          >
            {approveLabel}
          </button>
        ) : null}
      </div>
    </div>
    {disabledReason ? (
      <p className="mt-1.5 text-[10px] text-amber-600 dark:text-amber-400">{disabledReason}</p>
    ) : null}
  </div>
);

function getWorkspaceRows(mode: ManagementWorkspaceMode, rows: ManagerProblemRow[]) {
  switch (mode) {
    case 'due-soon':
      return rows.filter((row) => row.problemType === 'due_soon').slice(0, 10);
    case 'decision-pack':
      return rows
        .filter((row) =>
          [
            'overdue_decision',
            'pending_decision',
            'deferred_decision',
            'no_decision_maker',
          ].includes(row.problemType)
        )
        .slice(0, 12);
    case 'recovery-plan':
      return rows
        .filter((row) =>
          [
            'blocked_initiative',
            'blocked_task',
            'dependency_block',
            'decision_block',
            'critical_issue',
          ].includes(row.problemType)
        )
        .slice(0, 12);
    case 'watchlist':
      return rows
        .filter(
          (row) =>
            row.severity !== 'critical' ||
            [
              'high_risk',
              'missing_baseline',
              'stale_item',
              'delay_risk',
              'delay_late_start',
            ].includes(row.problemType)
        )
        .slice(0, 12);
    case 'rebalance':
      return rows
        .filter((row) =>
          ['overloaded_person', 'unassigned_task', 'no_estimate', 'due_soon'].includes(
            row.problemType
          )
        )
        .slice(0, 12);
    case 'ownership-fix':
      return rows
        .filter((row) =>
          ['no_owner', 'no_sponsor', 'no_dates', 'bus_factor', 'low_clarity'].includes(
            row.problemType
          )
        )
        .slice(0, 12);
    default:
      return [];
  }
}

const RecommendView: React.FC<{ data: V8AiRecommendation }> = ({ data }) => (
  <div className="space-y-0">
    <CollapsibleSection title="Diagnosis">
      <p className="text-[12px] leading-relaxed text-slate-700 dark:text-slate-300">
        {data.diagnosis}
      </p>
    </CollapsibleSection>

    <CollapsibleSection title="Recommendation" badge={<ConfidenceBadge value={data.confidence} />}>
      <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-800/40 dark:bg-blue-900/10">
        <p className="text-[12px] font-medium leading-relaxed text-blue-800 dark:text-blue-300">
          {data.recommendation}
        </p>
      </div>
    </CollapsibleSection>

    <CollapsibleSection title="Action Steps">
      <div className="space-y-2">
        {data.steps.map((step) => (
          <StepCard key={step.order} step={step} />
        ))}
      </div>
    </CollapsibleSection>

    <CollapsibleSection title="Reasoning">
      <p className="text-[12px] leading-relaxed text-slate-600 dark:text-slate-400">
        {data.reasoning}
      </p>
    </CollapsibleSection>

    <CollapsibleSection title="Alternative Approach" defaultOpen={false}>
      <p className="text-[12px] leading-relaxed text-slate-600 dark:text-slate-400">
        {data.alternativeApproach}
      </p>
    </CollapsibleSection>
  </div>
);

const TriageView: React.FC<{
  data: V8AiTriageResult;
  onSelectProblem?: (problemId: string) => void;
}> = ({ data, onSelectProblem }) => (
  <div className="space-y-0">
    <CollapsibleSection title="Executive Summary">
      <SummaryCallout severity="critical">{data.executiveSummary}</SummaryCallout>
    </CollapsibleSection>

    <CollapsibleSection
      title="Top Priority"
      badge={
        <span className="rounded-full bg-danger-100 px-2 py-0.5 text-[10px] font-semibold text-danger-700 dark:bg-danger-900/20 dark:text-danger-400">
          {data.topPriority.length} items
        </span>
      }
    >
      <div className="space-y-1.5">
        {data.topPriority.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => onSelectProblem?.(id)}
            className="flex w-full items-center gap-2 rounded bg-danger-50/50 px-2 py-1.5 text-left text-[11px] text-danger-700 transition-colors hover:bg-danger-100/60 dark:bg-danger-900/10 dark:text-danger-400 dark:hover:bg-danger-900/20"
          >
            <AlertTriangle size={12} />
            <span className="truncate">{id}</span>
          </button>
        ))}
      </div>
    </CollapsibleSection>

    <CollapsibleSection title={`Clusters (${data.clusters.length})`}>
      <div className="space-y-3">
        {data.clusters.map((cluster, idx) => (
          <div
            key={idx}
            className="rounded-lg border border-slate-200/70 p-3 dark:border-white/[0.06]"
          >
            <div className="mb-1.5 flex items-center gap-2">
              <SeverityBadge severity={cluster.severity} />
              <span className="text-[12px] font-semibold text-slate-900 dark:text-white">
                {cluster.theme}
              </span>
              <span className="ml-auto text-[10px] text-slate-600">
                {cluster.problemIds.length} problems
              </span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
              {cluster.summary}
            </p>
            <div className="mt-2 flex items-center gap-1.5 rounded bg-blue-50/50 px-2 py-1 text-[11px] text-blue-700 dark:bg-blue-900/10 dark:text-blue-400">
              <ArrowRight size={10} />
              {cluster.suggestedAction}
            </div>
          </div>
        ))}
      </div>
    </CollapsibleSection>
  </div>
);

const ActionPlanView: React.FC<{
  analysis: V8LaneAnalysisResponse;
  busySuggestionId: string | null;
  onApproveSuggestion: (suggestionId: string) => void;
  onDeferSuggestion: (suggestionId: string) => void;
  /** A11/DEC-120 — see SuggestionCard. */
  suggestionActionsDisabledReason?: string;
}> = ({
  analysis,
  busySuggestionId,
  onApproveSuggestion,
  onDeferSuggestion,
  suggestionActionsDisabledReason,
}) => {
  const decisionsBySuggestion = useMemo(
    () =>
      analysis.decisions.reduce((map, decision) => {
        if (!map.has(decision.suggestionId)) {
          map.set(decision.suggestionId, decision.state);
        }
        return map;
      }, new Map<string, string>()),
    [analysis.decisions]
  );

  return (
    <div className="space-y-0">
      <CollapsibleSection
        title="Summary"
        badge={<SeverityBadge severity={analysis.severity === 'ok' ? 'info' : analysis.severity} />}
      >
        <SummaryCallout severity={analysis.severity === 'ok' ? 'info' : analysis.severity}>
          {analysis.insights[0]?.interpretation ||
            analysis.observations[0]?.metric ||
            'No additional action context available for this lane yet.'}
        </SummaryCallout>
        <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
          Confidence: {analysis.confidence} | Refreshed:{' '}
          {new Date(analysis.lastRefreshed).toLocaleString()}
        </p>
      </CollapsibleSection>

      <CollapsibleSection
        title="Suggested Actions"
        badge={
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
            {analysis.suggestions.length}
          </span>
        }
      >
        <div className="space-y-3">
          {analysis.suggestions.map((suggestion) => (
            <SuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              decisionState={decisionsBySuggestion.get(suggestion.id)}
              busy={busySuggestionId === suggestion.id}
              approveLabel="Apply"
              onApprove={() => onApproveSuggestion(suggestion.id)}
              onDefer={() => onDeferSuggestion(suggestion.id)}
              disabledReason={suggestionActionsDisabledReason}
            />
          ))}
        </div>
      </CollapsibleSection>

      {analysis.effects.length > 0 && (
        <CollapsibleSection
          title="Expected Impact"
          badge={
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
              {analysis.effects.length}
            </span>
          }
        >
          <div className="space-y-2">
            {analysis.effects.map((effect) => (
              <div
                key={effect.id}
                className="rounded-lg border border-slate-200/70 p-3 dark:border-white/[0.06]"
              >
                <p className="text-[12px] font-medium text-slate-900 dark:text-white">
                  {effect.consequence}
                </p>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  Blast radius: {effect.blastRadius}
                  {effect.timelineImpact ? ` | Timeline: ${effect.timelineImpact}` : ''}
                  {effect.costImpact ? ` | Cost: ${effect.costImpact}` : ''}
                </p>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {analysis.executionPlan.length > 0 && (
        <CollapsibleSection
          title="Execution Follow-up"
          badge={
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
              {analysis.executionPlan.length}
            </span>
          }
        >
          <div className="space-y-3">
            {analysis.executionPlan.map((plan) => (
              <div
                key={plan.id}
                className="rounded-lg border border-slate-200/70 p-3 dark:border-white/[0.06]"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-[12px] font-semibold text-slate-900 dark:text-white">
                    Plan {plan.id}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-navy-800 dark:text-slate-300">
                    {plan.verificationStatus.replace(/_/g, ' ')}
                  </span>
                </div>
                {plan.beforeState ? (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Before: {plan.beforeState}
                  </p>
                ) : null}
                {plan.afterState ? (
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    Target: {plan.afterState}
                  </p>
                ) : null}
                <div className="mt-2 space-y-1.5">
                  {plan.tasks.map((task, idx) => (
                    <div
                      key={`${plan.id}-${idx}`}
                      className="rounded bg-slate-50 px-2 py-1.5 text-[11px] text-slate-600 dark:bg-white/[0.03] dark:text-slate-300"
                    >
                      {task.title} | {task.owner} | {task.deadline} | {task.status}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
};

const FocusWorkspaceView: React.FC<{
  mode: ManagementWorkspaceMode;
  rows: ManagerProblemRow[];
  analysis: V8LaneAnalysisResponse | null;
  onSelectProblem?: (problemId: string) => void;
}> = ({ mode, rows, analysis, onSelectProblem }) => {
  const focusRows = getWorkspaceRows(mode, rows);

  return (
    <div className="space-y-0">
      <CollapsibleSection
        title="Focus Summary"
        badge={
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
            {focusRows.length}
          </span>
        }
      >
        <SummaryCallout severity={analysis?.severity === 'critical' ? 'critical' : 'warning'}>
          {analysis?.insights[0]?.interpretation ||
            analysis?.observations[0]?.metric ||
            'Use this workspace to address the most relevant subset of current execution problems.'}
        </SummaryCallout>
      </CollapsibleSection>

      <CollapsibleSection title="Focus List" defaultOpen>
        <FocusList
          rows={focusRows}
          emptyText="No matching items in this focus area right now."
          onSelectProblem={onSelectProblem}
        />
      </CollapsibleSection>

      {analysis?.suggestions?.length ? (
        <CollapsibleSection title="Recommended Moves" defaultOpen={false}>
          <div className="space-y-2">
            {analysis.suggestions.slice(0, 6).map((suggestion) => (
              <div
                key={suggestion.id}
                className="rounded-lg border border-slate-200/70 p-3 dark:border-white/[0.06]"
              >
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-[12px] font-semibold text-slate-900 dark:text-white">
                    {suggestion.action}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      FEASIBILITY_COLORS[suggestion.feasibility]
                    }`}
                  >
                    {suggestion.feasibility.replace(/_/g, ' ')}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {suggestion.reason}
                </p>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      ) : null}
    </div>
  );
};

export const AiRecommendationPanel: React.FC<AiRecommendationPanelProps> = ({
  isOpen,
  onClose,
  mode,
  laneId,
  problemId,
  projectId,
  rows,
  onSelectProblem,
}) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recommendData, setRecommendData] = useState<V8AiRecommendation | null>(null);
  const [triageData, setTriageData] = useState<V8AiTriageResult | null>(null);
  const [laneAnalysis, setLaneAnalysis] = useState<V8LaneAnalysisResponse | null>(null);
  const [busySuggestionId, setBusySuggestionId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (mode === 'recommend' && problemId) {
        const resp = await V8ExecutionControlApi.getAiRecommendation(laneId, problemId, projectId);
        setRecommendData(
          ((resp as { data?: V8AiRecommendation }).data || resp) as V8AiRecommendation
        );
        setTriageData(null);
        setLaneAnalysis(null);
      } else if (mode === 'triage') {
        const resp = await V8ExecutionControlApi.getAiTriage(laneId, projectId);
        setTriageData(((resp as { data?: V8AiTriageResult }).data || resp) as V8AiTriageResult);
        setRecommendData(null);
        setLaneAnalysis(null);
      } else {
        const resp = await V8ExecutionControlApi.getLaneAnalysis(laneId, projectId);
        setLaneAnalysis(
          ((resp as { data?: V8LaneAnalysisResponse }).data || resp) as V8LaneAnalysisResponse
        );
        setRecommendData(null);
        setTriageData(null);
      }
    } catch (err) {
      setError(normalizeErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [laneId, mode, problemId, projectId]);

  useEffect(() => {
    if (!isOpen) return;
    setRecommendData(null);
    setTriageData(null);
    setLaneAnalysis(null);
    fetchData();
  }, [isOpen, fetchData]);

  const handleDecision = useCallback(
    async (suggestionId: string, state: 'approved' | 'deferred') => {
      setBusySuggestionId(suggestionId);
      setError(null);
      try {
        if (state === 'approved') {
          await V8ExecutionControlApi.applyManagerSuggestion(laneId, { suggestionId }, projectId);
        }
        await V8ExecutionControlApi.submitLaneDecision(laneId, { suggestionId, state });
        await fetchData();
      } catch (err) {
        setError(normalizeErrorMessage(err));
      } finally {
        setBusySuggestionId(null);
      }
    },
    [fetchData, laneId, projectId]
  );

  if (!isOpen) return null;

  return (
    <motion.aside
      initial={{ x: 16, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 16, opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="flex h-full min-h-0 flex-col bg-white dark:bg-navy-900"
    >
      <div className="flex items-center gap-3 border-b border-slate-200/70 px-4 py-3 dark:border-white/[0.06]">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary-500 to-blue-500">
          {mode === 'triage' ? (
            <Sparkles size={16} className="text-white" />
          ) : mode === 'action-plan' ? (
            <ClipboardList size={16} className="text-white" />
          ) : mode === 'decision-pack' ? (
            <Scale size={16} className="text-white" />
          ) : mode === 'watchlist' ? (
            <Shield size={16} className="text-white" />
          ) : mode === 'rebalance' || mode === 'ownership-fix' ? (
            <Users size={16} className="text-white" />
          ) : (
            <AlertTriangle size={16} className="text-white" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            {MODE_TITLES[mode]}
          </h2>
          <p className="text-[10px] text-slate-600 dark:text-slate-500">{MODE_SUBTITLES[mode]}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 dark:hover:bg-white/[0.06]"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {loading && (
          <LoadingState
            variant="spinner"
            label={t('execution.manager.ai.analyzing', 'AI is analyzing your data…')}
          />
        )}

        {error && !loading && <ErrorState message={error} retry={fetchData} />}

        {!loading && !error && mode === 'recommend' && recommendData && (
          <RecommendView data={recommendData} />
        )}

        {!loading && !error && mode === 'triage' && triageData && (
          <TriageView data={triageData} onSelectProblem={onSelectProblem} />
        )}

        {!loading && !error && mode === 'action-plan' && laneAnalysis && (
          <ActionPlanView
            analysis={laneAnalysis}
            busySuggestionId={busySuggestionId}
            onApproveSuggestion={(suggestionId) => handleDecision(suggestionId, 'approved')}
            onDeferSuggestion={(suggestionId) => handleDecision(suggestionId, 'deferred')}
            suggestionActionsDisabledReason={t(
              'execution.manager.actionWritesDisabledReason',
              'Saving is moving to the canonical execution registry — in progress'
            )}
          />
        )}

        {!loading &&
          !error &&
          [
            'due-soon',
            'decision-pack',
            'recovery-plan',
            'watchlist',
            'rebalance',
            'ownership-fix',
          ].includes(mode) && (
            <FocusWorkspaceView
              mode={mode}
              rows={rows}
              analysis={laneAnalysis}
              onSelectProblem={onSelectProblem}
            />
          )}
      </div>
    </motion.aside>
  );
};

export default AiRecommendationPanel;
