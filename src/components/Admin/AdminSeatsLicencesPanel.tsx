import { Armchair, Save } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getAdminSeatHistory,
  getAdminSeats,
  type SeatConfiguration,
  type SeatTransaction,
  updateAdminSeatAutoAdd,
} from '../../services/adminSeatsApi';
import { StandardTable, type TableColumn, type TableRow } from '../standard/StandardTable';
import { useTranslation } from 'react-i18next';
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
        cause instanceof Error ? cause.message : t('admin.billing.seats-licences.day2Auto.text1')
      );
    } finally {
      setLoading(false);
    }
  }, []);
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
        cause instanceof Error ? cause.message : t('admin.billing.seats-licences.day2Auto.text2')
      );
    } finally {
      setSaving(false);
    }
  };
  const columns = useMemo<TableColumn[]>(
    () => [
      {
        id: 'date',
        label: 'Data',
        sortable: true,
      },
      {
        id: 'type',
        label: 'Typ',
      },
      {
        id: 'count',
        label: 'Liczba',
        align: 'right',
      },
      {
        id: 'user',
        label: t('admin.billing.seats-licences.day2Auto.text3'),
      },
      {
        id: 'amount',
        label: 'Kwota',
        align: 'right',
      },
    ],
    []
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
          'System',
        amount: item.total_amount == null ? '—' : item.total_amount.toFixed(2),
      })),
    [history]
  );
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-c-text">
          {t('admin.billing.seats-licences.day2Auto.text4')}
        </h2>
        <p className="mt-1 text-sm text-c-text-secondary">
          {t('admin.billing.seats-licences.day2Auto.text5')}
        </p>
      </div>
      {error && (
        <div role="alert" className="rounded-xl border border-c-danger p-3 text-sm text-c-danger">
          {error}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          [t('admin.billing.seats-licences.day2Auto.text6'), config.total_seats_available ?? 0],
          [t('admin.billing.seats-licences.day2Auto.text7'), config.seats_used ?? 0],
          ['Wolne', config.seats_remaining ?? 0],
          ['Wykorzystanie', `${config.utilization_percent ?? 0}%`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-c-border bg-c-surface p-4">
            <p className="text-xs text-c-text-secondary">{label}</p>
            <p className="mt-1 text-xl font-semibold text-c-text">{value}</p>
          </div>
        ))}
      </div>
      <section className="rounded-xl border border-c-border bg-c-surface p-4">
        <h3 className="font-semibold text-c-text">Automatyczne dodawanie miejsc</h3>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />{' '}
            {t('admin.billing.seats-licences.day2Auto.text8')}
          </label>
          <label className="text-sm">
            {t('admin.billing.seats-licences.day2Auto.text9')}
            <input
              aria-label={t('admin.billing.seats-licences.day2Auto.text10')}
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
            {t('admin.billing.seats-licences.day2Auto.text11')}
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
            title: t('admin.billing.seats-licences.day2Auto.text12'),
            description: t('admin.billing.seats-licences.day2Auto.text13'),
          }}
          persistKey="admin.seats"
        />
      </section>
      <section className="rounded-xl border border-c-border bg-c-surface p-4">
        <h3 className="font-semibold text-c-text">Zakup miejsc</h3>
        <p className="mt-1 text-sm text-c-text-secondary">
          {t('admin.billing.seats-licences.day2Auto.text14')}
        </p>
        <button
          disabled
          className="mt-3 rounded-lg border border-c-border px-3 py-2 text-sm text-c-text-muted"
        >
          {t('admin.billing.seats-licences.day2Auto.text15')}
        </button>
      </section>
    </div>
  );
};
