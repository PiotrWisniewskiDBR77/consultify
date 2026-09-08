/**
 * AcademyProgress Component
 *
 * Partner Development Academy with certification tracking
 * Aligned with partner trust progression model
 */

import {
  Award,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock,
  GraduationCap,
  Lock,
  Play,
  Star,
  Trophy,
} from 'lucide-react';
import React, { useMemo } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import { AcademyModule, PartnerCertification } from '../../views/partner/types';

interface AcademyProgressProps {
  modules: AcademyModule[];
  certifications: PartnerCertification[];
  onStartModule?: (moduleId: string) => void;
  onViewCertification?: (certId: string) => void;
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  METHODOLOGY: {
    bg: 'bg-slate-200 dark:bg-slate-500/20',
    text: 'text-slate-700 dark:text-slate-300',
    icon: <BookOpen size={14} />,
  },
  SALES: {
    bg: 'bg-emerald-100 dark:bg-emerald-500/20',
    text: 'text-emerald-700 dark:text-emerald-400',
    icon: <Trophy size={14} />,
  },
  TECHNICAL: {
    bg: 'bg-blue-100 dark:bg-blue-500/20',
    text: 'text-blue-700 dark:text-blue-400',
    icon: <GraduationCap size={14} />,
  },
  COMPLIANCE: {
    bg: 'bg-amber-100 dark:bg-amber-500/20',
    text: 'text-amber-700 dark:text-amber-400',
    icon: <Award size={14} />,
  },
};

const CERTIFICATION_COLORS: Record<string, string> = {
  CONSULTIFY_CERTIFIED: 'from-navy-900 to-blue-700',
  CO_SELL_EXPERT: 'from-emerald-500 to-blue-600',
  ENTERPRISE_PARTNER: 'from-amber-500 to-amber-600',
};

/** Etykiety certyfikatow ida przez slownik (PLAN.md §2.6: zakaz renderowania
 *  surowej wartosci enumu i zakaz zaszywania napisu obok koloru). */
function certificationInfo(t: TFunction, type: string) {
  const fallback: Record<string, { label: string; description: string }> = {
    CONSULTIFY_CERTIFIED: {
      label: 'Consultify Certified Partner',
      description: 'Completed all required methodology modules',
    },
    CO_SELL_EXPERT: {
      label: 'Co-Sell Expert',
      description: 'Mastered co-selling best practices and deal registration',
    },
    ENTERPRISE_PARTNER: {
      label: 'Enterprise Partner',
      description: 'Advanced integration patterns and compliance certification',
    },
  };
  const base = fallback[type];
  return {
    color: CERTIFICATION_COLORS[type] || 'from-navy-900 to-blue-700',
    label: base
      ? t(`partner.academy.certifications.${type}.label`, base.label)
      : t('partner.academy.certifications.unknown.label', 'Partner certificate'),
    description: base
      ? t(`partner.academy.certifications.${type}.description`, base.description)
      : t('partner.academy.certifications.unknown.description', 'Certificate details unavailable'),
  };
}

export const AcademyProgress: React.FC<AcademyProgressProps> = ({
  modules,
  certifications,
  onStartModule,
  onViewCertification,
}) => {
  const { t, i18n } = useTranslation();
  // Calculate progress stats
  const stats = useMemo(() => {
    const totalModules = modules.length;
    const completedModules = modules.filter((m) => m.completedAt).length;
    const requiredModules = modules.filter((m) => m.requiredForCertification);
    const completedRequired = requiredModules.filter((m) => m.completedAt).length;

    const totalDuration = modules.reduce((sum, m) => {
      const minutes = parseInt(m.duration.replace(' min', ''));
      return sum + (isNaN(minutes) ? 0 : minutes);
    }, 0);

    const averageScore =
      modules.filter((m) => m.score).reduce((sum, m) => sum + (m.score || 0), 0) /
      Math.max(modules.filter((m) => m.score).length, 1);

    return {
      totalModules,
      completedModules,
      requiredModules: requiredModules.length,
      completedRequired,
      totalDuration,
      averageScore: Math.round(averageScore),
      progressPercent: Math.round((completedModules / totalModules) * 100),
      certificationReady: completedRequired === requiredModules.length,
    };
  }, [modules]);

  // Group modules by category
  const modulesByCategory = useMemo(() => {
    const grouped: Record<string, AcademyModule[]> = {};
    modules.forEach((module) => {
      if (!grouped[module.category]) {
        grouped[module.category] = [];
      }
      grouped[module.category].push(module);
    });
    return grouped;
  }, [modules]);

  return (
    <div className="space-y-6">
      {/* Progress Overview */}
      <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-c-surface to-c-surface-raised p-6 dark:border-navy-700">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-sm dark:bg-navy-900">
              <GraduationCap size={24} className="text-c-text" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-navy-900 dark:text-white">
                {t('partner.academy.title', 'Partner Development Academy')}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t('partner.academy.subtitle', 'Build expertise in the Consultify methodology')}
              </p>
            </div>
          </div>
          {stats.certificationReady && (
            <div className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
              <CheckCircle2 size={12} className="mr-1 inline" />
              {t('partner.academy.certificationReady', 'Certification ready')}
            </div>
          )}
        </div>

        {/* Stats Grid */}
        <div className="mb-4 grid gap-4 md:grid-cols-4">
          <StatCard
            icon={<BookOpen size={16} />}
            label={t('partner.academy.stats.modulesCompleted', 'Modules completed')}
            value={`${stats.completedModules}/${stats.totalModules}`}
          />
          <StatCard
            icon={<Clock size={16} />}
            label={t('partner.academy.stats.totalDuration', 'Total duration')}
            value={t('partner.academy.stats.minutes', '{{count}} min', {
              count: stats.totalDuration,
            })}
          />
          <StatCard
            icon={<Star size={16} />}
            label={t('partner.academy.stats.averageScore', 'Average score')}
            value={stats.averageScore > 0 ? `${stats.averageScore}%` : '—'}
          />
          <StatCard
            icon={<Award size={16} />}
            label={t('partner.academy.stats.certifications', 'Certifications')}
            value={certifications.length.toString()}
          />
        </div>

        {/* Progress Bar */}
        <div>
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="text-slate-600 dark:text-slate-300">
              {t('partner.academy.overallProgress', 'Overall progress')}
            </span>
            <span className="font-semibold text-navy-900 dark:text-white">
              {stats.progressPercent}%
            </span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-white/80 dark:bg-navy-900/60">
            <div
              className="h-full rounded-full bg-gradient-to-r from-navy-900 to-blue-600 transition-all duration-500"
              style={{ width: `${stats.progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Certifications */}
      {certifications.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white/90 p-6 dark:border-navy-700 dark:bg-navy-900/60">
          <h4 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            {t('partner.academy.yourCertifications', 'Your certifications')}
          </h4>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {certifications.map((cert) => {
              const info = certificationInfo(t, cert.type);
              return (
                <div
                  key={cert.id}
                  onClick={() => onViewCertification?.(cert.id)}
                  className={`cursor-pointer rounded-xl bg-gradient-to-br ${info.color} p-4 text-white shadow-lg transition hover:shadow-xl`}
                >
                  <div className="mb-3 flex items-center gap-2">
                    <Trophy size={20} />
                    <span className="text-xs font-medium text-white/80">
                      {t('partner.academy.certified', 'Certified')}
                    </span>
                  </div>
                  <div className="font-semibold">{info.label}</div>
                  <div className="mt-1 text-xs text-white/80">{info.description}</div>
                  <div className="mt-3 text-xs text-white/60">
                    {t('partner.academy.earnedOn', 'Earned {{date}}', {
                      date: new Date(cert.earnedAt).toLocaleDateString(i18n.language),
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modules by Category */}
      {Object.entries(modulesByCategory).map(([category, categoryModules]) => {
        const categoryInfo = CATEGORY_COLORS[category];
        const completedInCategory = categoryModules.filter((m) => m.completedAt).length;

        return (
          <div
            key={category}
            className="rounded-xl border border-slate-200 bg-white/90 p-6 dark:border-navy-700 dark:bg-navy-900/60"
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${categoryInfo.bg} ${categoryInfo.text}`}
                >
                  {categoryInfo.icon}
                </div>
                <div>
                  <h4 className="font-semibold text-navy-900 dark:text-white">
                    {category.charAt(0) + category.slice(1).toLowerCase()}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {t('partner.academy.completedOfTotal', '{{done}}/{{total}} completed', {
                      done: completedInCategory,
                      total: categoryModules.length,
                    })}
                  </p>
                </div>
              </div>
              <div className="text-xs text-slate-400 dark:text-slate-500">
                {t('partner.academy.minutesTotal', '{{count}} min total', {
                  count: categoryModules.reduce((sum, m) => {
                    const min = parseInt(m.duration.replace(' min', ''));
                    return sum + (isNaN(min) ? 0 : min);
                  }, 0),
                })}
              </div>
            </div>

            <div className="space-y-3">
              {categoryModules.map((module) => (
                <ModuleCard
                  key={module.id}
                  module={module}
                  onStart={() => onStartModule?.(module.id)}
                />
              ))}
            </div>
          </div>
        );
      })}

      {/* CTA for Certification */}
      {!stats.certificationReady && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-6 text-center dark:border-navy-600 dark:bg-navy-900/40">
          <Lock size={32} className="mx-auto mb-3 text-slate-400 dark:text-slate-500" />
          <h4 className="font-semibold text-navy-900 dark:text-white">
            {t('partner.academy.unlockTitle', 'Unlock Consultify certification')}
          </h4>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {t(
              'partner.academy.unlockBody',
              'Complete {{count}} more required module to earn your certification',
              { count: stats.requiredModules - stats.completedRequired }
            )}
          </p>
          <button className="mt-4 rounded-xl bg-c-text px-6 py-2 text-sm font-semibold text-c-bg transition hover:bg-c-text-secondary">
            {t('partner.academy.continueLearning', 'Continue learning')}
          </button>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value }) => (
  <div className="rounded-xl bg-white/80 p-3 shadow-sm dark:bg-navy-900/60">
    <div className="mb-1 flex items-center gap-2 text-slate-400 dark:text-slate-500">{icon}</div>
    <div className="text-lg font-bold text-navy-900 dark:text-white">{value}</div>
    <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
  </div>
);

interface ModuleCardProps {
  module: AcademyModule;
  onStart: () => void;
}

const ModuleCard: React.FC<ModuleCardProps> = ({ module, onStart }) => {
  const { t } = useTranslation();
  const isCompleted = !!module.completedAt;

  return (
    <div
      className={`flex items-center justify-between rounded-xl border p-4 transition ${
        isCompleted
          ? 'border-emerald-100 bg-emerald-50/50 dark:border-emerald-500/20 dark:bg-emerald-500/5'
          : 'border-slate-100 bg-slate-50/50 hover:border-brand/30 dark:border-navy-700 dark:bg-navy-950/20'
      }`}
    >
      <div className="flex items-center gap-4">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${
            isCompleted
              ? 'bg-emerald-500 text-white'
              : 'bg-slate-100 text-slate-500 dark:text-slate-400 dark:bg-white/10'
          }`}
        >
          {isCompleted ? <CheckCircle2 size={18} /> : <Play size={18} />}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`font-semibold ${isCompleted ? 'text-emerald-700 dark:text-emerald-400' : 'text-navy-900 dark:text-white'}`}
            >
              {module.title}
            </span>
            {module.requiredForCertification && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-white/10 dark:text-slate-300">
                {t('partner.academy.moduleRequired', 'Required')}
              </span>
            )}
          </div>
          <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {module.description}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {isCompleted && module.score && (
          <div className="text-right">
            <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
              {module.score}%
            </div>
            <div className="text-xs text-slate-400 dark:text-slate-500">
              {t('partner.academy.moduleScore', 'Score')}
            </div>
          </div>
        )}
        <div className="text-right">
          <div className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
            <Clock size={12} />
            {module.duration}
          </div>
        </div>
        {!isCompleted && (
          <button
            onClick={onStart}
            className="flex items-center gap-1 rounded-xl bg-navy-900 dark:bg-[#F4F7FB] px-3 py-1.5 text-xs font-semibold text-white dark:text-navy-950 transition hover:bg-navy-800 dark:hover:bg-[#DDE5EF] dark:hover:bg-[#DDE5EF]"
          >
            {t('partner.academy.moduleStart', 'Start')} <ChevronRight size={12} />
          </button>
        )}
      </div>
    </div>
  );
};

export default AcademyProgress;
