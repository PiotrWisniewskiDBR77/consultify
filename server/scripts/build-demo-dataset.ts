#!/usr/bin/env npx tsx
import { resolveDemoPolicy } from '../src/config/demoPolicy.js';
import { logSelectedDatabaseTarget, resolveScriptDatabaseTarget } from './lib/scriptDatabaseTarget.js';

async function main() {
  const write = process.argv.includes('--write');
  const target = resolveScriptDatabaseTarget({
    label: 'build-demo-dataset',
    databaseUrl: process.env.DATABASE_URL,
    publicDatabaseUrl: process.env.DATABASE_PUBLIC_URL,
    requireExplicitTarget: write,
  });
  process.env.DATABASE_URL = target.connectionString;
  logSelectedDatabaseTarget('build-demo-dataset', target);

  const { deleteDemoDatasetForOrganization, seedAtelierToysDemoDataset } = await import(
    '../src/services/demo/demoSeedService.js'
  );

  const organizationId = process.env.DEMO_ORG_ID?.trim() || 'demo-org';
  const anchorDate = process.env.DEMO_ANCHOR_DATE || new Date().toISOString();
  const demoPolicy = resolveDemoPolicy({
    ...process.env,
    APP_ENV: process.env.APP_ENV || 'production',
  });

  console.log(`\nAtelier Toys canonical demo rebuild`);
  console.log(`organization: ${organizationId}`);
  console.log(`anchorDate:   ${anchorDate}`);
  console.log(`mode:         ${write ? 'write' : 'dry-run'}\n`);

  if (demoPolicy.usesNonDefaultDemoOrgId && !demoPolicy.explicitApprovalEnabled) {
    const message =
      demoPolicy.errors[0] ||
      demoPolicy.warnings[0] ||
      `DEMO_ORG_ID=${organizationId} requires explicit approval flags.`;
    throw new Error(message);
  }

  if (!write) {
    const preview = await seedAtelierToysDemoDataset({
      organizationId: `${organizationId}-preview`,
      anchorDate,
      source: 'canonical',
    });
    await deleteDemoDatasetForOrganization(`${organizationId}-preview`);
    console.log(JSON.stringify(preview, null, 2));
    console.log('\nRun with `--write` to materialize the canonical Atelier Toys dataset.\n');
    return;
  }

  if (String(process.env.DEMO_DATASET_CONFIRM || '').trim() !== 'REBUILD_CANONICAL_DEMO') {
    throw new Error(
      'Refusing to rebuild demo dataset without explicit confirmation. Set DEMO_DATASET_CONFIRM=REBUILD_CANONICAL_DEMO.'
    );
  }

  await deleteDemoDatasetForOrganization(organizationId);
  const result = await seedAtelierToysDemoDataset({
    organizationId,
    anchorDate,
    source: 'canonical',
  });
  console.log(JSON.stringify(result, null, 2));
  console.log('\nCanonical Atelier Toys demo dataset rebuilt successfully.\n');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
