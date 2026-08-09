import { expect, test, type APIRequestContext } from '@playwright/test';

const API_BASE_URL = process.env.E2E_API_URL || 'http://127.0.0.1:3001';
const TEST_SUPPORT_KEY = process.env.TEST_SUPPORT_KEY || 'local-test-support-key-change-me';

type TestIdentity = {
  runId: string;
  organizationId: string;
  userId: string;
  token: string;
};

const auth = (token: string) => ({
  Authorization: `Bearer ${token}`,
  'content-type': 'application/json',
});

async function bootstrap(request: APIRequestContext, runId: string): Promise<TestIdentity> {
  const response = await request.post(`${API_BASE_URL}/api/test-support/bootstrap`, {
    headers: { 'x-test-support-key': TEST_SUPPORT_KEY, 'content-type': 'application/json' },
    data: { runId, role: 'ADMIN' },
  });
  expect(response.ok(), await response.text()).toBe(true);
  return (await response.json()) as TestIdentity;
}

async function createReviewer(
  request: APIRequestContext,
  runId: string
): Promise<TestIdentity> {
  const response = await request.post(`${API_BASE_URL}/api/test-support/member`, {
    headers: { 'x-test-support-key': TEST_SUPPORT_KEY, 'content-type': 'application/json' },
    data: { runId, role: 'ADMIN' },
  });
  expect(response.status(), await response.text()).toBe(201);
  return (await response.json()) as TestIdentity;
}

async function createDeck(request: APIRequestContext, token: string): Promise<string> {
  const response = await request.post(`${API_BASE_URL}/api/presentations/decks`, {
    headers: auth(token),
    data: {
      title: `Approval realDB ${Date.now()}`,
      theme: 'modern',
      source: 'artifact-studio-approval-realdb',
      slides: [
        {
          type: 'content',
          content: { title: 'Decision', bullets: ['Independent approval evidence'] },
        },
      ],
    },
  });
  expect(response.ok(), await response.text()).toBe(true);
  return String(((await response.json()) as any)?.data?.id || '');
}

test.describe('Presentation approval governance on realDB [@module:presentations]', () => {
  test.setTimeout(180_000);

  test('requires an independent reviewer, persists approval and exposes audit events', async ({
    request,
  }) => {
    const runId = `ppt-approval-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const owner = await bootstrap(request, runId);

    try {
      const reviewer = await createReviewer(request, runId);
      expect(reviewer.organizationId).toBe(owner.organizationId);
      expect(reviewer.userId).not.toBe(owner.userId);

      const deckId = await createDeck(request, owner.token);
      expect(deckId).not.toBe('');

      const selfSubmit = await request.post(
        `${API_BASE_URL}/api/presentations/decks/${deckId}/approval/submit`,
        {
          headers: auth(owner.token),
          data: { assignedToUserId: owner.userId },
        }
      );
      expect(selfSubmit.status()).toBe(409);

      const submit = await request.post(
        `${API_BASE_URL}/api/presentations/decks/${deckId}/approval/submit`,
        {
          headers: auth(owner.token),
          data: { assignedToUserId: reviewer.userId },
        }
      );
      expect(submit.status(), await submit.text()).toBe(201);

      const ownerApproval = await request.post(
        `${API_BASE_URL}/api/presentations/decks/${deckId}/approval/approve`,
        { headers: auth(owner.token) }
      );
      expect(ownerApproval.status()).toBe(403);

      const reviewerApproval = await request.post(
        `${API_BASE_URL}/api/presentations/decks/${deckId}/approval/approve`,
        { headers: auth(reviewer.token) }
      );
      expect(reviewerApproval.ok(), await reviewerApproval.text()).toBe(true);

      const state = await request.get(
        `${API_BASE_URL}/api/presentations/decks/${deckId}/approval-state`,
        { headers: auth(owner.token) }
      );
      expect(state.ok(), await state.text()).toBe(true);
      expect((await state.json()).data).toMatchObject({
        state: 'approved',
        currentForVersion: true,
      });

      const audit = await request.get(
        `${API_BASE_URL}/api/presentations/decks/${deckId}/audit-log`,
        { headers: auth(owner.token) }
      );
      expect(audit.ok(), await audit.text()).toBe(true);
      const actions = ((await audit.json()).data?.events || []).map((event: any) => event.action);
      expect(actions).toContain('approval.submitted');
      expect(actions).toContain('approval.approved');
    } finally {
      const cleanup = await request.post(`${API_BASE_URL}/api/test-support/cleanup`, {
        headers: { 'x-test-support-key': TEST_SUPPORT_KEY, 'content-type': 'application/json' },
        data: { runId },
        // Real-DB cleanup removes the whole isolated organization graph. On a
        // schema with hundreds of FK-linked tables it can legitimately exceed
        // Playwright's default 15 s request timeout even though the product
        // assertions above have already completed.
        timeout: 150_000,
      });
      expect(cleanup.ok(), await cleanup.text()).toBe(true);
    }
  });
});
