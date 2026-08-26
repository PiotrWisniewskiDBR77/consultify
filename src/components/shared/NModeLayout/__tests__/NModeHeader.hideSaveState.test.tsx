/**
 * @vitest-environment jsdom
 *
 * FIX-4 (day-27 acceptance fix-up, licencja nadzorcy) — additive
 * `NModeHeaderConfig.hideSaveState` gates off the save-state indicator
 * (`saveInfo.label`, ~L441-451 in `NModeHeader.tsx`) for read-only
 * documents (e.g. the assessment report view), where "Zapisano" /
 * "Zapisywanie…" would be misleading since there is nothing to save.
 *
 * Regression coverage: default (prop omitted) renders the indicator exactly
 * as before; passing `hideSaveState` renders the header with it gone, no
 * other change to the shell.
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

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
const SAVED_LABEL_KEY = 'sharedComponents.nModeHeader.savedLabel';

function renderHeader(extra: Partial<React.ComponentProps<typeof NModeHeader>> = {}) {
  return render(
    <NModeHeader
      title="Testowy artefakt"
      onTitleChange={noop}
      artifactId="task-1"
      artifactType="task"
      onSave={noop}
      onClose={noop}
      presentationMode="n"
      onPresentationModeChange={noop}
      {...extra}
    />
  );
}

describe('NModeHeader — hideSaveState (FIX-4, additive)', () => {
  it('without the prop, renders the save-state indicator exactly as before', () => {
    renderHeader();
    expect(screen.getByText(SAVED_LABEL_KEY)).toBeInTheDocument();
  });

  it('explicit hideSaveState={false} still renders the indicator (back-compat default)', () => {
    renderHeader({ hideSaveState: false });
    expect(screen.getByText(SAVED_LABEL_KEY)).toBeInTheDocument();
  });

  it('with hideSaveState={true}, the save-state indicator does not render', () => {
    renderHeader({ hideSaveState: true });
    expect(screen.queryByText(SAVED_LABEL_KEY)).not.toBeInTheDocument();
  });

  it('hideSaveState={true} leaves the rest of the header intact (title, status pill)', () => {
    renderHeader({ hideSaveState: true, statusLabel: 'Zatwierdzona' });
    expect(screen.getByText('Testowy artefakt')).toBeInTheDocument();
    expect(screen.getByText('Zatwierdzona')).toBeInTheDocument();
  });
});
