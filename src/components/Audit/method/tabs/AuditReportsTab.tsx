/**
 * AuditReportsTab — U7 Reports surface: raporty audytu (`AuditReport`) —
 * `audit_report`/`remediation_progress`, wersjonowane, wystawiane z Outputu.
 */
import { FileText } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import { StandardTable, type TableColumn } from '@/components/standard';
import { ErrorState } from '@/components/shared/states';
import { StatusChip } from '@/components/ui/primitives/chips';
import { formatListDate } from '@/utils/listDateFormat';

import { reportStatusLabel, reportStatusTone } from '../auditStatusTones';
import { AUDIT_REPORT_STATUSES, listReports, type AuditReportSummary } from '../auditsMethodApi';

export interface AuditReportsTabProps {
  isPolish: boolean;
}

const REPORT_KIND_LABEL: Record<string, { pl: string; en: string }> = {
  audit_report: { pl: 'Raport audytu', en: 'Audit report' },
  remediation_progress: { pl: 'Postęp naprawy', en: 'Remediation progress' },
};

export const AuditReportsTab: React.FC<AuditReportsTabProps> = ({ isPolish }) => {
  const [items, setItems] = useState<AuditReportSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    listReports()
      .then((result) => setItems(result.items))
      .catch((e: any) => setError(e?.message || (isPolish ? 'Nie udało się wczytać raportów' : 'Failed to load reports')))
      .finally(() => setLoading(false));
  }, [isPolish]);

  useEffect(() => {
    load();
  }, [load]);

  const columns: TableColumn[] = [
    {
      id: 'title',
      label: isPolish ? 'Tytuł' : 'Title',
      render: (row: AuditReportSummary) => (
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-c-text">{row.title}</span>
          <span className="text-[11px] text-c-text-muted">{row.programName || '—'}</span>
        </div>
      ),
    },
    {
      id: 'reportKind',
      label: isPolish ? 'Rodzaj' : 'Kind',
      width: '170px',
      render: (row: AuditReportSummary) => {
        const entry = REPORT_KIND_LABEL[row.reportKind];
        return <span className="text-xs text-c-text-secondary">{entry ? (isPolish ? entry.pl : entry.en) : row.reportKind}</span>;
      },
    },
    { id: 'version', label: isPolish ? 'Wersja' : 'Version', width: '90px' },
    {
      id: 'status',
      label: isPolish ? 'Status' : 'Status',
      width: '150px',
      filterable: true,
      filterOptions: AUDIT_REPORT_STATUSES.map((value) => ({
        value,
        label: reportStatusLabel(value, isPolish),
      })),
      render: (row: AuditReportSummary) => (
        <StatusChip label={reportStatusLabel(row.status, isPolish)} tone={reportStatusTone(row.status)} />
      ),
    },
    {
      id: 'language',
      label: isPolish ? 'Język' : 'Language',
      width: '90px',
      render: (row: AuditReportSummary) => (
        <span className="text-xs text-c-text-secondary">{row.language?.toUpperCase() || '—'}</span>
      ),
    },
    {
      id: 'publishedAt',
      label: isPolish ? 'Data publikacji' : 'Published at',
      width: '150px',
      sortable: true,
      render: (row: AuditReportSummary) => (
        <span className="text-xs text-c-text-secondary tabular-nums">{formatListDate(row.publishedAt)}</span>
      ),
    },
  ];

  if (error) {
    return (
      <div className="p-4">
        <ErrorState
          title={isPolish ? 'Nie udało się wczytać raportów' : 'Could not load reports'}
          description={error}
          onRetry={load}
        />
      </div>
    );
  }

  return (
    <div className="p-4">
      <StandardTable
        columns={columns}
        data={items}
        loading={loading}
        persistKey="audits.method.reports"
        empty={{
          icon: FileText,
          title: isPolish ? 'Brak raportów' : 'No reports yet',
          description: isPolish
            ? 'Raport powstaje z Outputu programu audytowego. Sfinalizuj program, żeby móc wystawić pierwszy raport.'
            : 'A report is issued from a program Output. Finalize a program to issue the first report.',
        }}
      />
    </div>
  );
};

export default AuditReportsTab;
