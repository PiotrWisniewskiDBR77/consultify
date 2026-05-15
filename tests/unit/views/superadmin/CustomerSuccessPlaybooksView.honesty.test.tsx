import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Api from '@/services/api';
import CustomerSuccessPlaybooksView from '@/views/superadmin/customers/CustomerSuccessPlaybooksView';

vi.mock('@/services/api', () => ({
  default: {
    createSuccessPlaybook: vi.fn(),
    deleteSuccessPlaybook: vi.fn(),
    executeSuccessPlaybook: vi.fn(),
    getPlaybookStats: vi.fn(),
    getSuccessActions: vi.fn(),
    getSuccessPlaybooks: vi.fn(),
    updateSuccessPlaybook: vi.fn(),
  },
}));

vi.mock('@/components/Admin/AdminState', () => ({
  DegradedState: ({ title, description }: { title: string; description: string }) => (
    <div role="alert">
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  ),
}));

vi.mock('@/components/shared/InfoButton', () => ({
  InfoButton: () => <span data-testid="info-button" />,
}));

const emptyStats = {
  active_playbooks: 0,
  completed_actions: 0,
  total_actions: 0,
  total_playbooks: 0,
};

describe('CustomerSuccessPlaybooksView honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render failed playbook loads as empty playbooks', async () => {
    vi.mocked(Api.getSuccessPlaybooks).mockRejectedValue(new Error('Playbooks API down'));
    vi.mocked(Api.getSuccessActions).mockResolvedValue([]);
    vi.mocked(Api.getPlaybookStats).mockResolvedValue(emptyStats);

    render(<CustomerSuccessPlaybooksView />);

    await waitFor(() => {
      expect(screen.getByText('Customer success playbooks unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Playbooks API down')).toBeInTheDocument();
    expect(
      screen.queryByText(/superadmin\.customers\.playbooks\.empty\.noPlaybooks|No playbooks/i)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/superadmin\.customers\.playbooks\.stats\.totalPlaybooks|Total Playbooks/i)
    ).not.toBeInTheDocument();
  });

  it('does not claim playbook creation success when read-back is stale', async () => {
    vi.mocked(Api.getSuccessPlaybooks).mockResolvedValue([]);
    vi.mocked(Api.getSuccessActions).mockResolvedValue([]);
    vi.mocked(Api.getPlaybookStats).mockResolvedValue(emptyStats);
    vi.mocked(Api.createSuccessPlaybook).mockResolvedValue({ success: true });

    render(<CustomerSuccessPlaybooksView />);

    await screen.findByRole('button', { name: /superadmin\.customers\.playbooks\.newPlaybook/i });
    fireEvent.click(
      screen.getByRole('button', { name: /superadmin\.customers\.playbooks\.newPlaybook/i })
    );
    fireEvent.change(
      screen.getByPlaceholderText('superadmin.customers.playbooks.placeholders.name'),
      {
        target: { value: 'Renewal rescue' },
      }
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: /superadmin\.customers\.playbooks\.actionTypes\.sendEmail/i,
      })
    );
    fireEvent.click(
      screen.getByRole('button', { name: /superadmin\.customers\.playbooks\.modals\.createCta/i })
    );

    await waitFor(() => {
      expect(
        screen.getByText('Success playbook creation was not confirmed by the server')
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText('superadmin.customers.playbooks.modals.createTitle')
    ).toBeInTheDocument();
  });

  it('does not claim playbook deletion success when read-back fails', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(Api.getSuccessPlaybooks)
      .mockResolvedValueOnce([
        {
          id: 'playbook-1',
          name: 'Renewal rescue',
          trigger_conditions_json: '{}',
          actions_json: '[{"type":"send_email","config":{}}]',
          is_active: true,
          created_at: '2026-01-01',
          updated_at: '2026-01-01',
        },
      ])
      .mockRejectedValueOnce(new Error('Playbooks refresh down'));
    vi.mocked(Api.getSuccessActions).mockResolvedValue([]);
    vi.mocked(Api.getPlaybookStats).mockResolvedValue({
      active_playbooks: 1,
      completed_actions: 0,
      total_actions: 0,
      total_playbooks: 1,
    });
    vi.mocked(Api.deleteSuccessPlaybook).mockResolvedValue({ success: true });

    render(<CustomerSuccessPlaybooksView />);

    fireEvent.click(await screen.findByText('Renewal rescue'));
    fireEvent.click(screen.getByRole('button', { name: /Delete success playbook/i }));

    await waitFor(() => {
      expect(screen.getByText('Playbooks refresh down')).toBeInTheDocument();
    });

    confirmSpy.mockRestore();
  });

  it('renders invalid execution dates as Unknown date', async () => {
    vi.mocked(Api.getSuccessPlaybooks).mockResolvedValue([
      {
        id: 'playbook-1',
        name: 'Renewal rescue',
        trigger_conditions_json: '{}',
        actions_json: '[{"type":"send_email","config":{}}]',
        is_active: true,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
    ]);
    vi.mocked(Api.getSuccessActions).mockResolvedValue([
      {
        id: 'action-1',
        playbook_id: 'playbook-1',
        organization_id: 'org-1',
        action_type: 'send_email',
        status: 'completed',
        executed_at: 'not-a-date',
      },
    ]);
    vi.mocked(Api.getPlaybookStats).mockResolvedValue({
      active_playbooks: 1,
      completed_actions: 1,
      total_actions: 1,
      total_playbooks: 1,
    });

    render(<CustomerSuccessPlaybooksView />);

    fireEvent.click(await screen.findByText('Renewal rescue'));

    expect(await screen.findByText('Unknown date')).toBeInTheDocument();
  });

  it('accepts wrapped playbook, action, stats, and nested create payloads', async () => {
    const existingPlaybook = {
      id: 'playbook-1',
      name: 'Renewal rescue',
      trigger_conditions_json: '{}',
      actions_json: '[{"type":"send_email","config":{}}]',
      is_active: 'true',
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    };
    const createdPlaybook = {
      ...existingPlaybook,
      id: 'playbook-2',
      name: 'Onboarding rescue',
      is_active: false,
    };
    vi.mocked(Api.getSuccessPlaybooks)
      .mockResolvedValueOnce({ data: { data: { playbooks: [existingPlaybook] } } })
      .mockResolvedValueOnce({
        data: { data: { playbooks: [existingPlaybook, createdPlaybook] } },
      });
    vi.mocked(Api.getSuccessActions).mockResolvedValue({
      data: {
        data: {
          actions: [
            {
              id: 'action-1',
              playbook_id: 'playbook-1',
              organization_id: 'org-1',
              action_type: 'send_email',
              status: 'completed',
              executed_at: 'not-a-date',
            },
          ],
        },
      },
    });
    vi.mocked(Api.getPlaybookStats).mockResolvedValue({
      data: {
        data: {
          active_playbooks: 'bad-active',
          completed_actions: 1,
          total_actions: 'bad-actions',
          total_playbooks: 1,
        },
      },
    });
    vi.mocked(Api.createSuccessPlaybook).mockResolvedValue({
      data: { data: { playbook: { id: 'playbook-2' } } },
    });

    const { container } = render(<CustomerSuccessPlaybooksView />);

    expect(await screen.findByText('Renewal rescue')).toBeInTheDocument();
    expect(container.textContent).not.toContain('bad-');
    fireEvent.click(screen.getByText('Renewal rescue'));
    expect(await screen.findByText('Unknown date')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: /superadmin\.customers\.playbooks\.newPlaybook/i })
    );
    fireEvent.change(
      screen.getByPlaceholderText('superadmin.customers.playbooks.placeholders.name'),
      {
        target: { value: 'Onboarding rescue' },
      }
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: /superadmin\.customers\.playbooks\.actionTypes\.sendEmail/i,
      })
    );
    fireEvent.click(
      screen.getByRole('button', { name: /superadmin\.customers\.playbooks\.modals\.createCta/i })
    );

    await waitFor(() => {
      expect(
        screen.queryByText('superadmin.customers.playbooks.modals.createTitle')
      ).not.toBeInTheDocument();
    });
    expect(screen.getByText('Onboarding rescue')).toBeInTheDocument();
  });

  it('does not render malformed playbook payloads as empty playbooks', async () => {
    vi.mocked(Api.getSuccessPlaybooks).mockResolvedValue({ unexpected: true });
    vi.mocked(Api.getSuccessActions).mockResolvedValue([]);
    vi.mocked(Api.getPlaybookStats).mockResolvedValue(emptyStats);

    render(<CustomerSuccessPlaybooksView />);

    await waitFor(() => {
      expect(screen.getByText('Customer success playbooks unavailable')).toBeInTheDocument();
    });
    expect(screen.getByText('Playbook response was missing list data')).toBeInTheDocument();
    expect(
      screen.queryByText(/superadmin\.customers\.playbooks\.empty\.noPlaybooks|No playbooks/i)
    ).not.toBeInTheDocument();
  });
});
