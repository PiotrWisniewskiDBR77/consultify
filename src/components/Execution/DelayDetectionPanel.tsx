/**
 * DelayDetectionPanel (T041)
 *
 * Shows detected schedule deviations (late start, overdue, finish risk, deadline risk)
 * with severity indicators, "why slip" context chips, and dismiss functionality.
 */
import {
  AlertTriangle,
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  Filter,
  Timer,
  X,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import {
  shouldFallbackToLegacyExecutionControl,
  V8ExecutionControlApi,
} from '@/services/api/v8/execution-control';
import { trackFunnelEvent } from '../../services/funnelAnalytics';

// ── Types ──────────────────────────────────────────────────────

export interface DelaySignalItem {
  id: string;
  entityType: 'INITIATIVE' | 'TASK';
  entityId: string;
  entityName: string;
  deviationType: 'LATE_START' | 'LATE_FINISH_RISK' | 'DEADLINE_RISK' | 'OVERDUE';
  severity: 'WARNING' | 'CRITICAL';
  daysDeviation: number;
  plannedDate: string | null;
  actualOrCurrent: string | null;
  whySlipReasons: Array<{ reason: string; detail: string }>;
  isDismissed: boolean;
}

interface DelayDetectionPanelProps {
  projectId?: string;
  onInitiativeClick?: (initiativeId: string) => void;
}

// ── Config ─────────────────────────────────────────────────────

const SEVERITY_CONFIG = {
  CRITICAL: {
    bg: 'bg-red-500/15',
    border: 'border-red-500/30',
    text: 'text-red-400',
    icon: AlertTriangle,
  },
  WARNING: {
    bg: 'bg-amber-500/15',
    border: 'border-amber-500/30',
    text: 'text-amber-400',
    icon: Clock,
  },
};

const DEVIATION_ICONS: Record<string, React.FC<{ size?: number; className?: string }>> = {
  LATE_START: Timer,
  LATE_FINISH_RISK: Clock,
  DEADLINE_RISK: Calendar,
  OVERDUE: AlertTriangle,
};

const REASON_COLORS: Record<string, string> = {
  BLOCKED: 'bg-red-500/20 text-red-400',
  DEPENDENCY_NOT_DONE: 'bg-orange-500/20 text-orange-400',
  NO_OWNER: 'bg-slate-500/20 text-slate-400',
  RAID_HIGH_RISK: 'bg-purple-500/20 text-purple-400',
  CAPACITY_OVERLOAD: 'bg-cyan-500/20 text-cyan-400',
  NO_TASKS_PLANNED: 'bg-gray-500/20 text-gray-400',
};

// ── Component ──────────────────────────────────────────────────

export const DelayDetectionPanel: React.FC<DelayDetectionPanelProps> = ({
  projectId,
  onInitiativeClick,
}) => {
  const { t } = useTranslation();
  const [signals, setSignals] = useState<DelaySignalItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string>('');
  const [entityFilter, setEntityFilter] = useState<string>('');

  const loadSignals = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const params = new URLSearchParams();
      if (projectId) params.set('projectId', projectId);
      const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

      // Try to persist detections (admin-only). Non-blocking: ignore 403/401.
      try {
        await V8ExecutionControlApi.detectDelaySignals(projectId).catch((error) => {
          if (!shouldFallbackToLegacyExecutionControl(error)) {
            throw error;
          }
          return fetch('/api/execution-control/delay-signals/detect', {
            method: 'POST',
            headers,
            body: JSON.stringify({ projectId: projectId || null }),
          });
        });
      } catch {
        // non-blocking
      }

      // Prefer persisted signals (stable + respects dismiss rows).
      try {
        const persistedData = await V8ExecutionControlApi.getDelaySignals({
          projectId,
          persisted: true,
        }).catch(async (error) => {
          if (!shouldFallbackToLegacyExecutionControl(error)) {
            throw error;
          }
          const persistedRes = await fetch(
            `/api/execution-control/delay-signals?${params.toString()}&persisted=true`,
            { headers }
          );
          if (!persistedRes.ok) {
            throw new Error('Persisted delay fetch failed');
          }
          return persistedRes.json();
        });
        if (persistedData) {
          const data = persistedData as { signals?: DelaySignalItem[] };
          setSignals(data.signals || []);
          return;
        }
      } catch {
        // Fall through to live detection if persisted reads are unavailable.
      }

      // Fallback to live detection (e.g., if persisted is restricted).
      const data = await V8ExecutionControlApi.getDelaySignals(
        projectId ? { projectId } : undefined
      ).catch(async (error) => {
        if (!shouldFallbackToLegacyExecutionControl(error)) {
          throw error;
        }
        const liveRes = await fetch(`/api/execution-control/delay-signals?${params}`, { headers });
        if (!liveRes.ok) {
          const err = await liveRes.json().catch(() => ({}));
          throw new Error((err as any)?.error || t('execution.delay.loadFailed', 'Failed to load'));
        }
        return liveRes.json();
      });
      if (data) {
        setSignals(data.signals || []);
      }
    } catch (error: any) {
      if (error?.message) {
        toast.error(error.message);
      }
      // non-blocking
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadSignals();
    trackFunnelEvent('delay_detection_viewed', { projectId });
  }, [loadSignals, projectId]);

  const filteredSignals = useMemo(() => {
    return signals.filter((s) => {
      if (severityFilter && s.severity !== severityFilter) return false;
      if (entityFilter && s.entityType !== entityFilter) return false;
      return true;
    });
  }, [signals, severityFilter, entityFilter]);

  const handleDismiss = useCallback(async (signal: DelaySignalItem) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const payload = {
        signalId: signal.id,
        entityType: signal.entityType,
        entityId: signal.entityId,
        deviationType: signal.deviationType,
      };
      const res = await V8ExecutionControlApi.dismissDelaySignal(payload)
        .then(() => ({ ok: true, json: async () => ({}) }))
        .catch((error) => {
          if (!shouldFallbackToLegacyExecutionControl(error)) {
            throw error;
          }
          return fetch('/api/execution-control/delay-signals/dismiss', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
        });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error((err as any)?.error || t('execution.delay.dismissFailed', 'Failed to dismiss'));
        return;
      }

      setSignals((prev) => prev.filter((s) => s.id !== signal.id));
      trackFunnelEvent('delay_signal_dismissed', {
        deviationType: signal.deviationType,
        severity: signal.severity,
      });
    } catch {
      // non-blocking
    }
  }, []);

  const criticalCount = signals.filter((s) => s.severity === 'CRITICAL').length;
  const warningCount = signals.filter((s) => s.severity === 'WARNING').length;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            {t('execution.delay.title')}
          </h3>
          {criticalCount > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-500/20 text-red-400">
              {criticalCount} {t('execution.delay.critical')}
            </span>
          )}
          {warningCount > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-500/20 text-amber-400">
              {warningCount} {t('execution.delay.warning')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded px-2 py-1 text-slate-700 dark:text-slate-300"
          >
            <option value="">{t('execution.delay.allSeverities')}</option>
            <option value="CRITICAL">{t('execution.delay.critical')}</option>
            <option value="WARNING">{t('execution.delay.warning')}</option>
          </select>
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded px-2 py-1 text-slate-700 dark:text-slate-300"
          >
            <option value="">{t('execution.delay.allTypes')}</option>
            <option value="INITIATIVE">{t('execution.delay.initiatives')}</option>
            <option value="TASK">{t('execution.delay.tasks')}</option>
          </select>
        </div>
      </div>

      {/* Signal List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-24 text-slate-400 text-sm">
          {t('execution.delay.loading')}
        </div>
      ) : filteredSignals.length === 0 ? (
        <div className="flex items-center justify-center h-24 text-slate-400">
          <div className="text-center">
            <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">{t('execution.delay.noDelays')}</p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredSignals.map((signal) => {
            const config = SEVERITY_CONFIG[signal.severity];
            const DevIcon = DEVIATION_ICONS[signal.deviationType] || AlertTriangle;
            const isExpanded = expandedId === signal.id;

            return (
              <div
                key={signal.id}
                className={`rounded-lg border ${config.border} ${config.bg} transition-all`}
              >
                <button
                  type="button"
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
                  onClick={() => setExpandedId(isExpanded ? null : signal.id)}
                >
                  <DevIcon size={16} className={config.text} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold uppercase ${config.text}`}>
                        {t(`execution.delay.type.${signal.deviationType}`)}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {signal.entityType === 'TASK' ? '(Task)' : ''}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                      {signal.entityName}
                    </p>
                  </div>
                  <span className={`text-sm font-bold tabular-nums ${config.text}`}>
                    {signal.deviationType === 'LATE_FINISH_RISK' ||
                    signal.deviationType === 'DEADLINE_RISK'
                      ? `${signal.daysDeviation}d ${t('execution.delay.remaining')}`
                      : `${signal.daysDeviation}d`}
                  </span>
                  {isExpanded ? (
                    <ChevronUp size={14} className="text-slate-400 shrink-0" />
                  ) : (
                    <ChevronDown size={14} className="text-slate-400 shrink-0" />
                  )}
                </button>

                {isExpanded && (
                  <div className="px-3 pb-3 space-y-2 border-t border-slate-200/30 dark:border-navy-700/30 pt-2">
                    {/* Plan vs Actual */}
                    {signal.plannedDate && (
                      <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                        <span>
                          {t('execution.delay.planned')}:{' '}
                          {new Date(signal.plannedDate).toLocaleDateString()}
                        </span>
                        {signal.actualOrCurrent && (
                          <span>
                            {t('execution.delay.current')}: {signal.actualOrCurrent}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Why Slip Reasons */}
                    {signal.whySlipReasons.length > 0 && (
                      <div>
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">
                          {t('execution.delay.whySlip')}
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {signal.whySlipReasons.map((r, idx) => (
                            <span
                              key={idx}
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${REASON_COLORS[r.reason] || 'bg-slate-500/20 text-slate-400'}`}
                              title={r.detail}
                            >
                              {r.detail}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-1">
                      {signal.entityType === 'INITIATIVE' && onInitiativeClick && (
                        <button
                          type="button"
                          onClick={() => onInitiativeClick(signal.entityId)}
                          className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                        >
                          <ExternalLink size={12} />
                          {t('execution.delay.viewInitiative')}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDismiss(signal)}
                        className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-300 transition-colors ml-auto"
                      >
                        <XCircle size={12} />
                        {t('execution.delay.dismiss')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DelayDetectionPanel;
