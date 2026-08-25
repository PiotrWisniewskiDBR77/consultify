import { FileClock } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';

import { getPlanHistory, type PlanHistoryEntry } from '../../services/adminBillingHistoryApi';
import { StandardTable, type TableColumn, type TableRow } from '../standard/StandardTable';

export const AdminPlanHistoryPanel: React.FC = () => {
  const [entries, setEntries] = useState<PlanHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setEntries(await getPlanHistory());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Nie udało się pobrać historii planu.');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => void load(), [load]);

  const rows = useMemo<TableRow[]>(
    () => entries.map((entry) => ({ ...entry, id: entry.id })),
    [entries]
  );
  const columns = useMemo<TableColumn[]>(
    () => [
      {
        id: 'created_at',
        label: 'Data',
        sortable: true,
        render: (row) => new Date(String(row.created_at)).toLocaleString(),
      },
      { id: 'action', label: 'Zmiana', sortable: true },
      { id: 'from_plan', label: 'Plan z', render: (row) => row.from_plan || '—' },
      { id: 'to_plan', label: 'Plan na', render: (row) => row.to_plan || '—' },
      { id: 'reason', label: 'Powód', render: (row) => row.reason || '—' },
      { id: 'performed_by', label: 'Wykonał', render: (row) => row.performed_by || 'System' },
    ],
    []
  );

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-c-border bg-c-surface p-5">
        <h2 className="text-lg font-semibold text-c-text">Historia zmian planu</h2>
        <p className="mt-1 text-sm text-c-text-secondary">
          Chronologiczny, tylko-do-odczytu zapis zmian subskrypcji tej organizacji.
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
            title: 'Brak historii zmian planu',
            description: 'Dla tej organizacji nie zapisano jeszcze zmiany subskrypcji.',
          }}
          persistKey="admin.planHistory"
        />
      </section>
    </div>
  );
};

export default AdminPlanHistoryPanel;
