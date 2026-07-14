import { RefreshCw, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Api } from '../../services/api';
import { Button } from './components/shared/Button';
import { Card } from './components/shared/Card';
import { SectionHeader } from './components/shared/PageHeader';

type SignalType = 'SYSTEM_ALERT' | 'CLIENT_TICKET' | 'USER_FEEDBACK';

type SignalItem = {
  id: string;
  type: SignalType;
  title?: string | null;
  message?: string | null;
  severity?: 'CRITICAL' | 'HIGH' | 'WARNING' | 'INFO' | string | null;
  created_at?: string | null;
};

function formatWhen(value?: string | null) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return '';
  }
}

function severityBadgeClasses(severity?: SignalItem['severity']) {
  const s = String(severity || '').toUpperCase();
  if (s === 'CRITICAL') return 'bg-danger-500/10 text-danger-600 dark:text-danger-400';
  if (s === 'HIGH') return 'bg-amber-500/10 text-amber-700 dark:text-amber-400';
  if (s === 'WARNING') return 'bg-primary-500/10 text-primary-700 dark:text-primary-400';
  return 'bg-slate-500/10 text-slate-600 dark:text-slate-400';
}

export const SuperAdminSignalsView: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<SignalItem[]>([]);

  const fetchSignals = useCallback(async () => {
    setLoading(true);
    try {
      const data = (await Api.getSuperAdminSignals()) as SignalItem[];
      setItems(Array.isArray(data) ? data : []);
    } catch (e: any) {
      console.error('[SuperAdminSignalsView] fetchSignals failed:', e);
      toast.error('Failed to load signals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSignals();
    const interval = window.setInterval(fetchSignals, 30000);
    return () => window.clearInterval(interval);
  }, [fetchSignals]);

  const groups = useMemo(() => {
    const system = items.filter((i) => i.type === 'SYSTEM_ALERT');
    const client = items.filter((i) => i.type === 'CLIENT_TICKET');
    const feedback = items.filter((i) => i.type === 'USER_FEEDBACK');
    return { system, client, feedback };
  }, [items]);

  const dismiss = async (id: string) => {
    try {
      await Api.markNotificationRead(id);
      setItems((prev) => prev.filter((x) => x.id !== id));
    } catch (e) {
      console.error('[SuperAdminSignalsView] dismiss failed:', e);
      toast.error('Failed to dismiss signal');
    }
  };

  const renderList = (list: SignalItem[]) => {
    if (loading) {
      return (
        <div className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">Loading…</div>
      );
    }
    if (list.length === 0) {
      return (
        <div className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
          No active signals.
        </div>
      );
    }

    return (
      <div className="divide-y divide-slate-100 dark:divide-white/[0.06]">
        {list.slice(0, 50).map((s) => (
          <div key={s.id} className="py-3 flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                    {s.title || 'Untitled'}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                    {s.message || 'No details provided.'}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold ${severityBadgeClasses(
                      s.severity
                    )}`}
                  >
                    {String(s.severity || 'INFO').toUpperCase()}
                  </span>
                  <button
                    onClick={() => dismiss(s.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-500 dark:hover:text-white dark:hover:bg-white/[0.06] transition-colors"
                    title="Dismiss"
                    aria-label="Dismiss"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-500 mt-2">
                {formatWhen(s.created_at)}
              </p>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-5 p-5 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            System alerts, client tickets, and user feedback (unread)
          </h2>
        </div>
        <Button variant="secondary" icon={RefreshCw} onClick={fetchSignals} loading={loading}>
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card variant="bordered" padding="lg" className="min-h-[320px]">
          <SectionHeader title="System Alerts" subtitle={`${groups.system.length} active`} />
          {renderList(groups.system)}
        </Card>

        <Card variant="bordered" padding="lg" className="min-h-[320px]">
          <SectionHeader title="Client Tickets" subtitle={`${groups.client.length} active`} />
          {renderList(groups.client)}
        </Card>

        <Card variant="bordered" padding="lg" className="min-h-[320px]">
          <SectionHeader title="User Feedback" subtitle={`${groups.feedback.length} active`} />
          {renderList(groups.feedback)}
        </Card>
      </div>
    </div>
  );
};

export default SuperAdminSignalsView;
