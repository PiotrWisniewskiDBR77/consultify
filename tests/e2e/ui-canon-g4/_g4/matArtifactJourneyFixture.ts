import type { APIRequestContext, Page } from '@playwright/test';

export const API = process.env.E2E_API_URL || 'http://127.0.0.1:3001';
export const SUPPORT_KEY = process.env.TEST_SUPPORT_KEY || 'local-test-support-key-change-me';

export type SignedFixture = {
  runId: string;
  organizationId: string;
  userId: string;
  token: string;
};

export const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

export async function bootstrap(request: APIRequestContext, runId: string): Promise<SignedFixture> {
  const response = await request.post(`${API}/api/test-support/bootstrap`, {
    headers: { 'x-test-support-key': SUPPORT_KEY },
    data: { runId, role: 'ADMIN' },
  });
  if (response.status() !== 200)
    throw new Error(`bootstrap ${response.status()}: ${await response.text()}`);
  return (await response.json()) as SignedFixture;
}

export async function cleanup(request: APIRequestContext, fixture: SignedFixture) {
  const response = await request.post(`${API}/api/test-support/cleanup`, {
    headers: { 'x-test-support-key': SUPPORT_KEY },
    data: { runId: fixture.runId, organizationId: fixture.organizationId },
  });
  if (!response.ok()) throw new Error(`cleanup ${response.status()}: ${await response.text()}`);
}

export async function signInPage(page: Page, fixture: SignedFixture) {
  await page.addInitScript(({ token, userId, organizationId }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify({ id: userId, organizationId, role: 'ADMIN' }));
  }, fixture);
}

export async function expectJsonOk(response: Awaited<ReturnType<APIRequestContext['get']>>) {
  if (!response.ok()) throw new Error(`${response.status()}: ${await response.text()}`);
  return response.json();
}
