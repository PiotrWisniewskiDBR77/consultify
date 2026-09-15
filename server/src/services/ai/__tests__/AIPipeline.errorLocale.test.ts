import { describe, expect, it } from 'vitest';

import { AIPipeline } from '../AIPipeline.js';

describe('AIPipeline user-visible error locale', () => {
  it('localizes the execute/stream error payload from the request locale', () => {
    const pipeline = AIPipeline.getInstance() as unknown as {
      handleError(error: unknown, language?: string): { code: string; message: string };
    };

    expect(pipeline.handleError(new Error('Model not allowed by policy: gpt-x'), 'pl-PL')).toEqual(
      expect.objectContaining({
        code: 'AI_ERROR',
        message: 'Model niedozwolony przez politykę: gpt-x',
      })
    );
  });

  it('emits Polish stream and execute error payloads on real public methods', async () => {
    const pipeline = AIPipeline.getInstance();
    const invalid = {
      capability: '' as never,
      prompt: 'test',
      userId: 'user-a',
      options: { language: 'pl' },
    };
    const streamed: unknown[] = [];
    await pipeline.processStream(invalid, (chunk) => streamed.push(chunk));
    expect(streamed).toContainEqual(
      expect.objectContaining({
        type: 'error',
        error: expect.objectContaining({ message: 'Wymagana jest zdolność' }),
      })
    );
    await expect(pipeline.process(invalid)).resolves.toEqual(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ message: 'Wymagana jest zdolność' }),
      })
    );
  });
});
