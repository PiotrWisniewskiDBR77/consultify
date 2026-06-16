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
    'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
  high: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  medium:
    'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  low: 'bg-slate-100 dark:bg-slate-900/30 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700',
};

export const AICoachPanel: React.FC = () => {
  const { i18n } = useTranslation();
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
    <div className="mx-4 mb-3 rounded-xl border border-primary-200/50 dark:border-primary-800/30 bg-gradient-to-r from-primary-50/60 to-indigo-50/60 dark:from-primary-950/15 dark:to-indigo-950/10 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Brain size={16} className="text-primary-500" />
          <span className="text-sm font-semibold text-primary-800 dark:text-primary-200">
            {isPolish ? 'AI Coach' : 'AI Coach'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={fetchAdvice}
            disabled={loading}
            className="p-1 rounded hover:bg-primary-500/10"
          >
            <RefreshCw size={12} className={`text-primary-500 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 rounded hover:bg-primary-500/10"
          >
            {expanded ? (
              <ChevronUp size={14} className="text-primary-500" />
            ) : (
              <ChevronDown size={14} className="text-primary-500" />
            )}
          </button>
        </div>
      </div>
      {expanded && (
        <div className="px-4 pb-3 space-y-2">
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-primary-500">
              <Loader2 size={12} className="animate-spin" />{' '}
              {isPolish ? 'Analizuję...' : 'Analyzing...'}
            </div>
          ) : result ? (
            <>
              <p className="text-xs font-medium text-primary-700 dark:text-primary-300">
                {result.summary}
              </p>
              {result.overcommitWarning && (
                <div className="px-2.5 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-200/50 dark:border-rose-800/30 text-xs text-rose-700 dark:text-rose-300">
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
