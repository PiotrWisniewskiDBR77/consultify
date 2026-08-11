import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React, { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { TableWithPreviewLayout } from '../../../src/components/shared/TableWithPreviewLayout';

vi.mock('@/hooks/useDeviceType', () => ({
  useDeviceType: () => ({ isMobile: true, safeAreaInsets: { top: 0, bottom: 0 } }),
}));

function MobileHarness() {
  const item = { id: 'one', title: 'First item' };
  const [selectedId, setSelectedId] = useState<string | null>(null);
  return (
    <TableWithPreviewLayout
      selectedId={selectedId}
      selectedItem={selectedId ? item : null}
      onSelect={setSelectedId}
      itemIds={[item.id]}
      renderPreview={() => <input aria-label="Preview input" />}
      renderPreviewFooter={() => <button type="button">Last action</button>}
    >
      <button type="button" onClick={() => setSelectedId(item.id)}>
        First item
      </button>
    </TableWithPreviewLayout>
  );
}

describe('TableWithPreviewLayout mobile dialog accessibility', () => {
  it('uses an aria-modal dialog, traps Tab and returns focus on Escape', async () => {
    render(<MobileHarness />);
    const trigger = screen.getByRole('button', { name: 'First item' });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: 'First item' });
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getAllByRole('button', { name: 'Close' })[0])
    );
    fireEvent.keyDown(document.activeElement!, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Last action' }));
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(document.activeElement).toBe(trigger);
  });
});
