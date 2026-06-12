import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { publicKnowledgeBaseRoutes } from '../knowledge-base.routes.js';
import { V8_KB_READ_CONTRACT } from '../knowledge-base.routes.js';

vi.mock('../../../services/v8/featureFlagService.js', () => ({
  getV8Flags: vi.fn().mockResolvedValue({ v8_enabled: true }),
  getAllOrgFlags: vi.fn().mockResolvedValue([]),
  setV8OrgFlag: vi.fn().mockResolvedValue({}),
  isV8Enabled: vi.fn().mockResolvedValue(true),
  isV8ShadowMode: vi.fn().mockResolvedValue(false),
}));

vi.mock('../../../utils/v8MetricsStore.js', () => ({
  recordV8Request: vi.fn(),
  getV8MetricsSnapshot: vi.fn().mockReturnValue({}),
}));

vi.mock('../../../middleware/v8Metrics.middleware.js', () => ({
  v8MetricsMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const mockSearchArticles = vi.fn();
const mockGetArticleBySlug = vi.fn();
const mockGetContextualArticles = vi.fn();
const mockGetCategories = vi.fn();
const mockGetArticles = vi.fn();
const mockGetPublicPreview = vi.fn();
const mockGetFeaturedArticles = vi.fn();
const mockTrackView = vi.fn();

vi.mock('../../../services/KnowledgeBaseService.js', () => ({
  default: {
    getPublicPreview: (...a: unknown[]) => mockGetPublicPreview(...a),
    getFeaturedArticles: (...a: unknown[]) => mockGetFeaturedArticles(...a),
    getCategories: (...a: unknown[]) => mockGetCategories(...a),
    getArticles: (...a: unknown[]) => mockGetArticles(...a),
    searchArticles: (...a: unknown[]) => mockSearchArticles(...a),
    getArticleBySlug: (...a: unknown[]) => mockGetArticleBySlug(...a),
    getContextualArticles: (...a: unknown[]) => mockGetContextualArticles(...a),
    trackView: (...a: unknown[]) => mockTrackView(...a),
  },
}));

let mockUser: {
  id: string;
  role: string;
  organizationId: string;
  isSuperAdmin: boolean;
} | null = null;

vi.mock('../../../middleware/auth.middleware.js', () => ({
  default: (req: any, res: any, next: () => void) => {
    if (!mockUser) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }
    req.userId = mockUser.id;
    req.userRole = mockUser.role;
    req.organizationId = mockUser.organizationId;
    req.user = mockUser;
    req.can = () => true;
    next();
  },
  verifyToken: (req: any, res: any, next: () => void) => {
    if (!mockUser) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }
    req.userId = mockUser.id;
    req.userRole = mockUser.role;
    req.organizationId = mockUser.organizationId;
    req.user = mockUser;
    req.can = () => true;
    next();
  },
  requireSuperAdmin: (req: any, res: any, next: () => void) => {
    if (!req.user?.isSuperAdmin) {
      res.status(403).json({ error: 'Super admin access required' });
      return;
    }
    next();
  },
  requireRole: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  requireOrganization: (_req: unknown, _res: unknown, next: () => void) => next(),
  isAuthenticated: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import v8Router from '../index.js';

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/public/kb-v8', publicKnowledgeBaseRoutes);
  app.use('/api/v8', v8Router);
  return app;
}

const ORG = 'org-kb-v8';
const UID = 'user-kb-v8';

describe('V8 Knowledge Base read-only routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: UID, role: 'ADMIN', organizationId: ORG, isSuperAdmin: false };
  });

  it('GET /api/public/kb-v8/public is anonymous-safe and delegates to getPublicPreview', async () => {
    mockUser = null;
    mockGetPublicPreview.mockResolvedValue([{ id: 'pub-1', slug: 'preview', title: 'Preview' }]);

    const res = await request(createApp()).get('/api/public/kb-v8/public?lang=pl&limit=2');

    expect(res.status).toBe(200);
    expect(mockGetPublicPreview).toHaveBeenCalledWith('pl', 2, undefined);
    expect(res.body.data.articles).toHaveLength(1);
    expect(res.body.meta.contract).toBe(V8_KB_READ_CONTRACT);
  });

  it('GET /api/public/kb-v8/categories is anonymous-safe on the public bridge', async () => {
    mockUser = null;
    mockGetCategories.mockResolvedValue([{ id: 'cat-1', slug: 'guides', name: 'Guides' }]);

    const res = await request(createApp()).get('/api/public/kb-v8/categories?lang=en');

    expect(res.status).toBe(200);
    expect(mockGetCategories).toHaveBeenCalledWith('en', false, undefined);
    expect(res.body.data.categories).toHaveLength(1);
    expect(res.body.meta.contract).toBe(V8_KB_READ_CONTRACT);
  });

  it('GET /api/public/kb-v8/categories ignores all=true on the anonymous public bridge', async () => {
    mockUser = null;
    mockGetCategories.mockResolvedValue([{ id: 'cat-1', slug: 'guides', name: 'Guides' }]);

    const res = await request(createApp()).get('/api/public/kb-v8/categories?lang=en&all=true');

    expect(res.status).toBe(200);
    expect(mockGetCategories).toHaveBeenCalledWith('en', false, undefined);
    expect(res.body.data.categories).toHaveLength(1);
    expect(res.body.meta.contract).toBe(V8_KB_READ_CONTRACT);
  });

  it('GET /api/public/kb-v8/featured is anonymous-safe and delegates to getFeaturedArticles', async () => {
    mockUser = null;
    mockGetFeaturedArticles.mockResolvedValue([
      { id: 'feat-1', slug: 'featured', title: 'Featured' },
    ]);

    const res = await request(createApp()).get('/api/public/kb-v8/featured?lang=en&limit=5');

    expect(res.status).toBe(200);
    expect(mockGetFeaturedArticles).toHaveBeenCalledWith('en', 5, undefined);
    expect(res.body.data.articles).toHaveLength(1);
    expect(res.body.meta.contract).toBe(V8_KB_READ_CONTRACT);
  });

  it('GET /api/public/kb-v8/articles is anonymous-safe and forces publicOnly', async () => {
    mockUser = null;
    mockGetArticles.mockResolvedValue({
      articles: [{ id: 'a-1', slug: 'intro', title: 'Intro' }],
      total: 1,
    });

    const res = await request(createApp()).get(
      '/api/public/kb-v8/articles?lang=en&category=guides&limit=3&offset=6'
    );

    expect(res.status).toBe(200);
    expect(mockGetArticles).toHaveBeenCalledWith({
      language: 'en',
      categorySlug: 'guides',
      search: undefined,
      limit: 3,
      offset: 6,
      publicOnly: true,
    });
    expect(res.body.data.total).toBe(1);
    expect(res.body.meta.contract).toBe(V8_KB_READ_CONTRACT);
  });

  it('GET /api/public/kb-v8/search is anonymous-safe and delegates to searchArticles', async () => {
    mockUser = null;
    mockSearchArticles.mockResolvedValue([
      {
        id: '1',
        slug: 's',
        title: 'T',
        summary: '',
        category_slug: 'c',
        category_name: 'C',
        category_icon: 'i',
        reading_time_minutes: 1,
        is_featured: false,
        is_public: true,
        view_count: 0,
      },
    ]);

    const res = await request(createApp()).get('/api/public/kb-v8/search?q=hello&lang=pl&limit=3');

    expect(res.status).toBe(200);
    expect(mockSearchArticles).toHaveBeenCalledWith('hello', 'pl', 3, undefined);
    expect(res.body.data.articles).toHaveLength(1);
    expect(res.body.meta.contract).toBe(V8_KB_READ_CONTRACT);
  });

  it('GET /api/public/kb-v8/articles/:slug is anonymous-safe for public articles', async () => {
    mockUser = null;
    mockGetArticleBySlug.mockResolvedValue({
      id: 'a1',
      slug: 'how-to',
      title: 'How',
      content: 'Body',
      status: 'published',
      is_public: true,
    });

    const res = await request(createApp()).get('/api/public/kb-v8/articles/how-to?lang=en');

    expect(res.status).toBe(200);
    expect(mockGetArticleBySlug).toHaveBeenCalledWith('how-to', 'en');
    expect(res.body.data.article.slug).toBe('how-to');
    expect(res.body.meta.contract).toBe(V8_KB_READ_CONTRACT);
  });

  it('GET /api/public/kb-v8/articles/:slug returns 404 anonymously for non-public article', async () => {
    mockUser = null;
    mockGetArticleBySlug.mockResolvedValue({
      id: 'a1',
      slug: 'internal',
      title: 'Internal',
      content: 'Body',
      status: 'published',
      is_public: false,
    });

    const res = await request(createApp()).get('/api/public/kb-v8/articles/internal?lang=en');

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('KB_ARTICLE_NOT_FOUND');
  });

  it('POST /api/public/kb-v8/articles/:id/view is anonymous-safe', async () => {
    mockUser = null;
    mockTrackView.mockResolvedValue(undefined);

    const res = await request(createApp())
      .post('/api/public/kb-v8/articles/article-1/view')
      .send({ sessionId: 'sess-public', source: 'public_docs' });

    expect(res.status).toBe(200);
    expect(mockTrackView).toHaveBeenCalledWith(
      'article-1',
      undefined,
      'sess-public',
      'public_docs'
    );
    expect(res.body.data.success).toBe(true);
    expect(res.body.meta.contract).toBe(V8_KB_READ_CONTRACT);
  });

  it('GET /api/v8/kb/categories delegates to KnowledgeBaseService.getCategories', async () => {
    mockGetCategories.mockResolvedValue([{ id: 'cat-1', slug: 'general', name: 'General' }]);

    const res = await request(createApp())
      .get('/api/v8/kb/categories?lang=pl&all=true')
      .set('Authorization', 'Bearer x');

    expect(res.status).toBe(200);
    expect(mockGetCategories).toHaveBeenCalledWith('pl', true, undefined);
    expect(res.body.data.categories).toHaveLength(1);
    expect(res.body.meta.contract).toBe(V8_KB_READ_CONTRACT);
  });

  it('GET /api/v8/kb/articles delegates to KnowledgeBaseService.getArticles', async () => {
    mockGetArticles.mockResolvedValue({
      articles: [{ id: 'a-1', slug: 'intro', title: 'Intro' }],
      total: 1,
    });

    const res = await request(createApp())
      .get('/api/v8/kb/articles?lang=en&category=general&limit=7&offset=14')
      .set('Authorization', 'Bearer x');

    expect(res.status).toBe(200);
    expect(mockGetArticles).toHaveBeenCalledWith({
      language: 'en',
      categorySlug: 'general',
      search: undefined,
      limit: 7,
      offset: 14,
      publicOnly: false,
      moduleId: undefined,
    });
    expect(res.body.data.total).toBe(1);
    expect(res.body.meta.version).toBe('v8');
  });

  it('GET /api/v8/kb/search returns empty data without calling service when q is too short', async () => {
    const res = await request(createApp())
      .get('/api/v8/kb/search?q=a')
      .set('Authorization', 'Bearer x');

    expect(res.status).toBe(200);
    expect(res.body.data.articles).toEqual([]);
    expect(res.body.meta.contract).toBe(V8_KB_READ_CONTRACT);
    expect(mockSearchArticles).not.toHaveBeenCalled();
  });

  it('GET /api/v8/kb/search delegates to KnowledgeBaseService.searchArticles', async () => {
    mockSearchArticles.mockResolvedValue([
      {
        id: '1',
        slug: 's',
        title: 'T',
        summary: '',
        category_slug: 'c',
        category_name: 'C',
        category_icon: 'i',
        reading_time_minutes: 1,
        is_featured: false,
        view_count: 0,
      },
    ]);

    const res = await request(createApp())
      .get('/api/v8/kb/search?q=hello&lang=pl&limit=3')
      .set('Authorization', 'Bearer x');

    expect(res.status).toBe(200);
    expect(mockSearchArticles).toHaveBeenCalledWith('hello', 'pl', 3, undefined);
    expect(res.body.data.articles).toHaveLength(1);
    expect(res.body.meta.version).toBe('v8');
  });

  it('GET /api/v8/kb/articles/:slug returns 404 when service returns null', async () => {
    mockGetArticleBySlug.mockResolvedValue(null);

    const res = await request(createApp())
      .get('/api/v8/kb/articles/missing')
      .set('Authorization', 'Bearer x');

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('KB_ARTICLE_NOT_FOUND');
  });

  it('GET /api/v8/kb/articles/:slug returns V8 envelope when article exists', async () => {
    mockGetArticleBySlug.mockResolvedValue({
      id: 'a1',
      slug: 'how-to',
      title: 'How',
      content: 'Body',
      status: 'published',
      is_public: true,
    });

    const res = await request(createApp())
      .get('/api/v8/kb/articles/how-to?lang=en')
      .set('Authorization', 'Bearer x');

    expect(res.status).toBe(200);
    expect(mockGetArticleBySlug).toHaveBeenCalledWith('how-to', 'en');
    expect(res.body.data.article.slug).toBe('how-to');
    expect(res.body.meta.contract).toBe(V8_KB_READ_CONTRACT);
  });

  it('GET /api/v8/kb/context/:moduleId delegates to getContextualArticles', async () => {
    mockGetContextualArticles.mockResolvedValue([]);

    const res = await request(createApp())
      .get('/api/v8/kb/context/chat?limit=7')
      .set('Authorization', 'Bearer x');

    expect(res.status).toBe(200);
    expect(mockGetContextualArticles).toHaveBeenCalledWith('chat', 'en', 7);
    expect(res.body.data.articles).toEqual([]);
  });

  it('POST /api/v8/kb/articles/:id/view delegates to trackView with authenticated user', async () => {
    mockTrackView.mockResolvedValue(undefined);

    const res = await request(createApp())
      .post('/api/v8/kb/articles/article-1/view')
      .set('Authorization', 'Bearer x')
      .send({ sessionId: 'sess-1', source: 'help_panel' });

    expect(res.status).toBe(200);
    expect(mockTrackView).toHaveBeenCalledWith('article-1', UID, 'sess-1', 'help_panel');
    expect(res.body.data.success).toBe(true);
    expect(res.body.meta.contract).toBe(V8_KB_READ_CONTRACT);
  });
});
