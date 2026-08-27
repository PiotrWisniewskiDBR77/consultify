/**
 * Seed DBR77 Anchor Tenant for PostgreSQL
 *
 * This script creates the required DBR77 organization that serves as
 * a "semantic anchor" for the database. The SystemIntegrity check
 * requires this organization to exist.
 *
 * Usage:
 *   node server/scripts/seed_dbr77_postgres.js
 *
 * Or via Railway CLI:
 *   railway run node server/scripts/seed_dbr77_postgres.js
 */

import dotenv from 'dotenv';
dotenv.config();
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const databaseUrl = process.env.DATABASE_URL;
const seedUserPassword = String(process.env.SEED_USER_PASSWORD || '').trim();

if (!seedUserPassword) {
  console.error('[ODMOWA] Brak zmiennej SEED_USER_PASSWORD. Ustaw ją przed uruchomieniem seeda.');
  process.exit(1);
}

if (!databaseUrl || !databaseUrl.startsWith('postgres')) {
  console.error('ERROR: DATABASE_URL must be a PostgreSQL connection string');
  console.error('Current DATABASE_URL:', databaseUrl ? 'Set but invalid' : 'Not set');
  process.exit(1);
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl:
    process.env.DB_SSL === 'true'
      ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' }
      : false,
});

// IDs - using fixed IDs so we can check for existence
const DBR77_ORG_ID = 'dbr77'; // Fixed ID for easy lookup
const SA_ORG_ID = uuidv4();
const ADMIN_ID = uuidv4();
const PIOTR_ID = uuidv4();
const JUSTYNA_ID = uuidv4();
const PROJECT_ID = uuidv4();

const DEFAULT_PASSWORD = bcrypt.hashSync(seedUserPassword, 8);

async function seedDBR77() {
  console.log('🌱 Seeding DBR77 Anchor Tenant...\n');

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Check if DBR77 already exists
    const existingCheck = await client.query(
      "SELECT id, name FROM organizations WHERE name LIKE '%DBR77%' OR id = $1",
      [DBR77_ORG_ID]
    );

    if (existingCheck.rows.length > 0) {
      console.log('✅ DBR77 organization already exists:');
      existingCheck.rows.forEach((row) => {
        console.log(`   - ${row.name} (${row.id})`);
      });
      console.log('\n⚠️  Skipping seed - DBR77 already exists.');
      await client.query('ROLLBACK');
      return;
    }

    // 2. Create System Admin Organization (if needed)
    const saCheck = await client.query(
      "SELECT id FROM organizations WHERE name LIKE '%System Admin%' OR name LIKE '%Super Admin%' LIMIT 1"
    );

    let saOrgId = SA_ORG_ID;
    if (saCheck.rows.length > 0) {
      saOrgId = saCheck.rows[0].id;
      console.log(`📋 Using existing System Admin Org: ${saOrgId}`);
    } else {
      await client.query(
        `INSERT INTO organizations (id, name, plan, status, created_at)
                 VALUES ($1, $2, $3, $4, NOW())
                 ON CONFLICT (id) DO NOTHING`,
        [SA_ORG_ID, 'System Admin Org', 'enterprise', 'active']
      );
      console.log(`✅ Created System Admin Organization: ${SA_ORG_ID}`);
    }

    // 3. Create DBR77 Organization
    await client.query(
      `INSERT INTO organizations (id, name, plan, status, created_at)
             VALUES ($1, $2, $3, $4, NOW())
             ON CONFLICT (id) DO NOTHING`,
      [DBR77_ORG_ID, 'Consultinity / DBR77', 'enterprise', 'active']
    );
    console.log(`✅ Created DBR77 Organization: ${DBR77_ORG_ID}`);

    // 4. Create Super Admin User
    await client.query(
      `INSERT INTO users (id, organization_id, email, password, first_name, last_name, role, status, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
             ON CONFLICT (email) DO UPDATE SET
                 password = EXCLUDED.password,
                 first_name = EXCLUDED.first_name,
                 last_name = EXCLUDED.last_name,
                 role = EXCLUDED.role,
                 status = EXCLUDED.status`,
      [
        ADMIN_ID,
        saOrgId,
        'admin@dbr77.com',
        DEFAULT_PASSWORD,
        'Super',
        'Admin',
        'SUPERADMIN',
        'active',
      ]
    );
    console.log(`✅ Created Super Admin: admin@dbr77.com (password: <HASLO>)`);

    // 5. Create DBR77 Users
    await client.query(
      `INSERT INTO users (id, organization_id, email, password, first_name, last_name, role, status, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
             ON CONFLICT (email) DO UPDATE SET
                 password = EXCLUDED.password,
                 first_name = EXCLUDED.first_name,
                 last_name = EXCLUDED.last_name,
                 role = EXCLUDED.role,
                 status = EXCLUDED.status`,
      [
        PIOTR_ID,
        DBR77_ORG_ID,
        'piotr.wisniewski@dbr77.com',
        DEFAULT_PASSWORD,
        'Piotr',
        'Wiśniewski',
        'ADMIN',
        'active',
      ]
    );
    console.log(`✅ Created Admin User: piotr.wisniewski@dbr77.com (password: <HASLO>)`);

    await client.query(
      `INSERT INTO users (id, organization_id, email, password, first_name, last_name, role, status, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
             ON CONFLICT (email) DO UPDATE SET
                 password = EXCLUDED.password,
                 first_name = EXCLUDED.first_name,
                 last_name = EXCLUDED.last_name,
                 role = EXCLUDED.role,
                 status = EXCLUDED.status`,
      [
        JUSTYNA_ID,
        DBR77_ORG_ID,
        'justyna.laskowska@dbr77.com',
        DEFAULT_PASSWORD,
        'Justyna',
        'Laskowska',
        'USER',
        'active',
      ]
    );
    console.log(`✅ Created User: justyna.laskowska@dbr77.com (password: <HASLO>)`);

    // 6. Create Default Project
    await client.query(
      `INSERT INTO projects (id, organization_id, name, status, owner_id, created_at)
             VALUES ($1, $2, $3, $4, $5, NOW())
             ON CONFLICT (id) DO NOTHING`,
      [PROJECT_ID, DBR77_ORG_ID, 'Digital Transformation 2025', 'active', PIOTR_ID]
    );
    console.log(`✅ Created Default Project: ${PROJECT_ID}`);

    // 7. Create LLM Provider (if table exists and no providers exist)
    // Note: Check if table exists first, and handle boolean vs integer types
    let llmCheck;
    try {
      // Try boolean first (PostgreSQL standard)
      llmCheck = await client.query(
        'SELECT COUNT(*) as count FROM llm_providers WHERE is_active = true'
      );
    } catch (err) {
      // Fallback to integer (0/1) if boolean doesn't work
      try {
        llmCheck = await client.query(
          'SELECT COUNT(*) as count FROM llm_providers WHERE is_active = 1'
        );
      } catch (err2) {
        // Table might not exist, skip LLM provider creation
        console.log('⚠️  llm_providers table not found, skipping LLM provider creation');
        llmCheck = { rows: [{ count: '1' }] }; // Set to non-zero to skip
      }
    }
    if (llmCheck.rows[0].count === '0') {
      // Try to insert a default LLM provider if GEMINI_API_KEY is set
      if (process.env.GEMINI_API_KEY) {
        try {
          // Try boolean values first
          await client.query(
            `INSERT INTO llm_providers (id, name, provider, api_key, is_active, is_default)
                       VALUES (gen_random_uuid(), $1, $2, $3, true, true)
                       ON CONFLICT DO NOTHING`,
            ['Google Gemini', 'gemini', process.env.GEMINI_API_KEY]
          );
          console.log(`✅ Created default LLM Provider: Google Gemini`);
        } catch (err) {
          // Fallback to integer values if boolean doesn't work
          await client.query(
            `INSERT INTO llm_providers (id, name, provider, api_key, is_active, is_default)
                       VALUES (gen_random_uuid(), $1, $2, $3, 1, 1)
                       ON CONFLICT DO NOTHING`,
            ['Google Gemini', 'gemini', process.env.GEMINI_API_KEY]
          );
          console.log(`✅ Created default LLM Provider: Google Gemini`);
        }
      } else {
        console.log(
          `⚠️  No LLM providers found and GEMINI_API_KEY not set. Add LLM providers manually.`
        );
      }
    }

    await client.query('COMMIT');
    console.log('\n✅ DBR77 seed completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`   - Organization: Consultinity / DBR77 (${DBR77_ORG_ID})`);
    console.log(
      `   - Users: admin@dbr77.com, piotr.wisniewski@dbr77.com, justyna.laskowska@dbr77.com`
    );
    console.log(`   - Default password: <HASLO>`);
    console.log(`   - Project: Digital Transformation 2025`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Error seeding DBR77:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the seed
seedDBR77().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
