/**
 * @vitest-environment jsdom
 *
 * Klient `financeV2.api.ts` §AP-CLIENT Comments (Gate J) — `comments.routes.ts`, 17
 * endpointów (10 komentarzy + 7 review-checklist). Ten sam wzorzec mockowania `fetchWithRetry`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../baseClient', async () => {
  const actual = await vi.importActual<typeof import('../baseClient')>('../baseClient');
  return {
    ...actual,
    fetchWithRetry: vi.fn(),
    getHeaders: () => ({ 'Content-Type': 'application/json', Authorization: 'Bearer test-token' }),
  };
});

import { fetchWithRetry } from '../baseClient';
import {
  addFinanceReviewChecklistItem,
  allFinanceReviewChecklistRequiredChecked,
  assignFinanceComment,
  checkFinanceReviewChecklistItem,
  createFinanceComment,
  getFinanceComment,
  getFinanceCommentAssignment,
  getFinanceReviewChecklistChangedCells,
  hasUnresolvedBlockingFinanceComments,
  listFinanceCommentMentionsForMe,
  listFinanceComments,
  listFinanceReviewChecklist,
  reopenFinanceComment,
  resolveFinanceComment,
  searchFinanceCommentsByCell,
  setFinanceReviewChecklistItemRequired,
  uncheckFinanceReviewChecklistItem,
} from '../financeV2.api';

const mockedFetch = fetchWithRetry as unknown as ReturnType<typeof vi.fn>;

function jsonResponse(status: number, body: unknown): Response {
  const response = {
    ok: status >= 200 && status < 300,
    status,
    statusText: '',
    url: 'https://example.test/mock',
    json: async () => body,
    text: async () => JSON.stringify(body),
    clone(): Response {
      return response as unknown as Response;
    },
  };
  return response as unknown as Response;
}

beforeEach(() => {
  mockedFetch.mockReset();
});
afterEach(() => {
  vi.clearAllMocks();
});

const SAMPLE_COMMENT = {
  id: 'c-1',
  artifactId: 'art-1',
  businessVersionId: 'bv-1',
  anchor: null,
  authorId: 'u-1',
  body: 'Sprawdź tę linię',
  mentions: [],
  isBlocking: false,
  resolvedBy: null,
  resolvedAt: null,
  createdBy: 'u-1',
  createdAt: 't',
  updatedAt: 't',
};

describe('financeV2.api — AP-CLIENT Comments (komentarze)', () => {
  it('createFinanceComment → POST /comments z anchor=null gdy nie podano', async () => {
    mockedFetch.mockResolvedValueOnce(jsonResponse(201, { data: SAMPLE_COMMENT, meta: {} }));
    const result = await createFinanceComment({
      artifactId: 'art-1',
      businessVersionId: 'bv-1',
      body: 'Sprawdź tę linię',
    });
    const [url, init] = mockedFetch.mock.calls[0];
    expect(url).toBe('/api/v8/finance-v2/comments');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toMatchObject({
      artifactId: 'art-1',
      businessVersionId: 'bv-1',
      anchor: null,
    });
    expect(result.id).toBe('c-1');
  });

  it('resolveFinanceComment / reopenFinanceComment → POST na odpowiedni URL, bez body', async () => {
    mockedFetch.mockResolvedValueOnce(
      jsonResponse(200, { data: { ...SAMPLE_COMMENT, resolvedBy: 'u-2' }, meta: {} })
    );
    await resolveFinanceComment('c-1');
    expect(mockedFetch.mock.calls[0][0]).toBe('/api/v8/finance-v2/comments/c-1/resolve');

    mockedFetch.mockResolvedValueOnce(jsonResponse(200, { data: SAMPLE_COMMENT, meta: {} }));
    await reopenFinanceComment('c-1');
    expect(mockedFetch.mock.calls[1][0]).toBe('/api/v8/finance-v2/comments/c-1/reopen');
  });

  it('assignFinanceComment → POST /comments/:id/assign z assigneeId/dueDate', async () => {
    mockedFetch.mockResolvedValueOnce(
      jsonResponse(201, {
        data: {
          id: 'a-1',
          commentId: 'c-1',
          assigneeId: 'u-9',
          dueDate: '2026-09-01',
          assignedBy: 'u-1',
          assignedAt: 't',
        },
        meta: {},
      })
    );
    const result = await assignFinanceComment('c-1', { assigneeId: 'u-9', dueDate: '2026-09-01' });
    const [url, init] = mockedFetch.mock.calls[0];
    expect(url).toBe('/api/v8/finance-v2/comments/c-1/assign');
    expect(JSON.parse(init.body)).toEqual({ assigneeId: 'u-9', dueDate: '2026-09-01' });
    expect(result.assigneeId).toBe('u-9');
  });

  it('getFinanceCommentAssignment → GET, null gdy brak przypisania', async () => {
    mockedFetch.mockResolvedValueOnce(jsonResponse(200, { data: null, meta: {} }));
    const result = await getFinanceCommentAssignment('c-1');
    expect(result).toBeNull();
  });

  it('getFinanceComment → 404 NOT_FOUND trafia do .data.code', async () => {
    mockedFetch.mockResolvedValueOnce(
      jsonResponse(404, { error: 'Comment not found', code: 'NOT_FOUND' })
    );
    await expect(getFinanceComment('missing')).rejects.toMatchObject({
      status: 404,
      data: { code: 'NOT_FOUND' },
    });
  });

  it('listFinanceComments → GET /comments?artifactId=... z opcjami unresolvedOnly/blockingOnly', async () => {
    mockedFetch.mockResolvedValueOnce(jsonResponse(200, { data: [SAMPLE_COMMENT], meta: {} }));
    const result = await listFinanceComments({
      artifactId: 'art-1',
      unresolvedOnly: true,
      blockingOnly: true,
    });
    const [url] = mockedFetch.mock.calls[0];
    expect(url).toContain('artifactId=art-1');
    expect(url).toContain('unresolvedOnly=true');
    expect(url).toContain('blockingOnly=true');
    expect(result).toHaveLength(1);
  });

  it('searchFinanceCommentsByCell → POST /comments/search-by-cell z businessVersionId + cellRef', async () => {
    mockedFetch.mockResolvedValueOnce(jsonResponse(200, { data: [SAMPLE_COMMENT], meta: {} }));
    const cellRef = {
      organizationId: 'org-1',
      businessVersionId: 'bv-1',
      tableName: 'finance_stmt_lines',
    };
    await searchFinanceCommentsByCell('bv-1', cellRef);
    const [url, init] = mockedFetch.mock.calls[0];
    expect(url).toBe('/api/v8/finance-v2/comments/search-by-cell');
    expect(JSON.parse(init.body)).toEqual({ businessVersionId: 'bv-1', cellRef });
  });

  it('listFinanceCommentMentionsForMe → GET /comments/mentions/me, żadnego query param userId', async () => {
    mockedFetch.mockResolvedValueOnce(jsonResponse(200, { data: [], meta: {} }));
    await listFinanceCommentMentionsForMe();
    const [url] = mockedFetch.mock.calls[0];
    expect(url).toBe('http://localhost:3000/api/v8/finance-v2/comments/mentions/me');
  });

  it('hasUnresolvedBlockingFinanceComments → GET /versions/:id/has-unresolved-blocking-comments', async () => {
    mockedFetch.mockResolvedValueOnce(
      jsonResponse(200, { data: { hasUnresolvedBlockingComments: true }, meta: {} })
    );
    const result = await hasUnresolvedBlockingFinanceComments('bv-1');
    expect(result.hasUnresolvedBlockingComments).toBe(true);
  });
});

describe('financeV2.api — AP-CLIENT Comments (review checklist / maker-checker)', () => {
  const SAMPLE_ITEM = {
    id: 'item-1',
    businessVersionId: 'bv-1',
    item: 'Zweryfikuj sumy kontrolne',
    required: true,
    checkedBy: null,
    checkedAt: null,
    createdBy: 'u-1',
    createdAt: 't',
  };

  it('addFinanceReviewChecklistItem → POST /review-checklist', async () => {
    mockedFetch.mockResolvedValueOnce(jsonResponse(201, { data: SAMPLE_ITEM, meta: {} }));
    const result = await addFinanceReviewChecklistItem({
      businessVersionId: 'bv-1',
      item: 'Zweryfikuj sumy kontrolne',
      required: true,
    });
    const [url, init] = mockedFetch.mock.calls[0];
    expect(url).toBe('/api/v8/finance-v2/review-checklist');
    expect(JSON.parse(init.body)).toEqual({
      businessVersionId: 'bv-1',
      item: 'Zweryfikuj sumy kontrolne',
      required: true,
    });
    expect(result.id).toBe('item-1');
  });

  it('checkFinanceReviewChecklistItem / uncheckFinanceReviewChecklistItem → POST na :id/check|uncheck', async () => {
    mockedFetch.mockResolvedValueOnce(
      jsonResponse(200, { data: { ...SAMPLE_ITEM, checkedBy: 'u-2' }, meta: {} })
    );
    await checkFinanceReviewChecklistItem('item-1');
    expect(mockedFetch.mock.calls[0][0]).toBe('/api/v8/finance-v2/review-checklist/item-1/check');

    mockedFetch.mockResolvedValueOnce(jsonResponse(200, { data: SAMPLE_ITEM, meta: {} }));
    await uncheckFinanceReviewChecklistItem('item-1');
    expect(mockedFetch.mock.calls[1][0]).toBe('/api/v8/finance-v2/review-checklist/item-1/uncheck');
  });

  it('setFinanceReviewChecklistItemRequired → POST :id/required z {required}', async () => {
    mockedFetch.mockResolvedValueOnce(
      jsonResponse(200, { data: { ...SAMPLE_ITEM, required: false }, meta: {} })
    );
    await setFinanceReviewChecklistItemRequired('item-1', false);
    const [url, init] = mockedFetch.mock.calls[0];
    expect(url).toBe('/api/v8/finance-v2/review-checklist/item-1/required');
    expect(JSON.parse(init.body)).toEqual({ required: false });
  });

  it('listFinanceReviewChecklist → GET /review-checklist/:businessVersionId', async () => {
    mockedFetch.mockResolvedValueOnce(jsonResponse(200, { data: [SAMPLE_ITEM], meta: {} }));
    const result = await listFinanceReviewChecklist('bv-1');
    expect(result).toHaveLength(1);
  });

  it('allFinanceReviewChecklistRequiredChecked → GET .../all-required-checked', async () => {
    mockedFetch.mockResolvedValueOnce(
      jsonResponse(200, { data: { allRequiredChecked: false }, meta: {} })
    );
    const result = await allFinanceReviewChecklistRequiredChecked('bv-1');
    expect(result.allRequiredChecked).toBe(false);
  });

  it('getFinanceReviewChecklistChangedCells → GET .../changed-cells z opcjonalnym previousApprovedBusinessVersionId', async () => {
    mockedFetch.mockResolvedValueOnce(
      jsonResponse(200, {
        data: { hasPreviousApproved: true, previousBusinessVersionId: 'bv-0', changedCells: [] },
        meta: {},
      })
    );
    await getFinanceReviewChecklistChangedCells('bv-1', 'bv-0');
    const [url] = mockedFetch.mock.calls[0];
    expect(url).toContain('previousApprovedBusinessVersionId=bv-0');
  });

  it('KONTROLA NEGATYWNA: 409 na check() (już checked) trafia do .data.code, nie do .code', async () => {
    mockedFetch.mockResolvedValueOnce(
      jsonResponse(409, { error: 'already checked', code: 'ALREADY_CHECKED' })
    );
    let caught: any;
    try {
      await checkFinanceReviewChecklistItem('item-1');
    } catch (e) {
      caught = e;
    }
    expect(caught.status).toBe(409);
    expect(caught.code).toBeUndefined();
    expect(caught.data.code).toBe('ALREADY_CHECKED');
  });
});
