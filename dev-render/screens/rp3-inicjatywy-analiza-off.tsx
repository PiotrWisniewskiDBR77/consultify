/**
 * RP3 (17.09) — REALNY <InitiativesHub> przy fladze VITE_INITIATIVES_FOUR_BUTTONS
 * OFF (harness startowany BEZ tej zmiennej) z soczewką „Analysis" z przelacznika
 * „Initiative workspace" (`?lens=analysis`).
 *
 * Po co: zlecenie RP3 usuwa atrapę `InitiativePreparationReadView`. Zrzut ma
 * pokazywać PRODUKT (całą powłokę Menu 1/2/3 z rejestrem), nie przyrząd, dlatego
 * montujemy produkcyjny hub, a nie wycinek. Atrapy `/api/*` gaszą 404 konsoli
 * (bramka zrzutów: bledyKonsoli=0) — bez backendu, zgodnie z przeznaczeniem
 * harnessu (dev-render/vite.config.ts).
 *
 * Query: &lens=analysis|list &lang=pl|en &theme=light|dark
 */
import React from 'react';

import { InitiativesHub } from '../../src/components/Initiatives/InitiativesHub';
import { AppProviders } from '../../src/providers/AppProviders';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();

const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

const EMPTY_LIST = { users: [], members: [], organizations: [], decisions: [], approvals: [] };

const originalFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = String(input);
  if (!url.includes('/api/')) return originalFetch(input, init);
  if (url.includes('/api/users')) return json(EMPTY_LIST);
  if (url.includes('/members')) return json([]);
  if (url.includes('/pending-decisions')) return json([]);
  if (url.includes('/admin/flags')) return json({ flags: {} });
  if (url.includes('/definition-approvals')) return json({ approvals: [] });
  if (url.includes('/organizations/current')) return json({ organizations: [] });
  return json({});
};

export default function Rp3InicjatywyAnalizaOffScreen(): React.ReactElement {
  return (
    <AppProviders>
      <div style={{ height: '100vh' }} data-testid="rp3-inicjatywy-analiza-off">
        <InitiativesHub />
      </div>
    </AppProviders>
  );
}
