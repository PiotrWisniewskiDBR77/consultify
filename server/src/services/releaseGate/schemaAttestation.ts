/**
 * Schema attestation for legacy migration variants whose recorded checksum cannot be traced
 * to any committed blob, but whose RESULTING SCHEMA is provably a known variant's outcome.
 *
 * Currently used for exactly one file: 730_partner_users_uuid_columns.sql.
 *
 * Forensic basis (2026-08-13, read-only against demo):
 *   - schema_migrations records checksum 15759c8f… applied 2026-03-16 20:13:11.
 *   - The file first reached git on 2026-03-19; only two contents ever existed
 *     (vA 9364461a…, vB eec2e7dc…). Neither hashes to the stored value, so the applied bytes
 *     were an uncommitted working-tree version.
 *   - The LIVE schema matches variant A exactly: partner_org_id is uuid AND the FK
 *     partner_users_partner_org_id_fkey -> partner_organizations(id) ON DELETE CASCADE exists.
 *     Variant B never creates that FK, so B alone cannot explain the live state.
 *
 * This is NOT grandfathering. A grandfathered checksum is trusted on its own; this contract
 * trusts nothing and re-proves the schema every single run. If any postcondition fails, the
 * release gate must abort BEFORE applying any migration.
 */

export interface AttestationQueryable {
  query(sql: string, params?: unknown[]): Promise<{ rows: any[] }>;
}

export interface AttestationResult {
  attested: boolean;
  /** every check performed, in order, with its outcome — for the release receipt */
  checks: Array<{ name: string; expected: string; actual: string; ok: boolean }>;
  failureReason?: string;
}

export const ATTESTED_VARIANT_LABEL = 'SCHEMA_ATTESTED_LEGACY_VARIANT';

/**
 * Attest the post-state of 730_partner_users_uuid_columns.sql.
 *
 * MUST be called inside the same transaction/connection the gate will use, so the schema it
 * proves is the schema the migrations will run against.
 */
export async function attestPartnerUsersUuidVariant(
  db: AttestationQueryable
): Promise<AttestationResult> {
  const checks: AttestationResult['checks'] = [];
  const record = (name: string, expected: string, actual: string) => {
    const ok = expected === actual;
    checks.push({ name, expected, actual, ok });
    return ok;
  };

  try {
    // 1 + 2. column exists and is uuid
    const col = await db.query(
      `SELECT data_type FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'partner_users'
          AND column_name = 'partner_org_id'`
    );
    if (col.rows.length === 0) {
      record('partner_users.partner_org_id exists', 'present', 'absent');
      return { attested: false, checks, failureReason: 'partner_users.partner_org_id does not exist' };
    }
    record('partner_users.partner_org_id exists', 'present', 'present');
    if (!record('partner_users.partner_org_id type', 'uuid', String(col.rows[0].data_type))) {
      return { attested: false, checks, failureReason: 'partner_org_id is not uuid' };
    }

    // 3-6. the FK: exists, correct name, correct target table+column, ON DELETE CASCADE
    const fk = await db.query(
      `SELECT con.conname,
              pg_get_constraintdef(con.oid) AS def,
              tgt.relname                   AS target_table,
              con.confdeltype               AS on_delete
         FROM pg_constraint con
         JOIN pg_class src ON src.oid = con.conrelid
         JOIN pg_class tgt ON tgt.oid = con.confrelid
         JOIN pg_namespace ns ON ns.oid = src.relnamespace
        WHERE ns.nspname = 'public'
          AND src.relname = 'partner_users'
          AND con.contype = 'f'
          AND EXISTS (
            SELECT 1
              FROM unnest(con.conkey) AS k(attnum)
              JOIN pg_attribute a
                ON a.attrelid = con.conrelid AND a.attnum = k.attnum
             WHERE a.attname = 'partner_org_id'
          )`
    );

    if (fk.rows.length === 0) {
      record('FK on partner_org_id', 'present', 'absent');
      return { attested: false, checks, failureReason: 'no foreign key on partner_users.partner_org_id' };
    }
    // 7. no conflicting second FK on the same column
    if (!record('FK count on partner_org_id', '1', String(fk.rows.length))) {
      return {
        attested: false,
        checks,
        failureReason: `expected exactly one FK on partner_org_id, found ${fk.rows.length}`,
      };
    }

    const row = fk.rows[0];
    if (!record('FK name', 'partner_users_partner_org_id_fkey', String(row.conname))) {
      return { attested: false, checks, failureReason: 'unexpected FK name' };
    }
    if (!record('FK target table', 'partner_organizations', String(row.target_table))) {
      return { attested: false, checks, failureReason: 'FK points at the wrong table' };
    }
    // confdeltype 'c' == ON DELETE CASCADE
    if (!record('FK on delete', 'CASCADE', row.on_delete === 'c' ? 'CASCADE' : String(row.on_delete))) {
      return { attested: false, checks, failureReason: 'FK is not ON DELETE CASCADE' };
    }
    const def = String(row.def);
    if (!record('FK target column', 'partner_organizations(id)', /REFERENCES\s+partner_organizations\s*\(\s*id\s*\)/i.test(def) ? 'partner_organizations(id)' : def)) {
      return { attested: false, checks, failureReason: 'FK does not reference partner_organizations(id)' };
    }

    return { attested: true, checks };
  } catch (error: any) {
    // An attestation query that cannot execute is a FAILURE, never a pass.
    checks.push({
      name: 'attestation query executed',
      expected: 'success',
      actual: `error: ${error?.message || String(error)}`,
      ok: false,
    });
    return {
      attested: false,
      checks,
      failureReason: `attestation query failed: ${error?.message || String(error)}`,
    };
  }
}
