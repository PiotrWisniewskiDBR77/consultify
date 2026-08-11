/**
 * ArtifactBreadcrumb — element ㉛ (Menu 1 artefaktu), tor PLATFORMY punkt 1.
 * Rules being locked in:
 *   - pusta tablica -> nic się nie renderuje (addytywne, karta bez okruszków
 *     wygląda jak dziś)
 *   - ostatnia pozycja jest zawsze TEKSTEM (current), nigdy klikalnym linkiem,
 *     nawet jeśli caller poda jej `onClick`
 *   - separator (ChevronRight) występuje DOKŁADNIE między sąsiednimi
 *     pozycjami — N pozycji => N-1 separatorów
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ArtifactBreadcrumb } from '../../../src/components/standard/ArtifactBreadcrumb';

describe('ArtifactBreadcrumb', () => {
  it('nie renderuje nic dla pustej tablicy', () => {
    const { container } = render(<ArtifactBreadcrumb items={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renderuje wszystkie pozycje w kolejności', () => {
    render(
      <ArtifactBreadcrumb
        items={[{ label: 'Rejestr KPI' }, { label: 'Zestawy' }, { label: 'OEE-LINIA-PAKOWANIA' }]}
      />
    );
    expect(screen.getByText('Rejestr KPI')).toBeInTheDocument();
    expect(screen.getByText('Zestawy')).toBeInTheDocument();
    expect(screen.getByText('OEE-LINIA-PAKOWANIA')).toBeInTheDocument();
  });

  it('N pozycji renderuje dokładnie N-1 separatorów', () => {
    const { container } = render(
      <ArtifactBreadcrumb items={[{ label: 'A' }, { label: 'B' }, { label: 'C' }]} />
    );
    expect(container.querySelectorAll('svg').length).toBe(2);
  });

  it('środkowa pozycja z onClick jest klikalnym przyciskiem', () => {
    const onClick = vi.fn();
    render(<ArtifactBreadcrumb items={[{ label: 'Rejestr KPI', onClick }, { label: 'Bieżący' }]} />);
    fireEvent.click(screen.getByText('Rejestr KPI'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('ostatnia pozycja jest tekstem — nawet gdy ma onClick, NIE jest klikalna', () => {
    const onClick = vi.fn();
    render(<ArtifactBreadcrumb items={[{ label: 'Rejestr' }, { label: 'Bieżący', onClick }]} />);
    const current = screen.getByText('Bieżący');
    expect(current.tagName).toBe('SPAN');
    fireEvent.click(current);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('nawigacja ma aria-label "Breadcrumb"', () => {
    render(<ArtifactBreadcrumb items={[{ label: 'A' }, { label: 'B' }]} />);
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeInTheDocument();
  });
});
