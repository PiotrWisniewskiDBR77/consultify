/**
 * Hook for streaming AI-generated content directly into the TipTap Canvas editor.
 * Teresa writes to the document in real-time — user sees text appearing.
 *
 * Uses the existing SSE streaming infrastructure (same as useAIStream.ts)
 * but routes output to TipTap editor instead of chat messages.
 */

import type { Editor } from '@tiptap/react';
import { useCallback, useEffect, useRef, useState } from 'react';

import i18n from '@/i18n';

import { hasPendingAiDiff } from './canvasDiffOps';
import { htmlToMarkdown, markdownToHtml } from './canvasMarkdownConversion';

/**
 * N-canvas-append fix — enforce real block separation in streamed markdown
 * BEFORE it is parsed into TipTap nodes. The model streams chunks like
 * "…rynku. ## Bariery 1. **Koszt**" where a heading/list opener is glued to
 * the end of the previous block. Inserted as plain text it stayed inline, and
 * Turndown then escaped the `##`/`1.` on save (→ literal "\## Bariery" that
 * `marked` never renders as a heading on reload). This guarantees:
 *  - a blank line BEFORE every ATX heading (`#`..`######`)
 *  - a blank line BEFORE a list/table block that follows a non-list line
 *  - headings/list/table markers always start their own line (never mid-line)
 * so `markdownToHtml` produces proper <h2>/<ul>/<table> nodes instead of a
 * single escaped paragraph.
 */
export function ensureBlockSpacing(markdown: string): string {
  if (!markdown) return markdown;
  // 1) Split a block opener that got glued onto the tail of a previous line,
  //    e.g. "…rynku. ## Bariery" → "…rynku.\n\n## Bariery". Only when the
  //    opener is NOT already at line start (^ excluded via the leading \S).
  let out = markdown
    // Heading glued mid-line: "text ## Title" → break before the hashes.
    .replace(/(\S)[ \t]+(#{1,6}[ \t]+\S)/g, '$1\n\n$2')
    // Ordered list item glued mid-line: "text 1. Foo" → break before it.
    .replace(/(\S)[ \t]+(\d+\.[ \t]+\S)/g, '$1\n\n$2')
    // Unordered list item glued mid-line: "text - foo" / "text * foo".
    .replace(/(\S)[ \t]+([-*+][ \t]+\S)/g, '$1\n\n$2');

  // 2) Ensure a BLANK line before headings and before a list/table block that
  //    starts right after a non-blank, non-list line.
  const lines = out.split('\n');
  const result: string[] = [];
  const isHeading = (l: string) => /^\s*#{1,6}\s+\S/.test(l);
  const isListItem = (l: string) => /^\s*([-*+]|\d+\.)\s+\S/.test(l);
  const isTableRow = (l: string) => /^\s*\|.*\|\s*$/.test(l);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const prev = result.length ? result[result.length - 1] : '';
    const prevTrim = prev.trim();
    const needsGapBefore =
      prevTrim !== '' &&
      ((isHeading(line) && !isHeading(prev)) ||
        ((isListItem(line) || isTableRow(line)) &&
          !isListItem(prev) &&
          !isTableRow(prev)));
    if (needsGapBefore) result.push('');
    result.push(line);
    // Blank line AFTER a heading so the following paragraph/list is its own block.
    if (isHeading(line)) {
      const next = lines[i + 1];
      if (next !== undefined && next.trim() !== '') result.push('');
    }
  }
  out = result.join('\n');
  return out;
}

export interface UseCanvasAIStreamOptions {
  editor: Editor | null;
  onComplete?: (finalMd: string) => void;
  onError?: (error: string) => void;
}

/**
 * Context forwarded from the chat composer so Teresa writes WITH awareness of
 * the document and conversation instead of blind. `canvasContextPacket` matches
 * the shape the /chat/stream handler reads from `context.canvasContextPacket`.
 */
export interface CanvasStreamContext {
  history?: Array<{ role: string; parts: Array<{ text: string }> }>;
  language?: string;
  canvasContextPacket?: Record<string, unknown> | null;
  /** B3 — provenance scope (draft id) so patch ops land in the audit log. */
  provenanceScope?: string | null;
}

export type CanvasStreamRequestMode = 'append' | 'replace' | 'generate' | 'patch';

export interface UseCanvasAIStreamReturn {
  isStreaming: boolean;
  streamToCanvas: (
    prompt: string,
    mode: CanvasStreamRequestMode,
    context?: CanvasStreamContext
  ) => void;
  stopStream: () => void;
}

export function useCanvasAIStream({
  editor,
  onComplete,
  onError,
}: UseCanvasAIStreamOptions): UseCanvasAIStreamReturn {
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  // C1.2: the position where the NEXT chunk should be inserted. Advanced after
  // each chunk so Teresa's output stays contiguous even if the user clicks into
  // the doc mid-stream. Previously `insertContent(chunk)` went to the live
  // selection, so any click fragmented the output.
  const insertPositionRef = useRef<number | null>(null);
  // C1.3: editor flag to restore on cleanup.
  const wasEditableRef = useRef<boolean | null>(null);
  // N-canvas-append: the doc position where the streamed region BEGINS, and the
  // raw markdown accumulated across chunks. On completion we delete the live
  // plain-text projection [appendStart, insertPosition) and re-insert the
  // accumulated markdown PARSED into real block nodes — so headings/lists render
  // correctly and the original content BEFORE appendStart is never touched.
  const appendStartRef = useRef<number | null>(null);
  const accumulatedMdRef = useRef<string>('');

  const stopStream = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    if (editor && wasEditableRef.current !== null) {
      editor.setEditable(wasEditableRef.current);
      wasEditableRef.current = null;
    }
    setIsStreaming(false);
  }, [editor]);

  // C1.3: closing the panel mid-stream MUST abort the SSE fetch so chunks don't
  // fire into a destroyed editor and the "Writing in document…" bubble doesn't
  // stay orphaned.
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    };
  }, []);

  const streamToCanvas = useCallback(
    async (prompt: string, mode: CanvasStreamRequestMode, streamContext?: CanvasStreamContext) => {
      if (!editor || isStreaming) return;

      // W2-T1 — refuse to start a stream while a previous AI suggestion is
      // still unresolved (aiAdded/aiRemoved marks present). Starting now would
      // interleave new content into the marked spans and the user could no
      // longer accept/reject the prior diff cleanly. Caller sees the error
      // via onError so it can surface "resolve the previous suggestion first".
      if (hasPendingAiDiff(editor)) {
        onError?.(
          i18n.t(
            'canvas.aiStream.resolvePendingSuggestion',
            'Resolve the previous AI suggestion (accept or reject) before starting a new edit.'
          )
        );
        return;
      }

      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      setIsStreaming(true);

      // ── B3 patch-mode: surgical anchor-based edit via /chat/quick ──────
      // No SSE, no editor lock: the document is sent as a plain-text
      // projection, the model returns anchored operations, and anchors are
      // re-validated against the LIVE doc at apply time — so a user edit
      // during the request degrades safely to the fallback stream.
      const streamMode: 'append' | 'replace' | 'generate' = mode === 'patch' ? 'replace' : mode;
      if (mode === 'patch') {
        try {
          const {
            buildDocTextIndex,
            parsePatchOperations,
            applyPatchOperations,
            buildPatchPrompt,
          } = await import('./canvasPatchOps');
          const docText = buildDocTextIndex(editor).text;
          const token = localStorage.getItem('token');
          const response = await fetch('/api/ai/chat/quick', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              // ChatQuickRequestSchema caps message at 8000 chars server-side,
              // so the document slice is capped at 6000 (not the 12KB the
              // streaming path uses) to leave room for contract + instruction.
              message: buildPatchPrompt(prompt.slice(0, 1000), docText.slice(0, 6000)),
              context: { source: 'canvas_patch' },
              language: streamContext?.language,
            }),
            signal: abortController.signal,
          });
          if (response.ok) {
            const data = await response.json();
            const rawReply = data?.response ?? data?.content ?? data?.text ?? '';
            const parsed = parsePatchOperations(String(rawReply), docText);
            if (parsed.ok) {
              const applied = applyPatchOperations(editor, parsed.operations);
              if (applied > 0) {
                // C6 — patch ops join the same provenance audit as selection edits.
                const scope = streamContext?.provenanceScope;
                if (scope) {
                  const { recordProvenanceEvent } = await import('./canvasProvenanceLog');
                  for (const op of parsed.operations) {
                    recordProvenanceEvent(scope, {
                      kind: 'apply',
                      at: Date.now(),
                      prompt,
                      originalExcerpt: op.anchor,
                      replacementExcerpt: op.replacement,
                    });
                  }
                }
                setIsStreaming(false);
                abortControllerRef.current = null;
                // Surface Accept/Reject + Esc in CanvasRichEditor and the brief
                // chat reply in UnifiedChatPanel. Markdown is NOT reconciled
                // here — accept/reject does that, exactly like selection edits.
                window.dispatchEvent(new CustomEvent('canvas-patch-pending'));
                window.dispatchEvent(
                  new CustomEvent('canvas-patch-result', {
                    detail: { status: 'applied', opsApplied: applied },
                  })
                );
                return;
              }
            }
          }
        } catch (err: any) {
          if (err?.name === 'AbortError') {
            setIsStreaming(false);
            abortControllerRef.current = null;
            return;
          }
          // Network/parse crash — degrade to the fallback stream below.
        }
        // Patch could not be applied (parse/anchor validation failed) —
        // visible note in chat, then the existing replace stream takes over.
        window.dispatchEvent(
          new CustomEvent('canvas-patch-result', { detail: { status: 'fallback' } })
        );
      }

      // Capture document + selection BEFORE mutating the editor, so Teresa
      // receives the real pre-edit state as context.
      const { from: selFrom, to: selTo } = editor.state.selection;
      const selectedText =
        selFrom !== selTo ? editor.state.doc.textBetween(selFrom, selTo, ' ') : '';
      const documentMarkdown = htmlToMarkdown(editor.getHTML()).trim();

      // Determine insertion point
      if (streamMode === 'append') {
        editor.commands.focus('end');
        editor.commands.insertContent('\n\n');
      } else if (streamMode === 'replace') {
        if (selFrom !== selTo) {
          editor
            .chain()
            .focus()
            .setTextSelection({ from: selFrom, to: selTo })
            .setMark('aiRemoved')
            .run();
        }
      }
      insertPositionRef.current = editor.state.selection.to;
      // N-canvas-append: remember where the streamed region starts so we can
      // swap the live plain-text projection for parsed block nodes on complete.
      appendStartRef.current = insertPositionRef.current;
      accumulatedMdRef.current = '';

      // C1.2: lock the editor while Teresa is writing so user clicks can't move
      // the cursor between chunks. We track and restore the prior editable flag.
      wasEditableRef.current = editor.isEditable;
      editor.setEditable(false);

      // Give Teresa document awareness via systemInstruction (the /chat/stream
      // handler appends it to the workspace prompt). The structured packet
      // (title/kind/blocks/selection) rides along in context.canvasContextPacket.
      const modeGuidance =
        streamMode === 'replace'
          ? 'Rewrite ONLY the user-selected portion below. Return just the replacement prose — no preamble, no explanations, no markdown code fences.'
          : 'Continue and extend the document. Return ONLY the new prose to insert — no preamble, no explanations, no code fences, and do not repeat content already present.';
      const systemInstruction = [
        "You are writing directly INTO the user's open Canvas document on their behalf.",
        documentMarkdown
          ? `Current document (Markdown):\n"""\n${documentMarkdown.slice(0, 12000)}\n"""`
          : 'The document is currently empty.',
        selectedText ? `User-selected portion:\n"""\n${selectedText.slice(0, 4000)}\n"""` : '',
        modeGuidance,
      ]
        .filter(Boolean)
        .join('\n\n');

      try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/ai/chat/stream', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: prompt,
            history: streamContext?.history || [],
            systemInstruction,
            language: streamContext?.language,
            context: {
              source: 'canvas_stream',
              mode: streamMode,
              canvasContextPacket: streamContext?.canvasContextPacket || null,
            },
            options: { selectedTier: 'STANDARD' },
          }),
          signal: abortController.signal,
        });

        if (!response.ok || !response.body) {
          setIsStreaming(false);
          onError?.(i18n.t('canvas.aiStream.streamRequestFailed', 'Stream request failed'));
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split('\n\n');
          buffer = events.pop() || '';

          for (const event of events) {
            if (!event.startsWith('data: ')) continue;
            const dataStr = event.slice(6).trim();

            if (dataStr === '[DONE]') continue;

            try {
              const data = JSON.parse(dataStr);

              // Handle content chunks
              if (data.content || data.text || data.delta) {
                const chunk = data.content || data.text || data.delta;
                if (chunk && editor && !abortController.signal.aborted) {
                  // C1.2: insert at the CAPTURED position (advanced after each
                  // chunk), not the live selection — see insertPositionRef.
                  const pos: number = insertPositionRef.current ?? editor.state.selection.to;
                  editor.commands.insertContentAt(pos, chunk);
                  insertPositionRef.current = pos + String(chunk).length;
                  accumulatedMdRef.current += String(chunk);
                }
              }

              // Handle error events
              if (data.type === 'error') {
                onError?.(data.message || i18n.t('canvas.aiStream.streamError', 'Stream error'));
                break;
              }
            } catch {
              // Non-JSON event, might be plain text chunk
              if (
                dataStr &&
                !dataStr.startsWith('{') &&
                editor &&
                !abortController.signal.aborted
              ) {
                // C1.2: same position-aware insertion as the structured chunks above.
                const pos: number = insertPositionRef.current ?? editor.state.selection.to;
                editor.commands.insertContentAt(pos, dataStr);
                insertPositionRef.current = pos + dataStr.length;
                accumulatedMdRef.current += dataStr;
              }
            }
          }
        }

        // Stream complete
        setIsStreaming(false);
        abortControllerRef.current = null;
        // C1.2: restore editability we locked during streaming.
        if (editor && wasEditableRef.current !== null) {
          editor.setEditable(wasEditableRef.current);
          wasEditableRef.current = null;
        }

        if (!abortController.signal.aborted) {
          // N-canvas-append: the chunks were streamed in as PLAIN TEXT for live
          // "writing…" feedback, so any `## heading` / `1. list` markers sit
          // inline inside one paragraph (Turndown would escape them to literal
          // "\##" that never re-renders). Now that the full markdown is known,
          // delete that plain-text projection and re-insert it PARSED into real
          // block nodes, with block spacing enforced first. Everything BEFORE
          // appendStart (the original document) is left untouched → append stays
          // strictly additive and cannot shrink/replace the prior content.
          const startPos = appendStartRef.current;
          const rawStreamed = accumulatedMdRef.current.trim();
          // Only reconcile additive streams (append/generate). 'replace' keeps
          // its aiRemoved diff workflow untouched to avoid regressing the
          // accept/reject selection-edit path.
          if (streamMode !== 'replace' && startPos !== null && rawStreamed) {
            const normalized = ensureBlockSpacing(rawStreamed);
            const html = markdownToHtml(normalized);
            const endPos = Math.min(
              insertPositionRef.current ?? editor.state.doc.content.size,
              editor.state.doc.content.size
            );
            editor
              .chain()
              .deleteRange({ from: Math.min(startPos, endPos), to: endPos })
              .insertContentAt(Math.min(startPos, endPos), html, {
                parseOptions: { preserveWhitespace: false },
              })
              .run();
          }

          // 'replace' marked the original selection as aiRemoved and streamed the
          // new content right after it — now drop the original so the document
          // reflects a true replacement.
          if (streamMode === 'replace') {
            const { collectMarkedRanges, AI_REMOVED_MARK } = await import('./canvasDiffOps');
            const removed = collectMarkedRanges(editor, AI_REMOVED_MARK);
            let chain = editor.chain();
            for (let i = removed.length - 1; i >= 0; i--) {
              chain = chain.deleteRange(removed[i]);
            }
            chain.run();
          }
          const finalMd = htmlToMarkdown(editor.getHTML());
          onComplete?.(finalMd);
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          // User stopped — not an error
        } else {
          onError?.(err?.message || i18n.t('canvas.aiStream.streamFailed', 'Stream failed'));
        }
        setIsStreaming(false);
        abortControllerRef.current = null;
        // C1.2: restore editability on error too.
        if (editor && wasEditableRef.current !== null) {
          editor.setEditable(wasEditableRef.current);
          wasEditableRef.current = null;
        }
      }
    },
    [editor, isStreaming, onComplete, onError]
  );

  return { isStreaming, streamToCanvas, stopStream };
}
