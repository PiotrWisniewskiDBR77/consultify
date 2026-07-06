/**
 * CellExpandPopover — Floating popover for rich cell editing.
 *
 * Opens on double-click / expand icon. Content adapts to column type:
 *  - text → rich text editor (markdown)
 *  - select/multiselect → option manager with color assignment
 *  - ai_generated → prompt editor + regenerate
 *  - number/currency → calculator-style input
 *  - any → cell-level notes
 */
import {
  AlignLeft,
  Check,
  ChevronDown,
  Loader2,
  Maximize2,
  MessageSquare,
  Palette,
  Plus,
  RefreshCw,
  Sparkles,
  StickyNote,
  Trash2,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { ColumnDef } from './tableTypes';
import { COLUMN_TYPE_COLORS, ROW_ACCENT_COLORS } from './tableTypes';

interface CellExpandPopoverProps {
  open: boolean;
  onClose: () => void;
  column: ColumnDef;
  value: any;
  rowData: Record<string, any>;
  onChange: (value: any) => void;
  locked?: boolean;
  anchorRect?: DOMRect | null;
  onAIRegenerate?: (prompt: string) => Promise<string>;
}

export const CellExpandPopover: React.FC<CellExpandPopoverProps> = ({
  open,
  onClose,
  column,
  value,
  rowData,
  onChange,
  locked = false,
  anchorRect,
  onAIRegenerate,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const popoverRef = useRef<HTMLDivElement>(null);

  const [cellNote, setCellNote] = useState<string>(rowData?.[`_note_${column.key}`] || '');
  const [showNote, setShowNote] = useState(!!cellNote);
  const [aiPrompt, setAiPrompt] = useState(column.aiPrompt || '');
  const [aiLoading, setAiLoading] = useState(false);
  const [newOption, setNewOption] = useState('');

  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose, open]);

  const handleSaveNote = useCallback(() => {
    onChange({ _noteUpdate: { key: `_note_${column.key}`, value: cellNote } });
  }, [cellNote, column.key, onChange]);

  const handleAIRegenerate = useCallback(async () => {
    if (!onAIRegenerate || !aiPrompt.trim()) return;
    setAiLoading(true);
    try {
      const result = await onAIRegenerate(aiPrompt);
      onChange(result);
    } finally {
      setAiLoading(false);
    }
  }, [aiPrompt, onAIRegenerate, onChange]);

  const handleAddOption = useCallback(() => {
    if (!newOption.trim()) return;
    const existing: string[] = column.options || [];
    if (!existing.includes(newOption.trim())) {
      onChange({ _optionsUpdate: [...existing, newOption.trim()] });
    }
    setNewOption('');
  }, [column.options, newOption, onChange]);

  const handleRemoveOption = useCallback(
    (opt: string) => {
      const existing: string[] = column.options || [];
      onChange({ _optionsUpdate: existing.filter((o) => o !== opt) });
    },
    [column.options, onChange]
  );

  if (!open) return null;

  const style: React.CSSProperties = {};
  if (anchorRect) {
    style.position = 'fixed';
    style.left = Math.min(anchorRect.left, window.innerWidth - 360);
    style.top = anchorRect.bottom + 4;
    if ((style.top as number) > window.innerHeight - 300) {
      style.top = anchorRect.top - 300;
    }
  }

  const typeColor = COLUMN_TYPE_COLORS[column.type] || 'var(--c-info)';

  return (
    <div className="fixed inset-0 z-context-menu" onClick={onClose}>
      <div
        ref={popoverRef}
        onClick={(e) => e.stopPropagation()}
        className="w-[340px] rounded-2xl border border-c-border-subtle bg-c-surface shadow-2xl overflow-hidden"
        style={style}
      >
        {/* Header */}
        <div className="px-4 py-2.5 border-b border-c-border-subtle flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: typeColor }}
          />
          <span className="text-[11px] font-bold text-c-text flex-1">
            {column.header}
          </span>
          <span className="text-[8px] font-bold uppercase tracking-wider text-c-text-secondary px-1.5 py-0.5 rounded bg-c-surface-raised">
            {column.type}
          </span>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-c-surface-raised transition-colors"
          >
            <X size={12} className="text-c-text-secondary" />
          </button>
        </div>

        {/* Content by type */}
        <div className="p-4 max-h-[300px] overflow-auto">
          {/* Text / rich text */}
          {column.type === 'text' && (
            <div>
              <textarea
                value={String(value || '')}
                onChange={(e) => onChange(e.target.value)}
                disabled={locked}
                rows={6}
                className="w-full rounded-xl border border-c-border-subtle bg-c-surface-raised p-3 text-xs text-c-text outline-none resize-none focus:ring-2 focus:ring-blue-500/30 leading-relaxed"
                placeholder={isPl ? 'Markdown obsługiwany...' : 'Markdown supported...'}
              />
              <p className="text-[9px] text-c-text-secondary mt-1.5">
                <AlignLeft size={8} className="inline mr-0.5" />
                {isPl
                  ? 'Obsługuje **pogrubienie**, *kursywę*, - listy'
                  : 'Supports **bold**, *italic*, - lists'}
              </p>
            </div>
          )}

          {/* Select / Multiselect — option manager */}
          {(column.type === 'select' || column.type === 'multiselect') && (
            <div>
              <div className="space-y-1 mb-3">
                {(column.options || []).map((opt, idx) => {
                  const optColor =
                    column.optionColors?.[opt] || ROW_ACCENT_COLORS[idx % ROW_ACCENT_COLORS.length];
                  const isSelected =
                    column.type === 'multiselect'
                      ? Array.isArray(value)
                        ? value.includes(opt)
                        : false
                      : value === opt;
                  return (
                    <div
                      key={opt}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-c-surface-raised"
                    >
                      <button
                        onClick={() => {
                          if (locked) return;
                          if (column.type === 'multiselect') {
                            const arr = Array.isArray(value) ? [...value] : [];
                            onChange(
                              arr.includes(opt) ? arr.filter((x) => x !== opt) : [...arr, opt]
                            );
                          } else {
                            onChange(value === opt ? '' : opt);
                          }
                        }}
                        className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition-colors ${
                          isSelected
                            ? 'border-transparent'
                            : 'border-c-border-subtle'
                        }`}
                        style={isSelected ? { backgroundColor: optColor } : {}}
                      >
                        {isSelected && <Check size={10} className="text-white" />}
                      </button>
                      <div
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: optColor }}
                      />
                      <span className="text-[11px] text-c-text flex-1">
                        {opt}
                      </span>
                      {!locked && (
                        <button
                          onClick={() => handleRemoveOption(opt)}
                          className="p-0.5 rounded text-c-text-secondary hover:text-danger-500 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Trash2 size={10} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              {!locked && (
                <div className="flex items-center gap-1.5">
                  <input
                    value={newOption}
                    onChange={(e) => setNewOption(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddOption()}
                    placeholder={isPl ? 'Nowa opcja...' : 'New option...'}
                    className="flex-1 rounded-lg border border-c-border-subtle bg-c-surface px-2.5 py-1.5 text-[10px] outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                  <button
                    onClick={handleAddOption}
                    disabled={!newOption.trim()}
                    className="p-1.5 rounded-lg bg-c-accent-soft text-c-accent hover:bg-c-accent-soft disabled:opacity-40 transition-colors"
                  >
                    <Plus size={12} />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* AI Generated — prompt editor */}
          {column.type === 'ai_generated' && (
            <div>
              <div className="rounded-xl border border-c-accent bg-c-accent-soft p-3 mb-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Sparkles size={11} className="text-c-accent" />
                  <span className="text-[10px] font-bold text-c-accent">
                    {isPl ? 'Prompt AI' : 'AI Prompt'}
                  </span>
                </div>
                <textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  disabled={locked}
                  rows={3}
                  className="w-full bg-transparent border-0 outline-none text-[11px] text-c-text resize-none leading-relaxed"
                  placeholder={
                    isPl ? 'Opisz co AI ma wygenerować...' : 'Describe what AI should generate...'
                  }
                />
              </div>
              <div className="rounded-xl bg-c-surface-raised p-3 mb-3">
                <label className="text-[9px] font-bold uppercase tracking-wider text-c-text-secondary mb-1 block">
                  {isPl ? 'Wynik' : 'Result'}
                </label>
                <p className="text-[11px] text-c-text leading-relaxed">
                  {String(value || (isPl ? 'Brak wyniku' : 'No result'))}
                </p>
              </div>
              {!locked && onAIRegenerate && (
                <button
                  onClick={handleAIRegenerate}
                  disabled={aiLoading || !aiPrompt.trim()}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-bold text-c-accent bg-c-accent-soft hover:bg-c-accent-soft disabled:opacity-40 transition-colors"
                >
                  {aiLoading ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <RefreshCw size={12} />
                  )}
                  {aiLoading
                    ? isPl
                      ? 'Generuję...'
                      : 'Generating...'
                    : isPl
                      ? 'Regeneruj'
                      : 'Regenerate'}
                </button>
              )}
            </div>
          )}

          {/* Number / Currency */}
          {(column.type === 'number' || column.type === 'currency') && (
            <div>
              <input
                type="number"
                value={value ?? ''}
                onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
                disabled={locked}
                className="w-full rounded-xl border border-c-border-subtle bg-c-surface-raised px-3 py-2.5 text-sm font-mono text-c-text outline-none focus:ring-2 focus:ring-blue-500/30"
              />
              {column.type === 'currency' && (
                <p className="text-[9px] text-c-text-secondary mt-1.5">{isPl ? 'Waluta' : 'Currency'}</p>
              )}
            </div>
          )}

          {/* Rating */}
          {column.type === 'rating' && (
            <div className="flex items-center gap-3 py-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => !locked && onChange(star === value ? 0 : star)}
                  className={`text-2xl transition-transform hover:scale-110 ${
                    star <= (Number(value) || 0)
                      ? 'text-amber-400'
                      : 'text-c-text-secondary'
                  }`}
                >
                  ★
                </button>
              ))}
              <span className="text-xs text-c-text-muted ml-2">{value || 0}/5</span>
            </div>
          )}

          {/* Progress */}
          {column.type === 'progress' && (
            <div>
              <div className="flex items-center gap-3 mb-2">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Number(value) || 0}
                  onChange={(e) => !locked && onChange(Number(e.target.value))}
                  disabled={locked}
                  className="flex-1 accent-primary-500"
                />
                <span className="text-sm font-bold text-c-text w-10 text-right">
                  {value || 0}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-c-border-subtle overflow-hidden">
                <div
                  className="h-full rounded-full bg-c-accent transition-all"
                  style={{ width: `${Number(value) || 0}%` }}
                />
              </div>
            </div>
          )}

          {/* Date */}
          {column.type === 'date' && (
            <input
              type="date"
              value={String(value || '')}
              onChange={(e) => onChange(e.target.value)}
              disabled={locked}
              className="w-full rounded-xl border border-c-border-subtle bg-c-surface-raised px-3 py-2.5 text-xs text-c-text outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          )}

          {/* URL */}
          {column.type === 'url' && (
            <div>
              <input
                type="url"
                value={String(value || '')}
                onChange={(e) => onChange(e.target.value)}
                disabled={locked}
                placeholder="https://..."
                className="w-full rounded-xl border border-c-border-subtle bg-c-surface-raised px-3 py-2.5 text-xs text-blue-600 dark:text-blue-400 outline-none focus:ring-2 focus:ring-blue-500/30"
              />
              {value && (
                <a
                  href={String(value)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[9px] text-blue-500 hover:underline mt-1 block"
                >
                  {isPl ? 'Otwórz link' : 'Open link'} ↗
                </a>
              )}
            </div>
          )}

          {/* Fallback */}
          {![
            'text',
            'select',
            'multiselect',
            'ai_generated',
            'number',
            'currency',
            'rating',
            'progress',
            'date',
            'url',
          ].includes(column.type) && (
            <input
              value={String(value || '')}
              onChange={(e) => onChange(e.target.value)}
              disabled={locked}
              className="w-full rounded-xl border border-c-border-subtle bg-c-surface-raised px-3 py-2.5 text-xs text-c-text outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          )}
        </div>

        {/* Cell note */}
        <div className="px-4 py-2.5 border-t border-c-border-subtle">
          <button
            onClick={() => setShowNote(!showNote)}
            className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-c-text-secondary hover:text-c-text-secondary transition-colors"
          >
            <StickyNote size={9} />
            {isPl ? 'Notatka do komórki' : 'Cell note'}
            <ChevronDown
              size={9}
              className={`transition-transform ${showNote ? 'rotate-180' : ''}`}
            />
          </button>
          {showNote && (
            <div className="mt-1.5">
              <textarea
                value={cellNote}
                onChange={(e) => setCellNote(e.target.value)}
                onBlur={handleSaveNote}
                disabled={locked}
                rows={2}
                placeholder={isPl ? 'Dodaj notatkę...' : 'Add a note...'}
                className="w-full bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200/40 dark:border-amber-700/20 rounded-lg px-2.5 py-1.5 text-[10px] text-c-text outline-none resize-none"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CellExpandPopover;
