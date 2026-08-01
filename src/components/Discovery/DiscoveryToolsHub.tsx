/**
 * DiscoveryToolsHub (V3: unified "Tools" hub)
 * Single mental model: Library → Sessions → Reports & Presentations → Initiatives
 * Categories: Strategy, Operations, Digital, Process Automation, Licensed
 *
 * V3-E01: User has one "Tools" entry point, licensed/assessment is a category
 * not a separate world. Breadcrumbs: "Tools > ..."
 */

import {
  Activity,
  AlertTriangle,
  Archive,
  ArrowRight,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Cpu,
  Database,
  DollarSign,
  ExternalLink,
  Eye,
  FileText,
  Filter,
  Flag,
  FolderOutput,
  Layers,
  Library,
  Lightbulb,
  List,
  ListTodo,
  Loader2,
  MessageSquare,
  Play,
  RefreshCw,
  Settings,
  Shield,
  Target,
  Trash2,
  TrendingUp,
  User,
  Users,
  Workflow,
  X,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';

import {
  EmptyState as SharedEmptyState,
  LoadingState as SharedLoadingState,
} from '@/components/shared/states';
// #63: ekrany listowe Tools = kanoniczny StandardTable (Triada), NIE surowy
// FilterableTable. StandardTable dokłada pstryczek „Edit Columns" (Settings2 →
// TableSettingsPopover), checkbox zaznaczania, per-kolumnowe lejki filtrów,
// 5-blokowy kebab sekcyjny i stany empty/loading — 1:1 jak Interview/Assessment.
import { StandardTable } from '@/components/standard';
import { useHelpSidePanel } from '@/contexts/HelpContext';
import { useOpenChatWithContext } from '@/hooks/useOpenChatWithContext';
import { ROUTES } from '@/routes/routeConfig';
import { Api, clearGlobalTransportFailure, resetAuthLoopGuard } from '@/services/api';
import { type FrameworkId, isFrameworkComingSoon } from '@/services/frameworkRegistry';
import { trackFunnelEvent } from '@/services/funnelAnalytics';
import { useAppStore } from '@/store/useAppStore';
import { useConversationStore } from '@/store/useConversationStore';
import { ToolType as StoreToolType } from '@/store/useToolStore';
import { listStrategyToolSlugs } from '@/toolCatalog/strategy/catalog';
import { parseArtifactRef } from '@/utils/artifactLinks';
import { formatRoiDisplay } from '@/utils/safeFormat';

import {
  type AssessmentFrameworkPreviewModel,
  AssessmentFrameworkPreviewV3Body,
  AssessmentFrameworkPreviewV3Footer,
} from '../assessment/AssessmentFrameworkPreviewV3';
import {
  type AssessmentSessionPreviewDetails,
  AssessmentSessionPreviewV3Body,
  AssessmentSessionPreviewV3Footer,
} from '../assessment/AssessmentSessionPreviewV3';
import { ToolDocumentView, ToolWorkspace } from '../DiscoveryTools';
import { GenerateInitiativesModal } from '../DiscoveryTools/GenerateInitiativesModal';
import { GenericToolDocumentView } from '../DiscoveryTools/GenericToolDocumentView';
import { KnownToolDetailView } from '../DiscoveryTools/KnownToolDetailView';
import {
  type KnownToolFull,
  KnownToolPreviewV3Body,
  KnownToolPreviewV3Footer,
} from '../DiscoveryTools/KnownToolPreviewV3';
import { getToolCategoryLabel } from '../DiscoveryTools/ToolSessionPreview';
import {
  type ToolSessionPreviewDetails,
  ToolSessionPreviewV3Body,
  ToolSessionPreviewV3Footer,
} from '../DiscoveryTools/ToolSessionPreviewV3';
import { InitiativeDocumentView } from '../Initiatives/InitiativeDocumentView';
import {
  InitiativePreviewV3Body,
  InitiativePreviewV3Footer,
  type InitiativePreviewV3Model,
} from '../Initiatives/InitiativePreviewV3';
import { getSourceDisplayLabel } from '../Initiatives/InitiativeSourceLink';
import {
  FilterChip,
  GridItem,
  GridView,
  ItemStatus,
  ModuleTab,
  OpenDocument,
  TableColumn,
  ViewMode,
} from '../shared/ModuleHub';
import { useModuleOpenDocuments } from '../shared/ModuleHub/useModuleOpenDocuments';
import { StandardModuleBar } from '../standard/StandardModuleBar';
import {
  MENU_3_ALL_DOT_CLASS,
  MENU_3_BADGE_ACTIVE,
  MENU_3_BADGE_INACTIVE,
  MENU_3_CHIP_ACTIVE,
  MENU_3_CHIP_INACTIVE,
  MENU_3_LEFT_CLASS,
} from '../shared/ModuleMenu3';
import { type RowActionSection, RowActionsMenu } from '../shared/RowActionsMenu';
import { TableWithPreviewLayout } from '../shared/TableWithPreviewLayout';
import { ChipBase } from '../ui/primitives/chips/chipBase';
import { PriorityChip, type PriorityLevel } from '../ui/primitives/chips/PriorityChip';

// Tool category types (V3: includes licensed assessments)
type ToolCategory = 'strategic' | 'operational' | 'digital' | 'automation' | 'licensed';
// Using ItemStatus from ModuleHub types (uppercase): DRAFT, REVIEW, APPROVED, DONE, etc.
// Helper to map lowercase statuses from API to uppercase for GridItem
const mapStatusToUppercase = (status: string): import('../shared/ModuleHub').ItemStatus => {
  const mapping: Record<string, import('../shared/ModuleHub').ItemStatus> = {
    draft: 'DRAFT',
    in_review: 'PENDING_REVIEW',
    pending_review: 'PENDING_REVIEW',
    approved: 'APPROVED',
    completed: 'DONE',
    done: 'DONE',
    blocked: 'BLOCKED',
    cancelled: 'CANCELLED',
    archived: 'ARCHIVED',
    proposed: 'REVIEW',
    planned: 'PLANNING',
    in_progress: 'EXECUTING',
    executing: 'EXECUTING',
    review: 'REVIEW',
  };
  return mapping[status.toLowerCase()] || 'DRAFT';
};

// Status filter options per tab context
interface StatusFilterOption {
  id: string;
  label: string;
  color: string;
  bgColor: string;
}

// Discovery tab: DRAFT, PENDING_REVIEW (work in progress)
const DISCOVERY_STATUSES: StatusFilterOption[] = [
  { id: 'all', label: 'All', color: 'text-c-text-secondary', bgColor: 'bg-c-text-muted' },
  { id: 'draft', label: 'Draft', color: 'text-c-text-secondary', bgColor: 'bg-c-text-muted' },
  {
    id: 'pending_review',
    label: 'Pending Review',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500',
  },
  {
    id: 'executing',
    label: 'In Progress',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500',
  },
];

// Reports tab: APPROVED, COMPLETED (finished analyses)
const REPORTS_STATUSES: StatusFilterOption[] = [
  { id: 'all', label: 'All', color: 'text-c-text-secondary', bgColor: 'bg-c-text-muted' },
  { id: 'approved', label: 'Approved', color: 'text-emerald-400', bgColor: 'bg-emerald-500' },
  { id: 'completed', label: 'Completed', color: 'text-emerald-400', bgColor: 'bg-emerald-500' },
];

// Initiatives tab: DRAFT, PROPOSED, PLANNED, IN_PROGRESS, COMPLETED, CANCELLED
const INITIATIVES_STATUSES: StatusFilterOption[] = [
  { id: 'all', label: 'All', color: 'text-c-text-secondary', bgColor: 'bg-c-text-muted' },
  { id: 'draft', label: 'Draft', color: 'text-c-text-secondary', bgColor: 'bg-c-text-muted' },
  { id: 'proposed', label: 'Proposed', color: 'text-amber-400', bgColor: 'bg-amber-500' },
  { id: 'planned', label: 'Planned', color: 'text-blue-400', bgColor: 'bg-blue-500' },
  { id: 'in_progress', label: 'In Progress', color: 'text-amber-400', bgColor: 'bg-amber-500' },
  { id: 'completed', label: 'Completed', color: 'text-emerald-400', bgColor: 'bg-emerald-500' },
  { id: 'cancelled', label: 'Cancelled', color: 'text-danger-400', bgColor: 'bg-danger-500' },
];

// Tool type codes
type ToolType =
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

// Category metadata
const CATEGORY_META: Record<
  ToolCategory,
  {
    name: string;
    icon: React.ReactNode;
    textClass: string;
    dotClass: string;
    count: number;
  }
> = {
  strategic: {
    name: 'Strategy',
    icon: <Target size={16} />,
    textClass: 'text-emerald-400',
    dotClass: 'bg-emerald-400',
    count: 10,
  },
  operational: {
    name: 'Operations',
    icon: <Settings size={16} />,
    textClass: 'text-blue-400',
    dotClass: 'bg-blue-400',
    count: 10,
  },
  digital: {
    name: 'Digital',
    icon: <Cpu size={16} />,
    textClass: 'text-blue-400',
    dotClass: 'bg-blue-400',
    count: 10,
  },
  automation: {
    name: 'Process Auto',
    icon: <Zap size={16} />,
    textClass: 'text-amber-400',
    dotClass: 'bg-amber-400',
    count: 1,
  },
  licensed: {
    name: 'Assessments',
    icon: <Shield size={16} />,
    textClass: 'text-danger-400',
    dotClass: 'bg-danger-400',
    count: 5,
  },
};

type AssessmentFramework = 'DRD' | 'SIRI' | 'ADMA' | 'CMMI' | 'LEAN';

const ASSESSMENT_FRAMEWORK_META: Record<
  AssessmentFramework,
  {
    name: string;
    shortName: string;
    icon: React.ReactNode;
    tags: string[];
  }
> = {
  DRD: {
    name: 'Digital Readiness Diagnosis',
    shortName: 'DRD',
    icon: <Activity size={16} className="text-danger-400" />,
    tags: ['assessment', 'digital', 'readiness'],
  },
  SIRI: {
    name: 'Smart Industry Readiness Index',
    shortName: 'SIRI',
    icon: <Cpu size={16} className="text-danger-400" />,
    tags: ['assessment', 'industry-4.0', 'readiness'],
  },
  ADMA: {
    name: 'Advanced Digital Maturity Assessment',
    shortName: 'ADMA',
    icon: <Database size={16} className="text-danger-400" />,
    tags: ['assessment', 'maturity', 'digital'],
  },
  CMMI: {
    name: 'Capability Maturity Model Integration',
    shortName: 'CMMI',
    icon: <Layers size={16} className="text-danger-400" />,
    tags: ['assessment', 'process', 'maturity'],
  },
  LEAN: {
    name: 'Lean 4.0',
    shortName: 'LEAN',
    icon: <Workflow size={16} className="text-danger-400" />,
    tags: ['assessment', 'lean', 'operations'],
  },
};

type LibraryItemKind = 'tool' | 'assessment';

type UnifiedLibraryItem = {
  kind: LibraryItemKind;
  id: string;
  toolType: string;
  name: string;
  libraryCategory: ToolCategory;
  description: string;
  whatYouGet: string[];
  tags: string[];
  icon: string | null;
  isLicensed: boolean;
  isActive: boolean;
  isComingSoon: boolean;
  sortOrder: number;
  createdAt: string | null;
  /** Normalized field for table filtering */
  license: 'licensed' | 'free';
  availability: 'active' | 'inactive';
};

// Tool metadata
const TOOL_META: Record<
  ToolType,
  {
    name: string;
    shortName: string;
    category: ToolCategory;
    description: string;
  }
> = {
  // Strategic Tools
  SWT: {
    name: 'Dynamic SWOT',
    shortName: 'SWT',
    category: 'strategic',
    description: 'AI-driven SWOT analysis',
  },
  PTR: {
    name: 'Market Forces (Porter)',
    shortName: 'PTR',
    category: 'strategic',
    description: '5 forces competitive analysis',
  },
  ANS: {
    name: 'Growth Paths (Ansoff)',
    shortName: 'ANS',
    category: 'strategic',
    description: 'Market/product expansion',
  },
  VCH: {
    name: 'Value Chain',
    shortName: 'VCH',
    category: 'strategic',
    description: 'Value leakage finder',
  },
  BCG: {
    name: 'Portfolio Priority',
    shortName: 'BCG',
    category: 'strategic',
    description: 'Strategic prioritization',
  },
  AMB: {
    name: 'Ambition Decomposer',
    shortName: 'AMB',
    category: 'strategic',
    description: 'Vision breakdown',
  },
  FOC: {
    name: 'Focus & Trade-off',
    shortName: 'FOC',
    category: 'strategic',
    description: 'What NOT to do',
  },
  RSK: {
    name: 'Risk & Uncertainty',
    shortName: 'RSK',
    category: 'strategic',
    description: 'Scenario mapping',
  },
  CAP: {
    name: 'Capability Mapper',
    shortName: 'CAP',
    category: 'strategic',
    description: 'Skills-to-outcomes',
  },
  NAR: {
    name: 'Narrative Engine',
    shortName: 'NAR',
    category: 'strategic',
    description: 'Strategy communication',
  },
  // Operational Tools
  VSM: {
    name: 'VSM Builder',
    shortName: 'VSM',
    category: 'operational',
    description: 'Value stream mapping',
  },
  SOP: {
    name: 'SOP Builder',
    shortName: 'SOP',
    category: 'operational',
    description: 'Standard work creation',
  },
  A3P: {
    name: 'A3 Problem Solving',
    shortName: 'A3P',
    category: 'operational',
    description: 'Root cause analysis',
  },
  SMD: {
    name: 'SMED Planner',
    shortName: 'SMD',
    category: 'operational',
    description: 'Changeover reduction',
  },
  DMS: {
    name: 'DMS Builder',
    shortName: 'DMS',
    category: 'operational',
    description: 'Daily management system',
  },
  AUT: {
    name: 'Automation Pipeline',
    shortName: 'AUT',
    category: 'operational',
    description: 'Automation backlog',
  },
  CON: {
    name: 'Constraint Control',
    shortName: 'CON',
    category: 'operational',
    description: 'Bottleneck management',
  },
  DEC: {
    name: 'Decision Engine',
    shortName: 'DEC',
    category: 'operational',
    description: 'Policy automation',
  },
  CTW: {
    name: 'Control Tower',
    shortName: 'CTW',
    category: 'operational',
    description: 'Shopfloor visibility',
  },
  INV: {
    name: 'Inventory Autopilot',
    shortName: 'INV',
    category: 'operational',
    description: 'Stock optimization',
  },
  // Digital Tools
  ROB: {
    name: 'Robotics Feasibility',
    shortName: 'ROB',
    category: 'digital',
    description: 'Robot deployment analysis',
  },
  LOG: {
    name: 'Logistics Automation',
    shortName: 'LOG',
    category: 'digital',
    description: 'Warehouse automation',
  },
  RPA: {
    name: 'RPA Scanner',
    shortName: 'RPA',
    category: 'digital',
    description: 'Process automation potential',
  },
  AID: {
    name: 'AI Discovery',
    shortName: 'AID',
    category: 'digital',
    description: 'AI use-case readiness',
  },
  INT: {
    name: 'Integration Diagnostic',
    shortName: 'INT',
    category: 'digital',
    description: 'System integration analysis',
  },
  DVP: {
    name: 'Digital Value Pool',
    shortName: 'DVP',
    category: 'digital',
    description: 'Value identification',
  },
  LEG: {
    name: 'Legacy Analyzer',
    shortName: 'LEG',
    category: 'digital',
    description: 'Technical debt assessment',
  },
  DAT: {
    name: 'Data Inventory',
    shortName: 'DAT',
    category: 'digital',
    description: 'Data asset mapping',
  },
  P2S: {
    name: 'Pain-to-Solution',
    shortName: 'P2S',
    category: 'digital',
    description: 'Solution matching',
  },
  SPE: {
    name: 'Pain Explorer',
    shortName: 'SPE',
    category: 'digital',
    description: 'Problem structuring',
  },
  // Automation Tool
  PAI: {
    name: 'Process Automation',
    shortName: 'PAI',
    category: 'automation',
    description: 'Interactive process workshop',
  },
};

// Map tool type from API to short code and category
const TOOL_TYPE_TO_SHORT: Record<string, { short: ToolType; category: ToolCategory }> = {
  'dynamic-swot': { short: 'SWT', category: 'strategic' },
  'market-forces': { short: 'PTR', category: 'strategic' },
  'growth-paths': { short: 'ANS', category: 'strategic' },
  'value-chain': { short: 'VCH', category: 'strategic' },
  'portfolio-priority': { short: 'BCG', category: 'strategic' },
  'ambition-decomposer': { short: 'AMB', category: 'strategic' },
  'focus-tradeoff': { short: 'FOC', category: 'strategic' },
  'risk-uncertainty': { short: 'RSK', category: 'strategic' },
  'capability-mapper': { short: 'CAP', category: 'strategic' },
  'narrative-engine': { short: 'NAR', category: 'strategic' },
  'vsm-builder': { short: 'VSM', category: 'operational' },
  'sop-builder': { short: 'SOP', category: 'operational' },
  'a3-problem-solving': { short: 'A3P', category: 'operational' },
  'smed-planner': { short: 'SMD', category: 'operational' },
  'dms-builder': { short: 'DMS', category: 'operational' },
  'automation-pipeline': { short: 'AUT', category: 'operational' },
  'constraint-control': { short: 'CON', category: 'operational' },
  'decision-engine': { short: 'DEC', category: 'operational' },
  'control-tower': { short: 'CTW', category: 'operational' },
  'inventory-autopilot': { short: 'INV', category: 'operational' },
  'robotics-feasibility': { short: 'ROB', category: 'digital' },
  'logistics-automation': { short: 'LOG', category: 'digital' },
  'rpa-scanner': { short: 'RPA', category: 'digital' },
  'ai-discovery': { short: 'AID', category: 'digital' },
  'integration-diagnostic': { short: 'INT', category: 'digital' },
  'digital-value-pool': { short: 'DVP', category: 'digital' },
  'legacy-analyzer': { short: 'LEG', category: 'digital' },
  'data-inventory': { short: 'DAT', category: 'digital' },
  'pain-to-solution': { short: 'P2S', category: 'digital' },
  'pain-explorer': { short: 'SPE', category: 'digital' },
  'process-automation': { short: 'PAI', category: 'automation' },
};

const SHORT_TO_TOOL_TYPE: Record<string, string> = Object.fromEntries(
  Object.entries(TOOL_TYPE_TO_SHORT).map(([toolType, meta]) => [meta.short, toolType])
);

// Tool session data from API
interface ToolSessionData {
  id: string;
  name: string;
  toolType: string;
  status: string;
  progress: number;
  confidenceAvg: number;
  projectId?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  reviewRequestedAt?: string;
  approvedAt?: string;
}

// Transformed data for display
interface DisplayItem {
  id: string;
  name: string;
  toolType: ToolType;
  category: ToolCategory;
  status: ItemStatus;
  progress: number;
  createdAt?: Date;
  updatedAt: Date;
  projectId?: string;
  createdBy?: string;
  reviewRequestedAt?: Date;
  approvedAt?: Date;
  apiToolType: string; // Original tool type from API
  _fullData?: any; // Full initiative data for detail view
}

type OutputKind = 'assessment_report' | 'report_builder' | 'presentation_deck';

interface OutputItem {
  kind: 'output';
  outputKind: OutputKind;
  id: string;
  name: string;
  status: ItemStatus;
  updatedAt: Date;
  createdAt?: Date;
  projectId?: string;
  /**
   * For traceability / filtering (best-effort)
   * Example: tool_session / assessment / upload_bundle
   */
  sourceType?: string | null;
  sourceId?: string | null;
  _fullData?: any;
}

// Task interface for initiatives
interface InitiativeTask {
  id: string;
  title: string;
  status: 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  assigneeId?: string;
  assigneeName?: string;
  dueDate?: string;
  estimatedHours?: number;
}

// Full initiative data
interface FullInitiativeData {
  id: string;
  name: string;
  title?: string;
  description?: string;
  summary?: string;
  status: string;
  priority?: string;
  axis?: string;
  costCapex?: number;
  costOpex?: number;
  expectedRoi?: number;
  ownerBusinessId?: string;
  ownerExecutionId?: string;
  ownerBusiness?: { firstName: string; lastName: string };
  ownerExecution?: { firstName: string; lastName: string };
  plannedStartDate?: string;
  plannedEndDate?: string;
  tasks?: InitiativeTask[];
  sourceType?: string;
  sourceId?: string;
}

interface DiscoveryToolsHubProps {
  initialTab?: ModuleTab;
  initialCategory?: 'all' | 'strategic' | 'operational' | 'digital' | 'automation' | 'licensed';
}

export const DiscoveryToolsHub: React.FC<DiscoveryToolsHubProps> = ({
  initialTab = 'library',
  initialCategory = 'all',
}) => {
  // V3-E01: Normalize legacy tab ids
  const normalizedInitialTab =
    initialTab === 'list' ? 'sessions' : initialTab === 'reports' ? 'outputs' : initialTab;
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentProjectId } = useAppStore();
  const openChatWithContext = useOpenChatWithContext();
  const addChatMessage = useConversationStore((s) => s.addMessage);
  const { i18n, t } = useTranslation();
  const lang = i18n.language?.startsWith('pl') ? 'pl' : 'en';
  const isPolish = lang === 'pl';
  const {
    setOpen: setHelpOpen,
    setActiveTab: setHelpTab,
    setKnowledgeModuleIdOverride,
  } = useHelpSidePanel();

  // Contextual help available for future global shell/sidebar integration.
  // Removed from Menu 2 right cluster per §2.1 canon (Help belongs to global shell/sidebar).
  const _openContextualHelp = useCallback(() => {
    setKnowledgeModuleIdOverride('discovery-tools');
    setHelpTab('knowledge');
    setHelpOpen(true);
  }, [setHelpOpen, setHelpTab, setKnowledgeModuleIdOverride]);

  // UI State
  const [activeTab, setActiveTab] = useState<ModuleTab>(normalizedInitialTab);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<FilterChip[]>([]);
  const [previewItemId, setPreviewItemId] = useState<string | null>(null);
  const [selectedLibraryIds, setSelectedLibraryIds] = useState<Set<string>>(new Set());
  const [selectedSessionsIds, setSelectedSessionsIds] = useState<Set<string>>(new Set());
  const [selectedReportsIds, setSelectedReportsIds] = useState<Set<string>>(new Set());
  const [previewFullSession, setPreviewFullSession] = useState<any | null>(null);
  const [previewFullLoading, setPreviewFullLoading] = useState(false);
  const [previewFullAssessment, setPreviewFullAssessment] = useState<any | null>(null);
  const [previewFullAssessmentLoading, setPreviewFullAssessmentLoading] = useState(false);
  const [previewKnownTool, setPreviewKnownTool] = useState<KnownToolFull | null>(null);
  const [previewKnownToolLoading, setPreviewKnownToolLoading] = useState(false);
  const [autoExportPdfForId, setAutoExportPdfForId] = useState<string | null>(null);
  const [generateInitiativesForId, setGenerateInitiativesForId] = useState<string | null>(null);
  const [generationDefaults, setGenerationDefaults] = useState({
    methodologyId: 'impact-feasibility',
    count: 3,
    includeChatContext: true,
  });
  const { openDocuments, setOpenDocuments, activeDocumentId, setActiveDocumentId, hydrated } =
    useModuleOpenDocuments('tools');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [libraryCategoryFilter, setLibraryCategoryFilter] = useState<
    'all' | 'strategic' | 'operational' | 'digital' | 'automation' | 'licensed' | 'other'
  >(initialCategory);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const statusDropdownRef = React.useRef<HTMLDivElement>(null);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [addMenuCategory, setAddMenuCategory] = useState<ToolCategory | 'all'>('all');
  const [addMenuQuery, setAddMenuQuery] = useState('');
  const addMenuRef = useRef<HTMLDivElement>(null);

  // #64: AI picker — "Nie wiesz, które wybrać?" (which tool do I pick?)
  const [suggestProblemText, setSuggestProblemText] = useState('');
  const [isSuggestingTool, setIsSuggestingTool] = useState(false);
  const [suggestToolResults, setSuggestToolResults] = useState<Array<{
    toolType: string;
    name: string;
    confidence: 'high' | 'medium' | 'low';
    reasoning: string;
  }> | null>(null);
  const [suggestToolError, setSuggestToolError] = useState<string | null>(null);

  // Reset the AI-picker panel whenever the Add menu is closed, so re-opening
  // it starts clean rather than showing a stale problem description/results.
  useEffect(() => {
    if (!isAddMenuOpen) {
      setSuggestProblemText('');
      setSuggestToolResults(null);
      setSuggestToolError(null);
      setIsSuggestingTool(false);
    }
  }, [isAddMenuOpen]);

  useEffect(() => {
    setLibraryCategoryFilter(initialCategory);
  }, [initialCategory]);

  // Docs-driven strategy catalog (wdrozenia/modules/tools/catalog/strategy/*.md)
  const strategyCatalogSlugs = useMemo(() => listStrategyToolSlugs(), []);
  const titleFromSlug = (slug: string) =>
    String(slug || '')
      .split('-')
      .filter(Boolean)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(' ');

  // Data State
  const [discoveries, setDiscoveries] = useState<DisplayItem[]>([]);
  const [outputs, setOutputs] = useState<OutputItem[]>([]);
  const [initiatives, setInitiatives] = useState<DisplayItem[]>([]);
  const [assessmentSessions, setAssessmentSessions] = useState<
    Array<{
      id: string;
      name: string;
      assessmentType: string;
      status: ItemStatus;
      progress: number;
      createdAt?: Date;
      updatedAt: Date;
      projectId?: string;
      createdBy?: string;
      _fullData?: any;
    }>
  >([]);
  const [knownTools, setKnownTools] = useState<
    Array<{
      id: string;
      toolType: string;
      name: string;
      libraryCategory: string | null;
      description: string;
      whatYouGet: string[];
      tags: string[];
      icon: string | null;
      isLicensed: boolean;
      isActive: boolean;
      isComingSoon: boolean;
      sortOrder: number;
      createdAt: string | null;
    }>
  >([]);
  const [isKnownToolsLoading, setIsKnownToolsLoading] = useState(true);
  const [knownToolsError, setKnownToolsError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // IMPACT-UX-002: Degraded UX Error State
  const [loadError, setLoadError] = useState<{ message: string; isTransportBlock: boolean } | null>(
    null
  );

  // Initiative detail state
  const [selectedInitiative, setSelectedInitiative] = useState<FullInitiativeData | null>(null);
  const [initiativeTasks, setInitiativeTasks] = useState<InitiativeTask[]>([]);
  const [isLoadingInitiative, setIsLoadingInitiative] = useState(false);

  // #69: org users, for resolving createdBy → display name in the Author column.
  const [orgUsers, setOrgUsers] = useState<
    Array<{ id: string; firstName: string; lastName: string }>
  >([]);
  useEffect(() => {
    let cancelled = false;
    Api.getUsers()
      .then((fetched) => {
        if (!cancelled) setOrgUsers(fetched || []);
      })
      .catch((err) => console.error('Failed to load users for Author column', err));
    return () => {
      cancelled = true;
    };
  }, []);
  const authorNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of orgUsers) {
      map.set(u.id, `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.id);
    }
    return map;
  }, [orgUsers]);
  const getAuthorLabel = useCallback(
    (createdBy?: string | null) => {
      if (!createdBy) return '';
      return authorNameById.get(createdBy) || createdBy;
    },
    [authorNameById]
  );

  // Transform API data to display format
  const transformToolSession = useCallback((session: ToolSessionData): DisplayItem => {
    const mapping = TOOL_TYPE_TO_SHORT[session.toolType] || {
      short: 'SWT' as ToolType,
      category: 'strategic' as ToolCategory,
    };
    const statusMap: Record<string, ItemStatus> = {
      DRAFT: 'DRAFT',
      REVIEW: 'PENDING_REVIEW',
      APPROVED: 'APPROVED',
      GENERATED: 'DONE',
      COMPLETED: 'DONE',
    };
    return {
      id: session.id,
      name: session.name,
      toolType: mapping.short,
      category: mapping.category,
      status: statusMap[session.status?.toUpperCase()] || 'DRAFT',
      progress: session.progress || 0,
      createdAt: session.createdAt ? new Date(session.createdAt) : undefined,
      updatedAt: session.updatedAt ? new Date(session.updatedAt) : new Date(),
      projectId: session.projectId,
      createdBy: session.createdBy,
      reviewRequestedAt: session.reviewRequestedAt
        ? new Date(session.reviewRequestedAt)
        : undefined,
      approvedAt: session.approvedAt ? new Date(session.approvedAt) : undefined,
      apiToolType: session.toolType,
    };
  }, []);

  const transformAssessmentSession = useCallback((session: any) => {
    const rawType =
      String(
        session?.assessmentType ||
          session?.assessment_type ||
          session?.framework ||
          session?.type ||
          ''
      ).trim() || 'DRD';
    const rawName = String(session?.name || session?.title || '').trim();

    const statusMap: Record<string, ItemStatus> = {
      DRAFT: 'DRAFT',
      IN_PROGRESS: 'EXECUTING',
      EXECUTING: 'EXECUTING',
      REVIEW: 'PENDING_REVIEW',
      IN_REVIEW: 'PENDING_REVIEW',
      PENDING_REVIEW: 'PENDING_REVIEW',
      APPROVED: 'APPROVED',
      GENERATED: 'DONE',
      COMPLETED: 'DONE',
      DONE: 'DONE',
    };

    const status = statusMap[String(session?.status || 'DRAFT').toUpperCase()] || 'DRAFT';
    const progressRaw =
      session?.completionPercent ??
      session?.completion_percent ??
      session?.progress ??
      session?.completion ??
      0;
    const progress = Number.isFinite(Number(progressRaw)) ? Number(progressRaw) : 0;

    return {
      id: String(session?.id || ''),
      name: rawName || `${rawType} Assessment`,
      assessmentType: rawType,
      status,
      progress,
      createdAt: session?.createdAt ? new Date(session.createdAt) : undefined,
      updatedAt: session?.updatedAt ? new Date(session.updatedAt) : new Date(),
      projectId: session?.projectId || session?.project_id,
      // #69: Author column — backend v8/assessment.routes.ts list endpoint spreads
      // raw DB rows (snake_case), other assessment call sites may return camelCase.
      createdBy: session?.createdBy || session?.created_by,
      _fullData: session,
    };
  }, []);

  const resolveBootstrapRequest = useCallback(
    async <T,>(label: string, promise: Promise<T>, fallback: T, timeoutMs = 8000): Promise<T> => {
      try {
        return await Promise.race<T>([
          promise,
          new Promise<T>((_, reject) =>
            window.setTimeout(() => reject(new Error(`${label} bootstrap timeout`)), timeoutMs)
          ),
        ]);
      } catch (error: any) {
        const status = Number(error?.status || error?.data?.status || 0);
        const code = String(error?.code || error?.data?.code || '');
        if (status >= 500 || code === 'CLIENT_TRANSPORT_GLOBAL_CIRCUIT_OPEN') {
          throw error;
        }
        console.warn(`[DiscoveryToolsHub] ${label} bootstrap fallback:`, error);
        return fallback;
      }
    },
    []
  );

  // Fetch data from API
  const fetchData = useCallback(
    async (showRefreshIndicator = false) => {
      if (showRefreshIndicator) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setLoadError(null);

      try {
        const [toolSessionsRes, assessmentRes, assessmentReports, reportBuilderList, decksList] =
          await Promise.all([
            resolveBootstrapRequest(
              'tool sessions',
              Api.listToolSessions({
                projectId: currentProjectId || undefined,
              }),
              { items: [] as ToolSessionData[], total: 0, limit: 0, offset: 0 }
            ),
            resolveBootstrapRequest(
              'assessments',
              Api.listAssessments({
                projectId: currentProjectId || undefined,
                limit: 100,
                offset: 0,
              }),
              { items: [] as any[], total: 0, limit: 100, offset: 0 }
            ),
            resolveBootstrapRequest(
              'assessment reports',
              Api.getAssessmentReports(currentProjectId || undefined),
              [] as any[]
            ),
            resolveBootstrapRequest('report builder list', Api.get('/report-builder'), {
              reports: [] as any[],
            }),
            resolveBootstrapRequest('presentation decks', Api.get('/presentations/decks'), {
              success: true,
              data: [] as any[],
            }),
          ]);

        const allSessions = (toolSessionsRes.items || []).map(transformToolSession);
        const allAssessments = ((assessmentRes as any)?.items || []).map(
          transformAssessmentSession
        );

        // Split by status for different tabs
        // Discovery: DRAFT, REVIEW (work in progress)
        const discoveryItems = allSessions.filter(
          (s) => s.status === 'DRAFT' || s.status === 'PENDING_REVIEW'
        );
        setDiscoveries(discoveryItems);

        // Reports & Presentations: real artifacts (assessment reports, report builder reports, decks)
        const mapOutputStatus = (raw: any): ItemStatus => {
          const s = String(raw || '').toUpperCase();
          const map: Record<string, ItemStatus> = {
            DRAFT: 'DRAFT',
            GENERATING: 'EXECUTING',
            IN_PROGRESS: 'EXECUTING',
            PENDING_APPROVAL: 'PENDING_REVIEW',
            IN_REVIEW: 'PENDING_REVIEW',
            REVIEW: 'PENDING_REVIEW',
            APPROVED: 'APPROVED',
            FINAL: 'DONE',
            COMPLETED: 'DONE',
            DONE: 'DONE',
            UTILIZED: 'DONE',
            REJECTED: 'CANCELLED',
            ARCHIVED: 'ARCHIVED',
            CANCELLED: 'CANCELLED',
            FAILED: 'BLOCKED',
            ERROR: 'BLOCKED',
          };
          return map[s] || 'DRAFT';
        };

        const normalizeDate = (v: any): Date => {
          try {
            const d = v ? new Date(v) : new Date();
            return Number.isFinite(d.getTime()) ? d : new Date();
          } catch {
            return new Date();
          }
        };

        const assessmentReportRows: OutputItem[] = (
          Array.isArray(assessmentReports) ? assessmentReports : []
        )
          .slice(0, 200)
          .map((r: any) => ({
            kind: 'output' as const,
            outputKind: 'assessment_report' as const,
            id: String(r?.id || ''),
            name: String(r?.name || r?.title || 'Assessment Report'),
            status: mapOutputStatus(r?.status),
            createdAt: r?.createdAt ? normalizeDate(r.createdAt) : undefined,
            updatedAt: normalizeDate(
              r?.updatedAt || r?.updated_at || r?.createdAt || r?.created_at
            ),
            projectId: r?.projectId || r?.project_id || currentProjectId || undefined,
            sourceType: 'assessment',
            sourceId: r?.assessmentId || r?.assessment_id || null,
            _fullData: r,
          }))
          .filter((r: any) => Boolean(r.id));

        const reportBuilderRowsRaw =
          (reportBuilderList as any)?.reports || (reportBuilderList as any)?.data || [];
        const reportBuilderRows: OutputItem[] = (
          Array.isArray(reportBuilderRowsRaw) ? reportBuilderRowsRaw : []
        )
          .slice(0, 200)
          .map((r: any) => ({
            kind: 'output' as const,
            outputKind: 'report_builder' as const,
            id: String(r?.id || ''),
            name: String(r?.title || r?.name || 'Report'),
            status: mapOutputStatus(r?.status),
            createdAt: r?.createdAt
              ? normalizeDate(r.createdAt)
              : r?.created_at
                ? normalizeDate(r.created_at)
                : undefined,
            updatedAt: normalizeDate(
              r?.updatedAt || r?.updated_at || r?.createdAt || r?.created_at
            ),
            projectId: currentProjectId || undefined,
            sourceType: r?.sourceType || r?.source_type || null,
            sourceId: r?.sourceId || r?.source_id || null,
            _fullData: r,
          }))
          .filter((r: any) => Boolean(r.id));

        const decksRaw = (decksList as any)?.data || [];
        const deckRows: OutputItem[] = (Array.isArray(decksRaw) ? decksRaw : [])
          .slice(0, 200)
          .map((d: any) => ({
            kind: 'output' as const,
            outputKind: 'presentation_deck' as const,
            id: String(d?.id || ''),
            name: String(d?.title || 'Presentation'),
            status: mapOutputStatus(d?.status),
            createdAt: d?.created_at ? normalizeDate(d.created_at) : undefined,
            updatedAt: normalizeDate(d?.updated_at || d?.updatedAt || d?.created_at),
            projectId: currentProjectId || undefined,
            sourceType: null,
            sourceId: null,
            _fullData: d,
          }))
          .filter((r: any) => Boolean(r.id));

        const mergedOutputs = [...assessmentReportRows, ...reportBuilderRows, ...deckRows].sort(
          (a, b) => Number(b.updatedAt.getTime()) - Number(a.updatedAt.getTime())
        );
        setOutputs(mergedOutputs);

        const inProgressAssessments = allAssessments.filter(
          (a: any) =>
            a.status === 'DRAFT' ||
            a.status === 'PENDING_REVIEW' ||
            a.status === 'EXECUTING' ||
            a.status === 'PLANNING'
        );
        setAssessmentSessions(inProgressAssessments);

        // Initiatives: Fetch initiatives derived from tools/assessments (traceability).
        try {
          const initiativesList = await Api.getInitiativesByStatus(
            [
              'DRAFT',
              'PENDING_REVIEW',
              'REVIEW',
              'PLANNING',
              'APPROVED',
              'SCHEDULED',
              'EXECUTING',
              'BLOCKED',
              'DONE',
              'TRACKING',
              'CANCELLED',
            ].join(','),
            currentProjectId || undefined
          );

          // Map initiatives to display format
          const traceable = (initiativesList || []).filter((i: any) => {
            const st = String(i?.sourceType || i?.source_type || '').toLowerCase();
            const sid = String(i?.sourceId || i?.source_id || '').trim();
            if (!sid) return false;
            // We treat only tool/assessment-derived initiatives as part of Tools hub "Initiatives".
            return (
              st === 'tool' ||
              st === 'assessment' ||
              st === 'assessment_report' ||
              st === 'assessment_drd' ||
              st === 'assessment_siri' ||
              st === 'assessment_adma'
            );
          });

          const rows = traceable.slice(0, 150).map((i: any) => ({
            id: i.id,
            name: i.title || i.name || 'Untitled Initiative',
            toolType: 'SWT' as ToolType,
            category: (i.axis === 'strategic'
              ? 'strategic'
              : i.axis === 'operational'
                ? 'operational'
                : i.axis === 'digital'
                  ? 'digital'
                  : 'strategic') as ToolCategory,
            status: mapStatusToUppercase(String(i.status || 'DRAFT')),
            progress: i.progress || 0,
            updatedAt: i.updatedAt ? new Date(i.updatedAt) : new Date(),
            apiToolType: 'initiative',
            // Keep full initiative data for detail view
            _fullData: i,
          }));
          setInitiatives(rows);
        } catch (err) {
          console.warn('[DiscoveryToolsHub] Failed to fetch initiatives:', err);
          setInitiatives([]);
        }
      } catch (error: any) {
        console.error('[DiscoveryToolsHub] Fetch error:', error);
        const isTransportBlock =
          error?.code === 'CLIENT_TRANSPORT_GLOBAL_CIRCUIT_OPEN' ||
          error?.message?.includes('transport safeguard');
        setLoadError({
          message: error?.message || 'Failed to load tools data',
          isTransportBlock,
        });
        toast.error('Failed to load tool sessions');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [currentProjectId, resolveBootstrapRequest, transformAssessmentSession, transformToolSession]
  );

  // Fetch data on mount and when projectId changes
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fetchKnownTools = useCallback(async () => {
    setIsKnownToolsLoading(true);
    setKnownToolsError(null);
    try {
      const res = await Api.getKnownTools({ lang, limit: 50, offset: 0 });
      setKnownTools(res.items || []);
    } catch (error: any) {
      console.warn('[DiscoveryToolsHub] Failed to fetch known tools:', error);
      setKnownToolsError(
        error?.message ||
          (lang === 'pl'
            ? 'Nie udało się załadować katalogu narzędzi.'
            : 'Failed to load the tools catalog.')
      );
    } finally {
      setIsKnownToolsLoading(false);
    }
  }, [lang]);

  useEffect(() => {
    fetchKnownTools();
  }, [fetchKnownTools]);

  useEffect(() => {
    trackFunnelEvent('tools_hub_opened', { module: 'tools' });
  }, []);

  // Fetch initiative details with tasks (used by preview + full open)
  const fetchInitiativeDetails = useCallback(async (initiativeId: string) => {
    setIsLoadingInitiative(true);
    try {
      // Fetch initiative details
      const initiative = await Api.getInitiativeById(initiativeId);
      setSelectedInitiative({
        id: initiative.id,
        name: initiative.name || initiative.title || 'Untitled',
        title: initiative.title,
        description: initiative.description,
        summary: initiative.summary,
        status: initiative.status,
        priority: initiative.priority,
        axis: initiative.axis,
        costCapex: initiative.costCapex || initiative.cost_capex,
        costOpex: initiative.costOpex || initiative.cost_opex,
        expectedRoi: initiative.expectedRoi || initiative.expected_roi,
        ownerBusinessId: initiative.ownerBusinessId || initiative.owner_business_id,
        ownerExecutionId: initiative.ownerExecutionId || initiative.owner_execution_id,
        ownerBusiness: initiative.ownerBusiness,
        ownerExecution: initiative.ownerExecution,
        plannedStartDate: initiative.plannedStartDate || initiative.planned_start_date,
        plannedEndDate: initiative.plannedEndDate || initiative.planned_end_date,
        tasks: initiative.tasks || [],
        sourceType: initiative.sourceType || initiative.source_type,
        sourceId: initiative.sourceId || initiative.source_id,
      });

      // Fetch tasks for this initiative
      try {
        const tasks = await Api.getInitiativeTasks(initiativeId);
        setInitiativeTasks(
          tasks.map((t: any) => ({
            id: t.id,
            title: t.title || t.name,
            status: t.status || 'TODO',
            priority: t.priority || 'MEDIUM',
            assigneeId: t.assigneeId || t.assignee_id,
            assigneeName: t.assignee?.firstName
              ? `${t.assignee.firstName} ${t.assignee.lastName}`
              : undefined,
            dueDate: t.dueDate || t.due_date,
            estimatedHours: t.estimatedHours || t.estimated_hours,
          }))
        );
      } catch {
        setInitiativeTasks([]);
      }
    } catch (error) {
      console.error('[DiscoveryToolsHub] Failed to fetch initiative details:', error);
      toast.error('Failed to load initiative details');
    } finally {
      setIsLoadingInitiative(false);
    }
  }, []);

  const submitInitiativeForReviewById = useCallback(
    async (initiativeId: string) => {
      const id = String(initiativeId || '').trim();
      if (!id) return;
      try {
        await Api.patch(`/initiatives/${id}/status`, { status: 'REVIEW' });
        toast.success(
          isPolish ? 'Wysłano inicjatywę do review' : 'Initiative submitted for review',
          {
            duration: 2000,
          }
        );
        await fetchData(true);
        await fetchInitiativeDetails(id);
      } catch (error: any) {
        toast.error(
          error?.response?.data?.error ||
            (isPolish ? 'Nie udało się wysłać do review' : 'Failed to submit for review')
        );
      }
    },
    [fetchData, fetchInitiativeDetails, isPolish]
  );

  // Reset status filter when tab changes
  useEffect(() => {
    setStatusFilter('all');
    setPreviewItemId(null);
    setPreviewFullSession(null);
    setPreviewFullLoading(false);
    setPreviewFullAssessment(null);
    setPreviewFullAssessmentLoading(false);
    setIsAddMenuOpen(false);
    setAddMenuCategory('all');
    setAddMenuQuery('');
  }, [activeTab]);

  // KANON: entering full view or switching away from table should close preview.
  useEffect(() => {
    if (activeDocumentId) setPreviewItemId(null);
  }, [activeDocumentId]);

  useEffect(() => {
    const supportsPreview =
      viewMode === 'table' || (activeTab === 'library' && viewMode === 'grid');
    if (!supportsPreview) setPreviewItemId(null);
  }, [activeTab, viewMode]);

  // View modes: we currently support Grid only in Library.
  useEffect(() => {
    if (activeTab !== 'library' && viewMode === 'grid') setViewMode('table');
  }, [activeTab, viewMode]);

  // Tools → Initiatives: preview needs richer data (owners/tasks), so fetch on selection.
  useEffect(() => {
    if (activeTab !== 'initiatives') return;
    if (!previewItemId) return;
    void fetchInitiativeDetails(previewItemId);
  }, [activeTab, fetchInitiativeDetails, previewItemId]);

  // Tools → Sessions: fetch full session for canonical preview.
  useEffect(() => {
    const shouldFetch =
      Boolean(previewItemId) && (activeTab === 'sessions' || activeTab === 'list');
    if (!shouldFetch) {
      setPreviewFullSession(null);
      setPreviewFullLoading(false);
      setPreviewFullAssessment(null);
      setPreviewFullAssessmentLoading(false);
      return;
    }

    let cancelled = false;
    const isAssessment =
      activeTab === 'sessions' &&
      (assessmentSessions || []).some((a) => String(a.id) === String(previewItemId));

    if (isAssessment) {
      setPreviewFullAssessment(null);
      setPreviewFullAssessmentLoading(true);
      setPreviewFullSession(null);
      setPreviewFullLoading(false);

      Api.getAssessmentSession(String(previewItemId))
        .then((res) => {
          if (cancelled) return;
          setPreviewFullAssessment(res || null);
        })
        .catch(() => {
          if (cancelled) return;
          setPreviewFullAssessment(null);
        })
        .finally(() => {
          if (cancelled) return;
          setPreviewFullAssessmentLoading(false);
        });
    } else {
      setPreviewFullSession(null);
      setPreviewFullLoading(true);
      setPreviewFullAssessment(null);
      setPreviewFullAssessmentLoading(false);

      Api.getToolSession(String(previewItemId))
        .then((res) => {
          if (cancelled) return;
          setPreviewFullSession(res || null);
        })
        .catch(() => {
          if (cancelled) return;
          setPreviewFullSession(null);
        })
        .finally(() => {
          if (cancelled) return;
          setPreviewFullLoading(false);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [activeTab, assessmentSessions, previewItemId]);

  // Tools → Library: fetch full known tool details for canonical preview.
  useEffect(() => {
    const shouldFetch = Boolean(previewItemId) && activeTab === 'library';
    if (!shouldFetch) {
      setPreviewKnownTool(null);
      setPreviewKnownToolLoading(false);
      return;
    }

    if (String(previewItemId || '').startsWith('assessment:')) {
      setPreviewKnownTool(null);
      setPreviewKnownToolLoading(false);
      return;
    }

    const selected = knownTools.find((k) => k.id === previewItemId);
    if (selected && !selected.isActive) {
      setPreviewKnownTool(null);
      setPreviewKnownToolLoading(false);
      return;
    }
    if (!selected && String(previewItemId || '').startsWith('tool:')) {
      setPreviewKnownTool(null);
      setPreviewKnownToolLoading(false);
      return;
    }
    const toolType =
      String(previewItemId) === 'tool:process-automation'
        ? 'process-automation'
        : String(selected?.toolType || '').trim();
    if (!toolType) {
      setPreviewKnownTool(null);
      setPreviewKnownToolLoading(false);
      return;
    }

    let cancelled = false;
    setPreviewKnownTool(null);
    setPreviewKnownToolLoading(true);
    Api.getKnownTool(toolType, { lang })
      .then((res) => {
        if (cancelled) return;
        setPreviewKnownTool((res as any)?.tool || null);
      })
      .catch(() => {
        if (cancelled) return;
        setPreviewKnownTool(null);
      })
      .finally(() => {
        if (cancelled) return;
        setPreviewKnownToolLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab, lang, knownTools, previewItemId]);

  // Close status dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setIsStatusDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Get status options based on active tab
  const currentStatusOptions = useMemo(() => {
    switch (activeTab) {
      case 'sessions':
      case 'list':
        return DISCOVERY_STATUSES;
      case 'outputs':
      case 'reports':
        return REPORTS_STATUSES;
      case 'initiatives':
        return INITIATIVES_STATUSES;
      default:
        return DISCOVERY_STATUSES;
    }
  }, [activeTab]);

  // Get selected status option
  const selectedStatusOption = useMemo(() => {
    return currentStatusOptions.find((opt) => opt.id === statusFilter) || currentStatusOptions[0];
  }, [currentStatusOptions, statusFilter]);

  // Tab configuration with dynamic counts
  const tabs = useMemo(() => {
    const hasAutomationInKnownTools = (knownTools || []).some(
      (k) => String(k?.toolType || '').trim() === 'process-automation'
    );
    const libraryCount =
      isKnownToolsLoading && knownTools.length === 0
        ? 0
        : (knownTools || []).length +
          Object.keys(ASSESSMENT_FRAMEWORK_META).length +
          (hasAutomationInKnownTools ? 0 : 1);

    return [
      {
        id: 'library' as ModuleTab,
        label: t('tools.hub.tabs.library', 'Library'),
        icon: <Library size={16} />,
        count: libraryCount,
      },
      {
        id: 'sessions' as ModuleTab,
        label: t('tools.hub.tabs.sessions', 'Sessions'),
        icon: <Play size={16} />,
        count: discoveries.length + assessmentSessions.length,
      },
      {
        id: 'outputs' as ModuleTab,
        label: isPolish ? 'Raporty i prezentacje' : 'Reports & Presentations',
        icon: <FolderOutput size={16} />,
        count: outputs.length,
      },
      {
        id: 'initiatives' as ModuleTab,
        label: t('tools.hub.tabs.initiatives', 'Initiatives'),
        icon: <Lightbulb size={16} />,
        count: initiatives.length,
      },
    ];
  }, [
    assessmentSessions.length,
    discoveries.length,
    initiatives.length,
    isPolish,
    knownTools,
    outputs.length,
    t,
    isKnownToolsLoading,
  ]);

  // Table columns
  const discoveryColumns: TableColumn[] = useMemo(
    () => [
      {
        id: 'toolType',
        label: t('tools.hub.table.type', 'Type'),
        width: '120px',
        filterable: true,
        filterOptions: Object.entries(TOOL_META).map(([key, meta]) => ({
          value: key,
          label: `${meta.shortName} - ${meta.name}`,
        })),
        render: (row) => {
          const meta = TOOL_META[row.toolType as ToolType];
          const categoryMeta = CATEGORY_META[meta?.category || 'strategic'];
          return (
            <div className="flex items-center gap-2">
              <span className={categoryMeta.textClass}>{categoryMeta.icon}</span>
              <span className="font-mono text-xs font-bold text-c-text-secondary">
                {meta?.shortName || row.toolType}
              </span>
            </div>
          );
        },
      },
      {
        id: 'name',
        label: t('tools.hub.table.name', 'Name'),
        render: (row) => (
          <div className="min-w-0">
            <span className="block text-sm font-semibold text-c-text truncate">
              {String(row.name || '')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')}
            </span>
          </div>
        ),
      },
      {
        id: 'category',
        label: t('tools.hub.table.category', 'Category'),
        width: '130px',
        filterable: true,
        filterOptions: Object.entries(CATEGORY_META).map(([key, meta]) => ({
          value: key,
          label: meta.name,
        })),
        render: (row) => {
          const meta = CATEGORY_META[row.category as ToolCategory];
          return (
            <ChipBase
              leading={
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${meta?.dotClass || 'bg-c-text-muted'}`}
                />
              }
            >
              {meta?.name || row.category}
            </ChipBase>
          );
        },
      },
      {
        id: 'status',
        label: t('tools.hub.table.status', 'Status'),
        width: '140px',
        filterable: true,
        filterOptions: [
          { value: 'draft', label: t('common.draft', 'Draft'), color: 'bg-c-text-muted' },
          {
            value: 'pending_review',
            label: t('common.pendingReview', 'Pending Review'),
            color: 'bg-amber-400',
          },
          { value: 'approved', label: t('common.approved', 'Approved'), color: 'bg-emerald-400' },
          { value: 'done', label: t('common.completed', 'Completed'), color: 'bg-emerald-400' },
        ],
      },
      {
        id: 'progress',
        label: t('tools.hub.table.progress', 'Progress'),
        width: '150px',
      },
      {
        id: 'createdBy',
        label: t('tools.hub.table.author', 'Author'),
        width: '140px',
        render: (row) => {
          const label = getAuthorLabel(row?.createdBy);
          return label ? (
            <span className="text-sm text-c-text truncate">{label}</span>
          ) : (
            <span className="text-sm text-slate-400">—</span>
          );
        },
      },
      {
        id: 'updatedAt',
        label: t('tools.hub.table.updated', 'Updated'),
        width: '120px',
        sortable: true,
      },
    ],
    [t, getAuthorLabel]
  );

  const sessionsColumns: TableColumn[] = useMemo(
    () => [
      {
        id: 'sessionType',
        label: t('tools.hub.table.type', 'Type'),
        width: '160px',
        filterable: true,
        filterOptions: [
          ...Object.entries(TOOL_META).map(([key, meta]) => ({
            value: meta.shortName,
            label: `${meta.shortName} - ${meta.name}`,
          })),
          ...(Object.keys(ASSESSMENT_FRAMEWORK_META) as AssessmentFramework[]).map((fw) => ({
            value: fw,
            label: `${fw} - ${ASSESSMENT_FRAMEWORK_META[fw].name}`,
          })),
        ],
        render: (row: any) => {
          if (row?.kind === 'assessmentSession') {
            const fw = String(row.assessmentType || row.sessionType || '').toUpperCase();
            const meta = (ASSESSMENT_FRAMEWORK_META as any)?.[fw];
            return (
              <div className="flex items-center gap-2">
                <span className="text-danger-400">{meta?.icon || <Shield size={16} />}</span>
                <span className="font-mono text-xs font-bold text-c-text-secondary">
                  {fw || 'ASSESS'}
                </span>
              </div>
            );
          }
          const toolCode = String(row?.toolType || row?.sessionType || '');
          const meta = TOOL_META[toolCode as ToolType];
          const categoryMeta = CATEGORY_META[meta?.category || 'strategic'];
          return (
            <div className="flex items-center gap-2">
              <span className={categoryMeta.textClass}>{categoryMeta.icon}</span>
              <span className="font-mono text-xs font-bold text-c-text-secondary">
                {meta?.shortName || toolCode}
              </span>
            </div>
          );
        },
      },
      {
        id: 'name',
        label: t('tools.hub.table.name', 'Name'),
        render: (row: any) => (
          <div className="min-w-0">
            <span className="block text-sm font-semibold text-c-text truncate">
              {String(row.name || '')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')}
            </span>
          </div>
        ),
      },
      {
        id: 'category',
        label: t('tools.hub.table.category', 'Category'),
        width: '130px',
        filterable: true,
        filterOptions: Object.entries(CATEGORY_META).map(([key, meta]) => ({
          value: key,
          label: meta.name,
        })),
        render: (row: any) => {
          const meta = CATEGORY_META[row.category as ToolCategory];
          return (
            <ChipBase
              leading={
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${meta?.dotClass || 'bg-c-text-muted'}`}
                />
              }
            >
              {meta?.name || row.category}
            </ChipBase>
          );
        },
      },
      {
        id: 'status',
        label: t('tools.hub.table.status', 'Status'),
        width: '140px',
        filterable: true,
        filterOptions: [
          { value: 'draft', label: t('common.draft', 'Draft'), color: 'bg-c-text-muted' },
          {
            value: 'executing',
            label: t('common.inProgress', 'In Progress'),
            color: 'bg-blue-400',
          },
          {
            value: 'pending_review',
            label: t('common.pendingReview', 'Pending Review'),
            color: 'bg-amber-400',
          },
          { value: 'approved', label: t('common.approved', 'Approved'), color: 'bg-emerald-400' },
          { value: 'done', label: t('common.done', 'Done'), color: 'bg-emerald-400' },
        ],
      },
      {
        id: 'progress',
        label: t('tools.hub.table.progress', 'Progress'),
        width: '150px',
      },
      {
        id: 'createdBy',
        label: t('tools.hub.table.author', 'Author'),
        width: '140px',
        render: (row: any) => {
          const label = getAuthorLabel(row?.createdBy);
          return label ? (
            <span className="text-sm text-c-text truncate">{label}</span>
          ) : (
            <span className="text-sm text-slate-400">—</span>
          );
        },
      },
      {
        id: 'updatedAt',
        label: t('tools.hub.table.updated', 'Updated'),
        width: '120px',
        sortable: true,
      },
    ],
    [t, getAuthorLabel]
  );

  const libraryColumns: TableColumn[] = useMemo(
    () => [
      {
        id: 'name',
        label: t('tools.hub.table.tool', 'Tool'),
        width: '200px',
        render: (row) => (
          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <div
                className={`truncate text-sm font-semibold ${
                  row.isActive ? 'text-c-text' : 'text-c-text-muted'
                }`}
                title={String(row.name || '').replace(/&amp;/g, '&')}
              >
                {String(row.name || '')
                  .replace(/&amp;/g, '&')
                  .replace(/&lt;/g, '<')
                  .replace(/&gt;/g, '>')}
              </div>
              {row.isComingSoon ? (
                <span className="shrink-0 inline-flex items-center h-5 px-1.5 rounded-full text-[10px] border border-slate-200/60 dark:border-white/[0.03] bg-c-surface-raised text-c-text-muted">
                  {t('common.comingSoon', 'Soon')}
                </span>
              ) : null}
            </div>
          </div>
        ),
      },
      {
        id: 'libraryCategory',
        label: t('tools.hub.table.category', 'Category'),
        width: '110px',
        filterable: true,
        filterOptions: Object.entries(CATEGORY_META).map(([key, meta]) => ({
          value: key,
          label: meta.name,
        })),
        render: (row) => {
          const category = (row.libraryCategory || '') as ToolCategory;
          const meta = CATEGORY_META[category];
          return (
            <span className={`text-xs font-medium ${meta?.textClass || 'text-c-text-secondary'}`}>
              {meta?.name || row.libraryCategory || '-'}
            </span>
          );
        },
      },
      {
        id: 'tags',
        label: t('tools.hub.table.tags', 'Tags'),
        width: '200px',
        render: (row) => (
          <div className="flex items-center gap-1 overflow-hidden">
            {(row.tags || []).slice(0, 3).map((tag: string) => (
              <span
                key={tag}
                className="shrink-0 px-1.5 py-px rounded text-[10px] bg-c-surface-raised text-c-text-secondary border border-c-border-subtle truncate max-w-[80px]"
                title={tag}
              >
                {tag}
              </span>
            ))}
            {(row.tags || []).length > 3 ? (
              <span className="shrink-0 text-[10px] text-c-text-muted">
                +{(row.tags || []).length - 3}
              </span>
            ) : null}
          </div>
        ),
      },
      {
        id: 'license',
        label: t('tools.hub.table.license', 'License'),
        width: '100px',
        filterable: true,
        filterOptions: [
          { value: 'licensed', label: t('tools.hub.license.licensed', 'Licensed') },
          { value: 'free', label: t('tools.hub.license.free', 'Free') },
        ],
        render: (row) => (
          // canon §4.0a: neutral chip shell; signal carried by the leading dot.
          <span className="inline-flex items-center gap-1.5 h-6 px-2 rounded-full text-[11px] font-medium border border-slate-200/60 dark:border-white/[0.03] bg-c-surface-raised text-c-text-secondary">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                row.isLicensed ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
            />
            {row.isLicensed
              ? t('tools.hub.license.licensed', 'Licensed')
              : t('tools.hub.license.free', 'Free')}
          </span>
        ),
      },
      {
        id: 'availability',
        label: isPolish ? 'Status' : 'Status',
        width: '120px',
        filterable: true,
        filterOptions: [
          { value: 'active', label: isPolish ? 'Aktywny' : 'Active' },
          { value: 'inactive', label: isPolish ? 'Nieaktywny' : 'Inactive' },
        ],
        render: (row) => (
          // canon §3.5/§4.0: status carried by signal dot only; chip shell stays neutral
          // (no status-colored background fill).
          <span className="inline-flex items-center gap-1.5 h-6 px-2 rounded-full text-[11px] font-medium border border-slate-200/60 dark:border-white/[0.03] bg-c-surface-raised text-c-text-secondary">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                row.isActive ? 'bg-emerald-500' : 'bg-c-text-muted'
              }`}
            />
            {row.isActive
              ? isPolish
                ? 'Aktywny'
                : 'Active'
              : isPolish
                ? 'Nieaktywny'
                : 'Inactive'}
          </span>
        ),
      },
    ],
    [isPolish, t]
  );

  // Columns for Initiatives tab
  const initiativeColumns: TableColumn[] = useMemo(
    () => [
      {
        id: 'name',
        label: t('tools.hub.initiatives.columns.initiative', 'Initiative'),
        render: (row) => (
          <div className="min-w-0">
            <span className="block text-sm font-semibold text-c-text truncate">{row.name}</span>
          </div>
        ),
      },
      {
        id: 'category',
        label: t('tools.hub.initiatives.columns.axis', 'Axis'),
        width: '120px',
        filterable: true,
        filterOptions: [
          { value: 'strategic', label: t('tools.axis.strategic', 'Strategic') },
          { value: 'operational', label: t('tools.axis.operational', 'Operational') },
          { value: 'digital', label: t('tools.axis.digital', 'Digital') },
        ],
        render: (row) => {
          const axisColors: Record<string, string> = {
            strategic: 'text-c-text-secondary',
            operational: 'text-c-text-secondary',
            digital: 'text-c-text-secondary',
          };
          return (
            <span
              className={`text-xs font-medium capitalize ${axisColors[row.category] || 'text-c-text-secondary'}`}
            >
              {row.category}
            </span>
          );
        },
      },
      {
        id: 'priority',
        label: t('tools.hub.initiatives.columns.priority', 'Priority'),
        width: '100px',
        render: (row) => {
          const priority = String(row._fullData?.priority || 'MEDIUM').toUpperCase();
          const levels: Record<string, PriorityLevel> = {
            CRITICAL: 'urgent',
            HIGH: 'high',
            MEDIUM: 'medium',
            LOW: 'low',
          };
          return <PriorityChip level={levels[priority] || 'medium'} label={priority} />;
        },
      },
      {
        id: 'status',
        label: t('tools.hub.initiatives.columns.status', 'Status'),
        width: '100px',
      },
      {
        id: 'roi',
        label: 'ROI',
        width: '80px',
        render: (row) => {
          const roi = row._fullData?.expectedRoi || row._fullData?.expected_roi;
          return (
            <span className={`text-xs font-medium ${roi ? 'text-green-400' : 'text-c-text-muted'}`}>
              {formatRoiDisplay(roi)}
            </span>
          );
        },
      },
      {
        id: 'tasks',
        label: t('tools.hub.initiatives.columns.tasks', 'Tasks'),
        width: '80px',
        render: (row) => {
          const taskCount = row._fullData?.tasks?.length || 0;
          return (
            <span className="text-xs text-c-text-secondary flex items-center gap-1">
              <ListTodo size={12} />
              {taskCount}
            </span>
          );
        },
      },
      {
        id: 'updatedAt',
        label: t('tools.hub.initiatives.columns.updated', 'Updated'),
        width: '120px',
        sortable: true,
      },
    ],
    [t]
  );

  const outputsColumns: TableColumn[] = useMemo(
    () => [
      {
        id: 'outputKind',
        label: t('tools.hub.outputs.columns.type', 'Type'),
        width: '150px',
        render: (row: any) => {
          const kind = String(row?.outputKind || '');
          const cfg: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
            assessment_report: {
              icon: <Activity size={14} />,
              label: isPolish ? 'Raport assessment' : 'Assessment report',
              color: 'text-blue-400',
            },
            report_builder: {
              icon: <FileText size={14} />,
              label: isPolish ? 'Raport' : 'Report',
              color: 'text-blue-400',
            },
            presentation_deck: {
              icon: <Layers size={14} />,
              label: isPolish ? 'Prezentacja' : 'Presentation',
              color: 'text-emerald-400',
            },
          };
          const c = cfg[kind] || {
            icon: <FileText size={14} />,
            label: isPolish ? 'Output' : 'Output',
            color: 'text-c-text-secondary',
          };
          return (
            <div className="flex items-center gap-2">
              <span className={c.color}>{c.icon}</span>
              <span className={`text-xs font-medium ${c.color}`}>{c.label}</span>
            </div>
          );
        },
      },
      {
        id: 'name',
        label: t('tools.hub.outputs.columns.name', 'Name'),
        render: (row: any) => (
          <div className="min-w-0">
            <span className="block text-sm font-semibold text-c-text truncate">
              {String(row?.name || '')}
            </span>
          </div>
        ),
      },
      {
        id: 'status',
        label: t('tools.hub.outputs.columns.status', 'Status'),
        width: '120px',
      },
      {
        id: 'updatedAt',
        label: t('tools.hub.outputs.columns.updated', 'Updated'),
        width: '120px',
        sortable: true,
      },
    ],
    [isPolish, t]
  );

  // Handlers
  const handleOpenDocument = useCallback(
    (row: DisplayItem | any) => {
      // Check if this is an initiative
      const isInitiative = row.apiToolType === 'initiative';

      const doc: OpenDocument = {
        id: row.id,
        type: isInitiative ? 'initiative' : 'tool',
        subType: row.apiToolType || row.toolType,
        name: row.name,
        status: row.status,
      };

      setOpenDocuments((prev) => {
        if (prev.find((d) => d.id === doc.id)) return prev;
        return [...prev, doc];
      });
      setActiveDocumentId(row.id);

      // If it's an initiative, fetch full details with tasks
      if (isInitiative) {
        fetchInitiativeDetails(row.id);
      }
    },
    [fetchInitiativeDetails]
  );

  const openOutput = useCallback(
    (item: OutputItem) => {
      if (!item?.id) return;
      if (item.outputKind === 'assessment_report') {
        // Canonical: resolve builder link and redirect.
        navigate(`/assessment-reports/${encodeURIComponent(item.id)}`);
        return;
      }
      if (item.outputKind === 'report_builder') {
        navigate(`/reports/builder/${encodeURIComponent(item.id)}`);
        return;
      }
      if (item.outputKind === 'presentation_deck') {
        navigate(`/presentations/builder/${encodeURIComponent(item.id)}`);
        return;
      }
    },
    [navigate]
  );

  const openDocumentById = useCallback(
    async (id: string) => {
      const existing = openDocuments.find((d) => d.id === id);
      if (existing) {
        setActiveDocumentId(existing.id);
        return;
      }

      const outputMatch = outputs.find((r: OutputItem) => r.id === id);
      if (outputMatch) {
        openOutput(outputMatch);
        return;
      }

      const initiativeMatch = initiatives.find((i) => i.id === id);
      if (initiativeMatch) {
        handleOpenDocument(initiativeMatch);
        return;
      }

      const sessionMatch = discoveries.find((d) => d.id === id);
      if (sessionMatch) {
        handleOpenDocument(sessionMatch);
        return;
      }

      try {
        const session = await Api.getToolSession(id);
        if (session?.id) {
          handleOpenDocument(transformToolSession(session));
          return;
        }
      } catch {
        // Best-effort deep-link hydration
      }

      try {
        // Fix: API_URL is already '/api'; the `/api/` prefix here produced a
        // doubled `/api/api/initiatives/...` 404. Siblings (1229, 2777) use
        // the bare `/initiatives/...` path. Aligned.
        const initiative = await Api.get(`/initiatives/${id}`);
        const row = initiative?.data;
        if (row?.id) {
          handleOpenDocument({
            id: row.id,
            name: row.title || row.name || 'Untitled Initiative',
            status: mapStatusToUppercase(String(row.status || 'DRAFT')),
            apiToolType: 'initiative',
          });
        }
      } catch {
        // Ignore invalid deep-link ids.
      }
    },
    [
      openDocuments,
      outputs,
      initiatives,
      discoveries,
      setActiveDocumentId,
      handleOpenDocument,
      openOutput,
      transformToolSession,
    ]
  );

  const handleOpenKnownTool = useCallback(
    (row: any) => {
      const toolType = String(row?.toolType || '').trim();
      if (!toolType) return;
      if (row?.kind === 'tool' && row?.isActive === false) {
        toast.error(
          isPolish
            ? 'To narzędzie jest jeszcze nieaktywne. Dostępny jest tylko podgląd w preview.'
            : 'This tool is inactive for now. Only the preview is available.'
        );
        return;
      }

      const docId = `known:${toolType}`;
      const doc: OpenDocument = {
        id: docId,
        type: 'tool',
        subType: toolType,
        name: row?.name || toolType,
        status: 'DRAFT',
      };

      setOpenDocuments((prev) => {
        if (prev.find((d) => d.id === doc.id)) return prev;
        return [...prev, doc];
      });
      setActiveDocumentId(docId);
      trackFunnelEvent('tool_preview_opened', { toolType });
    },
    [isPolish, setOpenDocuments]
  );

  const handleKnownToolSessionCreated = useCallback(
    (sessionId: string, toolType: string, name: string) => {
      const doc: OpenDocument = {
        id: sessionId,
        type: 'tool',
        subType: toolType,
        name,
        status: 'DRAFT',
      };
      setOpenDocuments((prev) => {
        if (prev.find((d) => d.id === doc.id)) return prev;
        return [...prev, doc];
      });
      setActiveTab('sessions');
      setActiveDocumentId(sessionId);
      setPreviewItemId(sessionId);
      fetchData(true);
    },
    [fetchData]
  );

  const handleCloseDocument = useCallback(
    (id: string) => {
      setOpenDocuments((prev) => prev.filter((d) => d.id !== id));
      if (activeDocumentId === id) {
        setActiveDocumentId(null);
        setSelectedInitiative(null);
        setInitiativeTasks([]);
      }
    },
    [activeDocumentId]
  );

  const handleShowList = useCallback(() => {
    setActiveDocumentId(null);
    setSelectedInitiative(null);
    setInitiativeTasks([]);
  }, []);

  /**
   * Menu 2 MUSI wyprowadzać z otwartej karty (zgłoszenie Piotra 2026-07-27:
   * „wystartowałem sesję i nie mam jak z niej wyjść").
   *
   * `renderContent()` sprawdza `activeDocumentId` PRZED `activeTab`, więc samo
   * `setActiveTab` przy otwartej sesji nic nie robiło — pigułki Menu 2 były
   * martwe, a jedynym wyjściem została bezetykietowa strzałka w nagłówku
   * artefaktu. Przełączenie zakładki = intencja „chcę stąd wyjść", więc
   * zamykamy kartę (zostaje w `openDocuments`, wraca jednym kliknięciem chipu).
   */
  const handleTabChange = useCallback(
    (tab: string) => {
      setActiveTab(tab as ModuleTab);
      handleShowList();
    },
    [handleShowList]
  );

  // TLS-01: `docId` is now a DURABLE, two-way-synced reflection of
  // `activeDocumentId`, not a one-shot deep-link param that gets stripped
  // after use. Previously, once a tool document opened, the URL reverted to
  // having no `docId` at all — reload/share/back-forward silently lost which
  // workspace (e.g. a SWOT session) was open, falling back only to a
  // per-tab `sessionStorage` cache. Now: opening/switching/closing a
  // document updates `docId` in the URL, and a `docId` present in the URL
  // (initial load, reload, browser back/forward, a shared/bookmarked link)
  // opens that document — making the URL the actual source of truth for
  // which surface/workspace is active, per the reopen-by-workspaceId
  // requirement.
  const docIdParam = String(searchParams.get('docId') || '').trim() || null;

  // URL -> state
  useEffect(() => {
    if (!hydrated) return;
    if (!docIdParam) return;
    if (docIdParam === activeDocumentId) return;
    void openDocumentById(docIdParam);
    // docIdParam is intentionally the only reactive dependency here — the
    // state->URL direction below owns reacting to activeDocumentId changes;
    // including it here too would cause both effects to fight/re-trigger
    // each other on every local navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, docIdParam]);

  // state -> URL
  useEffect(() => {
    if (!hydrated) return;
    if (docIdParam === (activeDocumentId || null)) return;
    const next = new URLSearchParams(searchParams);
    if (activeDocumentId) {
      next.set('docId', activeDocumentId);
    } else {
      next.delete('docId');
    }
    setSearchParams(next, { replace: true });
  }, [hydrated, activeDocumentId, docIdParam, searchParams, setSearchParams]);

  useEffect(() => {
    if (!hydrated) return;
    const artifact = parseArtifactRef(searchParams.get('artifact'));
    if (!artifact) return;
    if (artifact.type !== 'tool') return;

    setActiveTab('sessions');
    void openDocumentById(artifact.id).finally(() => {
      const next = new URLSearchParams(searchParams);
      next.delete('artifact');
      next.delete('code');
      setSearchParams(next, { replace: true });
    });
  }, [hydrated, openDocumentById, searchParams, setSearchParams]);

  const handleRemoveFilter = useCallback((id: string) => {
    setActiveFilters((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const handleClearFilters = useCallback(() => {
    setActiveFilters([]);
  }, []);

  const createAndOpenToolSession = useCallback(
    async (params: {
      toolType: string;
      name?: string;
      source?: 'add_menu' | 'library' | 'ai_suggest';
    }) => {
      const toolType = String(params.toolType || '').trim();
      if (!toolType) return;
      try {
        const sessionName =
          String(params.name || '').trim() || t('tools.hub.defaultSessionName', 'Session');
        const created = await Api.createToolSession({
          toolType,
          name: sessionName,
          projectId: currentProjectId ?? null,
        });
        setActiveTab('sessions');
        setPreviewItemId(created.id);
        handleOpenDocument({
          id: created.id,
          name: sessionName,
          status: created.status || 'DRAFT',
          apiToolType: toolType,
          toolType,
        });
        trackFunnelEvent('tool_session_started_from_library', {
          toolType,
          source: params.source || 'add_menu',
        });
        await fetchData(true);
        toast.success(t('tools.hub.toast.sessionCreated', 'Session created'));
      } catch {
        toast.error(t('tools.hub.toast.sessionCreateError', 'Failed to create tool session'));
      }
    },
    [currentProjectId, fetchData, handleOpenDocument, isPolish, t]
  );

  // #64: AI picker — "Nie wiesz, które wybrać?" Free-text problem description in,
  // top-3 candidate tools out. Fail-soft: any error just shows a message and the
  // manual picker list below stays fully usable.
  const handleSuggestTool = useCallback(async () => {
    const problemDescription = suggestProblemText.trim();
    if (!problemDescription) return;
    setIsSuggestingTool(true);
    setSuggestToolError(null);
    setSuggestToolResults(null);
    try {
      const { suggestions } = await Api.suggestTools({
        problemDescription,
        lang: isPolish ? 'pl' : 'en',
      });
      if (!suggestions || suggestions.length === 0) {
        setSuggestToolResults([]);
        setSuggestToolError(
          isPolish
            ? 'Nie udało się dopasować narzędzia do tego opisu. Wybierz ręcznie z listy poniżej.'
            : 'Could not match a tool to this description. Pick manually from the list below.'
        );
      } else {
        setSuggestToolResults(suggestions);
      }
    } catch {
      setSuggestToolResults(null);
      setSuggestToolError(
        isPolish
          ? 'Rekomendacja AI jest chwilowo niedostępna. Wybierz ręcznie z listy poniżej.'
          : 'AI suggestion is temporarily unavailable. Pick manually from the list below.'
      );
    } finally {
      setIsSuggestingTool(false);
    }
  }, [suggestProblemText, isPolish]);

  const handleSelectSuggestedTool = useCallback(
    (toolType: string, name: string) => {
      setIsAddMenuOpen(false);
      setSuggestProblemText('');
      setSuggestToolResults(null);
      setSuggestToolError(null);
      void createAndOpenToolSession({ toolType, name, source: 'ai_suggest' });
    },
    [createAndOpenToolSession]
  );

  const createAndOpenAssessmentSession = useCallback(
    async (params: {
      assessmentType: AssessmentFramework | string;
      name?: string;
      source?: 'add_menu' | 'library';
    }) => {
      const assessmentType = String(params.assessmentType || '')
        .trim()
        .toUpperCase();
      if (!assessmentType) return;

      // Honest gate (decision D-B): coming-soon frameworks (CMMI/LEAN) must never
      // start a session — this is the single choke point for every assessment
      // start path in the library, so no path can bypass it.
      if (isFrameworkComingSoon(assessmentType as FrameworkId)) {
        toast(
          isPolish
            ? 'Ten framework jest wkrótce dostępny — nie można jeszcze rozpocząć sesji.'
            : 'This framework is coming soon — a session cannot be started yet.',
          { icon: '🔜' }
        );
        return;
      }

      try {
        const sessionName =
          String(params.name || '').trim() ||
          `${assessmentType} — ${isPolish ? 'Assessment' : 'Assessment'}`;
        const created = await Api.createAssessmentSession({
          assessmentType: assessmentType as any,
          name: sessionName,
          projectId: currentProjectId ?? null,
        });
        trackFunnelEvent('licensed_tool_framework_opened', {
          assessmentType,
          source: params.source || 'add_menu',
        });
        await fetchData(true);
        toast.success(t('tools.hub.toast.sessionCreated', 'Session created'));
        navigate(`/assessment/${assessmentType.toLowerCase()}/${created.id}`);
      } catch {
        toast.error(
          t('tools.hub.toast.assessmentCreateError', 'Failed to create assessment session')
        );
      }
    },
    [currentProjectId, fetchData, isPolish, navigate, t]
  );

  const handleRowAction = useCallback(
    (action: string, row: any) => {
      const isInactiveTool = row?.kind === 'tool' && row?.isActive === false;
      const notifyInactiveTool = () => {
        toast.error(
          isPolish
            ? 'To narzędzie nie jest jeszcze aktywne. Możesz tylko zobaczyć opis w preview.'
            : 'This tool is not active yet. You can only view its preview description.'
        );
      };
      if (action === 'view' || action === 'edit') {
        if (row?.kind === 'assessmentSession') {
          navigate(`/assessment/${String(row.assessmentType || '').toLowerCase()}/${row.id}`);
          return;
        }
        handleOpenDocument(row);
      } else if (action === 'preview') {
        setPreviewItemId(row.id);
      } else if (action === 'library_open_full') {
        if (row?.kind === 'assessment') {
          void createAndOpenAssessmentSession({
            assessmentType: String(row?.toolType || '').trim(),
            name: `${String(row?.toolType || '').trim()} — ${isPolish ? 'Assessment' : 'Assessment'}`,
            source: 'library',
          });
          return;
        }
        if (isInactiveTool) {
          setPreviewItemId(row.id);
          notifyInactiveTool();
          return;
        }
        handleOpenKnownTool(row);
      } else if (action === 'library_start_session') {
        if (row?.kind === 'assessment') {
          const fw = String(row?.toolType || '').trim();
          if (!fw) return;
          void createAndOpenAssessmentSession({
            assessmentType: fw,
            name: `${fw} — ${isPolish ? 'Assessment' : 'Assessment'}`,
            source: 'library',
          });
          return;
        }
        const toolType = String(row?.toolType || '').trim();
        if (!toolType) return;
        if (row?.isComingSoon) return;
        if (isInactiveTool) {
          setPreviewItemId(row.id);
          notifyInactiveTool();
          return;
        }
        void createAndOpenToolSession({
          toolType,
          name: row?.name || toolType,
          source: 'library',
        });
      } else if (action === 'library_chat') {
        const toolType = String(row?.toolType || '').trim();
        if (!toolType) return;
        if (isInactiveTool) {
          setPreviewItemId(row.id);
          notifyInactiveTool();
          return;
        }
        (async () => {
          try {
            const convId = await openChatWithContext({
              entityType: row?.kind === 'assessment' ? 'assessment' : 'tool',
              entityId: toolType,
              entityName: row?.name || toolType,
              contextData: {
                kind: row?.kind || 'tool',
                toolType,
                category: row?.libraryCategory,
                isLicensed: !!row?.isLicensed,
                tags: row?.tags || [],
                whatYouGet: row?.whatYouGet || [],
                description: row?.description || '',
              },
            });
            await addChatMessage({
              conversationId: convId,
              role: 'user',
              content: isPolish
                ? row?.kind === 'assessment'
                  ? `Wyjaśnij, kiedy użyć tego frameworku assessment („${row?.name || toolType}”), jakie dane wejściowe są potrzebne i jak interpretować wyniki.`
                  : `Wyjaśnij, kiedy użyć tego narzędzia („${row?.name || toolType}”), jakie są typowe pułapki oraz jakie deliverables powinienem otrzymać.`
                : row?.kind === 'assessment'
                  ? `Explain when to use this assessment framework (“${row?.name || toolType}”), what inputs are needed, and how to interpret the results.`
                  : `Explain when to use this tool (“${row?.name || toolType}”), typical pitfalls, and what deliverables I should expect.`,
            } as any);
            toast.success(t('tools.hub.toast.chatOpened', 'Chat opened'), { duration: 1500 });
          } catch (e) {
            toast.error(t('tools.hub.toast.chatOpenError', 'Failed to open chat'));
          }
        })();
      }
    },
    [
      activeTab,
      addChatMessage,
      createAndOpenAssessmentSession,
      createAndOpenToolSession,
      handleOpenDocument,
      handleOpenKnownTool,
      isPolish,
      navigate,
      openChatWithContext,
      t,
    ]
  );

  // Get current data based on tab (non-Library)
  const currentData = useMemo(() => {
    let data: any[] = [];
    switch (activeTab) {
      case 'sessions':
      case 'list':
        data = discoveries;
        break;
      case 'outputs':
      case 'reports':
        data = outputs;
        break;
      case 'initiatives':
        data = initiatives;
        break;
      default:
        data = [];
    }

    // Apply status filter
    if (statusFilter && statusFilter !== 'all') {
      data = data.filter((item) => {
        // For initiatives tab, also check _fullData.status
        if (activeTab === 'initiatives' && item._fullData?.status) {
          return (
            item._fullData.status.toLowerCase() === statusFilter.toLowerCase() ||
            item._fullData.status.toLowerCase().replace('_', '') === statusFilter.replace('_', '')
          );
        }
        return (
          String(item.status || '').toLowerCase() === statusFilter.toLowerCase() ||
          String(item.status || '')
            .toLowerCase()
            .replace('_', '') === statusFilter.replace('_', '').toLowerCase()
        );
      });
    }

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      data = data.filter(
        (item) =>
          item.name.toLowerCase().includes(query) ||
          String((item as any)?.outputKind || '')
            .toLowerCase()
            .includes(query) ||
          String(item.apiToolType || item.toolType || '')
            .toLowerCase()
            .includes(query) ||
          String(item.category || '')
            .toLowerCase()
            .includes(query)
      );
    }

    return data;
  }, [activeTab, discoveries, initiatives, outputs, searchQuery, statusFilter]);

  type UnifiedSessionRow =
    | (DisplayItem & { kind: 'toolSession'; sessionType: string })
    | {
        kind: 'assessmentSession';
        id: string;
        name: string;
        assessmentType: string;
        sessionType: string;
        category: ToolCategory;
        status: ItemStatus;
        progress: number;
        createdAt?: Date;
        updatedAt: Date;
        createdBy?: string;
        apiToolType: 'assessment';
        _fullData?: any;
      };

  const unifiedSessionsData: UnifiedSessionRow[] = useMemo(() => {
    let data: UnifiedSessionRow[] = [
      ...discoveries.map((d) => ({
        ...d,
        kind: 'toolSession' as const,
        sessionType: String((d as any)?.toolType || ''),
      })),
      ...assessmentSessions.map((a) => ({
        kind: 'assessmentSession' as const,
        id: a.id,
        name: a.name,
        assessmentType: a.assessmentType,
        sessionType: a.assessmentType,
        category: 'licensed' as ToolCategory,
        status: a.status,
        progress: a.progress,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
        createdBy: (a as any).createdBy,
        apiToolType: 'assessment' as const,
        _fullData: a._fullData,
      })),
    ];

    // Apply status filter
    if (statusFilter && statusFilter !== 'all') {
      const wanted = statusFilter.toLowerCase();
      data = data.filter((item: any) => {
        const s = String(item?.status || '').toLowerCase();
        return s === wanted || s.replace('_', '') === wanted.replace('_', '');
      });
    }

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      data = data.filter((item: any) => {
        const typeText =
          item.kind === 'assessmentSession'
            ? String(item.assessmentType || '')
            : String(item.apiToolType || item.toolType || '');
        return (
          String(item.name || '')
            .toLowerCase()
            .includes(query) ||
          typeText.toLowerCase().includes(query) ||
          String(item.category || '')
            .toLowerCase()
            .includes(query)
        );
      });
    }

    return data;
  }, [assessmentSessions, discoveries, searchQuery, statusFilter]);

  const assessmentTemplateItems: UnifiedLibraryItem[] = useMemo(() => {
    return (Object.keys(ASSESSMENT_FRAMEWORK_META) as AssessmentFramework[]).map((fw, idx) => {
      const meta = ASSESSMENT_FRAMEWORK_META[fw];
      return {
        kind: 'assessment',
        id: `assessment:${fw}`,
        toolType: fw,
        name: meta.name,
        libraryCategory: 'licensed',
        description: isPolish
          ? 'Framework oceny do uruchomienia jako sesja assessment.'
          : 'Assessment framework template you can start as an assessment session.',
        whatYouGet: isPolish
          ? ['Wyniki dojrzałości i luki', 'Rekomendacje i inicjatywy', 'Raport do zatwierdzenia']
          : ['Maturity results and gaps', 'Recommendations and initiatives', 'Report for approval'],
        tags: meta.tags,
        icon: null,
        isLicensed: true,
        isActive: true,
        // Honest gate (decision D-B): reflect the framework registry so the
        // picker cannot claim CMMI/LEAN are startable.
        isComingSoon: isFrameworkComingSoon(fw as FrameworkId),
        sortOrder: 900 + idx,
        createdAt: null,
        license: 'licensed',
        availability: 'active',
      };
    });
  }, [isPolish]);

  const automationTemplateItem: UnifiedLibraryItem = useMemo(
    () => ({
      kind: 'tool',
      id: 'tool:process-automation',
      toolType: 'process-automation',
      name: isPolish ? 'System analizy procesu pod automatyzację' : 'Process Automation System',
      libraryCategory: 'automation',
      description: isPolish
        ? 'Analiza procesu end-to-end (As-Is → To-Be) i pipeline automatyzacji.'
        : 'End-to-end process analysis (As-Is → To-Be) with automation pipeline.',
      whatYouGet: isPolish
        ? ['Mapa procesu i wąskie gardła', 'Backlog automatyzacji', 'Priorytetyzacja i ROI']
        : ['Process map and bottlenecks', 'Automation backlog', 'Prioritization and ROI'],
      tags: ['automation', 'process', 'pipeline'],
      icon: null,
      isLicensed: false,
      isActive: false,
      isComingSoon: false,
      sortOrder: 850,
      createdAt: null,
      license: 'free',
      availability: 'inactive',
    }),
    [isPolish]
  );

  const libraryCatalogItems: UnifiedLibraryItem[] = useMemo(() => {
    if (isKnownToolsLoading && knownTools.length === 0) {
      return [];
    }

    const toolItems: UnifiedLibraryItem[] = (knownTools || []).map((t) => {
      const catRaw = String(t.libraryCategory || '').trim();
      const cat: ToolCategory =
        catRaw === 'strategic' ||
        catRaw === 'operational' ||
        catRaw === 'digital' ||
        catRaw === 'automation'
          ? (catRaw as ToolCategory)
          : t.isLicensed
            ? 'licensed'
            : 'strategic';
      return {
        kind: 'tool',
        id: String(t.id),
        toolType: String(t.toolType || ''),
        name: String(t.name || ''),
        libraryCategory: cat,
        description: String(t.description || ''),
        whatYouGet: Array.isArray(t.whatYouGet) ? t.whatYouGet : [],
        tags: Array.isArray(t.tags) ? t.tags : [],
        icon: t.icon ?? null,
        isLicensed: !!t.isLicensed,
        isActive: !!t.isActive,
        isComingSoon: !!t.isComingSoon,
        sortOrder: Number.isFinite(Number(t.sortOrder)) ? Number(t.sortOrder) : 999,
        createdAt: t.createdAt ?? null,
        license: t.isLicensed ? 'licensed' : 'free',
        availability: t.isActive ? 'active' : 'inactive',
      };
    });

    const byToolType = new Set(toolItems.map((i) => i.toolType));
    const extras: UnifiedLibraryItem[] = [...assessmentTemplateItems];
    if (!byToolType.has(automationTemplateItem.toolType)) extras.unshift(automationTemplateItem);

    return [...toolItems, ...extras].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }, [assessmentTemplateItems, automationTemplateItem, isKnownToolsLoading, knownTools]);

  const filteredLibraryItems = useMemo(() => {
    let data = libraryCatalogItems.slice();
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      data = data.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.toolType.toLowerCase().includes(q) ||
          String(t.libraryCategory || '')
            .toLowerCase()
            .includes(q) ||
          t.description.toLowerCase().includes(q)
      );
    }
    if (libraryCategoryFilter !== 'all') {
      data = data.filter((t) => {
        const cat = (t.libraryCategory ?? 'other') as string;
        return cat === libraryCategoryFilter;
      });
    }
    return data;
  }, [libraryCatalogItems, searchQuery, libraryCategoryFilter]);
  const libraryEmptyMessage = useMemo(() => {
    const normalizedQuery = String(searchQuery || '').trim();
    if (normalizedQuery.length > 0) {
      return t(
        'tools.hub.empty.librarySearchNoResults',
        isPolish
          ? `Brak wyników dla frazy "${normalizedQuery}". Zmień frazę lub wyczyść filtry.`
          : `No results for "${normalizedQuery}". Try a different phrase or clear filters.`,
        { query: normalizedQuery }
      );
    }

    return t('tools.hub.empty.library', 'No tools available in this category yet.');
  }, [isPolish, searchQuery, t]);
  const librarySearchQuery = String(searchQuery || '').trim();
  const hasLibrarySearchNoResults =
    librarySearchQuery.length > 0 && filteredLibraryItems.length === 0;

  const libraryCategoryCounts = useMemo(() => {
    const counts: Record<ToolCategory | 'other', number> = {
      strategic: 0,
      operational: 0,
      digital: 0,
      automation: 0,
      licensed: 0,
      other: 0,
    };
    for (const k of libraryCatalogItems) {
      const cat = (k.libraryCategory ?? 'other') as string;
      if (cat === 'strategic') counts.strategic += 1;
      else if (cat === 'operational') counts.operational += 1;
      else if (cat === 'digital') counts.digital += 1;
      else if (cat === 'automation') counts.automation += 1;
      else if (cat === 'licensed') counts.licensed += 1;
      else counts.other += 1;
    }
    return counts;
  }, [libraryCatalogItems]);

  const statusCountsForCommandRow = useMemo(() => {
    const matchesSearch = (item: any) => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      const typeText =
        item?.kind === 'assessmentSession'
          ? String(item?.assessmentType || '')
          : item?.kind === 'output'
            ? String(item?.outputKind || '')
            : String(item?.apiToolType || item?.toolType || '');
      return (
        String(item?.name || '')
          .toLowerCase()
          .includes(query) ||
        typeText.toLowerCase().includes(query) ||
        String(item?.category || '')
          .toLowerCase()
          .includes(query)
      );
    };

    const base =
      activeTab === 'sessions' || activeTab === 'list'
        ? (unifiedSessionsData as any[])
        : activeTab === 'outputs' || activeTab === 'reports'
          ? outputs
          : activeTab === 'initiatives'
            ? initiatives
            : [];

    const counts: Record<string, number> = { all: 0 };
    const filteredBase = base.filter(matchesSearch);
    counts.all = filteredBase.length;

    for (const opt of currentStatusOptions) {
      if (opt.id === 'all') continue;
      counts[opt.id] = filteredBase.filter((item: any) => {
        if (activeTab === 'initiatives' && item._fullData?.status) {
          const s = String(item._fullData.status || '').toLowerCase();
          const wanted = String(opt.id || '').toLowerCase();
          return s === wanted || s.replace('_', '') === wanted.replace('_', '');
        }
        const s = String(item.status || '').toLowerCase();
        const wanted = String(opt.id || '').toLowerCase();
        return s === wanted || s.replace('_', '') === wanted.replace('_', '');
      }).length;
    }

    return counts;
  }, [activeTab, currentStatusOptions, initiatives, outputs, searchQuery, unifiedSessionsData]);

  const libraryGridItems: GridItem[] = useMemo(() => {
    return filteredLibraryItems.map((tool) => ({
      ...tool,
      id: tool.id,
      name: tool.name,
      type: tool.libraryCategory || tool.kind,
      typeColor:
        tool.libraryCategory === 'strategic'
          ? 'emerald'
          : tool.libraryCategory === 'operational'
            ? 'blue'
            : tool.libraryCategory === 'digital'
              ? 'purple'
              : tool.libraryCategory === 'automation'
                ? 'amber'
                : tool.libraryCategory === 'licensed'
                  ? 'rose'
                  : 'amber',
      status: 'DRAFT',
      progress: 0,
      updatedAt: tool.createdAt ? new Date(tool.createdAt) : new Date(),
    }));
  }, [filteredLibraryItems]);

  // Helper functions for initiative detail
  const formatCurrency = (amount?: number) => {
    if (!amount) return '-';
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
    return `$${amount}`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getTaskStatusColor = (status: string) => {
    switch (status) {
      case 'DONE':
        return 'bg-emerald-500/20 text-emerald-400';
      case 'IN_PROGRESS':
        return 'bg-blue-500/20 text-blue-400';
      case 'BLOCKED':
        return 'bg-danger-500/20 text-danger-400';
      default:
        return 'bg-slate-500/20 text-c-text-secondary';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
        return 'text-danger-400';
      case 'HIGH':
        return 'text-amber-400';
      case 'MEDIUM':
        return 'text-blue-400';
      default:
        return 'text-c-text-secondary';
    }
  };

  // Handle submit for review
  const handleSubmitForReview = useCallback(async () => {
    if (!selectedInitiative) return;
    try {
      await Api.patch(`/initiatives/${selectedInitiative.id}/status`, { status: 'REVIEW' });
      toast.success('Initiative submitted for review');
      fetchData(true);
      handleShowList();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to submit for review');
    }
  }, [selectedInitiative, fetchData, handleShowList]);

  // Render Initiative Detail View with Tasks
  const renderInitiativeDetail = () => {
    if (isLoadingInitiative) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="flex flex-col items-center gap-3 text-c-text-muted">
            <Loader2 className="w-8 h-8 animate-spin" />
            <span>Loading initiative details...</span>
          </div>
        </div>
      );
    }

    if (!selectedInitiative) {
      return (
        <div className="flex items-center justify-center h-full text-c-text-muted">
          <div className="text-center">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-amber-400/50" />
            <p className="text-lg text-c-text">Initiative not found</p>
            <button
              onClick={handleShowList}
              className="mt-4 px-4 py-2 bg-c-border-subtle hover:bg-slate-300 dark:hover:bg-navy-600 text-c-text rounded-lg text-sm transition-colors"
            >
              Back to List
            </button>
          </div>
        </div>
      );
    }

    const taskStats = {
      total: initiativeTasks.length,
      done: initiativeTasks.filter((t) => t.status === 'DONE').length,
      inProgress: initiativeTasks.filter((t) => t.status === 'IN_PROGRESS').length,
      blocked: initiativeTasks.filter((t) => t.status === 'BLOCKED').length,
    };
    const completionPercent =
      taskStats.total > 0 ? Math.round((taskStats.done / taskStats.total) * 100) : 0;

    return (
      <div className="h-full flex flex-col overflow-hidden bg-c-bg">
        {/* Header */}
        <div className="shrink-0 border-b border-c-border-subtle bg-c-surface px-6 py-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <button
                  onClick={handleShowList}
                  className="p-1.5 text-c-text-muted hover:text-c-text dark:hover:text-white hover:bg-c-surface-raised rounded-lg transition-colors"
                >
                  <ChevronRight size={18} className="rotate-180" />
                </button>
                <span className="px-2 py-0.5 text-xs font-medium rounded bg-slate-500/20 text-c-text-secondary">
                  DRAFT
                </span>
                {selectedInitiative.axis && (
                  <span className="px-2 py-0.5 text-xs font-medium rounded bg-blue-500/20 text-blue-400 capitalize">
                    {selectedInitiative.axis}
                  </span>
                )}
                {selectedInitiative.priority && (
                  <span
                    className={`px-2 py-0.5 text-xs font-medium rounded ${getPriorityColor(selectedInitiative.priority)}`}
                  >
                    {selectedInitiative.priority}
                  </span>
                )}
              </div>
              <h1 className="text-xl font-bold text-c-text">{selectedInitiative.name}</h1>
              {selectedInitiative.description && (
                <p className="text-sm text-c-text-muted mt-1 line-clamp-2">
                  {selectedInitiative.description}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  navigate(
                    `/initiatives?open=${encodeURIComponent(selectedInitiative.id)}&mode=doc`
                  )
                }
                className="px-3 py-2 text-sm text-c-text-muted hover:text-c-text dark:hover:text-white hover:bg-c-surface-raised rounded-lg transition-colors"
              >
                Open Full View
              </button>
              <button
                onClick={handleSubmitForReview}
                className="px-4 py-2 text-sm font-medium text-white bg-navy-900 hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg transition-colors flex items-center gap-2"
              >
                <ArrowRight size={16} />
                Submit for Review
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Initiative Details */}
            <div className="lg:col-span-2 space-y-6">
              {/* Summary Section */}
              {selectedInitiative.summary && (
                <div className="bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03] p-5">
                  <h3 className="text-xs font-semibold text-c-text-muted uppercase mb-3 flex items-center gap-2">
                    <FileText size={14} />
                    Summary
                  </h3>
                  <p className="text-sm text-c-text-secondary leading-relaxed">
                    {selectedInitiative.summary}
                  </p>
                </div>
              )}

              {/* Tasks Section */}
              <div className="bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03] p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-semibold text-c-text-muted uppercase flex items-center gap-2">
                    <ListTodo size={14} />
                    Tasks ({taskStats.total})
                  </h3>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-green-400">{taskStats.done} Done</span>
                    <span className="text-blue-400">{taskStats.inProgress} In Progress</span>
                    {taskStats.blocked > 0 && (
                      <span className="text-danger-400">{taskStats.blocked} Blocked</span>
                    )}
                  </div>
                </div>

                {/* Task Progress Bar */}
                {taskStats.total > 0 && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-xs text-c-text-muted mb-1">
                      <span>Completion</span>
                      <span>{completionPercent}%</span>
                    </div>
                    <div className="h-2 bg-c-border-subtle rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-full transition-all"
                        style={{ width: `${completionPercent}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Tasks List */}
                {initiativeTasks.length === 0 ? (
                  <div className="text-center py-8 text-c-text-muted">
                    <ListTodo className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No tasks yet</p>
                    <p className="text-xs text-c-text-secondary mt-1">
                      Tasks will be added during planning phase
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {initiativeTasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-navy-800 rounded-lg border border-c-border-subtle hover:border-c-accent/30 transition-colors"
                      >
                        <div
                          className={`w-2 h-2 rounded-full ${
                            task.status === 'DONE'
                              ? 'bg-green-400'
                              : task.status === 'IN_PROGRESS'
                                ? 'bg-blue-400'
                                : task.status === 'BLOCKED'
                                  ? 'bg-danger-400'
                                  : 'bg-c-text-muted'
                          }`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-c-text truncate">
                              {task.title}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${getTaskStatusColor(task.status)}`}
                            >
                              {task.status.replace('_', ' ')}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-c-text-muted">
                            {task.assigneeName && (
                              <span className="flex items-center gap-1">
                                <User size={10} />
                                {task.assigneeName}
                              </span>
                            )}
                            {task.dueDate && (
                              <span className="flex items-center gap-1">
                                <Calendar size={10} />
                                {formatDate(task.dueDate)}
                              </span>
                            )}
                            {task.estimatedHours && (
                              <span className="flex items-center gap-1">
                                <Clock size={10} />
                                {task.estimatedHours}h
                              </span>
                            )}
                          </div>
                        </div>
                        <Flag size={14} className={getPriorityColor(task.priority)} />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Source Info */}
              {selectedInitiative.sourceType && (
                <div className="bg-slate-100/50 dark:bg-navy-900/50 rounded-xl border border-c-border-subtle p-4">
                  <div className="flex items-center gap-2 text-xs text-c-text-muted">
                    <Zap size={12} className="text-amber-400" />
                    <span>
                      Generated from:{' '}
                      <span className="text-c-text capitalize">
                        {getSourceDisplayLabel(
                          selectedInitiative.sourceType,
                          i18n.language === 'pl'
                        )}
                      </span>
                    </span>
                    {selectedInitiative.sourceId && (
                      <span className="text-c-text-muted">
                        ({selectedInitiative.sourceId.slice(0, 8)}...)
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column - Metrics & Info */}
            <div className="space-y-4">
              {/* Key Metrics */}
              <div className="bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03] p-5">
                <h3 className="text-xs font-semibold text-c-text-muted uppercase mb-4">
                  Key Metrics
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-c-text-muted flex items-center gap-2">
                      <DollarSign size={14} />
                      CAPEX
                    </span>
                    <span className="text-sm font-semibold text-c-text">
                      {formatCurrency(selectedInitiative.costCapex)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-c-text-muted flex items-center gap-2">
                      <DollarSign size={14} />
                      OPEX
                    </span>
                    <span className="text-sm font-semibold text-c-text">
                      {formatCurrency(selectedInitiative.costOpex)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-c-text-muted flex items-center gap-2">
                      <TrendingUp size={14} />
                      Expected ROI
                    </span>
                    <span className="text-sm font-semibold text-green-400">
                      {selectedInitiative.expectedRoi
                        ? formatRoiDisplay(selectedInitiative.expectedRoi)
                        : '-'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Timeline */}
              <div className="bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03] p-5">
                <h3 className="text-xs font-semibold text-c-text-muted uppercase mb-4 flex items-center gap-2">
                  <Calendar size={14} />
                  Timeline
                </h3>
                <div className="space-y-3">
                  <div>
                    <span className="text-xs text-c-text-muted">Start Date</span>
                    <div className="text-sm text-c-text">
                      {formatDate(selectedInitiative.plannedStartDate)}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-c-text-muted">End Date</span>
                    <div className="text-sm text-c-text">
                      {formatDate(selectedInitiative.plannedEndDate)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Ownership */}
              <div className="bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03] p-5">
                <h3 className="text-xs font-semibold text-c-text-muted uppercase mb-4 flex items-center gap-2">
                  <Users size={14} />
                  Ownership
                </h3>
                <div className="space-y-3">
                  <div>
                    <span className="text-xs text-c-text-muted">Business Owner</span>
                    <div className="text-sm text-c-text">
                      {selectedInitiative.ownerBusiness ? (
                        `${selectedInitiative.ownerBusiness.firstName} ${selectedInitiative.ownerBusiness.lastName}`
                      ) : (
                        <span className="text-c-text-muted">Not assigned</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-c-text-muted">Execution Owner</span>
                    <div className="text-sm text-c-text">
                      {selectedInitiative.ownerExecution ? (
                        `${selectedInitiative.ownerExecution.firstName} ${selectedInitiative.ownerExecution.lastName}`
                      ) : (
                        <span className="text-c-text-muted">Not assigned</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Next Steps */}
              <div className="bg-c-accent-soft rounded-xl border border-c-accent/20 p-5">
                <h3 className="text-xs font-semibold text-c-accent uppercase mb-3">Next Steps</h3>
                <ul className="space-y-2 text-sm text-c-text-secondary">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 size={14} className="mt-0.5 text-c-accent" />
                    <span>Review initiative details</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 size={14} className="mt-0.5 text-c-text-muted" />
                    <span>Assign owners if needed</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 size={14} className="mt-0.5 text-c-text-muted" />
                    <span>Submit for review (Go/No-Go)</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render content
  const renderContent = () => {
    // IMPACT-UX-002: Degraded UX Error State
    if (loadError) {
      return (
        <div className="flex flex-col items-center justify-center h-full min-h-screen bg-slate-50 dark:bg-navy-900 p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-danger-500 mb-4" />
          <h3 className="text-xl font-semibold text-c-text mb-2">
            {loadError.isTransportBlock
              ? isPolish
                ? 'Ochrona przed pętlą zapytań (Transport Safeguard)'
                : 'Requests blocked by global transport safeguard'
              : isPolish
                ? 'Błąd pobierania danych'
                : 'Data Loading Error'}
          </h3>
          <p className="text-c-text-muted max-w-md mb-6">{loadError.message}</p>
          <button
            onClick={() => {
              // IMPACT-TR-002: a user-initiated retry must clear any latched
              // transport/auth-loop guard so the module can recover immediately.
              clearGlobalTransportFailure();
              resetAuthLoopGuard();
              setLoadError(null);
              setIsLoading(true);
              fetchData();
            }}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-md font-medium"
          >
            <RefreshCw className="w-4 h-4" />
            {isPolish ? 'Spróbuj ponownie' : 'Retry'}
          </button>
        </div>
      );
    }

    // Show loading state
    if (isLoading) {
      return (
        <div className="mx-auto max-w-6xl px-6 py-6">
          <SharedLoadingState
            template="list"
            rows={6}
            label={t('tools.hub.loadingSessions', 'Loading tool sessions…')}
          />
        </div>
      );
    }

    // Show ToolWorkspace when a document is active
    if (activeDocumentId) {
      const doc = openDocuments.find((d) => d.id === activeDocumentId);

      // Known Tool Library detail (read-only N-mode)
      if (doc && doc.type === 'tool' && String(doc.id || '').startsWith('known:')) {
        return (
          <KnownToolDetailView
            toolType={String(doc.subType || '')}
            onClose={handleShowList}
            onSessionCreated={handleKnownToolSessionCreated}
          />
        );
      }

      // Show Initiative Document View (canonical full lifecycle view)
      if (doc && doc.type === 'initiative') {
        return (
          <InitiativeDocumentView
            initiativeId={doc.id}
            onBack={handleShowList}
            onStatusChange={() => fetchData(true)}
            sourceModule="tools"
          />
        );
      }

      // Check if this is a tool session (not an initiative)
      if (doc && doc.type === 'tool' && doc.subType !== 'initiative') {
        // Check if the tool type is supported
        const supportedTools = [
          'dynamic-swot',
          'market-forces',
          'growth-paths',
          'value-chain',
          'portfolio-priority',
          'risk-uncertainty',
          'capability-mapper',
          'sop-builder',
          'a3-problem-solving',
          'vsm-builder',
          'smed-planner',
          'dms-builder',
          'inventory-autopilot',
          'constraint-control',
          'decision-engine',
          'control-tower',
          'automation-pipeline',
          'robotics-feasibility',
          'logistics-automation',
          'rpa-scanner',
          'ai-discovery',
          'integration-diagnostic',
          'digital-value-pool',
          'legacy-analyzer',
          'data-inventory',
          'pain-to-solution',
          'pain-explorer',
          'process-automation',
        ];

        const toolType = doc.subType as StoreToolType;

        if (supportedTools.includes(toolType)) {
          // Use new ToolDocumentView - canonical two-column layout
          return (
            <ToolDocumentView
              toolType={toolType}
              sessionId={doc.id}
              autoExportPdf={doc.id === autoExportPdfForId}
              onAutoExportPdfConsumed={() => setAutoExportPdfForId(null)}
              onBack={handleShowList}
              onOpenInitiative={(initiativeId) => {
                // Open initiative in the same hub
                setOpenDocuments((prev) => {
                  const exists = prev.find((d) => d.id === initiativeId);
                  if (!exists) {
                    return [
                      ...prev,
                      {
                        id: initiativeId,
                        name: 'Initiative',
                        type: 'initiative' as const,
                        subType: 'initiative',
                        status: 'DRAFT' as const,
                      },
                    ];
                  }
                  return prev;
                });
                setActiveDocumentId(initiativeId);
              }}
            />
          );
        }
      }

      // Fallback for unsupported tools
      const toolMeta = TOOL_META[doc?.subType as ToolType];
      return (
        <GenericToolDocumentView
          sessionId={doc?.id || ''}
          title={doc?.name}
          toolTypeLabel={toolMeta?.name || doc?.subType}
          statusLabel={doc?.status || undefined}
          onBack={handleShowList}
        />
      );
    }

    // Known Tools Library tab
    if (activeTab === 'library') {
      if (isKnownToolsLoading && knownTools.length === 0) {
        return (
          <div className="h-full overflow-auto p-6">
            <SharedLoadingState
              template="card"
              count={6}
              label={isPolish ? 'Ładowanie biblioteki narzędzi…' : 'Loading tools library…'}
            />
          </div>
        );
      }

      if (knownToolsError && knownTools.length === 0) {
        return (
          <SharedEmptyState
            variant="error"
            title={isPolish ? 'Biblioteka nie została załadowana' : 'Library failed to load'}
            description={knownToolsError}
            onRetry={() => {
              // IMPACT-TR-002: clear any latched guard before retrying.
              clearGlobalTransportFailure();
              resetAuthLoopGuard();
              void fetchKnownTools();
            }}
          />
        );
      }

      type LibraryPreviewItem = (typeof filteredLibraryItems)[number] & { title: string };
      const selectedRow = previewItemId
        ? (filteredLibraryItems.find((d) => d.id === previewItemId) as any)
        : null;
      const selectedItem: LibraryPreviewItem | null = selectedRow
        ? ({ ...selectedRow, title: selectedRow.name } as LibraryPreviewItem)
        : null;
      const itemIds = filteredLibraryItems.map((d) => d.id);
      const renderLibrarySearchEmptyState = () => (
        <div data-testid="tools-library-search-empty-state" className="h-full">
          <SharedEmptyState
            variant="filter"
            icon={Library}
            title={libraryEmptyMessage}
            description={
              isPolish
                ? 'Zmień frazę wyszukiwania lub wyczyść filtry, aby zobaczyć więcej narzędzi.'
                : 'Try a different phrase or clear the search to see more tools.'
            }
            primaryAction={{
              label: isPolish ? 'Wyczyść wyszukiwanie' : 'Clear search',
              onClick: () => setSearchQuery(''),
            }}
          />
        </div>
      );

      const renderPreview = (item: LibraryPreviewItem) => {
        if ((item as any)?.kind === 'assessment') {
          const model: AssessmentFrameworkPreviewModel = {
            id: item.id,
            framework: String((item as any)?.toolType || ''),
            name: item.name,
            description: String((item as any)?.description || ''),
            whatYouGet: Array.isArray((item as any)?.whatYouGet) ? (item as any).whatYouGet : [],
            tags: Array.isArray((item as any)?.tags) ? (item as any).tags : [],
          };
          return <AssessmentFrameworkPreviewV3Body item={model} />;
        }
        return (
          <KnownToolPreviewV3Body
            tool={item as any}
            full={previewKnownTool}
            fullLoading={previewKnownToolLoading}
          />
        );
      };

      const renderFooter = (item: LibraryPreviewItem) => {
        if ((item as any)?.kind === 'assessment') {
          const model: AssessmentFrameworkPreviewModel = {
            id: item.id,
            framework: String((item as any)?.toolType || ''),
            name: item.name,
            description: String((item as any)?.description || ''),
            whatYouGet: Array.isArray((item as any)?.whatYouGet) ? (item as any).whatYouGet : [],
            tags: Array.isArray((item as any)?.tags) ? (item as any).tags : [],
          };
          return (
            <AssessmentFrameworkPreviewV3Footer
              item={model}
              onOpenFull={() => handleRowAction('library_open_full', item as any)}
              onStart={() => handleRowAction('library_start_session', item as any)}
              onChat={() => handleRowAction('library_chat', item as any)}
            />
          );
        }
        return (
          <KnownToolPreviewV3Footer
            tool={item as any}
            full={previewKnownTool}
            fullLoading={previewKnownToolLoading}
            onOpenFull={() => handleRowAction('library_open_full', item as any)}
            onStartSession={() => handleRowAction('library_start_session', item as any)}
            onChat={() => handleRowAction('library_chat', item as any)}
          />
        );
      };

      if (viewMode === 'grid') {
        return (
          <div className="h-full overflow-hidden">
            <TableWithPreviewLayout<LibraryPreviewItem>
              selectedId={previewItemId}
              selectedItem={selectedItem}
              onSelect={setPreviewItemId}
              itemIds={itemIds}
              getItemById={(id) => {
                const x = filteredLibraryItems.find((i) => i.id === id);
                return x ? ({ ...x, title: x.name || x.id } as any) : null;
              }}
              onOpenFull={(id) => {
                const row = filteredLibraryItems.find((d) => d.id === id);
                if (row) handleRowAction('library_open_full', row as any);
              }}
              renderPreview={renderPreview}
              renderPreviewFooter={renderFooter}
            >
              {hasLibrarySearchNoResults ? (
                renderLibrarySearchEmptyState()
              ) : (
                <GridView
                  items={libraryGridItems}
                  selectedItemId={previewItemId}
                  onItemClick={(item) => setPreviewItemId(item.id)}
                  onItemAction={(action, item) => {
                    if (action === 'open') return handleRowAction('library_open_full', item as any);
                    return handleRowAction(action, item as any);
                  }}
                  emptyMessage={libraryEmptyMessage}
                />
              )}
            </TableWithPreviewLayout>
          </div>
        );
      }

      return (
        <div className="h-full overflow-hidden">
          <TableWithPreviewLayout<LibraryPreviewItem>
            selectedId={previewItemId}
            selectedItem={selectedItem}
            onSelect={setPreviewItemId}
            itemIds={itemIds}
            getItemById={(id) => {
              const x = filteredLibraryItems.find((i) => i.id === id);
              return x ? ({ ...x, title: x.name || x.id } as any) : null;
            }}
            onOpenFull={(id) => {
              const row = filteredLibraryItems.find((d) => d.id === id);
              if (row) handleRowAction('library_open_full', row as any);
            }}
            renderPreview={renderPreview}
            renderPreviewFooter={renderFooter}
          >
            {hasLibrarySearchNoResults ? (
              renderLibrarySearchEmptyState()
            ) : (
              <StandardTable
                persistKey="tools.library"
                columns={libraryColumns}
                selection={{ selectedIds: selectedLibraryIds, onChange: setSelectedLibraryIds }}
                data={filteredLibraryItems}
                selectedRowId={previewItemId}
                onRowClick={(row) => setPreviewItemId(row.id)}
                onRowDoubleClick={(row) => handleRowAction('library_open_full', row as any)}
                rowActions={(row) =>
                  [
                    // Blok 1 — GÓRA: akcja główna (kanon ANEKS #4 / §9.1).
                    {
                      id: 'primary',
                      kind: 'open',
                      actions: [
                        {
                          id: 'open',
                          label: t('common.open', 'Open'),
                          icon: ExternalLink,
                          variant: 'primary',
                          disabled: (row as any)?.kind === 'tool' && !(row as any)?.isActive,
                          onClick: () => handleRowAction('library_open_full', row),
                        },
                      ],
                    },
                    // Blok 2 — kontekst encji (preview/start/chat).
                    {
                      id: 'context',
                      kind: 'context',
                      actions: [
                        {
                          id: 'preview',
                          label: t('common.preview', 'Preview'),
                          icon: Eye,
                          onClick: () => setPreviewItemId(row.id),
                        },
                        {
                          id: 'start',
                          label:
                            row?.kind === 'assessment'
                              ? isPolish
                                ? 'Start assessment'
                                : 'Start assessment'
                              : isPolish
                                ? 'Rozpocznij sesję'
                                : 'Start session',
                          icon: Play,
                          disabled:
                            !!(row as any)?.isComingSoon ||
                            ((row as any)?.kind === 'tool' && !(row as any)?.isActive),
                          onClick: () => handleRowAction('library_start_session', row),
                        },
                        {
                          id: 'chat',
                          label: isPolish ? 'Czat' : 'Chat',
                          icon: MessageSquare,
                          disabled: (row as any)?.kind === 'tool' && !(row as any)?.isActive,
                          onClick: () => handleRowAction('library_chat', row),
                        },
                      ],
                    },
                    // Blok 4 — FIXED BOTTOM MANIFEST (kanon §9.2): slot zawsze obecny
                    // i WIDOCZNY, wyszarzony gdy brak endpointu (nigdy cicha pominięcie —
                    // #61 fix: legacy `getRowActions` filtrował disabled=true poza widok,
                    // stąd kebab pokazywał tylko 3 pozycje mimo 5 zadeklarowanych).
                    {
                      id: 'universal',
                      kind: 'manage',
                      actions: [
                        {
                          id: 'archive',
                          label: isPolish ? 'Archiwizuj' : 'Archive',
                          icon: Archive,
                          disabled: true,
                          description: t('common.comingSoonBackend', 'Coming soon (backend)'),
                          onClick: () => undefined,
                        },
                      ],
                    },
                    // Blok 5 — DANGER, zawsze ostatnia, oddzielona separatorem sekcji.
                    {
                      id: 'danger',
                      kind: 'danger',
                      actions: [
                        {
                          id: 'delete',
                          label: isPolish ? 'Usuń' : 'Delete',
                          icon: Trash2,
                          variant: 'danger',
                          disabled: true,
                          description: t('common.comingSoonBackend', 'Coming soon (backend)'),
                          onClick: () => undefined,
                        },
                      ],
                    },
                  ] as RowActionSection[]
                }
                activeFilters={activeFilters}
                onFilterChange={setActiveFilters}
                empty={{ title: libraryEmptyMessage }}
                canvasClassName="pl-4 pr-1.5 pt-3 pb-4"
                density="compact"
              />
            )}
          </TableWithPreviewLayout>
        </div>
      );
    }

    // Unified Sessions tab (tool sessions + assessment sessions)
    if (activeTab === 'sessions' || activeTab === 'list') {
      type SessionPreviewItem = UnifiedSessionRow & { title: string };
      const selectedRow = previewItemId
        ? unifiedSessionsData.find((d: any) => d.id === previewItemId)
        : null;
      const selectedItem: SessionPreviewItem | null = selectedRow
        ? ({ ...selectedRow, title: selectedRow.name } as SessionPreviewItem)
        : null;
      const itemIds = unifiedSessionsData.map((d) => d.id);

      const openFull = (row: any) => {
        if (row?.kind === 'assessmentSession') {
          navigate(`/assessment/${String(row.assessmentType || '').toLowerCase()}/${row.id}`);
          return;
        }
        handleOpenDocument(row);
      };

      return (
        <div className="h-full overflow-hidden">
          <TableWithPreviewLayout<SessionPreviewItem>
            selectedId={previewItemId}
            selectedItem={selectedItem}
            onSelect={setPreviewItemId}
            itemIds={itemIds}
            getItemById={(id) => {
              const x = unifiedSessionsData.find((i) => i.id === id);
              return x ? ({ ...x, title: x.name || x.id } as any) : null;
            }}
            onOpenFull={(id) => {
              const row = unifiedSessionsData.find((d) => d.id === id);
              if (row) openFull(row as any);
            }}
            renderPreview={(item) => {
              if ((item as any)?.kind === 'assessmentSession') {
                return (
                  <AssessmentSessionPreviewV3Body
                    itemName={String(item.name || '')}
                    framework={String((item as any)?.assessmentType || '')}
                    status={String(item.status || '')}
                    progress={Number((item as any)?.progress || 0)}
                    createdAt={(item as any)?.createdAt}
                    updatedAt={(item as any)?.updatedAt}
                    details={
                      (previewFullAssessment as AssessmentSessionPreviewDetails | null) || null
                    }
                    detailsLoading={previewFullAssessmentLoading}
                  />
                );
              }
              return (
                <ToolSessionPreviewV3Body
                  itemName={item.name}
                  itemToolType={String((item as any).apiToolType || (item as any).toolType || '')}
                  status={String(item.status || '')}
                  progress={(item as any).progress}
                  createdAt={(item as any).createdAt}
                  updatedAt={(item as any).updatedAt}
                  details={(previewFullSession as ToolSessionPreviewDetails | null) || null}
                  detailsLoading={previewFullLoading}
                />
              );
            }}
            renderPreviewFooter={(item) => {
              if ((item as any)?.kind === 'assessmentSession') {
                return (
                  <AssessmentSessionPreviewV3Footer onOpenFull={() => openFull(item as any)} />
                );
              }

              const canResume = ['DRAFT', 'PENDING_REVIEW', 'REVIEW'].includes(
                String((item as any).status || '').toUpperCase()
              );

              const refreshFull = async () => {
                try {
                  const refreshed = await Api.getToolSession(String((item as any).id));
                  setPreviewFullSession(refreshed || null);
                } catch {
                  setPreviewFullSession(null);
                }
              };

              return (
                <ToolSessionPreviewV3Footer
                  details={(previewFullSession as ToolSessionPreviewDetails | null) || null}
                  detailsLoading={previewFullLoading}
                  canResume={canResume}
                  showOpen={false}
                  onOpenFull={() => openFull(item as any)}
                  onResume={() => openFull(item as any)}
                  onRequestReview={async () => {
                    try {
                      await Api.requestToolReview((item as any).id, {});
                      toast.success(isPolish ? 'Wysłano do review' : 'Sent for review');
                      await fetchData(true);
                      await refreshFull();
                    } catch (e: any) {
                      toast.error(
                        e?.message ||
                          (isPolish ? 'Nie udało się wysłać do review' : 'Request review failed')
                      );
                    }
                  }}
                  onApprove={async () => {
                    try {
                      await Api.approveTool((item as any).id, {});
                      toast.success(isPolish ? 'Zatwierdzono' : 'Approved');
                      await fetchData(true);
                      await refreshFull();
                    } catch (e: any) {
                      toast.error(
                        e?.message || (isPolish ? 'Nie udało się zatwierdzić' : 'Approve failed')
                      );
                    }
                  }}
                  onSendBack={async () => {
                    const comment = prompt(
                      isPolish ? 'Powód odesłania:' : 'Reason for sending back:'
                    );
                    if (!comment) return;
                    try {
                      await Api.sendToolBackToDraft((item as any).id, comment);
                      toast.success(isPolish ? 'Odesłano do draftu' : 'Sent back to draft');
                      await fetchData(true);
                      await refreshFull();
                    } catch (e: any) {
                      toast.error(
                        e?.message || (isPolish ? 'Nie udało się odesłać' : 'Send back failed')
                      );
                    }
                  }}
                  onOpenGenerateModal={() => setGenerateInitiativesForId((item as any).id)}
                />
              );
            }}
          >
            <StandardTable
              persistKey="tools.sessions"
              columns={sessionsColumns}
              selection={{ selectedIds: selectedSessionsIds, onChange: setSelectedSessionsIds }}
              data={unifiedSessionsData as any}
              selectedRowId={previewItemId}
              onRowClick={(row) => setPreviewItemId(row.id)}
              onRowDoubleClick={(row) => openFull(row as any)}
              rowActions={(row) =>
                [
                  // Blok 1 — GÓRA: akcja główna (kanon ANEKS #4 / §9.1).
                  {
                    id: 'primary',
                    kind: 'open',
                    actions: [
                      {
                        id: 'open',
                        label: t('common.open', 'Open'),
                        icon: ExternalLink,
                        variant: 'primary',
                        onClick: () => openFull(row as any),
                      },
                    ],
                  },
                  // Blok 2 — kontekst encji (preview/chat).
                  {
                    id: 'context',
                    kind: 'context',
                    actions: [
                      {
                        id: 'preview',
                        label: t('common.preview', 'Preview'),
                        icon: Eye,
                        onClick: () => setPreviewItemId(row.id),
                      },
                      {
                        id: 'chat',
                        label: isPolish ? 'Czat' : 'Chat',
                        icon: MessageSquare,
                        onClick: () => {
                          const sessionType = String((row as any)?.sessionType || '').trim();
                          const isAssessment = (row as any)?.kind === 'assessmentSession';
                          void (async () => {
                            try {
                              const convId = await openChatWithContext({
                                entityType: isAssessment ? 'assessment' : 'tool',
                                entityId: sessionType || row.id,
                                entityName: row?.name || sessionType,
                                contextData: {
                                  kind: (row as any)?.kind,
                                  toolType: sessionType,
                                  sessionId: row.id,
                                },
                              });
                              await addChatMessage({
                                conversationId: convId,
                                role: 'user',
                                content: isPolish
                                  ? `Pomóż mi dopracować tę sesję („${row?.name || sessionType}"): brakujące pola, ryzyka i następne kroki.`
                                  : `Help me refine this session ("${row?.name || sessionType}"): missing fields, risks, and next steps.`,
                              } as any);
                              toast.success(t('tools.hub.toast.chatOpened', 'Chat opened'), {
                                duration: 1500,
                              });
                            } catch {
                              toast.error(
                                t('tools.hub.toast.chatOpenError', 'Failed to open chat')
                              );
                            }
                          })();
                        },
                      },
                    ],
                  },
                  // Blok 4 — FIXED BOTTOM MANIFEST (kanon §9.2): slot zawsze obecny
                  // i WIDOCZNY, wyszarzony gdy brak endpointu (nigdy cicha pominięcie —
                  // #61 fix: legacy `getRowActions` filtrował disabled=true poza widok,
                  // stąd kebab pokazywał tylko 3 pozycje mimo 5 zadeklarowanych).
                  {
                    id: 'universal',
                    kind: 'manage',
                    actions: [
                      {
                        id: 'archive',
                        label: isPolish ? 'Archiwizuj' : 'Archive',
                        icon: Archive,
                        disabled: true,
                        description: t('common.comingSoonBackend', 'Coming soon (backend)'),
                        onClick: () => undefined,
                      },
                    ],
                  },
                  // Blok 5 — DANGER, zawsze ostatnia, oddzielona separatorem sekcji.
                  {
                    id: 'danger',
                    kind: 'danger',
                    actions: [
                      {
                        id: 'delete',
                        label: isPolish ? 'Usuń' : 'Delete',
                        icon: Trash2,
                        variant: 'danger',
                        disabled: true,
                        description: t('common.comingSoonBackend', 'Coming soon (backend)'),
                        onClick: () => undefined,
                      },
                    ],
                  },
                ] as RowActionSection[]
              }
              activeFilters={activeFilters}
              onFilterChange={setActiveFilters}
              empty={{
                title: t(
                  'tools.hub.empty.sessions',
                  'No active sessions yet. Start from Library and a new session will appear here automatically.'
                ),
              }}
              canvasClassName="pl-4 pr-1.5 pt-3 pb-4"
              density="compact"
            />
          </TableWithPreviewLayout>
        </div>
      );
    }

    // Table view (default)
    // Use different columns and empty messages based on active tab
    const isInitiativesTab = activeTab === 'initiatives';
    const isReportsAndPresentationsTab = activeTab === 'outputs' || activeTab === 'reports';
    const columns = isInitiativesTab
      ? initiativeColumns
      : isReportsAndPresentationsTab
        ? outputsColumns
        : discoveryColumns;
    const emptyMessage = isInitiativesTab
      ? t(
          'tools.hub.empty.initiatives',
          'No initiatives yet. Generate them from validated tool conclusions.'
        )
      : isReportsAndPresentationsTab
        ? t(
            'tools.hub.empty.outputs',
            'No reports or presentations yet. Finalize a session and generate them here.'
          )
        : t(
            'tools.hub.empty.sessions',
            'No active sessions yet. Start from Library and a new session will appear here automatically.'
          );

    type ToolsPreviewItem = (DisplayItem | OutputItem) & { title: string };

    const selectedRow = previewItemId ? currentData.find((d: any) => d.id === previewItemId) : null;
    const selectedItem: ToolsPreviewItem | null = selectedRow
      ? ({ ...selectedRow, title: selectedRow.name } as ToolsPreviewItem)
      : null;

    const itemIds = currentData.map((d) => d.id);

    return (
      <div className="h-full overflow-hidden">
        <TableWithPreviewLayout<ToolsPreviewItem>
          selectedId={previewItemId}
          selectedItem={selectedItem}
          onSelect={setPreviewItemId}
          itemIds={itemIds}
          getItemById={(id) => {
            const x = currentData.find((i) => i.id === id);
            return x ? ({ ...x, title: x.name || x.id } as any) : null;
          }}
          onOpenFull={(id) => {
            const row = currentData.find((d) => d.id === id);
            if (!row) return;
            if (isReportsAndPresentationsTab) {
              openOutput(row as any);
              return;
            }
            handleOpenDocument(row);
          }}
          renderPreview={(item) => {
            if (isReportsAndPresentationsTab) {
              const kind = String((item as any)?.outputKind || '');
              const label =
                kind === 'assessment_report'
                  ? t('tools.hub.outputs.type.assessmentReport', 'Assessment report')
                  : kind === 'presentation_deck'
                    ? t('tools.hub.outputs.type.presentation', 'Presentation')
                    : t('tools.hub.outputs.type.report', 'Report');
              return (
                <div className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs text-c-text-muted">{label}</div>
                      <div className="text-base font-semibold text-c-text truncate">
                        {item.name}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => openOutput(item as any)}
                      className="inline-flex items-center gap-2 h-8 px-3 rounded-full bg-navy-900 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] text-xs font-medium hover:bg-navy-800 active:scale-[0.98]"
                    >
                      <ExternalLink size={14} />
                      {t('common.open', 'Open')}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="text-c-text-muted">
                      {t('common.status', 'Status')}
                      <div className="text-c-text font-medium mt-0.5">
                        {String((item as any)?.status || '')}
                      </div>
                    </div>
                    <div className="text-c-text-muted">
                      {t('common.updated', 'Updated')}
                      <div className="text-c-text font-medium mt-0.5">
                        {(item as any)?.updatedAt
                          ? new Date((item as any).updatedAt).toLocaleString()
                          : '-'}
                      </div>
                    </div>
                  </div>
                </div>
              );
            }
            if (!isInitiativesTab) {
              const session = item as DisplayItem;
              return (
                <ToolSessionPreviewV3Body
                  itemName={session.name}
                  itemToolType={String(session.apiToolType || session.toolType || '')}
                  status={String(session.status || '')}
                  progress={session.progress}
                  createdAt={session.createdAt}
                  updatedAt={session.updatedAt}
                  details={(previewFullSession as ToolSessionPreviewDetails | null) || null}
                  detailsLoading={previewFullLoading}
                />
              );
            }

            const init =
              selectedInitiative && selectedInitiative.id === item.id
                ? selectedInitiative
                : ((item as any)?._fullData as any) || {};

            const mapToPreviewModel = (i: any): InitiativePreviewV3Model => ({
              id: String(i?.id || item.id),
              name: String(i?.name || i?.title || item.name || ''),
              title: String(i?.title || i?.name || item.name || ''),
              status: i?.status ?? item.status,
              axis: i?.axis ?? (item as any)?.category,
              priority: i?.priority ?? null,
              progress: Number.isFinite(Number((item as any)?.progress))
                ? Number((item as any)?.progress)
                : (i?.progress ?? null),
              createdAt: i?.createdAt ?? i?.created_at ?? (item as any)?.createdAt ?? null,
              updatedAt: i?.updatedAt ?? i?.updated_at ?? (item as any)?.updatedAt ?? null,
              summary: i?.summary ?? null,
              description: i?.description ?? null,
              plannedStartDate: i?.plannedStartDate ?? null,
              plannedEndDate: i?.plannedEndDate ?? null,
              ownerBusiness: i?.ownerBusiness ?? null,
              ownerExecution: i?.ownerExecution ?? null,
              sourceType: i?.sourceType ?? i?.source_type ?? null,
              sourceId: i?.sourceId ?? i?.source_id ?? null,
            });

            const openChat = async (promptText: string) => {
              try {
                const convId = await openChatWithContext({
                  entityType: 'initiative',
                  entityId: item.id,
                  entityName: item.name,
                  contextData: init,
                  pmoContext: { initiativeIds: [item.id] },
                });
                await addChatMessage({
                  conversationId: convId,
                  role: 'user',
                  content: promptText,
                } as any);
                toast.success(t('tools.hub.toast.chatOpened', 'Chat opened'), { duration: 1500 });
              } catch {
                toast.error(t('tools.hub.toast.chatOpenError', 'Failed to open chat'));
              }
            };

            return (
              <InitiativePreviewV3Body
                initiative={mapToPreviewModel(init)}
                onSummarize={() =>
                  openChat(
                    isPolish
                      ? 'Podsumuj tę inicjatywę w 5 punktach i zaproponuj 3 kolejne kroki.'
                      : 'Summarize this initiative in 5 bullets and propose 3 next steps.'
                  )
                }
              />
            );
          }}
          renderPreviewFooter={(item) => {
            if (isInitiativesTab) {
              const init =
                selectedInitiative && selectedInitiative.id === item.id
                  ? selectedInitiative
                  : ((item as any)?._fullData as any) || {};

              const mapToPreviewModel = (i: any): InitiativePreviewV3Model => ({
                id: String(i?.id || item.id),
                name: String(i?.name || i?.title || item.name || ''),
                title: String(i?.title || i?.name || item.name || ''),
                status: i?.status ?? item.status,
                axis: i?.axis ?? (item as any)?.category,
                priority: i?.priority ?? null,
                progress: Number.isFinite(Number((item as any)?.progress))
                  ? Number((item as any)?.progress)
                  : (i?.progress ?? null),
                createdAt: i?.createdAt ?? i?.created_at ?? (item as any)?.createdAt ?? null,
                updatedAt: i?.updatedAt ?? i?.updated_at ?? (item as any)?.updatedAt ?? null,
                summary: i?.summary ?? null,
                description: i?.description ?? null,
                plannedStartDate: i?.plannedStartDate ?? null,
                plannedEndDate: i?.plannedEndDate ?? null,
                ownerBusiness: i?.ownerBusiness ?? null,
                ownerExecution: i?.ownerExecution ?? null,
                sourceType: i?.sourceType ?? i?.source_type ?? null,
                sourceId: i?.sourceId ?? i?.source_id ?? null,
              });

              const statusUpper =
                String(init?.status || item.status || '').toUpperCase() || 'DRAFT';
              const extraPillBase =
                'inline-flex items-center justify-center gap-2 h-9 rounded-full border px-3 text-xs font-medium transition-colors duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900';
              const extraPillNeutral = `${extraPillBase} border-c-border-subtle bg-c-surface-raised text-c-text-secondary hover:bg-c-surface`;

              const openChat = async (promptText: string) => {
                try {
                  const convId = await openChatWithContext({
                    entityType: 'initiative',
                    entityId: item.id,
                    entityName: item.name,
                    contextData: init,
                    pmoContext: { initiativeIds: [item.id] },
                  });
                  await addChatMessage({
                    conversationId: convId,
                    role: 'user',
                    content: promptText,
                  } as any);
                  toast.success(t('tools.hub.toast.chatOpened', 'Chat opened'), { duration: 1500 });
                } catch {
                  toast.error(t('tools.hub.toast.chatOpenError', 'Failed to open chat'));
                }
              };

              const copyLink = async () => {
                try {
                  const url = `${window.location.origin}${ROUTES.INITIATIVES}?open=${encodeURIComponent(item.id)}&mode=doc`;
                  await navigator.clipboard.writeText(url);
                  toast.success(isPolish ? 'Skopiowano link' : 'Link copied');
                } catch {
                  toast.error(isPolish ? 'Nie udało się skopiować' : 'Copy failed');
                }
              };

              return (
                <InitiativePreviewV3Footer
                  initiative={mapToPreviewModel(init)}
                  tasksCount={initiativeTasks?.length}
                  onOpenFull={() => handleOpenDocument(item)}
                  onOpenInModule={() =>
                    navigate(`${ROUTES.INITIATIVES}?open=${encodeURIComponent(item.id)}&mode=doc`)
                  }
                  onOpenChat={(prompt) => openChat(prompt)}
                  onCopyLink={copyLink}
                  extraActionsAfterSlot={
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => submitInitiativeForReviewById(item.id)}
                        disabled={statusUpper !== 'DRAFT'}
                        className={`${extraPillNeutral} ${statusUpper !== 'DRAFT' ? 'opacity-60 cursor-not-allowed' : ''}`}
                        title={
                          statusUpper !== 'DRAFT'
                            ? isPolish
                              ? 'Dostępne tylko dla DRAFT'
                              : 'Available only for DRAFT'
                            : undefined
                        }
                      >
                        <ArrowRight size={14} />
                        {isPolish ? 'Do review' : 'Review'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void copyLink()}
                        className={extraPillNeutral}
                      >
                        {isPolish ? 'Link' : 'Link'}
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await fetchData(true);
                          await fetchInitiativeDetails(item.id);
                        }}
                        className={extraPillNeutral}
                      >
                        {isPolish ? 'Odśwież' : 'Refresh'}
                      </button>
                    </div>
                  }
                />
              );
            }

            const canResume = false;
            const showOpen = isReportsAndPresentationsTab;

            const refreshFull = async () => {
              try {
                const refreshed = await Api.getToolSession(String(item.id));
                setPreviewFullSession(refreshed || null);
              } catch {
                setPreviewFullSession(null);
              }
            };

            return (
              <ToolSessionPreviewV3Footer
                details={(previewFullSession as ToolSessionPreviewDetails | null) || null}
                detailsLoading={previewFullLoading}
                canResume={canResume}
                showOpen={showOpen}
                onOpenFull={() => handleOpenDocument(item)}
                onResume={() => handleOpenDocument(item)}
                onRequestReview={async () => {
                  try {
                    await Api.requestToolReview(item.id, {});
                    toast.success(isPolish ? 'Wysłano do review' : 'Sent for review');
                    await fetchData(true);
                    await refreshFull();
                  } catch (e: any) {
                    toast.error(
                      e?.message ||
                        (isPolish ? 'Nie udało się wysłać do review' : 'Request review failed')
                    );
                  }
                }}
                onApprove={async () => {
                  try {
                    await Api.approveTool(item.id, {});
                    toast.success(isPolish ? 'Zatwierdzono' : 'Approved');
                    await fetchData(true);
                    await refreshFull();
                  } catch (e: any) {
                    toast.error(
                      e?.message || (isPolish ? 'Nie udało się zatwierdzić' : 'Approve failed')
                    );
                  }
                }}
                onSendBack={async () => {
                  const comment = prompt(
                    isPolish ? 'Powód odesłania:' : 'Reason for sending back:'
                  );
                  if (!comment) return;
                  try {
                    await Api.sendToolBackToDraft(item.id, comment);
                    toast.success(isPolish ? 'Odesłano do draftu' : 'Sent back to draft');
                    await fetchData(true);
                    await refreshFull();
                  } catch (e: any) {
                    toast.error(
                      e?.message || (isPolish ? 'Nie udało się odesłać' : 'Send back failed')
                    );
                  }
                }}
                onOpenGenerateModal={() => setGenerateInitiativesForId(item.id)}
              />
            );
          }}
        >
          <StandardTable
            persistKey={isInitiativesTab ? 'tools.initiatives' : 'tools.outputs'}
            columns={columns}
            selection={{ selectedIds: selectedReportsIds, onChange: setSelectedReportsIds }}
            data={currentData}
            selectedRowId={previewItemId}
            onRowClick={(row) => setPreviewItemId(row.id)}
            onRowDoubleClick={(row) => {
              if (isReportsAndPresentationsTab) {
                openOutput(row as any);
                return;
              }
              handleOpenDocument(row);
            }}
            rowActions={
              isInitiativesTab
                ? (row) => {
                    const id = String(row?.id || '').trim();
                    return [
                      {
                        id: 'primary',
                        kind: 'open',
                        actions: [
                          {
                            id: 'open',
                            label: isPolish ? 'Otwórz' : 'Open',
                            icon: ExternalLink,
                            variant: 'primary',
                            onClick: () => handleOpenDocument(row),
                          },
                        ],
                      },
                      {
                        id: 'context',
                        kind: 'context',
                        actions: [
                          {
                            id: 'preview',
                            label: t('common.preview', 'Preview'),
                            icon: Eye,
                            onClick: () => setPreviewItemId(id),
                          },
                          {
                            id: 'open-initiatives',
                            label: isPolish ? 'Otwórz w Inicjatywach' : 'Open in Initiatives',
                            icon: ChevronRight,
                            onClick: () =>
                              navigate(
                                `${ROUTES.INITIATIVES}?open=${encodeURIComponent(id)}&mode=doc`
                              ),
                          },
                          {
                            id: 'chat',
                            label: isPolish ? 'Czat' : 'Chat',
                            icon: MessageSquare,
                            onClick: async () => {
                              const init = (row as any)?._fullData || {};
                              const convId = await openChatWithContext({
                                entityType: 'initiative',
                                entityId: id,
                                entityName: String(row?.name || row?.title || '') || id,
                                contextData: init,
                                pmoContext: { initiativeIds: [id] },
                              });
                              await addChatMessage({
                                conversationId: convId,
                                role: 'user',
                                content: isPolish
                                  ? 'Pomóż mi dopracować tę inicjatywę: brakujące pola, ryzyka, KPI i następne kroki.'
                                  : 'Help me refine this initiative: missing fields, risks, KPIs, and next steps.',
                              } as any);
                            },
                          },
                        ],
                      },
                    ] as RowActionSection[];
                  }
                : isReportsAndPresentationsTab
                  ? (row) => {
                      const id = String(row?.id || '').trim();
                      return [
                        // Blok 1 — GÓRA: akcja główna (kanon ANEKS #4 / §9.1).
                        {
                          id: 'primary',
                          kind: 'open',
                          actions: [
                            {
                              id: 'open',
                              label: isPolish ? 'Otwórz' : 'Open',
                              icon: ExternalLink,
                              variant: 'primary',
                              onClick: () => openOutput(row as any),
                            },
                          ],
                        },
                        {
                          id: 'context',
                          kind: 'context',
                          actions: [
                            {
                              id: 'preview',
                              label: t('common.preview', 'Preview'),
                              icon: Eye,
                              onClick: () => setPreviewItemId(id),
                            },
                            {
                              id: 'chat',
                              label: isPolish ? 'Czat' : 'Chat',
                              icon: MessageSquare,
                              onClick: () => setPreviewItemId(id),
                            },
                          ],
                        },
                        // Blok 4 — FIXED BOTTOM MANIFEST (kanon §9.2): slot zawsze
                        // obecny i WIDOCZNY, wyszarzony gdy brak endpointu (nigdy
                        // cicha pominięcie — #61 fix: legacy `getRowActions`
                        // filtrował disabled=true poza widok).
                        {
                          id: 'universal',
                          kind: 'manage',
                          actions: [
                            {
                              id: 'archive',
                              label: isPolish ? 'Archiwizuj' : 'Archive',
                              icon: Archive,
                              disabled: true,
                              description: t('common.comingSoonBackend', 'Coming soon (backend)'),
                              onClick: () => undefined,
                            },
                          ],
                        },
                        // Blok 5 — DANGER, zawsze ostatnia, oddzielona separatorem sekcji.
                        {
                          id: 'danger',
                          kind: 'danger',
                          actions: [
                            {
                              id: 'delete',
                              label: isPolish ? 'Usuń' : 'Delete',
                              icon: Trash2,
                              variant: 'danger',
                              disabled: true,
                              description: t('common.comingSoonBackend', 'Coming soon (backend)'),
                              onClick: () => undefined,
                            },
                          ],
                        },
                      ] as RowActionSection[];
                    }
                  : undefined
            }
            activeFilters={activeFilters}
            onFilterChange={setActiveFilters}
            empty={{ title: emptyMessage }}
            canvasClassName="pl-4 pr-1.5 pt-3 pb-4"
            density="compact"
          />
        </TableWithPreviewLayout>
      </div>
    );
  };

  const getStatusOptionLabel = useCallback(
    (id: string, fallback: string) => {
      const key = String(id || '').toLowerCase();
      const dict: Record<string, string> = {
        all: t('common.all', 'All'),
        draft: t('common.draft', 'Draft'),
        pending_review: t('common.pendingReview', 'Pending Review'),
        approved: t('common.approved', 'Approved'),
        completed: t('common.completed', 'Completed'),
        proposed: t('common.proposed', 'Proposed'),
        planned: t('common.planned', 'Planned'),
        in_progress: t('common.inProgress', 'In Progress'),
        cancelled: t('common.cancelled', 'Cancelled'),
      };
      return dict[key] || fallback;
    },
    [t]
  );

  const toolPickerCategories = useMemo(() => {
    const items: Array<{
      id: ToolCategory | 'all';
      label: string;
      count?: number;
      icon?: React.ReactNode;
    }> = [
      { id: 'all', label: t('common.all', 'All') },
      ...Object.entries(CATEGORY_META).map(([key, meta]) => ({
        id: key as ToolCategory,
        label: meta.name,
        count: meta.count,
        icon: meta.icon,
      })),
    ];
    return items;
  }, [t]);

  const toolPickerItems = useMemo(() => {
    const q = String(addMenuQuery || '')
      .trim()
      .toLowerCase();

    const base = Object.entries(TOOL_META).map(([shortCode, meta]) => {
      const toolType = SHORT_TO_TOOL_TYPE[String(shortCode || '').trim()];
      return {
        id: String(toolType || shortCode),
        toolType: String(toolType || shortCode),
        shortCode: String(meta.shortName || shortCode),
        name: meta.name,
        description: meta.description,
        category: meta.category,
        kind: 'tool' as const,
        isActive: (knownTools || []).some(
          (item) =>
            String(item?.toolType || '').trim() === String(toolType || shortCode).trim() &&
            item?.isActive === true
        ),
      };
    });

    const assessments = (Object.keys(ASSESSMENT_FRAMEWORK_META) as AssessmentFramework[]).map(
      (fw) => ({
        id: `assessment:${fw}`,
        toolType: fw,
        shortCode: fw,
        name: ASSESSMENT_FRAMEWORK_META[fw].name,
        description: isPolish ? 'Framework assessment' : 'Assessment framework',
        category: 'licensed' as ToolCategory,
        kind: 'assessment' as const,
        isActive: true,
      })
    );

    const catalog =
      strategyCatalogSlugs.length > 0
        ? strategyCatalogSlugs.map((slug) => ({
            id: `catalog:${slug}`,
            toolType: slug,
            shortCode: slug,
            name: titleFromSlug(slug),
            description: isPolish ? 'Framework (docs-driven)' : 'Framework (docs-driven)',
            category: 'strategic' as ToolCategory,
            kind: 'catalog' as const,
            isActive: false,
          }))
        : [];

    const all = [...base, ...assessments, ...catalog].filter((x) => Boolean(x.toolType));

    return all
      .filter((x) => (addMenuCategory === 'all' ? true : x.category === addMenuCategory))
      .filter((x) => {
        if (!q) return true;
        return (
          x.name.toLowerCase().includes(q) ||
          x.shortCode.toLowerCase().includes(q) ||
          x.toolType.toLowerCase().includes(q) ||
          String(x.description || '')
            .toLowerCase()
            .includes(q)
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [addMenuCategory, addMenuQuery, isPolish, knownTools, strategyCatalogSlugs, titleFromSlug]);

  // PrimaryCta: no leading `+` icon per §2.2 / §2.1 canon.
  // Chevron is allowed because the button opens a tool-picker menu (variants).
  const PrimaryCta = (
    <div ref={addMenuRef} className="relative">
      <button
        type="button"
        onClick={() => setIsAddMenuOpen((v) => !v)}
        className="inline-flex items-center gap-2 h-9 px-4 rounded-full text-sm font-medium bg-navy-900 text-white hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] transition-colors duration-150"
        aria-expanded={isAddMenuOpen}
      >
        <span>{isPolish ? 'Dodaj narzędzie' : t('tools.hub.addTool', 'Add tool')}</span>
        <ChevronDown
          size={16}
          className={`text-white/80 transition-transform duration-200 ${isAddMenuOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isAddMenuOpen ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsAddMenuOpen(false)} />
          <div className="absolute right-0 top-full mt-2 z-50 w-[520px] max-w-[calc(100vw-24px)] rounded-2xl border border-slate-200/60 dark:border-white/[0.03] dark:border-white/[0.08] bg-c-surface shadow-xl shadow-black/20 overflow-hidden">
            <div className="p-3 border-b border-c-border-subtle dark:border-white/[0.06]">
              <div className="relative">
                <input
                  value={addMenuQuery}
                  onChange={(e) => setAddMenuQuery(e.target.value)}
                  placeholder={isPolish ? 'Szukaj narzędzia…' : 'Search tools…'}
                  className="w-full h-9 rounded-full px-4 pr-10 text-sm bg-c-bg/70 border border-c-border-subtle text-c-text placeholder:text-c-text-muted focus:outline-none focus:ring-2 focus:ring-c-focus"
                />
                {addMenuQuery ? (
                  <button
                    type="button"
                    onClick={() => setAddMenuQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-c-text-secondary hover:text-slate-700 dark:hover:text-slate-200"
                    aria-label={isPolish ? 'Wyczyść' : 'Clear'}
                  >
                    <X size={16} />
                  </button>
                ) : null}
              </div>

              <div className="mt-2 flex flex-wrap gap-2">
                {toolPickerCategories.map((c) => {
                  const active = addMenuCategory === c.id;
                  return (
                    <button
                      key={String(c.id)}
                      type="button"
                      onClick={() => setAddMenuCategory(c.id)}
                      className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium border transition-colors ${
                        active
                          ? 'border-c-accent/40 bg-c-accent-soft text-c-text'
                          : 'border-c-border-subtle bg-c-surface-raised text-c-text-secondary hover:bg-c-surface'
                      }`}
                    >
                      {c.icon ? <span className="text-c-text-muted">{c.icon}</span> : null}
                      <span>{c.label}</span>
                      {c.count != null ? (
                        <span className="ml-1 px-1.5 py-0.5 rounded-full text-[11px] bg-c-border-subtle text-c-text-secondary">
                          {c.count}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* #64: AI picker — "Nie wiesz, które wybrać?" free-text -> top-3 candidates */}
            <div className="p-3 border-b border-c-border-subtle dark:border-white/[0.06] bg-c-surface-raised/40">
              <div className="text-xs font-medium text-c-text-secondary mb-1.5">
                {isPolish ? 'Nie wiesz, które wybrać?' : 'Not sure which one to pick?'}
              </div>
              <div className="flex items-start gap-2">
                <textarea
                  value={suggestProblemText}
                  onChange={(e) => setSuggestProblemText(e.target.value)}
                  placeholder={
                    isPolish
                      ? 'Opisz problem w 1-2 zdaniach…'
                      : 'Describe the problem in 1-2 sentences…'
                  }
                  rows={2}
                  maxLength={500}
                  className="flex-1 resize-none rounded-xl px-3 py-2 text-sm bg-c-bg/70 border border-c-border-subtle text-c-text placeholder:text-c-text-muted focus:outline-none focus:ring-2 focus:ring-c-focus"
                />
                <button
                  type="button"
                  onClick={() => void handleSuggestTool()}
                  disabled={isSuggestingTool || suggestProblemText.trim().length < 3}
                  className="shrink-0 h-9 px-3 rounded-full text-xs font-medium bg-navy-900 text-white hover:bg-navy-800 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] transition-colors duration-150"
                >
                  {isSuggestingTool
                    ? isPolish
                      ? 'Analizuję…'
                      : 'Analyzing…'
                    : isPolish
                      ? 'Zaproponuj narzędzie'
                      : 'Suggest a tool'}
                </button>
              </div>

              {suggestToolError ? (
                <div className="mt-2 text-xs text-c-text-muted">{suggestToolError}</div>
              ) : null}

              {suggestToolResults && suggestToolResults.length > 0 ? (
                <div className="mt-2 space-y-1.5">
                  {suggestToolResults.map((s) => (
                    <button
                      key={s.toolType}
                      type="button"
                      onClick={() => handleSelectSuggestedTool(s.toolType, s.name)}
                      className="w-full flex items-start gap-2 px-3 py-2 rounded-xl text-left border border-c-accent/30 bg-c-accent-soft/40 hover:bg-c-accent-soft transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-c-text truncate">{s.name}</span>
                          <span className="shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-c-border-subtle text-c-text-secondary">
                            {s.confidence === 'high'
                              ? isPolish
                                ? 'Wysokie dopasowanie'
                                : 'High match'
                              : s.confidence === 'medium'
                                ? isPolish
                                  ? 'Średnie dopasowanie'
                                  : 'Medium match'
                                : isPolish
                                  ? 'Niskie dopasowanie'
                                  : 'Low match'}
                          </span>
                        </div>
                        <div className="text-xs text-c-text-muted mt-0.5">{s.reasoning}</div>
                      </div>
                      <span className="mt-0.5 text-c-text-secondary">
                        <ArrowRight size={14} />
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="max-h-[60vh] overflow-auto p-2">
              {toolPickerItems.length === 0 ? (
                <div className="p-4 text-sm text-c-text-muted">
                  {isPolish ? 'Brak wyników.' : 'No results.'}
                </div>
              ) : (
                <div className="space-y-1">
                  {toolPickerItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setIsAddMenuOpen(false);
                        if (item.kind === 'assessment') {
                          void createAndOpenAssessmentSession({
                            assessmentType: item.toolType,
                            name: `${item.shortCode} — ${isPolish ? 'Assessment' : 'Assessment'}`,
                            source: 'add_menu',
                          });
                        } else {
                          if (!item.isActive) {
                            toast.error(
                              isPolish
                                ? 'To narzędzie nie jest jeszcze aktywne.'
                                : 'This tool is not active yet.'
                            );
                            return;
                          }
                          void createAndOpenToolSession({
                            toolType: item.toolType,
                            name: item.name,
                            source: 'add_menu',
                          });
                        }
                      }}
                      className={`w-full flex items-start gap-3 px-3 py-2 rounded-xl text-left transition-colors ${
                        item.isActive || item.kind === 'assessment'
                          ? 'hover:bg-c-surface-raised dark:hover:bg-white/[0.04]'
                          : 'opacity-60'
                      }`}
                    >
                      <span className="mt-0.5 font-mono text-xs font-bold text-c-text-muted w-12 truncate">
                        {item.kind === 'catalog' ? 'DOCS' : item.shortCode}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-c-text truncate">{item.name}</div>
                        <div className="text-xs text-c-text-muted truncate">{item.description}</div>
                        {item.kind !== 'assessment' ? (
                          <div className="mt-1 text-[11px] text-c-text-muted">
                            {item.isActive
                              ? isPolish
                                ? 'Aktywne'
                                : 'Active'
                              : isPolish
                                ? 'Nieaktywne'
                                : 'Inactive'}
                          </div>
                        ) : null}
                      </div>
                      <span className="mt-0.5 text-c-text-secondary">
                        <ArrowRight size={16} />
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );

  // Status Filter Dropdown Component (Filters — last in right cluster)
  // Domain-specific trigger label: "Status: All", "Status: Draft", etc. per §2.1
  const StatusFilterDropdown = (
    <div ref={statusDropdownRef} className="relative">
      <button
        type="button"
        onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
        className={`
          inline-flex items-center gap-2 h-9 px-4 rounded-full text-sm font-medium
          border transition-all duration-200
          ${
            isStatusDropdownOpen
              ? 'bg-c-accent-soft border-c-accent text-c-accent'
              : 'bg-c-surface-raised border-c-border-subtle text-c-text-secondary hover:bg-c-surface'
          }
        `}
      >
        <Filter size={16} className="text-c-text-secondary" />
        <span className={`w-2 h-2 rounded-full ${selectedStatusOption.bgColor}`} />
        <span>
          {isPolish ? 'Status' : 'Status'}:{' '}
          {getStatusOptionLabel(selectedStatusOption.id, selectedStatusOption.label)}
        </span>
        <ChevronDown
          size={16}
          className={`text-c-text-secondary transition-transform duration-200 ${isStatusDropdownOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isStatusDropdownOpen && (
        <div className="absolute top-full right-0 mt-1 z-50 min-w-[180px] py-1 bg-white dark:bg-navy-800 border border-slate-300 dark:border-navy-600 rounded-lg shadow-xl shadow-black/30">
          {currentStatusOptions.map((option) => {
            const isSelected = statusFilter === option.id;
            return (
              <button
                key={option.id}
                onClick={() => {
                  setStatusFilter(option.id);
                  setIsStatusDropdownOpen(false);
                }}
                className={`
                  w-full flex items-center gap-3 px-3 py-2 text-left
                  transition-colors duration-150
                  ${
                    isSelected
                      ? 'bg-c-accent-soft text-c-text'
                      : 'text-c-text-secondary hover:bg-c-surface-raised hover:text-c-text dark:hover:text-white'
                  }
                `}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${option.bgColor}`} />
                <span className="flex-1 text-sm">
                  {getStatusOptionLabel(option.id, option.label)}
                </span>
                {isSelected && (
                  <svg
                    className="w-4 h-4 text-c-accent"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  // CommandRowContent: canonical Menu 3 layout — flex justify-between, left=presets, right=actions.
  const CommandRowContent = (
    <div className="flex w-full items-center justify-between gap-3">
      <div className={MENU_3_LEFT_CLASS}>
        {activeTab === 'library' ? (
          <>
            {(
              [
                {
                  id: 'all' as const,
                  label: t('common.all', 'All'),
                  count: libraryCatalogItems.length,
                  dot: 'bg-c-text-muted',
                },
                {
                  id: 'strategic' as const,
                  label: isPolish ? 'Strategia' : 'Strategy',
                  count: libraryCategoryCounts.strategic,
                  dot: 'bg-emerald-500',
                },
                {
                  id: 'operational' as const,
                  label: isPolish ? 'Operacje' : 'Operations',
                  count: libraryCategoryCounts.operational,
                  dot: 'bg-blue-500',
                },
                {
                  id: 'digital' as const,
                  label: 'Digital',
                  count: libraryCategoryCounts.digital,
                  dot: 'bg-blue-500',
                },
                {
                  id: 'automation' as const,
                  label: isPolish ? 'Automatyzacje' : 'Automation',
                  count: libraryCategoryCounts.automation,
                  dot: 'bg-amber-500',
                },
                {
                  id: 'licensed' as const,
                  label: isPolish ? 'Assessments' : 'Assessments',
                  count: libraryCategoryCounts.licensed,
                  dot: 'bg-danger-500',
                },
                {
                  id: 'other' as const,
                  label: isPolish ? 'Inne' : 'Other',
                  count: libraryCategoryCounts.other,
                  dot: 'bg-c-text-muted',
                },
              ] as const
            ).map((opt) => {
              const isActive = libraryCategoryFilter === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setLibraryCategoryFilter(isActive ? 'all' : opt.id)}
                  className={isActive ? MENU_3_CHIP_ACTIVE : MENU_3_CHIP_INACTIVE}
                >
                  <span
                    className={
                      opt.id === 'all' ? MENU_3_ALL_DOT_CLASS : `w-2 h-2 rounded-full ${opt.dot}`
                    }
                  />
                  <span>{opt.label}</span>
                  <span className={isActive ? MENU_3_BADGE_ACTIVE : MENU_3_BADGE_INACTIVE}>
                    {opt.count}
                  </span>
                </button>
              );
            })}
          </>
        ) : (
          <>
            {currentStatusOptions.map((opt) => {
              const isActive = statusFilter === opt.id;
              const label = getStatusOptionLabel(opt.id, opt.label);
              const count = statusCountsForCommandRow[opt.id] ?? 0;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setStatusFilter(isActive ? 'all' : opt.id)}
                  className={isActive ? MENU_3_CHIP_ACTIVE : MENU_3_CHIP_INACTIVE}
                >
                  <span
                    className={
                      opt.id === 'all'
                        ? MENU_3_ALL_DOT_CLASS
                        : `w-2 h-2 rounded-full ${opt.bgColor}`
                    }
                  />
                  <span>{label}</span>
                  <span className={isActive ? MENU_3_BADGE_ACTIVE : MENU_3_BADGE_INACTIVE}>
                    {count}
                  </span>
                </button>
              );
            })}
          </>
        )}
      </div>
      {/* Right slot: contextual AI / actions — empty for now, reserved per §3.4 */}
      <div />
    </div>
  );

  // View modes: Library supports table+grid (segmented icon buttons via ModuleNavBar);
  // other tabs support table only. §2.2 / §2c canon: view toggle must be segmented icons.
  const activeViewModes: ViewMode[] = activeTab === 'library' ? ['table', 'grid'] : ['table'];

  return (
    <>
      <StandardModuleBar
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onSearch={setSearchQuery}
        searchValue={searchQuery}
        /* Wiersz kart otwartych (Menu 3, tryb 3) TYLKO gdy karta jest naprawdę
         * otwarta. `ModuleNavBar` przełącza Menu 3 w tryb kart, gdy lista nie
         * jest pusta — a `openDocuments` żyje w sessionStorage, więc karmienie
         * go bezwarunkowo zabierałoby chipy kategorii (All/Strategy/…) z
         * Biblioteki na długo po zamknięciu sesji. Na liście = jak dotąd. */
        openItems={activeDocumentId ? openDocuments : []}
        activeItemId={activeDocumentId}
        onSelectItem={setActiveDocumentId}
        onCloseItem={handleCloseDocument}
        onShowList={handleShowList}
        activeFilters={activeFilters}
        onRemoveFilter={handleRemoveFilter}
        onClearFilters={handleClearFilters}
        commandRowContent={CommandRowContent}
        primaryCtaContent={PrimaryCta}
        viewModes={activeViewModes}
        filterControls={activeTab === 'library' ? null : StatusFilterDropdown}
      >
        {renderContent()}
      </StandardModuleBar>

      {generateInitiativesForId ? (
        <GenerateInitiativesModal
          isPolish={isPolish}
          defaults={generationDefaults}
          onClose={() => setGenerateInitiativesForId(null)}
          onGenerate={async (payload) => {
            const toolId = generateInitiativesForId;
            try {
              setGenerationDefaults(payload);
              const result = await Api.generateToolInitiatives(toolId, payload);
              toast.success(isPolish ? 'Wygenerowano inicjatywy' : 'Initiatives generated');
              // I1 — actionable dedup. When the server-side flag
              // (INITIATIVE_DEDUP_ACTIONABLE) is ON it SKIPS creating
              // high-confidence duplicates and returns them in `skipped`. Surface
              // that as a concrete outcome ("N skipped") instead of a vague warning.
              // Server flag OFF → `skipped` absent/empty → legacy warning path below.
              const skipped = Array.isArray(result?.skipped) ? result.skipped : [];
              if (skipped.length > 0) {
                const skippedNames = skipped
                  .map((s: { title: string }) => s.title)
                  .filter(Boolean)
                  .slice(0, 3)
                  .join(', ');
                toast(
                  isPolish
                    ? `Pominięto ${skipped.length} duplikat(ów) — już istnieją w portfolio (${skippedNames}).`
                    : `Skipped ${skipped.length} duplicate(s) — already in the portfolio (${skippedNames}).`,
                  { icon: '⏭️', duration: 6000 }
                );
              }
              // #68b — functional parity with the canonical AI Initiative Wizard's
              // duplicate/similar detection (POST /initiatives/similarity-check).
              // Informational only, shown after success — never blocks creation.
              const duplicateWarnings = Array.isArray(result?.duplicateWarnings)
                ? result.duplicateWarnings
                : [];
              if (duplicateWarnings.length > 0) {
                const names = duplicateWarnings
                  .map((w: { title: string }) => w.title)
                  .filter(Boolean)
                  .slice(0, 3)
                  .join(', ');
                toast(
                  isPolish
                    ? `Uwaga: ${duplicateWarnings.length} z wygenerowanych inicjatyw przypomina istniejące (${names}). Sprawdź portfolio pod kątem duplikatów.`
                    : `Heads up: ${duplicateWarnings.length} generated initiative(s) resemble existing ones (${names}). Review the portfolio for duplicates.`,
                  { icon: '⚠️', duration: 6000 }
                );
              }
              setGenerateInitiativesForId(null);
              await fetchData(true);
              // Refresh preview details if preview is open for this session
              if (previewItemId === toolId) {
                const refreshed = await Api.getToolSession(toolId);
                setPreviewFullSession(refreshed || null);
              }
            } catch (e: any) {
              toast.error(
                e?.message ||
                  (isPolish ? 'Nie udało się wygenerować inicjatyw' : 'Generation failed')
              );
            }
          }}
        />
      ) : null}
    </>
  );
};

export default DiscoveryToolsHub;
