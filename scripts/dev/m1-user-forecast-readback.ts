/** Read-only RealPG receipt for M1 user forecasts in an explicit initiative scope. */
import DbPromise from '../../server/src/utils/DbPromise.js';
import { getUserForecast } from '../../server/src/services/workloadCapacityService.js';

async function main(): Promise<void> {
  const organizationId = String(process.argv[2] || '').trim();
  const asOf = String(process.argv[3] || '').trim();
  const initiativeIds = String(process.argv[4] || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (!organizationId || !asOf || !initiativeIds.length)
    throw new Error('organization id, asOf and comma-separated initiative ids required');

  const users = await DbPromise.all<{ user_id: string; name: string }>(
    `SELECT DISTINCT t.assignee_id AS user_id,
            COALESCE(NULLIF(TRIM(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'')),''),u.email,t.assignee_id) AS name
       FROM tasks t JOIN users u ON u.id=t.assignee_id AND u.organization_id=t.organization_id
      WHERE t.organization_id=? AND t.initiative_id IN (${initiativeIds.map(() => '?').join(',')})
      ORDER BY name`,
    [organizationId, ...initiativeIds]
  );
  const forecasts = [];
  for (const user of users) {
    forecasts.push({
      userId: user.user_id,
      name: user.name,
      weeks: await getUserForecast(organizationId, user.user_id, {
        asOf,
        weekCount: 4,
        initiativeIds,
      }),
    });
  }
  process.stdout.write(
    `${JSON.stringify(
      {
        organizationId,
        asOf,
        initiativeCount: initiativeIds.length,
        userCount: forecasts.length,
        forecasts,
      },
      null,
      2
    )}\n`
  );
}

main()
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(() => setTimeout(() => process.exit(process.exitCode ?? 0), 25));
