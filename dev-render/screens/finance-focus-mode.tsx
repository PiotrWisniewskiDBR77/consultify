/**
 * PKG_C (Finance v3 UI Platform) — dev-render host for Focus Mode
 * (`useFinanceFocusMode` + `focusMode.contract.ts`, OWN-FIN-004).
 *
 * Renderuje REALNY hook + REALNY `<FinanceWorkspaceBar>` w prostej powłoce
 * symulującej resztę Finance chrome (topbar/breadcrumbs/status strip), żeby
 * zrzut mógł UDOWODNIĆ, że po wejściu w focus mode ta reszta znika, a Menu 1
 * + pasek + workspace zostają — i że niezapisana zmiana w polu tekstowym
 * PRZETRWA cały cykl wejście→Esc→wyjście.
 *
 * URL: ?screen=finance-focus-mode[&lang=pl|en][&theme=light|dark]
 *   &autofocus=1   od razu wejdź w focus mode przy starcie (do zrzutu stanu "w trybie")
 *   &draft=<string>  początkowa wartość niezapisanego draftu
 */
import React, { useEffect, useState } from 'react';

import { FinanceWorkspaceBar } from '../../src/components/Finance/shared/FinanceWorkspaceBar';
import { ENABLEMENT_ALWAYS, type WorkspaceBarConfig } from '../../src/components/Finance/shared/financeWorkspaceBar.contract';
import { useFinanceFocusMode } from '../../src/hooks/useFinanceFocusMode';

const params = new URLSearchParams(window.location.search);
const autofocus = params.get('autofocus') === '1';
const initialDraft = params.get('draft') || 'Niezapisana zmiana wpisana przez użytkownika PRZED wejściem w focus mode.';

interface DraftState {
  draftValue: string;
  unsavedChanges: boolean;
}

function buildConfig(name: string): WorkspaceBarConfig {
  return {
    moduleId: 'baselineModel',
    artifactType: 'BASELINE_MODEL',
    identity: {
      artifactRef: { artifactType: 'BASELINE_MODEL', businessVersionId: 'bv-focus-1', artifactId: 'art-focus-1' },
      back: { targetListRoute: '/finance', label: { key: 'back', pl: 'Wróć do listy' } },
      name: { value: name, editable: true, editableBlockedReason: null, maxChars: 120, layoutBudgetChars: 60 },
      version: { label: 'v1', businessVersionId: 'bv-focus-1', hasUncommittedWorkingRevision: true },
      status: 'DRAFT',
      freshness: 'CURRENT',
      contextFields: ['type', 'period'],
    },
    viewNavigation: {
      kind: 'tabs',
      views: [
        { id: 'assumptions', label: { key: 'assumptions', pl: 'Założenia' }, state: null },
        { id: 'outputs', label: { key: 'outputs', pl: 'Wyliczenia' }, state: null },
      ],
      activeViewId: 'outputs',
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

function GlobalChrome(): React.ReactElement {
  return (
    <>
      <div data-testid="global-topbar" className="flex h-10 items-center justify-between border-b border-c-border-subtle bg-c-surface-raised px-4 text-xs text-c-text-secondary">
        <span>Consultify — global topbar (POWINIEN zniknąć w focus mode)</span>
        <span>Piotr W. · DBR77</span>
      </div>
      <div data-testid="finance-breadcrumbs" className="flex h-8 items-center gap-1 border-b border-c-border-subtle px-4 text-xs text-c-text-muted">
        <span>Finance</span>
        <span>/</span>
        <span>Models</span>
        <span>/</span>
        <span className="text-c-text">DBR77 (POWINIEN zniknąć w focus mode)</span>
      </div>
    </>
  );
}

function Menu1(): React.ReactElement {
  return (
    <div data-testid="menu1" className="flex h-10 items-center gap-4 border-b border-c-border-subtle bg-c-surface px-4 text-xs text-c-text-secondary">
      <span className="font-semibold text-c-text">Consultify</span>
      <span>Finance</span>
      <span className="text-c-text-muted">(Menu 1 — MUSI zostać widoczne w focus mode)</span>
    </div>
  );
}

export default function FinanceFocusModeScreen(): React.ReactElement {
  const [workspaceState, setWorkspaceState] = useState<DraftState>({ draftValue: initialDraft, unsavedChanges: true });

  const focusMode = useFinanceFocusMode<DraftState>({ workspaceState, activeViewId: 'outputs' });

  useEffect(() => {
    if (!autofocus) return;
    // Wejście przy starcie ekranu — do zrzutu stanu "w trybie focus".
    focusMode.enter('fullscreen.toggle', 'programmatic');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const config = buildConfig('DBR77 — Model bazowy FY2026');

  return (
    <div className="min-h-screen bg-c-bg" data-testid="finance-focus-mode-screen" data-focus-active={focusMode.active}>
      {!focusMode.active && <GlobalChrome />}
      <Menu1 />
      <FinanceWorkspaceBar
        config={config}
        evaluationContext={{ status: 'DRAFT', role: 'preparer', freshness: 'CURRENT', gates: {} }}
        contextValues={{ type: 'Model bazowy', period: 'FY2026' }}
        onNavigateBack={() => {}}
        onSelectView={() => {}}
        onPrimaryAction={() => {}}
        onLifecycleTransition={() => {}}
        onMoreItem={() => {}}
        onEnterFocusMode={() => focusMode.enter('fullscreen.toggle', 'toggle-control')}
        onCommitRename={async () => ({ ok: true })}
      />

      {!focusMode.active && (
        <div data-testid="finance-status-strip" className="border-b border-c-border-subtle bg-c-surface-raised/60 px-4 py-1.5 text-xs text-c-text-muted">
          Pasek statusu Finance (POWINIEN zniknąć w focus mode)
        </div>
      )}

      <div data-testid="workspace-content" className="p-6">
        <p className="mb-2 text-sm font-semibold text-c-text">Wyliczenia — pole robocze (draft)</p>
        <textarea
          data-testid="draft-textarea"
          value={workspaceState.draftValue}
          onChange={(e) => setWorkspaceState({ draftValue: e.target.value, unsavedChanges: true })}
          rows={4}
          className="w-full max-w-xl rounded-lg border border-c-border-subtle bg-c-surface p-2 text-sm text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
        />
        <p className="mt-2 text-xs text-c-text-muted">
          Stan skupienia: <span className="font-mono" data-testid="focus-active-label">{String(focusMode.active)}</span> · Niezapisane zmiany:{' '}
          <span className="font-mono" data-testid="unsaved-label">{String(workspaceState.unsavedChanges)}</span>
        </p>
        {focusMode.lastPreservationCheck && (
          <p className="mt-1 text-xs text-c-text-muted" data-testid="preservation-check">
            assertFocusModePreservation: <span className="font-mono">{focusMode.lastPreservationCheck.ok ? 'ok' : 'VIOLATION'}</span>
          </p>
        )}
        <button
          type="button"
          data-testid="toggle-focus-button"
          onClick={() => focusMode.toggle('fullscreen.toggle')}
          className="mt-4 inline-flex min-h-[2.75rem] items-center rounded-xl border border-c-border-subtle bg-c-surface px-4 text-xs font-semibold text-c-text shadow-sm hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
        >
          {focusMode.active ? 'Wyjdź z trybu pełnego obszaru (lub Esc)' : 'Włącz tryb pełnego obszaru roboczego'}
        </button>
      </div>
    </div>
  );
}
