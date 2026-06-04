/**
 * Hook for streaming AI-generated content directly into the TipTap Canvas editor.
 * Teresa writes to the document in real-time — user sees text appearing.
 *
 * Uses the existing SSE streaming infrastructure (same as useAIStream.ts)
 * but routes output to TipTap editor instead of chat messages.
 */

import type { Editor } from '@tiptap/react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { htmlToMarkdown } from './canvasMarkdownConversion';

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
}

export interface UseCanvasAIStreamReturn {
  isStreaming: boolean;
  streamToCanvas: (
    prompt: string,
    mode: 'append' | 'replace' | 'generate',
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
    async (
      prompt: string,
      mode: 'append' | 'replace' | 'generate',
      streamContext?: CanvasStreamContext
    ) => {
      if (!editor || isStreaming) return;

      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      setIsStreaming(true);

      // Capture document + selection BEFORE mutating the editor, so Teresa
      // receives the real pre-edit state as context.
      const { from: selFrom, to: selTo } = editor.state.selection;
      const selectedText =
        selFrom !== selTo ? editor.state.doc.textBetween(selFrom, selTo, ' ') : '';
      const documentMarkdown = htmlToMarkdown(editor.getHTML()).trim();

      // Determine insertion point
      if (mode === 'append') {
        editor.commands.focus('end');
        editor.commands.insertContent('\n\n');
      } else if (mode === 'replace') {
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

      // C1.2: lock the editor while Teresa is writing so user clicks can't move
      // the cursor between chunks. We track and restore the prior editable flag.
      wasEditableRef.current = editor.isEditable;
      editor.setEditable(false);

      // Give Teresa document awareness via systemInstruction (the /chat/stream
      // handler appends it to the workspace prompt). The structured packet
      // (title/kind/blocks/selection) rides along in context.canvasContextPacket.
      const modeGuidance =
        mode === 'replace'
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
              mode,
              canvasContextPacket: streamContext?.canvasContextPacket || null,
            },
            options: { selectedTier: 'STANDARD' },
          }),
          signal: abortController.signal,
        });

        if (!response.ok || !response.body) {
          setIsStreaming(false);
          onError?.('Stream request failed');
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
                }
              }

              // Handle error events
              if (data.type === 'error') {
                onError?.(data.message || 'Stream error');
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
          // 'replace' marked the original selection as aiRemoved and streamed the
          // new content right after it — now drop the original so the document
          // reflects a true replacement.
          if (mode === 'replace') {
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
          onError?.(err?.message || 'Stream failed');
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
