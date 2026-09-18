import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../src/index.css';
import { Api } from '../src/services/api';
import { RolloutTab } from '../src/components/Execution/RolloutTab';

(Api as any).get = async (path: string) => {
  if (String(path).startsWith('/rollout/kpis')) return { data: { kpis: [] } };
  if (String(path).startsWith('/rollout/risks')) return { data: { risks: [] } };
  if (String(path).startsWith('/rollout/changes')) return { data: { changes: [] } };
  if (String(path).startsWith('/rollout/closures')) return { data: { closures: [] } };
  return { data: {} };
};
(Api as any).post = async () => ({ data: {} });
(Api as any).patch = async () => ({ data: {} });
(Api as any).delete = async () => ({ data: {} });

function App() {
  const [commandRow, setCommandRow] = useState<React.ReactNode>(null);
  return (
    <main className="min-h-screen bg-canvas p-6 text-c-text" data-testid="re3b-render-root">
      <div className="mb-4 rounded-xl border border-c-border bg-c-surface p-3">{commandRow}</div>
      <div className="h-[720px] rounded-xl border border-c-border bg-c-surface shadow-sm">
        <RolloutTab
          projectId="project-r-e3b"
          initiatives={[] as any[]}
          onRegisterCommandRowContent={setCommandRow}
          riskSignals={
            [
              {
                id: 'overdue-init-a',
                initiativeId: 'init-a',
                initiativeName: 'Northwind rollout',
                signalType: 'OVERDUE',
                severity: 'CRITICAL',
                title: 'Overdue by 22 days',
                description: 'Late initiative',
                suggestedAction: 'Escalate to sponsor',
                sourceData: {
                  workRiskBoundary: {
                    sourceType: 'initiative',
                    sourceId: 'overdue-init-a',
                    riskState: 'red',
                    decisionLevel: 3,
                    missingEvidence: [],
                    requiresHumanReview: false,
                  },
                },
              },
            ] as any[]
          }
        />
      </div>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
