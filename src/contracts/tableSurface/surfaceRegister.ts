/**
 * MAPA T01–T45 → oczekiwany adapter i konfiguracja.
 *
 * To jest deliverable R00 „mapowanie T01–T45 → adapter/konfiguracja"
 * (`REPAIR_MASTER_PLAN.md`, Fala 0 / R00).
 *
 * ŹRÓDŁA (oba read-only dla wykonawców, bramka „brak modyfikacji dokumentacji
 * audytu wejściowego"):
 *  · `evidence/table-audit-45-2026-08-05/MATRIX_T01_T45.csv` — mianownik 45,
 *    `module`, `surface` i uzasadnienie werdyktu; to jest SSOT tożsamości powierzchni;
 *  · `docs/ui-standards/CONSULTIFY_SURFACE_REGISTER_2026-08-04.csv` — kolumna
 *    `class` (TABLE / TABLE_TOOL / TABLE_DASHBOARD / DASHBOARD), z której
 *    wyprowadzony jest `adapter`;
 *  · `evidence/table-audit-45-2026-08-05/REPAIR_WORK_PACKAGES.csv` — `ownerPackage`.
 *
 * CO TA MAPA OPISUJE: stan OCZEKIWANY po naprawie oraz pakiet, który ma go
 * dowieźć. NIE opisuje stanu bieżącego — ten żyje w `MATRIX_T01_T45.csv`.
 *
 * CZEGO NIE ROBI: nie renderuje, nie migruje i nie zmienia żadnego ekranu.
 * R00 zamraża kontrakt; T01–T45 migrują w falach R10–R28.
 *
 * `Record<TableSurfaceId, TableSurfaceContract>` wymusza KOMPLET 45 wpisów na
 * poziomie kompilacji — powierzchnia dopisana do unionu bez wpisu tutaj nie
 * przejdzie `tsc`. Ten sam mechanizm, którym `src/components/standard/registry.ts`
 * pilnuje siedmiu kart N.
 *
 * @module contracts/tableSurface/surfaceRegister
 */

import type {
  RepairPackageId,
  TableAdapterKind,
  TableColumnContract,
  TableSurfaceCapabilities,
  TableSurfaceContract,
  TableSurfaceId,
  TableSurfaceModule,
} from './types';

/** Wejście buildera — pola bez sensownej wartości domyślnej. */
interface SurfaceInput {
  module: TableSurfaceModule;
  surface: string;
  entity: string;
  adapter: TableAdapterKind;
  ownerPackage: RepairPackageId;
  persistKey: string;
  columns: TableColumnContract;
  selection?: 'bulk' | 'none';
  selectionNoneReason?: string;
  edit?: TableSurfaceCapabilities['edit'];
  archive?: TableSurfaceCapabilities['archive'];
  delete?: TableSurfaceCapabilities['delete'];
  deleteLockReason?: string;
  dueDate?: boolean;
  contextTransitions?: string[];
  viewModes?: TableSurfaceCapabilities['viewModes'];
  menu3Presets?: string[];
  bulkActions?: string[];
  relocateFromList?: string[];
}

/**
 * Buduje wpis, uzupełniając domyślne wartości kanonicznego rejestru.
 *
 * Domyślne `selection: 'bulk'` jest celowe: §10 czyni bulk regułą, a `none`
 * wyjątkiem wymagającym uzasadnienia. Domyślne `viewModes: ['list']` też —
 * segment przełącznika w Menu 2 renderuje się dopiero od dwóch widoków (§3),
 * więc jeden widok oznacza „brak segmentu", a nie „brak deklaracji".
 */
function defineSurface(id: TableSurfaceId, input: SurfaceInput): TableSurfaceContract {
  const selection = input.selection ?? 'bulk';
  return {
    id,
    module: input.module,
    surface: input.surface,
    adapter: input.adapter,
    ownerPackage: input.ownerPackage,
    requiresNewRegistry: input.adapter === 'missing-register',
    relocateFromList: input.relocateFromList,
    capabilities: {
      id,
      entity: input.entity,
      hasTable: true,
      selection,
      selectionNoneReason: input.selectionNoneReason,
      preview: true,
      fullOpen: true,
      edit: input.edit ?? 'supported',
      archive: input.archive ?? 'supported',
      delete: input.delete ?? 'supported',
      deleteLockReason: input.deleteLockReason,
      dueDate: input.dueDate ?? false,
      contextTransitions: input.contextTransitions ?? [],
      viewModes: input.viewModes ?? ['list'],
      menu3Presets: input.menu3Presets ?? ['all'],
      bulkActions: input.bulkActions ?? (selection === 'bulk' ? ['archive', 'delete'] : []),
      persistKey: input.persistKey,
      columns: input.columns,
    },
  };
}

/**
 * Kanoniczny rejestr 45 powierzchni.
 *
 * Uwaga do `ownerPackage`: `REPAIR_WORK_PACKAGES.csv` przypisuje R22 zakres
 * „T15-T20", a R23 „T21-T24", podczas gdy `MATRIX_T01_T45.csv` klasyfikuje T20
 * jako Assessment / Library. Rozbieżność jest w dokumentach wejściowych, których
 * R00 nie wolno modyfikować. Rozstrzygam na korzyść MATRIX (SSOT tożsamości
 * powierzchni): T20 → R23. Zgłoszone w KNOWN_LIMITATIONS raportu R00.
 */
export const TABLE_SURFACE_REGISTER: Readonly<Record<TableSurfaceId, TableSurfaceContract>> = {
  // ── My Work ───────────────────────────────────────────────────────────────
  T01: defineSurface('T01', {
    module: 'My Work',
    surface: 'Ideas',
    entity: 'idea',
    adapter: 'register',
    ownerPackage: 'R20',
    persistKey: 'my-work.ideas',
    archive: 'not-applicable',
    contextTransitions: ['whiteboard', 'mind-map', 'process-flow', 'table', 'initiative'],
    menu3Presets: ['all', 'mine', 'promoted'],
    bulkActions: ['assign', 'delete'],
    columns: {
      identifier: 'title',
      required: ['status', 'owner', 'updatedAt'],
      optional: ['source', 'tags'],
      availableInPreview: ['description', 'relations'],
    },
  }),
  T02: defineSurface('T02', {
    module: 'My Work',
    surface: 'Notebook',
    entity: 'note',
    adapter: 'register-with-tool',
    ownerPackage: 'R20',
    persistKey: 'my-work.notebook',
    contextTransitions: ['document', 'initiative'],
    menu3Presets: ['all', 'mine'],
    bulkActions: ['archive', 'delete'],
    relocateFromList: [],
    columns: {
      identifier: 'title',
      required: ['status', 'owner', 'updatedAt'],
      optional: ['sourceCount'],
      availableInPreview: ['excerpt', 'sources'],
    },
  }),
  T03: defineSurface('T03', {
    module: 'My Work',
    surface: 'Inbox',
    entity: 'inbox-item',
    adapter: 'register',
    ownerPackage: 'R20',
    persistKey: 'my-work.inbox',
    dueDate: true,
    contextTransitions: ['task', 'decision'],
    menu3Presets: ['all', 'unread', 'assigned', 'overdue'],
    bulkActions: ['mark-read', 'assign', 'archive'],
    columns: {
      identifier: 'subject',
      required: ['type', 'status', 'from', 'receivedAt'],
      optional: ['priority', 'dueDate'],
      availableInPreview: ['body', 'relations'],
    },
  }),
  T04: defineSurface('T04', {
    module: 'My Work',
    surface: 'Calendar',
    entity: 'calendar-entry',
    // R17 — dziś narzędzie kalendarza zamiast rejestru; kolumny kontekstowe
    // (identyfikator, czas, status, źródło, właściciel, akcje) trzeba dodać,
    // a narzędzia usunąć z widoku listy.
    adapter: 'semantic-gap',
    ownerPackage: 'R17',
    persistKey: 'my-work.calendar',
    dueDate: true,
    viewModes: ['list', 'calendar'],
    menu3Presets: ['today', 'week', 'overdue'],
    bulkActions: ['reschedule', 'delete'],
    columns: {
      identifier: 'title',
      required: ['startsAt', 'status', 'source', 'owner'],
      optional: ['duration', 'location'],
      availableInPreview: ['agenda', 'participants'],
    },
  }),
  T05: defineSurface('T05', {
    module: 'My Work',
    surface: 'Tasks',
    entity: 'task',
    adapter: 'register',
    ownerPackage: 'R20',
    persistKey: 'my-work.tasks',
    dueDate: true,
    viewModes: ['list', 'kanban'],
    contextTransitions: ['decision', 'initiative'],
    menu3Presets: ['all', 'mine', 'overdue', 'blocked'],
    bulkActions: ['assign', 'change-status', 'delete'],
    columns: {
      identifier: 'title',
      required: ['status', 'priority', 'assignee', 'dueDate'],
      optional: ['initiative', 'updatedAt'],
      availableInPreview: ['description', 'relations'],
    },
  }),
  T06: defineSurface('T06', {
    module: 'My Work',
    surface: 'Decisions',
    entity: 'decision',
    adapter: 'register',
    ownerPackage: 'R20',
    persistKey: 'my-work.decisions',
    dueDate: true,
    contextTransitions: ['task', 'initiative'],
    menu3Presets: ['all', 'pending', 'approved', 'rejected'],
    bulkActions: ['assign', 'delegate', 'delete'],
    columns: {
      identifier: 'title',
      required: ['status', 'priority', 'owner', 'dueDate'],
      optional: ['initiative', 'decidedAt'],
      availableInPreview: ['rationale', 'relations'],
    },
  }),
  T07: defineSurface('T07', {
    module: 'My Work',
    surface: 'Client Vault',
    entity: 'vault-document',
    adapter: 'register-with-tool',
    ownerPackage: 'R20',
    persistKey: 'my-work.client-vault',
    // Sejf jest tworzony automatycznie z kontekstu klienta — usunięcie wpisu
    // ręcznie nie jest dozwolone. Powód zapisany tu, NIGDY w etykiecie menu (§7).
    delete: 'business-locked',
    deleteLockReason: 'Vault entries are provisioned automatically and cannot be deleted manually.',
    archive: 'not-applicable',
    menu3Presets: ['all', 'indexed', 'pending'],
    bulkActions: ['reindex', 'download'],
    columns: {
      identifier: 'name',
      required: ['format', 'indexStatus', 'size', 'uploadedAt'],
      optional: ['owner'],
      availableInPreview: ['summary', 'relations'],
    },
  }),
  T08: defineSurface('T08', {
    module: 'My Work',
    surface: 'Run agent',
    entity: 'agent-run',
    adapter: 'register-with-tool',
    ownerPackage: 'R20',
    persistKey: 'my-work.run-agent',
    edit: 'permission-dependent',
    archive: 'not-applicable',
    menu3Presets: ['all', 'running', 'failed'],
    bulkActions: ['cancel', 'delete'],
    columns: {
      identifier: 'name',
      required: ['status', 'startedAt', 'duration', 'owner'],
      optional: ['stepCount'],
      availableInPreview: ['summary', 'relations'],
    },
  }),

  // ── Interview ─────────────────────────────────────────────────────────────
  T09: defineSurface('T09', {
    module: 'Interview',
    surface: 'Inbox',
    entity: 'interview-invitation',
    adapter: 'register',
    ownerPackage: 'R21',
    persistKey: 'interview.inbox',
    dueDate: true,
    menu3Presets: ['all', 'pending', 'answered'],
    bulkActions: ['remind', 'archive'],
    columns: {
      identifier: 'subject',
      required: ['status', 'respondent', 'sentAt', 'dueDate'],
      optional: ['template'],
      availableInPreview: ['summary', 'relations'],
    },
  }),
  T10: defineSurface('T10', {
    module: 'Interview',
    surface: 'Sessions or Processes',
    entity: 'interview-session',
    adapter: 'register-with-tool',
    ownerPackage: 'R21',
    persistKey: 'interview.sessions',
    menu3Presets: ['all', 'active', 'finished'],
    bulkActions: ['archive', 'delete'],
    columns: {
      identifier: 'title',
      required: ['status', 'progress', 'owner', 'startedAt'],
      optional: ['template'],
      availableInPreview: ['summary', 'relations'],
    },
  }),
  T11: defineSurface('T11', {
    module: 'Interview',
    surface: 'Assigned',
    entity: 'assigned-study',
    adapter: 'register',
    ownerPackage: 'R21',
    persistKey: 'interview.assigned',
    dueDate: true,
    menu3Presets: ['all', 'mine', 'overdue'],
    bulkActions: ['remind', 'reassign'],
    columns: {
      identifier: 'title',
      required: ['status', 'assignee', 'dueDate', 'progress'],
      optional: ['initiative'],
      availableInPreview: ['description', 'relations'],
    },
  }),
  T12: defineSurface('T12', {
    module: 'Interview',
    surface: 'Templates',
    entity: 'interview-template',
    adapter: 'register-with-tool',
    ownerPackage: 'R21',
    persistKey: 'interview.templates',
    menu3Presets: ['all', 'published', 'draft'],
    bulkActions: ['duplicate', 'archive'],
    columns: {
      identifier: 'name',
      required: ['status', 'questionCount', 'owner', 'updatedAt'],
      optional: ['category'],
      availableInPreview: ['description', 'relations'],
    },
  }),
  T13: defineSurface('T13', {
    module: 'Interview',
    surface: 'Insights',
    entity: 'insight',
    adapter: 'register-with-tool',
    ownerPackage: 'R21',
    persistKey: 'interview.insights',
    contextTransitions: ['initiative', 'report'],
    menu3Presets: ['all', 'confirmed', 'draft'],
    bulkActions: ['promote', 'archive'],
    columns: {
      identifier: 'title',
      required: ['status', 'confidence', 'source', 'createdAt'],
      optional: ['owner'],
      availableInPreview: ['summary', 'evidence'],
    },
  }),
  T14: defineSurface('T14', {
    module: 'Interview',
    surface: 'Initiatives',
    entity: 'initiative',
    adapter: 'register-with-tool',
    ownerPackage: 'R21',
    persistKey: 'interview.initiatives',
    menu3Presets: ['all', 'proposed', 'accepted'],
    bulkActions: ['assign', 'archive'],
    columns: {
      identifier: 'title',
      required: ['status', 'owner', 'impact', 'createdAt'],
      optional: ['source'],
      availableInPreview: ['description', 'relations'],
    },
  }),

  // ── Consulting Tools ──────────────────────────────────────────────────────
  T15: defineSurface('T15', {
    module: 'Consulting Tools',
    surface: 'Library',
    entity: 'tool',
    adapter: 'register-with-tool',
    ownerPackage: 'R22',
    persistKey: 'tools.library',
    edit: 'permission-dependent',
    archive: 'not-applicable',
    delete: 'business-locked',
    deleteLockReason: 'Catalogue tools are platform-owned and cannot be deleted by tenants.',
    viewModes: ['list', 'grid'],
    menu3Presets: ['all', 'licensed', 'available'],
    bulkActions: ['add-to-process'],
    columns: {
      identifier: 'name',
      required: ['category', 'status', 'owner'],
      optional: ['lastUsedAt'],
      availableInPreview: ['purpose', 'relations'],
    },
  }),
  T16: defineSurface('T16', {
    module: 'Consulting Tools',
    surface: 'Sessions or Processes',
    entity: 'tool-process',
    adapter: 'register-with-tool',
    ownerPackage: 'R22',
    persistKey: 'tools.processes',
    menu3Presets: ['all', 'running', 'finished'],
    bulkActions: ['archive', 'delete'],
    columns: {
      identifier: 'name',
      required: ['tool', 'status', 'progress', 'startedAt'],
      optional: ['owner'],
      availableInPreview: ['summary', 'relations'],
    },
  }),
  T17: defineSurface('T17', {
    module: 'Consulting Tools',
    surface: 'Outputs',
    entity: 'tool-output',
    adapter: 'register-with-tool',
    ownerPackage: 'R22',
    persistKey: 'tools.outputs',
    contextTransitions: ['report', 'presentation', 'initiative'],
    menu3Presets: ['all', 'accepted', 'draft'],
    bulkActions: ['export', 'archive'],
    columns: {
      identifier: 'title',
      required: ['type', 'status', 'source', 'createdAt'],
      optional: ['owner'],
      availableInPreview: ['summary', 'relations'],
    },
  }),
  T18: defineSurface('T18', {
    module: 'Consulting Tools',
    surface: 'Reports',
    entity: 'tool-report',
    adapter: 'register-with-tool',
    ownerPackage: 'R22',
    persistKey: 'tools.reports',
    contextTransitions: ['presentation', 'document'],
    menu3Presets: ['all', 'published', 'draft'],
    bulkActions: ['export', 'archive'],
    columns: {
      identifier: 'title',
      required: ['status', 'format', 'owner', 'updatedAt'],
      optional: ['source'],
      availableInPreview: ['summary', 'relations'],
    },
  }),
  T19: defineSurface('T19', {
    module: 'Consulting Tools',
    surface: 'Initiatives',
    entity: 'initiative',
    adapter: 'register-with-tool',
    ownerPackage: 'R22',
    persistKey: 'tools.initiatives',
    menu3Presets: ['all', 'proposed', 'accepted'],
    bulkActions: ['assign', 'archive'],
    columns: {
      identifier: 'title',
      required: ['status', 'owner', 'impact', 'createdAt'],
      optional: ['source'],
      availableInPreview: ['description', 'relations'],
    },
  }),

  // ── Assessment ────────────────────────────────────────────────────────────
  T20: defineSurface('T20', {
    module: 'Assessment',
    surface: 'Library',
    entity: 'assessment-model',
    adapter: 'register-with-tool',
    ownerPackage: 'R23',
    persistKey: 'assessment.library',
    edit: 'permission-dependent',
    archive: 'not-applicable',
    delete: 'business-locked',
    deleteLockReason: 'Assessment models (DRD, SIRI, ADMA, CMMI, Lean) are platform-owned.',
    viewModes: ['list', 'grid'],
    menu3Presets: ['all', 'available', 'planned'],
    bulkActions: ['start-assessment'],
    columns: {
      identifier: 'name',
      required: ['framework', 'status', 'dimensions'],
      optional: ['lastUsedAt'],
      availableInPreview: ['purpose', 'relations'],
    },
  }),
  T21: defineSurface('T21', {
    module: 'Assessment',
    surface: 'Processes',
    entity: 'assessment-process',
    adapter: 'register-with-tool',
    ownerPackage: 'R23',
    persistKey: 'assessment.processes',
    menu3Presets: ['all', 'running', 'finished'],
    bulkActions: ['archive', 'delete'],
    columns: {
      identifier: 'name',
      required: ['model', 'status', 'progress', 'owner'],
      optional: ['startedAt'],
      availableInPreview: ['summary', 'relations'],
    },
  }),
  T22: defineSurface('T22', {
    module: 'Assessment',
    surface: 'Outputs',
    entity: 'assessment-output',
    // R10 — repaired against the truthful assessment_report artifact registry.
    adapter: 'register',
    ownerPackage: 'R10',
    persistKey: 'assessment.outputs',
    selection: 'none',
    selectionNoneReason:
      'Assessment report artifacts currently expose no truthful bulk mutation or export endpoint.',
    edit: 'not-applicable',
    archive: 'not-applicable',
    delete: 'business-locked',
    deleteLockReason:
      'The artifact registry does not provide deletePath for assessment_report artifacts.',
    contextTransitions: [],
    menu3Presets: ['all'],
    bulkActions: [],
    columns: {
      identifier: 'resolvedTitle',
      required: ['outputType', 'deliveryState', 'ownerName', 'lastTransitionAt'],
      availableInPreview: ['details'],
    },
  }),
  T23: defineSurface('T23', {
    module: 'Assessment',
    surface: 'Reports',
    entity: 'assessment-report',
    adapter: 'register-with-tool',
    ownerPackage: 'R23',
    persistKey: 'assessment.reports',
    contextTransitions: ['presentation', 'initiative'],
    menu3Presets: ['all', 'published', 'draft'],
    bulkActions: ['export', 'archive'],
    columns: {
      identifier: 'title',
      required: ['status', 'format', 'owner', 'updatedAt'],
      optional: ['process'],
      availableInPreview: ['summary', 'relations'],
    },
  }),
  T24: defineSurface('T24', {
    module: 'Assessment',
    surface: 'Initiatives',
    entity: 'initiative',
    adapter: 'register-with-tool',
    ownerPackage: 'R23',
    persistKey: 'assessment.initiatives',
    menu3Presets: ['all', 'proposed', 'accepted'],
    bulkActions: ['assign', 'archive'],
    columns: {
      identifier: 'title',
      required: ['status', 'owner', 'impact', 'createdAt'],
      optional: ['source'],
      availableInPreview: ['description', 'relations'],
    },
  }),

  // ── Initiatives ───────────────────────────────────────────────────────────
  T25: defineSurface('T25', {
    module: 'Initiatives',
    surface: 'Portfolio',
    entity: 'initiative',
    adapter: 'register-with-tool',
    ownerPackage: 'R24',
    persistKey: 'initiatives.portfolio',
    dueDate: true,
    viewModes: ['list', 'kanban', 'timeline'],
    contextTransitions: ['execution', 'report'],
    menu3Presets: ['all', 'active', 'at-risk', 'done'],
    bulkActions: ['assign', 'change-status', 'archive'],
    columns: {
      identifier: 'title',
      required: ['status', 'owner', 'impact', 'dueDate'],
      optional: ['budget', 'phase'],
      availableInPreview: ['description', 'relations'],
    },
  }),
  T26: defineSurface('T26', {
    module: 'Initiatives',
    surface: 'Analysis',
    entity: 'initiative',
    // R13 — repaired: rows are the real PortfolioInitiative[] already passed
    // to PortfolioAnalysisView (name/status/priority/axis/updatedAt); no
    // endpoint returns a distinct "initiative-analysis" entity with a
    // score field. export/archive never existed for this surface — it is
    // read-only, one canonical layer over the same initiatives the five
    // analysis subviews (relocated below it) already derive their own
    // per-lens rows from.
    adapter: 'register',
    ownerPackage: 'R13',
    persistKey: 'initiatives.analysis',
    selection: 'none',
    selectionNoneReason:
      'Analysis is a read-only quality-gate view over initiatives; no bulk export/archive ' +
      'endpoint exists for this surface.',
    edit: 'not-applicable',
    archive: 'not-applicable',
    delete: 'business-locked',
    deleteLockReason: 'No delete endpoint is exposed for initiatives via the Analysis surface.',
    menu3Presets: ['all'],
    bulkActions: [],
    relocateFromList: ['kpi-cards', 'portfolio-charts'],
    columns: {
      identifier: 'name',
      required: ['status', 'priority', 'axis', 'updatedAt'],
    },
  }),
  T27: defineSurface('T27', {
    module: 'Initiatives',
    surface: 'Observability',
    entity: 'initiative',
    // R11 — repaired against the real getInitiatives()/getLineage() responses.
    // The old columns (initiative/severity/detectedAt) described a
    // "observability signal" entity that no endpoint has ever returned;
    // funnel/lineage are aggregates, not per-row signals. The canonical
    // table's real rows are initiatives themselves (InitiativeController.ts
    // getInitiatives, id/name/status/priority/area/updatedAt confirmed on
    // the live handler), previewed via the real per-id lineage chain.
    adapter: 'register',
    ownerPackage: 'R11',
    persistKey: 'initiatives.observability',
    selection: 'none',
    selectionNoneReason:
      'Observability derives read-only signals from the initiative list and lineage chain; ' +
      'no acknowledge/archive endpoint exists for this surface — mutation happens on the ' +
      'Portfolio tab.',
    edit: 'not-applicable',
    archive: 'not-applicable',
    delete: 'business-locked',
    deleteLockReason:
      'No delete endpoint is exposed for initiatives via the Observability surface.',
    menu3Presets: ['all'],
    bulkActions: [],
    relocateFromList: ['observability-dashboard'],
    columns: {
      identifier: 'name',
      required: ['status', 'priority', 'area', 'updatedAt'],
      optional: ['riskLevel'],
      availableInPreview: ['lineage'],
    },
  }),
  T28: defineSurface('T28', {
    module: 'Initiatives',
    surface: 'Candidates',
    entity: 'initiative-candidate',
    // R11 — repaired: real columns match InitiativeCandidate (mapRow,
    // initiativeCandidateService.ts) exactly. promote/reject never existed;
    // the real transitions are accept/dismiss (initiativeCandidates.routes.ts).
    adapter: 'register',
    ownerPackage: 'R11',
    persistKey: 'initiatives.candidates',
    selection: 'none',
    selectionNoneReason:
      'Accept/Dismiss are per-candidate decisions with no true multi-candidate bulk endpoint; ' +
      'sequential bulk with honest partial-failure accounting was out of scope for this package.',
    edit: 'not-applicable',
    archive: 'not-applicable',
    delete: 'business-locked',
    deleteLockReason:
      'No delete endpoint exists for candidates — only accept and dismiss transitions.',
    contextTransitions: ['initiative'],
    menu3Presets: ['all'],
    bulkActions: [],
    relocateFromList: ['candidates-scan-tool'],
    columns: {
      identifier: 'title',
      required: ['sourceType', 'status', 'fitScore', 'createdAt'],
      availableInPreview: ['rationale'],
    },
  }),
  T29: defineSurface('T29', {
    module: 'Initiatives',
    surface: 'Portfolio health',
    entity: 'initiative',
    // R11 — repaired: healthStatus/trend/owner/evaluatedAt never existed on
    // any response. `readyToLaunch` (id/title/status) is the only per-
    // initiative identity array in the portfolio-health aggregate
    // (portfolioAnalysisService.ts PortfolioHealth); coverage/balance/
    // duplicateClusters/byStatus stay in the preserved dashboard.
    adapter: 'register',
    ownerPackage: 'R11',
    persistKey: 'initiatives.portfolio-health',
    selection: 'none',
    selectionNoneReason:
      'Portfolio health is a read-only aggregate view (GET /api/initiatives/portfolio-health); ' +
      'no bulk assign/export endpoint exists for its ready-to-launch entries.',
    edit: 'not-applicable',
    archive: 'not-applicable',
    delete: 'business-locked',
    deleteLockReason:
      'No delete endpoint exists for portfolio-health entries — mutation happens on the Portfolio tab.',
    menu3Presets: ['all'],
    bulkActions: [],
    relocateFromList: ['portfolio-health-dashboard'],
    columns: {
      identifier: 'title',
      required: ['status'],
    },
  }),
  T30: defineSurface('T30', {
    module: 'Initiatives',
    surface: 'Goals',
    entity: 'goal',
    // T30-GOALS-R13-CORRECTION — R13's "no real API" finding was wrong: a
    // real, fully-functional Goal CRUD API is mounted at
    // /initiatives-v4/goals (goalsCreate/goalsGet/goalsGetOne/goalsUpdate/
    // goalsGetRollup/goalsLinkInitiative/goalsGetInitiatives/
    // goalsUnlinkInitiative, src/services/api.ts) — Results/
    // ResultsKpiScorecardsView.tsx already consumes it. This surface (the
    // Initiatives-module Goals tab) genuinely didn't exist and has now been
    // built (InitiativesGoalsTable.tsx) directly on that real contract.
    // goalsUpdate (PUT) exists but no edit form is built into this
    // canonical layer, so edit stays not-applicable; no delete endpoint
    // exists in the goals API at all.
    adapter: 'register',
    ownerPackage: 'R13',
    persistKey: 'initiatives.goals',
    selection: 'none',
    selectionNoneReason:
      'No bulk mutation endpoint exists for goals — only single-record goalsUpdate.',
    edit: 'not-applicable',
    archive: 'not-applicable',
    delete: 'business-locked',
    deleteLockReason: 'No delete endpoint exists in the goals API.',
    menu3Presets: ['all'],
    bulkActions: [],
    relocateFromList: [],
    columns: {
      identifier: 'title',
      required: ['status', 'ownerId', 'targetValue', 'endDate'],
      optional: ['progress'],
    },
  }),

  // ── Execution ─────────────────────────────────────────────────────────────
  T31: defineSurface('T31', {
    module: 'Execution',
    surface: 'Dashboard',
    entity: 'initiative',
    // R14 preflight: "Dashboard" has no dedicated activeTab — the tabs array
    // (ExecutionHub.tsx) has no 'dashboard' id. The runtime that matches
    // T31's real column/action claims is the 'list' ("Portfolio") tab's
    // StandardTable, which ALREADY has real kebab (buildInitiativeRowMenu),
    // real selection+bulk (summarySelectedIds/handleBulkStatusChange, looped
    // governed PATCH /initiatives/:id/status), and real preview — none of
    // T31's audit claims ("No kebab/selection/preview exists") hold against
    // current source. T31 and T32 point at the SAME runtime host; this is a
    // stale/duplicate audit mapping, not two distinct surfaces — flagged for
    // Codex, not silently merged. No UI built for T31 specifically.
    adapter: 'register',
    ownerPackage: 'R14',
    persistKey: 'execution.dashboard',
    dueDate: true,
    selection: 'bulk',
    edit: 'permission-dependent',
    archive: 'not-applicable',
    delete: 'business-locked',
    deleteLockReason: 'No delete endpoint exists for initiatives via this surface.',
    menu3Presets: ['all'],
    bulkActions: ['change-status'],
    relocateFromList: [],
    columns: {
      identifier: 'name',
      required: ['type', 'status', 'assignee', 'due'],
      optional: ['progress', 'tasks', 'alerts'],
    },
  }),
  T32: defineSurface('T32', {
    module: 'Execution',
    surface: 'Summary',
    entity: 'initiative',
    // R14 — repaired: same real 'list' tab runtime as T31 (see its comment).
    // The one genuinely current P0 defect (TABLE-T13: EVM/what-if analytics
    // panels — ExecutionIntelligencePanel/ExecutionChangeSignalsPanel/
    // ExecutionWhatIfSandbox — preceding the table) is fixed: relocated
    // below the table+preview block, flag-gated content unchanged.
    adapter: 'register',
    ownerPackage: 'R14',
    persistKey: 'execution.summary',
    dueDate: true,
    selection: 'bulk',
    edit: 'permission-dependent',
    archive: 'not-applicable',
    delete: 'business-locked',
    deleteLockReason: 'No delete endpoint exists for initiatives via this surface.',
    menu3Presets: ['all'],
    bulkActions: ['change-status'],
    relocateFromList: ['intelligence-panel', 'change-signals-panel', 'what-if-sandbox'],
    columns: {
      identifier: 'name',
      required: ['type', 'status', 'assignee', 'due'],
      optional: ['progress', 'tasks', 'alerts'],
    },
  }),
  T33: defineSurface('T33', {
    module: 'Execution',
    surface: 'Rollout',
    entity: 'rollout-item',
    // R14 preflight (adapter/columns NOT changed — no implementation touched
    // RolloutTab.tsx, so no mechanical reconciliation is justified yet):
    // TABLE-T13 ("resolves to Summary's EVM/what-if composition") appears
    // STALE — RolloutTab.tsx renders a genuinely distinct component with its
    // own 5 real subviews (Plan/KPI/Risks/Change/Closure) backed by real
    // /api/rollout/* data via FilterableTable, not the Summary/list content.
    // TABLE-T14 (routing: "Summary tab remains selected after clicking
    // Rollout") was investigated, not reproduced: handleMainTabChange and
    // the tab-deep-link effect both correctly set activeTab='rollout'. One
    // real, source-provable finding: BOTH history-sync effects call
    // `setSearchParams(next, { replace: true })` (lines ~869, ~909) for
    // every tab/view/document change, so browser back/forward does not
    // step through tab history at all — a real but broad, shared mechanism
    // affecting every tab, not rollout-specific. Too large a change (and
    // too much blast radius on list/reports/people_change, out of this
    // package's scope) to blind-fix here; left untouched and reported as an
    // open blocker for a dedicated, narrowly-scoped follow-up.
    adapter: 'contaminated-register',
    ownerPackage: 'R14',
    persistKey: 'execution.rollout',
    dueDate: true,
    menu3Presets: ['all', 'planned', 'in-progress', 'done'],
    bulkActions: ['assign', 'change-status'],
    relocateFromList: ['master-plan-kpi-cards', 'risk-matrix', 'change-checklists'],
    columns: {
      identifier: 'title',
      required: ['phase', 'status', 'owner', 'dueDate'],
      optional: ['risk'],
      availableInPreview: ['description', 'relations'],
    },
  }),
  T34: defineSurface('T34', {
    module: 'Execution',
    surface: 'Reporting',
    entity: 'execution-report',
    adapter: 'register-with-tool',
    ownerPackage: 'R25',
    persistKey: 'execution.reporting',
    contextTransitions: ['presentation', 'document'],
    menu3Presets: ['all', 'published', 'draft'],
    bulkActions: ['export', 'archive'],
    columns: {
      identifier: 'title',
      required: ['status', 'period', 'owner', 'updatedAt'],
      optional: ['format'],
      availableInPreview: ['summary', 'relations'],
    },
  }),
  T35: defineSurface('T35', {
    module: 'Execution',
    surface: 'Management',
    entity: 'management-lane',
    // R12 — repaired: rows are the six real management lanes
    // (managerLaneCounts: action-queue/decisions/blockers/risk/workload/
    // people-change), not a "management-item" with type/owner/dueDate — no
    // endpoint or panel returns that shape. assign/change-status never
    // existed; the one real row action is opening the lane's existing
    // ManagerModuleView subview. BenefitsRegisterPanel (real GET/POST
    // /api/benefits-register/benefits) stays a separate, preserved tool,
    // not merged into this table's rows.
    adapter: 'register',
    ownerPackage: 'R12',
    persistKey: 'execution.management',
    selection: 'none',
    selectionNoneReason:
      'Lanes are a fixed taxonomy of six areas, not individually owned/assignable/deletable ' +
      'records; no bulk mutation endpoint exists for them.',
    edit: 'not-applicable',
    archive: 'not-applicable',
    delete: 'business-locked',
    deleteLockReason: 'Lanes are a fixed taxonomy — there is nothing to delete.',
    menu3Presets: ['all'],
    bulkActions: [],
    relocateFromList: ['six-management-summaries', 'benefits-register-card'],
    columns: {
      identifier: 'label',
      required: ['total', 'critical', 'warning'],
    },
  }),

  // ── Results ───────────────────────────────────────────────────────────────
  T36: defineSurface('T36', {
    module: 'Results',
    surface: 'KPI Scorecards',
    entity: 'goal',
    // R15 — repaired: rows are real Goal records (Api.goalsGet() → GET
    // /initiatives-v4/goals; goal_type scorecard/key_result/objective), the
    // same persisted entity ResultsKpiScorecardsView.tsx already consumes —
    // not flat KPI catalog rows, not a fictional "kpi-scorecard" merge.
    // goalsUpdate (PUT) exists server-side but no edit form is wired into
    // this canonical layer, so edit stays not-applicable here; there is no
    // delete endpoint in the goals API at all.
    adapter: 'register',
    ownerPackage: 'R15',
    persistKey: 'results.kpi-scorecards',
    selection: 'none',
    selectionNoneReason:
      'No bulk mutation endpoint exists for goals — only single-record goalsUpdate.',
    edit: 'not-applicable',
    archive: 'not-applicable',
    delete: 'business-locked',
    deleteLockReason: 'No delete endpoint exists in the goals API.',
    menu3Presets: ['all'],
    bulkActions: [],
    relocateFromList: ['kpi-summary-cards'],
    columns: {
      identifier: 'title',
      required: ['goalType', 'status', 'progress', 'rollupProgress'],
    },
  }),
  T37: defineSurface('T37', {
    module: 'Results',
    surface: 'ROI Reviews',
    entity: 'initiative',
    // R15 — repaired: rows are the real `ROIInitiativeItem[]` from the
    // portfolio-summary endpoint (V8ResultsApi.getRoiPortfolioSummary(),
    // falling back to GET /benefits/roi/portfolio/summary) —
    // ROITrackingView.tsx's own real data, not a fictional "roi-review"
    // entity. No reviews/approvals endpoint exists; "reviewedAt"/approved-
    // draft status from the old entry never had a real source.
    adapter: 'register',
    ownerPackage: 'R15',
    persistKey: 'results.roi-reviews',
    selection: 'none',
    selectionNoneReason: 'No bulk endpoint exists for the ROI portfolio-summary entity.',
    edit: 'not-applicable',
    archive: 'not-applicable',
    delete: 'business-locked',
    deleteLockReason: 'No delete endpoint exists for ROI portfolio-summary rows.',
    menu3Presets: ['all'],
    bulkActions: [],
    relocateFromList: ['roi-summary-cards'],
    columns: {
      identifier: 'initiativeName',
      required: ['status', 'projectedBenefit', 'realizedBenefit', 'variance'],
    },
  }),
  T38: defineSurface('T38', {
    module: 'Results',
    surface: 'OKR Sets',
    entity: 'objective',
    // R15 — repaired: rows are real Objectives from GET
    // /results-strategic/:projectId/okr (id/label/rollupScore/keyResults[])
    // — the same endpoint StrategicLayerPanel.tsx and ResultsHub's
    // three-pairs widget already use, not a fictional "okr-set" merge. No
    // owner/period/dueDate fields exist on this response.
    adapter: 'register',
    ownerPackage: 'R15',
    persistKey: 'results.okr-sets',
    selection: 'none',
    selectionNoneReason: 'No bulk endpoint exists for OKR objectives.',
    edit: 'not-applicable',
    archive: 'not-applicable',
    delete: 'business-locked',
    deleteLockReason: 'No delete endpoint exists for OKR objectives.',
    menu3Presets: ['all'],
    bulkActions: [],
    relocateFromList: ['okr-summary-cards'],
    columns: {
      identifier: 'label',
      required: ['rollupScore'],
      optional: ['keyResultCount'],
    },
  }),

  // ── Finance ───────────────────────────────────────────────────────────────
  T39: defineSurface('T39', {
    module: 'Finance',
    surface: 'Statements',
    entity: 'financial-statement',
    adapter: 'register-with-tool',
    ownerPackage: 'R27',
    persistKey: 'finance.statements',
    edit: 'permission-dependent',
    menu3Presets: ['all', 'validated', 'draft'],
    bulkActions: ['export', 'archive'],
    columns: {
      identifier: 'name',
      required: ['type', 'period', 'status', 'currency'],
      optional: ['source', 'updatedAt'],
      availableInPreview: ['summary', 'relations'],
    },
  }),
  T40: defineSurface('T40', {
    module: 'Finance',
    surface: 'Analysis',
    entity: 'financial-analysis',
    adapter: 'contaminated-register',
    ownerPackage: 'R16',
    persistKey: 'finance.analysis',
    menu3Presets: ['all', 'published', 'draft'],
    bulkActions: ['export', 'archive'],
    relocateFromList: ['ratio-analysis-tools', 'benchmark-charts'],
    columns: {
      identifier: 'title',
      required: ['statement', 'status', 'period', 'owner'],
      optional: ['updatedAt'],
      availableInPreview: ['summary', 'relations'],
    },
  }),
  T41: defineSurface('T41', {
    module: 'Finance',
    surface: 'Models',
    entity: 'financial-model',
    adapter: 'contaminated-register',
    ownerPackage: 'R16',
    persistKey: 'finance.models',
    edit: 'permission-dependent',
    menu3Presets: ['all', 'validated', 'draft'],
    bulkActions: ['duplicate', 'archive'],
    relocateFromList: ['model-charts', 'assumption-editor'],
    columns: {
      identifier: 'name',
      required: ['status', 'period', 'owner', 'updatedAt'],
      optional: ['scenarioCount'],
      availableInPreview: ['summary', 'relations'],
    },
  }),
  T42: defineSurface('T42', {
    module: 'Finance',
    surface: 'Prediction',
    entity: 'forecast-scenario',
    adapter: 'contaminated-register',
    ownerPackage: 'R16',
    persistKey: 'finance.prediction',
    menu3Presets: ['all', 'baseline', 'stress'],
    bulkActions: ['duplicate', 'archive'],
    relocateFromList: ['forecast-tools', 'liquidity-charts'],
    columns: {
      identifier: 'name',
      required: ['model', 'status', 'horizon', 'updatedAt'],
      optional: ['owner'],
      availableInPreview: ['summary', 'relations'],
    },
  }),
  T43: defineSurface('T43', {
    module: 'Finance',
    surface: 'Enterprise valuation',
    entity: 'valuation',
    adapter: 'contaminated-register',
    ownerPackage: 'R16',
    persistKey: 'finance.valuation',
    menu3Presets: ['all', 'approved', 'draft'],
    bulkActions: ['export', 'archive'],
    relocateFromList: ['dcf-calculator', 'multiples-tool', 'real-options-tool'],
    columns: {
      identifier: 'name',
      required: ['method', 'status', 'value', 'valuedAt'],
      optional: ['owner'],
      availableInPreview: ['summary', 'relations'],
    },
  }),

  // ── Materials ─────────────────────────────────────────────────────────────
  T44: defineSurface('T44', {
    module: 'Materials',
    surface: 'All',
    entity: 'material',
    // R18 — audyt: „actual file format missing for document rows". Rejestr
    // istnieje i jest czysty; brakuje kolumny semantycznej, którą §5 uznaje
    // za tak samo obowiązkową jak element graficzny.
    adapter: 'semantic-gap',
    ownerPackage: 'R18',
    persistKey: 'materials.all',
    viewModes: ['list', 'grid'],
    contextTransitions: ['document', 'presentation'],
    menu3Presets: ['all', 'documents', 'presentations', 'sheets'],
    bulkActions: ['download', 'export', 'archive'],
    columns: {
      identifier: 'name',
      // `format` = rzeczywisty DOCX/PDF/XLSX/PPTX z MIME albo rozszerzenia,
      // z fallbackiem `Unknown` (REPAIR_WORK_PACKAGES R18) — nie generyczne „Custom".
      required: ['format', 'type', 'owner', 'updatedAt'],
      optional: ['size', 'source'],
      availableInPreview: ['summary', 'relations'],
    },
  }),
  T45: defineSurface('T45', {
    module: 'Materials',
    surface: 'Documents',
    entity: 'document',
    adapter: 'semantic-gap',
    ownerPackage: 'R18',
    persistKey: 'materials.documents',
    viewModes: ['list', 'grid'],
    contextTransitions: ['presentation', 'report'],
    menu3Presets: ['all', 'published', 'draft'],
    bulkActions: ['download', 'export', 'archive'],
    columns: {
      identifier: 'name',
      required: ['format', 'status', 'owner', 'updatedAt'],
      optional: ['size', 'template'],
      availableInPreview: ['summary', 'relations'],
    },
  }),
};

/** Wszystkie 45 identyfikatorów w kolejności T01…T45 — do iteracji w testach. */
export const TABLE_SURFACE_IDS = Object.keys(TABLE_SURFACE_REGISTER) as TableSurfaceId[];

/** Wpisy jako tablica. */
export const TABLE_SURFACE_CONTRACTS: readonly TableSurfaceContract[] = TABLE_SURFACE_IDS.map(
  (id) => TABLE_SURFACE_REGISTER[id]
);

/** Kontrakt powierzchni. Brak wpisu jest niewyrażalny typem. */
export function tableSurfaceContract(id: TableSurfaceId): TableSurfaceContract {
  return TABLE_SURFACE_REGISTER[id];
}

/** Powierzchnie obsługiwane przez dany pakiet naprawczy. */
export function surfacesForPackage(pkg: RepairPackageId): TableSurfaceContract[] {
  return TABLE_SURFACE_CONTRACTS.filter((c) => c.ownerPackage === pkg);
}

/** Powierzchnie danego adaptera. */
export function surfacesForAdapter(adapter: TableAdapterKind): TableSurfaceContract[] {
  return TABLE_SURFACE_CONTRACTS.filter((c) => c.adapter === adapter);
}
