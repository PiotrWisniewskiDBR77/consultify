/**
 * @vitest-environment jsdom
 *
 * `FinanceCommentsPanel` — Pakiet AP-CLIENT (Gate J), priorytet #3.
 *
 * Dowodzi: (1) flaga OFF → `null`, ZERO wywołań klienta, (2) flaga ON → ładuje
 * komentarze/checklist/blocking banner, (3) dodanie komentarza woła
 * `createFinanceComment` z realnym body/isBlocking/mentions i odświeża listę,
 * (4) resolve/reopen wołają właściwy endpoint po id.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockListFinanceComments = vi.fn();
const mockListFinanceReviewChecklist = vi.fn();
const mockHasUnresolvedBlocking = vi.fn();
const mockCreateFinanceComment = vi.fn();
const mockResolveFinanceComment = vi.fn();
const mockReopenFinanceComment = vi.fn();
const mockAddChecklistItem = vi.fn();
const mockCheckChecklistItem = vi.fn();
const mockUncheckChecklistItem = vi.fn();

vi.mock('@/services/api/financeV2.api', () => ({
  listFinanceComments: (...args: unknown[]) => mockListFinanceComments(...args),
  listFinanceReviewChecklist: (...args: unknown[]) => mockListFinanceReviewChecklist(...args),
  hasUnresolvedBlockingFinanceComments: (...args: unknown[]) => mockHasUnresolvedBlocking(...args),
  createFinanceComment: (...args: unknown[]) => mockCreateFinanceComment(...args),
  resolveFinanceComment: (...args: unknown[]) => mockResolveFinanceComment(...args),
  reopenFinanceComment: (...args: unknown[]) => mockReopenFinanceComment(...args),
  addFinanceReviewChecklistItem: (...args: unknown[]) => mockAddChecklistItem(...args),
  checkFinanceReviewChecklistItem: (...args: unknown[]) => mockCheckChecklistItem(...args),
  uncheckFinanceReviewChecklistItem: (...args: unknown[]) => mockUncheckChecklistItem(...args),
}));

import { FinanceCommentsPanel } from '../FinanceCommentsPanel';

const SAMPLE_COMMENT = {
  id: 'c-1',
  artifactId: 'art-1',
  businessVersionId: 'bv-1',
  anchor: null,
  authorId: 'u-1',
  body: 'Sprawdź linię COGS',
  mentions: ['u-2'],
  isBlocking: true,
  resolvedBy: null,
  resolvedAt: null,
  createdBy: 'u-1',
  createdAt: '2026-08-12T09:00:00.000Z',
  updatedAt: '2026-08-12T09:00:00.000Z',
};

const SAMPLE_CHECKLIST_ITEM = {
  id: 'item-1',
  businessVersionId: 'bv-1',
  item: 'Zweryfikuj sumy kontrolne',
  required: true,
  checkedBy: null,
  checkedAt: null,
  createdBy: 'u-1',
  createdAt: 't',
};

function mockLoadOnce(overrides: { comments?: any[]; checklist?: any[]; blocking?: boolean } = {}) {
  mockListFinanceComments.mockResolvedValueOnce(overrides.comments ?? [SAMPLE_COMMENT]);
  mockListFinanceReviewChecklist.mockResolvedValueOnce(overrides.checklist ?? [SAMPLE_CHECKLIST_ITEM]);
  mockHasUnresolvedBlocking.mockResolvedValueOnce({ hasUnresolvedBlockingComments: overrides.blocking ?? true });
}

beforeEach(() => {
  window.localStorage.clear();
  for (const m of [
    mockListFinanceComments,
    mockListFinanceReviewChecklist,
    mockHasUnresolvedBlocking,
    mockCreateFinanceComment,
    mockResolveFinanceComment,
    mockReopenFinanceComment,
    mockAddChecklistItem,
    mockCheckChecklistItem,
    mockUncheckChecklistItem,
  ]) {
    m.mockReset();
  }
});
afterEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
});

describe('FinanceCommentsPanel', () => {
  it('flaga domyślnie OFF → renderuje null, ZERO wywołań listFinanceComments', () => {
    const { container } = render(<FinanceCommentsPanel artifactId="art-1" businessVersionId="bv-1" />);
    expect(container.firstChild).toBeNull();
    expect(mockListFinanceComments).not.toHaveBeenCalled();
    expect(mockListFinanceReviewChecklist).not.toHaveBeenCalled();
    expect(mockHasUnresolvedBlocking).not.toHaveBeenCalled();
  });

  it('flaga ON → ładuje komentarze + checklist + banner blokujący', async () => {
    window.localStorage.setItem('consultify_feature_flags', JSON.stringify({ financeCommentsV1: true }));
    mockLoadOnce();
    render(<FinanceCommentsPanel artifactId="art-1" businessVersionId="bv-1" />);

    await waitFor(() => expect(screen.getByTestId('finance-comments-panel')).toBeInTheDocument());
    expect(mockListFinanceComments).toHaveBeenCalledWith({ businessVersionId: 'bv-1' });
    expect(mockListFinanceReviewChecklist).toHaveBeenCalledWith('bv-1');
    expect(mockHasUnresolvedBlocking).toHaveBeenCalledWith('bv-1');

    expect(screen.getByTestId('comments-blocking-banner')).toBeInTheDocument();
    expect(screen.getByText('Sprawdź linię COGS')).toBeInTheDocument();
    expect(screen.getByText('Zweryfikuj sumy kontrolne')).toBeInTheDocument();
  });

  it('dodanie komentarza woła createFinanceComment z body/isBlocking/mentions i odświeża listę', async () => {
    window.localStorage.setItem('consultify_feature_flags', JSON.stringify({ financeCommentsV1: true }));
    mockLoadOnce({ comments: [] });
    render(<FinanceCommentsPanel artifactId="art-1" businessVersionId="bv-1" />);
    await waitFor(() => expect(screen.getByTestId('finance-comments-panel')).toBeInTheDocument());

    fireEvent.change(screen.getByTestId('comment-composer-body'), { target: { value: 'Nowy komentarz' } });
    fireEvent.change(screen.getByTestId('comment-composer-mentions'), { target: { value: 'u-5, u-6' } });
    fireEvent.click(screen.getByTestId('comment-composer-blocking'));

    mockCreateFinanceComment.mockResolvedValueOnce(SAMPLE_COMMENT);
    mockLoadOnce({ comments: [SAMPLE_COMMENT] });
    fireEvent.click(screen.getByTestId('comment-composer-submit'));

    await waitFor(() => expect(mockCreateFinanceComment).toHaveBeenCalledTimes(1));
    expect(mockCreateFinanceComment).toHaveBeenCalledWith({
      artifactId: 'art-1',
      businessVersionId: 'bv-1',
      body: 'Nowy komentarz',
      isBlocking: true,
      mentions: ['u-5', 'u-6'],
    });
    await waitFor(() => expect(mockListFinanceComments).toHaveBeenCalledTimes(2)); // initial + odświeżenie
  });

  it('resolve/reopen wołają właściwy endpoint po commentId', async () => {
    window.localStorage.setItem('consultify_feature_flags', JSON.stringify({ financeCommentsV1: true }));
    mockLoadOnce();
    render(<FinanceCommentsPanel artifactId="art-1" businessVersionId="bv-1" />);
    await waitFor(() => expect(screen.getByTestId('finance-comments-panel')).toBeInTheDocument());

    mockResolveFinanceComment.mockResolvedValueOnce({ ...SAMPLE_COMMENT, resolvedAt: 't' });
    mockLoadOnce({ comments: [{ ...SAMPLE_COMMENT, resolvedAt: 't' }], blocking: false });
    fireEvent.click(screen.getByText('Oznacz jako rozwiązany'));
    await waitFor(() => expect(mockResolveFinanceComment).toHaveBeenCalledWith('c-1'));

    await waitFor(() => expect(screen.getByText('Otwórz ponownie')).toBeInTheDocument());
    mockReopenFinanceComment.mockResolvedValueOnce(SAMPLE_COMMENT);
    mockLoadOnce();
    fireEvent.click(screen.getByText('Otwórz ponownie'));
    await waitFor(() => expect(mockReopenFinanceComment).toHaveBeenCalledWith('c-1'));
  });

  it('KONTROLA NEGATYWNA: błąd 404 przy ładowaniu → honest-UI komunikat, nie surowy kod', async () => {
    window.localStorage.setItem('consultify_feature_flags', JSON.stringify({ financeCommentsV1: true }));
    const err = new Error('not found') as Error & { status?: number; data?: unknown };
    err.status = 404;
    err.data = { code: 'NOT_FOUND' };
    mockListFinanceComments.mockRejectedValueOnce(err);
    mockListFinanceReviewChecklist.mockResolvedValueOnce([]);
    mockHasUnresolvedBlocking.mockResolvedValueOnce({ hasUnresolvedBlockingComments: false });

    render(<FinanceCommentsPanel artifactId="art-1" businessVersionId="bv-1" />);
    await waitFor(() => expect(screen.getByTestId('comments-panel-error')).toBeInTheDocument());
    expect(screen.queryByText('NOT_FOUND')).not.toBeInTheDocument();
  });
});
