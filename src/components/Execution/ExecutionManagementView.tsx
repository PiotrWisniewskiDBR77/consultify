import { AlertTriangle, ChevronRight, ClipboardList, Scale, Shield, Users } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  MENU_3_ALL_DOT_CLASS,
  MENU_3_BADGE_ACTIVE,
  MENU_3_BADGE_INACTIVE,
  MENU_3_CHIP_ACTIVE,
  MENU_3_CHIP_INACTIVE,
  MENU_3_LEFT_CLASS,
} from '@/components/shared/ModuleMenu3';
import { Callout } from '@/components/shared/NModeBlocks';

import BenefitsRegisterPanel from './BenefitsRegisterPanel';
import { isExecutionFlagEnabled } from './executionFeatureFlags';
import { ExecutionManagementTable, type ManagementLaneRow } from './ExecutionManagementTable';
import { type ManagerModuleId, ManagerModuleView } from './ManagerModuleView';

interface ManagerLaneCount {
  total: number;
  critical: number;
  warning: number;
}

interface ExecutionManagementViewProps {
  managerLaneCounts: Record<string, ManagerLaneCount>;
  v8Degraded?: boolean;
  projectId?: string;
  searchQuery: string;
  hasExecutingInitiatives: boolean;
  onOpenEntity?: (entityType: string, entityId: string) => void;
  onRegisterCommandRowContent?: (node: React.ReactNode) => void;
  onRegisterCommandRowRightContent?: (node: React.ReactNode) => void;
}

type ManagementSubview = 'all' | ManagerModuleId;

export const ExecutionManagementView: React.FC<ExecutionManagementViewProps> = ({
  managerLaneCounts,
  v8Degraded,
  projectId,
  searchQuery,
  hasExecutingInitiatives,
  onOpenEntity,
  onRegisterCommandRowContent,
  onRegisterCommandRowRightContent,
}) => {
  const { t } = useTranslation();
  const [subview, setSubview] = useState<ManagementSubview>('all');
  const [actionButtons, setActionButtons] = useState<React.ReactNode>(null);

  const registerActions = useCallback((node: React.ReactNode) => {
    setActionButtons(node);
  }, []);

  useEffect(() => {
    if (subview === 'all') {
      setActionButtons(null);
    }
  }, [subview]);

  const laneCount = (id: string) => managerLaneCounts[id] || { total: 0, critical: 0, warning: 0 };

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
        icon: <ClipboardList size={14} className="text-blue-400" />,
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
        icon: <AlertTriangle size={14} className="text-danger-400" />,
      },
      {
        id: 'risk' as const,
        label: 'Risk',
        count: laneCount('risk').total,
        icon: <Shield size={14} className="text-danger-400" />,
      },
      {
        id: 'workload' as const,
        label: 'Workload',
        count: laneCount('workload').total,
        icon: <Users size={14} className="text-blue-400" />,
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
        icon: <ClipboardList size={20} className="text-blue-500" />,
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
        icon: <AlertTriangle size={20} className="text-danger-500" />,
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
        icon: <Users size={20} className="text-c-text-secondary" />,
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
        icon: <Shield size={20} className="text-danger-500" />,
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

  // T35 R12 — canonical table rows: same six lanes/counts as `tiles` above,
  // reshaped for StandardTable (id/label/total/critical/warning only).
  const laneRows: ManagementLaneRow[] = useMemo(
    () =>
      tiles.map((tile) => {
        const counts = laneCount(tile.id);
        return {
          id: tile.id,
          label: tile.title,
          total: counts.total,
          critical: counts.critical,
          warning: counts.warning,
        };
      }),
    [tiles, managerLaneCounts]
  );

  const filteredTiles = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return tiles;
    return tiles.filter(
      (tile) =>
        tile.title.toLowerCase().includes(query) || tile.description.toLowerCase().includes(query)
    );
  }, [searchQuery, tiles]);

  useEffect(() => {
    if (!onRegisterCommandRowRightContent) return;
    onRegisterCommandRowRightContent(actionButtons);
    return () => onRegisterCommandRowRightContent(null);
  }, [actionButtons, onRegisterCommandRowRightContent]);

  useEffect(() => {
    if (!onRegisterCommandRowContent) return;
    onRegisterCommandRowContent(
      <div className={MENU_3_LEFT_CLASS}>
        {presets.map((preset) => {
          const active = subview === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => setSubview((prev) => (prev === preset.id ? 'all' : preset.id))}
              className={active ? MENU_3_CHIP_ACTIVE : MENU_3_CHIP_INACTIVE}
            >
              {preset.id === 'all' ? <span className={MENU_3_ALL_DOT_CLASS} /> : preset.icon}
              <span>{preset.label}</span>
              <span className={active ? MENU_3_BADGE_ACTIVE : MENU_3_BADGE_INACTIVE}>
                {preset.count}
              </span>
            </button>
          );
        })}
      </div>
    );
    return () => onRegisterCommandRowContent(null);
  }, [onRegisterCommandRowContent, presets, subview]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 min-h-0 overflow-hidden">
        {subview === 'all' ? (
          <div className="flex h-full flex-col overflow-hidden">
            {/* T35 R12 — canonical table (six real lanes). Dashboard content
                below (callouts, benefits register, tile grid) is relocated,
                not deleted (surfaceRegister.ts T35 relocateFromList). */}
            <div className="h-1/2 min-h-[280px] shrink-0 overflow-hidden border-b border-slate-200 dark:border-slate-700">
              <ExecutionManagementTable rows={laneRows} onOpenLane={setSubview} />
            </div>
            <div className="flex-1 min-h-0 p-4 space-y-5 overflow-auto">
              {v8Degraded && (
                <Callout
                  variant="warning"
                  title={t('execution.manager.v8Degraded', 'Manager cockpit requires V8')}
                >
                  {t(
                    'execution.manager.v8DegradedDesc',
                    'The Manager cockpit (lanes, AI recommendations) is not available because V8 is not enabled on this environment. Contact your administrator to enable V8.'
                  )}
                </Callout>
              )}
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

              {isExecutionFlagEnabled('benefits') && <BenefitsRegisterPanel />}

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
                      className={`group text-left rounded-xl border bg-c-surface p-5 transition-all hover:shadow-md hover:border-c-border-strong ${
                        hasAlerts
                          ? 'border-amber-200 dark:border-amber-800/40'
                          : 'border-c-border-subtle'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-c-surface-raised group-hover:bg-c-surface-raised transition-colors">
                          {tile.icon}
                        </div>
                        <ChevronRight
                          size={14}
                          className="text-c-text-secondary group-hover:text-c-text-secondary transition-colors mt-1"
                        />
                      </div>
                      <h3 className="text-sm font-semibold text-c-text mb-1">{tile.title}</h3>
                      <p className="text-[11px] text-c-text-muted leading-relaxed mb-3">
                        {tile.description}
                      </p>
                      <div className="flex gap-3">
                        {tile.metrics.map((metric) => (
                          <div key={metric.label} className="min-w-0">
                            <div
                              className={`text-lg font-bold tabular-nums ${
                                metric.variant === 'critical'
                                  ? 'text-danger-600 dark:text-danger-400'
                                  : metric.variant === 'warn'
                                    ? 'text-amber-600 dark:text-amber-400'
                                    : 'text-c-text'
                              }`}
                            >
                              {metric.value}
                            </div>
                            <div className="text-[10px] uppercase tracking-wider text-c-text-muted">
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
          </div>
        ) : (
          <ManagerModuleView
            moduleId={subview}
            projectId={projectId}
            onOpenEntity={onOpenEntity}
            onRegisterActions={registerActions}
          />
        )}
      </div>
    </div>
  );
};

export default ExecutionManagementView;
