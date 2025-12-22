/**
 * Quick check script to verify if DBR77 exists
 * 
 * Usage:
 *   node server/scripts/check_dbr77.js
 */

require('dotenv').config();
const { Pool } = require('pg');

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl || !databaseUrl.startsWith('postgres')) {
    console.error('ERROR: DATABASE_URL must be a PostgreSQL connection string');
    process.exit(1);
}

const pool = new Pool({
    connectionString: databaseUrl,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' } : false
});

async function checkDBR77() {
    console.log('🔍 Checking for DBR77 anchor tenant...\n');

    try {
        const result = await pool.query(
            "SELECT id, name, plan, status, created_at FROM organizations WHERE name LIKE '%DBR77%' OR id = 'dbr77'"
        );

        if (result.rows.length === 0) {
            console.log('❌ DBR77 NOT FOUND');
            console.log('\n📋 To create it, run:');
            console.log('   railway run node server/scripts/seed_dbr77_postgres.js');
            console.log('\n   Or locally:');
            console.log('   node server/scripts/seed_dbr77_postgres.js');
        } else {
            console.log('✅ DBR77 FOUND:');
            result.rows.forEach(row => {
                console.log(`   - ID: ${row.id}`);
                console.log(`   - Name: ${row.name}`);
                console.log(`   - Plan: ${row.plan}`);
                console.log(`   - Status: ${row.status}`);
                console.log(`   - Created: ${row.created_at}`);
                console.log('');
            });
        }

        // Also check total organizations
        const countResult = await pool.query('SELECT COUNT(*) as count FROM organizations');
        console.log(`📊 Total organizations in database: ${countResult.rows[0].count}`);

    } catch (error) {
        console.error('❌ Error checking DBR77:', error.message);
        console.error(error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

checkDBR77();

