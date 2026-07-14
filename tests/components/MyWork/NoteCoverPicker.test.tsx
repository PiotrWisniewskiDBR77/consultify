import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { CoverImageBar, CoverUrlModal, IconPickerButton } from '@/components/MyWork/notebook/NoteCoverPicker';

describe('IconPickerButton', () => {
  it('shows the fallback when no icon is set', () => {
    render(<IconPickerButton value={null} fallback={<span>FB</span>} onChange={vi.fn()} isPolish={false} />);
    expect(screen.getByText('FB')).toBeInTheDocument();
  });

  it('opens the emoji grid and selects an icon', () => {
    const onChange = vi.fn();
    render(<IconPickerButton value={null} fallback={<span>FB</span>} onChange={onChange} isPolish={false} />);
    fireEvent.click(screen.getByTitle('Change page icon'));
    expect(screen.getByText('Icon')).toBeInTheDocument();
    fireEvent.click(screen.getByText('🎯'));
    expect(onChange).toHaveBeenCalledWith('🎯');
  });

  it('removes the icon via the Remove action', () => {
    const onChange = vi.fn();
    render(<IconPickerButton value={'🚀'} fallback={<span>FB</span>} onChange={onChange} isPolish={false} />);
    fireEvent.click(screen.getByTitle('Change page icon'));
    fireEvent.click(screen.getByText('Remove'));
    expect(onChange).toHaveBeenCalledWith(null);
  });
});

describe('CoverImageBar', () => {
  it('renders the "Add cover" affordance when there is no cover', () => {
    const onPick = vi.fn();
    render(<CoverImageBar coverUrl={null} onPick={onPick} onRemove={vi.fn()} isPolish={false} />);
    fireEvent.click(screen.getByText('Add cover'));
    expect(onPick).toHaveBeenCalled();
  });

  it('renders change + remove controls when a cover is set', () => {
    const onRemove = vi.fn();
    render(
      <CoverImageBar coverUrl="https://img/x.png" onPick={vi.fn()} onRemove={onRemove} isPolish={false} />
    );
    expect(screen.getByText('Change')).toBeInTheDocument();
    fireEvent.click(screen.getByTitle('Remove cover'));
    expect(onRemove).toHaveBeenCalled();
  });

  it('renders the add-cover label via t() (language-driven, not isPolish prop)', () => {
    // i18n(M04): label moved from isPolish-ternary to t(); the global test mock
    // returns the EN defaultValue, so PL/EN switching is exercised at runtime, not here.
    render(<CoverImageBar coverUrl={null} onPick={vi.fn()} onRemove={vi.fn()} isPolish />);
    expect(screen.getByText('Add cover')).toBeInTheDocument();
  });
});

describe('CoverUrlModal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <CoverUrlModal open={false} onClose={vi.fn()} onSubmit={vi.fn()} isPolish={false} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('submits a typed URL and closes', () => {
    const onSubmit = vi.fn();
    const onClose = vi.fn();
    render(<CoverUrlModal open onClose={onClose} onSubmit={onSubmit} isPolish={false} />);
    fireEvent.change(screen.getByPlaceholderText('https://…'), {
      target: { value: 'https://img/cover.jpg' },
    });
    fireEvent.click(screen.getByText('Set'));
    expect(onSubmit).toHaveBeenCalledWith('https://img/cover.jpg');
    expect(onClose).toHaveBeenCalled();
  });
});
