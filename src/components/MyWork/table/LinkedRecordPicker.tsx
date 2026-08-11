/**
 * LinkedRecordPicker — Enhanced search-and-select for linked records.
 *
 * Features:
 * - Debounced search input with API call
 * - Results dropdown with primary + secondary fields
 * - Selected record chips with remove
 * - "Create new record" option
 * - Expand/preview popover on chip click
 * - Multi-select support
 * - Full keyboard navigation (arrows, enter, escape)
 */
import { ChevronRight, ExternalLink, Link2, Loader2, Plus, Search, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useDialogA11y } from '@/components/ui/primitives/useDialogA11y';
import * as TablePlatformApi from '@/services/api/tablePlatform.api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface LinkedRecord {
  id: string;
  displayValue: string;
  secondaryFields?: Record<string, string>;
}

interface FieldMeta {
  id: string;
  name: string;
  order: number;
}

interface LinkedRecordPickerProps {
  open: boolean;
  onClose: () => void;
  recordId: string;
  fieldId: string;
  linkedTableId: string;
  currentLinks: LinkedRecord[];
  onLink: (toRecordIds: string[]) => void;
  onUnlink: (toRecordIds: string[]) => void;
  onExpandRecord?: (recordId: string, tableId: string) => void;
  onCreateNew?: () => void;
  locked?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const LinkedRecordPicker: React.FC<LinkedRecordPickerProps> = React.memo(
  ({
    open,
    onClose,
    recordId,
    fieldId,
    linkedTableId,
    currentLinks,
    onLink,
    onUnlink,
    onExpandRecord,
    onCreateNew,
    locked = false,
  }) => {
    const { t } = useTranslation();

    const [search, setSearch] = useState('');
    const debouncedSearch = useDebounce(search, 300);
    const [candidates, setCandidates] = useState<LinkedRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [highlightIdx, setHighlightIdx] = useState(-1);
    const [expandedChipId, setExpandedChipId] = useState<string | null>(null);
    const [expandData, setExpandData] = useState<Record<string, unknown> | null>(null);
    const [fieldsMeta, setFieldsMeta] = useState<FieldMeta[]>([]);

    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const linkedIds = useMemo(() => new Set(currentLinks.map((l) => l.id)), [currentLinks]);

    useDialogA11y({ open, onClose, containerRef, initialFocusRef: inputRef });

    // Load table fields metadata once
    useEffect(() => {
      if (!open || !linkedTableId) return;
      (async () => {
        try {
          const tableData = await TablePlatformApi.getTable(linkedTableId);
          const table = tableData as Record<string, unknown>;
          const fields = (table?.fields ?? []) as Array<Record<string, unknown>>;
          const meta: FieldMeta[] = fields.map((f) => ({
            id: String(f.id ?? ''),
            name: String(f.name ?? ''),
            order: Number(f.field_order ?? f.order ?? 999),
          }));
          meta.sort((a, b) => a.order - b.order);
          setFieldsMeta(meta);
        } catch {
          setFieldsMeta([]);
        }
      })();
    }, [open, linkedTableId]);

    // Load/search candidates
    useEffect(() => {
      if (!open || !linkedTableId) return;
      let cancelled = false;
      setLoading(true);

      (async () => {
        try {
          const primaryFieldId = fieldsMeta[0]?.id ?? '';
          const secondaryIds = fieldsMeta.slice(1, 3).map((f) => f.id);

          let records: Array<Record<string, unknown>> = [];

          if (debouncedSearch.trim()) {
            const res = await TablePlatformApi.searchRecords(
              linkedTableId,
              debouncedSearch.trim(),
              { pageSize: 50 }
            );
            records = ((res as Record<string, unknown>)?.records ?? []) as Array<
              Record<string, unknown>
            >;
          } else {
            const res = await TablePlatformApi.listRecords(linkedTableId, {
              pageSize: 100,
            });
            records = ((res as Record<string, unknown>)?.records ?? []) as Array<
              Record<string, unknown>
            >;
          }

          if (cancelled) return;

          const mapped: LinkedRecord[] = records.map((r) => {
            const data = (r.data as Record<string, unknown>) ?? {};
            const secondary: Record<string, string> = {};
            secondaryIds.forEach((fId) => {
              const fMeta = fieldsMeta.find((m) => m.id === fId);
              if (fMeta && data[fId] != null) {
                secondary[fMeta.name] = String(data[fId]);
              }
            });
            return {
              id: String(r.id ?? ''),
              displayValue: String(data[primaryFieldId] ?? r.id ?? ''),
              secondaryFields: secondary,
            };
          });

          setCandidates(mapped);
        } catch {
          if (!cancelled) setCandidates([]);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [open, linkedTableId, debouncedSearch, fieldsMeta]);

    // Reset state on open (initial focus is handled by useDialogA11y via initialFocusRef)
    useEffect(() => {
      if (open) {
        setSelected(new Set(currentLinks.map((l) => l.id)));
        setSearch('');
        setHighlightIdx(-1);
        setExpandedChipId(null);
        setExpandData(null);
      }
    }, [open, currentLinks]);

    // Keyboard navigation
    const filteredCandidates = useMemo(() => {
      // Already filtered by API search, but do local filter for instant feedback
      if (!search.trim()) return candidates;
      const q = search.toLowerCase();
      return candidates.filter(
        (c) =>
          c.displayValue.toLowerCase().includes(q) ||
          Object.values(c.secondaryFields ?? {}).some((v) => v.toLowerCase().includes(q))
      );
    }, [candidates, search]);

    const totalItems = filteredCandidates.length + (onCreateNew && !locked ? 1 : 0);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setHighlightIdx((prev) => Math.min(prev + 1, totalItems - 1));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setHighlightIdx((prev) => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (highlightIdx >= 0 && highlightIdx < filteredCandidates.length) {
            handleToggle(filteredCandidates[highlightIdx].id);
          } else if (highlightIdx === filteredCandidates.length && onCreateNew && !locked) {
            onCreateNew();
          }
        }
        // Escape is handled globally by useDialogA11y (avoids a double onClose call).
      },
      [highlightIdx, filteredCandidates, totalItems, onCreateNew, locked]
    );

    // Scroll highlighted item into view
    useEffect(() => {
      if (highlightIdx < 0 || !listRef.current) return;
      const items = listRef.current.querySelectorAll('[data-candidate-item]');
      items[highlightIdx]?.scrollIntoView({ block: 'nearest' });
    }, [highlightIdx]);

    const handleToggle = useCallback(
      (id: string) => {
        if (locked) return;
        setSelected((prev) => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        });
      },
      [locked]
    );

    const handleConfirm = useCallback(() => {
      const toLink = Array.from(selected).filter((id) => !linkedIds.has(id));
      const toUnlink = Array.from(linkedIds).filter((id) => !selected.has(id));
      if (toLink.length > 0) onLink(toLink);
      if (toUnlink.length > 0) onUnlink(toUnlink);
      onClose();
    }, [selected, linkedIds, onLink, onUnlink, onClose]);

    const handleRemoveLink = useCallback(
      (id: string) => {
        if (locked) return;
        setSelected((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      },
      [locked]
    );

    // Expand chip popover
    const handleExpandChip = useCallback(
      async (recId: string) => {
        if (expandedChipId === recId) {
          setExpandedChipId(null);
          setExpandData(null);
          return;
        }
        setExpandedChipId(recId);
        try {
          const rec = await TablePlatformApi.getRecord(recId);
          setExpandData(((rec as Record<string, unknown>)?.data as Record<string, unknown>) ?? rec);
        } catch {
          setExpandData(null);
        }
      },
      [expandedChipId]
    );

    // Close on click outside
    useEffect(() => {
      if (!open) return;
      const handler = (e: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
          onClose();
        }
      };
      document.addEventListener('mousedown', handler);
      return () => document.removeEventListener('mousedown', handler);
    }, [open, onClose]);

    if (!open) return null;

    const selectedList = [
      ...currentLinks.filter((l) => selected.has(l.id)),
      ...Array.from(selected)
        .filter((id) => !currentLinks.some((l) => l.id === id))
        .map((id) => {
          const c = candidates.find((c) => c.id === id);
          return { id, displayValue: c?.displayValue ?? id };
        }),
    ];

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-[1px]">
        <div
          ref={containerRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="linked-record-picker-title"
          tabIndex={-1}
          className="flex h-[620px] max-h-[85vh] w-[520px] flex-col overflow-hidden rounded-2xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface shadow-2xl outline-none"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-c-border-subtle px-5 py-3">
            <div
              id="linked-record-picker-title"
              className="flex items-center gap-2 text-sm font-semibold text-c-text"
            >
              <Link2 className="h-4 w-4 text-blue-500" />
              {t('myWorkTable.linkedRecordPicker.title')}
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 transition-colors hover:bg-c-surface-raised"
            >
              <X className="h-4 w-4 text-c-text-secondary" />
            </button>
          </div>

          {/* Selected chips */}
          {selectedList.length > 0 && (
            <div className="border-b border-c-border-subtle px-5 py-2.5">
              <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-c-text-secondary">
                {t('myWorkTable.linkedRecordPicker.selected')} ({selectedList.length})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {selectedList.map((link) => (
                  <div key={link.id} className="group relative">
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50">
                      <button
                        onClick={() => handleExpandChip(link.id)}
                        className="flex items-center gap-1 truncate"
                        title={t('myWorkTable.linkedRecordPicker.clickToExpand')}
                      >
                        <span className="max-w-[120px] truncate">{link.displayValue}</span>
                        <ChevronRight className="h-3 w-3 opacity-40" />
                      </button>
                      {!locked && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveLink(link.id);
                          }}
                          className="ml-0.5 rounded-full p-0.5 transition-colors hover:bg-danger-100 hover:text-danger-600 dark:hover:bg-danger-900/30"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </span>
                    {/* Expand popover */}
                    {expandedChipId === link.id && expandData && (
                      <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-3 shadow-xl">
                        <div className="mb-2 text-xs font-bold text-c-text">
                          {link.displayValue}
                        </div>
                        <div className="space-y-1">
                          {fieldsMeta.slice(0, 5).map((fm) => {
                            const val = (expandData as Record<string, unknown>)?.[fm.id];
                            if (val == null) return null;
                            return (
                              <div key={fm.id} className="flex items-start gap-2">
                                <span className="w-20 flex-shrink-0 truncate text-[10px] font-medium text-c-text-secondary">
                                  {fm.name}
                                </span>
                                <span className="text-[10px] text-c-text-secondary">
                                  {String(val)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                        {onExpandRecord && (
                          <button
                            onClick={() => onExpandRecord(link.id, linkedTableId)}
                            className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-400"
                          >
                            <ExternalLink className="h-3 w-3" />
                            {t('myWorkTable.linkedRecordPicker.openFullRecord')}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Search */}
          <div className="border-b border-c-border-subtle px-5 py-2.5">
            <div className="flex items-center gap-2 rounded-xl border border-c-border-subtle bg-c-surface-raised px-3 py-2">
              <Search className="h-4 w-4 text-c-text-secondary" />
              <input
                ref={inputRef}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setHighlightIdx(-1);
                }}
                onKeyDown={handleKeyDown}
                placeholder={t('myWorkTable.linkedRecordPicker.searchPlaceholder')}
                className="flex-1 bg-transparent text-sm text-c-text outline-none focus:ring-2 focus:ring-blue-500/30 placeholder:text-c-text-muted"
              />
              {loading && <Loader2 className="h-4 w-4 animate-spin text-c-text-secondary" />}
            </div>
          </div>

          {/* Candidates list */}
          <div ref={listRef} className="flex-1 overflow-y-auto px-2 py-1">
            {loading && filteredCandidates.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-c-text-secondary" />
              </div>
            ) : filteredCandidates.length === 0 && !loading ? (
              <div className="py-8 text-center text-sm text-c-text-secondary">
                {t('myWorkTable.linkedRecordPicker.noRecordsFound')}
              </div>
            ) : (
              filteredCandidates.map((c, idx) => {
                const isSelected = selected.has(c.id);
                const isHighlighted = idx === highlightIdx;
                const secondaryEntries = Object.entries(c.secondaryFields ?? {}).slice(0, 2);

                return (
                  <button
                    key={c.id}
                    data-candidate-item
                    onClick={() => handleToggle(c.id)}
                    disabled={locked}
                    className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                      isHighlighted
                        ? 'bg-blue-50 dark:bg-blue-900/20'
                        : isSelected
                          ? 'bg-emerald-50/60 dark:bg-emerald-900/10'
                          : 'hover:bg-c-surface-raised'
                    }`}
                  >
                    <div
                      className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition-colors ${
                        isSelected
                          ? 'border-blue-500 bg-blue-500 text-white'
                          : 'border-c-border-subtle'
                      }`}
                    >
                      {isSelected && <span className="text-[10px]">✓</span>}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="truncate font-medium text-c-text">
                        {c.displayValue || c.id}
                      </div>
                      {secondaryEntries.length > 0 && (
                        <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                          {secondaryEntries.map(([key, val]) => (
                            <span key={key} className="text-[10px] text-c-text-secondary">
                              <span className="font-medium">{key}:</span> {val}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {linkedIds.has(c.id) && (
                      <span className="mt-0.5 flex-shrink-0 rounded-full bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                        {t('myWorkTable.linkedRecordPicker.linked')}
                      </span>
                    )}
                  </button>
                );
              })
            )}

            {/* Create new option */}
            {onCreateNew && !locked && (
              <button
                data-candidate-item
                onClick={onCreateNew}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                  highlightIdx === filteredCandidates.length
                    ? 'bg-c-surface-raised'
                    : 'hover:bg-c-surface-raised'
                }`}
              >
                <div className="flex h-4 w-4 items-center justify-center rounded-full bg-c-surface">
                  <Plus className="h-3 w-3 text-c-text-secondary" />
                </div>
                <span className="font-medium text-c-text">
                  {t('myWorkTable.linkedRecordPicker.createNewRecord')}
                </span>
              </button>
            )}
          </div>

          {/* Footer */}
          {!locked && (
            <div className="flex items-center justify-between border-t border-c-border-subtle px-5 py-3">
              <span className="text-[10px] text-c-text-secondary">
                {selected.size} {t('myWorkTable.linkedRecordPicker.selectedCount')}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={onClose}
                  className="rounded-xl border border-c-border-subtle px-4 py-2 text-xs font-semibold transition-colors hover:bg-c-surface-raised"
                >
                  {t('myWorkTable.linkedRecordPicker.cancel')}
                </button>
                <button
                  onClick={handleConfirm}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700"
                >
                  {t('myWorkTable.linkedRecordPicker.confirm')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
);

LinkedRecordPicker.displayName = 'LinkedRecordPicker';
