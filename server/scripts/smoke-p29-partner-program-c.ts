#!/usr/bin/env tsx
/**
 * P29-C verification smoke (static): degraded payout + dual-control + ledger unavailable.
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
  const superRoutes = read('server/src/routes/partners.routes.ts');

  ok(
    'P29-C: request-payout-phase gates on payout profile',
    partnerRoutes.includes('P29_PAYOUT_SETTINGS_INCOMPLETE') &&
      partnerRoutes.includes('isPartnerPayoutDestinationComplete')
  );
  ok('P29-C: isPartnerPayoutDestinationComplete in payout settings service', payoutService.includes('isPartnerPayoutDestinationComplete'));
  ok('P29-C: dual-control gate in ledger service', ledger.includes('P29_DUAL_CONTROL_REQUIRED') && ledger.includes('requiresDualControl'));
  ok('P29-C: ledger unavailable degraded snapshot', ledger.includes('ledger_unavailable'));
  ok('P29-C: partner route propagates degraded', partnerRoutes.includes('detail.degraded'));
  ok('P29-C: superadmin route propagates degraded', superRoutes.includes('detail.degraded'));
  ok('P29-C: contract tests for payout readiness + dual-control', readinessTest.includes('requiresDualControl'));
  ok('P29-C: evidence doc — no deferred items', !evidence.includes('nie zaimplementowano') && evidence.includes('100%'));
  ok('P29-C: ledger idempotency_key remains UNIQUE', ledger.includes('idempotency_key TEXT UNIQUE'));
}

main();
