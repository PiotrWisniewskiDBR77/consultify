/**
 * Day206 visual proof. This mounts the REAL ToolStepList used by
 * MessageRenderer. Data are harness props shaped exactly like `tool_step` SSE;
 * they do not claim to originate from a live model run.
 */
import React from 'react';

import { ToolStepList } from '../../src/components/AIChat/ToolStepList';

export default function ChatToolStepsDay206Screen(): React.ReactElement {
  return (
    <main className="min-h-screen bg-c-bg p-10 text-c-text">
      <section className="mx-auto max-w-2xl rounded-2xl border border-c-border bg-c-surface p-6 shadow-sm">
        <div className="mb-4 text-xs font-semibold uppercase tracking-wide text-c-muted">
          Teresa · analiza inicjatywy
        </div>
        <div className="rounded-2xl bg-c-surface-2 p-4">
          <p className="mb-4 text-sm">Liczenie ROI i porównanie z benchmarkiem branżowym…</p>
          <ToolStepList
            steps={[
              { toolName: 'get_initiative_status', status: 'completed', costUsd: 0 },
              { toolName: 'calculate_financial', status: 'completed', costUsd: 0 },
              { toolName: 'compare_benchmarks', status: 'running', costUsd: 0 },
            ]}
          />
        </div>
      </section>
    </main>
  );
}
