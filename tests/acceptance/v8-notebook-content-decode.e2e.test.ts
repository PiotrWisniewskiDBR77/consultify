/**
 * Acceptance E2E — T5 follow-up: `content_text`/`content_json` decode-before-
 * store on `server/src/routes/v8/my-work.routes.ts` notebook endpoints.
 *
 * Context (Z139, data-integrity finding): the global input-sanitization
 * middleware HTML-escapes every string in `req.body` (so `&` becomes
 * `&amp;`, `<` becomes `&lt;`, etc.) before a handler ever sees it. Without
 * an explicit decode-before-store step, that escaped text lands in the DB
 * verbatim and renders un-decoded (`&amp;` instead of `&`) in the UI. The
 * `title` column on these same v8 routes already got this fix (07-18); this
 * follow-up applies the identical `decodeHtmlEntities` /
 * `deepDecodeHtmlEntities` treatment to `content_text` / `content_json`,
 * mirroring the sibling `server/src/routes/my-work/notebook.routes.ts`
 * (the "primary" path referenced in the v8 file's own Z139 comment).
 *
 * Pattern: 1:1 with tests/acceptance/h44-m13-flow.e2e.test.ts — REAL router
 * `v8/my-work.routes.ts` mounted behind REAL verifyToken + REAL
 * requireV8OrgContext/attachV8Context (mirrors the finance mount in
 * smoke-500.e2e.test.ts) + REAL Postgres (parity :5443). Zero mocks.
 *
 * Round-trip proved directly against the DB row (not just the JSON echo),
 * for both POST (create) and PUT (update):
 *   sanitizer-escaped input in → plain text in `notebook_pages.content_text`
 *   / `content_json` (and `title`, already covered) → plain text back out
 *   over GET.
 *
 * Isolation: prefix `odbior--pdf--`, own notebook_pages rows, cleaned up in
 * afterAll. ONLY file for this follow-up.
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { mintToken, pgClient } from './harness.js';
import { seed } from './seed.mjs';

const PREFIX = 'odbior--pdf--';

// What the global sanitizer middleware would have produced from a user who
// typed literal `&`, `<`, `>` — this is what handlers actually receive.
const ESCAPED_TITLE = `${PREFIX}R&amp;D notatka`;
const PLAIN_TITLE = `${PREFIX}R&D notatka`;
const ESCAPED_CONTENT_TEXT = 'Ryzyko &lt;krytyczne&gt; — budżet &amp; harmonogram pod presją.';
const PLAIN_CONTENT_TEXT = 'Ryzyko <krytyczne> — budżet & harmonogram pod presją.';
const ESCAPED_CONTENT_JSON = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Q3 &amp; Q4 plan &lt;draft&gt;' }],
    },
  ],
};
const PLAIN_TEXT_IN_JSON = 'Q3 & Q4 plan <draft>';

let app: Express;
let token: string;
let pageId: string;

async function buildApp(): Promise<Express> {
  const { verifyToken } = await import('../../server/src/middleware/auth.middleware.js');
  const { requireV8OrgContext, attachV8Context } = await import(
    '../../server/src/middleware/v8Auth.middleware.js'
  );
  const myWorkV8Router = (await import('../../server/src/routes/v8/my-work.routes.js')).default;

  const expressApp = express();
  expressApp.use(express.json({ limit: '5mb' }));
  expressApp.use(
    '/api/v8/my-work',
    verifyToken as any,
    requireV8OrgContext as any,
    attachV8Context as any,
    myWorkV8Router
  );
  return expressApp;
}

beforeAll(async () => {
  await seed(); // idempotent — org/user/membership foundation
  app = await buildApp();
  token = mintToken();
});

afterAll(async () => {
  const c = pgClient();
  await c.connect();
  try {
    if (pageId) {
      await c.query(`DELETE FROM notebook_pages WHERE id = $1`, [pageId]).catch(() => {});
    }
    // Belt-and-suspenders in case an assertion threw before pageId was set.
    await c
      .query(`DELETE FROM notebook_pages WHERE title LIKE $1`, [`${PREFIX}%`])
      .catch(() => {});
  } finally {
    await c.end();
  }
});

describe('v8/my-work.routes.ts — notebook content_text/content_json decode-before-store', () => {
  it('1) POST /notebook/pages decodes contentText/contentJson (mirrors title fix), verified against the raw DB row', async () => {
    const res = await request(app)
      .post('/api/v8/my-work/notebook/pages')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: ESCAPED_TITLE,
        contentText: ESCAPED_CONTENT_TEXT,
        contentJson: ESCAPED_CONTENT_JSON,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.id).toBeTruthy();
    pageId = res.body.data.id;

    // API response shape (contentJson comes back parsed as an object).
    expect(res.body.data.title).toBe(PLAIN_TITLE);
    expect(res.body.data.contentText).toBe(PLAIN_CONTENT_TEXT);
    const responseJsonStr = JSON.stringify(res.body.data.contentJson);
    expect(responseJsonStr).toContain(PLAIN_TEXT_IN_JSON);
    expect(responseJsonStr).not.toContain('&amp;');
    expect(responseJsonStr).not.toContain('&lt;');

    // Real row, not just an echo of the request.
    const c = pgClient();
    await c.connect();
    try {
      const r = await c.query(
        `SELECT title, content_text, content_json FROM notebook_pages WHERE id = $1`,
        [pageId]
      );
      expect(r.rows).toHaveLength(1);
      expect(r.rows[0].title).toBe(PLAIN_TITLE);
      expect(r.rows[0].content_text).toBe(PLAIN_CONTENT_TEXT);
      expect(r.rows[0].content_json).toContain(PLAIN_TEXT_IN_JSON);
      expect(r.rows[0].content_json).not.toContain('&amp;');
    } finally {
      await c.end();
    }
  });

  it('2) PUT /notebook/pages/:id decodes contentText/contentJson on update, verified against the raw DB row', async () => {
    expect(pageId).toBeTruthy(); // depends on test 1 having created the page

    const updatedEscapedText = 'Nowy status: R&amp;D &lt;blocked&gt; do decyzji.';
    const updatedPlainText = 'Nowy status: R&D <blocked> do decyzji.';
    const updatedEscapedJson = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Zaktualizowano Q1 &amp; Q2' }] }],
    };
    const updatedPlainTextInJson = 'Zaktualizowano Q1 & Q2';

    const res = await request(app)
      .put(`/api/v8/my-work/notebook/pages/${pageId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        contentText: updatedEscapedText,
        contentJson: updatedEscapedJson,
      });

    expect(res.status).toBe(200);

    const c = pgClient();
    await c.connect();
    try {
      const r = await c.query(
        `SELECT content_text, content_json FROM notebook_pages WHERE id = $1`,
        [pageId]
      );
      expect(r.rows).toHaveLength(1);
      expect(r.rows[0].content_text).toBe(updatedPlainText);
      expect(r.rows[0].content_json).toContain(updatedPlainTextInJson);
      expect(r.rows[0].content_json).not.toContain('&amp;');
    } finally {
      await c.end();
    }

    // Round-trip over GET too — plain text back out, not just at write time.
    const getRes = await request(app)
      .get(`/api/v8/my-work/notebook/pages/${pageId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.contentText).toBe(updatedPlainText);
  });
});
