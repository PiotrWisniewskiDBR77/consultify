/**
 * Command Center — "Retencja" (F-CC4, blok Harvey-Parity HP-10…13).
 *
 * Harmonogramy retencji (StandardTable, retentionDays edytowalne inline) +
 * initialize/execute. `execute` jest destrukcyjny (trwałe usunięcie danych
 * po oknie retencji) → ConfirmDialog przed wywołaniem (reguła sesji).
 *
 * Endpointy: getRetentionSchedules · initializeRetentionSchedules ·
 * updateRetentionSchedule · executeRetention.
 */
import { Check, Clock, Loader2, Play, RefreshCw } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import {
  executeRetention,
  getRetentionSchedules,
  initializeRetentionSchedules,
  type RetentionResult,
  type RetentionSchedule,
  updateRetentionSchedule,
} from '../../../services/enterpriseComplianceApi';
import { formatListDateTime } from '../../../utils/listDateFormat';
import { useConfirmDialog } from '../../MyWork/shared/ConfirmDialog';
import { StandardTable, type TableColumn, type TableRow } from '../../standard';

const RetentionDaysCell: React.FC<{
  schedule: RetentionSchedule;
  onSave: (id: string, days: number) => Promise<void>;
}> = ({ schedule, onSave }) => {
  const [value, setValue] = useState(schedule.retentionDays);
  const [saving, setSaving] = useState(false);
  const dirty = value !== schedule.retentionDays;

  useEffect(() => {
    setValue(schedule.retentionDays);
  }, [schedule.retentionDays]);

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        min={1}
        value={value}
        onChange={(e) => setValue(Number(e.target.value || 0))}
        className="w-20 rounded-lg border border-c-border bg-c-surface px-2 py-1 text-sm text-c-text focus:border-c-focus focus:outline-none focus:ring-1 focus:ring-c-focus"
      />
      {dirty && (
        <button
          type="button"
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            try {
              await onSave(schedule.id, value);
            } finally {
              setSaving(false);
            }
          }}
          className="rounded-md bg-c-text-secondary/10 p-1 text-c-text-secondary hover:bg-c-text-secondary/20 disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
        </button>
      )}
    </div>
  );
};

export const CommandCenterRetentionTab: React.FC = () => {
  const { t } = useTranslation();
  const { dialog, confirm } = useConfirmDialog();

  const [schedules, setSchedules] = useState<RetentionSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [lastResults, setLastResults] = useState<RetentionResult[] | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getRetentionSchedules();
      setSchedules(data);
    } catch (err: any) {
      setError(
        err?.message ||
          t('commandCenter.retention.toasts.loadError', 'Failed to load retention schedules')
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleInitialize = async () => {
    setInitializing(true);
    try {
      const data = await initializeRetentionSchedules();
      setSchedules(data);
      toast.success(
        t('commandCenter.retention.toasts.initialized', 'Retention schedules initialized')
      );
    } catch (err: any) {
      toast.error(
        err?.message ||
          t(
            'commandCenter.retention.toasts.initializeError',
            'Failed to initialize retention schedules'
          )
      );
    } finally {
      setInitializing(false);
    }
  };

  const handleUpdateDays = useCallback(
    async (id: string, days: number) => {
      try {
        await updateRetentionSchedule(id, { retentionDays: days });
        setSchedules((prev) => prev.map((s) => (s.id === id ? { ...s, retentionDays: days } : s)));
        toast.success(t('commandCenter.retention.toasts.updated', 'Retention schedule updated'));
      } catch (err: any) {
        toast.error(
          err?.message ||
            t('commandCenter.retention.toasts.updateError', 'Failed to update retention schedule')
        );
      }
    },
    [t]
  );

  const handleToggleActive = useCallback(
    async (schedule: RetentionSchedule) => {
      try {
        await updateRetentionSchedule(schedule.id, { isActive: !schedule.isActive });
        setSchedules((prev) =>
          prev.map((s) => (s.id === schedule.id ? { ...s, isActive: !s.isActive } : s))
        );
        toast.success(t('commandCenter.retention.toasts.updated', 'Retention schedule updated'));
      } catch (err: any) {
        toast.error(
          err?.message ||
            t('commandCenter.retention.toasts.updateError', 'Failed to update retention schedule')
        );
      }
    },
    [t]
  );

  const handleExecute = async () => {
    const ok = await confirm({
      title: t('commandCenter.retention.confirmExecute.title', 'Execute retention now?'),
      description: t(
        'commandCenter.retention.confirmExecute.description',
        'This permanently deletes data past its retention window for every active schedule in this organization. This cannot be undone.'
      ),
      confirmLabel: t('commandCenter.retention.actions.execute', 'Execute retention now'),
      cancelLabel: t('commandCenter.dlp.actions.cancel', 'Cancel'),
      variant: 'danger',
    });
    if (!ok) return;
    setExecuting(true);
    try {
      const results = await executeRetention();
      setLastResults(results);
      toast.success(t('commandCenter.retention.toasts.executed', 'Retention executed'));
      await load();
    } catch (err: any) {
      toast.error(
        err?.message ||
          t('commandCenter.retention.toasts.executeError', 'Failed to execute retention')
      );
    } finally {
      setExecuting(false);
    }
  };

  const formatDate = (value: string | null): string => formatListDateTime(value);

  const rows = useMemo<TableRow[]>(() => schedules.map((s) => ({ ...s, id: s.id })), [schedules]);

  const columns: TableColumn[] = useMemo(
    () => [
      {
        id: 'dataType',
        label: t('commandCenter.retention.columns.dataType', 'Data type'),
        sortable: true,
      },
      {
        id: 'retentionDays',
        label: t('commandCenter.retention.columns.retentionDays', 'Retention (days)'),
        width: '160px',
        render: (row: TableRow) => (
          <RetentionDaysCell
            schedule={row as unknown as RetentionSchedule}
            onSave={handleUpdateDays}
          />
        ),
      },
      {
        id: 'nextCleanupAt',
        label: t('commandCenter.retention.columns.nextCleanup', 'Next cleanup'),
        width: '180px',
        render: (row: TableRow) => formatDate(row.nextCleanupAt as string | null),
      },
      {
        id: 'lastCleanupAt',
        label: t('commandCenter.retention.columns.lastCleanup', 'Last cleanup'),
        width: '180px',
        render: (row: TableRow) => formatDate(row.lastCleanupAt as string | null),
      },
      {
        id: 'itemsDeletedTotal',
        label: t('commandCenter.retention.columns.itemsDeleted', 'Items deleted (total)'),
        width: '160px',
        align: 'right',
      },
      {
        id: 'isActive',
        label: t('commandCenter.retention.columns.status', 'Status'),
        width: '130px',
        render: (row: TableRow) => (
          <button
            type="button"
            onClick={() => void handleToggleActive(row as unknown as RetentionSchedule)}
            className={
              row.isActive
                ? 'inline-flex items-center rounded-full bg-c-success/15 px-2 py-0.5 text-xs font-medium text-c-success'
                : 'inline-flex items-center rounded-full bg-c-surface-raised px-2 py-0.5 text-xs font-medium text-c-text-muted'
            }
          >
            {row.isActive
              ? t('commandCenter.retention.status.active', 'Active')
              : t('commandCenter.retention.status.inactive', 'Inactive')}
          </button>
        ),
      },
    ],
    [t, handleUpdateDays, handleToggleActive]
  );

  return (
    <div className="space-y-6">
      {dialog}
      <div className="rounded-2xl border border-c-border bg-c-surface p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-c-text">
              {t('commandCenter.retention.title', 'Retention automation')}
            </h3>
            <p className="mt-1 text-sm text-c-text-secondary">
              {t(
                'commandCenter.retention.description',
                'Per-data-type retention schedules with automated cleanup.'
              )}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => void handleInitialize()}
              disabled={initializing}
              className="inline-flex items-center gap-2 rounded-lg border border-c-border px-3 py-2 text-sm font-medium text-c-text-secondary hover:bg-c-surface-raised disabled:opacity-50"
            >
              {initializing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {t('commandCenter.retention.actions.initialize', 'Initialize schedules')}
            </button>
            <button
              type="button"
              onClick={() => void handleExecute()}
              disabled={executing || schedules.length === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-c-danger px-3 py-2 text-sm font-medium text-white hover:brightness-110 disabled:opacity-50"
            >
              {executing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {t('commandCenter.retention.actions.execute', 'Execute retention now')}
            </button>
          </div>
        </div>

        {lastResults && lastResults.length > 0 && (
          <div className="mt-4 rounded-xl border border-c-border bg-c-surface-raised p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-c-text-secondary">
              {t('commandCenter.retention.results.title', 'Last execution result')}
            </p>
            <ul className="mt-1.5 space-y-1 text-xs text-c-text-secondary">
              {lastResults.map((r, idx) => (
                <li key={`${r.dataType}-${idx}`}>
                  {t(
                    'commandCenter.retention.results.summary',
                    '{{dataType}}: {{deleted}} deleted, {{preserved}} preserved',
                    {
                      dataType: r.dataType,
                      deleted: r.itemsDeleted,
                      preserved: r.preservedCount,
                    }
                  )}
                  {r.errors?.length > 0 && (
                    <span className="ml-2 text-c-danger">({r.errors.join('; ')})</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-c-border bg-c-surface p-2">
        <StandardTable
          columns={columns}
          data={rows}
          loading={loading}
          error={error}
          onRetry={() => void load()}
          empty={{
            icon: Clock,
            title: t('commandCenter.retention.empty.title', 'No retention schedules configured'),
            description: t(
              'commandCenter.retention.empty.description',
              'Initialize the default schedules to start automated cleanup.'
            ),
            actionLabel: t('commandCenter.retention.actions.initialize', 'Initialize schedules'),
            onAction: () => void handleInitialize(),
          }}
          persistKey="commandCenter.retentionSchedules"
        />
      </div>
    </div>
  );
};

export default CommandCenterRetentionTab;
