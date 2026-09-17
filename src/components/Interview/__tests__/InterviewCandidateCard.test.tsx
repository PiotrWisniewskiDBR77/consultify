/**
 * ST-2 (DEC-540 / U-09), etap 1 — the in-module initiative candidate card.
 *
 * Proves the three graded behaviours from the order:
 *  - the card/inbox is visible ONLY to its author (+ADMIN);
 *  - "Approve as draft → Initiatives" calls the EXISTING accept endpoint;
 *  - MUTATION target: dropping the author filter makes the non-author test red.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const MOCK_USER = { id: 'u-author', role: 'MEMBER' };

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (sel: (s: any) => any) => sel({ currentUser: MOCK_USER }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key,
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('react-hot-toast', () => ({
  default: { success: (...a: unknown[]) => toastSuccess(...a), error: (...a: unknown[]) => toastError(...a) },
}));

import {
  canViewCandidate,
  isInterviewCandidate,
  InterviewCandidateCard,
  type InterviewCandidate,
} from '../InterviewCandidateCard';
import { InterviewCandidateInbox } from '../InterviewCandidateInbox';

const AUTHOR_CANDIDATE: InterviewCandidate = {
  id: 'cand-1',
  title: 'Packing line changeover',
  rationale: 'From interview insight',
  sourceType: 'interview_insight_finding',
  sourceId: 'ins-1',
  status: 'pending',
  createdBy: 'u-author',
};

const OTHER_CANDIDATE: InterviewCandidate = {
  id: 'cand-2',
  title: 'Someone else candidate',
  sourceType: 'interview_submission',
  status: 'pending',
  createdBy: 'u-other',
};

describe('canViewCandidate — author-only visibility (ST-2)', () => {
  it('shows a candidate to its author', () => {
    expect(canViewCandidate(AUTHOR_CANDIDATE, MOCK_USER)).toBe(true);
  });

  it('shows any candidate to an ADMIN and a SUPERADMIN', () => {
    expect(canViewCandidate(OTHER_CANDIDATE, { id: 'x', role: 'ADMIN' })).toBe(true);
    expect(canViewCandidate(OTHER_CANDIDATE, { id: 'x', role: 'SUPERADMIN' })).toBe(true);
  });

  it('does NOT show another user candidate to a plain member', () => {
    // MUTATION: removing the createdBy comparison in canViewCandidate turns this red.
    expect(canViewCandidate(OTHER_CANDIDATE, MOCK_USER)).toBe(false);
  });

  it('is fail-closed for a candidate with no recorded author (member)', () => {
    expect(canViewCandidate({ createdBy: null }, MOCK_USER)).toBe(false);
    expect(canViewCandidate({ createdBy: null }, { id: 'a', role: 'ADMIN' })).toBe(true);
  });

  it('is fail-closed for an anonymous viewer', () => {
    expect(canViewCandidate(AUTHOR_CANDIDATE, null)).toBe(false);
  });
});

describe('isInterviewCandidate — source filter', () => {
  it('accepts the interview source types only', () => {
    expect(isInterviewCandidate({ sourceType: 'interview_submission' })).toBe(true);
    expect(isInterviewCandidate({ sourceType: 'interview_insight_finding' })).toBe(true);
    expect(isInterviewCandidate({ sourceType: 'interview_insight' })).toBe(true);
    expect(isInterviewCandidate({ sourceType: 'assessment' })).toBe(false);
    expect(isInterviewCandidate({ sourceType: null })).toBe(false);
  });
});

describe('InterviewCandidateCard — render + action', () => {
  it('renders the title, summary and the approve action', () => {
    render(<InterviewCandidateCard candidate={AUTHOR_CANDIDATE} onApprove={vi.fn()} />);
    expect(screen.getByTestId('interview-candidate-card-name').textContent).toBe('Packing line changeover');
    expect(screen.getByTestId('interview-candidate-card-approve')).toBeTruthy();
  });

  it('calls onApprove with the candidate when the action is clicked', () => {
    const onApprove = vi.fn();
    render(<InterviewCandidateCard candidate={AUTHOR_CANDIDATE} onApprove={onApprove} />);
    fireEvent.click(screen.getByTestId('interview-candidate-card-approve'));
    expect(onApprove).toHaveBeenCalledWith(AUTHOR_CANDIDATE);
  });
});

describe('InterviewCandidateInbox — author-only list + existing accept endpoint', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    toastSuccess.mockClear();
    toastError.mockClear();
  });

  function mockFetch(listResponse: unknown, acceptResponse: unknown) {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).includes('/accept')) {
        return { ok: true, json: async () => acceptResponse } as unknown as Response;
      }
      return { ok: true, json: async () => listResponse } as unknown as Response;
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  it('renders ONLY the current user interview candidates', async () => {
    mockFetch({ candidates: [AUTHOR_CANDIDATE, OTHER_CANDIDATE] }, {});
    render(<InterviewCandidateInbox />);
    await waitFor(() => expect(screen.getByTestId('interview-candidate-card-name')).toBeTruthy());
    const names = screen.getAllByTestId('interview-candidate-card-name').map((n) => n.textContent);
    expect(names).toContain('Packing line changeover');
    // MUTATION: dropping canViewCandidate from the inbox filter turns this red.
    expect(names).not.toContain('Someone else candidate');
  });

  it('shows the empty state when there are no visible candidates', async () => {
    mockFetch({ candidates: [OTHER_CANDIDATE] }, {});
    render(<InterviewCandidateInbox />);
    await waitFor(() => expect(screen.getByTestId('interview-candidate-inbox-empty')).toBeTruthy());
  });

  it('approves as draft via POST /api/initiatives/candidates/:id/accept', async () => {
    const fetchMock = mockFetch(
      { candidates: [AUTHOR_CANDIDATE] },
      { accepted: true, receiptPersisted: true, initiativeId: 'init-9', filled: true }
    );
    const onApproved = vi.fn();
    render(<InterviewCandidateInbox onApproved={onApproved} />);
    await waitFor(() => expect(screen.getByTestId('interview-candidate-card-approve')).toBeTruthy());

    fireEvent.click(screen.getByTestId('interview-candidate-card-approve'));

    await waitFor(() => expect(onApproved).toHaveBeenCalledWith('init-9'));
    const acceptCall = fetchMock.mock.calls.find((c) => String(c[0]).includes('/accept'));
    expect(acceptCall).toBeTruthy();
    expect(String(acceptCall?.[0])).toContain('/initiatives/candidates/cand-1/accept');
    expect((acceptCall?.[1] as RequestInit).method).toBe('POST');
    expect(toastSuccess).toHaveBeenCalled();
    // the approved card disappears from the inbox
    await waitFor(() => expect(screen.queryByTestId('interview-candidate-card-approve')).toBeNull());
  });

  it('surfaces an error and keeps the card when the receipt is not persisted', async () => {
    mockFetch({ candidates: [AUTHOR_CANDIDATE] }, { accepted: true, receiptPersisted: false });
    render(<InterviewCandidateInbox />);
    await waitFor(() => expect(screen.getByTestId('interview-candidate-card-approve')).toBeTruthy());
    fireEvent.click(screen.getByTestId('interview-candidate-card-approve'));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(screen.getByTestId('interview-candidate-card-approve')).toBeTruthy();
  });
});
