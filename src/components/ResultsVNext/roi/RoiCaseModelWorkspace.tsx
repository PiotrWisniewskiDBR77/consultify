/**
 * RoiCaseModelWorkspace — RN-G2 §G #12-14, the ROI Case MODEL SETUP
 * pod-widok: Baseline + calculation policy (§G #12), Assumptions CRUD
 * (§G #13 first half), Cost lines + Benefit lines CRUD (§G #13 second
 * half / §G #14).
 *
 * PLACEMENT DECISION (per task brief — "wybierz i uzasadnij w komentarzu"):
 * a sub-view of the SELECTED case within the existing `/results/roi` route,
 * switched by local component state in `ResultsRoiHub.tsx` (triggered from
 * the case row's kebab "Model sprawy"/"Model case" action) — NOT a new
 * route. Reasons:
 *  1. RN_G2_UI_SCOPE.md §G Open Question #2 ("archetype/shell for full-tool
 *     screens") is explicitly UNRESOLVED — building a real
 *     `/results/roi/cases/:roiCaseId` route would silently pre-decide that
 *     question (klasa S vs L, `StandardArtifactShell` vs a new shell) for a
 *     package whose job is model-setup CRUD, not the full-tool archetype.
 *  2. `ResultsVNextRegistryShell` already supports exactly this shape
 *     without a route: the `moduleBar.breadcrumbs`/`breadcrumbCta` slot is
 *     documented FOR "embedded hubs" (§A) — a case-scoped sub-view nested
 *     inside the ROI registry's own screen is precisely that.
 *  3. Every one of the five sub-resources here is scoped to ONE already-
 *     selected case (`caseId` in every path) — there is no independent
 *     "list of baselines across cases" to justify a standalone registry
 *     route the way KPI Scorecards' "own route" decision was justified
 *     (§G Open Question #3 precedent, a DIFFERENT resource shape).
 *
 * Data flow: the case itself (`RoiCaseListItem`) is passed in from the
 * already-loaded registry row — no redundant `GET /cases/:caseId` fetch.
 * Each of the four Menu 2 tabs below fetches its own sub-resource lazily on
 * first visit (mirrors `ResultsRoiHub.tsx`'s "All cases"/"Benefits
 * realization" lazy-per-tab convention) and a local fetch failure never
 * blanks the other tabs (RN_G2_UI_SCOPE.md §D, master plan §9 Gate 2).
 *
 * Lock semantics: ALL FIVE sub-resources share the exact same
 * `NON_EDITABLE_STATUSES` guard as the case itself (verified by reading
 * every `roi*Commands.ts` file — see `roiCaseDetailMappers.ts` header
 * comment) — so `isRoiCaseLocked(roiCase.status)` from
 * `roiRegistryMappers.ts` gates Add/Edit/Delete across every tab here, not
 * five separate re-derivations of the same server list.
 */
import { Plus } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import type { StandardModuleTab, TableRow } from '@/components/standard';

import { ResultsVNextRegistryShell } from '../ResultsVNextRegistryShell';
import type { RoiCaseListItem } from './roiApi';
import { isRoiCaseLocked, getRoiCaseLockInfo } from './roiRegistryMappers';
import {
  addRoiAssumption,
  addRoiBenefitLine,
  addRoiCostLine,
  getRoiBaseline,
  getRoiCalculationPolicy,
  listRoiAssumptions,
  listRoiBenefitLines,
  listRoiCostLines,
  newRoiIdempotencyKey,
  putRoiBaseline,
  putRoiCalculationPolicy,
  removeRoiAssumption,
  removeRoiBenefitLine,
  removeRoiCostLine,
  RoiApiError,
  updateRoiAssumption,
  updateRoiBenefitLine,
  updateRoiCostLine,
  type AddRoiAssumptionInput,
  type AddRoiBenefitLineInput,
  type AddRoiCostLineInput,
  type PutRoiBaselineInput,
  type PutRoiCalculationPolicyInput,
  type RoiAssumption,
  type RoiBaseline,
  type RoiBenefitLine,
  type RoiCalculationPolicy,
  type RoiCostLine,
} from './roiCaseDetailApi';
import {
  buildRoiAssumptionColumns,
  buildRoiAssumptionPreview,
  buildRoiBenefitLineColumns,
  buildRoiBenefitLinePreview,
  buildRoiCostLineColumns,
  buildRoiCostLinePreview,
  buildRoiSettingsColumns,
  buildRoiSettingsPreview,
  buildRoiSettingsRowMenu,
  buildRoiSettingsRows,
  type RoiSettingsRowVm,
} from './roiCaseDetailPresenters';
import { RoiBaselineEditModal } from './RoiBaselineEditModal';
import { RoiCalculationPolicyEditModal } from './RoiCalculationPolicyEditModal';
import { RoiAssumptionFormModal } from './RoiAssumptionFormModal';
import { RoiCostLineFormModal } from './RoiCostLineFormModal';
import { RoiBenefitLineFormModal } from './RoiBenefitLineFormModal';
import { RoiRemoveLineItemDialog } from './RoiRemoveLineItemDialog';

type ModelTab = 'settings' | 'assumptions' | 'cost-lines' | 'benefit-lines';

export interface RoiCaseModelWorkspaceProps {
  roiCase: RoiCaseListItem;
  isPolish: boolean;
  onBack: () => void;
}

function withId<T extends object>(row: T, idField: keyof T): T & { id: string } {
  return { ...row, id: String(row[idField]) };
}

/** Shared write-state shape for every one of the six modals this workspace
 * drives — one small helper type instead of six near-identical inline
 * `useState` triples. */
interface WriteState {
  busy: boolean;
  error: string | null;
  isConflict: boolean;
}
const IDLE_WRITE: WriteState = { busy: false, error: null, isConflict: false };

export const RoiCaseModelWorkspace: React.FC<RoiCaseModelWorkspaceProps> = ({ roiCase, isPolish, onBack }) => {
  const [tab, setTab] = useState<ModelTab>('settings');
  const locked = isRoiCaseLocked(roiCase.status);
  const lock = getRoiCaseLockInfo(roiCase.status);
  const lockReason = lock ? (isPolish ? lock.reason.pl : lock.reason.en) : undefined;

  // ── Settings (Baseline + Calculation policy) ──────────────────────────
  const [baseline, setBaseline] = useState<RoiBaseline | null | undefined>(undefined);
  const [policy, setPolicy] = useState<RoiCalculationPolicy | null | undefined>(undefined);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [selectedSettingsId, setSelectedSettingsId] = useState<'baseline' | 'calculation-policy' | null>(null);
  const [editSettingsKind, setEditSettingsKind] = useState<'baseline' | 'calculation-policy' | null>(null);
  const [settingsWrite, setSettingsWrite] = useState<WriteState>(IDLE_WRITE);
  const [settingsIdempotencyKey, setSettingsIdempotencyKey] = useState('');

  const loadSettings = useCallback(() => {
    setSettingsLoading(true);
    setSettingsError(null);
    Promise.all([getRoiBaseline(roiCase.caseId), getRoiCalculationPolicy(roiCase.caseId)])
      .then(([b, p]) => {
        setBaseline(b);
        setPolicy(p);
      })
      .catch((err) => setSettingsError(err instanceof Error ? err.message : String(err)))
      .finally(() => setSettingsLoading(false));
  }, [roiCase.caseId]);

  // ── Assumptions ─────────────────────────────────────────────────────────
  const [assumptions, setAssumptions] = useState<RoiAssumption[] | null>(null);
  const [assumptionsError, setAssumptionsError] = useState<string | null>(null);
  const [assumptionsLoading, setAssumptionsLoading] = useState(false);
  const [selectedAssumptionId, setSelectedAssumptionId] = useState<string | null>(null);
  const [assumptionForm, setAssumptionForm] = useState<{ mode: 'create' | 'edit'; assumption: RoiAssumption | null } | null>(null);
  const [assumptionWrite, setAssumptionWrite] = useState<WriteState>(IDLE_WRITE);
  const [assumptionIdempotencyKey, setAssumptionIdempotencyKey] = useState('');
  const [removeAssumption, setRemoveAssumption] = useState<RoiAssumption | null>(null);

  const loadAssumptions = useCallback(() => {
    setAssumptionsLoading(true);
    setAssumptionsError(null);
    listRoiAssumptions(roiCase.caseId)
      .then((rows) => setAssumptions(rows.filter((a) => !a.deletedAt)))
      .catch((err) => setAssumptionsError(err instanceof Error ? err.message : String(err)))
      .finally(() => setAssumptionsLoading(false));
  }, [roiCase.caseId]);

  // ── Cost lines ──────────────────────────────────────────────────────────
  const [costLines, setCostLines] = useState<RoiCostLine[] | null>(null);
  const [costLinesError, setCostLinesError] = useState<string | null>(null);
  const [costLinesLoading, setCostLinesLoading] = useState(false);
  const [selectedCostLineId, setSelectedCostLineId] = useState<string | null>(null);
  const [costLineForm, setCostLineForm] = useState<{ mode: 'create' | 'edit'; costLine: RoiCostLine | null } | null>(null);
  const [costLineWrite, setCostLineWrite] = useState<WriteState>(IDLE_WRITE);
  const [costLineIdempotencyKey, setCostLineIdempotencyKey] = useState('');
  const [removeCostLine, setRemoveCostLine] = useState<RoiCostLine | null>(null);

  const loadCostLines = useCallback(() => {
    setCostLinesLoading(true);
    setCostLinesError(null);
    listRoiCostLines(roiCase.caseId)
      .then((rows) => setCostLines(rows.filter((c) => !c.deletedAt)))
      .catch((err) => setCostLinesError(err instanceof Error ? err.message : String(err)))
      .finally(() => setCostLinesLoading(false));
  }, [roiCase.caseId]);

  // ── Benefit lines ───────────────────────────────────────────────────────
  const [benefitLines, setBenefitLines] = useState<RoiBenefitLine[] | null>(null);
  const [benefitLinesError, setBenefitLinesError] = useState<string | null>(null);
  const [benefitLinesLoading, setBenefitLinesLoading] = useState(false);
  const [selectedBenefitLineId, setSelectedBenefitLineId] = useState<string | null>(null);
  const [benefitLineForm, setBenefitLineForm] = useState<{ mode: 'create' | 'edit'; benefitLine: RoiBenefitLine | null } | null>(null);
  const [benefitLineWrite, setBenefitLineWrite] = useState<WriteState>(IDLE_WRITE);
  const [benefitLineIdempotencyKey, setBenefitLineIdempotencyKey] = useState('');
  const [removeBenefitLine, setRemoveBenefitLine] = useState<RoiBenefitLine | null>(null);

  const loadBenefitLines = useCallback(() => {
    setBenefitLinesLoading(true);
    setBenefitLinesError(null);
    listRoiBenefitLines(roiCase.caseId)
      .then((rows) => setBenefitLines(rows.filter((b) => !b.deletedAt)))
      .catch((err) => setBenefitLinesError(err instanceof Error ? err.message : String(err)))
      .finally(() => setBenefitLinesLoading(false));
  }, [roiCase.caseId]);

  // Lazy per-tab fetch — a local failure never blanks the other three tabs.
  useEffect(() => {
    if (tab === 'settings' && baseline === undefined && !settingsLoading) loadSettings();
    if (tab === 'assumptions' && assumptions === null && !assumptionsLoading) loadAssumptions();
    if (tab === 'cost-lines' && costLines === null && !costLinesLoading) loadCostLines();
    if (tab === 'benefit-lines' && benefitLines === null && !benefitLinesLoading) loadBenefitLines();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const conflictOf = (err: unknown) => err instanceof RoiApiError && err.status === 409;
  const messageOf = (err: unknown) => (err instanceof Error ? err.message : String(err));

  // ── Settings write handlers ─────────────────────────────────────────────
  const openEditSettings = (kind: 'baseline' | 'calculation-policy') => {
    setSettingsWrite(IDLE_WRITE);
    setSettingsIdempotencyKey(newRoiIdempotencyKey());
    setEditSettingsKind(kind);
  };

  const submitBaseline = (values: Omit<PutRoiBaselineInput, 'expectedVersion'>) => {
    if (!baseline) return;
    setSettingsWrite({ busy: true, error: null, isConflict: false });
    putRoiBaseline(roiCase.caseId, { ...values, expectedVersion: baseline.rowVersion, idempotencyKey: settingsIdempotencyKey })
      .then((res) => {
        setBaseline(res.baseline);
        setEditSettingsKind(null);
      })
      .catch((err) => setSettingsWrite({ busy: false, error: messageOf(err), isConflict: conflictOf(err) }))
      .finally(() => setSettingsWrite((s) => ({ ...s, busy: false })));
  };

  const submitPolicy = (values: Omit<PutRoiCalculationPolicyInput, 'expectedVersion'>) => {
    if (!policy) return;
    setSettingsWrite({ busy: true, error: null, isConflict: false });
    putRoiCalculationPolicy(roiCase.caseId, { ...values, expectedVersion: policy.rowVersion, idempotencyKey: settingsIdempotencyKey })
      .then((res) => {
        setPolicy(res.calculationPolicy);
        setEditSettingsKind(null);
      })
      .catch((err) => setSettingsWrite({ busy: false, error: messageOf(err), isConflict: conflictOf(err) }))
      .finally(() => setSettingsWrite((s) => ({ ...s, busy: false })));
  };

  // ── Assumption write handlers ────────────────────────────────────────────
  const openCreateAssumption = () => {
    if (locked) return;
    setAssumptionWrite(IDLE_WRITE);
    setAssumptionIdempotencyKey(newRoiIdempotencyKey());
    setAssumptionForm({ mode: 'create', assumption: null });
  };
  const openEditAssumption = (a: RoiAssumption) => {
    setAssumptionWrite(IDLE_WRITE);
    setAssumptionIdempotencyKey(newRoiIdempotencyKey());
    setAssumptionForm({ mode: 'edit', assumption: a });
  };
  const submitAssumption = (values: AddRoiAssumptionInput) => {
    if (!assumptionForm) return;
    setAssumptionWrite({ busy: true, error: null, isConflict: false });
    const call =
      assumptionForm.mode === 'create'
        ? addRoiAssumption(roiCase.caseId, { ...values, idempotencyKey: assumptionIdempotencyKey })
        : updateRoiAssumption(roiCase.caseId, assumptionForm.assumption!.assumptionId, {
            ...values,
            expectedVersion: assumptionForm.assumption!.rowVersion,
            idempotencyKey: assumptionIdempotencyKey,
          });
    call
      .then((res) => {
        setAssumptions((prev) => {
          const without = (prev ?? []).filter((a) => a.assumptionId !== res.assumption.assumptionId);
          return [...without, res.assumption];
        });
        setSelectedAssumptionId(res.assumption.assumptionId);
        setAssumptionForm(null);
      })
      .catch((err) => setAssumptionWrite({ busy: false, error: messageOf(err), isConflict: conflictOf(err) }))
      .finally(() => setAssumptionWrite((s) => ({ ...s, busy: false })));
  };
  const submitRemoveAssumption = (reason: string | null) => {
    if (!removeAssumption) return;
    setAssumptionWrite({ busy: true, error: null, isConflict: false });
    removeRoiAssumption(roiCase.caseId, removeAssumption.assumptionId, {
      expectedVersion: removeAssumption.rowVersion,
      reason,
      idempotencyKey: newRoiIdempotencyKey(),
    })
      .then(() => {
        setAssumptions((prev) => (prev ?? []).filter((a) => a.assumptionId !== removeAssumption.assumptionId));
        if (selectedAssumptionId === removeAssumption.assumptionId) setSelectedAssumptionId(null);
        setRemoveAssumption(null);
      })
      .catch((err) => setAssumptionWrite({ busy: false, error: messageOf(err), isConflict: conflictOf(err) }))
      .finally(() => setAssumptionWrite((s) => ({ ...s, busy: false })));
  };

  // ── Cost line write handlers ─────────────────────────────────────────────
  const openCreateCostLine = () => {
    if (locked) return;
    setCostLineWrite(IDLE_WRITE);
    setCostLineIdempotencyKey(newRoiIdempotencyKey());
    setCostLineForm({ mode: 'create', costLine: null });
  };
  const openEditCostLine = (c: RoiCostLine) => {
    setCostLineWrite(IDLE_WRITE);
    setCostLineIdempotencyKey(newRoiIdempotencyKey());
    setCostLineForm({ mode: 'edit', costLine: c });
  };
  const submitCostLine = (values: AddRoiCostLineInput) => {
    if (!costLineForm) return;
    setCostLineWrite({ busy: true, error: null, isConflict: false });
    const call =
      costLineForm.mode === 'create'
        ? addRoiCostLine(roiCase.caseId, { ...values, idempotencyKey: costLineIdempotencyKey })
        : updateRoiCostLine(roiCase.caseId, costLineForm.costLine!.costLineId, {
            ...values,
            expectedVersion: costLineForm.costLine!.rowVersion,
            idempotencyKey: costLineIdempotencyKey,
          });
    call
      .then((res) => {
        setCostLines((prev) => {
          const without = (prev ?? []).filter((c) => c.costLineId !== res.costLine.costLineId);
          return [...without, res.costLine];
        });
        setSelectedCostLineId(res.costLine.costLineId);
        setCostLineForm(null);
      })
      .catch((err) => setCostLineWrite({ busy: false, error: messageOf(err), isConflict: conflictOf(err) }))
      .finally(() => setCostLineWrite((s) => ({ ...s, busy: false })));
  };
  const submitRemoveCostLine = (reason: string | null) => {
    if (!removeCostLine) return;
    setCostLineWrite({ busy: true, error: null, isConflict: false });
    removeRoiCostLine(roiCase.caseId, removeCostLine.costLineId, {
      expectedVersion: removeCostLine.rowVersion,
      reason,
      idempotencyKey: newRoiIdempotencyKey(),
    })
      .then(() => {
        setCostLines((prev) => (prev ?? []).filter((c) => c.costLineId !== removeCostLine.costLineId));
        if (selectedCostLineId === removeCostLine.costLineId) setSelectedCostLineId(null);
        setRemoveCostLine(null);
      })
      .catch((err) => setCostLineWrite({ busy: false, error: messageOf(err), isConflict: conflictOf(err) }))
      .finally(() => setCostLineWrite((s) => ({ ...s, busy: false })));
  };

  // ── Benefit line write handlers ──────────────────────────────────────────
  const openCreateBenefitLine = () => {
    if (locked) return;
    setBenefitLineWrite(IDLE_WRITE);
    setBenefitLineIdempotencyKey(newRoiIdempotencyKey());
    setBenefitLineForm({ mode: 'create', benefitLine: null });
  };
  const openEditBenefitLine = (b: RoiBenefitLine) => {
    setBenefitLineWrite(IDLE_WRITE);
    setBenefitLineIdempotencyKey(newRoiIdempotencyKey());
    setBenefitLineForm({ mode: 'edit', benefitLine: b });
  };
  const submitBenefitLine = (values: AddRoiBenefitLineInput) => {
    if (!benefitLineForm) return;
    setBenefitLineWrite({ busy: true, error: null, isConflict: false });
    const call =
      benefitLineForm.mode === 'create'
        ? addRoiBenefitLine(roiCase.caseId, { ...values, idempotencyKey: benefitLineIdempotencyKey })
        : updateRoiBenefitLine(roiCase.caseId, benefitLineForm.benefitLine!.benefitLineId, {
            ...values,
            expectedVersion: benefitLineForm.benefitLine!.rowVersion,
            idempotencyKey: benefitLineIdempotencyKey,
          });
    call
      .then((res) => {
        setBenefitLines((prev) => {
          const without = (prev ?? []).filter((b) => b.benefitLineId !== res.benefitLine.benefitLineId);
          return [...without, res.benefitLine];
        });
        setSelectedBenefitLineId(res.benefitLine.benefitLineId);
        setBenefitLineForm(null);
      })
      .catch((err) => setBenefitLineWrite({ busy: false, error: messageOf(err), isConflict: conflictOf(err) }))
      .finally(() => setBenefitLineWrite((s) => ({ ...s, busy: false })));
  };
  const submitRemoveBenefitLine = (reason: string | null) => {
    if (!removeBenefitLine) return;
    setBenefitLineWrite({ busy: true, error: null, isConflict: false });
    removeRoiBenefitLine(roiCase.caseId, removeBenefitLine.benefitLineId, {
      expectedVersion: removeBenefitLine.rowVersion,
      reason,
      idempotencyKey: newRoiIdempotencyKey(),
    })
      .then(() => {
        setBenefitLines((prev) => (prev ?? []).filter((b) => b.benefitLineId !== removeBenefitLine.benefitLineId));
        if (selectedBenefitLineId === removeBenefitLine.benefitLineId) setSelectedBenefitLineId(null);
        setRemoveBenefitLine(null);
      })
      .catch((err) => setBenefitLineWrite({ busy: false, error: messageOf(err), isConflict: conflictOf(err) }))
      .finally(() => setBenefitLineWrite((s) => ({ ...s, busy: false })));
  };

  const tabs: StandardModuleTab[] = [
    { id: 'settings', label: isPolish ? 'Baseline i polityka' : 'Baseline & policy' },
    { id: 'assumptions', label: isPolish ? 'Założenia' : 'Assumptions' },
    { id: 'cost-lines', label: isPolish ? 'Koszty' : 'Cost lines' },
    { id: 'benefit-lines', label: isPolish ? 'Korzyści' : 'Benefit lines' },
  ];

  const breadcrumbs = [
    { label: isPolish ? 'Rejestr ROI' : 'ROI registry', onClick: onBack },
    { label: roiCase.title },
  ];

  /**
   * `StandardPrimaryCta.locked`/`lockedReason` (`StandardModuleBar.tsx`
   * L108-123) is documented for the "pilot lock" permission doctrine
   * specifically — reused here for the SAME visible/muted/tooltip/never-
   * hidden shape TRIADA §C3 requires for a business-rule lock, since no
   * other sanctioned toolbar-CTA lock affordance exists. The doctrine's
   * "onClick MUST still fire" rule is honored literally: `onClick` always
   * runs, it just early-returns via the same `if (locked) return;` guard
   * every `openCreate*` handler below already has — a deliberate no-op
   * (never a fabricated success, never a console error), not a dispatch to
   * a pilot-specific global handler that does not apply to this lock.
   */
  const addCta = (label: string, onClick: () => void, testId: string) => ({
    label,
    icon: Plus,
    onClick,
    testId,
    locked,
    lockedReason: lockReason,
  });

  if (tab === 'assumptions') {
    const rows: TableRow[] = (assumptions ?? []).map((a) => withId(a, 'assumptionId'));
    const selected = (assumptions ?? []).find((a) => a.assumptionId === selectedAssumptionId) ?? null;
    return (
      <>
        <ResultsVNextRegistryShell
          domain="roi"
          moduleBar={{
            breadcrumbs,
            tabs,
            activeTab: tab,
            onTabChange: (id) => setTab(id as ModelTab),
            showTabCounts: false,
            viewModes: ['table'],
            viewMode: 'table',
            primaryCta: addCta(isPolish ? 'Nowe założenie' : 'New assumption', openCreateAssumption, 'roi-model-assumption-create-cta'),
          }}
          table={{
            columns: buildRoiAssumptionColumns(isPolish),
            data: rows,
            persistKey: 'results-vnext.roi-model.assumptions',
            loading: assumptionsLoading,
            error: assumptionsError,
            onRetry: loadAssumptions,
            empty:
              !assumptionsLoading && !assumptionsError && rows.length === 0
                ? {
                    title: isPolish ? 'Brak założeń' : 'No assumptions yet',
                    description: isPolish ? 'Ta sprawa nie ma jeszcze żadnych założeń.' : 'This case has no assumptions yet.',
                    actionLabel: locked ? undefined : isPolish ? 'Nowe założenie' : 'New assumption',
                    onAction: locked ? undefined : openCreateAssumption,
                  }
                : undefined,
            selectedRowId: selectedAssumptionId,
            onRowClick: (row) => setSelectedAssumptionId(String(row.assumptionId)),
            rowMenu: (row) => {
              const a = row as unknown as RoiAssumption;
              return {
                primary: [{ id: 'open', label: isPolish ? 'Otwórz' : 'Open', onClick: () => setSelectedAssumptionId(a.assumptionId) }],
                universalHandlers: {
                  preview: () => setSelectedAssumptionId(a.assumptionId),
                  edit: locked ? undefined : () => openEditAssumption(a),
                  editNote: locked ? lockReason : undefined,
                },
                destructive: locked
                  ? { note: lockReason }
                  : { onClick: () => setRemoveAssumption(a) },
              };
            },
            defaultSort: { columnId: 'updatedAt', direction: 'desc' },
          }}
          preview={selected ? buildRoiAssumptionPreview(selected, roiCase.status, isPolish, () => setSelectedAssumptionId(null)) : null}
        />
        <RoiAssumptionFormModal
          open={!!assumptionForm}
          mode={assumptionForm?.mode ?? 'create'}
          assumption={assumptionForm?.assumption ?? null}
          onClose={() => (assumptionWrite.busy ? undefined : setAssumptionForm(null))}
          onSubmit={submitAssumption}
          isPolish={isPolish}
          busy={assumptionWrite.busy}
          errorMessage={assumptionWrite.error}
          isConflict={assumptionWrite.isConflict}
        />
        <RoiRemoveLineItemDialog
          open={!!removeAssumption}
          itemLabel={removeAssumption?.label ?? ''}
          isPolish={isPolish}
          onClose={() => (assumptionWrite.busy ? undefined : setRemoveAssumption(null))}
          onSubmit={submitRemoveAssumption}
          busy={assumptionWrite.busy}
          errorMessage={assumptionWrite.error}
          isConflict={assumptionWrite.isConflict}
        />
      </>
    );
  }

  if (tab === 'cost-lines') {
    const rows: TableRow[] = (costLines ?? []).map((c) => withId(c, 'costLineId'));
    const selected = (costLines ?? []).find((c) => c.costLineId === selectedCostLineId) ?? null;
    return (
      <>
        <ResultsVNextRegistryShell
          domain="roi"
          moduleBar={{
            breadcrumbs,
            tabs,
            activeTab: tab,
            onTabChange: (id) => setTab(id as ModelTab),
            showTabCounts: false,
            viewModes: ['table'],
            viewMode: 'table',
            primaryCta: addCta(isPolish ? 'Nowa pozycja kosztowa' : 'New cost line', openCreateCostLine, 'roi-model-cost-line-create-cta'),
          }}
          table={{
            columns: buildRoiCostLineColumns(isPolish),
            data: rows,
            persistKey: 'results-vnext.roi-model.cost-lines',
            loading: costLinesLoading,
            error: costLinesError,
            onRetry: loadCostLines,
            empty:
              !costLinesLoading && !costLinesError && rows.length === 0
                ? {
                    title: isPolish ? 'Brak pozycji kosztowych' : 'No cost lines yet',
                    description: isPolish ? 'Ta sprawa nie ma jeszcze żadnych kosztów.' : 'This case has no cost lines yet.',
                    actionLabel: locked ? undefined : isPolish ? 'Nowa pozycja kosztowa' : 'New cost line',
                    onAction: locked ? undefined : openCreateCostLine,
                  }
                : undefined,
            selectedRowId: selectedCostLineId,
            onRowClick: (row) => setSelectedCostLineId(String(row.costLineId)),
            rowMenu: (row) => {
              const c = row as unknown as RoiCostLine;
              return {
                primary: [{ id: 'open', label: isPolish ? 'Otwórz' : 'Open', onClick: () => setSelectedCostLineId(c.costLineId) }],
                universalHandlers: {
                  preview: () => setSelectedCostLineId(c.costLineId),
                  edit: locked ? undefined : () => openEditCostLine(c),
                  editNote: locked ? lockReason : undefined,
                },
                destructive: locked ? { note: lockReason } : { onClick: () => setRemoveCostLine(c) },
              };
            },
            defaultSort: { columnId: 'updatedAt', direction: 'desc' },
          }}
          preview={selected ? buildRoiCostLinePreview(selected, roiCase.status, isPolish, () => setSelectedCostLineId(null)) : null}
        />
        <RoiCostLineFormModal
          open={!!costLineForm}
          mode={costLineForm?.mode ?? 'create'}
          costLine={costLineForm?.costLine ?? null}
          defaultCurrency={roiCase.currency}
          onClose={() => (costLineWrite.busy ? undefined : setCostLineForm(null))}
          onSubmit={submitCostLine}
          isPolish={isPolish}
          busy={costLineWrite.busy}
          errorMessage={costLineWrite.error}
          isConflict={costLineWrite.isConflict}
        />
        <RoiRemoveLineItemDialog
          open={!!removeCostLine}
          itemLabel={removeCostLine?.label ?? ''}
          isPolish={isPolish}
          onClose={() => (costLineWrite.busy ? undefined : setRemoveCostLine(null))}
          onSubmit={submitRemoveCostLine}
          busy={costLineWrite.busy}
          errorMessage={costLineWrite.error}
          isConflict={costLineWrite.isConflict}
        />
      </>
    );
  }

  if (tab === 'benefit-lines') {
    const rows: TableRow[] = (benefitLines ?? []).map((b) => withId(b, 'benefitLineId'));
    const selected = (benefitLines ?? []).find((b) => b.benefitLineId === selectedBenefitLineId) ?? null;
    return (
      <>
        <ResultsVNextRegistryShell
          domain="roi"
          moduleBar={{
            breadcrumbs,
            tabs,
            activeTab: tab,
            onTabChange: (id) => setTab(id as ModelTab),
            showTabCounts: false,
            viewModes: ['table'],
            viewMode: 'table',
            primaryCta: addCta(isPolish ? 'Nowa pozycja korzyści' : 'New benefit line', openCreateBenefitLine, 'roi-model-benefit-line-create-cta'),
          }}
          table={{
            columns: buildRoiBenefitLineColumns(isPolish),
            data: rows,
            persistKey: 'results-vnext.roi-model.benefit-lines',
            loading: benefitLinesLoading,
            error: benefitLinesError,
            onRetry: loadBenefitLines,
            empty:
              !benefitLinesLoading && !benefitLinesError && rows.length === 0
                ? {
                    title: isPolish ? 'Brak pozycji korzyści' : 'No benefit lines yet',
                    description: isPolish ? 'Ta sprawa nie ma jeszcze żadnych korzyści.' : 'This case has no benefit lines yet.',
                    actionLabel: locked ? undefined : isPolish ? 'Nowa pozycja korzyści' : 'New benefit line',
                    onAction: locked ? undefined : openCreateBenefitLine,
                  }
                : undefined,
            selectedRowId: selectedBenefitLineId,
            onRowClick: (row) => setSelectedBenefitLineId(String(row.benefitLineId)),
            rowMenu: (row) => {
              const b = row as unknown as RoiBenefitLine;
              return {
                primary: [{ id: 'open', label: isPolish ? 'Otwórz' : 'Open', onClick: () => setSelectedBenefitLineId(b.benefitLineId) }],
                universalHandlers: {
                  preview: () => setSelectedBenefitLineId(b.benefitLineId),
                  edit: locked ? undefined : () => openEditBenefitLine(b),
                  editNote: locked ? lockReason : undefined,
                },
                destructive: locked ? { note: lockReason } : { onClick: () => setRemoveBenefitLine(b) },
              };
            },
            defaultSort: { columnId: 'updatedAt', direction: 'desc' },
          }}
          preview={selected ? buildRoiBenefitLinePreview(selected, roiCase.status, isPolish, () => setSelectedBenefitLineId(null)) : null}
        />
        <RoiBenefitLineFormModal
          open={!!benefitLineForm}
          mode={benefitLineForm?.mode ?? 'create'}
          benefitLine={benefitLineForm?.benefitLine ?? null}
          defaultCurrency={roiCase.currency}
          onClose={() => (benefitLineWrite.busy ? undefined : setBenefitLineForm(null))}
          onSubmit={submitBenefitLine}
          isPolish={isPolish}
          busy={benefitLineWrite.busy}
          errorMessage={benefitLineWrite.error}
          isConflict={benefitLineWrite.isConflict}
        />
        <RoiRemoveLineItemDialog
          open={!!removeBenefitLine}
          itemLabel={removeBenefitLine?.label ?? ''}
          isPolish={isPolish}
          onClose={() => (benefitLineWrite.busy ? undefined : setRemoveBenefitLine(null))}
          onSubmit={submitRemoveBenefitLine}
          busy={benefitLineWrite.busy}
          errorMessage={benefitLineWrite.error}
          isConflict={benefitLineWrite.isConflict}
        />
      </>
    );
  }

  // ── "settings" (default tab) — Baseline + Calculation policy 2-row table ─
  const settingsRows: TableRow[] =
    baseline === undefined || policy === undefined ? [] : buildRoiSettingsRows(baseline, policy).map((r) => withId(r, 'id'));
  const selectedSettings = settingsRows.find((r) => r.id === selectedSettingsId) as unknown as RoiSettingsRowVm | undefined;

  return (
    <>
      <ResultsVNextRegistryShell
        domain="roi"
        moduleBar={{
          breadcrumbs,
          tabs,
          activeTab: tab,
          onTabChange: (id) => setTab(id as ModelTab),
          showTabCounts: false,
          viewModes: ['table'],
          viewMode: 'table',
        }}
        table={{
          columns: buildRoiSettingsColumns(isPolish),
          data: settingsRows,
          persistKey: 'results-vnext.roi-model.settings',
          loading: settingsLoading,
          error: settingsError,
          onRetry: loadSettings,
          selectedRowId: selectedSettingsId,
          onRowClick: (row) => setSelectedSettingsId(row.id as 'baseline' | 'calculation-policy'),
          rowMenu: (row) =>
            buildRoiSettingsRowMenu(row as unknown as RoiSettingsRowVm, roiCase.status, isPolish, {
              onEdit: (r) => openEditSettings(r.kind),
              onPreview: (r) => setSelectedSettingsId(r.id),
            }),
        }}
        preview={selectedSettings ? buildRoiSettingsPreview(selectedSettings, roiCase.status, isPolish, () => setSelectedSettingsId(null)) : null}
      />
      <RoiBaselineEditModal
        open={editSettingsKind === 'baseline'}
        baseline={baseline ?? null}
        onClose={() => (settingsWrite.busy ? undefined : setEditSettingsKind(null))}
        onSubmit={submitBaseline}
        isPolish={isPolish}
        busy={settingsWrite.busy}
        errorMessage={settingsWrite.error}
        isConflict={settingsWrite.isConflict}
      />
      <RoiCalculationPolicyEditModal
        open={editSettingsKind === 'calculation-policy'}
        policy={policy ?? null}
        onClose={() => (settingsWrite.busy ? undefined : setEditSettingsKind(null))}
        onSubmit={submitPolicy}
        isPolish={isPolish}
        busy={settingsWrite.busy}
        errorMessage={settingsWrite.error}
        isConflict={settingsWrite.isConflict}
      />
    </>
  );
};

export default RoiCaseModelWorkspace;
