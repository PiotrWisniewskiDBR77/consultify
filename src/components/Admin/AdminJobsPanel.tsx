import { ListTodo } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getAdminJobs, type AdminJob } from '../../services/adminJobsApi';
import { StandardTable, type TableColumn, type TableRow } from '../standard/StandardTable';
export const AdminJobsPanel: React.FC = () => {
  const [jobs, setJobs] = useState<AdminJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setJobs(await getAdminJobs());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nie udało się pobrać zadań');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const counts = useMemo(
    () =>
      Object.fromEntries(
        ['queued', 'running', 'succeeded', 'failed'].map((s) => [
          s,
          jobs.filter((j) => j.status === s).length,
        ])
      ),
    [jobs]
  );
  const columns = useMemo<TableColumn[]>(
    () => [
      { id: 'type', label: 'Typ zadania' },
      { id: 'status', label: 'Status' },
      { id: 'attempts', label: 'Próby' },
      { id: 'error', label: 'Ostatni błąd' },
      { id: 'available', label: 'Dostępne od' },
      { id: 'created', label: 'Utworzono' },
    ],
    []
  );
  const rows = useMemo<TableRow[]>(
    () =>
      jobs.map((j) => ({
        id: j.id,
        type: j.job_type,
        status: j.status,
        attempts: `${j.attempt_count}/${j.max_attempts}`,
        error: j.last_error || '—',
        available: new Date(j.available_at).toLocaleString(),
        created: new Date(j.created_at).toLocaleString(),
      })),
    [jobs]
  );
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-c-text">Kolejki i zadania</h2>
        <p className="text-sm text-c-text-secondary">
          Tenantowy, tylko-do-odczytu stan zadań administracyjnych.
        </p>
      </div>
      {error && (
        <div role="alert" className="rounded-xl border border-c-danger p-3 text-c-danger">
          {error}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ['W kolejce', counts.queued],
          ['W trakcie', counts.running],
          ['Udane', counts.succeeded],
          ['Nieudane', counts.failed],
        ].map(([l, v]) => (
          <div key={l} className="rounded-xl border border-c-border bg-c-surface p-4">
            <p className="text-xs text-c-text-secondary">{l}</p>
            <p className="text-xl font-semibold text-c-text">{v}</p>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-c-border bg-c-surface p-2">
        <StandardTable
          columns={columns}
          data={rows}
          loading={loading}
          error={error}
          onRetry={() => void load()}
          empty={{
            icon: ListTodo,
            title: 'Brak zadań',
            description: 'Organizacja nie ma zadań administracyjnych w kolejce.',
          }}
          persistKey="admin.jobs"
        />
      </div>
    </div>
  );
};
