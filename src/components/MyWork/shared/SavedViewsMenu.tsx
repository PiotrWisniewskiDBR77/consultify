/**
 * SavedViewsMenu - Save/load task view presets (localStorage)
 * Persists: column widths, active filter, table column filters, smart sort, visible columns
 */

import { AnimatePresence, motion } from 'framer-motion';
import { Bookmark, Check, ChevronDown, Plus, Trash2, X } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { trackFunnelEvent } from '@/services/funnelAnalytics';

export interface TaskViewPreset {
  id: string;
  name: string;
  columnWidths?: Record<string, number>;
  activeFilter?: string;
  tableFilters?: Record<string, string[] | undefined>;
  smartSort?: boolean;
  hiddenColumns?: string[];
  createdAt: number;
}

const STORAGE_KEY = 'consultify-task-view-presets';

function loadPresets(): TaskViewPreset[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function savePresets(presets: TaskViewPreset[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
}

interface SavedViewsMenuProps {
  currentState: Omit<TaskViewPreset, 'id' | 'name' | 'createdAt'>;
  onApplyPreset: (preset: TaskViewPreset) => void;
}

export const SavedViewsMenu: React.FC<SavedViewsMenuProps> = ({ currentState, onApplyPreset }) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [presets, setPresets] = useState<TaskViewPreset[]>(loadPresets);
  const [isNaming, setIsNaming] = useState(false);
  const [newName, setNewName] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsNaming(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    if (isNaming) inputRef.current?.focus();
  }, [isNaming]);

  const handleSave = useCallback(() => {
    const name = newName.trim();
    if (!name) return;
    const preset: TaskViewPreset = {
      id: `view_${Date.now()}`,
      name,
      ...currentState,
      createdAt: Date.now(),
    };
    const updated = [...presets, preset];
    setPresets(updated);
    savePresets(updated);
    setNewName('');
    setIsNaming(false);
    trackFunnelEvent('saved_view_created', { name });
    toast.success(t('myWork.savedViews.saved', 'View saved'));
  }, [newName, currentState, presets, t]);

  const handleDelete = useCallback(
    (presetId: string) => {
      const updated = presets.filter((p) => p.id !== presetId);
      setPresets(updated);
      savePresets(updated);
      toast.success(t('myWork.savedViews.deleted', 'View deleted'));
    },
    [presets, t]
  );

  const handleApply = useCallback(
    (preset: TaskViewPreset) => {
      onApplyPreset(preset);
      setIsOpen(false);
      trackFunnelEvent('saved_view_applied', { name: preset.name });
      toast.success(`${preset.name}`);
    },
    [onApplyPreset]
  );

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
          ${
            isOpen
              ? 'bg-primary-100 dark:bg-primary-500/15 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-500/30'
              : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-navy-700 hover:bg-slate-200 dark:hover:bg-navy-700'
          }
        `}
      >
        <Bookmark size={12} />
        {t('myWork.savedViews.label', 'Views')}
        <ChevronDown
          size={10}
          className={isOpen ? 'rotate-180 transition-transform' : 'transition-transform'}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute top-full left-0 mt-1 z-overlay w-64 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 rounded-xl shadow-xl overflow-hidden"
          >
            <div className="px-3 py-2 border-b border-slate-200 dark:border-navy-700 flex items-center justify-between">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {t('myWork.savedViews.title', 'Saved Views')}
              </p>
              <button
                onClick={() => {
                  setIsNaming(true);
                  setNewName('');
                }}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-navy-700 text-slate-500"
              >
                <Plus size={14} />
              </button>
            </div>

            {/* Save new */}
            {isNaming && (
              <div className="px-3 py-2 border-b border-slate-200 dark:border-navy-700">
                <div className="flex items-center gap-2">
                  <input
                    ref={inputRef}
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSave();
                      if (e.key === 'Escape') setIsNaming(false);
                    }}
                    placeholder={t('myWork.savedViews.namePlaceholder', 'View name…')}
                    className="flex-1 h-7 px-2 text-sm rounded-lg border border-slate-200 dark:border-navy-600 bg-white dark:bg-navy-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-c-focus"
                  />
                  <button
                    onClick={handleSave}
                    disabled={!newName.trim()}
                    className="h-7 px-2 rounded-lg text-xs font-medium bg-c-text text-c-bg hover:bg-c-text-secondary disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Check size={12} />
                  </button>
                  <button
                    onClick={() => setIsNaming(false)}
                    className="h-7 px-1 rounded-lg text-slate-600 hover:text-slate-600"
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>
            )}

            {/* Presets list */}
            <div className="max-h-48 overflow-y-auto">
              {presets.length === 0 ? (
                <div className="px-3 py-4 text-center text-xs text-slate-600 dark:text-slate-500">
                  {t('myWork.savedViews.empty', 'No saved views yet')}
                </div>
              ) : (
                presets.map((preset) => (
                  <div
                    key={preset.id}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 dark:hover:bg-navy-700 group"
                  >
                    <button
                      onClick={() => handleApply(preset)}
                      className="flex-1 text-left text-sm text-slate-700 dark:text-slate-200 truncate"
                    >
                      {preset.name}
                    </button>
                    <button
                      onClick={() => handleDelete(preset.id)}
                      className="p-1 rounded text-slate-600 hover:text-danger-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SavedViewsMenu;
