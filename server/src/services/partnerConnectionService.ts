import crypto from 'node:crypto';

import { withPgTransaction } from '../database/PostgresDatabase.js';

export const PARTNER_SELF_CONNECT_ENV = 'PARTNER_SELF_CONNECT_ENABLED';

export class PartnerConnectionError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string
  ) {
    super(message);
  }
}

export interface PartnerConnectionResponse {
  connected: true;
  organization: {
    id: string;
    name: string;
    contactEmail: string;
    tier: string;
    status: string;
    partnerSince?: string;
    publicListingEnabled: boolean;
    referralCode: string;
    referralLinkSlug: string;
    specializations: string[];
    regions: string[];
  };
}

function normalizedPayload(params: { name?: string; contactEmail?: string }) {
  return {
    name: String(params.name || '').trim(),
    contactEmail: String(params.contactEmail || '')
      .trim()
      .toLowerCase(),
  };
}

function requestHash(value: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function responseFromOrg(
  org: any,
  specializations: string[] = [],
  regions: string[] = []
): PartnerConnectionResponse {
  return {
    connected: true,
    organization: {
      id: org.id,
      name: org.name,
      contactEmail: org.contact_email,
      tier: org.tier || 'registered',
      status: org.status || 'active',
      ...(org.partner_since ? { partnerSince: new Date(org.partner_since).toISOString() } : {}),
      publicListingEnabled: Boolean(org.public_listing_enabled),
      referralCode: org.referral_code,
      referralLinkSlug: org.referral_link_slug,
      specializations,
      regions,
    },
  };
}

export async function connectPartnerOrganization(params: {
  organizationId: string;
  userId: string;
  idempotencyKey: string;
  name?: string;
  contactEmail?: string;
  actorName?: string;
  actorEmail?: string;
  env?: NodeJS.ProcessEnv;
}): Promise<{ status: 200 | 201; data: PartnerConnectionResponse }> {
  const env = params.env || process.env;
  if (env[PARTNER_SELF_CONNECT_ENV] !== 'true') {
    throw new PartnerConnectionError(
      'Self-service partner registration is currently disabled.',
      403,
      'PARTNER_SELF_CONNECT_DISABLED'
    );
  }
  const idempotencyKey = String(params.idempotencyKey || '').trim();
  if (!idempotencyKey) {
    throw new PartnerConnectionError(
      'Idempotency-Key is required',
      400,
      'IDEMPOTENCY_KEY_REQUIRED'
    );
  }
  const requested = normalizedPayload({
    name:
      params.name ||
      (params.actorName ? `${params.actorName.trim()} — Partner` : 'Partner Organization'),
    contactEmail: params.contactEmail || params.actorEmail,
  });
  if (!requested.contactEmail) {
    throw new PartnerConnectionError('contactEmail is required', 400, 'CONTACT_EMAIL_REQUIRED');
  }
  const hash = requestHash(requested);

  return withPgTransaction(async (query) => {
    await query(`SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, [
      `partner-connect:${params.organizationId}`,
    ]);
    const authority = await query<any>(
      `SELECT role,status FROM organization_members
       WHERE organization_id=$1 AND user_id=$2 FOR SHARE`,
      [params.organizationId, params.userId]
    );
    if (
      String(authority.rows[0]?.status || '').toUpperCase() !== 'ACTIVE' ||
      !['ADMIN', 'OWNER', 'SUPERADMIN', 'SUPER_ADMIN'].includes(
        String(authority.rows[0]?.role || '').toUpperCase()
      )
    ) {
      throw new PartnerConnectionError(
        'Active tenant ADMIN or OWNER membership required',
        403,
        'PARTNER_CONNECT_AUTHORITY_REQUIRED'
      );
    }
    const receipt = await query<any>(
      `SELECT request_hash,status,response_status,response_json
       FROM partner_connection_receipts
       WHERE organization_id=$1 AND user_id=$2 AND idempotency_key=$3 FOR UPDATE`,
      [params.organizationId, params.userId, idempotencyKey]
    );
    if (receipt.rows[0]) {
      if (receipt.rows[0].request_hash !== hash) {
        throw new PartnerConnectionError(
          'Idempotency replay payload mismatch',
          409,
          'IDEMPOTENCY_PAYLOAD_MISMATCH'
        );
      }
      if (receipt.rows[0].status !== 'COMPLETED') {
        throw new PartnerConnectionError(
          'Idempotency request incomplete',
          409,
          'IDEMPOTENCY_INCOMPLETE'
        );
      }
      return {
        status: Number(receipt.rows[0].response_status) as 200 | 201,
        data: receipt.rows[0].response_json as PartnerConnectionResponse,
      };
    }

    await query(
      `INSERT INTO partner_connection_receipts
       (organization_id,user_id,idempotency_key,request_hash)
       VALUES($1,$2,$3,$4)`,
      [params.organizationId, params.userId, idempotencyKey, hash]
    );

    const existing = await query<any>(
      `SELECT DISTINCT po.*
       FROM partner_organizations po
       JOIN partner_users owner_link ON owner_link.partner_org_id=po.id
       JOIN organization_members tenant_member ON tenant_member.user_id=owner_link.user_id::text
       WHERE tenant_member.organization_id=$1
         AND UPPER(COALESCE(tenant_member.status,''))='ACTIVE'
         AND LOWER(COALESCE(owner_link.status,'active'))='active'
         AND LOWER(COALESCE(po.status,'active'))='active'
       ORDER BY po.updated_at DESC LIMIT 2`,
      [params.organizationId]
    );

    if (existing.rows.length > 1) {
      throw new PartnerConnectionError(
        'Tenant has multiple active Partner organizations',
        409,
        'PARTNER_TENANT_AMBIGUOUS'
      );
    }

    let org = existing.rows[0];
    let responseStatus: 200 | 201 = 200;
    if (org) {
      const currentLink = await query<any>(
        `SELECT status FROM partner_users WHERE partner_org_id=$1 AND user_id=$2 FOR UPDATE`,
        [org.id, params.userId]
      );
      if (currentLink.rows[0] && String(currentLink.rows[0].status).toLowerCase() !== 'active') {
        throw new PartnerConnectionError(
          'Partner membership is inactive',
          403,
          'PARTNER_MEMBERSHIP_INACTIVE'
        );
      }
      if (!currentLink.rows[0]) {
        await query(
          `INSERT INTO partner_users
           (id,partner_org_id,user_id,role,status,joined_at,created_at,updated_at)
           VALUES($1,$2,$3,'admin','active',NOW(),NOW(),NOW())`,
          [crypto.randomUUID(), org.id, params.userId]
        );
      }
    } else {
      const partnerOrgId = crypto.randomUUID();
      const referralCode = `PARTNER-${partnerOrgId.slice(0, 8).toUpperCase()}`;
      const referralLinkSlug = `partner-${partnerOrgId.toLowerCase()}`;
      await query(
        `INSERT INTO partner_organizations
         (id,name,contact_email,tier,status,partner_since,public_listing_enabled,
          created_at,updated_at,created_by,updated_by,referral_code,referral_link_slug)
         VALUES($1,$2,$3,'registered','active',NOW(),FALSE,NOW(),NOW(),$4::uuid,$4::uuid,$5,$6)`,
        [
          partnerOrgId,
          requested.name,
          requested.contactEmail,
          params.userId,
          referralCode,
          referralLinkSlug,
        ]
      );
      await query(
        `INSERT INTO partner_users
         (id,partner_org_id,user_id,role,status,joined_at,created_at,updated_at)
         VALUES($1,$2,$3,'owner','active',NOW(),NOW(),NOW())`,
        [crypto.randomUUID(), partnerOrgId, params.userId]
      );
      org = (await query<any>(`SELECT * FROM partner_organizations WHERE id=$1`, [partnerOrgId]))
        .rows[0];
      responseStatus = 201;
    }

    const specializations = (
      await query<{ framework: string }>(
        `SELECT framework FROM partner_specializations WHERE partner_org_id=$1 ORDER BY framework`,
        [org.id]
      )
    ).rows.map((row) => row.framework);
    const regions = (
      await query<{ region: string }>(
        `SELECT region FROM partner_regions WHERE partner_org_id=$1 ORDER BY region`,
        [org.id]
      )
    ).rows.map((row) => row.region);
    const data = responseFromOrg(org, specializations, regions);
    await query(
      `UPDATE partner_connection_receipts
       SET status='COMPLETED',response_status=$1,response_json=$2,completed_at=NOW()
       WHERE organization_id=$3 AND user_id=$4 AND idempotency_key=$5`,
      [responseStatus, JSON.stringify(data), params.organizationId, params.userId, idempotencyKey]
    );
    return { status: responseStatus, data };
  });
}
