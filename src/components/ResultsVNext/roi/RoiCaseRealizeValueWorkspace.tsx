/**
 * RoiCaseRealizeValueWorkspace — the REALIZE VALUE phase of the ROI Case
 * FULL TOOL. Five Menu 2 sub-views: Forecast versions (publish +
 * list/detail), Actuals (record + correct/verify/dispute), Actual
 * snapshots (publish + list/detail), Variances (record + status + causes),
 * Benefits realization (the case's own single-row derived view,
 * `GET .../benefits-realization`, Decision D14 — readable in any status).
 *
 * Write guards, verbatim from server (see `roiCaseFullToolApi.ts` header
 * citations): forecast-version publish + actual-snapshot publish are gated
 * on `ROI_TRACKING_ACTIVE_STATUSES` (`roiForecastVersionCommands.ts:132-136`,
 * `roiActualSnapshotCommands.ts:142-146`); the FIRST actual-entry record is
 * gated the same way via `requireCaseTrackable`
 * (`roiActualEntryCommands.ts:113-129`) but corrections/verify/dispute have
 * **no case-status guard at all** (confirmed by direct read, not inferred);
 * variances/causes likewise have **no case-status guard**, by explicit
 * design ("a durable fact... legitimately raised at any point",
 * `roiVarianceCommands.ts`/`roiFinanceReconciliationCommands.ts:7-13`).
 */
import { CalendarClock, Camera, Play, Plus } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import type { StandardModuleTab, TableRow } from '@/components/standard';

import { ResultsVNextRegistryShell } from '../ResultsVNextRegistryShell';
import type { RoiCaseListItem, RoiCaseStatus } from './roiApi';
import type { RoiCostLine, RoiBenefitLine } from './roiCaseDetailApi';
import { listRoiBenefitLines, listRoiCostLines } from './roiCaseDetailApi';
import {
  correctRoiActualEntry,
  createRoiForecastVersion,
  disputeRoiActualEntry,
  getRoiCaseBenefitsRealization,
  listRoiActualEntries,
  listRoiActualSnapshots,
  listRoiApprovalSnapshots,
  listRoiForecastVersions,
  listRoiVariances,
  addRoiVarianceCause,
  newRoiIdempotencyKey,
  publishRoiActualSnapshot,
  recordRoiActualEntry,
  recordRoiVariance,
  removeRoiVarianceCause,
  RoiApiError,
  updateRoiVarianceStatus,
  verifyRoiActualEntry,
  type RoiActualEntry,
  type RoiActualSnapshot,
  type RoiApprovalSnapshot,
  type RoiCaseBenefitsRealizationView,
  type RoiForecastVersion,
  type RoiVariance,
  type RoiVarianceCause,
} from './roiCaseFullToolApi';
import {
  buildRoiActualEntryColumns,
  buildRoiActualEntryPreview,
  buildRoiActualEntryRowMenu,
  buildRoiActualSnapshotColumns,
  buildRoiActualSnapshotPreview,
  buildRoiActualSnapshotRowMenu,
  buildRoiCaseViewsColumns,
  buildRoiCaseViewsPreview,
  buildRoiCaseViewsRowMenu,
  buildRoiCaseViewsRows,
  buildRoiForecastVersionColumns,
  buildRoiForecastVersionPreview,
  buildRoiForecastVersionRowMenu,
  buildRoiVarianceColumns,
  buildRoiVariancePreview,
  buildRoiVarianceRowMenu,
  withRoiFullToolId,
} from './roiCaseFullToolPresenters';
import {
  RoiActualEntryActionModal,
  RoiActualEntryFormModal,
  RoiActualSnapshotPublishModal,
  RoiForecastVersionCreateModal,
  RoiVarianceCauseFormModal,
  RoiVarianceFormModal,
  RoiVarianceStatusModal,
  type RoiActualEntryActionKind,
} from './RoiRealizeValueModals';
import { buildRoiCasePhaseChips, type RoiCasePhase } from './RoiCasePhaseNav';
import { toUserFacingErrorMessage } from '../shared/errorMessage';

type RealizeTab = 'forecast-versions' | 'actuals' | 'actual-snapshots' | 'variances' | 'benefits-realization';

const ROI_TRACKING_ACTIVE_STATUSES: readonly RoiCaseStatus[] = ['tracking', 'benefits_realization', 'post_investment_review_due', 'post_investment_review'];

interface WriteState { busy: boolean; error: string | null; isConflict: boolean; }
const IDLE_WRITE: WriteState = { busy: false, error: null, isConflict: false };

export interface RoiCaseRealizeValueWorkspaceProps {
  roiCase: RoiCaseListItem;
  isPolish: boolean;
  onBack: () => void;
  phase: RoiCasePhase;
  onPhaseChange: (phase: RoiCasePhase) => void;
}

export const RoiCaseRealizeValueWorkspace: React.FC<RoiCaseRealizeValueWorkspaceProps> = ({ roiCase, isPolish, onBack, phase, onPhaseChange }) => {
  const [tab, setTab] = useState<RealizeTab>('forecast-versions');
  const phaseChips = buildRoiCasePhaseChips(isPolish);
  const conflictOf = (err: unknown) => err instanceof RoiApiError && err.status === 409;
  const messageOf = (err: unknown) => toUserFacingErrorMessage(err, isPolish);
  const trackable = ROI_TRACKING_ACTIVE_STATUSES.includes(roiCase.status);
  const trackableLockReason = isPolish
    ? 'Dostępne dopiero po rozpoczęciu śledzenia realizacji (statusy Śledzenie / Realizacja korzyści / PIR).'
    : 'Available only once tracking has started (Tracking / Benefits realization / PIR statuses).';

  // ── Forecast versions ─────────────────────────────────────────────────
  const [forecastVersions, setForecastVersions] = useState<RoiForecastVersion[] | null>(null);
  const [fvError, setFvError] = useState<string | null>(null);
  const [fvLoading, setFvLoading] = useState(false);
  const [selectedFvId, setSelectedFvId] = useState<string | null>(null);
  const [fvCreateOpen, setFvCreateOpen] = useState(false);
  const [fvWrite, setFvWrite] = useState<WriteState>(IDLE_WRITE);
  const [fvIdempotencyKey, setFvIdempotencyKey] = useState('');

  const loadForecastVersions = useCallback(() => {
    setFvLoading(true); setFvError(null);
    listRoiForecastVersions(roiCase.caseId).then(setForecastVersions).catch((e) => setFvError(messageOf(e))).finally(() => setFvLoading(false));
  }, [roiCase.caseId]);

  // ── Actuals ────────────────────────────────────────────────────────────
  const [actualEntries, setActualEntries] = useState<RoiActualEntry[] | null>(null);
  const [aeError, setAeError] = useState<string | null>(null);
  const [aeLoading, setAeLoading] = useState(false);
  const [selectedAeId, setSelectedAeId] = useState<string | null>(null);
  const [aeFormOpen, setAeFormOpen] = useState(false);
  const [aeAction, setAeAction] = useState<{ entry: RoiActualEntry; kind: RoiActualEntryActionKind } | null>(null);
  const [aeWrite, setAeWrite] = useState<WriteState>(IDLE_WRITE);
  const [aeIdempotencyKey, setAeIdempotencyKey] = useState('');
  const [costLines, setCostLines] = useState<RoiCostLine[]>([]);
  const [benefitLines, setBenefitLines] = useState<RoiBenefitLine[]>([]);

  const loadActualEntries = useCallback(() => {
    setAeLoading(true); setAeError(null);
    listRoiActualEntries(roiCase.caseId).then(setActualEntries).catch((e) => setAeError(messageOf(e))).finally(() => setAeLoading(false));
    // Cost/benefit lines are needed for the record-actual form's line
    // picker — best-effort, non-blocking (a failure here doesn't error the
    // whole tab, it just leaves the picker empty).
    listRoiCostLines(roiCase.caseId).then(setCostLines).catch(() => undefined);
    listRoiBenefitLines(roiCase.caseId).then(setBenefitLines).catch(() => undefined);
  }, [roiCase.caseId]);

  // ── Actual snapshots ───────────────────────────────────────────────────
  const [actualSnapshots, setActualSnapshots] = useState<RoiActualSnapshot[] | null>(null);
  const [asError, setAsError] = useState<string | null>(null);
  const [asLoading, setAsLoading] = useState(false);
  const [selectedAsId, setSelectedAsId] = useState<string | null>(null);
  const [asPublishOpen, setAsPublishOpen] = useState(false);
  const [asWrite, setAsWrite] = useState<WriteState>(IDLE_WRITE);
  const [asIdempotencyKey, setAsIdempotencyKey] = useState('');

  const loadActualSnapshots = useCallback(() => {
    setAsLoading(true); setAsError(null);
    listRoiActualSnapshots(roiCase.caseId).then(setActualSnapshots).catch((e) => setAsError(messageOf(e))).finally(() => setAsLoading(false));
  }, [roiCase.caseId]);

  // ── Variances ──────────────────────────────────────────────────────────
  const [variances, setVariances] = useState<RoiVariance[] | null>(null);
  const [varError, setVarError] = useState<string | null>(null);
  const [varLoading, setVarLoading] = useState(false);
  const [selectedVarId, setSelectedVarId] = useState<string | null>(null);
  const [varFormOpen, setVarFormOpen] = useState(false);
  const [varStatusTarget, setVarStatusTarget] = useState<RoiVariance | null>(null);
  const [varCauseTarget, setVarCauseTarget] = useState<RoiVariance | null>(null);
  const [varianceCauses, setVarianceCauses] = useState<Record<string, RoiVarianceCause[]>>({});
  const [varWrite, setVarWrite] = useState<WriteState>(IDLE_WRITE);
  const [varIdempotencyKey, setVarIdempotencyKey] = useState('');

  const loadVariances = useCallback(() => {
    setVarLoading(true); setVarError(null);
    listRoiVariances(roiCase.caseId).then(setVariances).catch((e) => setVarError(messageOf(e))).finally(() => setVarLoading(false));
  }, [roiCase.caseId]);

  // RN-G6-C2: the "Record variance" form's approval-snapshot picker was
  // hardcoded to an empty array (`approvalSnapshots={[]}` below), which
  // meant `comparisonType: 'approved_vs_forecast'`/`'approved_vs_actual'`
  // could NEVER be submitted successfully through the UI — the server
  // requires `referenceApprovalSnapshotId` for those two comparison types
  // (409 "requires both a approved reference and a forecast reference",
  // reproduced live) but the dropdown offering it always showed only "—".
  // Fetched lazily alongside variances (same real endpoint
  // `RoiCaseDecisionWorkspace.tsx`'s own Approval snapshots tab already
  // uses), not a new one.
  const [approvalSnapshots, setApprovalSnapshots] = useState<RoiApprovalSnapshot[]>([]);
  useEffect(() => {
    if (tab !== 'variances') return;
    let cancelled = false;
    listRoiApprovalSnapshots(roiCase.caseId)
      .then((rows) => { if (!cancelled) setApprovalSnapshots(rows); })
      .catch(() => {
        /* Non-blocking — a fetch failure here just leaves the picker
         * empty (same honest-gap behavior as before this fix, for THIS
         * one sub-resource only), it never blocks the rest of the tab. */
      });
    return () => { cancelled = true; };
  }, [tab, roiCase.caseId]);

  // ── Benefits realization (single-row view) ────────────────────────────
  const [benefitsRealization, setBenefitsRealization] = useState<RoiCaseBenefitsRealizationView | null | undefined>(undefined);
  const [brError, setBrError] = useState<string | null>(null);
  const [brLoading, setBrLoading] = useState(false);
  const [brSelected, setBrSelected] = useState(false);

  const loadBenefitsRealization = useCallback(() => {
    setBrLoading(true); setBrError(null);
    getRoiCaseBenefitsRealization(roiCase.caseId).then(setBenefitsRealization).catch((e) => setBrError(messageOf(e))).finally(() => setBrLoading(false));
  }, [roiCase.caseId]);

  useEffect(() => {
    if (tab === 'forecast-versions' && forecastVersions === null && !fvLoading) loadForecastVersions();
    if (tab === 'actuals' && actualEntries === null && !aeLoading) loadActualEntries();
    if (tab === 'actual-snapshots' && actualSnapshots === null && !asLoading) loadActualSnapshots();
    if (tab === 'variances' && variances === null && !varLoading) loadVariances();
    if (tab === 'benefits-realization' && benefitsRealization === undefined && !brLoading) loadBenefitsRealization();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const breadcrumbs = [{ label: isPolish ? 'Rejestr ROI' : 'ROI registry', onClick: onBack }, { label: roiCase.title }];
  const tabs: StandardModuleTab[] = [
    { id: 'forecast-versions', label: isPolish ? 'Prognoza' : 'Forecast' },
    { id: 'actuals', label: isPolish ? 'Wykonania' : 'Actuals' },
    { id: 'actual-snapshots', label: isPolish ? 'Migawki wykonania' : 'Actual snapshots' },
    { id: 'variances', label: isPolish ? 'Wariancje' : 'Variances' },
    { id: 'benefits-realization', label: isPolish ? 'Realizacja korzyści' : 'Benefits realization' },
  ];
  const chipsBar = { chips: phaseChips, activeChip: phase, onChipChange: (id: string) => onPhaseChange(id as RoiCasePhase) };

  // ── Forecast versions tab ──────────────────────────────────────────────
  if (tab === 'forecast-versions') {
    const rows: TableRow[] = (forecastVersions ?? []).map((f) => withRoiFullToolId(f, 'forecastVersionId'));
    const selected = (forecastVersions ?? []).find((f) => f.forecastVersionId === selectedFvId) ?? null;
    return (
      <>
        <ResultsVNextRegistryShell
          domain="roi"
          moduleBar={{
            breadcrumbs, tabs, activeTab: tab, onTabChange: (id) => setTab(id as RealizeTab),
            showTabCounts: false, viewModes: ['table'], viewMode: 'table', ...chipsBar,
            primaryCta: {
              label: isPolish ? 'Opublikuj prognozę' : 'Publish forecast',
              icon: Plus,
              onClick: () => { setFvWrite(IDLE_WRITE); setFvIdempotencyKey(newRoiIdempotencyKey()); setFvCreateOpen(true); },
              testId: 'roi-realize-forecast-create-cta',
              locked: !trackable,
              lockedReason: !trackable ? trackableLockReason : undefined,
            },
          }}
          table={{
            columns: buildRoiForecastVersionColumns(isPolish),
            data: rows, persistKey: 'results-vnext.roi-realize.forecast-versions',
            loading: fvLoading, error: fvError, onRetry: loadForecastVersions,
            empty: !fvLoading && !fvError && rows.length === 0 ? { title: isPolish ? 'Brak wersji prognozy' : 'No forecast versions yet', description: isPolish ? 'Ta sprawa nie ma jeszcze opublikowanej prognozy.' : 'This case has no published forecast yet.' } : undefined,
            selectedRowId: selectedFvId, onRowClick: (row) => setSelectedFvId(String(row.forecastVersionId)),
            rowMenu: (row) => buildRoiForecastVersionRowMenu(row as unknown as RoiForecastVersion, isPolish, (r) => setSelectedFvId(r.forecastVersionId)),
            defaultSort: { columnId: 'publishedAt', direction: 'desc' },
          }}
          preview={selected ? buildRoiForecastVersionPreview(selected, isPolish, () => setSelectedFvId(null)) : null}
        />
        <RoiForecastVersionCreateModal
          open={fvCreateOpen}
          onClose={() => (fvWrite.busy ? undefined : setFvCreateOpen(false))}
          onSubmit={(values) => {
            setFvWrite({ busy: true, error: null, isConflict: false });
            createRoiForecastVersion(roiCase.caseId, { ...values, expectedVersion: roiCase.rowVersion, idempotencyKey: fvIdempotencyKey })
              .then((res) => { setForecastVersions((prev) => [res.forecastVersion, ...(prev ?? [])]); setSelectedFvId(res.forecastVersion.forecastVersionId); setFvCreateOpen(false); })
              .catch((err) => setFvWrite({ busy: false, error: messageOf(err), isConflict: conflictOf(err) }))
              .finally(() => setFvWrite((s) => ({ ...s, busy: false })));
          }}
          isPolish={isPolish} busy={fvWrite.busy} errorMessage={fvWrite.error} isConflict={fvWrite.isConflict}
        />
      </>
    );
  }

  // ── Actuals tab ─────────────────────────────────────────────────────────
  if (tab === 'actuals') {
    const rows: TableRow[] = (actualEntries ?? []).map((a) => withRoiFullToolId(a, 'actualEntryId'));
    const selected = (actualEntries ?? []).find((a) => a.actualEntryId === selectedAeId) ?? null;
    const openAction = (entry: RoiActualEntry, kind: RoiActualEntryActionKind) => {
      setAeWrite(IDLE_WRITE); setAeIdempotencyKey(newRoiIdempotencyKey()); setAeAction({ entry, kind });
    };
    return (
      <>
        <ResultsVNextRegistryShell
          domain="roi"
          moduleBar={{
            breadcrumbs, tabs, activeTab: tab, onTabChange: (id) => setTab(id as RealizeTab),
            showTabCounts: false, viewModes: ['table'], viewMode: 'table', ...chipsBar,
            primaryCta: {
              label: isPolish ? 'Zarejestruj wykonanie' : 'Record actual',
              icon: Plus,
              onClick: () => { setAeWrite(IDLE_WRITE); setAeIdempotencyKey(newRoiIdempotencyKey()); setAeFormOpen(true); },
              testId: 'roi-realize-actual-create-cta',
              locked: !trackable,
              lockedReason: !trackable ? trackableLockReason : undefined,
            },
          }}
          table={{
            columns: buildRoiActualEntryColumns(isPolish),
            data: rows, persistKey: 'results-vnext.roi-realize.actuals',
            loading: aeLoading, error: aeError, onRetry: loadActualEntries,
            empty: !aeLoading && !aeError && rows.length === 0 ? { title: isPolish ? 'Brak wpisów wykonania' : 'No actual entries yet', description: isPolish ? 'Ta sprawa nie ma jeszcze zarejestrowanych wykonań.' : 'This case has no recorded actuals yet.' } : undefined,
            selectedRowId: selectedAeId, onRowClick: (row) => setSelectedAeId(String(row.actualEntryId)),
            rowMenu: (row) => buildRoiActualEntryRowMenu(row as unknown as RoiActualEntry, isPolish, {
              onPreview: (r) => setSelectedAeId(r.actualEntryId),
              onCorrect: (r) => openAction(r, 'correction'),
              onVerify: (r) => openAction(r, 'verify'),
              onDispute: (r) => openAction(r, 'dispute'),
            }),
            defaultSort: { columnId: 'recordedAt', direction: 'desc' },
          }}
          preview={selected ? buildRoiActualEntryPreview(selected, isPolish, () => setSelectedAeId(null)) : null}
        />
        <RoiActualEntryFormModal
          open={aeFormOpen}
          costLines={costLines}
          benefitLines={benefitLines}
          defaultCurrency={roiCase.currency}
          onClose={() => (aeWrite.busy ? undefined : setAeFormOpen(false))}
          onSubmit={(values) => {
            setAeWrite({ busy: true, error: null, isConflict: false });
            recordRoiActualEntry(roiCase.caseId, { ...values, idempotencyKey: aeIdempotencyKey })
              .then((res) => { setActualEntries((prev) => [res.actualEntry, ...(prev ?? [])]); setSelectedAeId(res.actualEntry.actualEntryId); setAeFormOpen(false); })
              .catch((err) => setAeWrite({ busy: false, error: messageOf(err), isConflict: conflictOf(err) }))
              .finally(() => setAeWrite((s) => ({ ...s, busy: false })));
          }}
          isPolish={isPolish} busy={aeWrite.busy} errorMessage={aeWrite.error} isConflict={aeWrite.isConflict}
        />
        <RoiActualEntryActionModal
          open={!!aeAction}
          kind={aeAction?.kind ?? 'verify'}
          entryLabel={aeAction?.entry.source ?? ''}
          onClose={() => (aeWrite.busy ? undefined : setAeAction(null))}
          onSubmitCorrection={(values) => {
            if (!aeAction) return;
            setAeWrite({ busy: true, error: null, isConflict: false });
            correctRoiActualEntry(roiCase.caseId, aeAction.entry.actualEntryId, { ...values, idempotencyKey: aeIdempotencyKey })
              .then((res) => { setActualEntries((prev) => [res.actualEntry, ...(prev ?? [])]); setAeAction(null); })
              .catch((err) => setAeWrite({ busy: false, error: messageOf(err), isConflict: conflictOf(err) }))
              .finally(() => setAeWrite((s) => ({ ...s, busy: false })));
          }}
          onSubmitVerify={(notes) => {
            if (!aeAction) return;
            setAeWrite({ busy: true, error: null, isConflict: false });
            verifyRoiActualEntry(roiCase.caseId, aeAction.entry.actualEntryId, { notes, idempotencyKey: aeIdempotencyKey })
              .then((res) => { setActualEntries((prev) => [res.actualEntry, ...(prev ?? [])]); setAeAction(null); })
              .catch((err) => setAeWrite({ busy: false, error: messageOf(err), isConflict: conflictOf(err) }))
              .finally(() => setAeWrite((s) => ({ ...s, busy: false })));
          }}
          onSubmitDispute={(disputeReason) => {
            if (!aeAction) return;
            setAeWrite({ busy: true, error: null, isConflict: false });
            disputeRoiActualEntry(roiCase.caseId, aeAction.entry.actualEntryId, { disputeReason, idempotencyKey: aeIdempotencyKey })
              .then((res) => { setActualEntries((prev) => [res.actualEntry, ...(prev ?? [])]); setAeAction(null); })
              .catch((err) => setAeWrite({ busy: false, error: messageOf(err), isConflict: conflictOf(err) }))
              .finally(() => setAeWrite((s) => ({ ...s, busy: false })));
          }}
          isPolish={isPolish} busy={aeWrite.busy} errorMessage={aeWrite.error} isConflict={aeWrite.isConflict}
        />
      </>
    );
  }

  // ── Actual snapshots tab ────────────────────────────────────────────────
  if (tab === 'actual-snapshots') {
    const rows: TableRow[] = (actualSnapshots ?? []).map((s) => withRoiFullToolId(s, 'actualSnapshotId'));
    const selected = (actualSnapshots ?? []).find((s) => s.actualSnapshotId === selectedAsId) ?? null;
    return (
      <>
        <ResultsVNextRegistryShell
          domain="roi"
          moduleBar={{
            breadcrumbs, tabs, activeTab: tab, onTabChange: (id) => setTab(id as RealizeTab),
            showTabCounts: false, viewModes: ['table'], viewMode: 'table', ...chipsBar,
            primaryCta: {
              label: isPolish ? 'Opublikuj migawkę' : 'Publish snapshot',
              icon: Camera,
              onClick: () => { setAsWrite(IDLE_WRITE); setAsIdempotencyKey(newRoiIdempotencyKey()); setAsPublishOpen(true); },
              testId: 'roi-realize-actual-snapshot-create-cta',
              locked: !trackable,
              lockedReason: !trackable ? trackableLockReason : undefined,
            },
          }}
          table={{
            columns: buildRoiActualSnapshotColumns(isPolish),
            data: rows, persistKey: 'results-vnext.roi-realize.actual-snapshots',
            loading: asLoading, error: asError, onRetry: loadActualSnapshots,
            empty: !asLoading && !asError && rows.length === 0 ? { title: isPolish ? 'Brak migawek wykonania' : 'No actual snapshots yet', description: isPolish ? 'Ta sprawa nie ma jeszcze opublikowanej migawki wykonania.' : 'This case has no published actual snapshot yet.' } : undefined,
            selectedRowId: selectedAsId, onRowClick: (row) => setSelectedAsId(String(row.actualSnapshotId)),
            rowMenu: (row) => buildRoiActualSnapshotRowMenu(row as unknown as RoiActualSnapshot, isPolish, (r) => setSelectedAsId(r.actualSnapshotId)),
            defaultSort: { columnId: 'publishedAt', direction: 'desc' },
          }}
          preview={selected ? buildRoiActualSnapshotPreview(selected, isPolish, () => setSelectedAsId(null)) : null}
        />
        <RoiActualSnapshotPublishModal
          open={asPublishOpen}
          onClose={() => (asWrite.busy ? undefined : setAsPublishOpen(false))}
          onSubmit={(values) => {
            setAsWrite({ busy: true, error: null, isConflict: false });
            publishRoiActualSnapshot(roiCase.caseId, { ...values, expectedVersion: roiCase.rowVersion, idempotencyKey: asIdempotencyKey })
              .then((res) => { setActualSnapshots((prev) => [res.actualSnapshot, ...(prev ?? [])]); setSelectedAsId(res.actualSnapshot.actualSnapshotId); setAsPublishOpen(false); })
              .catch((err) => setAsWrite({ busy: false, error: messageOf(err), isConflict: conflictOf(err) }))
              .finally(() => setAsWrite((s) => ({ ...s, busy: false })));
          }}
          isPolish={isPolish} busy={asWrite.busy} errorMessage={asWrite.error} isConflict={asWrite.isConflict}
        />
      </>
    );
  }

  // ── Variances tab ───────────────────────────────────────────────────────
  if (tab === 'variances') {
    const rows: TableRow[] = (variances ?? []).map((v) => withRoiFullToolId(v, 'varianceId'));
    const selected = (variances ?? []).find((v) => v.varianceId === selectedVarId) ?? null;
    return (
      <>
        <ResultsVNextRegistryShell
          domain="roi"
          moduleBar={{
            breadcrumbs, tabs, activeTab: tab, onTabChange: (id) => setTab(id as RealizeTab),
            showTabCounts: false, viewModes: ['table'], viewMode: 'table', ...chipsBar,
            primaryCta: {
              label: isPolish ? 'Zarejestruj wariancję' : 'Record variance',
              icon: Plus,
              onClick: () => { setVarWrite(IDLE_WRITE); setVarIdempotencyKey(newRoiIdempotencyKey()); setVarFormOpen(true); },
              testId: 'roi-realize-variance-create-cta',
            },
          }}
          table={{
            columns: buildRoiVarianceColumns(isPolish),
            data: rows, persistKey: 'results-vnext.roi-realize.variances',
            loading: varLoading, error: varError, onRetry: loadVariances,
            empty: !varLoading && !varError && rows.length === 0 ? { title: isPolish ? 'Brak wariancji' : 'No variances yet', description: isPolish ? 'Ta sprawa nie ma jeszcze zarejestrowanych wariancji.' : 'This case has no recorded variances yet.' } : undefined,
            selectedRowId: selectedVarId, onRowClick: (row) => setSelectedVarId(String(row.varianceId)),
            rowMenu: (row) => buildRoiVarianceRowMenu(row as unknown as RoiVariance, isPolish, {
              onPreview: (r) => setSelectedVarId(r.varianceId),
              onEditStatus: (r) => { setVarWrite(IDLE_WRITE); setVarStatusTarget(r); },
              onAddCause: (r) => { setVarWrite(IDLE_WRITE); setVarCauseTarget(r); },
            }),
            defaultSort: { columnId: 'updatedAt', direction: 'desc' },
          }}
          preview={
            selected
              ? buildRoiVariancePreview(selected, varianceCauses[selected.varianceId] ?? null, isPolish, {
                  onClose: () => setSelectedVarId(null),
                  onRemoveCause: (c) => {
                    removeRoiVarianceCause(roiCase.caseId, selected.varianceId, c.causeId, { idempotencyKey: newRoiIdempotencyKey() })
                      .then(() => setVarianceCauses((prev) => ({ ...prev, [selected.varianceId]: (prev[selected.varianceId] ?? []).filter((x) => x.causeId !== c.causeId) })))
                      .catch(() => undefined);
                  },
                })
              : null
          }
        />
        <RoiVarianceFormModal
          open={varFormOpen}
          approvalSnapshots={approvalSnapshots}
          forecastVersions={forecastVersions ?? []}
          actualSnapshots={actualSnapshots ?? []}
          onClose={() => (varWrite.busy ? undefined : setVarFormOpen(false))}
          onSubmit={(values) => {
            setVarWrite({ busy: true, error: null, isConflict: false });
            recordRoiVariance(roiCase.caseId, { ...values, idempotencyKey: varIdempotencyKey })
              .then((res) => { setVariances((prev) => [res.variance, ...(prev ?? [])]); setSelectedVarId(res.variance.varianceId); setVarFormOpen(false); })
              .catch((err) => setVarWrite({ busy: false, error: messageOf(err), isConflict: conflictOf(err) }))
              .finally(() => setVarWrite((s) => ({ ...s, busy: false })));
          }}
          isPolish={isPolish} busy={varWrite.busy} errorMessage={varWrite.error} isConflict={varWrite.isConflict}
        />
        <RoiVarianceStatusModal
          open={!!varStatusTarget}
          varianceLabel={varStatusTarget?.metric ?? ''}
          currentStatus={varStatusTarget?.status ?? 'open'}
          onClose={() => (varWrite.busy ? undefined : setVarStatusTarget(null))}
          onSubmit={(values) => {
            if (!varStatusTarget) return;
            setVarWrite({ busy: true, error: null, isConflict: false });
            updateRoiVarianceStatus(roiCase.caseId, varStatusTarget.varianceId, { ...values, expectedVersion: varStatusTarget.rowVersion, idempotencyKey: newRoiIdempotencyKey() })
              .then((res) => { setVariances((prev) => (prev ?? []).map((v) => (v.varianceId === res.variance.varianceId ? res.variance : v))); setVarStatusTarget(null); })
              .catch((err) => setVarWrite({ busy: false, error: messageOf(err), isConflict: conflictOf(err) }))
              .finally(() => setVarWrite((s) => ({ ...s, busy: false })));
          }}
          isPolish={isPolish} busy={varWrite.busy} errorMessage={varWrite.error} isConflict={varWrite.isConflict}
        />
        <RoiVarianceCauseFormModal
          open={!!varCauseTarget}
          varianceLabel={varCauseTarget?.metric ?? ''}
          onClose={() => (varWrite.busy ? undefined : setVarCauseTarget(null))}
          onSubmit={(values) => {
            if (!varCauseTarget) return;
            setVarWrite({ busy: true, error: null, isConflict: false });
            addRoiVarianceCause(roiCase.caseId, varCauseTarget.varianceId, { ...values, idempotencyKey: newRoiIdempotencyKey() })
              .then((res) => {
                setVarianceCauses((prev) => ({ ...prev, [varCauseTarget.varianceId]: [...(prev[varCauseTarget.varianceId] ?? []), res.varianceCause] }));
                setVarCauseTarget(null);
              })
              .catch((err) => setVarWrite({ busy: false, error: messageOf(err), isConflict: conflictOf(err) }))
              .finally(() => setVarWrite((s) => ({ ...s, busy: false })));
          }}
          isPolish={isPolish} busy={varWrite.busy} errorMessage={varWrite.error} isConflict={varWrite.isConflict}
        />
      </>
    );
  }

  // ── Benefits realization tab (single-row view) ─────────────────────────
  const brRows: TableRow[] = benefitsRealization === undefined ? [] : buildRoiCaseViewsRows(null, benefitsRealization).filter((r) => r.id === 'benefits-realization').map((r) => withRoiFullToolId(r, 'id'));
  const brSelectedRow = brSelected ? (brRows[0] as any) : null;
  return (
    <ResultsVNextRegistryShell
      domain="roi"
      moduleBar={{
        breadcrumbs, tabs, activeTab: tab, onTabChange: (id) => setTab(id as RealizeTab),
        showTabCounts: false, viewModes: ['table'], viewMode: 'table', ...chipsBar,
      }}
      table={{
        columns: buildRoiCaseViewsColumns(isPolish),
        data: brRows, persistKey: 'results-vnext.roi-realize.benefits-realization',
        loading: brLoading, error: brError, onRetry: loadBenefitsRealization,
        selectedRowId: brSelected ? 'benefits-realization' : null,
        onRowClick: () => setBrSelected(true),
        rowMenu: (row) => buildRoiCaseViewsRowMenu(row as any, isPolish, () => setBrSelected(true)),
      }}
      preview={brSelectedRow ? buildRoiCaseViewsPreview(brSelectedRow, isPolish, () => setBrSelected(false)) : null}
    />
  );
};

export default RoiCaseRealizeValueWorkspace;
