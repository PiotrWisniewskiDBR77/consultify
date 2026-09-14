/**
 * @vitest-environment jsdom
 *
 * P-P06 (zgłoszenie pilotażu Pawła `3317aaf2`, 14.09.2026):
 * „Manual initiative creation loses project selection and cannot create".
 *
 * Odtworzone lokalnie (Playwright, staging-schema + dane org DBR77): ręczny
 * formularz inicjatywy z pustym polem projektu kończy się komunikatem
 * `Canonical initiative creation requires projectId and initiativeOwnerId`,
 * ZERO żądań sieciowych, okno zostaje otwarte — co zgadza się z `api_logs`
 * stagingu (o 04:12 UTC ani jednego POST-a inicjatywy).
 *
 * `autoSelectFirst` (DEC-499 Q3 — do czasu PMO zakres = cała organizacja)
 * sprawia, że pole NIGDY nie jest puste, gdy organizacja ma choć jeden
 * projekt: także wtedy, gdy wybór z jakiegokolwiek powodu wróci do pustego.
 */

import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key,
  }),
}));

const { getProjects } = vi.hoisted(() => ({ getProjects: vi.fn() }));

vi.mock('@/services/api', () => ({
  Api: { getProjects, createProject: vi.fn() },
}));

import { RequiredProjectPicker } from '../RequiredProjectPicker';

function Harness({ autoSelectFirst }: { autoSelectFirst?: boolean }) {
  const [value, setValue] = React.useState('');
  const [summary, setSummary] = React.useState('');
  return (
    <div>
      <RequiredProjectPicker
        value={value}
        onChange={setValue}
        language="en"
        autoSelectFirst={autoSelectFirst}
      />
      <textarea aria-label="summary" value={summary} onChange={(e) => setSummary(e.target.value)} />
      <output data-testid="resolved">{value}</output>
    </div>
  );
}

describe('RequiredProjectPicker — autoSelectFirst (P-P06)', () => {
  it('leaves the value empty without the opt-in (current behaviour for other consumers)', async () => {
    getProjects.mockResolvedValueOnce([
      { id: 'p-one', name: 'Portfolio One', status: 'active' },
      { id: 'p-two', name: 'Portfolio Two', status: 'active' },
    ]);

    render(<Harness />);

    await waitFor(() => expect(getProjects).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByRole('option', { name: 'Portfolio One' })).toBeInTheDocument()
    );
    expect(screen.getByTestId('resolved').textContent).toBe('');
  });

  it('resolves an organization default scope so Create is never blocked by an empty project', async () => {
    getProjects.mockResolvedValueOnce([
      { id: 'p-one', name: 'Portfolio One', status: 'active' },
      { id: 'p-two', name: 'Portfolio Two', status: 'active' },
    ]);

    render(<Harness autoSelectFirst />);

    await waitFor(() => expect(screen.getByTestId('resolved').textContent).toBe('p-one'));
    expect((screen.getByLabelText('Project *') as HTMLSelectElement).value).toBe('p-one');
  });

  it('skips archived projects when resolving the default scope', async () => {
    getProjects.mockResolvedValueOnce([
      { id: 'p-old', name: 'Retired Portfolio', status: 'archived' },
      { id: 'p-live', name: 'Live Portfolio', status: 'active' },
    ]);

    render(<Harness autoSelectFirst />);

    await waitFor(() => expect(screen.getByTestId('resolved').textContent).toBe('p-live'));
  });

  it('stays empty when the organization has no project to default to', async () => {
    getProjects.mockResolvedValueOnce([]);

    render(<Harness autoSelectFirst />);

    await waitFor(() => expect(getProjects).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByLabelText('New project name')).toBeInTheDocument()
    );
    expect(screen.getByTestId('resolved').textContent).toBe('');
  });
});
