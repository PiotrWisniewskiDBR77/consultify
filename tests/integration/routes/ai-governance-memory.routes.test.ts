import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

const authState = vi.hoisted(() => ({
  userId: 'u-1' as string | null,
  organizationId: 'org-1' as string | null,
  role: 'ADMIN' as string | null,
}));

const previewMemoryMock = vi.fn(async () => ({ empty: true }));
const exportMemoryMock = vi.fn(async () => ({ empty: true }));
const deleteMemoryMock = vi.fn(async () => ({ success: true }));
const getUserPrivacySettingsMock = vi.fn(async () => ({
  memoryEnabled: true,
  memoryWriteEnabled: true,
  privateModeDefault: false,
  retentionMode: 'session',
}));
const updateUserPrivacySettingsMock = vi.fn(async () => undefined);

vi.mock('../../../server/src/middleware/auth.middleware.js', async () => {
  const actual = (await vi.importActual(
    '../../../server/src/middleware/auth.middleware.js'
  )) as Record<string, unknown>;
  return {
    ...actual,
    verifyToken: (req: any, _res: any, next: any) => {
      if (!authState.userId) {
        req.user = undefined;
      } else {
        req.user = {
          id: authState.userId,
          organizationId: authState.organizationId,
          role: authState.role || 'ADMIN',
        };
      }
      next();
    },
  };
});

vi.mock('../../../server/src/services/ai/userPrivacyService.js', async () => {
  const actual = (await vi.importActual(
    '../../../server/src/services/ai/userPrivacyService.js'
  )) as Record<string, unknown>;
  return {
    ...actual,
    previewMemory: (...args: unknown[]) => previewMemoryMock(...args),
    exportMemory: (...args: unknown[]) => exportMemoryMock(...args),
    deleteMemory: (...args: unknown[]) => deleteMemoryMock(...args),
    getUserPrivacySettings: (...args: unknown[]) => getUserPrivacySettingsMock(...args),
    updateUserPrivacySettings: (...args: unknown[]) => updateUserPrivacySettingsMock(...args),
  };
});

const { default: aiGovernanceRouter } = await import('../../../server/src/routes/ai-governance.routes.js');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/ai-governance', aiGovernanceRouter);
  return app;
}

describe('ai-governance memory routes', () => {
  it('returns 401 for preview when unauthenticated', async () => {
    authState.userId = null;
    const app = createApp();

    const res = await request(app).get('/api/ai-governance/memory/preview');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Unauthorized');
    expect(res.body.code).toBe('AUTH_REQUIRED');
    expect(previewMemoryMock).not.toHaveBeenCalled();
  });

  it('returns success envelope for preview and export when authenticated', async () => {
    authState.userId = 'u-1';
    authState.organizationId = 'org-1';
    authState.role = 'ADMIN';
    previewMemoryMock.mockResolvedValueOnce({ empty: false, interactionCount: 3 });
    exportMemoryMock.mockResolvedValueOnce({ empty: false, interactionCount: 3 });
    const app = createApp();

    const previewRes = await request(app).get('/api/ai-governance/memory/preview');
    expect(previewRes.status).toBe(200);
    expect(previewRes.body.success).toBe(true);
    expect(previewRes.body.data).toEqual({ empty: false, interactionCount: 3 });

    const exportRes = await request(app).get('/api/ai-governance/memory/export');
    expect(exportRes.status).toBe(200);
    expect(exportRes.body.success).toBe(true);
    expect(exportRes.body.data).toEqual({ empty: false, interactionCount: 3 });
  });

  it('returns delete result when authenticated', async () => {
    authState.userId = 'u-1';
    deleteMemoryMock.mockResolvedValueOnce({ success: true });
    const app = createApp();

    const res = await request(app).delete('/api/ai-governance/memory');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns coded 500 when preview memory store is invalid', async () => {
    authState.userId = 'u-1';
    previewMemoryMock.mockRejectedValueOnce(new SyntaxError('invalid-json'));
    const app = createApp();

    const res = await request(app).get('/api/ai-governance/memory/preview');
    expect(res.status).toBe(500);
    expect(res.body.code).toBe('AI_GOVERNANCE_MEMORY_INVALID_STORE');
    expect(res.body.error).toBe('Memory store is invalid');
  });

  it('returns coded 500 when export memory store is invalid', async () => {
    authState.userId = 'u-1';
    exportMemoryMock.mockRejectedValueOnce(new SyntaxError('invalid-json'));
    const app = createApp();

    const res = await request(app).get('/api/ai-governance/memory/export');
    expect(res.status).toBe(500);
    expect(res.body.code).toBe('AI_GOVERNANCE_MEMORY_INVALID_STORE');
  });

  it('returns coded 500 when delete memory fails', async () => {
    authState.userId = 'u-1';
    deleteMemoryMock.mockResolvedValueOnce({ success: false });
    const app = createApp();

    const res = await request(app).delete('/api/ai-governance/memory');
    expect(res.status).toBe(500);
    expect(res.body.code).toBe('AI_GOVERNANCE_MEMORY_DELETE_FAILED');
    expect(res.body.error).toBe('Memory could not be deleted');
  });

  it('returns coded 401 for privacy routes when unauthenticated', async () => {
    authState.userId = null;
    const app = createApp();

    const getRes = await request(app).get('/api/ai-governance/privacy');
    expect(getRes.status).toBe(401);
    expect(getRes.body.code).toBe('AUTH_REQUIRED');
    expect(getRes.body.error).toBe('Unauthorized');

    const putRes = await request(app).put('/api/ai-governance/privacy').send({ memoryEnabled: false });
    expect(putRes.status).toBe(401);
    expect(putRes.body.code).toBe('AUTH_REQUIRED');
    expect(putRes.body.error).toBe('Unauthorized');
  });

  it('returns coded 500 when privacy read fails', async () => {
    authState.userId = 'u-1';
    getUserPrivacySettingsMock.mockRejectedValueOnce(new Error('privacy-read-failed'));
    const app = createApp();

    const res = await request(app).get('/api/ai-governance/privacy');
    expect(res.status).toBe(500);
    expect(res.body.code).toBe('AI_GOVERNANCE_PRIVACY_READ_FAILED');
    expect(res.body.error).toBe('AI governance privacy settings could not be loaded');
  });

  it('returns coded 500 when privacy update fails', async () => {
    authState.userId = 'u-1';
    updateUserPrivacySettingsMock.mockRejectedValueOnce(new Error('privacy-update-failed'));
    const app = createApp();

    const res = await request(app).put('/api/ai-governance/privacy').send({ memoryEnabled: false });
    expect(res.status).toBe(500);
    expect(res.body.code).toBe('AI_GOVERNANCE_PRIVACY_UPDATE_FAILED');
    expect(res.body.error).toBe('AI governance privacy settings could not be updated');
  });
});
