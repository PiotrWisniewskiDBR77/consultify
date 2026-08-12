/**
 * ID_BRIDGE (Gate E) — dev-render host for the REAL `<FinanceLegacyBridgeGate>`
 * (src/components/Finance/shared/FinanceLegacyBridgeGate.tsx), the gate
 * `FinanceHub.tsx`'s four v3 mount branches (Baseline/Prediction/Analysis/
 * Valuation) now render through instead of passing a legacy list-row id
 * straight into the canonical workspace.
 *
 * CLAUDE.md rule #7: renders the real component with a mocked
 * `resolve-legacy` endpoint so the author can screenshot it BEFORE the owner
 * sees anything.
 *
 * URL params:
 *   &kind=baseline|prediction|analysis|valuation   which legacy table this
 *     simulates a list-row click from (default: baseline).
 *   &state=resolved|missing|quarantined|error   which of the bridge's four
 *     outcomes the mocked endpoint returns:
 *       resolved    — real canonical artifactId/businessVersionId returned,
 *                     children render (shown here as a simple confirmation
 *                     card — the REAL workspace mount is proven separately
 *                     by each kind's own dev-render screen, e.g.
 *                     ?screen=finance-prediction-workspace&bridge=ok).
 *       missing     — NOT_MIGRATED — honest "nie ma jeszcze odpowiednika" state.
 *       quarantined — QUARANTINED with a reason — honest state, reason shown.
 *       error       — resolve-legacy request itself fails (500) — honest
 *                     error state with "Spróbuj ponownie".
 */
import React from 'react';

import { AppProviders } from '../../src/providers/AppProviders';

const params = new URLSearchParams(window.location.search);
const KIND = (params.get('kind') as 'baseline' | 'prediction' | 'analysis' | 'valuation' | null) ?? 'baseline';
const STATE = (params.get('state') as 'resolved' | 'missing' | 'quarantined' | 'error' | null) ?? 'resolved';

const LEGACY_TABLE_BY_KIND: Record<string, string> = {
  baseline: 'financial_models',
  prediction: 'financial_models',
  analysis: 'financial_analyses',
  valuation: 'valuations',
};
const ARTIFACT_TYPE_BY_KIND: Record<string, string> = {
  baseline: 'BASELINE_MODEL',
  prediction: 'PREDICTION_SCENARIO',
  analysis: 'HISTORICAL_ANALYSIS',
  valuation: 'VALUATION_CASE',
};
const LEGACY_ID = `${LEGACY_TABLE_BY_KIND[KIND]}-legacy-row-77`;

const FinanceLegacyBridgeGateLazy = React.lazy(() =>
  import('../../src/components/Finance/shared/FinanceLegacyBridgeGate').then((m) => ({ default: m.FinanceLegacyBridgeGate }))
);

const g = window as unknown as { __ID_BRIDGE_FETCH__?: boolean };
if (!g.__ID_BRIDGE_FETCH__) {
  g.__ID_BRIDGE_FETCH__ = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const json = (data: unknown, status = 200): Response =>
      new Response(JSON.stringify({ data }), { status, headers: { 'Content-Type': 'application/json' } });
    // Error envelope shape is `{error, code}` at the TOP LEVEL (see
    // finance-prediction-workspace.tsx's identical comment) — only the
    // genuine-transport-failure `error` scene uses this; RESOLVED/
    // NOT_MIGRATED/QUARANTINED are all real 200 domain outcomes (see
    // `artifacts.routes.ts`'s resolve-legacy handler) and correctly use `json()`.
    const errorJson = (error: string, code: string, status: number): Response =>
      new Response(JSON.stringify({ error, code }), { status, headers: { 'Content-Type': 'application/json' } });

    if (url.includes('/locales/')) return realFetch(input as RequestInfo, init);

    if (url.includes('/artifacts/resolve-legacy/')) {
      if (STATE === 'error') return errorJson('Internal error', 'INTERNAL_ERROR', 500);
      if (STATE === 'missing') return json({ status: 'NOT_MIGRATED' });
      if (STATE === 'quarantined')
        return json({ status: 'QUARANTINED', mappingConfidence: 'QUARANTINE', reason: 'approved_without_snapshot' });
      return json({
        status: 'RESOLVED',
        artifactId: `canonical-artifact-${KIND}-1`,
        businessVersionId: `canonical-bv-${KIND}-1`,
        artifactType: ARTIFACT_TYPE_BY_KIND[KIND],
        mappingConfidence: 'AUTO_MIGRATE',
      });
    }

    if (url.includes('/api/')) return json([]);
    return realFetch(input as RequestInfo, init);
  };
}

function SimulatedListRow(): React.ReactElement {
  return (
    <div className="border-b border-c-border-subtle bg-c-surface px-4 py-3 text-xs text-c-text-secondary" data-testid="simulated-list-row">
      <span className="font-semibold text-c-text">FinanceHub</span> — lista (Menu 2/3, poza zakresem tego pakietu, patrz
      OWN-FIN-001) — wybrano wiersz <code className="rounded bg-c-surface-raised px-1">{LEGACY_ID}</code> (tabela legacy{' '}
      <code className="rounded bg-c-surface-raised px-1">{LEGACY_TABLE_BY_KIND[KIND]}</code>) → most identyfikatorów
      rozwiązuje realny artefakt kanoniczny poniżej.
    </div>
  );
}

export function FinanceIdBridgeScreen(): React.ReactElement {
  return (
    <AppProviders>
      <div style={{ height: '100vh', width: '100vw', overflow: 'hidden' }} className="flex flex-col bg-c-bg">
        <SimulatedListRow />
        <div className="flex-1 overflow-auto">
          <React.Suspense fallback={null}>
            <FinanceLegacyBridgeGateLazy legacyTable={LEGACY_TABLE_BY_KIND[KIND] as never} legacyId={LEGACY_ID} onBackToList={() => {}}>
              {(resolved) => (
                <div className="p-6" data-testid="id-bridge-resolved-card">
                  <div className="max-w-xl rounded-xl border border-c-border-subtle bg-c-surface p-6">
                    <div className="text-xs uppercase tracking-wider text-c-text-muted">Most rozwiązany — RESOLVED</div>
                    <div className="mt-2 text-sm text-c-text">
                      Ten legacy wiersz (<code>{LEGACY_ID}</code>) prowadzi teraz do REALNEGO kanonicznego artefaktu:
                    </div>
                    <dl className="mt-4 grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-sm">
                      <dt className="text-c-text-muted">artifactId</dt>
                      <dd className="font-mono text-c-text">{resolved.artifactId}</dd>
                      <dt className="text-c-text-muted">businessVersionId</dt>
                      <dd className="font-mono text-c-text">{resolved.businessVersionId ?? '—'}</dd>
                      <dt className="text-c-text-muted">artifactType</dt>
                      <dd className="text-c-text">{resolved.artifactType}</dd>
                    </dl>
                    <div className="mt-4 text-xs text-c-text-secondary">
                      Ten workspace mounted tutaj przyjmuje te REALNE id — zamiast legacy id, jak przed poprawką
                      ID_BRIDGE. Pełny realny ekran per typ: <code>?screen=finance-baseline-workspace</code> /{' '}
                      <code>?screen=finance-prediction-workspace&bridge=ok</code> / <code>?screen=finance-analysis-workspace</code> /{' '}
                      <code>?screen=finance-valuation-workspace</code>.
                    </div>
                  </div>
                </div>
              )}
            </FinanceLegacyBridgeGateLazy>
          </React.Suspense>
        </div>
      </div>
    </AppProviders>
  );
}

export default FinanceIdBridgeScreen;
