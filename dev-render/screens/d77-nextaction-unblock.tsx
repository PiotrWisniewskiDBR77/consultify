/**
 * Dev-render: D-77 (DLUG-PO-MVP, P2/S) — REALNY <InitiativesHub> na danych
 * showcase (`createInitiativesDemoDataset`), żeby zmierzyć rekomendację
 * readiness w podglądzie zablokowanej inicjatywy (status IN_EXECUTION).
 *
 * Przed naprawą podgląd przy `lang=en` pokazywał polski literał
 * „Usuń blokadę realizacji" (wiersz demo niósł surowe `nextAction` bez
 * `nextActionKey`). Po naprawie rozwiązuje się przez
 * `enumLabel('initiativeNextAction','UNBLOCK')` → „Resume execution".
 *
 * Stub `window.fetch` (tylko odczyt) zwraca 200 dla endpointów pomocniczych
 * (users/organizations/v8/transition-preflight), żeby zrzut miał
 * bledyKonsoli=0; `/api/initiatives` NIE jest stubowane — w trybie demo
 * InitiativesHub sam podstawia dane showcase.
 */
import React from 'react';

import { InitiativesHub } from '../../src/components/Initiatives/InitiativesHub';
import { AppProviders } from '../../src/providers/AppProviders';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

const realFetch = window.fetch.bind(window);
window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (/\/organizations\/[^/]+\/members/.test(url)) return json([]);
  if (url.startsWith('/api') || url.includes('/api/')) return json({ data: [] });
  return realFetch(input as RequestInfo, init);
}) as typeof window.fetch;

export default function D77NextActionUnblockScreen() {
  return (
    <AppProviders>
      <div style={{ height: '100vh' }}>
        <InitiativesHub />
      </div>
    </AppProviders>
  );
}
