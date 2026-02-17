/**
 * ModuleHub Types
 * Shared types for Assessment and Discovery Tools modules
 *
 * ItemStatus uses canonical 11-status initiative lifecycle.
 * Documentation: wdrozenia/standards/03-STATUS-WORKFLOW.md
 */

export type ModuleTab =
  | 'list'
  | 'reports'
  | 'initiatives'
  | 'tasks'
  | 'team'
  | 'raid'
  | 'decisions'
  | 'assignments';

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
  type: 'assessment' | 'tool' | 'report' | 'initiative' | 'task' | 'decision';
  subType: string; // DRD, SWOT, VSM, etc.
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
export type ToolCategory = 'strategic' | 'operational' | 'digital' | 'automation';

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
