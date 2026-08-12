/**
 * RoiCaseLearnWorkspace — the LEARN phase of the ROI Case FULL TOOL. Three
 * Menu 2 sub-views: PIR (schedule + list/detail + draft edit + ask-Teresa +
 * Teresa-draft disposition), Finance links (create/delete), Finance
 * reconciliations (open + status update). Variances/causes stay in the
 * Realize Value phase (`RoiCaseRealizeValueWorkspace.tsx`) — they are
 * raised during tracking, not exclusively a Learn-phase artifact, and the
 * task brief's own grouping list keeps "wariancje i przyczyny" adjacent to
 * "wykonania"/"prognozy", not PIR.
 *
 * D13 — Teresa proposes, never decides. TWO separate, sequential gates:
 *  1. GENERATION (`askTeresaTarget` / `TeresaProposalPanel`, RN-G4 lane
 *     `teresa`, FALA 2 2026-08-11): runs the full P08 propose→approve/
 *     reject→execute→audit lifecycle against the REAL
 *     `POST /api/v8/teresa/proposal*` surface
 *     (`teresaCopilotService.ts`'s `handleRoiPirLessonsDraft` →
 *     `recordRoiPirTeresaLessonsDraft`), writing ONLY
 *     `teresa_draft_lessons_payload`/`teresa_draft_generated_at`.
 *  2. DISPOSITION (`teresaTarget` / `RoiPirTeresaDispositionModal`,
 *     pre-existing, ROI-E006): RECORDS a human decision on the
 *     already-generated draft — this modal never generates or decides,
 *     only records — and is the ONLY path that can move a Teresa draft into
 *     `lessons_learned`.
 * The manual path (`RoiPirDraftEditModal` + `updateRoiPostInvestmentReviewDraft`)
 * never calls Teresa at all and stays reachable regardless of her
 * availability — see `onManualFallback` below and
 * `TeresaUnavailableBanner`.
 */
import { CalendarClock, Link2, Plus } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import type { StandardModuleTab, TableRow } from '@/components/standard';
import { useAppStore } from '@/store/useAppStore';

import { ResultsVNextRegistryShell } from '../ResultsVNextRegistryShell';
import { TeresaProposalPanel } from '../teresa/TeresaProposalPanel';
import type { RoiCaseListItem } from './roiApi';
import {
  buildRoiPirLessonsDraftHandoffContext,
  buildRoiPirLessonsDraftSuggestion,
  buildRoiPirLessonsDraftTargetPayload,
  roiPirTeresaConsequencePreview,
} from './roiTeresaLessonsDraft';
import {
  createRoiFinanceLink,
  getRoiPostInvestmentReview,
  listRoiFinanceLinks,
  listRoiFinanceReconciliations,
  listRoiPostInvestmentReviews,
  newRoiIdempotencyKey,
  openRoiFinanceReconciliation,
  recordRoiPirTeresaDraftDisposition,
  removeRoiFinanceLink,
  RoiApiError,
  scheduleRoiPostInvestmentReview,
  updateRoiFinanceReconciliationStatus,
  updateRoiPostInvestmentReviewDraft,
  type RoiFinanceLink,
  type RoiFinanceReconciliation,
  type RoiPostInvestmentReview,
} from './roiCaseFullToolApi';
import {
  buildRoiFinanceLinkColumns,
  buildRoiFinanceLinkPreview,
  buildRoiFinanceLinkRowMenu,
  buildRoiFinanceReconciliationColumns,
  buildRoiFinanceReconciliationPreview,
  buildRoiFinanceReconciliationRowMenu,
  buildRoiPirColumns,
  buildRoiPirPreview,
  buildRoiPirRowMenu,
  withRoiFullToolId,
} from './roiCaseFullToolPresenters';
import {
  RoiFinanceLinkFormModal,
  RoiFinanceReconciliationFormModal,
  RoiFinanceReconciliationStatusModal,
  RoiPirDraftEditModal,
  RoiPirScheduleModal,
  RoiPirTeresaDispositionModal,
} from './RoiLearnModals';
import { RoiRemoveLineItemDialog } from './RoiRemoveLineItemDialog';
import { buildRoiCasePhaseChips, type RoiCasePhase } from './RoiCasePhaseNav';

type LearnTab = 'pir' | 'finance-links' | 'finance-reconciliations';

interface WriteState { busy: boolean; error: string | null; isConflict: boolean; }
const IDLE_WRITE: WriteState = { busy: false, error: null, isConflict: false };

export interface RoiCaseLearnWorkspaceProps {
  roiCase: RoiCaseListItem;
  isPolish: boolean;
  onBack: () => void;
  phase: RoiCasePhase;
  onPhaseChange: (phase: RoiCasePhase) => void;
}

export const RoiCaseLearnWorkspace: React.FC<RoiCaseLearnWorkspaceProps> = ({ roiCase, isPolish, onBack, phase, onPhaseChange }) => {
  const [tab, setTab] = useState<LearnTab>('pir');
  const phaseChips = buildRoiCasePhaseChips(isPolish);
  const conflictOf = (err: unknown) => err instanceof RoiApiError && err.status === 409;
  const messageOf = (err: unknown) => (err instanceof Error ? err.message : String(err));

  // ── PIR ────────────────────────────────────────────────────────────────
  const [pirs, setPirs] = useState<RoiPostInvestmentReview[] | null>(null);
  const [pirError, setPirError] = useState<string | null>(null);
  const [pirLoading, setPirLoading] = useState(false);
  const [selectedPirId, setSelectedPirId] = useState<string | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [draftEditTarget, setDraftEditTarget] = useState<RoiPostInvestmentReview | null>(null);
  const [teresaTarget, setTeresaTarget] = useState<RoiPostInvestmentReview | null>(null);
  const [pirWrite, setPirWrite] = useState<WriteState>(IDLE_WRITE);
  // RN-G4 lane `teresa` — GENERATION gate (see file header). `askTeresaKey`
  // is a fresh idempotency key per open ATTEMPT (same convention as
  // `newRoiIdempotencyKey()` everywhere else in this file); regenerated
  // each time the panel opens, not on every render.
  const [askTeresaTarget, setAskTeresaTarget] = useState<RoiPostInvestmentReview | null>(null);
  const [askTeresaKey, setAskTeresaKey] = useState('');
  const currentOrganization = useAppStore((s) => s.currentOrganization);

  const loadPirs = useCallback(() => {
    setPirLoading(true); setPirError(null);
    listRoiPostInvestmentReviews(roiCase.caseId).then(setPirs).catch((e) => setPirError(messageOf(e))).finally(() => setPirLoading(false));
  }, [roiCase.caseId]);

  // ── Finance links ─────────────────────────────────────────────────────
  const [financeLinks, setFinanceLinks] = useState<RoiFinanceLink[] | null>(null);
  const [flError, setFlError] = useState<string | null>(null);
  const [flLoading, setFlLoading] = useState(false);
  const [selectedFlId, setSelectedFlId] = useState<string | null>(null);
  const [flFormOpen, setFlFormOpen] = useState(false);
  const [removeFl, setRemoveFl] = useState<RoiFinanceLink | null>(null);
  const [flWrite, setFlWrite] = useState<WriteState>(IDLE_WRITE);
  const [flIdempotencyKey, setFlIdempotencyKey] = useState('');

  const loadFinanceLinks = useCallback(() => {
    setFlLoading(true); setFlError(null);
    listRoiFinanceLinks(roiCase.caseId).then(setFinanceLinks).catch((e) => setFlError(messageOf(e))).finally(() => setFlLoading(false));
  }, [roiCase.caseId]);

  // ── Finance reconciliations ──────────────────────────────────────────
  const [reconciliations, setReconciliations] = useState<RoiFinanceReconciliation[] | null>(null);
  const [frError, setFrError] = useState<string | null>(null);
  const [frLoading, setFrLoading] = useState(false);
  const [selectedFrId, setSelectedFrId] = useState<string | null>(null);
  const [frFormOpen, setFrFormOpen] = useState(false);
  const [frStatusTarget, setFrStatusTarget] = useState<RoiFinanceReconciliation | null>(null);
  const [frWrite, setFrWrite] = useState<WriteState>(IDLE_WRITE);
  const [frIdempotencyKey, setFrIdempotencyKey] = useState('');

  const loadReconciliations = useCallback(() => {
    setFrLoading(true); setFrError(null);
    listRoiFinanceReconciliations(roiCase.caseId).then(setReconciliations).catch((e) => setFrError(messageOf(e))).finally(() => setFrLoading(false));
  }, [roiCase.caseId]);

  useEffect(() => {
    if (tab === 'pir' && pirs === null && !pirLoading) loadPirs();
    if (tab === 'finance-links' && financeLinks === null && !flLoading) loadFinanceLinks();
    if (tab === 'finance-reconciliations' && reconciliations === null && !frLoading) loadReconciliations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const breadcrumbs = [{ label: isPolish ? 'Rejestr ROI' : 'ROI registry', onClick: onBack }, { label: roiCase.title }];
  const tabs: StandardModuleTab[] = [
    { id: 'pir', label: 'PIR' },
    { id: 'finance-links', label: isPolish ? 'Powiązania Finance' : 'Finance links' },
    { id: 'finance-reconciliations', label: isPolish ? 'Rekoncyliacje' : 'Reconciliations' },
  ];
  const chipsBar = { chips: phaseChips, activeChip: phase, onChipChange: (id: string) => onPhaseChange(id as RoiCasePhase) };

  if (tab === 'finance-links') {
    const rows: TableRow[] = (financeLinks ?? []).map((l) => withRoiFullToolId(l, 'linkId'));
    const selected = (financeLinks ?? []).find((l) => l.linkId === selectedFlId) ?? null;
    return (
      <>
        <ResultsVNextRegistryShell
          domain="roi"
          moduleBar={{
            breadcrumbs, tabs, activeTab: tab, onTabChange: (id) => setTab(id as LearnTab),
            showTabCounts: false, viewModes: ['table'], viewMode: 'table', ...chipsBar,
            primaryCta: { label: isPolish ? 'Nowe powiązanie' : 'New link', icon: Link2, onClick: () => { setFlWrite(IDLE_WRITE); setFlIdempotencyKey(newRoiIdempotencyKey()); setFlFormOpen(true); }, testId: 'roi-learn-finance-link-create-cta' },
          }}
          table={{
            columns: buildRoiFinanceLinkColumns(isPolish),
            data: rows, persistKey: 'results-vnext.roi-learn.finance-links',
            loading: flLoading, error: flError, onRetry: loadFinanceLinks,
            empty: !flLoading && !flError && rows.length === 0 ? { title: isPolish ? 'Brak powiązań Finance' : 'No finance links yet', description: isPolish ? 'Ta sprawa nie ma jeszcze powiązań z artefaktami Finance.' : 'This case has no finance-artifact links yet.' } : undefined,
            selectedRowId: selectedFlId, onRowClick: (row) => setSelectedFlId(String(row.linkId)),
            rowMenu: (row) => buildRoiFinanceLinkRowMenu(row as unknown as RoiFinanceLink, roiCase.status, isPolish, {
              onPreview: (r) => setSelectedFlId(r.linkId),
              onRemove: (r) => setRemoveFl(r),
            }),
            defaultSort: { columnId: 'asOf', direction: 'desc' },
          }}
          preview={selected ? buildRoiFinanceLinkPreview(selected, isPolish, () => setSelectedFlId(null)) : null}
        />
        <RoiFinanceLinkFormModal
          open={flFormOpen}
          defaultCurrency={roiCase.currency}
          onClose={() => (flWrite.busy ? undefined : setFlFormOpen(false))}
          onSubmit={(values) => {
            setFlWrite({ busy: true, error: null, isConflict: false });
            createRoiFinanceLink(roiCase.caseId, { ...values, idempotencyKey: flIdempotencyKey })
              .then((res) => { setFinanceLinks((prev) => [res.financeLink, ...(prev ?? [])]); setSelectedFlId(res.financeLink.linkId); setFlFormOpen(false); })
              .catch((err) => setFlWrite({ busy: false, error: messageOf(err), isConflict: conflictOf(err) }))
              .finally(() => setFlWrite((s) => ({ ...s, busy: false })));
          }}
          isPolish={isPolish} busy={flWrite.busy} errorMessage={flWrite.error} isConflict={flWrite.isConflict}
        />
        <RoiRemoveLineItemDialog
          open={!!removeFl}
          itemLabel={removeFl?.financeArtifactType ?? ''}
          isPolish={isPolish}
          onClose={() => (flWrite.busy ? undefined : setRemoveFl(null))}
          onSubmit={(reason) => {
            if (!removeFl) return;
            setFlWrite({ busy: true, error: null, isConflict: false });
            removeRoiFinanceLink(roiCase.caseId, removeFl.linkId, { expectedVersion: removeFl.rowVersion, reason, idempotencyKey: newRoiIdempotencyKey() })
              .then(() => { setFinanceLinks((prev) => (prev ?? []).filter((l) => l.linkId !== removeFl.linkId)); if (selectedFlId === removeFl.linkId) setSelectedFlId(null); setRemoveFl(null); })
              .catch((err) => setFlWrite({ busy: false, error: messageOf(err), isConflict: conflictOf(err) }))
              .finally(() => setFlWrite((s) => ({ ...s, busy: false })));
          }}
          busy={flWrite.busy} errorMessage={flWrite.error} isConflict={flWrite.isConflict}
        />
      </>
    );
  }

  if (tab === 'finance-reconciliations') {
    const rows: TableRow[] = (reconciliations ?? []).map((r) => withRoiFullToolId(r, 'reconciliationId'));
    const selected = (reconciliations ?? []).find((r) => r.reconciliationId === selectedFrId) ?? null;
    return (
      <>
        <ResultsVNextRegistryShell
          domain="roi"
          moduleBar={{
            breadcrumbs, tabs, activeTab: tab, onTabChange: (id) => setTab(id as LearnTab),
            showTabCounts: false, viewModes: ['table'], viewMode: 'table', ...chipsBar,
            primaryCta: { label: isPolish ? 'Otwórz rekoncyliację' : 'Open reconciliation', icon: Plus, onClick: () => { setFrWrite(IDLE_WRITE); setFrIdempotencyKey(newRoiIdempotencyKey()); setFrFormOpen(true); }, testId: 'roi-learn-reconciliation-create-cta' },
          }}
          table={{
            columns: buildRoiFinanceReconciliationColumns(isPolish),
            data: rows, persistKey: 'results-vnext.roi-learn.finance-reconciliations',
            loading: frLoading, error: frError, onRetry: loadReconciliations,
            empty: !frLoading && !frError && rows.length === 0 ? { title: isPolish ? 'Brak rekoncyliacji' : 'No reconciliations yet', description: isPolish ? 'Ta sprawa nie ma jeszcze otwartych rekoncyliacji.' : 'This case has no open reconciliations yet.' } : undefined,
            selectedRowId: selectedFrId, onRowClick: (row) => setSelectedFrId(String(row.reconciliationId)),
            rowMenu: (row) => buildRoiFinanceReconciliationRowMenu(row as unknown as RoiFinanceReconciliation, isPolish, {
              onPreview: (r) => setSelectedFrId(r.reconciliationId),
              onEditStatus: (r) => { setFrWrite(IDLE_WRITE); setFrStatusTarget(r); },
            }),
            defaultSort: { columnId: 'openedAt', direction: 'desc' },
          }}
          preview={selected ? buildRoiFinanceReconciliationPreview(selected, isPolish, () => setSelectedFrId(null)) : null}
        />
        <RoiFinanceReconciliationFormModal
          open={frFormOpen}
          financeLinks={financeLinks ?? []}
          onClose={() => (frWrite.busy ? undefined : setFrFormOpen(false))}
          onSubmit={(values) => {
            setFrWrite({ busy: true, error: null, isConflict: false });
            openRoiFinanceReconciliation(roiCase.caseId, { ...values, idempotencyKey: frIdempotencyKey })
              .then((res) => { setReconciliations((prev) => [res.financeReconciliation, ...(prev ?? [])]); setSelectedFrId(res.financeReconciliation.reconciliationId); setFrFormOpen(false); })
              .catch((err) => setFrWrite({ busy: false, error: messageOf(err), isConflict: conflictOf(err) }))
              .finally(() => setFrWrite((s) => ({ ...s, busy: false })));
          }}
          isPolish={isPolish} busy={frWrite.busy} errorMessage={frWrite.error} isConflict={frWrite.isConflict}
        />
        <RoiFinanceReconciliationStatusModal
          open={!!frStatusTarget}
          currentStatus={frStatusTarget?.status ?? 'open'}
          onClose={() => (frWrite.busy ? undefined : setFrStatusTarget(null))}
          onSubmit={(values) => {
            if (!frStatusTarget) return;
            setFrWrite({ busy: true, error: null, isConflict: false });
            updateRoiFinanceReconciliationStatus(roiCase.caseId, frStatusTarget.reconciliationId, { ...values, expectedVersion: frStatusTarget.rowVersion, idempotencyKey: newRoiIdempotencyKey() })
              .then((res) => { setReconciliations((prev) => (prev ?? []).map((r) => (r.reconciliationId === res.financeReconciliation.reconciliationId ? res.financeReconciliation : r))); setFrStatusTarget(null); })
              .catch((err) => setFrWrite({ busy: false, error: messageOf(err), isConflict: conflictOf(err) }))
              .finally(() => setFrWrite((s) => ({ ...s, busy: false })));
          }}
          isPolish={isPolish} busy={frWrite.busy} errorMessage={frWrite.error} isConflict={frWrite.isConflict}
        />
      </>
    );
  }

  // ── PIR tab (default) ──────────────────────────────────────────────────
  const rows: TableRow[] = (pirs ?? []).map((p) => withRoiFullToolId(p, 'pirId'));
  const selected = (pirs ?? []).find((p) => p.pirId === selectedPirId) ?? null;
  return (
    <>
      <ResultsVNextRegistryShell
        domain="roi"
        moduleBar={{
          breadcrumbs, tabs, activeTab: tab, onTabChange: (id) => setTab(id as LearnTab),
          showTabCounts: false, viewModes: ['table'], viewMode: 'table', ...chipsBar,
          primaryCta: { label: isPolish ? 'Zaplanuj przegląd' : 'Schedule review', icon: CalendarClock, onClick: () => setScheduleOpen(true), testId: 'roi-learn-pir-schedule-cta' },
        }}
        table={{
          columns: buildRoiPirColumns(isPolish),
          data: rows, persistKey: 'results-vnext.roi-learn.pir',
          loading: pirLoading, error: pirError, onRetry: loadPirs,
          empty: !pirLoading && !pirError && rows.length === 0 ? { title: isPolish ? 'Brak przeglądów poinwestycyjnych' : 'No post-investment reviews yet', description: isPolish ? 'PIR powstaje po przejściu sprawy do statusu „Przegląd poinwestycyjny".' : 'A PIR is created once the case transitions to Post-investment review.' } : undefined,
          selectedRowId: selectedPirId, onRowClick: (row) => setSelectedPirId(String(row.pirId)),
          rowMenu: (row) => buildRoiPirRowMenu(row as unknown as RoiPostInvestmentReview, isPolish, {
            onPreview: (r) => setSelectedPirId(r.pirId),
            onEditDraft: (r) => { setPirWrite(IDLE_WRITE); setDraftEditTarget(r); },
            onTeresaDisposition: (r) => { setPirWrite(IDLE_WRITE); setTeresaTarget(r); },
            onAskTeresa: (r) => { setAskTeresaKey(newRoiIdempotencyKey()); setAskTeresaTarget(r); },
          }),
          defaultSort: { columnId: 'startedAt', direction: 'desc' },
        }}
        preview={selected ? buildRoiPirPreview(selected, isPolish, () => setSelectedPirId(null)) : null}
      />
      <RoiPirScheduleModal
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        onSubmit={(values) => {
          scheduleRoiPostInvestmentReview(roiCase.caseId, { ...values, expectedVersion: roiCase.rowVersion, idempotencyKey: newRoiIdempotencyKey() })
            .then(() => setScheduleOpen(false))
            .catch(() => undefined);
        }}
        isPolish={isPolish} busy={false} errorMessage={null} isConflict={false}
      />
      <RoiPirDraftEditModal
        open={!!draftEditTarget}
        current={draftEditTarget ? { outcome: draftEditTarget.outcome, lessonsLearned: draftEditTarget.lessonsLearned, recommendation: draftEditTarget.recommendation } : null}
        onClose={() => (pirWrite.busy ? undefined : setDraftEditTarget(null))}
        onSubmit={(values) => {
          if (!draftEditTarget) return;
          setPirWrite({ busy: true, error: null, isConflict: false });
          updateRoiPostInvestmentReviewDraft(roiCase.caseId, draftEditTarget.pirId, { ...values, expectedVersion: draftEditTarget.rowVersion, idempotencyKey: newRoiIdempotencyKey() })
            .then((res) => { setPirs((prev) => (prev ?? []).map((p) => (p.pirId === res.postInvestmentReview.pirId ? res.postInvestmentReview : p))); setDraftEditTarget(null); })
            .catch((err) => setPirWrite({ busy: false, error: messageOf(err), isConflict: conflictOf(err) }))
            .finally(() => setPirWrite((s) => ({ ...s, busy: false })));
        }}
        isPolish={isPolish} busy={pirWrite.busy} errorMessage={pirWrite.error} isConflict={pirWrite.isConflict}
      />
      <RoiPirTeresaDispositionModal
        open={!!teresaTarget}
        onClose={() => (pirWrite.busy ? undefined : setTeresaTarget(null))}
        onSubmit={(values) => {
          if (!teresaTarget) return;
          setPirWrite({ busy: true, error: null, isConflict: false });
          recordRoiPirTeresaDraftDisposition(roiCase.caseId, teresaTarget.pirId, { ...values, expectedVersion: teresaTarget.rowVersion, idempotencyKey: newRoiIdempotencyKey() })
            .then((res) => { setPirs((prev) => (prev ?? []).map((p) => (p.pirId === res.postInvestmentReview.pirId ? res.postInvestmentReview : p))); setTeresaTarget(null); })
            .catch((err) => setPirWrite({ busy: false, error: messageOf(err), isConflict: conflictOf(err) }))
            .finally(() => setPirWrite((s) => ({ ...s, busy: false })));
        }}
        isPolish={isPolish} busy={pirWrite.busy} errorMessage={pirWrite.error} isConflict={pirWrite.isConflict}
      />
      {askTeresaTarget ? (() => {
        const suggestion = buildRoiPirLessonsDraftSuggestion({ roiCase, pir: askTeresaTarget, isPolish });
        return (
          <TeresaProposalPanel
            open={!!askTeresaTarget}
            onClose={() => setAskTeresaTarget(null)}
            isPolish={isPolish}
            title={isPolish ? 'Poproś Teresę o szkic wniosków' : 'Ask Teresa for a lessons draft'}
            targetModule="roi"
            sessionId={`roi-pir-teresa-${roiCase.caseId}`}
            idempotencyKey={askTeresaKey}
            buildHandoffContext={() =>
              buildRoiPirLessonsDraftHandoffContext({
                roiCase,
                pir: askTeresaTarget,
                organizationId: currentOrganization?.id ?? roiCase.organizationId,
                suggestion,
                sessionId: `roi-pir-teresa-${roiCase.caseId}`,
              })
            }
            buildTargetPayload={() =>
              buildRoiPirLessonsDraftTargetPayload({ pir: askTeresaTarget, caseId: roiCase.caseId, suggestion })
            }
            renderProposedChange={() => (
              <p className="whitespace-pre-wrap" data-testid="teresa-roi-draft-text">
                {suggestion.draftLessonsText}
              </p>
            )}
            evidenceBreakdown={suggestion.evidenceBreakdown}
            evidencePointers={suggestion.evidencePointers}
            consequencePreview={roiPirTeresaConsequencePreview(askTeresaTarget, isPolish)}
            onCompleted={() => {
              // D13 "przeładowanie i zimne otwarcie" — re-fetch the PIR from
              // the server rather than approximating the write locally, so
              // the row the disposition step opens next is the real,
              // server-truth state (teresaDraftLessonsPayload/
              // teresaDraftGeneratedAt as actually persisted).
              getRoiPostInvestmentReview(roiCase.caseId, askTeresaTarget.pirId).then((fresh) => {
                if (fresh) setPirs((prev) => (prev ?? []).map((p) => (p.pirId === fresh.pirId ? fresh : p)));
              });
            }}
            onManualFallback={() => {
              setAskTeresaTarget(null);
              setPirWrite(IDLE_WRITE);
              setDraftEditTarget(askTeresaTarget);
            }}
          />
        );
      })() : null}
    </>
  );
};

export default RoiCaseLearnWorkspace;
