/**
 * OkrHistoryView — RN-G3 lane `okr` (2026-08-11), the "History" mode of the
 * full OKR tool workspace (design §8.3 mode 7; OKR-E007 §4.8/§5,
 * OKR-F-024). Read-only: `GET /sets/:setId/history` (merged
 * `rvn_platform_events` + `okr_vnext_set_versions` material-change rows,
 * `okrSetHistoryRepository.ts`) plus `GET /sets/:setId/approval-snapshots`.
 */
import React, { useCallback, useEffect, useState } from 'react';

import type { StandardBreadcrumb, TableColumn, TableRow } from '@/components/standard';

import { ResultsVNextRegistryShell } from '../ResultsVNextRegistryShell';
import type { OkrSetDto } from './okrApi';
import {
  getOkrSetHistory,
  listOkrSetApprovalSnapshots,
  type OkrSetApprovedSnapshotSummary,
  type OkrSetHistoryEntry,
} from './okrWorkspaceApi';
import { formatOkrWorkspaceDate, shortWorkspaceId } from './okrWorkspaceMappers';
import { toUserFacingErrorMessage } from '../shared/errorMessage';

export interface OkrHistoryViewProps {
  set: OkrSetDto;
  isPolish: boolean;
  breadcrumbs: StandardBreadcrumb[];
}

function historyRowId(entry: OkrSetHistoryEntry): string {
  return entry.kind === 'event' ? entry.eventId : entry.versionId;
}
function withId(entry: OkrSetHistoryEntry): OkrSetHistoryEntry & { id: string } {
  return { ...entry, id: historyRowId(entry) };
}

export const OkrHistoryView: React.FC<OkrHistoryViewProps> = ({ set, isPolish, breadcrumbs }) => {
  const [entries, setEntries] = useState<OkrSetHistoryEntry[] | null>(null);
  const [snapshots, setSnapshots] = useState<OkrSetApprovedSnapshotSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([getOkrSetHistory(set.setId), listOkrSetApprovalSnapshots(set.setId)])
      .then(([history, snaps]) => {
        setEntries(history.entries);
        setSnapshots(snaps);
      })
      .catch((err) => setError(toUserFacingErrorMessage(err, isPolish)))
      .finally(() => setLoading(false));
  }, [set.setId]);

  useEffect(() => {
    load();
  }, [load]);

  const columns: TableColumn[] = [
    {
      id: 'kind',
      label: isPolish ? 'Rodzaj' : 'Kind',
      width: '160px',
      render: (row: OkrSetHistoryEntry) => (
        <span className="text-sm text-c-text">
          {row.kind === 'event' ? row.eventType : isPolish ? `Zmiana pola: ${row.fieldName}` : `Field change: ${row.fieldName}`}
        </span>
      ),
    },
    {
      id: 'detail',
      label: isPolish ? 'Szczegóły' : 'Detail',
      width: '320px',
      render: (row: OkrSetHistoryEntry) =>
        row.kind === 'event' ? (
          <span className="text-sm text-c-text-secondary">{row.reason ?? '—'}</span>
        ) : (
          <span className="text-sm text-c-text-secondary">
            {shortWorkspaceId(row.beforeValue)} → {shortWorkspaceId(row.afterValue)} ({row.reason})
          </span>
        ),
    },
    {
      id: 'actor',
      label: isPolish ? 'Kto' : 'Actor',
      width: '150px',
      render: (row: OkrSetHistoryEntry) => (
        <span className="font-mono text-sm text-c-text-secondary">
          {shortWorkspaceId(row.kind === 'event' ? row.actorUserId : row.requestedBy)}
        </span>
      ),
    },
    {
      id: 'when',
      label: isPolish ? 'Kiedy' : 'When',
      width: '170px',
      render: (row: OkrSetHistoryEntry) => (
        <span className="text-sm text-c-text-secondary">{formatOkrWorkspaceDate(row.kind === 'event' ? row.occurredAt : row.requestedAt, isPolish)}</span>
      ),
    },
  ];

  const rows: TableRow[] = (entries ?? []).map(withId);

  return (
    <ResultsVNextRegistryShell
      domain="okr"
      moduleBar={{ breadcrumbs }}
      table={{
        columns,
        data: rows,
        persistKey: 'results-vnext.okr-history',
        loading,
        error,
        onRetry: load,
        defaultSort: { columnId: 'when', direction: 'desc' },
        empty:
          !loading && !error && rows.length === 0
            ? { title: isPolish ? 'Brak historii' : 'No history', description: isPolish ? 'Brak zdarzeń dla tego zestawu.' : 'No events for this set yet.' }
            : undefined,
      }}
      preview={
        snapshots.length > 0
          ? {
              title: isPolish ? 'Migawki akceptacji' : 'Approval snapshots',
              onClose: undefined,
              details: {
                propertyLabel: isPolish ? 'Migawka' : 'Snapshot',
                valueLabel: isPolish ? 'Zaakceptowano' : 'Approved',
                properties: snapshots.map((s) => ({
                  id: s.snapshotId,
                  label: `#${s.sequenceNumber} — ${shortWorkspaceId(s.snapshotId)}`,
                  value: formatOkrWorkspaceDate(s.approvedAt, isPolish),
                })),
              },
              relations: [],
            }
          : null
      }
    />
  );
};

export default OkrHistoryView;
