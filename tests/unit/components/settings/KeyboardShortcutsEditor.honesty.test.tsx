import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import { KeyboardShortcutsEditor } from '@/components/settings/advanced/KeyboardShortcutsEditor';

vi.mock('@/components/shared/InfoButton', () => ({
  InfoButton: () => null,
}));

vi.mock('@/services/api', () => ({
  Api: {
    get: vi.fn(),
    put: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe('KeyboardShortcutsEditor honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(Api.get).mockRejectedValue(new Error('Shortcuts down'));
  });

  it('does not render failed shortcut loads as sample default shortcuts', async () => {
    render(
      <KeyboardShortcutsEditor
        currentUser={{ id: 'user-1', email: 'user@example.com' } as any}
        onUpdateUser={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Keyboard shortcuts unavailable')).toBeInTheDocument();
    });

    expect(screen.queryByText('Go to Dashboard')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save Changes/i })).toBeDisabled();
  });
});
