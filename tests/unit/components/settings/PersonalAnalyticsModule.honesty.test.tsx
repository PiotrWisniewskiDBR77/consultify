import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PersonalAnalyticsModule } from '@/components/settings/modules/PersonalAnalyticsModule';

vi.mock('@/components/shared/InfoButton', () => ({
  InfoButton: () => null,
}));

describe('PersonalAnalyticsModule honest UI', () => {
  it('does not render disconnected personal analytics as generated mock productivity data', async () => {
    render(
      <PersonalAnalyticsModule
        currentUser={{ id: 'user-1', email: 'user@example.com' } as any}
        onUpdateUser={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Personal analytics unavailable')).toBeInTheDocument();
    });

    expect(screen.queryByText('Tasks Completed')).not.toBeInTheDocument();
    expect(screen.queryByText('Activity Heatmap')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Export/i })).toBeDisabled();
  });
});
