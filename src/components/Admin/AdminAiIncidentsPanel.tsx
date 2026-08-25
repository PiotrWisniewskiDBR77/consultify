import { CircleCheck, TriangleAlert } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { getAiIncidents, type AiIncident } from '../../services/adminAiIncidentsApi';
import { StandardTable, type TableColumn, type TableRow } from '../standard/StandardTable';
import { useTranslation } from 'react-i18next';
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
          label: t('admin.ai.ai-incidents.day2Auto.text1'),
        },
        {
          id: 'duration',
          label: 'Czas trwania',
        },
        {
          id: 'samples',
          label: t('admin.ai.ai-incidents.day2Auto.text2'),
        },
        {
          id: 'error',
          label: t('admin.ai.ai-incidents.day2Auto.text3'),
        },
        {
          id: 'source',
          label: t('admin.ai.ai-incidents.day2Auto.text4'),
        },
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
        <p className="text-sm text-c-text-secondary">{t('admin.ai.ai-incidents.day2Auto.text5')}</p>
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
          {t('admin.ai.ai-incidents.day2Auto.text6')}
        </div>
      )}
      <StandardTable
        columns={cols}
        data={rows}
        loading={!loaded}
        empty={{
          icon: TriangleAlert,
          title: t('admin.ai.ai-incidents.day2Auto.text7'),
          description: t('admin.ai.ai-incidents.day2Auto.text8'),
        }}
        persistKey="admin.aiIncidents"
      />
    </div>
  );
};
