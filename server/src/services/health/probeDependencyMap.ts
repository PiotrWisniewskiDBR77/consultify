import type { ProbeResult } from './healthProbeService.js';

export type DependencyKind = 'database' | 'internal_service' | 'queue' | 'external_provider';
export type DependencyStatus = 'healthy' | 'degraded' | 'failing' | 'unknown';

export interface DependencyDeclaration {
  dependencyId: string;
  label: string;
  kind: DependencyKind;
}

export const DEPENDENCIES: readonly DependencyDeclaration[] = [
  { dependencyId: 'primary_data_store', label: 'Baza danych', kind: 'database' },
  {
    dependencyId: 'application_services',
    label: 'Wewnętrzne usługi aplikacji',
    kind: 'internal_service',
  },
];

/**
 * Jawna mapa utrzymywana na podstawie implementacji probe'ów.
 * Każdy komentarz wskazuje początek kodu stanowiącego dowód, bez ujawniania
 * dostawcy, hosta ani innych danych infrastruktury platformowej.
 */
export const PROBE_DEPENDENCIES: Readonly<Record<string, readonly string[]>> = {
  // healthProbeService.ts:104-137 — createKPI/getKPI + org-scoped cleanup in the data store.
  m15_kpi_round_trip: ['application_services', 'primary_data_store'],
  // healthProbeService.ts:145-215 — application transaction with write/read rollback.
  m15_roi_round_trip: ['application_services', 'primary_data_store'],
  // healthProbeService.ts:227-263 — org-scoped statement query + application schema contract.
  m16_statements_grounding: ['application_services', 'primary_data_store'],
  // healthProbeService.ts:275-320 — audit service write/read round-trip.
  m24_member_validate_audit: ['application_services', 'primary_data_store'],
  // healthProbeService.ts:332-386 — artifact registry service and org-scoped records.
  m17_artifacts_draft_filter: ['application_services', 'primary_data_store'],
  // healthProbeService.ts:398-484 — handoff service with org-scoped persisted state.
  m14_m15_handoff: ['application_services', 'primary_data_store'],
  // healthProbeService.ts:496-510 — live interview-insights service read.
  gp_interview_insights_live: ['application_services', 'primary_data_store'],
  // healthProbeService.ts:512-526 — live initiatives service read.
  gp_initiatives_list_live: ['application_services', 'primary_data_store'],
  // healthProbeService.ts:528-546 — assessment-to-initiatives application flow.
  gp_assessment_to_initiatives_live: ['application_services', 'primary_data_store'],
  // healthProbeService.ts:548-565 — tools-to-initiatives application flow.
  gp_tools_to_initiatives_live: ['application_services', 'primary_data_store'],
  // healthProbeService.ts:567-585 — initiatives-to-execution application flow.
  gp_initiatives_to_execution_live: ['application_services', 'primary_data_store'],
  // healthProbeService.ts:587-604 — execution-to-results application flow.
  gp_execution_to_results_live: ['application_services', 'primary_data_store'],
  // healthProbeService.ts:606-621 — org-scoped assessments list read.
  gp_assessments_list_live: ['application_services', 'primary_data_store'],
  // healthProbeService.ts:623-644 — org-scoped DRD report read.
  gp_drd_report_live: ['application_services', 'primary_data_store'],
  // healthProbeService.ts:646-669 — artifact register read through application service.
  gp_m17_register_read_live: ['application_services', 'primary_data_store'],
  // healthProbeService.ts:671-718 — tools-to-initiative write/read/cleanup round-trip.
  gp4_tools_to_initiative_round_trip: ['application_services', 'primary_data_store'],
  // healthProbeService.ts:720-769 — ideas-to-initiative write/read/cleanup round-trip.
  gp5_ideas_convert_to_initiative_round_trip: ['application_services', 'primary_data_store'],
  // healthProbeService.ts:771-828 — initiative-to-execution write/read/cleanup round-trip.
  gp6_initiative_to_execution_round_trip: ['application_services', 'primary_data_store'],
  // healthProbeService.ts:830-907 — execution closure-to-results persisted round-trip.
  gp7_execution_closure_to_results_round_trip: ['application_services', 'primary_data_store'],
  // healthProbeService.ts:909-1013 — results/finance reconciliation persisted round-trip.
  gp8_results_finance_reconciliation_round_trip: ['application_services', 'primary_data_store'],
};

export const UNDECLARED_PROBES: readonly string[] = [];

export function buildDependencyHealth(results: readonly ProbeResult[]) {
  return DEPENDENCIES.map((dependency) => {
    const probeIds = Object.entries(PROBE_DEPENDENCIES)
      .filter(([, dependencyIds]) => dependencyIds.includes(dependency.dependencyId))
      .map(([probeId]) => probeId);
    const linked = results.filter((result) => probeIds.includes(result.probeId));
    const fresh = linked.filter((result) => Boolean(result.ranAt));
    let status: DependencyStatus = 'unknown';
    if (fresh.some((result) => result.status === 'fail')) status = 'failing';
    else if (fresh.length > 0 && fresh.every((result) => result.status === 'pass')) {
      status = fresh.length === probeIds.length ? 'healthy' : 'degraded';
    } else if (fresh.length > 0) status = 'degraded';
    const lastCheckedAt = fresh.reduce<string | null>((latest, result) => {
      if (!result.ranAt) return latest;
      return !latest || Date.parse(result.ranAt) > Date.parse(latest) ? result.ranAt : latest;
    }, null);
    return { ...dependency, status, probeIds, lastCheckedAt };
  });
}
