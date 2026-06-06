/**
 * Primitive Switch / Toggle smoke tests
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Switch } from '../Switch';
import { Toggle } from '../Toggle';

describe('primitives/Switch', () => {
  it('reflects checked state and toggles on click', async () => {
    const onCheckedChange = vi.fn();
    const user = userEvent.setup();
    render(<Switch label="Enable" checked={false} onCheckedChange={onCheckedChange} />);

    const sw = screen.getByRole('switch');
    expect(sw).toHaveAttribute('aria-checked', 'false');
    await user.click(screen.getByText('Enable'));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it('shows error text', () => {
    render(<Switch aria-label="x" checked error="Boom" />);
    expect(screen.getByText('Boom')).toBeInTheDocument();
  });

  it('Toggle is the same control as Switch', () => {
    expect(Toggle).toBe(Switch);
  });
});
