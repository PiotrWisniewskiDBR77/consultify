#!/usr/bin/env tsx
import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../src/database/Database.js';
import * as DbPromise from '../src/utils/DbPromise.js';
import {
  DEFAULT_DEMO_LIMITS,
  DEFAULT_TRIAL_LIMITS,
  ORG_TYPES,
  TRIAL_DURATION_DAYS,
} from '../src/services/access/AccessTypes.js';
import { checkUserDemoPreference, setUserDemoPreference } from '../src/middleware/demoGuard.middleware.js';
import {
  DEMO_TRIAL_EVENT_TYPES,
  recordDemoTrialEvent,
} from '../src/services/demoTrialTelemetryService.js';

const DEMO_ORG_ID = process.env.DEMO_ORG_ID || 'demo-org';
const DEMO_USER_EMAIL = process.env.DEMO_USER_EMAIL || 'piotr.wisniewski@demo.com';
const TRIAL_ORG_NAME_PREFIX = 'Smoke Trial Org';
const SMOKE_DB_TIMEOUT_MS = 15000;
const DB_RETRY_ATTEMPTS = 3;

type CheckResult = { name: string; pass: boolean; actual?: unknown };

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

async function withDbRetry<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= DB_RETRY_ATTEMPTS; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const message = String((error as Error)?.message || error).toLowerCase();
      const isTimeout = message.includes('timeout');
      if (!isTimeout || attempt === DB_RETRY_ATTEMPTS) {
        throw error;
      }
      await sleep(250 * attempt);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Unknown DB error');
}

async function dbGet<T>(
  sql: string,
  params: unknown[] = [],
  options: { fallback?: boolean } = {}
): Promise<T | null> {
  return withDbRetry(() =>
    DbPromise.get<T>(sql, params, {
      fallback: options.fallback ?? false,
      timeout: SMOKE_DB_TIMEOUT_MS,
    })
  );
}

async function dbRun(sql: string, params: unknown[] = [], options: { fallback?: boolean } = {}): Promise<void> {
  await withDbRetry(async () => {
    await DbPromise.run(sql, params, {
      fallback: options.fallback ?? false,
      timeout: SMOKE_DB_TIMEOUT_MS,
    });
  });
}

async function getCount(sql: string, params: unknown[] = []): Promise<number> {
  const row = await dbGet<{ count?: number | string }>(sql, params, { fallback: true });
  return Number(row?.count || 0);
}

async function columnExists(tableName: string, columnName: string): Promise<boolean> {
  const row = await dbGet<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
     ) as exists`,
    [tableName, columnName],
    { fallback: true }
  );
  return Boolean(row?.exists);
}

async function main(): Promise<void> {
  getDatabase();

  const checks: CheckResult[] = [];

  const demoOrg = await dbGet<{ id: string; organization_type?: string | null }>(
    `SELECT id, organization_type FROM organizations WHERE id = ?`,
    [DEMO_ORG_ID],
    { fallback: false }
  );
  checks.push({ name: 'demo org exists', pass: Boolean(demoOrg?.id), actual: demoOrg?.id || null });

  const demoUser = await dbGet<{ id: string; organization_id: string }>(
    `SELECT id, organization_id FROM users WHERE email = ? LIMIT 1`,
    [DEMO_USER_EMAIL],
    { fallback: false }
  );
  checks.push({
    name: 'demo user exists',
    pass: Boolean(demoUser?.id),
    actual: demoUser?.id || null,
  });

  if (!demoUser?.id || !demoOrg?.id) {
    throw new Error('Missing demo org or demo user. Run db:seed:demo:contract first.');
  }

  await setUserDemoPreference(demoUser.id, true);
  const demoPrefEnabled = await checkUserDemoPreference(demoUser.id);
  checks.push({
    name: 'demo preference toggled on',
    pass: demoPrefEnabled === true,
    actual: demoPrefEnabled,
  });

  await setUserDemoPreference(demoUser.id, false);
  const demoPrefDisabled = await checkUserDemoPreference(demoUser.id);
  checks.push({
    name: 'demo preference toggled off',
    pass: demoPrefDisabled === false,
    actual: demoPrefDisabled,
  });

  const trialOrgId = uuidv4();
  const trialName = `${TRIAL_ORG_NAME_PREFIX} ${new Date().toISOString().slice(0, 10)} ${uuidv4().slice(0, 6)}`;
  const trialStartedAt = new Date().toISOString();
  const trialExpiresAt = new Date(
    Date.now() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const hasOrgType = await columnExists('organizations', 'organization_type');
  const hasTrialStarted = await columnExists('organizations', 'trial_started_at');
  const hasTrialExpires = await columnExists('organizations', 'trial_expires_at');
  const hasIsActive = await columnExists('organizations', 'is_active');

  const orgCols = ['id', 'name', 'plan', 'status'];
  const orgVals: Array<string | number> = [trialOrgId, trialName, 'trial', 'active'];
  if (hasOrgType) {
    orgCols.push('organization_type');
    orgVals.push(ORG_TYPES.TRIAL);
  }
  if (hasTrialStarted) {
    orgCols.push('trial_started_at');
    orgVals.push(trialStartedAt);
  }
  if (hasTrialExpires) {
    orgCols.push('trial_expires_at');
    orgVals.push(trialExpiresAt);
  }
  if (hasIsActive) {
    orgCols.push('is_active');
    orgVals.push(1);
  }

  await dbRun(
    `INSERT INTO organizations (${orgCols.join(', ')})
     VALUES (${orgCols.map(() => '?').join(', ')})
     ON CONFLICT(id) DO UPDATE SET name=excluded.name`,
    orgVals,
    { fallback: false }
  );

  const hasOrgMembers = await dbGet<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'organization_members'
     ) as exists`,
    [],
    { fallback: true }
  );
  if (hasOrgMembers?.exists) {
    const hasMemberStatus = await columnExists('organization_members', 'status');
    const hasMemberCreatedAt = await columnExists('organization_members', 'created_at');
    const memberCols = ['id', 'organization_id', 'user_id', 'role'];
    const memberVals: Array<string> = [uuidv4(), trialOrgId, demoUser.id, 'OWNER'];
    if (hasMemberStatus) {
      memberCols.push('status');
      memberVals.push('ACTIVE');
    }
    if (hasMemberCreatedAt) {
      memberCols.push('created_at');
      memberVals.push(new Date().toISOString());
    }
    await dbRun(
      `INSERT INTO organization_members (${memberCols.join(', ')})
       VALUES (${memberCols.map(() => '?').join(', ')})`,
      memberVals,
      { fallback: true }
    );
  }

  await recordDemoTrialEvent({
    eventType: DEMO_TRIAL_EVENT_TYPES.TRIAL_STARTED,
    organizationId: trialOrgId,
    userId: demoUser.id,
    source: 'smoke_demo_script_a',
    metadata: {
      trialDurationDays: TRIAL_DURATION_DAYS,
      trialExpiresAt,
    },
  });

  const trialRow = await dbGet<{
    id: string;
    organization_type?: string | null;
    trial_started_at?: string | null;
    trial_expires_at?: string | null;
  }>(
    `SELECT id, organization_type, trial_started_at, trial_expires_at
     FROM organizations WHERE id = ?`,
    [trialOrgId],
    { fallback: false }
  );

  checks.push({
    name: 'trial org created',
    pass: Boolean(trialRow?.id),
    actual: trialRow?.id || null,
  });
  checks.push({
    name: 'trial org type = TRIAL',
    pass: String(trialRow?.organization_type || '').toUpperCase() === 'TRIAL',
    actual: trialRow?.organization_type || null,
  });

  const trialStartedAtValue = trialRow?.trial_started_at ? new Date(trialRow.trial_started_at) : null;
  const trialExpiresAtValue = trialRow?.trial_expires_at ? new Date(trialRow.trial_expires_at) : null;
  const trialDurationDays =
    trialStartedAtValue && trialExpiresAtValue
      ? Math.round(
          (trialExpiresAtValue.getTime() - trialStartedAtValue.getTime()) / (24 * 60 * 60 * 1000)
        )
      : null;
  checks.push({
    name: 'trial duration = 7 days',
    pass: trialDurationDays === 7,
    actual: trialDurationDays,
  });

  checks.push({
    name: 'demo default AI daily limit = 10',
    pass: DEFAULT_DEMO_LIMITS.max_ai_calls_per_day === 10,
    actual: DEFAULT_DEMO_LIMITS.max_ai_calls_per_day,
  });

  checks.push({
    name: 'trial default AI daily limit = 50',
    pass: DEFAULT_TRIAL_LIMITS.max_ai_calls_per_day === 50,
    actual: DEFAULT_TRIAL_LIMITS.max_ai_calls_per_day,
  });

  const trialStartEvents = await getCount(
    `SELECT COUNT(*) as count
     FROM conversion_events
     WHERE organization_id = ? AND event_type IN ('TRIAL_START', 'trial_started')`,
    [trialOrgId]
  );
  checks.push({
    name: 'trial started telemetry recorded',
    pass: trialStartEvents >= 1,
    actual: trialStartEvents,
  });

  const failed = checks.filter((c) => !c.pass);
  console.log('\n[smoke-demo-script-a] Summary:');
  for (const c of checks) {
    console.log(` - ${c.pass ? 'OK' : 'FAIL'} ${c.name} (actual=${JSON.stringify(c.actual)})`);
  }

  if (failed.length > 0) {
    throw new Error(`Smoke failed: ${failed.map((f) => f.name).join(', ')}`);
  }

  console.log('\n[smoke-demo-script-a] Demo Script A checks passed.');
}

main().catch((error) => {
  console.error('[smoke-demo-script-a] Failed:', (error as Error)?.message || error);
  process.exit(1);
});
