/**
 * Seed DBR77 Test Users for Review System
 * 
 * Adds team members to DBR77 organization with admin role
 * All users can participate in assessment reviews.
 * 
 * Usage:
 *   node server/seed/seed_dbr77_users.js
 */

const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

// Detect database type
const isPostgres = process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres');

let db;
if (isPostgres) {
    require('dotenv').config();
    const { Pool } = require('pg');
    db = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
    });
} else {
    db = require('../database');
}

// ============================================================
// DATABASE HELPERS
// ============================================================

async function dbRun(sql, params = []) {
    if (isPostgres) {
        let pgSql = sql;
        let paramIndex = 0;
        pgSql = pgSql.replace(/\?/g, () => `$${++paramIndex}`);
        pgSql = pgSql.replace(/datetime\('now'\)/gi, 'NOW()');
        const result = await db.query(pgSql, params);
        return result;
    } else {
        return new Promise((resolve, reject) => {
            db.run(sql, params, function(err) {
                if (err) reject(err);
                else resolve({ lastID: this.lastID, changes: this.changes });
            });
        });
    }
}

async function dbGet(sql, params = []) {
    if (isPostgres) {
        let pgSql = sql;
        let paramIndex = 0;
        pgSql = pgSql.replace(/\?/g, () => `$${++paramIndex}`);
        const result = await db.query(pgSql, params);
        return result.rows[0];
    } else {
        return new Promise((resolve, reject) => {
            db.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }
}

// ============================================================
// USERS TO ADD
// ============================================================

const USERS = [
    { firstName: 'Justyna', lastName: 'Laskowska', email: 'justyna.laskowska@dbr77.com' },
    { firstName: 'Paweł', lastName: 'Mroczkowski', email: 'pawel.mroczkowski@dbr77.com' },
    { firstName: 'Bartek', lastName: 'Straszak', email: 'bartek.straszak@dbr77.com' },
    { firstName: 'Paweł', lastName: 'Dera', email: 'pawel.dera@dbr77.com' },
    { firstName: 'Konrad', lastName: 'Milewski', email: 'konrad.milewski@dbr77.com' },
    { firstName: 'Katarzyna', lastName: 'Szwarocka', email: 'katarzyna.szwarocka@dbr77.com' },
    { firstName: 'Tomasz', lastName: 'Jankowski', email: 'tomasz.jankowski@dbr77.com' },
    { firstName: 'Marcin', lastName: 'Żórawik', email: 'marcin.zorawik@db77.pl' },
];

// ============================================================
// MAIN SEED FUNCTION
// ============================================================

async function seedDBR77Users() {
    console.log('🌱 Seeding DBR77 Test Users...\n');
    console.log(`   Database: ${isPostgres ? 'PostgreSQL' : 'SQLite'}\n`);

    try {
        // 1. Find DBR77 organization
        const org = await dbGet(`SELECT id FROM organizations WHERE name LIKE '%DBR77%' LIMIT 1`);
        if (!org) {
            console.error('❌ DBR77 organization not found. Run seed_dbr77 first.');
            process.exit(1);
        }
        const organizationId = org.id;
        console.log(`✅ Found DBR77 organization: ${organizationId}`);

        // 2. Hash password
        const password = bcrypt.hashSync('123456', 8);
        console.log('✅ Password hash created');

        // 3. Create users
        console.log('\n👥 Creating users...\n');
        let created = 0;
        let skipped = 0;

        for (const user of USERS) {
            // Check if user already exists
            const existing = await dbGet(`SELECT id FROM users WHERE email = ?`, [user.email]);
            
            if (existing) {
                console.log(`   ⏭️  ${user.firstName} ${user.lastName} (${user.email}) - already exists`);
                skipped++;
                continue;
            }

            const userId = uuidv4();
            
            await dbRun(`
                INSERT INTO users (id, organization_id, email, password, first_name, last_name, role, status)
                VALUES (?, ?, ?, ?, ?, ?, 'admin', 'active')
            `, [userId, organizationId, user.email, password, user.firstName, user.lastName]);

            console.log(`   ✅ ${user.firstName} ${user.lastName} (${user.email})`);
            created++;
        }

        // ============================================================
        // SUMMARY
        // ============================================================
        console.log('\n' + '='.repeat(60));
        console.log('✅ DBR77 Users seeding complete!');
        console.log('='.repeat(60));
        console.log('\n📋 Summary:');
        console.log(`   Created: ${created}`);
        console.log(`   Skipped (already exist): ${skipped}`);
        console.log('\n   Users (password: 123456):');
        for (const user of USERS) {
            console.log(`   - ${user.email} (${user.firstName} ${user.lastName})`);
        }
        console.log('\n   All users have admin role and can review assessments.');

    } catch (error) {
        console.error('\n❌ Error seeding:', error);
        throw error;
    } finally {
        if (isPostgres) {
            await db.end();
        }
    }
}

// Run
if (require.main === module) {
    seedDBR77Users()
        .then(() => {
            console.log('\n🎉 Done!');
            process.exit(0);
        })
        .catch((err) => {
            console.error('Fatal error:', err);
            process.exit(1);
        });
}

module.exports = seedDBR77Users;



