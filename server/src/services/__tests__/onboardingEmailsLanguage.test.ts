/**
 * Bezpiecznik DEC-461 (2026-09-10 wieczór), następca P1 (2026-09-10 rano,
 * commit 0bfffeac4e, "polskie maile pierwszego kontaktu").
 *
 * P1 zaszył polski na sztywno w trzech mailach pierwszego kontaktu
 * (zaproszenie, potwierdzenie adresu, powitanie) — zanim DEC-461 ustalił,
 * że oprogramowanie buduje się PO ANGIELSKU, a polski jest tłumaczeniem.
 * Ten test pilnuje odwrotnego regresu: żeby EN nie zniknął z domyślnego
 * wariantu, a PL nie zniknął jako tłumaczenie.
 *
 * Rozróżnialna odmowa zaproszenia (kody 409/403/400/500 w
 * InvitationController.ts) zostaje bez zmian — testy niżej to potwierdzają.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { classifyInvitationCreateFailure } from '../../controllers/InvitationController.js';
import { InvitationSendingService } from '../invitation/InvitationSendingService.js';
import { sendWelcomeEmail } from '../welcomeEmailService.js';

// tests/setup.ts globally stubs emailVerificationService.js's `default`
// export (case-insensitive path match) to a no-op mock, for callers that
// don't care about email content. This suite DOES care about content, so
// it opts back into the real implementation and instead mocks the
// underlying transport (emailService.js) to inspect what was built.
vi.unmock('../emailVerificationService.js');

// Top-level (not inside describe/it) so Vitest's static hoisting applies
// this before welcomeEmailService's dynamic `import('./emailService.js')`
// and emailVerificationService's static `import EmailService from
// './emailService.js'` resolve — both point at the same file this mocks.
const emailSend = vi.fn().mockResolvedValue(true);
vi.mock('../emailService.js', () => ({
  default: { send: (...args: unknown[]) => emailSend(...args) },
  send: (...args: unknown[]) => emailSend(...args),
}));

const { sendVerificationEmail } = (await import('../emailVerificationService.js')).default;

afterEach(() => {
  emailSend.mockClear();
});

describe('mail powitalny (welcomeEmailService) — EN domyślnie, PL na życzenie', () => {
  it('bez podanego języka wysyła PO ANGIELSKU (DEC-461 default)', async () => {
    await sendWelcomeEmail({
      email: 'pilot@example.test',
      firstName: 'Tom',
      companyName: 'Pilot Co',
    });

    expect(emailSend).toHaveBeenCalledTimes(1);
    const message = emailSend.mock.calls[0][0];

    expect(message.subject).toContain('Welcome to Consultify');
    expect(message.html).toContain('Hi Tom,');
    expect(message.html).toContain('Go to dashboard');
    expect(message.html).toContain('lang="en"');
    expect(message.html).not.toContain('Cześć Tom');
    expect(message.html).not.toContain('Przejdź do pulpitu');
  });

  it('z lang="pl" wysyła PO POLSKU (tłumaczenie, nie domyślny wariant)', async () => {
    await sendWelcomeEmail({
      email: 'pilotaz@example.test',
      firstName: 'Tomek',
      companyName: 'Firma Pilotażowa',
      lang: 'pl',
    });

    const message = emailSend.mock.calls[0][0];
    expect(message.subject).toContain('Witamy w Consultify');
    expect(message.html).toContain('Cześć Tomek');
    expect(message.html).toContain('Przejdź do pulpitu');
    expect(message.html).toContain('lang="pl"');
    expect(message.html).not.toContain('Go to dashboard');
    expect(message.html).not.toContain('Best regards');
  });
});

describe('mail potwierdzenia adresu (emailVerificationService) — EN domyślnie, PL na życzenie', () => {
  it('bez podanego języka wysyła PO ANGIELSKU (DEC-461 default)', async () => {
    await sendVerificationEmail('pilot@example.test', 'Tom', 'token-abc');

    expect(emailSend).toHaveBeenCalledTimes(1);
    const message = emailSend.mock.calls[0][0];
    expect(message.subject).toBe('Verify your email');
    expect(message.html).toContain('Hi Tom,');
    expect(message.text).toContain('Hi Tom,');
    expect(message.html).not.toContain('Potwierdź swój adres e-mail');
  });

  it('z lang="pl" wysyła PO POLSKU', async () => {
    await sendVerificationEmail('pilotaz@example.test', 'Tomek', 'token-abc', 'pl');

    const message = emailSend.mock.calls[0][0];
    expect(message.subject).toBe('Potwierdź swój adres e-mail');
    expect(message.html).toContain('Cześć Tomek');
    expect(message.text).toContain('Cześć Tomek');
  });

  it('bez imienia spada na powitanie ogólne, nie na "Hi ,"', async () => {
    await sendVerificationEmail('pilot@example.test', '', 'token-abc');

    const message = emailSend.mock.calls[0][0];
    expect(message.html).toContain('Hello,');
    expect(message.html).not.toContain('Hi ,');
  });
});

describe('mail zaproszenia admin-IAM (InvitationSendingService.dispatchAdminIamInvitation) — EN domyślnie, PL na życzenie', () => {
  it('bez podanego języka wysyła PO ANGIELSKU (DEC-461 default)', async () => {
    const sender = vi.fn().mockResolvedValue(true);
    const service = new InvitationSendingService(sender);

    await service.dispatchAdminIamInvitation('invitee@example.test', 'token-xyz');

    expect(sender).toHaveBeenCalledTimes(1);
    const message = sender.mock.calls[0][0];
    expect(message.subject).toBe("You've been invited to Consultify");
    expect(message.html).toContain('Join your team on Consultify');
    expect(message.html).toContain('Accept invitation');
    expect(message.html).not.toContain('Zaproszenie do Consultify');
  });

  it('z lang="pl" wysyła PO POLSKU, w tym wariant "ponownie"', async () => {
    const sender = vi.fn().mockResolvedValue(true);
    const service = new InvitationSendingService(sender);

    await service.dispatchAdminIamInvitation('zaproszony@example.test', 'token-xyz', true, 'pl');

    const message = sender.mock.calls[0][0];
    expect(message.subject).toBe('Twoje zaproszenie do Consultify (ponownie)');
    expect(message.html).toContain('Wysyłamy Twój link z zaproszeniem jeszcze raz');
    expect(message.html).toContain('Przyjmij zaproszenie');
  });
});

describe('odmowa zaproszenia niesie powód, a nie ogólnik (bez zmian od P1)', () => {
  it('wyczerpane miejsca dostają własny kod i status, nie ogólne 400', () => {
    const wynik = classifyInvitationCreateFailure(
      'Organization has reached maximum seats. Please upgrade to add more members.'
    );

    expect(wynik.code).toBe('INVITATION_SEAT_LIMIT_REACHED');
    expect(wynik.status).toBe(409);
  });

  it('rozróżnia pozostałe znane odmowy', () => {
    expect(classifyInvitationCreateFailure('User is already a member').code).toBe(
      'INVITATION_ALREADY_MEMBER'
    );
    expect(classifyInvitationCreateFailure('Invitation already exists').code).toBe(
      'INVITATION_ALREADY_EXISTS'
    );
    expect(classifyInvitationCreateFailure('Trial has expired.').code).toBe(
      'INVITATION_TRIAL_EXPIRED'
    );
    expect(classifyInvitationCreateFailure('Invalid email format').code).toBe(
      'INVITATION_EMAIL_INVALID'
    );
  });

  it('nieznany błąd zostaje awarią serwera, nie winą użytkownika', () => {
    const wynik = classifyInvitationCreateFailure('ECONNRESET while writing to database');

    expect(wynik.status).toBe(500);
    expect(wynik.code).toBe('INVITATION_CREATE_FAILED');
  });
});
