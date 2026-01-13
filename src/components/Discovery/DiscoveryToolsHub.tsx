/**
 * DiscoveryToolsHub
 * Discovery Tools module with 3 tabs (Discovery, Reports, Initiatives)
 * and 4 category buttons (Strategy, Operations, Digital, Process Automation)
 */

import {
  Bot,
  Cpu,
  FileText,
  Lightbulb,
  Settings,
  Target,
  Workflow,
  Zap,
} from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';

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

// Tool type codes
type ToolType =
  // Strategic (1-10)
  | 'SWT' | 'PTR' | 'ANS' | 'VCH' | 'BCG' | 'AMB' | 'FOC' | 'RSK' | 'CAP' | 'NAR'
  // Operational (11-20)
  | 'VSM' | 'SOP' | 'A3P' | 'SMD' | 'DMS' | 'AUT' | 'CON' | 'DEC' | 'CTW' | 'INV'
  // Digital (21-30)
  | 'ROB' | 'LOG' | 'RPA' | 'AID' | 'INT' | 'DVP' | 'LEG' | 'DAT' | 'P2S' | 'SPE'
  // Automation (31)
  | 'PAI';

// Category metadata
const CATEGORY_META: Record<ToolCategory, {
  name: string;
  icon: React.ReactNode;
  color: string;
  count: number;
}> = {
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
const TOOL_META: Record<ToolType, {
  name: string;
  shortName: string;
  category: ToolCategory;
  description: string;
}> = {
  // Strategic Tools
  SWT: { name: 'Dynamic SWOT', shortName: 'SWT', category: 'strategic', description: 'AI-driven SWOT analysis' },
  PTR: { name: 'Market Forces (Porter)', shortName: 'PTR', category: 'strategic', description: '5 forces competitive analysis' },
  ANS: { name: 'Growth Paths (Ansoff)', shortName: 'ANS', category: 'strategic', description: 'Market/product expansion' },
  VCH: { name: 'Value Chain', shortName: 'VCH', category: 'strategic', description: 'Value leakage finder' },
  BCG: { name: 'Portfolio Priority', shortName: 'BCG', category: 'strategic', description: 'Strategic prioritization' },
  AMB: { name: 'Ambition Decomposer', shortName: 'AMB', category: 'strategic', description: 'Vision breakdown' },
  FOC: { name: 'Focus & Trade-off', shortName: 'FOC', category: 'strategic', description: 'What NOT to do' },
  RSK: { name: 'Risk & Uncertainty', shortName: 'RSK', category: 'strategic', description: 'Scenario mapping' },
  CAP: { name: 'Capability Mapper', shortName: 'CAP', category: 'strategic', description: 'Skills-to-outcomes' },
  NAR: { name: 'Narrative Engine', shortName: 'NAR', category: 'strategic', description: 'Strategy communication' },
  // Operational Tools
  VSM: { name: 'VSM Builder', shortName: 'VSM', category: 'operational', description: 'Value stream mapping' },
  SOP: { name: 'SOP Builder', shortName: 'SOP', category: 'operational', description: 'Standard work creation' },
  A3P: { name: 'A3 Problem Solving', shortName: 'A3P', category: 'operational', description: 'Root cause analysis' },
  SMD: { name: 'SMED Planner', shortName: 'SMD', category: 'operational', description: 'Changeover reduction' },
  DMS: { name: 'DMS Builder', shortName: 'DMS', category: 'operational', description: 'Daily management system' },
  AUT: { name: 'Automation Pipeline', shortName: 'AUT', category: 'operational', description: 'Automation backlog' },
  CON: { name: 'Constraint Control', shortName: 'CON', category: 'operational', description: 'Bottleneck management' },
  DEC: { name: 'Decision Engine', shortName: 'DEC', category: 'operational', description: 'Policy automation' },
  CTW: { name: 'Control Tower', shortName: 'CTW', category: 'operational', description: 'Shopfloor visibility' },
  INV: { name: 'Inventory Autopilot', shortName: 'INV', category: 'operational', description: 'Stock optimization' },
  // Digital Tools
  ROB: { name: 'Robotics Feasibility', shortName: 'ROB', category: 'digital', description: 'Robot deployment analysis' },
  LOG: { name: 'Logistics Automation', shortName: 'LOG', category: 'digital', description: 'Warehouse automation' },
  RPA: { name: 'RPA Scanner', shortName: 'RPA', category: 'digital', description: 'Process automation potential' },
  AID: { name: 'AI Discovery', shortName: 'AID', category: 'digital', description: 'AI use-case readiness' },
  INT: { name: 'Integration Diagnostic', shortName: 'INT', category: 'digital', description: 'System integration analysis' },
  DVP: { name: 'Digital Value Pool', shortName: 'DVP', category: 'digital', description: 'Value identification' },
  LEG: { name: 'Legacy Analyzer', shortName: 'LEG', category: 'digital', description: 'Technical debt assessment' },
  DAT: { name: 'Data Inventory', shortName: 'DAT', category: 'digital', description: 'Data asset mapping' },
  P2S: { name: 'Pain-to-Solution', shortName: 'P2S', category: 'digital', description: 'Solution matching' },
  SPE: { name: 'Pain Explorer', shortName: 'SPE', category: 'digital', description: 'Problem structuring' },
  // Automation Tool
  PAI: { name: 'Process Automation', shortName: 'PAI', category: 'automation', description: 'Interactive process workshop' },
};

// Mock data for discoveries
const MOCK_DISCOVERIES = [
  {
    id: 'd1',
    name: 'Sales Process SWOT Analysis',
    toolType: 'SWT' as ToolType,
    category: 'strategic' as ToolCategory,
    status: 'completed' as ItemStatus,
    progress: 100,
    updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
  },
  {
    id: 'd2',
    name: 'Manufacturing Value Stream Map',
    toolType: 'VSM' as ToolType,
    category: 'operational' as ToolCategory,
    status: 'in_review' as ItemStatus,
    progress: 85,
    updatedAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
  },
  {
    id: 'd3',
    name: 'RPA Opportunity Scan - Finance',
    toolType: 'RPA' as ToolType,
    category: 'digital' as ToolCategory,
    status: 'draft' as ItemStatus,
    progress: 40,
    updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
  },
  {
    id: 'd4',
    name: 'Order-to-Cash Process Automation',
    toolType: 'PAI' as ToolType,
    category: 'automation' as ToolCategory,
    status: 'in_review' as ItemStatus,
    progress: 70,
    updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
  },
];

// Mock data for reports
const MOCK_REPORTS = [
  {
    id: 'r1',
    name: 'SWOT Analysis - Sales Department',
    toolType: 'SWT' as ToolType,
    category: 'strategic' as ToolCategory,
    status: 'completed' as ItemStatus,
    progress: 100,
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
  },
];

// Mock data for initiatives
const MOCK_INITIATIVES = [
  {
    id: 'i1',
    name: 'Implement CRM System',
    toolType: 'SWT' as ToolType,
    category: 'strategic' as ToolCategory,
    status: 'approved' as ItemStatus,
    progress: 100,
    updatedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
  },
  {
    id: 'i2',
    name: 'Automate Invoice Processing',
    toolType: 'RPA' as ToolType,
    category: 'digital' as ToolCategory,
    status: 'draft' as ItemStatus,
    progress: 100,
    updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
  },
];

interface DiscoveryToolsHubProps {
  initialTab?: ModuleTab;
}

export const DiscoveryToolsHub: React.FC<DiscoveryToolsHubProps> = ({
  initialTab = 'list',
}) => {
  // State
  const [activeTab, setActiveTab] = useState<ModuleTab>(initialTab);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<FilterChip[]>([]);
  const [openDocuments, setOpenDocuments] = useState<OpenDocument[]>([]);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<ToolCategory | null>(null);

  // Tab configuration
  const tabs = useMemo(() => [
    {
      id: 'list' as ModuleTab,
      label: 'Discovery',
      icon: <Target size={16} />,
      count: MOCK_DISCOVERIES.length,
    },
    {
      id: 'reports' as ModuleTab,
      label: 'Reports',
      icon: <FileText size={16} />,
      count: MOCK_REPORTS.length,
    },
    {
      id: 'initiatives' as ModuleTab,
      label: 'Initiatives',
      icon: <Lightbulb size={16} />,
      count: MOCK_INITIATIVES.length,
    },
  ], []);

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
  const discoveryColumns: TableColumn[] = useMemo(() => [
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
            <span className={`text-${categoryMeta.color}-400`}>
              {categoryMeta.icon}
            </span>
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
      render: (row) => (
        <span className="text-sm text-white font-medium">{row.name}</span>
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
  ], []);

  // Handlers
  const handleOpenDocument = useCallback((row: any) => {
    const meta = TOOL_META[row.toolType as ToolType];
    const doc: OpenDocument = {
      id: row.id,
      type: 'tool',
      subType: row.toolType,
      name: row.name,
      status: row.status,
    };

    setOpenDocuments((prev) => {
      if (prev.find((d) => d.id === doc.id)) return prev;
      return [...prev, doc];
    });
    setActiveDocumentId(row.id);
  }, []);

  const handleCloseDocument = useCallback((id: string) => {
    setOpenDocuments((prev) => prev.filter((d) => d.id !== id));
    if (activeDocumentId === id) {
      setActiveDocumentId(null);
    }
  }, [activeDocumentId]);

  const handleShowList = useCallback(() => {
    setActiveDocumentId(null);
  }, []);

  const handleRemoveFilter = useCallback((id: string) => {
    setActiveFilters((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const handleClearFilters = useCallback(() => {
    setActiveFilters([]);
  }, []);

  const handleRowAction = useCallback((action: string, row: any) => {
    console.log('Row action:', action, row);
    if (action === 'view' || action === 'edit') {
      handleOpenDocument(row);
    }
  }, [handleOpenDocument]);

  // Get current data based on tab
  const currentData = useMemo(() => {
    switch (activeTab) {
      case 'list':
        return MOCK_DISCOVERIES;
      case 'reports':
        return MOCK_REPORTS;
      case 'initiatives':
        return MOCK_INITIATIVES;
      default:
        return [];
    }
  }, [activeTab]);

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

  // Render content
  const renderContent = () => {
    if (activeDocumentId) {
      const doc = openDocuments.find((d) => d.id === activeDocumentId);
      const toolMeta = TOOL_META[doc?.subType as ToolType];
      return (
        <div className="flex items-center justify-center h-full text-slate-500">
          <div className="text-center">
            <p className="text-lg">Working on: {doc?.name}</p>
            <p className="text-sm">({toolMeta?.name || doc?.subType} - {doc?.status})</p>
            <p className="mt-4 text-xs">Tool workspace placeholder - będzie tu AI chat + wizualizacja</p>
          </div>
        </div>
      );
    }

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

    return (
      <FilterableTable
        columns={discoveryColumns}
        data={currentData}
        onRowClick={handleOpenDocument}
        onRowAction={handleRowAction}
        activeFilters={activeFilters}
        onFilterChange={setActiveFilters}
        emptyMessage="No discoveries yet. Select a tool category to start."
      />
    );
  };

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
                      console.log('Start tool:', key);
                      setSelectedCategory(null);
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
