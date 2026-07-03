/**
 * emailService template wiring — unit tests (Task #84)
 *
 * Verifies that emailService.send() renders the branded .hbs templates through
 * the transport (mocked nodemailer), that an explicit `html` opts out of the
 * template, and that a bad/missing template falls back to inline content
 * instead of blocking the send.
 *
 * NOTE: the global tests/setup.ts mocks emailService (via the
 * server/services -> server/src/services alias). We deliberately load the REAL
 * module with `vi.importActual` and mock only its `nodemailer` dependency so
 * the actual send/render logic executes.
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

// The global tests/setup.ts mocks emailService via the server/services alias;
// undo it so we can load the real module below.
vi.unmock('../server/services/emailService.js');

// Mock the transport dependency the real emailService imports lazily.
const sendMail = vi.fn().mockResolvedValue({ messageId: 'test' });
const createTransport = vi.fn(() => ({ sendMail }));
vi.mock('nodemailer', () => ({ default: { createTransport }, createTransport }));

// SMTP settings via env so the transport branch is exercised (the real module
// reads env when the DB `settings` table yields nothing).
process.env.SMTP_HOST = 'smtp.example.com';
process.env.SMTP_USER = 'user@example.com';
process.env.SMTP_PASS = 'secret';

type SendFn = (opts: {
  to: string;
  subject: string;
  html?: string;
  template?: string;
  data?: Record<string, unknown>;
}) => Promise<boolean>;

let send: SendFn;

function lastSentHtml(): string {
  const call = sendMail.mock.calls[sendMail.mock.calls.length - 1];
  return call[0].html as string;
}

describe('emailService.send() template wiring', () => {
  beforeAll(async () => {
    const real = await vi.importActual<{ send: SendFn }>(
      '../../../../server/src/services/emailService.js'
    );
    send = real.send;
  });

  beforeEach(() => {
    sendMail.mockClear();
    createTransport.mockClear();
  });

  it('renders billing/invoice_created via the "invoice_created" alias', async () => {
    const ok = await send({
      to: 'admin@acme.test',
      subject: 'Invoice',
      template: 'invoice_created',
      data: {
        recipientName: 'Grace Hopper',
        invoiceNumber: 'INV-202607-0042',
        amount: '250.00',
        currency: 'USD',
        dueDate: '2026-07-31',
      },
    });

    expect(ok).toBe(true);
    expect(sendMail).toHaveBeenCalledTimes(1);
    const html = lastSentHtml();
    expect(html).toContain('Grace Hopper');
    expect(html).toContain('INV-202607-0042');
    expect(html).toContain('250.00');
    // Not the JSON-dump fallback.
    expect(html).not.toContain('Template: invoice_created');
  });

  it('maps the legacy "invoice" alias to billing/invoice_created', async () => {
    await send({
      to: 'admin@acme.test',
      subject: 'Invoice',
      template: 'invoice',
      data: { recipientName: 'Legacy Caller', invoiceNumber: 'L-1', amount: '9' },
    });
    expect(lastSentHtml()).toContain('Legacy Caller');
  });

  it('renders billing/subscription_canceled', async () => {
    await send({
      to: 'admin@acme.test',
      subject: 'Canceled',
      template: 'subscription_canceled',
      data: {
        recipientName: 'Alan Turing',
        planName: 'Pro',
        cancellationDate: '2026-07-01',
        accessUntilDate: '2026-07-31',
      },
    });
    const html = lastSentHtml();
    expect(html).toContain('Alan Turing');
    expect(html).not.toContain('Template: subscription_canceled');
  });

  it('explicit html opts out of the template', async () => {
    await send({
      to: 'admin@acme.test',
      subject: 'Custom',
      template: 'invoice_created',
      html: '<p>MY-CUSTOM-BODY</p>',
      data: { recipientName: 'Ignored' },
    });
    const html = lastSentHtml();
    expect(html).toBe('<p>MY-CUSTOM-BODY</p>');
    expect(html).not.toContain('Ignored');
  });

  it('falls back to inline JSON content when the template does not exist', async () => {
    const ok = await send({
      to: 'admin@acme.test',
      subject: 'Dunning',
      template: 'dunning_retry_1', // no matching .hbs
      data: { firstName: 'Team' },
    });
    // Send still succeeds (never blocked) and uses the JSON-dump fallback.
    expect(ok).toBe(true);
    const html = lastSentHtml();
    expect(html).toContain('Template: dunning_retry_1');
  });
});
