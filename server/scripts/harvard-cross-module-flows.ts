#!/usr/bin/env tsx
/**
 * Harvard cross-module flow contracts (Krok 8 — system testów przekrojowych)
 *
 * The 20 canonical cross-module flows from Harvard/INTEGRACJE.md §B, encoded as
 * verifiable contracts. Each flow names anchor points (a route path, service
 * symbol, or table) that MUST exist in the codebase for the handoff to be wired.
 * Static + grep-based, so it runs in CI with no backend, no auth, no prod risk.
 *
 * `status` mirrors the INTEGRACJE verdict:
 *   - 'works'   — both ends wired, data flows (PEŁNY / DZIAŁA).
 *   - 'partial' — works through a weaker/local link (CZĘŚCIOWY / LOKALNY).
 *   - 'stub'    — sender only logs/no-ops; known-broken, tracked so it does not
 *                 silently regress further (STUB / URWANY / ZEPSUTE).
 *
 * The companion test asserts every anchor exists. A 'stub' flow whose anchor
 * disappears is still a signal (the broken handoff was removed/renamed).
 */

export type FlowStatus = 'works' | 'partial' | 'stub';

export interface FlowAnchor {
  // A file (relative to repo root) that must contain `needle`.
  file: string;
  needle: string;
}

export interface CrossModuleFlow {
  id: string; // B-number from INTEGRACJE §B
  name: string;
  chain: string; // e.g. 'M01→M02→M17'
  status: FlowStatus;
  anchors: FlowAnchor[];
  // Destination tables the flow writes into. Asserted to exist in the
  // migration-defined schema (the data has somewhere real to land).
  targetTables?: string[];
  note?: string;
}

export const FLOWS: CrossModuleFlow[] = [
  {
    id: 'B1', name: 'Czat → Canvas → registry → Outputs', chain: 'M01→M02→M17', status: 'works',
    targetTables: ['v8_output_artifacts', 'v8_artifact_origin_links'],
    anchors: [
      { file: 'server/src/services/v8/artifactRegistryService.ts', needle: 'registerArtifactOrigin' },
      { file: 'server/src/services/v8/artifactRegistryService.ts', needle: 'v8_artifact_origin_links' },
    ],
  },
  {
    id: 'B2', name: 'Czat → intercepty → Ideas/Tabele/Studia', chain: 'M01→M06/07/09/20/18/19', status: 'works',
    anchors: [{ file: 'server/src/routes/share.routes.ts', needle: '/conversations/:id/share' }],
    note: 'część za ENABLE_V8_GLOBAL',
  },
  {
    id: 'B3', name: 'Canvas → promote → Pomysł/Notatka/Inicjatywa/Decyzja/Zadanie', chain: 'M02→M05/04/13/03', status: 'works',
    anchors: [{ file: 'server/src/services/v8/artifactRegistryService.ts', needle: 'getOriginLinkByOrigin' }],
  },
  {
    id: 'B4', name: 'Wywiad → Inicjatywy → Wdrożenie → Rezultaty (kręgosłup)', chain: 'M10→M13→M14→M15', status: 'partial',
    targetTables: ['v8_kpi_signals', 'initiatives'],
    anchors: [
      { file: 'server/src/services/executionResultsBridge.ts', needle: 'exportBudgetHealthToResults' },
      { file: 'server/src/services/v8/resultsROIService.ts', needle: 'budget_health' },
    ],
    note: 'M14→M15 domknięte mostkiem 2026-06-12 (budget_health signal); pełny ROI feed = backlog',
  },
  {
    id: 'B6', name: 'Audyty → fan-out wywiadów → Inbox', chain: 'M12→M10→M03', status: 'works',
    targetTables: ['interview_assignments'],
    anchors: [
      { file: 'server/src/services/auditProgramService.ts', needle: 'InterviewAssignment' },
    ],
    note: 'P1: brak walidacji org-membership assignee',
  },
  {
    id: 'B7', name: 'Notatnik → konwersje (task/decision/report/presentation/canvas/idea)', chain: 'M04→M13/M17/M19/M03/M02', status: 'partial',
    anchors: [{ file: 'server/src/services/v8/notebookHandoffService.ts', needle: 'Radar' }],
    note: 'convert DZIAŁA; handoff→Radar/Inicjatywy STUB (0 INSERT)',
  },
  {
    id: 'B8', name: 'Ideas → convert (6 targetów)', chain: 'M05→M13/M14/M01', status: 'partial',
    anchors: [{ file: 'server/src/routes/my-work.routes.ts', needle: 'initiatives' }],
    note: 'convert→initiative/task_set/team_chat DZIAŁA; eksport serwerowy STUB',
  },
  {
    id: 'B8b', name: 'Ideas — eksport serwerowy → Outputs', chain: 'M05→M17', status: 'partial',
    targetTables: ['idea_exports'],
    anchors: [
      { file: 'server/src/services/finalBatchService.ts', needle: 'requestAndGenerateExport' },
      { file: 'server/src/services/finalBatchService.ts', needle: 'idea_exports' },
    ],
    note: 'PARTIAL: json/markdown generowane realnie (storage seam) za flagą IDEA_SERVER_EXPORT_ENABLED (default OFF, decyzja #9/DP-5); png/svg/pdf/… nadal wymagają client canvas → 501 zamiast fałszywego sukcesu',
  },
  {
    id: 'B9', name: 'Tabele Studio governed → Results/Finance/Execution', chain: 'M20→M15/M16/M14', status: 'stub',
    targetTables: ['tp_module_sync_results'],
    anchors: [
      { file: 'server/src/services/tablePlatform/ModuleSyncService.ts', needle: 'syncToModule' },
      { file: 'server/src/services/tablePlatform/ModuleSyncService.ts', needle: 'tp_module_sync_results' },
    ],
    note: 'STUB: pisze tylko metadane, 0 czytelników; przycisk neutralizowany (decyzja #6)',
  },
  {
    id: 'B11', name: 'Meeting → decyzje/akcje → My Work', chain: 'M21→M03', status: 'partial',
    anchors: [
      { file: 'server/src/services/meetingService.ts', needle: 'meeting_follow_ups' },
    ],
    note: 'LOKALNY: nie trafia do globalnych tasks/decisions (decyzja #8 — odłożona)',
  },
  {
    id: 'B13', name: 'Organizacja → kontekst Teresy', chain: 'M23→M01', status: 'partial',
    anchors: [{ file: 'server/src/routes/organization-context-store.routes.ts', needle: 'organization_context' }],
    note: 'Profil DZIAŁA; Goals/Challenges/Strategy localStorage',
  },
  {
    id: 'B16', name: 'Kontekst encji → czat split', chain: 'wszystkie→M01', status: 'works',
    anchors: [{ file: 'src/hooks/useOpenChatWithContext.ts', needle: 'workspaceContext' }],
  },
  {
    id: 'B17', name: 'Mind Map sidekick → Teresa', chain: 'M06→M01', status: 'partial',
    anchors: [{ file: 'src/components/MyWork/mindmap/useMindMapQuickActions.ts', needle: 'onOpenChat' }],
    note: 'sidekick context lokalny w toolbarze, nie przez useOpenChatWithContext',
  },
  {
    id: 'B19', name: 'Ideas Table → Prezentacje deck', chain: 'M08→M19', status: 'works',
    targetTables: ['presentation_decks'],
    anchors: [
      { file: 'server/src/routes/presentations.routes.ts', needle: 'presentation_decks' },
    ],
  },
  {
    id: 'B20', name: 'AI OS waves → M01/M02/M13/M17/M20', chain: 'M22→*', status: 'works',
    anchors: [{ file: 'server/src/services/v8/artifactRegistryService.ts', needle: 'registerArtifactOrigin' }],
  },
];

// Runnable report: prints the cross-module flow matrix.
import { pathToFileURL } from 'url';

const isMain = import.meta.url === pathToFileURL(process.argv[1] || '').href;
if (isMain) {
  const icon = (s: FlowStatus) => (s === 'works' ? '✅' : s === 'partial' ? '🟡' : '🔴');
  const counts = { works: 0, partial: 0, stub: 0 };
  // eslint-disable-next-line no-console
  console.log('Harvard cross-module flows (INTEGRACJE §B):\n');
  for (const f of FLOWS) {
    counts[f.status]++;
    // eslint-disable-next-line no-console
    console.log(`${icon(f.status)} ${f.id.padEnd(4)} ${f.chain.padEnd(22)} ${f.name}${f.note ? `  — ${f.note}` : ''}`);
  }
  // eslint-disable-next-line no-console
  console.log(`\n${counts.works} works · ${counts.partial} partial · ${counts.stub} stub  (of ${FLOWS.length})`);
}
