/** @vitest-environment node */

/**
 * P3 — Obserwowalność i limiter AI (MVP koszyk 2, S2.6).
 *
 * Dowód, że per-organizacyjny budżet wywołań AI (`checkAccess(orgId, 'ai_call')`
 * w accessPolicyService.ts) faktycznie BLOKUJE po wyczerpaniu — dziennego licznika
 * wywołań (`usage_counters.ai_calls_count` vs `organization_limits.max_ai_calls_per_day`)
 * i budżetu tokenów okresu próbnego (`organizations.trial_tokens_used` vs
 * `organization_limits.max_total_tokens`) — oraz że organizacje typu PAID
 * (Northwind/DBR77 na pilotażu mają podniesione limity przez ustawienie ich
 * jako PAID) NIE są blokowane niezależnie od zużycia.
 *
 * Ten mechanizm jest niezależny od `DISABLE_RATE_LIMIT` / `aiRateLimiter`
 * (limiter HTTP per-minutę w rateLimiting.middleware.ts) — działa zawsze,
 * także gdy `DISABLE_RATE_LIMIT=true` wyłącza limiter HTTP.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDbGet } = vi.hoisted(() => ({
  mockDbGet: vi.fn(),
}));

vi.mock('../../utils/DbPromise.js', () => ({
  get: (...args: unknown[]) => mockDbGet(...args),
  all: vi.fn().mockResolvedValue([]),
  run: vi.fn().mockResolvedValue({ changes: 0 }),
}));

vi.mock('../../database/Database.js', () => ({
  getDatabase: () => ({}),
  default: {},
}));

vi.mock('../../utils/Logger.js', () => ({
  default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import accessPolicyService from '../accessPolicyService.js';

function sqlOf(call: unknown[]): string {
  // DbPromise.get is called as (db, sql, params, opts) by every access/* service.
  return String(call[1] ?? '');
}

type OrgFixture = {
  organization_type: string;
  trial_expires_at?: string | null;
  trial_started_at?: string | null;
  onboarding_status?: string | null;
  trial_tokens_used?: number;
  is_active?: number;
};

function wireDb(
  org: OrgFixture,
  limits: { max_ai_calls_per_day: number; max_total_tokens: number },
  usage: { ai_calls_count: number },
  paymentMethodsCount = 0
): void {
  mockDbGet.mockImplementation((...args: unknown[]) => {
    const sql = sqlOf(args);
    if (sql.includes('FROM organization_billing')) {
      return Promise.resolve(null);
    }
    if (sql.includes('FROM payment_methods')) {
      return Promise.resolve({ count: paymentMethodsCount });
    }
    if (sql.includes('trial_tokens_used')) {
      return Promise.resolve({ trial_tokens_used: org.trial_tokens_used ?? 0 });
    }
    if (sql.includes('onboarding_status')) {
      return Promise.resolve({ onboarding_status: org.onboarding_status ?? 'ORG_SETUP_COMPLETED' });
    }
    if (sql.includes('FROM organizations')) {
      return Promise.resolve({
        id: 'org-1',
        name: 'Test Org',
        organization_type: org.organization_type,
        trial_started_at: org.trial_started_at ?? null,
        trial_expires_at: org.trial_expires_at ?? null,
        is_active: org.is_active ?? 1,
        plan: null,
        status: null,
      });
    }
    if (sql.includes('FROM organization_limits')) {
      return Promise.resolve({
        id: 'limit-1',
        organization_id: 'org-1',
        max_projects: 3,
        max_users: 5,
        max_ai_calls_per_day: limits.max_ai_calls_per_day,
        max_initiatives: 10,
        max_storage_mb: 500,
        max_total_tokens: limits.max_total_tokens,
        ai_roles_enabled_json: '["ADVISOR"]',
      });
    }
    if (sql.includes('FROM usage_counters')) {
      return Promise.resolve({
        id: 'usage-1',
        organization_id: 'org-1',
        counter_date: new Date().toISOString().split('T')[0],
        ai_calls_count: usage.ai_calls_count,
        projects_count: 0,
        users_count: 0,
        initiatives_count: 0,
        storage_used_mb: 0,
      });
    }
    return Promise.resolve(null);
  });
}

describe('accessPolicyService.checkAccess(ai_call) — wyczerpanie budżetu AI per organizacja', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('blokuje TRIAL po wyczerpaniu dziennego limitu wywołań AI (AI_LIMIT_REACHED)', async () => {
    wireDb(
      { organization_type: 'TRIAL', onboarding_status: 'ORG_SETUP_COMPLETED' },
      { max_ai_calls_per_day: 50, max_total_tokens: 100_000 },
      { ai_calls_count: 50 } // == limit -> wyczerpane
    );

    const result = await accessPolicyService.checkAccess('org-1', 'ai_call');

    expect(result.allowed).toBe(false);
    expect(result.errorCode).toBe('AI_LIMIT_REACHED');
  });

  it('blokuje TRIAL po wyczerpaniu budżetu tokenów bez metody płatności (AI_TOKEN_BUDGET_EXCEEDED)', async () => {
    wireDb(
      {
        organization_type: 'TRIAL',
        onboarding_status: 'ORG_SETUP_COMPLETED',
        trial_tokens_used: 100_000,
      },
      { max_ai_calls_per_day: 50, max_total_tokens: 100_000 },
      { ai_calls_count: 5 }, // dzienny limit calls NIE wyczerpany, ale tokeny tak
      0 // brak metody płatności -> twardy blok
    );

    const result = await accessPolicyService.checkAccess('org-1', 'ai_call');

    expect(result.allowed).toBe(false);
    expect(result.errorCode).toBe('AI_TOKEN_BUDGET_EXCEEDED');
  });

  it('NIE blokuje TRIAL po wyczerpaniu tokenów, jeśli organizacja ma metodę płatności (hybrid PAYG)', async () => {
    wireDb(
      {
        organization_type: 'TRIAL',
        onboarding_status: 'ORG_SETUP_COMPLETED',
        trial_tokens_used: 999_999,
      },
      { max_ai_calls_per_day: 50, max_total_tokens: 100_000 },
      { ai_calls_count: 5 },
      1 // ma metodę płatności
    );

    const result = await accessPolicyService.checkAccess('org-1', 'ai_call');

    expect(result.allowed).toBe(true);
  });

  it('NIE blokuje organizacji PAID (pilotaż: Northwind/DBR77 z podniesionymi limitami) mimo dowolnego zużycia', async () => {
    wireDb(
      { organization_type: 'PAID' },
      { max_ai_calls_per_day: 1, max_total_tokens: 1 }, // limity nieistotne dla PAID
      { ai_calls_count: 999_999 }
    );

    const result = await accessPolicyService.checkAccess('org-1', 'ai_call');

    expect(result.allowed).toBe(true);
  });
});
