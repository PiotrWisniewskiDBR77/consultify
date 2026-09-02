/**
 * Day 218 visual proof for the real AdminAIControlCenterPanel.
 * `&state=full|empty|unavailable` selects the API outcome. The fetch stub is
 * intentionally narrow: every request except `/admin/ai/summary` falls through.
 */
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import { AdminAIControlCenterPanel } from '../../src/components/Admin/AdminAIControlCenterPanel';

const originalFetch = window.fetch.bind(window);

function responseFor(state: string): Response {
  if (state === 'unavailable') {
    return new Response(JSON.stringify({ message: 'AI policy check failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const empty = state === 'empty';
  return new Response(
    JSON.stringify({
      organizationId: 'day218-visual-org',
      summary: {
        governanceSummary: {
          currentLevel: empty ? 'ADVISORY' : 'PROACTIVE',
          internetEnabled: !empty,
          auditRequired: true,
        },
        contextPolicy: { piiRedaction: empty ? 'inherit' : 'on' },
        llmPolicy: empty ? null : { mode: 'governed', review_state: 'APPROVED' },
        statuses: { governance: 'ok', context: 'ok', llm: 'ok' },
      },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

export default function AdminAIControlCenterPanelScreen(): React.ReactElement {
  const state = new URLSearchParams(window.location.search).get('state') || 'full';
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.includes('/admin/ai/summary')) return responseFor(state);
    return originalFetch(input, init);
  };

  return (
    <MemoryRouter>
      <div className="min-h-screen bg-slate-50 p-8 dark:bg-slate-950">
        <AdminAIControlCenterPanel />
      </div>
    </MemoryRouter>
  );
}
