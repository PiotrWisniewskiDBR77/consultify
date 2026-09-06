/**
 * AuditInitiativesTab — U7 Initiatives surface: `AuditInitiativeProposal`.
 *
 * UCZCIWOŚĆ NAZEWNICZA (brief §D): to są lokalne PROPOSAL DRAFTY audytu, NIE
 * zarejestrowane Inicjatywy modułu Initiatives. `registeredInitiativeId`
 * istnieje w kernelu dopiero po jawnej rejestracji (poza zakresem tego
 * ekranu) — dopóki go nie ma, draft żyje wyłącznie tutaj. EmptyState i nagłówek
 * mówią to wprost, żeby nikt nie policzył tych wierszy jako Initiatives.
 *
 * DEC-2026-08-25-66 (Piotr, werdykt partii D, uwaga 4 — parytet z Tools/
 * Assessment): tabela nie miała kebaba wiersza w ogóle. Dodano kanoniczny
 * kebab z REALNYMI przejściami stanu — `POST /proposals/:id/register`,
 * `/dismiss`, `/defer` istnieją i są bramkowane na backendzie
 * (`proposalService.ts`) — plus podgląd (StandardPreview) i uczciwie
 * disabled Edit/Archive/Delete z powodem.
 */
import { Ban, CheckCircle2, Clock3, Lightbulb } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { type StandardRowMenu, StandardPreview, StandardTable, type TableColumn, type TableRow } from '@/components/standard';
import { JedenPrawyPanel } from '@/components/shared/PreviewPane/JedenPrawyPanel';
import { useJedenPanel } from '@/components/shared/PreviewPane/useJedenPanel';
import type { ArtifactPropertyRow } from '@/components/standard/ArtifactPropertiesTable';
import { ErrorState } from '@/components/shared/states';
import { PriorityChip, type PriorityLevel, StatusChip } from '@/components/ui/primitives/chips';
import { formatListDate } from '@/utils/listDateFormat';

import { proposalStatusLabel, proposalStatusTone } from '../auditStatusTones';
import {
  AUDIT_PROPOSAL_STATUSES,
  deferProposal,
  dismissProposal,
  listProposals,
  registerProposal,
  type AuditProposalSummary,
} from '../auditsMethodApi';

export interface AuditInitiativesTabProps {
  isPolish: boolean;
  /**
   * `programId` → nazwa programu — `/api/audits/proposals` nie wysyła
   * `programName` (`proposalService.ts` mapowanie ma tylko `program_id`), więc
   * pole frontendowe zawsze renderowało się jako „—". Rozwiązywane tutaj z
   * danych, które Hub już wczytał (`programsAll`).
   */
  programNameById?: Map<string, string>;
  /**
   * DEC-417b (1.1-A2): filtr statusu wybrany w Menu 3 / dropdownie Menu 2
   * Huba (`all` albo jedna z `AUDIT_PROPOSAL_STATUSES`).
   */
  statusFilter?: string;
  /** Rozkład statusów dla liczników chipów/dropdownu Menu 2 (Hub rysuje). */
  onCountsChange?: (counts: Record<string, number>) => void;
  /** Wymuszone przeładowanie po zamknięciu generatora z CTA Menu 2. */
  reloadToken?: number;
}

const EMPTY_MAP = new Map<string, string>();

const PRIORITY_LEVEL: Record<string, PriorityLevel> = {
  critical: 'urgent',
  high: 'high',
  medium: 'medium',
  low: 'low',
};

export const AuditInitiativesTab: React.FC<AuditInitiativesTabProps> = ({
  isPolish,
  programNameById = EMPTY_MAP,
  statusFilter = 'all',
  onCountsChange,
  reloadToken = 0,
}) => {
  // DEC-397b (1.1-K6): klik wiersza / kebab „Podgląd" po zamknięciu panelu
  // (X) mają go ponownie otworzyć — patrz InboxContent.tsx (K5, 2f5161f3b4).
  const jedenPanel = useJedenPanel();
  const [items, setItems] = useState<AuditProposalSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [transitioning, setTransitioning] = useState<string | null>(null);
  const [transitionError, setTransitionError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    listProposals()
      .then((result) => setItems(result.items))
      .catch((e: any) =>
        setError(e?.message || (isPolish ? 'Nie udało się wczytać szkiców propozycji' : 'Failed to load Proposal drafts'))
      )
      .finally(() => setLoading(false));
  }, [isPolish]);

  useEffect(() => {
    load();
  }, [load, reloadToken]);

  // Liczniki dla Menu 3/Menu 2 — z TEJ SAMEJ listy, którą widać w tabeli.
  useEffect(() => {
    const counts: Record<string, number> = { all: items.length };
    for (const status of AUDIT_PROPOSAL_STATUSES) {
      counts[status] = items.filter((p) => p.status === status).length;
    }
    onCountsChange?.(counts);
  }, [items, onCountsChange]);

  const visibleItems = useMemo(
    () => (statusFilter === 'all' ? items : items.filter((p) => p.status === statusFilter)),
    [items, statusFilter]
  );

  const runTransition = useCallback(
    async (id: string, action: 'register' | 'dismiss' | 'defer') => {
      setTransitioning(`${id}:${action}`);
      setTransitionError(null);
      try {
        const updated =
          action === 'register' ? await registerProposal(id) : action === 'dismiss' ? await dismissProposal(id) : await deferProposal(id);
        if (updated) {
          setItems((prev) => prev.map((p) => (p.id === id ? updated : p)));
        } else {
          await load();
        }
      } catch (e: any) {
        setTransitionError(
          e?.message ||
            (isPolish ? 'Nie udało się zmienić statusu szkicu propozycji' : 'Failed to change the Proposal draft status')
        );
      } finally {
        setTransitioning(null);
      }
    },
    [isPolish, load]
  );

  const columns: TableColumn[] = [
    {
      id: 'title',
      label: isPolish ? 'Tytuł' : 'Title',
      render: (row: AuditProposalSummary) => (
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-c-text">{row.title}</span>
          <span className="text-[11px] text-c-text-muted">
            {programNameById.get(row.programId) || row.programName || '—'}
          </span>
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
      label: 'Status',
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
      width: '200px',
      dataType: 'date',
      sortable: true,
      render: (row: AuditProposalSummary) => (
        <span className="text-xs text-c-text-secondary tabular-nums">{formatListDate(row.updatedAt)}</span>
      ),
    },
  ];

  const rowMenu = (rawRow: TableRow): StandardRowMenu => {
    const row = rawRow as unknown as AuditProposalSummary;
    const isRegistered = row.status === 'registered';
    const isDismissed = row.status === 'dismissed';
    const canRegister = !isRegistered && !isDismissed;
    const canDismissOrDefer = !isRegistered;
    return {
      statusTransitions: [
        {
          id: 'register',
          label: isPolish ? 'Zarejestruj jako inicjatywę' : 'Register as initiative',
          icon: CheckCircle2,
          onClick: canRegister ? () => void runTransition(row.id, 'register') : undefined,
          disabled: !canRegister || transitioning === `${row.id}:register`,
          note: canRegister
            ? undefined
            : isPolish
              ? `Nie można zarejestrować (status: ${proposalStatusLabel(row.status, true)})`
              : `Cannot register (status: ${proposalStatusLabel(row.status, false)})`,
        },
        {
          id: 'defer',
          label: isPolish ? 'Odłóż' : 'Defer',
          icon: Clock3,
          onClick: canDismissOrDefer ? () => void runTransition(row.id, 'defer') : undefined,
          disabled: !canDismissOrDefer || transitioning === `${row.id}:defer`,
          note: canDismissOrDefer
            ? undefined
            : isPolish
              ? 'Zarejestrowanej propozycji nie można odroczyć'
              : 'A registered proposal cannot be deferred',
        },
        {
          id: 'dismiss',
          label: isPolish ? 'Odrzuć' : 'Dismiss',
          icon: Ban,
          onClick: canDismissOrDefer ? () => void runTransition(row.id, 'dismiss') : undefined,
          disabled: !canDismissOrDefer || transitioning === `${row.id}:dismiss`,
          note: canDismissOrDefer
            ? undefined
            : isPolish
              ? 'Zarejestrowanej propozycji nie można odrzucić'
              : 'A registered proposal cannot be dismissed',
        },
      ],
      universalHandlers: {
        preview: () => {
          jedenPanel.otworz();
          setSelectedId(row.id);
        },
        editNote: isPolish
          ? 'Szkic propozycji powstaje z ustalenia — treść edytuje się w warsztacie kryterium, nie tutaj.'
          : 'A Proposal draft is generated from a finding — edit its content in the criterion workspace, not here.',
        archiveNote: isPolish
          ? 'Brak archiwizacji — użyj „Odłóż” albo „Odrzuć” do wycofania z aktywnej listy.'
          : 'No archive action — use "Defer" or "Dismiss" to take it off the active list.',
      },
      destructive: {
        note: isPolish
          ? 'Szkice propozycji są nieusuwalne — ślad audytu.'
          : 'Proposal drafts cannot be deleted — immutable audit trail.',
      },
    };
  };

  const selected = items.find((p) => p.id === selectedId) || null;
  const selectedProperties: ArtifactPropertyRow[] | undefined = selected
    ? [
        {
          id: 'program',
          label: 'Program',
          value: programNameById.get(selected.programId) || selected.programName || '—',
        },
        {
          id: 'sourceFindings',
          label: isPolish ? 'Ustalenia źródłowe' : 'Source findings',
          value: String(selected.sourceFindingIds.length),
          mono: true,
        },
        {
          id: 'priority',
          label: isPolish ? 'Priorytet' : 'Priority',
          value: selected.priority || '—',
        },
        {
          id: 'updatedAt',
          label: isPolish ? 'Zaktualizowano' : 'Updated',
          value: formatListDate(selected.updatedAt),
        },
      ]
    : undefined;

  if (error) {
    return (
      <div className="p-4">
        <ErrorState
          title={isPolish ? 'Nie udało się wczytać szkiców propozycji' : 'Could not load Proposal drafts'}
          description={error}
          onRetry={load}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* DEC-417b: linijka disclaimera nad tabelą znikła z paska (właściciel,
          06.09: „Straszny bałagan w menu trzecim") — to samo zdanie mówi
          teraz stan pusty tabeli, czyli tam, gdzie ktoś naprawdę pyta „co to
          w ogóle jest". Przycisk „Generuj inicjatywy" przeniesiony do CTA
          Menu 2 Huba („Nowa inicjatywa") — JEDNO wejście do generatora. */}
      <div className="flex min-h-0 flex-1">
        <div className="flex-1 min-w-0 overflow-auto p-4">
          {transitionError ? (
            <div className="mb-2 rounded-lg border border-c-danger/30 bg-c-danger/5 px-3 py-2 text-xs text-c-danger">
              {transitionError}
            </div>
          ) : null}
          <StandardTable
            columns={columns}
            data={visibleItems}
            loading={loading}
            rowMenu={rowMenu}
            onRowClick={(row) => {
              jedenPanel.otworz();
              setSelectedId(String(row.id));
            }}
            selectedRowId={selectedId}
            persistKey="audits.method.initiatives"
            empty={{
              icon: Lightbulb,
              title: isPolish ? 'Brak szkiców propozycji' : 'No Proposal drafts yet',
              description: isPolish
                ? 'To są lokalne szkice propozycji z ustaleń audytu — NIE są to zarejestrowane inicjatywy modułu Inicjatywy, dopóki ktoś jawnie ich nie zarejestruje. Szkic powstaje z ustalenia audytu; żadne ustalenie nie wygenerowało jeszcze propozycji. Użyj „Nowa inicjatywa” w pasku modułu.'
                : 'These are local Proposal drafts derived from audit findings — they are NOT registered Initiatives module items until someone explicitly registers them. A draft is created from an audit finding; no finding has produced a proposal yet. Use “New initiative” in the module bar.',
            }}
          />
        </div>
        <JedenPrawyPanel
          className="border-l border-c-border-subtle"
          rekord={selected ? (
            <StandardPreview
              title={selected.title}
              onClose={() => setSelectedId(null)}
              meta={{
                pills: [
                  {
                    label: 'Status',
                    value: proposalStatusLabel(selected.status, isPolish),
                    tone: proposalStatusTone(selected.status),
                  },
                ],
              }}
              details={{
                properties: selectedProperties,
                label: isPolish ? 'Szczegóły' : 'Details',
                propertyLabel: isPolish ? 'Właściwość' : 'Property',
                valueLabel: isPolish ? 'Wartość' : 'Value',
              }}
            />
          ) : null}
        />
      </div>

    </div>
  );
};

export default AuditInitiativesTab;
