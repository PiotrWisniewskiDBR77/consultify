const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('DATABASE_URL is required');
const { v4: uuidv4 } = require('uuid');

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  // ========================================
  // FIX 1: Add V8 feature flags for aplix-na and vts
  // ========================================
  console.log('\n=== FIX 1: V8 Feature Flags ===');
  
  const modules = ['chat', 'teresa', 'knowledge_base', 'artifacts', 'presentations', 'wordy', 'excele'];
  const orgs = ['aplix-na', 'vts'];
  
  for (const org of orgs) {
    for (const mod of modules) {
      const flagId = uuidv4();
      await client.query(
        `INSERT INTO v8_feature_flags (flag_id, organization_id, module, enabled, updated_at, updated_by)
         VALUES ($1, $2, $3, 1, NOW(), 'system-migration')
         ON CONFLICT DO NOTHING`,
        [flagId, org, mod]
      );
    }
    console.log(`  Added V8 flags for ${org}`);
  }

  // Verify
  const flagCheck = await client.query(
    `SELECT organization_id, COUNT(*) as cnt FROM v8_feature_flags GROUP BY organization_id ORDER BY organization_id`
  );
  console.log('  V8 flags per org:', flagCheck.rows);

  // ========================================
  // FIX 2: Add INTERVIEW permissions for ADMIN role
  // ========================================
  console.log('\n=== FIX 2: Interview Permissions ===');
  
  const interviewPerms = [
    'INTERVIEW_TEMPLATE_VIEW',
    'INTERVIEW_TEMPLATE_USE',
    'INTERVIEW_TEMPLATE_MANAGE',
    'INTERVIEW_ASSIGN_VIEW',
    'INTERVIEW_ASSIGN_MANAGE',
    'INTERVIEW_REMIND',
  ];
  
  const rolesForPerms = ['ADMIN', 'SUPERADMIN'];
  
  for (const role of rolesForPerms) {
    for (const perm of interviewPerms) {
      const id = uuidv4();
      await client.query(
        `INSERT INTO role_permissions (id, role, permission_key, created_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT DO NOTHING`,
        [id, role, perm]
      );
    }
    console.log(`  Added interview permissions for ${role}`);
  }

  // Also add for PROJECT_MANAGER and TEAM_MEMBER (view/use only)
  const viewPerms = ['INTERVIEW_TEMPLATE_VIEW', 'INTERVIEW_TEMPLATE_USE', 'INTERVIEW_ASSIGN_VIEW'];
  for (const perm of viewPerms) {
    for (const role of ['PROJECT_MANAGER', 'TEAM_MEMBER']) {
      const id = uuidv4();
      await client.query(
        `INSERT INTO role_permissions (id, role, permission_key, created_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT DO NOTHING`,
        [id, role, perm]
      );
    }
  }
  console.log('  Added view permissions for PROJECT_MANAGER and TEAM_MEMBER');

  // Verify
  const permCheck = await client.query(
    `SELECT role, permission_key FROM role_permissions WHERE permission_key LIKE 'INTERVIEW%' ORDER BY role, permission_key`
  );
  console.log('  Interview permissions:', permCheck.rows);

  // ========================================
  // FIX 3: Add missing user profile columns
  // ========================================
  console.log('\n=== FIX 3: Missing User Profile Columns ===');
  
  const missingColumns = [
    { name: 'display_name', type: 'TEXT' },
    { name: 'pronouns', type: 'TEXT' },
    { name: 'department', type: 'TEXT' },
    { name: 'status_message', type: 'TEXT' },
    { name: 'out_of_office', type: 'BOOLEAN DEFAULT FALSE' },
    { name: 'vacation_end', type: 'TIMESTAMP' },
    { name: 'linkedin_id', type: 'TEXT' },
    { name: 'phone', type: 'TEXT' },
    { name: 'location', type: 'TEXT' },
    { name: 'seniority_level', type: 'TEXT' },
    { name: 'site_location', type: 'TEXT' },
    { name: 'tenure_years', type: 'NUMERIC' },
    { name: 'manages_team', type: 'BOOLEAN DEFAULT FALSE' },
    { name: 'team_size', type: 'INTEGER DEFAULT 0' },
    { name: 'expertise_tags', type: 'TEXT' },
    { name: 'engagement_level', type: 'TEXT' },
    { name: 'profile_survey_completed_at', type: 'TIMESTAMP' },
    { name: 'profile_survey_dismissed_count', type: 'INTEGER DEFAULT 0' },
    { name: 'profile_survey_last_dismissed_at', type: 'TIMESTAMP' },
  ];

  for (const col of missingColumns) {
    try {
      await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`);
      console.log(`  Added column: ${col.name}`);
    } catch (e) {
      if (e.message.includes('already exists')) {
        console.log(`  Column ${col.name} already exists`);
      } else {
        console.log(`  Error adding ${col.name}: ${e.message}`);
      }
    }
  }

  // Verify
  const colCheck = await client.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name IN ('display_name', 'pronouns', 'department')`
  );
  console.log('  Verified columns exist:', colCheck.rows.map(r => r.column_name));

  console.log('\n=== ALL FIXES APPLIED ===');
  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
