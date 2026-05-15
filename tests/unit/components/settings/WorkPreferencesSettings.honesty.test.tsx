import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'react-hot-toast';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import { WorkPreferencesSettings } from '@/components/settings/WorkPreferencesSettings';

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
    get: vi.fn(),
    put: vi.fn(),
  },
}));

const user = {
  id: 'user-1',
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane@example.com',
  role: 'USER',
};

const initialPreferences = {
  defaultProjectView: 'kanban',
  defaultTaskSort: 'priority',
  weekStartDay: 'monday',
  showCompletedTasks: false,
  showSubtasks: true,
  autoArchiveDays: 30,
  taskDefaultDueDays: 7,
  defaultTimeTracking: 'none',
  defaultTaskPriority: 'medium',
  defaultReminderBefore: '1day',
  defaultSnoozeDuration: '1hour',
  autoSnoozeOverdue: false,
  enableFocusMode: true,
  focusModeBlocksNotifications: true,
  defaultFocusDuration: 25,
};

describe('WorkPreferencesSettings honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Api.get).mockResolvedValue({ preferences: initialPreferences });
    vi.mocked(Api.put).mockResolvedValue({ success: true });
  });

  it('does not render failed work preference loads as editable default preferences', async () => {
    vi.mocked(Api.get).mockRejectedValue(new Error('Work preferences backend down'));

    render(<WorkPreferencesSettings currentUser={user as any} onUpdateUser={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Work preferences unavailable')).toBeInTheDocument();
    });

    expect(screen.queryByText('Kanban Board')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Save Changes/i })).not.toBeInTheDocument();
  });

  it('does not show success when save read-back returns stale work preferences', async () => {
    vi.mocked(Api.get)
      .mockResolvedValueOnce({ preferences: initialPreferences })
      .mockResolvedValueOnce({ preferences: initialPreferences });

    render(<WorkPreferencesSettings currentUser={user as any} onUpdateUser={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('List View')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('List View'));
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Work preferences were not confirmed by the server');
    });

    expect(toast.success).not.toHaveBeenCalledWith('Work preferences saved successfully');
  });

  it('shows success only after work preferences are confirmed by read-back', async () => {
    vi.mocked(Api.get)
      .mockResolvedValueOnce({ preferences: initialPreferences })
      .mockResolvedValueOnce({
        preferences: { ...initialPreferences, defaultProjectView: 'list' },
      });

    render(<WorkPreferencesSettings currentUser={user as any} onUpdateUser={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('List View')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('List View'));
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Work preferences saved successfully');
    });
  });
});
