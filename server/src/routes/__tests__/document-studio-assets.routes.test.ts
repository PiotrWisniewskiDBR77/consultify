import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { __resetAssetRegistryForTests } from '../../services/documentStudio/documentAssetRegistryService.js';

let mockUser: { id: string; organizationId: string; role: string } | null = null;

vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, res: any, next: () => void) => {
    if (!mockUser) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }
    req.userId = mockUser.id;
    req.userRole = mockUser.role;
    req.organizationId = mockUser.organizationId;
    req.user = mockUser;
    next();
  },
}));

import documentStudioRoutes from '../document-studio.routes.js';

function createApp(): Express {
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use('/api/document-studio', documentStudioRoutes);
  return app;
}

const TINY_PNG_BUFFER = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0xfa, 0xcf, 0x00, 0x00,
  0x00, 0x02, 0x00, 0x01, 0xe2, 0x21, 0xbc, 0x33, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44,
  0xae, 0x42, 0x60, 0x82,
]);

function makeUploadBuffer(extraBytes = 100): Buffer {
  return Buffer.concat([TINY_PNG_BUFFER, Buffer.alloc(extraBytes, 0x00)]);
}

beforeEach(() => {
  mockUser = { id: 'user-assets-1', organizationId: 'org-assets-A', role: 'CONSULTANT' };
  __resetAssetRegistryForTests();
});

describe('document-studio assets routes', () => {
  it('uploads logo via multipart and returns an active asset', async () => {
    const res = await request(createApp())
      .post('/api/document-studio/assets/logo/upload')
      .attach('file', makeUploadBuffer(), {
        filename: 'brand.png',
        contentType: 'image/png',
      });

    expect(res.status).toBe(201);
    expect(res.body.asset).toBeDefined();
    expect(res.body.asset.status).toBe('active');
    expect(res.body.asset.mimeType).toBe('image/png');
    expect(res.body.asset.filename).toBe('brand.png');
  });

  it('returns 400 when multipart file is missing', async () => {
    const res = await request(createApp()).post('/api/document-studio/assets/logo/upload');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('asset_file_required');
  });

  it('returns 400 for unsupported mime type', async () => {
    const res = await request(createApp())
      .post('/api/document-studio/assets/logo/upload')
      .attach('file', Buffer.from('plain text payload'), {
        filename: 'brand.txt',
        contentType: 'text/plain',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('asset_invalid_mime_type');
  });
});
