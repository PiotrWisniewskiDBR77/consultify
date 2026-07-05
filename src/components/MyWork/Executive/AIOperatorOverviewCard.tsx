import {
  Activity,
  ArrowRight,
  MessageSquareMore,
  Route,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

type Props = {
  overview: any;
  loading?: boolean;
  onOpenSection?: (section: string) => void;
  onProposeIntervention?: (templateKey: string) => void;
  onAcceptIntervention?: (actionId: string) => void;
  onExecuteIntervention?: (actionId: string) => void;
  onRejectIntervention?: (actionId: string) => void;
  busyActionId?: string | null;
};

const statusTone: Record<string, string> = {
  strong: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  watch: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  stale: 'bg-danger-500/10 text-danger-700 dark:text-danger-300',
  ready: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  partial: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  blocked: 'bg-danger-500/10 text-danger-700 dark:text-danger-300',
};

const readinessTone = (score: number) =>
  score >= 75
    ? 'text-emerald-600 dark:text-emerald-300'
    : score >= 45
      ? 'text-amber-600 dark:text-amber-300'
      : 'text-danger-600 dark:text-danger-300';

export const AIOperatorOverviewCard: React.FC<Props> = ({
  overview,
  loading = false,
  onOpenSection,
  onProposeIntervention,
  onAcceptIntervention,
  onExecuteIntervention,
  onRejectIntervention,
  busyActionId = null,
}) => {
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 p-5">
        <div className="h-5 w-48 rounded bg-slate-200 dark:bg-white/10 animate-pulse mb-4" />
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div
              key={idx}
              className="h-20 rounded-xl bg-slate-100 dark:bg-white/[0.04] animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  const profile = overview?.foundation?.profile || {};
  const navigator = overview?.foundation?.navigator || {};
  const communication = overview?.communication || {};
  const value = overview?.value || {};
  const ops = overview?.ops || {};
  const plan = overview?.plan || {};
  const actions = Array.isArray(navigator?.nextBestActions)
    ? navigator.nextBestActions.slice(0, 3)
    : [];
  const workstreams = Array.isArray(ops?.workstreams) ? ops.workstreams.slice(0, 4) : [];
  const suggestedInterventions = Array.isArray(overview?.interventions?.suggested)
    ? overview.interventions.suggested.slice(0, 3)
    : [];
  const interventionQueue = Array.isArray(overview?.interventions?.queue)
    ? overview.interventions.queue.slice(0, 3)
    : [];

  return (
    <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-200 dark:border-navy-700">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary-500/10 flex items-center justify-center">
                <Activity size={16} className="text-primary-500" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  {t('executive.aiOperator.title', 'AI Operator')}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {t(
                    'executive.aiOperator.subtitle',
                    'Relationship, navigation, execution, and value in one cockpit'
                  )}
                </p>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div
              className={`text-2xl font-semibold ${readinessTone(Number(ops?.readinessScore || 0))}`}
            >
              {Number(ops?.readinessScore || 0)}%
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              {t('executive.aiOperator.readiness', 'operator readiness')}
            </div>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-5">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
          <MetricCard
            icon={<Route size={15} />}
            label={t('executive.aiOperator.stage', 'Stage')}
            value={String(profile?.currentStage || 'discovery').replace(/_/g, ' ')}
            tone={statusTone[profile?.relationshipHealth || 'watch']}
            sublabel={`${navigator?.progressPct || 0}%`}
          />
          <MetricCard
            icon={<MessageSquareMore size={15} />}
            label={t('executive.aiOperator.relationship', 'Relationship')}
            value={profile?.relationshipHealth || 'watch'}
            tone={statusTone[profile?.relationshipHealth || 'watch']}
            sublabel={
              profile?.daysSinceLastTouch != null
                ? `${profile.daysSinceLastTouch} ${t('executive.aiOperator.daysSinceTouch', 'days since touch')}`
                : t('executive.aiOperator.noTouchpoint', 'No touchpoint')
            }
          />
          <MetricCard
            icon={<TrendingUp size={15} />}
            label={t('executive.aiOperator.value', 'Value')}
            value={`${value?.coveragePct || 0}%`}
            tone={
              statusTone[
                value?.status === 'at_risk'
                  ? 'blocked'
                  : value?.status === 'tracking'
                    ? 'ready'
                    : 'partial'
              ]
            }
            sublabel={`${value?.trackedKpis || 0} KPI`}
          />
          <MetricCard
            icon={<ShieldCheck size={15} />}
            label={t('executive.aiOperator.autonomy', 'Autonomy')}
            value={`${ops?.autonomyScore || 0}%`}
            tone={
              statusTone[
                (ops?.autonomyScore || 0) >= 70
                  ? 'ready'
                  : (ops?.autonomyScore || 0) >= 40
                    ? 'partial'
                    : 'blocked'
              ]
            }
            sublabel={`${ops?.guardrails?.releaseCoveragePct || 0}% release trace`}
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <div className="rounded-xl border border-slate-200/70 dark:border-white/[0.08] p-4 bg-slate-50/70 dark:bg-white/[0.03]">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                {t('executive.aiOperator.nextActions', 'Next best actions')}
              </h4>
              <button
                type="button"
                onClick={() => onOpenSection?.('tasks')}
                className="text-xs text-slate-500 dark:text-slate-400 hover:text-primary-500 inline-flex items-center gap-1"
              >
                {t('executive.aiOperator.open', 'Open')}
                <ArrowRight size={12} />
              </button>
            </div>
            <div className="space-y-2">
              {actions.length ? (
                actions.map((action: any) => (
                  <div
                    key={action.id}
                    className="rounded-xl border border-slate-200/70 dark:border-white/[0.08] bg-white/80 dark:bg-white/[0.04] p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-900 dark:text-white">
                          {action.title}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          {action.reason}
                        </div>
                      </div>
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusTone[action.priority === 'critical' ? 'blocked' : action.priority === 'high' ? 'partial' : 'ready']}`}
                      >
                        {action.priority}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  {t('executive.aiOperator.noActions', 'No urgent operator actions.')}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/70 dark:border-white/[0.08] p-4 bg-slate-50/70 dark:bg-white/[0.03]">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
              {t('executive.aiOperator.cadence', 'Cadence and workstreams')}
            </h4>
            <div className="space-y-3">
              <div className="rounded-xl border border-slate-200/70 dark:border-white/[0.08] bg-white/80 dark:bg-white/[0.04] p-3">
                <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
                  {t('executive.aiOperator.executiveBrief', 'Executive brief')}
                </div>
                <div className="text-sm text-slate-800 dark:text-slate-100">
                  {communication?.executiveBrief?.summary ||
                    t('executive.aiOperator.noBrief', 'No brief yet.')}
                </div>
                <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  {(communication?.executiveBrief?.bullets || []).slice(0, 3).join(' • ')}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {workstreams.map((item: any) => (
                  <span
                    key={item.key}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium ${statusTone[item.status || 'partial']}`}
                  >
                    <span>{item.label}</span>
                    <span>{item.coveragePct}%</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/70 dark:border-white/[0.08] p-4 bg-slate-50/70 dark:bg-white/[0.03]">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                {t('executive.aiOperator.sequence', 'Operator sequence')}
              </h4>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {plan?.objective || t('executive.aiOperator.noPlan', 'No operator plan yet.')}
              </div>
            </div>
            <span
              className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-medium ${statusTone[(plan?.progressPct || 0) >= 70 ? 'ready' : (plan?.progressPct || 0) >= 40 ? 'partial' : 'blocked']}`}
            >
              {plan?.progressPct || 0}%
            </span>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="space-y-2">
              {Array.isArray(plan?.nodes) && plan.nodes.length ? (
                plan.nodes.slice(0, 6).map((node: any) => (
                  <div
                    key={node.key}
                    className="rounded-xl border border-slate-200/70 dark:border-white/[0.08] bg-white/80 dark:bg-white/[0.04] p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-900 dark:text-white">
                          {node.title}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          {node.description}
                        </div>
                      </div>
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusTone[node.status === 'done' ? 'ready' : node.status === 'in_progress' ? 'partial' : 'watch']}`}
                      >
                        {node.status}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        {node.ownerTrack}
                      </span>
                      {node.interventionTemplateKey && node.isInterventionAvailable ? (
                        <button
                          type="button"
                          disabled={busyActionId === node.interventionTemplateKey}
                          onClick={() =>
                            onProposeIntervention?.(String(node.interventionTemplateKey))
                          }
                          // Secondary (quiet) — the primary action on this card is
                          // the approval queue; sequence "Intervene" only proposes.
                          className="inline-flex items-center h-7 px-2.5 rounded-full border border-slate-200 dark:border-white/[0.12] text-slate-700 dark:text-slate-200 text-[11px] font-medium hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors disabled:opacity-60"
                        >
                          {t('executive.aiOperator.intervene', 'Intervene')}
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  {t(
                    'executive.aiOperator.noSequence',
                    'Sequence plan has not been generated yet.'
                  )}
                </div>
              )}
            </div>
            <div className="space-y-3">
              <div className="rounded-xl border border-slate-200/70 dark:border-white/[0.08] bg-white/80 dark:bg-white/[0.04] p-3">
                <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
                  {t('executive.aiOperator.nextMilestone', 'Next milestone')}
                </div>
                <div className="text-sm text-slate-900 dark:text-white">
                  {(() => {
                    // `plan` is a DB-persisted JSON blob; legacy plans store
                    // nextMilestone as { name, targetDate } while current plans
                    // store a plain string. Never render the object raw.
                    const milestone: any = plan?.nextMilestone;
                    if (!milestone) return t('executive.aiOperator.none', 'None');
                    if (typeof milestone === 'string') return milestone;
                    if (typeof milestone === 'object') {
                      const name = milestone.name || milestone.title || '';
                      const date = milestone.targetDate
                        ? new Date(milestone.targetDate).toLocaleDateString()
                        : '';
                      return (
                        [name, date].filter(Boolean).join(' · ') ||
                        t('executive.aiOperator.none', 'None')
                      );
                    }
                    return String(milestone);
                  })()}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200/70 dark:border-white/[0.08] bg-white/80 dark:bg-white/[0.04] p-3">
                <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
                  {t('executive.aiOperator.planBlockers', 'Plan blockers')}
                </div>
                <div className="space-y-1.5">
                  {(plan?.blockers || []).length ? (
                    (plan.blockers || []).slice(0, 4).map((item: string) => (
                      <div key={item} className="text-xs text-slate-600 dark:text-slate-300">
                        {item}
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {t('executive.aiOperator.noBlockers', 'No active plan blockers.')}
                    </div>
                  )}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200/70 dark:border-white/[0.08] bg-white/80 dark:bg-white/[0.04] p-3">
                <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
                  {t('executive.aiOperator.programSummary', 'Program summary')}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(plan?.summary || {}).map(([key, val]) => (
                    <div
                      key={key}
                      className="rounded-lg bg-slate-50 dark:bg-white/[0.03] px-3 py-2"
                    >
                      <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        {key}
                      </div>
                      <div className="text-sm font-medium text-slate-900 dark:text-white">
                        {String(val)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <div className="rounded-xl border border-slate-200/70 dark:border-white/[0.08] p-4 bg-slate-50/70 dark:bg-white/[0.03]">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
              {t('executive.aiOperator.suggestedInterventions', 'Suggested interventions')}
            </h4>
            <div className="space-y-2">
              {suggestedInterventions.length ? (
                suggestedInterventions.map((item: any) => (
                  <div
                    key={item.templateKey}
                    className="rounded-xl border border-slate-200/70 dark:border-white/[0.08] bg-white/80 dark:bg-white/[0.04] p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-900 dark:text-white">
                          {item.title}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          {item.summary}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={busyActionId === item.templateKey}
                        onClick={() => onProposeIntervention?.(String(item.templateKey))}
                        // Secondary (quiet) — proposing queues an item; the
                        // primary decision (Accept/Execute) lives in the queue.
                        className="inline-flex items-center h-8 px-3 rounded-full border border-slate-200 dark:border-white/[0.12] text-slate-700 dark:text-slate-200 text-xs font-medium hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors disabled:opacity-60"
                      >
                        {busyActionId === item.templateKey
                          ? t('executive.aiOperator.working', 'Working...')
                          : t('executive.aiOperator.propose', 'Propose')}
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  {t('executive.aiOperator.noInterventions', 'No new interventions to propose.')}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/70 dark:border-white/[0.08] p-4 bg-slate-50/70 dark:bg-white/[0.03]">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
              {t('executive.aiOperator.approvalQueue', 'Approval queue')}
            </h4>
            <div className="space-y-2">
              {interventionQueue.length ? (
                interventionQueue.map((item: any) => {
                  const status = String(item.status || 'proposed');
                  const disabled = busyActionId === item.actionId;
                  return (
                    <div
                      key={item.actionId || item.interventionId}
                      className="rounded-xl border border-slate-200/70 dark:border-white/[0.08] bg-white/80 dark:bg-white/[0.04] p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-slate-900 dark:text-white">
                            {item.title}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            {item.previewDiff || status}
                          </div>
                        </div>
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            status === 'executed'
                              ? statusTone.ready
                              : status === 'accepted'
                                ? statusTone.partial
                                : status === 'rejected'
                                  ? statusTone.blocked
                                  : statusTone.watch
                          }`}
                        >
                          {status}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {status === 'proposed' ? (
                          <>
                            <button
                              type="button"
                              disabled={disabled}
                              onClick={() =>
                                item.actionId && onAcceptIntervention?.(String(item.actionId))
                              }
                              className="inline-flex items-center h-8 px-3 rounded-full bg-emerald-600 text-white text-xs font-medium disabled:opacity-60"
                            >
                              {t('executive.aiOperator.accept', 'Accept')}
                            </button>
                            <button
                              type="button"
                              disabled={disabled}
                              onClick={() =>
                                item.actionId && onRejectIntervention?.(String(item.actionId))
                              }
                              className="inline-flex items-center h-8 px-3 rounded-full border border-slate-200 dark:border-white/[0.08] text-xs font-medium disabled:opacity-60"
                            >
                              {t('executive.aiOperator.reject', 'Reject')}
                            </button>
                          </>
                        ) : null}
                        {status === 'accepted' ? (
                          <button
                            type="button"
                            disabled={disabled}
                            onClick={() =>
                              item.actionId && onExecuteIntervention?.(String(item.actionId))
                            }
                            className="inline-flex items-center h-8 px-3 rounded-full bg-navy-900 text-white text-xs font-medium disabled:opacity-60"
                          >
                            {t('executive.aiOperator.execute', 'Execute')}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  {t('executive.aiOperator.noQueue', 'No interventions in the approval queue.')}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const MetricCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  sublabel: string;
  tone: string;
}> = ({ icon, label, value, sublabel, tone }) => (
  <div className="rounded-xl border border-slate-200/70 dark:border-white/[0.08] bg-slate-50/70 dark:bg-white/[0.03] p-4">
    <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
      {icon}
      <span>{label}</span>
    </div>
    <div className="mt-2 flex items-end justify-between gap-2">
      <div className="text-base font-semibold text-slate-900 dark:text-white">{value}</div>
      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${tone}`}>
        {sublabel}
      </span>
    </div>
  </div>
);

export default AIOperatorOverviewCard;
