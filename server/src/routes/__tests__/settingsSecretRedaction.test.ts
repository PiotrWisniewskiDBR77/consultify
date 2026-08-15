import { describe, expect, it } from 'vitest';

import { redactUserAIProviderSecrets } from '../settings.routes.js';

describe('settings secret response contract', () => {
  it('never returns a personal provider API key after save or reload', () => {
    const response = redactUserAIProviderSecrets([
      {
        id: 'provider-1',
        name: 'Private OpenAI',
        provider: 'openai',
        apiKey: 'sk-never-return-this',
        endpoint: undefined,
        isEnabled: true,
        isLocal: false,
      },
    ]);

    expect(response).toEqual([
      expect.objectContaining({ id: 'provider-1', hasApiKey: true }),
    ]);
    expect(JSON.stringify(response)).not.toContain('sk-never-return-this');
    expect(response[0]).not.toHaveProperty('apiKey');
  });
});
