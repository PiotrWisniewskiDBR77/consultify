/**
 * @vitest-environment jsdom
 *
 * Pakiet I (Dostępność), wymaganie #7 — `FinanceCommentsPanel.tsx`. PRZED
 * naprawą: dodanie komentarza / resolve / reopen / checklist zapisywały się
 * w tle bez żadnego sygnału dla czytnika ekranu poza przerysowaniem listy.
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
  mentions: [] as string[],
  isBlocking: false,
  resolvedBy: null,
  resolvedAt: null,
  createdBy: 'u-1',
  createdAt: 't',
  updatedAt: 't',
};

function mockLoadOnce(overrides: { comments?: unknown[]; checklist?: unknown[]; blocking?: boolean } = {}) {
  mockListFinanceComments.mockResolvedValueOnce(overrides.comments ?? [SAMPLE_COMMENT]);
  mockListFinanceReviewChecklist.mockResolvedValueOnce(overrides.checklist ?? []);
  mockHasUnresolvedBlocking.mockResolvedValueOnce({ hasUnresolvedBlockingComments: overrides.blocking ?? false });
}

beforeEach(() => {
  window.localStorage.clear();
  for (const m of [mockListFinanceComments, mockListFinanceReviewChecklist, mockHasUnresolvedBlocking, mockResolveFinanceComment, mockReopenFinanceComment]) {
    m.mockReset();
  }
  window.localStorage.setItem('consultify_feature_flags', JSON.stringify({ financeCommentsV1: true }));
});
afterEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
});

describe('FinanceCommentsPanel — ogłaszanie stanów dynamicznych (a11y, Pakiet I)', () => {
  it('podczas ładowania jest zamontowany role="status" z tekstem "Ładowanie komentarzy…"', async () => {
    mockListFinanceComments.mockReturnValueOnce(new Promise(() => {}));
    mockListFinanceReviewChecklist.mockReturnValueOnce(new Promise(() => {}));
    mockHasUnresolvedBlocking.mockReturnValueOnce(new Promise(() => {}));
    render(<FinanceCommentsPanel artifactId="art-1" businessVersionId="bv-1" />);
    const status = await screen.findByTestId('finance-status-announcer');
    expect(status).toHaveAttribute('role', 'status');
    expect(status).toHaveTextContent('Ładowanie komentarzy…');
  });

  it('po "Oznacz jako rozwiązany" role="status" ogłasza to działanie (nie tylko widoczna lista)', async () => {
    mockLoadOnce();
    mockResolveFinanceComment.mockResolvedValueOnce(undefined);
    mockLoadOnce({ comments: [{ ...SAMPLE_COMMENT, resolvedAt: 't', resolvedBy: 'u-2' }] });
    render(<FinanceCommentsPanel artifactId="art-1" businessVersionId="bv-1" />);
    await screen.findByTestId('finance-comments-panel');

    fireEvent.click(screen.getByText('Oznacz jako rozwiązany'));

    await waitFor(() => expect(screen.getByTestId('finance-status-announcer')).toHaveTextContent('Komentarz oznaczony jako rozwiązany.'));
  });

  it('błąd ładowania → role="status" priority=assertive', async () => {
    mockListFinanceComments.mockRejectedValueOnce(new Error('boom'));
    render(<FinanceCommentsPanel artifactId="art-1" businessVersionId="bv-1" />);
    await waitFor(() => {
      const status = screen.getByTestId('finance-status-announcer');
      expect(status).toHaveAttribute('aria-live', 'assertive');
    });
  });

  it('KONTROLA NEGATYWNA: przy fladze OFF brak jakiegokolwiek role="status" (panel nie renderuje nic)', () => {
    window.localStorage.clear();
    const { container } = render(<FinanceCommentsPanel artifactId="art-1" businessVersionId="bv-1" />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId('finance-status-announcer')).not.toBeInTheDocument();
  });
});

describe('FinanceCommentsPanel — dostępne nazwy / kontrast (a11y, Pakiet I)', () => {
  it('pozycja checklisty ma programowo powiązaną etykietę (axe: "label" critical, PRZED naprawą)', async () => {
    mockLoadOnce({ checklist: [{ id: 'item-1', businessVersionId: 'bv-1', item: 'Zweryfikuj sumy kontrolne', required: true, checkedBy: null, checkedAt: null, createdBy: 'u-1', createdAt: 't' }] });
    render(<FinanceCommentsPanel artifactId="art-1" businessVersionId="bv-1" />);
    await screen.findByTestId('finance-comments-panel');
    expect(screen.getByLabelText('Zweryfikuj sumy kontrolne')).toBeInTheDocument();
  });

  it('"Oznacz jako rozwiązany"/"Blokujący" NIE używają surowego `text-c-focus`/`text-c-danger` (za mały kontrast — axe, PRZED naprawą)', async () => {
    mockLoadOnce({ comments: [{ ...SAMPLE_COMMENT, isBlocking: true }] });
    render(<FinanceCommentsPanel artifactId="art-1" businessVersionId="bv-1" />);
    await screen.findByTestId('finance-comments-panel');
    const resolveButton = screen.getByText('Oznacz jako rozwiązany');
    expect(resolveButton.className).not.toMatch(/text-c-focus(?!-solid)\b/);
    expect(resolveButton.className).toMatch(/text-c-focus-solid/);
    const blockingBadge = screen.getByText('Blokujący');
    expect(blockingBadge.className).not.toMatch(/\btext-c-danger\b/);
    expect(blockingBadge.className).toMatch(/text-red-800/);
  });
});
