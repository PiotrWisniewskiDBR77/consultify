import { createOpenAI } from '@ai-sdk/openai';
import { generateText, type ModelMessage } from 'ai';
import { describe, expect, it, vi } from 'vitest';

import { buildMultimodalContent } from '../imageService.js';

describe('CHAT-IMG-1 AI SDK v6 image contract', () => {
  it('accepts ImagePart and serializes it for the real OpenAI adapter', async () => {
    let requestBody: any = null;
    const fakeFetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      requestBody = JSON.parse(String(init?.body || '{}'));
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
    const imageDataUrl = `data:image/png;base64,${Buffer.from('pixel-data').toString('base64')}`;
    const messages: ModelMessage[] = [
      {
        role: 'user',
        content: buildMultimodalContent('Describe the screenshot.', [
          {
            base64: Buffer.from('pixel-data').toString('base64'),
            mimeType: 'image/png',
            originalSize: 10,
            processedSize: 10,
            width: 1,
            height: 1,
          },
        ]),
      },
    ];

    const result = await generateText({ model: openai.chat('gpt-4o-mini'), messages });

    expect(result.text).toBe('A blue chart is visible.');
    expect(fakeFetch).toHaveBeenCalledTimes(1);
    expect(requestBody.messages[0].content).toEqual([
      { type: 'text', text: 'Describe the screenshot.' },
      { type: 'image_url', image_url: { url: imageDataUrl } },
    ]);
  });
});
