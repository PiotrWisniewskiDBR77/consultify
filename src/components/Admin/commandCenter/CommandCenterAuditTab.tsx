/**
 * Command Center — "Audyt SOC2" (F-CC3, blok Harvey-Parity HP-10…13).
 *
 * Eksport śladu audytowego (hash żądania/odpowiedzi, koszt, decyzje polityk)
 * z filtrem zakresu dat + akcja pobrania jako JSON. Lista przez
 * StandardTable (read-only — bez kebaba, tabela ewidencyjna).
 *
 * Endpoint: getComplianceAuditExport (GET .../audit-trail/export). Backend
 * zwraca już policzony wynik w kopercie JSON — "eksport" po stronie
 * frontu = wywołanie tego endpointu + zapis odpowiedzi jako plik .json
 * (nie ma osobnego endpointu generującego plik).
 */
import { Download, RefreshCw, ScrollText } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import {
  type AuditExportResult,
  getComplianceAuditExport,
} from '../../../services/enterpriseComplianceApi';
import { formatListDateTime } from '../../../utils/listDateFormat';
import { StandardTable, type TableColumn, type TableRow } from '../../standard';

const inputClass =
  'rounded-lg border border-c-border bg-c-surface px-3 py-2 text-sm text-c-text focus:border-c-focus focus:outline-none focus:ring-1 focus:ring-c-focus';

const defaultTo = () => new Date().toISOString().slice(0, 10);
const defaultFrom = () =>
  new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

export const CommandCenterAuditTab: React.FC = () => {
  const { t } = useTranslation();
  const [from, setFrom] = useState(defaultFrom());
  const [to, setTo] = useState(defaultTo());
  const [userId, setUserId] = useState('');
  const [eventType, setEventType] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AuditExportResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getComplianceAuditExport({
        from: from ? new Date(from).toISOString() : undefined,
        to: to ? new Date(`${to}T23:59:59.999Z`).toISOString() : undefined,
        userId: userId.trim() || undefined,
        eventType: eventType.trim() || undefined,
      });
      setResult(data);
    } catch (err: any) {
      setError(
        err?.message ||
          t('commandCenter.audit.toasts.loadError', 'Failed to load SOC2 audit export')
      );
    } finally {
      setLoading(false);
    }
  }, [from, to, userId, eventType, t]);

  const initialLoadRef = useRef(false);
  useEffect(() => {
    if (initialLoadRef.current) return;
    initialLoadRef.current = true;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDownload = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `soc2-audit-export-${defaultTo()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(t('commandCenter.audit.toasts.downloaded', 'Audit export downloaded'));
  };

  const rows = useMemo<TableRow[]>(
    () =>
      (result?.entries || []).map((entry) => ({
        ...entry,
        id: entry.id,
        policyCount: entry.policyDecisions?.length || 0,
      })),
    [result]
  );

  const columns: TableColumn[] = useMemo(
    () => [
      {
        id: 'createdAt',
        label: t('commandCenter.audit.columns.createdAt', 'Date'),
        width: '170px',
        sortable: true,
        render: (row: TableRow) => formatListDateTime(row.createdAt as string),
      },
      {
        id: 'eventType',
        label: t('commandCenter.audit.columns.eventType', 'Event'),
        width: '160px',
        filterable: true,
        sortable: true,
      },
      {
        id: 'modelId',
        label: t('commandCenter.audit.columns.model', 'Model'),
        width: '160px',
        render: (row: TableRow) => (row.modelId as string) || '—',
      },
      {
        id: 'tokens',
        label: t('commandCenter.audit.columns.tokens', 'Tokens (in/out)'),
        width: '140px',
        align: 'right',
        render: (row: TableRow) => `${row.tokensInput ?? 0} / ${row.tokensOutput ?? 0}`,
      },
      {
        id: 'costUsd',
        label: t('commandCenter.audit.columns.cost', 'Cost'),
        width: '100px',
        align: 'right',
        sortable: true,
        render: (row: TableRow) => `$${Number(row.costUsd || 0).toFixed(4)}`,
      },
      {
        id: 'latencyMs',
        label: t('commandCenter.audit.columns.latency', 'Latency'),
        width: '100px',
        align: 'right',
        sortable: true,
        render: (row: TableRow) => `${row.latencyMs ?? 0} ms`,
      },
      {
        id: 'policyCount',
        label: t('commandCenter.audit.columns.policy', 'Policy decisions'),
        width: '140px',
        align: 'right',
      },
    ],
    [t]
  );

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-c-border bg-c-surface p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="text-base font-semibold text-c-text">
              {t('commandCenter.audit.title', 'SOC2 audit trail')}
            </h3>
            <p className="mt-1 text-sm text-c-text-secondary">
              {t(
                'commandCenter.audit.description',
                'Export request/response hashes, cost, and policy decisions for a date range. Data is org-scoped by token.'
              )}
            </p>
            {result && (
              <p className="mt-2 text-xs text-c-text-muted">
                {t('commandCenter.audit.summary', '{{count}} entries — generated {{time}}', {
                  count: result.totalCount,
                  time: formatListDateTime(result.exportedAt),
                })}
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap items-end gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-c-text-secondary">
                {t('commandCenter.audit.filters.from', 'From')}
              </label>
              <input
                type="date"
                className={inputClass}
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-c-text-secondary">
                {t('commandCenter.audit.filters.to', 'To')}
              </label>
              <input
                type="date"
                className={inputClass}
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-c-text-secondary">
                {t('commandCenter.audit.filters.userId', 'User ID')}
              </label>
              <input
                className={inputClass}
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-c-text-secondary">
                {t('commandCenter.audit.filters.eventType', 'Event type')}
              </label>
              <input
                className={inputClass}
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                placeholder="chat.completion"
              />
            </div>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-c-border px-3 py-2 text-sm font-medium text-c-text-secondary hover:bg-c-surface-raised disabled:opacity-50"
            >
              <RefreshCw className="h-4 w-4" />
              {t('commandCenter.audit.filters.apply', 'Apply filters')}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={!result || result.entries.length === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-c-text px-3 py-2 text-sm font-medium text-c-bg hover:bg-c-text-secondary disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              {t('commandCenter.audit.actions.download', 'Download JSON')}
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-c-border bg-c-surface p-2">
        <StandardTable
          columns={columns}
          data={rows}
          loading={loading}
          error={error}
          onRetry={() => void load()}
          empty={{
            icon: ScrollText,
            title: t('commandCenter.audit.empty.title', 'No audit entries in this range'),
            description: t(
              'commandCenter.audit.empty.description',
              'Widen the date range or clear the filters.'
            ),
          }}
          persistKey="commandCenter.auditTrail"
        />
      </div>
    </div>
  );
};

export default CommandCenterAuditTab;
