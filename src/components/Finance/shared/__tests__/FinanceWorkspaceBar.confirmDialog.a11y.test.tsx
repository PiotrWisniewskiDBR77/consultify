/**
 * @vitest-environment jsdom
 *
 * Pakiet I (Dostępność) — `ConfirmDestructiveDialog` w `FinanceWorkspaceBar.tsx`.
 *
 * PRZED naprawą: dialog miał `role="alertdialog"` + fokus początkowy +
 * Escape — ale ŻADNEJ pułapki fokusa Tab (Tab mógł uciec pod przyciemnione
 * tło) i ŻADNEGO przywrócenia fokusa na wyzwalacz po zamknięciu. PO
 * naprawie (`useDialogA11y` z fallbackiem na
 * `data-testid="finance-workspace-bar-lifecycle-trigger"`, bo pozycja menu,
 * która otwiera dialog, odmontowuje się przed callbackiem).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { ENABLEMENT_ALWAYS, type WorkspaceBarConfig, type WorkspaceBarEvaluationContext } from '../financeWorkspaceBar.contract';
import { FinanceWorkspaceBar } from '../FinanceWorkspaceBar';

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
    get() {
      return document.body;
    },
    configurable: true,
  });
});

function makeConfigWithDestructiveLifecycle(): WorkspaceBarConfig {
  return {
    moduleId: 'baselineModel',
    artifactType: 'BASELINE_MODEL',
    identity: {
      artifactRef: { artifactType: 'BASELINE_MODEL', businessVersionId: 'bv-1', artifactId: 'art-1' },
      back: { targetListRoute: '/finance', label: { key: 'back', pl: 'Wróć do listy' } },
      name: { value: 'Model bazowy FY2026', editable: true, editableBlockedReason: null, maxChars: 120, layoutBudgetChars: 60 },
      version: { label: 'v1', businessVersionId: 'bv-1', hasUncommittedWorkingRevision: false },
      status: 'APPROVED',
      freshness: 'CURRENT',
      contextFields: [],
    },
    viewNavigation: {
      kind: 'tabs',
      views: [{ id: 'assumptions', label: { key: 'a', pl: 'Założenia' }, state: null }],
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
      lifecycle: {
        kind: 'lifecycle',
        id: 'lifecycle.menu',
        label: { key: 'lifecycle', pl: 'Stan' },
        enablement: ENABLEMENT_ALWAYS,
        transitions: [
          {
            action: 'reopen',
            label: { key: 'reopen', pl: 'Otwórz ponownie' },
            enablement: ENABLEMENT_ALWAYS,
            destructive: true,
            requiresConfirmation: true,
            requiresReason: false,
          },
        ],
      },
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

const evaluationContext: WorkspaceBarEvaluationContext = { status: 'APPROVED', role: 'preparer', freshness: 'CURRENT', gates: {} };

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

async function openConfirmDialog(): Promise<HTMLElement> {
  const lifecycleTrigger = screen.getByTestId('finance-workspace-bar-lifecycle-trigger');
  fireEvent.click(lifecycleTrigger);
  const menuItem = await screen.findByRole('menuitem', { name: 'Otwórz ponownie' });
  fireEvent.click(menuItem);
  return screen.findByRole('alertdialog');
}

describe('FinanceWorkspaceBar — ConfirmDestructiveDialog (a11y, Pakiet I)', () => {
  it('otwiera się z rolą alertdialog i fokusem na przycisku Potwierdź', async () => {
    render(<FinanceWorkspaceBar config={makeConfigWithDestructiveLifecycle()} evaluationContext={evaluationContext} contextValues={{}} {...noopHandlers()} />);
    await openConfirmDialog();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Potwierdź' })).toHaveFocus());
  });

  it('Escape zamyka dialog i przywraca fokus na trigger lifecycle (wyzwalacz — pozycja menu, która faktycznie otworzyła dialog, już się odmontowała)', async () => {
    render(<FinanceWorkspaceBar config={makeConfigWithDestructiveLifecycle()} evaluationContext={evaluationContext} contextValues={{}} {...noopHandlers()} />);
    const lifecycleTrigger = screen.getByTestId('finance-workspace-bar-lifecycle-trigger');
    await openConfirmDialog();

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    await waitFor(() => expect(lifecycleTrigger).toHaveFocus());
  });

  it('Tab z ostatniego elementu (Potwierdź) wraca na pierwszy (Anuluj) — pułapka fokusa', async () => {
    render(<FinanceWorkspaceBar config={makeConfigWithDestructiveLifecycle()} evaluationContext={evaluationContext} contextValues={{}} {...noopHandlers()} />);
    await openConfirmDialog();
    const cancelButton = screen.getByRole('button', { name: 'Anuluj' });
    const confirmButton = screen.getByRole('button', { name: 'Potwierdź' });
    await waitFor(() => expect(confirmButton).toHaveFocus());

    fireEvent.keyDown(confirmButton, { key: 'Tab' });
    await waitFor(() => expect(cancelButton).toHaveFocus());
  });

  it('"Potwierdź" wywołuje onLifecycleTransition z transition oryginalnym', async () => {
    const handlers = noopHandlers();
    render(<FinanceWorkspaceBar config={makeConfigWithDestructiveLifecycle()} evaluationContext={evaluationContext} contextValues={{}} {...handlers} />);
    await openConfirmDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Potwierdź' }));
    expect(handlers.onLifecycleTransition).toHaveBeenCalledWith(expect.objectContaining({ action: 'reopen' }));
  });

  it('KONTROLA NEGATYWNA: transition BEZ requiresConfirmation NIE otwiera ConfirmDestructiveDialog — woła onLifecycleTransition wprost', async () => {
    const handlers = noopHandlers();
    const config = makeConfigWithDestructiveLifecycle();
    // Mutacja lokalna configu na potrzeby testu: usuwamy wymóg potwierdzenia.
    const nonConfirming: WorkspaceBarConfig = {
      ...config,
      actions: {
        ...config.actions,
        lifecycle: {
          ...config.actions.lifecycle!,
          transitions: config.actions.lifecycle!.transitions.map((t) => ({ ...t, requiresConfirmation: false })),
        },
      },
    };
    render(<FinanceWorkspaceBar config={nonConfirming} evaluationContext={evaluationContext} contextValues={{}} {...handlers} />);
    const lifecycleTrigger = screen.getByTestId('finance-workspace-bar-lifecycle-trigger');
    fireEvent.click(lifecycleTrigger);
    const menuItem = await screen.findByRole('menuitem', { name: 'Otwórz ponownie' });
    fireEvent.click(menuItem);

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(handlers.onLifecycleTransition).toHaveBeenCalledWith(expect.objectContaining({ action: 'reopen' }));
  });
});
