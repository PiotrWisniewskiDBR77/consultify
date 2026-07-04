/**
 * @vitest-environment jsdom
 * StandardModuleBar — podstawowe testy renderu (Triada standard).
 */
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { StandardModuleBar } from '../../../src/components/standard/StandardModuleBar';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: any) => (typeof fallback === 'string' ? fallback : _key),
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
}));

describe('StandardModuleBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders breadcrumbs (Menu 1) and primary CTA (Menu 2 right)', () => {
    render(
      <StandardModuleBar
        breadcrumbs={[{ label: 'Tools' }, { label: 'Licensed' }, { label: 'Assessments' }]}
        primaryCta={{ label: 'New Assessment', onClick: vi.fn(), testId: 'new-cta' }}
      />
    );
    expect(screen.getByText('Tools')).toBeInTheDocument();
    expect(screen.getByText('Licensed')).toBeInTheDocument();
    expect(screen.getByText('Assessments')).toBeInTheDocument();
    expect(screen.getByTestId('new-cta')).toBeInTheDocument();
  });

  it('renders Menu 3 counter chips with counts — including 0', () => {
    render(
      <StandardModuleBar
        chips={[
          { id: 'all', label: 'All', count: 119 },
          { id: 'today', label: 'Today', count: 0 },
        ]}
        activeChip="all"
        onChipChange={vi.fn()}
      />
    );
    expect(screen.getByTestId('standard-chip-all')).toBeInTheDocument();
    expect(screen.getByText('119')).toBeInTheDocument();
    // Licznik 0 też widoczny (notatka-prawo §Menu3.1)
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByTestId('standard-chip-all')).toHaveAttribute('aria-pressed', 'true');
  });

  it('switches Menu 3 into bulk mode when selection > 0 (overrides chips)', () => {
    render(
      <StandardModuleBar
        chips={[{ id: 'all', label: 'All', count: 3 }]}
        activeChip="all"
        bulk={{
          count: 2,
          onClear: vi.fn(),
          actions: [{ id: 'del', label: 'Delete', onClick: vi.fn(), variant: 'danger' }],
        }}
      />
    );
    expect(screen.getByText('2 selected')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
    // Tryb bulk nadpisuje chipy filtrów
    expect(screen.queryByTestId('standard-chip-all')).not.toBeInTheDocument();
  });

  it('renders module tabs (Menu 2 pills) without counters', () => {
    render(
      <StandardModuleBar
        tabs={[
          { id: 'tasks', label: 'Tasks' },
          { id: 'decisions', label: 'Decisions' },
        ]}
        activeTab="tasks"
        onTabChange={vi.fn()}
      />
    );
    const tab = screen.getByRole('tab', { name: 'Tasks' });
    expect(tab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Decisions' })).toBeInTheDocument();
  });
});
