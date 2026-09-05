/**
 * @vitest-environment jsdom
 *
 * Plan napraw MVP 05.09.2026, pozycja (7) `finance-valuation-workspace`
 * (A32): właściciel — treść warsztatu wyceny jest merytorycznie ok, ale
 * przyciski nagłówka są słowami, nie okrągłymi ikonami jak w innych
 * warsztatach. Naprawa siedzi w rendererze `FinanceWorkspaceBar.tsx`
 * (`ICON_ONLY_ACTION_IDS`) jako lokalna, opt-in mapa po `action.id` — NIE w
 * kontrakcie współdzielonym (`financeWorkspaceBar.contract.ts`), który jest
 * celowo bit-identyczny z portem backendowym. Tylko `primary.refresh-step`
 * (jedyny id używany przez `ValuationWorkspace.tsx`) przełącza się na okrągły
 * przycisk ikonowy — KAŻDY inny warsztat (Baseline `primary.compute`,
 * StatementPackWorkspaceV2 `primary.refresh`, Prediction `primary-compute`)
 * musi renderować się bit-w-bit jak dotąd.
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ENABLEMENT_ALWAYS, type WorkspaceBarConfig, type WorkspaceBarEvaluationContext } from '../financeWorkspaceBar.contract';
import { FinanceWorkspaceBar } from '../FinanceWorkspaceBar';

function makeConfig(primaryId: string, primaryLabelPl: string): WorkspaceBarConfig {
  return {
    moduleId: 'valuation',
    artifactType: 'VALUATION_CASE',
    identity: {
      artifactRef: { artifactType: 'VALUATION_CASE', businessVersionId: 'bv-1', artifactId: 'art-1' },
      back: { targetListRoute: '/finance/valuation', label: { key: 'back', pl: 'Wróć do listy' } },
      name: {
        value: 'DBR77 — Wycena FY2026',
        editable: false,
        editableBlockedReason: 'INSUFFICIENT_ROLE',
        maxChars: 120,
        layoutBudgetChars: 60,
      },
      version: { label: 'v1', businessVersionId: 'bv-1', hasUncommittedWorkingRevision: false },
      status: 'DRAFT',
      freshness: 'NEVER_COMPUTED',
      contextFields: ['type', 'source'],
    },
    viewNavigation: {
      kind: 'tabs',
      views: [{ id: 'source', label: { key: 's', pl: 'Źródło' }, state: null }],
      activeViewId: 'source',
      placement: 'in-bar',
    },
    actions: {
      primary: {
        kind: 'primary',
        id: primaryId,
        label: { key: 'primary', pl: primaryLabelPl },
        enablement: ENABLEMENT_ALWAYS,
        mergesFreshness: false,
        keyboardCommandId: null,
      },
      secondary: null,
      lifecycle: null,
      more: null,
      fullscreen: {
        kind: 'fullscreen',
        id: 'fullscreen.toggle',
        label: { key: 'fullscreen', pl: 'Pełny ekran' },
        enablement: ENABLEMENT_ALWAYS,
        iconOnly: true,
        ariaLabel: { key: 'fullscreen.aria', pl: 'Tryb pełnego obszaru roboczego' },
      },
      extraDirectControls: [],
    },
  };
}

const evaluationContext: WorkspaceBarEvaluationContext = {
  status: 'DRAFT',
  role: 'preparer',
  freshness: 'NEVER_COMPUTED',
  gates: {},
};

function noopHandlers() {
  return {
    onNavigateBack: vi.fn(),
    onSelectView: vi.fn(),
    onPrimaryAction: vi.fn(),
    onLifecycleTransition: vi.fn(),
    onMoreItem: vi.fn(),
    onEnterFocusMode: vi.fn(),
    onCommitRename: vi.fn().mockResolvedValue({ ok: true }),
  };
}

describe('FinanceWorkspaceBar — primary action ikonowa TYLKO dla primary.refresh-step (Valuation)', () => {
  it('primary.refresh-step (Valuation): okrągły przycisk ikonowy, brak widocznego tekstu "Odśwież krok"', () => {
    const config = makeConfig('primary.refresh-step', 'Odśwież krok');
    render(
      <FinanceWorkspaceBar config={config} evaluationContext={evaluationContext} contextValues={{}} {...noopHandlers()} />
    );
    const btn = screen.getByTestId('finance-workspace-bar-primary');
    expect(btn).not.toHaveTextContent('Odśwież krok');
    expect(btn.className).toMatch(/rounded-full/);
    // Podpis zostaje dostępny dla czytnika ekranu i jako tooltip, nie znika.
    expect(btn).toHaveAttribute('aria-label', 'Odśwież krok');
    expect(btn).toHaveAttribute('title', 'Odśwież krok');
  });

  it('primary.compute (Baseline): NIE zmienia się — nadal słowny przycisk (regresja zakazana)', () => {
    const config = makeConfig('primary.compute', 'Przelicz');
    render(
      <FinanceWorkspaceBar config={config} evaluationContext={evaluationContext} contextValues={{}} {...noopHandlers()} />
    );
    const btn = screen.getByTestId('finance-workspace-bar-primary');
    expect(btn).toHaveTextContent('Przelicz');
    expect(btn.className).not.toMatch(/rounded-full/);
  });

  it('primary.refresh (StatementPackWorkspaceV2): NIE zmienia się — nadal słowny przycisk (regresja zakazana)', () => {
    const config = makeConfig('primary.refresh', 'Odśwież');
    render(
      <FinanceWorkspaceBar config={config} evaluationContext={evaluationContext} contextValues={{}} {...noopHandlers()} />
    );
    const btn = screen.getByTestId('finance-workspace-bar-primary');
    expect(btn).toHaveTextContent('Odśwież');
    expect(btn.className).not.toMatch(/rounded-full/);
  });

  it('primary-compute (Prediction): NIE zmienia się — nadal słowny przycisk (regresja zakazana)', () => {
    const config = makeConfig('primary-compute', 'Przelicz');
    render(
      <FinanceWorkspaceBar config={config} evaluationContext={evaluationContext} contextValues={{}} {...noopHandlers()} />
    );
    const btn = screen.getByTestId('finance-workspace-bar-primary');
    expect(btn).toHaveTextContent('Przelicz');
    expect(btn.className).not.toMatch(/rounded-full/);
  });
});
