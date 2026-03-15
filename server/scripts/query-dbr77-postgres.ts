#!/usr/bin/env tsx
/**
 * Query DBR77 data from PostgreSQL
 * Usage: DB_TYPE=postgres tsx server/scripts/query-dbr77-postgres.ts
 *       tsx server/scripts/query-dbr77-postgres.ts --user piotr.wisniewski@dbr77.com
 * Or: DATABASE_URL=postgresql://user:pass@host:5432/db tsx server/scripts/query-dbr77-postgres.ts
 */
import { Pool } from 'pg';

import {
  assertNoLocalDatabaseOutsideTests,
  resolveReachableDatabaseUrl,
} from '../src/config/databaseTargetResolver.js';

const resolvedDatabase = resolveReachableDatabaseUrl();
assertNoLocalDatabaseOutsideTests(process.env);

if (!resolvedDatabase.databaseUrl) {
  throw new Error(
    'DATABASE_URL or DATABASE_PUBLIC_URL is required. This script only supports the external Postgres target.'
  );
}

const DATABASE_URL = resolvedDatabase.databaseUrl;

const USER_EMAIL = process.argv.includes('--user')
  ? process.argv[process.argv.indexOf('--user') + 1]
  : 'piotr.wisniewski@dbr77.com';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]> {
  const res = await pool.query(sql, params);
  return (res.rows || []) as T[];
}

async function main() {
  console.log('\n📊 DBR77 — dane w PostgreSQL\n');
  console.log('Connection:', DATABASE_URL.replace(/:[^:@]+@/, ':****@'));

  try {
    // 1. Organizations
    const orgs = await query<{ id: string; name: string; plan: string; status: string }>(
      `SELECT id, name, plan, status FROM organizations 
       WHERE name ILIKE '%DBR77%' OR id::text ILIKE '%dbr77%'`
    );
    console.log('\n📁 Organizations:');
    if (orgs.length === 0) {
      console.log('   (brak)');
    } else {
      orgs.forEach((o) => console.log(`   ${o.id} | ${o.name} | ${o.plan} | ${o.status}`));
    }

    let orgIds = orgs.map((o) => o.id);
    if (orgIds.length === 0) {
      // Fallback: try common DBR77 org IDs (works for TEXT or UUID)
      const fallback = await query<{ id: string }>(
        `SELECT id FROM organizations WHERE id::text IN ('org-dbr77-system', 'org-dbr77-test', 'org-dbr77', 'dbr77')`
      );
      orgIds = fallback.map((f) => String(f.id));
    }
    if (orgIds.length === 0) {
      console.log('\n⚠️ Brak organizacji DBR77 — sprawdź migracje i seed.');
      console.log('   Możliwe ID: org-dbr77-system, org-dbr77-test, org-dbr77, dbr77');
      await pool.end();
      return;
    }

    const placeholders = orgIds.map((_, i) => `$${i + 1}`).join(', ');

    // 2. Users
    const users = await query<{ id: string; email: string; role: string }>(
      `SELECT id, email, role FROM users WHERE organization_id IN (${placeholders}) LIMIT 20`,
      orgIds
    );
    console.log('\n👤 Users:');
    users.forEach((u) => console.log(`   ${u.id} | ${u.email} | ${u.role}`));
    if (users.length >= 20) console.log('   ... (więcej)');

    // 3. Projects
    const projects = await query<{ id: string; name: string; status: string }>(
      `SELECT id, name, status FROM projects WHERE organization_id IN (${placeholders})`,
      orgIds
    );
    console.log('\n📂 Projects:');
    projects.forEach((p) => console.log(`   ${p.id} | ${p.name} | ${p.status}`));

    // 4. Initiatives
    const initiatives = await query<{ id: string; name: string; status: string }>(
      `SELECT id, name, status FROM initiatives WHERE organization_id IN (${placeholders}) LIMIT 15`,
      orgIds
    );
    console.log('\n💡 Initiatives:');
    initiatives.forEach((i) => console.log(`   ${i.id} | ${i.name} | ${i.status}`));

    // 5. Tasks
    const tasksCount = await query<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM tasks WHERE organization_id IN (${placeholders})`,
      orgIds
    );
    console.log('\n📋 Tasks:', tasksCount[0]?.count ?? 0);

    // 6. Teams
    const teams = await query<{ id: string; name: string }>(
      `SELECT id, name FROM teams WHERE organization_id IN (${placeholders})`,
      orgIds
    );
    console.log('\n👥 Teams:');
    teams.forEach((t) => console.log(`   ${t.id} | ${t.name}`));

    // 7. Table counts for DBR77 orgs
    const tables = [
      'notifications',
      'security_incidents',
      'multi_framework_assessments',
      'status_reports',
      'kpi_definitions',
    ];
    console.log('\n📈 Liczby wierszy (tabele z organization_id):');
    for (const table of tables) {
      try {
        const r = await query<{ count: string }>(
          `SELECT COUNT(*)::text as count FROM ${table} WHERE organization_id IN (${placeholders})`,
          orgIds
        );
        console.log(`   ${table}: ${r[0]?.count ?? 0}`);
      } catch {
        console.log(`   ${table}: (brak tabeli lub kolumny)`);
      }
    }

    // 8. User-specific: piotr.wisniewski@dbr77.com
    const piotr = await query<{
      id: string;
      email: string;
      first_name: string;
      last_name: string;
      role: string;
      organization_id: string;
    }>(`SELECT id, email, first_name, last_name, role, organization_id FROM users WHERE email = $1`, [
      USER_EMAIL,
    ]);
    if (piotr.length > 0) {
      const u = piotr[0];
      const userId = u.id;
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`👤 Użytkownik: ${u.first_name} ${u.last_name} (${u.email})`);
      console.log(`   ID: ${userId} | Rola: ${u.role} | Org: ${u.organization_id}`);
      const ownedProjects = await query<{ id: string; name: string }>(
        `SELECT id, name FROM projects WHERE owner_id = $1`,
        [userId]
      );
      console.log(`\n   📂 Projekty (owner): ${ownedProjects.length}`);
      ownedProjects.forEach((p) => console.log(`      ${p.name}`));
      const assignedTasks = await query<{
        id: string;
        title: string;
        status: string;
        project_id: string;
      }>(
        `SELECT t.id, t.title, t.status, t.project_id FROM tasks t WHERE t.assignee_id = $1 LIMIT 15`,
        [userId]
      );
      console.log(`\n   📋 Zadania (assignee): ${assignedTasks.length}`);
      assignedTasks.forEach((t) => console.log(`      [${t.status}] ${t.title}`));
      const reportedTasks = await query<{ count: string }>(
        `SELECT COUNT(*)::text FROM tasks WHERE reporter_id = $1`,
        [userId]
      );
      console.log(`   📋 Zadania (reporter): ${reportedTasks[0]?.count ?? 0}`);
      const ownedInitiatives = await query<{ id: string; name: string; status: string }>(
        `SELECT id, name, status FROM initiatives WHERE owner_business_id = $1 OR owner_execution_id = $1 LIMIT 10`,
        [userId]
      );
      console.log(`\n   💡 Inicjatywy (owner): ${ownedInitiatives.length}`);
      ownedInitiatives.forEach((i) => console.log(`      [${i.status}] ${i.name}`));
    } else {
      console.log(`\n⚠️ Użytkownik ${USER_EMAIL} nie znaleziony.`);
    }

    console.log('\n✅ Gotowe.\n');
  } catch (err) {
    console.error('❌ Błąd:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
