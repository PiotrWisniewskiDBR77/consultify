/**
 * RISK-22 (E12 confidentiality gate, S8-CONFID) — tests for
 * useIdeaConfidentialityGate (src/components/MyWork/useIdeaConfidentialityGate.ts),
 * the confirm/save/revert logic behind the confidentiality pill in
 * IdeaWorkspaceTools.tsx. This is the SAME hook IdeaMapWorkspace.tsx wires
 * to `PUT /my-ideas/:id` in production (see that file's `ideaWorkspaceToolsSharedProps`) —
 * not a re-implementation, so these tests exercise the real confirm-dialog +
 * Api-call + revert-on-failure path.
 *
 * `t` is resolved from the REAL locale JSON (mirrors
 * tests/components/MyWork/IdeaWorkspaceTools.inspector.test.tsx) with simple
 * {{var}} interpolation, so the downgrade-confirmation copy asserted below is
 * the actual string a user sees, not a hand-typed stand-in.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import toast from 'react-hot-toast';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import enTranslation from '../../../public/locales/en/translation.json';

const { apiMock } = vi.hoisted(() => ({ apiMock: { updateMyIdea: vi.fn() } }));
vi.mock('../../../src/services/api', () => ({ Api: apiMock }));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

import { useIdeaConfidentialityGate } from '../../../src/components/MyWork/useIdeaConfidentialityGate';

function resolveTranslation(key: string): string | undefined {
  const value = key
    .split('.')
    .reduce<unknown>(
      (acc, segment) =>
        acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[segment] : undefined,
      enTranslation
    );
  return typeof value === 'string' ? value : undefined;
}

function t(key: string, defaultValueOrOptions?: unknown, maybeOptions?: unknown): string {
  const resolved = resolveTranslation(key);
  let str =
    resolved ?? (typeof defaultValueOrOptions === 'string' ? defaultValueOrOptions : key);
  const options =
    typeof defaultValueOrOptions === 'object' && defaultValueOrOptions !== null
      ? defaultValueOrOptions
      : maybeOptions;
  if (options && typeof options === 'object') {
    for (const [k, v] of Object.entries(options as Record<string, unknown>)) {
      str = str.replace(new RegExp(`{{${k}}}`, 'g'), String(v));
    }
  }
  return str;
}

function TestHarness() {
  const gate = useIdeaConfidentialityGate({ t, isPolish: false, title: 'My idea' });
  return (
    <div>
      <div data-testid="level">{gate.confidentiality}</div>
      <div data-testid="supported">{String(gate.confidentialitySupported)}</div>
      <div data-testid="saving">{String(gate.confidentialitySaving)}</div>
      <button
        onClick={() =>
          gate.hydrateFromIdea({ confidentiality: 'restricted', confidentialitySupported: true })
        }
      >
        hydrate-restricted
      </button>
      <button
        onClick={() =>
          gate.hydrateFromIdea({ confidentiality: 'standard', confidentialitySupported: true })
        }
      >
        hydrate-standard
      </button>
      <button onClick={() => gate.handleConfidentialityChange('idea-1', 'standard')}>
        set-standard
      </button>
      <button onClick={() => gate.handleConfidentialityChange('idea-1', 'confidential')}>
        set-confidential
      </button>
      <button onClick={() => gate.handleConfidentialityChange('idea-1', 'restricted')}>
        set-restricted
      </button>
      {gate.confidentialityDowngradeDialog}
    </div>
  );
}

describe('useIdeaConfidentialityGate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('defaults to standard/unsupported before any hydrate call', () => {
    render(<TestHarness />);
    expect(screen.getByTestId('level').textContent).toBe('standard');
    expect(screen.getByTestId('supported').textContent).toBe('false');
  });

  it('raising protection (standard -> restricted) applies immediately, no confirmation', async () => {
    apiMock.updateMyIdea.mockResolvedValue({ confidentiality: 'restricted' });
    render(<TestHarness />);
    await act(async () => {
      fireEvent.click(screen.getByText('hydrate-standard'));
    });
    await act(async () => {
      fireEvent.click(screen.getByText('set-restricted'));
    });
    // No confirm dialog should appear for an upgrade.
    expect(screen.queryByText('Lower confidentiality?')).not.toBeInTheDocument();
    expect(apiMock.updateMyIdea).toHaveBeenCalledWith('idea-1', { confidentiality: 'restricted' });
    expect(screen.getByTestId('level').textContent).toBe('restricted');
    expect(toast.success).toHaveBeenCalled();
  });

  it('lowering protection (restricted -> standard) shows the downgrade confirmation naming what is given up, and applies only after confirming', async () => {
    apiMock.updateMyIdea.mockResolvedValue({ confidentiality: 'standard' });
    render(<TestHarness />);
    await act(async () => {
      fireEvent.click(screen.getByText('hydrate-restricted'));
    });
    await act(async () => {
      fireEvent.click(screen.getByText('set-standard'));
    });

    // Confirmation dialog is open, names the idea + both levels + the AI/export warning.
    expect(screen.getByText('Lower confidentiality?')).toBeInTheDocument();
    expect(
      screen.getByText(/"My idea" will change from Restricted to Standard\./)
    ).toBeInTheDocument();
    expect(screen.getByText(/removes the block on AI prompts and file exports/)).toBeInTheDocument();

    // No API call yet, and no state change yet — confirmation is pending.
    expect(apiMock.updateMyIdea).not.toHaveBeenCalled();
    expect(screen.getByTestId('level').textContent).toBe('restricted');

    await act(async () => {
      fireEvent.click(screen.getByText('Lower protection'));
    });

    expect(apiMock.updateMyIdea).toHaveBeenCalledWith('idea-1', { confidentiality: 'standard' });
    expect(screen.getByTestId('level').textContent).toBe('standard');
  });

  it('cancelling the downgrade confirmation leaves confidentiality and the API untouched', async () => {
    render(<TestHarness />);
    await act(async () => {
      fireEvent.click(screen.getByText('hydrate-restricted'));
    });
    await act(async () => {
      fireEvent.click(screen.getByText('set-standard'));
    });
    expect(screen.getByText('Lower confidentiality?')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByText('Cancel'));
    });

    expect(apiMock.updateMyIdea).not.toHaveBeenCalled();
    expect(screen.getByTestId('level').textContent).toBe('restricted');
    // AnimatePresence exit-animates the dialog out — wait for it to actually leave the DOM.
    await waitFor(() =>
      expect(screen.queryByText('Lower confidentiality?')).not.toBeInTheDocument()
    );
  });

  it('no false success: a rejected PUT leaves confidentiality unchanged and surfaces an error toast', async () => {
    apiMock.updateMyIdea.mockRejectedValue(new Error('boom'));
    render(<TestHarness />);
    await act(async () => {
      fireEvent.click(screen.getByText('hydrate-standard'));
    });
    await act(async () => {
      fireEvent.click(screen.getByText('set-restricted'));
    });

    expect(apiMock.updateMyIdea).toHaveBeenCalledWith('idea-1', { confidentiality: 'restricted' });
    // State was NEVER moved to 'restricted' — no optimistic flash, no stuck-wrong state.
    expect(screen.getByTestId('level').textContent).toBe('standard');
    expect(screen.getByTestId('saving').textContent).toBe('false');
    expect(toast.error).toHaveBeenCalledWith('boom');
  });

  it('a rejected downgrade (confirmed, then PUT fails) also leaves confidentiality unchanged', async () => {
    apiMock.updateMyIdea.mockRejectedValue(new Error('server refused'));
    render(<TestHarness />);
    await act(async () => {
      fireEvent.click(screen.getByText('hydrate-restricted'));
    });
    await act(async () => {
      fireEvent.click(screen.getByText('set-standard'));
    });
    await act(async () => {
      fireEvent.click(screen.getByText('Lower protection'));
    });

    expect(apiMock.updateMyIdea).toHaveBeenCalledWith('idea-1', { confidentiality: 'standard' });
    expect(screen.getByTestId('level').textContent).toBe('restricted');
    expect(toast.error).toHaveBeenCalledWith('server refused');
  });

  it('is a no-op when the target level equals the current level', async () => {
    render(<TestHarness />);
    await act(async () => {
      fireEvent.click(screen.getByText('hydrate-standard'));
    });
    await act(async () => {
      fireEvent.click(screen.getByText('set-standard'));
    });
    expect(apiMock.updateMyIdea).not.toHaveBeenCalled();
    expect(screen.queryByText('Lower confidentiality?')).not.toBeInTheDocument();
  });
});
