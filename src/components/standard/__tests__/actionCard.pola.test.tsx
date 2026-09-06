import { render, screen, within } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ActionCard } from '../ActionCard';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key }),
}));

const card = {
  id: 'card-1', sourceKind: 'audit_finding' as const, sourceId: 'finding-1',
  periodStart: '2026-09-01', periodEnd: '2026-09-30', goalMet: false,
  actionRequired: true, problem: 'Próg przekroczony', rootCause: 'Brak kontroli',
  actionText: 'Wprowadzić kontrolę', ownerName: 'Anna Kowalska', dueDate: '2026-10-05',
  comment: 'Priorytet', status: 'OPEN' as const, severity: 'RED' as const,
};

describe('ActionCard — jeden kontrakt pól §2.4', () => {
  it('renderuje wszystkie 10 pól w kolejności arkusza właściciela', () => {
    render(<ActionCard card={card} />);
    const labels = within(screen.getByRole('article')).getAllByRole('term').map((node) => node.textContent);
    expect(labels).toEqual(['Okres', 'Cel osiągnięty?', 'Działania wymagane?', 'Opis problemu', 'Główna przyczyna', 'Opis działania', 'Odpowiedzialność', 'Termin', 'Komentarz', 'Status']);
    expect(screen.getByText('Anna Kowalska')).toBeTruthy();
  });

  it('nie pokazuje surowego identyfikatora właściciela, gdy brak nazwiska', () => {
    render(<ActionCard card={{ ...card, ownerName: undefined }} />);
    expect(screen.queryByText(/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i)).toBeNull();
  });

  it('nie używa tokenów primary, a crimson wiąże wyłącznie z otwartym RED', () => {
    const { container, rerender } = render(<ActionCard card={card} />);
    expect(container.innerHTML).not.toContain('primary-');
    expect(container.innerHTML).toContain('c-danger');
    rerender(<ActionCard card={{ ...card, status: 'CLOSED' }} />);
    expect(container.querySelector('article')?.className).not.toContain('border-c-danger');
  });
});
