import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ActivityLogCanvas } from '../ActivityLogCanvas';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) =>
      fallback ??
      ({
        'sharedComponents.activityLogCanvas.title': 'Activity log',
        'sharedComponents.activityLogCanvas.noEntries': 'No entries',
        'sharedComponents.activityLogCanvas.from': 'From',
        'sharedComponents.activityLogCanvas.to': 'To',
        'sharedComponents.activityLogCanvas.unknownDate': 'Unknown date',
        'sharedComponents.activityLogCanvas.systemActor': 'System',
      }[key] ?? key),
    i18n: { language: 'en' },
  }),
}));

const stats = { total: 1, edited: 1, escalations: 0, collaboration: 0 };
const typeMeta = () => ({ icon: <span>•</span>, label: 'Change', style: '' });

describe('ActivityLogCanvas compact list', () => {
  it('shows date, actor, and concise transition while hiding technical values on demand', () => {
    render(
      <ActivityLogCanvas
        variant="compact-list"
        entries={[
          {
            id: 'entry-1',
            type: 'status_change',
            description: 'Status changed',
            timestamp: '2026-08-23T08:30:00.000Z',
            userName: 'Anna Nowak',
            oldValue: 'todo',
            newValue: 'in_progress',
          },
        ]}
        stats={stats}
        typeMeta={typeMeta}
      />
    );

    expect(screen.getByText('Status changed')).toBeInTheDocument();
    expect(screen.getByText(/Anna Nowak/)).toBeInTheDocument();
    expect(document.querySelector('time')?.getAttribute('datetime')).toBe(
      '2026-08-23T08:30:00.000Z'
    );
    expect(screen.queryByText('Entries')).not.toBeInTheDocument();

    const details = screen.getByText('Details').closest('details');
    expect(details).not.toBeNull();
    expect(details).not.toHaveAttribute('open');
    fireEvent.click(screen.getByText('Details'));
    expect(details).toHaveAttribute('open');
    expect(screen.getByText('From: todo')).toBeInTheDocument();
    expect(screen.getByText('To: in_progress')).toBeInTheDocument();
  });

  it('does not expose a technical disclosure when no before/after values exist', () => {
    render(
      <ActivityLogCanvas
        variant="compact-list"
        entries={[
          {
            id: 'entry-2',
            type: 'comment',
            description: 'Comment added',
            timestamp: '2026-08-23T09:00:00.000Z',
            userName: 'Piotr',
          },
        ]}
        stats={stats}
        typeMeta={typeMeta}
      />
    );

    expect(screen.queryByText('Details')).not.toBeInTheDocument();
  });

  it('shows truthful fallbacks for a system event with an invalid timestamp', () => {
    render(
      <ActivityLogCanvas
        variant="compact-list"
        entries={[
          {
            id: 'entry-3',
            type: 'system',
            description: 'Automated transition',
            timestamp: 'not-a-date',
          },
        ]}
        stats={stats}
        typeMeta={typeMeta}
      />
    );

    expect(screen.getByText('Unknown date')).toBeInTheDocument();
    expect(screen.getByText(/System/)).toBeInTheDocument();
    expect(screen.queryByText(/Invalid Date/)).not.toBeInTheDocument();
  });
});

