import { FileDown } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  type AuditExportReceipt,
  getAuditExportHistory,
} from '../../services/adminAuditExportHistoryApi';
import { humanizeEnum } from '../../utils/enumLabels';
import { formatListDateTime } from '../../utils/listDateFormat';
import { StandardTable, type TableColumn, type TableRow } from '../standard/StandardTable';
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
          label: t('admin.audit.export-history.columns.time'),
        },
        {
          id: 'who',
          label: t('admin.audit.export-history.columns.requestedBy'),
        },
        {
          id: 'kind',
          label: t('admin.audit.export-history.columns.exportKind'),
          render: (row) => (
            <span title={String(row.kindRaw || '')}>
              {t(`admin.audit.export-history.kinds.${row.kindRaw}`, {
                defaultValue: humanizeEnum(String(row.kindRaw || '')),
              })}
            </span>
          ),
        },
        {
          id: 'rows',
          label: t('admin.audit.export-history.columns.rows'),
        },
        {
          id: 'format',
          label: t('admin.audit.export-history.columns.format'),
        },
      ],
      [t]
    ),
    rows = useMemo<TableRow[]>(
      () =>
        data.map((r) => ({
          id: r.id,
          time: formatListDateTime(r.created_at),
          who: r.requested_by,
          kind: r.export_kind,
          kindRaw: r.export_kind,
          rows: r.row_count ?? '—',
          format: r.output_format || '—',
        })),
      [data]
    );
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-c-text">
          {t('admin.audit.export-history.title')}
        </h2>
        <p className="text-sm text-c-text-secondary">
          {t('admin.audit.export-history.description')}
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
          title: t('admin.audit.export-history.empty.title'),
          description: t('admin.audit.export-history.empty.description'),
        }}
        persistKey="admin.auditExports"
      />
    </div>
  );
};
