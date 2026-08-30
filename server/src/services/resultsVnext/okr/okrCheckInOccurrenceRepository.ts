import type { PoolClient } from 'pg';

import { acquirePgClient } from '../../../database/PostgresDatabase.js';

export interface OkrCheckInOccurrenceOption {
  cadenceOccurrenceId: string;
  windowStart: string;
  windowEnd: string;
  used: boolean;
  isCurrent: boolean;
}

interface OccurrenceRow {
  cadence_occurrence_id: string;
  window_start: string;
  window_end: string;
  used: boolean;
  is_current: boolean;
}

async function withReadClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await acquirePgClient();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

export async function listCheckInOccurrences(params: {
  organizationId: string;
  keyResultId: string;
}): Promise<OkrCheckInOccurrenceOption[]> {
  const { organizationId, keyResultId } = params;
  return withReadClient(async (client) => {
    const result = await client.query<OccurrenceRow>(
      `WITH occurrences AS (
         SELECT occ.cadence_occurrence_id,
                occ.window_start,
                occ.window_end,
                EXISTS (
                  SELECT 1
                    FROM okr_vnext_checkins c
                   WHERE c.organization_id = $1
                     AND c.key_result_id = $2
                     AND c.cadence_occurrence_id = occ.cadence_occurrence_id
                     AND c.correction_of_checkin_id IS NULL
                ) AS used
           FROM okr_vnext_key_results kr
           JOIN okr_vnext_sets s
             ON s.set_id = kr.set_id AND s.organization_id = kr.organization_id
           JOIN okr_vnext_checkin_occurrences occ
             ON occ.cycle_id = s.cycle_id AND occ.organization_id = kr.organization_id
          WHERE kr.key_result_id = $2
            AND kr.organization_id = $1
            AND kr.status <> 'cancelled'
       ), ranked AS (
         SELECT *,
                CASE WHEN NOT used THEN
                  ROW_NUMBER() OVER (PARTITION BY used ORDER BY window_end ASC, window_start ASC)
                END AS pending_rank
           FROM occurrences
       )
       SELECT cadence_occurrence_id, window_start, window_end, used,
              (NOT used AND pending_rank = 1) AS is_current
         FROM ranked
        ORDER BY window_start ASC, window_end ASC`,
      [organizationId, keyResultId]
    );
    return result.rows.map((row) => ({
      cadenceOccurrenceId: row.cadence_occurrence_id,
      windowStart: row.window_start,
      windowEnd: row.window_end,
      used: row.used,
      isCurrent: row.is_current,
    }));
  });
}
