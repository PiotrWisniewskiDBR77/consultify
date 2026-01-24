#!/usr/bin/env node
/**
 * Seed Billing Data for DBR77 Organization
 *
 * Seeds:
 * - Payment methods
 * - Invoices
 * - Spending alerts
 * - Billing alerts configuration
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

const db = require(path.join(__dirname, '../database'));

// Promisified helpers
const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

const get = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const all = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

async function seedBillingData() {
  console.log('🏦 Seeding Billing Data for DBR77...\n');

  try {
    // Find DBR77 organization - prioritize org-dbr77-test where user is assigned
    const org =
      (await get(`SELECT id, name FROM organizations WHERE id = 'org-dbr77-test' LIMIT 1`)) ||
      (await get(`SELECT id, name FROM organizations WHERE name LIKE '%DBR77%' LIMIT 1`));

    if (!org) {
      console.error('❌ DBR77 organization not found. Please run seed-dbr77-data.js first.');
      process.exit(1);
    }

    const orgId = org.id;
    console.log(`📍 Found organization: ${org.name} (${orgId})\n`);

    // Find admin user
    const admin = await get(
      `SELECT id, email FROM users WHERE organization_id = ? AND role IN ('ADMIN', 'OWNER') LIMIT 1`,
      [orgId]
    );
    const adminEmail = admin?.email || 'admin@dbr77.com';

    // ==========================================
    // 1. PAYMENT METHODS
    // ==========================================
    console.log('💳 Creating payment methods...');

    // Clear existing
    await run(`DELETE FROM payment_methods WHERE organization_id = ?`, [orgId]);

    // Add payment methods (using existing table structure with last_four)
    const paymentMethods = [
      {
        id: uuidv4(),
        type: 'card',
        brand: 'visa',
        last_four: '4242',
        expMonth: 12,
        expYear: 2027,
        isDefault: 1,
      },
      {
        id: uuidv4(),
        type: 'card',
        brand: 'mastercard',
        last_four: '5555',
        expMonth: 6,
        expYear: 2026,
        isDefault: 0,
      },
    ];

    for (const pm of paymentMethods) {
      await run(
        `
                INSERT INTO payment_methods (id, organization_id, type, brand, last_four, exp_month, exp_year, is_default)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `,
        [pm.id, orgId, pm.type, pm.brand, pm.last_four, pm.expMonth, pm.expYear, pm.isDefault]
      );
    }
    console.log(`  ✓ Created ${paymentMethods.length} payment methods`);

    // ==========================================
    // 2. INVOICES
    // ==========================================
    console.log('📄 Creating invoices...');

    // Clear existing
    await run(`DELETE FROM invoices WHERE organization_id = ?`, [orgId]);

    // Generate invoices for past 6 months (using existing table structure)
    const invoices = [];
    const now = new Date();

    for (let i = 0; i < 6; i++) {
      const invoiceDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const isPaid = i > 0; // Current month is pending, rest are paid
      const total = i % 2 === 0 ? 358.8 : 299;

      invoices.push({
        id: uuidv4(),
        stripeId: `in_test_${Date.now()}_${i}`,
        status: isPaid ? 'paid' : 'open',
        amountDue: isPaid ? 0 : total,
        amountPaid: isPaid ? total : 0,
        periodStart: invoiceDate.toISOString(),
        periodEnd: new Date(invoiceDate.getFullYear(), invoiceDate.getMonth() + 1, 0).toISOString(),
        createdAt: invoiceDate.toISOString(),
      });
    }

    for (const inv of invoices) {
      await run(
        `
                INSERT INTO invoices (id, organization_id, stripe_invoice_id, status, amount_due, amount_paid, period_start, period_end, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
        [
          inv.id,
          orgId,
          inv.stripeId,
          inv.status,
          inv.amountDue,
          inv.amountPaid,
          inv.periodStart,
          inv.periodEnd,
          inv.createdAt,
        ]
      );
    }
    console.log(`  ✓ Created ${invoices.length} invoices`);

    // ==========================================
    // 3. SPENDING ALERTS
    // ==========================================
    console.log('🔔 Creating spending alerts...');

    // Ensure table exists
    await run(`CREATE TABLE IF NOT EXISTS spending_alerts (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            type TEXT NOT NULL CHECK(type IN ('AI_TOKENS', 'STORAGE', 'USERS', 'TOTAL_SPEND')),
            threshold REAL NOT NULL,
            threshold_type TEXT NOT NULL CHECK(threshold_type IN ('PERCENTAGE', 'ABSOLUTE')),
            action TEXT NOT NULL CHECK(action IN ('NOTIFY', 'NOTIFY_AND_PAUSE', 'HARD_LIMIT')),
            notify_emails TEXT NOT NULL DEFAULT '[]',
            is_active INTEGER DEFAULT 1,
            last_triggered_at DATETIME DEFAULT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
        )`);

    // Clear existing
    await run(`DELETE FROM spending_alerts WHERE organization_id = ?`, [orgId]);

    // Create spending alerts
    const spendingAlerts = [
      {
        id: uuidv4(),
        type: 'AI_TOKENS',
        threshold: 80,
        thresholdType: 'PERCENTAGE',
        action: 'NOTIFY',
        notifyEmails: [adminEmail, 'finance@dbr77.com'],
        isActive: 1,
      },
      {
        id: uuidv4(),
        type: 'AI_TOKENS',
        threshold: 95,
        thresholdType: 'PERCENTAGE',
        action: 'NOTIFY_AND_PAUSE',
        notifyEmails: [adminEmail],
        isActive: 1,
      },
      {
        id: uuidv4(),
        type: 'STORAGE',
        threshold: 80,
        thresholdType: 'PERCENTAGE',
        action: 'NOTIFY',
        notifyEmails: [adminEmail],
        isActive: 1,
      },
      {
        id: uuidv4(),
        type: 'TOTAL_SPEND',
        threshold: 500,
        thresholdType: 'ABSOLUTE',
        action: 'NOTIFY',
        notifyEmails: [adminEmail, 'cfo@dbr77.com'],
        isActive: 1,
      },
    ];

    for (const alert of spendingAlerts) {
      await run(
        `
                INSERT INTO spending_alerts (id, organization_id, type, threshold, threshold_type, action, notify_emails, is_active)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `,
        [
          alert.id,
          orgId,
          alert.type,
          alert.threshold,
          alert.thresholdType,
          alert.action,
          JSON.stringify(alert.notifyEmails),
          alert.isActive,
        ]
      );
    }
    console.log(`  ✓ Created ${spendingAlerts.length} spending alerts`);

    // ==========================================
    // 4. BILLING ALERTS CONFIGURATION
    // ==========================================
    console.log('⚙️ Creating billing alerts configuration...');

    // Ensure table exists
    await run(`CREATE TABLE IF NOT EXISTS billing_alerts (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL UNIQUE,
            token_threshold_80 INTEGER DEFAULT 1,
            token_threshold_90 INTEGER DEFAULT 1,
            token_threshold_100 INTEGER DEFAULT 1,
            storage_threshold_80 INTEGER DEFAULT 1,
            storage_threshold_90 INTEGER DEFAULT 1,
            storage_threshold_100 INTEGER DEFAULT 1,
            auto_upgrade_enabled INTEGER DEFAULT 0,
            auto_upgrade_plan_id TEXT,
            cost_cap_monthly REAL DEFAULT NULL,
            email_notifications INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
        )`);

    // Upsert billing alert config
    await run(
      `
            INSERT INTO billing_alerts (id, organization_id, token_threshold_80, token_threshold_90, token_threshold_100, storage_threshold_80, storage_threshold_90, storage_threshold_100, cost_cap_monthly, email_notifications)
            VALUES (?, ?, 1, 1, 1, 1, 1, 1, 1000, 1)
            ON CONFLICT(organization_id) DO UPDATE SET
                cost_cap_monthly = 1000,
                email_notifications = 1,
                updated_at = datetime('now')
        `,
      [uuidv4(), orgId]
    );
    console.log('  ✓ Created billing alerts configuration');

    console.log('\n✅ Billing data seeded successfully!');
    console.log(`
Summary:
- Payment Methods: ${paymentMethods.length}
- Invoices: ${invoices.length}
- Spending Alerts: ${spendingAlerts.length}
- Billing Config: 1
        `);
  } catch (error) {
    console.error('❌ Error seeding billing data:', error);
    process.exit(1);
  }
}

// Run if called directly
seedBillingData()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
