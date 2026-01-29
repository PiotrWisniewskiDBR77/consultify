/**
 * DependenciesSection
 * Task dependencies management - blocks and blocked by relationships
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  ChevronDown,
  ExternalLink,
  GitBranch,
  Link2,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface TaskDependency {
  id: string;
  taskId: string;
  taskTitle: string;
  taskStatus?: string;
  type: 'blocks' | 'blocked_by';
}

interface DependenciesSectionProps {
  dependencies: TaskDependency[];
  onAdd: (type: 'blocks' | 'blocked_by') => void;
  onRemove: (id: string) => void;
  onOpenTask?: (taskId: string) => void;
  searchTasks?: (query: string) => Promise<{ id: string; title: string; status: string }[]>;
  expanded?: boolean;
  onToggleExpand?: () => void;
  readOnly?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  todo: 'bg-slate-400',
  in_progress: 'bg-blue-500',
  review: 'bg-purple-500',
  done: 'bg-emerald-500',
  blocked: 'bg-red-500',
};

export const DependenciesSection: React.FC<DependenciesSectionProps> = ({
  dependencies,
  onAdd,
  onRemove,
  onOpenTask,
  searchTasks,
  expanded = false,
  onToggleExpand,
  readOnly = false,
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const [showAddModal, setShowAddModal] = useState<'blocks' | 'blocked_by' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<
    { id: string; title: string; status: string }[]
  >([]);
  const [isSearching, setIsSearching] = useState(false);

  const blocksDeps = dependencies.filter((d) => d.type === 'blocks');
  const blockedByDeps = dependencies.filter((d) => d.type === 'blocked_by');

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim() || !searchTasks) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const results = await searchTasks(query);
      setSearchResults(results);
    } catch (error) {
      console.error('Search failed', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectTask = (task: { id: string; title: string; status: string }) => {
    if (showAddModal) {
      // This would typically call an API to add the dependency
      // For now, we'll just close the modal
      setShowAddModal(null);
      setSearchQuery('');
      setSearchResults([]);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/80 dark:bg-navy-900/80 backdrop-blur-xl rounded-2xl border border-slate-200/50 dark:border-navy-700/50 shadow-md hover:shadow-lg transition-shadow duration-300 overflow-hidden"
    >
      {/* Collapsible Header */}
      <motion.button
        whileHover={{ backgroundColor: 'rgba(148, 163, 184, 0.1)' }}
        whileTap={{ scale: 0.98 }}
        onClick={onToggleExpand}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/80 dark:hover:bg-navy-800/50 transition-colors duration-200"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20">
            <GitBranch size={18} className="text-indigo-500 dark:text-indigo-400" />
          </div>
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            {isPolish ? 'Zależności' : 'Dependencies'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {dependencies.length > 0 && (
            <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
              {dependencies.length}
            </span>
          )}
          <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown size={18} className="text-slate-400" />
          </motion.div>
        </div>
      </motion.button>

      {/* Content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="border-t border-slate-200 dark:border-navy-700 overflow-hidden"
          >
            <div className="p-4 space-y-4">
              {/* Blocks Section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-orange-600 dark:text-orange-400">
                    <ArrowRight size={14} />
                    <span>{isPolish ? 'Blokuje' : 'Blocks'}</span>
                    <span className="text-slate-400">({blocksDeps.length})</span>
                  </div>
                  {!readOnly && (
                    <button
                      onClick={() => onAdd('blocks')}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-500/10 transition-colors"
                    >
                      <Plus size={12} />
                      {isPolish ? 'Dodaj' : 'Add'}
                    </button>
                  )}
                </div>
                {blocksDeps.length === 0 ? (
                  <div className="text-center py-3 border border-dashed border-slate-200 dark:border-navy-700 rounded-lg">
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      {isPolish ? 'Nie blokuje innych zadań' : 'Does not block other tasks'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {blocksDeps.map((dep) => (
                      <div
                        key={dep.id}
                        className="flex items-center justify-between px-3 py-2 rounded-lg bg-orange-50/50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/30 group"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div
                            className={`w-2 h-2 rounded-full ${STATUS_COLORS[dep.taskStatus || 'todo']}`}
                          />
                          <span className="text-sm text-slate-700 dark:text-slate-300 truncate">
                            {dep.taskTitle}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          {onOpenTask && (
                            <button
                              onClick={() => onOpenTask(dep.taskId)}
                              className="p-1 rounded hover:bg-orange-100 dark:hover:bg-orange-500/20 text-slate-400 hover:text-orange-600 transition-colors"
                            >
                              <ExternalLink size={14} />
                            </button>
                          )}
                          {!readOnly && (
                            <button
                              onClick={() => onRemove(dep.id)}
                              className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-500/20 text-slate-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Blocked By Section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-red-600 dark:text-red-400">
                    <Link2 size={14} />
                    <span>{isPolish ? 'Blokowane przez' : 'Blocked by'}</span>
                    <span className="text-slate-400">({blockedByDeps.length})</span>
                  </div>
                  {!readOnly && (
                    <button
                      onClick={() => onAdd('blocked_by')}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                    >
                      <Plus size={12} />
                      {isPolish ? 'Dodaj' : 'Add'}
                    </button>
                  )}
                </div>
                {blockedByDeps.length === 0 ? (
                  <div className="text-center py-3 border border-dashed border-slate-200 dark:border-navy-700 rounded-lg">
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      {isPolish
                        ? 'Nie jest blokowane przez inne zadania'
                        : 'Not blocked by other tasks'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {blockedByDeps.map((dep) => (
                      <div
                        key={dep.id}
                        className="flex items-center justify-between px-3 py-2 rounded-lg bg-red-50/50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 group"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div
                            className={`w-2 h-2 rounded-full ${STATUS_COLORS[dep.taskStatus || 'todo']}`}
                          />
                          <span className="text-sm text-slate-700 dark:text-slate-300 truncate">
                            {dep.taskTitle}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          {onOpenTask && (
                            <button
                              onClick={() => onOpenTask(dep.taskId)}
                              className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-500/20 text-slate-400 hover:text-red-600 transition-colors"
                            >
                              <ExternalLink size={14} />
                            </button>
                          )}
                          {!readOnly && (
                            <button
                              onClick={() => onRemove(dep.id)}
                              className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-500/20 text-slate-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Warning if blocked */}
              {blockedByDeps.length > 0 && blockedByDeps.some((d) => d.taskStatus !== 'done') && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30">
                  <div className="flex items-start gap-2 text-sm text-red-700 dark:text-red-400">
                    <Link2 size={14} className="mt-0.5" />
                    <span>
                      {isPolish
                        ? 'To zadanie jest blokowane przez nieukończone zadania'
                        : 'This task is blocked by incomplete tasks'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Dependency Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={() => setShowAddModal(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-navy-900 rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-navy-700">
                <h3 className="text-lg font-semibold text-slate-800 dark:text-white">
                  {showAddModal === 'blocks'
                    ? isPolish
                      ? 'Dodaj zadanie blokowane'
                      : 'Add blocked task'
                    : isPolish
                      ? 'Dodaj zadanie blokujące'
                      : 'Add blocking task'}
                </h3>
                <button
                  onClick={() => setShowAddModal(null)}
                  className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 text-slate-400"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-5">
                <div className="relative">
                  <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    placeholder={isPolish ? 'Szukaj zadania...' : 'Search tasks...'}
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm text-slate-700 dark:text-slate-300 placeholder-slate-400 focus:outline-none focus:border-indigo-400"
                    autoFocus
                  />
                </div>
                {searchResults.length > 0 && (
                  <div className="mt-3 max-h-60 overflow-y-auto space-y-1">
                    {searchResults.map((task) => (
                      <button
                        key={task.id}
                        onClick={() => handleSelectTask(task)}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors text-left"
                      >
                        <div
                          className={`w-2 h-2 rounded-full ${STATUS_COLORS[task.status || 'todo']}`}
                        />
                        <span className="text-sm text-slate-700 dark:text-slate-300">
                          {task.title}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {searchQuery && searchResults.length === 0 && !isSearching && (
                  <p className="mt-3 text-center text-sm text-slate-400">
                    {isPolish ? 'Nie znaleziono zadań' : 'No tasks found'}
                  </p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default DependenciesSection;
