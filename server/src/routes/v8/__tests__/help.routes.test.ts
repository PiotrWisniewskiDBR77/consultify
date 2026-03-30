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
});

