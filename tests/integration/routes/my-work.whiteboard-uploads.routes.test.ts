/**
 * A6 "Whiteboard finish" — contract tests for the whiteboard image upload
 * endpoint (POST /api/my-work/whiteboard/images).
 *
 * Note on multer: tests/setup.ts globally mocks the `multer` package (a
 * lightweight body-parsing stand-in, applied to the whole suite so no test
 * relies on real disk I/O). That mock does not run `fileFilter` / `limits` /
 * the diskStorage `filename` hook, so this route re-checks mime type and
 * size in the handler itself (defense in depth) — see
 * ALLOWED_IMAGE_MIME_TYPES / MAX_WHITEBOARD_IMAGE_BYTES checks in
 * whiteboard-uploads.routes.ts. That's what these tests exercise. The
 * multer-level fileFilter is covered separately by a focused unit test
 * (tests/unit/backend/routes/whiteboard-uploads.fileFilter.test.ts) that
 * calls the exported filter function directly, bypassing the global mock.
 *
 * Covers:
 * - requires auth (401 without an authenticated user/org)
 * - rejects a disallowed mime type
 * - rejects a file over the 10MB cap (413)
 * - success shape: { url, id } (matches POST /api/branding/:orgId/upload)
 * - response url is scoped under the caller's org id
 */
import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';

let authOverride: { user?: { id: string; organizationId: string } } = {
  user: { id: 'user-1', organizationId: 'org-test-whiteboard-uploads' },
};

const { default: whiteboardUploadsRouter } = await import(
  '../../../server/src/routes/my-work/whiteboard-uploads.routes.ts'
);

// The real /api/my-work parent router (my-work.routes.ts) applies verifyToken
// (+ apiAuthRateLimiter + demoContextMiddleware) BEFORE mounting this
// sub-router, so whiteboard-uploads.routes.ts itself has no auth of its own —
// it trusts req.user to already be populated. This test app stands in for
// that parent-applied auth so the sub-router is exercised exactly as it runs
// in production, without pulling in the rest of my-work.routes.ts's deps.
function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    if (authOverride.user) {
      req.user = authOverride.user;
      req.userId = authOverride.user.id;
      req.organizationId = authOverride.user.organizationId;
    }
    next();
  });
  app.use('/api/my-work', whiteboardUploadsRouter);
  return app;
}

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);

describe('POST /api/my-work/whiteboard/images', () => {
  afterEach(() => {
    authOverride = { user: { id: 'user-1', organizationId: 'org-test-whiteboard-uploads' } };
  });

  it('requires authentication (401 without a user)', async () => {
    authOverride = { user: undefined };
    const res = await request(buildApp())
      .post('/api/my-work/whiteboard/images')
      .attach('image', TINY_PNG, { filename: 'test.png', contentType: 'image/png' });

    expect(res.status).toBe(401);
  });

  it('rejects a disallowed mime type', async () => {
    const res = await request(buildApp())
      .post('/api/my-work/whiteboard/images')
      .attach('image', Buffer.from('not an image'), {
        filename: 'notes.txt',
        contentType: 'text/plain',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
  });

  it('rejects image/svg+xml (XSS hardening — no SVG support for whiteboard uploads)', async () => {
    const res = await request(buildApp())
      .post('/api/my-work/whiteboard/images')
      .attach('image', Buffer.from('<svg onload="alert(1)"></svg>'), {
        filename: 'evil.svg',
        contentType: 'image/svg+xml',
      });

    expect(res.status).toBe(400);
  });

  it('rejects a file over the 10MB cap', async () => {
    const oversized = Buffer.alloc(10 * 1024 * 1024 + 1, 1);
    const res = await request(buildApp())
      .post('/api/my-work/whiteboard/images')
      .attach('image', oversized, { filename: 'big.png', contentType: 'image/png' });

    expect(res.status).toBe(413);
  });

  it('rejects when no file is attached', async () => {
    const res = await request(buildApp()).post('/api/my-work/whiteboard/images');
    expect(res.status).toBe(400);
  });

  it('accepts a valid PNG upload and returns { url, id }', async () => {
    const res = await request(buildApp())
      .post('/api/my-work/whiteboard/images')
      .attach('image', TINY_PNG, { filename: 'sticker.png', contentType: 'image/png' });

    expect(res.status).toBe(201);
    expect(typeof res.body.url).toBe('string');
    expect(res.body.url).toMatch(/^\/uploads\/whiteboard\/org-test-whiteboard-uploads\//);
    expect(typeof res.body.id).toBe('string');
    expect(res.body.id.length).toBeGreaterThan(0);
  });

  it('scopes the response url under the caller org id (path traversal guard)', async () => {
    authOverride = { user: { id: 'user-2', organizationId: '../../etc' } };
    const res = await request(buildApp())
      .post('/api/my-work/whiteboard/images')
      .attach('image', TINY_PNG, { filename: 'sticker.png', contentType: 'image/png' });

    expect(res.status).toBe(201);
    // sanitizeOrgIdForUploadPath falls back to 'unknown' for unsafe org ids.
    expect(res.body.url).toMatch(/^\/uploads\/whiteboard\/unknown\//);
  });
});
