import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { CreateInitiativeSchema } from '../../../server/src/validators/initiative.validators.js';
import { makeInitiativesApp } from './_helpers/makeInitiativesApp';

const {
  mockSectionTypeDelete,
  mockSectionTypeDuplicate,
  mockSectionTypeGetById,
  mockInitiativeController,
  mockTemplateService,
} = vi.hoisted(() => ({
  mockSectionTypeDelete: vi.fn(),
  mockSectionTypeDuplicate: vi.fn(),
  mockSectionTypeGetById: vi.fn(),
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
}));

vi.mock('../../../../server/src/services/initiativeSectionTypeService.js', () => ({
  default: {
    deleteSectionType: (...args: any[]) => mockSectionTypeDelete(...args),
    duplicateSectionType: (...args: any[]) => mockSectionTypeDuplicate(...args),
    getSectionTypeById: (...args: any[]) => mockSectionTypeGetById(...args),
  },
}));

vi.mock('../../../../server/src/services/initiativeGenerationService.js', () => ({
  default: {
    generateSectionContent: vi.fn(),
    suggestSections: vi.fn(),
  },
}));

vi.mock('../../../../server/src/controllers/InitiativeController.js', () => ({
  default: mockInitiativeController,
}));

vi.mock('../../../../server/src/services/initiativeTemplateService.js', () => ({
  default: mockTemplateService,
}));

describe('Initiatives routes: /section-types (REAL integration)', () => {
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

  it('DELETE /section-types/:id returns success', async () => {
    mockSectionTypeGetById.mockResolvedValueOnce({
      id: 'abc',
      isSystem: false,
      organizationId: 'test-org-id',
    });
    mockSectionTypeDelete.mockResolvedValueOnce(undefined);
    const app = await makeInitiativesApp();
    const res = await request(app).delete('/api/initiatives/section-types/abc');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
  });

  it('DELETE /section-types/:id returns 403 when system section is blocked', async () => {
    mockSectionTypeGetById.mockResolvedValueOnce({
      id: 'system',
      isSystem: true,
      organizationId: null,
    });
    const app = await makeInitiativesApp();
    const res = await request(app).delete('/api/initiatives/section-types/system');
    expect(res.status).toBe(403);
    expect(res.body).toEqual(expect.objectContaining({ error: expect.any(String) }));
  });

  it('DELETE /section-types/:id returns 500 on other errors', async () => {
    mockSectionTypeGetById.mockRejectedValueOnce(new Error('boom'));
    const app = await makeInitiativesApp();
    const res = await request(app).delete('/api/initiatives/section-types/abc');
    expect(res.status).toBe(500);
    expect(res.body).toEqual(expect.objectContaining({ error: 'Failed to delete section type' }));
  });

  it('POST /section-types/:id/duplicate returns 403 when org is missing', async () => {
    const app = await makeInitiativesApp({ user: { organizationId: '' } });
    const res = await request(app).post('/api/initiatives/section-types/abc/duplicate').send({});
    expect(res.status).toBe(403);
    expect(res.body).toEqual(expect.objectContaining({ error: 'Organization access required' }));
  });

  it('POST /section-types/:id/duplicate returns 201 and passes orgId + userId', async () => {
    mockSectionTypeGetById.mockResolvedValueOnce({
      id: 'abc',
      organizationId: null,
    });
    mockSectionTypeDuplicate.mockResolvedValueOnce({ id: 'dup-1' });
    const app = await makeInitiativesApp({ user: { id: 'u-1', organizationId: 'org-1' } });
    const res = await request(app).post('/api/initiatives/section-types/abc/duplicate').send({});
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: 'dup-1' });
    expect(mockSectionTypeDuplicate).toHaveBeenCalledWith('abc', 'org-1', 'u-1');
  });
});
