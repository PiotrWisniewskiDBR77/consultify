/**
 * ArtifactBadge Component Tests
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { ArtifactBadge } from '../../../src/components/AIChat/ArtifactBadge';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

describe('ArtifactBadge (L2)', () => {
  it('renders artifact title and falls back when title is missing', () => {
    render(
      <ArtifactBadge
        artifact={{ id: 'a1', type: 'table' } as any}
        onOpenInPanel={() => {}}
        onDownload={() => {}}
      />
    );

    expect(screen.getByText('Artifact')).toBeInTheDocument();
  });

  it('calls open/download callbacks and stops event propagation', () => {
    const onOpenInPanel = vi.fn();
    const onDownload = vi.fn();
    const onParentClick = vi.fn();

    render(
      <div onClick={onParentClick}>
        <ArtifactBadge
          artifact={{ id: 'a1', type: 'code', title: 'Snippet' } as any}
          onOpenInPanel={onOpenInPanel}
          onDownload={onDownload}
        />
      </div>
    );

    fireEvent.click(screen.getByTitle('Open in panel'));
    expect(onOpenInPanel).toHaveBeenCalledWith(expect.objectContaining({ id: 'a1' }));
    expect(onParentClick).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTitle('Download'));
    expect(onDownload).toHaveBeenCalledWith(expect.objectContaining({ id: 'a1' }));
    expect(onParentClick).not.toHaveBeenCalled();
  });
});

