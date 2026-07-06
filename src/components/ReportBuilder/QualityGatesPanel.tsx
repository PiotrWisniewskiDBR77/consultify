/**
 * QualityGatesPanel — T060 Phase 7
 *
 * Shows quality check results grouped by category with
 * summary bar, "Fix with AI" actions, and section navigation.
 */
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Eye,
  FileCheck,
  Info,
  Link,
  Loader2,
  RefreshCw,
  Shield,
  Sparkles,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { API_URL, getHeaders } from '../../services/api';
import { trackFunnelEvent } from '../../services/funnelAnalytics';

// ── Types ──────────────────────────────────────────────────────

type GateCategory = 'structure' | 'content' | 'compliance' | 'traceability' | 'coverage';

interface QualityGateResult {
  id: string;
  gateType: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  sectionKey?: string;
  category?: GateCategory;
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
  error: {
    icon: <XCircle size={14} />,
    color: 'text-danger-400',
    bg: 'bg-danger-500/10',
    border: 'border-danger-500/20',
  },
  warning: {
    icon: <AlertTriangle size={14} />,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
  },
  info: {
    icon: <Info size={14} />,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
  },
};

// ── Category config ────────────────────────────────────────────

const CATEGORY_META: Record<
  GateCategory,
  { icon: React.ReactNode; labelKey: string; fallback: string }
> = {
  structure: {
    icon: <Shield size={14} />,
    labelKey: 'reports.qualityGates.cat.structure',
    fallback: 'Structure',
  },
  content: {
    icon: <FileCheck size={14} />,
    labelKey: 'reports.qualityGates.cat.content',
    fallback: 'Content',
  },
  compliance: {
    icon: <Eye size={14} />,
    labelKey: 'reports.qualityGates.cat.compliance',
    fallback: 'Compliance',
  },
  traceability: {
    icon: <Link size={14} />,
    labelKey: 'reports.qualityGates.cat.traceability',
    fallback: 'Traceability',
  },
  coverage: {
    icon: <BarChart3 size={14} />,
    labelKey: 'reports.qualityGates.cat.coverage',
    fallback: 'Coverage',
  },
};

const CATEGORY_ORDER: GateCategory[] = [
  'structure',
  'content',
  'compliance',
  'traceability',
  'coverage',
];

function inferCategory(gate: QualityGateResult): GateCategory {
  if (gate.category) return gate.category;
  const t = gate.gateType;
  if (
    t === 'EMPTY_REPORT' ||
    t === 'MISSING_REQUIRED_SECTION' ||
    t === 'MISSING_RECOMMENDED_SECTION' ||
    t === 'SECTION_ORDER_WARNING'
  )
    return 'structure';
  if (
    t === 'EMPTY_CONTENT' ||
    t === 'SHORT_CONTENT' ||
    t === 'NUMERIC_INCONSISTENCY' ||
    t === 'CROSS_SECTION_INCONSISTENCY'
  )
    return 'content';
  if (t === 'BRAND_VOICE_VIOLATION') return 'compliance';
  if (t === 'MISSING_SOURCE_REFS' || t === 'LOW_TRACEABILITY_COVERAGE') return 'traceability';
  if (
    t === 'TEMPLATE_SECTION_MISSING' ||
    t === 'TEMPLATE_SECTION_EMPTY' ||
    t === 'RAG_CONTENT_MISMATCH'
  )
    return 'coverage';
  return 'content';
}

// ── Component ──────────────────────────────────────────────────

export const QualityGatesPanel: React.FC<QualityGatesPanelProps> = ({
  reportId,
  className = '',
  onSectionClick,
}) => {
  const { t } = useTranslation();
  const [report, setReport] = useState<QualityReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [fixingGateId, setFixingGateId] = useState<string | null>(null);

  const runCheck = useCallback(async () => {
    if (!reportId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/report-builder/${reportId}/quality-gates`, {
        headers: getHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setReport(data);
        trackFunnelEvent('report_quality_check_run', { reportId, score: data.score });
      }
    } catch {
      /* network error */
    } finally {
      setLoading(false);
    }
  }, [reportId]);

  useEffect(() => {
    runCheck();
  }, [runCheck]);

  const grouped = useMemo(() => {
    if (!report) return new Map<GateCategory, QualityGateResult[]>();
    const map = new Map<GateCategory, QualityGateResult[]>();
    for (const gate of report.gates) {
      const cat = inferCategory(gate);
      const list = map.get(cat) || [];
      list.push(gate);
      map.set(cat, list);
    }
    return map;
  }, [report]);

  const errorCount = report?.gates.filter((g) => g.severity === 'error').length ?? 0;
  const warningCount = report?.gates.filter((g) => g.severity === 'warning').length ?? 0;
  const passedCount = (report?.gates.length ?? 0) === 0 ? 1 : 0;

  const handleFixWithAI = useCallback(
    async (gate: QualityGateResult) => {
      setFixingGateId(gate.id);
      try {
        await fetch(`${API_URL}/report-builder/${reportId}/agent/message`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({ message: `Fix: ${gate.message}` }),
        });
        await runCheck();
      } catch {
        /* */
      } finally {
        setFixingGateId(null);
      }
    },
    [reportId, runCheck]
  );

  if (!report && !loading) return null;

  const scoreColor =
    (report?.score ?? 0) >= 80
      ? 'text-emerald-400'
      : (report?.score ?? 0) >= 50
        ? 'text-amber-400'
        : 'text-danger-400';

  const summaryBg =
    errorCount > 0
      ? 'bg-danger-500/10 border-danger-500/30'
      : warningCount > 0
        ? 'bg-amber-500/10 border-amber-500/30'
        : 'bg-emerald-500/10 border-emerald-500/30';

  const summaryText =
    errorCount > 0 ? 'text-danger-400' : warningCount > 0 ? 'text-amber-400' : 'text-emerald-400';

  return (
    <div className={`rounded-xl bg-c-surface border border-slate-200/60 dark:border-white/[0.03] p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Shield size={16} className="text-c-accent" />
          <span className="text-sm font-medium text-c-text">
            {t('reports.qualityGates.title', 'Quality Check')}
          </span>
        </div>
        <button
          onClick={runCheck}
          disabled={loading}
          className="p-1.5 text-c-text-secondary hover:text-c-accent hover:bg-c-accent-soft0 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading && !report ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="animate-spin text-c-accent" size={20} />
        </div>
      ) : report ? (
        <>
          {/* Score */}
          <div className="flex items-center gap-3 mb-3">
            <div className={`text-3xl font-bold ${scoreColor}`}>{report.score}</div>
            <div>
              <div className="text-xs text-c-text-secondary">
                {t('reports.qualityGates.readinessScore', 'Readiness Score')}
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                {report.canExport ? (
                  <span className="text-xs text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 size={11} />
                    {t('reports.qualityGates.exportReady', 'Export ready')}
                  </span>
                ) : (
                  <span className="text-xs text-danger-400 flex items-center gap-1">
                    <XCircle size={11} />
                    {t('reports.qualityGates.notExportReady', 'Not export ready')}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Summary bar */}
          <div className={`flex items-center gap-3 px-3 py-2 rounded-lg border mb-4 ${summaryBg}`}>
            <span className={`text-xs font-medium ${summaryText}`}>
              {report.gates.length === 0
                ? t('reports.qualityGates.allPassed', 'All quality checks passed!')
                : [
                    errorCount > 0 && `${errorCount} ${t('reports.qualityGates.errors', 'errors')}`,
                    warningCount > 0 &&
                      `${warningCount} ${t('reports.qualityGates.warnings', 'warnings')}`,
                    passedCount > 0 &&
                      t('reports.qualityGates.allPassed', 'All quality checks passed!'),
                  ]
                    .filter(Boolean)
                    .join(', ')}
            </span>
            {!report.canExport && (
              <span className="ml-auto text-[10px] text-danger-400/80 uppercase tracking-wide font-semibold">
                {t('reports.qualityGates.exportBlocked', 'Export blocked')}
              </span>
            )}
          </div>

          {/* Grouped gates */}
          {report.gates.length === 0 ? (
            <div className="text-center py-4">
              <CheckCircle2 className="mx-auto text-emerald-400 mb-2" size={24} />
              <p className="text-xs text-emerald-400">
                {t('reports.qualityGates.allPassed', 'All quality checks passed!')}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {CATEGORY_ORDER.filter((cat) => grouped.has(cat)).map((cat) => {
                const meta = CATEGORY_META[cat];
                const gates = grouped.get(cat)!;
                return (
                  <div key={cat}>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="text-c-text-secondary">{meta.icon}</span>
                      <span className="text-[11px] font-semibold text-c-text-secondary uppercase tracking-wider">
                        {t(meta.labelKey, meta.fallback)}
                      </span>
                      <span className="text-[10px] text-c-text-secondary ml-auto">{gates.length}</span>
                    </div>
                    <div className="space-y-1">
                      {gates.map((gate) => {
                        const cfg = SEVERITY_CONFIG[gate.severity];
                        const isFixable = gate.severity === 'error' || gate.severity === 'warning';
                        const isFixing = fixingGateId === gate.id;
                        return (
                          <div
                            key={gate.id}
                            className={`flex items-start gap-2 p-2 rounded-lg ${cfg.bg} border ${cfg.border} group transition-opacity`}
                          >
                            <span className={`shrink-0 mt-0.5 ${cfg.color}`}>{cfg.icon}</span>
                            <button
                              type="button"
                              className={`text-xs text-left flex-1 ${cfg.color} ${gate.sectionKey ? 'hover:underline cursor-pointer' : 'cursor-default'}`}
                              onClick={() => gate.sectionKey && onSectionClick?.(gate.sectionKey)}
                            >
                              {gate.message}
                            </button>
                            {isFixable && (
                              <button
                                type="button"
                                disabled={isFixing}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleFixWithAI(gate);
                                }}
                                className="shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-c-accent hover:bg-c-accent-soft0 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                                title={t('reports.qualityGates.fixWithAI', 'Fix with AI')}
                              >
                                {isFixing ? (
                                  <Loader2 size={10} className="animate-spin" />
                                ) : (
                                  <Sparkles size={10} />
                                )}
                                {t('reports.qualityGates.fixWithAI', 'Fix with AI')}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
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
