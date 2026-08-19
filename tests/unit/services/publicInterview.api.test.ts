import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  PublicInterviewApiError,
  publicInterviewApi,
} from '../../../src/services/api/publicInterview';

describe('publicInterviewApi', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('loads through the token-only credential-free public contract', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          distributionId: 'distribution-1',
          sessionId: 'session-1',
          status: 'opened',
          anonymityMode: 'anonymous',
          expiresAt: '2026-08-18T00:00:00.000Z',
          questions: [],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    await publicInterviewApi.load('invite/secret');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/interview-v4/public/distributions/invite%2Fsecret',
      expect.objectContaining({ credentials: 'omit', cache: 'no-store' })
    );
    expect(JSON.stringify(fetchMock.mock.calls[0])).not.toContain('organizationId');
    expect(JSON.stringify(fetchMock.mock.calls[0])).not.toContain('userId');
  });

  it('preserves 410 revoke/expiry semantics', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'DISTRIBUTION_REVOKED' }), {
          status: 410,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );

    await expect(publicInterviewApi.load('revoked')).rejects.toEqual(
      expect.objectContaining<Partial<PublicInterviewApiError>>({
        code: 'DISTRIBUTION_REVOKED',
        status: 410,
      })
    );
  });

  it('sends only answer content, CAS and idempotency to the scoped question URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ updatedAt: '2026-08-17T12:00:00.000Z', replayed: false }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await publicInterviewApi.answer('token', 'question/1', {
      answerText: 'Answer',
      contextNote: null,
      expectedUpdatedAt: '2026-08-17T11:00:00.000Z',
      idempotencyKey: 'respondent-question-1-key',
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/interview-v4/public/distributions/token/answers/question%2F1');
    expect(init.credentials).toBe('omit');
    expect(JSON.parse(String(init.body))).toEqual({
      answerText: 'Answer',
      contextNote: null,
      expectedUpdatedAt: '2026-08-17T11:00:00.000Z',
      idempotencyKey: 'respondent-question-1-key',
    });
  });

  it('fails closed when a successful answer response has no exact readback timestamp', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ replayed: false }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );

    await expect(
      publicInterviewApi.answer('token', 'question-1', {
        answerText: 'Answer',
        contextNote: null,
        expectedUpdatedAt: '2026-08-17T11:00:00.000Z',
        idempotencyKey: 'stable-key',
      })
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE', status: 502 });
  });

  it('does not report completion unless the server confirms completed true', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ completed: false }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );

    await expect(publicInterviewApi.complete('token')).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
      status: 502,
    });
  });
});
