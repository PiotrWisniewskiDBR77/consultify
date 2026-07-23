/**
 * Dev-render: AGT-007 proof — przestawialny schemat klocków.
 *
 * Mounts the REAL `AgentPlanPanel` (src/components/AIChat/AgentPlanPanel.tsx)
 * twice, side by side, both plans in status `planning` (mock —
 * dev-render/mocks/agentPlanCanvasMocks.ts) so the panel renders the
 * editable `AgentPlanCanvas` instead of the read-only step list:
 *
 *  - LEWO — ścieżka ① "AI proponuje": klasyczny schemat 5-fazowy od startu.
 *  - PRAWO — ścieżka ② "Ręcznie z klocków": pusty schemat, user dokłada.
 *
 * Click through (do zrzutu): przesuń klocek strzałkami, dodaj nowy
 * ("Dodaj klocek"), usuń jeden (kosz), zmień typ (select pod nazwą) —
 * wszystko trzyma się lokalnie (localStorage per planId), więc odświeżenie
 * strony pokazuje ostatni układ (dowód "zmiana się utrwala").
 */
import React, { useEffect, useState } from 'react';

import { installAgentPlanCanvasFetchMock } from '../mocks/agentPlanCanvasMocks';

export default function AgentPlanCanvasScreen(): React.ReactElement {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    installAgentPlanCanvasFetchMock();
    setReady(true);
  }, []);

  if (!ready) return <div className="h-screen w-screen bg-c-bg" />;

  // Lazy import AFTER the fetch mock is installed so the panel's first
  // effect (getAgentPlan) hits the mock, not a real backend.
  const AgentPlanPanel = React.lazy(() => import('@/components/AIChat/AgentPlanPanel'));

  return (
    <div className="h-screen w-screen overflow-y-auto bg-c-bg p-8">
      <div className="grid grid-cols-2 gap-8 max-w-5xl mx-auto">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-c-text-muted mb-2">
            Ścieżka ① — AI proponuje (klasyczny 5-fazowy)
          </h2>
          <React.Suspense fallback={<div className="text-c-text-muted text-sm">Loading…</div>}>
            <AgentPlanPanel planId="plan-canvas-path1" pollIntervalMs={999999} />
          </React.Suspense>
        </div>
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-c-text-muted mb-2">
            Ścieżka ② — Ręcznie z klocków (pusty start)
          </h2>
          <React.Suspense fallback={<div className="text-c-text-muted text-sm">Loading…</div>}>
            <AgentPlanPanel planId="plan-canvas-path2" pollIntervalMs={999999} />
          </React.Suspense>
        </div>
      </div>
    </div>
  );
}
