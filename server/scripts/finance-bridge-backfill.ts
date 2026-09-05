#!/usr/bin/env tsx
/**
 * Finance v3 — jednorazowy, IDEMPOTENTNY backfill tożsamości kanonicznej dla
 * zastanych rekordów Finansów (ID BRIDGE, strona zapisu).
 *
 * ★ PO CO: `finance_artifact_aliases` (most legacy → kanoniczny) zapisywał
 * dotąd wyłącznie backfill WP-C03 `finance-v3-backfill-dry-run.ts`, który z
 * założenia biegnie na jednorazowym, wyrzucanym Postgresie i NIGDY nie został
 * uruchomiony na żywym środowisku. Skutkiem — zmierzonym 2026-09-05 —
 * `FinanceLegacyBridgeGate` zwracał „unresolved" dla KAŻDEGO realnego rekordu i
 * 11 z 13 zatwierdzonych ekranów Finansów nigdy się nie montowało.
 *
 * Forward-fix (osobne commity tej samej gałęzi) sprawia, że tożsamość powstaje
 * LENIWIE przy pierwszym otwarciu rekordu — ten skrypt jest jego hurtową
 * połową: przygotowuje tożsamość dla wszystkich rekordów naraz, żeby pierwsze
 * otwarcie nie płaciło za zapis i żeby dało się policzyć pokrycie PRZED
 * odbiorem. Oba używają DOKŁADNIE tej samej funkcji
 * (`ensureLegacyFinanceArtifactIdentity`), więc nie mogą się rozjechać.
 *
 * CZEGO NIE ROBI: nie kopiuje ani nie zgaduje żadnych DANYCH finansowych.
 * Materializuje wyłącznie tożsamość (artefakt + wersja + alias). Treść
 * kanoniczna pozostaje pusta, dopóki nikt jej nie wprowadzi — warsztat v3
 * pokazuje wtedy swój własny, uczciwy stan pusty, nigdy dane udawane.
 *
 * IDEMPOTENCJA: drugi przebieg nie tworzy ani jednego nowego artefaktu ani
 * aliasu (advisory lock + `uq_finance_artifacts_org_natural_key` +
 * `uq_finance_alias_legacy` + `ON CONFLICT DO NOTHING`). Raport rozróżnia
 * `utworzone` od `już istniało`, żeby to było WIDAĆ, a nie trzeba było wierzyć.
 *
 * Bezpieczeństwo:
 *  - DRY-RUN domyślnie: bez `--write` skrypt tylko LICZY kandydatów, zero zapisów.
 *  - `--org=<id>` zawęża do jednej organizacji (zalecane na pierwszy przebieg).
 *  - `--limit=<n>` ogranicza liczbę rekordów na tabelę (przebieg próbny).
 *  - Nigdy nie nadpisuje aliasu z kwarantanny — rekord świadomie wykluczony
 *    przez WP-C03 zostaje wykluczony.
 *
 * Użycie:
 *   npx tsx server/scripts/finance-bridge-backfill.ts                     # dry run, wszystkie organizacje
 *   npx tsx server/scripts/finance-bridge-backfill.ts --org=<orgId>       # dry run, jedna organizacja
 *   npx tsx server/scripts/finance-bridge-backfill.ts --org=<orgId> --write
 *
 * Na stagingu (baza z .env.staging.local, NIGDY produkcja):
 *   DOTENV_IGNORE_LOCAL=1 ENV_FILE=.env.staging.local DB_TYPE=postgres \
 *     npx tsx server/scripts/finance-bridge-backfill.ts --org=<orgId> --write
 */
import pg from 'pg';

import { resolveReachableDatabaseUrl } from '../src/config/databaseTargetResolver.js';
import {
  LEGACY_FINANCE_TABLES,
  canonicalArtifactTypesForLegacyTable,
  type LegacyFinanceTable,
} from '../src/services/finance/canonical/legacyIdBridgeService.js';
import { ensureLegacyFinanceArtifactIdentity } from '../src/services/finance/canonical/legacyIdentityMaterializationService.js';
import logger from '../src/utils/Logger.js';

/** Aktor zapisany w `created_by` materializowanych wierszy — nigdy prawdziwy użytkownik, żeby dało się odróżnić tożsamość z backfillu od tej z ręki. */
const BACKFILL_ACTOR = 'system:finance-bridge-backfill';

export interface BackfillCounters {
  candidates: number;
  created: number;
  alreadyMapped: number;
  quarantined: number;
  skipped: number;
  failed: number;
}

export interface BackfillReport {
  perTable: Record<string, BackfillCounters>;
  total: BackfillCounters;
}

function emptyCounters(): BackfillCounters {
  return { candidates: 0, created: 0, alreadyMapped: 0, quarantined: 0, skipped: 0, failed: 0 };
}

function addCounters(target: BackfillCounters, source: BackfillCounters): void {
  target.candidates += source.candidates;
  target.created += source.created;
  target.alreadyMapped += source.alreadyMapped;
  target.quarantined += source.quarantined;
  target.skipped += source.skipped;
  target.failed += source.failed;
}

export interface RunBackfillOptions {
  client: pg.Client | pg.Pool;
  organizationId?: string;
  limit?: number;
  write: boolean;
  onProgress?: (line: string) => void;
}

/**
 * Rekordy legacy, które NIE mają jeszcze aliasu w tej organizacji — to jest
 * definicja „kandydata". Zapytanie jest jedynym miejscem, gdzie ten skrypt sam
 * dotyka SQL-a; cała reszta idzie przez wspólną funkcję materializacji.
 */
async function selectCandidates(
  client: pg.Client | pg.Pool,
  legacyTable: LegacyFinanceTable,
  organizationId: string | undefined,
  limit: number | undefined
): Promise<Array<{ id: string; organization_id: string }>> {
  const params: unknown[] = [legacyTable];
  let orgClause = '';
  if (organizationId) {
    params.push(organizationId);
    orgClause = `AND legacy.organization_id = $${params.length}`;
  }
  let limitClause = '';
  if (limit && limit > 0) {
    params.push(limit);
    limitClause = `LIMIT $${params.length}`;
  }
  const res = await client.query<{ id: string; organization_id: string }>(
    `SELECT legacy.id, legacy.organization_id
       FROM ${legacyTable} legacy
       JOIN organizations org ON org.id = legacy.organization_id
      WHERE NOT EXISTS (
              SELECT 1 FROM finance_artifact_aliases alias
               WHERE alias.legacy_table = $1
                 AND alias.legacy_id = legacy.id
                 AND alias.organization_id = legacy.organization_id
            )
        ${orgClause}
      ORDER BY legacy.id
      ${limitClause}`,
    params
  );
  return res.rows;
}

export async function runFinanceBridgeBackfill(
  options: RunBackfillOptions
): Promise<BackfillReport> {
  const perTable: Record<string, BackfillCounters> = {};
  const total = emptyCounters();

  for (const legacyTable of LEGACY_FINANCE_TABLES) {
    const counters = emptyCounters();
    const candidates = await selectCandidates(
      options.client,
      legacyTable,
      options.organizationId,
      options.limit
    );
    counters.candidates = candidates.length;

    if (options.write) {
      for (const row of candidates) {
        // `financial_models` karmi dwa warsztaty — materializujemy tożsamość dla
        // OBU typów, bo lista pokazuje ten sam wiersz w zakładce Modele i w
        // Predykcji, a każdy warsztat potrzebuje własnego artefaktu kanonicznego.
        for (const artifactType of canonicalArtifactTypesForLegacyTable(legacyTable)) {
          try {
            const result = await ensureLegacyFinanceArtifactIdentity({
              organizationId: row.organization_id,
              userId: BACKFILL_ACTOR,
              legacyTable,
              legacyId: row.id,
              expectedArtifactType: artifactType,
            });
            if (result.status === 'RESOLVED') {
              if (result.created) counters.created += 1;
              else counters.alreadyMapped += 1;
            } else if (result.status === 'QUARANTINED') {
              counters.quarantined += 1;
            } else {
              // Wiersz zniknął między SELECT-em a zapisem albo należy do innej
              // organizacji — fail-closed, nie zgadujemy.
              counters.skipped += 1;
            }
          } catch (error) {
            counters.failed += 1;
            logger.error(
              `[finance-bridge-backfill] ${legacyTable}/${row.id} (${artifactType}) failed: ${
                (error as Error).message
              }`
            );
          }
        }
      }
    }

    perTable[legacyTable] = counters;
    addCounters(total, counters);
    options.onProgress?.(
      `${legacyTable}: kandydaci=${counters.candidates} utworzone=${counters.created} ` +
        `już-istniało=${counters.alreadyMapped} kwarantanna=${counters.quarantined} ` +
        `pominięte=${counters.skipped} błędy=${counters.failed}`
    );
  }

  return { perTable, total };
}

function env(name: string): string | undefined {
  const value = String(process.env[name] || '').trim();
  return value || undefined;
}

async function main(): Promise<void> {
  const write = process.argv.includes('--write');
  const orgArg = process.argv.find((a) => a.startsWith('--org='));
  const limitArg = process.argv.find((a) => a.startsWith('--limit='));
  const organizationId = orgArg ? orgArg.split('=')[1]?.trim() || undefined : undefined;
  const limit = limitArg ? Number.parseInt(limitArg.split('=')[1] || '', 10) : undefined;

  const resolved = resolveReachableDatabaseUrl({
    databaseUrl: env('DATABASE_URL'),
    publicDatabaseUrl: env('DATABASE_PUBLIC_URL'),
  });
  if (!resolved.databaseUrl) {
    throw new Error('DATABASE_URL jest wymagane dla finance-bridge-backfill');
  }
  if (resolved.reason) logger.warn(`[finance-bridge-backfill] ${resolved.reason}`);

  const client = new pg.Client({ connectionString: resolved.databaseUrl });
  await client.connect();
  try {
    logger.info(
      `[finance-bridge-backfill] tryb=${write ? 'ZAPIS' : 'DRY-RUN'} organizacja=${
        organizationId ?? '(wszystkie)'
      } limit=${limit ?? '(brak)'}`
    );
    const report = await runFinanceBridgeBackfill({
      client,
      organizationId,
      limit: Number.isFinite(limit as number) ? (limit as number) : undefined,
      write,
      onProgress: (line) => logger.info(`[finance-bridge-backfill] ${line}`),
    });
    logger.info(
      `[finance-bridge-backfill] RAZEM kandydaci=${report.total.candidates} ` +
        `utworzone=${report.total.created} już-istniało=${report.total.alreadyMapped} ` +
        `kwarantanna=${report.total.quarantined} pominięte=${report.total.skipped} ` +
        `błędy=${report.total.failed}`
    );
    if (!write) {
      logger.info(
        '[finance-bridge-backfill] DRY-RUN — nic nie zapisano. Dodaj --write, aby zastosować.'
      );
    }
    if (report.total.failed > 0) process.exitCode = 1;
  } finally {
    await client.end().catch(() => undefined);
  }
}

const invokedDirectly =
  process.argv[1] !== undefined && process.argv[1].includes('finance-bridge-backfill');
if (invokedDirectly) {
  main().catch((error) => {
    logger.error(`[finance-bridge-backfill] ${(error as Error).message}`);
    process.exit(1);
  });
}
