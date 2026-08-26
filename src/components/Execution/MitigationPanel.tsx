/**
 * MitigationPanel (T040)
 *
 * Inline mitigation management for RAID risk items.
 * Allows setting: plan, owner, due date, response strategy, status.
 */

import { Check, Shield } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import {
  shouldFallbackToLegacyExecutionControl,
  V8ExecutionControlApi,
  type V8ExecutionRaidMitigationPayload,
} from '@/services/api/v8/execution-control';

import { trackFunnelEvent } from '../../services/funnelAnalytics';

interface MitigationPanelProps {
  raidItemId: string;
  initialPlan?: string;
  initialStrategy?: V8ExecutionRaidMitigationPayload['responseStrategy'] | '';
  initialOwnerId?: string;
  initialDueDate?: string;
  initialStatus?: V8ExecutionRaidMitigationPayload['mitigationStatus'] | '';
  onSaved?: () => void;
}

const RESPONSE_STRATEGIES = ['AVOID', 'TRANSFER', 'MITIGATE', 'ACCEPT', 'ESCALATE'] as const;
const MITIGATION_STATUSES = ['OPEN', 'IN_PROGRESS', 'MITIGATED', 'ACCEPTED', 'CLOSED'] as const;

// A11/DEC-120: updateRaidMitigation posts through the retired legacy
// execution-control writer — requireCanonicalExecutionWriter 409s every
// non-GET on /api/v8/execution-control/* except budget-entry DELETE. Save
// is disabled with a visible reason until this panel is repointed at the
// canonical Runtime-v1 writer (tracked separately; not a batch-A change).
const RAID_MITIGATION_WRITES_DISABLED = true;

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
  const [strategy, setStrategy] = useState<
    V8ExecutionRaidMitigationPayload['responseStrategy'] | ''
  >(initialStrategy);
  const [ownerId, setOwnerId] = useState(initialOwnerId);
  const [dueDate, setDueDate] = useState(initialDueDate);
  const [status, setStatus] = useState<V8ExecutionRaidMitigationPayload['mitigationStatus'] | ''>(
    initialStatus
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaved(false);

    try {
      const token = getAuthToken();
      if (!token) return;

      const body: V8ExecutionRaidMitigationPayload = { raidItemId };
      if (plan) body.mitigationPlan = plan;
      if (strategy) body.responseStrategy = strategy;
      if (ownerId) body.mitigationOwnerId = ownerId;
      if (dueDate) body.mitigationDueDate = dueDate;
      if (status) body.mitigationStatus = status;

      const res = await V8ExecutionControlApi.updateRaidMitigation(raidItemId, body)
        .then(() => ({ ok: true, json: async () => ({}) }))
        .catch((error) => {
          if (!shouldFallbackToLegacyExecutionControl(error)) {
            throw error;
          }
          return fetch(`/api/execution-control/raid/${raidItemId}/mitigation`, {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
          });
        });

      if (res.ok) {
        setSaved(true);
        trackFunnelEvent('execution_risk_mitigation_updated', { raidItemId, strategy, status });
        onSaved?.();
        setTimeout(() => setSaved(false), 2000);
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(
          (err as any)?.error ||
            (err as any)?.message ||
            t('execution.toast.mitigationSaveFailed', 'Failed to save mitigation')
        );
      }
    } catch {
      toast.error(t('execution.toast.mitigationSaveFailed', 'Failed to save mitigation'));
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
        <Shield size={14} className="text-blue-500" />
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
            onChange={(e) =>
              setStrategy(e.target.value as V8ExecutionRaidMitigationPayload['responseStrategy'])
            }
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
            onChange={(e) =>
              setStatus(e.target.value as V8ExecutionRaidMitigationPayload['mitigationStatus'])
            }
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
            placeholder={t('execution.mitigation.ownerIdPlaceholder', 'Owner ID')}
            className="w-full text-xs bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded px-2 py-1.5 text-slate-700 dark:text-slate-300 placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* A11/DEC-120: updateRaidMitigation posts through the retired legacy
          execution-control writer (409 EXECUTION_RUNTIME_V1_WRITE_REQUIRED on
          every non-GET). Disabled with a visible reason instead of an active
          Save button that always errors. */}
      <button
        onClick={handleSave}
        disabled={saving || RAID_MITIGATION_WRITES_DISABLED}
        title={t(
          'execution.mitigation.saveDisabledReason',
          'Saving is moving to the canonical execution registry — in progress'
        )}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saved ? <Check size={12} /> : <Shield size={12} />}
        {saved ? t('execution.mitigation.saved') : t('execution.mitigation.save')}
      </button>
      <p className="text-[11px] leading-snug text-amber-600 dark:text-amber-400">
        {t(
          'execution.mitigation.saveDisabledReason',
          'Saving is moving to the canonical execution registry — in progress'
        )}
      </p>
    </div>
  );
};

export default MitigationPanel;
