/**
 * @vitest-environment jsdom
 *
 * IdeaTemplateGallery — L-06 (M05): confirm before template overwrite.
 *
 * A template apply replaces the whole graph (Api.syncMyIdeaMap overwrites
 * nodes/edges). The fix gates that destructive overwrite behind a confirm
 * dialog whenever the canvas already has elements:
 *   - empty canvas (existingNodeCount=0) → applies immediately, no dialog;
 *   - non-empty canvas → shows "Replace existing elements?" and does NOT
 *     write until the user confirms;
 *   - cancelling leaves the graph untouched (no sync call).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const syncMyIdeaMap = vi.fn();
const expandMyIdeaMap = vi.fn();

vi.mock('@/services/api', () => ({
  Api: {
    syncMyIdeaMap: (...a: unknown[]) => syncMyIdeaMap(...a),
    expandMyIdeaMap: (...a: unknown[]) => expandMyIdeaMap(...a),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, value?: string | { defaultValue?: string }) => {
      const copy: Record<string, string> = {
        'myWorkIdeas.templateGallery.useTemplate': 'Use template',
        'myWorkIdeas.templateGallery.replaceExistingElements': 'Replace existing elements?',
        'myWorkIdeas.templateGallery.replaceExistingElementsDesc':
          'This replaces existing elements.',
        'myWorkIdeas.templateGallery.replace': 'Replace',
        'myWorkIdeas.templateGallery.cancel': 'Cancel',
      };
      return copy[key] ?? (typeof value === 'string' ? value : value?.defaultValue) ?? key;
    },
    i18n: { language: 'en' },
  }),
}));

import { IdeaTemplateGallery } from '../IdeaTemplateGallery';

const baseProps = {
  open: true,
  onClose: vi.fn(),
  ideaId: 'idea-1',
  activeTool: 'mindmap' as const,
  onApplied: vi.fn(),
  baseVersion: 1,
};

const firstApplyButton = () => screen.getAllByText('Use template')[0];

describe('IdeaTemplateGallery — L-06 confirm before overwrite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    syncMyIdeaMap.mockResolvedValue({ version: 2 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('applies immediately when the canvas is empty (no confirm dialog)', async () => {
    render(<IdeaTemplateGallery {...baseProps} existingNodeCount={0} />);
    fireEvent.click(firstApplyButton());
    await waitFor(() => expect(syncMyIdeaMap).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('Replace existing elements?')).toBeNull();
  });

  it('shows a confirm dialog and does NOT overwrite until confirmed', async () => {
    render(<IdeaTemplateGallery {...baseProps} existingNodeCount={5} />);
    fireEvent.click(firstApplyButton());
    await waitFor(() => expect(screen.getByText('Replace existing elements?')).toBeTruthy());
    // Destructive write must not have happened yet.
    expect(syncMyIdeaMap).not.toHaveBeenCalled();
  });

  it('overwrites only after the user confirms', async () => {
    render(<IdeaTemplateGallery {...baseProps} existingNodeCount={5} />);
    fireEvent.click(firstApplyButton());
    await waitFor(() => expect(screen.getByText('Replace existing elements?')).toBeTruthy());
    fireEvent.click(screen.getByText('Replace'));
    await waitFor(() => expect(syncMyIdeaMap).toHaveBeenCalledTimes(1));
  });

  it('does not overwrite when the user cancels', async () => {
    render(<IdeaTemplateGallery {...baseProps} existingNodeCount={5} />);
    fireEvent.click(firstApplyButton());
    await waitFor(() => expect(screen.getByText('Replace existing elements?')).toBeTruthy());
    fireEvent.click(screen.getByText('Cancel'));
    await waitFor(() => expect(screen.queryByText('Replace existing elements?')).toBeNull());
    expect(syncMyIdeaMap).not.toHaveBeenCalled();
  });
});
