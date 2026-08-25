import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRealT } from '@/test-utils/realTranslations';

import { TeamApi } from '../../../services/api/teams.api';
import { AdminTeamsPanel } from '../AdminTeamsPanel';


// Opt-in to real PL translation resolution (tests/setup.ts's global
// react-i18next mock is key-agnostic by repo convention). This panel's
// own admin day-2 i18n contract (AdminDay2I18n.test.ts) forbids defaultValue
// fallbacks, so its tests assert literal Polish strings resolved from the
// real shipped translation.json instead.
vi.mock('react-i18next', () => {
  const t = createRealT('pl');
  return { useTranslation: () => ({ t, i18n: { language: 'pl' } }) };
});

vi.mock('../../../services/api/teams.api', () => ({
  TeamApi: {
    getTeams: vi.fn(),
    getTeam: vi.fn(),
    createTeam: vi.fn(),
    deleteTeam: vi.fn(),
    addTeamMember: vi.fn(),
    removeTeamMember: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockedApi = vi.mocked(TeamApi);
const team = {
  id: 'team-1',
  organizationId: 'org-1',
  name: 'Delivery',
  members: [],
  memberCount: 0,
  teamType: 'standard',
  isActive: true,
  createdAt: '2026-08-24T20:00:00.000Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.getTeams.mockResolvedValue([team]);
});

describe('AdminTeamsPanel', () => {
  it('loads real teams and renders the list', async () => {
    render(<AdminTeamsPanel />);
    expect(await screen.findByText('Delivery')).toBeInTheDocument();
    expect(mockedApi.getTeams).toHaveBeenCalledTimes(1);
  });

  it('renders an honest empty state', async () => {
    mockedApi.getTeams.mockResolvedValue([]);
    render(<AdminTeamsPanel />);
    expect(await screen.findByText('Brak zespołów')).toBeInTheDocument();
  });

  it('renders an API error and retry action', async () => {
    mockedApi.getTeams.mockRejectedValueOnce(new Error('backend unavailable'));
    render(<AdminTeamsPanel />);
    expect(await screen.findByText('backend unavailable')).toBeInTheDocument();
  });

  it('accepts create only after exact list readback', async () => {
    mockedApi.getTeams.mockResolvedValueOnce([]).mockResolvedValueOnce([team]);
    mockedApi.createTeam.mockResolvedValue(team);
    render(<AdminTeamsPanel />);
    await screen.findByText('Brak zespołów');
    fireEvent.change(screen.getByLabelText('Nazwa zespołu'), { target: { value: 'Delivery' } });
    fireEvent.click(screen.getByRole('button', { name: 'Utwórz' }));
    await waitFor(() =>
      expect(mockedApi.createTeam).toHaveBeenCalledWith({
        name: 'Delivery',
        description: undefined,
      })
    );
    expect(await screen.findByText('Delivery')).toBeInTheDocument();
  });
});
