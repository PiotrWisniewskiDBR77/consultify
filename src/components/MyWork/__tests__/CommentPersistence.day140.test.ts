import { describe, expect, it, vi } from 'vitest';

import { addDecisionCommentAndReload, deleteDecisionCommentAndReload } from '../DecisionDetailView';
import { addTaskCommentAndReload, deleteTaskCommentAndReload } from '../TaskDetailView';

describe('Day 140 comment persistence callers', () => {
  it('task add waits for POST and replaces UI data with the server readback', async () => {
    const order: string[] = [];
    const api = {
      addTaskComment: vi.fn(async () => {
        order.push('post');
      }),
      getTaskComments: vi.fn(async () => {
        order.push('get');
        return [
          {
            id: 'task-comment-1',
            content: 'server task comment',
            userId: 'user-1',
            user: { id: 'user-1', firstName: 'Ada', lastName: 'Nowak' },
            createdAt: '2026-08-30T08:00:00.000Z',
          },
        ];
      }),
    };

    const comments = await addTaskCommentAndReload(api as any, 'task/1', 'new comment');

    expect(order).toEqual(['post', 'get']);
    expect(api.addTaskComment).toHaveBeenCalledWith('task/1', 'new comment');
    expect(comments).toEqual([
      expect.objectContaining({
        id: 'task-comment-1',
        content: 'server task comment',
        authorId: 'user-1',
        authorName: 'Ada Nowak',
      }),
    ]);
  });

  it('task delete waits for DELETE and returns the server readback', async () => {
    const api = {
      deleteTaskComment: vi.fn(async () => undefined),
      getTaskComments: vi.fn(async () => []),
    };
    await expect(deleteTaskCommentAndReload(api as any, 'task-1', 'comment-1')).resolves.toEqual(
      []
    );
    expect(api.deleteTaskComment).toHaveBeenCalledWith('task-1', 'comment-1');
    expect(api.getTaskComments).toHaveBeenCalledWith('task-1');
  });

  it('task add rejects and never reports readback when the server rejects', async () => {
    const api = {
      addTaskComment: vi.fn(async () => {
        throw new Error('server rejected');
      }),
      getTaskComments: vi.fn(async () => []),
    };
    await expect(addTaskCommentAndReload(api as any, 'task-1', 'x')).rejects.toThrow(
      'server rejected'
    );
    expect(api.getTaskComments).not.toHaveBeenCalled();
  });

  it('decision add POSTs body then replaces UI data with aggregate server readback', async () => {
    const api = {
      post: vi.fn(async () => ({ data: {} })),
      get: vi.fn(async () => ({
        data: {
          comments: [
            {
              id: 'decision-comment-1',
              body: 'server decision comment',
              authorId: 'user-2',
              createdAt: '2026-08-30T08:00:00.000Z',
            },
          ],
        },
      })),
      delete: vi.fn(async () => ({ data: {} })),
    };

    const comments = await addDecisionCommentAndReload(api as any, 'decision/1', 'new comment');

    expect(api.post).toHaveBeenCalledWith('/decisions/decision%2F1/comments', {
      body: 'new comment',
    });
    expect(api.get).toHaveBeenCalledWith('/decisions/decision%2F1/detail');
    expect(comments[0]).toEqual(
      expect.objectContaining({
        id: 'decision-comment-1',
        content: 'server decision comment',
        authorId: 'user-2',
      })
    );
  });

  it('decision delete waits for DELETE and returns aggregate server readback', async () => {
    const api = {
      post: vi.fn(),
      delete: vi.fn(async () => ({ data: { success: true } })),
      get: vi.fn(async () => ({ data: { comments: [] } })),
    };
    await expect(
      deleteDecisionCommentAndReload(api as any, 'decision-1', 'comment/1')
    ).resolves.toEqual([]);
    expect(api.delete).toHaveBeenCalledWith('/decisions/decision-1/comments/comment%2F1');
    expect(api.get).toHaveBeenCalledWith('/decisions/decision-1/detail');
  });
});
