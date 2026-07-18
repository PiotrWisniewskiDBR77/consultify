/**
 * T5 — Z139 title/name double-escape ACCEPTANCE E2E (real runtime).
 *
 * Wzorzec 1:1 z pozostałymi testami tego harnessu: REALNY notebook router +
 * REALNE auth (minted JWT) + REALNA lokalna Postgres (parity :5443) + REALNY
 * global input-sanitization middleware (server/src/middleware/
 * inputSanitization.middleware.ts). Zero mocków logiki biznesowej.
 *
 * Sedno Z139: middleware HTML-escapuje KAŻDY string body na KAŻDY zapis. Pola
 * decode-before-store (tytuł notatki) muszą wrócić do PLAIN przy zapisie, a
 * sanitizer musi być IDEMPOTENTNY (dekoduje→escapuje raz), inaczej `&amp;`
 * puchnie do `&amp;amp;` co edycję. Ten test dowodzi obu gwarancji na realnym
 * łańcuchu HTTP+DB, dokładnie tak jak w produkcji.
 *
 * Izolacja: prefiks `odbior--t5--`, org/user SEED z harness/seed.mjs,
 * sprzątanie w afterAll (probe sprząta po sobie — reguła CLAUDE.md).
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { mintToken, pgClient } from './harness.js';
import { SEED, seed } from './seed.mjs';

const PREFIX = 'odbior--t5--';

let token: string;
let app: Express;
const createdPageIds: string[] = [];

/**
 * Build the REAL request chain: json -> global input-sanitization middleware
 * -> verifyToken -> notebook router. Mirrors server/src/index.ts app.use order
 * (sanitizer is app.use'd globally before routers). buildApp() in harness.ts
 * deliberately omits the sanitizer, so we assemble it here to exercise the
 * exact escape->decode-before-store interaction Z139 is about.
 */
async function buildSanitizedNotebookApp(): Promise<Express> {
  const { verifyToken } = await import('../../server/src/middleware/auth.middleware.js');
  const { inputSanitizationMiddleware } = await import(
    '../../server/src/middleware/inputSanitization.middleware.js'
  );
  const notebookRouter = (await import('../../server/src/routes/my-work/notebook.routes.js'))
    .default;

  const a = express();
  a.use(express.json({ limit: '5mb' }));
  a.use(inputSanitizationMiddleware as any);
  a.use('/api/my-work', verifyToken as any, notebookRouter);
  return a;
}

async function createPage(title: string, contentText: string): Promise<string> {
  const res = await request(app)
    .post('/api/my-work/notebook/pages')
    .set('Authorization', `Bearer ${token}`)
    .send({ title, contentText, visibility: 'private' });
  expect(res.status, `create failed: ${res.status} ${JSON.stringify(res.body)}`).toBe(201);
  const id = res.body.id as string;
  expect(id).toBeTruthy();
  createdPageIds.push(id);
  return id;
}

async function getPage(id: string) {
  const res = await request(app)
    .get(`/api/my-work/notebook/pages/${id}`)
    .set('Authorization', `Bearer ${token}`);
  expect(res.status, `get failed: ${res.status}`).toBe(200);
  return res.body as { title: string; contentText: string | null };
}

async function putPage(id: string, title: string) {
  const res = await request(app)
    .put(`/api/my-work/notebook/pages/${id}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ title });
  expect([200, 204], `put failed: ${res.status} ${JSON.stringify(res.body)}`).toContain(res.status);
}

/** Direct DB read — authoritative "what is physically stored". */
async function dbTitle(id: string): Promise<string> {
  const c = pgClient();
  await c.connect();
  try {
    const r = await c.query('SELECT title FROM notebook_pages WHERE id = $1', [id]);
    return r.rows[0]?.title as string;
  } finally {
    await c.end();
  }
}

const DOUBLE_ESCAPE = /&amp;(amp|lt|gt|quot|apos|#x27|#96|nbsp);/;

beforeAll(async () => {
  await seed(); // idempotent — org/user/membership odbioru
  token = mintToken();
  app = await buildSanitizedNotebookApp();
});

afterAll(async () => {
  if (!createdPageIds.length) return;
  const c = pgClient();
  await c.connect();
  try {
    await c.query('DELETE FROM notebook_pages WHERE id = ANY($1::text[])', [createdPageIds]);
  } finally {
    await c.end();
  }
});

describe('Z139 T5 — notebook title decode-before-store (real HTTP+DB)', () => {
  it('round-trips a title with < > & " \' „ to PLAIN text (no double-escape)', async () => {
    const title = `${PREFIX}A <b> & "Quote" 'apos' „Polski"`;
    const contentText = `${PREFIX}body <i>x</i> & y "z"`;
    const id = await createPage(title, contentText);

    // Read via the REAL GET endpoint — must equal the exact plain input.
    const page = await getPage(id);
    expect(page.title).toBe(title);
    expect(page.contentText).toBe(contentText);

    // Not a single HTML entity survived to the client.
    expect(page.title).not.toMatch(/&(amp|lt|gt|quot|#x27);/);
    expect(page.title).not.toMatch(DOUBLE_ESCAPE);

    // Physically stored PLAIN in the DB (decode-before-store contract).
    const stored = await dbTitle(id);
    expect(stored).toBe(title);
    expect(stored).not.toContain('&amp;');
  });

  it('is IDEMPOTENT across repeated edit-saves (no &amp; -> &amp;amp; growth)', async () => {
    const title = `${PREFIX}Q4 & Q1 <plan> "final"`;
    const id = await createPage(title, 'x');

    // Simulate the client echoing the server value back on each subsequent
    // save (exactly the loop that used to compound the escaping).
    for (let i = 0; i < 3; i += 1) {
      const echoed = (await getPage(id)).title;
      await putPage(id, echoed);
    }

    const finalPage = await getPage(id);
    expect(finalPage.title).toBe(title); // never grew, never changed
    expect(finalPage.title).not.toMatch(DOUBLE_ESCAPE);
    expect(await dbTitle(id)).toBe(title);
  });

  it('persists an XSS payload inert (stored plain once, never executable/compounded)', async () => {
    const xss = `${PREFIX}<script>alert('xss')</script>`;
    const id = await createPage(xss, 'y');

    const page = await getPage(id);
    // Stored exactly once-decoded to plain text; the render layer (React/TipTap)
    // escapes on output — it is never fed to dangerouslySetInnerHTML. The DB
    // value is inert data, not a compounded/growing entity string.
    expect(page.title).toBe(xss);
    expect(page.title).not.toMatch(DOUBLE_ESCAPE);

    // Re-save must not resurrect or compound escaping.
    await putPage(id, page.title);
    expect((await getPage(id)).title).toBe(xss);

    // Sanitizer contract (the fixed component): escapes dangerous chars exactly
    // ONCE and is idempotent — this is what neutralizes XSS on the render-
    // agnostic fields and what stops the double-escape defect at the source.
    const { sanitizeString } = await import('../../server/src/utils/security.utils.js');
    const once = sanitizeString("<script>alert('x')</script>");
    expect(once).toBe('&lt;script&gt;alert(&#x27;x&#x27;)&lt;/script&gt;');
    expect(sanitizeString(once)).toBe(once); // idempotent: no &amp;amp; growth
  });
});
