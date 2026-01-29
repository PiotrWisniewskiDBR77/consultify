/**
 * DiscoveryToolsHub
 * Discovery Tools module with 3 tabs (Discovery, Reports, Initiatives)
 * and 4 category buttons (Strategy, Operations, Digital, Process Automation)
 *
 * Connected to real API - fetches tool sessions from backend
 * Initiatives tab shows DRAFT initiatives with tasks
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
  FileText,
  Filter,
  Flag,
  Lightbulb,
  ListTodo,
  Loader2,
  Plus,
  Settings,
  Target,
  TrendingUp,
  User,
  Users,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '@/routes/routeConfig';
import { Api } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';
import { ToolType as StoreToolType } from '@/store/useToolStore';

import { ToolDocumentView, ToolWorkspace } from '../DiscoveryTools';
import { GenericToolDocumentView } from '../DiscoveryTools/GenericToolDocumentView';
import { InitiativeDocumentView } from '../Initiatives/InitiativeDocumentView';
import {
  CategoryButton,
  FilterableTable,
  FilterChip,
  GridItem,
  GridView,
  ModuleHub,
  ModuleTab,
  OpenDocument,
  TableColumn,
  ViewMode,
} from '../shared/ModuleHub';

// Tool category types
type ToolCategory = 'strategic' | 'operational' | 'digital' | 'automation';
type ItemStatus = 'draft' | 'in_review' | 'approved' | 'completed';

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
  updatedAt: Date;
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

export const DiscoveryToolsHub: React.FC<DiscoveryToolsHubProps> = ({ initialTab = 'list' }) => {
  const navigate = useNavigate();
  const { currentProjectId } = useAppStore();

  // UI State
  const [activeTab, setActiveTab] = useState<ModuleTab>(initialTab);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<FilterChip[]>([]);
  const [openDocuments, setOpenDocuments] = useState<OpenDocument[]>([]);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<ToolCategory | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const statusDropdownRef = React.useRef<HTMLDivElement>(null);

  // Data State
  const [discoveries, setDiscoveries] = useState<DisplayItem[]>([]);
  const [reports, setReports] = useState<DisplayItem[]>([]);
  const [initiatives, setInitiatives] = useState<DisplayItem[]>([]);
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
      DRAFT: 'draft',
      REVIEW: 'in_review',
      APPROVED: 'approved',
      COMPLETED: 'completed',
    };
    return {
      id: session.id,
      name: session.name,
      toolType: mapping.short,
      category: mapping.category,
      status: statusMap[session.status?.toUpperCase()] || 'draft',
      progress: session.progress || 0,
      updatedAt: session.updatedAt ? new Date(session.updatedAt) : new Date(),
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
          (s) => s.status === 'draft' || s.status === 'in_review'
        );
        setDiscoveries(discoveryItems);

        // Reports: APPROVED, COMPLETED (finished analyses)
        const reportItems = allSessions.filter(
          (s) => s.status === 'approved' || s.status === 'completed'
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
            status: 'draft' as ItemStatus,
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

  // Reset status filter when tab changes
  useEffect(() => {
    setStatusFilter('all');
  }, [activeTab]);

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
      case 'list':
        return DISCOVERY_STATUSES;
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
        id: 'list' as ModuleTab,
        label: 'Discovery',
        icon: <Target size={16} />,
        count: discoveries.length,
      },
      {
        id: 'reports' as ModuleTab,
        label: 'Reports',
        icon: <FileText size={16} />,
        count: reports.length,
      },
      {
        id: 'initiatives' as ModuleTab,
        label: 'Initiatives',
        icon: <Lightbulb size={16} />,
        count: initiatives.length,
      },
    ],
    [discoveries.length, reports.length, initiatives.length]
  );

  // Category buttons
  const categoryButtons: CategoryButton[] = useMemo(() => {
    return Object.entries(CATEGORY_META).map(([key, meta]) => ({
      id: key,
      label: meta.name,
      icon: meta.icon,
      count: meta.count,
      onClick: () => {
        console.log('Open category:', key);
        setSelectedCategory(key as ToolCategory);
      },
    }));
  }, []);

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
              <span className="font-mono text-xs font-bold text-slate-300">
                {meta?.shortName || row.toolType}
              </span>
            </div>
          );
        },
      },
      {
        id: 'name',
        label: 'Name',
        render: (row) => <span className="text-sm text-white font-medium">{row.name}</span>,
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

  // Columns for Initiatives tab
  const initiativeColumns: TableColumn[] = useMemo(
    () => [
      {
        id: 'name',
        label: 'Initiative',
        render: (row) => (
          <div>
            <span className="text-sm text-white font-medium">{row.name}</span>
            {row._fullData?.description && (
              <p className="text-xs text-slate-500 truncate max-w-xs">
                {row._fullData.description}
              </p>
            )}
          </div>
        ),
      },
      {
        id: 'category',
        label: 'Axis',
        width: '120px',
        filterable: true,
        filterOptions: [
          { value: 'strategic', label: 'Strategic' },
          { value: 'operational', label: 'Operational' },
          { value: 'digital', label: 'Digital' },
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
        label: 'Priority',
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
              className={`px-2 py-0.5 text-xs font-medium rounded ${priorityColors[priority] || priorityColors.MEDIUM}`}
            >
              {priority}
            </span>
          );
        },
      },
      {
        id: 'status',
        label: 'Status',
        width: '100px',
        render: () => (
          <span className="px-2 py-0.5 text-xs font-medium rounded bg-slate-500/20 text-slate-400">
            DRAFT
          </span>
        ),
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
        label: 'Tasks',
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
        label: 'Updated',
        width: '120px',
        sortable: true,
      },
    ],
    []
  );

  // Fetch initiative details with tasks
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

  const handleRemoveFilter = useCallback((id: string) => {
    setActiveFilters((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const handleClearFilters = useCallback(() => {
    setActiveFilters([]);
  }, []);

  const handleRowAction = useCallback(
    (action: string, row: any) => {
      console.log('Row action:', action, row);
      if (action === 'view' || action === 'edit') {
        handleOpenDocument(row);
      }
    },
    [handleOpenDocument]
  );

  // Get current data based on tab
  const currentData = useMemo(() => {
    let data: DisplayItem[] = [];
    switch (activeTab) {
      case 'list':
        data = discoveries;
        break;
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

  // Convert to grid items
  const gridItems: GridItem[] = useMemo(() => {
    return currentData.map((item) => {
      const meta = TOOL_META[item.toolType as ToolType];
      const categoryMeta = CATEGORY_META[meta?.category || 'strategic'];
      return {
        ...item,
        type: item.toolType,
        typeColor: categoryMeta?.color || 'slate',
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
          <div className="flex flex-col items-center gap-3 text-slate-400">
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
            <p className="text-lg text-white">Initiative not found</p>
            <button
              onClick={handleShowList}
              className="mt-4 px-4 py-2 bg-navy-700 hover:bg-navy-600 text-white rounded-lg text-sm transition-colors"
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
      <div className="h-full flex flex-col overflow-hidden bg-navy-950">
        {/* Header */}
        <div className="shrink-0 border-b border-navy-700 bg-navy-900 px-6 py-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <button
                  onClick={handleShowList}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-navy-700 rounded-lg transition-colors"
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
              <h1 className="text-xl font-bold text-white">{selectedInitiative.name}</h1>
              {selectedInitiative.description && (
                <p className="text-sm text-slate-400 mt-1 line-clamp-2">
                  {selectedInitiative.description}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate(`/initiatives/${selectedInitiative.id}`)}
                className="px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-navy-700 rounded-lg transition-colors"
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
                <div className="bg-navy-900 rounded-xl border border-navy-700 p-5">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase mb-3 flex items-center gap-2">
                    <FileText size={14} />
                    Summary
                  </h3>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    {selectedInitiative.summary}
                  </p>
                </div>
              )}

              {/* Tasks Section */}
              <div className="bg-navy-900 rounded-xl border border-navy-700 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase flex items-center gap-2">
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
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                      <span>Completion</span>
                      <span>{completionPercent}%</span>
                    </div>
                    <div className="h-2 bg-navy-700 rounded-full overflow-hidden">
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
                        className="flex items-center gap-3 p-3 bg-navy-800 rounded-lg border border-navy-700 hover:border-purple-500/30 transition-colors"
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
                            <span className="text-sm text-white font-medium truncate">
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
                <div className="bg-navy-900/50 rounded-xl border border-navy-700 p-4">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Zap size={12} className="text-amber-400" />
                    <span>
                      Generated from:{' '}
                      <span className="text-white capitalize">{selectedInitiative.sourceType}</span>
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
              <div className="bg-navy-900 rounded-xl border border-navy-700 p-5">
                <h3 className="text-xs font-semibold text-slate-400 uppercase mb-4">Key Metrics</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-400 flex items-center gap-2">
                      <DollarSign size={14} />
                      CAPEX
                    </span>
                    <span className="text-sm font-semibold text-white">
                      {formatCurrency(selectedInitiative.costCapex)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-400 flex items-center gap-2">
                      <DollarSign size={14} />
                      OPEX
                    </span>
                    <span className="text-sm font-semibold text-white">
                      {formatCurrency(selectedInitiative.costOpex)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-400 flex items-center gap-2">
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
              <div className="bg-navy-900 rounded-xl border border-navy-700 p-5">
                <h3 className="text-xs font-semibold text-slate-400 uppercase mb-4 flex items-center gap-2">
                  <Calendar size={14} />
                  Timeline
                </h3>
                <div className="space-y-3">
                  <div>
                    <span className="text-xs text-slate-500">Start Date</span>
                    <div className="text-sm text-white">
                      {formatDate(selectedInitiative.plannedStartDate)}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">End Date</span>
                    <div className="text-sm text-white">
                      {formatDate(selectedInitiative.plannedEndDate)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Ownership */}
              <div className="bg-navy-900 rounded-xl border border-navy-700 p-5">
                <h3 className="text-xs font-semibold text-slate-400 uppercase mb-4 flex items-center gap-2">
                  <Users size={14} />
                  Ownership
                </h3>
                <div className="space-y-3">
                  <div>
                    <span className="text-xs text-slate-500">Business Owner</span>
                    <div className="text-sm text-white">
                      {selectedInitiative.ownerBusiness ? (
                        `${selectedInitiative.ownerBusiness.firstName} ${selectedInitiative.ownerBusiness.lastName}`
                      ) : (
                        <span className="text-slate-500">Not assigned</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">Execution Owner</span>
                    <div className="text-sm text-white">
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
                <ul className="space-y-2 text-sm text-slate-300">
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
          <div className="flex flex-col items-center gap-3 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin" />
            <span>Loading tool sessions...</span>
          </div>
        </div>
      );
    }

    // Show ToolWorkspace when a document is active
    if (activeDocumentId) {
      const doc = openDocuments.find((d) => d.id === activeDocumentId);

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
          'portfolio-priority',
          'risk-uncertainty',
          'sop-builder',
          'a3-problem-solving',
          'smed-planner',
          'dms-builder',
          'inventory-autopilot',
        ];

        const toolType = doc.subType as StoreToolType;

        if (supportedTools.includes(toolType)) {
          // Use new ToolDocumentView - canonical two-column layout
          return (
            <ToolDocumentView
              toolType={toolType}
              sessionId={doc.id}
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
          sessionId={doc?.id}
          title={doc?.name}
          toolTypeLabel={toolMeta?.name || doc?.subType}
          statusLabel={doc?.status}
          onBack={handleShowList}
        />
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
    const columns = isInitiativesTab ? initiativeColumns : discoveryColumns;
    const emptyMessage = isInitiativesTab
      ? 'No draft initiatives yet. Run a tool or assessment to generate initiatives.'
      : 'No discoveries yet. Select a tool category to start.';

    return (
      <FilterableTable
        columns={columns}
        data={currentData}
        onRowClick={handleOpenDocument}
        onRowAction={handleRowAction}
        activeFilters={activeFilters}
        onFilterChange={setActiveFilters}
        emptyMessage={emptyMessage}
      />
    );
  };

  // Status Filter Dropdown Component
  const StatusFilterDropdown = (
    <div ref={statusDropdownRef} className="relative">
      <button
        onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
        className={`
          flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium
          border transition-all duration-200
          ${
            isStatusDropdownOpen
              ? 'bg-primary-500/15 border-primary-500 text-primary-400'
              : 'bg-navy-800 border-navy-600 text-slate-300 hover:bg-navy-700 hover:border-slate-500 hover:text-white'
          }
        `}
      >
        <Filter size={16} className="text-slate-400" />
        <span className={`w-2 h-2 rounded-full ${selectedStatusOption.bgColor}`} />
        <span>{selectedStatusOption.label}</span>
        <ChevronDown
          size={16}
          className={`text-slate-400 transition-transform duration-200 ${isStatusDropdownOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isStatusDropdownOpen && (
        <div className="absolute top-full right-0 mt-1 z-50 min-w-[180px] py-1 bg-navy-800 border border-navy-600 rounded-lg shadow-xl shadow-black/30">
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
                      ? 'bg-primary-500/15 text-white'
                      : 'text-slate-300 hover:bg-navy-700 hover:text-white'
                  }
                `}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${option.bgColor}`} />
                <span className="flex-1 text-sm">{option.label}</span>
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
        categoryButtons={categoryButtons}
        rightControls={StatusFilterDropdown}
      >
        {renderContent()}
      </ModuleHub>

      {/* Tool Selection Modal */}
      {selectedCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-navy-900 border border-navy-700 rounded-xl p-6 w-full max-w-lg max-h-[80vh] overflow-auto">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              {CATEGORY_META[selectedCategory].icon}
              <span>{CATEGORY_META[selectedCategory].name} Tools</span>
              <span className="text-slate-500 text-sm font-normal">
                ({CATEGORY_META[selectedCategory].count})
              </span>
            </h2>
            <div className="space-y-2">
              {Object.entries(TOOL_META)
                .filter(([_, meta]) => meta.category === selectedCategory)
                .map(([key, meta]) => (
                  <button
                    key={key}
                    onClick={() => {
                      console.log(
                        '[DiscoveryToolsHub] Start tool:',
                        key,
                        'category:',
                        selectedCategory
                      );
                      setSelectedCategory(null);
                      // Navigate to strategic tools view with tool parameter
                      if (selectedCategory === 'strategic') {
                        // Map short codes to tool IDs
                        const toolIdMap: Record<string, string> = {
                          SWT: 'dynamic-swot',
                          PTR: 'market-forces',
                          ANS: 'growth-paths',
                          VCH: 'value-chain',
                          BCG: 'portfolio-priority',
                          AMB: 'ambition-decomposer',
                          FOC: 'focus-tradeoff',
                          RSK: 'risk-uncertainty',
                          CAP: 'capability-mapper',
                          NAR: 'narrative-engine',
                        };
                        const toolId = toolIdMap[key] || key.toLowerCase();
                        navigate(`${ROUTES.DISCOVERY_TOOLS.STRATEGIC}?tool=${toolId}`);
                      }
                    }}
                    className={`
                      flex items-center gap-3 w-full p-3 rounded-lg
                      bg-navy-800 border border-navy-600
                      hover:border-${CATEGORY_META[selectedCategory].color}-500/50 hover:bg-navy-700
                      transition-all text-left
                    `}
                  >
                    <span className="font-mono text-xs font-bold text-slate-400 w-8">
                      {meta.shortName}
                    </span>
                    <div className="flex-1">
                      <div className="text-white font-medium">{meta.name}</div>
                      <div className="text-xs text-slate-400">{meta.description}</div>
                    </div>
                  </button>
                ))}
            </div>
            <button
              onClick={() => setSelectedCategory(null)}
              className="mt-4 w-full py-2 text-sm text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default DiscoveryToolsHub;
