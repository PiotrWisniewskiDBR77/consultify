/**
 * OkrCyclesPage — RN-G3 lane `okr` (2026-08-11), the Cycle admin surface
 * (`/results/okr/cycles`), OWN top-level route — same rationale as
 * `OkrProgramsPage.tsx`'s header. Full lifecycle IS mounted server-side
 * (`planned → drafting → active → review → closed`, plus `cancel` from any
 * non-terminal state — `okrCycleCommands.ts` L442-487, cited in
 * `okrAdminApi.ts`), so every transition button below is real, gated 1:1 to
 * the server's own `fromStatuses` per named spec — never guessed.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Blocks } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { TableColumn, TableRow } from '@/components/standard';
import { EmptyState } from '@/components/shared/states';
import { Modal, StatusChip } from '@/components/ui/primitives';

import { ResultsVNextRegistryShell } from '../ResultsVNextRegistryShell';
import { isResultsVNextFlagEnabled } from '../resultsVNextFeatureFlags';
import {
  activateOkrCycle,
  cancelOkrCycle,
  closeOkrCycle,
  createOkrCycle,
  listOkrCycles,
  listOkrPrograms,
  newOkrAdminIdempotencyKey,
  openDraftingOkrCycle,
  openReviewOkrCycle,
  OkrAdminApiError,
  type CreateOkrCycleInput,
  type OkrCycleDto,
  type OkrCycleStatus,
  type OkrCycleTransitionInput,
  type OkrProgramDto,
} from './okrAdminApi';
import { formatOkrWorkspaceDate } from './okrWorkspaceMappers';

const CYCLE_STATUS_TONE: Record<OkrCycleStatus, 'neutral' | 'success' | 'warning' | 'danger'> = {
  planned: 'neutral',
  drafting: 'warning',
  active: 'success',
  review: 'warning',
  closed: 'neutral',
  cancelled: 'danger',
};
const CYCLE_STATUS_LABEL: Record<OkrCycleStatus, { pl: string; en: string }> = {
  planned: { pl: 'Zaplanowany', en: 'Planned' },
  drafting: { pl: 'Szkicowanie', en: 'Drafting' },
  active: { pl: 'Aktywny', en: 'Active' },
  review: { pl: 'Przegląd', en: 'Review' },
  closed: { pl: 'Zamknięty', en: 'Closed' },
  cancelled: { pl: 'Anulowany', en: 'Cancelled' },
};
// Gate table — 1:1 with okrCycleCommands.ts L442-487's named specs.
const CYCLE_GATE_FROM: Record<'openDrafting' | 'activate' | 'openReview' | 'close' | 'cancel', OkrCycleStatus[]> = {
  openDrafting: ['planned'],
  activate: ['drafting'],
  openReview: ['active'],
  close: ['review'],
  cancel: ['planned', 'drafting', 'active', 'review'],
};

function withId(row: OkrCycleDto): OkrCycleDto & { id: string } {
  return { ...row, id: row.cycleId };
}

const EMPTY_CREATE: Omit<CreateOkrCycleInput, 'idempotencyKey'> = {
  programId: '',
  name: '',
  startDate: '',
  endDate: '',
  draftOpenAt: '',
  submissionDueAt: '',
  activeStartAt: '',
  finalUpdateDueAt: '',
  reviewOpenAt: '',
  reflectionDueAt: '',
  closeAt: '',
};

const OkrCyclesPageContent: React.FC<{ isPolish: boolean }> = ({ isPolish }) => {
  const [cycles, setCycles] = useState<OkrCycleDto[] | null>(null);
  const [programs, setPrograms] = useState<OkrProgramDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_CREATE);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    listOkrCycles()
      .then((rows) => setCycles(rows))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    listOkrPrograms()
      .then((rows) => {
        setPrograms(rows);
        if (rows.length > 0) setForm((prev) => ({ ...prev, programId: prev.programId || rows[0].programId }));
      })
      .catch(() => undefined);
  }, [load]);

  const selected = (cycles ?? []).find((c) => c.cycleId === selectedId) ?? null;
  const rows: TableRow[] = (cycles ?? []).map(withId);

  const respond = (fn: () => Promise<unknown>) => {
    setError(null);
    fn()
      .then(() => load())
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  };

  const transitionInput = (c: OkrCycleDto): OkrCycleTransitionInput => ({ expectedVersion: c.rowVersion, idempotencyKey: newOkrAdminIdempotencyKey() });

  const columns: TableColumn[] = [
    { id: 'name', label: isPolish ? 'Nazwa' : 'Name', width: '220px', sortable: true, render: (r: OkrCycleDto) => <span className="text-sm font-medium text-c-text">{r.name}</span> },
    {
      id: 'status',
      label: 'Status',
      width: '140px',
      filterable: true,
      filterOptions: (['planned', 'drafting', 'active', 'review', 'closed', 'cancelled'] as const).map((s) => ({
        value: s,
        label: isPolish ? CYCLE_STATUS_LABEL[s].pl : CYCLE_STATUS_LABEL[s].en,
      })),
      render: (r: OkrCycleDto) => <StatusChip label={isPolish ? CYCLE_STATUS_LABEL[r.status].pl : CYCLE_STATUS_LABEL[r.status].en} tone={CYCLE_STATUS_TONE[r.status]} />,
    },
    { id: 'startDate', label: isPolish ? 'Start' : 'Start', width: '130px', render: (r: OkrCycleDto) => <span className="text-sm text-c-text-secondary">{formatOkrWorkspaceDate(r.startDate, isPolish)}</span> },
    { id: 'endDate', label: isPolish ? 'Koniec' : 'End', width: '130px', render: (r: OkrCycleDto) => <span className="text-sm text-c-text-secondary">{formatOkrWorkspaceDate(r.endDate, isPolish)}</span> },
    { id: 'closeAt', label: isPolish ? 'Zamknięcie' : 'Close at', width: '150px', render: (r: OkrCycleDto) => <span className="text-sm text-c-text-secondary">{formatOkrWorkspaceDate(r.closeAt, isPolish)}</span> },
  ];

  const buildTransitions = (c: OkrCycleDto) => {
    const items: { id: string; label: string; allowed: boolean; onClick: () => void }[] = [
      { id: 'openDrafting', label: isPolish ? 'Otwórz szkicowanie' : 'Open drafting', allowed: CYCLE_GATE_FROM.openDrafting.includes(c.status), onClick: () => respond(() => openDraftingOkrCycle(c.cycleId, transitionInput(c))) },
      { id: 'activate', label: isPolish ? 'Aktywuj' : 'Activate', allowed: CYCLE_GATE_FROM.activate.includes(c.status), onClick: () => respond(() => activateOkrCycle(c.cycleId, transitionInput(c))) },
      { id: 'openReview', label: isPolish ? 'Otwórz przegląd' : 'Open review', allowed: CYCLE_GATE_FROM.openReview.includes(c.status), onClick: () => respond(() => openReviewOkrCycle(c.cycleId, transitionInput(c))) },
      { id: 'close', label: isPolish ? 'Zamknij' : 'Close', allowed: CYCLE_GATE_FROM.close.includes(c.status), onClick: () => respond(() => closeOkrCycle(c.cycleId, transitionInput(c))) },
    ];
    return items;
  };

  return (
    <>
      <ResultsVNextRegistryShell
        domain="okr"
        moduleBar={{
          breadcrumbs: [{ label: isPolish ? 'Wyniki' : 'Results' }, { label: 'OKR' }, { label: isPolish ? 'Cykle' : 'Cycles' }],
          breadcrumbCta: { label: isPolish ? 'Nowy cykl' : 'New cycle', onClick: () => { setForm((prev) => ({ ...EMPTY_CREATE, programId: prev.programId })); setFormError(null); setFormOpen(true); }, testId: 'okr-cycle-create-cta', locked: programs.length === 0, lockedReason: programs.length === 0 ? (isPolish ? 'Utwórz najpierw Program OKR.' : 'Create an OKR Program first.') : undefined },
        }}
        table={{
          columns,
          data: rows,
          persistKey: 'results-vnext.okr-cycles',
          loading,
          error,
          onRetry: load,
          selectedRowId: selectedId,
          onRowClick: (row) => setSelectedId(String(row.cycleId)),
          empty:
            !loading && !error && rows.length === 0
              ? { title: isPolish ? 'Brak cykli OKR' : 'No OKR cycles', description: isPolish ? 'Utwórz pierwszy cykl w ramach programu.' : 'Create the first cycle under a program.' }
              : undefined,
          rowMenu: (row) => {
            const c = row as unknown as OkrCycleDto;
            const transitions = buildTransitions(c).filter((t) => t.allowed);
            const canCancel = CYCLE_GATE_FROM.cancel.includes(c.status);
            return {
              primary: [{ id: 'open', label: isPolish ? 'Otwórz' : 'Open', onClick: () => setSelectedId(c.cycleId) }],
              universalHandlers: { preview: () => setSelectedId(c.cycleId) },
              statusTransitions: transitions.length
                ? transitions.map((t) => ({ id: t.id, label: t.label, onClick: t.onClick }))
                : [{ id: 'none', label: isPolish ? 'Brak dostępnych przejść' : 'No transitions available', disabled: true, note: isPolish ? `Status "${c.status}" nie ma dalszego przejścia poza anulowaniem.` : `Status "${c.status}" has no forward transition besides cancel.` }],
              destructive: canCancel
                ? { label: isPolish ? 'Anuluj cykl' : 'Cancel cycle', onClick: () => respond(() => cancelOkrCycle(c.cycleId, transitionInput(c))) }
                : { label: isPolish ? 'Anuluj cykl' : 'Cancel cycle', note: isPolish ? 'Cykl jest już zamknięty/anulowany.' : 'Cycle is already closed/cancelled.' },
            };
          },
        }}
        preview={
          selected
            ? {
                title: selected.name,
                onClose: () => setSelectedId(null),
                meta: { pills: [{ label: isPolish ? CYCLE_STATUS_LABEL[selected.status].pl : CYCLE_STATUS_LABEL[selected.status].en, tone: CYCLE_STATUS_TONE[selected.status] }] },
                details: {
                  propertyLabel: isPolish ? 'Właściwość' : 'Property',
                  valueLabel: isPolish ? 'Wartość' : 'Value',
                  properties: [
                    { id: 'programId', label: isPolish ? 'Program' : 'Program', value: selected.programId, mono: true },
                    { id: 'startDate', label: isPolish ? 'Start' : 'Start', value: formatOkrWorkspaceDate(selected.startDate, isPolish) },
                    { id: 'endDate', label: isPolish ? 'Koniec' : 'End', value: formatOkrWorkspaceDate(selected.endDate, isPolish) },
                    { id: 'draftOpenAt', label: isPolish ? 'Otwarcie szkicu' : 'Draft opens', value: formatOkrWorkspaceDate(selected.draftOpenAt, isPolish) },
                    { id: 'submissionDueAt', label: isPolish ? 'Termin złożenia' : 'Submission due', value: formatOkrWorkspaceDate(selected.submissionDueAt, isPolish) },
                    { id: 'activeStartAt', label: isPolish ? 'Start aktywności' : 'Active start', value: formatOkrWorkspaceDate(selected.activeStartAt, isPolish) },
                    { id: 'reviewOpenAt', label: isPolish ? 'Otwarcie przeglądu' : 'Review opens', value: formatOkrWorkspaceDate(selected.reviewOpenAt, isPolish) },
                    { id: 'reflectionDueAt', label: isPolish ? 'Termin refleksji' : 'Reflection due', value: formatOkrWorkspaceDate(selected.reflectionDueAt, isPolish) },
                    { id: 'closeAt', label: isPolish ? 'Zamknięcie' : 'Close at', value: formatOkrWorkspaceDate(selected.closeAt, isPolish) },
                  ],
                },
                relations: [],
              }
            : null
        }
      />

      <Modal
        open={formOpen}
        onClose={busy ? () => {} : () => setFormOpen(false)}
        title={isPolish ? 'Nowy cykl OKR' : 'New OKR cycle'}
        size="lg"
        preventOverlayClose={busy}
        preventEscapeClose={busy}
        footer={
          <>
            <button type="button" onClick={() => setFormOpen(false)} disabled={busy} className="inline-flex h-9 items-center gap-2 rounded-lg border border-c-border bg-transparent px-4 text-sm font-medium text-c-text hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus">
              {isPolish ? 'Wstecz' : 'Back'}
            </button>
            <button
              type="button"
              disabled={busy || !form.name.trim() || !form.programId || !form.startDate || !form.endDate || !form.draftOpenAt || !form.submissionDueAt || !form.activeStartAt || !form.finalUpdateDueAt || !form.reviewOpenAt || !form.reflectionDueAt || !form.closeAt}
              onClick={() => {
                setBusy(true);
                setFormError(null);
                createOkrCycle({ ...form, idempotencyKey: newOkrAdminIdempotencyKey() })
                  .then(() => {
                    setFormOpen(false);
                    load();
                  })
                  .catch((err) => setFormError(err instanceof Error ? err.message : String(err)))
                  .finally(() => setBusy(false));
              }}
              data-testid="okr-cycle-form-submit"
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-c-border-strong bg-c-text px-4 text-sm font-medium text-c-surface hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? (isPolish ? 'Zapisywanie…' : 'Saving…') : isPolish ? 'Zapisz' : 'Save'}
            </button>
          </>
        }
      >
        <div className="space-y-3 max-h-[60vh] overflow-auto pr-1">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-c-text-muted mb-1.5" htmlFor="okr-cycle-program">
              {isPolish ? 'Program' : 'Program'}
            </label>
            <select
              id="okr-cycle-program"
              value={form.programId}
              onChange={(e) => setForm((prev) => ({ ...prev, programId: e.target.value }))}
              className="w-full h-9 rounded-lg border border-c-border bg-c-surface px-3 text-sm text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            >
              {programs.map((p) => (
                <option key={p.programId} value={p.programId}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-c-text-muted mb-1.5" htmlFor="okr-cycle-name">
              {isPolish ? 'Nazwa' : 'Name'}
            </label>
            <input
              id="okr-cycle-name"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full h-9 rounded-lg border border-c-border bg-c-surface px-3 text-sm text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
              data-testid="okr-cycle-name-input"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                ['startDate', isPolish ? 'Start' : 'Start date'],
                ['endDate', isPolish ? 'Koniec' : 'End date'],
                ['draftOpenAt', isPolish ? 'Otwarcie szkicu' : 'Draft opens'],
                ['submissionDueAt', isPolish ? 'Termin złożenia' : 'Submission due'],
                ['activeStartAt', isPolish ? 'Start aktywności' : 'Active start'],
                ['finalUpdateDueAt', isPolish ? 'Ostatnia aktualizacja' : 'Final update due'],
                ['reviewOpenAt', isPolish ? 'Otwarcie przeglądu' : 'Review opens'],
                ['reflectionDueAt', isPolish ? 'Termin refleksji' : 'Reflection due'],
                ['closeAt', isPolish ? 'Zamknięcie' : 'Close at'],
              ] as const
            ).map(([field, label]) => (
              <div key={field}>
                <label className="block text-[10px] font-semibold uppercase tracking-wide text-c-text-muted mb-1">{label}</label>
                <input
                  type="datetime-local"
                  value={form[field]}
                  onChange={(e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))}
                  className="w-full h-8 rounded-lg border border-c-border bg-c-surface px-2 text-xs text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                  data-testid={`okr-cycle-${field}-input`}
                />
              </div>
            ))}
          </div>
          {formError ? (
            <div role="alert" className="flex items-start gap-2 rounded-lg border border-c-danger/30 bg-c-danger/10 px-3 py-2 text-[12px] text-c-text">
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-c-danger" />
              <span>{formError}</span>
            </div>
          ) : null}
        </div>
      </Modal>
    </>
  );
};

export const OkrCyclesPage: React.FC = () => {
  const { i18n } = useTranslation();
  const isPolish = !!i18n.language?.startsWith('pl');
  const enabled = isResultsVNextFlagEnabled('okrRegistry');

  if (!enabled) {
    return (
      <div className="h-full flex items-center justify-center p-6" data-testid="results-vnext-okr-cycles-disabled">
        <EmptyState
          variant="new"
          icon={Blocks}
          title={isPolish ? 'Cykle OKR — jeszcze nie włączone' : 'OKR Cycles — not yet enabled'}
          description={isPolish ? 'Ta powierzchnia jest w budowie. Wróć później albo poproś administratora o dostęp za flagą.' : 'This surface is still being built. Check back later, or ask an administrator for flag access.'}
          compact
        />
      </div>
    );
  }

  return <OkrCyclesPageContent isPolish={isPolish} />;
};

export default OkrCyclesPage;

export { OkrAdminApiError };
