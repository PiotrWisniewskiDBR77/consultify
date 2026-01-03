/**
 * Add missing DBR77 users to the database
 * 
 * Users to add:
 * - konrad.milewski@dbr77.com - PROJECT_MANAGER
 * - pawel.mroczkowski@dbr77.com - TEAM_MEMBER
 * - tomasz.jankowski@dbr77.com - MANAGER
 * 
 * Usage: node scripts/add_dbr77_users.cjs
 */

const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

// Configuration
const DEFAULT_PASSWORD = '123456';
const DBR77_ORG_NAME = 'Consultify / DBR77';

const USERS_TO_ADD = [
    {
        email: 'konrad.milewski@dbr77.com',
        firstName: 'Konrad',
        lastName: 'Milewski',
        role: 'PROJECT_MANAGER'
    },
    {
        email: 'pawel.mroczkowski@dbr77.com',
        firstName: 'Paweł',
        lastName: 'Mroczkowski',
        role: 'TEAM_MEMBER'
    },
    {
        email: 'tomasz.jankowski@dbr77.com',
        firstName: 'Tomasz',
        lastName: 'Jankowski',
        role: 'MANAGER'
    }
];

// Detect database type
const databaseUrl = process.env.DATABASE_URL;
const usePostgres = databaseUrl && databaseUrl.startsWith('postgres');

console.log('🚀 Adding missing DBR77 users...');
console.log(`📦 Database: ${usePostgres ? 'PostgreSQL' : 'SQLite'}`);

async function addUsersToPostgres() {
    const pool = new Pool({
        connectionString: databaseUrl,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    try {
        // Find DBR77 organization
        const orgResult = await pool.query(
            "SELECT id FROM organizations WHERE name LIKE '%DBR77%' OR name LIKE '%Consultify%' LIMIT 1"
        );

        if (orgResult.rows.length === 0) {
            console.error('❌ DBR77 organization not found!');
            return;
        }

        const orgId = orgResult.rows[0].id;
        console.log(`✅ Found organization: ${orgId}`);

        const hashedPassword = bcrypt.hashSync(DEFAULT_PASSWORD, 8);

        for (const user of USERS_TO_ADD) {
            // Check if user already exists
            const existingUser = await pool.query(
                'SELECT id FROM users WHERE email = $1',
                [user.email]
            );

            if (existingUser.rows.length > 0) {
                console.log(`⏭️  User ${user.email} already exists, skipping...`);
                continue;
            }

            const userId = uuidv4();
            await pool.query(
                `INSERT INTO users (id, organization_id, email, password, first_name, last_name, role, status, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', NOW())`,
                [userId, orgId, user.email, hashedPassword, user.firstName, user.lastName, user.role]
            );

            console.log(`✅ Added user: ${user.email} (${user.role})`);
        }

        console.log('\n✅ PostgreSQL users added successfully!');
    } catch (error) {
        console.error('❌ PostgreSQL error:', error.message);
    } finally {
        await pool.end();
    }
}

function addUsersToSqlite() {
    // Try multiple possible database paths
    const possiblePaths = [
        path.resolve(__dirname, '../server/consultify.db'),
        path.resolve(__dirname, '../database.sqlite'),
        path.resolve(__dirname, '../server/database.sqlite')
    ];

    let dbPath = null;
    const fs = require('fs');

    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            dbPath = p;
            break;
        }
    }

    if (!dbPath) {
        console.error('❌ SQLite database not found! Tried:', possiblePaths);
        return;
    }

    console.log(`📁 Using database: ${dbPath}`);

    const db = new sqlite3.Database(dbPath);

    db.serialize(() => {
        // Find DBR77 organization
        db.get(
            "SELECT id FROM organizations WHERE name LIKE '%DBR77%' OR name LIKE '%Consultify%' LIMIT 1",
            [],
            (err, org) => {
                if (err) {
                    console.error('❌ Error finding organization:', err.message);
                    db.close();
                    return;
                }

                if (!org) {
                    console.error('❌ DBR77 organization not found!');
                    db.close();
                    return;
                }

                const orgId = org.id;
                console.log(`✅ Found organization: ${orgId}`);

                const hashedPassword = bcrypt.hashSync(DEFAULT_PASSWORD, 8);

                const insertUser = db.prepare(`
                    INSERT INTO users (id, organization_id, email, password, first_name, last_name, role, status, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, 'active', datetime('now'))
                `);

                let addedCount = 0;
                let skippedCount = 0;
                let processedCount = 0;

                USERS_TO_ADD.forEach((user, index) => {
                    // Check if user exists
                    db.get('SELECT id FROM users WHERE email = ?', [user.email], (err, existing) => {
                        if (existing) {
                            console.log(`⏭️  User ${user.email} already exists, skipping...`);
                            skippedCount++;
                        } else {
                            const userId = uuidv4();
                            insertUser.run(
                                userId,
                                orgId,
                                user.email,
                                hashedPassword,
                                user.firstName,
                                user.lastName,
                                user.role,
                                (err) => {
                                    if (err) {
                                        console.error(`❌ Error adding ${user.email}:`, err.message);
                                    } else {
                                        console.log(`✅ Added user: ${user.email} (${user.role})`);
                                        addedCount++;
                                    }
                                }
                            );
                        }

                        processedCount++;

                        // Finalize when all users processed
                        if (processedCount === USERS_TO_ADD.length) {
                            setTimeout(() => {
                                insertUser.finalize();
                                db.close(() => {
                                    console.log(`\n📊 Summary: Added ${addedCount}, Skipped ${skippedCount}`);
                                    console.log('✅ SQLite users update complete!');
                                });
                            }, 500);
                        }
                    });
                });
            }
        );
    });
}

// Main execution
if (usePostgres) {
    addUsersToPostgres();
} else {
    addUsersToSqlite();
}








