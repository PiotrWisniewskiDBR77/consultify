import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ErrorState } from '../ErrorState';

describe('ErrorState timeout variant', () => {
  it('provides an honest shared timeout banner without screen-specific copy', () => {
    render(<ErrorState variant="timeout" compact />);

    expect(
      screen.getByRole('alert', { name: '' }).textContent,
    ).toContain('Nie udało się wczytać danych na czas');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Ładowanie trwało dłużej niż 15 sekund. Spróbuj ponownie.',
    );
  });
});
