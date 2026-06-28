/**
 * ModuleHub Types
 * Shared types for Assessment and Discovery Tools modules
 *
 * ItemStatus uses canonical 11-status initiative lifecycle.
 * Documentation: wdrozenia/standards/03-STATUS-WORKFLOW.md
 */

export type ModuleTab =
  | 'library'
  | 'list'
  | 'sessions'
  | 'outputs'
  | 'reports'
  | 'initiatives'
  | 'tasks'
  | 'team'
  | 'raid'
  | 'decisions'
  | 'assignments'
  // Finance (ECONOMICS module) — v3 functional areas
  | 'statements'
  | 'models'
  | 'analysis'
  | 'prediction'
  | 'valuation'
  | 'investment'
  // V3-J02 — Presentations Hub
  | 'all_decks'
  | 'recent'
  // V3-H01 — Results Hub
  | 'summary'
  | 'kpis'
  | 'kpi_overview'
  | 'kpi_catalog'
  | 'kpi_reports'
  | 'kpi_queue'
  | 'results_initiatives'
  | 'results_kpi'
  | 'results_reports'
  | 'roi'
  | 'all_kpis'
  | 'by_initiative'
  | 'global'
  // V3-H02 — ROI Tracking
  | 'roi_tracking'
  // V3-J — Reports & Presentations unified hub
  | 'templates'
  | 'presentations'
  // V3-H03 — Results Operational + ROI Analysis
  | 'operational'
  | 'roi_analysis'
  | 'results_strategic'
  | 'results_ai'
  // V3-F02 — Initiatives Portfolio Analysis
  | 'analysis'
  // USPOJNIENIE E1/E2 — Initiatives observability (lineage + funnel)
  | 'observability'
  // Initiatives backbone — F2 candidates inbox + F4 portfolio health
  | 'candidates'
  | 'portfolioHealth'
  // V3-Phase10 — Unified Report Builder Hub
  | 'my_reports'
  | 'r1_r4'
  | 'schedules'
  // V8.1 — Outputs Library (unified hub; route remains /presentations)
  | 'outputs_all'
  | 'outputs_mine'
  | 'outputs_review'
  | 'outputs_documents'
  | 'outputs_sheets'
  // Interview module
  | 'my_assignments'
  | 'managed'
  | 'insights'
  | 'pending_review'
  // Wnioski module
  | 'inbox'
  | 'readout'
  | 'conversions'
  | 'documents'
  // Execution module — Rollout sub-tab (Module 06 Realizacja)
  | 'rollout';

export type ViewMode = 'table' | 'grid' | 'kanban' | 'timeline' | 'calendar' | 'matrix';

/**
 * Canonical Initiative Status (11 statuses)
 * Lifecycle: DRAFT → REVIEW → PROMOTED → PLANNING → APPROVED → SCHEDULED → EXECUTING → DONE → TRACKING
 */
export type ItemStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'REVIEW'
  | 'PROMOTED'
  | 'PLANNING'
  | 'APPROVED'
  | 'SCHEDULED'
  | 'EXECUTING'
  | 'BLOCKED'
  | 'DONE'
  | 'TRACKING'
  | 'CANCELLED'
  | 'ARCHIVED';

export interface OpenDocument {
  id: string;
  type:
    | 'assessment'
    | 'tool'
    | 'report'
    | 'initiative'
    | 'task'
    | 'decision'
    | 'presentation'
    | 'idea'
    | 'conclusion'
    | 'notification'
    | 'interview_session'
    | 'interview_insight'
    | 'interview_template';
  subType: string; // DRD, SWOT, VSM, deck source type, etc.
  name: string;
  status: ItemStatus;
  hasUnsavedChanges?: boolean;
}

export interface ColumnFilter {
  column: string;
  values: string[];
}

export interface ModuleHubProps {
  moduleType: 'assessment' | 'discovery';
  title: string;
  subtitle: string;

  // Tab configuration
  tabs: TabConfig[];
  activeTab: ModuleTab;
  onTabChange: (tab: ModuleTab) => void;

  // View mode
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;

  // Dynamic documents
  openDocuments: OpenDocument[];
  activeDocumentId: string | null;
  onOpenDocument: (doc: OpenDocument) => void;
  onCloseDocument: (id: string) => void;
  onSelectDocument: (id: string) => void;

  // Actions
  onNewItem?: () => void;
  newItemLabel?: string;
  categoryButtons?: CategoryButton[];

  // Content
  children: React.ReactNode;
}

export interface TabConfig {
  id: ModuleTab;
  label: string;
  icon: React.ReactNode;
  count?: number;
}

export interface CategoryButton {
  id: string;
  label: string;
  icon: React.ReactNode;
  count: number;
  onClick: () => void;
}

// Assessment specific types
export type AssessmentFrameworkType = 'DRD' | 'SIRI' | 'ADMA' | 'CMMI' | 'LEAN';

export interface AssessmentItem {
  id: string;
  name: string;
  framework: AssessmentFrameworkType;
  status: ItemStatus;
  progress: number;
  updatedAt: Date;
  createdBy?: string;
}

// Discovery Tools specific types
export type ToolCategory = 'strategic' | 'operational' | 'digital' | 'automation' | 'licensed';

export type ToolType =
  // Strategic (1-10)
  | 'SWT'
  | 'PTR'
  | 'ANS'
  | 'VCH'
  | 'BCG'
  | 'AMB'
  | 'FOC'
  | 'RSK'
  | 'CAP'
  | 'NAR'
  // Operational (11-20)
  | 'VSM'
  | 'SOP'
  | 'A3P'
  | 'SMD'
  | 'DMS'
  | 'AUT'
  | 'CON'
  | 'DEC'
  | 'CTW'
  | 'INV'
  // Digital (21-30)
  | 'ROB'
  | 'LOG'
  | 'RPA'
  | 'AID'
  | 'INT'
  | 'DVP'
  | 'LEG'
  | 'DAT'
  | 'P2S'
  | 'SPE'
  // Automation (31)
  | 'PAI';

export interface DiscoveryItem {
  id: string;
  name: string;
  toolType: ToolType;
  category: ToolCategory;
  status: ItemStatus;
  progress: number;
  updatedAt: Date;
  createdBy?: string;
}

// Framework/Tool metadata
export interface FrameworkMeta {
  id: string;
  name: string;
  shortName: string;
  icon: string;
  color: string;
  description: string;
}

export interface ToolMeta {
  id: ToolType;
  name: string;
  shortName: string;
  category: ToolCategory;
  icon: string;
  color: string;
  description: string;
}
