/**
 * @vitest-environment jsdom
 *
 * TOOL_SESSION_WORKSPACE_STANDARD.md §6.3: the user must always be able to
 * tell whether their work is confirmed by the server. Every state renders
 * VISIBLY (never a silent/blank indicator) and only `SAVE_FAILED` is allowed
 * to use the crimson-adjacent danger token — everything else (including
 * "niezapisane zmiany" and "offline — w kolejce", which are normal working
 * states, not failures) stays neutral/warning/info per CLAUDE.md kanon.
 */
import { cleanup, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import { SaveStateIndicator } from '../SaveStateIndicator';
import type { MethodSaveState } from '@/method-core/contracts';

const ALL_STATES: MethodSaveState[] = ['CLEAN', 'SAVED', 'DIRTY', 'SAVING', 'SAVE_FAILED', 'OFFLINE_PENDING'];

describe('SaveStateIndicator — save state is always visible', () => {
  it.each(ALL_STATES)('renders a non-empty, visible indicator for %s', (state) => {
    render(<SaveStateIndicator state={state} lastSavedAt={null} />);
    const el = screen.getByTestId('save-state-indicator');
    expect(el).toBeInTheDocument();
    expect(el).toHaveAttribute('data-state', state);
    expect(el.textContent?.trim().length).toBeGreaterThan(0);
  });

  it('only SAVE_FAILED uses the danger (crimson-adjacent) tone — every other state is neutral/success/info/warning', () => {
    for (const state of ALL_STATES) {
      render(<SaveStateIndicator state={state} lastSavedAt={null} />);
      const el = screen.getByTestId('save-state-indicator');
      if (state === 'SAVE_FAILED') {
        expect(el.className).toMatch(/text-c-danger/);
      } else {
        expect(el.className).not.toMatch(/text-c-danger/);
      }
      cleanup();
    }
  });

  it('DIRTY (unsaved changes) is a normal working state, not an error — warning tone, not danger', () => {
    render(<SaveStateIndicator state="DIRTY" lastSavedAt={null} />);
    const el = screen.getByTestId('save-state-indicator');
    expect(el.className).toMatch(/text-c-warning/);
    expect(el.className).not.toMatch(/text-c-danger/);
    expect(el.textContent).toMatch(/Niezapisane zmiany/);
  });

  it('OFFLINE_PENDING stays visible with an honest label, never silently hidden', () => {
    render(<SaveStateIndicator state="OFFLINE_PENDING" lastSavedAt={null} />);
    expect(screen.getByTestId('save-state-indicator').textContent).toMatch(/Offline/);
  });

  it('SAVE_FAILED surfaces both the failure and an explicit retry action — never a silent stuck state', () => {
    render(
      <SaveStateIndicator
        state="SAVE_FAILED"
        lastSavedAt={null}
        errorMessage="network down"
        onRetry={() => {}}
        onStay={() => {}}
      />
    );
    expect(screen.getByText(/Zapis nieudany/)).toBeInTheDocument();
    expect(screen.getByText(/network down/)).toBeInTheDocument();
    expect(screen.getByText('Spróbuj ponownie')).toBeInTheDocument();
  });
});
