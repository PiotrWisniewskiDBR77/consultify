#!/usr/bin/env tsx
/**
 * Naprawa danych: "PL · Silesia" w `organization_context.location`.
 *
 * BLOKER/WAŻNY audytu evidence/audyt-mvp-20260906/B3/RAPORT_B3.md (defekt #6):
 * ekran Organizacja → "Tożsamość i model działania" pokazuje "PL · Silesia" —
 * hybrydę PL/EN, mimo że `server/scripts/seed-interview-demo.ts:337` ma już
 * `location: 'PL · Śląskie'` od dawna. Przyczyna zmierzona na żywej lokalnej
 * bazie (nie zgadnięta): rekord ISTNIEJĄCEJ organizacji demo (DBR77,
 * `cc9db573-260f-4a19-927f-f3cc1fbaea38`) w `organization_context.location`
 * dalej niesie starą wartość "PL · Silesia" — poprawka seeda naprawiła tylko
 * PRZYSZŁE `upsertIfPossible` (ON CONFLICT DO UPDATE), ale seed nie został
 * ponownie uruchomiony dla tego konkretnego rekordu po zmianie.
 *
 * ZAKRES. Jedna tabela, jedna kolumna: `organization_context.location`.
 * Zweryfikowane bezpośrednio na bazie (docker exec psql, `\d organization_context`
 * + grep `Silesia` w `server/` i `src/`): to JEDYNE miejsce w schemacie, gdzie
 * słowo "Silesia" żyje jako DANE (w kodzie już wszędzie "Śląskie"). Siostrzana
 * tabela `organization_profiles.headquarters_country` sprawdzona — brak
 * wiersza dla DBR77 lokalnie, nie dotyczy tej naprawy.
 *
 * TRANSFORMACJA. Zamiana PODCIĄGU (nie całej wartości) `Silesia` → `Śląskie`
 * w `location` — bezpieczne dla dowolnego otoczenia słowa (np. "PL · Silesia"
 * → "PL · Śląskie"), NIE dotyka wierszy, które już mają "Śląskie" lub inną
 * wartość (filtr `location ILIKE '%Silesia%'` w SQL, powtórne uruchomienie
 * `--apply` = 0 dotkniętych wierszy → idempotentne).
 *
 * UŻYCIE:
 *   DATABASE_URL=… npx tsx server/scripts/napraw-region-silesia.ts --dry-run [--org=<id>]
 *   DATABASE_URL=… npx tsx server/scripts/napraw-region-silesia.ts --apply   [--org=<id>]
 * `--org=<id>` zawęża do jednej organizacji (domyślnie: WSZYSTKIE organizacje
 * z "Silesia" w `location` — na dziś zmierzone: dokładnie jedna, DBR77, ale
 * naprawa nie zakłada tego na sztywno). Bez `--dry-run`/`--apply` skrypt
 * kończy z błędem (żadna operacja domyślna).
 *
 * BEZPIECZEŃSTWO. Ten sam mechanizm doboru bazy co inne skrypty naprawcze
 * (`resolveScriptDatabaseTarget`, `requireExplicitTarget: true` — DATABASE_URL
 * musi być podany jawnie, brak cichego fallbacku na produkcję/demo).
 */
import { logSelectedDatabaseTarget, resolveScriptDatabaseTarget } from './lib/scriptDatabaseTarget.js';
import logger from '../src/utils/Logger.js';

type Db = {
  run: (sql: string, p?: unknown[]) => Promise<unknown>;
  query: <T>(sql: string, p?: unknown[]) => Promise<{ rows?: T[] }>;
};

interface AffectedRow {
  organization_id: string;
  location: string;
}

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return undefined;
  const eq = hit.indexOf('=');
  return eq === -1 ? '' : hit.slice(eq + 1);
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const apply = process.argv.includes('--apply');
  const orgFilter = arg('org');

  if (dryRun === apply) {
    console.error('[napraw-region-silesia] Podaj dokładnie jedną z opcji: --dry-run albo --apply.');
    process.exit(2);
  }

  const target = resolveScriptDatabaseTarget({
    label: 'napraw-region-silesia',
    databaseUrl: process.env.DATABASE_URL,
    publicDatabaseUrl: process.env.DATABASE_PUBLIC_URL,
    requireExplicitTarget: true,
    // Lokalne stanowisko NOC (127.0.0.1:54400) i staging DBR77 to oba
    // legalne cele tego skryptu — bez tej flagi loopback jest odrzucany
    // jako "wymagany zewnętrzny Postgres", co blokowałoby pilotaż lokalny
    // przed --apply na stagingu (patrz legacy-task-cutover-runner.ts).
    allowOnlyLoopback: true,
  });
  logSelectedDatabaseTarget('napraw-region-silesia', target);
  process.env.DATABASE_URL = target.connectionString;
  const { getDatabaseAsync } = await import('../src/database/Database.js');
  const db = (await getDatabaseAsync()) as unknown as Db;

  const params: unknown[] = [];
  let where = `location ILIKE '%Silesia%'`;
  if (orgFilter) {
    params.push(orgFilter);
    where += ` AND organization_id = $${params.length}`;
  }

  const { rows = [] } = await db.query<AffectedRow>(
    `SELECT organization_id, location FROM organization_context WHERE ${where} ORDER BY organization_id`,
    params
  );

  logger.info(
    `[napraw-region-silesia] org=${orgFilter || 'WSZYSTKIE'} apply=${apply}: ${rows.length} wierszy z "Silesia" w location`
  );
  for (const row of rows) {
    logger.info(`[napraw-region-silesia]   ${row.organization_id}: "${row.location}"`);
  }

  if (rows.length === 0) {
    logger.info('[napraw-region-silesia] Brak wierszy do naprawy — nic do zrobienia (idempotentne).');
    return;
  }

  if (!apply) {
    logger.info('[napraw-region-silesia] --dry-run: brak zapisu. Uruchom z --apply, aby zastosować.');
    return;
  }

  let patched = 0;
  for (const row of rows) {
    const next = row.location.replace(/Silesia/g, 'Śląskie');
    await db.run(
      `UPDATE organization_context SET location = $1, updated_at = $2 WHERE organization_id = $3`,
      [next, new Date().toISOString(), row.organization_id]
    );
    logger.info(`[napraw-region-silesia]   NAPRAWIONO ${row.organization_id}: "${row.location}" → "${next}"`);
    patched += 1;
  }

  logger.info(`[napraw-region-silesia] Gotowe — naprawiono ${patched} wierszy.`);
}

main().catch((e) => {
  console.error('[napraw-region-silesia] Failed:', e);
  process.exit(1);
});
