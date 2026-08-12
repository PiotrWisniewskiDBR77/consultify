/**
 * @vitest-environment jsdom
 *
 * ID_BRIDGE (Gate E) — `FinanceLegacyBridgeGate` / `useFinanceLegacyBridge`.
 *
 * This is the gate `FinanceHub.tsx`'s four v3 mount branches
 * (Baseline/Prediction/Analysis/Valuation) now render through instead of
 * passing the legacy list-row id straight into the canonical workspace.
 *
 * Proves the THREE distinguishable states from CLAUDE.md §2.3, plus loading:
 *   - loading    — spinner, children never called.
 *   - resolved   — children(resolved) called with the REAL canonical ids —
 *     this is the actual "list row -> correct artifact opens with real ids"
 *     proof for the ID bridge, at the level this codebase already tests
 *     wiring logic (pure/isolated component, not the 3000-line FinanceHub).
 *   - unresolved — NOT_MIGRATED and QUARANTINED (with reason) both render the
 *     honest "not available" shell, children NEVER called — this is the
 *     direct anti-silent-emptiness proof for the bridge layer itself (the
 *     legacy id that "can't be resolved", the specific scenario the task
 *     brief calls out for Prediction, is really an UNRESOLVED response from
 *     this exact gate).
 *   - error      — network/server failure, distinct message, Retry button
 *     that re-calls the resolver.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const apiMocks = vi.hoisted(() => ({
  resolveLegacyFinanceArtifact: vi.fn(),
}));
vi.mock('@/services/api/financeV2.api', () => apiMocks);

import { FinanceLegacyBridgeGate } from '../FinanceLegacyBridgeGate';

afterEach(() => {
  vi.clearAllMocks();
});

describe('FinanceLegacyBridgeGate — RESOLVED (list row -> real workspace with real ids)', () => {
  it('renders children with the REAL canonical artifactId/businessVersionId, never the legacy id', async () => {
    apiMocks.resolveLegacyFinanceArtifact.mockResolvedValue({
      status: 'RESOLVED',
      artifactId: 'canonical-artifact-77',
      businessVersionId: 'canonical-bv-77',
      artifactType: 'BASELINE_MODEL',
      mappingConfidence: 'AUTO_MIGRATE',
    });

    render(
      <FinanceLegacyBridgeGate legacyTable="financial_models" legacyId="legacy-model-1" onBackToList={() => {}}>
        {(resolved) => (
          <div data-testid="mounted-workspace">
            artifactId={resolved.artifactId} businessVersionId={resolved.businessVersionId}
          </div>
        )}
      </FinanceLegacyBridgeGate>
    );

    await waitFor(() => expect(screen.getByTestId('mounted-workspace')).toBeInTheDocument());
    expect(screen.getByTestId('mounted-workspace').textContent).toContain('canonical-artifact-77');
    expect(screen.getByTestId('mounted-workspace').textContent).toContain('canonical-bv-77');
    expect(screen.getByTestId('mounted-workspace').textContent).not.toContain('legacy-model-1');
    expect(apiMocks.resolveLegacyFinanceArtifact).toHaveBeenCalledWith('financial_models', 'legacy-model-1');
  });

  it('shows a loading state before resolution, never mounts children early', async () => {
    let resolvePromise!: (v: unknown) => void;
    apiMocks.resolveLegacyFinanceArtifact.mockReturnValue(
      new Promise((resolve) => {
        resolvePromise = resolve;
      })
    );
    const childRenderSpy = vi.fn().mockReturnValue(<div data-testid="mounted-workspace" />);

    render(
      <FinanceLegacyBridgeGate legacyTable="valuations" legacyId="legacy-val-1" onBackToList={() => {}}>
        {childRenderSpy}
      </FinanceLegacyBridgeGate>
    );

    expect(screen.getByTestId('finance-bridge-loading')).toBeInTheDocument();
    expect(childRenderSpy).not.toHaveBeenCalled();

    resolvePromise({ status: 'RESOLVED', artifactId: 'a-1', businessVersionId: 'bv-1', artifactType: 'VALUATION_CASE', mappingConfidence: 'AUTO_MIGRATE' });
    await waitFor(() => expect(screen.getByTestId('mounted-workspace')).toBeInTheDocument());
  });
});

describe('FinanceLegacyBridgeGate — UNRESOLVED (anti-silent-emptiness for the bridge itself)', () => {
  it('★ NOT_MIGRATED: a legacy id the bridge cannot resolve renders an honest message, children NEVER called', async () => {
    apiMocks.resolveLegacyFinanceArtifact.mockResolvedValue({ status: 'NOT_MIGRATED' });
    const childRenderSpy = vi.fn().mockReturnValue(<div data-testid="mounted-workspace" />);
    const onBackToList = vi.fn();

    render(
      <FinanceLegacyBridgeGate legacyTable="financial_analyses" legacyId="legacy-analysis-unresolvable" onBackToList={onBackToList}>
        {childRenderSpy}
      </FinanceLegacyBridgeGate>
    );

    await waitFor(() => expect(screen.getByTestId('finance-bridge-unresolved')).toBeInTheDocument());
    expect(childRenderSpy).not.toHaveBeenCalled();
    expect(screen.queryByTestId('mounted-workspace')).not.toBeInTheDocument();
    expect(screen.getByTestId('finance-bridge-unresolved').textContent).toMatch(
      /nie ma jeszcze odpowiednika|nie został jeszcze przeniesiony/
    );

    await userEvent.click(screen.getByRole('button', { name: /Wróć do listy/i }));
    expect(onBackToList).toHaveBeenCalledTimes(1);
  });

  it('QUARANTINED: a deliberately-excluded legacy row surfaces the recorded reason, distinct message from NOT_MIGRATED, children never called', async () => {
    apiMocks.resolveLegacyFinanceArtifact.mockResolvedValue({
      status: 'QUARANTINED',
      mappingConfidence: 'QUARANTINE',
      reason: 'approved_without_snapshot',
    });
    const childRenderSpy = vi.fn().mockReturnValue(<div data-testid="mounted-workspace" />);

    render(
      <FinanceLegacyBridgeGate legacyTable="valuations" legacyId="legacy-val-quarantined" onBackToList={() => {}}>
        {childRenderSpy}
      </FinanceLegacyBridgeGate>
    );

    await waitFor(() => expect(screen.getByTestId('finance-bridge-unresolved')).toBeInTheDocument());
    expect(childRenderSpy).not.toHaveBeenCalled();
    // ★ NAPRAWA (Gate E FIXA — surowy `mapping_reason` na ekranie): ten test
    // dawniej ASERTOWAŁ raw string `approved_without_snapshot` jako
    // OCZEKIWANE zachowanie, betonując dokładnie tę klasę defektu (kod
    // techniczny z backendu wprost w polskim UI), przeciw której cały pakiet
    // mostu (Zadanie 3, "brak surowych stringów") jest napisany. Teraz
    // asertuje odwrotnie: ludzka polska etykieta MUSI się pojawić, surowy kod
    // NIGDY nie może pojawić się w widocznym tekście.
    const text = screen.getByTestId('finance-bridge-unresolved').textContent ?? '';
    expect(text).not.toContain('approved_without_snapshot');
    expect(text).toMatch(/zatwierdzony.*bez zapisanej migawki danych/);
  });

  it('★ NAPRAWA: nieznana/wolna-tekstowa wartość mapping_reason (np. zdanie z `;`/`=`) dostaje bezpieczny ogólny fallback, NIGDY nie jest echowana wprost', async () => {
    apiMocks.resolveLegacyFinanceArtifact.mockResolvedValue({
      status: 'QUARANTINED',
      mappingConfidence: 'EXCLUDE_WITH_REASON',
      reason: 'pack_status=draft;pack_readiness_status=pending',
    });
    const childRenderSpy = vi.fn().mockReturnValue(<div data-testid="mounted-workspace" />);

    render(
      <FinanceLegacyBridgeGate legacyTable="financial_statement_packs" legacyId="legacy-pack-1" onBackToList={() => {}}>
        {childRenderSpy}
      </FinanceLegacyBridgeGate>
    );

    await waitFor(() => expect(screen.getByTestId('finance-bridge-unresolved')).toBeInTheDocument());
    const text = screen.getByTestId('finance-bridge-unresolved').textContent ?? '';
    expect(text).not.toContain('pack_status=draft');
    expect(text).not.toContain(';');
    expect(text).not.toContain('=');
    expect(text).toMatch(/techniczny zapis zespołu ds. migracji danych/);
  });
});

describe('FinanceLegacyBridgeGate — ERROR (network/server failure, distinct from UNRESOLVED)', () => {
  it('a rejected resolve call shows a distinct error state (not the NOT_MIGRATED copy) with a working Retry', async () => {
    apiMocks.resolveLegacyFinanceArtifact
      .mockRejectedValueOnce(Object.assign(new Error('network down'), { status: 500, data: { code: 'INTERNAL_ERROR' } }))
      .mockResolvedValueOnce({ status: 'RESOLVED', artifactId: 'a-2', businessVersionId: 'bv-2', artifactType: 'HISTORICAL_ANALYSIS', mappingConfidence: 'AUTO_MIGRATE' });

    render(
      <FinanceLegacyBridgeGate legacyTable="financial_analyses" legacyId="legacy-analysis-2" onBackToList={() => {}}>
        {(resolved) => <div data-testid="mounted-workspace">{resolved.artifactId}</div>}
      </FinanceLegacyBridgeGate>
    );

    await waitFor(() => expect(screen.getByTestId('finance-bridge-error')).toBeInTheDocument());
    expect(screen.queryByTestId('finance-bridge-unresolved')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mounted-workspace')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Spróbuj ponownie/i }));
    await waitFor(() => expect(screen.getByTestId('mounted-workspace')).toBeInTheDocument());
    expect(apiMocks.resolveLegacyFinanceArtifact).toHaveBeenCalledTimes(2);
  });
});
