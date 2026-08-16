import { createHash, randomUUID } from 'node:crypto';

import { acquirePgClient } from '../../database/PostgresDatabase.js';

export class InitiativeProfileError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
  }
}

export interface UpdateInitiativeProfileInput {
  summary: string;
  expectedVersion: number;
  idempotencyKey: string;
}

function requestHash(input: UpdateInitiativeProfileInput): string {
  return createHash('sha256')
    .update(
      JSON.stringify({ summary: input.summary.trim(), expectedVersion: input.expectedVersion })
    )
    .digest('hex');
}

export async function updateInitiativeProfile(
  organizationId: string,
  initiativeId: string,
  actorId: string,
  input: UpdateInitiativeProfileInput
) {
  const summary = input.summary.trim();
  if (!summary) throw new InitiativeProfileError(400, 'SUMMARY_REQUIRED', 'summary is required');
  if (!Number.isInteger(input.expectedVersion) || input.expectedVersion < 1) {
    throw new InitiativeProfileError(
      400,
      'EXPECTED_VERSION_REQUIRED',
      'expectedVersion is required'
    );
  }
  if (!input.idempotencyKey.trim()) {
    throw new InitiativeProfileError(
      400,
      'IDEMPOTENCY_KEY_REQUIRED',
      'Idempotency-Key is required'
    );
  }

  const hash = requestHash({ ...input, summary });
  const client = await acquirePgClient();
  try {
    await client.query('BEGIN');
    const membership = await client.query<{ role: string }>(
      `SELECT role FROM organization_members
        WHERE organization_id=$1 AND user_id=$2 AND UPPER(status)='ACTIVE'
        FOR SHARE`,
      [organizationId, actorId]
    );
    if (
      !membership.rows[0] ||
      !['OWNER', 'ADMIN'].includes(String(membership.rows[0].role).toUpperCase())
    ) {
      throw new InitiativeProfileError(
        403,
        'INITIATIVE_PROFILE_ROLE_REQUIRED',
        'Active OWNER or ADMIN membership is required'
      );
    }
    await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [
      `${organizationId}:${initiativeId}:${input.idempotencyKey}`,
    ]);
    const receipt = await client.query<{ request_hash: string; response_json: unknown }>(
      `SELECT request_hash,response_json FROM initiative_profile_update_receipts
        WHERE organization_id=$1 AND initiative_id=$2 AND idempotency_key=$3`,
      [organizationId, initiativeId, input.idempotencyKey]
    );
    if (receipt.rows[0]) {
      if (receipt.rows[0].request_hash !== hash) {
        throw new InitiativeProfileError(
          409,
          'IDEMPOTENCY_PAYLOAD_COLLISION',
          'Idempotency key payload differs'
        );
      }
      await client.query('COMMIT');
      return { ...(receipt.rows[0].response_json as object), idempotentReplay: true };
    }

    const current = await client.query<{ profile_version: number }>(
      `SELECT profile_version FROM initiatives
        WHERE id=$1 AND organization_id=$2 FOR UPDATE`,
      [initiativeId, organizationId]
    );
    if (!current.rows[0])
      throw new InitiativeProfileError(404, 'INITIATIVE_NOT_FOUND', 'Initiative not found');
    if (current.rows[0].profile_version !== input.expectedVersion) {
      throw new InitiativeProfileError(
        409,
        'PROFILE_VERSION_CONFLICT',
        'Initiative profile changed'
      );
    }

    const nextVersion = input.expectedVersion + 1;
    await client.query(
      `UPDATE initiatives SET summary=$1,profile_version=$2,updated_at=NOW()
        WHERE id=$3 AND organization_id=$4`,
      [summary, nextVersion, initiativeId, organizationId]
    );
    const response = { initiativeId, summary, version: nextVersion, idempotentReplay: false };
    await client.query(
      `INSERT INTO initiative_profile_update_receipts
         (id,organization_id,initiative_id,idempotency_key,request_hash,resulting_version,response_json,created_by)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        randomUUID(),
        organizationId,
        initiativeId,
        input.idempotencyKey,
        hash,
        nextVersion,
        JSON.stringify(response),
        actorId,
      ]
    );
    await client.query('COMMIT');
    return response;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
