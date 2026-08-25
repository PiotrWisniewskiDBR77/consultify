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

const { searchParamsMock, setSearchParamsMock, navigateMock } = vi.hoisted(() => ({
  searchParamsMock: new URLSearchParams(),
  setSearchParamsMock: vi.fn(),
  navigateMock: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: string | { defaultValue?: string }) =>
      (typeof opts === 'string' ? opts : opts?.defaultValue) ?? k,
    i18n: { language: 'en' },
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
  useSearchParams: () => [searchParamsMock, setSearchParamsMock],
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

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector: (state: any) => unknown) =>
    selector({ currentUser: { id: 'admin-1', role: 'ADMIN', isAuthenticated: true } }),
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
    searchParamsMock.delete('meetingId');
    setSearchParamsMock.mockReset();
    navigateMock.mockReset();
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
  // Retry lives behind the AI hint strip's kebab ("Regenerate"), not a bare
  // "Retry" label — that literal button belonged to the now-deleted inline
  // MeetingDetailView, dead since the object route took over "opening" a
  // meeting; the live retry path is StandardPreview's `ai.onRegenerate`.
  it('shows an honest error + retry when the operator brief fetch fails (500)', async () => {
    getMeetingsMock.mockResolvedValue({ meetings: [meeting] });
    const err: any = new Error('boom');
    err.status = 500;
    getBriefMock.mockRejectedValue(err);
    render(<MeetingHub />);

    fireEvent.click(await screen.findByText('Quarterly Review'));

    expect(await screen.findByText('Could not load the operator brief.')).toBeTruthy();
    // Scope to the AI hint strip specifically — the preview pane also has a
    // Details-section kebab (Copy/Export) and the table rows have their own,
    // so an unscoped `.lucide-ellipsis-vertical` query is ambiguous.
    const aiBlock = screen.getByText('AI', { selector: 'span' }).closest('.py-1') as HTMLElement;
    const kebab = aiBlock.querySelector('.lucide-ellipsis-vertical')?.closest('button');
    expect(kebab).toBeTruthy();
    fireEvent.click(kebab as HTMLElement);
    const regenerate = await screen.findByText('sharedComponents.previewAIHintStrip.regenerate');

    // Retry re-issues the request (recovers to a real brief).
    getBriefMock.mockResolvedValueOnce({ meetingId: 'meeting-1', prepSummary: 'Focus.' });
    fireEvent.click(regenerate);
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

    fireEvent.click(await screen.findByText('Quarterly Review'));

    expect(await screen.findByText('Could not load the operator brief.')).toBeTruthy();
    const aiBlock = screen.getByText('AI', { selector: 'span' }).closest('.py-1') as HTMLElement;
    const kebab = aiBlock.querySelector('.lucide-ellipsis-vertical')?.closest('button');
    expect(kebab).toBeTruthy();
    fireEvent.click(kebab as HTMLElement);
    expect(
      await screen.findByText('sharedComponents.previewAIHintStrip.regenerate')
    ).toBeTruthy();
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
    fireEvent.click(await screen.findByText('Quarterly Review'));
    fireEvent.click(await screen.findByRole('button', { name: /meeting\.aiNotes|AI Notes/i }));

    expect(await screen.findByText(/Recording and automatic transcription are OFF/i)).toBeTruthy();
    expect(screen.getByLabelText(/Meeting source text/i)).toBeTruthy();
    expect(document.querySelector('[data-meeting-capture-policy="manual-text-only"]')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /record|transcrib|upload audio/i })).toBeNull();
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
    fireEvent.click(await screen.findByText('Quarterly Review'));
    fireEvent.click(await screen.findByRole('button', { name: /meeting\.aiNotes|AI Notes/i }));
    fireEvent.change(await screen.findByLabelText(/Meeting source text/i), {
      target: { value: 'Manual meeting text' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: /meeting\.generateNotes2|Generate notes/i })
    );

    await waitFor(() => expect(generateNotesMock).toHaveBeenCalled());
    const firstCommand = generateNotesMock.mock.calls[0][1];
    expect(firstCommand).toMatchObject({
      transcript: 'Manual meeting text',
      language: 'en',
      idempotencyKey: expect.any(String),
    });
    expect(screen.queryByText('Ephemeral')).toBeNull();

    fireEvent.click(
      screen.getByRole('button', { name: /meeting\.generateNotes2|Generate notes/i })
    );
    await waitFor(() => expect(generateNotesMock).toHaveBeenCalledTimes(2));
    expect(generateNotesMock.mock.calls[1][1].idempotencyKey).toBe(firstCommand.idempotencyKey);
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
    fireEvent.click(await screen.findByText('Quarterly Review'));
    fireEvent.click(await screen.findByRole('button', { name: /meeting\.aiNotes|AI Notes/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Approve and materialize/i }));

    await waitFor(() =>
      expect(decideNoteMock).toHaveBeenCalledWith('meeting-1', 'note-1', { action: 'approve' })
    );
    expect(await screen.findByText(/receipt-1/)).toBeTruthy();
  });

  it('shows the exact durable receipt after a cold proposal reload', async () => {
    getMeetingsMock.mockResolvedValue({ meetings: [meeting] });
    listNotesMock.mockResolvedValue({
      notes: [
        {
          id: 'note-cold',
          source: 'ai',
          summary: 'Approved minutes',
          keyPoints: [],
          decisions: [],
          actionItems: [],
          status: 'approved',
          proposalId: 'proposal-cold',
          proposalState: 'materialized',
          receiptId: 'receipt-cold-exact',
          targetKind: 'material',
          targetRecordId: 'note-cold',
        },
      ],
    });
    render(<MeetingHub />);
    fireEvent.click(await screen.findByText('Quarterly Review'));
    fireEvent.click(await screen.findByRole('button', { name: /meeting\.aiNotes|AI Notes/i }));
    expect(await screen.findByText(/receipt-cold-exact/)).toBeTruthy();
  });

  it('opens a meeting from the stable meetingId deep link', async () => {
    searchParamsMock.set('meetingId', 'meeting-1');
    getMeetingsMock.mockResolvedValue({ meetings: [meeting] });
    render(<MeetingHub />);

    expect(await screen.findByText('Operator brief')).toBeTruthy();
    expect(screen.getAllByText('Quarterly Review').length).toBeGreaterThan(0);
  });

  it('shows the durable rejection reason after cold proposal reload', async () => {
    getMeetingsMock.mockResolvedValue({ meetings: [meeting] });
    listNotesMock.mockResolvedValue({ notes: [{
      id: 'note-rejected', source: 'heuristic', summary: 'Rejected minutes', keyPoints: [], decisions: [], actionItems: [],
      status: 'rejected', proposalId: 'proposal-rejected', decisionReason: 'Readiness evidence is absent',
    }] });
    render(<MeetingHub />);
    fireEvent.click(await screen.findByText('Quarterly Review'));
    fireEvent.click(await screen.findByRole('button', { name: /meeting\.aiNotes|AI Notes/i }));
    expect(await screen.findByText(/Readiness evidence is absent/)).toBeTruthy();
  });

  it('reloads authoritative proposal state after a stale decision conflict', async () => {
    getMeetingsMock.mockResolvedValue({ meetings: [meeting] });
    const note = {
      id: 'note-stale',
      source: 'heuristic',
      summary: 'Concurrent proposal',
      keyPoints: [],
      decisions: [],
      actionItems: [],
      status: 'proposed',
      proposalId: 'proposal-stale',
    };
    listNotesMock
      .mockResolvedValueOnce({ notes: [note] })
      .mockResolvedValueOnce({ notes: [{ ...note, status: 'approved' }] });
    const conflict: any = new Error('already materialized');
    conflict.status = 409;
    decideNoteMock.mockRejectedValue(conflict);
    render(<MeetingHub />);
    fireEvent.click(await screen.findByText('Quarterly Review'));
    fireEvent.click(await screen.findByRole('button', { name: /meeting\.aiNotes|AI Notes/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Approve and materialize/i }));

    await waitFor(() => expect(listNotesMock).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('Materialized')).toBeTruthy();
  });

  // Stage 2 cleanup: the dead openDocuments/activeDocumentId document-tab
  // state and the MeetingDetailView branch it fed are gone. This guards the
  // one behavior that state used to gate — double-clicking a row still opens
  // the meeting, now straight to the canonical object route (no inline view,
  // no dependency on selection state).
  it('double-clicking a meeting row navigates to the object route (no regression from the dead-state cleanup)', async () => {
    getMeetingsMock.mockResolvedValue({ meetings: [meeting] });
    render(<MeetingHub />);

    fireEvent.dblClick(await screen.findByText('Quarterly Review'));

    expect(navigateMock).toHaveBeenCalledWith('/meetings/meeting-1');
  });
});
