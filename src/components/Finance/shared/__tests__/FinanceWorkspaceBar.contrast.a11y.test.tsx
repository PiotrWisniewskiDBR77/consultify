/**
 * @vitest-environment jsdom
 *
 * Pakiet I (Dostępność) — `ViewStateBadge` w `FinanceWorkspaceBar.tsx`.
 *
 * PRZED naprawą: `text-c-warning` na 10px mierzył 4.31:1 (axe-core na realnym
 * dev-render, próg WCAG AA 4.5:1) — token semantyczny jest kalibrowany pod
 * większe elementy (kropki/ikony), nie mikro-tekst odznaki zakładki. jsdom
 * nie liczy realnego kontrastu (brak layoutu/renderowania pikseli), więc ten
 * test PILNUJE KLAS (nie przelicza kontrastu) — dowód liczbowy jest w
 * `docs/validation/finance-v3/generated/gate-e/pkg-i-axe/*.json` (axe na
 * REALNYM dev-render, przed/po naprawie).
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { FinanceWorkspaceBar } from '../FinanceWorkspaceBar';
import {
  ENABLEMENT_ALWAYS,
  type WorkspaceBarConfig,
  type WorkspaceBarEvaluationContext,
} from '../financeWorkspaceBar.contract';

function makeConfigWithViewState(state: {
  kind: 'ready' | 'stale' | 'blocked';
  label: { key: string; pl: string };
}): WorkspaceBarConfig {
  return {
    moduleId: 'baselineModel',
    artifactType: 'BASELINE_MODEL',
    identity: {
      artifactRef: {
        artifactType: 'BASELINE_MODEL',
        businessVersionId: 'bv-1',
        artifactId: 'art-1',
      },
      back: { targetListRoute: '/finance', label: { key: 'back', pl: 'Wróć do listy' } },
      name: {
        value: 'Model bazowy',
        editable: true,
        editableBlockedReason: null,
        maxChars: 120,
        layoutBudgetChars: 60,
      },
      version: { label: 'v1', businessVersionId: 'bv-1', hasUncommittedWorkingRevision: false },
      status: 'DRAFT',
      freshness: 'CURRENT',
      contextFields: [],
    },
    viewNavigation: {
      kind: 'tabs',
      views: [{ id: 'outputs', label: { key: 'o', pl: 'Wyliczenia' }, state }],
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

describe('FinanceWorkspaceBar — ViewStateBadge, kontrast (a11y, Pakiet I)', () => {
  it('stan "stale" NIE używa surowego `text-c-warning` (za mały kontrast na 10px) — używa ciemniejszego `text-amber-900`', () => {
    render(
      <FinanceWorkspaceBar
        config={makeConfigWithViewState({
          kind: 'stale',
          label: { key: 'stale', pl: 'Nieaktualne' },
        })}
        evaluationContext={evaluationContext}
        contextValues={{}}
        {...noopHandlers()}
      />
    );
    const badge = screen.getByText('Nieaktualne');
    expect(badge.className).not.toMatch(/\btext-c-warning\b/);
    expect(badge.className).toMatch(/text-amber-900/);
  });

  it('stan "blocked" NIE używa surowego `text-c-danger` — używa `text-red-800`', () => {
    render(
      <FinanceWorkspaceBar
        config={makeConfigWithViewState({
          kind: 'blocked',
          label: { key: 'blocked', pl: 'Zablokowane' },
        })}
        evaluationContext={evaluationContext}
        contextValues={{}}
        {...noopHandlers()}
      />
    );
    const badge = screen.getByText('Zablokowane');
    expect(badge.className).not.toMatch(/\btext-c-danger\b/);
    expect(badge.className).toMatch(/text-red-800/);
  });

  it('stan "ready" NIE używa surowego `text-c-success` — używa `text-emerald-800`', () => {
    render(
      <FinanceWorkspaceBar
        config={makeConfigWithViewState({ kind: 'ready', label: { key: 'ready', pl: 'Gotowe' } })}
        evaluationContext={evaluationContext}
        contextValues={{}}
        {...noopHandlers()}
      />
    );
    const badge = screen.getByText('Gotowe');
    expect(badge.className).not.toMatch(/\btext-c-success\b/);
    expect(badge.className).toMatch(/text-emerald-800/);
  });

  it('KONTROLA NEGATYWNA: status nadal niesiony TEKSTEM (etykieta), nie tylko klasą koloru — zmiana `state.label.pl` zmienia widoczny tekst', () => {
    render(
      <FinanceWorkspaceBar
        config={makeConfigWithViewState({
          kind: 'stale',
          label: { key: 'stale', pl: 'Wymaga przeliczenia' },
        })}
        evaluationContext={evaluationContext}
        contextValues={{}}
        {...noopHandlers()}
      />
    );
    expect(screen.getByText('Wymaga przeliczenia')).toBeInTheDocument();
    expect(screen.queryByText('Nieaktualne')).not.toBeInTheDocument();
  });
});
