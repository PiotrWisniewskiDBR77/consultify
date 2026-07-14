import { Brain, ChevronDown, ChevronUp, Loader2, RefreshCw } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface Recommendation {
  taskId: string;
  title: string;
  rank: number;
  reason: string;
  urgency: 'critical' | 'high' | 'medium' | 'low';
}

interface AdvisorResult {
  recommendations: Recommendation[];
  overcommitWarning: string | null;
  summary: string;
}

const URGENCY_COLORS = {
  critical:
    'bg-danger-100 dark:bg-danger-900/30 text-danger-700 dark:text-danger-300 border-danger-200 dark:border-danger-800',
  high: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  medium:
    'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  low: 'bg-slate-100 dark:bg-slate-900/30 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700',
};

export const AICoachPanel: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const [result, setResult] = useState<AdvisorResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const fetchAdvice = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/my-work/priority-advice', {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (res.ok) setResult(await res.json());
    } catch {
      /* ignore */
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAdvice();
  }, []);

  if (!result && !loading) return null;

  return (
    <div className="mx-4 mb-3 rounded-xl border border-c-info/50 dark:border-c-info/30 bg-gradient-to-r from-c-info/60 to-indigo-50/60 dark:from-c-info/15 dark:to-indigo-950/10 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Brain size={16} className="text-c-info" />
          <span className="text-sm font-semibold text-c-info dark:text-c-info">
            {t('myWork.aiCoachPanel.aICoach', 'AI Coach')}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={fetchAdvice}
            disabled={loading}
            className="p-1 rounded hover:bg-c-info/10"
          >
            <RefreshCw size={12} className={`text-c-info ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 rounded hover:bg-c-info/10"
          >
            {expanded ? (
              <ChevronUp size={14} className="text-c-info" />
            ) : (
              <ChevronDown size={14} className="text-c-info" />
            )}
          </button>
        </div>
      </div>
      {expanded && (
        <div className="px-4 pb-3 space-y-2">
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-c-info">
              <Loader2 size={12} className="animate-spin" />{' '}
              {t('myWork.aiCoachPanel.analyzing', 'Analyzing...')}
            </div>
          ) : result ? (
            <>
              <p className="text-xs font-medium text-c-info dark:text-c-info">
                {result.summary}
              </p>
              {result.overcommitWarning && (
                <div className="px-2.5 py-1.5 rounded-lg bg-danger-50 dark:bg-danger-900/20 border border-danger-200/50 dark:border-danger-800/30 text-xs text-danger-700 dark:text-danger-300">
                  {result.overcommitWarning}
                </div>
              )}
              <div className="space-y-1">
                {result.recommendations.slice(0, 5).map((rec) => (
                  <div
                    key={rec.taskId}
                    className={`flex items-start gap-2 px-2.5 py-1.5 rounded-lg border text-xs ${URGENCY_COLORS[rec.urgency]}`}
                  >
                    <span className="font-bold shrink-0">#{rec.rank}</span>
                    <div className="min-w-0">
                      <span className="font-medium">{rec.title}</span>
                      <span className="block text-[10px] opacity-75 mt-0.5">{rec.reason}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
};
