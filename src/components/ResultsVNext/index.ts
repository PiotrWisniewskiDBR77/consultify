/**
 * RN-G2 — Results Next registry shell (P0). See RN_G2_UI_SCOPE.md and
 * `ResultsVNextRegistryShell.tsx` for the contract. Future P1/P2/P3 domain
 * screens live in this same folder alongside the shell.
 */
export { HonestValueCell, type HonestValueCellProps } from './HonestValue';
export {
  LifecycleLockBadge,
  type LifecycleLockBadgeProps,
  lockedRowMenuAction,
} from './LifecycleLockBadge';
export { ResultsKpiRegistryPage } from './ResultsKpiRegistryPage';
export { ResultsOkrRegistryPage } from './ResultsOkrRegistryPage';
export {
  ResultsVNextForbiddenState,
  type ResultsVNextForbiddenStateProps,
} from './ResultsVNextForbiddenState';
export {
  ResultsVNextRegistryRouteBase,
  type ResultsVNextRegistryRouteBaseProps,
} from './ResultsVNextRegistryRouteBase';
export {
  ResultsVNextRegistryShell,
  type ResultsVNextRegistryShellProps,
  type ResultsVNextTableProps,
} from './ResultsVNextRegistryShell';
export { ResultsRoiRegistryPage } from './ResultsRoiRegistryPage';
// R09-3 (2026-08-10) — shared, read-only legacy-archive registry (kpi/roi/okr
// `.../legacy` index). Exported for the NEXT wave to wire in as a hub tab —
// deliberately NOT mounted into any existing KPI/ROI/OKR hub here (those
// belong to other in-flight lanes; see the component's own header comment).
export {
  ResultsVNextLegacyArchivePanel,
  type ResultsVNextLegacyArchivePanelProps,
} from './legacy/ResultsVNextLegacyArchivePanel';
export {
  type LegacyArchiveIndexRow,
  type LegacyArchiveIndexMeta,
  type LegacyArchiveIndexResponse,
  type LegacyArchiveOriginDomain,
  LegacyArchiveApiError,
  listLegacyArchiveIndex,
  type ResultsVNextLegacyDomain,
} from './legacy/legacyArchiveApi';
// RN-G2 P2 — ROI vertical (registry list + preview). See `roi/` subfolder:
// `roiApi.ts` (fetch client), `roiRegistryMappers.ts` (status/lock/honest-
// value pure helpers), `roiRegistryPresenters.tsx` (StandardTable/Preview
// builders shared by the live Hub and the dev-render QA harness).
export { ResultsRoiHub } from './roi/ResultsRoiHub';
// RN-G2 P3 #23 — OKR vertical (Sets registry list + preview). See `okr/`
// subfolder: `okrApi.ts` (fetch client), `okrRegistryMappers.ts` (status/
// lock/honest-value pure helpers), `okrRegistryPresenters.tsx`
// (StandardTable/Preview builders shared by the live Hub and the dev-render
// QA harness). Mirrors the `roi/` subfolder exactly.
export { ResultsOkrHub } from './okr/ResultsOkrHub';
// RN-G3 lane `okr` full-tool task (2026-08-11) — the full OKR tool
// (`OkrSetWorkspace`, reached from a Set's row menu/preview) and the
// Program/Cycle admin surfaces (`/results/okr/programs`, `/results/okr/cycles`).
export { OkrSetWorkspace } from './okr/OkrSetWorkspace';
export { OkrProgramsPage } from './okr/OkrProgramsPage';
export { OkrCyclesPage } from './okr/OkrCyclesPage';
// RN-G2 P1 #8 — KPI Scorecards (registry tab on ResultsKpiRegistryPage +
// its own `/results/kpi/scorecards/:scorecardId` detail route). See
// `kpiScorecards/` subfolder: `kpiScorecardApi.ts` (fetch client),
// `kpiScorecardMappers.ts` (status/lock/label pure helpers),
// `kpiScorecardPresenters.tsx` (StandardTable/Preview builders shared by the
// live screens and the dev-render QA harness).
export { ResultsKpiScorecardDetailPage } from './kpiScorecards/ResultsKpiScorecardDetailPage';
// RN-G3 lane (2026-08-11) — KPI full tool, klasa L (`/results/kpi/:kpiId`,
// D03) + Deviation Case subview (D05). See `kpiTool/` subfolder:
// `kpiDeviationApi.ts`/`kpiInitiativeImpactApi.ts` (fetch clients),
// `kpiToolMappers.ts` (status/tone pure helpers), `KpiToolPage.tsx`/
// `KpiDeviationCaseSubview.tsx` (screens).
export { KpiToolPage } from './kpiTool/KpiToolPage';
export { KpiDeviationCaseSubview } from './kpiTool/KpiDeviationCaseSubview';
// RN-G5 scopegap task 1 (§G #30) — cross-cutting Attention view
// (`/results/attention`). See `attention/` subfolder: `attentionApi.ts`
// (fetch client for the 3 previously-unconsumed attention/team-health
// endpoints), `attentionPresenters.tsx` (bucket registry + generic row
// preview), `ResultsAttentionPage.tsx` (screen).
export { ResultsAttentionPage } from './attention/ResultsAttentionPage';
// RN-G5 scopegap task 3 (§G #11) — ROI org PIR-outcomes perspective, a
// standalone route + self-contained tab component ready to fold into
// `ResultsRoiHub.tsx` as a third Menu 2 tab (see `RoiPirOutcomesTab.tsx`
// header).
export { RoiPirOutcomesTab } from './roi/RoiPirOutcomesTab';
export { ResultsRoiPirOutcomesPage } from './roi/ResultsRoiPirOutcomesPage';
export {
  isResultsVNextFlagEnabled,
  RESULTS_VNEXT_FLAG_KEYS,
  resultsVNextHostAllowsDefaultOn,
  type ResultsVNextFlag,
} from './resultsVNextFeatureFlags';
export type {
  HonestValue,
  ResultsVNextDenyReason,
  ResultsVNextDomain,
  ResultsVNextForbiddenDetail,
} from './types';
// RN-G4 lane `teresa` (FALA 2, 2026-08-11) — shared Teresa governance panel
// (propose→approve/reject→execute→audit against the real P08
// `/api/v8/teresa/proposal*` surface) + its supporting pieces. Domain call
// sites live alongside each domain's own full-tool files (see
// `roi/roiTeresaLessonsDraft.ts` for the one wired-up example, ROI's
// `pir_lessons_draft` advisor mode).
export { TeresaProposalPanel, type TeresaProposalPanelProps } from './teresa/TeresaProposalPanel';
export {
  TeresaEvidenceBreakdown,
  type TeresaEvidenceBreakdownProps,
  type TeresaEvidenceBreakdownValue,
} from './teresa/TeresaEvidenceBreakdown';
export {
  TeresaUnavailableBanner,
  type TeresaUnavailableBannerProps,
} from './teresa/TeresaUnavailableBanner';
export {
  approveTeresaProposal,
  createTeresaProposal,
  executeTeresaProposal,
  getTeresaAuditTrail,
  getTeresaProposal,
  rejectTeresaProposal,
  TeresaProposalApiError,
} from './teresa/teresaProposalApi';
export type {
  HandoffTargetModule as TeresaHandoffTargetModule,
  TeresaHandoffContext,
} from './teresa/teresaHandoffTypes';
