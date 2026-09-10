/**
 * organizationLifecycleService — eksport i trwałe usunięcie WSZYSTKICH danych
 * jednej organizacji, wołane z realnego endpointu HTTP (nie ze skryptu operatora).
 *
 * P5 (kryterium 12, S2.7, docs/program/TRZY_POJEMNIKI_PRACY_20260906.md):
 * eksport organizacji do pliku i usunięcie na żądanie mają działać z interfejsu.
 *
 * BEZPIECZEŃSTWO — WZORZEC PRZEJĘTY Z `scripts/dane/usun-organizacje.ts`:
 * Ten sam incydent z 09.09.2026 (patrz `server/tests/dane-sieroty/wzorcowe.test.ts`)
 * pokazał, że kasowanie „sierot" po wzorcu potrafi zabrać wiersze konfiguracji
 * produktu (`organization_id IN ('*','__system__','__global__','')`). Tu ryzyko
 * jest strukturalnie mniejsze — każde zapytanie filtruje `kolumna::text = $1`
 * dokładnym, jednym identyfikatorem organizacji, nigdy wzorcem — ale identyczna
 * lista wartości zastrzeżonych jest i tak odrzucana na wejściu (`RESERVED_ORGANIZATION_IDS`),
 * żeby nikt nie mógł nawet w teorii wywołać usunięcia dla '*'.
 *
 * Odkrywanie tabel organizacyjnych jest DYNAMICZNE (czyta `pg_constraint` +
 * `information_schema`), a nie zaszytą listą — dokładnie z tego samego powodu,
 * co w skrypcie operatora: lista tabel z `organization_id` zmienia się z każdym
 * tygodniem migracji i zaszyta lista gnije w kilka tygodni (zmierzone tam:
 * 164 FK → 294 FK w siedem tygodni).
 */
import type { PoolClient } from 'pg';

import logger from '../utils/Logger.js';

// ============================================================================
// Stałe bezpieczeństwa
// ============================================================================

/** Wartości, których NIGDY nie wolno traktować jako identyfikator organizacji
 *  do usunięcia/eksportu — te same, którymi `scripts/dane/usun-organizacje.ts`
 *  (`ORGANIZACJE_WZORCOWE`) chroni bazową konfigurację produktu. */
export const RESERVED_ORGANIZATION_IDS = ['*', '__system__', '__global__', ''] as const;

export function assertNotReservedOrganizationId(organizationId: string): void {
  const normalized = (organizationId || '').trim();
  if ((RESERVED_ORGANIZATION_IDS as readonly string[]).includes(normalized)) {
    throw new Error(
      `Refusing to operate on reserved organization id "${organizationId}" — this is product baseline configuration, not a tenant.`
    );
  }
}

// ============================================================================
// Odkrywanie tabel powiązanych z organizacją
// ============================================================================

export interface KolumnaOrganizacji {
  tabela: string;
  kolumna: string;
  typ: string;
}

const qi = (id: string): string => `"${id.replace(/"/g, '""')}"`;

/**
 * Wszystkie tabele publiczne mające albo (a) klucz obcy do `organizations`,
 * albo (b) kolumnę dosłownie nazwaną `organization_id` — suma tych dwóch
 * zbiorów, bo część tabel trzyma `organization_id` BEZ deklarowanego FK
 * (dokładnie ten mechanizm zostawił 38 715 sierot w bazie, patrz komentarz
 * w `scripts/dane/usun-organizacje.ts`). Zapytanie 1:1 z `kolumnyOrganizacji`
 * tamtego skryptu — jedno źródło prawdy dla dwóch konsumentów (CLI operatora
 * i ten serwis) byłoby ładniejsze, ale `scripts/` i `server/src/` mają osobne
 * granice budowania; zapytanie SQL jest na tyle krótkie i bez zależności, że
 * duplikacja jest tańsza niż crosslink między dwoma tsconfigami.
 */
export async function discoverOrganizationScopedColumns(
  client: PoolClient
): Promise<KolumnaOrganizacji[]> {
  const r = await client.query<KolumnaOrganizacji>(`
    WITH z_fk AS (
      SELECT src.relname AS tabela, sa.attname AS kolumna
        FROM pg_constraint con
        JOIN pg_class src ON src.oid = con.conrelid
        JOIN pg_class tgt ON tgt.oid = con.confrelid
        JOIN pg_namespace n ON n.oid = src.relnamespace AND n.nspname = 'public'
        JOIN unnest(con.conkey) WITH ORDINALITY AS k(attnum, ord) ON true
        JOIN pg_attribute sa ON sa.attrelid = src.oid AND sa.attnum = k.attnum
       WHERE con.contype = 'f' AND tgt.relname = 'organizations'
    ),
    po_nazwie AS (
      SELECT c.relname AS tabela, a.attname AS kolumna
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
        JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
       WHERE c.relkind = 'r' AND a.attname = 'organization_id'
    ),
    razem AS (SELECT * FROM z_fk UNION SELECT * FROM po_nazwie)
    SELECT r.tabela, r.kolumna, format_type(a.atttypid, a.atttypmod) AS typ
      FROM razem r
      JOIN pg_class c ON c.relname = r.tabela
      JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public' AND c.relkind = 'r'
      JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = r.kolumna
     WHERE r.tabela <> 'organizations'
     ORDER BY 1, 2`);
  return r.rows;
}

// ============================================================================
// EKSPORT
// ============================================================================

export interface OrganizationExportResult {
  organization: Record<string, unknown> | null;
  exportedAt: string;
  tables: Record<string, Record<string, unknown>[]>;
  rowCounts: Record<string, number>;
  skipped: Array<{ tabela: string; kolumna: string; reason: string }>;
  totalRows: number;
}

/** Limit wierszy PER TABELA w jednym eksporcie — ochrona przed nieograniczonym
 *  rozmiarem pliku dla organizacji z bardzo długą historią (np. activity_logs). */
const MAX_ROWS_PER_TABLE = 20_000;

export async function exportOrganizationData(
  client: PoolClient,
  organizationId: string
): Promise<OrganizationExportResult> {
  assertNotReservedOrganizationId(organizationId);

  const orgRow = await client.query('SELECT * FROM organizations WHERE id = $1', [
    organizationId,
  ]);
  if (orgRow.rowCount === 0) {
    throw Object.assign(new Error('Organization not found'), { code: 'ORG_NOT_FOUND' });
  }

  const kolumny = await discoverOrganizationScopedColumns(client);
  const tables: Record<string, Record<string, unknown>[]> = {};
  const rowCounts: Record<string, number> = {};
  const skipped: Array<{ tabela: string; kolumna: string; reason: string }> = [];
  let totalRows = 0;

  for (const k of kolumny) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const res = await client.query(
        `SELECT * FROM ${qi(k.tabela)} WHERE ${qi(k.kolumna)}::text = $1 LIMIT ${MAX_ROWS_PER_TABLE}`,
        [organizationId]
      );
      if (res.rowCount && res.rowCount > 0) {
        const key = kolumny.filter((x) => x.tabela === k.tabela).length > 1
          ? `${k.tabela}.${k.kolumna}`
          : k.tabela;
        tables[key] = res.rows;
        rowCounts[key] = res.rowCount;
        totalRows += res.rowCount;
      }
    } catch (err: any) {
      logger.warn('[OrgLifecycle] Export: skipping table due to read error', {
        tabela: k.tabela,
        kolumna: k.kolumna,
        err: err?.message,
      });
      skipped.push({ tabela: k.tabela, kolumna: k.kolumna, reason: err?.message || 'unknown' });
    }
  }

  return {
    organization: orgRow.rows[0] || null,
    exportedAt: new Date().toISOString(),
    tables,
    rowCounts,
    skipped,
    totalRows,
  };
}

/** Zamienia wynik eksportu na jeden CSV: `table,row_index,data_json`. Format
 *  spłaszczony celowo — tabele mają różne, zmieniające się zestawy kolumn;
 *  JSON per wiersz jest jedynym reprezentowalnym w CSV kształtem bez utraty
 *  danych. Klient może dociąć/rozpakować kolumnę `data_json` narzędziem wg
 *  wyboru (jq, pandas, Excel Power Query). */
export function organizationExportToCsv(result: OrganizationExportResult): string {
  const lines = ['table,row_index,data_json'];
  const escapeCsv = (v: string): string => `"${v.replace(/"/g, '""')}"`;
  if (result.organization) {
    lines.push(
      `${escapeCsv('organizations')},0,${escapeCsv(JSON.stringify(result.organization))}`
    );
  }
  for (const [table, rows] of Object.entries(result.tables)) {
    rows.forEach((row, idx) => {
      lines.push(`${escapeCsv(table)},${idx},${escapeCsv(JSON.stringify(row))}`);
    });
  }
  return lines.join('\n');
}

// ============================================================================
// USUNIĘCIE
// ============================================================================

export interface OrganizationDeletionResult {
  organizationId: string;
  organizationName: string;
  deletedCounts: Record<string, number>;
  passes: number;
}

const MAX_PASSES = 6;
/** Kody błędów Postgres, które oznaczają „ta tabela ma jeszcze blokujące
 *  dziecko — spróbuj ponownie w kolejnym przebiegu", a nie realną awarię. */
const RETRYABLE_PG_ERROR_CODES = new Set(['23503']); // foreign_key_violation

/**
 * Usuwa WSZYSTKIE wiersze jednej organizacji ze WSZYSTKICH tabel odkrytych
 * przez `discoverOrganizationScopedColumns`, a na końcu sam wiersz w
 * `organizations`. Musi być wołane na kliencie z otwartą transakcją
 * (`BEGIN` już wykonany przez wywołującego) — funkcja NIE robi commit/rollback
 * całej transakcji, tylko SAVEPOINT per tabela per przebieg (analogicznie do
 * `trybApply` w `scripts/dane/usun-organizacje.ts`: „pętla zbieżna, savepoint
 * per tabela"), żeby jedna zablokowana tabela nie ubijała całej transakcji.
 *
 * Rzuca, jeśli po `MAX_PASSES` przebiegach zostają tabele nie do skasowania —
 * wywołujący MUSI wtedy zrobić ROLLBACK całej transakcji (fail closed, żadnego
 * częściowego usunięcia).
 */
export async function deleteOrganizationDataInTransaction(
  client: PoolClient,
  organizationId: string
): Promise<OrganizationDeletionResult> {
  assertNotReservedOrganizationId(organizationId);

  const orgRow = await client.query<{ id: string; name: string | null }>(
    'SELECT id, name FROM organizations WHERE id = $1 FOR UPDATE',
    [organizationId]
  );
  if (orgRow.rowCount === 0) {
    throw Object.assign(new Error('Organization not found'), { code: 'ORG_NOT_FOUND' });
  }
  const organizationName = orgRow.rows[0]!.name || '';

  const kolumny = await discoverOrganizationScopedColumns(client);
  let pending = kolumny.slice();
  const deletedCounts: Record<string, number> = {};
  let passCount = 0;

  for (let pass = 0; pass < MAX_PASSES && pending.length > 0; pass++) {
    passCount = pass + 1;
    const stillPending: KolumnaOrganizacji[] = [];
    for (const k of pending) {
      const savepoint = `sp_${pass}_${stillPending.length}`;
      // eslint-disable-next-line no-await-in-loop
      await client.query(`SAVEPOINT ${qi(savepoint)}`);
      try {
        // eslint-disable-next-line no-await-in-loop
        const res = await client.query(
          `DELETE FROM ${qi(k.tabela)} WHERE ${qi(k.kolumna)}::text = $1`,
          [organizationId]
        );
        // eslint-disable-next-line no-await-in-loop
        await client.query(`RELEASE SAVEPOINT ${qi(savepoint)}`);
        const key = kolumny.filter((x) => x.tabela === k.tabela).length > 1
          ? `${k.tabela}.${k.kolumna}`
          : k.tabela;
        deletedCounts[key] = (deletedCounts[key] || 0) + (res.rowCount || 0);
      } catch (err: any) {
        // eslint-disable-next-line no-await-in-loop
        await client.query(`ROLLBACK TO SAVEPOINT ${qi(savepoint)}`);
        if (RETRYABLE_PG_ERROR_CODES.has(err?.code)) {
          stillPending.push(k);
        } else {
          logger.error('[OrgLifecycle] Delete: non-retryable error, aborting', {
            tabela: k.tabela,
            kolumna: k.kolumna,
            code: err?.code,
            message: err?.message,
          });
          throw err;
        }
      }
    }
    pending = stillPending;
  }

  if (pending.length > 0) {
    const nazwy = pending.map((k) => `${k.tabela}.${k.kolumna}`).join(', ');
    throw Object.assign(
      new Error(
        `Could not delete organization-scoped rows in ${pending.length} table(s) after ${MAX_PASSES} passes (still FK-blocked): ${nazwy}`
      ),
      { code: 'ORG_DELETE_BLOCKED', tables: pending }
    );
  }

  await client.query(`SAVEPOINT ${qi('sp_final_org_row')}`);
  try {
    const delOrg = await client.query('DELETE FROM organizations WHERE id = $1', [organizationId]);
    await client.query(`RELEASE SAVEPOINT ${qi('sp_final_org_row')}`);
    deletedCounts['organizations'] = delOrg.rowCount || 0;
  } catch (err) {
    await client.query(`ROLLBACK TO SAVEPOINT ${qi('sp_final_org_row')}`);
    throw err;
  }

  return { organizationId, organizationName, deletedCounts, passes: passCount };
}
