/**
 * Guards the #6b fix: Teresa must stream into the Canvas WITH document and
 * conversation context, not blind. Asserts the /chat/stream request body
 * carries the current document markdown (in systemInstruction), the chat
 * history, language, and the canvasContextPacket.
 */

import { Editor } from '@tiptap/core';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useCanvasAIStream } from '@/components/AIChat/CanvasEditor/useCanvasAIStream';
import { getCanvasEditorExtensions } from '@/components/AIChat/CanvasEditor/canvasEditorExtensions';

function makeEditor(): Editor {
  return new Editor({
    extensions: getCanvasEditorExtensions(),
    content: '<p>Existing intro paragraph.</p>',
  });
}

// A fetch mock that captures the request body and returns an immediately-closed
// SSE stream so the hook's read loop completes cleanly.
function stubFetchCapturing(): { bodyRef: { value: any } } {
  const bodyRef: { value: any } = { value: null };
  const fetchMock = vi.fn(async (_url: string, init: any) => {
    bodyRef.value = JSON.parse(init.body);
    return {
      ok: true,
      body: { getReader: () => ({ read: async () => ({ done: true, value: undefined }) }) },
    } as unknown as Response;
  });
  vi.stubGlobal('fetch', fetchMock);
  return { bodyRef };
}

let editor: Editor;

beforeEach(() => {
  editor = makeEditor();
});

afterEach(() => {
  vi.unstubAllGlobals();
  editor.destroy();
});

describe('useCanvasAIStream — context-aware streaming (#6b)', () => {
  it('sends the current document, history, language and packet to /chat/stream', async () => {
    const { bodyRef } = stubFetchCapturing();
    const onComplete = vi.fn();

    const { result } = renderHook(() => useCanvasAIStream({ editor, onComplete }));

    await act(async () => {
      result.current.streamToCanvas('Dopisz podsumowanie', 'append', {
        language: 'pl',
        history: [{ role: 'user', parts: [{ text: 'poprzednia wiadomość' }] }],
        canvasContextPacket: { schemaVersion: 3, activeDraft: { title: 'Plan' } },
      });
    });

    await waitFor(() => expect(bodyRef.value).not.toBeNull());
    const body = bodyRef.value;

    // The document content is threaded into systemInstruction — NOT blind.
    expect(body.systemInstruction).toContain('Existing intro paragraph');
    expect(body.systemInstruction).toMatch(/INTO the user/i);

    // Conversation + locale + structured packet ride along.
    expect(body.language).toBe('pl');
    expect(body.history).toHaveLength(1);
    expect(body.history[0].parts[0].text).toBe('poprzednia wiadomość');
    expect(body.context.source).toBe('canvas_stream');
    expect(body.context.mode).toBe('append');
    expect(body.context.canvasContextPacket).toEqual({
      schemaVersion: 3,
      activeDraft: { title: 'Plan' },
    });

    await waitFor(() => expect(onComplete).toHaveBeenCalled());
  });

  it('does not stream when there is no editor', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useCanvasAIStream({ editor: null }));
    await act(async () => {
      result.current.streamToCanvas('anything', 'append');
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
