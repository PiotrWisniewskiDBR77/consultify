import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { CreateInitiativeSchema } from '../../../server/src/validators/initiative.validators.js';
import { makeInitiativesApp } from './_helpers/makeInitiativesApp';

const {
  mockGenerateSectionContent,
  mockInitiativeController,
  mockTemplateService,
  mockSectionTypeService,
} = vi.hoisted(() => ({
  mockGenerateSectionContent: vi.fn(),
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
    generateSectionContent: (...args: any[]) => mockGenerateSectionContent(...args),
    suggestSections: vi.fn(),
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

describe('Initiatives routes: POST /generate-section (REAL integration)', () => {
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

  it('returns 403 when organizationId is missing', async () => {
    const app = await makeInitiativesApp({ user: { organizationId: '' } });
    const res = await request(app).post('/api/initiatives/generate-section').send({
      sectionKey: 'overview',
      initiativeName: 'X',
    });
    expect(res.status).toBe(403);
    expect(res.body).toEqual(
      expect.objectContaining({ error: 'Organization access required' })
    );
  });

  it('returns 400 when sectionKey is missing', async () => {
    const app = await makeInitiativesApp();
    const res = await request(app).post('/api/initiatives/generate-section').send({
      initiativeName: 'X',
    });
    expect(res.status).toBe(400);
    expect(res.body).toEqual(expect.objectContaining({ error: 'sectionKey is required' }));
  });

  it('defaults language to en when missing', async () => {
    mockGenerateSectionContent.mockResolvedValueOnce({ ok: true });
    const app = await makeInitiativesApp({ user: { organizationId: 'org-1' } });
    const res = await request(app).post('/api/initiatives/generate-section').send({
      sectionKey: 'overview',
      initiativeName: 'X',
    });
    expect(res.status).toBe(200);
    expect(mockGenerateSectionContent).toHaveBeenCalledWith(
      'overview',
      expect.objectContaining({ initiativeName: 'X', language: 'en' }),
      'org-1',
      // F3.8 — reviewer §B4 defaults ON; route enables withReview unless body sends `false`.
      expect.objectContaining({ withReview: true })
    );
  });

  it('passes through explicit language', async () => {
    mockGenerateSectionContent.mockResolvedValueOnce({ ok: true });
    const app = await makeInitiativesApp({ user: { organizationId: 'org-2' } });
    const res = await request(app).post('/api/initiatives/generate-section').send({
      sectionKey: 'overview',
      initiativeName: 'X',
      language: 'pl',
    });
    expect(res.status).toBe(200);
    expect(mockGenerateSectionContent).toHaveBeenCalledWith(
      'overview',
      expect.objectContaining({ language: 'pl' }),
      'org-2',
      // F3.8 — reviewer §B4 defaults ON; route enables withReview unless body sends `false`.
      expect.objectContaining({ withReview: true })
    );
  });

  it('returns 500 when generation throws', async () => {
    mockGenerateSectionContent.mockRejectedValueOnce(new Error('boom'));
    const app = await makeInitiativesApp();
    const res = await request(app).post('/api/initiatives/generate-section').send({
      sectionKey: 'overview',
      initiativeName: 'X',
    });
    expect(res.status).toBe(500);
    expect(res.body).toEqual(
      expect.objectContaining({
        status: 'error',
        error: expect.objectContaining({ code: 'PMO_INITIATIVES_SECTION_GENERATION_FAILED' }),
      })
    );
  });
});
