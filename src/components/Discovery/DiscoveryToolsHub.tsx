/**
 * DiscoveryToolsHub (V3: unified "Tools" hub)
 * Single mental model: Library → Sessions → Outputs → Initiatives
 * Categories: Strategy, Operations, Digital, Process Automation, Licensed
 *
 * V3-E01: User has one "Tools" entry point, licensed/assessment is a category
 * not a separate world. Breadcrumbs: "Tools > ..."
 */

import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Cpu,
  DollarSign,
  ExternalLink,
  Eye,
  FileText,
  Filter,
  Flag,
  FolderOutput,
  Grid3X3,
  Library,
  Lightbulb,
  List,
  ListTodo,
  Loader2,
  MessageSquare,
  Play,
  Plus,
  Settings,
  Shield,
  Target,
  TrendingUp,
  User,
  Users,
  X,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { useOpenChatWithContext } from '@/hooks/useOpenChatWithContext';
import { ROUTES } from '@/routes/routeConfig';
import { Api } from '@/services/api';
import { trackFunnelEvent } from '@/services/funnelAnalytics';
import { useAppStore } from '@/store/useAppStore';
import { useConversationStore } from '@/store/useConversationStore';
import { ToolType as StoreToolType } from '@/store/useToolStore';
import { listStrategyToolSlugs } from '@/toolCatalog/strategy/catalog';

import { ToolDocumentView, ToolWorkspace } from '../DiscoveryTools';
import { GenerateInitiativesModal } from '../DiscoveryTools/GenerateInitiativesModal';
import { GenericToolDocumentView } from '../DiscoveryTools/GenericToolDocumentView';
import { KnownToolDetailView } from '../DiscoveryTools/KnownToolDetailView';
import { getToolCategoryLabel } from '../DiscoveryTools/ToolSessionPreview';
import {
  ToolSessionPreviewV3Body,
  ToolSessionPreviewV3Footer,
  type ToolSessionPreviewDetails,
} from '../DiscoveryTools/ToolSessionPreviewV3';
import { InitiativeDocumentView } from '../Initiatives/InitiativeDocumentView';
import { type RowAction, RowActionsMenu } from '../shared/RowActionsMenu';
import {
  FilterableTable,
  FilterChip,
  GridItem,
  GridView,
  ItemStatus,
  ModuleHub,
  ModuleTab,
  OpenDocument,
  TableColumn,
  ViewMode,
} from '../shared/ModuleHub';
import { useModuleOpenDocuments } from '../shared/ModuleHub/useModuleOpenDocuments';
import { TableWithPreviewLayout } from '../shared/TableWithPreviewLayout';

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
  { id: 'all', label: 'All', color: 'text-slate-400', bgColor: 'bg-slate-500' },
  { id: 'draft', label: 'Draft', color: 'text-slate-400', bgColor: 'bg-slate-500' },
  {
    id: 'pending_review',
    label: 'Pending Review',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500',
  },
];

// Reports tab: APPROVED, COMPLETED (finished analyses)
const REPORTS_STATUSES: StatusFilterOption[] = [
  { id: 'all', label: 'All', color: 'text-slate-400', bgColor: 'bg-slate-500' },
  { id: 'approved', label: 'Approved', color: 'text-emerald-400', bgColor: 'bg-emerald-500' },
  { id: 'completed', label: 'Completed', color: 'text-blue-400', bgColor: 'bg-blue-500' },
];

// Initiatives tab: DRAFT, PROPOSED, PLANNED, IN_PROGRESS, COMPLETED, CANCELLED
const INITIATIVES_STATUSES: StatusFilterOption[] = [
  { id: 'all', label: 'All', color: 'text-slate-400', bgColor: 'bg-slate-500' },
  { id: 'draft', label: 'Draft', color: 'text-slate-400', bgColor: 'bg-slate-500' },
  { id: 'proposed', label: 'Proposed', color: 'text-purple-400', bgColor: 'bg-purple-500' },
  { id: 'planned', label: 'Planned', color: 'text-blue-400', bgColor: 'bg-blue-500' },
  { id: 'in_progress', label: 'In Progress', color: 'text-amber-400', bgColor: 'bg-amber-500' },
  { id: 'completed', label: 'Completed', color: 'text-emerald-400', bgColor: 'bg-emerald-500' },
  { id: 'cancelled', label: 'Cancelled', color: 'text-red-400', bgColor: 'bg-red-500' },
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
    color: string;
    count: number;
  }
> = {
  strategic: {
    name: 'Strategy',
    icon: <Target size={16} />,
    color: 'emerald',
    count: 10,
  },
  operational: {
    name: 'Operations',
    icon: <Settings size={16} />,
    color: 'blue',
    count: 10,
  },
  digital: {
    name: 'Digital',
    icon: <Cpu size={16} />,
    color: 'purple',
    count: 10,
  },
  automation: {
    name: 'Process Auto',
    icon: <Zap size={16} />,
    color: 'amber',
    count: 1,
  },
  licensed: {
    name: 'Licensed',
    icon: <Shield size={16} />,
    color: 'rose',
    count: 3,
  },
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
  confidenceAvg?: number;
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
}

export const DiscoveryToolsHub: React.FC<DiscoveryToolsHubProps> = ({ initialTab = 'library' }) => {
  // V3-E01: Normalize legacy tab ids
  const normalizedInitialTab =
    initialTab === 'list' ? 'sessions' : initialTab === 'reports' ? 'outputs' : initialTab;
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentProjectId } = useAppStore();
  const openChatWithContext = useOpenChatWithContext();
  const addChatMessage = useConversationStore((s) => s.addMessage);
  const { i18n, t } = useTranslation();
  const lang = i18n.language === 'pl' ? 'pl' : 'en';
  const isPolish = lang === 'pl';

  // UI State
  const [activeTab, setActiveTab] = useState<ModuleTab>(normalizedInitialTab);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<FilterChip[]>([]);
  const [previewItemId, setPreviewItemId] = useState<string | null>(null);
  const [previewFullSession, setPreviewFullSession] = useState<any | null>(null);
  const [previewFullLoading, setPreviewFullLoading] = useState(false);
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
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const statusDropdownRef = React.useRef<HTMLDivElement>(null);
  const [isViewDropdownOpen, setIsViewDropdownOpen] = useState(false);
  const viewDropdownRef = React.useRef<HTMLDivElement>(null);
  const [initiativeDetailsExpanded, setInitiativeDetailsExpanded] = useState(false);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [addMenuCategory, setAddMenuCategory] = useState<ToolCategory | 'all'>('all');
  const [addMenuQuery, setAddMenuQuery] = useState('');
  const addMenuRef = useRef<HTMLDivElement>(null);

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
  const [reports, setReports] = useState<DisplayItem[]>([]);
  const [initiatives, setInitiatives] = useState<DisplayItem[]>([]);
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
      isComingSoon: boolean;
      sortOrder: number;
      createdAt: string | null;
    }>
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Initiative detail state
  const [selectedInitiative, setSelectedInitiative] = useState<FullInitiativeData | null>(null);
  const [initiativeTasks, setInitiativeTasks] = useState<InitiativeTask[]>([]);
  const [isLoadingInitiative, setIsLoadingInitiative] = useState(false);

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
      reviewRequestedAt: session.reviewRequestedAt ? new Date(session.reviewRequestedAt) : undefined,
      approvedAt: session.approvedAt ? new Date(session.approvedAt) : undefined,
      apiToolType: session.toolType,
    };
  }, []);

  // Fetch data from API
  const fetchData = useCallback(
    async (showRefreshIndicator = false) => {
      if (showRefreshIndicator) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      try {
        // Fetch all tool sessions
        const response = await Api.listToolSessions({
          projectId: currentProjectId || undefined,
        });

        const allSessions = (response.items || []).map(transformToolSession);

        // Split by status for different tabs
        // Discovery: DRAFT, REVIEW (work in progress)
        const discoveryItems = allSessions.filter(
          (s) => s.status === 'DRAFT' || s.status === 'PENDING_REVIEW'
        );
        setDiscoveries(discoveryItems);

        // Reports: APPROVED, COMPLETED (finished analyses)
        const reportItems = allSessions.filter(
          (s) => s.status === 'APPROVED' || s.status === 'DONE'
        );
        setReports(reportItems);

        // Initiatives: Fetch DRAFT initiatives (generated from tools/assessment)
        try {
          const initiativesList = await Api.getInitiativesByStatus(
            'DRAFT',
            currentProjectId || undefined
          );

          // Map initiatives to display format
          const draftInitiatives = initiativesList.slice(0, 100).map((i: any) => ({
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
          setInitiatives(draftInitiatives);
        } catch (err) {
          console.warn('[DiscoveryToolsHub] Failed to fetch initiatives:', err);
          setInitiatives([]);
        }
      } catch (error: any) {
        console.error('[DiscoveryToolsHub] Fetch error:', error);
        toast.error('Failed to load tool sessions');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [currentProjectId, transformToolSession]
  );

  // Fetch data on mount and when projectId changes
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fetchKnownTools = useCallback(async () => {
    try {
      const res = await Api.getKnownTools({ lang, limit: 50, offset: 0 });
      setKnownTools(res.items || []);
    } catch (error: any) {
      console.warn('[DiscoveryToolsHub] Failed to fetch known tools:', error);
      setKnownTools([]);
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
        toast.success(isPolish ? 'Wysłano inicjatywę do review' : 'Initiative submitted for review', {
          duration: 2000,
        });
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
    setInitiativeDetailsExpanded(false);
    setIsAddMenuOpen(false);
    setAddMenuCategory('all');
    setAddMenuQuery('');
  }, [activeTab]);

  // KANON: entering full view or switching away from table should close preview.
  useEffect(() => {
    if (activeDocumentId) setPreviewItemId(null);
  }, [activeDocumentId]);

  useEffect(() => {
    if (viewMode !== 'table') setPreviewItemId(null);
  }, [viewMode]);

  // Tools → Initiatives: preview needs richer data (owners/tasks), so fetch on selection.
  useEffect(() => {
    if (activeTab !== 'initiatives') return;
    if (!previewItemId) return;
    setInitiativeDetailsExpanded(false);
    void fetchInitiativeDetails(previewItemId);
  }, [activeTab, fetchInitiativeDetails, previewItemId]);

  // Tools → Sessions/Outputs: fetch full tool session for canonical preview.
  useEffect(() => {
    const shouldFetch =
      Boolean(previewItemId) && (activeTab === 'sessions' || activeTab === 'outputs' || activeTab === 'reports');
    if (!shouldFetch) {
      setPreviewFullSession(null);
      setPreviewFullLoading(false);
      return;
    }

    let cancelled = false;
    setPreviewFullSession(null);
    setPreviewFullLoading(true);
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

    return () => {
      cancelled = true;
    };
  }, [activeTab, previewItemId]);

  // Close status dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setIsStatusDropdownOpen(false);
      }
      if (viewDropdownRef.current && !viewDropdownRef.current.contains(event.target as Node)) {
        setIsViewDropdownOpen(false);
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
  const tabs = useMemo(
    () => [
      {
        id: 'library' as ModuleTab,
        label: t('tools.hub.tabs.library', 'Library'),
        icon: <Library size={16} />,
        count: knownTools.length,
      },
      {
        id: 'sessions' as ModuleTab,
        label: t('tools.hub.tabs.sessions', 'Sessions'),
        icon: <Play size={16} />,
        count: discoveries.length,
      },
      {
        id: 'outputs' as ModuleTab,
        label: t('tools.hub.tabs.outputs', 'Outputs'),
        icon: <FolderOutput size={16} />,
        count: reports.length,
      },
      {
        id: 'initiatives' as ModuleTab,
        label: t('tools.hub.tabs.initiatives', 'Initiatives'),
        icon: <Lightbulb size={16} />,
        count: initiatives.length,
      },
    ],
    [discoveries.length, reports.length, initiatives.length, knownTools.length, t]
  );

  // Table columns
  const discoveryColumns: TableColumn[] = useMemo(
    () => [
      {
        id: 'toolType',
        label: 'Type',
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
              <span className={`text-${categoryMeta.color}-400`}>{categoryMeta.icon}</span>
              <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                {meta?.shortName || row.toolType}
              </span>
            </div>
          );
        },
      },
      {
        id: 'name',
        label: 'Name',
        render: (row) => (
          <div className="min-w-0">
            <span className="block text-sm text-slate-900 dark:text-white font-medium truncate">
              {row.name}
            </span>
          </div>
        ),
      },
      {
        id: 'category',
        label: 'Category',
        width: '130px',
        filterable: true,
        filterOptions: Object.entries(CATEGORY_META).map(([key, meta]) => ({
          value: key,
          label: meta.name,
        })),
        render: (row) => {
          const meta = CATEGORY_META[row.category as ToolCategory];
          return (
            <span className={`text-xs font-medium text-${meta?.color || 'slate'}-400`}>
              {meta?.name || row.category}
            </span>
          );
        },
      },
      {
        id: 'status',
        label: 'Status',
        width: '140px',
        filterable: true,
        filterOptions: [
          { value: 'draft', label: 'Draft', color: 'bg-slate-400' },
          { value: 'in_review', label: 'In Review', color: 'bg-amber-400' },
          { value: 'approved', label: 'Approved', color: 'bg-emerald-400' },
          { value: 'completed', label: 'Completed', color: 'bg-emerald-400' },
        ],
      },
      {
        id: 'progress',
        label: 'Progress',
        width: '150px',
      },
      {
        id: 'updatedAt',
        label: 'Updated',
        width: '120px',
        sortable: true,
      },
    ],
    []
  );

  const libraryColumns: TableColumn[] = useMemo(
    () => [
      {
        id: 'name',
        label: t('tools.hub.table.tool', 'Tool'),
        render: (row) => (
          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <div
                className="text-sm font-medium text-slate-900 dark:text-white truncate"
                title={row.name}
              >
                {row.name}
              </div>
              {row.isComingSoon ? (
                <span className="shrink-0 inline-flex items-center h-6 px-2 rounded-full text-[11px] border border-slate-200/70 dark:border-white/[0.08] bg-white/60 dark:bg-white/[0.04] text-slate-600 dark:text-slate-300">
                  {t('common.comingSoon', 'Coming soon')}
                </span>
              ) : null}
            </div>
          </div>
        ),
      },
      {
        id: 'libraryCategory',
        label: t('tools.hub.table.category', 'Category'),
        width: '140px',
        filterable: true,
        filterOptions: Object.entries(CATEGORY_META).map(([key, meta]) => ({
          value: key,
          label: meta.name,
        })),
        render: (row) => {
          const category = (row.libraryCategory || '') as ToolCategory;
          const meta = CATEGORY_META[category];
          return (
            <span className={`text-xs font-medium text-${meta?.color || 'slate'}-400`}>
              {meta?.name || row.libraryCategory || '-'}
            </span>
          );
        },
      },
      {
        id: 'tags',
        label: t('tools.hub.table.tags', 'Tags'),
        render: (row) => (
          <div className="flex flex-wrap gap-1">
            {(row.tags || []).slice(0, 4).map((tag: string) => (
              <span
                key={tag}
                className="px-2 py-0.5 rounded-full text-[11px] bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-navy-700"
              >
                {tag}
              </span>
            ))}
            {(row.tags || []).length > 4 ? (
              <span className="text-[11px] text-slate-500">+{(row.tags || []).length - 4}</span>
            ) : null}
          </div>
        ),
      },
      {
        id: 'license',
        label: t('tools.hub.table.license', 'License'),
        width: '110px',
        filterable: true,
        filterOptions: [
          { value: 'licensed', label: t('tools.hub.license.licensed', 'Licensed') },
          { value: 'free', label: t('tools.hub.license.free', 'Free') },
        ],
        render: (row) => (
          <span
            className={`text-xs font-medium ${
              row.isLicensed ? 'text-amber-500' : 'text-emerald-500'
            }`}
          >
            {row.isLicensed
              ? t('tools.hub.license.licensed', 'Licensed')
              : t('tools.hub.license.free', 'Free')}
          </span>
        ),
      },
    ],
    [t]
  );

  // Columns for Initiatives tab
  const initiativeColumns: TableColumn[] = useMemo(
    () => [
      {
        id: 'name',
        label: t('tools.hub.initiatives.columns.initiative', 'Initiative'),
        render: (row) => (
          <div className="min-w-0">
            <span className="block text-sm text-slate-900 dark:text-white font-medium truncate">
              {row.name}
            </span>
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
            strategic: 'text-emerald-400',
            operational: 'text-blue-400',
            digital: 'text-purple-400',
          };
          return (
            <span
              className={`text-xs font-medium capitalize ${axisColors[row.category] || 'text-slate-400'}`}
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
          const priority = row._fullData?.priority || 'MEDIUM';
          const priorityColors: Record<string, string> = {
            CRITICAL: 'bg-red-500/20 text-red-400',
            HIGH: 'bg-orange-500/20 text-orange-400',
            MEDIUM: 'bg-amber-500/20 text-amber-400',
            LOW: 'bg-slate-500/20 text-slate-400',
          };
          return (
            <span
              className={`px-2 py-0.5 text-[11px] font-medium rounded-full ${
                priorityColors[priority] || priorityColors.MEDIUM
              }`}
            >
              {priority}
            </span>
          );
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
            <span className={`text-xs font-medium ${roi ? 'text-green-400' : 'text-slate-500'}`}>
              {roi ? `${roi.toFixed(1)}x` : '-'}
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
            <span className="text-xs text-slate-400 flex items-center gap-1">
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

  const openDocumentById = useCallback(
    async (id: string) => {
      const existing = openDocuments.find((d) => d.id === id);
      if (existing) {
        setActiveDocumentId(existing.id);
        return;
      }

      const reportMatch = reports.find((r) => r.id === id);
      if (reportMatch) {
        handleOpenDocument(reportMatch);
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
        const initiative = await Api.get(`/api/initiatives/${id}`);
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
      reports,
      initiatives,
      discoveries,
      setActiveDocumentId,
      handleOpenDocument,
      transformToolSession,
    ]
  );

  const handleOpenKnownTool = useCallback(
    (row: any) => {
      const toolType = String(row?.toolType || '').trim();
      if (!toolType) return;

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
    [setOpenDocuments]
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
      setActiveDocumentId(sessionId);
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

  useEffect(() => {
    if (!hydrated) return;
    const docId = String(searchParams.get('docId') || '').trim();
    if (!docId) return;
    void openDocumentById(docId).finally(() => {
      const next = new URLSearchParams(searchParams);
      next.delete('docId');
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
    async (params: { toolType: string; name?: string; source?: 'add_menu' | 'library' }) => {
      const toolType = String(params.toolType || '').trim();
      if (!toolType) return;
      try {
        const sessionName =
          String(params.name || '').trim() ||
          `${toolType} — ${isPolish ? 'Sesja' : 'Session'}`;
        const created = await Api.createToolSession({
          toolType,
          name: sessionName,
          projectId: currentProjectId ?? null,
        });
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

  const handleRowAction = useCallback(
    (action: string, row: any) => {
      if (action === 'view' || action === 'edit') {
        handleOpenDocument(row);
      } else if (action === 'preview') {
        setPreviewItemId(row.id);
      } else if (action === 'library_open_full') {
        handleOpenKnownTool(row);
      } else if (action === 'library_start_session') {
        const toolType = String(row?.toolType || '').trim();
        if (!toolType) return;
        if (row?.isComingSoon) return;
        void createAndOpenToolSession({
          toolType,
          name: `${row?.name || toolType} — ${isPolish ? 'Sesja' : 'Session'}`,
          source: 'library',
        });
      } else if (action === 'library_chat') {
        const toolType = String(row?.toolType || '').trim();
        if (!toolType) return;
        (async () => {
          try {
            const convId = await openChatWithContext({
              entityType: 'tool',
              entityId: toolType,
              entityName: row?.name || toolType,
              contextData: {
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
                ? `Wyjaśnij, kiedy użyć tego narzędzia („${row?.name || toolType}”), jakie są typowe pułapki oraz jakie deliverables powinienem otrzymać.`
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
      createAndOpenToolSession,
      handleOpenDocument,
      handleOpenKnownTool,
      isPolish,
      openChatWithContext,
      t,
    ]
  );

  // Get current data based on tab
  const currentData = useMemo(() => {
    let data: DisplayItem[] = [];
    switch (activeTab) {
      case 'library':
        data = [];
        break;
      case 'sessions':
      case 'list':
        data = discoveries;
        break;
      case 'outputs':
      case 'reports':
        data = reports;
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
          item.status === statusFilter ||
          item.status.replace('_', '') === statusFilter.replace('_', '')
        );
      });
    }

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      data = data.filter(
        (item) =>
          item.name.toLowerCase().includes(query) ||
          item.toolType.toLowerCase().includes(query) ||
          item.category.toLowerCase().includes(query)
      );
    }

    return data;
  }, [activeTab, discoveries, reports, initiatives, searchQuery, statusFilter]);

  const filteredKnownTools = useMemo(() => {
    let data = knownTools.slice();
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      data = data.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.toolType.toLowerCase().includes(q) ||
          (t.libraryCategory || '').toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q)
      );
    }
    return data;
  }, [knownTools, searchQuery]);

  const libraryGridItems: GridItem[] = useMemo(() => {
    return filteredKnownTools.map((tool) => ({
      ...tool,
      id: tool.toolType,
      name: tool.name,
      type: tool.libraryCategory || 'tool',
      typeColor:
        tool.libraryCategory === 'strategic'
          ? 'emerald'
          : tool.libraryCategory === 'operational'
            ? 'blue'
            : tool.libraryCategory === 'digital'
              ? 'purple'
              : 'amber',
      status: 'DRAFT',
      progress: 0,
      updatedAt: tool.createdAt || new Date(),
    }));
  }, [filteredKnownTools]);

  // Convert to grid items
  const gridItems: GridItem[] = useMemo(() => {
    return currentData.map((item) => {
      const meta = TOOL_META[item.toolType as ToolType];
      const categoryMeta = CATEGORY_META[meta?.category || 'strategic'];
      return {
        ...item,
        type: item.toolType,
        typeColor: categoryMeta?.color || 'slate',
        status: mapStatusToUppercase(item.status),
      };
    });
  }, [currentData]);

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
        return 'bg-green-500/20 text-green-400';
      case 'IN_PROGRESS':
        return 'bg-blue-500/20 text-blue-400';
      case 'BLOCKED':
        return 'bg-red-500/20 text-red-400';
      default:
        return 'bg-slate-500/20 text-slate-400';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
        return 'text-red-400';
      case 'HIGH':
        return 'text-orange-400';
      case 'MEDIUM':
        return 'text-amber-400';
      default:
        return 'text-slate-400';
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
          <div className="flex flex-col items-center gap-3 text-slate-500 dark:text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin" />
            <span>Loading initiative details...</span>
          </div>
        </div>
      );
    }

    if (!selectedInitiative) {
      return (
        <div className="flex items-center justify-center h-full text-slate-500">
          <div className="text-center">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-amber-400/50" />
            <p className="text-lg text-slate-900 dark:text-white">Initiative not found</p>
            <button
              onClick={handleShowList}
              className="mt-4 px-4 py-2 bg-slate-200 dark:bg-navy-700 hover:bg-slate-300 dark:hover:bg-navy-600 text-slate-900 dark:text-white rounded-lg text-sm transition-colors"
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
      <div className="h-full flex flex-col overflow-hidden bg-slate-50 dark:bg-navy-950">
        {/* Header */}
        <div className="shrink-0 border-b border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 px-6 py-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <button
                  onClick={handleShowList}
                  className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-navy-700 rounded-lg transition-colors"
                >
                  <ChevronRight size={18} className="rotate-180" />
                </button>
                <span className="px-2 py-0.5 text-xs font-medium rounded bg-slate-500/20 text-slate-400">
                  DRAFT
                </span>
                {selectedInitiative.axis && (
                  <span className="px-2 py-0.5 text-xs font-medium rounded bg-purple-500/20 text-purple-400 capitalize">
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
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                {selectedInitiative.name}
              </h1>
              {selectedInitiative.description && (
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                  {selectedInitiative.description}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate(`/initiatives?open=${encodeURIComponent(selectedInitiative.id)}&mode=doc`)}
                className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-navy-700 rounded-lg transition-colors"
              >
                Open Full View
              </button>
              <button
                onClick={handleSubmitForReview}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors flex items-center gap-2"
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
                <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-5">
                  <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-3 flex items-center gap-2">
                    <FileText size={14} />
                    Summary
                  </h3>
                  <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                    {selectedInitiative.summary}
                  </p>
                </div>
              )}

              {/* Tasks Section */}
              <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-2">
                    <ListTodo size={14} />
                    Tasks ({taskStats.total})
                  </h3>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-green-400">{taskStats.done} Done</span>
                    <span className="text-blue-400">{taskStats.inProgress} In Progress</span>
                    {taskStats.blocked > 0 && (
                      <span className="text-red-400">{taskStats.blocked} Blocked</span>
                    )}
                  </div>
                </div>

                {/* Task Progress Bar */}
                {taskStats.total > 0 && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                      <span>Completion</span>
                      <span>{completionPercent}%</span>
                    </div>
                    <div className="h-2 bg-slate-200 dark:bg-navy-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-purple-500 to-purple-400 rounded-full transition-all"
                        style={{ width: `${completionPercent}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Tasks List */}
                {initiativeTasks.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <ListTodo className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No tasks yet</p>
                    <p className="text-xs text-slate-600 mt-1">
                      Tasks will be added during planning phase
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {initiativeTasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-navy-800 rounded-lg border border-slate-200 dark:border-navy-700 hover:border-purple-500/30 transition-colors"
                      >
                        <div
                          className={`w-2 h-2 rounded-full ${
                            task.status === 'DONE'
                              ? 'bg-green-400'
                              : task.status === 'IN_PROGRESS'
                                ? 'bg-blue-400'
                                : task.status === 'BLOCKED'
                                  ? 'bg-red-400'
                                  : 'bg-slate-400'
                          }`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-slate-900 dark:text-white font-medium truncate">
                              {task.title}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${getTaskStatusColor(task.status)}`}
                            >
                              {task.status.replace('_', ' ')}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
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
                <div className="bg-slate-100/50 dark:bg-navy-900/50 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <Zap size={12} className="text-amber-400" />
                    <span>
                      Generated from:{' '}
                      <span className="text-slate-900 dark:text-white capitalize">
                        {selectedInitiative.sourceType}
                      </span>
                    </span>
                    {selectedInitiative.sourceId && (
                      <span className="text-slate-500">
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
              <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-5">
                <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-4">
                  Key Metrics
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
                      <DollarSign size={14} />
                      CAPEX
                    </span>
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">
                      {formatCurrency(selectedInitiative.costCapex)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
                      <DollarSign size={14} />
                      OPEX
                    </span>
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">
                      {formatCurrency(selectedInitiative.costOpex)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
                      <TrendingUp size={14} />
                      Expected ROI
                    </span>
                    <span className="text-sm font-semibold text-green-400">
                      {selectedInitiative.expectedRoi
                        ? `${selectedInitiative.expectedRoi.toFixed(1)}x`
                        : '-'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Timeline */}
              <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-5">
                <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-4 flex items-center gap-2">
                  <Calendar size={14} />
                  Timeline
                </h3>
                <div className="space-y-3">
                  <div>
                    <span className="text-xs text-slate-500">Start Date</span>
                    <div className="text-sm text-slate-900 dark:text-white">
                      {formatDate(selectedInitiative.plannedStartDate)}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">End Date</span>
                    <div className="text-sm text-slate-900 dark:text-white">
                      {formatDate(selectedInitiative.plannedEndDate)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Ownership */}
              <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-5">
                <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-4 flex items-center gap-2">
                  <Users size={14} />
                  Ownership
                </h3>
                <div className="space-y-3">
                  <div>
                    <span className="text-xs text-slate-500">Business Owner</span>
                    <div className="text-sm text-slate-900 dark:text-white">
                      {selectedInitiative.ownerBusiness ? (
                        `${selectedInitiative.ownerBusiness.firstName} ${selectedInitiative.ownerBusiness.lastName}`
                      ) : (
                        <span className="text-slate-500">Not assigned</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">Execution Owner</span>
                    <div className="text-sm text-slate-900 dark:text-white">
                      {selectedInitiative.ownerExecution ? (
                        `${selectedInitiative.ownerExecution.firstName} ${selectedInitiative.ownerExecution.lastName}`
                      ) : (
                        <span className="text-slate-500">Not assigned</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Next Steps */}
              <div className="bg-purple-500/10 rounded-xl border border-purple-500/20 p-5">
                <h3 className="text-xs font-semibold text-purple-400 uppercase mb-3">Next Steps</h3>
                <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 size={14} className="mt-0.5 text-purple-400" />
                    <span>Review initiative details</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 size={14} className="mt-0.5 text-slate-500" />
                    <span>Assign owners if needed</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 size={14} className="mt-0.5 text-slate-500" />
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
    // Show loading state
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="flex flex-col items-center gap-3 text-slate-500 dark:text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin" />
            <span>Loading tool sessions...</span>
          </div>
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
      if (viewMode === 'grid') {
        return (
          <GridView
            items={libraryGridItems}
            onItemClick={(item) => handleOpenKnownTool(item)}
            emptyMessage={t('tools.hub.empty.library', 'No tools available.')}
          />
        );
      }

      return (
        <div className="h-full overflow-hidden">
          <FilterableTable
            columns={libraryColumns}
            data={filteredKnownTools}
            onRowClick={handleOpenKnownTool}
            onRowDoubleClick={handleOpenKnownTool}
            onRowAction={handleRowAction}
            getRowActions={(row) =>
              [
                {
                  id: 'open',
                  label: t('common.open', 'Open'),
                  icon: ExternalLink,
                  variant: 'primary',
                  onClick: () => handleRowAction('library_open_full', row),
                },
                {
                  id: 'start',
                  label: isPolish ? 'Rozpocznij sesję' : 'Start session',
                  icon: Play,
                  disabled: !!(row as any)?.isComingSoon,
                  onClick: () => handleRowAction('library_start_session', row),
                },
                {
                  id: 'chat',
                  label: isPolish ? 'Czat' : 'Chat',
                  icon: MessageSquare,
                  divider: true,
                  onClick: () => handleRowAction('library_chat', row),
                },
              ] as RowAction[]
            }
            activeFilters={activeFilters}
            onFilterChange={setActiveFilters}
            emptyMessage={t('tools.hub.empty.library', 'No tools available.')}
            canvasClassName="pl-4 pr-1.5 pt-3 pb-4"
            density="compact"
          />
        </div>
      );
    }

    // Grid view
    if (viewMode === 'grid') {
      return (
        <GridView
          items={gridItems}
          onItemClick={handleOpenDocument}
          onItemAction={handleRowAction}
          emptyMessage="No discoveries yet. Select a tool category to start."
        />
      );
    }

    // Table view (default)
    // Use different columns and empty messages based on active tab
    const isInitiativesTab = activeTab === 'initiatives';
    const isOutputsTab = activeTab === 'outputs' || activeTab === 'reports';
    const columns = isInitiativesTab ? initiativeColumns : discoveryColumns;
    const emptyMessage = isInitiativesTab
      ? 'No draft initiatives yet. Run a tool or assessment to generate initiatives.'
      : isOutputsTab
        ? 'No outputs yet. Finalize a tool session to generate reports and presentations.'
        : 'No active sessions. Start a tool from the Library to begin.';

    type ToolsPreviewItem = DisplayItem & { title: string };

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
          onOpenFull={(id) => {
            const row = currentData.find((d) => d.id === id);
            if (row) handleOpenDocument(row);
          }}
          renderKicker={(item) =>
            isInitiativesTab
              ? isPolish
                ? 'Inicjatywa'
                : 'Initiative'
              : getToolCategoryLabel(String(item.apiToolType || ''), isPolish)
          }
          renderPreview={(item) => {
            if (!isInitiativesTab) {
              return (
                <ToolSessionPreviewV3Body
                  itemName={item.name}
                  itemToolType={String(item.apiToolType || item.toolType || '')}
                  status={String(item.status || '')}
                  progress={item.progress}
                  createdAt={item.createdAt}
                  updatedAt={item.updatedAt}
                  details={(previewFullSession as ToolSessionPreviewDetails | null) || null}
                  detailsLoading={previewFullLoading}
                />
              );
            }

            const init =
              selectedInitiative && selectedInitiative.id === item.id
                ? selectedInitiative
                : ((item as any)?._fullData as any) || {};

            const status = String(init?.status || item.status || '').toUpperCase() || 'DRAFT';
            const axis = String(init?.axis || (item as any)?.category || '').trim();
            const priority = String(init?.priority || '').trim();
            const progress = Number.isFinite(item.progress as any) ? (item.progress as any) : null;

            const createdAt = init?.createdAt || init?.created_at || (item as any)?.createdAt;
            const updatedAt = init?.updatedAt || init?.updated_at || item.updatedAt;
            const fmtDate = (value: any) => {
              if (!value) return '—';
              const d = value instanceof Date ? value : new Date(value);
              if (Number.isNaN(d.getTime())) return '—';
              return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
            };

            const detailsText = String(init?.summary || init?.description || '').trim();

            const detailsMenu: RowAction[] = [
              {
                id: 'toggle',
                label: initiativeDetailsExpanded
                  ? isPolish
                    ? 'Zwiń'
                    : 'Collapse'
                  : isPolish
                    ? 'Rozwiń'
                    : 'Expand',
                onClick: () => setInitiativeDetailsExpanded((v) => !v),
              },
              {
                id: 'summarize',
                label: isPolish ? 'Podsumuj' : 'Summarize',
                onClick: async () => {
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
                      content: isPolish
                        ? 'Podsumuj tę inicjatywę w 5 punktach i zaproponuj 3 kolejne kroki.'
                        : 'Summarize this initiative in 5 bullets and propose 3 next steps.',
                    } as any);
                    toast.success(t('tools.hub.toast.chatOpened', 'Chat opened'), { duration: 1500 });
                  } catch {
                    toast.error(t('tools.hub.toast.chatOpenError', 'Failed to open chat'));
                  }
                },
              },
              {
                id: 'copy',
                label: isPolish ? 'Kopiuj' : 'Copy',
                divider: true,
                onClick: async () => {
                  try {
                    await navigator.clipboard.writeText([item.name, '', detailsText].filter(Boolean).join('\n'));
                    toast.success(isPolish ? 'Skopiowano' : 'Copied');
                  } catch {
                    toast.error(isPolish ? 'Nie udało się skopiować' : 'Copy failed');
                  }
                },
              },
            ];

            const metaPill = (label: string, value: string) => (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border border-slate-200/70 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.04] text-slate-700 dark:text-slate-200">
                <span className="text-slate-500 dark:text-slate-400">{label}</span>
                <span className="text-slate-900 dark:text-white">{value}</span>
              </span>
            );

            const statusPill = (value: string) => (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border border-slate-200/70 dark:border-white/[0.08] bg-transparent text-slate-700 dark:text-slate-200">
                {value.replace(/_/g, ' ')}
              </span>
            );

            return (
              <div className="space-y-4">
                {/* Brief/meta card — mirrors MyWork rhythm */}
                <div className="rounded-xl border border-slate-200/70 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.04] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border border-slate-200/70 dark:border-white/[0.08] bg-transparent text-slate-700 dark:text-slate-200">
                      {isPolish ? 'Inicjatywa' : 'Initiative'}
                    </span>
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      {statusPill(status)}
                      {progress != null ? metaPill(isPolish ? 'Postęp' : 'Progress', `${progress}%`) : null}
                      {axis ? metaPill(isPolish ? 'Oś' : 'Axis', axis) : null}
                      {priority ? metaPill(isPolish ? 'Pilność' : 'Priority', priority) : null}
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <div className="text-slate-500 dark:text-slate-400">
                        {isPolish ? 'Utworzono' : 'Created'}
                      </div>
                      <div className="text-slate-900 dark:text-white">{fmtDate(createdAt)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-slate-500 dark:text-slate-400">
                        {isPolish ? 'Ostatnia zmiana' : 'Last modified'}
                      </div>
                      <div className="text-slate-900 dark:text-white">{fmtDate(updatedAt)}</div>
                    </div>
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {isPolish ? 'Szczegóły' : 'Details'}
                    </div>
                    <RowActionsMenu iconVariant="vertical" actions={detailsMenu} />
                  </div>

                  <div
                    className={[
                      'text-sm text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap',
                      initiativeDetailsExpanded ? '' : 'line-clamp-6',
                    ].join(' ')}
                  >
                    {detailsText || (isPolish ? 'Brak opisu.' : 'No description.')}
                  </div>
                </div>
              </div>
            );
          }}
          renderPreviewFooter={(item) => {
            if (isInitiativesTab) {
              const init =
                selectedInitiative && selectedInitiative.id === item.id
                  ? selectedInitiative
                  : ((item as any)?._fullData as any) || {};

              const status = String(init?.status || item.status || '').toUpperCase() || 'DRAFT';
              const hintChipClass =
                'inline-flex items-center h-7 px-2.5 rounded-full text-[11px] font-medium border border-slate-200/70 dark:border-white/[0.08] bg-transparent text-slate-500 dark:text-slate-300 hover:bg-slate-100/50 dark:hover:bg-white/[0.04] transition-colors active:scale-[0.98]';
              const footerPillBase =
                'inline-flex items-center justify-center gap-2 h-9 rounded-full border px-3 text-xs font-medium transition-colors duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900';
              const pillNeutral =
                `${footerPillBase} border-slate-200/70 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.04] text-slate-700 dark:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-white/[0.06]`;
              const pillPrimary =
                `${footerPillBase} border-primary-500/30 bg-primary-500/10 text-primary-600 dark:text-primary-300 hover:bg-primary-500/15`;

              const openChat = async (promptText: string) => {
                try {
                  const convId = await openChatWithContext({
                    entityType: 'initiative',
                    entityId: item.id,
                    entityName: item.name,
                    contextData: init,
                    pmoContext: { initiativeIds: [item.id] },
                  });
                  await addChatMessage({ conversationId: convId, role: 'user', content: promptText } as any);
                  toast.success(t('tools.hub.toast.chatOpened', 'Chat opened'), { duration: 1500 });
                } catch {
                  toast.error(t('tools.hub.toast.chatOpenError', 'Failed to open chat'));
                }
              };

              const aiHints = isPolish
                ? [
                    { label: 'Kolejne kroki', prompt: 'Zaproponuj 3 kolejne kroki dla tej inicjatywy.' },
                    { label: 'Ryzyka', prompt: 'Wypisz 5 ryzyk i propozycje mitigacji dla tej inicjatywy.' },
                    { label: 'Zakres', prompt: 'Ułóż krótki zakres i kryteria sukcesu dla tej inicjatywy.' },
                  ]
                : [
                    { label: 'Next steps', prompt: 'Propose 3 next steps for this initiative.' },
                    { label: 'Risks', prompt: 'List 5 risks and mitigations for this initiative.' },
                    { label: 'Scope', prompt: 'Draft a short scope and success criteria for this initiative.' },
                  ];

              const aiMenu: RowAction[] = [
                {
                  id: 'regenerate',
                  label: isPolish ? 'Regeneruj' : 'Regenerate',
                  onClick: () =>
                    openChat(
                      isPolish
                        ? 'Wygeneruj 3 szybkie hinty (co zrobić / na co uważać / jak mierzyć).'
                        : 'Generate 3 quick hints (what to do / risks / how to measure).'
                    ),
                },
                {
                  id: 'copy-link',
                  label: isPolish ? 'Kopiuj link' : 'Copy link',
                  divider: true,
                  onClick: async () => {
                    try {
                      const url = `${window.location.origin}${ROUTES.INITIATIVES}?open=${encodeURIComponent(item.id)}&mode=doc`;
                      await navigator.clipboard.writeText(url);
                      toast.success(isPolish ? 'Skopiowano link' : 'Link copied');
                    } catch {
                      toast.error(isPolish ? 'Nie udało się skopiować' : 'Copy failed');
                    }
                  },
                },
                {
                  id: 'clear',
                  label: isPolish ? 'Wyczyść' : 'Clear',
                  onClick: () => {
                    setInitiativeDetailsExpanded(false);
                    toast.success(isPolish ? 'Wyczyściłem stan podglądu' : 'Preview state cleared', {
                      duration: 1200,
                    });
                  },
                },
              ];

              const relationsPill = (label: string, value: string, onClick?: () => void) => (
                <button
                  type="button"
                  onClick={onClick}
                  disabled={!onClick}
                  className={[
                    'inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium border',
                    'border-slate-200/70 dark:border-white/[0.08]',
                    'bg-transparent',
                    onClick
                      ? 'text-slate-700 dark:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-white/[0.06] transition-colors'
                      : 'text-slate-500 dark:text-slate-400 cursor-default',
                  ].join(' ')}
                >
                  <span className="text-slate-500 dark:text-slate-400">{label}</span>
                  <span className="truncate max-w-[220px]">{value}</span>
                </button>
              );

              const sourceType = String(init?.sourceType || init?.source_type || '').trim();
              const sourceId = String(init?.sourceId || init?.source_id || '').trim();
              const sourceLabel = sourceType
                ? sourceId
                  ? `${sourceType} · ${sourceId.slice(0, 8)}…`
                  : sourceType
                : '—';

              return (
                <div className="space-y-0">
                  {/* AI zone (raised + more room like MyWork) */}
                  <div className="py-1">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
                        <span className="text-[10px] font-medium uppercase tracking-wider">AI</span>
                      </div>
                      <RowActionsMenu iconVariant="vertical" actions={aiMenu} />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {aiHints.map((h) => (
                        <button
                          key={h.label}
                          type="button"
                          onClick={() => openChat(h.prompt)}
                          className={hintChipClass}
                        >
                          {h.label}
                        </button>
                      ))}
                    </div>
                    <div className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                      {isPolish
                        ? 'Użyj AI hintów w stopce, aby wygenerować brief.'
                        : 'Use AI hints in the footer to generate a brief.'}
                    </div>
                  </div>

                  <div className="border-t border-slate-200/50 dark:border-white/[0.06] my-3" />

                  {/* Relations (room for 2 rows) */}
                  <div className="min-h-[4.5rem] flex flex-wrap items-start content-start gap-2 py-1">
                    {relationsPill(
                      isPolish ? 'Źródło' : 'Source',
                      sourceLabel,
                      sourceId ? () => void openDocumentById(sourceId) : undefined
                    )}
                    {relationsPill(
                      isPolish ? 'Inicjatywy' : 'Initiatives',
                      isPolish ? 'Otwórz' : 'Open',
                      () =>
                        navigate(`${ROUTES.INITIATIVES}?open=${encodeURIComponent(item.id)}&mode=doc`)
                    )}
                    {initiativeTasks?.length ? (
                      relationsPill(isPolish ? 'Zadania' : 'Tasks', String(initiativeTasks.length))
                    ) : null}
                  </div>

                  <div className="border-t border-slate-200/50 dark:border-white/[0.06] my-3" />

                  {/* Actions — more buttons (initiative is “in motion”) */}
                  <div className="space-y-2.5 py-1">
                    <div className="flex gap-2 flex-wrap">
                      <button type="button" onClick={() => handleOpenDocument(item)} className={pillPrimary}>
                        <ExternalLink size={14} />
                        {isPolish ? 'Otwórz' : 'Open'}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          navigate(`${ROUTES.INITIATIVES}?open=${encodeURIComponent(item.id)}&mode=doc`)
                        }
                        className={pillNeutral}
                      >
                        <ChevronRight size={14} />
                        {isPolish ? 'W module' : 'In module'}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          openChat(
                            isPolish
                              ? 'Pomóż mi dopracować tę inicjatywę: brakujące pola, ryzyka, KPI i następne kroki.'
                              : 'Help me refine this initiative: missing fields, risks, KPIs, and next steps.'
                          )
                        }
                        className={pillNeutral}
                      >
                        <MessageSquare size={14} />
                        {isPolish ? 'Czat' : 'Chat'}
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => submitInitiativeForReviewById(item.id)}
                        disabled={status !== 'DRAFT'}
                        className={`${pillNeutral} ${status !== 'DRAFT' ? 'opacity-60 cursor-not-allowed' : ''}`}
                        title={
                          status !== 'DRAFT'
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
                        onClick={async () => {
                          try {
                            const url = `${window.location.origin}${ROUTES.INITIATIVES}?open=${encodeURIComponent(item.id)}&mode=doc`;
                            await navigator.clipboard.writeText(url);
                            toast.success(isPolish ? 'Skopiowano link' : 'Link copied');
                          } catch {
                            toast.error(isPolish ? 'Nie udało się skopiować' : 'Copy failed');
                          }
                        }}
                        className={pillNeutral}
                      >
                        {isPolish ? 'Link' : 'Link'}
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await fetchData(true);
                          await fetchInitiativeDetails(item.id);
                        }}
                        className={pillNeutral}
                      >
                        {isPolish ? 'Odśwież' : 'Refresh'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            }

            const canResume =
              activeTab === 'sessions' &&
              ['DRAFT', 'PENDING_REVIEW', 'REVIEW'].includes(String(item.status || '').toUpperCase());
            const showOpen = isOutputsTab;

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
                    toast.error(e?.message || (isPolish ? 'Nie udało się wysłać do review' : 'Request review failed'));
                  }
                }}
                onApprove={async () => {
                  try {
                    await Api.approveTool(item.id, {});
                    toast.success(isPolish ? 'Zatwierdzono' : 'Approved');
                    await fetchData(true);
                    await refreshFull();
                  } catch (e: any) {
                    toast.error(e?.message || (isPolish ? 'Nie udało się zatwierdzić' : 'Approve failed'));
                  }
                }}
                onSendBack={async () => {
                  const comment = prompt(isPolish ? 'Powód odesłania:' : 'Reason for sending back:');
                  if (!comment) return;
                  try {
                    await Api.sendToolBackToDraft(item.id, comment);
                    toast.success(isPolish ? 'Odesłano do draftu' : 'Sent back to draft');
                    await fetchData(true);
                    await refreshFull();
                  } catch (e: any) {
                    toast.error(e?.message || (isPolish ? 'Nie udało się odesłać' : 'Send back failed'));
                  }
                }}
                onOpenGenerateModal={() => setGenerateInitiativesForId(item.id)}
              />
            );
          }}
        >
          <FilterableTable
            columns={columns}
            data={currentData}
            onRowClick={(row) => setPreviewItemId(row.id)}
            onRowDoubleClick={handleOpenDocument}
            onRowAction={handleRowAction}
            getRowActions={
              isInitiativesTab
                ? (row) => {
                    const id = String(row?.id || '').trim();
                    return [
                      {
                        id: 'open',
                        label: isPolish ? 'Otwórz' : 'Open',
                        icon: ExternalLink,
                        variant: 'primary',
                        onClick: () => handleOpenDocument(row),
                      },
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
                          navigate(`${ROUTES.INITIATIVES}?open=${encodeURIComponent(id)}&mode=doc`),
                      },
                      {
                        id: 'chat',
                        label: isPolish ? 'Czat' : 'Chat',
                        icon: MessageSquare,
                        divider: true,
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
                    ] as RowAction[];
                  }
                : undefined
            }
            activeFilters={activeFilters}
            onFilterChange={setActiveFilters}
            emptyMessage={emptyMessage}
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

  // View tool (pill dropdown) — shown in Tools hub to match Golden Standard.
  const ViewToolDropdown = (
    <div ref={viewDropdownRef} className="relative">
      <button
        type="button"
        onClick={() => setIsViewDropdownOpen((v) => !v)}
        className="inline-flex items-center gap-2 h-9 px-4 rounded-full text-sm font-medium bg-white/70 dark:bg-white/[0.04] border border-slate-200/70 dark:border-white/[0.06] text-slate-700 dark:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-white/[0.06] transition-colors"
        aria-expanded={isViewDropdownOpen}
      >
        {viewMode === 'grid' ? <Grid3X3 size={16} /> : <List size={16} />}
        <span>{viewMode === 'grid' ? t('common.grid', 'Grid') : t('common.table', 'Table')}</span>
        <ChevronDown
          size={16}
          className={`text-slate-400 transition-transform duration-200 ${isViewDropdownOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isViewDropdownOpen && (
        <div className="absolute top-full right-0 mt-1 z-50 min-w-[180px] py-1 bg-white dark:bg-navy-800 border border-slate-200/70 dark:border-white/[0.08] rounded-xl shadow-xl shadow-black/30">
          {[
            { id: 'table' as const, label: t('common.table', 'Table'), icon: <List size={16} /> },
            { id: 'grid' as const, label: t('common.grid', 'Grid'), icon: <Grid3X3 size={16} /> },
          ].map((opt) => {
            const selected = viewMode === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setViewMode(opt.id);
                  setIsViewDropdownOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
                  selected
                    ? 'bg-primary-500/10 text-slate-900 dark:text-white'
                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.04]'
                }`}
              >
                <span className="text-slate-500 dark:text-slate-400">{opt.icon}</span>
                <span className="text-sm">{opt.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  const toolPickerCategories = useMemo(() => {
    const items: Array<{ id: ToolCategory | 'all'; label: string; count?: number; icon?: React.ReactNode }> = [
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
    const q = String(addMenuQuery || '').trim().toLowerCase();

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
      };
    });

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
          }))
        : [];

    const all = [...base, ...catalog].filter((x) => Boolean(x.toolType));

    return all
      .filter((x) => (addMenuCategory === 'all' ? true : x.category === addMenuCategory))
      .filter((x) => {
        if (!q) return true;
        return (
          x.name.toLowerCase().includes(q) ||
          x.shortCode.toLowerCase().includes(q) ||
          x.toolType.toLowerCase().includes(q) ||
          String(x.description || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [addMenuCategory, addMenuQuery, isPolish, strategyCatalogSlugs, titleFromSlug]);

  const PrimaryCta = (
    <div ref={addMenuRef} className="relative">
      <button
        type="button"
        onClick={() => setIsAddMenuOpen((v) => !v)}
        className="inline-flex items-center gap-2 h-9 px-4 rounded-full text-sm font-medium bg-hig-primary text-white hover:bg-hig-primary-hover transition-colors duration-150"
        aria-expanded={isAddMenuOpen}
      >
        <Plus size={16} />
        <span>{isPolish ? 'Dodaj' : t('common.add', 'Add')}</span>
        <ChevronDown
          size={16}
          className={`text-white/80 transition-transform duration-200 ${isAddMenuOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isAddMenuOpen ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsAddMenuOpen(false)} />
          <div className="absolute right-0 top-full mt-2 z-50 w-[520px] max-w-[calc(100vw-24px)] rounded-2xl border border-slate-200/70 dark:border-white/[0.08] bg-white dark:bg-navy-900 shadow-xl shadow-black/20 overflow-hidden">
            <div className="p-3 border-b border-slate-200/60 dark:border-white/[0.06]">
              <div className="relative">
                <input
                  value={addMenuQuery}
                  onChange={(e) => setAddMenuQuery(e.target.value)}
                  placeholder={isPolish ? 'Szukaj narzędzia…' : 'Search tools…'}
                  className="w-full h-9 rounded-full px-4 pr-10 text-sm bg-slate-50 dark:bg-navy-950/70 border border-slate-200/70 dark:border-white/[0.06] text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
                />
                {addMenuQuery ? (
                  <button
                    type="button"
                    onClick={() => setAddMenuQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
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
                          ? 'border-primary-500/40 bg-primary-500/10 text-slate-900 dark:text-white'
                          : 'border-slate-200/70 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.04] text-slate-700 dark:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-white/[0.06]'
                      }`}
                    >
                      {c.icon ? <span className="text-slate-500 dark:text-slate-400">{c.icon}</span> : null}
                      <span>{c.label}</span>
                      {c.count != null ? (
                        <span className="ml-1 px-1.5 py-0.5 rounded-full text-[11px] bg-slate-200 dark:bg-navy-700 text-slate-600 dark:text-slate-300">
                          {c.count}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="max-h-[60vh] overflow-auto p-2">
              {toolPickerItems.length === 0 ? (
                <div className="p-4 text-sm text-slate-500 dark:text-slate-400">
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
                        void createAndOpenToolSession({
                          toolType: item.toolType,
                          name: `${item.name} — ${isPolish ? 'Sesja' : 'Session'}`,
                          source: 'add_menu',
                        });
                      }}
                      className="w-full flex items-start gap-3 px-3 py-2 rounded-xl text-left hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors"
                    >
                      <span className="mt-0.5 font-mono text-xs font-bold text-slate-500 dark:text-slate-400 w-12 truncate">
                        {item.kind === 'catalog' ? 'DOCS' : item.shortCode}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                          {item.name}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {item.description}
                        </div>
                      </div>
                      <span className="mt-0.5 text-slate-400">
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
  const StatusFilterDropdown = (
    <div ref={statusDropdownRef} className="relative">
      <button
        onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
        className={`
          inline-flex items-center gap-2 h-9 px-4 rounded-full text-sm font-medium
          border transition-all duration-200
          ${
            isStatusDropdownOpen
              ? 'bg-primary-500/15 border-primary-500 text-primary-400'
              : 'bg-white/70 dark:bg-white/[0.04] border-slate-200/70 dark:border-white/[0.06] text-slate-700 dark:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-white/[0.06]'
          }
        `}
      >
        <Filter size={16} className="text-slate-400" />
        <span className={`w-2 h-2 rounded-full ${selectedStatusOption.bgColor}`} />
        <span>{getStatusOptionLabel(selectedStatusOption.id, selectedStatusOption.label)}</span>
        <ChevronDown
          size={16}
          className={`text-slate-400 transition-transform duration-200 ${isStatusDropdownOpen ? 'rotate-180' : ''}`}
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
                      ? 'bg-primary-500/15 text-slate-900 dark:text-white'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-700 hover:text-slate-900 dark:hover:text-white'
                  }
                `}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${option.bgColor}`} />
                <span className="flex-1 text-sm">{getStatusOptionLabel(option.id, option.label)}</span>
                {isSelected && (
                  <svg
                    className="w-4 h-4 text-primary-400"
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

  return (
    <>
      <ModuleHub
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onSearch={setSearchQuery}
        openDocuments={openDocuments}
        activeDocumentId={activeDocumentId}
        onSelectDocument={setActiveDocumentId}
        onCloseDocument={handleCloseDocument}
        onShowList={handleShowList}
        activeFilters={activeFilters}
        onRemoveFilter={handleRemoveFilter}
        onClearFilters={handleClearFilters}
        primaryCta={PrimaryCta}
        availableViewModes={['table']}
        rightControls={
          <div className="flex items-center gap-2">
            {ViewToolDropdown}
            {activeTab === 'library' ? null : StatusFilterDropdown}
          </div>
        }
      >
        {renderContent()}
      </ModuleHub>

      {generateInitiativesForId ? (
        <GenerateInitiativesModal
          isPolish={isPolish}
          defaults={generationDefaults}
          onClose={() => setGenerateInitiativesForId(null)}
          onGenerate={async (payload) => {
            const toolId = generateInitiativesForId;
            try {
              setGenerationDefaults(payload);
              await Api.generateToolInitiatives(toolId, payload);
              toast.success(isPolish ? 'Wygenerowano inicjatywy' : 'Initiatives generated');
              setGenerateInitiativesForId(null);
              await fetchData(true);
              // Refresh preview details if preview is open for this session
              if (previewItemId === toolId) {
                const refreshed = await Api.getToolSession(toolId);
                setPreviewFullSession(refreshed || null);
              }
            } catch (e: any) {
              toast.error(
                e?.message || (isPolish ? 'Nie udało się wygenerować inicjatyw' : 'Generation failed')
              );
            }
          }}
        />
      ) : null}
    </>
  );
};

export default DiscoveryToolsHub;
