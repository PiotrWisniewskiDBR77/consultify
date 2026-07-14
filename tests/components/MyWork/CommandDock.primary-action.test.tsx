import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CommandDock } from '../../../src/components/MyWork/Home/CommandDock';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    // Mirror i18next: t(key, fallbackString) OR t(key, { defaultValue }).
    t: (key: string, opt?: unknown) => {
      if (typeof opt === 'string') return opt;
      if (opt && typeof opt === 'object' && 'defaultValue' in (opt as Record<string, unknown>)) {
        return String((opt as { defaultValue: unknown }).defaultValue);
      }
      return key;
    },
    i18n: { language: 'en', changeLanguage: () => {} },
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

vi.mock('../../../src/components/MyWork/Home/HomeBlockShell', () => ({
  HomeBlockShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('CommandDock primary action', () => {
  it('shows one dominant primary action above quick-create shortcuts', () => {
    const onAction = vi.fn();

    render(
      <CommandDock
        onAction={onAction}
        block={{
          id: 'commandDock',
          title: 'Command Dock',
          subtitle: 'Immediate moves',
          accent: 'neutral',
          size: 'hero',
          priorityWeight: 100,
          relevanceScore: 100,
          freshnessScore: 100,
          ctaIntents: [],
          payload: {
            primaryAction: {
              title: 'Finalize the steering brief',
              helper: 'Due today',
              action: {
                type: 'open',
                target: 'task',
                id: 'task-1',
              },
            },
            actions: [
              { id: 'new-idea', label: '+ Idea', kind: 'create', target: 'idea' },
              { id: 'ask-ai', label: 'Ask AI', kind: 'chat', starterPrompt: 'Help me prioritize.' },
            ],
            runtimeSummary: {
              inboxPending: 3,
              inboxAtRisk: 1,
              recentOutputs: 2,
              reviewSharedOutputs: 1,
            },
          },
        }}
      />
    );

    expect(screen.getByText('Do this now')).toBeInTheDocument();
    expect(screen.getByText('Finalize the steering brief')).toBeInTheDocument();
    expect(screen.getByText('Shortcuts and quick create')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Open$/i }));
    expect(onAction).toHaveBeenCalledWith({
      type: 'open',
      target: 'task',
      id: 'task-1',
    });

    fireEvent.click(screen.getByRole('button', { name: /\+ Idea/i }));
    expect(onAction).toHaveBeenCalledWith({
      type: 'create',
      target: 'idea',
    });
  });
});
