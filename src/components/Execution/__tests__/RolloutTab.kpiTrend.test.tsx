/**
 * @vitest-environment jsdom
 *
 * Kolumna Trend — uczciwy, POLSKI stan pusty i realny wykres przy dwóch punktach.
 *
 * Odbiór na żywo 05.09 (`execution-tab-rollout`): kolumna Trend pisała wszędzie
 * angielskie „No history yet" na w pełni polskim ekranie, i mówiła to samo w
 * dwóch RÓŻNYCH sytuacjach — brak pomiarów i JEDEN pomiar (wykres wymaga dwóch).
 * Właściciel widział „brak historii" przy KPI, który historię już miał.
 *
 * DOWÓD MUTACYJNY (wykonany 2026-09-05): przywrócenie jednego napisu
 * „No history yet" dla obu przypadków → padają oba testy stanu pustego.
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : k),
    i18n: { language: 'pl' },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

vi.mock('@/services/api', () => ({
  Api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const { KpiSparkline } = (await import('../RolloutTab')) as unknown as {
  KpiSparkline: React.FC<{ points: number[]; target: number }>;
};

describe('KpiSparkline', () => {
  it('bez pomiarów mówi po polsku, że trend pojawi się po dwóch', () => {
    render(<KpiSparkline points={[]} target={90} />);
    expect(screen.getByText('Brak pomiarów — trend pojawi się po dwóch')).toBeInTheDocument();
    expect(screen.queryByText(/No history yet/)).not.toBeInTheDocument();
  });

  it('przy JEDNYM pomiarze nie kłamie, że historii nie ma', () => {
    render(<KpiSparkline points={[62]} target={90} />);
    expect(screen.getByText('Jeden pomiar — trend od drugiego')).toBeInTheDocument();
  });

  it('przy dwóch pomiarach rysuje słupki, nie komunikat', () => {
    const { container } = render(<KpiSparkline points={[62, 74]} target={90} />);
    expect(screen.queryByText(/trend/i)).not.toBeInTheDocument();
    expect(container.querySelectorAll('div[title]')).toHaveLength(2);
  });
});
