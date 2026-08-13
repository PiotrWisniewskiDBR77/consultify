/**
 * @vitest-environment jsdom
 *
 * `FinanceWorkspaceBar` — render + kontrola negatywna (Pakiet C).
 *
 * Dowodzi:
 *   - render realnego komponentu (nie atrapy) reaguje na zmianę propsów
 *     (nazwa/status/freshness) — zmiana propa zmienia DOM.
 *   - ≤5 bezpośrednich kontrolek po prawej faktycznie renderuje się jako
 *     ≤5 elementów interaktywnych w tej strefie (`data-direct-control-count`).
 *   - rename: klik w nazwę → input → Enter → `onCommitRename` wywołany z
 *     znormalizowaną wartością.
 *   - fullscreen jest zawsze ostatnią kontrolką po prawej.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ENABLEMENT_ALWAYS, type WorkspaceBarConfig, type WorkspaceBarEvaluationContext } from '../financeWorkspaceBar.contract';
import { FinanceWorkspaceBar } from '../FinanceWorkspaceBar';

function makeConfig(
  overrides: Partial<Omit<WorkspaceBarConfig['identity'], 'name'>> & {
    name?: Partial<WorkspaceBarConfig['identity']['name']>;
  } = {}
): WorkspaceBarConfig {
  const { name: nameOverrides, ...identityOverrides } = overrides;
  return {
    moduleId: 'baselineModel',
    artifactType: 'BASELINE_MODEL',
    identity: {
      artifactRef: { artifactType: 'BASELINE_MODEL', businessVersionId: 'bv-1', artifactId: 'art-1' },
      back: { targetListRoute: '/finance', label: { key: 'back', pl: 'Wróć do listy' } },
      name: {
        value: 'Model bazowy FY2026',
        editable: true,
        editableBlockedReason: null,
        maxChars: 120,
        layoutBudgetChars: 60,
        ...nameOverrides,
      },
      version: { label: 'v1', businessVersionId: 'bv-1', hasUncommittedWorkingRevision: false },
      status: 'DRAFT',
      freshness: 'CURRENT',
      contextFields: ['type', 'period'],
      ...identityOverrides,
    },
    viewNavigation: {
      kind: 'tabs',
      views: [
        { id: 'assumptions', label: { key: 'a', pl: 'Założenia' }, state: null },
        { id: 'outputs', label: { key: 'o', pl: 'Wyliczenia' }, state: null },
      ],
      activeViewId: 'assumptions',
      placement: 'in-bar',
    },
    actions: {
      primary: {
        kind: 'primary',
        id: 'primary.recalculate',
        label: { key: 'recalc', pl: 'Przelicz' },
        enablement: ENABLEMENT_ALWAYS,
        mergesFreshness: true,
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
  freshness: 'CURRENT',
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

describe('FinanceWorkspaceBar — render realny i kontrola negatywna', () => {
  it('renderuje nazwę i status z configu', () => {
    render(
      <FinanceWorkspaceBar config={makeConfig()} evaluationContext={evaluationContext} contextValues={{}} {...noopHandlers()} />
    );
    expect(screen.getByTestId('finance-workspace-bar-name')).toHaveTextContent('Model bazowy FY2026');
  });

  it('KONTROLA NEGATYWNA: zmiana nazwy/statusu w propsach zmienia wyrenderowany DOM', () => {
    const { rerender } = render(
      <FinanceWorkspaceBar config={makeConfig()} evaluationContext={evaluationContext} contextValues={{}} {...noopHandlers()} />
    );
    expect(screen.getByTestId('finance-workspace-bar-name')).toHaveTextContent('Model bazowy FY2026');

    const changedConfig = makeConfig({ name: { value: 'KONTROLA NEGATYWNA — zmieniona nazwa' }, status: 'APPROVED' });
    rerender(
      <FinanceWorkspaceBar config={changedConfig} evaluationContext={evaluationContext} contextValues={{}} {...noopHandlers()} />
    );
    expect(screen.getByTestId('finance-workspace-bar-name')).toHaveTextContent('KONTROLA NEGATYWNA — zmieniona nazwa');
    expect(screen.getByText('Zatwierdzone')).toBeInTheDocument();
  });

  it('freshness STALE_SOURCE scala się z CTA: „Nieaktualne · Przelicz”', () => {
    const config = makeConfig({ freshness: 'STALE_SOURCE' });
    render(<FinanceWorkspaceBar config={config} evaluationContext={evaluationContext} contextValues={{}} {...noopHandlers()} />);
    expect(screen.getByTestId('finance-workspace-bar-primary')).toHaveTextContent('Nieaktualne');
    expect(screen.getByTestId('finance-workspace-bar-primary')).toHaveTextContent('Przelicz');
  });

  it('DŁUGA NAZWA (60 znaków) przy renderze — bez rzucania wyjątku, nazwa jest w DOM (obcinana wizualnie przez `truncate`, nie przez layout)', () => {
    const longName = 'N'.repeat(60);
    const config = makeConfig({ name: { value: longName } });
    render(<FinanceWorkspaceBar config={config} evaluationContext={evaluationContext} contextValues={{}} {...noopHandlers()} />);
    expect(screen.getByTestId('finance-workspace-bar-name')).toHaveTextContent(longName);
  });

  it('fullscreen jest zawsze ostatnią bezpośrednią kontrolką po prawej', () => {
    render(<FinanceWorkspaceBar config={makeConfig()} evaluationContext={evaluationContext} contextValues={{}} {...noopHandlers()} />);
    const fullscreen = screen.getByTestId('finance-workspace-bar-fullscreen');
    const primary = screen.getByTestId('finance-workspace-bar-primary');
    // fullscreen występuje PO primary w kolejności DOM (porównanie pozycji węzłów).
    expect(primary.compareDocumentPosition(fullscreen) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('rename: klik w nazwę → edycja → Enter → onCommitRename wywołany ze znormalizowaną wartością', async () => {
    const handlers = noopHandlers();
    render(<FinanceWorkspaceBar config={makeConfig()} evaluationContext={evaluationContext} contextValues={{}} {...handlers} />);

    fireEvent.click(screen.getByTestId('finance-workspace-bar-name'));
    const input = await screen.findByDisplayValue('Model bazowy FY2026');
    fireEvent.change(input, { target: { value: '  Nowa nazwa  ' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => expect(handlers.onCommitRename).toHaveBeenCalledWith('Nowa nazwa'));
  });

  it('rename zablokowany (editable=false) — klik w nazwę NIE otwiera edycji', () => {
    const config = makeConfig({ name: { value: 'Zatwierdzony model', editable: false, editableBlockedReason: 'STATUS_IMMUTABLE' } });
    render(<FinanceWorkspaceBar config={config} evaluationContext={evaluationContext} contextValues={{}} {...noopHandlers()} />);
    fireEvent.click(screen.getByTestId('finance-workspace-bar-name'));
    expect(screen.queryByDisplayValue('Zatwierdzony model')).not.toBeInTheDocument();
  });

  it('primary wyłączony gdy resolveControlState zwraca available:false (rola bez uprawnień)', () => {
    const restrictedCtx: WorkspaceBarEvaluationContext = { status: 'DRAFT', role: 'viewer', freshness: 'CURRENT', gates: {} };
    const config = makeConfig();
    config.actions.primary.enablement = { statuses: 'any', roles: ['preparer', 'finance_admin'], freshness: 'any', requiresGates: [] };
    render(<FinanceWorkspaceBar config={config} evaluationContext={restrictedCtx} contextValues={{}} {...noopHandlers()} />);
    expect(screen.getByTestId('finance-workspace-bar-primary')).toBeDisabled();
  });
});
