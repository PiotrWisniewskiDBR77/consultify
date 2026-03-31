#!/usr/bin/env tsx
/**
 * P29-B rollout smoke (static): artefakty portal vs operator + whatNext/hold bez live DB.
 * Uruchom: npx tsx server/scripts/smoke-p29-partner-program-b.ts
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
  const service = read('server/src/services/partnerProgramLedgerService.ts');
  const partnerRoutes = read('server/src/routes/v8/partner.routes.ts');
  const superRoutes = read('server/src/routes/partners.routes.ts');
  const migration = read('server/migrations/20260331_p28_workbench_p29_partner_program_ledger.sql');
  const contractTest = read('tests/integration/p28-p29.program-assessment.contract.test.ts');

  ok(
    'P29-B: getProgramStatusDetail + buildPartnerWhatNextGuidance in service',
    service.includes('getProgramStatusDetail') && service.includes('buildPartnerWhatNextGuidance')
  );
  ok(
    'P29-B: partner GET /program/status returns whatNext + hold',
    partnerRoutes.includes("getProgramStatusDetail(partnerOrgId, 'partner')") &&
      partnerRoutes.includes('whatNext: detail.whatNext') &&
      partnerRoutes.includes('hold: detail.hold')
  );
  ok(
    'P29-B: partner lifecycle error may include whatNext',
    partnerRoutes.includes('P29_LIFECYCLE_FORBIDDEN') && partnerRoutes.includes('whatNext')
  );
  ok(
    'P29-B: superadmin program status uses operator audience + whatNext/hold',
    superRoutes.includes("getProgramStatusDetail(partnerOrgId, 'operator')") &&
      superRoutes.includes('whatNext: detail.whatNext')
  );
  ok('Migration defines partner_program_ledger', migration.includes('partner_program_ledger'));
  ok(
    'P29-B: contract tests cover buildPartnerWhatNextGuidance',
    contractTest.includes('buildPartnerWhatNextGuidance: partner in earn with balance')
  );
}

main();
