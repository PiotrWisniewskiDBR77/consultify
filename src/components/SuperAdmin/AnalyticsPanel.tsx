/**
 * AnalyticsPanel - System Analytics & Reporting
 */

import { Activity, BarChart3, Loader2, TrendingUp } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Api } from '../../services/api';

export const AnalyticsPanel: React.FC = () => {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const data = (await (Api as any).getSystemMetrics()) || {};
      setMetrics(data);
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-slate-400 dark:text-slate-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-c-text mb-2">System Analytics</h2>
          <p className="text-slate-400 dark:text-slate-500 text-sm">
            Monitor system performance and usage
          </p>
        </div>
      </div>

      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-slate-50/30 dark:bg-navy-950/20 rounded-xl border border-c-border-subtle">
            <div className="flex items-center gap-3 mb-2">
              <Activity size={20} className="text-blue-400" />
              <span className="text-sm text-slate-400 dark:text-slate-500">API Requests</span>
            </div>
            <div className="text-2xl font-bold text-c-text">{metrics.api?.total_requests || 0}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {metrics.api?.requests_last_hour || 0} in last hour
            </div>
          </div>

          <div className="p-4 bg-slate-50/30 dark:bg-navy-950/20 rounded-xl border border-c-border-subtle">
            <div className="flex items-center gap-3 mb-2">
              <BarChart3 size={20} className="text-green-400" />
              <span className="text-sm text-slate-400 dark:text-slate-500">AI Requests</span>
            </div>
            <div className="text-2xl font-bold text-c-text">{metrics.ai?.total_requests || 0}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Avg latency: {metrics.ai?.avg_latency || 0}ms
            </div>
          </div>

          <div className="p-4 bg-slate-50/30 dark:bg-navy-950/20 rounded-xl border border-c-border-subtle">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp size={20} className="text-primary-400" />
              <span className="text-sm text-slate-400 dark:text-slate-500">Database Queries</span>
            </div>
            <div className="text-2xl font-bold text-c-text">
              {metrics.database?.total_queries || 0}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {metrics.database?.queries_last_hour || 0} in last hour
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalyticsPanel;
