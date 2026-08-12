/**
 * RN-G3 lane (KPI full tool, klasa L) — pure label/tone helpers for the
 * Deviation Case 9-state machine + escalation overlay and the Initiative
 * Impact / Corrective Action / Effectiveness Verification sub-enums.
 *
 * Mirrors the existing `ResultsKpiRegistryPage.tsx` STATUS_TONE/STATUS_LABEL
 * pattern (duplicated here rather than imported — those maps are module-
 * private in that file, and this package's allowlist does not include
 * exporting new surface from it beyond what's already justified).
 *
 * `StatusTone` values match `src/components/ui/primitives`'s `StatusChip`
 * tone union (`info`/`warning`/`success`/`neutral`/`danger`) — read from
 * that file before adding a tone value not already in the union.
 */
import type { StatusTone } from '@/components/ui/primitives';
import type {
  CorrectiveActionStatus,
  DeviationCaseStatus,
  EffectivenessVerificationStatus,
} from './kpiDeviationApi';
import type { InitiativeKpiImpactStatus } from './kpiInitiativeImpactApi';
import type { KpiApprovalStatus, KpiPerformanceStatus, KpiDataQualityStatus, KpiTargetGeometry } from '../kpiApi';

export const DEVIATION_CASE_STATUS_TONE: Record<DeviationCaseStatus, StatusTone> = {
  open: 'danger',
  analysis_required: 'warning',
  plan_required: 'warning',
  plan_submitted: 'info',
  approved: 'info',
  executing: 'info',
  recovery_observed: 'info',
  verification: 'warning',
  closed: 'neutral',
};

const DEVIATION_CASE_STATUS_LABEL: Record<DeviationCaseStatus, { pl: string; en: string }> = {
  open: { pl: 'Otwarta', en: 'Open' },
  analysis_required: { pl: 'Wymaga analizy', en: 'Analysis required' },
  plan_required: { pl: 'Wymaga planu', en: 'Plan required' },
  plan_submitted: { pl: 'Plan złożony', en: 'Plan submitted' },
  approved: { pl: 'Plan zatwierdzony', en: 'Plan approved' },
  executing: { pl: 'W realizacji', en: 'Executing' },
  recovery_observed: { pl: 'Odbudowa zaobserwowana', en: 'Recovery observed' },
  verification: { pl: 'Weryfikacja skuteczności', en: 'Effectiveness verification' },
  closed: { pl: 'Zamknięta', en: 'Closed' },
};

export function deviationCaseStatusLabel(status: DeviationCaseStatus, isPolish: boolean): string {
  return isPolish ? DEVIATION_CASE_STATUS_LABEL[status].pl : DEVIATION_CASE_STATUS_LABEL[status].en;
}

export const DEVIATION_SEVERITY_TONE: Record<'warning' | 'critical', StatusTone> = {
  warning: 'warning',
  critical: 'danger',
};

export function deviationSeverityLabel(severity: 'warning' | 'critical', isPolish: boolean): string {
  if (severity === 'critical') return isPolish ? 'Krytyczna' : 'Critical';
  return isPolish ? 'Ostrzegawcza' : 'Warning';
}

/** Escalation is a NON-EXCLUSIVE boolean overlay (KPI_E003_DESIGN.md L75-78,
 * plan §4.6) — never a 10th state. This label is always rendered ADDITIONAL
 * to (never instead of) the status pill above. */
export function escalatedOverlayLabel(isPolish: boolean): string {
  return isPolish ? 'Eskalowana' : 'Escalated';
}

const CORRECTIVE_ACTION_STATUS_LABEL: Record<CorrectiveActionStatus, { pl: string; en: string }> = {
  planned: { pl: 'Zaplanowana', en: 'Planned' },
  active: { pl: 'W trakcie', en: 'Active' },
  blocked: { pl: 'Zablokowana', en: 'Blocked' },
  completed: { pl: 'Zakończona', en: 'Completed' },
  cancelled: { pl: 'Anulowana', en: 'Cancelled' },
};

export function correctiveActionStatusLabel(status: CorrectiveActionStatus, isPolish: boolean): string {
  return isPolish ? CORRECTIVE_ACTION_STATUS_LABEL[status].pl : CORRECTIVE_ACTION_STATUS_LABEL[status].en;
}

export const CORRECTIVE_ACTION_STATUS_TONE: Record<CorrectiveActionStatus, StatusTone> = {
  planned: 'neutral',
  active: 'info',
  blocked: 'warning',
  completed: 'success',
  cancelled: 'neutral',
};

const EFFECTIVENESS_VERIFICATION_STATUS_LABEL: Record<
  EffectivenessVerificationStatus,
  { pl: string; en: string }
> = {
  pending: { pl: 'Oczekująca', en: 'Pending' },
  effective: { pl: 'Skuteczna', en: 'Effective' },
  partially_effective: { pl: 'Częściowo skuteczna', en: 'Partially effective' },
  ineffective: { pl: 'Nieskuteczna', en: 'Ineffective' },
};

export function effectivenessVerificationStatusLabel(
  status: EffectivenessVerificationStatus,
  isPolish: boolean
): string {
  return isPolish
    ? EFFECTIVENESS_VERIFICATION_STATUS_LABEL[status].pl
    : EFFECTIVENESS_VERIFICATION_STATUS_LABEL[status].en;
}

export const EFFECTIVENESS_VERIFICATION_STATUS_TONE: Record<EffectivenessVerificationStatus, StatusTone> = {
  pending: 'neutral',
  effective: 'success',
  partially_effective: 'warning',
  ineffective: 'danger',
};

const INITIATIVE_KPI_IMPACT_STATUS_LABEL: Record<InitiativeKpiImpactStatus, { pl: string; en: string }> = {
  proposed: { pl: 'Zaproponowany', en: 'Proposed' },
  committed: { pl: 'Zatwierdzony (baseline)', en: 'Committed (baseline)' },
  superseded: { pl: 'Zastąpiony', en: 'Superseded' },
  realized_reviewed: { pl: 'Zrealizowany — po przeglądzie', en: 'Realized — reviewed' },
  cancelled: { pl: 'Anulowany', en: 'Cancelled' },
};

export function initiativeKpiImpactStatusLabel(status: InitiativeKpiImpactStatus, isPolish: boolean): string {
  return isPolish
    ? INITIATIVE_KPI_IMPACT_STATUS_LABEL[status].pl
    : INITIATIVE_KPI_IMPACT_STATUS_LABEL[status].en;
}

export const INITIATIVE_KPI_IMPACT_STATUS_TONE: Record<InitiativeKpiImpactStatus, StatusTone> = {
  proposed: 'neutral',
  committed: 'info',
  superseded: 'neutral',
  realized_reviewed: 'success',
  cancelled: 'neutral',
};

const PERFORMANCE_STATUS_LABEL: Record<KpiPerformanceStatus, { pl: string; en: string }> = {
  on_target: { pl: 'W celu', en: 'On target' },
  warning: { pl: 'Ostrzeżenie', en: 'Warning' },
  critical: { pl: 'Krytyczny', en: 'Critical' },
  neutral: { pl: 'Neutralny', en: 'Neutral' },
};

export function performanceStatusLabel(status: KpiPerformanceStatus, isPolish: boolean): string {
  return isPolish ? PERFORMANCE_STATUS_LABEL[status].pl : PERFORMANCE_STATUS_LABEL[status].en;
}

export const PERFORMANCE_STATUS_TONE: Record<KpiPerformanceStatus, StatusTone> = {
  on_target: 'success',
  warning: 'warning',
  critical: 'danger',
  neutral: 'neutral',
};

const DATA_QUALITY_STATUS_LABEL: Record<KpiDataQualityStatus, { pl: string; en: string }> = {
  unverified: { pl: 'Niezweryfikowane', en: 'Unverified' },
  verified: { pl: 'Zweryfikowane', en: 'Verified' },
  disputed: { pl: 'Sporne', en: 'Disputed' },
  estimated: { pl: 'Szacowane', en: 'Estimated' },
};

export function dataQualityStatusLabel(status: KpiDataQualityStatus, isPolish: boolean): string {
  return isPolish ? DATA_QUALITY_STATUS_LABEL[status].pl : DATA_QUALITY_STATUS_LABEL[status].en;
}

export const DATA_QUALITY_STATUS_TONE: Record<KpiDataQualityStatus, StatusTone> = {
  unverified: 'neutral',
  verified: 'success',
  disputed: 'danger',
  estimated: 'warning',
};

// RN-G6 UI fix (2026-08-12) — Contract section, `getKpiCurrentDefinitionVersion`
// (`GET /kpi/:kpiId/version`, P0-D) now used to show the joined definition
// version's `approvalStatus`/`targetGeometry` — same duplicated-map
// convention this file's header documents (mirrors
// `KpiDraftFormModal.tsx`'s own `GEOMETRY_LABEL`, that file being outside
// this package's edit allowlist).
const KPI_APPROVAL_STATUS_LABEL: Record<KpiApprovalStatus, { pl: string; en: string }> = {
  draft: { pl: 'Szkic', en: 'Draft' },
  submitted: { pl: 'Zgłoszona', en: 'Submitted' },
  approved: { pl: 'Zatwierdzona', en: 'Approved' },
  rejected: { pl: 'Odrzucona', en: 'Rejected' },
};

export function kpiApprovalStatusLabel(status: KpiApprovalStatus, isPolish: boolean): string {
  return isPolish ? KPI_APPROVAL_STATUS_LABEL[status].pl : KPI_APPROVAL_STATUS_LABEL[status].en;
}

export const KPI_APPROVAL_STATUS_TONE: Record<KpiApprovalStatus, StatusTone> = {
  draft: 'neutral',
  submitted: 'info',
  approved: 'success',
  rejected: 'danger',
};

const KPI_TARGET_GEOMETRY_LABEL: Record<KpiTargetGeometry, { pl: string; en: string }> = {
  threshold_min: { pl: 'Próg minimalny (im więcej, tym lepiej)', en: 'Minimum threshold (higher is better)' },
  threshold_max: { pl: 'Próg maksymalny (im mniej, tym lepiej)', en: 'Maximum threshold (lower is better)' },
  range: { pl: 'Przedział', en: 'Range' },
  exact: { pl: 'Wartość dokładna', en: 'Exact value' },
  binary: { pl: 'Zero-jedynkowy (spełniony/niespełniony)', en: 'Binary (met/not met)' },
  custom: { pl: 'Niestandardowy (formuła, bez oceny automatycznej)', en: 'Custom (formula, no automatic evaluation)' },
};

export function kpiTargetGeometryLabel(geometry: KpiTargetGeometry, isPolish: boolean): string {
  return isPolish ? KPI_TARGET_GEOMETRY_LABEL[geometry].pl : KPI_TARGET_GEOMETRY_LABEL[geometry].en;
}
