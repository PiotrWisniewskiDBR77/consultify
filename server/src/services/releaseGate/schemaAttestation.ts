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

// ---------------------------------------------------------------------------
// Post-approval schema postconditions (release gate closeout, 2026-08-13)
// ---------------------------------------------------------------------------
// A reviewed (stored,current) checksum pair proves WHICH bytes ran. It does NOT prove the
// resulting schema is acceptable. For migrations whose historical version produced a schema that
// differs from a fresh install, the checksum alone is therefore not sufficient evidence — the gate
// must additionally re-prove the live shape on every evaluation.
//
// Registered below for exactly the three files whose divergence was established by read-only
// forensics. Each returns the same AttestationResult contract, so a failure is reported with the
// precise check that failed and always fails closed.

/** 542 — steering-board timestamps must be a real timestamp type, not TEXT. */
export async function attestSteeringBoardTimestamps(
  db: AttestationQueryable
): Promise<AttestationResult> {
  const checks: AttestationResult['checks'] = [];
  try {
    const r = await db.query(
      `SELECT table_name, column_name, data_type
         FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name IN ('project_steering_board','project_steering_board_members')
          AND column_name IN ('created_at','updated_at')`
    );
    if (r.rows.length === 0) {
      checks.push({ name: 'steering board tables present', expected: 'present', actual: 'absent', ok: true });
      return { attested: true, checks }; // environment simply lacks the feature tables
    }
    let ok = true;
    for (const row of r.rows) {
      const actual = String(row.data_type);
      const good = actual.startsWith('timestamp');
      checks.push({
        name: `${row.table_name}.${row.column_name} type`,
        expected: 'timestamp*',
        actual,
        ok: good,
      });
      if (!good) ok = false;
    }
    return ok
      ? { attested: true, checks }
      : {
          attested: false,
          checks,
          failureReason:
            'steering-board timestamps are still TEXT — run 20260813_repair_d_steering_board_timestamptz.sql',
        };
  } catch (error: any) {
    checks.push({ name: 'attestation query executed', expected: 'success', actual: String(error?.message || error), ok: false });
    return { attested: false, checks, failureReason: `attestation query failed: ${error?.message || error}` };
  }
}

/** 548 — api_keys.is_active must be a type the status contract actually supports. */
export async function attestApiKeyStatusContract(
  db: AttestationQueryable
): Promise<AttestationResult> {
  const checks: AttestationResult['checks'] = [];
  const SUPPORTED = ['boolean', 'integer', 'smallint', 'bigint'];
  try {
    const r = await db.query(
      `SELECT column_name, data_type FROM information_schema.columns
        WHERE table_schema='public' AND table_name='api_keys' AND column_name IN ('is_active','status')`
    );
    if (r.rows.length === 0) {
      checks.push({ name: 'api_keys present', expected: 'present', actual: 'absent', ok: true });
      return { attested: true, checks };
    }
    const isActive = r.rows.find((x: any) => x.column_name === 'is_active');
    const status = r.rows.find((x: any) => x.column_name === 'status');

    const statusOk = Boolean(status);
    checks.push({ name: 'api_keys.status present', expected: 'present', actual: statusOk ? 'present' : 'absent', ok: statusOk });

    if (!isActive) {
      // No is_active at all — nothing to derive from, and status exists. Acceptable.
      return statusOk
        ? { attested: true, checks }
        : { attested: false, checks, failureReason: 'api_keys.status missing' };
    }
    const t = String(isActive.data_type);
    const typeOk = SUPPORTED.includes(t);
    checks.push({ name: 'api_keys.is_active type', expected: SUPPORTED.join('|'), actual: t, ok: typeOk });

    return typeOk && statusOk
      ? { attested: true, checks }
      : {
          attested: false,
          checks,
          failureReason: typeOk
            ? 'api_keys.status missing'
            : `api_keys.is_active type ${t} is not supported by the status contract`,
        };
  } catch (error: any) {
    checks.push({ name: 'attestation query executed', expected: 'success', actual: String(error?.message || error), ok: false });
    return { attested: false, checks, failureReason: `attestation query failed: ${error?.message || error}` };
  }
}

/**
 * 573 — communication_plans.id and communication_plan_items.plan_id must be the SAME type and
 * joined by a real FK.
 *
 * Both shapes are legitimate and both are in service:
 *   demo  = uuid / uuid   (the historical version declared UUID)
 *   fresh = text / text   (the current version declares TEXT so a fresh FK does not fail)
 * What is NEVER acceptable is a MISMATCH between the two, which would break the FK. Note the
 * current migration's own comment claims the live schema has a TEXT id — read-only verification on
 * 2026-08-13 showed demo is uuid/uuid. The comment is wrong; this attestation checks reality.
 */
export async function attestCommunicationPlanKeyParity(
  db: AttestationQueryable
): Promise<AttestationResult> {
  const checks: AttestationResult['checks'] = [];
  try {
    const cols = await db.query(
      `SELECT table_name, column_name, data_type FROM information_schema.columns
        WHERE table_schema='public'
          AND ((table_name='communication_plans' AND column_name='id')
            OR (table_name='communication_plan_items' AND column_name='plan_id'))`
    );
    const planId = cols.rows.find((x: any) => x.table_name === 'communication_plans');
    const itemFk = cols.rows.find((x: any) => x.table_name === 'communication_plan_items');
    if (!planId && !itemFk) {
      checks.push({ name: 'communication plan tables present', expected: 'present', actual: 'absent', ok: true });
      return { attested: true, checks };
    }
    if (!planId || !itemFk) {
      checks.push({
        name: 'both communication plan tables present',
        expected: 'both',
        actual: planId ? 'plans only' : 'items only',
        ok: false,
      });
      return { attested: false, checks, failureReason: 'only one side of the communication plan pair exists' };
    }
    const a = String(planId.data_type);
    const b = String(itemFk.data_type);
    const match = a === b;
    checks.push({ name: 'communication_plans.id vs communication_plan_items.plan_id', expected: 'identical types', actual: `${a} vs ${b}`, ok: match });

    const fk = await db.query(
      `SELECT con.conname FROM pg_constraint con
         JOIN pg_class rel ON rel.oid = con.conrelid
         JOIN pg_class tgt ON tgt.oid = con.confrelid
         JOIN pg_namespace ns ON ns.oid = rel.relnamespace
        WHERE ns.nspname='public' AND con.contype='f'
          AND rel.relname='communication_plan_items' AND tgt.relname='communication_plans'`
    );
    const fkOk = fk.rows.length >= 1;
    checks.push({ name: 'FK items -> plans', expected: 'present', actual: fkOk ? 'present' : 'absent', ok: fkOk });

    return match && fkOk
      ? { attested: true, checks }
      : {
          attested: false,
          checks,
          failureReason: match
            ? 'communication_plan_items has no FK to communication_plans'
            : `key type mismatch: communication_plans.id is ${a} but communication_plan_items.plan_id is ${b}`,
        };
  } catch (error: any) {
    checks.push({ name: 'attestation query executed', expected: 'success', actual: String(error?.message || error), ok: false });
    return { attested: false, checks, failureReason: `attestation query failed: ${error?.message || error}` };
  }
}

/**
 * Files whose approved checksum is NOT sufficient on its own: the gate must additionally re-prove
 * the live schema shape. Keyed by filename so the evaluator cannot forget one.
 */
export const POSTCONDITION_ATTESTATIONS: Readonly<
  Record<string, (db: AttestationQueryable) => Promise<AttestationResult>>
> = Object.freeze({
  '542_project_members_consultant_overlay_and_steering_board.sql': attestSteeringBoardTimestamps,
  '548_audit_log_api_keys_compatibility.sql': attestApiKeyStatusContract,
  '573_people_change_comms_t043_t044_t045.sql': attestCommunicationPlanKeyParity,
});
