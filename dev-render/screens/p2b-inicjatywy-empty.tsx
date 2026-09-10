/**
 * P2B (DEC-457, 2026-09-10) — puste dane REALNEGO <InitiativesHub>.
 *
 * `dev-render/screens/inicjatywy-lista.tsx` (istniejący ekran) montuje ten sam
 * komponent, ale z `isDemoMode: true` (seedRealisticSession) — zawsze pokazuje
 * wbudowany zestaw demo, nigdy prawdziwie pusty rejestr. Ten plik wyłącza
 * demo-fallback (localStorage `consultify-storage.state.isDemoMode = false`)
 * i mockuje oba wołania rejestru (`listRegisteredInitiatives` →
 * `/api/initiatives/runtime-v1/initiatives`, `listLegacyInitiatives` →
 * `/api/initiatives`) tak, by zwracały 200 z pustą tablicą — bez tego
 * brak backendu w harnessie liczy się jako błąd sieci i komponent robi 3
 * próby ponowienia z rosnącym opóźnieniem (do ~14s) zanim pokaże pusty stan.
 *
 * Query: &theme=light|dark
 */
import React from 'react';

import { InitiativesHub } from '../../src/components/Initiatives/InitiativesHub';
import { AppProviders } from '../../src/providers/AppProviders';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();

try {
  const raw = window.localStorage.getItem('consultify-storage');
  const parsed = raw ? JSON.parse(raw) : { state: {} };
  parsed.state = { ...parsed.state, isDemoMode: false, isDemoSession: false };
  window.localStorage.setItem('consultify-storage', JSON.stringify(parsed));
} catch {
  // ignore — brak localStorage nie powinien wywalić harnessu
}

const originalFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = String(input);
  if (url.includes('/api/initiatives/runtime-v1/initiatives')) {
    return new Response(JSON.stringify({ initiatives: [], nextCursor: null }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (url.includes('/api/initiatives') && !url.includes('runtime-v1')) {
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return originalFetch(input, init);
};

export default function P2bInicjatywyEmptyScreen(): React.ReactElement {
  return (
    <AppProviders>
      <div style={{ height: '100vh' }} data-testid="p2b-inicjatywy-empty">
        <InitiativesHub />
      </div>
    </AppProviders>
  );
}
