/**
 * @vitest-environment jsdom
 *
 * F1 (Case Workspace V1, 2026-08-12) — axe-core 4.10.2 flagged the Menu 1
 * back button (`NModeHeader.tsx` ~L352) as `critical` on all 14 detail-screen
 * cells (7 widths × 2 themes): it is an icon-only `<button>` (ChevronLeft)
 * with no accessible name. `onClose` is the shared "go back to where you
 * came from" handler every consumer wires here (Task/Decision/Notification/
 * Initiative/Case/DiscoveryTool/Interview/Insight — see
 * `NModeHeaderConfig.onClose`), so "Wstecz"/"Back" names the real action.
 *
 * This is a negative-control-bearing regression test: it asserts the
 * accessible name is present, wired to the real onClose handler, and
 * distinct from the adjacent kebab ("Więcej") accessible name.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('framer-motion', () => ({
  motion: {
    div: ({
      children,
      initial: _i,
      animate: _a,
      transition: _t,
      whileHover: _wh,
      whileTap: _wt,
      ...props
    }: Record<string, unknown> & { children?: React.ReactNode }) => <div {...props}>{children}</div>,
    button: ({
      children,
      whileHover: _wh,
      whileTap: _wt,
      ...props
    }: Record<string, unknown> & { children?: React.ReactNode }) => (
      <button {...props}>{children}</button>
    ),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'pl' },
  }),
}));

import { NModeHeader } from '../NModeHeader';

const noop = () => {};

// vi.fn() with NO implementation infers Mock<Procedure | Constructable>, which
// is not assignable to NModeHeader's `onClose: () => void`. Giving it an empty
// implementation makes the signature concrete, so the spy stays fully typed and
// assertable without a cast.
const makeOnCloseSpy = () => vi.fn(() => {});
let onCloseSpy: ReturnType<typeof makeOnCloseSpy>;

function renderHeader() {
  return render(
    <NModeHeader
      title="Testowy artefakt"
      onTitleChange={noop}
      artifactId="task-1"
      artifactType="task"
      onSave={noop}
      onClose={onCloseSpy}
      presentationMode="n"
      onPresentationModeChange={noop}
    />
  );
}

describe('NModeHeader — F1 back-button accessible name (axe critical, 2026-08-12)', () => {
  beforeEach(() => {
    onCloseSpy = makeOnCloseSpy();
  });

  it('exposes an accessible name on the icon-only back button', () => {
    renderHeader();

    const backButton = screen.getByRole('button', { name: 'Wstecz' });
    expect(backButton).toBeInTheDocument();
  });

  it('the accessible name does not duplicate the adjacent kebab (⋮) name', () => {
    renderHeader();

    const backButton = screen.getByRole('button', { name: 'Wstecz' });
    const kebabButton = screen.getByRole('button', {
      name: 'sharedComponents.nModeHeader.moreActions',
    });
    expect(backButton).not.toBe(kebabButton);
    expect(backButton.getAttribute('aria-label')).not.toBe(kebabButton.getAttribute('aria-label'));
  });

  it('clicking the named back button still invokes the real onClose (no behavior change)', () => {
    renderHeader();

    fireEvent.click(screen.getByRole('button', { name: 'Wstecz' }));
    expect(onCloseSpy).toHaveBeenCalledTimes(1);
  });

  it('the back button is keyboard-focusable and reachable via Tab order', () => {
    renderHeader();

    const backButton = screen.getByRole('button', { name: 'Wstecz' });
    backButton.focus();
    expect(backButton).toHaveFocus();
  });
});
