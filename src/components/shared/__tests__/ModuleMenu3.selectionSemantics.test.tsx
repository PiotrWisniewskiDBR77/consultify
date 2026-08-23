import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Menu3Chip } from '../ModuleMenu3';

describe('Menu3Chip selection semantics', () => {
  it('exposes selected state and remains keyboard operable', async () => {
    const onClick = vi.fn();
    const { rerender } = render(
      <Menu3Chip active={false} onClick={onClick}>
        Processing
      </Menu3Chip>
    );

    const chip = screen.getByRole('button', { name: 'Processing' });
    expect(chip).toHaveAttribute('aria-pressed', 'false');
    chip.focus();
    await userEvent.keyboard('{Enter}');
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(<Menu3Chip active>Processing</Menu3Chip>);
    expect(screen.getByRole('button', { name: 'Processing' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it('does not invent toggle semantics for action chips', () => {
    render(<Menu3Chip>Clear</Menu3Chip>);
    expect(screen.getByRole('button', { name: 'Clear' })).not.toHaveAttribute('aria-pressed');
  });
});

