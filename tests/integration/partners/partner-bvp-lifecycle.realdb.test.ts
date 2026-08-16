/**
 * PRT-BVP-001 — one real PostgreSQL partner lifecycle.
 *
 * Proves registration/connection, certification, durable referral identity,
 * attribution, tenant isolation, retry/concurrency and a cold read through a
 * separately opened database connection. Fixtures use reserved UUIDs and are
 * removed after the suite; no shared/demo organization is touched.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;
const USER_A = 'f1000000-0000-4000-8000-000000000001';
const USER_B = 'f1000000-0000-4000-8000-000000000002';
const PARTNER_A = 'f2000000-0000-4000-8000-000000000001';
const PARTNER_B = 'f2000000-0000-4000-8000-000000000002';
const CUSTOMER_A = 'f3000000-0000-4000-8000-000000000001';
const CUSTOMER_B = 'f3000000-0000-4000-8000-000000000002';

let sql: Client;
let referral: typeof import('../../../server/src/services/partnerReferralService.ts');
let certification: typeof import('../../../server/src/services/partnerCertificationService.ts');
let resolvePartnerOrg: typeof import('../../../server/src/services/partnerOrgResolution.ts');
let stableIdentity: { referralCode: string; referralLinkSlug: string };
let attributionId: string;
let certificateId: string;

async function cleanup() {
  await sql.query(`DELETE FROM partner_attributions WHERE organization_id IN ($1,$2)`, [
    CUSTOMER_A,
    CUSTOMER_B,
  ]);
  await sql.query(`DELETE FROM partner_users WHERE user_id IN ($1,$2)`, [USER_A, USER_B]);
  await sql.query(`DELETE FROM partner_organizations WHERE id IN ($1,$2)`, [PARTNER_A, PARTNER_B]);
  await sql.query(`DELETE FROM organization_members WHERE user_id IN ($1,$2)`, [USER_A, USER_B]);
  await sql.query(`DELETE FROM users WHERE id IN ($1,$2)`, [USER_A, USER_B]);
  await sql.query(`DELETE FROM organizations WHERE id IN ($1,$2)`, [CUSTOMER_A, CUSTOMER_B]);
}

beforeAll(async () => {
  if (!DATABASE_URL) throw new Error('DATABASE_URL is required for PRT-BVP-001 realDB proof');
  sql = new Client({ connectionString: DATABASE_URL });
  await sql.connect();
  const identity = await sql.query(`SELECT version() AS version`);
  expect(identity.rows[0].version).toMatch(/PostgreSQL/);
  await cleanup();

  await sql.query(
    `INSERT INTO users (id, email, first_name, last_name, role, status)
     VALUES ($1,'prt-bvp-a@example.test','Partner','A','ADMIN','active'),
            ($2,'prt-bvp-b@example.test','Partner','B','ADMIN','active')`,
    [USER_A, USER_B]
  );
  await sql.query(
    `INSERT INTO organizations (id, name) VALUES ($1,'Customer A'),($2,'Customer B')`,
    [CUSTOMER_A, CUSTOMER_B]
  );
  await sql.query(
    `INSERT INTO organization_members (id,organization_id,user_id,role,status)
     VALUES ('f5000000-0000-4000-8000-000000000001',$1,$2,'ADMIN','ACTIVE'),
            ('f5000000-0000-4000-8000-000000000002',$3,$4,'ADMIN','ACTIVE')`,
    [CUSTOMER_A, USER_A, CUSTOMER_B, USER_B]
  );
  await sql.query(
    `INSERT INTO partner_organizations
       (id,name,contact_email,tier,status,partner_since,public_listing_enabled,created_by,updated_by)
     VALUES ($1,'BVP Partner B','prt-bvp-b@example.test','registered','active',now(),false,$2,$2)`,
    [PARTNER_B, USER_B]
  );
  await sql.query(
    `INSERT INTO partner_users (id,partner_org_id,user_id,role,status,joined_at)
     VALUES ('f4000000-0000-4000-8000-000000000002',$1,$2,'owner','active',now())`,
    [PARTNER_B, USER_B]
  );

  referral = await import('../../../server/src/services/partnerReferralService.ts');
  certification = await import('../../../server/src/services/partnerCertificationService.ts');
  resolvePartnerOrg = await import('../../../server/src/services/partnerOrgResolution.ts');
}, 60_000);

afterAll(async () => {
  if (sql) {
    await cleanup();
    await sql.end();
  }
});

describe.sequential('PRT-BVP-001 partner lifecycle on real PostgreSQL', () => {
  it('keeps a different workspace partner isolated, then registers and connects the owner', async () => {
    await expect(resolvePartnerOrg.getActivePartnerOrgIdForUser(USER_B)).resolves.toBe(PARTNER_B);
    await expect(resolvePartnerOrg.getActivePartnerOrgIdForUser(USER_A)).resolves.toBeNull();

    await sql.query(
      `INSERT INTO partner_organizations
         (id,name,contact_email,tier,status,partner_since,public_listing_enabled,created_by,updated_by)
       VALUES ($1,'BVP Partner A','prt-bvp-a@example.test','registered','active',now(),false,$2,$2)`,
      [PARTNER_A, USER_A]
    );
    await sql.query(
      `INSERT INTO partner_users (id,partner_org_id,user_id,role,status,joined_at)
       VALUES ('f4000000-0000-4000-8000-000000000001',$1,$2,'owner','active',now())`,
      [PARTNER_A, USER_A]
    );

    await expect(resolvePartnerOrg.getActivePartnerOrgIdForUser(USER_A)).resolves.toBe(PARTNER_A);
  });

  it('creates one stable referral identity under concurrent first access and validates code + slug', async () => {
    const identities = await Promise.all(
      Array.from({ length: 8 }, () =>
        referral.ensurePartnerReferralIdentity(PARTNER_A, 'BVP Partner A')
      )
    );
    expect(new Set(identities.map((value) => JSON.stringify(value))).size).toBe(1);
    stableIdentity = identities[0];
    expect(stableIdentity.referralCode).toMatch(/^BVPPAR-/);
    expect(stableIdentity.referralLinkSlug).toContain('bvp-partner-a');

    await expect(
      referral.validateReferralCode(stableIdentity.referralCode.toLowerCase())
    ).resolves.toEqual(expect.objectContaining({ valid: true, partnerOrgId: PARTNER_A }));
    await expect(
      referral.validateReferralCode(stableIdentity.referralLinkSlug.toUpperCase())
    ).resolves.toEqual(expect.objectContaining({ valid: true, partnerOrgId: PARTNER_A }));

    const tools = await referral.getReferralTools(PARTNER_A);
    expect(tools).toEqual(expect.objectContaining(stableIdentity));
  });

  it('completes the persisted foundation learning + exam certification', async () => {
    const matrix = await certification.ensurePartnerCertificationMatrix({
      partnerOrgId: PARTNER_A,
      userId: USER_A,
      language: 'en',
    });
    expect(matrix).toHaveLength(9);
    const foundation = matrix.find((row) => row.certification_type === 'sales_foundation');
    expect(foundation).toBeTruthy();

    const modules = await certification.getCertificationModules('sales_foundation', 'en');
    expect(modules.length).toBeGreaterThan(0);
    await certification.ensureLearningProgressRows({
      certificationId: foundation!.id,
      moduleIds: modules.map((module) => module.id),
    });
    await sql.query(
      `UPDATE partner_learning_progress
       SET status='completed', progress_percent=100, completed_at=now(), updated_at=now()
       WHERE certification_id=$1`,
      [foundation!.id]
    );
    await certification.recalcCertificationProgress(foundation!.id);

    const attempt = await certification.startCertificationExam({
      certificationId: foundation!.id,
      partnerOrgId: PARTNER_A,
      userId: USER_A,
      language: 'en',
      ip: '127.0.0.1',
      userAgent: 'prt-bvp-realdb',
    });
    expect(attempt.questions.length).toBeGreaterThanOrEqual(5);
    const questionIds = attempt.questions.map((question) => question.id);
    const correct = await sql.query(
      `SELECT id,correct_option_id FROM partner_exam_questions WHERE id = ANY($1::text[])`,
      [questionIds]
    );
    const answers = Object.fromEntries(
      correct.rows.map((row) => [String(row.id), String(row.correct_option_id)])
    );
    const result = await certification.submitCertificationExam({
      attemptId: attempt.attemptId,
      certificationId: foundation!.id,
      partnerOrgId: PARTNER_A,
      userId: USER_A,
      answers,
    });
    expect(result).toEqual(expect.objectContaining({ passed: true, scorePercent: 100 }));
    certificateId = result.certificateId!;
  });

  it('attributes the registered customer exactly once and reads it only in the owning partner scope', async () => {
    const created = await referral.createAttribution({
      partnerOrgId: PARTNER_A,
      organizationId: CUSTOMER_A,
      attributionType: 'REFERRAL_LINK',
      referralCodeUsed: stableIdentity.referralCode,
      commissionRatePercent: 0,
      utmSource: 'partner-bvp-proof',
    });
    attributionId = created.id;
    expect(created).toEqual(
      expect.objectContaining({
        partnerOrgId: PARTNER_A,
        organizationId: CUSTOMER_A,
        status: 'PENDING',
        referralCodeUsed: stableIdentity.referralCode,
      })
    );
    // The completed foundation certification raises the effective tier to
    // BRONZE, whose canonical repaired lookup is 12%.
    expect(Number(created.commissionRatePercent)).toBe(12);

    const own = await referral.getPartnerAttributions(PARTNER_A);
    const foreign = await referral.getPartnerAttributions(PARTNER_B);
    expect(own.map((row) => row.id)).toContain(attributionId);
    expect(foreign.map((row) => row.id)).not.toContain(attributionId);

    await expect(
      referral.createAttribution({
        partnerOrgId: PARTNER_A,
        organizationId: CUSTOMER_A,
        attributionType: 'REFERRAL_LINK',
        referralCodeUsed: stableIdentity.referralCode,
        commissionRatePercent: 10,
      })
    ).rejects.toThrow(/already exists/);
  });

  it('rejects inactive partner codes instead of fabricating eligibility', async () => {
    await sql.query(`UPDATE partner_organizations SET status='inactive' WHERE id=$1`, [PARTNER_A]);
    await expect(referral.validateReferralCode(stableIdentity.referralCode)).resolves.toEqual(
      expect.objectContaining({ valid: false })
    );
    await sql.query(`UPDATE partner_organizations SET status='active' WHERE id=$1`, [PARTNER_A]);
  });

  it('cold-reopens durable connection, certification, code and attribution through a new PG connection', async () => {
    const cold = new Client({ connectionString: DATABASE_URL });
    await cold.connect();
    try {
      const reopened = await cold.query(
        `SELECT po.id AS partner_id, po.referral_code, po.referral_link_slug,
                pu.user_id, pc.certificate_id, pc.status AS certification_status,
                pa.id AS attribution_id, pa.organization_id, pa.referral_code_used
         FROM partner_organizations po
         JOIN partner_users pu ON pu.partner_org_id=po.id AND pu.status='active'
         JOIN partner_certifications pc ON pc.partner_org_id=po.id AND pc.user_id=pu.user_id
         JOIN partner_attributions pa ON pa.partner_org_id=po.id
         WHERE po.id=$1 AND pc.certificate_id=$2 AND pa.id=$3`,
        [PARTNER_A, certificateId, attributionId]
      );
      expect(reopened.rows).toHaveLength(1);
      expect(reopened.rows[0]).toEqual(
        expect.objectContaining({
          partner_id: PARTNER_A,
          user_id: USER_A,
          referral_code: stableIdentity.referralCode,
          referral_link_slug: stableIdentity.referralLinkSlug,
          certificate_id: certificateId,
          certification_status: 'completed',
          attribution_id: attributionId,
          organization_id: CUSTOMER_A,
          referral_code_used: stableIdentity.referralCode,
        })
      );
    } finally {
      await cold.end();
    }
  });
});
