import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AIPulseCore } from '../../../src/components/MyWork/Home/AIPulseCore';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) =>
      ({
        'myWork.radar.topMove': 'Top move',
        'myWork.radar.worthNoticing': 'Worth noticing',
        'myWork.radar.talkToAI': 'Talk to AI',
        'myWork.radar.openExecution': 'Open execution',
      })[key] ||
      fallback ||
      key,
    i18n: { language: 'en' },
  }),
}));

vi.mock('../../../src/components/MyWork/Home/HomeBlockShell', () => ({
  HomeBlockShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('AIPulseCore actionable priority', () => {
  it('elevates the first focus item as the top move and keeps remaining items in the queue', () => {
    const onAction = vi.fn();

    render(
      <AIPulseCore
        onAction={onAction}
        block={{
          id: 'aiPulseCore',
          title: 'AI Pulse Core',
          subtitle: 'What matters most right now',
          accent: 'ai',
          size: 'hero',
          priorityWeight: 100,
          relevanceScore: 100,
          freshnessScore: 100,
          ctaIntents: [],
          payload: {
            greeting: 'Good morning',
            headline: 'One move matters most today.',
            summary: 'Execution needs one clean priority.',
            insight: 'Convert the strongest move into an executable lane.',
            weekProgress: 50,
            pulseScore: 88,
            focusItems: [
              {
                id: 'task-1',
                type: 'task',
                title: 'Finalize the steering brief',
                meta: 'Due today',
                priority: 'high',
              },
              {
                id: 'decision-1',
                type: 'decision',
                title: 'Approve the rollout sequence',
                meta: 'Two stakeholders waiting',
                priority: 'high',
              },
              {
                id: 'idea-1',
                type: 'idea',
                title: 'Shape the new AI lane',
                meta: 'Needs owner',
                priority: 'medium',
              },
            ],
          },
        }}
      />
    );

    expect(screen.getByText('Top move')).toBeInTheDocument();
    expect(screen.getByText('Finalize the steering brief')).toBeInTheDocument();
    expect(screen.getByText('Q2')).toBeInTheDocument();
    expect(screen.getByText('Q3')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Finalize the steering brief/i }));
    expect(onAction).toHaveBeenCalledWith({
      type: 'open',
      target: 'task',
      id: 'task-1',
    });
  });
});
