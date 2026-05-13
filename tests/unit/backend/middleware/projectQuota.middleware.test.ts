import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import os from 'os';
import path from 'path';

import { enforceProjectQuota, setDependencies } from '../../../../server/src/middleware/projectQuota.middleware.ts';

describe('projectQuota.middleware', () => {
  const checkProjectQuota = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    checkProjectQuota.mockResolvedValue({
      allowed: true,
      used: 0,
      limit: 1024,
      percentage: 0,
    });
    setDependencies({
      usageService: {
        checkProjectQuota,
      } as any,
    });
  });

  it('falls back to req.query.projectId when req.body accessor throws', async () => {
    const req: any = { query: { projectId: 'proj-1' } };
    Object.defineProperty(req, 'body', {
      configurable: true,
      get: () => {
        throw new Error('body getter failed');
      },
    });
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await enforceProjectQuota(req, res, next);

    expect(checkProjectQuota).toHaveBeenCalledWith('proj-1');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('returns 400 without calling usage service when project id exceeds max length', async () => {
    const req: any = { body: { project_id: 'p'.repeat(257) } };
    const res: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    const next = vi.fn();

    await enforceProjectQuota(req, res, next);

    expect(checkProjectQuota).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'INVALID_PROJECT_ID' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('continues when req.file.path accessor throws during cleanup path read', async () => {
    checkProjectQuota.mockResolvedValueOnce({
      allowed: false,
      used: 2048,
      limit: 1024,
      percentage: 200,
    });

    const req: any = {
      body: { project_id: 'proj-1' },
      file: {},
    };
    Object.defineProperty(req.file, 'path', {
      configurable: true,
      get: () => {
        throw new Error('file path getter failed');
      },
    });
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await enforceProjectQuota(req, res, next);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 429 with safe usage strings when quota numeric fields are malformed', async () => {
    checkProjectQuota.mockResolvedValueOnce({
      allowed: false,
      used: NaN,
      limit: undefined,
      percentage: null,
    });

    const req: any = { body: { project_id: 'proj-1' } };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await enforceProjectQuota(req, res, next);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'PROJECT_STORAGE_EXCEEDED',
        usage: {
          usedGB: '0.00',
          limitGB: '0.00',
          percentage: '0.0',
        },
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('does not send 500 when headers are already sent in catch path', async () => {
    checkProjectQuota.mockRejectedValueOnce(new Error('quota service down'));

    const req: any = { body: { project_id: 'proj-1' } };
    const res: any = {
      headersSent: true,
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    const next = vi.fn();

    await enforceProjectQuota(req, res, next);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0]?.[0]).toBeInstanceOf(Error);
  });

  it('does not send 500 when response is writableEnded in catch path', async () => {
    checkProjectQuota.mockRejectedValueOnce(new Error('quota service down'));

    const req: any = { body: { project_id: 'proj-1' } };
    const res: any = {
      headersSent: false,
      writableEnded: true,
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    const next = vi.fn();

    await enforceProjectQuota(req, res, next);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0]?.[0]).toBeInstanceOf(Error);
  });

  it('calls next when quota exceeded but headers are already sent', async () => {
    checkProjectQuota.mockResolvedValueOnce({
      allowed: false,
      used: 2048,
      limit: 1024,
      percentage: 200,
    });

    const req: any = { body: { project_id: 'proj-1' } };
    const res: any = {
      headersSent: true,
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    const next = vi.fn();

    await enforceProjectQuota(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0]?.[0]).toBeInstanceOf(Error);
    expect((next.mock.calls[0]?.[0] as Error).message).toBe(
      'Failed to send project quota exceeded response'
    );
    expect(res.status).not.toHaveBeenCalledWith(429);
    expect(res.json).not.toHaveBeenCalled();
  });

  it('calls next with error when quota exceeded response writer throws', async () => {
    checkProjectQuota.mockResolvedValueOnce({
      allowed: false,
      used: 2048,
      limit: 1024,
      percentage: 200,
    });

    const req: any = { body: { project_id: 'proj-1' } };
    const res: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(() => {
        throw new Error('json failed');
      }),
    };
    const next = vi.fn();

    await expect(enforceProjectQuota(req, res, next)).resolves.toBeUndefined();

    expect(res.status).toHaveBeenCalledWith(429);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0]?.[0]).toBeInstanceOf(Error);
    expect((next.mock.calls[0]?.[0] as Error).message).toBe(
      'Failed to send project quota exceeded response'
    );
  });

  it('calls next with error when quota exceeded and response is already writableEnded', async () => {
    checkProjectQuota.mockResolvedValueOnce({
      allowed: false,
      used: 2048,
      limit: 1024,
      percentage: 200,
    });

    const req: any = { body: { project_id: 'proj-1' } };
    const res: any = {
      headersSent: false,
      writableEnded: true,
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    const next = vi.fn();

    await enforceProjectQuota(req, res, next);

    expect(res.status).not.toHaveBeenCalledWith(429);
    expect(res.json).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0]?.[0]).toBeInstanceOf(Error);
    expect((next.mock.calls[0]?.[0] as Error).message).toBe(
      'Failed to send project quota exceeded response'
    );
  });

  it('returns 500 when quota payload is malformed', async () => {
    checkProjectQuota.mockResolvedValueOnce({ allowed: 'yes' } as any);

    const req: any = { body: { project_id: 'proj-1' } };
    const res: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    const next = vi.fn();

    await enforceProjectQuota(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Failed to verify project quota' });
    expect(next).not.toHaveBeenCalled();
  });

  it('does not throw when json writer fails for malformed quota payload 500', async () => {
    checkProjectQuota.mockResolvedValueOnce({ allowed: 'yes' } as any);

    const req: any = { body: { project_id: 'proj-1' } };
    const res: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(() => {
        throw new Error('json failed');
      }),
    };
    const next = vi.fn();

    await expect(enforceProjectQuota(req, res, next)).resolves.toBeUndefined();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0]?.[0]).toBeInstanceOf(Error);
  });

  it('does not throw when response status writer throws in catch path', async () => {
    checkProjectQuota.mockRejectedValueOnce(new Error('quota service down'));

    const req: any = { body: { project_id: 'proj-1' } };
    const res: any = {
      status: vi.fn(() => {
        throw new Error('status failed');
      }),
      json: vi.fn().mockReturnThis(),
    };
    const next = vi.fn();

    await expect(enforceProjectQuota(req, res, next)).resolves.toBeUndefined();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0]?.[0]).toBeInstanceOf(Error);
  });

  it('skips temp-file cleanup when req.file.path resolves outside upload root', async () => {
    checkProjectQuota.mockResolvedValueOnce({
      allowed: false,
      used: 2048,
      limit: 1024,
      percentage: 200,
    });
    const outsidePath = path.join(process.cwd(), `project-quota-outside-${Date.now()}.tmp`);
    fs.writeFileSync(outsidePath, 'tmp');

    const req: any = {
      body: { project_id: 'proj-1' },
      file: { path: outsidePath },
    };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    try {
      await enforceProjectQuota(req, res, next);
      expect(fs.existsSync(outsidePath)).toBe(true);
    } finally {
      if (fs.existsSync(outsidePath)) fs.unlinkSync(outsidePath);
    }
  });

  it('skips temp-file cleanup when path under tmp is a symlink to outside upload root', async () => {
    checkProjectQuota.mockResolvedValueOnce({
      allowed: false,
      used: 2048,
      limit: 1024,
      percentage: 200,
    });
    const targetOutside = path.join(process.cwd(), `project-quota-symlink-target-${Date.now()}.tmp`);
    const linkInsideTmp = path.join(os.tmpdir(), `project-quota-symlink-${Date.now()}.tmp`);
    fs.writeFileSync(targetOutside, 'keep');

    try {
      fs.symlinkSync(targetOutside, linkInsideTmp);

      const req: any = {
        body: { project_id: 'proj-1' },
        file: { path: linkInsideTmp },
      };
      const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
      const next = vi.fn();

      await enforceProjectQuota(req, res, next);

      expect(fs.existsSync(targetOutside)).toBe(true);
      expect(fs.existsSync(linkInsideTmp)).toBe(true);
      expect(res.status).toHaveBeenCalledWith(429);
      expect(next).not.toHaveBeenCalled();
    } finally {
      if (fs.existsSync(linkInsideTmp)) fs.unlinkSync(linkInsideTmp);
      if (fs.existsSync(targetOutside)) fs.unlinkSync(targetOutside);
    }
  });

  it('cleans temp-file when req.file.path is under upload root', async () => {
    checkProjectQuota.mockResolvedValueOnce({
      allowed: false,
      used: 2048,
      limit: 1024,
      percentage: 200,
    });
    const safePath = path.join(os.tmpdir(), `consultify-upload-${Date.now()}.tmp`);
    fs.writeFileSync(safePath, 'tmp');

    const req: any = {
      body: { project_id: 'proj-1' },
      file: { path: safePath },
    };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await enforceProjectQuota(req, res, next);
    expect(fs.existsSync(safePath)).toBe(false);
  });

  it('does not attempt unlink for missing temp file under upload root', async () => {
    checkProjectQuota.mockResolvedValueOnce({
      allowed: false,
      used: 2048,
      limit: 1024,
      percentage: 200,
    });
    const missingPath = path.join(os.tmpdir(), `consultify-missing-${Date.now()}.tmp`);

    const req: any = {
      body: { project_id: 'proj-1' },
      file: { path: missingPath },
    };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await enforceProjectQuota(req, res, next);

    expect(fs.existsSync(missingPath)).toBe(false);
    expect(res.status).toHaveBeenCalledWith(429);
  });
});
