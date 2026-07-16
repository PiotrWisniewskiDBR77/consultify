/**
 * Dev-render: HP-4 F3 entry point proof.
 *
 * Mounts the REAL `AgentPlanView` (src/views/AgentPlanView.tsx) — the exact
 * component wired onto the new `/agent-plan` route (see AppRoutes.tsx) and
 * sidebar item (menuConfig.ts) — with the two real agent-plan API calls
 * mocked (dev-render/mocks/agentPlanMocks.ts) so this proves the entry point
 * itself works without needing a backend/DB/login.
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
