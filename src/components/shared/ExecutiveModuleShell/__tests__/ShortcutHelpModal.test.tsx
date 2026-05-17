/**
 * @vitest-environment jsdom
 *
 * Tests for `<ShortcutHelpModal>` (EPIC-T16 D6).
 *
 * Coverage:
 *   * isOpen=false → renders nothing.
 *   * isOpen=true → renders dialog + each shortcut row.
 *   * Empty shortcut list → "No shortcuts registered" placeholder.
 *   * Close button calls onClose.
 *   * Escape key calls onClose.
 *   * Backdrop click calls onClose; inside-click does not.
 *   * Close button receives focus on open (a11y).
 */

import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ShortcutHelpModal } from '../ShortcutHelpModal';
import type { ShortcutDescriptor } from '../shortcuts';

const SAMPLE: ShortcutDescriptor[] = [
  {
    id: 'toggle-left-rail',
    label: 'Toggle left rail',
    display: '⌘ \\',
    match: () => false,
    handler: () => undefined,
  },
  {
    id: 'open-shortcut-help',
    label: 'Open shortcut help',
    display: '⌘ /',
    match: () => false,
    handler: () => undefined,
  },
];

describe('ShortcutHelpModal', () => {
  it('renders nothing when isOpen=false', () => {
    const { container } = render(
      <ShortcutHelpModal isOpen={false} onClose={vi.fn()} shortcuts={SAMPLE} />
    );
    expect(container.querySelector('[data-testid="mels-shortcut-help"]')).toBeNull();
  });

  it('renders the dialog and all shortcut rows when isOpen=true', () => {
    render(<ShortcutHelpModal isOpen onClose={vi.fn()} shortcuts={SAMPLE} />);
    expect(screen.getByTestId('mels-shortcut-help')).toBeInTheDocument();
    expect(screen.getByTestId('mels-shortcut-row-toggle-left-rail')).toHaveTextContent(
      'Toggle left rail'
    );
    expect(screen.getByTestId('mels-shortcut-row-open-shortcut-help')).toHaveTextContent('⌘ /');
  });

  it('renders the empty placeholder when shortcuts=[]', () => {
    render(<ShortcutHelpModal isOpen onClose={vi.fn()} shortcuts={[]} />);
    expect(screen.getByText(/no shortcuts registered/i)).toBeInTheDocument();
  });

  it('close button calls onClose', () => {
    const onClose = vi.fn();
    render(<ShortcutHelpModal isOpen onClose={onClose} shortcuts={SAMPLE} />);
    fireEvent.click(screen.getByTestId('mels-shortcut-help-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Escape key calls onClose', () => {
    const onClose = vi.fn();
    render(<ShortcutHelpModal isOpen onClose={onClose} shortcuts={SAMPLE} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('backdrop click closes; inner click does not', () => {
    const onClose = vi.fn();
    render(<ShortcutHelpModal isOpen onClose={onClose} shortcuts={SAMPLE} />);
    fireEvent.click(screen.getByTestId('mels-shortcut-help'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('mels-shortcut-help-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('close button receives focus on open', () => {
    render(<ShortcutHelpModal isOpen onClose={vi.fn()} shortcuts={SAMPLE} />);
    expect(document.activeElement).toBe(screen.getByTestId('mels-shortcut-help-close'));
  });

  it('honours custom title and description', () => {
    render(
      <ShortcutHelpModal
        isOpen
        onClose={vi.fn()}
        shortcuts={SAMPLE}
        title="Skróty klawiszowe"
        description="Dostępne polecenia w MELS."
      />
    );
    expect(screen.getByText('Skróty klawiszowe')).toBeInTheDocument();
    expect(screen.getByText('Dostępne polecenia w MELS.')).toBeInTheDocument();
  });
});
