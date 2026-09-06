#!/usr/bin/env tsx
/**
 * UZUPEŁNIENIE SEEDA „Wyniki" o pola raportu OKR dołożone przez P7K część A.
 *
 * ── PO CO OSOBNY SKRYPT ───────────────────────────────────────────────────
 * `seed-wyniki-dbr77.ts` położył 3 zestawy OKR, 10 celów, 28 kluczowych
 * rezultatów i 28 check-inów ZANIM powstały kolumny `theme`, `team_name`,
 * `deadline`, `description` i `report_goal`
 * (migracja `20262102_okr_p7k_report_fields.sql`). Kolumny są NULLable bez
 * backfillu — czyli na demo i stagingu raport OKR pokazuje w tych miejscach
 * uczciwe „—", bo takich danych po prostu nie ma.
 *
 * Ten skrypt je DOPISUJE do danych pokazowych DBR77 — jako dane seeda, nie
 * jako wyliczenie UI. Rozróżnienie jest istotne: UI NIGDY nie zgaduje tematu
 * z opisu ani terminu z końca cyklu (to byłoby fabrykowanie); wartości muszą
 * przyjść z bazy, a do bazy wkłada je seed danych pokazowych, tak samo jak
 * wcześniej włożył nazwy celów i rezultatów.
 *
 * ── WŁASNOŚCI ─────────────────────────────────────────────────────────────
 * · ADDYTYWNY — pisze WYŁĄCZNIE w kolumnach dołożonych przez P7K i wyłącznie
 *   tam, gdzie jest dziś NULL (`WHERE ... IS NULL`), więc nie nadpisze
 *   niczego, co ktoś wpisał ręcznie;
 * · IDEMPOTENTNY — drugi przebieg zmienia 0 wierszy;
 * · ODWRACALNY — `--rollback` zeruje TE kolumny w TYCH wierszach do NULL;
 * · TRANSAKCYJNY — wszystko albo nic;
 * · dopasowanie po TYTULE zestawu/celu w danej organizacji, bo tytuły są
 *   naturalnym kluczem seeda i czytelne dla człowieka czytającego ten plik.
 *
 * Uruchomienie:
 *   DATABASE_URL=... npx tsx server/scripts/seed-wyniki-okr-p7k.ts --org=DBR77 --dry-run
 *   DATABASE_URL=... npx tsx server/scripts/seed-wyniki-okr-p7k.ts --org=DBR77 --apply
 *   DATABASE_URL=... npx tsx server/scripts/seed-wyniki-okr-p7k.ts --org=DBR77 --rollback
 */
import { Pool, type PoolClient } from 'pg';

import { resolveOrganization, SeedStopError } from './seed-wyniki-dbr77.js';

// ==========================================
// Treść — wprost dopisana do zestawów i celów seeda DBR77
// ==========================================

interface SetPatch {
  title: string;
  description: string;
  reportGoal: string;
  /** Temat + zespół + termin per CEL (termin dziedziczą jego rezultaty). */
  objectives: { title: string; theme: string; team: string; deadline: string }[];
}

const SETS: SetPatch[] = [
  {
    title: 'OKR zakładu — Q4 2026',
    description:
      'Cele zakładu DBR77 na czwarty kwartał: terminowość wobec klienta, dostępność maszyn, koszt jakości i kompetencje utrzymania ruchu.',
    reportGoal:
      'Dowieźć mierzalną poprawę obsługi klienta i dostępności produkcji bez wzrostu kosztu jakości.',
    objectives: [
      {
        title: 'Ustabilizować terminowość dostaw do klienta',
        theme: 'Obsługa klienta',
        team: 'Planowanie i logistyka',
        deadline: '2026-12-15',
      },
      {
        title: 'Podnieść dostępność parku maszynowego',
        theme: 'Efektywność operacyjna',
        team: 'Utrzymanie ruchu',
        deadline: '2026-11-30',
      },
      {
        title: 'Ograniczyć koszt niskiej jakości',
        theme: 'Jakość i koszty',
        team: 'Jakość',
        deadline: '2026-12-31',
      },
      {
        title: 'Zbudować kompetencje utrzymania ruchu',
        theme: 'Ludzie i kompetencje',
        team: 'Utrzymanie ruchu',
        deadline: '2026-12-31',
      },
    ],
  },
  {
    title: 'OKR automatyzacji — Q4 2026',
    description:
      'Program automatyzacji: uruchomienie gniazda spawalniczego, kontrola wizyjna na montażu i przygotowanie magazynu WIP.',
    reportGoal:
      'Doprowadzić gniazdo spawalnicze do pracy produkcyjnej i domknąć warunki wstępne automatyzacji magazynu.',
    objectives: [
      {
        title: 'Uruchomić zrobotyzowane gniazdo spawalnicze',
        theme: 'Automatyzacja produkcji',
        team: 'Automatyzacja',
        deadline: '2026-11-30',
      },
      {
        title: 'Wdrożyć kontrolę wizyjną na linii montażu',
        theme: 'Automatyzacja produkcji',
        team: 'Jakość',
        deadline: '2026-12-15',
      },
      {
        title: 'Przygotować magazyn WIP do automatyzacji',
        theme: 'Przepływ materiału',
        team: 'Planowanie i logistyka',
        deadline: '2026-12-31',
      },
    ],
  },
  {
    title: 'OKR sprzedaży — H2 2026',
    description:
      'Cele sprzedaży na drugie półrocze: odbudowa eksportu, marża na wyrobach własnych i czas reakcji ofertowej.',
    reportGoal: 'Odzyskać wolumen eksportowy i podnieść marżę bez wydłużania cyklu ofertowania.',
    objectives: [
      {
        title: 'Odbudować sprzedaż eksportową',
        theme: 'Wzrost przychodów',
        team: 'Sprzedaż eksportowa',
        deadline: '2026-12-31',
      },
      {
        title: 'Zwiększyć marżę na wyrobach własnych',
        theme: 'Rentowność',
        team: 'Sprzedaż',
        deadline: '2026-12-31',
      },
      {
        title: 'Skrócić cykl ofertowania',
        theme: 'Wzrost przychodów',
        team: 'Ofertowanie',
        deadline: '2026-11-30',
      },
    ],
  },
];

// ==========================================
// Zapis
// ==========================================

interface Counters {
  sets: number;
  objectives: number;
  keyResults: number;
}

async function apply(client: PoolClient, organizationId: string): Promise<Counters> {
  const counters: Counters = { sets: 0, objectives: 0, keyResults: 0 };
  for (const set of SETS) {
    const setRow = await client.query<{ set_id: string }>(
      `UPDATE okr_vnext_sets
          SET description = COALESCE(description, $3),
              report_goal = COALESCE(report_goal, $4)
        WHERE organization_id = $1 AND title = $2
          AND (description IS NULL OR report_goal IS NULL)
        RETURNING set_id`,
      [organizationId, set.title, set.description, set.reportGoal]
    );
    counters.sets += setRow.rowCount ?? 0;

    // Identyfikator zestawu potrzebny jest także wtedy, gdy nagłówek był już
    // wypełniony (idempotencja) — dlatego czytamy go osobno, a nie z UPDATE.
    const found = await client.query<{ set_id: string }>(
      `SELECT set_id FROM okr_vnext_sets WHERE organization_id = $1 AND title = $2`,
      [organizationId, set.title]
    );
    const setId = found.rows[0]?.set_id;
    if (!setId) continue;

    for (const objective of set.objectives) {
      const objectiveRow = await client.query<{ objective_id: string }>(
        `UPDATE okr_vnext_objectives
            SET theme = COALESCE(theme, $4)
          WHERE organization_id = $1 AND set_id = $2 AND title = $3 AND theme IS NULL
          RETURNING objective_id`,
        [organizationId, setId, objective.title, objective.theme]
      );
      counters.objectives += objectiveRow.rowCount ?? 0;

      const foundObjective = await client.query<{ objective_id: string }>(
        `SELECT objective_id FROM okr_vnext_objectives
          WHERE organization_id = $1 AND set_id = $2 AND title = $3`,
        [organizationId, setId, objective.title]
      );
      const objectiveId = foundObjective.rows[0]?.objective_id;
      if (!objectiveId) continue;

      const keyResults = await client.query(
        `UPDATE okr_vnext_key_results
            SET team_name = COALESCE(team_name, $3),
                deadline  = COALESCE(deadline, $4::date)
          WHERE organization_id = $1 AND objective_id = $2
            AND (team_name IS NULL OR deadline IS NULL)`,
        [organizationId, objectiveId, objective.team, objective.deadline]
      );
      counters.keyResults += keyResults.rowCount ?? 0;
    }
  }
  return counters;
}

async function rollback(client: PoolClient, organizationId: string): Promise<Counters> {
  const counters: Counters = { sets: 0, objectives: 0, keyResults: 0 };
  for (const set of SETS) {
    const found = await client.query<{ set_id: string }>(
      `SELECT set_id FROM okr_vnext_sets WHERE organization_id = $1 AND title = $2`,
      [organizationId, set.title]
    );
    const setId = found.rows[0]?.set_id;
    if (!setId) continue;

    // Cofamy WYŁĄCZNIE wartości, które ten skrypt wpisał — porównanie z
    // treścią z tego pliku, żeby nie skasować cudzej, ręcznej edycji.
    const setRow = await client.query(
      `UPDATE okr_vnext_sets
          SET description = CASE WHEN description = $3 THEN NULL ELSE description END,
              report_goal = CASE WHEN report_goal = $4 THEN NULL ELSE report_goal END
        WHERE set_id = $2 AND organization_id = $1
          AND (description = $3 OR report_goal = $4)`,
      [organizationId, setId, set.description, set.reportGoal]
    );
    counters.sets += setRow.rowCount ?? 0;

    for (const objective of set.objectives) {
      const foundObjective = await client.query<{ objective_id: string }>(
        `SELECT objective_id FROM okr_vnext_objectives
          WHERE organization_id = $1 AND set_id = $2 AND title = $3`,
        [organizationId, setId, objective.title]
      );
      const objectiveId = foundObjective.rows[0]?.objective_id;
      if (!objectiveId) continue;

      const objectiveRow = await client.query(
        `UPDATE okr_vnext_objectives SET theme = NULL
          WHERE objective_id = $1 AND organization_id = $2 AND theme = $3`,
        [objectiveId, organizationId, objective.theme]
      );
      counters.objectives += objectiveRow.rowCount ?? 0;

      const keyResults = await client.query(
        `UPDATE okr_vnext_key_results
            SET team_name = CASE WHEN team_name = $3 THEN NULL ELSE team_name END,
                deadline  = CASE WHEN deadline = $4::date THEN NULL ELSE deadline END
          WHERE organization_id = $1 AND objective_id = $2
            AND (team_name = $3 OR deadline = $4::date)`,
        [organizationId, objectiveId, objective.team, objective.deadline]
      );
      counters.keyResults += keyResults.rowCount ?? 0;
    }
  }
  return counters;
}

/** Ile wierszy CZEKA na uzupełnienie — liczone przed zapisem, także w dry-run. */
async function pending(client: PoolClient, organizationId: string): Promise<Counters> {
  const counters: Counters = { sets: 0, objectives: 0, keyResults: 0 };
  const setTitles = SETS.map((set) => set.title);
  const objectiveTitles = SETS.flatMap((set) => set.objectives.map((o) => o.title));
  const sets = await client.query<{ n: string }>(
    `SELECT count(*)::text n FROM okr_vnext_sets
      WHERE organization_id = $1 AND title = ANY($2::text[])
        AND (description IS NULL OR report_goal IS NULL)`,
    [organizationId, setTitles]
  );
  counters.sets = Number(sets.rows[0]?.n ?? 0);
  const objectives = await client.query<{ n: string }>(
    `SELECT count(*)::text n FROM okr_vnext_objectives
      WHERE organization_id = $1 AND title = ANY($2::text[]) AND theme IS NULL`,
    [organizationId, objectiveTitles]
  );
  counters.objectives = Number(objectives.rows[0]?.n ?? 0);
  const keyResults = await client.query<{ n: string }>(
    `SELECT count(*)::text n FROM okr_vnext_key_results kr
       JOIN okr_vnext_objectives o ON o.objective_id = kr.objective_id
      WHERE kr.organization_id = $1 AND o.title = ANY($2::text[])
        AND (kr.team_name IS NULL OR kr.deadline IS NULL)`,
    [organizationId, objectiveTitles]
  );
  counters.keyResults = Number(keyResults.rows[0]?.n ?? 0);
  return counters;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const argOf = (name: string): string | undefined => {
    const hit = args.find((a) => a.startsWith(`--${name}=`));
    return hit ? hit.slice(name.length + 3) : undefined;
  };
  const mode = args.includes('--rollback')
    ? 'rollback'
    : args.includes('--apply')
      ? 'apply'
      : 'dry-run';
  const orgNeedle = argOf('org') ?? 'DBR77';
  const databaseUrl = argOf('database-url') ?? process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('Brak DATABASE_URL (albo --database-url=...)');

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: /sslmode=require|sslmode=verify/.test(databaseUrl)
      ? { rejectUnauthorized: false }
      : undefined,
    max: 2,
  });
  const client = await pool.connect();
  try {
    const org = await resolveOrganization(client, orgNeedle);
    process.stdout.write(`\n=== SEED WYNIKI · OKR · pola P7K ===\nTryb: ${mode}\n`);
    process.stdout.write(`Organizacja: ${org.name} (${org.id})\n`);

    const before = await pending(client, org.id);
    process.stdout.write(
      `Do uzupełnienia: zestawy ${before.sets}, cele ${before.objectives}, rezultaty ${before.keyResults}\n`
    );

    if (mode === 'dry-run') {
      process.stdout.write('Tryb --dry-run: nic nie zapisano.\n');
      return;
    }

    await client.query('BEGIN');
    const counters = mode === 'apply' ? await apply(client, org.id) : await rollback(client, org.id);
    await client.query('COMMIT');
    process.stdout.write(
      `Zapisano (${mode}): zestawy ${counters.sets}, cele ${counters.objectives}, rezultaty ${counters.keyResults}\n`
    );

    const after = await pending(client, org.id);
    process.stdout.write(
      `Zostało bez wartości: zestawy ${after.sets}, cele ${after.objectives}, rezultaty ${after.keyResults}\n`
    );
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    if (err instanceof SeedStopError) {
      process.stderr.write(`${err.message}\n`);
      process.exitCode = 2;
      return;
    }
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

void main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.stack : String(err)}\n`);
  process.exitCode = 1;
});
