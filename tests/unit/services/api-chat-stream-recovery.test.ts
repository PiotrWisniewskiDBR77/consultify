import { afterEach, describe, expect, it, vi } from 'vitest';

vi.unmock('@/services/api');
import { Api } from '@/services/api';

function sseResponse(events: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const event of events) controller.enqueue(encoder.encode(event));
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('CHAT-02 stream transport recovery', () => {
  it('reports the canonical stream owner and no hidden V8 fallback', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      sseResponse(['data: {"text":"Hello"}\n\n', 'data: [DONE]\n\n'])
    );
    const onThinking = vi.fn();
    await Api.chatWithAIStream(
      'hello',
      [],
      vi.fn(),
      vi.fn(),
      undefined,
      undefined,
      undefined,
      undefined,
      onThinking
    );
    expect(onThinking).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'stream_transport',
        endpoint: '/api/ai/chat/stream',
        fallback: 'none',
        v8Role: 'snapshot_and_handoff_only',
      })
    );
  });

  it('rejects an empty successful SSE response instead of persisting fallback prose', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(sseResponse(['data: [DONE]\n\n']));
    const onChunk = vi.fn();
    const onDone = vi.fn();
    await expect(Api.chatWithAIStream('hello', [], onChunk, onDone)).rejects.toMatchObject({
      code: 'EMPTY_STREAM',
    });
    expect(onChunk).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });

  it('rejects a non-SSE HTTP failure instead of completing a synthetic answer', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'provider unavailable', code: 'NO_LLM_PROVIDER' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    const onChunk = vi.fn();
    const onDone = vi.fn();
    await expect(Api.chatWithAIStream('hello', [], onChunk, onDone)).rejects.toMatchObject({
      code: 'NO_LLM_PROVIDER',
      httpStatus: 503,
    });
    expect(onChunk).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });

  it('propagates a retryable provider SSE error instead of completing it as success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      sseResponse([
        'data: {"error":"provider disconnected","code":"AI_STREAM_ERROR"}\n\n',
        'data: [DONE]\n\n',
      ])
    );
    const onChunk = vi.fn();
    const onDone = vi.fn();

    await expect(Api.chatWithAIStream('hello', [], onChunk, onDone)).rejects.toMatchObject({
      code: 'AI_STREAM_ERROR',
    });
    expect(onChunk).toHaveBeenCalledWith(expect.stringContaining('error'));
    expect(onDone).not.toHaveBeenCalled();
  });

  it('streams fragmented text and completes exactly once', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      sseResponse(['data: {"text":"Hel', 'lo"}\n\n', 'data: [DONE]\n\n'])
    );
    const onChunk = vi.fn();
    const onDone = vi.fn();

    await Api.chatWithAIStream('hello', [], onChunk, onDone);

    expect(onChunk).toHaveBeenCalledWith('Hello');
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
