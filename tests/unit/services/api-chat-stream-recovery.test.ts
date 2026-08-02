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
