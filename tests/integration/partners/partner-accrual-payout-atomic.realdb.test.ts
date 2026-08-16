import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const run = process.env.RUN_DB_TESTS === '1' && process.env.MOCK_DB === 'false';
const describeReal = run ? describe : describe.skip;
const url = process.env.DATABASE_URL || '';
const orgA = '11111111-1111-4111-8111-111111111111';
const orgB = '22222222-2222-4222-8222-222222222222';
const user = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
let sql: Client;
let service: typeof import('../../../server/src/services/partnerCommissionService.js');

describeReal.sequential('PRT-MVP-ACCRUAL-001 atomic canonical payout writer real PG', () => {
  beforeAll(async () => {
    process.env.PARTNER_ACCRUAL_POLICY_JSON = JSON.stringify({
      status: 'APPROVED', version: 'synthetic-test-only-v1', baseCurrency: 'EUR',
      commissionRateBps: 1500, payoutFeeBps: 100, minimumPayoutMinor: 100,
    });
    sql = new Client({ connectionString: url });
    await sql.connect();
    await sql.query(`
      CREATE TABLE partner_organizations(id uuid PRIMARY KEY, payout_method text);
      CREATE TABLE partner_commission_transactions(
        id uuid PRIMARY KEY, partner_org_id uuid NOT NULL, commission_amount numeric NOT NULL,
        currency text NOT NULL, transaction_date timestamptz NOT NULL, status text NOT NULL,
        payout_id uuid, updated_at timestamptz DEFAULT now()
      );
      CREATE TABLE partner_payouts(
        id uuid PRIMARY KEY, partner_org_id uuid NOT NULL, payout_account_id text,
        payout_period_start date NOT NULL, payout_period_end date NOT NULL, gross_amount numeric NOT NULL,
        fees numeric NOT NULL, tax_withheld numeric DEFAULT 0, net_amount numeric NOT NULL,
        currency text NOT NULL, transaction_count integer NOT NULL, status text NOT NULL,
        payout_method text, payout_reference text, external_payout_id text, requested_at timestamptz DEFAULT now(),
        requested_by uuid, processed_at timestamptz, processed_by uuid, completed_at timestamptz,
        failure_reason text, notes text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
      );
      CREATE TABLE partner_program_ledger(
        id uuid PRIMARY KEY, partner_org_id uuid NOT NULL, entry_type text NOT NULL, amount numeric NOT NULL,
        currency text NOT NULL, occurred_at timestamptz NOT NULL, recorded_at timestamptz NOT NULL,
        source_ref text NOT NULL, actor text NOT NULL, actor_id uuid, correlation_id text,
        idempotency_key text, reason_code text, note text, rule_version text NOT NULL,
        related_entry_id uuid, dispute_status text
      );
      CREATE UNIQUE INDEX uq_test_ledger_idem ON partner_program_ledger(partner_org_id,idempotency_key) WHERE idempotency_key IS NOT NULL;
      INSERT INTO partner_organizations VALUES ('${orgA}','BANK_TRANSFER'),('${orgB}','BANK_TRANSFER');
    `);
    service = await import('../../../server/src/services/partnerCommissionService.js');
  });

  afterAll(async () => {
    delete process.env.PARTNER_ACCRUAL_POLICY_JSON;
    await sql?.end();
  });

  it('rolls back payout and commission links when ledger append fails', async () => {
    const commission = '10000000-0000-4000-8000-000000000001';
    await sql.query(`INSERT INTO partner_commission_transactions VALUES ($1,$2,100,'EUR',now(),'APPROVED',NULL,now())`, [commission, orgA]);
    await sql.query(`CREATE FUNCTION reject_forced_payout() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.note='FORCE_FAIL' THEN RAISE EXCEPTION 'forced ledger failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_forced BEFORE INSERT ON partner_program_ledger FOR EACH ROW EXECUTE FUNCTION reject_forced_payout()`);
    const result = await service.requestPayout({ partnerOrgId: orgA, requestedBy: user, notes: 'FORCE_FAIL', idempotencyKey: 'failure-key' });
    expect(result).toBeNull();
    expect((await sql.query(`SELECT count(*)::int n FROM partner_payouts`)).rows[0].n).toBe(0);
    expect((await sql.query(`SELECT payout_id FROM partner_commission_transactions WHERE id=$1`, [commission])).rows[0].payout_id).toBeNull();
    await sql.query(`DROP TRIGGER reject_forced ON partner_program_ledger; DROP FUNCTION reject_forced_payout()`);
  });

  it('serializes concurrent requests and returns the same payout on idempotent retry', async () => {
    const commission = '10000000-0000-4000-8000-000000000002';
    await sql.query(`INSERT INTO partner_commission_transactions VALUES ($1,$2,200,'EUR',now(),'APPROVED',NULL,now())`, [commission, orgA]);
    const request = { partnerOrgId: orgA, requestedBy: user, idempotencyKey: 'concurrent-key' };
    const [first, second] = await Promise.all([service.requestPayout(request), service.requestPayout(request)]);
    expect(first?.id).toBeTruthy();
    expect(second?.id).toBe(first?.id);
    expect((await sql.query(`SELECT count(*)::int n FROM partner_payouts WHERE partner_org_id=$1`, [orgA])).rows[0].n).toBe(1);
    expect((await sql.query(`SELECT count(*)::int n FROM partner_program_ledger WHERE partner_org_id=$1 AND entry_type='payout.requested'`, [orgA])).rows[0].n).toBe(1);
  });

  it('keeps another tenant untouched and survives cold readback', async () => {
    const foreign = '20000000-0000-4000-8000-000000000001';
    await sql.query(`INSERT INTO partner_commission_transactions VALUES ($1,$2,300,'EUR',now(),'APPROVED',NULL,now())`, [foreign, orgB]);
    const cold = new Client({ connectionString: url });
    await cold.connect();
    const foreignRow = await cold.query(`SELECT payout_id FROM partner_commission_transactions WHERE id=$1 AND partner_org_id=$2`, [foreign, orgB]);
    const canonical = await cold.query(`SELECT p.id,l.rule_version,l.currency FROM partner_payouts p JOIN partner_program_ledger l ON l.source_ref::jsonb->>'payoutId'=p.id::text WHERE p.partner_org_id=$1`, [orgA]);
    await cold.end();
    expect(foreignRow.rows[0].payout_id).toBeNull();
    expect(canonical.rows).toHaveLength(1);
    expect(canonical.rows[0]).toMatchObject({ rule_version: 'synthetic-test-only-v1', currency: 'EUR' });
  });
});
