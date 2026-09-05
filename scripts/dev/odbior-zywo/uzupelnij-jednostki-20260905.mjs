#!/usr/bin/env node
/**
 * Odbiór 05.09 (05-ocena) — decyzja właściciela: uzupełnij kolumnę JEDNOSTKA
 * (`assessments.business_unit`, migracja server/migrations/20260905_assessment_business_unit.sql)
 * dla istniejących ocen organizacji DBR77, które dziś mają tę kolumnę pustą
 * (bo żaden ekran jej wcześniej nie wysyłał — patrz komentarz w
 * src/services/api.ts:createAssessmentSession).
 *
 * Mapowanie id → jednostka zostało wyprowadzone z listy ocen widocznej na
 * stagingu (`GET /api/v8/assessment`, org "DBR77" =
 * a3e05d4a-5397-419d-b486-8e44366c0063, zalogowany bearer z pliku sesji
 * ODBIOR_AUTH_STATE) 2026-09-05. UWAGA: mapujemy po ID, nie po nazwie — dwie
 * pozycje na liście mają identyczną nazwę ("DRD Assessment - Jul 12, 2026")
 * z różnymi id, więc nazwa sama w sobie nie jest kluczem jednoznacznym.
 * Jednostki są realistyczne dla DBR77 (spawalnictwo przemysłowe), nie
 * odczytane z żadnego pola źródłowego — nazwy ocen tego nie niosą.
 *
 * Idempotentne: UPDATE działa tylko na `business_unit IS NULL AND id = $2`,
 * więc powtórne uruchomienie po ręcznej zmianie jednostki niczego nie nadpisze.
 *
 * Użycie:
 *   DATABASE_URL=postgres://... node scripts/dev/odbior-zywo/uzupelnij-jednostki-20260905.mjs
 *     → tryb DRY-RUN (domyślny): drukuje plan (id → jednostka → obecna wartość
 *       → akcja) i NIC nie zapisuje.
 *   DATABASE_URL=postgres://... node scripts/dev/odbior-zywo/uzupelnij-jednostki-20260905.mjs --wykonaj
 *     → stosuje UPDATE dla wierszy z business_unit IS NULL.
 */
import pg from 'pg';

const databaseUrl = String(process.env.DATABASE_URL || '');
const wykonaj = process.argv.includes('--wykonaj');

if (!databaseUrl.startsWith('postgres')) {
  console.error('Wymagane: DATABASE_URL (connection string do bazy postgres).');
  process.exit(2);
}

// Organizacja DBR77 na stagingu (potwierdzone GET /api/organizations/<id> → name: "DBR77").
const DBR77_ORG_ID = 'a3e05d4a-5397-419d-b486-8e44366c0063';

// Plan id → jednostka, wyprowadzony z listy ocen DBR77 widocznej na stagingu 2026-09-05
// (10 pozycji, wszystkie w org DBR77, wszystkie z business_unit=NULL w chwili pomiaru).
const PLAN = [
  {
    id: '1404d2c5-a769-43fd-928d-c487469f36f0',
    name: 'Digital Readiness Diagnosis — 23/08/2026',
    businessUnit: 'Zarząd Grupy',
  },
  {
    id: '7da4ecbf-568e-4109-8c44-c375238fa12a',
    name: 'SIRI Assessment - Jul 3, 2026',
    businessUnit: 'Produkcja spawalnicza',
  },
  {
    id: 'f2f213c9-5f88-430f-96eb-2f2fd5d38c32',
    name: 'DRD Assessment - Jul 12, 2026',
    businessUnit: 'Logistyka',
  },
  {
    id: 'b901d4a3-fd10-42a6-97cb-accf57e0fd2d',
    name: 'DRD Assessment - Jul 12, 2026',
    businessUnit: 'IT',
  },
  {
    id: 'af460bda-8478-483e-aa2e-62708230a851',
    name: 'DRD Assessment - Jul 11, 2026',
    businessUnit: 'Produkcja spawalnicza',
  },
  {
    id: '88f644c0-cfe3-44a5-a041-a656c5126dbc',
    name: 'DRD Assessment - Jul 11, 2026',
    businessUnit: 'Zarząd Grupy',
  },
  {
    id: '72cca96a-2133-4bf8-94cf-758deeb50fe2',
    name: 'DRD Assessment - Jul 4, 2026',
    businessUnit: 'Logistyka',
  },
  {
    id: 'dbr77-assess-001',
    name: 'Ocena dojrzałości cyfrowej Q1',
    businessUnit: 'Zarząd Grupy',
  },
  {
    id: 'dbr77-assess-002',
    name: 'Analiza gotowości AI',
    businessUnit: 'IT',
  },
  {
    id: 'd37f070e-b3e8-4226-9613-b8b72a4fd893',
    name: 'DRD Assessment - Apr 29, 2026',
    businessUnit: 'Produkcja spawalnicza',
  },
];

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();

try {
  console.log(`Tryb: ${wykonaj ? 'WYKONAJ (zapis)' : 'DRY-RUN (bez zapisu)'}`);
  console.log(`Organizacja: DBR77 (${DBR77_ORG_ID})`);
  console.log('');

  let planowaneDoZapisu = 0;
  let pominieteJużUstawione = 0;
  let pominieteBrakWiersza = 0;

  for (const row of PLAN) {
    const res = await client.query(
      `SELECT id, name, business_unit, organization_id FROM assessments WHERE id = $1`,
      [row.id]
    );
    if (res.rowCount === 0) {
      console.log(`  POMINIĘTO (brak wiersza w tej bazie): ${row.id} — ${row.name}`);
      pominieteBrakWiersza += 1;
      continue;
    }
    const current = res.rows[0];
    if (current.organization_id !== DBR77_ORG_ID) {
      console.log(
        `  POMINIĘTO (inna organizacja niż DBR77): ${row.id} — org=${current.organization_id}`
      );
      continue;
    }
    if (current.business_unit) {
      console.log(
        `  POMINIĘTO (już ma jednostkę "${current.business_unit}"): ${row.id} — ${current.name}`
      );
      pominieteJużUstawione += 1;
      continue;
    }

    console.log(`  ${row.id}  ${JSON.stringify(current.name)}  →  "${row.businessUnit}"`);
    planowaneDoZapisu += 1;

    if (wykonaj) {
      const updateRes = await client.query(
        `UPDATE assessments SET business_unit = $1, updated_at = now()
         WHERE id = $2 AND business_unit IS NULL`,
        [row.businessUnit, row.id]
      );
      if (updateRes.rowCount !== 1) {
        console.log(`    UWAGA: zapis nie trafił w wiersz (rowCount=${updateRes.rowCount}) — ktoś ustawił jednostkę w międzyczasie, pomijam.`);
      }
    }
  }

  console.log('');
  console.log(
    `Podsumowanie: ${planowaneDoZapisu} do zapisu, ${pominieteJużUstawione} już miało jednostkę, ${pominieteBrakWiersza} brak wiersza w tej bazie.`
  );
  if (!wykonaj) {
    console.log('To był DRY-RUN — nic nie zapisano. Uruchom z --wykonaj, żeby zastosować.');
  } else {
    console.log('Zapisano powyższe zmiany.');
  }
} finally {
  await client.end();
}
