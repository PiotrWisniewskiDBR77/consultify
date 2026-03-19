import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Brain,
  Check,
  Lightbulb,
  RefreshCw,
  Sparkles,
  TrendingUp,
  X,
} from 'lucide-react';

import { Api } from '../../../services/api';

interface WorkerInsight {
  id: string;
  worker_id: string;
  insight_type: string;
  title: string;
  description: string | null;
  evidence: Record<string, unknown> | null;
  priority: string;
  status: string;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

interface InsightsPanelProps {
  workerId: string;
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  knowledge_gap: <Brain size={16} className="text-amber-500" />,
  frequent_topic: <TrendingUp size={16} className="text-blue-500" />,
  objection_pattern: <AlertTriangle size={16} className="text-red-500" />,
  improvement_suggestion: <Lightbulb size={16} className="text-emerald-500" />,
  escalation_pattern: <AlertTriangle size={16} className="text-orange-500" />,
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  high: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  low: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  reviewed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  applied: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  dismissed: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
};

export const InsightsPanel: React.FC<InsightsPanelProps> = ({ workerId }) => {
  const [insights, setInsights] = useState<WorkerInsight[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');

  const fetchInsights = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (statusFilter) params.set('status', statusFilter);

      const response = await Api.get(
        `/api/virtual-workers/${workerId}/insights?${params.toString()}`
      );
      if (response?.data) {
        const payload = response.data;
        setInsights(Array.isArray(payload.data) ? payload.data : []);
        setTotal(payload.total || 0);
      }
    } catch (err) {
      console.error('Failed to fetch insights:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const response = await Api.post(
        `/api/virtual-workers/${workerId}/insights/generate`,
        {}
      );
      if (response?.data?.generated > 0) {
        fetchInsights();
      }
    } catch (err) {
      console.error('Failed to generate insights:', err);
    } finally {
      setGenerating(false);
    }
  };

  const handleReview = async (insightId: string, status: string) => {
    try {
      await Api.put(`/api/virtual-workers/${workerId}/insights/${insightId}`, {
        status,
      });
      fetchInsights();
    } catch (err) {
      console.error('Failed to review insight:', err);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, [workerId, statusFilter]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            AI Insights & Recommendations
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {total} insight{total !== 1 ? 's' : ''} generated
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2 py-1 border border-slate-300 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-900 text-slate-700 dark:text-slate-300 text-xs"
          >
            <option value="">All statuses</option>
            <option value="new">New</option>
            <option value="reviewed">Reviewed</option>
            <option value="applied">Applied</option>
            <option value="dismissed">Dismissed</option>
          </select>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors text-sm font-medium"
          >
            {generating ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : (
              <Sparkles size={14} />
            )}
            {generating ? 'Analyzing...' : 'Generate Insights'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <RefreshCw className="w-5 h-5 animate-spin text-indigo-500" />
        </div>
      ) : insights.length === 0 ? (
        <div className="text-center py-16">
          <Sparkles className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No insights yet. Click "Generate Insights" to analyze recent conversations.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {insights.map((insight) => (
            <div
              key={insight.id}
              className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <div className="mt-0.5">
                    {TYPE_ICONS[insight.insight_type] || <Lightbulb size={16} className="text-slate-400" />}
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                      {insight.title}
                    </h4>
                    {insight.description && (
                      <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                        {insight.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[insight.priority] || PRIORITY_COLORS.medium}`}>
                        {insight.priority}
                      </span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[insight.status] || STATUS_COLORS.new}`}>
                        {insight.status}
                      </span>
                      <span className="text-xs text-slate-400 dark:text-slate-500">
                        {insight.insight_type.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>
                </div>

                {insight.status === 'new' && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleReview(insight.id, 'applied')}
                      title="Apply"
                      className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                    >
                      <Check size={16} />
                    </button>
                    <button
                      onClick={() => handleReview(insight.id, 'dismissed')}
                      title="Dismiss"
                      className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
