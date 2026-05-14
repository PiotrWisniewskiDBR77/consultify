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
    clearChatHistory: vi.fn(async () => ({ success: true })),
    exportChatHistory: vi.fn(async () => new Blob(['{}'], { type: 'application/json' })),
  },
}));

describe('AIPreferencesModule history tab', () => {
  it('renders canonical ChatHistorySettings actions in history tab', async () => {
    render(
      <AIPreferencesModule
        initialTab="history"
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

    expect(await screen.findByRole('button', { name: /Export History/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Clear All History/i })).toBeInTheDocument();
    expect(screen.queryByText('Save Chat History')).not.toBeInTheDocument();
  });
});
