import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { apiGet } = vi.hoisted(() => ({ apiGet: vi.fn() }));

vi.mock('../../../../services/api', () => ({
  Api: { get: apiGet, post: vi.fn() },
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }));

import { ReportGeneratorDrawer } from '../ReportGeneratorDrawer';

describe('ReportGeneratorDrawer project loading', () => {
  beforeEach(() => apiGet.mockReset());

  it('shows a direct-array project and enables Generate only after selection', async () => {
    apiGet.mockResolvedValue([{ id: 'project-1', name: 'Real project' }]);
    render(<ReportGeneratorDrawer isOpen onClose={vi.fn()} onReportGenerated={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Single Project' }));
    const generate = screen.getByRole('button', { name: 'Generate Report' });
    expect(generate).toBeDisabled();
    const project = await screen.findByRole('option', { name: 'Real project' });
    fireEvent.change(project.closest('select')!, { target: { value: 'project-1' } });
    expect(generate).toBeEnabled();
  });

  it('shows a visible error for a malformed project response', async () => {
    apiGet.mockResolvedValue({ data: {} });
    render(<ReportGeneratorDrawer isOpen onClose={vi.fn()} onReportGenerated={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Single Project' }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });
});
