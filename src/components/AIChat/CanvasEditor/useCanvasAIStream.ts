/**
 * Hook for streaming AI-generated content directly into the TipTap Canvas editor.
 * Teresa writes to the document in real-time — user sees text appearing.
 *
 * Uses the existing SSE streaming infrastructure (same as useAIStream.ts)
 * but routes output to TipTap editor instead of chat messages.
 */

import type { Editor } from '@tiptap/react';
import { useCallback, useRef, useState } from 'react';

export interface UseCanvasAIStreamOptions {
  editor: Editor | null;
  onComplete?: (finalMd: string) => void;
  onError?: (error: string) => void;
}

export interface UseCanvasAIStreamReturn {
  isStreaming: boolean;
  streamToCanvas: (prompt: string, mode: 'append' | 'replace' | 'generate') => void;
  stopStream: () => void;
}

export function useCanvasAIStream({
  editor,
  onComplete,
  onError,
}: UseCanvasAIStreamOptions): UseCanvasAIStreamReturn {
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const insertPositionRef = useRef<number | null>(null);

  const stopStream = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsStreaming(false);
  }, []);

  const streamToCanvas = useCallback(
    async (prompt: string, mode: 'append' | 'replace' | 'generate') => {
      if (!editor || isStreaming) return;

      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      setIsStreaming(true);

      // Determine insertion point
      if (mode === 'append') {
        editor.commands.focus('end');
        editor.commands.insertContent('\n\n');
      } else if (mode === 'replace') {
        const { from, to } = editor.state.selection;
        if (from !== to) {
          editor.chain().focus().setTextSelection({ from, to }).setMark('aiRemoved').run();
        }
      }
      insertPositionRef.current = editor.state.selection.to;

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
            history: [],
            context: { source: 'canvas_stream', mode },
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
                  editor.commands.insertContent(chunk);
                }
              }

              // Handle error events
              if (data.type === 'error') {
                onError?.(data.message || 'Stream error');
                break;
              }
            } catch {
              // Non-JSON event, might be plain text chunk
              if (dataStr && !dataStr.startsWith('{') && editor && !abortController.signal.aborted) {
                editor.commands.insertContent(dataStr);
              }
            }
          }
        }

        // Stream complete
        setIsStreaming(false);
        abortControllerRef.current = null;

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
          const { htmlToMarkdown } = await import('./canvasMarkdownConversion');
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
      }
    },
    [editor, isStreaming, onComplete, onError]
  );

  return { isStreaming, streamToCanvas, stopStream };
}
