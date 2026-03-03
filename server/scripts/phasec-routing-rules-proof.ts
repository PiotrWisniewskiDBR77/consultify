#!/usr/bin/env tsx
/**
 * Phase C proof runner for LLM Routing Rules.
 *
 * What it proves:
 * - DB: table exists (information_schema / PRAGMA via adapter)
 * - Network: CRUD endpoints respond 2xx and persist (list→create→toggle→update→delete)
 * - Runtime: simulate endpoint returns appliedRuleIds + candidate filtering
 *
 * Usage:
 *   BASE_URL=http://127.0.0.1:3001 tsx server/scripts/phasec-routing-rules-proof.ts
 */

import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';

const BASE_URL = String(process.env.BASE_URL || 'http://127.0.0.1:3001').trim();

dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });
if (process.env.ENV_FILE) {
  dotenv.config({ path: String(process.env.ENV_FILE) });
}

const DATABASE_URL = String(process.env.DATABASE_URL || '').trim();
const JWT_SECRET = String(process.env.JWT_SECRET || '').trim();

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is missing (expected from .env/.env.local).');
}
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is missing (expected from .env/.env.local).');
}

function assertOk(condition: any, message: string) {
  if (!condition) throw new Error(message);
}

async function jsonFetch(path: string, opts: RequestInit & { token: string }) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...opts,
    headers: {
      ...(opts.headers || {}),
      Authorization: `Bearer ${opts.token}`,
      'Content-Type': 'application/json',
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (json as any)?.error || res.statusText || 'Request failed';
    throw new Error(`${opts.method || 'GET'} ${path} → ${res.status}: ${msg}`);
  }
  return json as any;
}

async function main() {
  console.log('[PhaseC] Using BASE_URL:', BASE_URL);

  const pool = new Pool({ connectionString: DATABASE_URL });

  // 1) DB proof: table exists
  const existsRes = await pool.query(
    `SELECT 1
     FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'llm_routing_rules'
     LIMIT 1`
  );
  assertOk(existsRes.rowCount && existsRes.rowCount > 0, 'DB: llm_routing_rules table not found');
  console.log('[PhaseC] DB OK: llm_routing_rules exists');

  // 2) Find SUPERADMIN user (verifySuperAdmin checks DB truth)
  const userRes = await pool.query(
    `SELECT id
     FROM users
     WHERE role IN ('SUPERADMIN', 'SUPER_ADMIN')
     ORDER BY id
     LIMIT 1`
  );
  assertOk(userRes.rows?.[0]?.id, 'No SUPERADMIN user found in DB (users.role)');
  const superadminId = String(userRes.rows[0].id);
  const token = jwt.sign({ id: superadminId, role: 'SUPERADMIN' }, JWT_SECRET);
  console.log('[PhaseC] Auth OK: SUPERADMIN user found');

  // 3) Network CRUD proof
  const before = await jsonFetch('/api/llm/routing-rules', { method: 'GET', token });
  console.log('[PhaseC] GET /routing-rules:', { count: (before?.rules || []).length });

  const created = await jsonFetch('/api/llm/routing-rules', {
    method: 'POST',
    token,
    body: JSON.stringify({
      name: 'PhaseC: Health only',
      description: 'Keep only healthy providers (Phase C proof)',
      type: 'health',
      priority: 1,
      isActive: true,
      config: { tiers: ['STANDARD'] },
    }),
  });
  const ruleId = String(created?.rule?.id || '');
  assertOk(ruleId, 'Create did not return rule.id');
  console.log('[PhaseC] POST /routing-rules: created', { ruleId });

  const toggled = await jsonFetch(`/api/llm/routing-rules/${ruleId}/toggle`, {
    method: 'PUT',
    token,
    body: JSON.stringify({ isActive: false }),
  });
  assertOk(toggled?.rule?.isActive === false, 'Toggle OFF did not set isActive=false');
  console.log('[PhaseC] PUT /routing-rules/:id/toggle: off OK');

  const updated = await jsonFetch(`/api/llm/routing-rules/${ruleId}`, {
    method: 'PUT',
    token,
    body: JSON.stringify({
      name: 'PhaseC: Health only (v2)',
      description: 'Keep only healthy providers (updated)',
      type: 'health',
      priority: 2,
      isActive: true,
      config: { tiers: ['STANDARD', 'BUDGET'] },
    }),
  });
  assertOk(updated?.rule?.name?.includes('(v2)'), 'Update did not change name');
  console.log('[PhaseC] PUT /routing-rules/:id: update OK');

  const listAfter = await jsonFetch('/api/llm/routing-rules', { method: 'GET', token });
  const found = (listAfter?.rules || []).find((r: any) => r?.id === ruleId);
  assertOk(found, 'Updated rule not returned by list');
  console.log('[PhaseC] GET /routing-rules: list reflects persisted row');

  // 4) Runtime apply proof via simulate
  const sim = await jsonFetch('/api/llm/routing-rules/simulate', {
    method: 'POST',
    token,
    body: JSON.stringify({
      tier: 'STANDARD',
      purpose: 'chat_complex',
      candidates: [
        { id: 'p1', provider: 'openrouter', model_id: 'openai/gpt-4o', health_status: 'healthy' },
        { id: 'p2', provider: 'openai', model_id: 'gpt-4o', health_status: 'unhealthy' },
        { id: 'p3', provider: 'anthropic', model_id: 'claude', health_status: 'healthy' },
      ],
    }),
  });
  assertOk(Array.isArray(sim?.appliedRuleIds) && sim.appliedRuleIds.includes(ruleId), 'Simulate did not apply the created rule');
  assertOk(sim?.candidatesBefore === 3 && sim?.candidatesAfter === 2, 'Simulate did not filter candidates as expected');
  console.log('[PhaseC] POST /routing-rules/simulate: runtime apply OK', {
    appliedRuleIds: sim.appliedRuleIds,
    candidatesBefore: sim.candidatesBefore,
    candidatesAfter: sim.candidatesAfter,
  });

  // 5) Cleanup
  await jsonFetch(`/api/llm/routing-rules/${ruleId}`, { method: 'DELETE', token });
  console.log('[PhaseC] DELETE /routing-rules/:id: delete OK');

  await pool.end();
  console.log('[PhaseC] DONE');
}

main().catch((e) => {
  console.error('[PhaseC] FAILED:', e?.message || e);
  process.exit(1);
});

