import { FileDown } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import {
  getAuditExportHistory,
  type AuditExportReceipt,
} from '../../services/adminAuditExportHistoryApi';
import { StandardTable, type TableColumn, type TableRow } from '../standard/StandardTable';
import { useTranslation } from 'react-i18next';
export const AdminAuditExportHistoryPanel: React.FC = () => {
  const { t } = useTranslation();
  const [data, setData] = useState<AuditExportReceipt[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState<string | null>(null);
  useEffect(() => {
    getAuditExportHistory()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  const cols = useMemo<TableColumn[]>(
      () => [
        {
          id: 'time',
          label: 'Kiedy',
        },
        {
          id: 'who',
          label: 'Kto',
        },
        {
          id: 'kind',
          label: t('admin.audit.export-history.day2Auto.text1'),
        },
        {
          id: 'rows',
          label: 'Wiersze',
        },
        {
          id: 'format',
          label: 'Format',
        },
      ],
      []
    ),
    rows = useMemo<TableRow[]>(
      () =>
        data.map((r) => ({
          id: r.id,
          time: new Date(r.created_at).toLocaleString(),
          who: r.requested_by,
          kind: r.export_kind,
          rows: r.row_count ?? '—',
          format: r.output_format || '—',
        })),
      [data]
    );
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-c-text">
          {t('admin.audit.export-history.day2Auto.text2')}
        </h2>
        <p className="text-sm text-c-text-secondary">
          {t('admin.audit.export-history.day2Auto.text3')}
        </p>
      </div>
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-c-danger bg-c-surface p-4 text-sm text-c-danger"
        >
          {error}
        </div>
      )}
      <StandardTable
        columns={cols}
        data={rows}
        loading={loading}
        empty={{
          icon: FileDown,
          title: t('admin.audit.export-history.day2Auto.text4'),
          description: t('admin.audit.export-history.day2Auto.text5'),
        }}
        persistKey="admin.auditExports"
      />
    </div>
  );
};
