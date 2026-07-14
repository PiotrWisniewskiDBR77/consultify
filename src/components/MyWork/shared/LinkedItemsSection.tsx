/**
 * LinkedItemsSection
 * Shared component for displaying linked items (tasks, decisions, risks, etc.)
 * ClickUp-style design following Golden Standard
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileText,
  Flag,
  Link as LinkIcon,
  Loader2,
  Plus,
  Scale,
  Search,
  Target,
  Trash2,
  X,
} from 'lucide-react';
import React, { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

export type LinkedItemType =
  | 'task'
  | 'decision'
  | 'risk'
  | 'initiative'
  | 'project'
  | 'assessment'
  | 'report'
  | 'tool'
  | 'insight'
  | 'external';

export type LinkRelationType =
  | 'related'
  | 'blocks'
  | 'depends_on'
  | 'parent_of'
  | 'informs'
  | 'duplicates';

export interface LinkedItem {
  id: string;
  type: LinkedItemType;
  title: string;
  status?: string;
  priority?: string;
  url?: string;
  externalUrl?: string;
  comment?: string;
  linkRelation?: LinkRelationType;
  linkDirection?: 'outgoing' | 'incoming';
}

interface LinkedItemsSectionProps {
  items: LinkedItem[];
  onAdd?: (item: LinkedItem) => Promise<void>;
  onRemove: (itemId: string) => Promise<void>;
  onNavigate?: (item: LinkedItem) => void;
  searchItems?: (query: string, type?: LinkedItemType) => Promise<LinkedItem[]>;
  readOnly?: boolean;
  allowedTypes?: LinkedItemType[];
  expanded?: boolean;
  onToggleExpand?: () => void;
}

export const LinkedItemsSection: React.FC<LinkedItemsSectionProps> = ({
  items,
  onAdd,
  onRemove,
  onNavigate,
  searchItems,
  readOnly = false,
  allowedTypes = ['task', 'decision', 'risk', 'initiative'],
  expanded = false,
  onToggleExpand,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const [isAddingLink, setIsAddingLink] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LinkedItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedType, setSelectedType] = useState<LinkedItemType | 'all'>('all');
  const [isAddingExternal, setIsAddingExternal] = useState(false);
  const [externalUrl, setExternalUrl] = useState('');
  const [externalTitle, setExternalTitle] = useState('');

  const getTypeIcon = (type: LinkedItemType, size: number = 16) => {
    switch (type) {
      case 'task':
        return <CheckSquare size={size} className="text-blue-400" />;
      case 'decision':
        return <Scale size={size} className="text-primary-400" />;
      case 'risk':
        return <AlertTriangle size={size} className="text-amber-400" />;
      case 'initiative':
        return <Target size={size} className="text-emerald-400" />;
      case 'project':
        return <Flag size={size} className="text-indigo-400" />;
      case 'assessment':
        return <FileText size={size} className="text-blue-400" />;
      case 'report':
        return <FileText size={size} className="text-primary-400" />;
      case 'tool':
        return <Flag size={size} className="text-fuchsia-400" />;
      case 'insight':
        return <AlertTriangle size={size} className="text-blue-400" />;
      case 'external':
        return <ExternalLink size={size} className="text-slate-500 dark:text-slate-400" />;
      default:
        return <LinkIcon size={size} className="text-slate-500 dark:text-slate-400" />;
    }
  };

  const getTypeLabel = (type: LinkedItemType) => {
    const labels: Record<LinkedItemType, { en: string; pl: string }> = {
      task: { en: 'Task', pl: 'Zadanie' },
      decision: { en: 'Decision', pl: 'Decyzja' },
      risk: { en: 'Risk', pl: 'Ryzyko' },
      initiative: { en: 'Initiative', pl: 'Inicjatywa' },
      project: { en: 'Project', pl: 'Projekt' },
      assessment: { en: 'Assessment', pl: 'Ocena' },
      report: { en: 'Report', pl: 'Raport' },
      tool: { en: 'Tool', pl: 'Narzędzie' },
      insight: { en: 'Insight', pl: 'Insight' },
      external: { en: 'External Link', pl: 'Link zewnętrzny' },
    };
    return isPolish ? labels[type].pl : labels[type].en;
  };

  const getStatusColor = (status?: string) => {
    if (!status) return 'bg-slate-500/20 text-slate-500 dark:text-slate-400';

    const statusLower = status.toLowerCase();
    if (['done', 'completed', 'approved', 'closed', 'mitigated'].includes(statusLower)) {
      return 'bg-emerald-500/20 text-emerald-400';
    }
    if (['in_progress', 'active', 'open'].includes(statusLower)) {
      return 'bg-blue-500/20 text-blue-400';
    }
    if (['blocked', 'rejected', 'critical'].includes(statusLower)) {
      return 'bg-danger-500/20 text-danger-400';
    }
    if (['pending', 'review', 'deferred'].includes(statusLower)) {
      return 'bg-amber-500/20 text-amber-400';
    }
    return 'bg-slate-500/20 text-slate-500 dark:text-slate-400';
  };

  const handleSearch = useCallback(
    async (query: string) => {
      if (!searchItems || query.length < 2) {
        setSearchResults([]);
        return;
      }

      try {
        setSearching(true);
        const typeFilter = selectedType === 'all' ? undefined : selectedType;
        const results = await searchItems(query, typeFilter);
        // Filter out already linked items
        const filtered = results.filter((r) => !items.some((i) => i.id === r.id));
        setSearchResults(filtered);
      } catch (error) {
        console.error('Search failed', error);
      } finally {
        setSearching(false);
      }
    },
    [searchItems, selectedType, items]
  );

  const handleAddItem = useCallback(
    async (item: LinkedItem) => {
      if (!onAdd) return;

      try {
        await onAdd(item);
        setSearchQuery('');
        setSearchResults([]);
        setIsAddingLink(false);
        toast.success(t('myWork.linkedItems.toastSuccess', 'Link added'));
      } catch (error) {
        toast.error(t('myWork.linkedItems.toastError', 'Failed to add link'));
      }
    },
    [onAdd, isPolish]
  );

  const handleRemoveItem = useCallback(
    async (itemId: string) => {
      if (
        !confirm(
          t('myWork.linkedItems.areYouSureYou', 'Are you sure you want to remove this link?')
        )
      ) {
        return;
      }

      try {
        await onRemove(itemId);
        toast.success(t('myWork.linkedItems.toastSuccess2', 'Link removed'));
      } catch (error) {
        toast.error(t('myWork.linkedItems.toastError2', 'Failed to remove link'));
      }
    },
    [onRemove, isPolish]
  );

  const handleAddExternalLink = useCallback(async () => {
    if (!externalUrl.trim() || !externalTitle.trim() || !onAdd) return;

    // Validate URL format
    try {
      new URL(externalUrl);
    } catch {
      toast.error(t('myWork.linkedItems.toastError3', 'Invalid URL format'));
      return;
    }

    const externalItem: LinkedItem = {
      id: `external-${Date.now()}`,
      type: 'external',
      title: externalTitle.trim(),
      externalUrl: externalUrl.trim(),
      url: externalUrl.trim(),
    };

    try {
      await onAdd(externalItem);
      setExternalUrl('');
      setExternalTitle('');
      setIsAddingExternal(false);
      toast.success(t('myWork.linkedItems.toastSuccess3', 'External link added'));
    } catch (error) {
      toast.error(t('myWork.linkedItems.toastError4', 'Failed to add link'));
    }
  }, [externalUrl, externalTitle, onAdd, isPolish]);

  // Group items by type
  const groupedItems = items.reduce(
    (acc, item) => {
      if (!acc[item.type]) {
        acc[item.type] = [];
      }
      acc[item.type].push(item);
      return acc;
    },
    {} as Record<LinkedItemType, LinkedItem[]>
  );

  return (
    <div className="bg-white/80 dark:bg-navy-900/80 backdrop-blur-xl rounded-2xl border border-slate-200 dark:border-navy-700/50 shadow-md hover:shadow-lg transition-shadow duration-300 overflow-hidden">
      {/* Collapsible Header */}
      <motion.button
        whileHover={{ backgroundColor: 'rgba(148, 163, 184, 0.1)' }}
        whileTap={{ scale: 0.98 }}
        onClick={onToggleExpand}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/80 dark:hover:bg-navy-800/50 transition-colors duration-200"
      >
        <div className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
          <div className="p-2 rounded-xl bg-primary-500/10 dark:bg-primary-500/20">
            <LinkIcon size={18} className="text-primary-500 dark:text-primary-400" />
          </div>
          <span className="text-sm font-semibold">{t('myWork.linkedItems.linkedItems', 'Linked Items')}</span>
        </div>
        <div className="flex items-center gap-2">
          {items.length > 0 && (
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 dark:text-slate-500">
              {items.length}
            </span>
          )}
          <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown size={18} className="text-slate-500 dark:text-slate-400" />
          </motion.div>
        </div>
      </motion.button>

      {/* Collapsible Content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="border-t border-slate-200 dark:border-navy-700 overflow-hidden"
          >
            <div className="p-4">
              {/* Add Link Panel */}
              <AnimatePresence>
                {isAddingLink && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-4 overflow-hidden"
                  >
                    <div className="bg-slate-50 dark:bg-navy-800 rounded-lg p-3 border border-slate-200 dark:border-navy-600">
                      {/* Type Filter */}
                      <div className="flex gap-2 mb-3 flex-wrap">
                        <button
                          onClick={() => setSelectedType('all')}
                          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                            selectedType === 'all'
                              ? 'bg-navy-900 text-white'
                              : 'bg-slate-200 dark:bg-navy-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-navy-600'
                          }`}
                        >
                          {t('myWork.linkedItems.all', 'All')}
                        </button>
                        {allowedTypes.map((type) => (
                          <button
                            key={type}
                            onClick={() => setSelectedType(type)}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                              selectedType === type
                                ? 'bg-navy-900 text-white'
                                : 'bg-slate-200 dark:bg-navy-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-navy-600'
                            }`}
                          >
                            {getTypeIcon(type, 12)}
                            <span>{getTypeLabel(type)}</span>
                          </button>
                        ))}
                      </div>

                      {/* Search Input */}
                      <div className="relative">
                        <Search
                          size={16}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400"
                        />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => {
                            setSearchQuery(e.target.value);
                            handleSearch(e.target.value);
                          }}
                          placeholder={t('myWork.linkedItems.placeholder', 'Search items...')}
                          className="w-full pl-10 pr-4 py-2 rounded-lg text-sm bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-600 text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-primary-500 outline-none"
                          autoFocus
                        />
                        {searching && (
                          <Loader2
                            size={16}
                            className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-500 dark:text-slate-400"
                          />
                        )}
                      </div>

                      {/* Search Results */}
                      {searchResults.length > 0 && (
                        <div className="mt-3 max-h-48 overflow-y-auto space-y-1">
                          {searchResults.map((result) => (
                            <button
                              key={result.id}
                              onClick={() => handleAddItem(result)}
                              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors text-left"
                            >
                              {getTypeIcon(result.type)}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-800 dark:text-white truncate">
                                  {result.title}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  {getTypeLabel(result.type)}
                                </p>
                              </div>
                              <Plus size={16} className="text-slate-500 dark:text-slate-400" />
                            </button>
                          ))}
                        </div>
                      )}

                      {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
                        <p className="mt-3 text-center text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500">
                          {t('myWork.linkedItems.noResultsFound', 'No results found')}
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* Add External Link Panel */}
                {isAddingExternal && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-4 overflow-hidden"
                  >
                    <div className="bg-slate-50 dark:bg-navy-800 rounded-lg p-3 border border-slate-200 dark:border-navy-600">
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                            {t('myWork.linkedItems.linkTitle', 'Link Title')}
                          </label>
                          <input
                            type="text"
                            value={externalTitle}
                            onChange={(e) => setExternalTitle(e.target.value)}
                            placeholder={
                              t('myWork.linkedItems.eGProjectDocumentation', 'e.g., Project documentation')
                            }
                            className="w-full px-3 py-2 rounded-lg text-sm bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-600 text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-primary-500 outline-none"
                            autoFocus
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                            {t('myWork.linkedItems.uRL', 'URL')}
                          </label>
                          <input
                            type="url"
                            value={externalUrl}
                            onChange={(e) => setExternalUrl(e.target.value)}
                            placeholder={t('myWork.linkedItems.placeholder2', 'https://example.com')}
                            className="w-full px-3 py-2 rounded-lg text-sm bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-600 text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-primary-500 outline-none"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleAddExternalLink}
                            disabled={!externalUrl.trim() || !externalTitle.trim()}
                            className="flex-1 px-3 py-2 rounded-lg text-sm font-medium bg-c-text text-c-bg hover:bg-c-text-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {t('myWork.linkedItems.addLink', 'Add Link')}
                          </button>
                          <button
                            onClick={() => {
                              setIsAddingExternal(false);
                              setExternalUrl('');
                              setExternalTitle('');
                            }}
                            className="px-3 py-2 rounded-lg text-sm font-medium bg-slate-200 dark:bg-navy-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-navy-600 transition-colors"
                          >
                            {t('myWork.linkedItems.cancel', 'Cancel')}
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Items List */}
              {items.length === 0 ? (
                <div className="text-center py-6 text-slate-500 dark:text-slate-400 dark:text-slate-500">
                  <LinkIcon size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">{t('myWork.linkedItems.noLinkedItems', 'No linked items')}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(groupedItems).map(([type, typeItems]) => (
                    <div key={type}>
                      {/* Type Header */}
                      <div className="flex items-center gap-2 mb-2">
                        {getTypeIcon(type as LinkedItemType)}
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          {getTypeLabel(type as LinkedItemType)}s ({typeItems.length})
                        </span>
                      </div>

                      {/* Items */}
                      <div className="space-y-1">
                        {typeItems.map((item) => (
                          <motion.div
                            key={item.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="group flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 hover:border-primary-300 dark:hover:border-primary-500/50 transition-all"
                          >
                            {/* Title */}
                            <button
                              onClick={() => onNavigate?.(item)}
                              className="flex-1 min-w-0 text-left flex items-center gap-2"
                            >
                              <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                                {item.title}
                              </span>
                              <ChevronRight
                                size={14}
                                className="flex-shrink-0 text-slate-500 dark:text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity"
                              />
                            </button>

                            {/* Status Badge */}
                            {item.status && (
                              <span
                                className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                                  item.status
                                )}`}
                              >
                                {item.status}
                              </span>
                            )}

                            {/* Actions */}
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {(item.url || item.externalUrl) && (
                                <a
                                  href={item.externalUrl || item.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-navy-600 transition-colors"
                                  title={t('myWork.linkedItems.title', 'Open in new tab')}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <ExternalLink
                                    size={14}
                                    className="text-slate-500 dark:text-slate-400"
                                  />
                                </a>
                              )}
                              {!readOnly && (
                                <button
                                  onClick={() => handleRemoveItem(item.id)}
                                  className="p-1.5 rounded hover:bg-danger-50 dark:hover:bg-danger-500/20 transition-colors"
                                  title={t('myWork.linkedItems.title2', 'Remove link')}
                                >
                                  <Trash2
                                    size={14}
                                    className="text-slate-500 dark:text-slate-400 hover:text-danger-500"
                                  />
                                </button>
                              )}
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LinkedItemsSection;
