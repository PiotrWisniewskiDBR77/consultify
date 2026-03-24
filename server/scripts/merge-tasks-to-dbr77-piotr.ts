#!/usr/bin/env npx tsx
/**
 * Merge & assign tasks to piotr.wisniewski@dbr77.com in DBR77 organization
 *
 * 1. Merges tasks assigned to this user (from any org) to DBR77
 * 2. Assigns unassigned tasks in DBR77 to this user (so they appear in My Work)
 *
 * Usage (repo root):
 *   npx tsx server/scripts/merge-tasks-to-dbr77-piotr.ts
 *
 * Uses DATABASE_URL or DATABASE_PUBLIC_URL from .env. For Railway DB from laptop,
 * set DATABASE_PUBLIC_URL to the public Postgres URL.
 *
 * Options:
 *   --dry-run    Only report what would be updated, do not execute
 *
 * To add demo tasks for DBR77:
 *   SEED_ORG_ID=dbr77 SEED_USER_EMAIL=piotr.wisniewski@dbr77.com npx tsx server/scripts/seed-mywork-demo.ts
 */

import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const TARGET_EMAIL = 'piotr.wisniewski@dbr77.com';
const TARGET_ORG_NAMES = ['DBR77', 'Consultinity / DBR77'];
const TARGET_ORG_IDS = ['dbr77', 'org-dbr77-system', 'org-dbr77-test'];

async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  if (isDryRun) {
    console.log('🔍 DRY RUN — no changes will be made\n');
  }

  const { getDatabaseAsync } = await import('../src/database/Database.js');
  const db = await getDatabaseAsync();

  // 1. Find DBR77 organization
  const orgResult = await db.query<{ id: string; name: string }>(
    `SELECT id, name FROM organizations 
     WHERE id = ANY($1) OR name ILIKE '%DBR77%' OR name ILIKE '%Consultinity%DBR77%'
     ORDER BY CASE WHEN id = 'dbr77' THEN 0 WHEN id LIKE 'org-dbr77%' THEN 1 ELSE 2 END
     LIMIT 1`,
    [TARGET_ORG_IDS]
  );
  const orgRow = orgResult?.rows?.[0];
  if (!orgRow) {
    console.error('❌ DBR77 organization not found. Run seed_dbr77_postgres.js first.');
    process.exit(1);
  }
  const orgId = orgRow.id;
  console.log(`✅ Organization: ${orgRow.name} (${orgId})`);

  // 2. Find piotr.wisniewski@dbr77.com user (prefer in DBR77 org)
  const userResult = await db.query<{ id: string; email: string; organization_id: string }>(
    `SELECT id, email, organization_id FROM users 
     WHERE LOWER(email) = LOWER($1)
     ORDER BY CASE WHEN organization_id = $2 THEN 0 ELSE 1 END
     LIMIT 1`,
    [TARGET_EMAIL, orgId]
  );
  const userRow = userResult?.rows?.[0];
  if (!userRow) {
    console.error(`❌ User ${TARGET_EMAIL} not found.`);
    process.exit(1);
  }
  const userId = userRow.id;
  console.log(`✅ User: ${userRow.email} (${userId})`);

  // 3. Find all user ids with this email (for tasks assigned to any of them)
  const allUserIdsResult = await db.query<{ id: string }>(
    `SELECT id FROM users WHERE LOWER(email) = LOWER($1)`,
    [TARGET_EMAIL]
  );
  const allUserIds = (allUserIdsResult?.rows || []).map((r) => r.id);
  if (allUserIds.length === 0) {
    console.error('❌ No users found.');
    process.exit(1);
  }

  // 4. Count tasks to merge (assigned to any of this user's ids, not already in correct org+assignee)
  const countResult = await db.query<{ cnt: string }>(
    `SELECT COUNT(*) as cnt FROM tasks 
     WHERE assignee_id = ANY($1) 
     AND (organization_id IS DISTINCT FROM $2 OR assignee_id IS DISTINCT FROM $3)`,
    [allUserIds, orgId, userId]
  );
  const count = parseInt(countResult?.rows?.[0]?.cnt || '0', 10);

  if (count > 0) {
    console.log(`\n📋 Found ${count} task(s) to merge to DBR77 + ${TARGET_EMAIL}`);
  }

  let totalUpdated = 0;

  if (count > 0 && isDryRun) {
    const previewResult = await db.query<{ id: string; title: string; organization_id: string }>(
      `SELECT id, title, organization_id FROM tasks 
       WHERE assignee_id = ANY($1) 
       AND (organization_id IS DISTINCT FROM $2 OR assignee_id IS DISTINCT FROM $3)
       LIMIT 20`,
      [allUserIds, orgId, userId]
    );
    console.log('\nSample tasks that would be updated:');
    (previewResult?.rows || []).forEach((r) => {
      console.log(`   - ${r.title?.slice(0, 50) || r.id}... (org: ${r.organization_id})`);
    });
    if (count > 20) {
      console.log(`   ... and ${count - 20} more`);
    }
    console.log('\nRun without --dry-run to apply changes.');
  } else if (count > 0) {
    // 5. Execute merge (org + assignee; set task_type=personal for personal-tasks view)
    const updateResult = await db.run(
      `UPDATE tasks 
       SET organization_id = $1, assignee_id = $2, 
           task_type = COALESCE(NULLIF(COALESCE(task_type,''), ''), 'personal')
       WHERE assignee_id = ANY($3) 
       AND (organization_id IS DISTINCT FROM $1 OR assignee_id IS DISTINCT FROM $2)`,
      [orgId, userId, allUserIds]
    );
    totalUpdated = (updateResult as { changes?: number })?.changes ?? 0;
  }

  // 6. Assign unassigned tasks in DBR77 to this user
  const unassignedCountResult = await db.query<{ cnt: string }>(
    `SELECT COUNT(*) as cnt FROM tasks 
     WHERE organization_id = $1 
     AND (assignee_id IS NULL OR assignee_id = '')`,
    [orgId]
  );
  const unassignedCount = parseInt(unassignedCountResult?.rows?.[0]?.cnt || '0', 10);

  if (unassignedCount > 0) {
    console.log(`\n📋 Found ${unassignedCount} unassigned task(s) in DBR77 — assigning to ${TARGET_EMAIL}`);

    if (!isDryRun) {
      const assignResult = await db.run(
        `UPDATE tasks 
         SET assignee_id = $1, task_type = COALESCE(NULLIF(COALESCE(task_type,''), ''), 'personal')
         WHERE organization_id = $2 
         AND (assignee_id IS NULL OR assignee_id = '')`,
        [userId, orgId]
      );
      const assigned = (assignResult as { changes?: number })?.changes ?? 0;
      totalUpdated += assigned;
      console.log(`   Assigned ${assigned} task(s) to ${TARGET_EMAIL}`);
    } else {
      const previewResult = await db.query<{ id: string; title: string }>(
        `SELECT id, title FROM tasks 
         WHERE organization_id = $1 AND (assignee_id IS NULL OR assignee_id = '')
         LIMIT 10`,
        [orgId]
      );
      console.log('   Sample:');
      (previewResult?.rows || []).forEach((r) => {
        console.log(`   - ${(r.title || '').slice(0, 50)}...`);
      });
      if (unassignedCount > 10) console.log(`   ... and ${unassignedCount - 10} more`);
    }
  }

  console.log(`\n✅ Done. ${totalUpdated} task(s) updated for ${TARGET_EMAIL}`);
  console.log('   Refresh My Work → Tasks to see them.');
}

main().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
