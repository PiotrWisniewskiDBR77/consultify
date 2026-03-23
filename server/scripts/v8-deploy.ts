#!/usr/bin/env npx tsx
/**
 * V8 Deployment Orchestrator
 * CP-17: Automates the full V8 staging/production deployment sequence.
 *
 * Usage:
 *   npx tsx scripts/v8-deploy.ts --check        # Pre-flight checks only
 *   npx tsx scripts/v8-deploy.ts --deploy        # Full deployment sequence
 *   npx tsx scripts/v8-deploy.ts --enable-shadow # Enable shadow mode for an org
 *   npx tsx scripts/v8-deploy.ts --status        # Check current V8 status
 */

import { resolveReachableDatabaseUrl } from '../src/config/databaseTargetResolver.js';

type Mode = 'check' | 'deploy' | 'enable-shadow' | 'status';

function parseMode(): Mode {
  const args = process.argv.slice(2);
  if (args.includes('--check')) return 'check';
  if (args.includes('--deploy')) return 'deploy';
  if (args.includes('--enable-shadow')) return 'enable-shadow';
  if (args.includes('--status')) return 'status';
  console.error(
    'Usage: npx tsx scripts/v8-deploy.ts <--check | --deploy | --enable-shadow | --status>',
  );
  process.exit(1);
}

function hasFlag(flag: string): boolean {
  return process.argv.slice(2).includes(flag);
}

const jsonOutput = hasFlag('--json');
const forceMode = hasFlag('--force');

interface CheckResult {
  name: string;
  passed: boolean;
  detail: string;
}

async function runPreflightChecks(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  // 1. Database connectivity
  const dbResult = resolveReachableDatabaseUrl();
  results.push({
    name: 'Database URL resolved',
    passed: dbResult.source !== 'none',
    detail:
      dbResult.source !== 'none'
        ? `Using ${dbResult.source}${dbResult.reason ? ` — ${dbResult.reason}` : ''}`
        : 'No DATABASE_URL or DATABASE_PUBLIC_URL configured',
  });

  // 2. V8 env vars
  results.push({
    name: 'ENABLE_V8_GLOBAL configured',
    passed: process.env.ENABLE_V8_GLOBAL !== undefined,
    detail: `ENABLE_V8_GLOBAL=${process.env.ENABLE_V8_GLOBAL ?? 'not set'}`,
  });

  results.push({
    name: 'ENABLE_V8_SHADOW_MODE configured',
    passed: process.env.ENABLE_V8_SHADOW_MODE !== undefined,
    detail: `ENABLE_V8_SHADOW_MODE=${process.env.ENABLE_V8_SHADOW_MODE ?? 'not set'}`,
  });

  // 3. Node version
  const nodeVersion = process.version;
  const major = parseInt(nodeVersion.slice(1), 10);
  results.push({
    name: 'Node.js >= 18',
    passed: major >= 18,
    detail: `Node ${nodeVersion}`,
  });

  return results;
}

function printResults(results: CheckResult[]): void {
  console.log('\n=== V8 Deployment Pre-flight Checks ===\n');
  for (const r of results) {
    const icon = r.passed ? '✅' : '❌';
    console.log(`${icon} ${r.name}`);
    console.log(`   ${r.detail}`);
  }
  const passed = results.filter((r) => r.passed).length;
  console.log(`\n${passed}/${results.length} checks passed.\n`);
}

async function runDeploySequence(): Promise<void> {
  console.log('\n=== V8 Deployment Sequence ===\n');

  // Step 1: Pre-flight
  console.log('[1/5] Running pre-flight checks...');
  const checks = await runPreflightChecks();
  printResults(checks);
  const critical = checks.filter((c) => !c.passed && c.name.includes('Database'));
  if (critical.length > 0) {
    console.error('ABORT: Critical pre-flight checks failed.');
    process.exit(1);
  }

  // Step 2: Migration
  console.log('[2/5] Running V8 migrations (dry-run first)...');
  console.log('  → Execute: npx tsx scripts/v8-migrate.ts --dry-run');
  console.log('  → Then: npx tsx scripts/v8-migrate.ts --apply');
  console.log('  → Then: npx tsx scripts/v8-migrate.ts --verify');

  // Step 3: Verify health
  console.log('\n[3/5] Verify V8 health endpoint...');
  console.log('  → curl -H "Authorization: Bearer $TOKEN" $API_URL/api/v8/health');

  // Step 4: Enable V8 globally (disabled by default)
  console.log('\n[4/5] V8 global toggle...');
  console.log('  → Set ENABLE_V8_GLOBAL=true in Railway environment');
  console.log('  → Set ENABLE_V8_SHADOW_MODE=true for shadow mode');

  // Step 5: Enable for test org
  console.log('\n[5/5] Enable V8 for test organization...');
  console.log('  → PUT /api/v8/admin/flags/chat { "enabled": true }');
  console.log('  → PUT /api/v8/admin/flags/ai_core { "enabled": true }');

  console.log('\n=== Deployment sequence complete. Follow steps above. ===\n');
}

async function checkStatus(): Promise<void> {
  console.log('\n=== V8 Status Check ===\n');

  console.log('Environment:');
  console.log(`  ENABLE_V8_GLOBAL: ${process.env.ENABLE_V8_GLOBAL ?? 'not set'}`);
  console.log(`  ENABLE_V8_SHADOW_MODE: ${process.env.ENABLE_V8_SHADOW_MODE ?? 'not set'}`);
  console.log(`  NODE_ENV: ${process.env.NODE_ENV ?? 'not set'}`);

  const dbResult = resolveReachableDatabaseUrl();
  console.log(`\nDatabase:`);
  console.log(`  Source: ${dbResult.source}`);
  if (dbResult.reason) console.log(`  Reason: ${dbResult.reason}`);

  console.log('\nV8 Endpoints:');
  console.log('  GET /api/v8/health — platform health');
  console.log('  GET /api/v8/health/readiness — domain readiness');
  console.log('  GET /api/v8/admin/flags — feature flags');
  console.log('  GET /api/v8/admin/health — detailed health (superadmin)');
  console.log('  GET /api/v8/admin/metrics — request metrics (superadmin)');
  console.log('  GET /api/v8/admin/shadow/stats — shadow mode stats (superadmin)');
}

async function main(): Promise<void> {
  const mode = parseMode();

  switch (mode) {
    case 'check': {
      const results = await runPreflightChecks();
      if (jsonOutput) {
        const allPassed = results.every((r) => r.passed);
        console.log(JSON.stringify({ passed: allPassed, results }, null, 2));
        process.exit(allPassed ? 0 : 1);
      }
      printResults(results);
      process.exit(results.every((r) => r.passed) ? 0 : 1);
    }
    case 'deploy':
      await runDeploySequence();
      break;
    case 'enable-shadow':
      console.log('\nTo enable shadow mode:');
      console.log('1. Set ENABLE_V8_GLOBAL=true');
      console.log('2. Set ENABLE_V8_SHADOW_MODE=true');
      console.log('3. PUT /api/v8/admin/flags/chat { "enabled": true }');
      console.log('4. Verify: GET /api/v8/admin/shadow/stats');
      break;
    case 'status':
      await checkStatus();
      break;
  }
}

main().catch((err: unknown) => {
  console.error('Deployment error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
