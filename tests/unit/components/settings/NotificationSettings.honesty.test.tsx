import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'react-hot-toast';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import { User } from '@/types';
import { NotificationSettings } from '@/components/settings/NotificationSettings';

vi.mock('@/components/shared/InfoButton', () => ({
  InfoButton: () => null,
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@/services/api', () => ({
  Api: {
    getNotificationPreferences: vi.fn(),
    saveNotificationPreferences: vi.fn(),
    getIntegrations: vi.fn(),
  },
}));

const currentUser = {
  id: 'user-1',
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane@example.com',
  role: 'USER',
  organizationId: 'org-1',
};

const initialPreferences = {
  taskAssignment: { email: true, inApp: true },
  taskUpdates: { email: false, inApp: true },
  milestones: { email: true, inApp: true },
  mentions: { email: true, inApp: true },
};

const asUser = (user: Partial<User>) => user as User;

describe('NotificationSettings honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Api.getNotificationPreferences).mockResolvedValue(initialPreferences);
    vi.mocked(Api.saveNotificationPreferences).mockResolvedValue({ success: true });
    vi.mocked(Api.getIntegrations).mockResolvedValue([]);
  });

  it('does not render failed notification preference loads as editable defaults', async () => {
    vi.mocked(Api.getNotificationPreferences).mockRejectedValue(new Error('Notifications down'));

    render(<NotificationSettings currentUser={asUser(currentUser)} onUpdateUser={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Notification preferences unavailable')).toBeInTheDocument();
    });

    expect(screen.queryByText('Task Assignments')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Save Changes/i })).not.toBeInTheDocument();
  });

  it('does not show success when save read-back returns stale notification preferences', async () => {
    const onUpdateUser = vi.fn();
    vi.mocked(Api.getNotificationPreferences)
      .mockResolvedValueOnce(initialPreferences)
      .mockResolvedValueOnce(initialPreferences);

    render(<NotificationSettings currentUser={asUser(currentUser)} onUpdateUser={onUpdateUser} />);

    await waitFor(() => {
      expect(screen.getByText('Task Assignments')).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole('switch')[0]);
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Notification preferences were not confirmed by the server'
      );
    });

    expect(toast.success).not.toHaveBeenCalled();
    expect(onUpdateUser).not.toHaveBeenCalled();
  });

  it('confirms a saved preference by read-back and restores it on reload', async () => {
    const onUpdateUser = vi.fn();
    const persistedPreferences = {
      ...initialPreferences,
      taskAssignment: { ...initialPreferences.taskAssignment, inApp: false },
    };
    vi.mocked(Api.getNotificationPreferences)
      .mockResolvedValueOnce(initialPreferences)
      .mockResolvedValueOnce(persistedPreferences)
      .mockResolvedValueOnce(persistedPreferences);

    const firstRender = render(
      <NotificationSettings currentUser={asUser(currentUser)} onUpdateUser={onUpdateUser} />
    );

    await waitFor(() => expect(screen.getByText('Task Assignments')).toBeInTheDocument());
    fireEvent.click(screen.getAllByRole('switch')[0]);
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(Api.saveNotificationPreferences).toHaveBeenCalledWith('user-1', persistedPreferences);
      expect(toast.success).toHaveBeenCalled();
    });
    expect(screen.getByRole('button', { name: /Save Changes/i })).toBeDisabled();

    firstRender.unmount();
    render(<NotificationSettings currentUser={asUser(currentUser)} onUpdateUser={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('Task Assignments')).toBeInTheDocument());
    expect(screen.getAllByRole('switch')[0]).not.toBeChecked();
    expect(Api.getNotificationPreferences).toHaveBeenCalledTimes(3);
  });
});
