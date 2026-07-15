/**
 * Bulk Operations Toolbar
 *
 * Provides multi-select, copy-paste, and batch update functionality
 * for assessment editors (DRD, SIRI, ADMA).
 */

import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  CheckSquare,
  Clipboard,
  ClipboardCopy,
  Copy,
  Edit3,
  Minus,
  Plus,
  RefreshCw,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

// ============================================
// TYPES
// ============================================

export interface SelectableItem {
  id: string;
  name: string;
  namePL?: string;
  currentLevel: number;
  targetLevel?: number;
  category?: string;
  notes?: string;
}

export interface BulkUpdatePayload {
  itemIds: string[];
  updates: {
    currentLevel?: number;
    targetLevel?: number;
    notes?: string;
    levelDelta?: number; // For relative changes (+1, -1)
  };
}

interface Props {
  items: SelectableItem[];
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onBulkUpdate: (payload: BulkUpdatePayload) => void;
  onCopy?: (items: SelectableItem[]) => void;
  onPaste?: () => void;
  clipboardHasData?: boolean;
  maxLevel?: number;
  minLevel?: number;
  readOnly?: boolean;
}

// ============================================
// MAIN COMPONENT
// ============================================

export const BulkOperationsToolbar: React.FC<Props> = ({
  items,
  selectedIds,
  onSelectionChange,
  onBulkUpdate,
  onCopy,
  onPaste,
  clipboardHasData = false,
  maxLevel = 5,
  minLevel = 1,
  readOnly = false,
}) => {
  const { t } = useTranslation();

  const [showBatchDialog, setShowBatchDialog] = useState(false);
  const [batchLevel, setBatchLevel] = useState<number>(3);
  const [batchTargetLevel, setBatchTargetLevel] = useState<number | null>(null);
  const [batchNotes, setBatchNotes] = useState<string>('');

  // Calculate selection stats
  const selectionStats = useMemo(() => {
    const selectedItems = items.filter((item) => selectedIds.has(item.id));
    if (selectedItems.length === 0) {
      return { count: 0, avgLevel: 0, minLevel: 0, maxLevel: 0, categories: [] };
    }

    const levels = selectedItems.map((i) => i.currentLevel);
    const categories = [...new Set(selectedItems.map((i) => i.category).filter(Boolean))];

    return {
      count: selectedItems.length,
      avgLevel: Math.round((levels.reduce((a, b) => a + b, 0) / levels.length) * 10) / 10,
      minLevel: Math.min(...levels),
      maxLevel: Math.max(...levels),
      categories: categories as string[],
    };
  }, [items, selectedIds]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (readOnly) return;

      // Ctrl/Cmd + A: Select all
      if ((e.ctrlKey || e.metaKey) && e.key === 'a' && !e.shiftKey) {
        e.preventDefault();
        onSelectionChange(new Set(items.map((i) => i.id)));
      }

      // Ctrl/Cmd + C: Copy
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && selectedIds.size > 0 && onCopy) {
        e.preventDefault();
        const selectedItems = items.filter((i) => selectedIds.has(i.id));
        onCopy(selectedItems);
      }

      // Ctrl/Cmd + V: Paste
      if ((e.ctrlKey || e.metaKey) && e.key === 'v' && clipboardHasData && onPaste) {
        e.preventDefault();
        onPaste();
      }

      // Escape: Clear selection
      if (e.key === 'Escape') {
        onSelectionChange(new Set());
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [items, selectedIds, onSelectionChange, onCopy, onPaste, clipboardHasData, readOnly]);

  // Handlers
  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === items.length) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(items.map((i) => i.id)));
    }
  }, [items, selectedIds, onSelectionChange]);

  const handleClearSelection = useCallback(() => {
    onSelectionChange(new Set());
  }, [onSelectionChange]);

  const handleIncrementLevel = useCallback(() => {
    if (selectedIds.size === 0) return;
    onBulkUpdate({
      itemIds: Array.from(selectedIds),
      updates: { levelDelta: 1 },
    });
  }, [selectedIds, onBulkUpdate]);

  const handleDecrementLevel = useCallback(() => {
    if (selectedIds.size === 0) return;
    onBulkUpdate({
      itemIds: Array.from(selectedIds),
      updates: { levelDelta: -1 },
    });
  }, [selectedIds, onBulkUpdate]);

  const handleSetLevel = useCallback(
    (level: number) => {
      if (selectedIds.size === 0) return;
      onBulkUpdate({
        itemIds: Array.from(selectedIds),
        updates: { currentLevel: level },
      });
    },
    [selectedIds, onBulkUpdate]
  );

  const handleBatchApply = useCallback(() => {
    if (selectedIds.size === 0) return;

    const updates: BulkUpdatePayload['updates'] = {};
    if (batchLevel) updates.currentLevel = batchLevel;
    if (batchTargetLevel) updates.targetLevel = batchTargetLevel;
    if (batchNotes) updates.notes = batchNotes;

    onBulkUpdate({
      itemIds: Array.from(selectedIds),
      updates,
    });

    setShowBatchDialog(false);
  }, [selectedIds, batchLevel, batchTargetLevel, batchNotes, onBulkUpdate]);

  const handleCopy = useCallback(() => {
    if (selectedIds.size === 0 || !onCopy) return;
    const selectedItems = items.filter((i) => selectedIds.has(i.id));
    onCopy(selectedItems);
  }, [items, selectedIds, onCopy]);

  const hasSelection = selectedIds.size > 0;
  const allSelected = selectedIds.size === items.length && items.length > 0;

  if (items.length === 0) return null;

  return (
    <>
      <div className="bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg p-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          {/* Selection Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleSelectAll}
              className={`p-2 rounded-lg transition-colors ${
                allSelected
                  ? 'bg-blue-500 text-white'
                  : 'bg-white dark:bg-navy-950 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-900'
              }`}
              title={t('assessment.bulk.selectAll', 'Select all (Ctrl+A)')}
            >
              {allSelected ? <CheckSquare size={18} /> : <Square size={18} />}
            </button>

            {hasSelection && (
              <>
                <div className="h-6 w-px bg-slate-300 dark:bg-navy-600" />
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  {selectionStats.count} {t('assessment.bulk.selected', 'selected')}
                </span>
                <button
                  onClick={handleClearSelection}
                  className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded"
                  title={t('assessment.bulk.clearSelection', 'Clear selection (Esc)')}
                >
                  <X size={16} />
                </button>
              </>
            )}
          </div>

          {/* Action Buttons */}
          {hasSelection && !readOnly && (
            <div className="flex items-center gap-2">
              {/* Quick Level Adjustments */}
              <div className="flex items-center bg-white dark:bg-navy-950 rounded-lg border border-slate-200 dark:border-navy-700">
                <button
                  onClick={handleDecrementLevel}
                  disabled={selectionStats.minLevel <= minLevel}
                  className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-900 rounded-l-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  title={t('assessment.bulk.decreaseLevel', 'Decrease level (-1)')}
                >
                  <Minus size={16} />
                </button>
                <span className="px-3 text-sm font-medium text-navy-900 dark:text-white border-x border-slate-200 dark:border-navy-700">
                  {selectionStats.avgLevel}
                </span>
                <button
                  onClick={handleIncrementLevel}
                  disabled={selectionStats.maxLevel >= maxLevel}
                  className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-900 rounded-r-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  title={t('assessment.bulk.increaseLevel', 'Increase level (+1)')}
                >
                  <Plus size={16} />
                </button>
              </div>

              {/* Quick Set Level */}
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].slice(0, maxLevel).map((level) => (
                  <button
                    key={level}
                    onClick={() => handleSetLevel(level)}
                    className={`w-8 h-8 rounded text-sm font-medium transition-colors ${
                      selectionStats.avgLevel === level
                        ? 'bg-blue-500 text-white'
                        : 'bg-white dark:bg-navy-950 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-900 border border-slate-200 dark:border-navy-700'
                    }`}
                    title={`${t('assessment.bulk.setLevel', 'Set level')} ${level}`}
                  >
                    {level}
                  </button>
                ))}
              </div>

              <div className="h-6 w-px bg-slate-300 dark:bg-navy-600" />

              {/* Copy/Paste */}
              {onCopy && (
                <button
                  onClick={handleCopy}
                  className="p-2 bg-white dark:bg-navy-950 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-900 rounded-lg border border-slate-200 dark:border-navy-700"
                  title={t('assessment.bulk.copy', 'Copy (Ctrl+C)')}
                >
                  <Copy size={16} />
                </button>
              )}

              {onPaste && (
                <button
                  onClick={onPaste}
                  disabled={!clipboardHasData}
                  className="p-2 bg-white dark:bg-navy-950 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-900 rounded-lg border border-slate-200 dark:border-navy-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={t('assessment.bulk.paste', 'Paste (Ctrl+V)')}
                >
                  <Clipboard size={16} />
                </button>
              )}

              <div className="h-6 w-px bg-slate-300 dark:bg-navy-600" />

              {/* Batch Edit */}
              <button
                onClick={() => setShowBatchDialog(true)}
                className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2 text-sm"
              >
                <Edit3 size={16} />
                {t('assessment.bulk.batchEdit', 'Batch Edit')}
              </button>
            </div>
          )}

          {/* Selection Stats */}
          {hasSelection && (
            <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
              <span>
                {t('assessment.bulk.avgLevel', 'Avg level:')} {selectionStats.avgLevel}
              </span>
              <span>
                {t('assessment.bulk.range', 'Range:')} {selectionStats.minLevel}-
                {selectionStats.maxLevel}
              </span>
              {selectionStats.categories.length > 0 && (
                <span>
                  {t('assessment.bulk.categories', 'Categories:')}{' '}
                  {selectionStats.categories.length}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Batch Edit Dialog */}
      {showBatchDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-navy-900 rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="p-4 border-b border-slate-200 dark:border-navy-700">
              <h3 className="text-lg font-bold text-navy-900 dark:text-white">
                {t('assessment.bulk.batchEdit', 'Batch Edit')}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t('assessment.bulk.editSelectedItems', 'Edit {{count}} selected items', {
                  count: selectionStats.count,
                })}
              </p>
            </div>

            <div className="p-4 space-y-4">
              {/* Current Level */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  {t('assessment.bulk.currentLevel', 'Current Level')}
                </label>
                <div className="flex gap-2">
                  {Array.from({ length: maxLevel }, (_, i) => i + minLevel).map((level) => (
                    <button
                      key={level}
                      onClick={() => setBatchLevel(level)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                        batchLevel === level
                          ? 'bg-blue-500 text-white'
                          : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-navy-700'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              {/* Target Level */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  {t('assessment.bulk.targetLevelOptional', 'Target Level (optional)')}
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setBatchTargetLevel(null)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      batchTargetLevel === null
                        ? 'bg-slate-500 text-white'
                        : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-navy-700'
                    }`}
                  >
                    {t('assessment.bulk.none', 'None')}
                  </button>
                  {Array.from({ length: maxLevel }, (_, i) => i + minLevel).map((level) => (
                    <button
                      key={level}
                      onClick={() => setBatchTargetLevel(level)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                        batchTargetLevel === level
                          ? 'bg-green-500 text-white'
                          : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-navy-700'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  {t('assessment.bulk.notesAppend', 'Notes (append to existing)')}
                </label>
                <textarea
                  value={batchNotes}
                  onChange={(e) => setBatchNotes(e.target.value)}
                  placeholder={t('assessment.bulk.notesPlaceholder', 'Additional notes...')}
                  className="w-full h-24 p-3 border border-slate-200 dark:border-navy-700 rounded-lg bg-white dark:bg-navy-950 text-navy-900 dark:text-white resize-none"
                />
              </div>

              {/* Warning */}
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-500/30 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5" />
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    {t(
                      'assessment.bulk.warningMessage',
                      'This will update all selected items. This action cannot be undone.'
                    )}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-navy-700 flex justify-end gap-3">
              <button
                onClick={() => setShowBatchDialog(false)}
                className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-lg transition-colors"
              >
                {t('assessment.bulk.cancel', 'Cancel')}
              </button>
              <button
                onClick={handleBatchApply}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
              >
                <Check size={16} />
                {t('assessment.bulk.apply', 'Apply')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// ============================================
// CLIPBOARD HOOK
// ============================================

export interface ClipboardData {
  type: 'assessment-items';
  framework: string;
  items: SelectableItem[];
  timestamp: string;
}

export function useAssessmentClipboard() {
  const [clipboardData, setClipboardData] = useState<ClipboardData | null>(null);

  const copy = useCallback((items: SelectableItem[], framework: string) => {
    const data: ClipboardData = {
      type: 'assessment-items',
      framework,
      items,
      timestamp: new Date().toISOString(),
    };
    setClipboardData(data);

    // Also copy to system clipboard as JSON
    try {
      navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    } catch (e) {
      console.warn('Failed to copy to system clipboard:', e);
    }
  }, []);

  const paste = useCallback(async (): Promise<ClipboardData | null> => {
    // First try internal clipboard
    if (clipboardData) {
      return clipboardData;
    }

    // Try system clipboard
    try {
      const text = await navigator.clipboard.readText();
      const data = JSON.parse(text);
      if (data.type === 'assessment-items') {
        return data as ClipboardData;
      }
    } catch (e) {
      console.warn('Failed to read from system clipboard:', e);
    }

    return null;
  }, [clipboardData]);

  const clear = useCallback(() => {
    setClipboardData(null);
  }, []);

  return {
    clipboardData,
    hasData: clipboardData !== null,
    copy,
    paste,
    clear,
  };
}

export default BulkOperationsToolbar;
