import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { addTaskCommentAndReload } from '../TaskDetailView';

const taskDetailSource = fs.readFileSync(path.resolve(__dirname, '../TaskDetailView.tsx'), 'utf8');

describe('Day 222 AI task comment persistence', () => {
  it('routes the generated comment through POST and the server readback', async () => {
    const generateAIComment = taskDetailSource.slice(
      taskDetailSource.indexOf('const generateAIComment = async () => {'),
      taskDetailSource.indexOf('// ── AI: propozycja składu RACI')
    );

    expect(generateAIComment).toContain(
      'setComments(await addTaskCommentAndReload(Api, taskId, generatedComment));'
    );
    expect(generateAIComment).not.toContain(
      'setComments((prev) => [...prev, newComment]);'
    );
  });

  it('persists before replacing local state with the GET readback', async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    const order: string[] = [];
    const api = {
      addTaskComment: vi.fn(async () => {
        order.push('post');
      }),
      getTaskComments: vi.fn(async () => {
        order.push('get');
        return [
          {
            id: 'persisted-ai-comment',
            content: 'Generated next step',
            userId: 'signed-in-user',
            user: { id: 'signed-in-user', firstName: 'Piotr', lastName: 'Test' },
            createdAt: '2026-09-01T06:00:00.000Z',
          },
        ];
      }),
    };

    const comments = await addTaskCommentAndReload(
      api as any,
      'task-222',
      'Generated next step'
    );

    expect(order).toEqual(['post', 'get']);
    expect(api.addTaskComment).toHaveBeenCalledWith('task-222', 'Generated next step');
    expect(comments[0]).toEqual(
      expect.objectContaining({
        id: 'persisted-ai-comment',
        content: 'Generated next step',
        authorId: 'signed-in-user',
        authorName: 'Piotr Test',
      })
    );
  });

  it('does not perform a readback when persistence rejects', async () => {
    const api = {
      addTaskComment: vi.fn(async () => {
        throw new Error('write rejected');
      }),
      getTaskComments: vi.fn(async () => []),
    };

    await expect(
      addTaskCommentAndReload(api as any, 'task-222', 'Generated next step')
    ).rejects.toThrow('write rejected');
    expect(api.getTaskComments).not.toHaveBeenCalled();
  });
});
