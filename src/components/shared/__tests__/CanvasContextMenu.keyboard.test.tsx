import { fireEvent, render, screen } from '@testing-library/react';
import React, { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { CanvasContextMenu } from '../CanvasContextMenu';

function Harness(): React.ReactElement {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Selected cell
      </button>
      {open ? (
        <CanvasContextMenu
          x={20}
          y={20}
          onClose={() => setOpen(false)}
          items={[
            { id: 'copy', label: 'Kopiuj', onSelect: vi.fn() },
            { id: 'cut', label: 'Wytnij', onSelect: vi.fn() },
          ]}
        />
      ) : null}
    </>
  );
}

describe('CanvasContextMenu keyboard focus contract', () => {
  it('focuses the first item, navigates with ArrowDown and restores the trigger on Escape', async () => {
    render(<Harness />);
    const selectedCell = screen.getByRole('button', { name: 'Selected cell' });
    selectedCell.focus();
    fireEvent.click(selectedCell);

    const copy = await screen.findByRole('menuitem', { name: 'Kopiuj' });
    expect(copy).toHaveFocus();

    fireEvent.keyDown(copy, { key: 'ArrowDown' });
    const cut = screen.getByRole('menuitem', { name: 'Wytnij' });
    expect(cut).toHaveFocus();

    fireEvent.keyDown(cut, { key: 'Escape' });
    await vi.waitFor(() => expect(selectedCell).toHaveFocus());
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
