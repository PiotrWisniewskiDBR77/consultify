import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import helpRoutes from '../help.routes.js';

const mockGetContextualArticles = vi.fn();

vi.mock('../../../middleware/v8Auth.middleware.js', () => ({
  getV8Context: vi.fn(),
}));

vi.mock('../../../services/KnowledgeBaseService.js', () => ({
  default: {
    getContextualArticles: (...a: unknown[]) => mockGetContextualArticles(...a),
  },
}));

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/v8/help', helpRoutes);
  return app;
}

describe('V8 Help recommendations route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns help-reco-v1 payload with context + recommendations', async () => {
    mockGetContextualArticles.mockResolvedValue([{ id: 'a1', slug: 'p25b-tools-primer' }]);

    const res = await request(createApp()).get(
      '/api/v8/help/recommendations?surface_id=tools&module_id=discovery-tools&locale=pl-PL'
    );

    expect(res.status).toBe(200);
    expect(res.body?.data?.version).toBe('help-reco-v1');
    expect(res.body?.data?.context?.surface_id).toBe('tools');
    expect(res.body?.data?.context?.module_id).toBe('discovery-tools');
    expect(res.body?.data?.recommendations?.[0]?.article_id).toBe('p25b-tools-primer');
    expect(res.body?.data?.recommendations?.[0]?.rationale?.pl).toMatch(/Jesteś w/i);
  });

  it('returns empty recommendations when KB has no articles', async () => {
    mockGetContextualArticles.mockResolvedValue([]);

    const res = await request(createApp()).get(
      '/api/v8/help/recommendations?surface_id=tools&locale=en-US'
    );

    expect(res.status).toBe(200);
    expect(res.body?.data?.version).toBe('help-reco-v1');
    expect(res.body?.data?.recommendations).toEqual([]);
    expect(res.body?.data?.context?.locale).toBe('en-US');
  });

  it('normalizes pl-PL locale to pl for KB query', async () => {
    mockGetContextualArticles.mockResolvedValue([{ id: 'a2', slug: 'test-article' }]);

    await request(createApp()).get(
      '/api/v8/help/recommendations?surface_id=interview&locale=pl-PL'
    );

    expect(mockGetContextualArticles).toHaveBeenCalledWith('interview', 'pl', 5);
  });

  it('defaults unknown locale to en', async () => {
    mockGetContextualArticles.mockResolvedValue([]);

    await request(createApp()).get(
      '/api/v8/help/recommendations?surface_id=interview&locale=de-DE'
    );

    expect(mockGetContextualArticles).toHaveBeenCalledWith('interview', 'en', 5);
  });

  it('returns bilingual rationale with en + pl', async () => {
    mockGetContextualArticles.mockResolvedValue([{ id: 'a3', slug: 'outputs-primer' }]);

    const res = await request(createApp()).get(
      '/api/v8/help/recommendations?surface_id=results&module_id=outputs&locale=en-US'
    );

    const reco = res.body?.data?.recommendations?.[0];
    expect(reco?.rationale?.en).toBeTruthy();
    expect(reco?.rationale?.pl).toBeTruthy();
  });
});
