import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { PreviewActionBar } from '@/components/shared/PreviewPane/PreviewActionBar';

describe('Interview PreviewActionBar owner behavior', () => {
  it('invokes direct actions, preserves disabled truth and routes secondary actions through overflow', async () => {
    const open = vi.fn();
    const forbidden = vi.fn();
    const delegate = vi.fn();
    render(
      <PreviewActionBar
        rows={[
          {
            buttons: [
              { label: 'Open', onClick: open, colorScheme: 'primary' },
              { label: 'Approve', onClick: forbidden, colorScheme: 'emerald', disabled: true },
            ],
          },
        ]}
        overflowLabel="More interview actions"
        overflowActions={[
          { label: 'Delegate', onClick: delegate, colorScheme: 'neutral' },
        ]}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(open).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    expect(forbidden).not.toHaveBeenCalled();

    const trigger = screen.getByRole('button', { name: 'More interview actions' });
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delegate' }));
    expect(delegate).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes overflow with Escape and restores trigger focus', async () => {
    render(
      <PreviewActionBar
        overflowLabel="More interview actions"
        overflowActions={[
          { label: 'Archive', onClick: vi.fn(), colorScheme: 'neutral' },
        ]}
      />
    );
    const trigger = screen.getByRole('button', { name: 'More interview actions' });
    fireEvent.click(trigger);
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
