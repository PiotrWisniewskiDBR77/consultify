import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Heart,
  Loader2,
  Mail,
  MessageSquare,
  Send,
  Star,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState, LoadingState } from '@/components/shared/states';
import Api, { getHeaders } from '@/services/api';
import { trackFunnelEvent } from '@/services/funnelAnalytics';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface PeopleChangeWorkspaceProps {
  initiativeId?: string;
  projectId?: string;
}

interface Capability {
  id: string;
  name: string;
  domain: string;
  description?: string;
  tags: string[];
  isActive: boolean;
}

interface CapabilityRequirement {
  id: string;
  capabilityId: string;
  minLevel: number;
  priority: string;
  initiativeId?: string;
}

interface CandidateMatch {
  userId: string;
  matchScore: number;
  gaps: { capabilityId: string; capabilityName: string; required: number; actual: number }[];
}

interface PulseSummary {
  avgRating: number | null;
  totalResponses: number;
  trend: 'improving' | 'stable' | 'declining' | null;
  distribution: Record<string, number>;
  recentComments: string[];
}

interface ResistanceAlert {
  id: string;
  alertType: string;
  severity: string;
  message: string;
  recommendations: string[];
  isAcknowledged: boolean;
  createdAt: string;
}

interface StakeholderSegment {
  id: string;
  name: string;
  description?: string;
  segmentType?: string;
  membersJson: unknown[];
}

interface CommPlan {
  id: string;
  cadence: string;
  description?: string;
  isActive: boolean;
  nextDueAt?: string;
}

interface CommPlanItem {
  id: string;
  planId: string;
  subject?: string | null;
  status: string;
  segmentIds: string[];
  channel?: string;
}

interface SteercoPack {
  id: string;
  title: string;
  packType: string;
  status: string;
  scheduledDate?: string | null;
  distributedAt?: string | null;
  distributionChannels?: string | null;
}

interface SendLogEntry {
  id: string;
  channel?: string;
  recipientCount: number;
  sentBy?: string;
  sentAt: string;
}

type SubTab = 'capability' | 'sentiment' | 'communication';

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const PeopleChangeWorkspace: React.FC<PeopleChangeWorkspaceProps> = ({
  initiativeId,
  projectId,
}) => {
  const { t } = useTranslation();
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('capability');

  /* ------------- Capability state ------------- */
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [requirements, setRequirements] = useState<CapabilityRequirement[]>([]);
  const [candidates, setCandidates] = useState<CandidateMatch[]>([]);
  const [capLoading, setCapLoading] = useState(false);

  /* ------------- Sentiment state ------------- */
  const [pulseSummary, setPulseSummary] = useState<PulseSummary | null>(null);
  const [alerts, setAlerts] = useState<ResistanceAlert[]>([]);
  const [pulseRating, setPulseRating] = useState(0);
  const [pulseComment, setPulseComment] = useState('');
  const [submittingPulse, setSubmittingPulse] = useState(false);
  const [sentLoading, setSentLoading] = useState(false);

  /* ------------- Communication state ------------- */
  const [segments, setSegments] = useState<StakeholderSegment[]>([]);
  const [plans, setPlans] = useState<CommPlan[]>([]);
  const [planItemsByPlanId, setPlanItemsByPlanId] = useState<Record<string, CommPlanItem[]>>({});
  const [steercoPacks, setSteercoPacks] = useState<SteercoPack[]>([]);
  const [overduePlans, setOverduePlans] = useState<CommPlan[]>([]);
  const [sendLog, setSendLog] = useState<SendLogEntry[]>([]);
  const [commLoading, setCommLoading] = useState(false);
  const [sendingPlanItemId, setSendingPlanItemId] = useState<string | null>(null);
  const [distributingPackId, setDistributingPackId] = useState<string | null>(null);

  /* ---------------------------------------------------------------- */
  /*  Data fetchers                                                    */
  /* ---------------------------------------------------------------- */

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (initiativeId) p.set('initiativeId', initiativeId);
    if (projectId) p.set('projectId', projectId);
    return p.toString();
  }, [initiativeId, projectId]);

  const fetchCapabilities = useCallback(async () => {
    setCapLoading(true);
    try {
      const [capRes, reqRes] = await Promise.all([
        fetch(`/api/capabilities?${qs}`, { headers: getHeaders() }),
        fetch(`/api/capabilities/requirements?${qs}`, { headers: getHeaders() }),
      ]);
      const capData = await capRes.json();
      const reqData = await reqRes.json();
      setCapabilities(capData.data ?? []);
      setRequirements(reqData.data ?? []);
    } catch {
      /* ignore */
    }
    setCapLoading(false);
  }, [initiativeId, qs]);

  const fetchCandidates = useCallback(async () => {
    try {
      const res = await fetch(`/api/capabilities/match?${qs}`, { headers: getHeaders() });
      const data = await res.json();
      setCandidates(data.data ?? []);
      trackFunnelEvent('capability_match_viewed');
    } catch {
      /* ignore */
    }
  }, [qs]);

  const fetchSentiment = useCallback(async () => {
    setSentLoading(true);
    try {
      const [pulseRes, alertRes] = await Promise.all([
        fetch(`/api/change-sentiment/pulse/summary?${qs}`, { headers: getHeaders() }),
        fetch(`/api/change-sentiment/alerts?${qs}`, { headers: getHeaders() }),
      ]);
      const pulseData = await pulseRes.json();
      const alertData = await alertRes.json();
      setPulseSummary(pulseData.data ?? null);
      setAlerts(alertData.data ?? []);
    } catch {
      /* ignore */
    }
    setSentLoading(false);
  }, [qs]);

  const fetchComm = useCallback(async () => {
    setCommLoading(true);
    try {
      const [nextSegments, nextPlans, nextSteercoPacks, nextOverduePlans, nextSendLog] =
        await Promise.all([
          Api.getStakeholderSegments(initiativeId),
          Api.getStakeholderPlans(initiativeId),
          Api.getSteercoPacks({ initiativeId }),
          Api.getStakeholderOverduePlans(),
          Api.getStakeholderSendLog({ initiativeId, limit: 20 }),
        ]);
      const planItemsEntries = await Promise.all(
        (nextPlans ?? []).map(
          async (plan) => [plan.id, await Api.getStakeholderPlanItems(plan.id)] as const
        )
      );
      setSegments(nextSegments ?? []);
      setPlans(nextPlans ?? []);
      setPlanItemsByPlanId(Object.fromEntries(planItemsEntries));
      setSteercoPacks(nextSteercoPacks ?? []);
      setOverduePlans(nextOverduePlans ?? []);
      setSendLog(nextSendLog ?? []);
    } catch {
      /* ignore */
    }
    setCommLoading(false);
  }, [initiativeId, qs]);

  const getRecipientCountForPlanItem = useCallback(
    (item: CommPlanItem): number => {
      if (!Array.isArray(item.segmentIds) || item.segmentIds.length === 0) return 0;
      return item.segmentIds.reduce((total, segmentId) => {
        const segment = segments.find((candidate) => candidate.id === segmentId);
        return total + (Array.isArray(segment?.membersJson) ? segment.membersJson.length : 0);
      }, 0);
    },
    [segments]
  );

  const handleSendPlanItem = useCallback(
    async (planId: string, item: CommPlanItem) => {
      setSendingPlanItemId(item.id);
      try {
        await Api.sendStakeholderPlanItem(planId, item.id, {
          initiativeId,
          segmentId: item.segmentIds[0],
          recipientCount: getRecipientCountForPlanItem(item),
        });
        await fetchComm();
      } catch {
        /* ignore */
      } finally {
        setSendingPlanItemId(null);
      }
    },
    [fetchComm, getRecipientCountForPlanItem, initiativeId]
  );

  const handleDistributePack = useCallback(
    async (pack: SteercoPack) => {
      const segmentIds = segments.map((segment) => segment.id);
      if (segmentIds.length === 0) return;

      const channels =
        pack.distributionChannels
          ?.split(',')
          .map((value) => value.trim())
          .filter(Boolean) ?? [];

      setDistributingPackId(pack.id);
      try {
        await Api.distributeSteercoPack(pack.id, {
          segmentIds,
          channels: channels.length > 0 ? channels : ['in_app'],
        });
        await fetchComm();
      } catch {
        /* ignore */
      } finally {
        setDistributingPackId(null);
      }
    },
    [fetchComm, segments]
  );

  useEffect(() => {
    if (activeSubTab === 'capability') {
      fetchCapabilities();
    } else if (activeSubTab === 'sentiment') {
      fetchSentiment();
    } else if (activeSubTab === 'communication') {
      fetchComm();
    }
  }, [activeSubTab, fetchCapabilities, fetchSentiment, fetchComm]);

  /* ---------------------------------------------------------------- */
  /*  Handlers                                                         */
  /* ---------------------------------------------------------------- */

  const handleSubmitPulse = async () => {
    if (pulseRating < 1) return;
    setSubmittingPulse(true);
    try {
      await fetch('/api/change-sentiment/pulse', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          initiativeId,
          projectId,
          rating: pulseRating,
          comment: pulseComment || undefined,
          isAnonymous: false,
        }),
      });
      trackFunnelEvent('change_pulse_submitted');
      setPulseRating(0);
      setPulseComment('');
      fetchSentiment();
    } catch {
      /* ignore */
    }
    setSubmittingPulse(false);
  };

  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      await fetch(`/api/change-sentiment/alerts/${alertId}/acknowledge`, {
        method: 'POST',
        headers: getHeaders(),
      });
      trackFunnelEvent('change_resistance_alert_clicked');
      fetchSentiment();
    } catch {
      /* ignore */
    }
  };

  /* ---------------------------------------------------------------- */
  /*  Sub-tab navigation                                               */
  /* ---------------------------------------------------------------- */

  const subTabs: { id: SubTab; label: string; icon: React.ReactNode }[] = [
    {
      id: 'capability',
      label: t('capability.title', 'Capabilities'),
      icon: <BookOpen size={14} />,
    },
    { id: 'sentiment', label: t('change.title', 'Change Pulse'), icon: <Heart size={14} /> },
    {
      id: 'communication',
      label: t('stakeholder.title', 'Communication'),
      icon: <Mail size={14} />,
    },
  ];

  /* ---------------------------------------------------------------- */
  /*  Render: Capability Tab                                           */
  /* ---------------------------------------------------------------- */

  const renderCapabilityTab = () => (
    <div className="space-y-4">
      {/* Catalog Grid */}
      <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {t('capability.catalog', 'Capability Catalog')}
          </h3>
          <span className="text-xs text-slate-500">
            {capabilities.length} {t('capability.items', 'capabilities')}
          </span>
        </div>
        {capLoading ? (
          <LoadingState template="list" rows={3} />
        ) : capabilities.length === 0 ? (
          <EmptyState
            variant="new"
            compact
            title={t('capability.empty', 'No capabilities defined yet.')}
            description={t(
              'capability.emptyDesc',
              'Define capabilities to plan the change effort.',
            )}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {capabilities.map((cap) => (
              <div
                key={cap.id}
                className="border border-slate-200 dark:border-navy-700 rounded-lg p-3"
              >
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {cap.name}
                </div>
                <div className="text-xs text-slate-500 mt-1">{cap.domain}</div>
                {cap.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {cap.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="px-1.5 py-0.5 text-[10px] rounded bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Requirements */}
      <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {t('capability.requirements', 'Requirements')}
          </h3>
          <span className="text-xs text-slate-500">{requirements.length}</span>
        </div>
        {requirements.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-3">
            {t('capability.noRequirements', 'No requirements set.')}
          </p>
        ) : (
          <div className="space-y-2">
            {requirements.map((r) => {
              const cap = capabilities.find((c) => c.id === r.capabilityId);
              return (
                <div
                  key={r.id}
                  className="flex items-center justify-between border-b border-slate-200 dark:border-navy-800 pb-2"
                >
                  <span className="text-sm text-slate-800 dark:text-slate-200">
                    {cap?.name ?? r.capabilityId}
                  </span>
                  <span className="text-xs text-slate-500">
                    {t('capability.minLevel', 'Min Level')}: {r.minLevel} · {r.priority}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Candidate Matching */}
      <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {t('capability.matching', 'Candidate Matching')}
          </h3>
          <button
            type="button"
            onClick={fetchCandidates}
            className="px-3 py-1 text-xs font-medium rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 transition-colors"
          >
            {t('capability.runMatch', 'Run Match')}
          </button>
        </div>
        {candidates.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-3">
            {t('capability.noCandidates', 'Run matching to see candidates.')}
          </p>
        ) : (
          <div className="space-y-2">
            {candidates.map((c) => (
              <div
                key={c.userId}
                className="flex items-center justify-between border-b border-slate-200 dark:border-navy-800 pb-2"
              >
                <div>
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                    {c.userId}
                  </span>
                  {c.gaps.length > 0 && (
                    <span className="ml-2 text-xs text-amber-500">
                      {c.gaps.length} {t('capability.gaps', 'gaps')}
                    </span>
                  )}
                </div>
                <div
                  className={`text-sm font-semibold ${c.matchScore >= 80 ? 'text-green-600' : c.matchScore >= 50 ? 'text-amber-600' : 'text-rose-500'}`}
                >
                  {c.matchScore}%
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  /* ---------------------------------------------------------------- */
  /*  Render: Sentiment Tab                                            */
  /* ---------------------------------------------------------------- */

  const renderSentimentTab = () => (
    <div className="space-y-4">
      {/* Alerts */}
      {alerts.filter((a) => !a.isAcknowledged).length > 0 && (
        <div className="space-y-2">
          {alerts
            .filter((a) => !a.isAcknowledged)
            .map((alert) => (
              <div
                key={alert.id}
                className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl p-3 flex items-start gap-3"
              >
                <AlertTriangle className="text-rose-500 shrink-0 mt-0.5" size={16} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-rose-800 dark:text-rose-300">
                    {alert.message}
                  </div>
                  {alert.recommendations.length > 0 && (
                    <ul className="mt-1 space-y-0.5">
                      {alert.recommendations.map((r, i) => (
                        <li key={i} className="text-xs text-rose-600 dark:text-rose-400">
                          • {r}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleAcknowledgeAlert(alert.id)}
                  className="text-xs text-rose-600 hover:text-rose-800 font-medium shrink-0"
                >
                  {t('change.acknowledge', 'Acknowledge')}
                </button>
              </div>
            ))}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {pulseSummary?.avgRating != null ? pulseSummary.avgRating.toFixed(1) : '–'}
          </div>
          <div className="text-xs text-slate-500 mt-1">{t('change.avgRating', 'Avg Rating')}</div>
        </div>
        <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {pulseSummary?.totalResponses ?? 0}
          </div>
          <div className="text-xs text-slate-500 mt-1">{t('change.responses', 'Responses')}</div>
        </div>
        <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-4 text-center">
          <div className="flex items-center justify-center gap-1">
            {pulseSummary?.trend === 'improving' && (
              <TrendingUp className="text-green-500" size={18} />
            )}
            {pulseSummary?.trend === 'declining' && (
              <TrendingDown className="text-rose-500" size={18} />
            )}
            <span className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {pulseSummary?.trend
                ? t(`change.trend.${pulseSummary.trend}`, pulseSummary.trend)
                : '–'}
            </span>
          </div>
          <div className="text-xs text-slate-500 mt-1">{t('change.trend.label', 'Trend')}</div>
        </div>
      </div>

      {/* Pulse Form */}
      <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
          {t('change.submitPulse', 'Quick Pulse Check-in')}
        </h3>
        <div className="flex items-center gap-1 mb-3">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setPulseRating(n)}
              className={`p-1.5 rounded-lg transition-colors ${pulseRating >= n ? 'text-amber-400' : 'text-slate-600 dark:text-slate-400'}`}
            >
              <Star size={24} fill={pulseRating >= n ? 'currentColor' : 'none'} />
            </button>
          ))}
          <span className="ml-2 text-sm text-slate-500">
            {pulseRating > 0 ? `${pulseRating}/5` : ''}
          </span>
        </div>
        <textarea
          value={pulseComment}
          onChange={(e) => setPulseComment(e.target.value)}
          placeholder={t('change.commentPlaceholder', 'Optional comment...')}
          className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800 text-slate-900 dark:text-slate-100 resize-none"
          rows={2}
        />
        <button
          type="button"
          onClick={handleSubmitPulse}
          disabled={pulseRating < 1 || submittingPulse}
          className="mt-2 px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 transition-colors flex items-center gap-2"
        >
          {submittingPulse ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />}
          {t('change.submit', 'Submit')}
        </button>
      </div>

      {/* Recent Comments */}
      {pulseSummary && pulseSummary.recentComments.length > 0 && (
        <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
            <MessageSquare size={14} className="inline mr-1" />
            {t('change.recentComments', 'Recent Comments')}
          </h3>
          <div className="space-y-2">
            {pulseSummary.recentComments.map((c, i) => (
              <div
                key={i}
                className="text-sm text-slate-700 dark:text-slate-300 border-l-2 border-slate-200 dark:border-navy-600 pl-3"
              >
                {c}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  /* ---------------------------------------------------------------- */
  /*  Render: Communication Tab                                        */
  /* ---------------------------------------------------------------- */

  const renderCommunicationTab = () => (
    <div className="space-y-4">
      {/* Overdue Alerts */}
      {overduePlans.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="text-amber-500" size={14} />
            <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              {t('stakeholder.overdue', 'Overdue Communications')}: {overduePlans.length}
            </span>
          </div>
          <div className="space-y-1">
            {overduePlans.map((p) => (
              <div key={p.id} className="text-xs text-amber-700 dark:text-amber-400">
                {p.description ?? p.cadence} — {t('stakeholder.dueSince', 'due since')}{' '}
                {p.nextDueAt ? new Date(p.nextDueAt).toLocaleDateString() : '?'}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Segments Grid */}
      <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            <Users size={14} className="inline mr-1" />
            {t('stakeholder.segments', 'Stakeholder Segments')}
          </h3>
          <span className="text-xs text-slate-500">{segments.length}</span>
        </div>
        {commLoading ? (
          <LoadingState template="list" rows={3} />
        ) : segments.length === 0 ? (
          <EmptyState
            variant="new"
            compact
            title={t('stakeholder.noSegments', 'No segments defined.')}
            description={t(
              'stakeholder.noSegmentsDesc',
              'Add stakeholder segments to tailor communications.',
            )}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {segments.map((s) => (
              <div
                key={s.id}
                className="border border-slate-200 dark:border-navy-700 rounded-lg p-3"
              >
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {s.name}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {s.segmentType ?? 'general'} ·{' '}
                  {Array.isArray(s.membersJson) ? s.membersJson.length : 0}{' '}
                  {t('stakeholder.members', 'members')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Plans */}
      <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
          {t('stakeholder.plans', 'Communication Plans')}
        </h3>
        {plans.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-3">
            {t('stakeholder.noPlans', 'No communication plans yet.')}
          </p>
        ) : (
          <div className="space-y-2">
            {plans.map((p) => {
              const nextPendingItem = (planItemsByPlanId[p.id] ?? []).find(
                (item) => item.status !== 'sent'
              );
              return (
                <div
                  key={p.id}
                  className="border-b border-slate-200 dark:border-navy-800 pb-2 last:border-b-0"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                        {p.description ?? t('stakeholder.untitled', 'Untitled plan')}
                      </span>
                      <span className="ml-2 text-xs text-slate-500">{p.cadence}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {p.isActive ? (
                        <CheckCircle2 size={14} className="text-green-500" />
                      ) : (
                        <span className="text-xs text-slate-600">
                          {t('stakeholder.inactive', 'Inactive')}
                        </span>
                      )}
                    </div>
                  </div>
                  {nextPendingItem && (
                    <div className="mt-2 flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-xs dark:bg-navy-800/80">
                      <div className="min-w-0">
                        <div className="font-medium text-slate-700 dark:text-slate-200">
                          {nextPendingItem.subject ?? t('stakeholder.nextSend', 'Ready to send')}
                        </div>
                        <div className="mt-0.5 text-slate-500 dark:text-slate-400">
                          {nextPendingItem.channel ?? 'email'} ·{' '}
                          {getRecipientCountForPlanItem(nextPendingItem)}{' '}
                          {t('stakeholder.recipients', 'recipients')}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSendPlanItem(p.id, nextPendingItem)}
                        disabled={sendingPlanItemId === nextPendingItem.id}
                        className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1.5 font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {sendingPlanItemId === nextPendingItem.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Send size={12} />
                        )}
                        {t('stakeholder.sendNow', 'Send now')}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Send Log */}
      <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
          <Send size={14} className="inline mr-1" />
          {t('stakeholder.sendLog', 'Send Log')}
        </h3>
        {sendLog.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-3">
            {t('stakeholder.noSends', 'No communications sent yet.')}
          </p>
        ) : (
          <div className="space-y-2">
            {sendLog.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between text-sm border-b border-slate-200 dark:border-navy-800 pb-2"
              >
                <span className="text-slate-800 dark:text-slate-200">
                  {entry.channel ?? 'email'} · {entry.recipientCount}{' '}
                  {t('stakeholder.recipients', 'recipients')}
                </span>
                <span className="text-xs text-slate-500">
                  {new Date(entry.sentAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SteerCo Packs */}
      <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
          {t('stakeholder.steercoPacks', 'SteerCo Packs')}
        </h3>
        {steercoPacks.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-3">
            {t('stakeholder.noSteercoPacks', 'No steerco packs yet.')}
          </p>
        ) : (
          <div className="space-y-2">
            {steercoPacks.map((pack) => {
              const canDistribute = pack.status !== 'distributed' && segments.length > 0;
              return (
                <div
                  key={pack.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 dark:border-navy-800"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-800 dark:text-slate-200">
                      {pack.title}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {pack.packType} · {pack.status}
                      {pack.distributedAt
                        ? ` · ${t('stakeholder.distributedOn', 'distributed')} ${new Date(pack.distributedAt).toLocaleDateString()}`
                        : ''}
                    </div>
                  </div>
                  {canDistribute && (
                    <button
                      type="button"
                      onClick={() => handleDistributePack(pack)}
                      disabled={distributingPackId === pack.id}
                      className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-sky-700 disabled:opacity-50"
                    >
                      {distributingPackId === pack.id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Send size={12} />
                      )}
                      {t('stakeholder.distributeNow', 'Distribute now')}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  /* ---------------------------------------------------------------- */
  /*  Main render                                                      */
  /* ---------------------------------------------------------------- */

  return (
    <div className="p-4 space-y-4">
      {/* Sub-tab bar */}
      <div className="flex gap-1 bg-slate-100 dark:bg-navy-800 rounded-xl p-1">
        {subTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveSubTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              activeSubTab === tab.id
                ? 'bg-white dark:bg-navy-900 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeSubTab === 'capability' && renderCapabilityTab()}
      {activeSubTab === 'sentiment' && renderSentimentTab()}
      {activeSubTab === 'communication' && renderCommunicationTab()}
    </div>
  );
};

export default PeopleChangeWorkspace;
