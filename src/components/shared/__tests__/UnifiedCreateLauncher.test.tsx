/**
 * @vitest-environment jsdom
 *
 * UnifiedCreateLauncher — component-level test.
 *
 * Context (dyżur 05.09 "wywiad-czat-defekty"): the component and its rollout
 * flag (`unifiedCreateLauncherFlag.ts`, default ON) exist and are fully
 * built, but `grep -rn "isUnifiedCreateLauncherEnabled\|<UnifiedCreateLauncher"
 * src/` shows ZERO callers anywhere in the app — it is not mounted from any
 * route or hub. This is NOT an oversight: D-01 (Piotr, OBR-28, 2026-07-27)
 * explicitly REMOVED the universal "+ Nowy"/"+ New" 3-way chooser from both
 * My Work (src/components/MyWork/MyWorkHub.tsx, commit 255366d01b) and
 * Interview (src/components/Interview/InterviewHub.tsx, commit 47f51800e9)
 * in favour of one contextual per-tab CTA ("Kanon: maks. JEDEN primary CTA").
 * Both D-01 comments are still present, unmodified, on HEAD.
 *
 * Later grafika review sessions (evidence/grafika/{132-noc-wywiad-ocena,
 * 144-runda-pelna,195-przelot-A,203-polski,216-poprawione-dzis}, all dated
 * 2026-08-30..09-02 — AFTER D-01) kept re-approving this screen's *look* in
 * isolation, and docs/program/AUDYT_16_MODULOW_20260905/03_Wywiad.md lists
 * `unified-create-launcher` as an accepted Wywiad screen — but none of that
 * is a wiring decision, and none of it reverses D-01 in the code.
 *
 * Given that conflict, this test locks in the ONE thing that is not in
 * dispute: the component itself works correctly in isolation (chooser ->
 * correct generator). It intentionally does NOT assert reachability from any
 * real route, and no production hub is modified — reinstating the universal
 * launcher is a product-direction call for the owner, not a call this test
 * (or the fix that added it) makes unilaterally. See the sibling test
 * `UnifiedCreateLauncher.d01Wiring.test.ts` for the guard on the other side
 * of that conflict.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'pl', getFixedT: () => (key: string) => key },
  }),
}));

vi.mock('react-hot-toast', () => {
  const fn = vi.fn();
  return { default: Object.assign(fn, { success: vi.fn(), error: vi.fn() }) };
});

vi.mock('@/services/api', () => ({ Api: { post: vi.fn(async () => ({})) } }));

vi.mock('@/components/Interview/InsightCreatorModal', () => ({
  InsightCreatorModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="mock-insight-creator-modal" /> : null,
}));

vi.mock('@/components/Initiatives/Wizard/InitiativeCharterWizard', () => ({
  InitiativeCharterWizard: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="mock-initiative-charter-wizard" /> : null,
}));

vi.mock('@/components/MyWork/DecisionsPanel', () => ({
  NewDecisionModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="mock-new-decision-modal" /> : null,
}));

import { UnifiedCreateLauncher } from '../UnifiedCreateLauncher';

describe('UnifiedCreateLauncher (component-level, not wired into any hub — see file header)', () => {
  it('renders the Krok 0 three-way chooser with Polish labels when isOpen', () => {
    render(<UnifiedCreateLauncher isOpen onClose={vi.fn()} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByTestId('unified-create-launcher-insight')).toHaveTextContent('Wniosek');
    expect(screen.getByTestId('unified-create-launcher-initiative')).toHaveTextContent(
      'Inicjatywa'
    );
    expect(screen.getByTestId('unified-create-launcher-decision')).toHaveTextContent('Decyzja');
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(<UnifiedCreateLauncher isOpen={false} onClose={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('picking "Wniosek" delegates to InsightCreatorModal', () => {
    render(<UnifiedCreateLauncher isOpen onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('unified-create-launcher-insight'));
    expect(screen.getByTestId('mock-insight-creator-modal')).toBeInTheDocument();
  });

  it('picking "Inicjatywa" delegates to InitiativeCharterWizard', () => {
    render(<UnifiedCreateLauncher isOpen onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('unified-create-launcher-initiative'));
    expect(screen.getByTestId('mock-initiative-charter-wizard')).toBeInTheDocument();
  });

  it('picking "Decyzja" delegates to NewDecisionModal', () => {
    render(<UnifiedCreateLauncher isOpen onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('unified-create-launcher-decision'));
    expect(screen.getByTestId('mock-new-decision-modal')).toBeInTheDocument();
  });

  it('skips Krok 0 straight to the picked generator when defaultType is set (Faza 1 contract)', () => {
    render(<UnifiedCreateLauncher isOpen onClose={vi.fn()} defaultType="initiative" />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('mock-initiative-charter-wizard')).toBeInTheDocument();
  });
});
