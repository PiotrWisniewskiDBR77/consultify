#!/usr/bin/env tsx
/**
 * P29-C verification smoke (static): degraded payout + dowód rollout C.
 * Uruchom: npx tsx server/scripts/smoke-p29-partner-program-c.ts
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function ok(name: string, pass: boolean): void {
  console.log(pass ? `✓ ${name}` : `✗ ${name}`);
  if (!pass) process.exitCode = 1;
}

function main(): void {
  const partnerRoutes = read('server/src/routes/v8/partner.routes.ts');
  const payoutService = read('server/src/services/partnerPayoutSettingsService.ts');
  const readinessTest = read('tests/integration/p29-payout-readiness.contract.test.ts');
  const evidence = read('docs/product/work-packets/cursor-work/final_master/evidence/P29_C_VERIFICATION_ROLLOUT_2026-03-31.md');
  const ledger = read('server/src/services/partnerProgramLedgerService.ts');

  ok(
    'P29-C: request-payout-phase gates on payout profile',
    partnerRoutes.includes('P29_PAYOUT_SETTINGS_INCOMPLETE') &&
      partnerRoutes.includes('isPartnerPayoutDestinationComplete')
  );
  ok('P29-C: isPartnerPayoutDestinationComplete in payout settings service', payoutService.includes('isPartnerPayoutDestinationComplete'));
  ok('P29-C: contract tests for payout readiness', readinessTest.includes('isPartnerPayoutDestinationComplete'));
  ok('P29-C: evidence doc', evidence.includes('P29-C') && evidence.includes('Rollback'));
  ok('P29-C: ledger idempotency_key remains UNIQUE', ledger.includes('idempotency_key TEXT UNIQUE'));
}

main();
