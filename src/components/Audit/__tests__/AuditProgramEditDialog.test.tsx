import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

const { updateProgram } = vi.hoisted(() => ({ updateProgram: vi.fn() }));
vi.mock('../auditApi', () => ({ updateProgram }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key }),
}));

import { AuditProgramEditDialog } from '../AuditProgramEditDialog';

const program = {
  id: 'program-1',
  organizationId: 'org-1',
  name: 'Original name',
  description: 'Original description',
  objective: 'Original objective',
  status: 'draft' as const,
  preset: null,
  config: {},
  createdBy: 'consultant-1',
  createdAt: '2026-08-15T00:00:00.000Z',
  updatedAt: '2026-08-15T00:00:00.000Z',
};

describe('AuditProgramEditDialog', () => {
  it('saves edited base fields and returns the persisted read model', async () => {
    const saved = { ...program, name: 'Updated name' };
    updateProgram.mockResolvedValueOnce(saved);
    const onSaved = vi.fn();
    render(<AuditProgramEditDialog program={program} onClose={vi.fn()} onSaved={onSaved} />);

    fireEvent.change(screen.getByDisplayValue('Original name'), {
      target: { value: 'Updated name' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(updateProgram).toHaveBeenCalledWith(
        'program-1',
        expect.objectContaining({ name: 'Updated name' })
      );
      expect(onSaved).toHaveBeenCalledWith(saved);
    });
  });
});
