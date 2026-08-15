/**
 * Registers the compiled SIRI Method Pack in one organization's server-side
 * method_packs registry. Readiness is copied verbatim from the compiler: this
 * tool never promotes an unapproved methodology to pilot/released.
 *
 * Usage:
 *   DATABASE_URL=... npx tsx scripts/seed-method-packs-siri.ts --org <id> [--dry-run]
 */
import { Client } from 'pg';

import { compileSiriPack } from '../src/method-core/methods/siri/compileSiriPack';

interface Args {
  organizationId: string;
  dryRun: boolean;
}

function parseArgs(argv: string[]): Args {
  const orgIndex = argv.indexOf('--org');
  const organizationId = orgIndex >= 0 ? argv[orgIndex + 1] : '';
  if (!organizationId) {
    throw new Error('Missing --org <organizationId>; method packs are tenant-scoped.');
  }
  return { organizationId, dryRun: argv.includes('--dry-run') };
}

async function main(): Promise<void> {
  const { organizationId, dryRun } = parseArgs(process.argv.slice(2));
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('Missing DATABASE_URL.');

  const { pack, report } = compileSiriPack();
  const { manifest } = pack;

  console.log(`Pack:      ${manifest.id} @ ${manifest.version} — ${manifest.name}`);
  console.log(`Readiness: ${manifest.readiness} (compiler value, never promoted by seed)`);
  console.log(
    `Content:   ${pack.units.length} units, ${pack.levels.length} levels, ${pack.questions.length} questions`
  );
  if (report) console.log(`Compile report: ${JSON.stringify(report).slice(0, 400)}`);

  if (manifest.readiness === 'released') {
    console.warn(
      'WARNING: compiler returned released; confirm methodology-owner approval before writing.'
    );
  }
  if (dryRun) {
    console.log('--dry-run: no database write.');
    return;
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const existing = await client.query(
      `SELECT id, readiness FROM method_packs
       WHERE organization_id = $1 AND pack_id = $2 AND version = $3`,
      [organizationId, manifest.id, manifest.version]
    );
    if (existing.rowCount) {
      console.log(
        `Pack already registered for ${organizationId} ` +
          `(readiness=${existing.rows[0].readiness}); immutable version left unchanged.`
      );
      return;
    }

    const id = `mp-siri-${manifest.version}-${organizationId}`.slice(0, 120);
    await client.query(
      `INSERT INTO method_packs
         (id, organization_id, pack_id, version, name, readiness, licence_json, manifest_json, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [
        id,
        organizationId,
        manifest.id,
        manifest.version,
        manifest.name,
        manifest.readiness,
        JSON.stringify(manifest.licence),
        JSON.stringify({
          manifest,
          units: pack.units,
          levels: pack.levels,
          questions: pack.questions,
          sources: pack.sources,
          scoringFixtures: pack.scoringFixtures,
        }),
      ]
    );
    console.log(`Registered ${manifest.id}@${manifest.version} for ${organizationId}.`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
