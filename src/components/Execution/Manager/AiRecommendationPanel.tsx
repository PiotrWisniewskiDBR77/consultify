/**
 * AiRecommendationPanel — slide-over panel displaying AI-generated recommendations.
 *
 * Supports three modes:
 * - "recommend": Single-problem recommendation (diagnosis + steps + alternative)
 * - "triage": Clustered & prioritized view of all problems
 * - "manage-all": Full management plan with clusters, quick wins, escalations
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Loader2,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  V8ExecutionControlApi,
  type V8AiManageAllResult,
  type V8AiRecommendation,
  type V8AiStep,
  type V8AiTriageResult,
} from '../../../services/api/v8/execution-control';

type PanelMode = 'recommend' | 'triage' | 'manage-all';

interface AiRecommendationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  mode: PanelMode;
  laneId: string;
  problemId?: string;
  projectId?: string;
}

const SEVERITY_COLORS: Record<string, { dot: string; bg: string; text: string }> = {
  critical: { dot: 'bg-rose-500', bg: 'bg-rose-50 dark:bg-rose-900/20', text: 'text-rose-700 dark:text-rose-400' },
  warning: { dot: 'bg-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-400' },
  info: { dot: 'bg-sky-500', bg: 'bg-sky-50 dark:bg-sky-900/20', text: 'text-sky-700 dark:text-sky-400' },
};

/* ── Sub-components ─────────────────────────────────────────────────────── */

const StepCard: React.FC<{ step: V8AiStep }> = ({ step }) => (
  <div className="flex gap-3 rounded-lg border border-slate-200/70 p-3 dark:border-white/[0.06]">
    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-100 text-[11px] font-bold text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400">
      {step.order}
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-[12px] font-medium text-slate-900 dark:text-white">{step.action}</p>
      <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-slate-500 dark:text-slate-400">
        <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 dark:bg-navy-800">
          👤 {step.owner}
        </span>
        <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 dark:bg-navy-800">
          ⏱ {step.timeframe}
        </span>
      </div>
      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">→ {step.outcome}</p>
    </div>
  </div>
);

const ConfidenceBadge: React.FC<{ value: number }> = ({ value }) => {
  const color =
    value >= 75 ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20' :
    value >= 50 ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20' :
    'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${color}`}>
      AI Confidence: {value}%
    </span>
  );
};

const SeverityBadge: React.FC<{ severity: string }> = ({ severity }) => {
  const c = SEVERITY_COLORS[severity] || SEVERITY_COLORS.info;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${c.bg} ${c.text}`}>
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
    <div className="border-b border-slate-100 dark:border-white/[0.04]">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left"
      >
        {open ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{title}</span>
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

/* ── Recommend view ─────────────────────────────────────────────────────── */

const RecommendView: React.FC<{ data: V8AiRecommendation }> = ({ data }) => (
  <div className="space-y-0">
    <CollapsibleSection title="Diagnosis">
      <p className="text-[12px] leading-relaxed text-slate-700 dark:text-slate-300">{data.diagnosis}</p>
    </CollapsibleSection>

    <CollapsibleSection title="Recommendation" badge={<ConfidenceBadge value={data.confidence} />}>
      <div className="rounded-lg border border-cyan-200 bg-cyan-50/50 p-3 dark:border-cyan-800/40 dark:bg-cyan-900/10">
        <p className="text-[12px] font-medium leading-relaxed text-cyan-800 dark:text-cyan-300">{data.recommendation}</p>
      </div>
    </CollapsibleSection>

    <CollapsibleSection title="Action Steps">
      <div className="space-y-2">
        {data.steps.map((s) => <StepCard key={s.order} step={s} />)}
      </div>
    </CollapsibleSection>

    <CollapsibleSection title="Reasoning">
      <p className="text-[12px] leading-relaxed text-slate-600 dark:text-slate-400">{data.reasoning}</p>
    </CollapsibleSection>

    <CollapsibleSection title="Alternative Approach" defaultOpen={false}>
      <p className="text-[12px] leading-relaxed text-slate-600 dark:text-slate-400">{data.alternativeApproach}</p>
    </CollapsibleSection>
  </div>
);

/* ── Triage view ────────────────────────────────────────────────────────── */

const TriageView: React.FC<{ data: V8AiTriageResult }> = ({ data }) => (
  <div className="space-y-0">
    <CollapsibleSection title="Executive Summary">
      <p className="text-[12px] leading-relaxed text-slate-700 dark:text-slate-300">{data.executiveSummary}</p>
    </CollapsibleSection>

    <CollapsibleSection title="Top Priority" badge={
      <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700 dark:bg-rose-900/20 dark:text-rose-400">
        {data.topPriority.length} items
      </span>
    }>
      <div className="space-y-1">
        {data.topPriority.map((id) => (
          <div key={id} className="flex items-center gap-2 rounded bg-rose-50/50 px-2 py-1 text-[11px] text-rose-700 dark:bg-rose-900/10 dark:text-rose-400">
            <AlertTriangle size={12} />
            {id}
          </div>
        ))}
      </div>
    </CollapsibleSection>

    <CollapsibleSection title={`Clusters (${data.clusters.length})`}>
      <div className="space-y-3">
        {data.clusters.map((cluster, idx) => (
          <div key={idx} className="rounded-lg border border-slate-200/70 p-3 dark:border-white/[0.06]">
            <div className="mb-1.5 flex items-center gap-2">
              <SeverityBadge severity={cluster.severity} />
              <span className="text-[12px] font-semibold text-slate-900 dark:text-white">{cluster.theme}</span>
              <span className="ml-auto text-[10px] text-slate-400">{cluster.problemIds.length} problems</span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">{cluster.summary}</p>
            <div className="mt-2 flex items-center gap-1.5 rounded bg-cyan-50/50 px-2 py-1 text-[11px] text-cyan-700 dark:bg-cyan-900/10 dark:text-cyan-400">
              <ArrowRight size={10} />
              {cluster.suggestedAction}
            </div>
          </div>
        ))}
      </div>
    </CollapsibleSection>
  </div>
);

/* ── Manage-All view ────────────────────────────────────────────────────── */

const ManageAllView: React.FC<{ data: V8AiManageAllResult }> = ({ data }) => (
  <div className="space-y-0">
    <CollapsibleSection title="Executive Summary">
      <p className="text-[12px] leading-relaxed text-slate-700 dark:text-slate-300">{data.executiveSummary}</p>
    </CollapsibleSection>

    {data.quickWins.length > 0 && (
      <CollapsibleSection title="Quick Wins" badge={
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
          <Zap size={10} className="mr-0.5 inline" />{data.quickWins.length}
        </span>
      }>
        <div className="space-y-1.5">
          {data.quickWins.map((qw, i) => (
            <div key={i} className="flex items-start gap-2 rounded bg-emerald-50/50 px-2.5 py-1.5 text-[11px] text-emerald-700 dark:bg-emerald-900/10 dark:text-emerald-400">
              <CheckCircle2 size={12} className="mt-0.5 shrink-0" />
              {qw}
            </div>
          ))}
        </div>
      </CollapsibleSection>
    )}

    {data.escalationNeeded.length > 0 && (
      <CollapsibleSection title="Escalation Needed" badge={
        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700 dark:bg-rose-900/20 dark:text-rose-400">
          {data.escalationNeeded.length}
        </span>
      }>
        <div className="space-y-1.5">
          {data.escalationNeeded.map((esc, i) => (
            <div key={i} className="flex items-start gap-2 rounded bg-rose-50/50 px-2.5 py-1.5 text-[11px] text-rose-700 dark:bg-rose-900/10 dark:text-rose-400">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" />
              {esc}
            </div>
          ))}
        </div>
      </CollapsibleSection>
    )}

    <CollapsibleSection title={`Action Clusters (${data.clusters.length})`}>
      <div className="space-y-4">
        {data.clusters.map((cluster, idx) => (
          <div key={idx} className="rounded-lg border border-slate-200/70 p-3 dark:border-white/[0.06]">
            <div className="mb-2 flex items-center gap-2">
              <SeverityBadge severity={cluster.severity} />
              <span className="text-[12px] font-semibold text-slate-900 dark:text-white">{cluster.theme}</span>
              <span className="ml-auto text-[10px] text-slate-400">{cluster.affectedProblemIds.length} problems</span>
            </div>
            <p className="mb-2 text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">{cluster.diagnosis}</p>
            <div className="space-y-2">
              {cluster.steps.map((s) => <StepCard key={s.order} step={s} />)}
            </div>
          </div>
        ))}
      </div>
    </CollapsibleSection>
  </div>
);

/* ── Main panel ─────────────────────────────────────────────────────────── */

const MODE_TITLES: Record<PanelMode, string> = {
  recommend: 'AI Recommendation',
  triage: 'AI Triage & Prioritization',
  'manage-all': 'AI Management Plan',
};

export const AiRecommendationPanel: React.FC<AiRecommendationPanelProps> = ({
  isOpen,
  onClose,
  mode,
  laneId,
  problemId,
  projectId,
}) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recommendData, setRecommendData] = useState<V8AiRecommendation | null>(null);
  const [triageData, setTriageData] = useState<V8AiTriageResult | null>(null);
  const [manageAllData, setManageAllData] = useState<V8AiManageAllResult | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (mode === 'recommend' && problemId) {
        const resp = await V8ExecutionControlApi.getAiRecommendation(laneId, problemId, projectId);
        setRecommendData((resp as any)?.data || resp as any);
      } else if (mode === 'triage') {
        const resp = await V8ExecutionControlApi.getAiTriage(laneId, projectId);
        setTriageData((resp as any)?.data || resp as any);
      } else if (mode === 'manage-all') {
        const resp = await V8ExecutionControlApi.getAiManageAll(laneId, projectId);
        setManageAllData((resp as any)?.data || resp as any);
      }
    } catch (err: any) {
      setError(err?.message || 'AI analysis failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [mode, laneId, problemId, projectId]);

  useEffect(() => {
    if (isOpen) {
      setRecommendData(null);
      setTriageData(null);
      setManageAllData(null);
      fetchData();
    }
  }, [isOpen, fetchData]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/20 backdrop-blur-[2px] dark:bg-black/40"
        onClick={onClose}
      >
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="flex w-full max-w-lg flex-col bg-white shadow-2xl dark:bg-navy-900"
        >
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-slate-200/70 px-4 py-3 dark:border-white/[0.06]">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-cyan-500">
              <Sparkles size={16} className="text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                {MODE_TITLES[mode]}
              </h2>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">
                {t('execution.manager.ai.powered', 'Powered by AI analysis')}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06]"
            >
              <X size={16} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto">
            {loading && (
              <div className="flex flex-col items-center justify-center gap-3 py-20">
                <Loader2 size={28} className="animate-spin text-cyan-500" />
                <p className="text-[12px] text-slate-500 dark:text-slate-400">
                  {t('execution.manager.ai.analyzing', 'AI is analyzing your data…')}
                </p>
              </div>
            )}

            {error && !loading && (
              <div className="m-4 rounded-lg border border-rose-200 bg-rose-50 p-4 dark:border-rose-800/40 dark:bg-rose-900/10">
                <p className="text-[12px] font-medium text-rose-700 dark:text-rose-400">{error}</p>
                <button
                  type="button"
                  onClick={fetchData}
                  className="mt-2 rounded-lg bg-rose-100 px-3 py-1 text-[11px] font-medium text-rose-700 hover:bg-rose-200 dark:bg-rose-900/20 dark:text-rose-400"
                >
                  {t('common.retry', 'Retry')}
                </button>
              </div>
            )}

            {!loading && !error && mode === 'recommend' && recommendData && (
              <RecommendView data={recommendData} />
            )}
            {!loading && !error && mode === 'triage' && triageData && (
              <TriageView data={triageData} />
            )}
            {!loading && !error && mode === 'manage-all' && manageAllData && (
              <ManageAllView data={manageAllData} />
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default AiRecommendationPanel;
