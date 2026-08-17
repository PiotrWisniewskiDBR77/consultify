/**
 * Primitive Select smoke tests
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Select } from '../Select';

const options = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
];

describe('primitives/Select', () => {
  it('renders label, options and reports changes', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Select label="Pick one" options={options} value="a" onChange={onChange} />);

    expect(screen.getByText('Pick one')).toBeInTheDocument();
    const select = screen.getByRole('combobox', { name: 'Pick one' });
    await user.selectOptions(select, 'b');
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('exposes error state via aria-invalid and message', () => {
    render(<Select label="Pick" options={options} error="Required field" />);
    const select = screen.getByRole('combobox', { name: 'Pick' });
    expect(select).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Required field')).toBeInTheDocument();
  });

  it('accepts an accessible name when a visible label is rendered elsewhere', () => {
    render(<Select aria-label="Choose owner" options={options} value="a" />);
    expect(screen.getByRole('combobox', { name: 'Choose owner' })).toBeInTheDocument();
  });
});
