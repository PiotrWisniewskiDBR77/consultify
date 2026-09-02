/**
 * Regression guard for the 2026-09-02 password-recovery outage.
 *
 * Two defects made every outbound email die silently on staging:
 *   1. the envelope sender was read only from SMTP_FROM, while deployments
 *      configure EMAIL_FROM — so nodemailer sent as system@consultify.com,
 *      which the provider rejects ("553 5.7.1 Sender address rejected");
 *   2. send() returned true even after the transport threw, so callers
 *      (forgot-password above all) reported success for a mail nobody got.
 */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

// tests/setup.ts mocks `server/services/emailService.js`, and vitest.config.ts
// aliases that legacy path onto this very module — so without an explicit
// unmock every "email test" would exercise a stub that always returns true.
vi.unmock('../emailService.js');
const emailService: typeof import('../emailService.js') = await import('../emailService.js');

const ENV_KEYS = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_SECURE', 'SMTP_FROM', 'EMAIL_FROM'];
const savedEnv: Record<string, string | undefined> = {};

function stubDeps(sendMail: ReturnType<typeof vi.fn>) {
  const createTransport = vi.fn(() => ({ sendMail }));
  emailService.setDependencies({
    // settings table intentionally empty: env must drive the config
    db: { all: (_sql: string, _p: unknown[], cb: Function) => cb(null, []) } as never,
    nodemailer: { createTransport },
    config: {},
  });
  return createTransport;
}

describe('emailService — envelope sender and delivery reporting', () => {
  beforeEach(() => {
    for (const k of ENV_KEYS) {
      savedEnv[k] = process.env[k];
      delete process.env[k];
    }
    process.env.SMTP_HOST = 'smtp.example.invalid';
    process.env.SMTP_USER = 'mailbox@example.invalid';
    process.env.SMTP_PASS = 'secret';
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (savedEnv[k] === undefined) delete process.env[k];
      else process.env[k] = savedEnv[k] as string;
    }
    vi.restoreAllMocks();
  });

  it('sends as EMAIL_FROM when SMTP_FROM is not configured', async () => {
    process.env.EMAIL_FROM = 'hello@example.invalid';
    const sendMail = vi.fn().mockResolvedValue({ messageId: 'x' });
    stubDeps(sendMail);

    const ok = await emailService.send({ to: 'user@example.invalid', subject: 'S', html: '<p>x</p>' });

    expect(ok).toBe(true);
    expect(sendMail.mock.calls[0][0].from).toBe('hello@example.invalid');
  });

  it('never falls back to a foreign hard-coded domain: uses the authenticated mailbox', async () => {
    const sendMail = vi.fn().mockResolvedValue({ messageId: 'x' });
    stubDeps(sendMail);

    await emailService.send({ to: 'user@example.invalid', subject: 'S', html: '<p>x</p>' });

    expect(sendMail.mock.calls[0][0].from).toBe('mailbox@example.invalid');
    expect(String(sendMail.mock.calls[0][0].from)).not.toContain('system@consultify.com');
  });

  it('derives implicit TLS from port 465 and honours SMTP_SECURE', async () => {
    const sendMail = vi.fn().mockResolvedValue({ messageId: 'x' });
    process.env.SMTP_PORT = '465';
    let createTransport = stubDeps(sendMail);
    await emailService.send({ to: 'u@example.invalid', subject: 'S', html: 'x' });
    expect(createTransport.mock.calls[0][0].secure).toBe(true);

    process.env.SMTP_PORT = '587';
    process.env.SMTP_SECURE = 'true';
    createTransport = stubDeps(sendMail);
    await emailService.send({ to: 'u@example.invalid', subject: 'S', html: 'x' });
    expect(createTransport.mock.calls[0][0].secure).toBe(true);
  });

  it('reports FALSE when a configured provider rejects the message', async () => {
    const sendMail = vi
      .fn()
      .mockRejectedValue(new Error('553 5.7.1 Sender address rejected: not owned by user'));
    stubDeps(sendMail);

    const ok = await emailService.send({ to: 'user@example.invalid', subject: 'S', html: '<p>x</p>' });

    expect(ok).toBe(false);
  });
});
