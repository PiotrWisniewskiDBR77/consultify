/**
 * @vitest-environment jsdom
 *
 * M05 / L-06 — Applying a template overwrites the WHOLE canvas graph
 * (Api.syncMyIdeaMap replaces nodes/edges). When the canvas already has
 * content (existingNodeCount > 0), the gallery MUST show a confirm dialog
 * ("Zastąpić istniejące elementy?" / "Replace existing elements?") before
 * destroying the user's work. With an empty canvas it applies immediately.
 *
 * This test pins that confirm-gate contract:
 *  (a) existingNodeCount=0 → apply runs immediately, NO confirm dialog, onApplied fired.
 *  (b) existingNodeCount>0 → selecting a template SHOWS the confirm dialog.
 *  (c) existingNodeCount>0 + user CONFIRMS (Replace) → apply runs, onApplied fired.
 *  (d) existingNodeCount>0 + user CANCELS  → apply does NOT run, onApplied NOT fired.
 *
 * The "apply callback" under assertion is the gallery's `onApplied` prop, which
 * fires only after the real overwrite (Api.syncMyIdeaMap) resolves.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import enTranslation from '../../../public/locales/en/translation.json';

// EN locale → component renders English labels ("Use template", "Replace", "Cancel").
// IdeaTemplateGallery.tsx now calls most of these t() keys with NO inline
// fallback (moved entirely to public/locales/en/translation.json), so a mock
// that only resolves the fallback argument returns raw keys. Resolve real
// English copy instead, falling back to any inline fallback arg first.
function resolveTranslation(key: string): string {
  const value = key
    .split('.')
    .reduce<unknown>(
      (acc, segment) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[segment] : undefined),
      enTranslation
    );
  return typeof value === 'string' ? value : key;
}

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => undefined },
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (_key: string, fallback?: any) =>
      typeof fallback === 'string'
        ? fallback
        : (fallback?.defaultValue ?? resolveTranslation(_key)),
  }),
}));

// react-hot-toast is fired on success/error; stub it so it doesn't touch the DOM.
vi.mock('react-hot-toast', () => {
  const toast: any = (..._args: unknown[]) => undefined;
  toast.success = vi.fn();
  toast.error = vi.fn();
  return { __esModule: true, default: toast };
});

// The real overwrite. We resolve it so onApplied can fire; we also assert on it.
const syncMyIdeaMap = vi.fn().mockResolvedValue({ version: 2 });
const expandMyIdeaMap = vi.fn().mockResolvedValue({});
vi.mock('@/services/api', () => ({
  Api: {
    syncMyIdeaMap: (...args: unknown[]) => syncMyIdeaMap(...args),
    expandMyIdeaMap: (...args: unknown[]) => expandMyIdeaMap(...args),
  },
}));

const baseProps = {
  open: true,
  onClose: vi.fn(),
  ideaId: 'idea-1',
  activeTool: 'process_flow' as const,
  onApplied: vi.fn(),
};

async function loadGallery() {
  const mod = await import('@/components/MyWork/IdeaTemplateGallery');
  return mod.IdeaTemplateGallery;
}

// Click the primary "Use template" action of the first rendered template tile.
function clickFirstUseTemplate() {
  const buttons = screen.getAllByText('Use template');
  fireEvent.click(buttons[0]);
}

beforeEach(() => {
  vi.resetModules();
  syncMyIdeaMap.mockClear();
  expandMyIdeaMap.mockClear();
  baseProps.onApplied.mockClear();
  baseProps.onClose.mockClear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('M05 L-06 — confirm gate before a template overwrites an existing graph', () => {
  it('(a) empty canvas (existingNodeCount=0): applies immediately, NO confirm, onApplied fired', async () => {
    const Gallery = await loadGallery();
    render(<Gallery {...baseProps} existingNodeCount={0} />);

    clickFirstUseTemplate();

    // No confirm dialog rendered.
    expect(screen.queryByText(/Replace existing elements\?/i)).not.toBeInTheDocument();

    // The real overwrite ran and the apply callback fired.
    await waitFor(() => expect(syncMyIdeaMap).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(baseProps.onApplied).toHaveBeenCalledTimes(1));
  });

  it('(b) populated canvas (existingNodeCount>0): selecting a template SHOWS the confirm dialog', async () => {
    const Gallery = await loadGallery();
    render(<Gallery {...baseProps} existingNodeCount={5} />);

    clickFirstUseTemplate();

    // Confirm dialog appears; overwrite is gated behind it (not yet called).
    expect(await screen.findByText(/Replace existing elements\?/i)).toBeInTheDocument();
    expect(syncMyIdeaMap).not.toHaveBeenCalled();
    expect(baseProps.onApplied).not.toHaveBeenCalled();
  });

  it('(c) populated canvas + user CONFIRMS (Replace): apply runs, onApplied fired', async () => {
    const Gallery = await loadGallery();
    render(<Gallery {...baseProps} existingNodeCount={5} />);

    clickFirstUseTemplate();
    await screen.findByText(/Replace existing elements\?/i);

    // Click the confirm button ("Replace") in the dialog footer.
    fireEvent.click(screen.getByRole('button', { name: 'Replace' }));

    await waitFor(() => expect(syncMyIdeaMap).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(baseProps.onApplied).toHaveBeenCalledTimes(1));
  });

  it('(d) populated canvas + user CANCELS: apply does NOT run, onApplied NOT fired (graph preserved)', async () => {
    const Gallery = await loadGallery();
    render(<Gallery {...baseProps} existingNodeCount={5} />);

    clickFirstUseTemplate();
    await screen.findByText(/Replace existing elements\?/i);

    // Decline via the cancel button ("Cancel").
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    // Dialog dismissed and the overwrite never happened.
    await waitFor(() =>
      expect(screen.queryByText(/Replace existing elements\?/i)).not.toBeInTheDocument()
    );
    expect(syncMyIdeaMap).not.toHaveBeenCalled();
    expect(baseProps.onApplied).not.toHaveBeenCalled();
  });
});
