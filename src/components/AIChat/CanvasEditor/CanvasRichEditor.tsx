/**
 * TipTap-based rich text editor for Canvas documents.
 * Replaces the read-only CanvasMarkdownRenderer with full inline editing.
 *
 * Supports both manual editing AND AI-assisted editing:
 * - Manual: click, type, format with toolbar
 * - AI: select text → floating menu → Teresa modifies with inline diff
 *
 * Storage is markdown-canonical: converts markdown ↔ HTML on load/save.
 */

import { EditorContent, useEditor } from '@tiptap/react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AIAcceptRejectBar, CanvasAIFloatingMenu } from './CanvasAIFloatingMenu';
import { CanvasEditorToolbar } from './CanvasEditorToolbar';
import { acceptAiDiff, applyAiDiff, rejectAiDiff } from './canvasDiffOps';
import { htmlToMarkdown, markdownToHtml } from './canvasMarkdownConversion';
import { getCanvasEditorExtensions } from './canvasEditorExtensions';

export interface CanvasSelection {
  selectedText: string;
  from: number;
  to: number;
}

interface CanvasRichEditorProps {
  contentMd: string;
  onContentChange: (md: string) => void;
  onSelectionChange?: (sel: CanvasSelection | null) => void;
  onEditorReady?: (editor: any) => void;
  editable?: boolean;
  placeholder?: string;
  className?: string;
  isStreaming?: boolean;
  onStopStream?: () => void;
}

const SAVE_DEBOUNCE_MS = 300;

export const CanvasRichEditor: React.FC<CanvasRichEditorProps> = ({
  contentMd,
  onContentChange,
  onSelectionChange,
  onEditorReady,
  editable = true,
  placeholder,
  className,
  isStreaming = false,
  onStopStream,
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language?.startsWith('pl');
  const extensions = useMemo(() => getCanvasEditorExtensions(placeholder), [placeholder]);

  const onContentChangeRef = useRef(onContentChange);
  onContentChangeRef.current = onContentChange;
  const onSelectionChangeRef = useRef(onSelectionChange);
  onSelectionChangeRef.current = onSelectionChange;
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isExternalUpdateRef = useRef(false);

  const [selection, setSelection] = useState<CanvasSelection | null>(null);
  const [aiProcessing, setAiProcessing] = useState(false);
  const [hasPendingDiff, setHasPendingDiff] = useState(false);

  const editor = useEditor({
    extensions,
    editable,
    content: markdownToHtml(contentMd),
    onUpdate: ({ editor: ed }) => {
      if (isExternalUpdateRef.current) return;

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        const html = ed.getHTML();
        const md = htmlToMarkdown(html);
        onContentChangeRef.current(md);
      }, SAVE_DEBOUNCE_MS);
    },
    onSelectionUpdate: ({ editor: ed }) => {
      if (hasPendingDiff) return;
      const { from, to } = ed.state.selection;
      if (from === to) {
        setSelection(null);
        onSelectionChangeRef.current?.(null);
        return;
      }
      const selectedText = ed.state.doc.textBetween(from, to, ' ');
      const sel = { selectedText, from, to };
      setSelection(sel);
      onSelectionChangeRef.current?.(sel);
    },
  });

  // Sync external contentMd changes
  const lastExternalMdRef = useRef(contentMd);
  useEffect(() => {
    if (!editor) return;
    if (contentMd === lastExternalMdRef.current) return;
    lastExternalMdRef.current = contentMd;

    isExternalUpdateRef.current = true;
    const html = markdownToHtml(contentMd);
    // emitUpdate:false → applying an external markdown sync must not re-trigger
    // onUpdate (which would loop a save back to the parent).
    editor.commands.setContent(html, { emitUpdate: false });
    isExternalUpdateRef.current = false;
  }, [contentMd, editor]);

  useEffect(() => {
    if (editor) editor.setEditable(editable);
  }, [editable, editor]);

  useEffect(() => {
    if (editor) onEditorReady?.(editor);
  }, [editor, onEditorReady]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // AI request handler: send selected text + prompt, get replacement
  const handleAIRequest = useCallback(
    async (prompt: string, selectedText: string): Promise<string | null> => {
      if (!editor || !selection) return null;
      setAiProcessing(true);

      try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/ai/chat/quick', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: `${prompt}\n\nText to modify:\n${selectedText}`,
            context: { source: 'canvas_selection', selectedText },
          }),
        });

        if (!response.ok) {
          setAiProcessing(false);
          return null;
        }

        const data = await response.json();
        const replacementRaw = data?.response ?? data?.content ?? data?.text;
        const replacement =
          typeof replacementRaw === 'string' ? replacementRaw.trim() : '';
        if (!replacement) {
          setAiProcessing(false);
          return null;
        }

        // Apply inline diff (mark original removed + insert replacement marked
        // added). Span is measured inside applyAiDiff via the doc-size delta —
        // never `to + string.length`, which breaks on multi-node replacements.
        applyAiDiff(editor, { from: selection.from, to: selection.to }, replacement);

        setHasPendingDiff(true);
        setAiProcessing(false);
        return replacement;
      } catch {
        setAiProcessing(false);
        return null;
      }
    },
    [editor, selection]
  );

  // Accept AI suggestion: delete the original (aiRemoved) text, keep the
  // inserted (aiAdded) text but strip its marker. Then persist.
  const handleAcceptDiff = useCallback(() => {
    if (!editor) return;

    acceptAiDiff(editor);

    setHasPendingDiff(false);
    setSelection(null);

    const md = htmlToMarkdown(editor.getHTML());
    onContentChangeRef.current(md);
  }, [editor]);

  // Reject AI suggestion: delete the inserted (aiAdded) text, restore the
  // original by stripping its aiRemoved marker. Persist for parity with accept
  // so closing the canvas does not lose the rollback relative to the backend.
  const handleRejectDiff = useCallback(() => {
    if (!editor) return;

    rejectAiDiff(editor);

    setHasPendingDiff(false);
    setSelection(null);

    const md = htmlToMarkdown(editor.getHTML());
    onContentChangeRef.current(md);
  }, [editor]);

  const editorClassName = useMemo(
    () =>
      [
        'prose prose-sm dark:prose-invert max-w-none',
        'focus:outline-none min-h-[200px] px-6 py-4',
        'prose-headings:font-semibold prose-headings:text-slate-900 dark:prose-headings:text-white',
        'prose-p:text-slate-700 dark:prose-p:text-slate-300',
        'prose-a:text-primary-600 dark:prose-a:text-primary-400',
        'prose-code:text-pink-600 dark:prose-code:text-pink-400',
        'prose-table:border-collapse',
        'prose-th:border prose-th:border-slate-300 dark:prose-th:border-slate-600 prose-th:px-3 prose-th:py-2 prose-th:bg-slate-50 dark:prose-th:bg-navy-800',
        'prose-td:border prose-td:border-slate-300 dark:prose-td:border-slate-600 prose-td:px-3 prose-td:py-2',
        className,
      ]
        .filter(Boolean)
        .join(' '),
    [className]
  );

  if (!editor) return null;

  return (
    <>
      <CanvasEditorToolbar editor={editor} />
      <div className="flex-1 overflow-y-auto relative">
        <EditorContent editor={editor} className={editorClassName} />

        {/* AI floating menu on selection */}
        {!hasPendingDiff && selection && editable && (
          <CanvasAIFloatingMenu
            editor={editor}
            selection={selection}
            onAIRequest={handleAIRequest}
            isProcessing={aiProcessing}
          />
        )}

        {/* Accept/Reject bar for pending AI diff */}
        {hasPendingDiff && (
          <AIAcceptRejectBar
            onAccept={handleAcceptDiff}
            onReject={handleRejectDiff}
            isPolish={isPolish}
          />
        )}

        {/* Streaming indicator */}
        {isStreaming && (
          <div className="sticky bottom-4 flex justify-center z-50 pointer-events-none">
            <div className="flex items-center gap-2 rounded-full border border-primary-200 dark:border-primary-500/30 bg-white dark:bg-navy-800 px-4 py-2 shadow-lg pointer-events-auto">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-sm text-slate-600 dark:text-slate-300">
                {isPolish ? 'Teresa pisze...' : 'Teresa is writing...'}
              </span>
              {onStopStream && (
                <button
                  onClick={onStopStream}
                  className="px-2 py-0.5 rounded text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                >
                  Stop
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default CanvasRichEditor;
