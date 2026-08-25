import { CircleCheck, TriangleAlert } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { getAiIncidents, type AiIncident } from '../../services/adminAiIncidentsApi';
import { StandardTable, type TableColumn, type TableRow } from '../standard/StandardTable';
export const AdminAiIncidentsPanel: React.FC = () => {
  const [data, setData] = useState<AiIncident[]>([]),
    [loaded, setLoaded] = useState(false),
    [error, setError] = useState<string | null>(null);
  useEffect(() => {
    getAiIncidents()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoaded(true));
  }, []);
  const cols = useMemo<TableColumn[]>(
      () => [
        { id: 'start', label: 'Początek' },
        { id: 'duration', label: 'Czas trwania' },
        { id: 'samples', label: 'Próbki' },
        { id: 'error', label: 'Ostatni błąd' },
        { id: 'source', label: 'Źródło' },
      ],
      []
    ),
    rows = useMemo<TableRow[]>(
      () =>
        data.map((x, i) => ({
          id: `${x.source}-${x.start}-${i}`,
          start: new Date(x.start).toLocaleString(),
          duration: x.durationMs == null ? '—' : `${Math.round(x.durationMs / 60000)} min`,
          samples: x.samples ?? '—',
          error: x.lastError || '—',
          source: x.source,
        })),
      [data]
    );
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-c-text">Incydenty AI</h2>
        <p className="text-sm text-c-text-secondary">
          Incydenty są wyliczane z bieżących pomiarów dostępności; trwały rejestr historyczny nie
          jest jeszcze prowadzony.
        </p>
      </div>
      {error && <div role="alert">{error}</div>}
      {loaded && data.length === 0 && !error && (
        <div className="flex items-center gap-2 rounded-xl border border-c-success p-4">
          <CircleCheck className="h-5 w-5" />
          Brak incydentów w bieżącym oknie pomiarowym.
        </div>
      )}
      <StandardTable
        columns={cols}
        data={rows}
        empty={{
          icon: TriangleAlert,
          title: 'Brak incydentów',
          description: 'Pomiary nie wykazały degradacji w bieżącym oknie.',
        }}
        persistKey="admin.aiIncidents"
      />
    </div>
  );
};
