/**
 * P2B (DEC-457, 2026-09-10) — puste dane REALNEGO <ExecutionHub initialTab="list">.
 *
 * `dev-render/screens/execution-tab.tsx` (istniejący ekran) montuje ten sam
 * komponent z `isDemoMode: true` (seedRealisticSession) — nieudany fetch w
 * harnessie (brak backendu) ląduje na demo-fallback (executionDemoData +
 * baner "Sample data — source unavailable"), NIGDY na prawdziwie pusty
 * portfel. Ten plik wyłącza demo-fallback (localStorage
 * `consultify-storage.state.isDemoMode = false`) i mockuje oba wołania
 * portfela (`Api.getInitiatives` → `/api/initiatives`, `listExecutionCases`
 * → `/api/initiatives/runtime-v1/execution-cases`) na 200 z pustą listą —
 * bez tego brak backendu liczy się jako błąd sieci i ExecutionHub robi 3
 * próby ponowienia z rosnącym opóźnieniem (do ~14s) zanim pokaże cokolwiek.
 *
 * Query: &theme=light|dark
 */
import React from 'react';

import { ExecutionHub } from '../../src/components/Execution/ExecutionHub';
import { AppProviders } from '../../src/providers/AppProviders';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();

try {
  const raw = window.localStorage.getItem('consultify-storage');
  const parsed = raw ? JSON.parse(raw) : { state: {} };
  parsed.state = { ...parsed.state, isDemoMode: false, isDemoSession: false };
  window.localStorage.setItem('consultify-storage', JSON.stringify(parsed));
} catch {
  // ignore
}

const originalFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = String(input);
  if (url.includes('/api/initiatives/runtime-v1/execution-cases')) {
    return new Response(JSON.stringify({ cases: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (url.includes('/api/initiatives') && !url.includes('runtime-v1')) {
    return new Response(JSON.stringify({ initiatives: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return originalFetch(input, init);
};

export default function P2bRealizacjaEmptyScreen(): React.ReactElement {
  return (
    <AppProviders>
      <div style={{ height: '100vh' }} data-testid="p2b-realizacja-empty">
        <ExecutionHub initialTab="list" />
      </div>
    </AppProviders>
  );
}
