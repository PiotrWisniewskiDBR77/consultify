/**
 * Rejestracja pakietu metodycznego SIRI w serwerowym rejestrze `method_packs`.
 *
 * Bliźniaczy skrypt do `scripts/seed-method-packs.ts` (DRD), tej samej
 * przyczyny: `compileSiriPack()` jest wołany wyłącznie z kodu przeglądarki,
 * serwerowy `methodPackRegistry.register()` nie ma callera produkcyjnego,
 * a `POST /api/method/sessions` wymaga pakietu już obecnego w rejestrze.
 *
 * NIE podnosi gotowości metodycznej — `readiness` przepisywane jest
 * dokładnie z kompilacji. Jeżeli to nie `released`/`pilot`, produkcyjne
 * tworzenie sesji nadal odmówi z `pack_not_released`, świadomie.
 *
 * URUCHOMIENIE
 *   CI=true DATABASE_URL=... npx tsx scripts/seed-method-packs-siri.ts --org <id> [--dry-run]
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
    throw new Error(
      'Brakuje --org <organizationId>. Pakiet jest rejestrowany per organizacja, ' +
        'więc bez tego nie wiadomo, komu go dać.'
    );
  }
  return { organizationId, dryRun: argv.includes('--dry-run') };
}

async function main(): Promise<void> {
  const { organizationId, dryRun } = parseArgs(process.argv.slice(2));

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('Brakuje DATABASE_URL.');
  }

  const { pack, report } = compileSiriPack();
  const { manifest } = pack;

  console.log(`Pakiet:    ${manifest.id} @ ${manifest.version} — ${manifest.name}`);
  console.log(`Readiness: ${manifest.readiness}  (przepisane z kompilacji, NIE podnoszone)`);
  console.log(`Treść:     ${pack.units.length} jednostek, ${pack.levels.length} poziomów, ${pack.questions.length} pytań`);
  if (report) {
    console.log(`Raport kompilacji: ${JSON.stringify(report).slice(0, 400)}`);
  }

  if (manifest.readiness === 'released') {
    console.warn(
      '\n⚠️  Pakiet kompiluje się jako `released`. Upewnij się, że metodyka ma ' +
        'zatwierdzenie właściciela — bramka gotowości przestanie chronić sesje produkcyjne.'
    );
  }

  if (dryRun) {
    console.log('\n--dry-run: nic nie zapisano.');
    return;
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const existing = await client.query(
      'SELECT id, readiness FROM method_packs WHERE organization_id = $1 AND pack_id = $2 AND version = $3',
      [organizationId, manifest.id, manifest.version]
    );
    if (existing.rowCount) {
      console.log(
        `\nPakiet już zarejestrowany dla organizacji ${organizationId} ` +
          `(readiness=${existing.rows[0].readiness}). Nie nadpisuję — nowa treść wymaga nowej wersji.`
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
    console.log(`\n✅ Zarejestrowano pakiet ${manifest.id}@${manifest.version} dla organizacji ${organizationId}.`);
    console.log(
      'Uwaga: przy readiness innym niż `released`/`pilot` produkcyjne tworzenie sesji ' +
        'nadal odmówi (`pack_not_released`). Tak ma być.'
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
