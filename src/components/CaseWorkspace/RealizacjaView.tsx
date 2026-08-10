/**
 * Zlecenie → zakładka REALIZACJA.
 *
 * Odpowiada na jedno pytanie: co się teraz dzieje i na co czekamy. Dwie listy
 * (oczekiwania i sprawy do zatwierdzenia) idą przez `StandardTable`; szczegóły
 * przez `StandardPreview`, ZAMKNIĘTY domyślnie (warunek właściciela #6) —
 * otwiera się dopiero po kliknięciu wiersza.
 *
 * „W toku" nie jest używane dla kroku, który w rzeczywistości CZEKA
 * (`02_INFORMATION_ARCHITECTURE_AND_UX.md` §6.5) — stan oczekiwania nazywamy
 * po imieniu: na kogo/na co czekamy i od kiedy.
 */

import { Clock, Inbox } from 'lucide-react';
import React, { useMemo, useState } from 'react';

import { StandardPreview } from '@/components/standard/StandardPreview';
import { StandardTable, type TableColumn } from '@/components/standard/StandardTable';
import {
  caseStatusLabel,
  caseWaitStatusLabel,
  caseWaitTypeLabel,
  effectClassLabel,
  proposalStatusLabel,
} from '@/utils/enumLabels';

import type { CaseActionProposal, CaseCoreView, CaseHistoryEvent, CaseWait } from './types';
import { formatDateTime, relativeDays, StatusTag, TechnicalId } from './ui';

export interface RealizacjaViewProps {
  caseItem: CaseCoreView;
  waits: CaseWait[];
  proposals: CaseActionProposal[];
  history: CaseHistoryEvent[];
  /** Widok ekspercki = wolno pokazać identyfikatory techniczne obok polskiego opisu. */
  expert?: boolean;
}

type Selection = { kind: 'oczekiwanie'; id: string } | { kind: 'propozycja'; id: string } | null;

function waitTone(wait: CaseWait): 'critical' | 'warning' | 'success' | 'neutral' {
  if (wait.status === 'EXPIRED') return 'critical';
  if (wait.status === 'ACTIVE') {
    const deadline = wait.timeoutAt || wait.dueAt;
    if (deadline && new Date(deadline).getTime() < Date.now()) return 'critical';
    return 'warning';
  }
  if (wait.status === 'SATISFIED') return 'success';
  return 'neutral';
}

function proposalTone(
  status: CaseActionProposal['status']
): 'critical' | 'warning' | 'success' | 'neutral' {
  if (status === 'FAILED' || status === 'REJECTED') return 'critical';
  if (status === 'PENDING_REVIEW' || status === 'REQUESTED_CHANGES') return 'warning';
  if (status === 'EXECUTED' || status === 'AUDITED') return 'success';
  return 'neutral';
}

export const RealizacjaView: React.FC<RealizacjaViewProps> = ({
  caseItem,
  waits,
  proposals,
  history,
  expert,
}) => {
  const [selection, setSelection] = useState<Selection>(null);

  const activeWaits = useMemo(() => waits.filter((w) => w.status === 'ACTIVE'), [waits]);
  const pendingProposals = useMemo(
    () => proposals.filter((p) => p.status === 'PENDING_REVIEW'),
    [proposals]
  );

  const waitRows = useMemo(
    () =>
      waits.map((wait) => ({
        id: wait.waitId,
        naCo: caseWaitTypeLabel(wait.waitType, true),
        stan: caseWaitStatusLabel(wait.status, true),
        stanTone: waitTone(wait),
        odKiedy: wait.createdAt,
        termin: wait.timeoutAt || wait.dueAt || '',
        sygnal: wait.expectedEventType || '',
        raw: wait,
      })),
    [waits]
  );

  const proposalRows = useMemo(
    () =>
      proposals.map((proposal) => ({
        id: proposal.actionProposalId,
        czego: effectClassLabel(proposal.effectClass, true),
        stan: proposalStatusLabel(proposal.status, true),
        stanTone: proposalTone(proposal.status),
        ktoZglosil:
          proposal.proposerType === 'HUMAN'
            ? 'Człowiek'
            : proposal.proposerType === 'AGENT'
              ? 'Asystent AI'
              : 'System',
        zgloszone: proposal.createdAt,
        wazneDo: proposal.expiresAt || '',
        raw: proposal,
      })),
    [proposals]
  );

  const waitColumns: TableColumn[] = [
    {
      id: 'naCo',
      label: 'Na co czekamy',
      width: '250px',
      sortable: true,
      filterable: true,
      render: (row: Record<string, unknown>) => (
        <span className="text-sm font-medium text-c-text">{String(row.naCo)}</span>
      ),
    },
    {
      id: 'stan',
      label: 'Stan',
      width: '150px',
      filterable: true,
      render: (row: Record<string, unknown>) => (
        <StatusTag tone={row.stanTone as 'critical'}>{String(row.stan)}</StatusTag>
      ),
    },
    {
      id: 'odKiedy',
      label: 'Czeka od',
      width: '150px',
      sortable: true,
      render: (row: Record<string, unknown>) => (
        <span className="text-sm text-c-text-secondary" title={formatDateTime(String(row.odKiedy))}>
          {relativeDays(String(row.odKiedy))}
        </span>
      ),
    },
    {
      id: 'termin',
      label: 'Termin',
      width: '150px',
      sortable: true,
      render: (row: Record<string, unknown>) =>
        row.termin ? (
          <span className="text-sm text-c-text-secondary">
            {formatDateTime(String(row.termin))}
          </span>
        ) : (
          <span className="text-sm text-c-text-muted">bez terminu</span>
        ),
    },
  ];

  const proposalColumns: TableColumn[] = [
    {
      id: 'czego',
      label: 'Czego dotyczy',
      width: '260px',
      sortable: true,
      filterable: true,
      render: (row: Record<string, unknown>) => (
        <span className="text-sm font-medium text-c-text">{String(row.czego)}</span>
      ),
    },
    {
      id: 'stan',
      label: 'Stan',
      width: '180px',
      filterable: true,
      render: (row: Record<string, unknown>) => (
        <StatusTag tone={row.stanTone as 'critical'}>{String(row.stan)}</StatusTag>
      ),
    },
    { id: 'ktoZglosil', label: 'Kto zgłosił', width: '140px', filterable: true },
    {
      id: 'zgloszone',
      label: 'Zgłoszone',
      width: '150px',
      sortable: true,
      render: (row: Record<string, unknown>) => (
        <span className="text-sm text-c-text-secondary">{relativeDays(String(row.zgloszone))}</span>
      ),
    },
  ];

  const selectedWait =
    selection?.kind === 'oczekiwanie'
      ? (waits.find((w) => w.waitId === selection.id) ?? null)
      : null;
  const selectedProposal =
    selection?.kind === 'propozycja'
      ? (proposals.find((p) => p.actionProposalId === selection.id) ?? null)
      : null;

  return (
    <div className="flex min-w-0 flex-col gap-4 lg:flex-row">
      <div className="min-w-0 flex-1 space-y-4">
        {/* Co się teraz dzieje — jedno zdanie, bez żargonu. */}
        <div className="rounded-xl border border-c-border bg-c-surface p-3 sm:p-4">
          <h2 className="text-base font-semibold text-c-text">Co się teraz dzieje</h2>
          <p className="mt-1 text-sm text-c-text-secondary">
            Zlecenie jest w stanie „{caseStatusLabel(caseItem.caseStatus, true).toLowerCase()}".{' '}
            {activeWaits.length
              ? `Czekamy na ${activeWaits.length} ${activeWaits.length === 1 ? 'rzecz' : 'rzeczy'}.`
              : 'Nic nie jest w stanie oczekiwania.'}{' '}
            {pendingProposals.length
              ? `${pendingProposals.length} ${pendingProposals.length === 1 ? 'sprawa czeka' : 'sprawy czekają'} na Twoją decyzję.`
              : 'Nic nie czeka na Twoją decyzję.'}
          </p>
        </div>

        <section aria-labelledby="zlecenia-oczekiwania" className="min-w-0">
          <h3 id="zlecenia-oczekiwania" className="mb-2 text-sm font-semibold text-c-text">
            Na co czekamy
          </h3>
          <div className="min-w-0 overflow-hidden rounded-xl border border-c-border bg-c-surface p-2 sm:p-3">
            <StandardTable
              columns={waitColumns}
              data={waitRows}
              selectedRowId={selection?.kind === 'oczekiwanie' ? selection.id : null}
              onRowClick={(row) => setSelection({ kind: 'oczekiwanie', id: String(row.id) })}
              rowDescription={() => null}
              persistKey="caseWorkspace.execution.waits"
              density="compact"
              defaultSort={{ columnId: 'odKiedy', direction: 'desc' }}
              empty={{
                icon: Clock,
                title: 'Nic nie czeka',
                description: 'Żaden krok zlecenia nie jest w tej chwili wstrzymany.',
              }}
            />
          </div>
        </section>

        <section aria-labelledby="zlecenia-decyzje" className="min-w-0">
          <h3 id="zlecenia-decyzje" className="mb-2 text-sm font-semibold text-c-text">
            Sprawy do zatwierdzenia
          </h3>
          <div className="min-w-0 overflow-hidden rounded-xl border border-c-border bg-c-surface p-2 sm:p-3">
            <StandardTable
              columns={proposalColumns}
              data={proposalRows}
              selectedRowId={selection?.kind === 'propozycja' ? selection.id : null}
              onRowClick={(row) => setSelection({ kind: 'propozycja', id: String(row.id) })}
              rowDescription={() => null}
              persistKey="caseWorkspace.execution.proposals"
              density="compact"
              defaultSort={{ columnId: 'zgloszone', direction: 'desc' }}
              empty={{
                icon: Inbox,
                title: 'Nic nie czeka na decyzję',
                description: 'Gdy system będzie chciał coś zrobić w Twoim imieniu, zapyta tutaj.',
              }}
            />
          </div>
        </section>

        {history.length ? (
          <section aria-labelledby="zlecenia-przebieg" className="min-w-0">
            <h3 id="zlecenia-przebieg" className="mb-2 text-sm font-semibold text-c-text">
              Przebieg zlecenia
            </h3>
            <ol className="space-y-1.5">
              {history.slice(0, 12).map((event) => (
                <li
                  key={event.eventId}
                  className="flex flex-wrap items-baseline gap-x-2 rounded-lg border border-c-border bg-c-surface px-3 py-2"
                >
                  <span className="text-xs tabular-nums text-c-text-muted">
                    {formatDateTime(event.occurredAt)}
                  </span>
                  <span className="min-w-0 flex-1 text-sm text-c-text">{event.summary}</span>
                  {expert ? <TechnicalId value={event.eventType} /> : null}
                </li>
              ))}
            </ol>
          </section>
        ) : null}
      </div>

      {/* Prawy panel kontekstowy — ZAMKNIĘTY domyślnie, otwiera go dopiero
          kliknięcie wiersza (warunek właściciela #6). */}
      {selectedWait ? (
        <aside className="w-full shrink-0 lg:w-[380px]">
          <StandardPreview
            title={caseWaitTypeLabel(selectedWait.waitType, true)}
            onClose={() => setSelection(null)}
            meta={{
              pills: [{ label: caseWaitStatusLabel(selectedWait.status, true), tone: 'info' }],
              trailing: (
                <span className="text-xs text-c-text-muted">
                  {relativeDays(selectedWait.createdAt)}
                </span>
              ),
            }}
            details={{
              text: 'Ten krok zlecenia jest wstrzymany do czasu, aż nadejdzie opisany niżej sygnał.',
              showWordCount: false,
              propertyLabel: 'Właściwość',
              valueLabel: 'Wartość',
              properties: [
                {
                  id: 'czeka-od',
                  label: 'Czeka od',
                  value: formatDateTime(selectedWait.createdAt),
                },
                {
                  id: 'termin',
                  label: 'Termin',
                  value: selectedWait.timeoutAt
                    ? formatDateTime(selectedWait.timeoutAt)
                    : selectedWait.dueAt
                      ? formatDateTime(selectedWait.dueAt)
                      : 'bez terminu',
                },
                {
                  id: 'sygnal',
                  label: 'Oczekiwany sygnał',
                  value: selectedWait.expectedEventType
                    ? expert
                      ? selectedWait.expectedEventType
                      : 'zdarzenie w systemie'
                    : 'brak — czekamy na człowieka',
                },
                {
                  id: 'rozwiazane',
                  label: 'Doczekało się',
                  value: selectedWait.satisfiedAt
                    ? formatDateTime(selectedWait.satisfiedAt)
                    : 'jeszcze nie',
                },
              ],
            }}
          />
        </aside>
      ) : selectedProposal ? (
        <aside className="w-full shrink-0 lg:w-[380px]">
          <StandardPreview
            title={effectClassLabel(selectedProposal.effectClass, true)}
            onClose={() => setSelection(null)}
            meta={{
              pills: [{ label: proposalStatusLabel(selectedProposal.status, true), tone: 'info' }],
              trailing: (
                <span className="text-xs text-c-text-muted">
                  {relativeDays(selectedProposal.createdAt)}
                </span>
              ),
              recommendation:
                selectedProposal.status === 'PENDING_REVIEW'
                  ? 'Ta sprawa czeka na Twoją decyzję.'
                  : undefined,
            }}
            details={{
              text: 'Propozycja czynności zgłoszona w ramach tego zlecenia.',
              showWordCount: false,
              propertyLabel: 'Właściwość',
              valueLabel: 'Wartość',
              properties: [
                {
                  id: 'kto',
                  label: 'Kto zgłosił',
                  value:
                    selectedProposal.proposerType === 'HUMAN'
                      ? 'Człowiek'
                      : selectedProposal.proposerType === 'AGENT'
                        ? 'Asystent AI'
                        : 'System',
                },
                {
                  id: 'zgloszone',
                  label: 'Zgłoszone',
                  value: formatDateTime(selectedProposal.createdAt),
                },
                {
                  id: 'wazne',
                  label: 'Ważne do',
                  value: selectedProposal.expiresAt
                    ? formatDateTime(selectedProposal.expiresAt)
                    : 'bezterminowo',
                },
              ],
            }}
          />
        </aside>
      ) : null}
    </div>
  );
};

export default RealizacjaView;
