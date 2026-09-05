/**
 * DEV-RENDER — REALNY `<ResultsRoiHub>` w stanie „domena ROI wygaszona dla
 * organizacji" (blokada odbioru 05.09, naprawa z 05.09).
 *
 * PO CO TEN EKRAN. Odbiór na żywo 05.09 zmierzył, że właściciel DBR77 widzi
 * w rejestrze ROI tylko „Brak spraw ROI", a przycisk „Nowa sprawa ROI"
 * kończy się 403 `ROI_CASE_CREATION_NOT_AUTHORIZED`. Naprawa dokłada odczyt
 * `GET /vnext/results/roi/visibility-policy` i zamienia ten martwy stan na
 * uczciwy komunikat + jednorazową akcję „Włącz ROI dla organizacji"
 * (OWNER/ADMIN).
 *
 * DLACZEGO HARNESS, A NIE ZRZUT Z APLIKACJI (uczciwie, wprost). Lokalny
 * frontend chodzi na proxy do BACKENDU STAGINGU — a tam nowej trasy
 * `GET /visibility-policy` jeszcze nie ma (404), więc na żywo ekran pokaże
 * dziś stan sprzed naprawy. Backendu nie da się też uruchomić lokalnie:
 * `server/src/config/databaseTargetResolver.ts` twardo odrzuca lokalny
 * DATABASE_URL poza testami. Ten harness mountuje WIĘC PRAWDZIWY komponent
 * produkcyjny (`src/components/ResultsVNext/roi/ResultsRoiHub.tsx`, zero
 * reimplementacji) i podmienia wyłącznie warstwę HTTP — dokładnie ta sama
 * konwencja, co `results-vnext-kpi-registry.tsx`.
 *
 * Parametry URL:
 *   ?screen=roi-visibility-activation
 *   &rola=owner|czlonek   kto patrzy (default owner) — OWNER/ADMIN dostaje
 *                         akcję, zwykły członek dostaje samo wyjaśnienie
 *   &stan=wylaczone|wlaczone  (default wylaczone) — stan polityki na starcie
 */
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import { ResultsRoiHub } from '../../src/components/ResultsVNext/roi/ResultsRoiHub';
import { useAppStore } from '../../src/store/useAppStore';

const params = new URLSearchParams(window.location.search);
const rola = params.get('rola') === 'czlonek' ? 'czlonek' : 'owner';

try {
  window.localStorage.setItem('ff.results_vnext_roi_registry', '1');
} catch {
  // no-op — dev-render only
}

useAppStore.setState({
  currentUser: {
    id: 'user-piotr-demo',
    firstName: 'Piotr',
    lastName: 'Wiśniewski',
    email: 'piotr.wisniewski@dbr77.com',
    role: rola === 'owner' ? 'OWNER' : 'MEMBER',
  },
  currentOrganization: { id: 'org-dbr77-demo', name: 'DBR77' },
} as never);

// Stan polityki żyje w harnessie, żeby klik „Włącz ROI dla organizacji"
// realnie przestawiał ekran (przed -> po), a nie tylko malował jeden kadr.
let opublikowana = params.get('stan') === 'wlaczone';

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const realFetch = window.fetch.bind(window);
window.fetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const method = (init?.method || 'GET').toUpperCase();

  if (url.includes('/vnext/results/roi/visibility-policy')) {
    if (method === 'POST') {
      opublikowana = true;
      return json({
        outcome: 'applied',
        publication: {
          organizationId: 'org-dbr77-demo',
          publishedBy: 'user-piotr-demo',
          publishedAt: new Date().toISOString(),
          policyKey: 'AMD-FLOW-ROI-VISIBILITY-002/v1',
        },
      });
    }
    return json(
      opublikowana
        ? {
            published: true,
            publication: {
              organizationId: 'org-dbr77-demo',
              publishedBy: 'user-piotr-demo',
              publishedAt: new Date().toISOString(),
              policyKey: 'AMD-FLOW-ROI-VISIBILITY-002/v1',
            },
            canPublish: false,
            blocker: 'ALREADY_PUBLISHED',
          }
        : {
            published: false,
            publication: null,
            canPublish: rola === 'owner',
            blocker: rola === 'owner' ? null : 'ORDINARY_MEMBER_DENIED',
          }
    );
  }

  // Rejestr jest pusty w obu stanach — bo tak wygląda organizacja, która
  // dopiero co włączyła domenę. Różnica, którą ma pokazać zrzut, jest w
  // KOMUNIKACIE i AKCJI, nie w wierszach.
  if (url.includes('/vnext/results/roi/cases')) return json({ cases: [] });
  if (url.includes('/vnext/results/roi/org/benefits-realization')) return json({ cases: [] });
  if (url.includes('/organizations/')) return json({ members: [] });
  if (url.includes('/initiatives')) return json([]);
  return realFetch(input as RequestInfo, init);
}) as typeof window.fetch;

const RoiVisibilityActivationScreen: React.FC = () => (
  <div className="h-screen bg-c-bg text-c-text">
    <MemoryRouter initialEntries={['/results/roi']}>
      <ResultsRoiHub />
    </MemoryRouter>
  </div>
);

export default RoiVisibilityActivationScreen;
