/**
 * QualityGatesPanel — T060
 *
 * Shows quality check results for a report: missing sections,
 * empty content, readiness score, export/approve eligibility.
 */
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
  RefreshCw,
  Shield,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { API_URL, getHeaders } from '../../services/api';
import { trackFunnelEvent } from '../../services/funnelAnalytics';

// ── Types ──────────────────────────────────────────────────────

interface QualityGateResult {
  id: string;
  gateType: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  sectionKey?: string;
}

interface QualityReport {
  reportId: string;
  canExport: boolean;
  canApprove: boolean;
  gates: QualityGateResult[];
  score: number;
  checkedAt: string;
}

interface QualityGatesPanelProps {
  reportId: string;
  className?: string;
  onSectionClick?: (sectionKey: string) => void;
}

// ── Severity config ────────────────────────────────────────────

const SEVERITY_CONFIG = {
  error: { icon: <XCircle size={14} />, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
  warning: { icon: <AlertTriangle size={14} />, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  info: { icon: <Info size={14} />, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
};

// ── Component ──────────────────────────────────────────────────

export const QualityGatesPanel: React.FC<QualityGatesPanelProps> = ({
  reportId,
  className = '',
  onSectionClick,
}) => {
  const { t } = useTranslation();
  const [report, setReport] = useState<QualityReport | null>(null);
  const [loading, setLoading] = useState(false);

  const runCheck = useCallback(async () => {
    if (!reportId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/report-builder/${reportId}/quality-gates`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setReport(data);
        trackFunnelEvent('report_quality_check_run', { reportId, score: data.score });
      }
    } catch { /* */ }
    finally { setLoading(false); }
  }, [reportId]);

  useEffect(() => {
    runCheck();
  }, [runCheck]);

  if (!report && !loading) return null;

  const scoreColor = (report?.score ?? 0) >= 80 ? 'text-emerald-400' : (report?.score ?? 0) >= 50 ? 'text-amber-400' : 'text-red-400';
  const errors = report?.gates.filter((g) => g.severity === 'error') || [];
  const warnings = report?.gates.filter((g) => g.severity === 'warning') || [];
  const infos = report?.gates.filter((g) => g.severity === 'info') || [];

  return (
    <div className={`rounded-xl bg-navy-900/50 border border-navy-700/50 p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Shield size={16} className="text-violet-400" />
          <span className="text-sm font-medium text-white">{t('reports.qualityGates.title', 'Quality Check')}</span>
        </div>
        <button
          onClick={runCheck}
          disabled={loading}
          className="p-1.5 text-slate-400 hover:text-violet-400 hover:bg-violet-500/10 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading && !report ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="animate-spin text-violet-400" size={20} />
        </div>
      ) : report ? (
        <>
          {/* Score */}
          <div className="flex items-center gap-3 mb-4">
            <div className={`text-3xl font-bold ${scoreColor}`}>{report.score}</div>
            <div>
              <div className="text-xs text-slate-400">{t('reports.qualityGates.readinessScore', 'Readiness Score')}</div>
              <div className="flex items-center gap-3 mt-0.5">
                {report.canExport ? (
                  <span className="text-xs text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 size={11} /> {t('reports.qualityGates.exportReady', 'Export ready')}
                  </span>
                ) : (
                  <span className="text-xs text-red-400 flex items-center gap-1">
                    <XCircle size={11} /> {t('reports.qualityGates.notExportReady', 'Not export ready')}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Gates list */}
          {report.gates.length === 0 ? (
            <div className="text-center py-4">
              <CheckCircle2 className="mx-auto text-emerald-400 mb-2" size={24} />
              <p className="text-xs text-emerald-400">{t('reports.qualityGates.allPassed', 'All quality checks passed!')}</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {[...errors, ...warnings, ...infos].map((gate) => {
                const cfg = SEVERITY_CONFIG[gate.severity];
                return (
                  <div
                    key={gate.id}
                    className={`flex items-start gap-2 p-2 rounded-lg ${cfg.bg} border ${cfg.border} cursor-pointer hover:opacity-80 transition-opacity`}
                    onClick={() => gate.sectionKey && onSectionClick?.(gate.sectionKey)}
                  >
                    <span className={`shrink-0 mt-0.5 ${cfg.color}`}>{cfg.icon}</span>
                    <span className={`text-xs ${cfg.color}`}>{gate.message}</span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
};

export default QualityGatesPanel;
