import { beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { makeInitiativesApp } from './_helpers/makeInitiativesApp';

describe('Initiatives AI generation (honest 503; no placeholder content)', () => {
  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.MOCK_DB = 'false';
    process.env.ENABLE_TEST_AUTH_BYPASS = 'true';

    // Prevent accidental real calls by ensuring no API keys are present in tests.
    process.env.OPENAI_API_KEY = '';
    process.env.GEMINI_API_KEY = '';
    process.env.ANTHROPIC_API_KEY = '';

    vi.resetModules();

    const mod = await import('../../../server/src/database/DatabaseInitializer.ts');
    if (typeof (mod as any).initializeDatabase === 'function') {
      await (mod as any).initializeDatabase();
    }
  });

  it('POST /api/initiatives/generate-section returns 503 FEATURE_UNAVAILABLE when LLM is not usable', async () => {
    const app = await makeInitiativesApp({
      user: { id: 'test-user-id', organizationId: 'test-org-id' },
    });

    const res = await request(app).post('/api/initiatives/generate-section').send({
      sectionKey: 'overview',
      initiativeName: 'Test Initiative',
      language: 'en',
      // Intentionally omit initiativeId to avoid DB dependencies; this is an AI availability test.
    });

    expect(res.status).toBe(503);
    expect(res.body).toEqual(expect.objectContaining({ success: false, code: 'FEATURE_UNAVAILABLE' }));
  });

  it('POST /api/initiatives/suggest-sections returns 503 FEATURE_UNAVAILABLE when LLM is not usable', async () => {
    const app = await makeInitiativesApp({
      user: { id: 'test-user-id', organizationId: 'test-org-id' },
    });

    const res = await request(app).post('/api/initiatives/suggest-sections').send({
      initiativeName: 'Test Initiative',
      language: 'en',
    });

    expect(res.status).toBe(503);
    expect(res.body).toEqual(expect.objectContaining({ success: false, code: 'FEATURE_UNAVAILABLE' }));
  });
});
