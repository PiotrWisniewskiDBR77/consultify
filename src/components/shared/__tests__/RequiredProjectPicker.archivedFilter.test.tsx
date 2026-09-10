/**
 * @vitest-environment jsdom
 *
 * D-C2/DEC-464: RequiredProjectPicker ukrywa projekty status='archived' z
 * listy WYBORU, chyba że aktualnie wybrany projekt (`value`) jest sam
 * archiwalny — wtedy zostaje widoczny z dopiskiem "(archived)"
 * (i18n: shared.requiredProjectPicker.archivedSuffix).
 */

import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key,
  }),
}));

const { getProjects } = vi.hoisted(() => ({
  getProjects: vi.fn(),
}));

vi.mock('@/services/api', () => ({
  Api: { getProjects, createProject: vi.fn() },
}));

import { RequiredProjectPicker } from '../RequiredProjectPicker';

describe('RequiredProjectPicker — archived filtering (D-C2/DEC-464)', () => {
  it('hides an archived project that is not the current value', async () => {
    getProjects.mockResolvedValueOnce([
      { id: 'p-active', name: 'Active Project', status: 'active' },
      { id: 'p-archived', name: 'Old Project', status: 'archived' },
    ]);

    render(<RequiredProjectPicker value="" onChange={() => {}} language="en" />);

    await waitFor(() => expect(getProjects).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByRole('option', { name: 'Active Project' })).toBeInTheDocument()
    );
    expect(screen.queryByRole('option', { name: /Old Project/ })).not.toBeInTheDocument();
  });

  it('keeps the currently selected archived project visible with an "(archived)" suffix', async () => {
    getProjects.mockResolvedValueOnce([
      { id: 'p-active', name: 'Active Project', status: 'active' },
      { id: 'p-archived', name: 'Old Project', status: 'archived' },
    ]);

    render(<RequiredProjectPicker value="p-archived" onChange={() => {}} language="en" />);

    await waitFor(() => expect(getProjects).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByRole('option', { name: 'Old Project (archived)' })).toBeInTheDocument()
    );
    expect(screen.getByRole('option', { name: 'Active Project' })).toBeInTheDocument();
  });
});
