/**
 * DeckQualityGatesPanel — G1: Quality Gates for presentations.
 * Shows structure/content/brand/traceability check results with score.
 */

import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Info,
  Shield,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface DeckQualityGateResult {
  id: string;
  gateType: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  cardIndex?: number;
  category: 'structure' | 'content' | 'brand' | 'traceability' | 'quality';
}

interface DeckQualityReport {
  deckId: string;
  canExport: boolean;
  canShare: boolean;
  gates: DeckQualityGateResult[];
  score: number;
  checkedAt: string;
}

interface DeckQualityGatesPanelProps {
  deckId: string;
  isOpen: boolean;
  onClose: () => void;
  onJumpToCard?: (cardIndex: number) => void;
}

const categoryIcons: Record<string, typeof Shield> = {
  structure: Shield,
  content: Info,
  brand: CheckCircle2,
  traceability: Info,
  quality: CheckCircle2,
};

const categoryLabels: Record<string, string> = {
  structure: 'Structure',
  content: 'Content',
  brand: 'Brand',
  traceability: 'Traceability',
  quality: 'Quality',
};

const severityStyles: Record<string, { bg: string; text: string; icon: typeof XCircle }> = {
  error: { bg: 'bg-rose-500/10', text: 'text-rose-600', icon: XCircle },
  warning: { bg: 'bg-amber-500/10', text: 'text-amber-600', icon: AlertTriangle },
  info: { bg: 'bg-blue-500/10', text: 'text-blue-500', icon: Info },
};

function getHeaders() {
  return {
    Authorization: `Bearer ${localStorage.getItem('token')}`,
    'Content-Type': 'application/json',
  };
}

export const DeckQualityGatesPanel: React.FC<DeckQualityGatesPanelProps> = ({
  deckId,
  isOpen,
  onClose,
  onJumpToCard,
}) => {
  const { t } = useTranslation();
  const [report, setReport] = useState<DeckQualityReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['structure', 'content'])
  );

  const runCheck = useCallback(async () => {
    if (!deckId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/presentations/decks/${deckId}/quality-gates`, {
        method: 'POST',
        headers: getHeaders(),
      });
      if (res.ok) {
        const json = await res.json();
        setReport(json.data);
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [deckId]);

  useEffect(() => {
    if (isOpen && deckId) runCheck();
  }, [isOpen, deckId, runCheck]);

  if (!isOpen) return null;

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const grouped: Record<string, DeckQualityGateResult[]> = {};
  for (const g of report?.gates || []) {
    if (!grouped[g.category]) grouped[g.category] = [];
    grouped[g.category].push(g);
  }

  const scoreColor =
    (report?.score ?? 0) >= 80
      ? 'text-green-500'
      : (report?.score ?? 0) >= 50
        ? 'text-amber-500'
        : 'text-rose-500';

  return (
    <div className="absolute top-0 right-0 w-80 h-full bg-white dark:bg-navy-900 border-l border-slate-200 dark:border-navy-700 z-30 flex flex-col shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-navy-700">
        <div className="flex items-center gap-2">
          <Shield size={16} className="text-primary-500" />
          <h3 className="text-sm font-semibold text-slate-800 dark:text-white">
            {t('presentations.qualityGates.title', 'Quality Gates')}
          </h3>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-sm">
          ✕
        </button>
      </div>

      {/* Score */}
      {report && (
        <div className="px-4 py-3 border-b border-slate-100 dark:border-navy-800">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">
              {t('presentations.qualityGates.score', 'Deck Score')}
            </span>
            <span className={`text-2xl font-bold ${scoreColor}`}>{report.score}</span>
          </div>
          <div className="mt-2 flex gap-2">
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                report.canExport ? 'bg-green-500/10 text-green-600' : 'bg-rose-500/10 text-rose-600'
              }`}
            >
              {report.canExport ? 'Export OK' : 'Export Blocked'}
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                report.canShare
                  ? 'bg-green-500/10 text-green-600'
                  : 'bg-amber-500/10 text-amber-600'
              }`}
            >
              {report.canShare ? 'Share OK' : 'Share Warning'}
            </span>
          </div>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full" />
          </div>
        )}

        {!loading && report && report.gates.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckCircle2 size={32} className="text-green-500 mb-2" />
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {t('presentations.qualityGates.allPassed', 'All quality gates passed!')}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {t(
                'presentations.qualityGates.readyToExport',
                'Your deck is ready to export and share.'
              )}
            </p>
          </div>
        )}

        {!loading &&
          Object.entries(grouped).map(([category, gates]) => {
            const CatIcon = categoryIcons[category] || Info;
            const expanded = expandedCategories.has(category);
            const errorCount = gates.filter((g) => g.severity === 'error').length;
            const warnCount = gates.filter((g) => g.severity === 'warning').length;

            return (
              <div key={category}>
                <button
                  onClick={() => toggleCategory(category)}
                  className="flex items-center gap-2 w-full text-left py-1.5"
                >
                  {expanded ? (
                    <ChevronDown size={14} className="text-slate-400" />
                  ) : (
                    <ChevronRight size={14} className="text-slate-400" />
                  )}
                  <CatIcon size={14} className="text-slate-500" />
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
                    {categoryLabels[category] || category}
                  </span>
                  <div className="ml-auto flex gap-1">
                    {errorCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-500/10 text-rose-600 font-medium">
                        {errorCount}
                      </span>
                    )}
                    {warnCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-600 font-medium">
                        {warnCount}
                      </span>
                    )}
                  </div>
                </button>

                {expanded && (
                  <div className="ml-5 space-y-1.5 mt-1">
                    {gates.map((gate) => {
                      const sev = severityStyles[gate.severity] || severityStyles.info;
                      const SevIcon = sev.icon;
                      return (
                        <div
                          key={gate.id}
                          className={`flex items-start gap-2 p-2 rounded-lg ${sev.bg} cursor-pointer hover:opacity-80`}
                          onClick={() => {
                            if (gate.cardIndex != null) onJumpToCard?.(gate.cardIndex);
                          }}
                        >
                          <SevIcon size={14} className={`${sev.text} mt-0.5 flex-shrink-0`} />
                          <p className={`text-[11px] ${sev.text}`}>{gate.message}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-slate-100 dark:border-navy-800">
        <button
          onClick={runCheck}
          disabled={loading}
          className="w-full py-2 rounded-lg bg-primary-600 text-white text-xs font-medium hover:bg-primary-500 disabled:opacity-50"
        >
          {loading
            ? t('presentations.qualityGates.checking', 'Checking...')
            : t('presentations.qualityGates.recheck', 'Re-check Quality Gates')}
        </button>
      </div>
    </div>
  );
};
