import { Armchair, Save } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  getAdminSeatHistory,
  getAdminSeats,
  type SeatConfiguration,
  type SeatTransaction,
  updateAdminSeatAutoAdd,
} from '../../services/adminSeatsApi';
import { StandardTable, type TableColumn, type TableRow } from '../standard/StandardTable';
const buttonClass =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-c-border bg-c-surface px-3 py-2 text-sm font-medium text-c-text hover:bg-c-surface-raised disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 ring-[color:var(--c-focus)]';
export const AdminSeatsLicencesPanel: React.FC = () => {
  const { t } = useTranslation();
  const [config, setConfig] = useState<SeatConfiguration>({});
  const [history, setHistory] = useState<SeatTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [threshold, setThreshold] = useState(80);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [next, rows] = await Promise.all([getAdminSeats(), getAdminSeatHistory()]);
      setConfig(next);
      setHistory(rows);
      setEnabled(Boolean(next.auto_add_seats_on_invite));
      setThreshold(Number(next.auto_add_seats_threshold ?? 80));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : t('admin.billing.seats-licences.loadError')
      );
    } finally {
      setLoading(false);
    }
  }, [t]);
  useEffect(() => {
    void load();
  }, [load]);
  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const readback = await updateAdminSeatAutoAdd(enabled, threshold);
      setConfig(readback);
      setEnabled(Boolean(readback.auto_add_seats_on_invite));
      setThreshold(Number(readback.auto_add_seats_threshold ?? threshold));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : t('admin.billing.seats-licences.saveError')
      );
    } finally {
      setSaving(false);
    }
  };
  const columns = useMemo<TableColumn[]>(
    () => [
      {
        id: 'date',
        label: t('admin.billing.seats-licences.columns.date'),
        sortable: true,
      },
      {
        id: 'type',
        label: t('admin.billing.seats-licences.columns.type'),
      },
      {
        id: 'count',
        label: t('admin.billing.seats-licences.columns.count'),
        align: 'right',
      },
      {
        id: 'user',
        label: t('admin.billing.seats-licences.columns.user'),
      },
      {
        id: 'amount',
        label: t('admin.billing.seats-licences.columns.amount'),
        align: 'right',
      },
    ],
    [t]
  );
  const rows = useMemo<TableRow[]>(
    () =>
      history.map((item) => ({
        id: item.id,
        date: new Date(item.created_at).toLocaleString(),
        type: item.transaction_type,
        count: item.seats_count,
        user:
          [item.first_name, item.last_name].filter(Boolean).join(' ') ||
          item.triggered_by_email ||
          t('admin.billing.seats-licences.systemActor'),
        amount: item.total_amount == null ? '—' : item.total_amount.toFixed(2),
      })),
    [history, t]
  );
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-c-text">
          {t('admin.billing.seats-licences.title')}
        </h2>
        <p className="mt-1 text-sm text-c-text-secondary">
          {t('admin.billing.seats-licences.description')}
        </p>
      </div>
      {error && (
        <div role="alert" className="rounded-xl border border-c-danger p-3 text-sm text-c-danger">
          {error}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          [t('admin.billing.seats-licences.summary.total'), config.total_seats_available ?? 0],
          [t('admin.billing.seats-licences.summary.used'), config.seats_used ?? 0],
          [t('admin.billing.seats-licences.summary.remaining'), config.seats_remaining ?? 0],
          [
            t('admin.billing.seats-licences.summary.utilization'),
            `${config.utilization_percent ?? 0}%`,
          ],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-c-border bg-c-surface p-4">
            <p className="text-xs text-c-text-secondary">{label}</p>
            <p className="mt-1 text-xl font-semibold text-c-text">{value}</p>
          </div>
        ))}
      </div>
      <section className="rounded-xl border border-c-border bg-c-surface p-4">
        <h3 className="font-semibold text-c-text">
          {t('admin.billing.seats-licences.autoAdd.title')}
        </h3>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />{' '}
            {t('admin.billing.seats-licences.autoAdd.enabled')}
          </label>
          <label className="text-sm">
            {t('admin.billing.seats-licences.autoAdd.threshold')}
            <input
              aria-label={t('admin.billing.seats-licences.autoAdd.thresholdAria')}
              className="ml-2 w-20 rounded border border-c-border bg-c-surface px-2 py-1"
              type="number"
              min={1}
              max={100}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
            />
          </label>
          <button disabled={saving} onClick={() => void save()} className={buttonClass}>
            <Save className="h-4 w-4" />
            {t('admin.billing.seats-licences.actions.save')}
          </button>
        </div>
      </section>
      <section className="rounded-xl border border-c-border bg-c-surface p-2">
        <StandardTable
          columns={columns}
          data={rows}
          loading={loading}
          error={error}
          onRetry={() => void load()}
          empty={{
            icon: Armchair,
            title: t('admin.billing.seats-licences.history.emptyTitle'),
            description: t('admin.billing.seats-licences.history.emptyDescription'),
          }}
          persistKey="admin.seats"
        />
      </section>
      <section className="rounded-xl border border-c-border bg-c-surface p-4">
        <h3 className="font-semibold text-c-text">
          {t('admin.billing.seats-licences.purchase.title')}
        </h3>
        <p className="mt-1 text-sm text-c-text-secondary">
          {t('admin.billing.seats-licences.purchaseUnavailable')}
        </p>
        <button
          disabled
          className="mt-3 rounded-lg border border-c-border px-3 py-2 text-sm text-c-text-muted"
        >
          {t('admin.billing.seats-licences.actions.purchase')}
        </button>
      </section>
    </div>
  );
};
