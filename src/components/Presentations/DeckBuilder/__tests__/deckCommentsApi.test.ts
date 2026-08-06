import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiMocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('@/services/api', () => ({ Api: apiMocks }));

import {
  addDeckComment,
  deleteDeckComment,
  listDeckComments,
  setDeckCommentResolved,
} from '../deckCommentsApi';

function apiResponse<T extends object>(payload: T): T {
  return new Proxy(payload, {
    get(target, property, receiver) {
      if (property === 'data') return target;
      return Reflect.get(target, property, receiver);
    },
  });
}

const comment = {
  id: 'comment-1',
  threadId: 'thread-1',
  deckId: 'deck-1',
  organizationId: 'org-1',
  slideId: null,
  anchor: { kind: 'deck' as const },
  author: 'user-1',
  body: 'Review note',
  resolved: false,
  createdAt: '2026-08-06T20:00:00.000Z',
  updatedAt: '2026-08-06T20:00:00.000Z',
};

describe('deckCommentsApi', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reads the server data envelope hidden by the shared Api proxy', async () => {
    const thread = {
      threadId: 'thread-1',
      deckId: 'deck-1',
      anchor: { kind: 'deck' as const },
      resolved: false,
      root: comment,
      replies: [],
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
    };
    const counts = { deckId: 'deck-1', totalOpen: 1, totalResolved: 0, perSlide: {} };
    apiMocks.get.mockResolvedValue(
      apiResponse({ success: true, data: { threads: [thread], counts } })
    );

    await expect(listDeckComments('deck-1')).resolves.toEqual({ threads: [thread], counts });
  });

  it('returns comment mutations from the hidden server envelope', async () => {
    const response = apiResponse({ success: true, data: { comment } });
    apiMocks.post.mockResolvedValue(response);
    apiMocks.patch.mockResolvedValue(response);
    apiMocks.delete.mockResolvedValue(response);

    await expect(addDeckComment('deck-1', { body: comment.body })).resolves.toEqual(comment);
    await expect(setDeckCommentResolved('deck-1', comment.id, true)).resolves.toEqual(comment);
    await expect(deleteDeckComment('deck-1', comment.id)).resolves.toEqual(comment);
  });
});
