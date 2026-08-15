import { describe, expect, it } from 'vitest';

import {
  selectVisibleToolSessions,
  TOOL_SESSIONS_PAGE_LIMIT,
} from '../toolSessionVisibility';

describe('tool session visibility contract', () => {
  it('keeps approved sessions in the Sessions dataset', () => {
    const sessions = [
      { id: 'draft-1', status: 'DRAFT' },
      { id: 'review-1', status: 'PENDING_REVIEW' },
      { id: 'approved-1', status: 'APPROVED' },
    ];

    expect(selectVisibleToolSessions(sessions).map((session) => session.id)).toEqual([
      'draft-1',
      'review-1',
      'approved-1',
    ]);
  });

  it('uses the endpoint hard cap so the hub does not silently stop at 50 rows', () => {
    expect(TOOL_SESSIONS_PAGE_LIMIT).toBe(100);
  });
});
