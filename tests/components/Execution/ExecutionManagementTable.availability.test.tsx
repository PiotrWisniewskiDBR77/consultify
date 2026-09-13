/**
 * @vitest-environment jsdom
 */

import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => {
  const t = (_key: string, fallback?: string) => fallback ?? _key;
  return { useTranslation: () => ({ t, i18n: { language: 'en' } }) };
});
vi.mock('@/components/shared/PreviewPane/useJedenPanel', () => ({
  useJedenPanel: () => ({ otworz: vi.fn(), zamkniety: false }),
}));
vi.mock('@/components/shared/PreviewPane/JedenPrawyPanel', () => ({
  JedenPrawyPanel: ({ rekord }: { rekord?: React.ReactNode }) => <aside>{rekord}</aside>,
}));

import {
  ExecutionManagementTable,
  type ManagementLaneRow,
} from '@/components/Execution/ExecutionManagementTable';

const rows: ManagementLaneRow[] = [
  {
    id: 'action-queue',
    label: 'Action Queue',
    status: 'loading',
    total: null,
    critical: null,
    warning: null,
  },
  {
    id: 'decisions',
    label: 'Decisions',
    status: 'unavailable',
    total: null,
    critical: null,
    warning: null,
  },
  {
    id: 'blockers',
    label: 'Blockers',
    status: 'available',
    total: 0,
    critical: 0,
    warning: 0,
  },
  {
    id: 'risk',
    label: 'Execution Risk',
    status: 'available',
    total: 4,
    critical: 2,
    warning: 1,
  },
];

describe('ExecutionManagementTable honest availability rendering', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => cleanup());

  it('renders loading and unavailable as states, preserves proven zero, and sorts available counts', () => {
    render(<ExecutionManagementTable rows={rows} />);

    const loadingRow = screen.getByText('Action Queue').closest('tr');
    const unavailableRow = screen.getByText('Decisions').closest('tr');
    const emptyRow = screen.getByText('Blockers').closest('tr');
    expect(loadingRow).not.toBeNull();
    expect(unavailableRow).not.toBeNull();
    expect(emptyRow).not.toBeNull();
    expect(within(loadingRow!).getAllByText('Loading')).toHaveLength(3);
    expect(within(unavailableRow!).getAllByText('Unavailable')).toHaveLength(3);
    expect(within(unavailableRow!).queryByText('0')).not.toBeInTheDocument();
    expect(within(emptyRow!).getAllByText('0')).toHaveLength(3);

    const renderedRows = screen.getAllByRole('row').map((row) => row.textContent ?? '');
    expect(renderedRows.findIndex((text) => text.includes('Execution Risk'))).toBeLessThan(
      renderedRows.findIndex((text) => text.includes('Blockers'))
    );
  });

  it('does not label unavailable data healthy, while a proven empty lane remains healthy', () => {
    render(<ExecutionManagementTable rows={rows} />);

    const unavailableRow = screen.getByText('Decisions').closest('tr')!;
    fireEvent.click(unavailableRow);
    expect(unavailableRow).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('complementary')).toHaveTextContent('Data status: Unavailable.');
    expect(screen.queryByText('Healthy')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Blockers').closest('tr')!);
    expect(screen.getByText('Healthy')).toBeInTheDocument();
    expect(screen.getByRole('complementary')).toHaveTextContent(
      /Items: 0\. Critical: 0\. Warning: 0\./
    );
  });
});
