/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import ArtifactAttachPopover from '../../../../src/components/shared/NModeBlocks/ArtifactAttachPopover';

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

  it('shows status and does not attach for unparseable colon refs', () => {
    const onAttach = vi.fn();
    const onClose = vi.fn();
    render(
      <ArtifactAttachPopover open onAttach={onAttach} onClose={onClose} searchResults={[]} isPl={false} />
    );

    const input = screen.getByPlaceholderText('Search or paste ref (e.g. task:abc123)...');
    pasteInto(input as HTMLInputElement, 'unknown:xyz');

    expect(onAttach).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('Invalid artifact ref. Use type:id format.');
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

