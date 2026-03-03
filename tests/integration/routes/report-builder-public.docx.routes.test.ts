import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getPublicLinkByTokenMock = vi.fn();

vi.mock('../../../server/src/services/reportBuilderService.js', () => ({
  default: {
    getPublicLinkByToken: (...args: any[]) => getPublicLinkByTokenMock(...args),
  },
}));

import publicReportRouter from '../../../server/src/routes/report-builder-public.routes.js';

describe('public report DOCX download', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/public/report', publicReportRouter);

  beforeEach(() => {
    getPublicLinkByTokenMock.mockReset();
  });

  it('GET /api/public/report/:token/docx returns docx (zip) with proper headers', async () => {
    getPublicLinkByTokenMock.mockResolvedValue({
      link: { passwordHash: null, showCompanyLogo: false, showConsultifyBranding: true, customMessage: '' },
      report: { id: 'r-1', title: 'My Report', config: { language: 'pl' } },
      sections: [
        { enabled: true, orderIndex: 0, title: 'Intro', sectionType: 'text', content: 'Hello world' },
      ],
    });

    const res = await request(app)
      .get('/api/public/report/tok-1/docx')
      .set('Authorization', 'Bearer test')
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    expect(String(res.headers['content-type'] || '')).toContain(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    expect(String(res.headers['content-disposition'] || '')).toContain('My Report.docx');

    // DOCX is a zip => starts with "PK"
    expect(Buffer.isBuffer(res.body)).toBe(true);
    expect(res.body.slice(0, 2).toString('utf8')).toBe('PK');
  });
});

