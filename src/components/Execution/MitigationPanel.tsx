/**
 * MitigationPanel (T040)
 *
 * Inline mitigation management for RAID risk items.
 * Allows setting: plan, owner, due date, response strategy, status.
 */

import { Check, Shield } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { trackFunnelEvent } from '../../services/funnelAnalytics';

interface MitigationPanelProps {
  raidItemId: string;
  initialPlan?: string;
  initialStrategy?: string;
  initialOwnerId?: string;
  initialDueDate?: string;
  initialStatus?: string;
  onSaved?: () => void;
}

const RESPONSE_STRATEGIES = ['AVOID', 'TRANSFER', 'MITIGATE', 'ACCEPT', 'ESCALATE'] as const;
const MITIGATION_STATUSES = ['OPEN', 'IN_PROGRESS', 'MITIGATED', 'ACCEPTED', 'CLOSED'] as const;

function getAuthToken(): string | null {
  try {
    return localStorage.getItem('token');
  } catch {
    return null;
  }
}

export const MitigationPanel: React.FC<MitigationPanelProps> = ({
  raidItemId,
  initialPlan = '',
  initialStrategy = '',
  initialOwnerId = '',
  initialDueDate = '',
  initialStatus = 'OPEN',
  onSaved,
}) => {
  const { t } = useTranslation();
  const [plan, setPlan] = useState(initialPlan);
  const [strategy, setStrategy] = useState(initialStrategy);
  const [ownerId, setOwnerId] = useState(initialOwnerId);
  const [dueDate, setDueDate] = useState(initialDueDate);
  const [status, setStatus] = useState(initialStatus);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaved(false);

    try {
      const token = getAuthToken();
      if (!token) return;

      const body: Record<string, string> = { raidItemId };
      if (plan) body.mitigationPlan = plan;
      if (strategy) body.responseStrategy = strategy;
      if (ownerId) body.mitigationOwnerId = ownerId;
      if (dueDate) body.mitigationDueDate = dueDate;
      if (status) body.mitigationStatus = status;

      const res = await fetch(`/api/execution-control/raid/${raidItemId}/mitigation`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setSaved(true);
        trackFunnelEvent('execution_risk_mitigation_updated', { raidItemId, strategy, status });
        onSaved?.();
        setTimeout(() => setSaved(false), 2000);
      }
    } catch {
      // noop
    } finally {
      setSaving(false);
    }
  }, [raidItemId, plan, strategy, ownerId, dueDate, status, onSaved]);

  const strategyKey = (s: string) => {
    const map: Record<string, string> = {
      AVOID: 'avoid',
      TRANSFER: 'transfer',
      MITIGATE: 'mitigate',
      ACCEPT: 'accept',
      ESCALATE: 'escalate',
    };
    return `execution.mitigation.${map[s] || s.toLowerCase()}`;
  };

  const statusKey = (s: string) => {
    const map: Record<string, string> = {
      OPEN: 'statusOpen',
      IN_PROGRESS: 'statusInProgress',
      MITIGATED: 'statusMitigated',
      ACCEPTED: 'statusAccepted',
      CLOSED: 'statusClosed',
    };
    return `execution.mitigation.${map[s] || 'statusOpen'}`;
  };

  return (
    <div className="space-y-3 p-3 rounded-lg bg-slate-50 dark:bg-navy-800/50 border border-slate-200 dark:border-navy-700">
      <div className="flex items-center gap-2">
        <Shield size={14} className="text-cyan-500" />
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
          {t('execution.mitigation.title')}
        </span>
      </div>

      <div>
        <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block mb-1">
          {t('execution.mitigation.plan')}
        </label>
        <textarea
          value={plan}
          onChange={(e) => setPlan(e.target.value)}
          placeholder={t('execution.mitigation.planPlaceholder')}
          rows={2}
          className="w-full text-xs bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded px-2.5 py-1.5 text-slate-700 dark:text-slate-300 placeholder:text-slate-400 resize-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block mb-1">
            {t('execution.mitigation.strategy')}
          </label>
          <select
            value={strategy}
            onChange={(e) => setStrategy(e.target.value)}
            className="w-full text-xs bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded px-2 py-1.5 text-slate-700 dark:text-slate-300"
          >
            <option value="">—</option>
            {RESPONSE_STRATEGIES.map((s) => (
              <option key={s} value={s}>
                {t(strategyKey(s))}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block mb-1">
            {t('execution.mitigation.status')}
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full text-xs bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded px-2 py-1.5 text-slate-700 dark:text-slate-300"
          >
            {MITIGATION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(statusKey(s))}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block mb-1">
            {t('execution.mitigation.dueDate')}
          </label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full text-xs bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded px-2 py-1.5 text-slate-700 dark:text-slate-300"
          />
        </div>
        <div>
          <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block mb-1">
            {t('execution.mitigation.owner')}
          </label>
          <input
            type="text"
            value={ownerId}
            onChange={(e) => setOwnerId(e.target.value)}
            placeholder="Owner ID"
            className="w-full text-xs bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded px-2 py-1.5 text-slate-700 dark:text-slate-300 placeholder:text-slate-400"
          />
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 transition-colors disabled:opacity-50"
      >
        {saved ? <Check size={12} /> : <Shield size={12} />}
        {saved ? t('execution.mitigation.saved') : t('execution.mitigation.save')}
      </button>
    </div>
  );
};

export default MitigationPanel;
