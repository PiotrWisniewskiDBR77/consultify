/**
 * AdminInitiativeSectionTypesPanel
 *
 * Full CRUD management for Initiative Section Types (library).
 * UI matches BlockTypesManager / TemplatesManager pattern exactly.
 *
 * Features:
 * - Top navbar: Search toggle, All/System/Custom tabs, category & column filters
 * - Rich table with expandable detail rows
 * - System type duplication, org type edit/deactivate
 * - AI prompt template preview in expanded detail
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Building2,
  Calendar,
  CheckSquare,
  ChevronDown,
  Copy,
  DollarSign,
  Edit3,
  Eye,
  FileText,
  History,
  Layers,
  Link2,
  Loader2,
  MessageSquare,
  Package,
  Plus,
  Scale,
  Search,
  Sparkles,
  Tag,
  Target,
  Trash2,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

import { Api } from '@/services/api';

// ==========================================
// TYPES
// ==========================================

interface SectionType {
  id: string;
  organizationId: string | null;
  key: string;
  name: string;
  namePl: string | null;
  description: string | null;
  descriptionPl: string | null;
  category: 'content' | 'control' | 'meta';
  columnPosition: 'left' | 'right';
  defaultOrder: number;
  icon: string | null;
  iconColor: string | null;
  iconBg: string | null;
  componentKey: string;
  aiPromptTemplate: string | null;
  isSystem: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// ICON REGISTRY
// ==========================================

const ICON_MAP: Record<string, React.ElementType> = {
  FileText,
  AlertTriangle,
  Target,
  Scale,
  CheckSquare,
  BarChart3,
  DollarSign,
  TrendingUp,
  Sparkles,
  MessageSquare,
  History,
  Layers,
  Users,
  Calendar,
  Link2,
  Tag,
  Bell,
};

const getIcon = (iconName: string | null): React.ElementType => {
  if (!iconName) return Layers;
  return ICON_MAP[iconName] || Layers;
};

// ==========================================
// BADGE HELPERS
// ==========================================

const getTypeBadge = (isSystem: boolean) =>
  isSystem
    ? {
        color: 'text-blue-400',
        bg: 'bg-blue-500/20',
        label: 'APP',
        icon: Package,
        dot: 'bg-blue-500',
      }
    : {
        color: 'text-primary-400',
        bg: 'bg-primary-500/20',
        label: 'ORG',
        icon: Building2,
        dot: 'bg-c-accent',
      };

const getCategoryBadge = (category: string) => {
  switch (category) {
    case 'content':
      return { color: 'text-blue-400', bg: 'bg-blue-500/15', label: 'Content' };
    case 'control':
      return { color: 'text-primary-400', bg: 'bg-primary-500/15', label: 'Control' };
    case 'meta':
      return { color: 'text-slate-400', bg: 'bg-slate-500/15', label: 'Meta' };
    default:
      return { color: 'text-slate-400', bg: 'bg-slate-500/15', label: category };
  }
};

const getColumnBadge = (column: string) =>
  column === 'left'
    ? { color: 'text-emerald-400', bg: 'bg-emerald-500/15', label: 'Left' }
    : { color: 'text-amber-400', bg: 'bg-amber-500/15', label: 'Right' };

const rowVariants = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, x: -10 },
  hover: { y: -1, boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)', transition: { duration: 0.2 } },
};

// ==========================================
// COMPONENT
// ==========================================

export const AdminInitiativeSectionTypesPanel: React.FC = () => {
  const [sectionTypes, setSectionTypes] = useState<SectionType[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [filter, setFilter] = useState<'all' | 'app' | 'org'>('all');
  const [filterCategory, setFilterCategory] = useState<'all' | 'content' | 'control' | 'meta'>(
    'all'
  );
  const [filterColumn, setFilterColumn] = useState<'all' | 'left' | 'right'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  // Selection & expansion
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);

  // ==========================================
  // DATA FETCHING
  // ==========================================

  const fetchSectionTypes = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await Api.get('/initiatives/section-types');
      setSectionTypes(Array.isArray(data) ? data : []);
    } catch (e: any) {
      toast.error('Failed to load section types');
      console.error('[SectionTypes]', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSectionTypes();
  }, [fetchSectionTypes]);

  // ==========================================
  // COMPUTED
  // ==========================================

  const filteredTypes = useMemo(() => {
    let result = sectionTypes;
    if (filter === 'app') result = result.filter((s) => s.isSystem);
    if (filter === 'org') result = result.filter((s) => !s.isSystem);
    if (filterCategory !== 'all') result = result.filter((s) => s.category === filterCategory);
    if (filterColumn !== 'all') result = result.filter((s) => s.columnPosition === filterColumn);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.key.toLowerCase().includes(q) ||
          s.namePl?.toLowerCase().includes(q) ||
          s.description?.toLowerCase().includes(q)
      );
    }
    return result.sort((a, b) => {
      if (a.columnPosition !== b.columnPosition) return a.columnPosition === 'left' ? -1 : 1;
      return a.defaultOrder - b.defaultOrder;
    });
  }, [sectionTypes, filter, filterCategory, filterColumn, searchQuery]);

  const appCount = sectionTypes.filter((s) => s.isSystem).length;
  const orgCount = sectionTypes.filter((s) => !s.isSystem).length;

  // ==========================================
  // ACTIONS
  // ==========================================

  const handleDuplicate = async (id: string) => {
    setIsMutating(true);
    try {
      await Api.post(`/initiatives/section-types/${id}/duplicate`, {});
      toast.success('Section duplicated to organization');
      fetchSectionTypes();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to duplicate');
    } finally {
      setIsMutating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deactivate this section type? It will no longer appear in templates.')) return;
    setIsMutating(true);
    try {
      await Api.delete(`/initiatives/section-types/${id}`);
      toast.success('Section type deactivated');
      fetchSectionTypes();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to deactivate');
    } finally {
      setIsMutating(false);
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  // ==========================================
  // RENDER
  // ==========================================

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50 dark:bg-navy-950">
      {/* ─── Navigation Bar ─── */}
      <div className="bg-white dark:bg-navy-900 border-b border-slate-200 dark:border-navy-700">
        <div className="flex items-center justify-between px-4 py-3">
          {/* Left: Search + Tabs */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSearch(!showSearch)}
              className={`flex items-center justify-center h-9 w-9 rounded-lg border transition-all duration-200 ${
                showSearch
                  ? 'bg-primary-500/15 border-primary-500 text-primary-400'
                  : 'bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-600 text-slate-600 dark:text-slate-400 hover:text-navy-900 dark:hover:text-white hover:border-slate-300'
              }`}
            >
              <Search size={16} />
            </button>

            {/* All */}
            <button
              onClick={() => setFilter('all')}
              className={`flex items-center gap-1.5 h-9 px-3 text-sm font-medium rounded-lg border transition-all duration-200 ${
                filter === 'all'
                  ? 'bg-primary-500/15 border-primary-500 text-primary-300'
                  : 'bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-600 text-slate-600 dark:text-slate-400 hover:text-navy-900 dark:hover:text-white hover:border-slate-300'
              }`}
            >
              <Layers size={14} />
              <span>All</span>
              <span
                className={`px-1.5 text-xs rounded-full ${filter === 'all' ? 'bg-primary-500/30 text-primary-300' : 'bg-slate-100 dark:bg-navy-700 text-slate-600 dark:text-slate-400'}`}
              >
                {sectionTypes.length}
              </span>
            </button>

            {/* App */}
            <button
              onClick={() => setFilter('app')}
              className={`flex items-center gap-1.5 h-9 px-3 text-sm font-medium rounded-lg border transition-all duration-200 ${
                filter === 'app'
                  ? 'bg-blue-500/15 border-blue-500 text-blue-300'
                  : 'bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-600 text-slate-600 dark:text-slate-400 hover:text-navy-900 dark:hover:text-white hover:border-slate-300'
              }`}
            >
              <Package size={14} />
              <span>App</span>
              <span
                className={`px-1.5 text-xs rounded-full ${filter === 'app' ? 'bg-blue-500/30 text-blue-300' : 'bg-slate-100 dark:bg-navy-700 text-slate-600 dark:text-slate-400'}`}
              >
                {appCount}
              </span>
            </button>

            {/* Org */}
            <button
              onClick={() => setFilter('org')}
              className={`flex items-center gap-1.5 h-9 px-3 text-sm font-medium rounded-lg border transition-all duration-200 ${
                filter === 'org'
                  ? 'bg-primary-500/15 border-primary-500 text-primary-300'
                  : 'bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-600 text-slate-600 dark:text-slate-400 hover:text-navy-900 dark:hover:text-white hover:border-slate-300'
              }`}
            >
              <Building2 size={14} />
              <span>Org</span>
              <span
                className={`px-1.5 text-xs rounded-full ${filter === 'org' ? 'bg-primary-500/30 text-primary-300' : 'bg-slate-100 dark:bg-navy-700 text-slate-600 dark:text-slate-400'}`}
              >
                {orgCount}
              </span>
            </button>

            {/* Category filter */}
            <div className="h-5 w-px bg-slate-200 dark:bg-navy-700 mx-1" />
            {(['all', 'content', 'control', 'meta'] as const).map((c) => (
              <button
                key={c}
                onClick={() => setFilterCategory(c)}
                className={`h-9 px-2.5 text-xs font-medium rounded-lg border transition-all ${
                  filterCategory === c
                    ? c === 'all'
                      ? 'bg-primary-500/15 border-primary-500 text-primary-300'
                      : c === 'content'
                        ? 'bg-blue-500/15 border-blue-500 text-blue-300'
                        : c === 'control'
                          ? 'bg-primary-500/15 border-primary-500 text-primary-300'
                          : 'bg-slate-500/15 border-slate-500 text-slate-300'
                    : 'bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-600 text-slate-500 dark:text-slate-400 hover:border-slate-300'
                }`}
              >
                {c === 'all' ? 'All Categories' : c.charAt(0).toUpperCase() + c.slice(1)}
              </button>
            ))}

            {/* Column filter */}
            <div className="h-5 w-px bg-slate-200 dark:bg-navy-700 mx-1" />
            {(['all', 'left', 'right'] as const).map((col) => (
              <button
                key={col}
                onClick={() => setFilterColumn(col)}
                className={`h-9 px-2.5 text-xs font-medium rounded-lg border transition-all ${
                  filterColumn === col
                    ? col === 'all'
                      ? 'bg-primary-500/15 border-primary-500 text-primary-300'
                      : col === 'left'
                        ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300'
                        : 'bg-amber-500/15 border-amber-500 text-amber-300'
                    : 'bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-600 text-slate-500 dark:text-slate-400 hover:border-slate-300'
                }`}
              >
                {col === 'all' ? 'All Columns' : col === 'left' ? 'Left' : 'Right'}
              </button>
            ))}
          </div>

          {/* Right: + New Section */}
          <button className="flex items-center gap-1.5 h-9 px-4 rounded-lg text-sm font-medium bg-gradient-to-r from-primary-500 to-primary-600 text-white border border-white/20 hover:brightness-110 shadow-lg shadow-primary-500/25 transition-all duration-200">
            <Plus size={14} />
            <span>New Section</span>
          </button>
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
                placeholder="Search section types by name, key, description..."
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

      {/* ─── Table ─── */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredTypes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center p-8 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700/50 rounded-xl">
            <div className="p-4 rounded-full bg-slate-100 dark:bg-navy-800 inline-block mb-4">
              <Layers size={28} className="text-slate-500 dark:text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {searchQuery ? 'No sections match your search' : 'No section types found'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {searchQuery
                ? 'Try adjusting your search terms'
                : 'Section types define the available building blocks for initiative cards'}
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700/50 rounded-xl overflow-hidden">
            <table /* §27-todo: lista encji → migracja do FilterableTable + Menu 1/2/3 (kanon §2); swiadomie oznaczona, nie przepisana w tej sesji */  className="w-full" style={{ minWidth: 900 }}>
              <thead>
                <tr className="border-b border-slate-200 dark:border-navy-700/50 bg-slate-50 dark:bg-navy-900/50 sticky top-0 z-10">
                  <th className="w-10 px-2 py-2" />
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[90px]">
                    Type
                  </th>
                  <th className="w-8 px-1 py-2" />
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Section
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[90px]">
                    Category
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[80px]">
                    Column
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[60px]">
                    Order
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[50px]">
                    AI
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[100px]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {filteredTypes.map((st) => {
                    const typeBadge = getTypeBadge(st.isSystem);
                    const catBadge = getCategoryBadge(st.category);
                    const colBadge = getColumnBadge(st.columnPosition);
                    const TypeIcon = typeBadge.icon;
                    const SectionIcon = getIcon(st.icon);
                    const isExpanded = expandedId === st.id;
                    const hasAI = Boolean(st.aiPromptTemplate);

                    return (
                      <React.Fragment key={st.id}>
                        <motion.tr
                          variants={rowVariants}
                          initial="initial"
                          animate="animate"
                          exit="exit"
                          whileHover="hover"
                          onClick={() => setExpandedId(isExpanded ? null : st.id)}
                          className={`
                            group cursor-pointer border-b border-slate-200 dark:border-navy-700/50
                            ${selectedIds.has(st.id) ? 'bg-primary-50 dark:bg-primary-500/10' : ''}
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
                                toggleSelect(st.id);
                              }}
                              className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${
                                selectedIds.has(st.id)
                                  ? 'bg-c-text text-c-bg border-c-border'
                                  : 'border-slate-300 dark:border-navy-500 hover:border-primary-400'
                              }`}
                            >
                              {selectedIds.has(st.id) && <CheckSquare size={12} />}
                            </button>
                          </td>

                          {/* Type */}
                          <td className="px-3 py-2.5">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-semibold uppercase ${typeBadge.bg} ${typeBadge.color}`}
                            >
                              <TypeIcon size={11} />
                              {typeBadge.label}
                            </span>
                          </td>

                          {/* Color indicator */}
                          <td className="w-8 px-1 py-2.5">
                            <div className={`w-2.5 h-2.5 rounded-full ${typeBadge.dot}`} />
                          </td>

                          {/* Section name + description */}
                          <td className="px-3 py-2.5" style={{ minWidth: 220 }}>
                            <div className="flex items-center gap-3">
                              <div
                                className={`p-1.5 rounded-lg bg-gradient-to-br ${st.iconBg || 'from-slate-500/10 to-gray-500/10'}`}
                              >
                                <SectionIcon
                                  size={16}
                                  className={st.iconColor || 'text-slate-500'}
                                />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-slate-900 dark:text-white">
                                    {st.name}
                                  </span>
                                  <code className="text-[10px] px-1 py-0.5 rounded bg-slate-100 dark:bg-navy-800 text-slate-400 dark:text-slate-500 font-mono">
                                    {st.key}
                                  </code>
                                </div>
                                <span className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                                  {st.description || st.namePl || '—'}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Category */}
                          <td className="px-3 py-2.5">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-medium ${catBadge.bg} ${catBadge.color}`}
                            >
                              {catBadge.label}
                            </span>
                          </td>

                          {/* Column */}
                          <td className="px-3 py-2.5">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-medium ${colBadge.bg} ${colBadge.color}`}
                            >
                              {colBadge.label}
                            </span>
                          </td>

                          {/* Order */}
                          <td className="px-3 py-2.5 text-center">
                            <span className="text-sm text-slate-600 dark:text-slate-400">
                              {st.defaultOrder}
                            </span>
                          </td>

                          {/* AI */}
                          <td className="px-3 py-2.5">
                            {hasAI ? (
                              <div
                                className="w-6 h-6 rounded-full bg-primary-500/15 flex items-center justify-center"
                                title="AI prompt configured"
                              >
                                <Sparkles size={12} className="text-primary-400" />
                              </div>
                            ) : (
                              <div
                                className="w-6 h-6 rounded-full bg-slate-100 dark:bg-navy-800 flex items-center justify-center"
                                title="No AI prompt"
                              >
                                <span className="text-[10px] text-slate-400 dark:text-slate-500">—</span>
                              </div>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="px-3 py-2.5">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedId(isExpanded ? null : st.id);
                                }}
                                className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-navy-600 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                title="Preview"
                              >
                                <Eye size={15} />
                              </button>
                              {st.isSystem ? (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDuplicate(st.id);
                                  }}
                                  disabled={isMutating}
                                  className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-navy-600 text-slate-500 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors disabled:opacity-50"
                                  title="Duplicate to organization"
                                >
                                  <Copy size={15} />
                                </button>
                              ) : (
                                <>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                    }}
                                    className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-navy-600 text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                                    title="Edit"
                                  >
                                    <Edit3 size={15} />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDelete(st.id);
                                    }}
                                    disabled={isMutating}
                                    className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-navy-600 text-slate-500 dark:text-slate-400 hover:text-danger-600 dark:hover:text-danger-400 transition-colors disabled:opacity-50"
                                    title="Deactivate"
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </motion.tr>

                        {/* ─── Expanded Detail Row ─── */}
                        {isExpanded && (
                          <motion.tr
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="bg-slate-50 dark:bg-navy-800/30"
                          >
                            <td colSpan={9} className="px-6 py-5">
                              <div className="grid grid-cols-3 gap-6">
                                {/* Col 1: Details */}
                                <div className="space-y-3">
                                  <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    Section Details
                                  </h4>
                                  <div className="space-y-2">
                                    <div className="flex items-center gap-3 p-2.5 rounded-lg bg-white/50 dark:bg-navy-900/50 border border-slate-200/50 dark:border-navy-700/50">
                                      <div
                                        className={`p-2 rounded-lg bg-gradient-to-br ${st.iconBg || 'from-slate-500/10 to-gray-500/10'}`}
                                      >
                                        <SectionIcon
                                          size={20}
                                          className={st.iconColor || 'text-slate-500'}
                                        />
                                      </div>
                                      <div>
                                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                          {st.name}
                                        </p>
                                        {st.namePl && (
                                          <p className="text-xs text-slate-400 dark:text-slate-500">{st.namePl}</p>
                                        )}
                                      </div>
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                      {st.description || 'No description'}
                                    </p>
                                    {st.descriptionPl && (
                                      <p className="text-xs text-slate-400 dark:text-slate-500 italic">
                                        {st.descriptionPl}
                                      </p>
                                    )}
                                  </div>
                                </div>

                                {/* Col 2: Technical */}
                                <div className="space-y-3">
                                  <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    Technical
                                  </h4>
                                  <div className="grid grid-cols-2 gap-2">
                                    <div className="p-2 rounded-lg bg-white/50 dark:bg-navy-900/50 border border-slate-200/50 dark:border-navy-700/50">
                                      <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase">
                                        Key
                                      </span>
                                      <p className="text-xs font-mono text-slate-600 dark:text-slate-400">
                                        {st.key}
                                      </p>
                                    </div>
                                    <div className="p-2 rounded-lg bg-white/50 dark:bg-navy-900/50 border border-slate-200/50 dark:border-navy-700/50">
                                      <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase">
                                        Component
                                      </span>
                                      <p className="text-xs font-mono text-indigo-500">
                                        {st.componentKey}
                                      </p>
                                    </div>
                                    <div className="p-2 rounded-lg bg-white/50 dark:bg-navy-900/50 border border-slate-200/50 dark:border-navy-700/50">
                                      <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase">
                                        Icon
                                      </span>
                                      <p className="text-xs text-slate-600 dark:text-slate-400">
                                        {st.icon || '—'}{' '}
                                        <span className={st.iconColor || ''}>
                                          {st.iconColor || ''}
                                        </span>
                                      </p>
                                    </div>
                                    <div className="p-2 rounded-lg bg-white/50 dark:bg-navy-900/50 border border-slate-200/50 dark:border-navy-700/50">
                                      <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase">
                                        ID
                                      </span>
                                      <p className="text-xs font-mono text-slate-500 dark:text-slate-400 truncate">
                                        {st.id}
                                      </p>
                                    </div>
                                  </div>
                                </div>

                                {/* Col 3: AI Prompt */}
                                <div className="space-y-3">
                                  <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                    <Sparkles size={12} className="text-primary-400" />
                                    AI Prompt Template
                                  </h4>
                                  {st.aiPromptTemplate ? (
                                    <pre className="text-[11px] text-slate-500 dark:text-slate-400 p-3 rounded-lg bg-primary-50/50 dark:bg-primary-500/5 border border-primary-200/50 dark:border-primary-500/10 overflow-auto max-h-40 whitespace-pre-wrap font-mono leading-relaxed">
                                      {st.aiPromptTemplate}
                                    </pre>
                                  ) : (
                                    <div className="flex flex-col items-center justify-center h-32 rounded-lg bg-slate-50 dark:bg-navy-900/50 border border-dashed border-slate-200 dark:border-navy-700">
                                      <Sparkles
                                        size={20}
                                        className="text-slate-300 dark:text-slate-600 mb-2"
                                      />
                                      <p className="text-xs text-slate-400">
                                        No AI prompt template configured
                                      </p>
                                    </div>
                                  )}
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
    </div>
  );
};
