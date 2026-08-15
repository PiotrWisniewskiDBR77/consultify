import { describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

// Exercise the real multipart parser; the repository-wide lightweight multer
// stand-in is not a valid integration harness for streamed attachments.
vi.unmock('multer');

vi.mock('../../../server/src/middleware/auth.middleware.js', async () => {
  const actual = (await vi.importActual(
    '../../../server/src/middleware/auth.middleware.js'
  )) as any;
  return {
    ...actual,
    verifyToken: (req: any, _res: any, next: any) => {
      req.user = { id: 'e2e-user-id', organizationId: 'e2e-org-id', role: 'ADMIN' };
      req.userId = 'e2e-user-id';
      req.organizationId = 'e2e-org-id';
      next();
    },
  };
});

vi.mock('../../../server/src/middleware/rateLimiting.middleware.js', async () => {
  const actual = (await vi.importActual(
    '../../../server/src/middleware/rateLimiting.middleware.js'
  )) as any;
  return {
    ...actual,
    aiRateLimiter: (_req: any, _res: any, next: any) => next(),
  };
});

const mockDbRun = vi.fn().mockResolvedValue(undefined);
const recordAttachmentExtraction = vi.fn().mockResolvedValue({ itemId: 'ctx-doc-1' });
vi.mock('../../../server/src/utils/DbPromise.js', async () => {
  const actual = (await vi.importActual('../../../server/src/utils/DbPromise.js')) as any;
  return {
    ...actual,
    run: (...args: any[]) => mockDbRun(...args),
  };
});

vi.mock('../../../server/src/services/organizationContext/OrganizationContextService.js', () => ({
  default: {
    recordAttachmentExtraction: (...args: any[]) => recordAttachmentExtraction(...args),
  },
}));

vi.mock('../../../server/src/services/ragService.js', () => ({
  default: {
    generateEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
  },
}));

vi.mock('mammoth', () => ({
  default: {
    extractRawText: vi.fn().mockResolvedValue({ value: 'DOCX extracted text\nSecond paragraph' }),
  },
  extractRawText: vi.fn().mockResolvedValue({ value: 'DOCX extracted text\nSecond paragraph' }),
}));

const { default: aiRouter } = await import('../../../server/src/routes/ai.routes.ts');

describe('AI attachments ingest (REAL integration)', () => {
  const makeApp = () => {
    const app = express();
    app.use(express.json({ limit: '2mb' }));
    app.use('/api/ai', aiRouter);
    return app;
  };

  it('returns 400 when file is missing', async () => {
    const app = makeApp();
    const res = await request(app).post('/api/ai/attachments/ingest').send({});
    expect(res.status).toBe(400);
    expect(res.body).toEqual(
      expect.objectContaining({
        error: 'No file uploaded',
      })
    );
  });

  it('ingests a text file and returns docId + chunkCount', async () => {
    const app = makeApp();
    const res = await request(app)
      .post('/api/ai/attachments/ingest')
      .attach('file', Buffer.from('Hello attachment\n\nSecond paragraph', 'utf8'), {
        filename: 'note.txt',
        contentType: 'text/plain',
      });

    expect(res.status).toBe(201);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: true,
        docId: expect.any(String),
        filename: 'note.txt',
        mimeType: 'text/plain',
        totalChunks: expect.any(Number),
        embeddedChunks: expect.any(Number),
      })
    );
    expect(res.body.totalChunks).toBeGreaterThan(0);
    expect(mockDbRun).toHaveBeenCalled();
    expect(recordAttachmentExtraction).toHaveBeenCalledWith({
      organizationId: 'e2e-org-id',
      userId: 'e2e-user-id',
      payload: expect.objectContaining({
        filename: 'note.txt',
        mimeType: 'text/plain',
        extractedText: 'Hello attachment\n\nSecond paragraph',
      }),
    });
  });

  it('returns a concrete extraction status for unreadable PDFs', async () => {
    const app = makeApp();
    const res = await request(app)
      .post('/api/ai/attachments/ingest')
      .attach('file', Buffer.from('%PDF-1.4\n% unreadable fixture', 'utf8'), {
        filename: 'scanned.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status).toBe(400);
    expect(res.body).toEqual(
      expect.objectContaining({
        code: 'PDF_TEXT_EXTRACTION_FAILED',
        extractionStatus: 'ocr_required_or_unreadable',
        attachmentState: 'ocr_required',
        sourceClass: 'attachment',
        recoverable: true,
        filename: 'scanned.pdf',
      })
    );
  });

  it('extracts DOCX attachments through the document parser', async () => {
    const app = makeApp();
    const { Document, Packer, Paragraph } = await import('docx');
    const docxBuffer = await Packer.toBuffer(
      new Document({
        sections: [
          {
            children: [
              new Paragraph('DOCX extracted text'),
              new Paragraph('Second paragraph'),
            ],
          },
        ],
      })
    );
    const res = await request(app)
      .post('/api/ai/attachments/ingest')
      .attach('file', docxBuffer, {
        filename: 'research.docx',
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

    expect(res.status).toBe(201);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: true,
        filename: 'research.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        extractionStatus: 'extracted',
      })
    );
    expect(recordAttachmentExtraction).toHaveBeenCalledWith({
      organizationId: 'e2e-org-id',
      userId: 'e2e-user-id',
      payload: expect.objectContaining({
        filename: 'research.docx',
        extractedText: expect.stringContaining('DOCX extracted text'),
      }),
    });
  });
});
