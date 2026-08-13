/**
 * Rejestracja pakietu metodycznego DRD w serwerowym rejestrze `method_packs`.
 *
 * DLACZEGO TEN PLIK ISTNIEJE
 * --------------------------
 * Pakiet DRD jest w tym repo skompilowany i kompletny — `compileDrdPack()`
 * buduje go deterministycznie z `src/services/drdStructure.ts`. Ale wołany był
 * WYŁĄCZNIE z kodu przeglądarki (`src/method-core/methods/drd/drdSessionRuntime.ts`).
 * Po stronie serwera `methodPackRegistry.register()` nie był wołany nigdzie poza
 * testami, a `POST /api/method/sessions` wymaga pakietu, który już jest w
 * rejestrze — sam niczego nie rejestruje i odmawia z `422 pack_not_released`.
 *
 * Skutek na świeżej instalacji, potwierdzony empirycznie (uwierzytelnione
 * `GET /api/method/packs` → `{"packs":[]}`): DRD działał w przeglądarce, ale
 * przez HTTP nie dało się założyć ani jednej sesji, bo rejestr był pusty i nic
 * go nie zapełniało. Nie było też `POST /packs`, więc nie dało się tego zrobić
 * z zewnątrz. Ten skrypt jest brakującym mostem.
 *
 * CZEGO TEN SKRYPT ŚWIADOMIE NIE ROBI
 * -----------------------------------
 * NIE podnosi gotowości metodycznej. `readiness` przepisujemy dokładnie takie,
 * jakie wychodzi z kompilacji — dziś `methodology_review`, bo metodyka nie ma
 * jeszcze zatwierdzenia właściciela. To znaczy, że po zaseedowaniu produkcyjna
 * sesja NADAL zostanie odrzucona z `pack_not_released`, i tak ma być: bramka
 * gotowości jest prawdziwym zabezpieczeniem metodycznym, a nie przeszkodą do
 * obejścia. Demo przechodzi osobną, jawną ścieżką (`demoBypass.ts`), która jest
 * strukturalnie niezdolna do zadziałania na produkcji.
 *
 * Podniesienie `readiness` na `released` jest decyzją właściciela metodyki,
 * nie skryptu i nie inżyniera.
 *
 * DLACZEGO POZA `server/`
 * -----------------------
 * `tsc -p server` ma `rootDir` ustawiony na `server/`, więc kod serwera nie może
 * importować z `src/`. Skrypt leży poza projektem serwera i jest uruchamiany
 * przez `tsx`, dzięki czemu czyta pakiet z jedynego źródła prawdy zamiast
 * powielać metodykę w drugim miejscu — kopia rozjechałaby się przy pierwszej
 * zmianie w `drdStructure.ts`.
 *
 * URUCHOMIENIE
 *   CI=true DATABASE_URL=... npx tsx scripts/seed-method-packs.ts --org <id> [--dry-run]
 */
import { Client } from 'pg';

import { compileDrdPack } from '../src/method-core/methods/drd/compileDrdPack';

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

  const { pack, report } = compileDrdPack();
  const { manifest } = pack;

  // Kompilator sam raportuje luki w pokryciu treścią. Jeżeli coś jest niepełne,
  // ma to być widoczne przy seedowaniu, a nie odkryte przez klienta na sesji.
  console.log(`Pakiet:    ${manifest.id} @ ${manifest.version} — ${manifest.name}`);
  console.log(`Readiness: ${manifest.readiness}  (przepisane z kompilacji, NIE podnoszone)`);
  console.log(`Treść:     ${pack.units.length} jednostek, ${pack.levels.length} poziomów, ${pack.questions.length} pytań`);
  if (report) {
    console.log(`Raport kompilacji: ${JSON.stringify(report).slice(0, 400)}`);
  }

  if (manifest.readiness === 'released') {
    // Zabezpieczenie przed cichym podniesieniem gotowości: jeżeli kiedyś
    // kompilacja zacznie zwracać `released`, ma to być świadoma decyzja
    // widoczna w kodzie metodyki, a nie niespodzianka przy seedowaniu.
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
      // Rejestr pakietów jest z założenia niezmienny per (pack_id, version) —
      // wynik sesji musi dać się odtworzyć z dokładnie tej treści, na której
      // powstał. Nadpisanie w miejscu unieważniłoby historyczne wyniki, więc
      // nowa treść = nowa wersja pakietu.
      console.log(
        `\nPakiet już zarejestrowany dla organizacji ${organizationId} ` +
          `(readiness=${existing.rows[0].readiness}). Nie nadpisuję — nowa treść wymaga nowej wersji.`
      );
      return;
    }

    const id = `mp-drd-${manifest.version}-${organizationId}`.slice(0, 120);
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
