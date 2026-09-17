import { describe, expect, it, vi } from 'vitest';

import { prepareForReview, type AssessmentPersona } from '../e2e/assessment/_helpers/assessmentUiTechnicalFixture';

const okResponse = (body: unknown = {}) => ({
  ok: () => true,
  status: () => 200,
  text: async () => JSON.stringify(body),
  json: async () => body,
});

describe('assessment UI technical fixture CAS contract', () => {
  it('reads the fresh session version before every event append', async () => {
    let version = 1;
    const eventVersions: number[] = [];
    const request = {
      get: vi.fn(async () => okResponse({ session: { version } })),
      post: vi.fn(async (url: string, options: { data: Record<string, unknown> }) => {
        if (url.endsWith('/roles')) return okResponse();
        if (url.endsWith('/transition')) {
          version += 1;
          return okResponse({ session: { version } });
        }
        if (url.endsWith('/events')) {
          eventVersions.push(options.data.expectedVersion as number);
          if (options.data.expectedVersion !== version) {
            return {
              ...okResponse({ code: 'VERSION_CONFLICT' }),
              ok: () => false,
              status: () => 409,
            };
          }
          version += 1;
          return okResponse({ event: { id: `event-${version}` } });
        }
        throw new Error(`unexpected fixture URL: ${url}`);
      }),
    };
    const owner: AssessmentPersona = {
      runId: 'asm-ui-1',
      organizationId: 'org-1',
      userId: 'user-1',
      token: 'token',
      role: 'ADMIN',
    };

    await prepareForReview(request as never, owner, 'session-1');

    expect(eventVersions).toEqual([3, 4, 5]);
    expect(version).toBe(6);
    expect(request.get).toHaveBeenCalledTimes(3);
  });
});
