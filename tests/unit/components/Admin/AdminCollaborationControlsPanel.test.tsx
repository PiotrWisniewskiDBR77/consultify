import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AdminCollaborationControlsPanel } from '@/components/Admin/AdminCollaborationControlsPanel';
import { Api } from '@/services/api';

/**
 * DEC-2026-08-24-12 (owner decision on TRI-MUST-02) — guest access, external
 * link sharing, and tool approval required had no enforcement consumer
 * anywhere in the product: saving/loading these switches only round-tripped
 * through adminP32.routes.ts with nothing downstream ever reading the
 * values. The owner ruled that out as a "policy placebo" and required the
 * controls to be hidden (not deleted server-side) until real enforcement is
 * built and separately accepted.
 *
 * This replaces the old interactive-switches test (loads controls, flips a
 * checkbox, saves) with the new contract: no switches, no save action, no
 * API round-trip — just a single explanatory notice in their place.
 */
vi.mock('@/services/api', () => ({
  Api: {
    getAdminCollaborationControls: vi.fn(),
    updateAdminCollaborationControls: vi.fn(),
  },
}));

describe('AdminCollaborationControlsPanel (DEC-2026-08-24-12)', () => {
  it('renders no interactive controls for the three unenforced policies', () => {
    render(<AdminCollaborationControlsPanel />);

    // Exact, case-sensitive matches — the surviving description text uses
    // lowercase, differently-phrased mentions of the same topics ("...for
    // guest access, sharing, and tool approval.") which must NOT false-match.
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Guest access')).not.toBeInTheDocument();
    expect(screen.queryByText('External link sharing')).not.toBeInTheDocument();
    expect(screen.queryByText('Tool approval required')).not.toBeInTheDocument();
  });

  it('shows the "planned, not yet enforced" notice in its place', () => {
    render(<AdminCollaborationControlsPanel />);

    expect(
      screen.getByText(/Planned — this policy will be enforced once implemented\./i)
    ).toBeInTheDocument();
  });

  it('does not call the backend at all — nothing to load or save', () => {
    render(<AdminCollaborationControlsPanel />);

    expect(Api.getAdminCollaborationControls).not.toHaveBeenCalled();
    expect(Api.updateAdminCollaborationControls).not.toHaveBeenCalled();
  });

  it('keeps the section title and description intact around the notice', () => {
    render(<AdminCollaborationControlsPanel />);

    expect(screen.getByText('Collaboration Controls')).toBeInTheDocument();
    expect(
      screen.getByText('Canonical P32 controls for guest access, sharing, and tool approval.')
    ).toBeInTheDocument();
  });
});
