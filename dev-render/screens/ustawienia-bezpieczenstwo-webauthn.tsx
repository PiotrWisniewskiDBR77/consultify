/**
 * JEZYK-CRIMSON-3 (09.09) — dowód wzrokiem dla WebAuthnSettings.tsx.
 *
 * STOP zmierzony przy tej paczce: `WebAuthnSettings.tsx` nie ma ANI JEDNEGO
 * importera w calym `src/` (grep potwierdza — nie jest eksportowany nawet
 * z barrela `components/settings/security/index.ts`, nie jest wolany z
 * zadnej sekcji <SettingsView>). To martwy kod, nieosiagalny przez zywa
 * nawigacje aplikacji — dlatego harness montuje go STANDALONE (CLAUDE.md #7:
 * "dev-render/harness z mock-danymi, bez logowania Piotra"), zamiast probowac
 * przejsc do niego z realnego ekranu Ustawien (co jest niemozliwe).
 *
 * Zero mockow API: `api.get('/auth/webauthn/credentials')` naturalnie
 * zawiedzie (brak backendu pod adresem harnessu) — komponent lapie ten
 * blad sam (`setError('Failed to load passkeys')`) i mimo to renderuje
 * Info Box ("What are passkeys?") bezwarunkowo, wiec dowod jest wierny.
 *
 * URL: ?screen=ustawienia-bezpieczenstwo-webauthn&lang=pl|en&theme=light|dark
 */
import React from 'react';

import WebAuthnSettings from '../../src/components/settings/security/WebAuthnSettings';

export default function UstawieniaBezpieczenstwoWebAuthnScreen(): React.ReactElement {
  return (
    <div className="min-h-screen bg-c-bg p-8">
      <div className="mx-auto max-w-2xl">
        <WebAuthnSettings />
      </div>
    </div>
  );
}
