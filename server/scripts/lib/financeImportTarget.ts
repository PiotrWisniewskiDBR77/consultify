import { URL } from 'node:url';

import { resolveReachableDatabaseUrl } from '../../src/config/databaseTargetResolver.js';

function env(name: string): string | undefined {
  const value = String(process.env[name] || '').trim();
  return value || undefined;
}

const BLOCKED_FINANCE_IMPORT_ORGS = new Set(['atelier', 'demo-org', 'e2e-org-id']);

function printableEnvValue(value: string | undefined): string {
  return value ? `"${value}"` : '<unset>';
}

function describeFinanceImportOrgInputs(): string {
  return `FINANCE_IMPORT_ORG_ID=${printableEnvValue(env('FINANCE_IMPORT_ORG_ID'))}, DEMO_ORG_ID=${printableEnvValue(env('DEMO_ORG_ID'))}`;
}

function isLocalHost(host: string): boolean {
  const normalized = String(host || '').trim().toLowerCase();
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '0.0.0.0';
}

export function resolveFinanceImportApiUrl(): string {
  const baseUrl = env('FINANCE_IMPORT_API_URL') || env('API_URL');
  if (!baseUrl) {
    throw new Error(
      'Missing finance import API target. Set FINANCE_IMPORT_API_URL or API_URL explicitly.'
    );
  }
  return baseUrl.replace(/\/+$/, '');
}

export function resolveFinanceImportDatabaseUrl(): string {
  const resolved = resolveReachableDatabaseUrl({
    databaseUrl: env('FINANCE_IMPORT_DATABASE_URL') || env('DATABASE_URL'),
    publicDatabaseUrl: env('FINANCE_IMPORT_DATABASE_PUBLIC_URL') || env('DATABASE_PUBLIC_URL'),
  });
  const databaseUrl = resolved.databaseUrl;
  if (!databaseUrl) {
    throw new Error(
      'Missing finance import database target. Set FINANCE_IMPORT_DATABASE_URL, FINANCE_IMPORT_DATABASE_PUBLIC_URL, DATABASE_URL, or DATABASE_PUBLIC_URL explicitly.'
    );
  }

  const allowLocal = env('ALLOW_LOCAL_FINANCE_IMPORT') === '1';
  try {
    const parsed = new URL(databaseUrl);
    if (!allowLocal && isLocalHost(parsed.hostname)) {
      throw new Error(
        'Refusing local finance import target. Set ALLOW_LOCAL_FINANCE_IMPORT=1 if localhost is intentional.'
      );
    }
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error('Invalid finance import database URL.');
  }

  return databaseUrl;
}

export function resolveFinanceImportOrgId(): string {
  const orgId = env('FINANCE_IMPORT_ORG_ID');
  if (!orgId) {
    throw new Error(
      `Missing explicit finance import organization. Set FINANCE_IMPORT_ORG_ID to the real target org before running finance import scripts. Current inputs: ${describeFinanceImportOrgInputs()}`
    );
  }
  const allowDemoOrg = env('ALLOW_DEMO_FINANCE_IMPORT') === '1';
  if (!allowDemoOrg && BLOCKED_FINANCE_IMPORT_ORGS.has(orgId.toLowerCase())) {
    throw new Error(
      `Refusing finance import target "${orgId}". Demo/staging orgs are blocked by default. Current inputs: ${describeFinanceImportOrgInputs()}. Set ALLOW_DEMO_FINANCE_IMPORT=1 only if that target is intentional.`
    );
  }
  return orgId;
}

export async function assertFinanceImportApiSession(params: {
  baseUrl: string;
  token: string;
  expectedOrganizationId?: string;
}): Promise<{ userId: string; organizationId: string; email: string }> {
  const res = await fetch(`${params.baseUrl}/api/auth/me`, {
    headers: {
      Authorization: `Bearer ${params.token}`,
    },
  });

  const text = await res.text();
  let parsed: any = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = { raw: text };
  }

  if (!res.ok) {
    throw new Error(
      `Failed to verify finance import session: ${parsed?.error || parsed?.message || res.status}`
    );
  }

  const user = parsed?.user || parsed;
  const organizationId = String(user?.organizationId || user?.organization_id || '').trim();
  const userId = String(user?.id || '').trim();
  const email = String(user?.email || '').trim();

  if (!organizationId || !userId) {
    throw new Error('Finance import session verification returned incomplete user data.');
  }

  if (params.expectedOrganizationId && organizationId !== params.expectedOrganizationId) {
    throw new Error(
      `Finance import session organization mismatch. Expected "${params.expectedOrganizationId}", got "${organizationId}".`
    );
  }

  return { userId, organizationId, email };
}
