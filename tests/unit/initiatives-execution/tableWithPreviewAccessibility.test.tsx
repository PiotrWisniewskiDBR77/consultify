import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React, { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { TableWithPreviewLayout } from '../../../src/components/shared/TableWithPreviewLayout';

vi.mock('@/hooks/useDeviceType', () => ({
  useDeviceType: () => ({ isMobile: false, safeAreaInsets: { top: 0, bottom: 0 } }),
}));

const items = [
  { id: 'one', title: 'First item' },
  { id: 'two', title: 'Second item' },
];

function Harness() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = items.find((item) => item.id === selectedId) ?? null;
  return (
    <TableWithPreviewLayout
      selectedId={selectedId}
      selectedItem={selected}
      onSelect={setSelectedId}
      onOpenFull={vi.fn()}
      itemIds={items.map((item) => item.id)}
      getItemById={(id) => items.find((item) => item.id === id) ?? null}
      renderPreview={(item) => (
        <label>
          Notes
          <textarea aria-label={`${item.title} notes`} />
        </label>
      )}
      renderPreviewFooter={() => <button type="button">Context action</button>}
    >
      {items.map((item) => (
        <button key={item.id} type="button" onClick={() => setSelectedId(item.id)}>
          {item.title}
        </button>
      ))}
    </TableWithPreviewLayout>
  );
}

describe('TableWithPreviewLayout canonical keyboard accessibility', () => {
  it('supports arrows, input-safe Enter, Esc and focus return', async () => {
    render(<Harness />);
    const first = screen.getByRole('button', { name: 'First item' });
    first.focus();
    fireEvent.click(first);
    await screen.findByLabelText('First item notes');
    const workspace = screen.getByRole('region', { name: 'Table and preview workspace' });
    workspace.focus();
    fireEvent.keyDown(workspace, { key: 'j' });
    expect(await screen.findByLabelText('Second item notes')).toBeInTheDocument();
    const notes = screen.getByLabelText('Second item notes');
    notes.focus();
    fireEvent.keyDown(notes, { key: 'Enter' });
    expect(screen.getByLabelText('Second item notes')).toBeInTheDocument();
    fireEvent.keyDown(workspace, { key: 'Escape' });
    await waitFor(() =>
      expect(screen.queryByLabelText('Second item notes')).not.toBeInTheDocument()
    );
    expect(document.activeElement).toBe(first);
  });
});
