/** @vitest-environment jsdom */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  downloadOrganizationExportJob: vi.fn(),
  exportOrganizationData: vi.fn(),
  getAccessCodes: vi.fn(),
  getAccessRequests: vi.fn(),
  getOrganizationExportJob: vi.fn(),
  getOrganizations: vi.fn(),
  startOrganizationExportJob: vi.fn(),
}));

vi.mock('@/services/api', () => ({
  Api: {
    ...api,
    approveAccessRequest: vi.fn(),
    deactivateAccessCode: vi.fn(),
    generateAccessCode: vi.fn(),
    rejectAccessRequest: vi.fn(),
    updateOrganization: vi.fn(),
  },
}));
vi.mock('react-hot-toast', () => ({
  toast: { error: vi.fn(), remove: vi.fn(), success: vi.fn() },
}));
vi.mock('@/components/Admin/AdminState', () => ({
  DegradedState: ({ title }: { title: string }) => <div role="alert">{title}</div>,
}));
vi.mock('@/components/MyWork/shared/ConfirmDialog', () => ({ ConfirmDialog: () => null }));
vi.mock('@/components/shared/InfoButton', () => ({ InfoButton: () => null }));
vi.mock('@/views/superadmin/SuperAdminOrgDetailsModal', () => ({
  SuperAdminOrgDetailsModal: () => null,
}));
vi.mock('@/components/standard/StandardTable', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/standard/StandardTable')>();
  return {
    StandardTable: ({ columns, data, rowMenu }: any) => (
      <div>
        {data.map((row: any) => {
          const menu = rowMenu?.(row);
          return (
            <div key={row.id}>
              <span>{row.name}</span>
              {columns.find((column: any) => column.id === 'actions')?.render?.(row)}
              {menu
                ? actual
                    .rowMenuToSections(menu, (_key: string, fallback: string) => fallback, false)
                    .flatMap((section) => section.actions)
                    .map((item) => (
                      <button key={item.id} onClick={item.onClick} disabled={item.disabled}>
                        {item.label}
                      </button>
                    ))
                : null}
            </div>
          );
        })}
      </div>
    ),
  };
});

import { OrganizationsView } from '../OrganizationsView';

describe('OrganizationsView enterprise archive export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    api.getOrganizations.mockResolvedValue({
      organizations: [{ id: 'org-a', name: 'Organization A', plan: 'enterprise', status: 'active' }],
    });
    api.getAccessRequests.mockResolvedValue({ requests: [] });
    api.getAccessCodes.mockResolvedValue({ codes: [] });
    api.startOrganizationExportJob.mockResolvedValue({
      job: { id: 'job-a', phase: 'queued' },
      resumeToken: 'resume-secret',
    });
    api.getOrganizationExportJob.mockResolvedValue({
      id: 'job-a',
      organizationId: 'org-a',
      phase: 'ready',
      completedTables: 1379,
      totalTables: 1379,
      rows: 42,
      percent: 100,
    });
    api.downloadOrganizationExportJob.mockResolvedValue(new Blob(['zip']));
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:e1') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  });

  it('starts the resumable job and downloads its ZIP instead of the legacy JSON', async () => {
    render(<OrganizationsView />);
    fireEvent.click(await screen.findByRole('button', { name: 'enterpriseExport.action' }));

    await waitFor(() => expect(api.downloadOrganizationExportJob).toHaveBeenCalled());
    expect(api.startOrganizationExportJob).toHaveBeenCalledWith('org-a');
    expect(api.getOrganizationExportJob).toHaveBeenCalledWith('org-a', 'job-a', 'resume-secret');
    expect(api.downloadOrganizationExportJob).toHaveBeenCalledWith('org-a', 'job-a', 'resume-secret');
    expect(api.exportOrganizationData).not.toHaveBeenCalled();
    expect(screen.getByText('enterpriseExport.ready')).toBeVisible();
    expect(sessionStorage.getItem('enterprise-export:org-a')).toBeNull();
  });

  it('shows measured progress and resumes an interrupted job from session storage', async () => {
    sessionStorage.setItem(
      'enterprise-export:org-a',
      JSON.stringify({ jobId: 'job-resume', resumeToken: 'resume-existing' })
    );
    api.getOrganizationExportJob
      .mockResolvedValueOnce({
        id: 'job-resume',
        organizationId: 'org-a',
        phase: 'running',
        completedTables: 400,
        totalTables: 1379,
        rows: 900,
        percent: 29,
      })
      .mockResolvedValueOnce({
        id: 'job-resume',
        organizationId: 'org-a',
        phase: 'ready',
        completedTables: 1379,
        totalTables: 1379,
        rows: 1900,
        percent: 100,
      });

    render(<OrganizationsView />);
    fireEvent.click(await screen.findByRole('button', { name: 'enterpriseExport.action' }));

    expect(await screen.findByText('29%')).toBeVisible();
    expect(screen.getByText('enterpriseExport.progressTables')).toBeVisible();
    await waitFor(() => expect(api.downloadOrganizationExportJob).toHaveBeenCalled(), {
      timeout: 3000,
    });
    expect(api.startOrganizationExportJob).not.toHaveBeenCalled();
    expect(api.getOrganizationExportJob).toHaveBeenNthCalledWith(
      1,
      'org-a',
      'job-resume',
      'resume-existing'
    );
  });

  it('replaces preparing state with a retryable failure and retries through the saved operation', async () => {
    api.startOrganizationExportJob
      .mockRejectedValueOnce(new Error('gateway unavailable'))
      .mockResolvedValueOnce({ job: { id: 'job-b', phase: 'queued' }, resumeToken: 'resume-b' });

    render(<OrganizationsView />);
    fireEvent.click(await screen.findByRole('button', { name: 'enterpriseExport.action' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('gateway unavailable');
    expect(screen.queryByText('enterpriseExport.preparing')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'enterpriseExport.retry' }));

    await waitFor(() => expect(api.downloadOrganizationExportJob).toHaveBeenCalled());
    expect(api.startOrganizationExportJob).toHaveBeenCalledTimes(2);
  });
});
