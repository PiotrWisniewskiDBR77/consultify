import { CircleCheck, TriangleAlert } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { type AiIncident, getAiIncidents } from '../../services/adminAiIncidentsApi';
import { StandardTable, type TableColumn, type TableRow } from '../standard/StandardTable';
export const AdminAiIncidentsPanel: React.FC = () => {
  const { t } = useTranslation();
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
        {
          id: 'start',
          label: t('admin.ai.ai-incidents.columns.startedAt'),
        },
        {
          id: 'duration',
          label: t('admin.ai.ai-incidents.columns.duration'),
        },
        {
          id: 'samples',
          label: t('admin.ai.ai-incidents.columns.samples'),
        },
        {
          id: 'error',
          label: t('admin.ai.ai-incidents.columns.lastError'),
        },
        {
          id: 'source',
          label: t('admin.ai.ai-incidents.columns.source'),
        },
      ],
      [t]
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
        <h2 className="text-lg font-semibold text-c-text">{t('admin.ai.ai-incidents.title')}</h2>
        <p className="text-sm text-c-text-secondary">{t('admin.ai.ai-incidents.description')}</p>
      </div>
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-c-danger bg-c-surface p-4 text-sm text-c-danger"
        >
          {error}
        </div>
      )}
      {loaded && data.length === 0 && !error && (
        <div className="flex items-center gap-2 rounded-xl border border-c-success p-4">
          <CircleCheck className="h-5 w-5" />
          {t('admin.ai.ai-incidents.noIncidentsInWindow')}
        </div>
      )}
      <StandardTable
        columns={cols}
        data={rows}
        loading={!loaded}
        empty={{
          icon: TriangleAlert,
          title: t('admin.ai.ai-incidents.empty.title'),
          description: t('admin.ai.ai-incidents.empty.description'),
        }}
        persistKey="admin.aiIncidents"
      />
    </div>
  );
};
