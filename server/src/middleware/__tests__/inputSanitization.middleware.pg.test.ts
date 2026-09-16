/**
 * @vitest-environment node
 *
 * FEEDBACK-1/0b behavioral receipt on disposable PostgreSQL:
 * FEEDBACK_SANITIZER_PG_URL=postgresql://feedback:feedback@127.0.0.1:6454/feedback_test \
 *   npx vitest run server/src/middleware/__tests__/inputSanitization.middleware.pg.test.ts --retry=0
 */
import type { NextFunction, Request, Response } from 'express';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import inputSanitizationMiddleware from '../inputSanitization.middleware.js';

const pgUrl = process.env.FEEDBACK_SANITIZER_PG_URL;
const describePg = pgUrl ? describe : describe.skip;

describePg('FEEDBACK-1/0b quote round-trip through middleware and PostgreSQL', () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({ connectionString: pgUrl, ssl: false });
    await client.connect();
    await client.query('DROP TABLE IF EXISTS feedback_sanitizer_receipt');
    await client.query('CREATE TABLE feedback_sanitizer_receipt (id text PRIMARY KEY, body text NOT NULL)');
  });

  afterAll(async () => {
    await client.query('DROP TABLE IF EXISTS feedback_sanitizer_receipt');
    await client.end();
  });

  async function sanitizeAndRoundTrip(id: string, body: string): Promise<string> {
    const req = {
      headers: { 'content-type': 'application/json' },
      body: { body },
      query: {},
      params: {},
      path: '/feedback-sanitizer-receipt',
      method: 'POST',
    } as unknown as Request;
    const next = vi.fn() as unknown as NextFunction;

    await inputSanitizationMiddleware(req, {} as Response, next);
    expect(next).toHaveBeenCalledTimes(1);
    await client.query('INSERT INTO feedback_sanitizer_receipt(id,body) VALUES($1,$2)', [
      id,
      (req.body as { body: string }).body,
    ]);
    const readback = await client.query<{ body: string }>(
      'SELECT body FROM feedback_sanitizer_receipt WHERE id=$1',
      [id]
    );
    return readback.rows[0].body;
  }

  it('preserves quotes exactly while neutralizing executable HTML delimiters', async () => {
    const quoteText = 'He said "yes", it\'s `ready`';
    await expect(sanitizeAndRoundTrip('quotes', quoteText)).resolves.toBe(quoteText);
    const hostile = await sanitizeAndRoundTrip('xss', '<script>alert("x")</script>');
    expect(hostile).toBe('&lt;script&gt;alert("x")&lt;/script&gt;');
    expect(hostile).not.toContain('<script>');
  });
});
