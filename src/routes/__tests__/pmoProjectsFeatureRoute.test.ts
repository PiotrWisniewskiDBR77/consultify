import { describe, expect, it } from 'vitest';

import appRoutesSource from '../AppRoutes.tsx?raw';

describe('F2-3 E2 Projects route feature flag', () => {
  it('reads VITE_PMO_PROJECTS in one Vite expression and defaults to OFF', () => {
    expect(appRoutesSource).toContain("import.meta.env.VITE_PMO_PROJECTS === 'true'");
  });

  it('keeps /projects redirecting to /my-work when OFF and mounts MyProjects when ON', () => {
    const routeIndex = appRoutesSource.indexOf('path={ROUTES.PROJECTS}');
    expect(routeIndex).toBeGreaterThan(-1);
    const route = appRoutesSource.slice(routeIndex, routeIndex + 700);
    expect(route).toContain('pmoProjectsEnabled ?');
    expect(route).toContain('<MyProjects />');
    expect(route).toContain('<Navigate to="/my-work" replace />');
  });


  it('mounts /projects/:projectId as a flagged project object deep-link', () => {
    expect(appRoutesSource).toContain('ProjectDetailScreen');
    expect(appRoutesSource).toContain('path={`${ROUTES.PROJECTS}/:projectId`}');
    const detailIndex = appRoutesSource.indexOf('path={`${ROUTES.PROJECTS}/:projectId`}');
    expect(detailIndex).toBeGreaterThan(-1);
    const detailRoute = appRoutesSource.slice(detailIndex, detailIndex + 700);
    expect(detailRoute).toContain('pmoProjectsEnabled ?');
    expect(detailRoute).toContain('<ProjectDetailScreen />');
    expect(detailRoute).toContain('<Navigate to="/my-work" replace />');
  });

  it('does not create a new main-menu entry for PMO', () => {
    const routeIndex = appRoutesSource.indexOf('path={ROUTES.PROJECTS}');
    const route = appRoutesSource.slice(routeIndex, routeIndex + 700);
    expect(route).not.toContain('Sidebar');
    expect(route).not.toContain('mainMenu');
  });
});
