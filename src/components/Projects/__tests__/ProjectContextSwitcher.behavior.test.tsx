import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.unmock('@/store/useAppStore');
vi.unmock('react-router-dom');

const { getMyProjectMemberships } = vi.hoisted(() => ({
  getMyProjectMemberships: vi.fn(),
}));

vi.mock('@/services/api', () => ({
  Api: { getMyProjectMemberships },
}));

import { ProjectContextSwitcher } from '../ProjectContextSwitcher';
import { useAppStore } from '@/store/useAppStore';

const projects = [
  { id: '6174636d-c4f2-552d-9a5a-d2695738f9bc', name: 'Operational Excellence Programme' },
  { id: 'ae6cfbae-1ba8-5328-9048-d86f2a52a09e', name: 'Digital & Automation Roadmap' },
];

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-probe">{location.pathname}</div>;
}

describe('ProjectContextSwitcher', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_PMO_PROJECT_SWITCHER', 'true');
    getMyProjectMemberships.mockReset();
    getMyProjectMemberships.mockResolvedValue(projects);
    useAppStore.setState({ currentProjectId: null });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it('is absent while the F-2 flag is OFF', () => {
    vi.stubEnv('VITE_PMO_PROJECT_SWITCHER', 'false');
    render(
      <MemoryRouter>
        <ProjectContextSwitcher />
      </MemoryRouter>
    );

    expect(screen.queryByTestId('project-context-switcher')).not.toBeInTheDocument();
    expect(getMyProjectMemberships).not.toHaveBeenCalled();
  });

  it('selects the active project through the shared store and opens its project card', async () => {
    render(
      <MemoryRouter initialEntries={['/initiatives']}>
        <Routes>
          <Route
            path="*"
            element={
              <>
                <ProjectContextSwitcher />
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(
      await screen.findByRole('button', { name: /select project context/i })
    ).toHaveTextContent('All projects');
    fireEvent.click(screen.getByRole('button', { name: /select project context/i }));
    fireEvent.click(await screen.findByRole('option', { name: /Digital & Automation Roadmap/i }));

    await waitFor(() => {
      expect(useAppStore.getState().currentProjectId).toBe(projects[1].id);
      expect(screen.getByTestId('location-probe')).toHaveTextContent(`/projects/${projects[1].id}`);
    });
  });
});
