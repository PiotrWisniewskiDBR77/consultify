import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import AIPreferencesModule from '@/views/settings/AIPreferencesModule';

vi.mock('@/components/shared/InfoButton', () => ({
  InfoButton: () => null,
}));

vi.mock('@/services/api', () => ({
  Api: {
    getAIMemory: vi.fn(async () => ({
      preferences: {
        enabled: true,
        retentionDays: 30,
        includeConversations: true,
        includePreferences: true,
        includeContext: true,
      },
    })),
    saveAIMemory: vi.fn(async () => ({ success: true })),
    clearAIMemoryData: vi.fn(async () => ({ success: true })),
  },
}));

describe('AIPreferencesModule memory tab', () => {
  it('renders canonical AIMemorySettings component in memory tab', async () => {
    render(
      <AIPreferencesModule
        initialTab="memory"
        currentUser={{
          id: 'u-1',
          email: 'u-1@test.com',
          firstName: 'U',
          lastName: 'One',
          role: 'admin',
        } as any}
        onUpdateUser={vi.fn()}
      />
    );

    expect(await screen.findByText('Memory & Context')).toBeInTheDocument();
    expect(screen.queryByText('AI Memory & Context')).not.toBeInTheDocument();
  });
});
