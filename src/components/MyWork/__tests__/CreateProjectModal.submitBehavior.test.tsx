import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CreateProjectModal } from '../CreateProjectModal';

const api = vi.hoisted(() => ({ createProject: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock('@/services/api', () => ({ Api: api }));
vi.mock('react-hot-toast', () => ({ default: toast }));
vi.mock('react-i18next', async () => {
  const { createRealUseTranslation } = await import('@/test-utils/realTranslations');
  return { useTranslation: createRealUseTranslation('en') };
});

function mountModal() {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  render(<CreateProjectModal isOpen onClose={onClose} onSaved={onSaved} />);
  return { onClose, onSaved };
}

describe('F2-3 E2 CreateProjectModal native form behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.createProject.mockResolvedValue({ id: 'project-1', name: 'Factory modernization' });
  });

  it('Cancel closes a valid form without creating a project', async () => {
    const user = userEvent.setup();
    const { onClose, onSaved } = mountModal();
    await user.type(screen.getByRole('textbox', { name: /Name/i }), 'Factory modernization');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(api.createProject).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('the X button closes a valid form without creating a project', async () => {
    const user = userEvent.setup();
    const { onClose, onSaved } = mountModal();
    await user.type(screen.getByRole('textbox', { name: /Name/i }), 'Factory modernization');

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(api.createProject).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('Submit creates exactly one project and returns the saved record', async () => {
    const user = userEvent.setup();
    const { onClose, onSaved } = mountModal();
    await user.type(screen.getByRole('textbox', { name: /Name/i }), 'Factory modernization');

    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => expect(api.createProject).toHaveBeenCalledTimes(1));
    expect(api.createProject).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Factory modernization', pmo_standard: 'pmbok' })
    );
    expect(api.createProject.mock.calls[0]?.[0]).not.toHaveProperty('goal');
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('matches the API positive-budget contract', () => {
    mountModal();
    const budget = screen.getByRole('spinbutton', { name: /Budget/i });

    expect(budget).toHaveAttribute('min', '0.01');
    expect(budget).toHaveAttribute('step', '0.01');
  });
});
