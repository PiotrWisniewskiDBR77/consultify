import {
  AlertTriangle,
  ChevronRight,
  ClipboardList,
  Scale,
  Shield,
  Users,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Callout } from '@/components/shared/NModeBlocks';

import { type ManagerModuleId, ManagerModuleView } from './ManagerModuleView';

interface ManagerLaneCount {
  total: number;
  critical: number;
  warning: number;
}

interface ExecutionManagementViewProps {
  managerLaneCounts: Record<string, ManagerLaneCount>;
  projectId?: string;
  searchQuery: string;
  hasExecutingInitiatives: boolean;
  onOpenEntity?: (entityType: string, entityId: string) => void;
  actionButtons?: React.ReactNode;
}

type ManagementSubview = 'all' | ManagerModuleId;

const CHIP_BASE =
  'h-8 inline-flex items-center gap-1.5 rounded-full px-2.5 text-[11px] font-medium border transition-colors whitespace-nowrap';

const BADGE_BASE =
  'px-1.5 py-0.5 rounded-full text-[10px] font-semibold tabular-nums leading-none';

export const ExecutionManagementView: React.FC<ExecutionManagementViewProps> = ({
  managerLaneCounts,
  projectId,
  searchQuery,
  hasExecutingInitiatives,
  onOpenEntity,
  actionButtons,
}) => {
  const { t } = useTranslation();
  const [subview, setSubview] = useState<ManagementSubview>('all');

  const laneCount = (id: string) =>
    managerLaneCounts[id] || { total: 0, critical: 0, warning: 0 };

  const presets = useMemo(
    () => [
      {
        id: 'all' as const,
        label: t('common.all', 'ALL'),
        count: 6,
        icon: <span className="h-2 w-2 rounded-full bg-slate-400" />,
      },
      {
        id: 'action-queue' as const,
        label: 'Action Queue',
        count: laneCount('action-queue').total,
        icon: <ClipboardList size={14} className="text-cyan-400" />,
      },
      {
        id: 'decisions' as const,
        label: 'Decisions',
        count: laneCount('decisions').total,
        icon: <Scale size={14} className="text-amber-400" />,
      },
      {
        id: 'blockers' as const,
        label: 'Blockers',
        count: laneCount('blockers').total,
        icon: <AlertTriangle size={14} className="text-rose-400" />,
      },
      {
        id: 'risk' as const,
        label: 'Risk',
        count: laneCount('risk').total,
        icon: <Shield size={14} className="text-rose-400" />,
      },
      {
        id: 'workload' as const,
        label: 'Workload',
        count: laneCount('workload').total,
        icon: <Users size={14} className="text-violet-400" />,
      },
      {
        id: 'people-change' as const,
        label: t('execution.manager.preset.peopleChange', 'People & Change'),
        count: laneCount('people-change').total,
        icon: <Users size={14} className="text-emerald-400" />,
      },
    ],
    [managerLaneCounts, t]
  );

  const tiles = useMemo(
    () => [
      {
        id: 'action-queue' as ManagerModuleId,
        icon: <ClipboardList size={20} className="text-cyan-500" />,
        title: t('execution.manager.tile.actionQueue', 'Action Queue'),
        description: t(
          'execution.manager.tile.actionQueueDesc',
          'Tasks, decisions, and escalations requiring your attention.'
        ),
        metrics: [
          {
            label: 'Items',
            value: laneCount('action-queue').total,
            variant: laneCount('action-queue').total > 0 ? 'warn' : 'default',
          },
          {
            label: 'Critical',
            value: laneCount('action-queue').critical,
            variant: laneCount('action-queue').critical > 0 ? 'critical' : 'default',
          },
        ],
      },
      {
        id: 'decisions' as ManagerModuleId,
        icon: <Scale size={20} className="text-amber-500" />,
        title: t('execution.manager.tile.decisions', 'Decisions & Approvals'),
        description: t(
          'execution.manager.tile.decisionsDesc',
          'Pending and overdue decisions blocking downstream work.'
        ),
        metrics: [
          {
            label: 'Critical',
            value: laneCount('decisions').critical,
            variant: laneCount('decisions').critical > 0 ? 'critical' : 'default',
          },
          {
            label: 'Issues',
            value: laneCount('decisions').total,
            variant: laneCount('decisions').total > 0 ? 'warn' : 'default',
          },
        ],
      },
      {
        id: 'blockers' as ManagerModuleId,
        icon: <AlertTriangle size={20} className="text-rose-500" />,
        title: t('execution.manager.tile.blockers', 'Blockers & Escalations'),
        description: t(
          'execution.manager.tile.blockersDesc',
          'Blocked initiatives, critical risks, and recovery actions.'
        ),
        metrics: [
          {
            label: 'Blocked',
            value: laneCount('blockers').critical,
            variant: laneCount('blockers').critical > 0 ? 'critical' : 'default',
          },
          {
            label: 'Issues',
            value: laneCount('blockers').total,
            variant: laneCount('blockers').total > 0 ? 'warn' : 'default',
          },
        ],
      },
      {
        id: 'workload' as ManagerModuleId,
        icon: <Users size={20} className="text-violet-500" />,
        title: t('execution.manager.tile.workload', 'Resource & Workload'),
        description: t(
          'execution.manager.tile.workloadDesc',
          'Per-person task load, utilization, and capacity gaps.'
        ),
        metrics: [
          {
            label: 'Issues',
            value: laneCount('workload').total,
            variant: laneCount('workload').total > 0 ? 'warn' : 'default',
          },
          {
            label: 'Critical',
            value: laneCount('workload').critical,
            variant: laneCount('workload').critical > 0 ? 'critical' : 'default',
          },
        ],
      },
      {
        id: 'risk' as ManagerModuleId,
        icon: <Shield size={20} className="text-rose-500" />,
        title: t('execution.manager.tile.risk', 'Execution Risk'),
        description: t(
          'execution.manager.tile.riskDesc',
          'Risk signals, delay detection, and intervention suggestions.'
        ),
        metrics: [
          {
            label: 'Risks',
            value: laneCount('risk').total,
            variant: laneCount('risk').total > 0 ? 'warn' : 'default',
          },
          {
            label: 'Critical',
            value: laneCount('risk').critical,
            variant: laneCount('risk').critical > 0 ? 'critical' : 'default',
          },
        ],
      },
      {
        id: 'people-change' as ManagerModuleId,
        icon: <Users size={20} className="text-emerald-500" />,
        title: t('execution.manager.tile.peopleChange', 'People & Change'),
        description: t(
          'execution.manager.tile.peopleChangeDesc',
          'Ownership gaps, stakeholder mapping, and communication.'
        ),
        metrics: [
          {
            label: 'Gaps',
            value: laneCount('people-change').total,
            variant: laneCount('people-change').total > 0 ? 'warn' : 'default',
          },
          {
            label: 'Critical',
            value: laneCount('people-change').critical,
            variant: laneCount('people-change').critical > 0 ? 'critical' : 'default',
          },
        ],
      },
    ],
    [managerLaneCounts, t]
  );

  const filteredTiles = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return tiles;
    return tiles.filter(
      (tile) =>
        tile.title.toLowerCase().includes(query) || tile.description.toLowerCase().includes(query)
    );
  }, [searchQuery, tiles]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="shrink-0 bg-white dark:bg-navy-900 border-b border-slate-200/60 dark:border-white/5">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {presets.map((preset) => {
              const active = subview === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setSubview((prev) => (prev === preset.id ? 'all' : preset.id))}
                  className={`${CHIP_BASE} ${
                    active
                      ? 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-200 border-cyan-500/40'
                      : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 border-slate-200/60 dark:border-navy-700/60 hover:bg-white/60 dark:hover:bg-navy-900/50'
                  }`}
                >
                  {preset.icon}
                  <span>{preset.label}</span>
                  <span
                    className={`${BADGE_BASE} ${
                      active
                        ? 'bg-cyan-500/30 text-cyan-700 dark:text-cyan-200'
                        : 'bg-slate-200 dark:bg-navy-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {preset.count}
                  </span>
                </button>
              );
            })}
          </div>
          {actionButtons ? (
            <div className="flex items-center gap-1.5 shrink-0">{actionButtons}</div>
          ) : null}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {subview === 'all' ? (
          <div className="p-4 space-y-5 h-full overflow-auto">
            {!hasExecutingInitiatives && (
              <Callout
                variant="info"
                title={t('execution.manager.noInitiatives', 'No executing initiatives')}
              >
                {t(
                  'execution.manager.noInitiativesDesc',
                  'The Manager cockpit will populate when initiatives enter execution. Currently the portfolio is empty.'
                )}
              </Callout>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredTiles.map((tile) => {
                const hasAlerts = tile.metrics.some(
                  (metric) => metric.variant === 'critical' || metric.variant === 'warn'
                );
                return (
                  <button
                    key={tile.id}
                    type="button"
                    onClick={() => setSubview(tile.id)}
                    className={`group text-left rounded-xl border bg-white dark:bg-navy-900 p-5 transition-all hover:shadow-md hover:border-cyan-500/40 dark:hover:border-cyan-400/30 ${
                      hasAlerts
                        ? 'border-amber-200 dark:border-amber-800/40'
                        : 'border-slate-200 dark:border-navy-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-navy-800 group-hover:bg-cyan-50 dark:group-hover:bg-cyan-900/20 transition-colors">
                        {tile.icon}
                      </div>
                      <ChevronRight
                        size={14}
                        className="text-slate-300 dark:text-slate-600 group-hover:text-cyan-500 transition-colors mt-1"
                      />
                    </div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
                      {tile.title}
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed mb-3">
                      {tile.description}
                    </p>
                    <div className="flex gap-3">
                      {tile.metrics.map((metric) => (
                        <div key={metric.label} className="min-w-0">
                          <div
                            className={`text-lg font-bold tabular-nums ${
                              metric.variant === 'critical'
                                ? 'text-rose-600 dark:text-rose-400'
                                : metric.variant === 'warn'
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-slate-900 dark:text-white'
                            }`}
                          >
                            {metric.value}
                          </div>
                          <div className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
                            {metric.label}
                          </div>
                        </div>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <ManagerModuleView
            moduleId={subview}
            projectId={projectId}
            onBack={() => setSubview('all')}
            onOpenEntity={onOpenEntity}
          />
        )}
      </div>
    </div>
  );
};

export default ExecutionManagementView;
