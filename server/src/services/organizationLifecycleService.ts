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
  securityManifest: {
    policyVersion: string;
    complete: boolean;
    truncated: boolean;
    scope: string;
    excludedTables: Array<{ table: string; reason: string }>;
    excludedColumns: Array<{ table: string; classes: string[]; count: number; reason: string }>;
  };
  totalRows: number;
}

interface ForeignKeyEdge {
  childTable: string;
  parentTable: string;
  childColumns: string[];
  parentColumns: string[];
}

const USER_EXPORT_COLUMNS = new Set([
  'id', 'organization_id', 'email', 'first_name', 'last_name', 'role', 'status',
  'avatar_url', 'title', 'timezone', 'locale', 'date_format', 'time_format',
  'first_day_of_week', 'accessibility_settings', 'notification_preferences',
  'ui_preferences', 'ai_assertiveness_level', 'ai_autonomy_level', 'job_title',
  'department', 'site_location', 'seniority_level', 'tenure_years', 'manages_team',
  'team_size', 'expertise_tags', 'display_name', 'pronouns', 'status_message',
  'out_of_office', 'vacation_end', 'location', 'company_name', 'language',
  'is_active', 'weekly_capacity_hours', 'availability_percent', 'created_at',
  'updated_at', 'last_login', 'last_login_at', 'onboarding_completed',
]);

const normalizedSecurityName = (name: string): string =>
  name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
const SECURITY_COLUMN_PATTERN = /(^|_)(password|passcode|secret|token|credential|mfa|otp|api_key|private_key|access_key|recovery|backup_codes?|hash|salt|cookie|authorization)($|_)/i;
const SECURITY_TABLE_PATTERN = /^(user_sessions?|auth_sessions?|refresh_tokens?|password_reset_tokens?|oauth_(tokens?|credentials?)|api_keys?|mfa_(secrets?|challenges?)|credentials?|secrets?|integration_secrets)$/i;
const EXPORT_POLICY_VERSION = 'tenant-export-safe-v3';
const QUERY_KEY_BATCH_SIZE = 500;

async function discoverTableColumns(client: PoolClient): Promise<Map<string, string[]>> {
  const result = await client.query<{ table_name: string; column_name: string }>(`
    SELECT table_name, column_name
      FROM information_schema.columns
     WHERE table_schema = 'public'
     ORDER BY table_name, ordinal_position`);
  const columns = new Map<string, string[]>();
  for (const row of result.rows) {
    const current = columns.get(row.table_name) || [];
    current.push(row.column_name);
    columns.set(row.table_name, current);
  }
  return columns;
}

async function discoverForeignKeyEdges(client: PoolClient): Promise<ForeignKeyEdge[]> {
  const result = await client.query<ForeignKeyEdge>(`
    SELECT child.relname AS "childTable", parent.relname AS "parentTable",
           array_agg(child_attribute.attname ORDER BY child_key.ordinality)::text[] AS "childColumns",
           array_agg(parent_attribute.attname ORDER BY child_key.ordinality)::text[] AS "parentColumns"
      FROM pg_constraint constraint_row
      JOIN pg_class child ON child.oid = constraint_row.conrelid
      JOIN pg_class parent ON parent.oid = constraint_row.confrelid
      JOIN pg_namespace namespace_row ON namespace_row.oid = child.relnamespace AND namespace_row.nspname = 'public'
      JOIN unnest(constraint_row.conkey) WITH ORDINALITY child_key(attnum, ordinality) ON true
      JOIN unnest(constraint_row.confkey) WITH ORDINALITY parent_key(attnum, ordinality)
        ON parent_key.ordinality = child_key.ordinality
      JOIN pg_attribute child_attribute ON child_attribute.attrelid = child.oid AND child_attribute.attnum = child_key.attnum
      JOIN pg_attribute parent_attribute ON parent_attribute.attrelid = parent.oid AND parent_attribute.attnum = parent_key.attnum
     WHERE constraint_row.contype = 'f' AND child.relkind = 'r' AND parent.relkind = 'r'
     GROUP BY child.relname, parent.relname, constraint_row.oid
     ORDER BY parent.relname, child.relname`);
  return result.rows;
}

function exportColumnsForTable(table: string, columns: string[]): string[] {
  if (table === 'users') return columns.filter((column) => USER_EXPORT_COLUMNS.has(column));
  return columns.filter((column) => !SECURITY_COLUMN_PATTERN.test(normalizedSecurityName(column)));
}

function projection(columns: string[]): string {
  if (columns.length === 0) return `ctid::text AS "__export_row_id"`;
  return `ctid::text AS "__export_row_id", ${columns.map(qi).join(', ')}`;
}

function sanitizeExportValue(value: unknown): unknown {
  if (typeof value === 'string' && /^[\[{]/.test(value.trim())) {
    try {
      return JSON.stringify(sanitizeExportValue(JSON.parse(value)));
    } catch {
      return value;
    }
  }
  if (Array.isArray(value)) return value.map(sanitizeExportValue);
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !SECURITY_COLUMN_PATTERN.test(normalizedSecurityName(key)))
        .map(([key, nested]) => [key, sanitizeExportValue(nested)])
    );
  }
  return value;
}

function publicRow(row: Record<string, unknown>): Record<string, unknown> {
  const { __export_row_id: _rowIdentity, ...safe } = row;
  return sanitizeExportValue(safe) as Record<string, unknown>;
}

export async function exportOrganizationData(
  client: PoolClient,
  organizationId: string
): Promise<OrganizationExportResult> {
  assertNotReservedOrganizationId(organizationId);

  const allColumns = await discoverTableColumns(client);
  const foreignKeys = await discoverForeignKeyEdges(client);
  const securityTables = new Set(
    [...allColumns.keys()].filter((table) => SECURITY_TABLE_PATTERN.test(table))
  );
  const safeColumns = new Map<string, string[]>();
  const excludedColumns: Array<{ table: string; classes: string[]; count: number; reason: string }> = [];
  for (const [table, columns] of allColumns) {
    if (securityTables.has(table)) continue;
    const safe = exportColumnsForTable(table, columns);
    safeColumns.set(table, safe);
    const excluded = columns.filter((column) => !safe.includes(column));
    if (excluded.length > 0) {
      excludedColumns.push({
        table,
        classes: table === 'users'
          ? ['authentication', 'session_recovery', 'linked_identity']
          : ['credential_or_security_material'],
        count: excluded.length,
        reason: 'security_class_excluded',
      });
    }
  }

  const organizationColumns = safeColumns.get('organizations') || [];
  const orgRow = await client.query(
    `SELECT ${projection(organizationColumns)} FROM organizations WHERE id = $1`,
    [organizationId]
  );
  if (orgRow.rowCount === 0) {
    throw Object.assign(new Error('Organization not found'), { code: 'ORG_NOT_FOUND' });
  }

  const kolumny = await discoverOrganizationScopedColumns(client);
  const organizationScopeByTable = new Map<string, string[]>();
  for (const scoped of kolumny) {
    const current = organizationScopeByTable.get(scoped.tabela) || [];
    if (!current.includes(scoped.kolumna)) current.push(scoped.kolumna);
    organizationScopeByTable.set(scoped.tabela, current);
  }
  const rawRows = new Map<string, Map<string, Record<string, unknown>>>();
  const queue: string[] = [];
  const addRows = (table: string, rows: Record<string, unknown>[]) => {
    const tableRows = rawRows.get(table) || new Map<string, Record<string, unknown>>();
    let added = false;
    for (const row of rows) {
      const identity = String(row.__export_row_id || JSON.stringify(row));
      if (!tableRows.has(identity)) {
        tableRows.set(identity, row);
        added = true;
      }
    }
    rawRows.set(table, tableRows);
    if (added && !queue.includes(table)) queue.push(table);
  };
  addRows('organizations', orgRow.rows);

  for (const scoped of kolumny) {
    if (securityTables.has(scoped.tabela)) continue;
    const columns = safeColumns.get(scoped.tabela);
    if (!columns) throw new Error(`EXPORT_SCHEMA_MISSING:${scoped.tabela}`);
    // eslint-disable-next-line no-await-in-loop
    const result = await client.query(
      `SELECT ${projection(columns)} FROM ${qi(scoped.tabela)} WHERE ${qi(scoped.kolumna)}::text = $1`,
      [organizationId]
    );
    addRows(scoped.tabela, result.rows);
  }

  while (queue.length > 0) {
    const parentTable = queue.shift()!;
    const parentRows = [...(rawRows.get(parentTable)?.values() || [])];
    for (const edge of foreignKeys.filter((candidate) => candidate.parentTable === parentTable)) {
      if (securityTables.has(edge.childTable)) continue;
      const childColumns = safeColumns.get(edge.childTable);
      if (!childColumns) throw new Error(`EXPORT_SCHEMA_MISSING:${edge.childTable}`);
      if (edge.parentColumns.some((column) => !safeColumns.get(parentTable)?.includes(column)) ||
          edge.childColumns.some((column) => !childColumns.includes(column))) {
        throw new Error(`EXPORT_SECURITY_EDGE_UNSUPPORTED:${parentTable}:${edge.childTable}`);
      }
      const childOrganizationColumns = organizationScopeByTable.get(edge.childTable) || [];
      const childHasOrganizationScope = childOrganizationColumns.length > 0;
      // A user may belong to more than one tenant. A user FK without an explicit tenant
      // discriminator cannot prove ownership of the child row, so it must not be traversed.
      if (parentTable === 'users' && !childHasOrganizationScope) continue;
      const tuples = parentRows
        .map((row) => edge.parentColumns.map((column) => row[column]))
        .filter((values) => values.every((value) => value !== null && value !== undefined));
      for (let offset = 0; offset < tuples.length; offset += QUERY_KEY_BATCH_SIZE) {
        const batch = tuples.slice(offset, offset + QUERY_KEY_BATCH_SIZE);
        if (batch.length === 0) continue;
        const params = batch.flat();
        const width = edge.childColumns.length;
        const placeholders = batch.map((_, tupleIndex) =>
          `(${edge.childColumns.map((__, columnIndex) => `$${tupleIndex * width + columnIndex + 1}`).join(',')})`
        ).join(',');
        // eslint-disable-next-line no-await-in-loop
        const result = await client.query(
          `SELECT ${projection(childColumns)} FROM ${qi(edge.childTable)} WHERE (${edge.childColumns.map(qi).join(',')}) IN (${placeholders})${childHasOrganizationScope ? ` AND (${childOrganizationColumns.map((column) => `${qi(column)}::text = $${params.length + 1}`).join(' OR ')})` : ''}`,
          childHasOrganizationScope ? [...params, organizationId] : params
        );
        addRows(edge.childTable, result.rows);
      }
    }
  }

  const tables: Record<string, Record<string, unknown>[]> = {};
  const rowCounts: Record<string, number> = {};
  let totalRows = 0;
  for (const [table, rowsByIdentity] of rawRows) {
    if (table === 'organizations' || rowsByIdentity.size === 0) continue;
    const rows = [...rowsByIdentity.values()].map(publicRow);
    tables[table] = rows;
    rowCounts[table] = rows.length;
    totalRows += rows.length;
  }

  return {
    organization: publicRow(orgRow.rows[0]) || null,
    exportedAt: new Date().toISOString(),
    tables,
    rowCounts,
    skipped: [],
    securityManifest: {
      policyVersion: EXPORT_POLICY_VERSION,
      complete: true,
      truncated: false,
      scope: 'all tenant rows reachable by exact organization scope or foreign-key descendants, excluding declared security classes',
      excludedTables: [...securityTables].sort().map((table) => ({
        table,
        reason: 'credential_session_or_security_material',
      })),
      excludedColumns,
    },
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
