/**
 * Reports & Presentations Hub — Types
 * V8.1 Outputs Library taxonomy (same shell; route alias /presentations).
 */

import type {
  TemplateOriginRuntime,
  TemplateScope as MaterialTemplateScope,
  TemplateSource,
  TemplateStatus as MaterialTemplateStatus,
} from '@/types/materials';

import type { MaterialFileFormat } from './materialFileFormat';

export type RapTab =
  | 'outputs_all'
  | 'outputs_mine'
  | 'outputs_review'
  | 'outputs_documents'
  | 'presentations'
  | 'outputs_sheets'
  | 'templates'
  // C2 (2026-07-22): Architekt szablonów Prezentacji — zakładka widoczna TYLKO
  // przy fladze isDeckArchitectEnabled() (default ON since fb119cefe8, akcept
  // Piotra 2026-07-22; UWAGA: decyzja architekta D6 z 2026-07-24 postuluje OFF
  // — konflikt do rozstrzygnięcia przez Piotra, nie zmieniaj defaultu bez
  // jego słowa); przy OFF hub bez zmian względem pre-flag.
  | 'template_architect'
  // Gen. Excel nav (2026-07-22): rejestr parametrycznych szablonów Excela —
  // zakładka widoczna TYLKO przy fladze isWorkbookTemplatesEnabled() (default
  // OFF); przy OFF hub bez zmian.
  | 'workbook_templates';
// NOTE (#83a): 'outputs_data' retired as a top-level Menu 2 tab — Data Sources
// moved to a sub-tab inside Sheets (SheetsTabContent). Legacy `?tab=data` deep
// links now resolve to 'outputs_sheets' via outputsLibraryTabQuery.ts.

/**
 * Sheet origin (inwentarz Excel 27.07): `kind === 'sheet'` rows come from two
 * DIFFERENT registry writers that both use `originRuntime: 'sheet'`, so the
 * registry alone can't tell them apart — the row previously showed a bare
 * "Sheet" label for both, making a Table Studio export look identical to a
 * real workbook ("tabele o niczym" — Piotr's audyt).
 *   - 'table_export' — flat XLSX/CSV export of a `tp_tables` row, registered
 *     by `registerGovernedTableSheetArtifact` (originSummary.sourceTable ===
 *     'tp_tables', governanceMode: 'governed'). 61/75 sheet artifacts on demo.
 *   - 'workbook' — a real generator-built workbook in `generated_workbooks`,
 *     registered by the `/api/workbook` routes (no `sourceTable` marker).
 * See `resolveSheetOrigin` in useRapData.ts for the derivation.
 */
export type SheetOrigin = 'table_export' | 'workbook';

/** Canonical registry row flattened for All / Mine / Needs review tabs */
export interface UnifiedOutputRow {
  kind: 'document' | 'presentation' | 'sheet';
  originRecordId: string;
  artifactId?: string;
  title: string;
  /** Normalized for command-row chips (draft | ready | shared | archived | …) */
  statusKey: string;
  owner: string;
  updatedAt: string;
  reportType?: string;
  sourceType?: string;
  sourceInitiativeId?: string;
  slideCount?: number;
  exportFormats: string[];
  /** Persisted material format; never inferred from the generic `kind`. */
  fileFormat: MaterialFileFormat;
  governance?: ArtifactGovernanceSummary;
  /** Only set when `kind === 'sheet'` — see `SheetOrigin` above. */
  sheetOrigin?: SheetOrigin;
}

export type TemplateType = 'report' | 'presentation' | 'sheet';
export type TemplateCategory =
  | 'R1'
  | 'R2'
  | 'R3'
  | 'R4'
  | 'executive_update'
  | 'project_kickoff'
  | 'initiative_review'
  | 'financial_review'
  | 'assessment_results'
  | 'custom';
/**
 * Zakres/status szablonu — SSOT w `src/types/materials.ts` (kontrakt indeksu).
 * Zachowujemy legacy warianty (`'application'`, `'active'`, `'archived'`) jako
 * część unionu WYŁĄCZNIE po to, żeby stare, jeszcze niezmigrowane miejsca w UI
 * dalej się kompilowały — mapper indeksu ich NIE produkuje (patrz
 * `mapTemplateScope`/`mapTemplateStatus` w useRapData.ts).
 */
export type TemplateScope = MaterialTemplateScope | 'application';
export type TemplateStatus = MaterialTemplateStatus | 'active' | 'archived';

export type ReportType = 'R1' | 'R2' | 'R3' | 'R4' | 'custom';
export type ReportStatus = 'draft' | 'ready' | 'exported' | 'archived';

export type PresentationSourceType = 'tool' | 'assessment' | 'finance' | 'upload';
export type PresentationStatus =
  'draft' | 'generated' | 'editing' | 'ready' | 'shared' | 'archived';

export interface ArtifactSourceRef {
  artifact_id: string;
  artifact_type: string;
  artifact_name: string;
}

export interface ArtifactOriginLinkItem {
  linkId: string;
  artifactId: string;
  organizationId: string;
  originRuntime:
    | 'report'
    | 'presentation'
    | 'sheet'
    | 'native_artifact'
    | 'report_template'
    | 'presentation_template';
  originRecordId: string;
  isPrimaryOrigin: boolean;
  createdAt: string;
}

export interface ArtifactAccessGrantItem {
  grantId: string;
  artifactId: string;
  organizationId: string;
  grantKind: 'user' | 'role';
  userId: string | null;
  roleKey: string | null;
  createdBy: string;
  createdAt: string;
}

export interface ArtifactExportTraceItem {
  exportId: string;
  artifactId: string;
  organizationId: string;
  format: string;
  requestedBy: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
}

/**
 * P2.6 — compact deck quality scorecard surfaced on presentation list rows.
 * Derived server-side from the existing checkDeckQualityGates output (score +
 * A-F grade + top failing gates); present only for presentation decks that are
 * readable. Absent → the list badge falls back to `validationState`.
 */
export interface DeckListScorecard {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  result: 'PASS' | 'PASS_WITH_P2' | 'BLOCKED_P1' | 'INCONCLUSIVE';
  p0: number;
  p1: number;
  p2: number;
  canExport: boolean;
  topIssues: string[];
}

export interface ArtifactGovernanceSummary {
  visibilityScope?: 'private' | 'project' | 'organization' | 'review_shared' | 'demo';
  publishState?: string | null;
  validationState?: 'validated' | 'pending' | 'attention_required' | null;
  /** P2.6 — deck quality scorecard (presentation decks only; see DeckListScorecard). */
  deckScorecard?: DeckListScorecard | null;
  validationChecks?: Array<{
    id: string;
    status: 'passed' | 'pending' | 'failed';
    message: string;
  }>;
  publishReviewers?: string[];
  reviewGateCount?: number;
  projectId?: string | null;
  executionRunId?: string | null;
  executionState?: string | null;
  contextSnapshotId?: string | null;
  canonicalHome?: string | null;
  lastTransitionAt?: string | null;
  sourceRefs?: unknown[];
  originSummary?: Record<string, unknown> | null;
  openPath?: string | null;
  exportPath?: string | null;
  authority?: string | null;
  manageAccessPath?: string | null;
  canManageAccess?: boolean;
  exportHistory?: ArtifactExportTraceItem[];
  reviewAuthority?: 'artifact_review';
  executionAuthority?: 'execution_spine';
  accessGrants?: ArtifactAccessGrantItem[];
  originLinks?: ArtifactOriginLinkItem[];
  lineagePaths?: {
    runPath: string;
    toolUsagePath: string;
    outputsPath: string;
  } | null;
}

export interface TemplateItem {
  /**
   * Id WIERSZA INDEKSU artefaktów (historyczna nazwa `id`, zachowana bo używa
   * jej StandardTable jako klucza wiersza). ★ To NIE jest id kanonicznego
   * szablonu — patrz `canonicalTemplateId`.
   */
  id: string;
  /** Jawna, nieomylna nazwa tego samego identyfikatora co `id` (index artifact id). */
  artifactIndexId?: string;
  /**
   * Id KANONICZNEGO rekordu szablonu w jego runtime (document_templates,
   * report_builder_templates, …). To jego oczekuje generator przy „Użyj wzorca".
   * `null` = indeks nie zna kanonicznego rekordu (zwykle wpis osierocony).
   */
  canonicalTemplateId?: string | null;
  /** Runtime pochodzenia kanonicznego rekordu (rozstrzyga trasę „Użyj wzorca"). */
  originRuntime?: TemplateOriginRuntime | null;
  /** `'legacy'` = report_builder_templates; `'canonical'` = nowy rejestr. */
  source?: TemplateSource | null;
  /** Skrót na `source === 'legacy'` (backend podaje jawnie). */
  legacy?: boolean;
  /** true = brak kanonicznego rekordu → wpisu NIE wolno oferować do użycia. */
  orphaned?: boolean;
  title: string;
  description?: string;
  type: TemplateType;
  category: TemplateCategory;
  scope: TemplateScope;
  status: TemplateStatus;
  /**
   * ISO data ostatniej zmiany albo `null`, gdy indeks jej nie zna.
   * ★ NIE fabrykujemy „teraz" — brak daty ma być widoczny.
   */
  updatedAt: string | null;
  createdBy: string;
  slideCount?: number;
  sectionCount?: number;
  deprecationReason?: string;
  migrationHint?: string;
  /** Structured pointer to the replacement template artifact */
  replacedByArtifactId?: string;
  governance?: ArtifactGovernanceSummary | null;
  [key: string]: unknown;
}

export interface ReportItem {
  id: string;
  artifactId?: string;
  title: string;
  reportType: ReportType;
  status: ReportStatus;
  owner: string;
  goal?: string;
  communicationRegister?: string;
  confidentiality?: string;
  periodFrom?: string;
  periodTo?: string;
  createdAt: string;
  updatedAt: string;
  exportFormats: string[];
  /** Persisted document format; `Unknown` means the registry did not provide one. */
  fileFormat?: MaterialFileFormat;
  sourceRefs?: Array<string | ArtifactSourceRef>;
  governance?: ArtifactGovernanceSummary;
  [key: string]: unknown;
}

export interface PresentationItem {
  id: string;
  artifactId?: string;
  title: string;
  sourceType: PresentationSourceType;
  owner: string;
  status: PresentationStatus;
  presentationMode?: 'show' | 'document' | 'briefing' | 'workshop' | string;
  createdAt: string;
  updatedAt: string;
  slideCount: number;
  thumbnailUrl?: string;
  exportFormats: string[];
  sourceId?: string;
  sourceRefs?: ArtifactSourceRef[];
  governance?: ArtifactGovernanceSummary;
  [key: string]: unknown;
}

export const REPORT_TYPE_META: Record<
  ReportType,
  { label: string; labelPl: string; color: string; dotColor: string }
> = {
  R1: {
    label: 'Weekly Execution',
    labelPl: 'Raport tygodniowy',
    color: 'text-blue-400',
    dotColor: 'bg-blue-400',
  },
  R2: {
    label: 'Steering Committee',
    labelPl: 'Komitet sterujący',
    color: 'text-blue-400',
    dotColor: 'bg-blue-400',
  },
  R3: {
    label: 'Benefits Tracking',
    labelPl: 'Śledzenie korzyści',
    color: 'text-emerald-400',
    dotColor: 'bg-emerald-400',
  },
  R4: {
    label: 'Portfolio Overview',
    labelPl: 'Przegląd portfela',
    color: 'text-amber-400',
    dotColor: 'bg-amber-400',
  },
  custom: { label: 'Custom', labelPl: 'Własny', color: 'text-slate-600', dotColor: 'bg-slate-400' },
};

export type StatusChipTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export const REPORT_STATUS_META: Record<
  ReportStatus,
  { label: string; labelPl: string; dotColor: string; tone: StatusChipTone }
> = {
  draft: { label: 'Draft', labelPl: 'Szkic', dotColor: 'bg-slate-400', tone: 'neutral' },
  ready: { label: 'Ready', labelPl: 'Gotowy', dotColor: 'bg-emerald-400', tone: 'success' },
  exported: {
    label: 'Exported',
    labelPl: 'Wyeksportowany',
    dotColor: 'bg-blue-400',
    tone: 'info',
  },
  archived: {
    label: 'Archived',
    labelPl: 'Zarchiwizowany',
    dotColor: 'bg-slate-500',
    tone: 'neutral',
  },
};

export const PRESENTATION_STATUS_META: Record<
  PresentationStatus,
  { label: string; labelPl: string; dotColor: string; tone: StatusChipTone }
> = {
  draft: { label: 'Draft', labelPl: 'Szkic', dotColor: 'bg-slate-400', tone: 'neutral' },
  generated: {
    label: 'Generated',
    labelPl: 'Wygenerowana',
    dotColor: 'bg-blue-400',
    tone: 'info',
  },
  editing: { label: 'Editing', labelPl: 'Edycja', dotColor: 'bg-amber-400', tone: 'warning' },
  ready: { label: 'Ready', labelPl: 'Gotowa', dotColor: 'bg-emerald-400', tone: 'success' },
  shared: { label: 'Shared', labelPl: 'Udostępniona', dotColor: 'bg-blue-400', tone: 'info' },
  archived: {
    label: 'Archived',
    labelPl: 'Zarchiwizowana',
    dotColor: 'bg-slate-500',
    tone: 'neutral',
  },
};

export const SOURCE_TYPE_META: Record<
  PresentationSourceType,
  { label: string; labelPl: string; color: string }
> = {
  tool: { label: 'Tool', labelPl: 'Narzędzie', color: 'text-emerald-400' },
  assessment: { label: 'Assessment', labelPl: 'Ocena', color: 'text-blue-400' },
  finance: { label: 'Finance', labelPl: 'Finanse', color: 'text-blue-400' },
  upload: { label: 'Upload', labelPl: 'Przesłane', color: 'text-amber-400' },
};

/**
 * Labels for the `sheet` row's TYPE column, distinguishing a flat Table
 * Studio export from a real generated workbook — see `SheetOrigin` above.
 * Text-only differentiation, no new colors (TRIADA §primary=crimson pułapka):
 * both share the same neutral `text-c-text-secondary` class in the column.
 */
export const SHEET_ORIGIN_META: Record<SheetOrigin, { label: string; labelPl: string }> = {
  workbook: { label: 'Sheet (model)', labelPl: 'Arkusz (model)' },
  table_export: { label: 'Sheet (table export)', labelPl: 'Arkusz (eksport tabeli)' },
};

export const TEMPLATE_TYPE_META: Record<
  TemplateType,
  { label: string; labelPl: string; dotColor: string }
> = {
  report: { label: 'Report', labelPl: 'Raport', dotColor: 'bg-blue-400' },
  sheet: { label: 'Sheet', labelPl: 'Tabela', dotColor: 'bg-emerald-400' },
  presentation: { label: 'Presentation', labelPl: 'Prezentacja', dotColor: 'bg-blue-400' },
};

export const TEMPLATE_STATUS_META: Record<
  TemplateStatus,
  { label: string; labelPl: string; dotColor: string; tone: StatusChipTone }
> = {
  approved: {
    label: 'Approved',
    labelPl: 'Zatwierdzony',
    dotColor: 'bg-emerald-400',
    tone: 'success',
  },
  published: {
    label: 'Published',
    labelPl: 'Opublikowany',
    dotColor: 'bg-emerald-400',
    tone: 'success',
  },
  unknown: { label: 'Unknown', labelPl: 'Nieznany', dotColor: 'bg-slate-400', tone: 'neutral' },
  active: { label: 'Active', labelPl: 'Aktywny', dotColor: 'bg-emerald-400', tone: 'success' },
  draft: { label: 'Draft', labelPl: 'Szkic', dotColor: 'bg-slate-400', tone: 'neutral' },
  deprecated: {
    label: 'Deprecated',
    labelPl: 'Wycofany',
    dotColor: 'bg-amber-500',
    tone: 'warning',
  },
  archived: {
    label: 'Archived',
    labelPl: 'Zarchiwizowany',
    dotColor: 'bg-slate-500',
    tone: 'neutral',
  },
};
