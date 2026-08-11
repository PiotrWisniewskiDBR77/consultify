/**
 * RoiCaseModelWorkspace — the BUILD CASE phase of the ROI Case FULL TOOL
 * (task brief: "Zorganizuj je jako cztery fazy — Build Case → Decision →
 * Realize Value → Learn"). Originally RN-G2 §G #12-14 (Baseline +
 * calculation policy, Assumptions CRUD, Cost lines + Benefit lines CRUD) —
 * EXTENDED, not duplicated, with Scenarios + overrides and Calculation-run
 * triggering (§C `roi.routes.ts` scenarios/overrides/calculation-runs
 * groups), since both are genuinely part of building the case's economic
 * model before it goes to Decision.
 *
 * PLACEMENT: a sub-view of the SELECTED case within the existing
 * `/results/roi` route, switched by local component state in
 * `ResultsRoiHub.tsx` — see that file's `modelCase`/`fullToolCase` state
 * and `RoiCaseFullTool.tsx`'s header comment for the up-to-date placement
 * rationale (RN_G2_UI_SCOPE.md §G Open Question #2 stays unresolved; this
 * package does not silently pre-decide it).
 *
 * Data flow: the case itself (`RoiCaseListItem`) is passed in from the
 * already-loaded registry row — no redundant `GET /cases/:caseId` fetch.
 * Each Menu 2 tab fetches its own sub-resource lazily on first visit and a
 * local fetch failure never blanks the other tabs (RN_G2_UI_SCOPE.md §D).
 *
 * Lock semantics: every sub-resource here shares the exact same
 * `NON_EDITABLE_STATUSES` guard as the case itself (baseline/policy/
 * assumptions/cost+benefit lines verified in `roiCaseDetailMappers.ts`
 * header comment; scenarios/overrides verified at
 * `roiScenarioCommands.ts:75-77`; calculation-run creation instead uses its
 * OWN narrower `RUNNABLE_STATUSES = {'modeling','ready_for_review'}`
 * (`roiCalculationRunCommands.ts:349,385-390`) — NOT the same list, so the
 * "New run" CTA locks on a different, narrower condition than the rest of
 * this tab, computed separately below, not reusing `isRoiCaseLocked`.
 *
 * Menu 3: the phase-switcher chips (Build Case/Decision/Realize
 * Value/Learn), built once by `RoiCasePhaseNav.tsx` and reused identically
 * by the other three phase workspaces so the strip never drifts.
 */
import { Plus } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import type { RelationItem, StandardModuleTab, TableRow } from '@/components/standard';

import { ResultsVNextRegistryShell } from '../ResultsVNextRegistryShell';
import type { RoiCaseListItem } from './roiApi';
import { isRoiCaseLocked, getRoiCaseLockInfo } from './roiRegistryMappers';
import { roiEvidenceLinkPurposeLabel } from './roiCaseFullToolMappers';
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
import {
  addRoiBenefitEvidenceLink,
  addRoiScenario,
  createRoiCalculationRun,
  listRoiBenefitEvidenceLinks,
  listRoiCalculationRuns,
  listRoiScenarios,
  removeRoiBenefitEvidenceLink,
  removeRoiScenario,
  removeRoiScenarioOverride,
  setRoiScenarioOverride,
  updateRoiScenario,
  type AddRoiBenefitEvidenceLinkInput,
  type AddRoiScenarioInput,
  type RoiBenefitEvidenceLink,
  type RoiCalculationRun,
  type RoiScenario,
  type RoiScenarioOverride,
  type SetRoiScenarioOverrideInput,
} from './roiCaseFullToolApi';
import {
  buildRoiCalculationRunColumns,
  buildRoiCalculationRunPreview,
  buildRoiCalculationRunRowMenu,
  buildRoiScenarioColumns,
  buildRoiScenarioPreview,
  buildRoiScenarioRowMenu,
  withRoiFullToolId,
} from './roiCaseFullToolPresenters';
import { RoiCalculationRunTriggerModal, RoiKpiEvidenceLinkFormModal, RoiScenarioFormModal, RoiScenarioOverrideFormModal } from './RoiBuildCaseModals';
import { buildRoiCasePhaseChips, type RoiCasePhase } from './RoiCasePhaseNav';

type ModelTab = 'settings' | 'assumptions' | 'cost-lines' | 'benefit-lines' | 'scenarios' | 'calculation-runs';

/** `RUNNABLE_STATUSES` for calculation-run creation — verbatim from
 * `roiCalculationRunCommands.ts:349` — deliberately NOT
 * `NON_EDITABLE_STATUSES`, see file header. */
const ROI_CALC_RUN_RUNNABLE_STATUSES: readonly RoiCaseListItem['status'][] = ['modeling', 'ready_for_review'];

export interface RoiCaseModelWorkspaceProps {
  roiCase: RoiCaseListItem;
  isPolish: boolean;
  onBack: () => void;
  phase: RoiCasePhase;
  onPhaseChange: (phase: RoiCasePhase) => void;
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

export const RoiCaseModelWorkspace: React.FC<RoiCaseModelWorkspaceProps> = ({ roiCase, isPolish, onBack, phase, onPhaseChange }) => {
  const [tab, setTab] = useState<ModelTab>('settings');
  const locked = isRoiCaseLocked(roiCase.status);
  const lock = getRoiCaseLockInfo(roiCase.status);
  const lockReason = lock ? (isPolish ? lock.reason.pl : lock.reason.en) : undefined;
  const phaseChips = buildRoiCasePhaseChips(isPolish);

  // ── Scenarios (+ overrides) ──────────────────────────────────────────────
  const [scenarios, setScenarios] = useState<RoiScenario[] | null>(null);
  const [scenariosError, setScenariosError] = useState<string | null>(null);
  const [scenariosLoading, setScenariosLoading] = useState(false);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
  const [scenarioOverrides, setScenarioOverrides] = useState<RoiScenarioOverride[] | null>(null);
  const [scenarioForm, setScenarioForm] = useState<{ mode: 'create' | 'edit'; scenario: RoiScenario | null } | null>(null);
  const [scenarioWrite, setScenarioWrite] = useState<WriteState>(IDLE_WRITE);
  const [scenarioIdempotencyKey, setScenarioIdempotencyKey] = useState('');
  const [removeScenario, setRemoveScenarioTarget] = useState<RoiScenario | null>(null);
  const [overrideForm, setOverrideForm] = useState<RoiScenario | null>(null);

  const loadScenarios = useCallback(() => {
    setScenariosLoading(true);
    setScenariosError(null);
    listRoiScenarios(roiCase.caseId)
      .then((rows) => setScenarios(rows.filter((s) => !s.deletedAt)))
      .catch((err) => setScenariosError(err instanceof Error ? err.message : String(err)))
      .finally(() => setScenariosLoading(false));
  }, [roiCase.caseId]);

  // ── Calculation runs (read history + trigger new) ────────────────────────
  const [calcRuns, setCalcRuns] = useState<RoiCalculationRun[] | null>(null);
  const [calcRunsError, setCalcRunsError] = useState<string | null>(null);
  const [calcRunsLoading, setCalcRunsLoading] = useState(false);
  const [selectedCalcRunId, setSelectedCalcRunId] = useState<string | null>(null);
  const [calcRunTriggerOpen, setCalcRunTriggerOpen] = useState(false);
  const [calcRunWrite, setCalcRunWrite] = useState<WriteState>(IDLE_WRITE);
  const [calcRunIdempotencyKey, setCalcRunIdempotencyKey] = useState('');

  const loadCalcRuns = useCallback(() => {
    setCalcRunsLoading(true);
    setCalcRunsError(null);
    listRoiCalculationRuns(roiCase.caseId)
      .then((rows) => setCalcRuns(rows))
      .catch((err) => setCalcRunsError(err instanceof Error ? err.message : String(err)))
      .finally(() => setCalcRunsLoading(false));
  }, [roiCase.caseId]);

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

  const conflictOf = (err: unknown) => err instanceof RoiApiError && err.status === 409;
  const messageOf = (err: unknown) => (err instanceof Error ? err.message : String(err));

  // ── KPI evidence links — nested under ONE selected benefit line ──────────
  // (roi.routes.ts L1368-1467). Fetched lazily only when a benefit line is
  // open, rendered via that line's `StandardPreview.relations` block
  // (`roiCaseFullToolPresenters.tsx` pattern) — never a 7th top-level tab for
  // a resource with no independent existence outside its parent line.
  const [evidenceLinks, setEvidenceLinks] = useState<RoiBenefitEvidenceLink[] | null>(null);
  const [evidenceLinksError, setEvidenceLinksError] = useState<string | null>(null);
  const [evidenceLinkForm, setEvidenceLinkForm] = useState<RoiBenefitLine | null>(null);
  const [evidenceLinkWrite, setEvidenceLinkWrite] = useState<WriteState>(IDLE_WRITE);

  useEffect(() => {
    if (!selectedBenefitLineId) {
      setEvidenceLinks(null);
      return;
    }
    let cancelled = false;
    setEvidenceLinks(null);
    setEvidenceLinksError(null);
    listRoiBenefitEvidenceLinks(roiCase.caseId, selectedBenefitLineId)
      .then((rows) => { if (!cancelled) setEvidenceLinks(rows); })
      .catch((err) => { if (!cancelled) setEvidenceLinksError(err instanceof Error ? err.message : String(err)); });
    return () => { cancelled = true; };
  }, [roiCase.caseId, selectedBenefitLineId]);

  const submitEvidenceLink = (values: AddRoiBenefitEvidenceLinkInput) => {
    if (!evidenceLinkForm) return;
    setEvidenceLinkWrite({ busy: true, error: null, isConflict: false });
    addRoiBenefitEvidenceLink(roiCase.caseId, evidenceLinkForm.benefitLineId, { ...values, idempotencyKey: newRoiIdempotencyKey() })
      .then((res) => {
        setEvidenceLinks((prev) => [...(prev ?? []), res.link]);
        setEvidenceLinkForm(null);
      })
      .catch((err) => setEvidenceLinkWrite({ busy: false, error: messageOf(err), isConflict: conflictOf(err) }))
      .finally(() => setEvidenceLinkWrite((s) => ({ ...s, busy: false })));
  };
  const removeEvidenceLink = (benefitLine: RoiBenefitLine, link: RoiBenefitEvidenceLink) => {
    removeRoiBenefitEvidenceLink(roiCase.caseId, benefitLine.benefitLineId, link.linkId, { expectedVersion: link.rowVersion, idempotencyKey: newRoiIdempotencyKey() })
      .then(() => setEvidenceLinks((prev) => (prev ?? []).filter((l) => l.linkId !== link.linkId)))
      .catch(() => {
        /* Non-blocking, same rationale as `removeOverride` above — a failed
         * remove leaves the link visible and the user can retry. */
      });
  };

  // Lazy per-tab fetch — a local failure never blanks the other three tabs.
  useEffect(() => {
    if (tab === 'settings' && baseline === undefined && !settingsLoading) loadSettings();
    if (tab === 'assumptions' && assumptions === null && !assumptionsLoading) loadAssumptions();
    if (tab === 'cost-lines' && costLines === null && !costLinesLoading) loadCostLines();
    if (tab === 'benefit-lines' && benefitLines === null && !benefitLinesLoading) loadBenefitLines();
    if (tab === 'scenarios' && scenarios === null && !scenariosLoading) loadScenarios();
    if (tab === 'calculation-runs' && calcRuns === null && !calcRunsLoading) loadCalcRuns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Overrides are nested under ONE selected scenario — fetched lazily only
  // when a scenario is opened (same "no N+1 across the whole list" shape as
  // `ResultsRoiHub.tsx`'s calc-run preview fetch).
  useEffect(() => {
    if (!selectedScenarioId) { setScenarioOverrides(null); return; }
    // Overrides have no dedicated GET-list wrapper in `roiCaseFullToolApi.ts`
    // by server design (no such route exists — only POST/DELETE on a
    // scenario's overrides; the scenario's own GET response does not embed
    // them either, per `roiEconomicModelTypes.ts` `RoiScenario` shape). This
    // is a real, honest gap: the preview's `relations` block below renders
    // whatever this component has accumulated CLIENT-SIDE this session
    // (via `setRoiScenarioOverride`'s own response), never re-fetched from
    // a list endpoint that does not exist. Documented, not silently guessed.
    setScenarioOverrides((prev) => prev ?? []);
  }, [selectedScenarioId]);

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

  // ── Scenario write handlers ──────────────────────────────────────────────
  const openCreateScenario = () => {
    if (locked) return;
    setScenarioWrite(IDLE_WRITE);
    setScenarioIdempotencyKey(newRoiIdempotencyKey());
    setScenarioForm({ mode: 'create', scenario: null });
  };
  const openEditScenario = (s: RoiScenario) => {
    setScenarioWrite(IDLE_WRITE);
    setScenarioIdempotencyKey(newRoiIdempotencyKey());
    setScenarioForm({ mode: 'edit', scenario: s });
  };
  const submitScenario = (values: AddRoiScenarioInput) => {
    if (!scenarioForm) return;
    setScenarioWrite({ busy: true, error: null, isConflict: false });
    const call =
      scenarioForm.mode === 'create'
        ? addRoiScenario(roiCase.caseId, { ...values, idempotencyKey: scenarioIdempotencyKey })
        : updateRoiScenario(roiCase.caseId, scenarioForm.scenario!.scenarioId, {
            label: values.label,
            description: values.description,
            expectedVersion: scenarioForm.scenario!.rowVersion,
            idempotencyKey: scenarioIdempotencyKey,
          });
    call
      .then((res) => {
        setScenarios((prev) => {
          const without = (prev ?? []).filter((s) => s.scenarioId !== res.scenario.scenarioId);
          return [...without, res.scenario];
        });
        setSelectedScenarioId(res.scenario.scenarioId);
        setScenarioForm(null);
      })
      .catch((err) => setScenarioWrite({ busy: false, error: messageOf(err), isConflict: conflictOf(err) }))
      .finally(() => setScenarioWrite((s) => ({ ...s, busy: false })));
  };
  const submitRemoveScenario = (reason: string | null) => {
    if (!removeScenario) return;
    setScenarioWrite({ busy: true, error: null, isConflict: false });
    removeRoiScenario(roiCase.caseId, removeScenario.scenarioId, { expectedVersion: removeScenario.rowVersion, reason, idempotencyKey: newRoiIdempotencyKey() })
      .then(() => {
        setScenarios((prev) => (prev ?? []).filter((s) => s.scenarioId !== removeScenario.scenarioId));
        if (selectedScenarioId === removeScenario.scenarioId) setSelectedScenarioId(null);
        setRemoveScenarioTarget(null);
      })
      .catch((err) => setScenarioWrite({ busy: false, error: messageOf(err), isConflict: conflictOf(err) }))
      .finally(() => setScenarioWrite((s) => ({ ...s, busy: false })));
  };
  const overrideTargetOptions = (): { targetType: 'assumption' | 'cost_line' | 'benefit_line'; targetId: string; label: string }[] => [
    ...(assumptions ?? []).map((a) => ({ targetType: 'assumption' as const, targetId: a.assumptionId, label: `${isPolish ? 'Założenie' : 'Assumption'}: ${a.label}` })),
    ...(costLines ?? []).map((c) => ({ targetType: 'cost_line' as const, targetId: c.costLineId, label: `${isPolish ? 'Koszt' : 'Cost'}: ${c.label}` })),
    ...(benefitLines ?? []).map((b) => ({ targetType: 'benefit_line' as const, targetId: b.benefitLineId, label: `${isPolish ? 'Korzyść' : 'Benefit'}: ${b.label}` })),
  ];
  const submitOverride = (values: Omit<SetRoiScenarioOverrideInput, 'expectedVersion'>) => {
    if (!overrideForm) return;
    setScenarioWrite({ busy: true, error: null, isConflict: false });
    setRoiScenarioOverride(roiCase.caseId, overrideForm.scenarioId, { ...values, expectedVersion: overrideForm.rowVersion, idempotencyKey: newRoiIdempotencyKey() })
      .then((res) => {
        setScenarioOverrides((prev) => [...(prev ?? []).filter((o) => o.overrideId !== res.override.overrideId), res.override]);
        setOverrideForm(null);
      })
      .catch((err) => setScenarioWrite({ busy: false, error: messageOf(err), isConflict: conflictOf(err) }))
      .finally(() => setScenarioWrite((s) => ({ ...s, busy: false })));
  };
  const removeOverride = (scenario: RoiScenario, override: RoiScenarioOverride) => {
    removeRoiScenarioOverride(roiCase.caseId, scenario.scenarioId, override.overrideId, { expectedVersion: scenario.rowVersion, idempotencyKey: newRoiIdempotencyKey() })
      .then(() => setScenarioOverrides((prev) => (prev ?? []).filter((o) => o.overrideId !== override.overrideId)))
      .catch(() => {
        /* Non-blocking — a failed remove leaves the override visible; the
         * user can retry. Preview-level relation clicks intentionally don't
         * open a second confirmation dialog (RN-G2 keeps this action
         * single-click, unlike top-level line-item removal). */
      });
  };

  // ── Calculation run write handlers ───────────────────────────────────────
  const calcRunRunnable = ROI_CALC_RUN_RUNNABLE_STATUSES.includes(roiCase.status);
  const openTriggerCalcRun = () => {
    if (!calcRunRunnable) return;
    setCalcRunWrite(IDLE_WRITE);
    setCalcRunIdempotencyKey(newRoiIdempotencyKey());
    setCalcRunTriggerOpen(true);
  };
  const submitCalcRunTrigger = (values: { scenarioId?: string | null; reason?: string | null }) => {
    setCalcRunWrite({ busy: true, error: null, isConflict: false });
    createRoiCalculationRun(roiCase.caseId, { ...values, idempotencyKey: calcRunIdempotencyKey })
      .then((res) => {
        setCalcRuns((prev) => [res.run, ...(prev ?? [])]);
        setSelectedCalcRunId(res.run.runId);
        setCalcRunTriggerOpen(false);
      })
      .catch((err) => setCalcRunWrite({ busy: false, error: messageOf(err), isConflict: conflictOf(err) }))
      .finally(() => setCalcRunWrite((s) => ({ ...s, busy: false })));
  };

  const tabs: StandardModuleTab[] = [
    { id: 'settings', label: isPolish ? 'Baseline i polityka' : 'Baseline & policy' },
    { id: 'assumptions', label: isPolish ? 'Założenia' : 'Assumptions' },
    { id: 'cost-lines', label: isPolish ? 'Koszty' : 'Cost lines' },
    { id: 'benefit-lines', label: isPolish ? 'Korzyści' : 'Benefit lines' },
    { id: 'scenarios', label: isPolish ? 'Scenariusze' : 'Scenarios' },
    { id: 'calculation-runs', label: isPolish ? 'Przebiegi kalkulacji' : 'Calculation runs' },
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
            chips: phaseChips,
            activeChip: phase,
            onChipChange: (id) => onPhaseChange(id as RoiCasePhase),
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
            chips: phaseChips,
            activeChip: phase,
            onChipChange: (id) => onPhaseChange(id as RoiCasePhase),
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
            chips: phaseChips,
            activeChip: phase,
            onChipChange: (id) => onPhaseChange(id as RoiCasePhase),
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
          preview={
            selected
              ? {
                  ...buildRoiBenefitLinePreview(selected, roiCase.status, isPolish, () => setSelectedBenefitLineId(null)),
                  relations: (evidenceLinks ?? []).map(
                    (l): RelationItem => ({
                      id: l.linkId,
                      label: `KPI ${l.kpiId} · ${roiEvidenceLinkPurposeLabel(l.purpose, isPolish)}`,
                      type: 'roi-kpi-evidence-link',
                      onClick: locked ? undefined : () => removeEvidenceLink(selected, l),
                    })
                  ),
                  relationsEmptyLabel: evidenceLinksError
                    ? isPolish
                      ? `Błąd wczytywania dowodów: ${evidenceLinksError}`
                      : `Error loading evidence: ${evidenceLinksError}`
                    : isPolish
                      ? 'Brak dowodów KPI dla tej pozycji korzyści'
                      : 'No KPI evidence for this benefit line',
                  actions: {
                    informational: [
                      {
                        id: 'manage-evidence',
                        variant: 'neutral',
                        label: isPolish ? 'Dodaj dowód KPI' : 'Add KPI evidence',
                        onClick: () => setEvidenceLinkForm(selected),
                        disabled: locked,
                      },
                    ],
                  },
                }
              : null
          }
        />
        <RoiKpiEvidenceLinkFormModal
          open={!!evidenceLinkForm}
          benefitLineLabel={evidenceLinkForm?.label ?? ''}
          onClose={() => (evidenceLinkWrite.busy ? undefined : setEvidenceLinkForm(null))}
          onSubmit={submitEvidenceLink}
          isPolish={isPolish}
          busy={evidenceLinkWrite.busy}
          errorMessage={evidenceLinkWrite.error}
          isConflict={evidenceLinkWrite.isConflict}
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

  if (tab === 'scenarios') {
    const rows: TableRow[] = (scenarios ?? []).map((s) => withRoiFullToolId(s, 'scenarioId'));
    const selected = (scenarios ?? []).find((s) => s.scenarioId === selectedScenarioId) ?? null;
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
            chips: phaseChips,
            activeChip: phase,
            onChipChange: (id) => onPhaseChange(id as RoiCasePhase),
            primaryCta: addCta(isPolish ? 'Nowy scenariusz' : 'New scenario', openCreateScenario, 'roi-model-scenario-create-cta'),
          }}
          table={{
            columns: buildRoiScenarioColumns(isPolish),
            data: rows,
            persistKey: 'results-vnext.roi-model.scenarios',
            loading: scenariosLoading,
            error: scenariosError,
            onRetry: loadScenarios,
            empty:
              !scenariosLoading && !scenariosError && rows.length === 0
                ? {
                    title: isPolish ? 'Brak scenariuszy' : 'No scenarios yet',
                    description: isPolish ? 'Ta sprawa nie ma jeszcze żadnych scenariuszy.' : 'This case has no scenarios yet.',
                    actionLabel: locked ? undefined : isPolish ? 'Nowy scenariusz' : 'New scenario',
                    onAction: locked ? undefined : openCreateScenario,
                  }
                : undefined,
            selectedRowId: selectedScenarioId,
            onRowClick: (row) => setSelectedScenarioId(String(row.scenarioId)),
            rowMenu: (row) => buildRoiScenarioRowMenu(row as unknown as RoiScenario, roiCase.status, isPolish, {
              onPreview: (r) => setSelectedScenarioId(r.scenarioId),
              onEdit: locked ? undefined : (r) => openEditScenario(r),
              onRemove: locked ? undefined : (r) => setRemoveScenarioTarget(r),
            }),
            defaultSort: { columnId: 'updatedAt', direction: 'desc' },
          }}
          preview={
            selected
              ? buildRoiScenarioPreview(selected, scenarioOverrides, roiCase.status, isPolish, {
                  onClose: () => setSelectedScenarioId(null),
                  onManageOverrides: locked ? undefined : () => setOverrideForm(selected),
                  onRemoveOverride: locked ? undefined : (o) => removeOverride(selected, o),
                })
              : null
          }
        />
        <RoiScenarioFormModal
          open={!!scenarioForm}
          mode={scenarioForm?.mode ?? 'create'}
          scenario={scenarioForm?.scenario ?? null}
          onClose={() => (scenarioWrite.busy ? undefined : setScenarioForm(null))}
          onSubmit={submitScenario}
          isPolish={isPolish}
          busy={scenarioWrite.busy}
          errorMessage={scenarioWrite.error}
          isConflict={scenarioWrite.isConflict}
        />
        <RoiRemoveLineItemDialog
          open={!!removeScenario}
          itemLabel={removeScenario?.label ?? ''}
          isPolish={isPolish}
          onClose={() => (scenarioWrite.busy ? undefined : setRemoveScenarioTarget(null))}
          onSubmit={submitRemoveScenario}
          busy={scenarioWrite.busy}
          errorMessage={scenarioWrite.error}
          isConflict={scenarioWrite.isConflict}
        />
        <RoiScenarioOverrideFormModal
          open={!!overrideForm}
          scenarioLabel={overrideForm?.label ?? ''}
          targetOptions={overrideTargetOptions()}
          onClose={() => (scenarioWrite.busy ? undefined : setOverrideForm(null))}
          onSubmit={submitOverride}
          isPolish={isPolish}
          busy={scenarioWrite.busy}
          errorMessage={scenarioWrite.error}
          isConflict={scenarioWrite.isConflict}
        />
      </>
    );
  }

  if (tab === 'calculation-runs') {
    const rows: TableRow[] = (calcRuns ?? []).map((r) => withRoiFullToolId(r, 'runId'));
    const selected = (calcRuns ?? []).find((r) => r.runId === selectedCalcRunId) ?? null;
    const runLockReason = isPolish
      ? 'Nowy przebieg kalkulacji można uruchomić tylko w statusie „Modelowanie” lub „Gotowy do przeglądu”.'
      : 'A new calculation run can only be started while the case is Modeling or Ready for review.';
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
            chips: phaseChips,
            activeChip: phase,
            onChipChange: (id) => onPhaseChange(id as RoiCasePhase),
            primaryCta: {
              label: isPolish ? 'Nowy przebieg' : 'New run',
              icon: Plus,
              onClick: openTriggerCalcRun,
              testId: 'roi-model-calc-run-trigger-cta',
              locked: !calcRunRunnable,
              lockedReason: !calcRunRunnable ? runLockReason : undefined,
            },
          }}
          table={{
            columns: buildRoiCalculationRunColumns(isPolish),
            data: rows,
            persistKey: 'results-vnext.roi-model.calculation-runs',
            loading: calcRunsLoading,
            error: calcRunsError,
            onRetry: loadCalcRuns,
            empty:
              !calcRunsLoading && !calcRunsError && rows.length === 0
                ? {
                    title: isPolish ? 'Brak przebiegów kalkulacji' : 'No calculation runs yet',
                    description: isPolish ? 'Ta sprawa nie ma jeszcze żadnego przebiegu kalkulacji.' : 'This case has no calculation runs yet.',
                    actionLabel: calcRunRunnable ? (isPolish ? 'Nowy przebieg' : 'New run') : undefined,
                    onAction: calcRunRunnable ? openTriggerCalcRun : undefined,
                  }
                : undefined,
            selectedRowId: selectedCalcRunId,
            onRowClick: (row) => setSelectedCalcRunId(String(row.runId)),
            rowMenu: (row) => buildRoiCalculationRunRowMenu(row as unknown as RoiCalculationRun, isPolish, (r) => setSelectedCalcRunId(r.runId)),
            defaultSort: { columnId: 'completedAt', direction: 'desc' },
          }}
          preview={selected ? buildRoiCalculationRunPreview(selected, isPolish, () => setSelectedCalcRunId(null)) : null}
        />
        <RoiCalculationRunTriggerModal
          open={calcRunTriggerOpen}
          scenarios={scenarios ?? []}
          onClose={() => (calcRunWrite.busy ? undefined : setCalcRunTriggerOpen(false))}
          onSubmit={submitCalcRunTrigger}
          isPolish={isPolish}
          busy={calcRunWrite.busy}
          errorMessage={calcRunWrite.error}
          isConflict={calcRunWrite.isConflict}
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
          chips: phaseChips,
          activeChip: phase,
          onChipChange: (id) => onPhaseChange(id as RoiCasePhase),
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
