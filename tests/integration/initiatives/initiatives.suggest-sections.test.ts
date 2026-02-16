import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { CreateInitiativeSchema } from '../../../server/src/validators/initiative.validators.js';
import { makeInitiativesApp } from './_helpers/makeInitiativesApp';

const {
  mockSuggestSections,
  mockInitiativeController,
  mockTemplateService,
  mockSectionTypeService,
} = vi.hoisted(() => ({
  mockSuggestSections: vi.fn(),
  mockInitiativeController: new Proxy(
    {},
    {
      get: () => (_req: any, res: any) => res.status(501).json({ error: 'not-mocked' }),
    }
  ),
  mockTemplateService: {
    getTemplates: vi.fn(),
    getTemplateById: vi.fn(),
    createTemplate: vi.fn(),
    updateTemplate: vi.fn(),
    deleteTemplate: vi.fn(),
  },
  mockSectionTypeService: {
    deleteSectionType: vi.fn(),
    duplicateSectionType: vi.fn(),
  },
}));

vi.mock('../../../../server/src/services/initiativeGenerationService.js', () => ({
  default: {
    generateSectionContent: vi.fn(),
    suggestSections: (...args: any[]) => mockSuggestSections(...args),
  },
}));

vi.mock('../../../../server/src/controllers/InitiativeController.js', () => ({
  default: mockInitiativeController,
}));

vi.mock('../../../../server/src/services/initiativeTemplateService.js', () => ({
  default: mockTemplateService,
}));

vi.mock('../../../../server/src/services/initiativeSectionTypeService.js', () => ({
  default: mockSectionTypeService,
}));

describe('Initiatives routes: POST /suggest-sections (REAL integration)', () => {
  void CreateInitiativeSchema;
  const origNodeEnv = process.env.NODE_ENV;
  const origBypass = process.env.ENABLE_TEST_AUTH_BYPASS;
  const origMockDb = process.env.MOCK_DB;
  const origTestType = process.env.TEST_TYPE;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.ENABLE_TEST_AUTH_BYPASS = 'true';
    process.env.MOCK_DB = 'false';
    process.env.TEST_TYPE = 'integration';
  });

  afterAll(() => {
    if (origNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = origNodeEnv;
    if (origBypass === undefined) delete process.env.ENABLE_TEST_AUTH_BYPASS;
    else process.env.ENABLE_TEST_AUTH_BYPASS = origBypass;
    if (origMockDb === undefined) delete process.env.MOCK_DB;
    else process.env.MOCK_DB = origMockDb;
    if (origTestType === undefined) delete process.env.TEST_TYPE;
    else process.env.TEST_TYPE = origTestType;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when organizationId is missing', async () => {
    const app = await makeInitiativesApp({ user: { organizationId: '' } });
    const res = await request(app).post('/api/initiatives/suggest-sections').send({
      initiativeName: 'X',
    });
    expect(res.status).toBe(401);
    expect(res.body).toEqual(expect.objectContaining({ error: 'Unauthorized' }));
  });

  it('defaults language to en', async () => {
    mockSuggestSections.mockResolvedValueOnce([{ key: 'overview', reason: 'r', priority: 'high' }]);
    const app = await makeInitiativesApp({ user: { organizationId: 'org-1' } });
    const res = await request(app).post('/api/initiatives/suggest-sections').send({
      initiativeName: 'X',
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      suggestions: [{ key: 'overview', reason: 'r', priority: 'high' }],
    });
    expect(mockSuggestSections).toHaveBeenCalledWith(
      expect.objectContaining({ initiativeName: 'X', language: 'en' }),
      'org-1'
    );
  });

  it('passes through explicit language', async () => {
    mockSuggestSections.mockResolvedValueOnce([]);
    const app = await makeInitiativesApp({ user: { organizationId: 'org-2' } });
    const res = await request(app).post('/api/initiatives/suggest-sections').send({
      initiativeName: 'X',
      language: 'pl',
    });
    expect(res.status).toBe(200);
    expect(mockSuggestSections).toHaveBeenCalledWith(
      expect.objectContaining({ language: 'pl' }),
      'org-2'
    );
  });

  it('returns 500 when suggestSections throws', async () => {
    mockSuggestSections.mockRejectedValueOnce(new Error('boom'));
    const app = await makeInitiativesApp();
    const res = await request(app).post('/api/initiatives/suggest-sections').send({
      initiativeName: 'X',
    });
    expect(res.status).toBe(500);
    expect(res.body).toEqual(
      expect.objectContaining({ error: 'Failed to suggest sections', message: 'boom' })
    );
  });

  it('returns suggestions wrapper even for empty list', async () => {
    mockSuggestSections.mockResolvedValueOnce([]);
    const app = await makeInitiativesApp();
    const res = await request(app).post('/api/initiatives/suggest-sections').send({
      initiativeName: 'X',
      summary: 'S',
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ suggestions: [] });
  });
});
