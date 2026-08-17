import type { APIRequestContext, Browser, BrowserContext } from '@playwright/test';
import pg from 'pg';

export type SwotPersonaRole = 'ADMIN' | 'USER';

export type SwotPersona = {
  runId: string;
  organizationId: string;
  userId: string;
  token: string;
  role: SwotPersonaRole;
};

const API_BASE_URL = process.env.E2E_API_URL || 'http://127.0.0.1:3001';
const APP_BASE_URL = process.env.E2E_BASE_URL || 'http://127.0.0.1:3000';
const TEST_SUPPORT_KEY = process.env.TEST_SUPPORT_KEY || 'local-test-support-key-change-me';

function supportHeaders(): Record<string, string> {
  return { 'x-test-support-key': TEST_SUPPORT_KEY, 'content-type': 'application/json' };
}

export function authHeaders(persona: SwotPersona): Record<string, string> {
  return { Authorization: `Bearer ${persona.token}`, 'content-type': 'application/json' };
}

async function checkedJson(
  response: Awaited<ReturnType<APIRequestContext['post']>>,
  label: string
) {
  if (!response.ok()) throw new Error(`${label}: ${response.status()} ${await response.text()}`);
  return response.json();
}

export async function bootstrapTenant(
  request: APIRequestContext,
  runId: string,
  role: SwotPersonaRole = 'ADMIN'
): Promise<SwotPersona> {
  const response = await request.post(`${API_BASE_URL}/api/test-support/bootstrap`, {
    headers: supportHeaders(),
    data: { runId, role },
  });
  return { ...(await checkedJson(response, `bootstrap ${role}`)), role } as SwotPersona;
}

export async function addMember(
  request: APIRequestContext,
  tenant: SwotPersona,
  role: SwotPersonaRole
): Promise<SwotPersona> {
  const response = await request.post(`${API_BASE_URL}/api/test-support/member`, {
    headers: supportHeaders(),
    data: { runId: tenant.runId, role },
  });
  return { ...(await checkedJson(response, `member ${role}`)), role } as SwotPersona;
}

/**
 * The credential below is the real HS256 JWT returned by the mounted test-support
 * route. This helper only installs that server-issued credential in the same SPA
 * storage slots as the production auth bootstrap; it never constructs or signs a
 * token locally and is run with E2E_MODE=false.
 */
export async function signedBrowserContext(
  browser: Browser,
  persona: SwotPersona,
  viewport = { width: 1440, height: 900 }
): Promise<BrowserContext> {
  const context = await browser.newContext({ baseURL: APP_BASE_URL, viewport });
  await context.addInitScript(
    ({ auth, origin }) => {
      if (window.location.origin !== origin) return;
      const user = {
        id: auth.userId,
        email: `${auth.role.toLowerCase()}@local.test`,
        role: auth.role,
        organizationId: auth.organizationId,
        organizationName: 'TLS technical tenant',
        firstName: 'TLS',
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
            currentOrganization: { id: auth.organizationId, name: 'TLS technical tenant' },
          },
          version: 0,
        })
      );
    },
    { auth: persona, origin: new URL(APP_BASE_URL).origin }
  );
  return context;
}

export async function setMembershipState(
  persona: SwotPersona,
  status: 'ACTIVE' | 'REVOKED'
): Promise<void> {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(
      `UPDATE organization_members
          SET status = $1
        WHERE organization_id = $2 AND user_id = $3`,
      [status, persona.organizationId, persona.userId]
    );
  } finally {
    await client.end();
  }
}

export async function cleanupRuns(request: APIRequestContext, runIds: string[]): Promise<void> {
  for (const runId of runIds) {
    const response = await request.post(`${API_BASE_URL}/api/test-support/cleanup`, {
      headers: supportHeaders(),
      data: { runId },
    });
    if (!response.ok())
      throw new Error(`cleanup ${runId}: ${response.status()} ${await response.text()}`);
  }
}

export function assertSignedJwt(persona: SwotPersona): void {
  const [header, payload, signature] = persona.token.split('.');
  if (!header || !payload || !signature) throw new Error('test-support returned a malformed JWT');
  const decoded = JSON.parse(Buffer.from(header, 'base64url').toString('utf8')) as { alg?: string };
  if (decoded.alg !== 'HS256') throw new Error(`expected HS256 JWT, got ${decoded.alg || 'none'}`);
}
