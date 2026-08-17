import fs from 'node:fs';
import path from 'node:path';

import type { APIRequestContext, Browser, BrowserContext } from '@playwright/test';

export type MywIdentity = {
  runId: string;
  organizationId: string;
  userId: string;
  token: string;
  role: 'MANAGER' | 'USER';
};

export async function createMember(
  request: APIRequestContext,
  runId: string,
  role: MywIdentity['role']
): Promise<MywIdentity> {
  const response = await request.post('/api/test-support/member', { data: { runId, role } });
  if (response.status() !== 201) {
    throw new Error(
      `member ${role} bootstrap failed: ${response.status()} ${await response.text()}`
    );
  }
  return { ...(await response.json()), role } as MywIdentity;
}

export async function createIdentityContext(
  browser: Browser,
  baseURL: string,
  identity: MywIdentity,
  viewport = { width: 1440, height: 960 }
): Promise<BrowserContext> {
  const context = await browser.newContext({ baseURL, viewport });
  await context.addInitScript(
    ({ auth, origin }) => {
      if (window.location.origin !== origin) return;
      const user = {
        id: auth.userId,
        email: `${auth.role.toLowerCase()}@local.test`,
        role: auth.role,
        organizationId: auth.organizationId,
        organizationName: 'MYW technical tenant',
        firstName: 'E2E',
        lastName: auth.role,
        isAuthenticated: true,
        accessLevel: 'full',
        isDemo: false,
      };
      localStorage.setItem('token', auth.token);
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem(`consultify_onboarding_done:${auth.userId}`, 'true');
      localStorage.setItem(
        'consultify-storage',
        JSON.stringify({
          state: {
            sessionMode: 'FULL',
            isDemoMode: false,
            isDemoSession: false,
            currentUser: user,
            currentOrganization: { id: auth.organizationId, name: 'MYW technical tenant' },
          },
          version: 0,
        })
      );
    },
    { auth: identity, origin: new URL(baseURL).origin }
  );
  return context;
}

export function writeTechnicalResult(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
