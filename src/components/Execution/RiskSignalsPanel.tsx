/**
 * RiskSignalsPanel (T040)
 *
 * Displays heuristic-detected risk signals for the execution portfolio.
 * Shows severity, signal type, affected initiative, and suggested actions.
 */

import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Clock,
  Eye,
  Lock,
  Shield,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/ui/composed/EmptyState';
import { LoadingState } from '@/components/ui/primitives';
import {
  shouldFallbackToLegacyExecutionControl,
  V8ExecutionControlApi,
} from '@/services/api/v8/execution-control';

import { trackFunnelEvent } from '../../services/funnelAnalytics';

export interface RiskSignal {
  id: string;
  initiativeId: string;
  initiativeName: string;
  signalType: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  description: string;
  suggestedAction: string;
}

interface RiskSignalsPanelProps {
  projectId?: string;
  onInitiativeClick?: (initiativeId: string) => void;
  signals?: RiskSignal[];
  loading?: boolean;
  onRefresh?: () => void;
}

const SEVERITY_CONFIG = {
  CRITICAL: {
    bg: 'bg-danger-500/10',
    border: 'border-danger-500/30',
    text: 'text-danger-400',
    badge: 'bg-danger-500/20 text-danger-400',
    icon: ShieldAlert,
  },
  HIGH: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-400',
    badge: 'bg-amber-500/20 text-amber-400',
    icon: AlertTriangle,
  },
  MEDIUM: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-400',
    badge: 'bg-amber-500/20 text-amber-400',
    icon: Clock,
  },
  LOW: {
    bg: 'bg-slate-500/10',
    border: 'border-slate-500/30',
    text: 'text-slate-600',
    badge: 'bg-slate-500/20 text-slate-600',
    icon: Eye,
  },
};

const SIGNAL_ICONS: Record<string, React.FC<{ size?: number; className?: string }>> = {
  OVERDUE: Clock,
  BLOCKED_LONG: Lock,
  DEPENDENCY_CONFLICT: AlertTriangle,
  UNOWNED_RISK: Shield,
  UNMITIGATED_HIGH_RISK: ShieldAlert,
  SLA_BREACH: AlertTriangle,
};

function getAuthToken(): string | null {
  try {
    return localStorage.getItem('token');
  } catch {
    return null;
  }
}

export const RiskSignalsPanel: React.FC<RiskSignalsPanelProps> = ({
  projectId,
  onInitiativeClick,
  signals: controlledSignals,
  loading: controlledLoading,
  onRefresh,
}) => {
  const { t } = useTranslation();
  const [signals, setSignals] = useState<RiskSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const isControlled = controlledSignals !== undefined;
  const visibleSignalsSource = isControlled ? controlledSignals || [] : signals;
  const effectiveLoading = isControlled ? Boolean(controlledLoading) : loading;

  const fetchSignals = useCallback(async () => {
    try {
      const token = getAuthToken();
      if (!token) return;

      const params = new URLSearchParams();
      if (projectId) params.set('projectId', projectId);

      const data = await V8ExecutionControlApi.getRiskSignals(projectId).catch(async (error) => {
        if (!shouldFallbackToLegacyExecutionControl(error)) {
          throw error;
        }
        const res = await fetch(`/api/execution-control/risk-signals?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return { signals: [], count: 0 };
        return res.json();
      });
      setSignals(data.signals || []);
      trackFunnelEvent('execution_risk_signal_viewed', { count: data.count || 0 });
    } catch {
      // noop
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (isControlled) {
      setLoading(false);
      return;
    }
    fetchSignals();
  }, [fetchSignals, isControlled]);

  const handleDismiss = useCallback(
    async (signalId: string) => {
      try {
        const token = getAuthToken();
        if (!token) return;

        await V8ExecutionControlApi.dismissRiskSignal(signalId).catch((error) => {
          if (!shouldFallbackToLegacyExecutionControl(error)) {
            throw error;
          }
          return fetch('/api/execution-control/risk-signals/dismiss', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ signalId }),
          });
        });

        setDismissedIds((prev) => new Set([...prev, signalId]));
        onRefresh?.();
        trackFunnelEvent('execution_risk_signal_dismissed', { signalId });
      } catch {
        // noop
      }
    },
    [onRefresh]
  );

  const visibleSignals = visibleSignalsSource.filter((s) => !dismissedIds.has(s.id));

  if (effectiveLoading) {
    return <LoadingState variant="spinner" />;
  }

  if (visibleSignals.length === 0) {
    return (
      <EmptyState
        compact
        icon={<Shield />}
        title={t('execution.riskSignals.noSignals')}
        description=""
      />
    );
  }

  const critical = visibleSignals.filter((s) => s.severity === 'CRITICAL').length;
  const high = visibleSignals.filter((s) => s.severity === 'HIGH').length;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 px-4 py-2">
        <Shield size={16} className="text-danger-400" />
        <span className="text-sm font-semibold text-slate-900 dark:text-white">
          {t('execution.riskSignals.title')}
        </span>
        <span className="text-xs text-slate-500">({visibleSignals.length})</span>
        {critical > 0 && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-danger-500/20 text-danger-400 font-medium">
            {critical} {t('execution.riskSignals.critical')}
          </span>
        )}
        {high > 0 && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-medium">
            {high} {t('execution.riskSignals.high')}
          </span>
        )}
      </div>

      <div className="space-y-1 px-2">
        {visibleSignals.map((signal) => {
          const config = SEVERITY_CONFIG[signal.severity];
          const isExpanded = expandedId === signal.id;
          const SignalIcon = SIGNAL_ICONS[signal.signalType] || AlertTriangle;

          return (
            <div
              key={signal.id}
              className={`rounded-lg border ${config.border} ${config.bg} overflow-hidden transition-all`}
            >
              <div
                className="flex items-center gap-3 px-3 py-2.5 cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : signal.id)}
              >
                <SignalIcon size={14} className={config.text} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                      {signal.title}
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded ${config.badge} font-medium`}
                    >
                      {signal.severity}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate block">
                    {signal.initiativeName}
                  </span>
                </div>
                {isExpanded ? (
                  <ChevronDown size={14} className="text-slate-600 shrink-0" />
                ) : (
                  <ChevronRight size={14} className="text-slate-600 shrink-0" />
                )}
              </div>

              {isExpanded && (
                <div className="px-3 pb-3 space-y-2 border-t border-slate-200/20 dark:border-navy-700/50 pt-2">
                  <p className="text-xs text-slate-600 dark:text-slate-300">{signal.description}</p>
                  <div className="flex items-start gap-2">
                    <span className="text-[10px] uppercase font-semibold text-slate-600 shrink-0 mt-px">
                      {t('execution.riskSignals.suggestedAction')}:
                    </span>
                    <p className="text-xs text-blue-600 dark:text-blue-400">
                      {signal.suggestedAction}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    {onInitiativeClick && signal.initiativeId && (
                      <button
                        onClick={() => onInitiativeClick(signal.initiativeId)}
                        className="text-xs px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-slate-700 dark:text-slate-300 transition-colors"
                      >
                        {t('execution.riskSignals.viewDetails')}
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDismiss(signal.id);
                      }}
                      className="text-xs px-2.5 py-1 rounded text-slate-500 hover:text-danger-400 hover:bg-danger-500/10 transition-colors flex items-center gap-1"
                    >
                      <XCircle size={12} />
                      {t('execution.riskSignals.dismiss')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RiskSignalsPanel;
