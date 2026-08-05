/** @vitest-environment node */

import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDbGet, mockDbRun } = vi.hoisted(() => ({
  mockDbGet: vi.fn(),
  mockDbRun: vi.fn(),
}));

vi.mock('../../utils/DbPromise.js', () => ({
  all: vi.fn(),
  get: (...args: unknown[]) => mockDbGet(...args),
  run: (...args: unknown[]) => mockDbRun(...args),
}));

vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: () => void) => {
    req.user = { id: 'user-1', email: 'user@example.com' };
    next();
  },
}));

vi.mock('../../utils/Logger.js', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import mfaRouter from '../mfa.routes';

const app = express();
app.use(express.json());
app.use('/api/mfa', mfaRouter);

describe('MFA setup persistence honesty', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbGet.mockResolvedValue({ email: 'user@example.com' });
  });

  it('does not return a QR secret when DbPromise reports a failed write', async () => {
    mockDbRun.mockResolvedValue({ success: false, error: 'user_mfa table missing' });

    const response = await request(app).post('/api/mfa/setup').send({});

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: 'Nie udało się skonfigurować MFA',
      code: 'MFA_SETUP_NOT_PERSISTED',
    });
    expect(response.body).not.toHaveProperty('secret');
    expect(response.body).not.toHaveProperty('qrCodeData');
  });

  it('positive control returns setup data only after a successful write', async () => {
    mockDbRun.mockResolvedValue({ success: true, changes: 1 });

    const response = await request(app).post('/api/mfa/setup').send({});

    expect(response.status).toBe(200);
    expect(response.body.secret).toMatch(/^[a-zA-Z0-9]{20,32}$/);
    expect(response.body.qrCodeData).toContain('otpauth://totp/Consultify:');
  });
});
