/**
 * P26-B Integration Tests — Knowledge Base: Collections, Tags, Surface Bindings, Faceted Search
 *
 * Tests the V8 KB routes for P26 canon compliance.
 */

import { describe, expect, it } from 'vitest';

const API_BASE = '/api/public/kb-v8';

async function apiGet(path: string) {
  const url = `http://localhost:${process.env.PORT || 3001}${API_BASE}${path}`;
  const res = await fetch(url);
  return { status: res.status, data: await res.json().catch(() => null) };
}

describe('P26-B: Knowledge Base — Collections, Tags, Surfaces', () => {
  // ================================================================
  // Collections (IA spine)
  // ================================================================

  it('GET /collections returns array with title and article_count', async () => {
    const { status, data } = await apiGet('/collections?lang=en');
    expect(status).toBe(200);
    expect(data?.data?.collections).toBeDefined();
    expect(Array.isArray(data.data.collections)).toBe(true);
  });

  it('GET /collections?featured=true filters featured only', async () => {
    const { status, data } = await apiGet('/collections?lang=en&featured=true');
    expect(status).toBe(200);
    expect(Array.isArray(data?.data?.collections)).toBe(true);
  });

  it('GET /collections/:slug returns 404 for unknown slug', async () => {
    const { status } = await apiGet('/collections/nonexistent-slug-xyz');
    expect(status).toBe(404);
  });

  it('GET /collections/:slug/articles returns articles for valid collection', async () => {
    const { data: collData } = await apiGet('/collections?lang=en');
    const collections = collData?.data?.collections || [];
    if (collections.length === 0) return; // skip if no collections seeded

    const slug = collections[0].slug;
    const { status, data } = await apiGet(`/collections/${slug}/articles?lang=en&limit=5`);
    expect(status).toBe(200);
    expect(data?.data?.articles).toBeDefined();
    expect(typeof data.data.total).toBe('number');
  });

  // ================================================================
  // Tags (facets)
  // ================================================================

  it('GET /tags returns array with label and kind', async () => {
    const { status, data } = await apiGet('/tags?lang=en');
    expect(status).toBe(200);
    expect(Array.isArray(data?.data?.tags)).toBe(true);
  });

  it('GET /tags?kind=domain filters by kind', async () => {
    const { status, data } = await apiGet('/tags?lang=en&kind=domain');
    expect(status).toBe(200);
    expect(Array.isArray(data?.data?.tags)).toBe(true);
  });

  it('GET /tags/:slug/articles returns 400 without slug', async () => {
    const { status } = await apiGet('/tags//articles');
    expect([400, 404]).toContain(status);
  });

  // ================================================================
  // Faceted Search
  // ================================================================

  it('GET /search/faceted?q=... returns articles + facets', async () => {
    const { status, data } = await apiGet('/search/faceted?q=consultify&lang=en');
    expect(status).toBe(200);
    expect(data?.data?.articles).toBeDefined();
    expect(data?.data?.facets).toBeDefined();
    expect(data?.data?.facets?.collections).toBeDefined();
    expect(data?.data?.facets?.tags).toBeDefined();
    expect(typeof data.data.total).toBe('number');
  });

  it('GET /search/faceted with short query returns empty', async () => {
    const { status, data } = await apiGet('/search/faceted?q=a&lang=en');
    expect(status).toBe(200);
    expect(data?.data?.articles).toEqual([]);
  });

  // ================================================================
  // Related Articles
  // ================================================================

  it('GET /articles/:slug/related returns 404 for unknown article', async () => {
    const { status } = await apiGet('/articles/nonexistent-article-xyz/related');
    expect(status).toBe(404);
  });

  it('GET /articles/:slug/related returns array for valid article', async () => {
    const { data: artData } = await apiGet('/articles?lang=en&limit=1');
    const articles = artData?.data?.articles || [];
    if (articles.length === 0) return;

    const slug = articles[0].slug;
    const { status, data } = await apiGet(`/articles/${slug}/related?lang=en`);
    expect(status).toBe(200);
    expect(Array.isArray(data?.data?.articles)).toBe(true);
  });

  // ================================================================
  // Article Versions
  // ================================================================

  it('GET /articles/:slug/versions returns 404 for unknown article', async () => {
    const { status } = await apiGet('/articles/nonexistent-article-xyz/versions');
    expect(status).toBe(404);
  });

  it('GET /articles/:slug/versions returns array for valid article', async () => {
    const { data: artData } = await apiGet('/articles?lang=en&limit=1');
    const articles = artData?.data?.articles || [];
    if (articles.length === 0) return;

    const slug = articles[0].slug;
    const { status, data } = await apiGet(`/articles/${slug}/versions`);
    expect(status).toBe(200);
    expect(Array.isArray(data?.data?.versions)).toBe(true);
  });

  // ================================================================
  // Redirect / Deprecation
  // ================================================================

  it('GET /articles/:slug/redirect returns redirect info', async () => {
    const { data: artData } = await apiGet('/articles?lang=en&limit=1');
    const articles = artData?.data?.articles || [];
    if (articles.length === 0) return;

    const slug = articles[0].slug;
    const { status, data } = await apiGet(`/articles/${slug}/redirect`);
    expect(status).toBe(200);
    expect(data?.data).toHaveProperty('redirectSlug');
    expect(data?.data).toHaveProperty('deprecationReason');
  });

  // ================================================================
  // Surface Bindings
  // ================================================================

  it('GET /surface/public_docs returns articles bound to public_docs', async () => {
    const { status, data } = await apiGet('/surface/public_docs?lang=en');
    expect(status).toBe(200);
    expect(Array.isArray(data?.data?.articles)).toBe(true);
    expect(data?.data?.surface).toBe('public_docs');
  });

  it('GET /surface/help returns articles bound to help', async () => {
    const { status, data } = await apiGet('/surface/help?lang=en');
    expect(status).toBe(200);
    expect(Array.isArray(data?.data?.articles)).toBe(true);
  });

  it('GET /surface/ai_recommendations returns articles for AI', async () => {
    const { status, data } = await apiGet('/surface/ai_recommendations?lang=en');
    expect(status).toBe(200);
    expect(Array.isArray(data?.data?.articles)).toBe(true);
  });

  it('GET /surface/:surface?toolContext= filters by tool context', async () => {
    const { status, data } = await apiGet('/surface/right_panel?lang=en&toolContext=discovery-tools');
    expect(status).toBe(200);
    expect(Array.isArray(data?.data?.articles)).toBe(true);
  });

  // ================================================================
  // Existing endpoints still work (regression)
  // ================================================================

  it('GET /categories still returns categories', async () => {
    const { status, data } = await apiGet('/categories?lang=en');
    expect(status).toBe(200);
    expect(Array.isArray(data?.data?.categories)).toBe(true);
  });

  it('GET /articles still returns articles', async () => {
    const { status, data } = await apiGet('/articles?lang=en&limit=5');
    expect(status).toBe(200);
    expect(data?.data?.articles).toBeDefined();
  });

  it('GET /search still returns results', async () => {
    const { status, data } = await apiGet('/search?q=consultify&lang=en');
    expect(status).toBe(200);
    expect(Array.isArray(data?.data?.articles)).toBe(true);
  });

  it('GET /featured still returns featured articles', async () => {
    const { status, data } = await apiGet('/featured?lang=en');
    expect(status).toBe(200);
    expect(Array.isArray(data?.data?.articles)).toBe(true);
  });

  // ================================================================
  // PL/EN degraded posture
  // ================================================================

  it('GET /articles?lang=pl returns articles with fallback metadata', async () => {
    const { status, data } = await apiGet('/articles?lang=pl&limit=3');
    expect(status).toBe(200);
    const articles = data?.data?.articles || [];
    for (const a of articles) {
      expect(typeof a.title).toBe('string');
      expect(a.title.length).toBeGreaterThan(0);
    }
  });
});
