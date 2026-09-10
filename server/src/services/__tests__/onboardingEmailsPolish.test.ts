/**
 * Bezpiecznik P1 (2026-09-10).
 *
 * Pilotaż prowadzą polskojęzyczni użytkownicy, a trzy maile PIERWSZEGO kontaktu
 * — zaproszenie, potwierdzenie adresu, powitanie — były twardo po angielsku
 * ("You have been invited to Consultify", "Verify your email",
 * "Welcome to Consultify"). Zmierzone na żywym stagingu 2026-09-10 05:46-05:51.
 * Ten test pilnuje, żeby nie wróciły, oraz żeby odmowa zaproszenia niosła
 * powód, a nie samo "Invitation payload is invalid.".
 */
import { describe, expect, it, vi } from 'vitest';

import { classifyInvitationCreateFailure } from '../../controllers/InvitationController.js';
import { sendWelcomeEmail } from '../welcomeEmailService.js';

const ANGIELSKIE_TEMATY = [
  'Welcome to Consultify',
  'Verify your email',
  'You have been invited to Consultify',
];

describe('maile onboardingu są po polsku', () => {
  it('mail powitalny ma polski temat i polską treść', async () => {
    const send = vi.fn().mockResolvedValue(true);
    vi.doMock('../emailService.js', () => ({ default: { send } }));

    await sendWelcomeEmail({
      email: 'pilotaz@example.test',
      firstName: 'Tomek',
      companyName: 'Firma Pilotażowa',
    });

    expect(send).toHaveBeenCalledTimes(1);
    const wiadomosc = send.mock.calls[0][0];

    expect(wiadomosc.subject).toContain('Witamy w Consultify');
    for (const angielski of ANGIELSKIE_TEMATY) {
      expect(wiadomosc.subject).not.toContain(angielski);
    }

    // Sam polski temat nad angielską treścią to półśrodek — sprawdzamy treść.
    expect(wiadomosc.html).toContain('Cześć Tomek');
    expect(wiadomosc.html).toContain('Przejdź do pulpitu');
    expect(wiadomosc.html).toContain('lang="pl"');
    expect(wiadomosc.html).not.toContain('Go to Dashboard');
    expect(wiadomosc.html).not.toContain('Best regards');

    vi.doUnmock('../emailService.js');
  });
});

describe('odmowa zaproszenia niesie powód, a nie ogólnik', () => {
  it('wyczerpane miejsca dostają własny kod i status, nie ogólne 400', () => {
    const wynik = classifyInvitationCreateFailure(
      'Organization has reached maximum seats. Please upgrade to add more members.'
    );

    // Powód podróżuje w kodzie — tekst należy do klienta (bramka J0 zabrania
    // dokładania zdań z serwera do UI w którymkolwiek języku).
    expect(wynik.code).toBe('INVITATION_SEAT_LIMIT_REACHED');
    // Regresja, przed którą bronimy: wszystko wpadało w jedno, nierozróżnialne 400.
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
