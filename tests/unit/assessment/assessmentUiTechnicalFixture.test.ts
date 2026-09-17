import { describe, expect, it, vi } from 'vitest';

import { prepareForReview, type AssessmentPersona } from '../../e2e/assessment/_helpers/assessmentUiTechnicalFixture';

function response(body: unknown = {}, status = 200) {
  return {
    ok: () => status >= 200 && status < 300,
    status: () => status,
    text: () => Promise.resolve(JSON.stringify(body)),
    json: () => Promise.resolve(body),
  };
}

describe('assessment technical fixture DRD event writes', () => {
  it('reads the current session version immediately before every event write', async () => {
    const versions = [4, 5, 6];
    const calls: Array<{ kind: 'get' | 'post'; url: string; data?: Record<string, unknown> }> = [];
    const request = {
      get: vi.fn(async (url: string) => {
        calls.push({ kind: 'get', url });
        return response({ session: { version: versions.shift() } });
      }),
      post: vi.fn(async (url: string, options?: { data?: Record<string, unknown> }) => {
        calls.push({ kind: 'post', url, data: options?.data });
        return response();
      }),
    };
    const owner: AssessmentPersona = {
      runId: 'asm-ui-1',
      organizationId: 'org-1',
      userId: 'owner-1',
      token: 'token',
      role: 'ADMIN',
    };

    await prepareForReview(request as never, owner, 'session-1');

    const eventCalls = calls.filter((call) => call.url.endsWith('/events'));
    expect(eventCalls.map((call) => call.data?.expectedVersion)).toEqual([4, 5, 6]);
    for (const eventCall of eventCalls) {
      const index = calls.indexOf(eventCall);
      expect(calls[index - 1]).toMatchObject({
        kind: 'get',
        url: expect.stringContaining('/api/method/sessions/session-1'),
      });
    }
  });
});
