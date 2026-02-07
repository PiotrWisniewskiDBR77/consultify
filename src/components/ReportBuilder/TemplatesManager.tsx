/**
 * TemplatesManager
 *
 * Full CRUD management for Report Builder templates
 * UI/UX matching the Decisions panel style exactly
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  Building2,
  Calendar,
  Check,
  CheckSquare,
  ChevronDown,
  Copy,
  Edit3,
  FileText,
  Flag,
  Loader2,
  Minus,
  Package,
  Plus,
  RefreshCw,
  Search,
  Square,
  Trash2,
  User,
  Users,
  X,
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
import { ReportEditor } from './ReportEditor/ReportEditor';

// ==========================================
// TYPES
// ==========================================

interface TemplateSection {
  key: string;
  type: string;
  title: string;
  required: boolean;
  order: number;
}

interface Template {
  id: string;
  name: string;
  description?: string;
  sourceType: string;
  reportType?: string;
  isSystem: boolean;
  isDefault: boolean;
  isPublic: boolean;
  sections: TemplateSection[];
  createdAt?: string;
  updatedAt?: string;
  // User & Audience
  createdById?: string;
  createdByName?: string;
  audience?: string; // 'executive' | 'manager' | 'analyst' | 'team' | 'external'
}

interface TemplatesManagerProps {
  embedded?: boolean;
  autoOpenNewTemplate?: boolean;
  onUseTemplate?: (templateId: string) => void;
}

// ==========================================
// COLUMN DEFINITIONS (Decisions-style)
// ==========================================

const SOURCE_TYPE_FILTER_OPTIONS = [
  { value: 'ASSESSMENT', label: 'Assessment' },
  { value: 'INTERVIEW', label: 'Interview' },
  { value: 'TOOL', label: 'Tool' },
  { value: 'INITIATIVE', label: 'Initiative' },
];

const TYPE_FILTER_OPTIONS = [
  { value: 'system', label: 'App (System)' },
  { value: 'org', label: 'Organization' },
];

const AUDIENCE_FILTER_OPTIONS = [
  { value: 'executive', label: 'Executive' },
  { value: 'manager', label: 'Manager' },
  { value: 'analyst', label: 'Analyst' },
  { value: 'team', label: 'Team' },
  { value: 'external', label: 'External' },
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
    width: 220,
    minWidth: 180,
    resizable: false,
    filterable: false,
  },
  {
    id: 'sourceType',
    label: 'Module',
    width: 110,
    minWidth: 90,
    maxWidth: 140,
    resizable: true,
    filterable: true,
    filterType: 'multiselect',
    filterOptions: SOURCE_TYPE_FILTER_OPTIONS,
  },
  {
    id: 'audience',
    label: 'Audience',
    width: 100,
    minWidth: 80,
    maxWidth: 130,
    resizable: true,
    filterable: true,
    filterType: 'multiselect',
    filterOptions: AUDIENCE_FILTER_OPTIONS,
  },
  {
    id: 'createdBy',
    label: 'User',
    width: 120,
    minWidth: 100,
    maxWidth: 160,
    resizable: true,
    filterable: false,
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
    label: 'Actions',
    width: 120,
    minWidth: 100,
    maxWidth: 140,
    resizable: false,
    filterable: false,
    align: 'right',
  },
];

// Default column widths
const getDefaultColumnWidths = (): ColumnWidths =>
  TEMPLATE_COLUMNS.reduce((acc, col) => ({ ...acc, [col.id]: col.width }), {});

// Row animation variants (matching Decisions)
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
// HELPER FUNCTIONS
// ==========================================

// Get type badge config
const getTypeBadgeConfig = (isSystem: boolean) => {
  if (isSystem) {
    return {
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/20',
      label: 'APP',
      icon: Package,
      dot: 'bg-cyan-500',
    };
  }
  return {
    color: 'text-purple-400',
    bg: 'bg-purple-500/20',
    label: 'ORG',
    icon: Building2,
    dot: 'bg-purple-500',
  };
};

// Get source type badge config
const getSourceTypeBadgeConfig = (sourceType: string) => {
  switch (sourceType?.toUpperCase()) {
    case 'ASSESSMENT':
      return { color: 'text-blue-400', bg: 'bg-blue-500/20' };
    case 'INTERVIEW':
      return { color: 'text-emerald-400', bg: 'bg-emerald-500/20' };
    case 'TOOL':
      return { color: 'text-amber-400', bg: 'bg-amber-500/20' };
    case 'INITIATIVE':
      return { color: 'text-pink-400', bg: 'bg-pink-500/20' };
    default:
      return { color: 'text-slate-400', bg: 'bg-slate-500/20' };
  }
};

// Get audience badge config
const getAudienceBadgeConfig = (audience?: string) => {
  switch (audience?.toLowerCase()) {
    case 'executive':
      return { color: 'text-violet-400', bg: 'bg-violet-500/20', label: 'Executive' };
    case 'manager':
      return { color: 'text-blue-400', bg: 'bg-blue-500/20', label: 'Manager' };
    case 'analyst':
      return { color: 'text-emerald-400', bg: 'bg-emerald-500/20', label: 'Analyst' };
    case 'team':
      return { color: 'text-amber-400', bg: 'bg-amber-500/20', label: 'Team' };
    case 'external':
      return { color: 'text-rose-400', bg: 'bg-rose-500/20', label: 'External' };
    default:
      return { color: 'text-slate-400', bg: 'bg-slate-500/20', label: 'General' };
  }
};

// Date formatting (matching Decisions style)
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

// ==========================================
// MAIN COMPONENT
// ==========================================

export const TemplatesManager: React.FC<TemplatesManagerProps> = ({
  embedded,
  autoOpenNewTemplate,
  onUseTemplate,
}) => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [filter, setFilter] = useState<'all' | 'app' | 'org'>('all');
  const [moduleFilter, setModuleFilter] = useState<
    'all' | 'assessment' | 'interview' | 'tool' | 'initiative'
  >('all');
  const [formatFilter, setFormatFilter] = useState<'all' | 'horizontal' | 'vertical'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Table state (Decisions-style)
  const [columnWidths, setColumnWidths] = useState<ColumnWidths>(getDefaultColumnWidths());
  const [tableFilters, setTableFilters] = useState<TableFilters>({});
  const [openFilterId, setOpenFilterId] = useState<string | null>(null);

  // Fetch templates
  const fetchTemplates = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await Api.get('/report-builder/templates');
      const allTemplates = response?.templates || [];

      const parsed = allTemplates.map((t: any) => {
        // Normalize backend payload (SQLite rows often return snake_case fields)
        const normalized = {
          sourceType: t.sourceType ?? t.source_type,
          reportType: t.reportType ?? t.report_type,
          isSystem: Boolean(t.isSystem ?? t.is_system),
          isDefault: Boolean(t.isDefault ?? t.is_default),
          isPublic: Boolean(t.isPublic ?? t.is_public),
          createdAt: t.createdAt ?? t.created_at,
          updatedAt: t.updatedAt ?? t.updated_at,
          createdById: t.createdById ?? t.created_by ?? t.createdBy,
          createdByName: t.createdByName ?? t.created_by_name ?? t.creatorName,
        };

        const rawSections = Array.isArray(t.sections)
          ? t.sections
          : typeof t.sections === 'string'
            ? t.sections
            : typeof t.sectionsJson === 'string'
              ? t.sectionsJson
              : typeof t.sections_json === 'string'
                ? t.sections_json
                : null;

        let sections: any[] = [];
        if (Array.isArray(rawSections)) {
          sections = rawSections;
        } else if (typeof rawSections === 'string' && rawSections.trim()) {
          try {
            sections = JSON.parse(rawSections);
          } catch {
            sections = [];
          }
        }

        // Prefer normalized fields for UI logic (filters, counts, rendering)
        return { ...t, ...normalized, sections };
      });

      setTemplates(parsed);
    } catch (err) {
      console.error('[TemplatesManager] Error fetching templates:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // Filter and search
  const filteredTemplates = useMemo(() => {
    let result = templates;

    // Tab filter (App/Org)
    if (filter === 'app') {
      result = result.filter((t) => t.isSystem);
    } else if (filter === 'org') {
      result = result.filter((t) => !t.isSystem);
    }

    // Module filter
    if (moduleFilter !== 'all') {
      result = result.filter((t) => (t.sourceType || '').toLowerCase() === moduleFilter);
    }

    // Format filter (horizontal/vertical based on reportType or metadata)
    if (formatFilter !== 'all') {
      result = result.filter((t) => {
        const format = (t.reportType || 'vertical').toLowerCase();
        return format === formatFilter;
      });
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(query) ||
          t.description?.toLowerCase().includes(query) ||
          (t.sourceType || '').toLowerCase().includes(query)
      );
    }

    // Table column filters
    const typeFilter = tableFilters.type as string[] | undefined;
    if (typeFilter?.length) {
      result = result.filter((t) => {
        const templateType = t.isSystem ? 'system' : 'org';
        return typeFilter.includes(templateType);
      });
    }

    const sourceTypeFilter = tableFilters.sourceType as string[] | undefined;
    if (sourceTypeFilter?.length) {
      result = result.filter((t) => sourceTypeFilter.includes(t.sourceType || ''));
    }

    const audienceFilter = tableFilters.audience as string[] | undefined;
    if (audienceFilter?.length) {
      result = result.filter((t) => audienceFilter.includes(t.audience || 'general'));
    }

    return result;
  }, [templates, filter, moduleFilter, formatFilter, searchQuery, tableFilters]);

  const appCount = templates.filter((t) => t.isSystem).length;
  const orgCount = templates.filter((t) => !t.isSystem).length;

  // Counts for filter dropdowns
  const moduleCounts = useMemo(
    () => ({
      assessment: templates.filter((t) => (t.sourceType || '').toLowerCase() === 'assessment')
        .length,
      interview: templates.filter((t) => (t.sourceType || '').toLowerCase() === 'interview').length,
      tool: templates.filter((t) => (t.sourceType || '').toLowerCase() === 'tool').length,
      initiative: templates.filter((t) => (t.sourceType || '').toLowerCase() === 'initiative')
        .length,
    }),
    [templates]
  );

  const formatCounts = useMemo(
    () => ({
      horizontal: templates.filter((t) => (t.reportType || '').toLowerCase() === 'horizontal')
        .length,
      vertical: templates.filter((t) => (t.reportType || 'vertical').toLowerCase() === 'vertical')
        .length,
    }),
    [templates]
  );

  // Selection helpers
  const allSelected = selectedIds.size > 0 && selectedIds.size === filteredTemplates.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < filteredTemplates.length;

  // Handlers
  const handleDelete = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      await Api.delete(`/report-builder/templates/${templateId}`);
      toast.success('Template deleted');
      fetchTemplates();
    } catch (err: any) {
      toast.error(err?.error || 'Failed to delete');
    }
  };

  const handleDuplicate = async (template: Template) => {
    try {
      await Api.post(`/report-builder/templates/${template.id}/duplicate`, {
        name: `${template.name} (Copy)`,
      });
      toast.success('Template duplicated');
      fetchTemplates();
    } catch (err: any) {
      toast.error(err?.error || 'Failed to duplicate');
    }
  };

  const openEditor = (template?: Template) => {
    setEditingTemplate(template || null);
    setShowEditor(true);
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedIds(new Set(filteredTemplates.map((t) => t.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleColumnResize = useCallback((columnId: string, newWidth: number) => {
    setColumnWidths((prev) => ({ ...prev, [columnId]: newWidth }));
  }, []);

  const handleFilterChange = useCallback((columnId: string, value: string[]) => {
    setTableFilters((prev) => ({ ...prev, [columnId]: value }));
  }, []);

  useEffect(() => {
    if (autoOpenNewTemplate) {
      setEditingTemplate(null);
      setShowEditor(true);
    }
  }, [autoOpenNewTemplate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50 dark:bg-navy-950">
      {/* Navigation Bar - Matching MyWorkHub Golden Standard */}
      <div className="bg-white dark:bg-navy-900 border-b border-slate-200 dark:border-navy-700">
        {/* Main Navigation Row */}
        <div className="flex items-center justify-between px-4 py-3">
          {/* Left: Search Toggle + Tab Buttons */}
          <div className="flex items-center gap-3">
            {/* Search Toggle Button */}
            <button
              onClick={() => setShowSearch(!showSearch)}
              className={`flex items-center justify-center h-9 w-9 rounded-lg border transition-all duration-200 ${
                showSearch
                  ? 'bg-purple-500/15 border-purple-500 text-purple-400'
                  : 'bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-600 text-slate-600 dark:text-slate-400 hover:text-navy-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-500'
              }`}
              title="Search"
            >
              <Search size={16} />
            </button>

            {/* Tab Buttons - Unified height */}
            <button
              onClick={() => setFilter('all')}
              className={`flex items-center gap-1.5 h-9 px-3 text-sm font-medium rounded-lg border transition-all duration-200 ${
                filter === 'all'
                  ? 'bg-purple-500/15 border-purple-500 text-purple-300'
                  : 'bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-600 text-slate-600 dark:text-slate-400 hover:text-navy-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-500'
              }`}
            >
              <FileText size={14} />
              <span>All</span>
              <span
                className={`px-1.5 text-xs rounded-full ${
                  filter === 'all'
                    ? 'bg-purple-500/30 text-purple-300'
                    : 'bg-slate-100 text-slate-600 dark:bg-navy-700 dark:text-slate-400'
                }`}
              >
                {templates.length}
              </span>
            </button>

            <button
              onClick={() => setFilter('app')}
              className={`flex items-center gap-1.5 h-9 px-3 text-sm font-medium rounded-lg border transition-all duration-200 ${
                filter === 'app'
                  ? 'bg-cyan-500/15 border-cyan-500 text-cyan-300'
                  : 'bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-600 text-slate-600 dark:text-slate-400 hover:text-navy-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-500'
              }`}
            >
              <Package size={14} />
              <span>App</span>
              <span
                className={`px-1.5 text-xs rounded-full ${
                  filter === 'app'
                    ? 'bg-cyan-500/30 text-cyan-300'
                    : 'bg-slate-100 text-slate-600 dark:bg-navy-700 dark:text-slate-400'
                }`}
              >
                {appCount}
              </span>
            </button>

            <button
              onClick={() => setFilter('org')}
              className={`flex items-center gap-1.5 h-9 px-3 text-sm font-medium rounded-lg border transition-all duration-200 ${
                filter === 'org'
                  ? 'bg-purple-500/15 border-purple-500 text-purple-300'
                  : 'bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-600 text-slate-600 dark:text-slate-400 hover:text-navy-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-500'
              }`}
            >
              <Building2 size={14} />
              <span>Org</span>
              <span
                className={`px-1.5 text-xs rounded-full ${
                  filter === 'org'
                    ? 'bg-purple-500/30 text-purple-300'
                    : 'bg-slate-100 text-slate-600 dark:bg-navy-700 dark:text-slate-400'
                }`}
              >
                {orgCount}
              </span>
            </button>
          </div>

          {/* Right: Filter Dropdowns + Action Button */}
          <div className="flex items-center gap-2">
            {/* Module Filter Dropdown */}
            <div className="relative">
              <select
                value={moduleFilter}
                onChange={(e) => setModuleFilter(e.target.value as typeof moduleFilter)}
                className="appearance-none h-9 pl-3 pr-8 rounded-lg text-sm font-medium bg-white dark:bg-navy-700 border border-slate-200 dark:border-navy-500 text-slate-700 dark:text-slate-200 hover:border-purple-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 transition-all duration-200 cursor-pointer"
              >
                <option value="all">All Modules</option>
                <option value="assessment">Assessment ({moduleCounts.assessment})</option>
                <option value="interview">Interview ({moduleCounts.interview})</option>
                <option value="tool">Tool ({moduleCounts.tool})</option>
                <option value="initiative">Initiative ({moduleCounts.initiative})</option>
              </select>
              <ChevronDown
                size={14}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 pointer-events-none"
              />
            </div>

            {/* Format Filter Dropdown */}
            <div className="relative">
              <select
                value={formatFilter}
                onChange={(e) => setFormatFilter(e.target.value as typeof formatFilter)}
                className="appearance-none h-9 pl-3 pr-8 rounded-lg text-sm font-medium bg-white dark:bg-navy-700 border border-slate-200 dark:border-navy-500 text-slate-700 dark:text-slate-200 hover:border-purple-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 transition-all duration-200 cursor-pointer"
              >
                <option value="all">All Formats</option>
                <option value="vertical">Vertical ({formatCounts.vertical})</option>
                <option value="horizontal">Horizontal ({formatCounts.horizontal})</option>
              </select>
              <ChevronDown
                size={14}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 pointer-events-none"
              />
            </div>

            {/* Separator */}
            <div className="w-px h-6 bg-slate-200 dark:bg-navy-600 mx-1" />

            {/* Primary Action Button - Unified height */}
            <button
              onClick={() => openEditor()}
              className="flex items-center gap-1.5 h-9 px-4 rounded-lg text-sm font-medium bg-gradient-to-r from-purple-500 to-purple-600 text-white border border-white/20 hover:brightness-110 shadow-lg shadow-purple-500/25 transition-all duration-200"
            >
              <Plus size={14} />
              <span>New Template</span>
            </button>
          </div>
        </div>

        {/* Expandable Search Bar */}
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
                placeholder="Search templates..."
                autoFocus
                className="w-full pl-10 pr-10 py-2 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 transition-all"
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

      {/* Table Container - matching Decisions style */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredTemplates.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center p-8 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700/50 rounded-xl">
            <div className="p-4 rounded-full bg-slate-100 dark:bg-navy-800 inline-block mb-4">
              <FileText size={28} className="text-slate-500" />
            </div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {searchQuery ? 'No templates match your search' : 'No templates found'}
            </p>
            <p className="text-xs text-slate-500">
              {searchQuery
                ? 'Try adjusting your search terms'
                : 'Create a new template to get started'}
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700/50 rounded-xl overflow-hidden">
            <table className="w-full" style={{ minWidth: 900 }}>
              <thead>
                <tr className="border-b border-slate-200 dark:border-navy-700/50 bg-slate-50 dark:bg-navy-900/50 sticky top-0 z-10">
                  {/* Select All */}
                  <th className="w-10 px-2 py-2">
                    <button
                      onClick={() => handleSelectAll(!allSelected)}
                      className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                        allSelected
                          ? 'bg-purple-500 border-purple-500 text-white'
                          : someSelected
                            ? 'bg-purple-500/50 border-purple-500 text-white'
                            : 'border-slate-300 dark:border-navy-500 hover:border-purple-400 text-transparent hover:text-slate-500 dark:hover:text-slate-400'
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

                  {/* Type with Filter */}
                  <th
                    className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider relative group/header"
                    style={{ width: columnWidths.type }}
                  >
                    <div className="flex items-center gap-1">
                      <span
                        className={(tableFilters.type as string[])?.length ? 'text-purple-500' : ''}
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

                  {/* Indicator (dot) */}
                  <th className="w-8 px-1 py-2"></th>

                  {/* Template Name */}
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Template
                  </th>

                  {/* Module with Filter */}
                  <th
                    className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider relative group/header"
                    style={{ width: columnWidths.sourceType }}
                  >
                    <div className="flex items-center gap-1">
                      <span
                        className={
                          (tableFilters.sourceType as string[])?.length ? 'text-purple-500' : ''
                        }
                      >
                        Module
                      </span>
                      <FilterDropdown
                        column={TEMPLATE_COLUMNS.find((c) => c.id === 'sourceType')!}
                        value={tableFilters.sourceType as string[]}
                        onChange={(val) => handleFilterChange('sourceType', val as string[])}
                        isOpen={openFilterId === 'sourceType'}
                        onToggle={() =>
                          setOpenFilterId(openFilterId === 'sourceType' ? null : 'sourceType')
                        }
                        onClose={() => setOpenFilterId(null)}
                      />
                    </div>
                    <ColumnResizer
                      columnId="sourceType"
                      currentWidth={columnWidths.sourceType}
                      minWidth={100}
                      maxWidth={180}
                      onResize={handleColumnResize}
                    />
                  </th>

                  {/* Audience with Filter */}
                  <th
                    className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider relative group/header"
                    style={{ width: columnWidths.audience }}
                  >
                    <div className="flex items-center gap-1">
                      <span
                        className={
                          (tableFilters.audience as string[])?.length ? 'text-purple-500' : ''
                        }
                      >
                        Audience
                      </span>
                      <FilterDropdown
                        column={TEMPLATE_COLUMNS.find((c) => c.id === 'audience')!}
                        value={tableFilters.audience as string[]}
                        onChange={(val) => handleFilterChange('audience', val as string[])}
                        isOpen={openFilterId === 'audience'}
                        onToggle={() =>
                          setOpenFilterId(openFilterId === 'audience' ? null : 'audience')
                        }
                        onClose={() => setOpenFilterId(null)}
                      />
                    </div>
                    <ColumnResizer
                      columnId="audience"
                      currentWidth={columnWidths.audience}
                      minWidth={80}
                      maxWidth={130}
                      onResize={handleColumnResize}
                    />
                  </th>

                  {/* User */}
                  <th
                    className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider relative group/header"
                    style={{ width: columnWidths.createdBy }}
                  >
                    <span>User</span>
                    <ColumnResizer
                      columnId="createdBy"
                      currentWidth={columnWidths.createdBy}
                      minWidth={100}
                      maxWidth={160}
                      onResize={handleColumnResize}
                    />
                  </th>

                  {/* Sections */}
                  <th
                    className="px-3 py-2 text-center text-xs font-medium text-slate-500 uppercase tracking-wider relative group/header"
                    style={{ width: columnWidths.sections }}
                  >
                    <span>Sections</span>
                    <ColumnResizer
                      columnId="sections"
                      currentWidth={columnWidths.sections}
                      minWidth={60}
                      maxWidth={100}
                      onResize={handleColumnResize}
                    />
                  </th>

                  {/* Updated */}
                  <th
                    className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider relative group/header"
                    style={{ width: columnWidths.updatedAt }}
                  >
                    <span>Updated</span>
                    <ColumnResizer
                      columnId="updatedAt"
                      currentWidth={columnWidths.updatedAt}
                      minWidth={80}
                      maxWidth={130}
                      onResize={handleColumnResize}
                    />
                  </th>

                  {/* Actions */}
                  <th
                    className="px-3 py-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wider"
                    style={{ width: columnWidths.actions }}
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {filteredTemplates.map((template) => {
                    const typeConfig = getTypeBadgeConfig(template.isSystem);
                    const sourceConfig = getSourceTypeBadgeConfig(template.sourceType);
                    const TypeIcon = typeConfig.icon;

                    return (
                      <motion.tr
                        key={template.id}
                        variants={rowVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        whileHover="hover"
                        className={`
                          group cursor-pointer border-b border-slate-200 dark:border-navy-700/50
                          ${selectedIds.has(template.id) ? 'bg-purple-50 dark:bg-purple-500/10' : ''}
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
                                ? 'bg-purple-500 border-purple-500 text-white'
                                : 'border-slate-300 dark:border-navy-500 hover:border-purple-400'
                            }`}
                          >
                            {selectedIds.has(template.id) && <CheckSquare size={12} />}
                          </button>
                        </td>

                        {/* Type Badge */}
                        <td className="px-3 py-2.5" style={{ width: columnWidths.type }}>
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-semibold uppercase ${typeConfig.bg} ${typeConfig.color}`}
                          >
                            <TypeIcon size={11} />
                            {typeConfig.label}
                          </span>
                        </td>

                        {/* Indicator Dot */}
                        <td className="w-8 px-1 py-2.5">
                          <div
                            className={`w-2.5 h-2.5 rounded-full ${typeConfig.dot}`}
                            title={template.isSystem ? 'System template' : 'Organization template'}
                          />
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

                        {/* Module */}
                        <td className="px-3 py-2.5" style={{ width: columnWidths.sourceType }}>
                          <span
                            className={`inline-flex px-2 py-1 rounded text-xs font-medium ${sourceConfig.bg} ${sourceConfig.color}`}
                          >
                            {template.sourceType || '—'}
                          </span>
                        </td>

                        {/* Audience */}
                        <td className="px-3 py-2.5" style={{ width: columnWidths.audience }}>
                          {(() => {
                            const audienceConfig = getAudienceBadgeConfig(template.audience);
                            return (
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${audienceConfig.bg} ${audienceConfig.color}`}
                              >
                                <Users size={11} />
                                {audienceConfig.label}
                              </span>
                            );
                          })()}
                        </td>

                        {/* User */}
                        <td className="px-3 py-2.5" style={{ width: columnWidths.createdBy }}>
                          <div className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400">
                            <User size={13} className="text-slate-400 dark:text-slate-500" />
                            <span className="truncate">
                              {template.createdByName || (template.isSystem ? 'System' : '—')}
                            </span>
                          </div>
                        </td>

                        {/* Sections */}
                        <td
                          className="px-3 py-2.5 text-center"
                          style={{ width: columnWidths.sections }}
                        >
                          <span className="text-sm text-slate-700 dark:text-slate-400">
                            {template.sections?.length || 0}
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
                            {template.isSystem ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDuplicate(template);
                                }}
                                className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-navy-600 text-slate-500 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                                title="Duplicate to organization"
                              >
                                <Copy size={15} />
                              </button>
                            ) : (
                              <>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openEditor(template);
                                  }}
                                  className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-navy-600 text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                                  title="Edit"
                                >
                                  <Edit3 size={15} />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDuplicate(template);
                                  }}
                                  className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-navy-600 text-slate-500 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                                  title="Duplicate"
                                >
                                  <Copy size={15} />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(template.id);
                                  }}
                                  className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-navy-600 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Template Editor Modal */}
      <AnimatePresence>
        {showEditor && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-slate-50 dark:bg-navy-950"
          >
            <ReportEditor
              mode="template"
              templateId={editingTemplate?.id}
              templateMeta={{
                name: editingTemplate?.name || '',
                description: editingTemplate?.description || '',
                sourceType: (editingTemplate?.sourceType as any) || 'ASSESSMENT',
                reportType: editingTemplate?.reportType || '',
              }}
              onTemplateSaved={() => {
                setShowEditor(false);
                setEditingTemplate(null);
                fetchTemplates();
              }}
              onClose={() => {
                setShowEditor(false);
                setEditingTemplate(null);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TemplatesManager;
