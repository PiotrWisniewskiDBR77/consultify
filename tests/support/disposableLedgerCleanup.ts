import type { Client } from 'pg';

const ENABLE_ENV = 'CLOSURE_EVIDENCE_ALLOW_IMMUTABLE_FIXTURE_CLEANUP';
const PREFIX_ENV = 'CLOSURE_EVIDENCE_DISPOSABLE_DB_PREFIX';

type AppendOnlyLedger =
  | 'initiative_closure_evidence'
  | 'initiative_lifecycle_gate_decisions'
  | 'execution_action_audit';

const LEDGER_TRIGGER: Record<AppendOnlyLedger, string> = {
  initiative_closure_evidence: 'trg_initiative_closure_evidence_append_only',
  initiative_lifecycle_gate_decisions: 'initiative_lifecycle_gate_decisions_immutable',
  execution_action_audit: 'trg_execution_action_audit_immutable',
};

export interface LedgerScope {
  ledger: AppendOnlyLedger;
  column: 'id' | 'decision_id' | 'organization_id' | 'initiative_id' | 'closure_request_id';
  values?: string[];
  prefix?: string;
}

export interface DeleteLedgerRowsOptions {
  /** Test-only fault injection proving transaction rollback restores the trigger. */
  forceFailureAfterDisable?: boolean;
}

export class UnsafeCleanupTargetError extends Error {}

export async function assertDisposableDatabase(client: Client): Promise<string> {
  if (process.env[ENABLE_ENV] !== '1') {
    throw new UnsafeCleanupTargetError(`${ENABLE_ENV}=1 is required`);
  }
  const prefix = String(process.env[PREFIX_ENV] ?? '').trim();
  if (!prefix) throw new UnsafeCleanupTargetError(`${PREFIX_ENV} is required`);

  const result = await client.query<{ db: string }>('SELECT current_database() AS db');
  const database = String(result.rows[0]?.db ?? '');
  if (!database.startsWith(prefix)) {
    throw new UnsafeCleanupTargetError(
      `Refusing immutable fixture cleanup outside disposable database prefix ${prefix}`
    );
  }
  return database;
}

/**
 * Removes only explicitly named immutable-ledger rows. Trigger suspension and
 * restoration are transactional; rollback restores the production guard even
 * when cleanup fails after DISABLE TRIGGER.
 */
export async function deleteLedgerRows(
  client: Client,
  scopes: LedgerScope[],
  options: DeleteLedgerRowsOptions = {}
): Promise<Record<string, number>> {
  await assertDisposableDatabase(client);
  const usable = scopes.filter((scope) => (scope.values?.length ?? 0) > 0 || Boolean(scope.prefix));
  if (usable.length === 0) return {};

  const removed: Record<string, number> = {};
  await client.query('BEGIN');
  try {
    await client.query(
      `SELECT pg_advisory_xact_lock(hashtext('closure-evidence-fixture-cleanup'))`
    );
    const ledgers = [...new Set(usable.map((scope) => scope.ledger))];
    for (const ledger of ledgers) {
      await client.query(`ALTER TABLE ${ledger} DISABLE TRIGGER ${LEDGER_TRIGGER[ledger]}`);
    }
    if (options.forceFailureAfterDisable) {
      throw new Error('forced immutable fixture cleanup failure after trigger disable');
    }

    for (const scope of usable) {
      const key = `${scope.ledger}.${scope.column}`;
      const result = scope.prefix
        ? await client.query(`DELETE FROM ${scope.ledger} WHERE ${scope.column} LIKE $1 || '%'`, [
            scope.prefix,
          ])
        : await client.query(
            `DELETE FROM ${scope.ledger} WHERE ${scope.column} = ANY($1::text[])`,
            [scope.values]
          );
      removed[key] = (removed[key] ?? 0) + (result.rowCount ?? 0);
    }

    for (const ledger of ledgers) {
      await client.query(`ALTER TABLE ${ledger} ENABLE TRIGGER ${LEDGER_TRIGGER[ledger]}`);
    }
    await client.query('COMMIT');
    return removed;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  }
}

export async function residueByPrefix(
  client: Client,
  prefixes: string[]
): Promise<Record<string, number>> {
  const targets: Array<[string, string]> = [
    ['initiative_closure_evidence', 'id'],
    ['initiative_lifecycle_gate_decisions', 'decision_id'],
    ['execution_action_audit', 'audit_id'],
    ['initiative_closure_requests', 'id'],
    ['initiative_history', 'initiative_id'],
    ['initiatives', 'id'],
    ['tasks', 'id'],
    ['decisions', 'id'],
    ['initiative_milestones', 'id'],
    ['meetings', 'id'],
    ['meeting_notes', 'id'],
    ['notebook_pages', 'id'],
    ['notebook_page_versions', 'id'],
    ['tool_sessions', 'id'],
    ['tool_outputs', 'id'],
    ['method_outputs', 'id'],
    ['method_snapshots', 'id'],
    ['method_sessions', 'id'],
    ['projects', 'id'],
    ['organization_members', 'organization_id'],
    ['users', 'id'],
    ['organizations', 'id'],
  ];
  const residue: Record<string, number> = {};
  for (const [table, column] of targets) {
    for (const prefix of prefixes) {
      try {
        const result = await client.query<{ n: string }>(
          `SELECT count(*) AS n FROM ${table} WHERE ${column} LIKE $1 || '%'`,
          [prefix]
        );
        const count = Number(result.rows[0]?.n ?? 0);
        if (count > 0) residue[`${table}:${prefix}`] = count;
      } catch {
        // A schema without an optional table has no residue in that table.
      }
    }
  }
  return residue;
}
