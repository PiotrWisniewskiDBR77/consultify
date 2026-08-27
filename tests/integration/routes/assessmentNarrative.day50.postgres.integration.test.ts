/** @vitest-environment node */
import express, { type Express } from 'express';
import JSZip from 'jszip';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

import { run } from '../../../scripts/seed-demo-drd-metalpol.js';
import { ApiGateway } from '../../../server/src/Gateway.js';
import config from '../../../server/src/config/Config.js';

const DATABASE_URL = process.env.DATABASE_URL ?? '';
const REAL_DB =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  DATABASE_URL === 'postgresql://postgres:cx@127.0.0.1:5830/cx_day50';

function binary(
  res: NodeJS.ReadableStream,
  callback: (error: Error | null, body?: Buffer) => void
) {
  const chunks: Buffer[] = [];
  res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
  res.on('error', callback);
}

function token(organizationId: string): string {
  return jwt.sign(
    { id: 'demo-metalpol-user-akowalczyk', organizationId, role: 'user' },
    config.JWT_SECRET,
    {
      expiresIn: '15m',
      ...(config.JWT_ISSUER ? { issuer: config.JWT_ISSUER } : {}),
      ...(config.JWT_AUDIENCE ? { audience: config.JWT_AUDIENCE } : {}),
    }
  );
}

describe.skipIf(!REAL_DB)(
  'Day 50 area narrative through the real ApiGateway and PostgreSQL',
  () => {
    let app: Express;
    const metalpolToken = token('demo-metalpol-org');

    beforeAll(async () => {
      await run('apply');
      app = express();
      app.use(express.json());
      ApiGateway.getInstance().initializeRoutes(app);
    }, 60_000);

    it('returns sourced content for 23 assessed areas and null for 16 unassessed areas', async () => {
      const response = await request(app)
        .get('/api/method/sessions/demo-metalpol-session/assessment-report-contract')
        .set('Authorization', `Bearer ${metalpolToken}`);

      expect(response.status).toBe(200);
      const comments = response.body.reportContract.chapters.flatMap(
        (chapter: { areaComments: unknown[] }) => chapter.areaComments
      );
      expect(
        comments.filter((comment: { content: string | null }) => comment.content)
      ).toHaveLength(23);
      expect(
        comments.filter((comment: { content: string | null }) => comment.content === null)
      ).toHaveLength(16);
      const filledComments = comments.filter(
        (candidate: { content: string | null }) => candidate.content
      );
      for (const comment of filledComments) {
        expect(comment.answerRefs).toHaveLength(1);
        if (comment.uncertainty === 'evidenced') {
          expect(comment.evidenceRefs.length).toBeGreaterThan(0);
        } else {
          expect(comment.evidenceRefs).toEqual([]);
        }
        expect(comment.sourceFields).toContain('businessMeaning');
        expect(comment.sourceFields).toContain('recommendation');
      }
      const lengths = filledComments
        .map((comment: { content: string }) => comment.content.trim().split(/\s+/u).length)
        .sort((left: number, right: number) => left - right);
      console.log(
        `A.2 word distribution: min=${lengths[0]} median=${lengths[Math.floor(lengths.length / 2)]} max=${lengths.at(-1)} outside110to170=${lengths.filter((length: number) => length < 110 || length > 170).length}`
      );
    });

    it('renders an assessed narrative into word/document.xml and keeps honest placeholders', async () => {
      const contractResponse = await request(app)
        .get('/api/method/sessions/demo-metalpol-session/assessment-report-contract')
        .set('Authorization', `Bearer ${metalpolToken}`);
      const expected = contractResponse.body.reportContract.chapters[0].areaComments[0].content;
      const response = await request(app)
        .get('/api/method/sessions/demo-metalpol-session/assessment-report.docx')
        .set('Authorization', `Bearer ${metalpolToken}`)
        .buffer(true)
        .parse(binary);

      expect(response.status).toBe(200);
      const zip = await JSZip.loadAsync(response.body);
      const xml = (await zip.file('word/document.xml')!.async('string')).replaceAll('\u00a0', ' ');
      expect(xml).toContain(expected);
      expect(xml).toContain('Sekcja do uzupełnienia — limit 110–170 słów; wymagane:');
    });

    it('returns 404 for a session outside the authenticated tenant', async () => {
      const response = await request(app)
        .get('/api/method/sessions/demo-metalpol-session/assessment-report-contract')
        .set('Authorization', `Bearer ${token('foreign-day50-org')}`);
      expect(response.status).toBe(404);
    });

    it('returns 404 rather than a successful empty envelope for a missing session', async () => {
      const response = await request(app)
        .get('/api/method/sessions/day50-session-does-not-exist/assessment-report-contract')
        .set('Authorization', `Bearer ${metalpolToken}`);
      expect(response.status).toBe(404);
    });
  }
);
