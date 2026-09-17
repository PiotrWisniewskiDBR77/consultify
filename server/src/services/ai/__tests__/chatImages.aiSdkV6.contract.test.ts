import { createOpenAI } from '@ai-sdk/openai';
import { generateText, type ModelMessage } from 'ai';
import { describe, expect, it, vi } from 'vitest';

import { prepareChatImages } from '../../../routes/ai.routes.js';
import { attachChatImagesToLastUserMessage } from '../AIPipeline.js';

describe('CHAT-IMG-1 AI SDK v6 image contract', () => {
  it('keeps the persisted image on the second turn and serializes image_url for OpenAI', async () => {
    type OpenAIRequestBody = { messages: Array<{ content: unknown }> };
    let requestBody: OpenAIRequestBody | null = null;
    const fakeFetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      requestBody = JSON.parse(String(init?.body || '{}')) as OpenAIRequestBody;
      return new Response(
        JSON.stringify({
          id: 'chatcmpl-test',
          object: 'chat.completion',
          created: 1,
          model: 'gpt-4o-mini',
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: 'A blue chart is visible.' },
              finish_reason: 'stop',
            },
          ],
          usage: { prompt_tokens: 12, completion_tokens: 6, total_tokens: 18 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    });
    const openai = createOpenAI({ apiKey: 'test-key', fetch: fakeFetch as typeof fetch });
    const validPngBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
    const persistedDataUrl = `data:image/png;base64,${validPngBase64}`;
    const preparedImages = await prepareChatImages([
      { name: 'process.png', mimeType: 'image/png', dataUrl: persistedDataUrl },
    ]);
    const imageDataUrl = `data:${preparedImages[0].mimeType};base64,${preparedImages[0].base64}`;
    const messages = attachChatImagesToLastUserMessage(
      [
        { role: 'user', content: 'This image shows the current process.' },
        { role: 'assistant', content: 'I can inspect it with you.' },
        { role: 'user', content: 'What bottleneck do you see now?' },
      ],
      preparedImages
    ) as ModelMessage[];

    const result = await generateText({ model: openai.chat('gpt-4o-mini'), messages });

    expect(result.text).toBe('A blue chart is visible.');
    expect(fakeFetch).toHaveBeenCalledTimes(1);
    expect(requestBody?.messages[2]?.content).toEqual([
      { type: 'text', text: 'What bottleneck do you see now?' },
      { type: 'image_url', image_url: { url: imageDataUrl } },
    ]);
  });
});
