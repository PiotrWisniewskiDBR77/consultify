/**
 * Pricing Seed Script (from legal-metadata.json)
 * 
 * Seeds subscription plans from the /Legal/config/legal-metadata.json file.
 * Ensures database subscription_plans table stays in sync with official pricing.
 * 
 * Run: node server/seeds/pricingFromMetadata.js
 */

const fs = require('fs');
const path = require('path');
import { getDatabase } from '../database/Database.js';
const db = getDatabase();

// Path to legal metadata
const METADATA_PATH = path.resolve(__dirname, '../../Legal/config/legal-metadata.json');

/**
 * Load pricing from legal-metadata.json
 */
function loadPricingMetadata() {
    try {
        const content = fs.readFileSync(METADATA_PATH, 'utf8');
        const metadata = JSON.parse(content);
        return {
            currency: metadata.pricing?.currency || 'EUR',
            plans: metadata.pricing?.plans || [],
            trial: metadata.pricing?.trial || {}
        };
    } catch (error) {
        console.error('[Pricing Seed] Error loading legal-metadata.json:', error.message);
        throw error;
    }
}

/**
 * Add column if it doesn't exist
 */
function addColumnIfNotExists(column, type, defaultValue) {
    return new Promise((resolve) => {
        const defaultClause = defaultValue !== undefined ? ` DEFAULT ${defaultValue}` : '';
        db.run(`ALTER TABLE subscription_plans ADD COLUMN ${column} ${type}${defaultClause}`, (err) => {
            // Ignore error if column already exists
            resolve();
        });
    });
}

/**
 * Ensure subscription_plans table and columns exist
 */
async function ensureTable() {
    // First ensure the table exists (base schema)
    await new Promise((resolve, reject) => {
        db.run(`
            CREATE TABLE IF NOT EXISTS subscription_plans (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                price_monthly REAL NOT NULL DEFAULT 0,
                token_limit INTEGER DEFAULT 5000,
                storage_limit_gb REAL DEFAULT 10,
                token_overage_rate REAL DEFAULT 0.05,
                storage_overage_rate REAL DEFAULT 0.10,
                stripe_price_id TEXT,
                is_active INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });

    // Add missing columns if they don't exist
    await addColumnIfNotExists('price_annual', 'REAL', 'NULL');
    await addColumnIfNotExists('features', 'TEXT', 'NULL');
    await addColumnIfNotExists('updated_at', 'DATETIME', "CURRENT_TIMESTAMP");
    
    // Ensure system_settings table exists for trial config
    await new Promise((resolve) => {
        db.run(`
            CREATE TABLE IF NOT EXISTS system_settings (
                key TEXT PRIMARY KEY,
                value TEXT,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `, () => resolve());
    });
}

/**
 * Upsert a subscription plan
 */
function upsertPlan(plan) {
    return new Promise((resolve, reject) => {
        const features = JSON.stringify({
            seatsIncluded: plan.seatsIncluded,
            aiCreditsMonthly: plan.aiCreditsMonthly,
            extraSeatPrice: plan.extraSeatPrice,
            overagePrice: plan.overagePrice,
            byokEnabled: plan.byokEnabled,
            byokPrice: plan.byokPrice || null,
            workspaces: plan.workspaces,
            supportSla: plan.supportSla
        });

        // Check if plan exists
        db.get('SELECT id FROM subscription_plans WHERE id = ?', [plan.id], (err, row) => {
            if (err) {
                reject(err);
                return;
            }

            if (row) {
                // Update existing plan (without relying on updated_at column)
                db.run(
                    `UPDATE subscription_plans SET 
                        name = ?,
                        price_monthly = ?,
                        token_limit = ?,
                        token_overage_rate = ?,
                        is_active = 1
                    WHERE id = ?`,
                    [
                        plan.name,
                        plan.monthlyPrice,
                        plan.aiCreditsMonthly,
                        plan.overagePrice,
                        plan.id
                    ],
                    function(updateErr) {
                        if (updateErr) reject(updateErr);
                        else resolve({ action: 'updated', id: plan.id });
                    }
                );
            } else {
                // Insert new plan
                db.run(
                    `INSERT INTO subscription_plans 
                    (id, name, price_monthly, token_limit, storage_limit_gb, token_overage_rate, storage_overage_rate, is_active)
                    VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
                    [
                        plan.id,
                        plan.name,
                        plan.monthlyPrice,
                        plan.aiCreditsMonthly,
                        10, // default storage
                        plan.overagePrice,
                        0.10 // default storage overage
                    ],
                    (insertErr) => {
                        if (insertErr) reject(insertErr);
                        else resolve({ action: 'inserted', id: plan.id });
                    }
                );
            }
        });
    });
}

/**
 * Seed all pricing plans
 */
async function seedPricingPlans() {
    console.log('[Pricing Seed] Starting pricing sync from legal-metadata.json...');
    console.log(`[Pricing Seed] Metadata path: ${METADATA_PATH}`);

    // Ensure table exists
    await ensureTable();

    // Load pricing data
    const pricing = loadPricingMetadata();
    console.log(`[Pricing Seed] Currency: ${pricing.currency}`);
    console.log(`[Pricing Seed] Found ${pricing.plans.length} plans to sync`);

    const results = [];

    for (const plan of pricing.plans) {
        try {
            const result = await upsertPlan(plan);
            results.push(result);
            console.log(`[Pricing Seed] ${result.action} plan: ${plan.name} (${plan.id})`);
        } catch (error) {
            console.error(`[Pricing Seed] Error syncing ${plan.id}:`, error.message);
            results.push({ action: 'error', id: plan.id, error: error.message });
        }
    }

    return results;
}

/**
 * Verify all plans were synced
 */
async function verifyPlans() {
    return new Promise((resolve) => {
        db.all(
            `SELECT id, name, price_monthly, token_limit 
             FROM subscription_plans 
             WHERE is_active = 1 
             ORDER BY price_monthly ASC`,
            [],
            (err, rows) => {
                if (err) {
                    console.error('[Pricing Seed] Error verifying plans:', err.message);
                } else {
                    console.log('\n[Pricing Seed] Active subscription plans:');
                    rows.forEach(row => {
                        console.log(`  - ${row.id}: ${row.name}`);
                        console.log(`    Monthly: €${row.price_monthly} | AI Credits: ${row.token_limit}/month`);
                    });
                }
                resolve(rows);
            }
        );
    });
}

/**
 * Store trial configuration in settings
 */
async function seedTrialConfig() {
    const pricing = loadPricingMetadata();
    const trial = pricing.trial;

    if (!trial) {
        console.log('[Pricing Seed] No trial config found, skipping');
        return;
    }

    return new Promise((resolve) => {
        db.run(
            `INSERT OR REPLACE INTO system_settings (key, value, updated_at)
             VALUES ('trial_config', ?, datetime('now'))`,
            [JSON.stringify(trial)],
            (err) => {
                if (err) {
                    console.error('[Pricing Seed] Error saving trial config:', err.message);
                } else {
                    console.log('[Pricing Seed] Trial config saved:');
                    console.log(`  Duration: ${trial.durationDays} days`);
                    console.log(`  Plan Level: ${trial.planLevel}`);
                    console.log(`  AI Credits: ${trial.aiCredits}`);
                    console.log(`  Seats: ${trial.seats}`);
                    console.log(`  Credit Card Required: ${trial.creditCardRequired ? 'Yes' : 'No'}`);
                }
                resolve();
            }
        );
    });
}

// Run if executed directly
if (require.main === module) {
    // Wait for DB init
    setTimeout(async () => {
        try {
            await seedPricingPlans();
            await seedTrialConfig();
            await verifyPlans();
            console.log('\n[Pricing Seed] Done');
            process.exit(0);
        } catch (error) {
            console.error('[Pricing Seed] Fatal error:', error);
            process.exit(1);
        }
    }, 1000);
}

export default { seedPricingPlans, loadPricingMetadata, verifyPlans, seedTrialConfig };

