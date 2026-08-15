/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import ArtifactAttachPopover from '../../../../src/components/shared/NModeBlocks/ArtifactAttachPopover';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: {
      getFixedT: () => (key: string, fallback?: string) =>
        key === 'sharedComponents.artifactAttachPopover.searchPlaceholder'
          ? 'Search or paste ref (e.g. task:abc123)...'
          : fallback || key,
    },
  }),
}));

function pasteInto(input: HTMLInputElement, value: string) {
  fireEvent.paste(input, {
    clipboardData: {
      getData: () => value,
    },
  });
}

describe('ArtifactAttachPopover paste contract', () => {
  it('attaches and closes on valid artifact paste', () => {
    const onAttach = vi.fn();
    const onClose = vi.fn();
    render(
      <ArtifactAttachPopover open onAttach={onAttach} onClose={onClose} searchResults={[]} isPl={false} />
    );

    const input = screen.getByPlaceholderText('Search or paste ref (e.g. task:abc123)...');
    pasteInto(input as HTMLInputElement, '  initiative:abc  ');

    expect(onAttach).toHaveBeenCalledTimes(1);
    expect(onAttach).toHaveBeenCalledWith(
      { type: 'initiative', id: 'abc', title: 'initiative:abc' },
      'related'
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('attaches any colon ref using the parsed type (no type whitelist)', () => {
    const onAttach = vi.fn();
    const onClose = vi.fn();
    render(
      <ArtifactAttachPopover open onAttach={onAttach} onClose={onClose} searchResults={[]} isPl={false} />
    );

    const input = screen.getByPlaceholderText('Search or paste ref (e.g. task:abc123)...');
    pasteInto(input as HTMLInputElement, 'unknown:xyz');

    // parseArtifactRef no longer validates the type against a whitelist, so any
    // `type:id` shape parses and attaches with the parsed type.
    expect(onAttach).toHaveBeenCalledTimes(1);
    expect(onAttach).toHaveBeenCalledWith(
      { type: 'unknown', id: 'xyz', title: 'unknown:xyz' },
      'related'
    );
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('does not set parse-failure status for plain text without colon', () => {
    const onAttach = vi.fn();
    const onClose = vi.fn();
    render(
      <ArtifactAttachPopover open onAttach={onAttach} onClose={onClose} searchResults={[]} isPl={false} />
    );

    const input = screen.getByPlaceholderText('Search or paste ref (e.g. task:abc123)...');
    pasteInto(input as HTMLInputElement, 'just-plain-text');

    expect(onAttach).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByRole('status')).toBeNull();
  });
});
