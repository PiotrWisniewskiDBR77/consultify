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
import {
  acceptAiDiff,
  applyAiDiff,
  hasPendingAiDiff,
  rejectAiDiff,
  snapRangeToBlockBoundaries,
} from './canvasDiffOps';
import { getCanvasEditorExtensions } from './canvasEditorExtensions';
import { CanvasEditorToolbar } from './CanvasEditorToolbar';
import { htmlToMarkdown, markdownToHtml } from './canvasMarkdownConversion';
import { migrateProvenanceLog, recordProvenanceEvent } from './canvasProvenanceLog';

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
  /** C6 — scope key for the provenance log (typically the draft id). */
  provenanceScope?: string;
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
  provenanceScope,
}) => {
  const { t, i18n } = useTranslation();
  const effectivePlaceholder =
    placeholder ?? t('canvas.editor.startTypingPlaceholder', 'Start typing or press / for commands...');
  const extensions = useMemo(
    () => getCanvasEditorExtensions(effectivePlaceholder),
    [effectivePlaceholder]
  );

  const onContentChangeRef = useRef(onContentChange);
  onContentChangeRef.current = onContentChange;
  const onSelectionChangeRef = useRef(onSelectionChange);
  onSelectionChangeRef.current = onSelectionChange;
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isExternalUpdateRef = useRef(false);

  const [selection, setSelection] = useState<CanvasSelection | null>(null);
  const [aiProcessing, setAiProcessing] = useState(false);
  const [hasPendingDiff, setHasPendingDiff] = useState(false);

  // W2-T2 — give onUpdate access to the live pending-diff state via a ref so
  // the debounced save can skip while a suggestion is unresolved. State-only
  // closes over a stale value (the useEditor callback captures the first
  // render's hasPendingDiff and never sees the toggle).
  const hasPendingDiffRef = useRef(false);
  hasPendingDiffRef.current = hasPendingDiff;

  // W2-T4 — provenance scope fallback. A fresh canvas mounts before the
  // backend has assigned a draftId, so the first AI edits would have logged
  // under `undefined` and been dropped. We synthesize a session-scoped temp
  // id on first AI activity and migrate the log onto the real draftId the
  // moment the parent passes it in. Stable across renders, never sent to the
  // backend, never persisted as the canonical id.
  const fallbackScopeRef = useRef<string | null>(null);
  const ensureFallbackScope = useCallback((): string => {
    if (fallbackScopeRef.current) return fallbackScopeRef.current;
    let id: string;
    try {
      id = `tmp-${crypto.randomUUID()}`;
    } catch {
      id = `tmp-${Date.now()}-${Math.floor(Math.random() * 1e9).toString(36)}`;
    }
    fallbackScopeRef.current = id;
    return id;
  }, []);
  const effectiveProvenanceScope =
    provenanceScope && provenanceScope.length > 0 ? provenanceScope : null;
  // When the real draftId arrives, hand the events accrued under the temp
  // scope over to it so the audit log stays continuous.
  useEffect(() => {
    if (effectiveProvenanceScope && fallbackScopeRef.current) {
      migrateProvenanceLog(fallbackScopeRef.current, effectiveProvenanceScope);
      fallbackScopeRef.current = null;
    }
  }, [effectiveProvenanceScope]);

  const editor = useEditor({
    extensions,
    editable,
    content: markdownToHtml(contentMd),
    onUpdate: ({ editor: ed }) => {
      if (isExternalUpdateRef.current) return;

      // W2-T2 — refuse to autosave while a pending AI diff lives in the doc.
      // Reason: Turndown has no rule for the aiAdded/aiRemoved marks, so
      // serializing now strips them silently — and the user can no longer
      // accept or reject the diff against the persisted markdown. Save
      // resumes after accept/reject (both call onContentChangeRef directly).
      //
      // N-8 — also check the LIVE document for diff marks, not just the React
      // ref. The mutation that creates the diff (applyAiDiff / patch ops) fires
      // this onUpdate synchronously, BEFORE setHasPendingDiff(true) has flipped
      // the ref on the next render. Without the doc-state check that first
      // onUpdate would schedule a save of the doubled (original + replacement)
      // HTML, persisting the doubling once the marks are later stripped.
      if (hasPendingDiffRef.current || hasPendingAiDiff(ed)) return;

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

  // B3 — patch-mode ops (chat-driven, applied by useCanvasAIStream via the
  // shared editor instance) land as aiRemoved/aiAdded marks WITHOUT passing
  // through handleAIRequest, so sync the pending-diff state here. That
  // surfaces the same Accept/Reject bar + Esc-to-reject + autosave skip the
  // selection-edit flow gets.
  useEffect(() => {
    const onPatchPending = () => {
      setHasPendingDiff(true);
      setSelection(null);
    };
    window.addEventListener('canvas-patch-pending', onPatchPending);
    return () => window.removeEventListener('canvas-patch-pending', onPatchPending);
  }, []);

  // P1 — Esc handler. While Teresa is streaming, Esc stops the stream
  // (consultants reach for Esc reflexively when AI starts producing the wrong
  // thing). While a pending diff is unresolved, Esc rejects it. Only one of
  // the two states is ever active so there's no precedence conflict.
  useEffect(() => {
    if (!isStreaming && !hasPendingDiff) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (isStreaming && onStopStream) {
        e.preventDefault();
        onStopStream();
      } else if (hasPendingDiff) {
        e.preventDefault();
        // Mirror handleRejectDiff inline — using the callback directly here
        // avoids a useCallback identity churn in deps.
        if (!editor) return;
        rejectAiDiff(editor);
        const rejectScope = effectiveProvenanceScope ?? fallbackScopeRef.current;
        if (rejectScope) {
          recordProvenanceEvent(rejectScope, { kind: 'reject', at: Date.now() });
        }
        setHasPendingDiff(false);
        setSelection(null);
        const md = htmlToMarkdown(editor.getHTML());
        onContentChangeRef.current(md);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isStreaming, hasPendingDiff, onStopStream, editor, effectiveProvenanceScope]);

  // AI request handler: send selected text + prompt, get replacement
  const handleAIRequest = useCallback(
    async (prompt: string, selectedText: string): Promise<string | null> => {
      if (!editor || !selection) return null;
      // W2-T1/T3 — refuse to start a floating-menu AI request while Teresa
      // is already streaming OR while a previous suggestion is unresolved.
      // Either case would interleave content with content the user can no
      // longer attribute to one mode or the other.
      if (isStreaming) return null;
      if (hasPendingDiff) return null;
      setAiProcessing(true);

      // E1 — block-boundary guard. A selection crossing block nodes (e.g.
      // paragraph → heading) would splice the replacement mid-word into the
      // second block. Snap the range outward to whole blocks BEFORE sending,
      // so the AI sees (and the diff replaces) complete blocks. Single-block
      // selections return the original range untouched — behavior identical.
      const effectiveRange = snapRangeToBlockBoundaries(editor, {
        from: selection.from,
        to: selection.to,
      });
      const wasSnapped =
        effectiveRange.from !== selection.from || effectiveRange.to !== selection.to;
      const effectiveText = wasSnapped
        ? editor.state.doc.textBetween(effectiveRange.from, effectiveRange.to, '\n\n')
        : selectedText;

      try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/ai/chat/quick', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: `${prompt}\n\nText to modify:\n${effectiveText}`,
            context: { source: 'canvas_selection', selectedText: effectiveText },
          }),
        });

        if (!response.ok) {
          setAiProcessing(false);
          return null;
        }

        const data = await response.json();
        const replacementRaw = data?.response ?? data?.content ?? data?.text;
        const replacement = typeof replacementRaw === 'string' ? replacementRaw.trim() : '';
        if (!replacement) {
          setAiProcessing(false);
          return null;
        }

        // N-8 — flip the pending-diff guard BEFORE mutating the editor. The
        // diff transactions below fire `onUpdate` synchronously, and the
        // autosave there reads `hasPendingDiffRef.current`. React's
        // `setHasPendingDiff(true)` (below) only updates the ref on the NEXT
        // render, so without this the `onUpdate` would still see `false` and
        // schedule a save of the marked, DOUBLED HTML (original + replacement).
        // Turndown drops the aiAdded/aiRemoved marks on serialize, so that
        // snapshot persists the doubling and a subsequent external sync wipes
        // the marks — Accept then has nothing to delete. (N-1 family.) Also
        // cancel any save already queued from the pre-diff selection edit.
        hasPendingDiffRef.current = true;
        if (saveTimerRef.current) {
          clearTimeout(saveTimerRef.current);
          saveTimerRef.current = null;
        }

        // Apply inline diff (mark original removed + insert replacement marked
        // added). Span is measured inside applyAiDiff via the doc-size delta —
        // never `to + string.length`, which breaks on multi-node replacements.
        // E1 — uses the block-snapped range so a cross-block diff replaces
        // whole blocks instead of splicing into the middle of one.
        applyAiDiff(editor, effectiveRange, replacement);

        // C6 — record the apply event so the per-span provenance audit (the
        // differentiator vs Claude/ChatGPT/Gemini/Antigravity) has the prompt
        // + original + replacement attached to this draft. W2-T4 — fall back
        // to a session-scoped temp id when the real draftId hasn't been
        // assigned yet so the first edits on a fresh canvas are not dropped.
        const scope = effectiveProvenanceScope ?? ensureFallbackScope();
        recordProvenanceEvent(scope, {
          kind: 'apply',
          at: Date.now(),
          prompt,
          originalExcerpt: effectiveText,
          replacementExcerpt: replacement,
          selectionFrom: effectiveRange.from,
          selectionTo: effectiveRange.to,
        });

        setHasPendingDiff(true);
        setAiProcessing(false);
        return replacement;
      } catch {
        setAiProcessing(false);
        return null;
      }
    },
    [editor, selection, effectiveProvenanceScope, ensureFallbackScope, isStreaming, hasPendingDiff]
  );

  // E1 — "Wyjaśnij" handler: same /api/ai/chat/quick pipeline as
  // handleAIRequest, but READ-ONLY — the response is rendered in the floating
  // menu's explanation popover and never touches the document (no diff marks,
  // no provenance event, no pending-diff state).
  const handleAIExplain = useCallback(
    async (prompt: string, selectedText: string): Promise<string | null> => {
      if (!editor || !selection) return null;
      // Same gating as handleAIRequest — never fire while Teresa is streaming
      // or while an unresolved suggestion lives in the doc.
      if (isStreaming) return null;
      if (hasPendingDiff) return null;
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
            message: `${prompt}\n\nText to explain:\n${selectedText}`,
            context: { source: 'canvas_selection', selectedText },
            // The explanation is for the reader, so hint the backend with the
            // UI language; the prompt itself pins output to the text language.
            language: i18n.language,
          }),
        });

        if (!response.ok) return null;

        const data = await response.json();
        const raw = data?.response ?? data?.content ?? data?.text;
        const text = typeof raw === 'string' ? raw.trim() : '';
        return text || null;
      } catch {
        return null;
      } finally {
        setAiProcessing(false);
      }
    },
    [editor, selection, isStreaming, hasPendingDiff, i18n.language]
  );

  // Accept AI suggestion: delete the original (aiRemoved) text, keep the
  // inserted (aiAdded) text but strip its marker. Then persist.
  const handleAcceptDiff = useCallback(() => {
    if (!editor) return;

    acceptAiDiff(editor);

    const acceptScope = effectiveProvenanceScope ?? fallbackScopeRef.current;
    if (acceptScope) {
      recordProvenanceEvent(acceptScope, { kind: 'accept', at: Date.now() });
    }

    setHasPendingDiff(false);
    setSelection(null);

    const md = htmlToMarkdown(editor.getHTML());
    onContentChangeRef.current(md);
  }, [editor, effectiveProvenanceScope]);

  // Reject AI suggestion: delete the inserted (aiAdded) text, restore the
  // original by stripping its aiRemoved marker. Persist for parity with accept
  // so closing the canvas does not lose the rollback relative to the backend.
  const handleRejectDiff = useCallback(() => {
    if (!editor) return;

    rejectAiDiff(editor);

    const rejectScope = effectiveProvenanceScope ?? fallbackScopeRef.current;
    if (rejectScope) {
      recordProvenanceEvent(rejectScope, { kind: 'reject', at: Date.now() });
    }

    setHasPendingDiff(false);
    setSelection(null);

    const md = htmlToMarkdown(editor.getHTML());
    onContentChangeRef.current(md);
  }, [editor, effectiveProvenanceScope]);

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

        {/* AI floating menu on selection. W2-T3 — also hide while Teresa is
            streaming, so the user cannot fire a parallel /chat/quick request
            that would race with the SSE stream and produce interleaved chunks
            the user can no longer accept/reject coherently. */}
        {!hasPendingDiff && !isStreaming && selection && editable && (
          <CanvasAIFloatingMenu
            editor={editor}
            selection={selection}
            onAIRequest={handleAIRequest}
            onExplainRequest={handleAIExplain}
            isProcessing={aiProcessing}
          />
        )}

        {/* Accept/Reject bar for pending AI diff */}
        {hasPendingDiff && (
          <AIAcceptRejectBar
            onAccept={handleAcceptDiff}
            onReject={handleRejectDiff}
          />
        )}

        {/* Streaming indicator */}
        {isStreaming && (
          <div className="sticky bottom-4 flex justify-center z-50 pointer-events-none">
            <div className="flex items-center gap-2 rounded-full border border-primary-200 dark:border-primary-500/30 bg-white dark:bg-navy-800 px-4 py-2 shadow-lg pointer-events-auto">
              <div className="flex gap-1">
                <span
                  className="w-1.5 h-1.5 rounded-full bg-navy-900 animate-bounce dark:bg-white"
                  style={{ animationDelay: '0ms' }}
                />
                <span
                  className="w-1.5 h-1.5 rounded-full bg-navy-900 animate-bounce dark:bg-white"
                  style={{ animationDelay: '150ms' }}
                />
                <span
                  className="w-1.5 h-1.5 rounded-full bg-navy-900 animate-bounce dark:bg-white"
                  style={{ animationDelay: '300ms' }}
                />
              </div>
              <span className="text-sm text-slate-600 dark:text-slate-300">
                {t('canvas.editor.teresaWriting', 'Teresa is writing...')}
              </span>
              {onStopStream && (
                <button
                  onClick={onStopStream}
                  className="px-2 py-0.5 rounded text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                >
                  {t('canvas.editor.stop', 'Stop')}
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
