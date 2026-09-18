/**
 * @vitest-environment jsdom
 *
 * MTG-2a (DEC-607) — WIRING test for `MeetingProtocolViewer`.
 *
 * Mounted on the REAL component inside the REAL `StandardArtifactShell` (only
 * the network client `meetingProtocolClient` is mocked), so what is measured is
 * the viewer's wiring to the three protocol routes and its W109b gating — not a
 * mirror. Per the cost-rule "Testy wpięcia, nie obecności", each assertion is on
 * the CALL ARGUMENT of the client function (the meetingId / errata note that
 * actually go over the wire), not on decorative text.
 *
 * W109b invariant under test: the working preview is ALWAYS a live draft
 * (`status === 'draft'`), so the Approve primary vs. the errata panel MUST be
 * gated on `publishedVersion` (has anything been frozen?), never on `status`.
 *
 * Mutations that MUST turn this RED (proven in the report):
 *   · gate the primary/errata on `status === 'approved'` instead of
 *     `publishedVersion != null` → since status is always 'draft', Approve shows
 *     even on a published protocol and the errata panel never appears;
 *   · call `approveMeetingProtocol()` with no/again-wrong meetingId → arg assert fails;
 *   · drop the errata-note argument (call with meetingId only) → arg assert fails;
 *   · remove the Approve primary slot → clicking finds no button.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => {
  const translate = (
    k: string,
    opts?: string | { defaultValue?: string; [key: string]: unknown },
    vars?: Record<string, unknown>
  ) => {
    const szablon = (typeof opts === 'string' ? opts : opts?.defaultValue) ?? k;
    const params = { ...(typeof opts === 'object' && opts ? opts : {}), ...(vars || {}) };
    return szablon.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, name: string) => String(params[name] ?? ''));
  };
  return {
    useTranslation: () => ({
      t: translate,
      i18n: { language: 'en', getFixedT: () => translate, changeLanguage: async () => undefined },
    }),
    Trans: ({ children, i18nKey }: any) => children || i18nKey,
    I18nextProvider: ({ children }: any) => children,
    Translation: ({ children }: any) => children({ t: translate, i18n: {} }),
    initReactI18next: { type: '3rdParty', init: () => undefined },
  };
});

const { fetchMock, approveMock, errataMock, exportMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
  approveMock: vi.fn(),
  errataMock: vi.fn(),
  exportMock: vi.fn(),
}));

// Keep the real `blockOf` + types; replace only the network calls.
vi.mock('../meetingProtocolClient', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    fetchMeetingProtocolPreview: fetchMock,
    approveMeetingProtocol: approveMock,
    createMeetingProtocolErrata: errataMock,
    exportMeetingProtocolDocx: exportMock,
  };
});

import { MeetingProtocolViewer } from '../MeetingProtocolViewer';

const MEETING_ID = 'meeting-1';

function makePreview(overrides: Record<string, unknown> = {}) {
  return {
    id: null,
    version: '1.0',
    // W109b: the working view is ALWAYS a live draft — even after publication.
    status: 'draft',
    content: {
      meetingId: MEETING_ID,
      generatedAt: '2026-07-01T12:00:00.000Z',
      blocks: [
        {
          kind: 'meta',
          title: 'Quarterly Review',
          startAt: '2026-07-01T10:00:00.000Z',
          endAt: '2026-07-01T11:00:00.000Z',
          timezone: null,
          location: 'Zoom',
          meetingType: 'internal',
          lifecycleState: 'scheduled',
        },
      ],
    },
    publishedVersion: null,
    approvedByName: null,
    approvedAt: null,
    errataNote: '',
    persisted: false,
    ...overrides,
  };
}

describe('MeetingProtocolViewer — approve / errata wiring (W109b)', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    approveMock.mockReset();
    errataMock.mockReset();
    exportMock.mockReset();
    approveMock.mockResolvedValue({ id: 'p1', version: '1.0', status: 'approved' });
    errataMock.mockResolvedValue({ id: 'p2', version: '1.1', status: 'approved' });
    exportMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('unpublished: shows Approve and clicking it calls approveMeetingProtocol with the meetingId', async () => {
    fetchMock.mockResolvedValue(makePreview({ publishedVersion: null }));
    render(<MeetingProtocolViewer meetingId={MEETING_ID} onClose={() => {}} />);

    const approve = await screen.findByRole('button', { name: /Approve/i });
    // No errata panel before anything is frozen.
    expect(screen.queryByRole('button', { name: /Create errata version/i })).toBeNull();

    fireEvent.click(approve);
    await waitFor(() => expect(approveMock).toHaveBeenCalledTimes(1));
    expect(approveMock).toHaveBeenCalledWith(MEETING_ID);
    expect(errataMock).not.toHaveBeenCalled();
  });

  it('published (status still draft): hides Approve and exposes the errata panel', async () => {
    fetchMock.mockResolvedValue(
      makePreview({ publishedVersion: '1.0', version: '1.1', approvedByName: 'Constance Chair' })
    );
    render(<MeetingProtocolViewer meetingId={MEETING_ID} onClose={() => {}} />);

    await waitFor(() => expect(screen.queryByTestId('meeting-protocol-document')).toBeInTheDocument());
    // W109b: a published protocol still has status 'draft' in the working view,
    // yet the Approve primary must be gone (gated on publishedVersion, not status).
    expect(screen.queryByRole('button', { name: /^Approve$/i })).toBeNull();
  });

  it('published: typing a note and clicking Create errata calls createMeetingProtocolErrata(meetingId, note)', async () => {
    fetchMock.mockResolvedValue(makePreview({ publishedVersion: '1.0', version: '1.1' }));
    render(<MeetingProtocolViewer meetingId={MEETING_ID} onClose={() => {}} />);

    const note = (await screen.findByLabelText(/Errata note/i)) as HTMLTextAreaElement;
    fireEvent.change(note, { target: { value: 'Fix the recorded decision wording' } });

    const errataButton = await screen.findByRole('button', { name: /Create errata version/i });
    fireEvent.click(errataButton);

    await waitFor(() => expect(errataMock).toHaveBeenCalledTimes(1));
    expect(errataMock).toHaveBeenCalledWith(MEETING_ID, 'Fix the recorded decision wording');
    expect(approveMock).not.toHaveBeenCalled();
  });

  it('published without manage rights: neither Approve nor the errata action is wired', async () => {
    fetchMock.mockResolvedValue(makePreview({ publishedVersion: '1.0', version: '1.1' }));
    render(<MeetingProtocolViewer meetingId={MEETING_ID} canManage={false} onClose={() => {}} />);

    await waitFor(() => expect(screen.queryByTestId('meeting-protocol-document')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /^Approve$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Create errata version/i })).toBeNull();
  });

  // MTG-2a v2 (Wpis 131): the viewer labels each block's SOURCE from the block's
  // `source` value. MUTATION: swapping the viewer's source ternary (register↔note)
  // turns this RED.
  it('labels the SOURCE per block: approved note for decisions, register for actions', async () => {
    fetchMock.mockResolvedValue(
      makePreview({
        content: {
          meetingId: MEETING_ID,
          generatedAt: '2026-07-01T12:00:00.000Z',
          blocks: [
            {
              kind: 'meta',
              title: 'Quarterly Review',
              startAt: '2026-07-01T10:00:00.000Z',
              endAt: '2026-07-01T11:00:00.000Z',
              timezone: null,
              location: 'Zoom',
              meetingType: 'internal',
              lifecycleState: 'scheduled',
            },
            {
              kind: 'decisions',
              source: 'approved_note',
              items: [
                {
                  statement: 'Escalate the delay',
                  rationale: '',
                  owner: null,
                  decisionType: null,
                  impact: null,
                  rejectedAlternative: null,
                  decidedBy: null,
                  decidedAt: null,
                  status: 'recorded',
                },
              ],
            },
            {
              kind: 'actions',
              source: 'register',
              items: [
                {
                  title: 'Send the summary',
                  owner: null,
                  dueAt: null,
                  status: 'open',
                  taskId: null,
                  taskStatus: null,
                  agendaItemTitle: null,
                },
              ],
            },
          ],
        },
      })
    );
    render(<MeetingProtocolViewer meetingId={MEETING_ID} onClose={() => {}} />);

    await waitFor(() =>
      expect(screen.queryByTestId('meeting-protocol-document')).toBeInTheDocument()
    );
    expect(screen.getByTestId('decisions-source').textContent).toBe('From approved note');
    expect(screen.getByTestId('actions-source').textContent).toBe('From follow-ups register');
  });

  // MTG-2c (PLAN.md:272 „protokół z eksportem"): the Actions panel exports the
  // live protocol as DOCX. Assertions are on the CALL ARGUMENT of the client
  // function (the meetingId that goes over the wire), not on decorative text.
  // MUTATIONS that MUST turn these RED: remove the button's onClick (no call);
  // call exportMeetingProtocolDocx() without/with a wrong meetingId (arg assert);
  // remove the Export button from the actions slot (findByRole times out).
  it('draft: clicking Export DOCX calls exportMeetingProtocolDocx with the meetingId', async () => {
    fetchMock.mockResolvedValue(makePreview({ publishedVersion: null }));
    render(<MeetingProtocolViewer meetingId={MEETING_ID} onClose={() => {}} />);

    const exportButton = await screen.findByRole('button', { name: /Export DOCX/i });
    fireEvent.click(exportButton);

    await waitFor(() => expect(exportMock).toHaveBeenCalledTimes(1));
    expect(exportMock).toHaveBeenCalledWith(MEETING_ID);
    expect(approveMock).not.toHaveBeenCalled();
  });

  it('published without manage rights: Export DOCX is still wired (read-level action)', async () => {
    fetchMock.mockResolvedValue(makePreview({ publishedVersion: '1.0', version: '1.1' }));
    render(<MeetingProtocolViewer meetingId={MEETING_ID} canManage={false} onClose={() => {}} />);

    const exportButton = await screen.findByRole('button', { name: /Export DOCX/i });
    fireEvent.click(exportButton);

    await waitFor(() => expect(exportMock).toHaveBeenCalledTimes(1));
    expect(exportMock).toHaveBeenCalledWith(MEETING_ID);
  });

  it('load failure: no Export DOCX button (the panel stays closed)', async () => {
    fetchMock.mockRejectedValue(Object.assign(new Error('HTTP_404'), { status: 404 }));
    render(<MeetingProtocolViewer meetingId={MEETING_ID} onClose={() => {}} />);

    await waitFor(() =>
      expect(screen.queryByText(/No protocol is available/i)).toBeInTheDocument()
    );
    expect(screen.queryByRole('button', { name: /Export DOCX/i })).toBeNull();
    expect(exportMock).not.toHaveBeenCalled();
  });
});
