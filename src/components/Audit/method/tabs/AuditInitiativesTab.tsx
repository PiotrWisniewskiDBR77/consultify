/**
 * AuditInitiativesTab — U7 Initiatives surface: `AuditInitiativeProposal`.
 *
 * UCZCIWOŚĆ NAZEWNICZA (brief §D): to są lokalne PROPOSAL DRAFTY audytu, NIE
 * zarejestrowane Inicjatywy modułu Initiatives. `registeredInitiativeId`
 * istnieje w kernelu dopiero po jawnej rejestracji (poza zakresem tego
 * ekranu) — dopóki go nie ma, draft żyje wyłącznie tutaj. EmptyState i nagłówek
 * mówią to wprost, żeby nikt nie policzył tych wierszy jako Initiatives.
 */
import { Lightbulb } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import { StandardTable, type TableColumn } from '@/components/standard';
import { ErrorState } from '@/components/shared/states';
import { PriorityChip, type PriorityLevel, StatusChip } from '@/components/ui/primitives/chips';
import { formatListDate } from '@/utils/listDateFormat';

import { proposalStatusLabel, proposalStatusTone } from '../auditStatusTones';
import { AUDIT_PROPOSAL_STATUSES, listProposals, type AuditProposalSummary } from '../auditsMethodApi';

export interface AuditInitiativesTabProps {
  isPolish: boolean;
}

const PRIORITY_LEVEL: Record<string, PriorityLevel> = {
  critical: 'urgent',
  high: 'high',
  medium: 'medium',
  low: 'low',
};

export const AuditInitiativesTab: React.FC<AuditInitiativesTabProps> = ({ isPolish }) => {
  const [items, setItems] = useState<AuditProposalSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    listProposals()
      .then((result) => setItems(result.items))
      .catch((e: any) =>
        setError(e?.message || (isPolish ? 'Nie udało się wczytać Proposal Draftów' : 'Failed to load Proposal Drafts'))
      )
      .finally(() => setLoading(false));
  }, [isPolish]);

  useEffect(() => {
    load();
  }, [load]);

  const columns: TableColumn[] = [
    {
      id: 'title',
      label: isPolish ? 'Tytuł' : 'Title',
      render: (row: AuditProposalSummary) => (
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-c-text">{row.title}</span>
          <span className="text-[11px] text-c-text-muted">{row.programName || '—'}</span>
        </div>
      ),
    },
    {
      id: 'sourceFindings',
      label: isPolish ? 'Ustalenia źródłowe' : 'Source findings',
      width: '160px',
      render: (row: AuditProposalSummary) => (
        <span className="text-xs text-c-text-muted tabular-nums">{row.sourceFindingIds.length}</span>
      ),
    },
    {
      id: 'priority',
      label: isPolish ? 'Priorytet' : 'Priority',
      width: '110px',
      filterable: true,
      filterOptions: Object.keys(PRIORITY_LEVEL).map((value) => ({
        value,
        label: value.charAt(0).toUpperCase() + value.slice(1),
      })),
      render: (row: AuditProposalSummary) =>
        row.priority ? (
          <PriorityChip level={PRIORITY_LEVEL[row.priority] || 'medium'} label={row.priority} />
        ) : (
          <span className="text-xs text-slate-400">—</span>
        ),
    },
    {
      id: 'status',
      label: isPolish ? 'Status' : 'Status',
      width: '170px',
      filterable: true,
      filterOptions: AUDIT_PROPOSAL_STATUSES.map((value) => ({
        value,
        label: proposalStatusLabel(value, isPolish),
      })),
      render: (row: AuditProposalSummary) => (
        <StatusChip label={proposalStatusLabel(row.status, isPolish)} tone={proposalStatusTone(row.status)} />
      ),
    },
    {
      id: 'updatedAt',
      label: isPolish ? 'Zaktualizowano' : 'Updated',
      width: '140px',
      sortable: true,
      render: (row: AuditProposalSummary) => (
        <span className="text-xs text-c-text-secondary tabular-nums">{formatListDate(row.updatedAt)}</span>
      ),
    },
  ];

  if (error) {
    return (
      <div className="p-4">
        <ErrorState
          title={isPolish ? 'Nie udało się wczytać Proposal Draftów' : 'Could not load Proposal Drafts'}
          description={error}
          onRetry={load}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-2 p-4">
      <p className="text-xs text-c-text-muted">
        {isPolish
          ? 'To są lokalne szkice (Proposal Draft) z ustaleń audytu — NIE są to zarejestrowane Inicjatywy modułu Initiatives, dopóki ktoś jawnie ich nie zarejestruje.'
          : 'These are local Proposal Drafts derived from audit findings — they are NOT registered Initiatives module items until someone explicitly registers them.'}
      </p>
      <StandardTable
        columns={columns}
        data={items}
        loading={loading}
        persistKey="audits.method.initiatives"
        empty={{
          icon: Lightbulb,
          title: isPolish ? 'Brak Proposal Draftów' : 'No Proposal Drafts yet',
          description: isPolish
            ? 'Proposal Draft powstaje z ustalenia audytu podczas przeglądu ustaleń. Żadne ustalenie nie wygenerowało jeszcze propozycji.'
            : 'A Proposal Draft is created from an audit finding during findings review. No finding has produced a proposal yet.',
        }}
      />
    </div>
  );
};

export default AuditInitiativesTab;
