/**
 * SkillsGapSection (T066)
 *
 * Displays skills gap analysis within an initiative detail view.
 * Three tab-views: by Requirement, by Person, summary.
 * Shows "unknown coverage" callout when team members lack profiles.
 */

import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  CheckCircle,
  HelpCircle,
  Users,
  UserX,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { LoadingState } from '@/components/ui/primitives';
import { trackFunnelEvent } from '@/services/funnelAnalytics';

import { useInitiativeContext } from './InitiativeContext';
import type { InitiativeSectionProps } from './types';

interface RequirementGap {
  requirementId: string;
  capabilityId: string;
  capabilityName: string;
  categoryName: string | null;
  minLevel: number;
  priority: 'required' | 'nice_to_have';
  headcount: number | null;
  status: 'covered' | 'partial' | 'missing' | 'unknown';
  bestAvailableLevel: number;
  coveredBy: { userId: string; firstName: string; lastName: string; level: number }[];
  recommendation: string | null;
}

interface PersonGap {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  hasProfile: boolean;
  capabilities: { capabilityId: string; capabilityName: string; level: number }[];
  gaps: { capabilityId: string; capabilityName: string; required: number; actual: number }[];
}

interface GapSummary {
  initiativeId: string;
  initiativeName: string;
  totalRequirements: number;
  covered: number;
  partial: number;
  missing: number;
  unknown: number;
  teamSize: number;
  profilesComplete: number;
  requirements: RequirementGap[];
  persons: PersonGap[];
  unknownCoveragePercent: number;
}

const API_URL = '/api';

async function apiFetch<T>(url: string, opts?: RequestInit): Promise<T> {
  const token = localStorage.getItem('token') || '';
  const res = await fetch(`${API_URL}${url}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(opts?.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

type ViewTab = 'requirements' | 'persons' | 'summary';

const STATUS_CONFIG = {
  covered: {
    icon: CheckCircle,
    color: 'text-emerald-500',
    bg: 'bg-emerald-50 dark:bg-emerald-500/10',
    border: 'border-emerald-200 dark:border-emerald-500/20',
  },
  partial: {
    icon: AlertTriangle,
    color: 'text-amber-500',
    bg: 'bg-amber-50 dark:bg-amber-500/10',
    border: 'border-amber-200 dark:border-amber-500/20',
  },
  missing: {
    icon: XCircle,
    color: 'text-danger-500',
    bg: 'bg-danger-50 dark:bg-danger-500/10',
    border: 'border-danger-200 dark:border-danger-500/20',
  },
  unknown: {
    icon: HelpCircle,
    color: 'text-slate-600',
    bg: 'bg-slate-50 dark:bg-slate-500/10',
    border: 'border-slate-200 dark:border-slate-500/20',
  },
};

const RECOMMENDATION_LABELS: Record<string, { en: string; pl: string; color: string }> = {
  hire: { en: 'Hire', pl: 'Rekrutuj', color: 'text-danger-600 bg-danger-50 dark:bg-danger-500/10' },
  train: { en: 'Train', pl: 'Szkolenie', color: 'text-blue-600 bg-blue-50 dark:bg-blue-500/10' },
  outsource: {
    en: 'Outsource',
    pl: 'Outsource',
    color: 'text-c-info bg-c-info/10 dark:bg-c-info/10',
  },
  resequence: {
    en: 'Resequence',
    pl: 'Przesekwencjonuj',
    color: 'text-amber-600 bg-amber-50 dark:bg-amber-500/10',
  },
};

export const SkillsGapSection: React.FC<InitiativeSectionProps> = () => {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language === 'pl';
  const { initiativeId } = useInitiativeContext();

  const [gap, setGap] = useState<GapSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ViewTab>('requirements');

  const loadGap = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch<{ gap: GapSummary }>(`/skills-gap/initiatives/${initiativeId}`);
      setGap(res.gap);
      trackFunnelEvent('skills_gap_viewed', { initiativeId, scope: 'initiative' });
    } catch {
      // may not have requirements yet
    } finally {
      setLoading(false);
    }
  }, [initiativeId]);

  useEffect(() => {
    if (initiativeId) loadGap();
  }, [initiativeId, loadGap]);

  if (loading) {
    return <LoadingState variant="spinner" className="py-8" />;
  }

  if (!gap || gap.totalRequirements === 0) {
    return (
      <div className="text-center py-8 text-slate-600 dark:text-slate-500 text-sm">
        <BarChart3 size={24} className="mx-auto mb-2 opacity-50" />
        {t('skillsGap.empty', 'Add competency requirements to see gap analysis')}
      </div>
    );
  }

  const tabs: { key: ViewTab; label: string; icon: React.ElementType }[] = [
    {
      key: 'requirements',
      label: t('skillsGap.tabs.requirements', 'By Requirement'),
      icon: BookOpen,
    },
    { key: 'persons', label: t('skillsGap.tabs.persons', 'By Person'), icon: Users },
    { key: 'summary', label: t('skillsGap.tabs.summary', 'Summary'), icon: BarChart3 },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 size={16} className="text-c-info" />
          <h3 className="text-sm font-semibold text-navy-900 dark:text-white">
            {t('skillsGap.title', 'Skills Gap Analysis')}
          </h3>
        </div>
      </div>

      {/* Unknown coverage callout */}
      {gap.unknownCoveragePercent > 0 && (
        <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-500/10 border border-slate-200 dark:border-slate-500/20 rounded-lg">
          <UserX size={16} className="text-slate-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
              {t('skillsGap.unknownCoverage.title', 'Unknown coverage')}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {t('skillsGap.unknownCoverage.description', {
                defaultValue:
                  '{{count}} of {{total}} team members have no competency profile. Gap analysis may be incomplete.',
                count: gap.teamSize - gap.profilesComplete,
                total: gap.teamSize,
              })}
            </p>
          </div>
        </div>
      )}

      {/* Quick stats */}
      <div className="grid grid-cols-4 gap-2">
        {(['covered', 'partial', 'missing', 'unknown'] as const).map((status) => {
          const cfg = STATUS_CONFIG[status];
          const Icon = cfg.icon;
          const count = gap[status];
          return (
            <div
              key={status}
              className={`${cfg.bg} border ${cfg.border} rounded-lg p-2 text-center`}
            >
              <Icon size={14} className={`mx-auto ${cfg.color} mb-1`} />
              <div className="text-lg font-bold text-navy-900 dark:text-white">{count}</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 capitalize">
                {t(`skillsGap.status.${status}`, status)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 dark:border-navy-700">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              activeTab === key
                ? 'border-c-info text-c-info dark:text-c-info'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'requirements' && <RequirementsView gap={gap} isPl={isPl} />}
      {activeTab === 'persons' && <PersonsView gap={gap} />}
      {activeTab === 'summary' && <SummaryView gap={gap} />}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Tab: By Requirement                                                */
/* ------------------------------------------------------------------ */

const RequirementsView: React.FC<{ gap: GapSummary; isPl: boolean }> = ({ gap, isPl }) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-2">
      {gap.requirements.map((req) => {
        const cfg = STATUS_CONFIG[req.status];
        const Icon = cfg.icon;
        const recLabel = req.recommendation ? RECOMMENDATION_LABELS[req.recommendation] : null;

        return (
          <div key={req.requirementId} className={`${cfg.bg} border ${cfg.border} rounded-lg p-3`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon size={14} className={cfg.color} />
                <span className="text-xs font-medium text-navy-900 dark:text-white">
                  {req.capabilityName}
                </span>
                {req.categoryName && (
                  <span className="text-[10px] text-slate-600 px-1.5 py-0.5 rounded bg-white/60 dark:bg-navy-800/60">
                    {req.categoryName}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {req.priority === 'required' && (
                  <span className="text-[10px] font-medium text-danger-600 dark:text-danger-400">
                    {t('skillsGap.mustHave', 'Must-have')}
                  </span>
                )}
                <span className="text-xs font-mono text-slate-600 dark:text-slate-400">
                  {t('skillsGap.levelRequired', {
                    defaultValue: 'L{{level}}',
                    level: req.minLevel,
                  })}
                  {req.bestAvailableLevel > 0 && (
                    <span className="text-slate-600">
                      {' '}
                      / {t('skillsGap.best', 'best')} L{req.bestAvailableLevel}
                    </span>
                  )}
                </span>
              </div>
            </div>

            {req.coveredBy.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {req.coveredBy.map((person) => (
                  <span
                    key={person.userId}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-white/70 dark:bg-navy-800/70 text-slate-600 dark:text-slate-400"
                  >
                    {person.firstName} {person.lastName} (L{person.level})
                  </span>
                ))}
              </div>
            )}

            {recLabel && (
              <div className="mt-2">
                <span
                  className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${recLabel.color}`}
                >
                  {isPl ? recLabel.pl : recLabel.en}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Tab: By Person                                                     */
/* ------------------------------------------------------------------ */

const PersonsView: React.FC<{ gap: GapSummary }> = ({ gap }) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-2">
      {gap.persons.map((person) => (
        <div
          key={person.userId}
          className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg p-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  person.hasProfile
                    ? 'bg-c-info/10 dark:bg-c-info/20 text-c-info dark:text-c-info'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600'
                }`}
              >
                {person.firstName?.[0]}
                {person.lastName?.[0]}
              </div>
              <div>
                <span className="text-xs font-medium text-navy-900 dark:text-white">
                  {person.firstName} {person.lastName}
                </span>
                {!person.hasProfile && (
                  <span className="ml-2 text-[10px] text-slate-600 italic">
                    {t('skillsGap.noProfile', 'No profile')}
                  </span>
                )}
              </div>
            </div>
            <div className="text-xs text-slate-500">
              {person.gaps.length === 0
                ? t('skillsGap.noGaps', 'No gaps')
                : t('skillsGap.gapCount', {
                    defaultValue: '{{count}} gap(s)',
                    count: person.gaps.length,
                  })}
            </div>
          </div>

          {person.gaps.length > 0 && (
            <div className="mt-2 space-y-1">
              {person.gaps.map((g) => (
                <div
                  key={g.capabilityId}
                  className="flex items-center justify-between text-[10px] px-2 py-1 rounded bg-danger-50 dark:bg-danger-500/10"
                >
                  <span className="text-danger-700 dark:text-danger-400">{g.capabilityName}</span>
                  <span className="text-danger-500 font-mono">
                    L{g.actual} &rarr; L{g.required}
                  </span>
                </div>
              ))}
            </div>
          )}

          {person.capabilities.length > 0 && person.gaps.length === 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {person.capabilities.map((c) => (
                <span
                  key={c.capabilityId}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                >
                  {c.capabilityName} L{c.level}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}

      {gap.persons.length === 0 && (
        <div className="text-center py-6 text-slate-600 text-xs">
          {t('skillsGap.noTeam', 'No team members assigned to this initiative')}
        </div>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Tab: Summary                                                       */
/* ------------------------------------------------------------------ */

const SummaryView: React.FC<{ gap: GapSummary }> = ({ gap }) => {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language === 'pl';
  const total = gap.totalRequirements || 1;

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-xs text-slate-500 mb-1">
          <span>{t('skillsGap.summary.readiness', 'Readiness')}</span>
          <span>{Math.round((gap.covered / total) * 100)}%</span>
        </div>
        <div className="h-3 bg-slate-100 dark:bg-navy-800 rounded-full overflow-hidden flex">
          {gap.covered > 0 && (
            <div
              className="bg-emerald-500 transition-all"
              style={{ width: `${(gap.covered / total) * 100}%` }}
            />
          )}
          {gap.partial > 0 && (
            <div
              className="bg-amber-400 transition-all"
              style={{ width: `${(gap.partial / total) * 100}%` }}
            />
          )}
          {gap.missing > 0 && (
            <div
              className="bg-danger-500 transition-all"
              style={{ width: `${(gap.missing / total) * 100}%` }}
            />
          )}
          {gap.unknown > 0 && (
            <div
              className="bg-slate-300 dark:bg-slate-600 transition-all"
              style={{ width: `${(gap.unknown / total) * 100}%` }}
            />
          )}
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg p-3">
          <div className="text-xs text-slate-500 mb-1">
            {t('skillsGap.summary.teamSize', 'Team Size')}
          </div>
          <div className="text-lg font-bold text-navy-900 dark:text-white">{gap.teamSize}</div>
          <div className="text-[10px] text-slate-600">
            {gap.profilesComplete} {t('skillsGap.summary.withProfiles', 'with profiles')}
          </div>
        </div>
        <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg p-3">
          <div className="text-xs text-slate-500 mb-1">
            {t('skillsGap.summary.mustHaveGaps', 'Must-Have Gaps')}
          </div>
          <div className="text-lg font-bold text-danger-600 dark:text-danger-400">
            {
              gap.requirements.filter((r) => r.priority === 'required' && r.status !== 'covered')
                .length
            }
          </div>
          <div className="text-[10px] text-slate-600">
            {t('skillsGap.summary.ofMustHave', {
              defaultValue: 'of {{total}} must-have',
              total: gap.requirements.filter((r) => r.priority === 'required').length,
            })}
          </div>
        </div>
      </div>

      {/* Top actions needed */}
      <div>
        <h4 className="text-xs font-semibold text-navy-900 dark:text-white mb-2">
          {t('skillsGap.summary.actions', 'Recommended Actions')}
        </h4>
        <div className="space-y-1">
          {gap.requirements
            .filter((r) => r.recommendation && r.status !== 'covered')
            .slice(0, 5)
            .map((r) => {
              const rec = RECOMMENDATION_LABELS[r.recommendation!];
              return (
                <div
                  key={r.requirementId}
                  className="flex items-center justify-between text-xs px-3 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg"
                >
                  <span className="text-navy-900 dark:text-white">{r.capabilityName}</span>
                  <span
                    className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${rec?.color || ''}`}
                  >
                    {rec ? (isPl ? rec.pl : rec.en) : r.recommendation}
                  </span>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
};

export default SkillsGapSection;
