import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.unmock('@/store/useAppStore');
vi.unmock('react-router-dom');
import records from '../../../docs/program/PJ_1_W244_20260918/http-records.json';
const { getProjectDetails, getTasks } = vi.hoisted(() => ({
  getProjectDetails: vi.fn(),
  getTasks: vi.fn(),
}));
vi.mock('@/services/api', () => ({ Api: { getProjectDetails, getTasks } }));
vi.mock('@/layouts/MainLayout', () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/views/MyWorkView', () => ({
  MyWorkView: () => <div data-testid="my-work-destination" />,
}));
vi.mock('@/components/AIChat/ConversationRouteSync', () => ({ ConversationRouteSync: () => null }));
vi.mock('@/components/ProtectedRoute', () => ({
  ProtectedRoute: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  BetaGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
import { AppRoutes } from '../AppRoutes';
import { useAppStore } from '@/store/useAppStore';
beforeEach(() => {
  vi.stubEnv('VITE_PMO_PROJECTS', 'true');
  getProjectDetails.mockReset();
  getTasks.mockReset();
  useAppStore.setState({
    currentUser: {
      id: '08c54d75-5260-57b1-9db6-a30aed89a587',
      role: 'ADMIN',
      isAuthenticated: true,
    } as any,
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});
describe('PJ-1 real AppRoutes and project screen HTTP replay', () => {
  it.each(records)('renders deep-link $id using its actual response', async (record) => {
    getProjectDetails.mockImplementation(async (id) => {
      expect(id).toBe(record.id);
      return record.body;
    });
    getTasks.mockImplementation(async (filters) => {
      expect(filters).toEqual({ projectId: record.id });
      return record.tasks;
    });
    render(
      <MemoryRouter initialEntries={[`/projects/${record.id}`]}>
        <AppRoutes />
      </MemoryRouter>
    );
    expect(
      await screen.findByRole('heading', { name: record.body.name }, { timeout: 10000 })
    ).toBeInTheDocument();
    expect(getProjectDetails).toHaveBeenCalledWith(record.id);
    for (const initiative of record.body.initiatives) {
      expect(screen.getByText(initiative.name)).toBeInTheDocument();
    }
    expect(getTasks).toHaveBeenCalledWith({ projectId: record.id });
    fireEvent.click(screen.getAllByRole('button', { name: /Tasks/ })[0]);
    if (record.tasks.length)
      expect(await screen.findByText(record.tasks[0].title)).toBeInTheDocument();
  });
  it('flag OFF redirects without fetching project data', async () => {
    vi.stubEnv('VITE_PMO_PROJECTS', 'false');
    render(
      <MemoryRouter initialEntries={[`/projects/${records[0].id}`]}>
        <AppRoutes />
      </MemoryRouter>
    );
    expect(
      await screen.findByTestId('my-work-destination', {}, { timeout: 10000 })
    ).toBeInTheDocument();
    expect(getProjectDetails).not.toHaveBeenCalled();
    expect(getTasks).not.toHaveBeenCalled();
  });
});
