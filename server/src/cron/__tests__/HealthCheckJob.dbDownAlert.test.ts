/** @vitest-environment node */

/**
 * P3 — Obserwowalność i limiter AI (MVP koszyk 2, S2.5).
 *
 * Dowód (bez czekania na realny cron-tick ani realną awarię bazy) że
 * `HealthCheckJob` NIE jest fantomem: gdy `SELECT 1` faktycznie rzuca,
 * kod woła jednocześnie `sendSystemAlert` (Slack/WhatsApp) ORAZ
 * `emailService.sendEmail` na adres z `ALERT_EMAIL_RECIPIENTS` — dokładnie
 * ten sam adres, który dziś na stagingu odbiera te alerty (Piotr Wiśniewski,
 * piotr.wisniewski@dbr77.com, zmierzone `railway variables` 2026-09-10).
 *
 * `node-cron`'s `schedule()` jest zamockowany, żeby przechwycić callback i
 * wywołać go ręcznie zamiast czekać na realną minutę — to jedyny sposób
 * dotrzeć do logiki bez przepisywania HealthCheckJob (poza zakresem tego kroku).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSendEmail, mockSendSystemAlert, mockDbGet, capturedCallback } = vi.hoisted(() => ({
  mockSendEmail: vi.fn().mockResolvedValue(true),
  mockSendSystemAlert: vi.fn().mockResolvedValue(undefined),
  mockDbGet: vi.fn(),
  capturedCallback: { fn: null as null | (() => Promise<void>) },
}));

vi.mock('node-cron', () => ({
  schedule: (_pattern: string, fn: () => Promise<void>) => {
    capturedCallback.fn = fn;
    return { stop: vi.fn() };
  },
}));

vi.mock('../../utils/DbPromise.js', () => ({
  get: (...args: unknown[]) => mockDbGet(...args),
}));

vi.mock('../../database/Database.js', () => ({
  getDatabase: () => ({}),
  default: {},
}));

vi.mock('../../services/emailService.js', () => ({
  default: { sendEmail: mockSendEmail },
  sendEmail: mockSendEmail,
}));

vi.mock('../../services/systemAlertNotifier.js', () => ({
  sendSystemAlert: mockSendSystemAlert,
  default: { sendSystemAlert: mockSendSystemAlert },
}));

vi.mock('../../utils/Logger.js', () => ({
  default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import HealthCheckJob from '../HealthCheckJob.js';

describe('HealthCheckJob — padnięcie bazy (SELECT 1) dociera do nazwanego adresata', () => {
  const savedRecipients = process.env.ALERT_EMAIL_RECIPIENTS;

  beforeEach(() => {
    vi.clearAllMocks();
    capturedCallback.fn = null;
  });

  afterEach(() => {
    if (savedRecipients === undefined) delete process.env.ALERT_EMAIL_RECIPIENTS;
    else process.env.ALERT_EMAIL_RECIPIENTS = savedRecipients;
  });

  it('SELECT 1 rzuca -> sendSystemAlert (Slack/WhatsApp) + e-mail na ALERT_EMAIL_RECIPIENTS', async () => {
    process.env.ALERT_EMAIL_RECIPIENTS = 'piotr.wisniewski@dbr77.com';
    mockDbGet.mockRejectedValue(new Error('connection refused'));

    const job = new HealthCheckJob();
    job.startHealthCheck();

    expect(capturedCallback.fn).toBeTypeOf('function');
    await capturedCallback.fn!();

    expect(mockSendSystemAlert).toHaveBeenCalledTimes(1);
    expect(mockSendSystemAlert.mock.calls[0][0]).toMatchObject({
      severity: 'CRITICAL',
      source: 'Database',
    });

    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const [to, subject] = mockSendEmail.mock.calls[0];
    expect(to).toBe('piotr.wisniewski@dbr77.com');
    expect(String(subject)).toMatch(/CRITICAL ALERT/);
  });

  it('bez ALERT_EMAIL_RECIPIENTS (stan demo) -> e-mail wysyłany na pusty adres (cichy brak adresata)', async () => {
    delete process.env.ALERT_EMAIL_RECIPIENTS;
    mockDbGet.mockRejectedValue(new Error('connection refused'));

    const job = new HealthCheckJob();
    job.startHealthCheck();
    await capturedCallback.fn!();

    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const [to] = mockSendEmail.mock.calls[0];
    expect(to).toBe('');
  });
});
