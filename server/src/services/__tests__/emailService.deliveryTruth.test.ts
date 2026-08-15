import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const dbAll = vi.fn();
const dbRun = vi.fn();

vi.mock('../../utils/DbPromise.js', () => ({
  all: (...args: unknown[]) => dbAll(...args),
  run: (...args: unknown[]) => dbRun(...args),
}));

vi.mock('../../database/Database.js', () => ({
  getDatabase: () => ({}),
  default: {},
}));

vi.mock('../email/emailTemplateRenderer.js', () => ({
  renderTemplate: vi.fn(),
  templateExists: vi.fn(() => false),
}));

const ORIGINAL_ENV = { ...process.env };

describe('emailService delivery truth', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.doUnmock('../emailService.js');
    process.env = { ...ORIGINAL_ENV };
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.SMTP_FROM;
    delete process.env.EMAIL_FROM;
    dbAll.mockResolvedValue([]);
    dbRun.mockResolvedValue({ success: true, changes: 1 });
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('uses EMAIL_FROM and returns true only when SMTP accepts the message', async () => {
    process.env.SMTP_HOST = 'smtp.example.test';
    process.env.SMTP_USER = 'authenticated@example.test';
    process.env.SMTP_PASS = 'secret';
    process.env.EMAIL_FROM = 'Consultify <mail@example.test>';
    const sendMail = vi.fn().mockResolvedValue({ messageId: 'msg-1' });
    const createTransport = vi.fn(() => ({ sendMail }));
    const service = await import('../emailService.js');
    service.setDependencies({ nodemailer: { createTransport }, config: {} });

    await expect(
      service.send({
        to: 'recipient@example.test',
        subject: 'Delivery contract',
        html: '<p>ok</p>',
        organizationId: 'org-1',
      })
    ).resolves.toBe(true);

    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'Consultify <mail@example.test>' })
    );
    expect(dbRun).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('INSERT INTO email_sends'),
      expect.arrayContaining(['org-1', 'recipient@example.test', 'SENT'])
    );
  });

  it('returns false and records FAILED when SMTP rejects the message', async () => {
    process.env.SMTP_HOST = 'smtp.example.test';
    process.env.SMTP_USER = 'authenticated@example.test';
    const sendMail = vi.fn().mockRejectedValue(new Error('553 sender rejected'));
    const service = await import('../emailService.js');
    service.setDependencies({
      nodemailer: { createTransport: vi.fn(() => ({ sendMail })) },
      config: {},
    });

    await expect(
      service.send({ to: 'recipient@example.test', subject: 'Rejected', html: '<p>no</p>' })
    ).resolves.toBe(false);

    expect(dbRun).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('INSERT INTO email_sends'),
      expect.arrayContaining(['recipient@example.test', 'FAILED', '553 sender rejected'])
    );
  });

  it('returns false and records MOCK when SMTP is not configured', async () => {
    const createTransport = vi.fn();
    const service = await import('../emailService.js');
    service.setDependencies({ nodemailer: { createTransport }, config: {} });

    await expect(
      service.send({ to: 'recipient@example.test', subject: 'No SMTP', html: '<p>no</p>' })
    ).resolves.toBe(false);

    expect(createTransport).not.toHaveBeenCalled();
    expect(dbRun).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('INSERT INTO email_sends'),
      expect.arrayContaining(['recipient@example.test', 'MOCK'])
    );
  });

  it('does not turn a successful SMTP delivery into failure when audit persistence fails', async () => {
    process.env.SMTP_HOST = 'smtp.example.test';
    process.env.SMTP_USER = 'authenticated@example.test';
    dbRun.mockRejectedValue(new Error('audit table unavailable'));
    const service = await import('../emailService.js');
    service.setDependencies({
      nodemailer: {
        createTransport: vi.fn(() => ({ sendMail: vi.fn().mockResolvedValue({}) })),
      },
      config: {},
    });

    await expect(
      service.send({ to: 'recipient@example.test', subject: 'Delivered', html: '<p>ok</p>' })
    ).resolves.toBe(true);
  });
});
