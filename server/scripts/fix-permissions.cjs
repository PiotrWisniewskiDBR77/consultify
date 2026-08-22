const { Client } = require('pg');
const { v4: uuidv4 } = require('uuid');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('DATABASE_URL is required');

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  // Step 1: Add interview permission KEYS to permissions table
  console.log('=== Adding interview permissions to permissions table ===');
  const interviewPermissions = [
    { key: 'INTERVIEW_TEMPLATE_VIEW', name: 'View interview templates', desc: 'View interview templates', category: 'INTERVIEW', icon: 'visibility' },
    { key: 'INTERVIEW_TEMPLATE_USE', name: 'Use interview templates', desc: 'Use interview templates to create assignments', category: 'INTERVIEW', icon: 'play_arrow' },
    { key: 'INTERVIEW_TEMPLATE_MANAGE', name: 'Manage interview templates', desc: 'Create, edit, delete interview templates', category: 'INTERVIEW', icon: 'settings' },
    { key: 'INTERVIEW_ASSIGN_VIEW', name: 'View interview assignments', desc: 'View interview assignments and their status', category: 'INTERVIEW', icon: 'assignment' },
    { key: 'INTERVIEW_ASSIGN_MANAGE', name: 'Manage interview assignments', desc: 'Create, edit, manage interview assignments', category: 'INTERVIEW', icon: 'assignment_turned_in' },
    { key: 'INTERVIEW_REMIND', name: 'Send interview reminders', desc: 'Send reminders for interview assignments', category: 'INTERVIEW', icon: 'notifications' },
  ];

  for (const perm of interviewPermissions) {
    await client.query(
      `INSERT INTO permissions (key, name, description, category, icon, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (key) DO NOTHING`,
      [perm.key, perm.name, perm.desc, perm.category, perm.icon]
    );
    console.log(`  Added permission: ${perm.key}`);
  }

  // Step 2: Add role_permissions mappings
  console.log('\n=== Adding role_permissions ===');

  const rolePermMap = {
    SUPERADMIN: interviewPermissions.map(p => p.key),
    ADMIN: interviewPermissions.map(p => p.key),
    PROJECT_MANAGER: ['INTERVIEW_TEMPLATE_VIEW', 'INTERVIEW_TEMPLATE_USE', 'INTERVIEW_ASSIGN_VIEW', 'INTERVIEW_ASSIGN_MANAGE', 'INTERVIEW_REMIND'],
    TEAM_MEMBER: ['INTERVIEW_TEMPLATE_VIEW', 'INTERVIEW_TEMPLATE_USE', 'INTERVIEW_ASSIGN_VIEW'],
    VIEWER: ['INTERVIEW_TEMPLATE_VIEW', 'INTERVIEW_ASSIGN_VIEW'],
  };

  for (const [role, perms] of Object.entries(rolePermMap)) {
    for (const perm of perms) {
      const id = uuidv4();
      await client.query(
        `INSERT INTO role_permissions (id, role, permission_key, created_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT DO NOTHING`,
        [id, role, perm]
      );
    }
    console.log(`  Added ${perms.length} interview permissions for ${role}`);
  }

  // Step 3: Add missing user profile columns (from Fix 3 earlier)
  console.log('\n=== Adding missing user profile columns ===');
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
      console.log(`  Column ${col.name}: ${e.message.includes('already exists') ? 'already exists' : e.message}`);
    }
  }

  // Verify all
  console.log('\n=== Verification ===');
  
  const permCheck = await client.query(
    `SELECT rp.role, rp.permission_key FROM role_permissions rp WHERE rp.permission_key LIKE 'INTERVIEW%' ORDER BY rp.role, rp.permission_key`
  );
  console.log('Interview role_permissions:', permCheck.rows.length, 'entries');
  for (const r of permCheck.rows) {
    console.log(`  ${r.role}: ${r.permission_key}`);
  }

  const colCheck = await client.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'display_name'`
  );
  console.log('display_name column exists:', colCheck.rows.length > 0);

  console.log('\n=== ALL FIXES COMPLETE ===');
  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
