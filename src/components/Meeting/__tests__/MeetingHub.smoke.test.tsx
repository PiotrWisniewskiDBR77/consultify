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
    t: (k: string, opts?: string | { defaultValue?: string }) =>
      (typeof opts === 'string' ? opts : opts?.defaultValue) ?? k,
    i18n: { language: 'en' },
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

const { getMeetingsMock, getBriefMock, listNotesMock, generateNotesMock, decideNoteMock } =
  vi.hoisted(() => ({
    getMeetingsMock: vi.fn(),
    getBriefMock: vi.fn(),
    listNotesMock: vi.fn(),
    generateNotesMock: vi.fn(),
    decideNoteMock: vi.fn(),
  }));

vi.mock('@/services/api', () => ({
  Api: {
    getMeetings: getMeetingsMock,
    getAIOperatorMeetingBrief: getBriefMock,
    listMeetingNotes: listNotesMock,
    generateMeetingNotes: generateNotesMock,
    decideMeetingNote: decideNoteMock,
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
    listNotesMock.mockReset();
    listNotesMock.mockResolvedValue({ notes: [] });
    generateNotesMock.mockReset();
    decideNoteMock.mockReset();
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

  // M21 — operator brief must degrade honestly: a real fetch failure (non-404)
  // surfaces a retryable error, NOT the same "no brief" message as a legit empty.
  it('shows an honest error + retry when the operator brief fetch fails (500)', async () => {
    getMeetingsMock.mockResolvedValue({ meetings: [meeting] });
    const err: any = new Error('boom');
    err.status = 500;
    getBriefMock.mockRejectedValue(err);
    render(<MeetingHub />);

    fireEvent.dblClick(await screen.findByText('Quarterly Review'));

    expect(await screen.findByText('Could not load the operator brief.')).toBeTruthy();
    const retry = await screen.findByText('Retry');
    expect(retry).toBeTruthy();

    // Retry re-issues the request (recovers to a real brief).
    getBriefMock.mockResolvedValueOnce({ meetingId: 'meeting-1', prepSummary: 'Focus.' });
    fireEvent.click(retry);
    await waitFor(() => expect(screen.getByText('Focus.')).toBeTruthy());
  });

  // M12-F04 (2026-08-05): this test used to assert the opposite — that a 404
  // brief is "an honest empty". That premise does not hold in the real runtime:
  //   • `aiOperatorService.getMeetingBrief` is deterministic and returns a brief
  //     for every meeting that exists, and we only fetch for a meeting we are
  //     already rendering — so "this meeting has no brief yet" is not a state
  //     the backend can be in;
  //   • `/api/ai-operator/*` sits behind `requireInternalToolsAccess`, which
  //     answers 404 {"error":"Not found"} for every org outside the internal
  //     allowlist — so in practice a 404 IS an access denial.
  // Rendering that as a calm "no brief" is silent emptiness, which this module
  // is not allowed to have. A 404 must now surface as a retryable error.
  it('surfaces a 404 brief as an honest error, not as silent emptiness', async () => {
    getMeetingsMock.mockResolvedValue({ meetings: [meeting] });
    const err: any = new Error('Not found');
    err.status = 404;
    getBriefMock.mockRejectedValue(err);
    render(<MeetingHub />);

    fireEvent.dblClick(await screen.findByText('Quarterly Review'));

    expect(await screen.findByText('Could not load the operator brief.')).toBeTruthy();
    expect(await screen.findByText('Retry')).toBeTruthy();
    expect(screen.queryByText('meeting.noOperatorBrief')).toBeNull();
  });

  it('loads governed proposals and exposes recording OFF', async () => {
    getMeetingsMock.mockResolvedValue({ meetings: [meeting] });
    listNotesMock.mockResolvedValue({
      notes: [
        {
          id: 'note-1',
          source: 'heuristic',
          summary: 'Draft minutes',
          keyPoints: [],
          decisions: [],
          actionItems: [],
          status: 'proposed',
          proposalId: 'proposal-1',
          transcriptHash: 'abcdef0123456789',
        },
      ],
    });
    render(<MeetingHub />);
    fireEvent.dblClick(await screen.findByText('Quarterly Review'));
    fireEvent.click(await screen.findByRole('button', { name: /meeting\.aiNotes|AI Notes/i }));

    expect(await screen.findByText(/Recording and automatic transcription are OFF/i)).toBeTruthy();
    expect(await screen.findByText('Draft minutes')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Approve and materialize/i })).toBeTruthy();
  });

  it('fails closed when generation has no durable proposal', async () => {
    getMeetingsMock.mockResolvedValue({ meetings: [meeting] });
    generateNotesMock.mockResolvedValue({
      note: { summary: 'Ephemeral' },
      meetingNoteId: null,
      proposal: null,
    });
    render(<MeetingHub />);
    fireEvent.dblClick(await screen.findByText('Quarterly Review'));
    fireEvent.click(await screen.findByRole('button', { name: /meeting\.aiNotes|AI Notes/i }));
    fireEvent.change(await screen.findByLabelText(/Meeting source text/i), {
      target: { value: 'Manual meeting text' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: /meeting\.generateNotes2|Generate notes/i })
    );

    await waitFor(() => expect(generateNotesMock).toHaveBeenCalled());
    expect(screen.queryByText('Ephemeral')).toBeNull();
  });

  it('materializes a proposal only after an explicit decision', async () => {
    getMeetingsMock.mockResolvedValue({ meetings: [meeting] });
    const note = {
      id: 'note-1',
      source: 'heuristic',
      summary: 'Draft minutes',
      keyPoints: [],
      decisions: [],
      actionItems: [],
      status: 'proposed',
      proposalId: 'proposal-1',
    };
    listNotesMock.mockResolvedValue({ notes: [note] });
    decideNoteMock.mockResolvedValue({
      note: { ...note, status: 'approved' },
      proposal: { proposalId: 'proposal-1', state: 'materialized' },
      receipt: { receiptId: 'receipt-1' },
    });
    render(<MeetingHub />);
    fireEvent.dblClick(await screen.findByText('Quarterly Review'));
    fireEvent.click(await screen.findByRole('button', { name: /meeting\.aiNotes|AI Notes/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Approve and materialize/i }));

    await waitFor(() =>
      expect(decideNoteMock).toHaveBeenCalledWith('meeting-1', 'note-1', { action: 'approve' })
    );
    expect(await screen.findByText(/receipt-1/)).toBeTruthy();
  });
});
