/**
 * Dev-render: AGT-010/AGT-011 proof — powłoka "Run agent" (Moje procesy | Szablony).
 *
 * Mounts the REAL `AgentHubShell` (src/components/AIChat/AgentHubShell.tsx)
 * with the agent-plan endpoints mocked (dev-render/mocks/agentHubMocks.ts) —
 * no backend/DB/login needed. Proves CLAUDE.md #7 (render-verify BEFORE
 * Piotr sees it).
 *
 * Click through (do zrzutu):
 *  - "Moje procesy" tabela: 5 wierszy, statusy planning/executing/
 *    awaiting_approval/completed/failed, kolumna postęp (x/5 kroków).
 *  - Klik w wiersz → AgentPlanWorkspace (ArtifactRightPanel) tego planu.
 *  - "Szablony" pigułka (AGT-011) → tabela łącząca ProcessLibrary (classic-5
 *    domyślny, chip "Domyślny" + drd) z próbką katalogu manifestów (chip
 *    "Gotowa analiza"), kolumna "Liczba kroków".
 *  - "Nowy proces" → tworzy plan classic-5 w trybie draft, otwiera canvas
 *    edytowalny (AgentPlanCanvas, status 'planning'). Klik w wiersz Szablonów
 *    robi to samo dla procesu (draft) albo tworzy plan od razu dla manifestu.
 */
import React, { useEffect, useState } from 'react';

import { installAgentHubFetchMock } from '../mocks/agentHubMocks';

export default function AgentHubScreen(): React.ReactElement {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    installAgentHubFetchMock();
    setReady(true);
  }, []);

  if (!ready) return <div className="h-screen w-screen bg-c-bg" />;

  // Lazy import AFTER the fetch mock is installed so the shell's first
  // effect (listAgentPlans) hits the mock, not a real backend.
  const AgentHubShell = React.lazy(() =>
    import('@/components/AIChat/AgentHubShell').then((m) => ({ default: m.AgentHubShell }))
  );

  return (
    <div className="h-screen w-screen overflow-hidden bg-c-bg">
      <React.Suspense fallback={<div className="text-c-text-muted text-sm p-8">Loading…</div>}>
        <AgentHubShell />
      </React.Suspense>
    </div>
  );
}
