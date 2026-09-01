/**
 * Dev-render: HP-4 F3 entry point proof.
 *
 * ★ SPROSTOWANIE 2026-09-01 (AUDYT_PRZYRZADU_20260901.md, Kategoria 4).
 * Ten nagłówek TWIERDZIŁ, że `AgentPlanView` jest „wpięty w nową trasę
 * /agent-plan (AppRoutes.tsx) i pozycję w menu (menuConfig.ts)". W tej gałęzi
 * to NIEPRAWDA i zmierzyłem to:
 *   grep -rn "AgentPlanView" src/ server/src/ → ZERO trafień poza
 *   `src/views/AgentPlanView.tsx`; `/agent-plan` (AppRoutes.tsx:1618) jest
 *   wyłącznie przekierowaniem na `Moja praca?tab=agent` (relokacja AGT-003).
 * Warsztat agenta użytkownik widzi INNĄ drogą: MyWorkHub → AgentHubShell →
 * AgentPlanWorkspace (AgentHubShell.tsx:1700). Ten plik montuje więc
 * osieroconą powierzchnię sprzed relokacji — jest PRZYRZĄDEM, nie ekranem
 * produktu, i dlatego stoi w rejestrze z oceną C („nie pokazujemy").
 * Nie usuwamy go i nie ruszamy produktu; ostrzeżenie ma nie wrócić.
 *
 * Mounts the REAL `AgentPlanView` (src/views/AgentPlanView.tsx) z dwoma
 * zamockowanymi wołaniami agent-plan (dev-render/mocks/agentPlanMocks.ts),
 * więc renderuje się bez backendu/DB/logowania.
 *
 * Click through: pick a manifest → "Start agent" → panel swaps to
 * AgentPlanPanel and polls (mock advances steps automatically) → an
 * awaiting_approval step appears → "Approve step" completes the plan.
 */
import React, { useEffect, useState } from 'react';

import { installAgentPlanFetchMock } from '../mocks/agentPlanMocks';

export default function AgentPlanViewScreen(): React.ReactElement {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    installAgentPlanFetchMock();
    setReady(true);
  }, []);

  if (!ready) return <div className="h-screen w-screen bg-c-bg" />;

  // Lazy import AFTER the fetch mock is installed so the component's first
  // effect (listAgentManifests) hits the mock, not a real backend.
  const AgentPlanView = React.lazy(() => import('@/views/AgentPlanView'));

  return (
    <div className="h-screen w-screen overflow-y-auto bg-c-bg p-8">
      <React.Suspense fallback={<div className="text-c-text-muted text-sm">Loading…</div>}>
        <AgentPlanView />
      </React.Suspense>
    </div>
  );
}
