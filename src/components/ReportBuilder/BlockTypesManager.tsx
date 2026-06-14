/**
 * BlockTypesManager
 *
 * Full CRUD management for Report Builder block types (library)
 * UI/UX matching TemplatesManager / Decisions panel style exactly
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  Blocks,
  Building2,
  Calendar,
  CheckSquare,
  ChevronDown,
  Copy,
  Edit3,
  Loader2,
  Minus,
  Package,
  Plus,
  Search,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

import { Api } from '@/services/api';

// ==========================================
// TYPES
// ==========================================

type BlockRenderKind = 'markdown' | 'callout' | 'table' | 'chart' | 'matrix' | 'json';
type SectionLength = 'short' | 'medium' | 'long';
type SectionLanguage = 'technical' | 'business' | 'general';
type BlockCategory = 'content' | 'data' | 'visual';

export interface BlockType {
  id: string;
  name: string;
  description?: string | null;
  sourceTypes?: string[] | null;
  renderKind: BlockRenderKind;
  promptTemplate?: string | null;
  inputSchema?: Record<string, unknown> | null;
  defaultLength?: SectionLength;
  defaultLanguage?: SectionLanguage;
  isSystem?: boolean;
  isActive?: boolean;
  category?: BlockCategory;
  displayOrder?: number;
  createdAt?: string;
  updatedAt?: string;
}

interface BlockTypesManagerProps {
  onBack?: () => void;
  embedded?: boolean;
}

// ==========================================
// HELPER FUNCTIONS (matching TemplatesManager)
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
    dot: 'bg-primary-500',
  };
};

const getCategoryBadgeConfig = (category?: string) => {
  switch (category) {
    case 'content':
      return { color: 'text-blue-400', bg: 'bg-blue-500/20', label: 'Content' };
    case 'data':
      return { color: 'text-emerald-400', bg: 'bg-emerald-500/20', label: 'Data' };
    case 'visual':
      return { color: 'text-primary-400', bg: 'bg-primary-500/20', label: 'Visual' };
    default:
      return { color: 'text-slate-600', bg: 'bg-slate-500/20', label: 'Other' };
  }
};

const getRenderBadgeConfig = (renderKind: string) => {
  switch (renderKind) {
    case 'markdown':
      return { color: 'text-blue-400', bg: 'bg-blue-500/20' };
    case 'callout':
      return { color: 'text-amber-400', bg: 'bg-amber-500/20' };
    case 'table':
      return { color: 'text-emerald-400', bg: 'bg-emerald-500/20' };
    case 'chart':
      return { color: 'text-pink-400', bg: 'bg-pink-500/20' };
    case 'matrix':
      return { color: 'text-primary-400', bg: 'bg-primary-500/20' };
    case 'json':
      return { color: 'text-blue-400', bg: 'bg-blue-500/20' };
    default:
      return { color: 'text-slate-600', bg: 'bg-slate-500/20' };
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
// MAIN COMPONENT
// ==========================================

export const BlockTypesManager: React.FC<BlockTypesManagerProps> = ({ embedded = false }) => {
  const [blocks, setBlocks] = useState<BlockType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'app' | 'org'>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'content' | 'data' | 'visual'>(
    'all'
  );
  const [renderFilter, setRenderFilter] = useState<'all' | BlockRenderKind>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Edit modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<BlockType | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [renderKind, setRenderKind] = useState<BlockRenderKind>('markdown');
  const [sourceTypesText, setSourceTypesText] = useState('ASSESSMENT');
  const [promptTemplate, setPromptTemplate] = useState('');
  const [defaultLength, setDefaultLength] = useState<SectionLength>('medium');
  const [defaultLanguage, setDefaultLanguage] = useState<SectionLanguage>('business');

  const resetForm = useCallback(() => {
    setName('');
    setDescription('');
    setRenderKind('markdown');
    setSourceTypesText('ASSESSMENT');
    setPromptTemplate('');
    setDefaultLength('medium');
    setDefaultLanguage('business');
  }, []);

  const openCreate = () => {
    setEditing(null);
    resetForm();
    setIsModalOpen(true);
  };

  const openEdit = (b: BlockType) => {
    setEditing(b);
    setName(b.name);
    setDescription(b.description || '');
    setRenderKind((b.renderKind || 'markdown') as BlockRenderKind);
    setSourceTypesText((b.sourceTypes || ['ASSESSMENT']).join(', '));
    setPromptTemplate(b.promptTemplate || '');
    setDefaultLength((b.defaultLength || 'medium') as SectionLength);
    setDefaultLanguage((b.defaultLanguage || 'business') as SectionLanguage);
    setIsModalOpen(true);
  };

  const parsedSourceTypes = useMemo(() => {
    const items = sourceTypesText
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    return Array.from(new Set(items));
  }, [sourceTypesText]);

  const fetchBlocks = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await Api.get('/report-builder/block-types');
      setBlocks(res?.blocks || []);
    } catch (e: any) {
      console.error('[BlockTypesManager] Error fetching blocks:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBlocks();
  }, [fetchBlocks]);

  const save = async () => {
    if (!name.trim()) return;
    const payload = {
      name: name.trim(),
      description: description.trim() || undefined,
      sourceTypes: parsedSourceTypes,
      renderKind,
      promptTemplate: promptTemplate.trim() || undefined,
      defaultLength,
      defaultLanguage,
    };

    try {
      if (editing?.id) {
        await Api.put(`/report-builder/block-types/${editing.id}`, payload);
        toast.success('Block updated');
      } else {
        await Api.post('/report-builder/block-types', payload);
        toast.success('Block created');
      }
      setIsModalOpen(false);
      await fetchBlocks();
    } catch (err: any) {
      toast.error(err?.error || 'Failed to save');
    }
  };

  const deactivate = async (b: BlockType) => {
    if (b.isSystem) return;
    if (!confirm('Deactivate this block type?')) return;
    try {
      await Api.delete(`/report-builder/block-types/${b.id}`);
      toast.success('Block deactivated');
      await fetchBlocks();
    } catch (err: any) {
      toast.error(err?.error || 'Failed to deactivate');
    }
  };

  // Filter and search
  const filteredBlocks = useMemo(() => {
    let result = blocks;

    if (filter === 'app') result = result.filter((b) => b.isSystem);
    else if (filter === 'org') result = result.filter((b) => !b.isSystem);

    if (categoryFilter !== 'all')
      result = result.filter((b) => (b.category || 'content') === categoryFilter);

    if (renderFilter !== 'all') result = result.filter((b) => b.renderKind === renderFilter);

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (b) =>
          b.name.toLowerCase().includes(query) ||
          b.description?.toLowerCase().includes(query) ||
          b.renderKind.toLowerCase().includes(query)
      );
    }

    return result;
  }, [blocks, filter, categoryFilter, renderFilter, searchQuery]);

  const appCount = blocks.filter((b) => b.isSystem).length;
  const orgCount = blocks.filter((b) => !b.isSystem).length;

  const categoryCounts = useMemo(
    () => ({
      content: blocks.filter((b) => (b.category || 'content') === 'content').length,
      data: blocks.filter((b) => b.category === 'data').length,
      visual: blocks.filter((b) => b.category === 'visual').length,
    }),
    [blocks]
  );

  // Selection helpers
  const allSelected = selectedIds.size > 0 && selectedIds.size === filteredBlocks.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < filteredBlocks.length;

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) setSelectedIds(new Set(filteredBlocks.map((b) => b.id)));
    else setSelectedIds(new Set());
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50 dark:bg-navy-950">
      {/* Navigation Bar - Matching TemplatesManager exactly */}
      <div className="bg-white dark:bg-navy-900 border-b border-slate-200 dark:border-navy-700">
        {/* Main Navigation Row */}
        <div className="flex items-center justify-between px-4 py-3">
          {/* Left: Search Toggle + Tab Buttons */}
          <div className="flex items-center gap-3">
            {/* Search Toggle Button */}
            <button
              onClick={() => setShowSearch(!showSearch)}
              className={`flex items-center justify-center h-9 w-9 rounded-lg border transition duration-200 ${
                showSearch
                  ? 'bg-primary-500/15 border-primary-500 text-primary-400'
                  : 'bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-600 text-slate-600 dark:text-slate-400 hover:text-navy-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-500'
              }`}
              title="Search"
            >
              <Search size={16} />
            </button>

            {/* Tab Buttons - Unified height */}
            <button
              onClick={() => setFilter('all')}
              className={`flex items-center gap-1.5 h-9 px-3 text-sm font-medium rounded-lg border transition duration-200 ${
                filter === 'all'
                  ? 'bg-primary-500/15 border-primary-500 text-primary-300'
                  : 'bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-600 text-slate-600 dark:text-slate-400 hover:text-navy-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-500'
              }`}
            >
              <Blocks size={14} />
              <span>All</span>
              <span
                className={`px-1.5 text-xs rounded-full ${
                  filter === 'all'
                    ? 'bg-primary-500/30 text-primary-300'
                    : 'bg-slate-100 text-slate-600 dark:bg-navy-700 dark:text-slate-400'
                }`}
              >
                {blocks.length}
              </span>
            </button>

            <button
              onClick={() => setFilter('app')}
              className={`flex items-center gap-1.5 h-9 px-3 text-sm font-medium rounded-lg border transition duration-200 ${
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

            <button
              onClick={() => setFilter('org')}
              className={`flex items-center gap-1.5 h-9 px-3 text-sm font-medium rounded-lg border transition duration-200 ${
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

          {/* Right: Filter Dropdowns + Action Button */}
          <div className="flex items-center gap-2">
            {/* Category Filter Dropdown */}
            <div className="relative">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as typeof categoryFilter)}
                className="appearance-none h-9 pl-3 pr-8 rounded-lg text-sm font-medium bg-white dark:bg-navy-700 border border-slate-200 dark:border-navy-500 text-slate-700 dark:text-slate-200 hover:border-primary-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/20 transition duration-200 cursor-pointer"
              >
                <option value="all">All Categories</option>
                <option value="content">Content ({categoryCounts.content})</option>
                <option value="data">Data ({categoryCounts.data})</option>
                <option value="visual">Visual ({categoryCounts.visual})</option>
              </select>
              <ChevronDown
                size={14}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 pointer-events-none"
              />
            </div>

            {/* Render Kind Filter Dropdown */}
            <div className="relative">
              <select
                value={renderFilter}
                onChange={(e) => setRenderFilter(e.target.value as typeof renderFilter)}
                className="appearance-none h-9 pl-3 pr-8 rounded-lg text-sm font-medium bg-white dark:bg-navy-700 border border-slate-200 dark:border-navy-500 text-slate-700 dark:text-slate-200 hover:border-primary-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/20 transition duration-200 cursor-pointer"
              >
                <option value="all">All Renders</option>
                <option value="markdown">Markdown</option>
                <option value="callout">Callout</option>
                <option value="table">Table</option>
                <option value="chart">Chart</option>
                <option value="matrix">Matrix</option>
                <option value="json">JSON</option>
              </select>
              <ChevronDown
                size={14}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 pointer-events-none"
              />
            </div>

            {/* Separator */}
            <div className="w-px h-6 bg-slate-200 dark:bg-navy-600 mx-1" />

            {/* Primary Action Button */}
            <button
              onClick={openCreate}
              className="flex items-center gap-1.5 h-9 px-4 rounded-lg text-sm font-medium bg-gradient-to-r from-primary-500 to-primary-600 text-white border border-white/20 hover:brightness-110 shadow-lg shadow-primary-500/25 transition duration-200"
            >
              <Plus size={14} />
              <span>New Block</span>
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
                placeholder="Search blocks..."
                autoFocus
                className="w-full pl-10 pr-10 py-2 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 transition"
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

      {/* Table Container - matching TemplatesManager style */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredBlocks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center p-8 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700/50 rounded-xl">
            <div className="p-4 rounded-full bg-slate-100 dark:bg-navy-800 inline-block mb-4">
              <Blocks size={28} className="text-slate-500" />
            </div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {searchQuery ? 'No blocks match your search' : 'No blocks found'}
            </p>
            <p className="text-xs text-slate-500">
              {searchQuery
                ? 'Try adjusting your search terms'
                : 'Create a new block to get started'}
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
                          ? 'bg-primary-500 border-primary-500 text-white'
                          : someSelected
                            ? 'bg-primary-500/50 border-primary-500 text-white'
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
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-[90px]">
                    Type
                  </th>

                  {/* Indicator */}
                  <th className="w-8 px-1 py-2"></th>

                  {/* Block Name */}
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Block
                  </th>

                  {/* Category */}
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-[100px]">
                    Category
                  </th>

                  {/* Render */}
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-[100px]">
                    Render
                  </th>

                  {/* Sources */}
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-[200px]">
                    Sources
                  </th>

                  {/* Updated */}
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-[100px]">
                    Updated
                  </th>

                  {/* Actions */}
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wider w-[100px]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {filteredBlocks.map((block) => {
                    const typeConfig = getTypeBadgeConfig(Boolean(block.isSystem));
                    const categoryConfig = getCategoryBadgeConfig(block.category);
                    const renderConfig = getRenderBadgeConfig(block.renderKind);
                    const TypeIcon = typeConfig.icon;

                    return (
                      <motion.tr
                        key={block.id}
                        variants={rowVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        whileHover="hover"
                        className={`
                          group cursor-pointer border-b border-slate-200 dark:border-navy-700/50
                          ${selectedIds.has(block.id) ? 'bg-primary-50 dark:bg-primary-500/10' : ''}
                          transition-colors duration-150
                          hover:bg-slate-50 dark:hover:bg-navy-800/50
                        `}
                      >
                        {/* Checkbox */}
                        <td className="w-10 px-2 py-2.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSelect(block.id);
                            }}
                            className={`w-5 h-5 rounded border flex items-center justify-center transition ${
                              selectedIds.has(block.id)
                                ? 'bg-primary-500 border-primary-500 text-white'
                                : 'border-slate-300 dark:border-navy-500 hover:border-primary-400'
                            }`}
                          >
                            {selectedIds.has(block.id) && <CheckSquare size={12} />}
                          </button>
                        </td>

                        {/* Type Badge */}
                        <td className="px-3 py-2.5 w-[90px]">
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
                            title={block.isSystem ? 'System block' : 'Organization block'}
                          />
                        </td>

                        {/* Block Name */}
                        <td className="px-3 py-2.5" style={{ minWidth: 200 }}>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-slate-900 dark:text-white">
                              {block.name}
                            </span>
                            {block.description && (
                              <span className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                                {block.description}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Category */}
                        <td className="px-3 py-2.5 w-[100px]">
                          <span
                            className={`inline-flex px-2 py-1 rounded text-xs font-medium ${categoryConfig.bg} ${categoryConfig.color}`}
                          >
                            {categoryConfig.label}
                          </span>
                        </td>

                        {/* Render Kind */}
                        <td className="px-3 py-2.5 w-[100px]">
                          <span
                            className={`inline-flex px-2 py-1 rounded text-xs font-medium ${renderConfig.bg} ${renderConfig.color}`}
                          >
                            {block.renderKind}
                          </span>
                        </td>

                        {/* Sources */}
                        <td className="px-3 py-2.5 w-[200px]">
                          <div className="flex flex-wrap gap-1">
                            {(block.sourceTypes || []).map((st) => {
                              const srcColor =
                                st === 'ASSESSMENT'
                                  ? 'text-blue-400 bg-blue-500/20'
                                  : st === 'INTERVIEW'
                                    ? 'text-emerald-400 bg-emerald-500/20'
                                    : st === 'TOOL'
                                      ? 'text-amber-400 bg-amber-500/20'
                                      : 'text-pink-400 bg-pink-500/20';
                              return (
                                <span
                                  key={st}
                                  className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${srcColor}`}
                                >
                                  {st}
                                </span>
                              );
                            })}
                          </div>
                        </td>

                        {/* Updated */}
                        <td className="px-3 py-2.5 w-[100px]">
                          <div className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400">
                            <Calendar size={12} className="text-slate-600 dark:text-slate-500" />
                            {formatDate(block.updatedAt || block.createdAt)}
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="px-3 py-2.5 w-[100px]">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openEdit(block);
                              }}
                              className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-navy-600 text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                              title="Edit"
                            >
                              <Edit3 size={15} />
                            </button>
                            {!block.isSystem && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deactivate(block);
                                }}
                                className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-navy-600 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                                title="Deactivate"
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                            {block.isSystem && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // TODO: duplicate to org
                                }}
                                className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-navy-600 text-slate-500 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                                title="Duplicate to organization"
                              >
                                <Copy size={15} />
                              </button>
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

      {/* Edit/Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-navy-900 rounded-xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
              <h3 className="font-semibold text-slate-900 dark:text-white">
                {editing ? 'Edit Block' : 'New Block'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-navy-700 text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Name
                  </label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-800 text-slate-900 dark:text-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500/20 transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Render Kind
                  </label>
                  <select
                    value={renderKind}
                    onChange={(e) => setRenderKind(e.target.value as BlockRenderKind)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-800 text-slate-900 dark:text-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500/20 transition"
                  >
                    <option value="markdown">markdown</option>
                    <option value="callout">callout</option>
                    <option value="table">table</option>
                    <option value="chart">chart</option>
                    <option value="matrix">matrix</option>
                    <option value="json">json</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Description
                </label>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-800 text-slate-900 dark:text-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500/20 transition"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Sources (CSV)
                  </label>
                  <input
                    value={sourceTypesText}
                    onChange={(e) => setSourceTypesText(e.target.value)}
                    placeholder="ASSESSMENT, TOOL"
                    className="w-full px-3 py-2 border border-slate-200 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-800 text-slate-900 dark:text-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500/20 transition"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Length
                    </label>
                    <select
                      value={defaultLength}
                      onChange={(e) => setDefaultLength(e.target.value as SectionLength)}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-800 text-slate-900 dark:text-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500/20 transition"
                    >
                      <option value="short">Short</option>
                      <option value="medium">Medium</option>
                      <option value="long">Long</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Style
                    </label>
                    <select
                      value={defaultLanguage}
                      onChange={(e) => setDefaultLanguage(e.target.value as SectionLanguage)}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-800 text-slate-900 dark:text-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500/20 transition"
                    >
                      <option value="business">Business</option>
                      <option value="technical">Technical</option>
                      <option value="general">General</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Prompt Template
                </label>
                <textarea
                  value={promptTemplate}
                  onChange={(e) => setPromptTemplate(e.target.value)}
                  rows={6}
                  placeholder='E.g. "Write a section about ... using data: {{facts}}"'
                  className="w-full px-3 py-2 border border-slate-200 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-800 text-slate-900 dark:text-white font-mono text-xs focus:border-primary-500 focus:ring-1 focus:ring-primary-500/20 transition"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={!name.trim()}
                className="px-4 py-2 text-sm font-medium bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-lg hover:brightness-110 shadow-lg shadow-primary-500/25 disabled:opacity-50 transition"
              >
                {editing ? 'Save Changes' : 'Create Block'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BlockTypesManager;
