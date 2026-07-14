/**
 * InlineEditor (REQ-6)
 *
 * Lightweight inline editor for block content.
 * Toggle between preview (markdown) and edit (raw text) modes.
 * Supports undo/redo, word count, and change tracking.
 */

import { Check, Eye, Pencil, RotateCcw, RotateCw, X } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';

// ==========================================
// TYPES
// ==========================================

interface InlineEditorProps {
  content: string;
  onSave: (content: string) => void;
  isPl: boolean;
  /** Render the smart renderer in preview mode instead of default markdown */
  previewRenderer?: React.ReactNode;
  /** Maximum height in pixels for the editor (scrollable) */
  maxHeight?: number;
}

// ==========================================
// HELPERS
// ==========================================

function countWords(text: string): number {
  return text
    .replace(/[#*_\-|>]+/g, '')
    .split(/\s+/)
    .filter(Boolean).length;
}

function countChanges(original: string, current: string): number {
  if (original === current) return 0;
  const origLines = original.split('\n');
  const currLines = current.split('\n');
  let changes = 0;
  const maxLen = Math.max(origLines.length, currLines.length);
  for (let i = 0; i < maxLen; i++) {
    if ((origLines[i] || '') !== (currLines[i] || '')) changes++;
  }
  return changes;
}

// ==========================================
// UNDO/REDO HOOK
// ==========================================

function useUndoRedo(initialValue: string) {
  const [history, setHistory] = useState<string[]>([initialValue]);
  const [index, setIndex] = useState(0);

  const current = history[index];

  const push = useCallback(
    (value: string) => {
      // Don't push if same as current
      if (value === history[index]) return;
      const newHistory = history.slice(0, index + 1);
      newHistory.push(value);
      // Keep max 50 states
      if (newHistory.length > 50) newHistory.shift();
      setHistory(newHistory);
      setIndex(newHistory.length - 1);
    },
    [history, index]
  );

  const undo = useCallback(() => {
    if (index > 0) setIndex(index - 1);
  }, [index]);

  const redo = useCallback(() => {
    if (index < history.length - 1) setIndex(index + 1);
  }, [index, history.length]);

  const canUndo = index > 0;
  const canRedo = index < history.length - 1;

  return { current, push, undo, redo, canUndo, canRedo };
}

// ==========================================
// COMPONENT
// ==========================================

export const InlineEditor: React.FC<InlineEditorProps> = ({
  content,
  onSave,
  isPl,
  previewRenderer,
  maxHeight = 500,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [originalContent] = useState(content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { current, push, undo, redo, canUndo, canRedo } = useUndoRedo(content);

  // Auto-focus and resize textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      // Auto-resize
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, maxHeight)}px`;
    }
  }, [isEditing, maxHeight]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        onSave(current);
        setIsEditing(false);
      }
      if (e.key === 'Escape') {
        setIsEditing(false);
      }
    },
    [current, onSave, undo, redo]
  );

  const wordCount = countWords(current);
  const changedLines = countChanges(originalContent, current);
  const hasChanges = current !== content;

  // ── Preview Mode ──
  if (!isEditing) {
    return (
      <div className="group/editor relative">
        {/* Edit overlay trigger */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsEditing(true);
          }}
          className="absolute top-2 right-2 z-10 opacity-0 group-hover/editor:opacity-100 transition-all
            flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium
            bg-c-surface border border-c-border-subtle 
            rounded-lg shadow-sm hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600
            text-c-text-secondary hover:text-blue-600 dark:hover:text-blue-400"
          title={isPl ? 'Edytuj treść (Ctrl+Click)' : 'Edit content (Ctrl+Click)'}
        >
          <Pencil className="w-3 h-3" />
          {isPl ? 'Edytuj' : 'Edit'}
        </button>

        {/* Content preview */}
        <div
          className="cursor-pointer"
          onDoubleClick={(e) => {
            e.stopPropagation();
            setIsEditing(true);
          }}
        >
          {previewRenderer || (
            <div className="prose prose-sm dark:prose-invert max-w-none text-c-text-secondary">
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Edit Mode ──
  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-t-lg">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-blue-700 dark:text-blue-300 flex items-center gap-1">
            <Pencil className="w-3 h-3" />
            {isPl ? 'Tryb edycji' : 'Edit Mode'}
          </span>
          <span className="text-[10px] text-blue-500 dark:text-blue-400">
            {wordCount} {isPl ? 'słów' : 'words'}
            {changedLines > 0 && (
              <span className="ml-1 text-amber-600 dark:text-amber-400">
                · {changedLines} {isPl ? 'zm. linii' : 'changed lines'}
              </span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Undo/Redo */}
          <button
            onClick={undo}
            disabled={!canUndo}
            className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded disabled:opacity-30"
            title={isPl ? 'Cofnij (Ctrl+Z)' : 'Undo (Ctrl+Z)'}
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded disabled:opacity-30"
            title={isPl ? 'Ponów (Ctrl+Shift+Z)' : 'Redo (Ctrl+Shift+Z)'}
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>

          <div className="w-px h-4 bg-blue-200 dark:bg-blue-700 mx-1" />

          {/* Preview toggle */}
          <button
            onClick={() => setIsEditing(false)}
            className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded"
            title={isPl ? 'Podgląd' : 'Preview'}
          >
            <Eye className="w-3.5 h-3.5" />
          </button>

          {/* Cancel */}
          <button
            onClick={() => {
              push(content); // Reset to original
              setIsEditing(false);
            }}
            className="p-1 text-c-text-secondary hover:bg-c-border-subtle rounded"
            title={isPl ? 'Anuluj (Esc)' : 'Cancel (Esc)'}
          >
            <X className="w-3.5 h-3.5" />
          </button>

          {/* Save */}
          <button
            onClick={() => {
              onSave(current);
              setIsEditing(false);
            }}
            disabled={!hasChanges}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg transition-all ml-1 ${
              hasChanges
                ? 'bg-blue-600 text-c-text hover:bg-blue-700 shadow-sm'
                : 'bg-c-border-subtle text-c-text-secondary cursor-not-allowed'
            }`}
            title={isPl ? 'Zapisz (Ctrl+S)' : 'Save (Ctrl+S)'}
          >
            <Check className="w-3 h-3" />
            {isPl ? 'Zapisz' : 'Save'}
          </button>
        </div>
      </div>

      {/* Editor */}
      <textarea
        ref={textareaRef}
        value={current}
        onChange={(e) => push(e.target.value)}
        onKeyDown={handleKeyDown}
        className="w-full px-4 py-3 text-sm font-mono bg-c-surface 
          border border-t-0 border-blue-200 dark:border-blue-800 rounded-b-lg 
          focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400
          resize-y min-h-[120px] leading-relaxed"
        style={{ maxHeight: `${maxHeight}px` }}
      />

      {/* Keyboard shortcuts hint */}
      <div className="flex items-center gap-3 mt-1 px-1">
        <span className="text-[10px] text-c-text-secondary">
          <kbd className="px-1 py-0.5 bg-c-surface-raised rounded text-[9px]">Ctrl+S</kbd>{' '}
          {isPl ? 'zapisz' : 'save'}
        </span>
        <span className="text-[10px] text-c-text-secondary">
          <kbd className="px-1 py-0.5 bg-c-surface-raised rounded text-[9px]">Ctrl+Z</kbd>{' '}
          {isPl ? 'cofnij' : 'undo'}
        </span>
        <span className="text-[10px] text-c-text-secondary">
          <kbd className="px-1 py-0.5 bg-c-surface-raised rounded text-[9px]">Esc</kbd>{' '}
          {isPl ? 'anuluj' : 'cancel'}
        </span>
        <span className="text-[10px] text-c-text-secondary">
          {isPl ? 'Podwójne kliknięcie aby edytować' : 'Double-click to edit'}
        </span>
      </div>
    </div>
  );
};

export default InlineEditor;
