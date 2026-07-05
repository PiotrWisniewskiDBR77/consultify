/**
 * EscalationBanner — G7 Frontend
 *
 * Evaluates R1 report data against escalation thresholds and displays
 * a banner suggesting escalation to R2 (Steering Committee) when conditions are met.
 */
import { AlertTriangle, ArrowRight, Loader2, ShieldAlert, X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { API_URL, getHeaders } from '../../../services/api';

interface EscalationTrigger {
  shouldEscalate: boolean;
  severity: 'critical' | 'warning' | 'none';
  reasons: string[];
  suggestedReportType: 'R2' | null;
  blockedInitiatives: number;
  overdueDecisions: number;
  budgetDeviations: number;
}

interface EscalationBannerProps {
  reportId: string;
  reportTypeV3?: string;
  onCreateR2?: () => void;
}

export const EscalationBanner: React.FC<EscalationBannerProps> = ({
  reportId,
  reportTypeV3,
  onCreateR2,
}) => {
  const { t } = useTranslation();
  const [trigger, setTrigger] = useState<EscalationTrigger | null>(null);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const evaluate = useCallback(async () => {
    if (!reportId || (reportTypeV3 || '').toUpperCase() !== 'R1') return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/report-builder/${reportId}/evaluate-escalation`, {
        method: 'POST',
        headers: getHeaders(),
      });
      if (res.ok) {
        const data: EscalationTrigger = await res.json();
        setTrigger(data);
      }
    } catch {
      /* network error */
    } finally {
      setLoading(false);
    }
  }, [reportId, reportTypeV3]);

  useEffect(() => {
    evaluate();
  }, [evaluate]);

  if (!trigger?.shouldEscalate || dismissed) return null;

  const isCritical = trigger.severity === 'critical';
  const bannerBg = isCritical
    ? 'bg-danger-500/10 border-danger-500/30'
    : 'bg-amber-500/10 border-amber-500/30';
  const bannerText = isCritical ? 'text-danger-300' : 'text-amber-300';
  const iconColor = isCritical ? 'text-danger-400' : 'text-amber-400';

  return (
    <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${bannerBg} mb-4`}>
      {loading ? (
        <Loader2 size={16} className="animate-spin text-c-accent shrink-0 mt-0.5" />
      ) : (
        <ShieldAlert size={16} className={`${iconColor} shrink-0 mt-0.5`} />
      )}
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-medium ${bannerText}`}>
          {isCritical
            ? t(
                'reports.escalation.criticalTitle',
                'Critical: Steering Committee escalation recommended'
              )
            : t(
                'reports.escalation.warningTitle',
                'Attention: Consider escalating to Steering Committee'
              )}
        </div>
        <ul className="mt-1.5 space-y-0.5">
          {trigger.reasons.map((reason, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs text-c-text-secondary">
              <AlertTriangle size={10} className={`${iconColor} shrink-0 mt-0.5`} />
              {reason}
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-3 mt-2">
          <div className="flex items-center gap-4 text-[10px] text-c-text-secondary uppercase tracking-wide">
            {trigger.blockedInitiatives > 0 && (
              <span>
                {trigger.blockedInitiatives} {t('reports.escalation.blocked', 'blocked')}
              </span>
            )}
            {trigger.overdueDecisions > 0 && (
              <span>
                {trigger.overdueDecisions}{' '}
                {t('reports.escalation.overdueDecisions', 'overdue decisions')}
              </span>
            )}
            {trigger.budgetDeviations > 0 && (
              <span>
                {trigger.budgetDeviations}{' '}
                {t('reports.escalation.budgetDeviations', 'budget deviations')}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {onCreateR2 && (
          <button
            onClick={onCreateR2}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-c-accent-soft hover:bg-c-accent-soft text-c-text transition-colors"
          >
            {t('reports.escalation.createR2', 'Create R2 Report')}
            <ArrowRight size={12} />
          </button>
        )}
        <button
          onClick={() => setDismissed(true)}
          className="p-1 text-c-text-secondary hover:text-c-text-secondary transition-colors"
          title={t('reports.escalation.dismiss', 'Dismiss')}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};

export default EscalationBanner;
