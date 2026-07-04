/**
 * P2.2 — BlockToolbar "AI Generate" + "Upload" buttons (Images panel).
 *
 * These two buttons were hidden in wave 1 (P0.2) with a "return in P2.2"
 * comment. This suite proves they are back, enabled, and wired to the
 * callbacks the deck builder is expected to pass in (reusing the existing
 * R4 per-slide rewrite mechanism for AI Generate, and the existing Media
 * Library / upload flow for Upload) — not a disabled placeholder.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { BlockToolbar } from '../../../src/components/Presentations/DeckBuilder/BlockToolbar';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

describe('BlockToolbar — Images panel (P2.2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function openImagesPanel() {
    const user = userEvent.setup();
    await user.click(screen.getByTitle('images'));
    return user;
  }

  it('renders "AI Generate" and "Upload" as enabled buttons (not disabled placeholders)', async () => {
    render(
      <BlockToolbar
        onInsertBlock={vi.fn()}
        onOpenMediaLibrary={vi.fn()}
        onGenerateAiImage={vi.fn()}
        onUpload={vi.fn()}
      />
    );

    await openImagesPanel();

    const aiGenerateBtn = screen.getByText('AI Generate').closest('button');
    const uploadBtn = screen.getByText('Upload').closest('button');

    expect(aiGenerateBtn).not.toBeNull();
    expect(uploadBtn).not.toBeNull();
    expect(aiGenerateBtn).not.toBeDisabled();
    expect(uploadBtn).not.toBeDisabled();
  });

  it('clicking "AI Generate" invokes onGenerateAiImage (reuses regenerateSlide rewrite mechanism)', async () => {
    const onGenerateAiImage = vi.fn();
    render(
      <BlockToolbar
        onInsertBlock={vi.fn()}
        onOpenMediaLibrary={vi.fn()}
        onGenerateAiImage={onGenerateAiImage}
        onUpload={vi.fn()}
      />
    );

    const user = await openImagesPanel();
    await user.click(screen.getByText('AI Generate'));

    expect(onGenerateAiImage).toHaveBeenCalledTimes(1);
  });

  it('clicking "Upload" invokes onUpload (opens Media Library, which owns the real upload flow)', async () => {
    const onUpload = vi.fn();
    render(
      <BlockToolbar
        onInsertBlock={vi.fn()}
        onOpenMediaLibrary={vi.fn()}
        onGenerateAiImage={vi.fn()}
        onUpload={onUpload}
      />
    );

    const user = await openImagesPanel();
    await user.click(screen.getByText('Upload'));

    expect(onUpload).toHaveBeenCalledTimes(1);
  });

  it('shows a generating state and disables "AI Generate" while a rewrite is in flight', async () => {
    render(
      <BlockToolbar
        onInsertBlock={vi.fn()}
        onOpenMediaLibrary={vi.fn()}
        onGenerateAiImage={vi.fn()}
        isGeneratingAiImage
        onUpload={vi.fn()}
      />
    );

    await openImagesPanel();

    const generatingBtn = screen.getByText('Generating…').closest('button');
    expect(generatingBtn).toBeDisabled();
  });

  it('"Organization Library" still opens the media library (pre-existing behaviour unchanged)', async () => {
    const onOpenMediaLibrary = vi.fn();
    render(
      <BlockToolbar
        onInsertBlock={vi.fn()}
        onOpenMediaLibrary={onOpenMediaLibrary}
        onGenerateAiImage={vi.fn()}
        onUpload={vi.fn()}
      />
    );

    const user = await openImagesPanel();
    await user.click(screen.getByText('Organization Library'));

    expect(onOpenMediaLibrary).toHaveBeenCalledTimes(1);
  });
});
