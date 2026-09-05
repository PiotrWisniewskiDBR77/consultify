/**
 * AuditDrdReportsTab — 7th AuditsMethodHub tab, behind `isDrdReportEnabled()`
 * (`src/utils/drdReportFlag.ts`).
 *
 * Runda 3 odbioru (05.09, `evidence/odbior-zywo-20260905/11-audyty/wyniki.json`
 * id `audyty-drd-report`): `drdReportFlag.ts`'s header comment promised a
 * "Raporty DRD" tab in `AuditsHub`, but that hub was replaced by
 * `AuditsMethodHub.tsx`, which never read the flag (`rg 'drdReport'
 * src/components/Audit/` was zero hits before this file). `DRDAuditReportView`
 * (src/views/DRDAuditReportView.tsx) and its route
 * (`/audit-programs/drd-report/:reportId`) already exist and work — the only
 * missing piece was an entry point into that route from the Audits module,
 * listing the org's DRD-capable assessment reports.
 *
 * Data source: `GET /api/assessment-reports` (`Api.getAssessmentReports`,
 * already used elsewhere — e.g. `ReportsManagementPanel.tsx`,
 * `AssessmentHub.tsx`). No audit-program-scoped DRD report list endpoint
 * exists; this is the same list every other DRD-report consumer reads.
 *
 * Columns per the owner-approved image
 * (`evidence/grafika/20-tabele-szerokosc/audyty-drd-report__PRZED__light.png`):
 * PROGRAM (report name) | OCENA (the assessment it was generated from) |
 * STATUS | AKTUALIZACJA (updatedAt). Kanon: `StandardTable`, no bespoke grid.
 */
import { FileBarChart2 } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { StandardTable, type TableColumn, type TableRow } from '@/components/standard';
import { ErrorState } from '@/components/shared/states';
import { StatusChip, type StatusTone } from '@/components/ui/primitives/chips';
import { Api } from '@/services/api';
import { formatListDate } from '@/utils/listDateFormat';

export interface AuditDrdReportsTabProps {
  isPolish: boolean;
}

interface DrdAssessmentReportSummary extends TableRow {
  id: string;
  name: string;
  assessmentName: string;
  status: string;
  updatedAt: string;
}

// assessment_reports.status is UPPERCASE (`DRAFT`/`PENDING_APPROVAL`/
// `APPROVED`/`FINAL`/`UTILIZED` — server/src/routes/assessment-reports.routes.ts
// #680) — a distinct domain from the lowercase `AuditReportStatus` that
// `auditStatusTones.ts`'s `reportStatusLabel`/`reportStatusTone` map (a
// different entity, the audit_report/`audit-programs/reports` chain).
const DRD_STATUS_TONE: Record<string, StatusTone> = {
  DRAFT: 'neutral',
  PENDING_APPROVAL: 'warning',
  APPROVED: 'info',
  FINAL: 'success',
  UTILIZED: 'success',
};

const DRD_STATUS_LABEL: Record<string, { pl: string; en: string }> = {
  DRAFT: { pl: 'Szkic', en: 'Draft' },
  PENDING_APPROVAL: { pl: 'Do zatwierdzenia', en: 'Pending approval' },
  APPROVED: { pl: 'Zatwierdzony', en: 'Approved' },
  FINAL: { pl: 'Finalne', en: 'Final' },
  UTILIZED: { pl: 'Wykorzystany', en: 'Utilized' },
};

function drdStatusTone(status: string): StatusTone {
  return DRD_STATUS_TONE[status] || 'neutral';
}

function drdStatusLabel(status: string, isPolish: boolean): string {
  const entry = DRD_STATUS_LABEL[status];
  if (!entry) return status;
  return isPolish ? entry.pl : entry.en;
}

export const AuditDrdReportsTab: React.FC<AuditDrdReportsTabProps> = ({ isPolish }) => {
  const navigate = useNavigate();
  const [items, setItems] = useState<DrdAssessmentReportSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Api.getAssessmentReports()
      .then((reports: any[]) => {
        setItems(
          (reports || []).map((r) => ({
            id: String(r.id),
            name: r.name || (isPolish ? 'Raport bez nazwy' : 'Untitled report'),
            assessmentName: r.assessmentName || '—',
            status: String(r.status || 'DRAFT').toUpperCase(),
            updatedAt: r.updatedAt,
          }))
        );
      })
      .catch((e: any) =>
        setError(
          e?.message ||
            (isPolish ? 'Nie udało się wczytać raportów DRD' : 'Failed to load DRD reports')
        )
      )
      .finally(() => setLoading(false));
  }, [isPolish]);

  useEffect(() => {
    load();
  }, [load]);

  const openReport = useCallback(
    (row: TableRow) => {
      navigate(`/audit-programs/drd-report/${encodeURIComponent(String(row.id))}`);
    },
    [navigate]
  );

  const columns: TableColumn[] = [
    {
      id: 'program',
      label: 'Program',
      render: (row: DrdAssessmentReportSummary) => (
        <span className="text-sm font-semibold text-c-text">{row.name}</span>
      ),
    },
    {
      id: 'ocena',
      label: isPolish ? 'Ocena' : 'Assessment',
      render: (row: DrdAssessmentReportSummary) => (
        <span className="text-xs text-c-text-secondary">{row.assessmentName}</span>
      ),
    },
    {
      id: 'status',
      label: 'Status',
      width: '160px',
      filterable: true,
      filterOptions: Object.keys(DRD_STATUS_LABEL).map((value) => ({
        value,
        label: drdStatusLabel(value, isPolish),
      })),
      render: (row: DrdAssessmentReportSummary) => (
        <StatusChip label={drdStatusLabel(row.status, isPolish)} tone={drdStatusTone(row.status)} />
      ),
    },
    {
      id: 'updatedAt',
      label: isPolish ? 'Aktualizacja' : 'Updated',
      width: '150px',
      sortable: true,
      render: (row: DrdAssessmentReportSummary) => (
        <span className="text-xs text-c-text-secondary tabular-nums">
          {formatListDate(row.updatedAt)}
        </span>
      ),
    },
  ];

  if (error) {
    return (
      <div className="p-4">
        <ErrorState
          title={isPolish ? 'Nie udało się wczytać raportów DRD' : 'Could not load DRD reports'}
          description={error}
          onRetry={load}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0">
      <div className="flex-1 min-w-0 overflow-auto p-4">
        <StandardTable
          columns={columns}
          data={items}
          loading={loading}
          onRowClick={openReport}
          persistKey="audits.method.drdReports"
          empty={{
            icon: FileBarChart2,
            title: isPolish ? 'Brak raportów DRD' : 'No DRD reports yet',
            description: isPolish
              ? 'Raport DRD powstaje z ukończonej oceny (Assessment). Gdy organizacja wygeneruje pierwszy raport, pojawi się tutaj.'
              : 'A DRD report is generated from a completed assessment. Once your organization generates one, it will appear here.',
          }}
        />
      </div>
    </div>
  );
};

export default AuditDrdReportsTab;
