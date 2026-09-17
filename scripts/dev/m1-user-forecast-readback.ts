/** Read-only RealPG receipt for M1 user forecasts. Uses pg directly and performs no DDL. */
import { Pool } from 'pg';

const CLOSED = ['done', 'completed', 'validated', 'cancelled'];
const round1 = (value: number) => Math.round(value * 10) / 10;
const formatDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const parseDay = (value: string | Date | null): Date | null => {
  if (!value) return null;
  const text = value instanceof Date ? formatDate(value) : String(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (!match) return null;
  const result = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  result.setHours(0, 0, 0, 0);
  return Number.isNaN(result.getTime()) ? null : result;
};
const addDays = (date: Date, days: number) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};
const monday = (date: Date) => {
  const result = new Date(date);
  const day = result.getDay();
  result.setDate(result.getDate() - day + (day === 0 ? -6 : 1));
  result.setHours(0, 0, 0, 0);
  return result;
};
const workingDays = (start: Date, end: Date) => {
  let count = 0;
  for (
    let day = new Date(start), guard = 0;
    day <= end && guard <= 20_000;
    day = addDays(day, 1), guard += 1
  )
    if (day.getDay() !== 0 && day.getDay() !== 6) count += 1;
  return count;
};
const spread = (start: Date, due: Date, hours: number) => {
  const result = new Map<string, number>();
  const from = start <= due ? start : due;
  const days = workingDays(from, due);
  if (!days) return new Map([[formatDate(monday(due)), hours]]);
  for (let day = new Date(from); day <= due; day = addDays(day, 1)) {
    if (day.getDay() === 0 || day.getDay() === 6) continue;
    const week = formatDate(monday(day));
    result.set(week, (result.get(week) ?? 0) + hours / days);
  }
  return result;
};

async function main(): Promise<void> {
  const organizationId = String(process.argv[2] || '').trim();
  const asOf = String(process.argv[3] || '').trim();
  const initiativeIds = String(process.argv[4] || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  const connectionString = String(process.env.DATABASE_URL || '').trim();
  if (!organizationId || !asOf || !initiativeIds.length)
    throw new Error('organization id, asOf and comma-separated initiative ids required');
  if (!connectionString) throw new Error('DATABASE_URL required');
  if (initiativeIds.length > 100) throw new Error('M1_INITIATIVE_SCOPE_INVALID');

  const pool = new Pool({
    connectionString,
    max: 1,
    ssl:
      process.env.DB_SSL === 'true' || process.env.DB_SSL === 'require'
        ? { rejectUnauthorized: false }
        : undefined,
  });
  try {
    const users = await pool.query<{ user_id: string; name: string }>(
      `SELECT DISTINCT t.assignee_id AS user_id,
              COALESCE(NULLIF(TRIM(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'')),''),u.email,t.assignee_id) AS name
         FROM tasks t JOIN users u ON u.id=t.assignee_id AND u.organization_id=t.organization_id
        WHERE t.organization_id=$1 AND t.initiative_id = ANY($2::text[])
        ORDER BY name`,
      [organizationId, initiativeIds]
    );
    const anchor = parseDay(asOf);
    if (!anchor) throw new Error('M1_FORECAST_ANCHOR_INVALID');
    const weekStarts = Array.from({ length: 4 }, (_, index) =>
      formatDate(addDays(monday(anchor), index * 7))
    );
    const forecasts = [];
    for (const user of users.rows) {
      const profileResult = await pool.query<{
        weekly_capacity_hours: number | string | null;
        availability_percent: number | null;
      }>(
        'SELECT weekly_capacity_hours, availability_percent FROM users WHERE id=$1 AND organization_id=$2',
        [user.user_id, organizationId]
      );
      const profile = profileResult.rows[0];
      if (!profile) throw new Error('M1_USER_NOT_FOUND');
      const raw = Number(profile.weekly_capacity_hours);
      const capacity =
        profile.weekly_capacity_hours === null ? 40 : Number.isFinite(raw) && raw >= 0 ? raw : 40;
      const availability = Math.min(
        100,
        Math.max(0, Number(profile.availability_percent ?? 100) || 0)
      );
      const explicit = new Map<string, { hours: number; taskIds: string[] }>();
      try {
        const allocations = await pool.query<{
          week_start: string | Date;
          task_id: string;
          hours: number | string;
        }>(
          `SELECT ta.week_start,ta.task_id,COALESCE(SUM(ta.allocated_hours),0) AS hours
             FROM task_allocations ta JOIN tasks t ON t.id=ta.task_id AND t.organization_id=ta.organization_id
            WHERE ta.user_id=$1 AND ta.organization_id=$2 AND ta.week_start = ANY($3::date[]) AND t.initiative_id = ANY($4::text[])
            GROUP BY ta.week_start,ta.task_id`,
          [user.user_id, organizationId, weekStarts, initiativeIds]
        );
        for (const row of allocations.rows) {
          const key = formatDate(parseDay(row.week_start) as Date);
          const current = explicit.get(key) ?? { hours: 0, taskIds: [] };
          current.hours += Number(row.hours) || 0;
          current.taskIds = [...new Set([...current.taskIds, String(row.task_id)])].sort();
          explicit.set(key, current);
        }
      } catch (error) {
        if (!(error && typeof error === 'object' && 'code' in error && error.code === '42P01'))
          throw error;
      }
      const tasks = await pool.query<{
        task_id: string;
        estimated_hours: number | string | null;
        started_at: string | Date | null;
        created_at: string | Date | null;
        due_date: string | Date | null;
      }>(
        `SELECT id AS task_id,estimated_hours,started_at,created_at,due_date FROM tasks
          WHERE assignee_id=$1 AND organization_id=$2 AND LOWER(COALESCE(status,'')) <> ALL($3::text[]) AND initiative_id = ANY($4::text[]) ORDER BY id`,
        [user.user_id, organizationId, CLOSED, initiativeIds]
      );
      const fallback = new Map<string, Map<string, number>>();
      const unknown = new Map(weekStarts.map((week) => [week, new Set<string>()]));
      for (const task of tasks.rows) {
        const due = parseDay(task.due_date);
        const estimate = Number(task.estimated_hours);
        if (!due) {
          for (const ids of unknown.values()) ids.add(task.task_id);
          continue;
        }
        const start = parseDay(task.started_at) ?? parseDay(task.created_at) ?? due;
        for (const [week, hours] of spread(
          start,
          due,
          Number.isFinite(estimate) && estimate > 0 ? estimate : 1
        )) {
          if (!unknown.has(week)) continue;
          if (!Number.isFinite(estimate) || estimate <= 0) {
            unknown.get(week)?.add(task.task_id);
            continue;
          }
          const values = fallback.get(week) ?? new Map<string, number>();
          values.set(task.task_id, (values.get(task.task_id) ?? 0) + hours);
          fallback.set(week, values);
        }
      }
      forecasts.push({
        userId: user.user_id,
        name: user.name,
        weeks: weekStarts.map((weekStart) => {
          const allocated = explicit.get(weekStart);
          const explicitIds = new Set(allocated?.taskIds ?? []);
          const fallbackTasks = [...(fallback.get(weekStart) ?? [])].filter(
            ([id]) => !explicitIds.has(id)
          );
          const demand =
            (allocated?.hours ?? 0) + fallbackTasks.reduce((sum, [, hours]) => sum + hours, 0);
          const unknownTaskIds = [...(unknown.get(weekStart) ?? [])]
            .filter((id) => !explicitIds.has(id))
            .sort();
          const capacityHours = round1((capacity * availability) / 100);
          return {
            weekStart,
            capacityHours,
            allocatedHours: round1(demand),
            availableHours: round1(Math.max(0, capacityHours - demand)),
            taskIds: [
              ...new Set([...(allocated?.taskIds ?? []), ...fallbackTasks.map(([id]) => id)]),
            ].sort(),
            unknownTaskIds,
            knowledgeState: unknownTaskIds.length ? 'UNKNOWN' : 'KNOWN',
          };
        }),
      });
    }
    process.stdout.write(
      `${JSON.stringify({ organizationId, asOf, initiativeCount: initiativeIds.length, userCount: forecasts.length, forecasts }, null, 2)}\n`
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
