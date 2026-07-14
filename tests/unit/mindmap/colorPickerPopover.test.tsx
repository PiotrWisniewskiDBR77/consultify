/**
 * Tests for ColorPickerPopover: color selection dispatches update.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (key: string) => key,
  }),
}));

import { ColorPickerPopover } from '@/components/MyWork/mindmap/floating-toolbar/ColorPickerPopover';

const baseProps = {
  isPl: false,
  currentColor: '#3b82f6',
  currentFillOpacity: 100,
  currentLineStyle: 'solid' as const,
  onUpdate: vi.fn(),
  onClose: vi.fn(),
};

describe('ColorPickerPopover', () => {
  it('renders line style toggles', () => {
    render(<ColorPickerPopover {...baseProps} />);
    expect(screen.getByText('━━━')).toBeTruthy();
    expect(screen.getByText('╌╌╌')).toBeTruthy();
    expect(screen.getByText('···')).toBeTruthy();
  });

  it('renders opacity slider', () => {
    render(<ColorPickerPopover {...baseProps} />);
    expect(screen.getByText('ideas.mindmap.opacity')).toBeTruthy();
    expect(screen.getByText('100%')).toBeTruthy();
  });

  it('dispatches color on recommended color click', () => {
    const onUpdate = vi.fn();
    const { container } = render(<ColorPickerPopover {...baseProps} onUpdate={onUpdate} />);
    const colorBtns = container.querySelectorAll<HTMLButtonElement>('button[style]');
    expect(colorBtns.length).toBeGreaterThan(0);
    fireEvent.click(colorBtns[0]);
    expect(onUpdate).toHaveBeenCalledWith({ color: expect.any(String) });
  });

  it('dispatches line style on toggle', () => {
    const onUpdate = vi.fn();
    render(<ColorPickerPopover {...baseProps} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByText('╌╌╌'));
    expect(onUpdate).toHaveBeenCalledWith({ lineStyle: 'dashed' });
  });

  it('randomize button dispatches a color', () => {
    const onUpdate = vi.fn();
    render(<ColorPickerPopover {...baseProps} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByText('ideas.mindmap.random'));
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ color: expect.any(String) })
    );
  });
});
