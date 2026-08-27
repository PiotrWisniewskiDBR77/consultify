/**
 * Demo User Seed Script (Generic demo)
 * Creates the piotr.wisniewski@demo.com user and DEMO organization if they don't exist
 *
 * Run:
 *   node server/seeds/demoUser_demo.js
 */
import bcrypt from 'bcryptjs';
import path from 'path';

function requireEnv(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) {
    console.error(`[ODMOWA] Brak zmiennej ${name}. Ustaw ją przed uruchomieniem seeda.`);
    process.exit(1);
  }
  return value;
}

export const DEMO_PASSWORD = requireEnv('SEED_USER_PASSWORD');

// SQLite + Postgres compatible (mirrors v3 seed scripts)
const isPostgres = process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres');

let db;
if (isPostgres) {
  const dotenv = await import('dotenv');
  dotenv.config();
  const pg = await import('pg');
  const { Pool } = pg.default || pg;
  db = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });
} else {
  const sqlite3Module = await import('sqlite3');
  const sqlite3 = sqlite3Module.default.verbose();
  const __dirname = path.dirname(new URL(import.meta.url).pathname);
  const dbPath = path.resolve(__dirname, '../consultinity.db');
  db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('❌ Error opening database:', err.message);
      process.exit(1);
    }
    console.log('📂 Connected to SQLite database:', dbPath);
  });
}

async function dbRun(sql, params = []) {
  if (isPostgres) {
    let pgSql = sql;
    let paramIndex = 0;
    pgSql = pgSql.replace(/\?/g, () => `$${++paramIndex}`);
    pgSql = pgSql.replace(/datetime\('now'\)/gi, 'NOW()');
    pgSql = pgSql.replace(/datetime\('now', '([^']+)'\)/gi, "NOW() + INTERVAL '$1'");
    pgSql = pgSql.replace(/INSERT\s+OR\s+IGNORE\s+INTO/gi, 'INSERT INTO');
    pgSql = pgSql.replace(/INSERT\s+OR\s+REPLACE\s+INTO/gi, 'INSERT INTO');
    return await db.query(pgSql, params);
  }
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

async function dbGet(sql, params = []) {
  if (isPostgres) {
    let pgSql = sql;
    let paramIndex = 0;
    pgSql = pgSql.replace(/\?/g, () => `$${++paramIndex}`);
    const result = await db.query(pgSql, params);
    return result.rows[0];
  }
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

export const DEMO_ORG_ID = 'org-demo-public';
export const DEMO_USER_ID = 'user-demo-public-admin';
export const DEMO_EMAIL = 'piotr.wisniewski@demo.com';

async function seedDemoUser() {
  console.log('🚀 Seeding Demo User...');

  const existingUser = await dbGet(`SELECT id FROM users WHERE email = ?`, [DEMO_EMAIL]);
  if (existingUser) {
    console.log('✅ Demo user already exists:', DEMO_EMAIL);
    return;
  }

  const existingOrg = await dbGet(`SELECT id FROM organizations WHERE id = ?`, [DEMO_ORG_ID]);
  if (!existingOrg) {
    const now = new Date();
    const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    await dbRun(
      `INSERT INTO organizations(id, name, plan, status, organization_type, trial_started_at, trial_expires_at, is_active)
       VALUES(?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        DEMO_ORG_ID,
        'Consultinity Demo',
        'enterprise',
        'active',
        'DEMO',
        now.toISOString(),
        expires.toISOString(),
        1,
      ]
    );
    console.log('✅ Created demo organization (DEMO)');
  } else {
    console.log('✅ Demo organization already exists');
  }

  // Ensure default DEMO limits exist (required for daily AI caps + token budgets)
  const existingLimits = await dbGet(
    `SELECT id FROM organization_limits WHERE organization_id = ?`,
    [DEMO_ORG_ID]
  );
  if (!existingLimits) {
    await dbRun(
      `INSERT INTO organization_limits(
          id,
          organization_id,
          max_projects,
          max_users,
          max_ai_calls_per_day,
          max_initiatives,
          max_storage_mb,
          max_total_tokens,
          ai_roles_enabled_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [`limits-${DEMO_ORG_ID}`, DEMO_ORG_ID, 1, 1, 10, 5, 10, 10000, '["ADVISOR"]']
    );
    console.log('✅ Created demo organization limits');
  }

  const hashedPassword = bcrypt.hashSync(DEMO_PASSWORD, 8);
  await dbRun(
    `INSERT INTO users(id, organization_id, email, password, first_name, last_name, role, status)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?)`,
    [DEMO_USER_ID, DEMO_ORG_ID, DEMO_EMAIL, hashedPassword, 'Demo', 'User', 'ADMIN', 'active']
  );
  console.log('✅ Created demo user:', DEMO_EMAIL);

  // Create a minimal sample project for demo navigation
  const projectId = 'project-demo-001';
  try {
    await dbRun(
      `INSERT OR IGNORE INTO projects(id, organization_id, name, status, owner_id)
       VALUES(?, ?, ?, ?, ?)`,
      [projectId, DEMO_ORG_ID, 'Demo Workspace', 'active', DEMO_USER_ID]
    );
    console.log('✅ Created demo project');
  } catch (err) {
    console.warn('⚠️ Could not create demo project:', err);
  }
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  seedDemoUser()
    .then(() => {
      console.log('🎉 Demo user seeding complete!');
      if (!isPostgres) db.close();
      process.exit(0);
    })
    .catch((err) => {
      console.error('💥 Demo user seeding failed:', err);
      if (!isPostgres) db.close();
      process.exit(1);
    });
}

export default { seedDemoUser, DEMO_EMAIL, DEMO_PASSWORD, DEMO_ORG_ID, DEMO_USER_ID };
