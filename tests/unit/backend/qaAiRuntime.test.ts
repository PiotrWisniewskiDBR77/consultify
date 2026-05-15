import { afterEach, describe, expect, it } from 'vitest';

import { llmService } from '../../../server/src/services/ai/llmService.js';
import {
  buildQaResearchChatResponse,
  buildQaWebSearchResults,
  isQaAiMode,
} from '../../../server/src/services/ai/qaAiRuntime.js';

describe('QA AI runtime mode', () => {
  afterEach(() => {
    delete process.env.QA_AI_MODE;
    delete process.env.AI_PROVIDER_MODE;
    delete process.env.CONSULTIFY_MOCK_AI;
  });

  it('detects QA mock flags used by staging acceptance', () => {
    process.env.AI_PROVIDER_MODE = 'mock';

    expect(isQaAiMode()).toBe(true);
  });

  it('returns deterministic text without a provider api key', async () => {
    process.env.QA_AI_MODE = 'true';

    const result = await llmService.call({
      type: 'chat',
      modelConfig: { provider: 'openai', id: 'gpt-test' },
      systemPrompt: 'You are Teresa.',
      messages: [{ role: 'user', content: 'QA TEST hello' }],
    });

    expect(result.content).toContain('QA MOCK RESPONSE');
    expect(result.qaMock).toBe(true);
  });

  it('returns deterministic stream chunks without live provider calls', async () => {
    process.env.QA_AI_MODE = 'true';

    const result = await llmService.call({
      type: 'chat',
      stream: true,
      modelConfig: { provider: 'openai', id: 'gpt-test' },
      messages: [{ role: 'user', content: 'QA TEST stream' }],
    });

    let text = '';
    for await (const chunk of result.stream as AsyncIterable<string>) {
      text += chunk;
    }
    expect(text).toContain('QA MOCK RESPONSE');
  });

  it('supports deterministic research query generation and web evidence', () => {
    const response = buildQaResearchChatResponse({
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: 'Return as JSON object with queries' }],
    });
    const parsed = JSON.parse(response);
    const search = buildQaWebSearchResults('AI OS readiness') as any;

    expect(parsed.queries).toHaveLength(2);
    expect(search.results[0].url).toContain('demo.consultify.ai');
  });
});
