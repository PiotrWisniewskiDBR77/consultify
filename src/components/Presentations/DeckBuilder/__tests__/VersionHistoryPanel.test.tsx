import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { VersionHistoryPanel } from '../VersionHistoryPanel';

describe('VersionHistoryPanel history availability', () => {
  it('does not present a failed history request as an empty history', () => {
    const onRetryHistory = vi.fn();
    render(
      <VersionHistoryPanel
        isOpen
        onClose={vi.fn()}
        versions={[]}
        historyStatus="unavailable"
        onRetryHistory={onRetryHistory}
        onRestore={vi.fn()}
        onSaveCheckpoint={vi.fn()}
        hasUnsavedChanges={false}
        lastSavedAt={null}
      />
    );

    expect(screen.getByRole('status')).toHaveTextContent('Version history unavailable');
    expect(screen.queryByText('No versions yet')).not.toBeInTheDocument();
    screen.getByRole('button', { name: 'Retry' }).click();
    expect(onRetryHistory).toHaveBeenCalledOnce();
  });
});
