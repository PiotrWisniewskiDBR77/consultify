import type { PoolClient } from 'pg';

import { requireNoLegalHoldInTransaction } from './OrgPoliciesService.js';

/** Owns the pinned client until both the snapshot and session lock are finished. */
export async function withOrganizationExportSnapshot<T>(
  client: PoolClient,
  organizationId: string,
  read: (client: PoolClient) => Promise<T>
): Promise<T> {
  let acquireAttempted = false;
  let locked = false;
  let began = false;
  let discard = false;
  try {
    // The policy writer uses the same key with a transaction-scoped lock. Taking
    // this session lock before BEGIN prevents an absent-policy stale snapshot.
    acquireAttempted = true;
    await client.query('SELECT pg_advisory_lock(hashtextextended($1, 0))', [organizationId]);
    locked = true;
    // BEGIN may succeed on the backend even if its acknowledgement is lost.
    began = true;
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    await requireNoLegalHoldInTransaction(client, organizationId, 'DATA_EXPORT', {
      lockRows: false,
    });
    const result = await read(client);
    await client.query('COMMIT');
    began = false;
    return result;
  } catch (error) {
    if (began) {
      try {
        await client.query('ROLLBACK');
      } catch {
        discard = true;
      }
    }
    throw error;
  } finally {
    if (locked) {
      try {
        const result = await client.query<{ unlocked: boolean }>(
          'SELECT pg_advisory_unlock(hashtextextended($1, 0)) AS unlocked',
          [organizationId]
        );
        if (result.rows[0]?.unlocked !== true) discard = true;
      } catch {
        discard = true;
      }
    } else if (acquireAttempted) {
      // A failed acknowledgement cannot tell us whether PostgreSQL took the lock.
      discard = true;
    }
    client.release(discard ? new Error('advisory lock release unconfirmed') : undefined);
  }
}
