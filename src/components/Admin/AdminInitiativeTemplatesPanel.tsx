/**
 * AdminInitiativeTemplatesPanel
 *
 * Full CRUD management for Initiative Templates (process blueprints).
 * UI/UX matches the Report Templates (TemplatesManager) pattern exactly.
 *
 * 4 levels: Quick Win → Standard → Enterprise → Full Charter
 * Each template defines: visible sections, required fields, workflow, tasks,
 * decisions, milestones, notifications, roles, KPIs.
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  Building2,
  Calendar,
  CheckSquare,
  ChevronDown,
  Copy,
  Edit3,
  Eye,
  FileText,
  Lightbulb,
  Loader2,
  Minus,
  Package,
  Plus,
  Search,
  Sparkles,
  Square,
  Target,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

import {
  type ColumnDef,
  ColumnResizer,
  type ColumnWidths,
  FilterDropdown,
  type TableFilters,
} from '@/components/ui/ResizableTable';

import { Api } from '../../services/api';
import { InitiativeTemplateEditor } from './InitiativeTemplateEditor';

// ==========================================
// TYPES
// ==========================================

type TemplateLevel = 'quick_win' | 'standard' | 'enterprise' | 'full_charter';

interface InitiativeTemplate {
  id: string;
  name: string;
  description?: string;
  category: string;
  level: TemplateLevel;
  isSystem: boolean;
  isPublic: boolean;
  sourceTypes: string[];
  visibleSections: Record<string, boolean>;
  requiredFields: string[];
  workflowConfig: Record<string, any>;
  notificationConfig: Record<string, boolean>;
  suggestedTasks: any[];
  suggestedDecisions: any[];
  suggestedMilestones: any[];
  suggestedRoles: any[];
  suggestedKpis: any[];
  sectionsCount: number;
  createdBy?: string;
  createdByName?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ==========================================
// CONSTANTS
// ==========================================

const LEVEL_CONFIG: Record<
  TemplateLevel,
  { label: string; color: string; bg: string; icon: React.ElementType; description: string }
> = {
  quick_win: {
    label: 'Quick Win',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/20',
    icon: Zap,
    description: 'Minimal initiative for fast action items',
  },
  standard: {
    label: 'Standard',
    color: 'text-blue-400',
    bg: 'bg-blue-500/20',
    icon: FileText,
    description: 'Standard operational/transformational project',
  },
  enterprise: {
    label: 'Enterprise',
    color: 'text-primary-400',
    bg: 'bg-primary-500/20',
    icon: Target,
    description: 'Full governance with gates and RACI',
  },
  full_charter: {
    label: 'Full Charter',
    color: 'text-amber-400',
    bg: 'bg-amber-500/20',
    icon: Sparkles,
    description: 'Complete investment case with KPIs',
  },
};

const LEVEL_FILTER_OPTIONS = [
  { value: 'quick_win', label: 'Quick Win' },
  { value: 'standard', label: 'Standard' },
  { value: 'enterprise', label: 'Enterprise' },
  { value: 'full_charter', label: 'Full Charter' },
];

const TYPE_FILTER_OPTIONS = [
  { value: 'system', label: 'App (System)' },
  { value: 'org', label: 'Organization' },
];

const SOURCE_FILTER_OPTIONS = [
  { value: 'assessment', label: 'Assessment' },
  { value: 'tool', label: 'Tool' },
  { value: 'manual', label: 'Manual' },
  { value: 'ai', label: 'AI' },
];

const TEMPLATE_COLUMNS: ColumnDef[] = [
  {
    id: 'select',
    label: '',
    width: 40,
    minWidth: 40,
    maxWidth: 40,
    resizable: false,
    filterable: false,
  },
  {
    id: 'type',
    label: 'Type',
    width: 90,
    minWidth: 80,
    maxWidth: 120,
    resizable: true,
    filterable: true,
    filterType: 'multiselect',
    filterOptions: TYPE_FILTER_OPTIONS,
  },
  {
    id: 'indicator',
    label: '',
    width: 32,
    minWidth: 32,
    maxWidth: 32,
    resizable: false,
    filterable: false,
  },
  {
    id: 'name',
    label: 'Template',
    width: 240,
    minWidth: 180,
    resizable: false,
    filterable: false,
  },
  {
    id: 'level',
    label: 'Level',
    width: 130,
    minWidth: 100,
    maxWidth: 160,
    resizable: true,
    filterable: true,
    filterType: 'multiselect',
    filterOptions: LEVEL_FILTER_OPTIONS,
  },
  {
    id: 'source',
    label: 'Sources',
    width: 130,
    minWidth: 100,
    maxWidth: 180,
    resizable: true,
    filterable: true,
    filterType: 'multiselect',
    filterOptions: SOURCE_FILTER_OPTIONS,
  },
  {
    id: 'sections',
    label: 'Sections',
    width: 80,
    minWidth: 60,
    maxWidth: 100,
    resizable: true,
    filterable: false,
  },
  {
    id: 'tasks',
    label: 'Tasks',
    width: 70,
    minWidth: 50,
    maxWidth: 90,
    resizable: true,
    filterable: false,
  },
  {
    id: 'gates',
    label: 'Gates',
    width: 70,
    minWidth: 50,
    maxWidth: 90,
    resizable: true,
    filterable: false,
  },
  {
    id: 'updatedAt',
    label: 'Updated',
    width: 100,
    minWidth: 80,
    maxWidth: 130,
    resizable: true,
    filterable: false,
  },
  {
    id: 'actions',
    label: '',
    width: 100,
    minWidth: 80,
    maxWidth: 120,
    resizable: false,
    filterable: false,
    align: 'right',
  },
];

const getDefaultColumnWidths = (): ColumnWidths =>
  TEMPLATE_COLUMNS.reduce((acc, col) => ({ ...acc, [col.id]: col.width }), {});

const rowVariants = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, x: -10 },
  hover: {
    y: -2,
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    transition: { duration: 0.2 },
  },
};

// ==========================================
// HELPERS
// ==========================================

const getTypeBadgeConfig = (isSystem: boolean) => {
  if (isSystem) {
    return {
      color: 'text-blue-400',
      bg: 'bg-blue-500/20',
      label: 'APP',
      icon: Package,
      dot: 'bg-blue-500',
    };
  }
  return {
    color: 'text-primary-400',
    bg: 'bg-primary-500/20',
    label: 'ORG',
    icon: Building2,
    dot: 'bg-c-accent',
  };
};

const getSourceBadgeConfig = (source: string) => {
  switch (source?.toLowerCase()) {
    case 'assessment':
      return { color: 'text-blue-400', bg: 'bg-blue-500/15' };
    case 'tool':
      return { color: 'text-amber-400', bg: 'bg-amber-500/15' };
    case 'manual':
      return { color: 'text-slate-400', bg: 'bg-slate-500/15' };
    case 'ai':
      return { color: 'text-emerald-400', bg: 'bg-emerald-500/15' };
    default:
      return { color: 'text-slate-400', bg: 'bg-slate-500/15' };
  }
};

const formatDate = (dateStr?: string): string => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dateOnly = new Date(date);
  dateOnly.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((dateOnly.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays > -7 && diffDays < 0) return `${Math.abs(diffDays)}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const safeParseJson = (val: any, fallback: any = []) => {
  if (Array.isArray(val) || (typeof val === 'object' && val !== null)) return val;
  if (typeof val === 'string' && val.trim()) {
    try {
      return JSON.parse(val);
    } catch {
      return fallback;
    }
  }
  return fallback;
};

const parseTemplate = (raw: any): InitiativeTemplate => {
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description,
    category: raw.category,
    level: raw.level || 'standard',
    isSystem: Boolean(raw.is_system ?? raw.isSystem),
    isPublic: Boolean(raw.is_public ?? raw.isPublic),
    sourceTypes: safeParseJson(raw.sourceTypes || raw.source_types, [
      'assessment',
      'tool',
      'manual',
    ]),
    visibleSections: safeParseJson(raw.visibleSections || raw.visible_sections, {}),
    requiredFields: safeParseJson(raw.requiredFields || raw.required_fields, []),
    workflowConfig: safeParseJson(raw.workflowConfig || raw.workflow_config, {}),
    notificationConfig: safeParseJson(raw.notificationConfig || raw.notification_config, {}),
    suggestedTasks: safeParseJson(raw.suggestedTasks || raw.suggested_tasks, []),
    suggestedDecisions: safeParseJson(raw.suggestedDecisions || raw.suggested_decisions, []),
    suggestedMilestones: safeParseJson(raw.suggestedMilestones || raw.suggested_milestones, []),
    suggestedRoles: safeParseJson(raw.suggestedRoles || raw.suggested_roles, []),
    suggestedKpis: safeParseJson(raw.suggestedKpis || raw.suggested_kpis, []),
    sectionsCount: raw.sections_count ?? raw.sectionsCount ?? 0,
    createdBy: raw.created_by ?? raw.createdBy,
    createdByName: raw.created_by_name ?? raw.createdByName,
    createdAt: raw.created_at ?? raw.createdAt,
    updatedAt: raw.updated_at ?? raw.updatedAt,
  };
};

// ==========================================
// MAIN COMPONENT
// ==========================================

export const AdminInitiativeTemplatesPanel: React.FC = () => {
  const [templates, setTemplates] = useState<InitiativeTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'app' | 'org'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Editor state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);

  // Table state
  const [columnWidths, setColumnWidths] = useState<ColumnWidths>(getDefaultColumnWidths());
  const [tableFilters, setTableFilters] = useState<TableFilters>({});
  const [openFilterId, setOpenFilterId] = useState<string | null>(null);

  // Fetch templates
  const fetchTemplates = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await Api.get('/initiatives/templates');
      const list = Array.isArray(response) ? response : response?.templates || [];
      setTemplates(list.map(parseTemplate));
    } catch (err) {
      console.error('[InitiativeTemplates] Error fetching:', err);
      toast.error('Failed to load initiative templates');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // Filtered templates
  const filteredTemplates = useMemo(() => {
    let result = templates;

    // Tab filter
    if (filter === 'app') result = result.filter((t) => t.isSystem);
    else if (filter === 'org') result = result.filter((t) => !t.isSystem);

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q) ||
          t.level.toLowerCase().includes(q)
      );
    }

    // Table column filters
    const typeFilter = tableFilters.type as string[] | undefined;
    if (typeFilter?.length) {
      result = result.filter((t) => {
        const tType = t.isSystem ? 'system' : 'org';
        return typeFilter.includes(tType);
      });
    }

    const levelFilter = tableFilters.level as string[] | undefined;
    if (levelFilter?.length) {
      result = result.filter((t) => levelFilter.includes(t.level));
    }

    const sourceFilter = tableFilters.source as string[] | undefined;
    if (sourceFilter?.length) {
      result = result.filter((t) => t.sourceTypes.some((s) => sourceFilter.includes(s)));
    }

    return result;
  }, [templates, filter, searchQuery, tableFilters]);

  const appCount = templates.filter((t) => t.isSystem).length;
  const orgCount = templates.filter((t) => !t.isSystem).length;

  // Selection
  const allSelected = selectedIds.size > 0 && selectedIds.size === filteredTemplates.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < filteredTemplates.length;

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) setSelectedIds(new Set(filteredTemplates.map((t) => t.id)));
    else setSelectedIds(new Set());
  };

  const handleColumnResize = useCallback((columnId: string, newWidth: number) => {
    setColumnWidths((prev) => ({ ...prev, [columnId]: newWidth }));
  }, []);

  const handleFilterChange = useCallback((columnId: string, value: string[]) => {
    setTableFilters((prev) => ({ ...prev, [columnId]: value }));
  }, []);

  const handleOpenEditor = useCallback((templateId: string | null) => {
    setEditingTemplateId(templateId);
    setEditorOpen(true);
  }, []);

  const handleEditorClose = useCallback(() => {
    setEditorOpen(false);
    setEditingTemplateId(null);
  }, []);

  const handleEditorSaved = useCallback(() => {
    setEditorOpen(false);
    setEditingTemplateId(null);
    fetchTemplates();
  }, [fetchTemplates]);

  const handleDuplicate = async (template: InitiativeTemplate) => {
    try {
      await Api.post(`/initiatives/templates/${template.id}/duplicate`, {
        name: `${template.name} (Copy)`,
      });
      toast.success('Template duplicated');
      fetchTemplates();
    } catch (err: any) {
      toast.error(err?.error || 'Failed to duplicate');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    try {
      await Api.delete(`/initiatives/templates/${id}`);
      toast.success('Template deleted');
      fetchTemplates();
    } catch (err: any) {
      toast.error(err?.error || 'Failed to delete');
    }
  };

  // Count visible sections
  const countVisibleSections = (vs: Record<string, boolean>) =>
    Object.values(vs).filter(Boolean).length;

  // Count gate milestones
  const countGates = (milestones: any[]) => milestones.filter((m) => m.isGate).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50 dark:bg-navy-950">
      {/* Navigation Bar */}
      <div className="bg-white dark:bg-navy-900 border-b border-slate-200 dark:border-navy-700">
        <div className="flex items-center justify-between px-4 py-3">
          {/* Left: Search + Tabs */}
          <div className="flex items-center gap-3">
            {/* Search Toggle */}
            <button
              onClick={() => setShowSearch(!showSearch)}
              className={`flex items-center justify-center h-9 w-9 rounded-lg border transition-all duration-200 ${
                showSearch
                  ? 'bg-primary-500/15 border-primary-500 text-primary-400'
                  : 'bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-600 text-slate-600 dark:text-slate-400 hover:text-navy-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-500'
              }`}
              title="Search"
            >
              <Search size={16} />
            </button>

            {/* All Tab */}
            <button
              onClick={() => setFilter('all')}
              className={`flex items-center gap-1.5 h-9 px-3 text-sm font-medium rounded-lg border transition-all duration-200 ${
                filter === 'all'
                  ? 'bg-primary-500/15 border-primary-500 text-primary-300'
                  : 'bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-600 text-slate-600 dark:text-slate-400 hover:text-navy-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-500'
              }`}
            >
              <Lightbulb size={14} />
              <span>All</span>
              <span
                className={`px-1.5 text-xs rounded-full ${
                  filter === 'all'
                    ? 'bg-primary-500/30 text-primary-300'
                    : 'bg-slate-100 text-slate-600 dark:bg-navy-700 dark:text-slate-400'
                }`}
              >
                {templates.length}
              </span>
            </button>

            {/* App Tab */}
            <button
              onClick={() => setFilter('app')}
              className={`flex items-center gap-1.5 h-9 px-3 text-sm font-medium rounded-lg border transition-all duration-200 ${
                filter === 'app'
                  ? 'bg-blue-500/15 border-blue-500 text-blue-300'
                  : 'bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-600 text-slate-600 dark:text-slate-400 hover:text-navy-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-500'
              }`}
            >
              <Package size={14} />
              <span>App</span>
              <span
                className={`px-1.5 text-xs rounded-full ${
                  filter === 'app'
                    ? 'bg-blue-500/30 text-blue-300'
                    : 'bg-slate-100 text-slate-600 dark:bg-navy-700 dark:text-slate-400'
                }`}
              >
                {appCount}
              </span>
            </button>

            {/* Org Tab */}
            <button
              onClick={() => setFilter('org')}
              className={`flex items-center gap-1.5 h-9 px-3 text-sm font-medium rounded-lg border transition-all duration-200 ${
                filter === 'org'
                  ? 'bg-primary-500/15 border-primary-500 text-primary-300'
                  : 'bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-600 text-slate-600 dark:text-slate-400 hover:text-navy-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-500'
              }`}
            >
              <Building2 size={14} />
              <span>Org</span>
              <span
                className={`px-1.5 text-xs rounded-full ${
                  filter === 'org'
                    ? 'bg-primary-500/30 text-primary-300'
                    : 'bg-slate-100 text-slate-600 dark:bg-navy-700 dark:text-slate-400'
                }`}
              >
                {orgCount}
              </span>
            </button>
          </div>

          {/* Right: New Template */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleOpenEditor(null)}
              className="flex items-center gap-1.5 h-9 px-4 rounded-lg text-sm font-medium bg-gradient-to-r from-primary-500 to-primary-600 text-white border border-c-border hover:brightness-110 shadow-lg shadow-primary-500/25 transition-all duration-200"
            >
              <Plus size={14} />
              <span>New Template</span>
            </button>
          </div>
        </div>

        {/* Expandable Search */}
        {showSearch && (
          <div className="px-4 pb-3">
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search initiative templates..."
                autoFocus
                className="w-full pl-10 pr-10 py-2 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setShowSearch(false);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredTemplates.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center p-8 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700/50 rounded-xl">
            <div className="p-4 rounded-full bg-slate-100 dark:bg-navy-800 inline-block mb-4">
              <Lightbulb size={28} className="text-slate-500" />
            </div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {searchQuery ? 'No templates match your search' : 'No initiative templates found'}
            </p>
            <p className="text-xs text-slate-500">
              {searchQuery
                ? 'Try adjusting your search terms'
                : 'Templates define the process blueprint for initiatives'}
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700/50 rounded-xl overflow-hidden">
            <table /* §27-todo: lista encji → migracja do FilterableTable + Menu 1/2/3 (kanon §2); swiadomie oznaczona, nie przepisana w tej sesji */  className="w-full" style={{ minWidth: 900 }}>
              <thead>
                <tr className="border-b border-slate-200 dark:border-navy-700/50 bg-slate-50 dark:bg-navy-900/50 sticky top-0 z-10">
                  {/* Select All */}
                  <th className="w-10 px-2 py-2">
                    <button
                      onClick={() => handleSelectAll(!allSelected)}
                      className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                        allSelected
                          ? 'bg-c-text text-c-bg border-c-border'
                          : someSelected
                            ? 'bg-c-accent/10 border-c-accent'
                            : 'border-slate-300 dark:border-navy-500 hover:border-primary-400 text-transparent hover:text-slate-500 dark:hover:text-slate-400'
                      }`}
                    >
                      {allSelected ? (
                        <CheckSquare size={14} />
                      ) : someSelected ? (
                        <Minus size={14} />
                      ) : (
                        <Square size={14} />
                      )}
                    </button>
                  </th>

                  {/* Type */}
                  <th
                    className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider relative group/header"
                    style={{ width: columnWidths.type }}
                  >
                    <div className="flex items-center gap-1">
                      <span
                        className={
                          (tableFilters.type as string[])?.length ? 'text-primary-500' : ''
                        }
                      >
                        Type
                      </span>
                      <FilterDropdown
                        column={TEMPLATE_COLUMNS.find((c) => c.id === 'type')!}
                        value={tableFilters.type as string[]}
                        onChange={(val) => handleFilterChange('type', val as string[])}
                        isOpen={openFilterId === 'type'}
                        onToggle={() => setOpenFilterId(openFilterId === 'type' ? null : 'type')}
                        onClose={() => setOpenFilterId(null)}
                      />
                    </div>
                    <ColumnResizer
                      columnId="type"
                      currentWidth={columnWidths.type}
                      minWidth={80}
                      maxWidth={140}
                      onResize={handleColumnResize}
                    />
                  </th>

                  {/* Indicator */}
                  <th className="w-8 px-1 py-2"></th>

                  {/* Template Name */}
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Template
                  </th>

                  {/* Level */}
                  <th
                    className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider relative group/header"
                    style={{ width: columnWidths.level }}
                  >
                    <div className="flex items-center gap-1">
                      <span
                        className={
                          (tableFilters.level as string[])?.length ? 'text-primary-500' : ''
                        }
                      >
                        Level
                      </span>
                      <FilterDropdown
                        column={TEMPLATE_COLUMNS.find((c) => c.id === 'level')!}
                        value={tableFilters.level as string[]}
                        onChange={(val) => handleFilterChange('level', val as string[])}
                        isOpen={openFilterId === 'level'}
                        onToggle={() => setOpenFilterId(openFilterId === 'level' ? null : 'level')}
                        onClose={() => setOpenFilterId(null)}
                      />
                    </div>
                    <ColumnResizer
                      columnId="level"
                      currentWidth={columnWidths.level}
                      minWidth={100}
                      maxWidth={160}
                      onResize={handleColumnResize}
                    />
                  </th>

                  {/* Sources */}
                  <th
                    className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider relative group/header"
                    style={{ width: columnWidths.source }}
                  >
                    <div className="flex items-center gap-1">
                      <span
                        className={
                          (tableFilters.source as string[])?.length ? 'text-primary-500' : ''
                        }
                      >
                        Sources
                      </span>
                      <FilterDropdown
                        column={TEMPLATE_COLUMNS.find((c) => c.id === 'source')!}
                        value={tableFilters.source as string[]}
                        onChange={(val) => handleFilterChange('source', val as string[])}
                        isOpen={openFilterId === 'source'}
                        onToggle={() =>
                          setOpenFilterId(openFilterId === 'source' ? null : 'source')
                        }
                        onClose={() => setOpenFilterId(null)}
                      />
                    </div>
                    <ColumnResizer
                      columnId="source"
                      currentWidth={columnWidths.source}
                      minWidth={100}
                      maxWidth={180}
                      onResize={handleColumnResize}
                    />
                  </th>

                  {/* Sections */}
                  <th
                    className="px-3 py-2 text-center text-xs font-medium text-slate-500 uppercase tracking-wider"
                    style={{ width: columnWidths.sections }}
                  >
                    Sections
                  </th>

                  {/* Tasks */}
                  <th
                    className="px-3 py-2 text-center text-xs font-medium text-slate-500 uppercase tracking-wider"
                    style={{ width: columnWidths.tasks }}
                  >
                    Tasks
                  </th>

                  {/* Gates */}
                  <th
                    className="px-3 py-2 text-center text-xs font-medium text-slate-500 uppercase tracking-wider"
                    style={{ width: columnWidths.gates }}
                  >
                    Gates
                  </th>

                  {/* Updated */}
                  <th
                    className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"
                    style={{ width: columnWidths.updatedAt }}
                  >
                    Updated
                  </th>

                  {/* Actions */}
                  <th
                    className="px-3 py-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wider"
                    style={{ width: columnWidths.actions }}
                  ></th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {filteredTemplates.map((template) => {
                    const typeConfig = getTypeBadgeConfig(template.isSystem);
                    const levelConfig = LEVEL_CONFIG[template.level] || LEVEL_CONFIG.standard;
                    const TypeIcon = typeConfig.icon;
                    const LevelIcon = levelConfig.icon;
                    const isExpanded = expandedId === template.id;

                    return (
                      <React.Fragment key={template.id}>
                        <motion.tr
                          variants={rowVariants}
                          initial="initial"
                          animate="animate"
                          exit="exit"
                          whileHover="hover"
                          onClick={() => setExpandedId(isExpanded ? null : template.id)}
                          className={`
                            group cursor-pointer border-b border-slate-200 dark:border-navy-700/50
                            ${selectedIds.has(template.id) ? 'bg-primary-50 dark:bg-primary-500/10' : ''}
                            ${isExpanded ? 'bg-slate-50 dark:bg-navy-800/50' : ''}
                            transition-colors duration-150
                            hover:bg-slate-50 dark:hover:bg-navy-800/50
                          `}
                        >
                          {/* Checkbox */}
                          <td className="w-10 px-2 py-2.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleSelect(template.id);
                              }}
                              className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${
                                selectedIds.has(template.id)
                                  ? 'bg-c-text text-c-bg border-c-border'
                                  : 'border-slate-300 dark:border-navy-500 hover:border-primary-400'
                              }`}
                            >
                              {selectedIds.has(template.id) && <CheckSquare size={12} />}
                            </button>
                          </td>

                          {/* Type */}
                          <td className="px-3 py-2.5" style={{ width: columnWidths.type }}>
                            <span
                              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-semibold uppercase ${typeConfig.bg} ${typeConfig.color}`}
                            >
                              <TypeIcon size={11} />
                              {typeConfig.label}
                            </span>
                          </td>

                          {/* Indicator */}
                          <td className="w-8 px-1 py-2.5">
                            <div className={`w-2.5 h-2.5 rounded-full ${typeConfig.dot}`} />
                          </td>

                          {/* Template Name */}
                          <td className="px-3 py-2.5" style={{ minWidth: 200 }}>
                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-slate-900 dark:text-white">
                                {template.name}
                              </span>
                              {template.description && (
                                <span className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                                  {template.description}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Level */}
                          <td className="px-3 py-2.5" style={{ width: columnWidths.level }}>
                            <span
                              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium ${levelConfig.bg} ${levelConfig.color}`}
                            >
                              <LevelIcon size={12} />
                              {levelConfig.label}
                            </span>
                          </td>

                          {/* Sources */}
                          <td className="px-3 py-2.5" style={{ width: columnWidths.source }}>
                            <div className="flex flex-wrap gap-1">
                              {template.sourceTypes.slice(0, 3).map((s) => {
                                const sc = getSourceBadgeConfig(s);
                                return (
                                  <span
                                    key={s}
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${sc.bg} ${sc.color}`}
                                  >
                                    {s}
                                  </span>
                                );
                              })}
                              {template.sourceTypes.length > 3 && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-500/15 text-slate-400">
                                  +{template.sourceTypes.length - 3}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Sections */}
                          <td
                            className="px-3 py-2.5 text-center"
                            style={{ width: columnWidths.sections }}
                          >
                            <span className="text-sm text-slate-700 dark:text-slate-400">
                              {countVisibleSections(template.visibleSections)}
                            </span>
                          </td>

                          {/* Tasks */}
                          <td
                            className="px-3 py-2.5 text-center"
                            style={{ width: columnWidths.tasks }}
                          >
                            <span className="text-sm text-slate-700 dark:text-slate-400">
                              {template.suggestedTasks.length}
                            </span>
                          </td>

                          {/* Gates */}
                          <td
                            className="px-3 py-2.5 text-center"
                            style={{ width: columnWidths.gates }}
                          >
                            <span className="text-sm text-slate-700 dark:text-slate-400">
                              {countGates(template.suggestedMilestones)}
                            </span>
                          </td>

                          {/* Updated */}
                          <td className="px-3 py-2.5" style={{ width: columnWidths.updatedAt }}>
                            <div className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400">
                              <Calendar size={12} className="text-slate-400 dark:text-slate-500" />
                              {formatDate(template.updatedAt || template.createdAt)}
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="px-3 py-2.5" style={{ width: columnWidths.actions }}>
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedId(isExpanded ? null : template.id);
                                }}
                                className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-navy-600 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                title="Preview"
                              >
                                <Eye size={15} />
                              </button>
                              {template.isSystem ? (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDuplicate(template);
                                  }}
                                  className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-navy-600 text-slate-500 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                                  title="Duplicate to organization"
                                >
                                  <Copy size={15} />
                                </button>
                              ) : (
                                <>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenEditor(template.id);
                                    }}
                                    className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-navy-600 text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                                    title="Edit"
                                  >
                                    <Edit3 size={15} />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDelete(template.id);
                                    }}
                                    className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-navy-600 text-slate-500 dark:text-slate-400 hover:text-danger-600 dark:hover:text-danger-400 transition-colors"
                                    title="Delete"
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </motion.tr>

                        {/* Expanded Detail Row */}
                        {isExpanded && (
                          <motion.tr
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="bg-slate-50 dark:bg-navy-800/30"
                          >
                            <td colSpan={11} className="px-6 py-5">
                              <div className="grid grid-cols-4 gap-6">
                                {/* Visible Sections */}
                                <div>
                                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                                    Visible Sections
                                  </h4>
                                  <div className="space-y-1.5">
                                    {Object.entries(template.visibleSections).map(
                                      ([key, visible]) => (
                                        <div key={key} className="flex items-center gap-2">
                                          <div
                                            className={`w-2 h-2 rounded-full ${visible ? 'bg-emerald-400' : 'bg-slate-600'}`}
                                          />
                                          <span
                                            className={`text-xs ${visible ? 'text-slate-300' : 'text-slate-600'}`}
                                          >
                                            {key
                                              .replace(/([A-Z])/g, ' $1')
                                              .replace(/^./, (s) => s.toUpperCase())}
                                          </span>
                                        </div>
                                      )
                                    )}
                                  </div>
                                </div>

                                {/* Suggested Tasks */}
                                <div>
                                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                                    Suggested Tasks ({template.suggestedTasks.length})
                                  </h4>
                                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                    {template.suggestedTasks.map((task: any, i: number) => (
                                      <div key={i} className="flex items-start gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
                                        <span className="text-xs text-slate-400 line-clamp-1">
                                          {task.title}
                                        </span>
                                      </div>
                                    ))}
                                    {template.suggestedTasks.length === 0 && (
                                      <span className="text-xs text-slate-600 italic">
                                        None defined
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Milestones & Gates */}
                                <div>
                                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                                    Milestones & Gates ({template.suggestedMilestones.length})
                                  </h4>
                                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                    {template.suggestedMilestones.map((m: any, i: number) => (
                                      <div key={i} className="flex items-start gap-2">
                                        <div
                                          className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${m.isGate ? 'bg-amber-400' : 'bg-slate-500'}`}
                                        />
                                        <span
                                          className={`text-xs ${m.isGate ? 'text-amber-300 font-medium' : 'text-slate-400'}`}
                                        >
                                          {m.name} {m.isGate && '⦿'}
                                        </span>
                                      </div>
                                    ))}
                                    {template.suggestedMilestones.length === 0 && (
                                      <span className="text-xs text-slate-600 italic">
                                        None defined
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Workflow & Decisions */}
                                <div>
                                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                                    Workflow Config
                                  </h4>
                                  <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-slate-500">Phases:</span>
                                      <div className="flex gap-1">
                                        {(template.workflowConfig.phases || ['PLAN']).map(
                                          (p: string) => (
                                            <span
                                              key={p}
                                              className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary-500/15 text-primary-400"
                                            >
                                              {p}
                                            </span>
                                          )
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-slate-500">Approval:</span>
                                      <span
                                        className={`text-xs ${template.workflowConfig.requireApproval ? 'text-emerald-400' : 'text-slate-600'}`}
                                      >
                                        {template.workflowConfig.requireApproval
                                          ? 'Required'
                                          : 'Optional'}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-slate-500">Steering:</span>
                                      <span
                                        className={`text-xs ${template.workflowConfig.requireSteeringCommittee ? 'text-emerald-400' : 'text-slate-600'}`}
                                      >
                                        {template.workflowConfig.requireSteeringCommittee
                                          ? 'Required'
                                          : 'Not needed'}
                                      </span>
                                    </div>

                                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-4 mb-2">
                                      Decisions ({template.suggestedDecisions.length})
                                    </h4>
                                    <div className="space-y-1.5">
                                      {template.suggestedDecisions.map((d: any, i: number) => (
                                        <div key={i} className="flex items-start gap-2">
                                          <div className="w-1.5 h-1.5 rounded-full bg-danger-400 mt-1.5 flex-shrink-0" />
                                          <span className="text-xs text-slate-400">{d.title}</span>
                                        </div>
                                      ))}
                                      {template.suggestedDecisions.length === 0 && (
                                        <span className="text-xs text-slate-600 italic">None</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </motion.tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Template Editor Slide-over */}
      <AnimatePresence>
        {editorOpen && (
          <InitiativeTemplateEditor
            templateId={editingTemplateId}
            onClose={handleEditorClose}
            onSaved={handleEditorSaved}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminInitiativeTemplatesPanel;
