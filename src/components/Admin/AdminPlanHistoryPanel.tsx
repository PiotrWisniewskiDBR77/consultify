import { FileClock } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { getPlanHistory, type PlanHistoryEntry } from '../../services/adminBillingHistoryApi';
import { StandardTable, type TableColumn, type TableRow } from '../standard/StandardTable';
export const AdminPlanHistoryPanel: React.FC = () => {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<PlanHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setEntries(await getPlanHistory());
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : t('admin.billing.plan-history.loadError')
      );
    } finally {
      setLoading(false);
    }
  }, [t]);
  React.useEffect(() => void load(), [load]);
  const rows = useMemo<TableRow[]>(
    () =>
      entries.map((entry) => ({
        ...entry,
        id: entry.id,
      })),
    [entries]
  );
  const columns = useMemo<TableColumn[]>(
    () => [
      {
        id: 'created_at',
        label: t('admin.billing.plan-history.columns.date'),
        sortable: true,
        render: (row) => new Date(String(row.created_at)).toLocaleString(),
      },
      {
        id: 'action',
        label: t('admin.billing.plan-history.columns.action'),
        sortable: true,
      },
      {
        id: 'from_plan',
        label: t('admin.billing.plan-history.columns.fromPlan'),
        render: (row) => row.from_plan || '—',
      },
      {
        id: 'to_plan',
        label: t('admin.billing.plan-history.columns.toPlan'),
        render: (row) => row.to_plan || '—',
      },
      {
        id: 'reason',
        label: t('admin.billing.plan-history.columns.reason'),
        render: (row) => row.reason || '—',
      },
      {
        id: 'performed_by',
        label: t('admin.billing.plan-history.columns.actor'),
        render: (row) => row.performed_by || t('admin.billing.plan-history.systemActor'),
      },
    ],
    [t]
  );
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-c-border bg-c-surface p-5">
        <h2 className="text-lg font-semibold text-c-text">
          {t('admin.billing.plan-history.title')}
        </h2>
        <p className="mt-1 text-sm text-c-text-secondary">
          {t('admin.billing.plan-history.description')}
        </p>
      </section>
      <section className="rounded-2xl border border-c-border bg-c-surface p-2">
        <StandardTable
          columns={columns}
          data={rows}
          loading={loading}
          error={error}
          onRetry={() => void load()}
          empty={{
            icon: FileClock,
            title: t('admin.billing.plan-history.empty.title'),
            description: t('admin.billing.plan-history.empty.description'),
          }}
          persistKey="admin.planHistory"
        />
      </section>
    </div>
  );
};
export default AdminPlanHistoryPanel;
