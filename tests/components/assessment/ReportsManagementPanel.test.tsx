/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

const apiGetMock = vi.fn();

vi.mock('../../../src/services/api', () => ({
  Api: {
    get: (...args: unknown[]) => apiGetMock(...args),
    post: vi.fn(),
    delete: vi.fn(),
  },
  getHeaders: () => ({ Authorization: 'Bearer test' }),
}));

import { ReportsManagementPanel } from '../../../src/components/assessment/manage/ReportsManagementPanel';

describe('ReportsManagementPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows report provenance readback from the same assessment run', async () => {
    apiGetMock.mockResolvedValue({
      reports: [
        {
          id: 'rpt-1',
          title: 'DRD Executive Report',
          sourceName: 'Canonical DRD',
          status: 'APPROVED',
          createdAt: '2026-04-11T08:00:00.000Z',
          updatedAt: '2026-04-11T09:00:00.000Z',
          createdBy: 'user-1',
          createdByName: 'Ada Lovelace',
          initiativesCount: 2,
          config: {
            assessmentRunId: 'run-42',
            workbenchReviewState: 'accepted',
          },
        },
      ],
    });

    render(
      <MemoryRouter>
        <ReportsManagementPanel
          assessmentId="asm-1"
          assessmentName="Canonical DRD"
          workflowStatus="APPROVED"
          canManage={true}
          onRefresh={async () => {}}
        />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('DRD Executive Report')).toBeInTheDocument();
    });

    expect(screen.getByText(/Current report lane readback: run run-42/i)).toBeInTheDocument();
    expect(screen.getAllByText(/run run-42 • review accepted/i)).toHaveLength(2);
  });
});
