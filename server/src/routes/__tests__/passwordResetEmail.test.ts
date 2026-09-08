/**
 * Password reset email — PL/EN copy, escaping, sender display name.
 *
 * POMIAR (2026-09-08): przed tą zmianą `buildPasswordResetEmailHtml` w
 * auth.routes.ts renderowała goły <h2> po angielsku, bez wersji PL, bez
 * `text`, a `from` w emailService.ts wysyłał surowy adres (widoczny na
 * stagingu jako "hello@consultinity.com <hello@consultinity.com>").
 *
 * Ten test nie dotyka bazy ani Express — importuje wyłącznie czyste
 * budowniczych funkcje wyeksportowane z auth.routes.ts
 * (resolvePasswordResetEmailLang, buildPasswordResetEmail,
 * PASSWORD_RESET_EMAIL_SUBJECT) i formatFromAddress z emailService.ts.
 */
import nodemailer from 'nodemailer';
import { describe, expect, it } from 'vitest';

import {
  buildPasswordResetEmail,
  PASSWORD_RESET_EMAIL_SUBJECT,
  resolvePasswordResetEmailLang,
} from '../auth.routes.js';
import { formatFromAddress } from '../../services/email/fromAddress.js';

describe('resolvePasswordResetEmailLang', () => {
  it('defaults to pl when no language is set', () => {
    expect(resolvePasswordResetEmailLang(undefined)).toBe('pl');
    expect(resolvePasswordResetEmailLang(null)).toBe('pl');
    expect(resolvePasswordResetEmailLang('')).toBe('pl');
  });

  it('defaults to pl for any language other than the literal "en"', () => {
    expect(resolvePasswordResetEmailLang('pl')).toBe('pl');
    expect(resolvePasswordResetEmailLang('fr')).toBe('pl');
    expect(resolvePasswordResetEmailLang('de')).toBe('pl');
  });

  it('selects en (case-insensitively) only for "en"', () => {
    expect(resolvePasswordResetEmailLang('en')).toBe('en');
    expect(resolvePasswordResetEmailLang('EN')).toBe('en');
    expect(resolvePasswordResetEmailLang(' En ')).toBe('en');
  });
});

describe('PASSWORD_RESET_EMAIL_SUBJECT', () => {
  it('has the exact PL/EN subject lines from the spec', () => {
    expect(PASSWORD_RESET_EMAIL_SUBJECT.pl).toBe('Consultify — reset hasła');
    expect(PASSWORD_RESET_EMAIL_SUBJECT.en).toBe('Consultify — password reset');
  });
});

describe('buildPasswordResetEmail', () => {
  const resetLink = 'https://demo.consultify.ai/reset-password?token=abc123XYZ';

  it('renders Polish copy with the greeting, link, and real TTL (not hardcoded)', () => {
    const { html, text } = buildPasswordResetEmail({
      lang: 'pl',
      firstName: 'Piotr',
      resetLink,
      ttlMinutes: 45,
    });

    expect(html).toContain('Cześć Piotr,');
    expect(html).toContain('Ustaw nowe hasło');
    expect(html).toContain(resetLink);
    expect(html).toContain('45 minut');
    expect(html).toContain('Jeśli to nie Ty prosiłeś o zmianę hasła');
    // No crimson CTA — Consultify UI rule: red is critical-severity only.
    expect(html.toLowerCase()).not.toContain('#85182f');

    expect(text).toContain('Cześć Piotr,');
    expect(text).toContain(resetLink);
    expect(text).toContain('45 minut');
  });

  it('falls back to a neutral Polish greeting when no first name is present', () => {
    const { html } = buildPasswordResetEmail({
      lang: 'pl',
      firstName: null,
      resetLink,
      ttlMinutes: 60,
    });
    expect(html).toContain('Dzień dobry,');
    expect(html).not.toContain('Cześć');
  });

  it('renders English copy with a real TTL value taken from params', () => {
    const { html, text } = buildPasswordResetEmail({
      lang: 'en',
      firstName: 'Jane',
      resetLink,
      ttlMinutes: 30,
    });

    expect(html).toContain('Hi Jane,');
    expect(html).toContain('Set a new password');
    expect(html).toContain(resetLink);
    expect(html).toContain('30 minutes');
    expect(html).toContain('you can safely ignore this email');

    expect(text).toContain('Hi Jane,');
    expect(text).toContain('30 minutes');
  });

  it('falls back to a neutral English greeting when no first name is present', () => {
    const { html } = buildPasswordResetEmail({
      lang: 'en',
      firstName: undefined,
      resetLink,
      ttlMinutes: 60,
    });
    expect(html).toContain('Hello,');
  });

  it('HTML-escapes the first name to prevent markup/script injection', () => {
    const { html } = buildPasswordResetEmail({
      lang: 'pl',
      firstName: '<script>alert(1)</script>',
      resetLink,
      ttlMinutes: 60,
    });

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('never puts the raw token anywhere except inside the link URL', () => {
    const { html, text } = buildPasswordResetEmail({
      lang: 'pl',
      firstName: 'Piotr',
      resetLink,
      ttlMinutes: 60,
    });
    // The token only ever appears as part of the resetLink query string —
    // there is exactly one occurrence pattern (the link), never bare.
    const tokenOnly = 'abc123XYZ';
    const htmlOccurrences = html.split(tokenOnly).length - 1;
    const textOccurrences = text.split(tokenOnly).length - 1;
    // html: CTA href + copy-paste href + copy-paste visible link text = 3.
    expect(htmlOccurrences).toBe(3);
    expect(textOccurrences).toBe(1);
  });
});

describe('formatFromAddress (emailService.ts)', () => {
  it('wraps a bare address with a default "Consultify" display name', () => {
    expect(formatFromAddress('hello@consultinity.com')).toBe(
      '"Consultify" <hello@consultinity.com>'
    );
  });

  it('uses EMAIL_FROM_NAME when provided', () => {
    expect(formatFromAddress('hello@consultinity.com', 'Consultify Ops')).toBe(
      '"Consultify Ops" <hello@consultinity.com>'
    );
  });

  it('leaves an already-named From address untouched', () => {
    expect(formatFromAddress('"Consultify Support" <support@consultinity.com>')).toBe(
      '"Consultify Support" <support@consultinity.com>'
    );
    expect(formatFromAddress('Consultify <hello@consultinity.com>')).toBe(
      'Consultify <hello@consultinity.com>'
    );
  });

  it('never touches the actual mailbox address, only adds a name', () => {
    const result = formatFromAddress('hello@consultinity.com');
    expect(result).toContain('<hello@consultinity.com>');
  });
});

describe('nodemailer RFC 2047 subject encoding (real nodemailer, no network)', () => {
  it('encodes the Polish subject as a MIME encoded-word, not raw UTF-8 bytes', async () => {
    const transporter = nodemailer.createTransport({ streamTransport: true, buffer: true });
    const info = await transporter.sendMail({
      from: formatFromAddress('hello@consultinity.com'),
      to: 'user@example.com',
      subject: PASSWORD_RESET_EMAIL_SUBJECT.pl,
      html: '<p>test</p>',
      text: 'test',
    });

    const raw = (info.message as Buffer).toString('utf8');
    const subjectLine = raw.split('\r\n').find((line) => line.startsWith('Subject:'));

    expect(subjectLine).toBeDefined();
    // RFC 2047 encoded-word form: =?UTF-8?Q?...?= or =?UTF-8?B?...?=
    expect(subjectLine).toMatch(/=\?UTF-8\?[QB]\?/i);
    // The raw em dash / "ł" must NOT appear unencoded in the header.
    expect(subjectLine).not.toContain('—');
    expect(subjectLine).not.toContain('ł');

    // From header carries the display name, not a bare repeated address.
    const fromLine = raw.split('\r\n').find((line) => line.startsWith('From:'));
    expect(fromLine).toContain('Consultify');
    expect(fromLine).toContain('hello@consultinity.com');
  });
});
