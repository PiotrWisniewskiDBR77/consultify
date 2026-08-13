/**
 * Kanon dostępności klawiaturowej dla komponentów listowych — TRIADA część B,
 * punkty 41-43.
 *
 * DLACZEGO TEN TEST ISTNIEJE:
 * Audyt wizualny huba Audits wykazał dwa defekty, które nie należały do tamtego
 * modułu — leżały we WSPÓLNYCH komponentach i dotyczyły całej aplikacji naraz:
 *
 *   1. `<tr onClick>` w `FilterableTable` nie miał `tabIndex` ani obsługi
 *      Enter/Spacji. Otwarcie podglądu było możliwe wyłącznie myszą — w każdym
 *      module jednocześnie.
 *   2. `StandardPreview` nie obsługiwał klawisza Escape. Podglądu nie dało się
 *      zamknąć klawiaturą nigdzie.
 *
 * Razem zamykały całą ścieżkę „otwórz podgląd → przeczytaj → zamknij" dla osoby
 * pracującej klawiaturą. Ten test pilnuje, żeby regresja nie wróciła po cichu.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { StandardPreview } from '../StandardPreview';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
    i18n: { language: 'pl' },
  }),
}));

describe('StandardPreview — Escape zamyka podgląd', () => {
  it('wywołuje onClose po naciśnięciu Escape', () => {
    const onClose = vi.fn();
    render(<StandardPreview title="Podgląd" onClose={onClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('nie przechwytuje Escape, który obsłużyła bardziej lokalna warstwa', () => {
    const onClose = vi.fn();
    render(<StandardPreview title="Podgląd" onClose={onClose} />);

    // Modal/popover otwarty nad podglądem zatrzymuje zdarzenie u siebie.
    const event = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    event.preventDefault();
    document.dispatchEvent(event);

    expect(onClose).not.toHaveBeenCalled();
  });

  it('inne klawisze nie zamykają podglądu', () => {
    const onClose = vi.fn();
    render(<StandardPreview title="Podgląd" onClose={onClose} />);

    fireEvent.keyDown(document, { key: 'Enter' });
    fireEvent.keyDown(document, { key: 'a' });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('nasłuch znika po odmontowaniu — brak wycieku i wywołań po zamknięciu', () => {
    const onClose = vi.fn();
    const { unmount } = render(<StandardPreview title="Podgląd" onClose={onClose} />);

    unmount();
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('podgląd bez onClose nie rejestruje nasłuchu i nie wybucha na Escape', () => {
    render(<StandardPreview title="Podgląd bez zamykania" />);
    expect(() => fireEvent.keyDown(document, { key: 'Escape' })).not.toThrow();
    expect(screen.getByText('Podgląd bez zamykania')).toBeTruthy();
  });
});
