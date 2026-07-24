/**
 * Dev-render: WARSZTAT AGENTA — trzy kolumny (sterowanie · schemat · paleta).
 *
 * Montuje PRAWDZIWY `AgentPlanPanel` (src/components/AIChat/AgentPlanPanel.tsx)
 * na mockach `dev-render/mocks/agentWorkshopMocks.ts`. Wybór stanu przez
 * parametr URL `&case=`:
 *   planning  (domyślny) — schemat edytowalny: paleta aktywna, drag&drop,
 *                          klocek „Informacja" w środku przepływu,
 *   executing            — plan w toku: krok 3/5 wyróżniony jako „TERAZ",
 *   approval             — plan na bramce: „Zatwierdź krok" w sekcji Zgody.
 *
 * Zrzuty do odbioru: każdy przypadek w `&theme=light` i `&theme=dark`.
 *
 * ⚠ Mock fetch instalujemy w ZAKRESIE MODUŁU (nie w efekcie + React.lazy).
 * `React.lazy()` wołane w ciele komponentu tworzy NOWY typ komponentu przy
 * każdym renderze — w React 19 pod StrictMode (podwójny render) Suspense nigdy
 * się nie rozwiązuje i ekran zostaje na „Wczytuję…". Panel woła fetch dopiero
 * w efekcie po zamontowaniu, więc zwykły import jest tu bezpieczny.
 */
import React from 'react';

import { AgentPlanPanel } from '@/components/AIChat/AgentPlanPanel';

import { installAgentWorkshopFetchMock } from '../mocks/agentWorkshopMocks';

installAgentWorkshopFetchMock();

const CASE_TO_PLAN: Record<string, string> = {
  planning: 'warsztat-planning',
  executing: 'warsztat-executing',
  approval: 'warsztat-approval',
};

export default function AgentWarsztatScreen(): React.ReactElement {
  const params = new URLSearchParams(window.location.search);
  const planId = CASE_TO_PLAN[params.get('case') ?? 'planning'] ?? CASE_TO_PLAN.planning;

  return (
    <div className="h-screen w-screen overflow-hidden bg-c-bg">
      <AgentPlanPanel key={planId} planId={planId} pollIntervalMs={999999} onClose={() => {}} />
    </div>
  );
}
