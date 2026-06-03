/**
 * @vitest-environment jsdom
 *
 * Smoke test for the Meeting module hub (Module 13). Verifies the hub mounts,
 * loads meetings from the API, renders the list with the new follow-up/decision
 * data, and that the create modal opens. The full CRUD surface is covered by the
 * server route/service tests; this guards the mounted React shell against
 * regressions now that `/meeting` renders `MeetingHub` (was a coming-soon stub).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_k: string, fallback?: string) => fallback ?? _k,
    i18n: { language: 'en' },
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

const { getMeetingsMock, getBriefMock } = vi.hoisted(() => ({
  getMeetingsMock: vi.fn(),
  getBriefMock: vi.fn(),
}));

vi.mock('@/services/api', () => ({
  Api: {
    getMeetings: getMeetingsMock,
    getAIOperatorMeetingBrief: getBriefMock,
  },
}));

import { MeetingHub } from '../MeetingHub';

const meeting = {
  id: 'meeting-1',
  title: 'Quarterly Review',
  startAt: '2026-07-01T10:00:00.000Z',
  endAt: '2026-07-01T11:00:00.000Z',
  location: 'Zoom',
  attendees: ['Alice', 'Bob'],
  preRead: [],
  agenda: ['Status'],
  decisions: [],
  followUps: [{ id: 'fu-1', title: 'Recap', owner: 'Bob', status: 'open' }],
  status: 'scheduled',
};

describe('MeetingHub (smoke)', () => {
  beforeEach(() => {
    getMeetingsMock.mockReset();
    getBriefMock.mockReset();
    getBriefMock.mockResolvedValue(null);
  });

  it('loads and renders meetings from the API', async () => {
    getMeetingsMock.mockResolvedValue({ meetings: [meeting] });
    render(<MeetingHub />);

    expect(await screen.findByText('Quarterly Review')).toBeTruthy();
    expect(getMeetingsMock).toHaveBeenCalled();
  });

  it('renders the empty state when there are no meetings', async () => {
    getMeetingsMock.mockResolvedValue({ meetings: [] });
    render(<MeetingHub />);

    expect(await screen.findByText('No meetings yet')).toBeTruthy();
  });

  it('opens the create-meeting modal from the primary CTA', async () => {
    getMeetingsMock.mockResolvedValue({ meetings: [] });
    render(<MeetingHub />);

    fireEvent.click(await screen.findByText('New meeting'));
    // The modal subtitle is unique (the "Create meeting" label appears on both
    // the header and the footer button), so assert on it to confirm the modal opened.
    await waitFor(() =>
      expect(screen.getByText('Agenda + pre-read + follow-up workspace')).toBeTruthy()
    );
  });
});
