/**
 * Seed data script for Staging environment
 * Usage: node scripts/seed_staging.js
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const bcrypt = require('bcrypt');

async function seed() {
    console.log('🌱 Seeding Staging Database...');

    // 1. Create Test Organization
    const orgId = uuidv4();
    await run(`
        INSERT INTO organizations (id, name, plan, status, stripe_customer_id)
        VALUES (?, 'Staging Corp', 'enterprise', 'active', 'cus_test123')
    `, [orgId]);
    console.log('✅ Organization created');

    // 2. Create Admin User
    const adminId = uuidv4();
    const adminHash = await bcrypt.hash('StagingAdmin123!', 10);
    await run(`
        INSERT INTO users (id, organization_id, email, password_hash, first_name, last_name, role, status)
        VALUES (?, ?, 'admin@staging.consultify.app', ?, 'Admin', 'User', 'OWNER', 'active')
    `, [adminId, orgId, adminHash]);
    console.log('✅ Admin user created');

    // 3. Create Regular User
    const userId = uuidv4();
    const userHash = await bcrypt.hash('StagingUser123!', 10);
    await run(`
        INSERT INTO users (id, organization_id, email, password_hash, first_name, last_name, role, status)
        VALUES (?, ?, 'user@staging.consultify.app', ?, 'Test', 'User', 'USER', 'active')
    `, [userId, orgId, userHash]);
    console.log('✅ Regular user created');

    // 4. Create Mock Invoices
    const invoiceId = uuidv4();
    await run(`
        INSERT INTO invoices (id, organization_id, invoice_number, status, total, currency, due_date)
        VALUES (?, ?, 'INV-202412-0001', 'open', 500000, 'USD', datetime('now', '+30 days'))
    `, [invoiceId, orgId]);
    console.log('✅ Mock invoice created');

    console.log('✨ Seeding complete!');
    process.exit(0);
}

function run(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

seed().catch(err => {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
});
