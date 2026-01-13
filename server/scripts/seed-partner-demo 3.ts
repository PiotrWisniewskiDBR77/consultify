/**
 * SEED: Partner Demo Data
 *
 * Standalone script to seed partner-related demo data for testing.
 * Run with: npx ts-node server/scripts/seed-partner-demo.ts
 *
 * Or add to package.json:
 *   "seed:partner": "ts-node server/scripts/seed-partner-demo.ts"
 */

import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../src/database/Database.js';

interface SeedConfig {
    organizationId?: string;
    partnerOrgName?: string;
    referralCode?: string;
    tier?: 'REGISTERED' | 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
}

const DEFAULT_CONFIG: SeedConfig = {
    organizationId: 'partner-org-demo',
    partnerOrgName: 'Demo Partner Organization',
    referralCode: 'DEMO2026',
    tier: 'GOLD',
};

async function seedPartnerDemo(config: SeedConfig = DEFAULT_CONFIG): Promise<void> {
    const db = getDatabase();

    const run = (sql: string, params: unknown[] = []): Promise<void> =>
        new Promise((resolve, reject) => {
            db.run(sql, params, (err: Error | null) => {
                if (err) reject(err);
                else resolve();
            });
        });

    console.log('\n🤝 Partner Demo Seed Script');
    console.log('================================\n');

    const PARTNER_ORG_ID = config.organizationId || uuidv4();

    try {
        // 1. Partner Organization
        console.log('📁 Creating partner organization...');
        await run(
            `
            INSERT OR REPLACE INTO partner_organizations (
                id, name, legal_name, tax_id, contact_email, contact_phone, website,
                program_type, tier, status, partner_since, referral_code, referral_link,
                license_discount_percent, commission_rate_percent, performance_score,
                public_listing_enabled, specializations, regions, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `,
            [
                PARTNER_ORG_ID,
                config.partnerOrgName || 'Demo Partner',
                config.partnerOrgName || 'Demo Partner Ltd.',
                'DEMO123456',
                'demo@partner.example.com',
                '+1 555 123 4567',
                'https://partner.example.com',
                'SOLUTION_PARTNER',
                config.tier || 'GOLD',
                'active',
                '2024-01-01',
                config.referralCode || 'DEMO2026',
                `https://app.consultinity.com/r/${config.referralCode || 'DEMO2026'}`,
                20,
                25,
                85,
                1,
                JSON.stringify(['DRD', 'SIRI', 'Lean 4.0']),
                JSON.stringify(['CEE', 'DACH']),
            ],
        );
        console.log('   ✅ Partner organization created');

        // 2. Payout Account
        console.log('💳 Creating payout account...');
        await run(
            `
            INSERT OR REPLACE INTO partner_payout_accounts (
                id, partner_org_id, method, account_name, iban, bic, is_verified, is_default, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `,
            [
                uuidv4(),
                PARTNER_ORG_ID,
                'BANK_TRANSFER',
                config.partnerOrgName || 'Demo Partner',
                'DE89370400440532013000',
                'COBADEFFXXX',
                1,
                1,
            ],
        );
        console.log('   ✅ Payout account created');

        // 3. Campaign Links
        console.log('🔗 Creating campaign links...');
        const campaigns = [
            { name: 'LinkedIn Q1', source: 'linkedin', medium: 'social', campaign: 'q1-2026' },
            { name: 'Email Newsletter', source: 'email', medium: 'newsletter', campaign: 'jan-2026' },
            { name: 'Website Banner', source: 'website', medium: 'banner', campaign: 'homepage' },
        ];

        for (const c of campaigns) {
            await run(
                `
                INSERT OR REPLACE INTO partner_campaign_links (
                    id, partner_org_id, name, url, utm_source, utm_medium, utm_campaign, click_count, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            `,
                [
                    uuidv4(),
                    PARTNER_ORG_ID,
                    c.name,
                    `https://app.consultinity.com/?ref=${config.referralCode}&utm_source=${c.source}&utm_medium=${c.medium}&utm_campaign=${c.campaign}`,
                    c.source,
                    c.medium,
                    c.campaign,
                    Math.floor(Math.random() * 150) + 25,
                ],
            );
        }
        console.log(`   ✅ ${campaigns.length} campaign links created`);

        // 4. Attributions
        console.log('🎯 Creating attributions...');
        const attributions = [
            { name: 'Acme Corp', status: 'converted', revenue: 36000, commission: 9000 },
            { name: 'TechStart Inc', status: 'converted', revenue: 24000, commission: 6000 },
            { name: 'Global Industries', status: 'trial', revenue: 0, commission: 0 },
        ];

        for (const attr of attributions) {
            await run(
                `
                INSERT OR REPLACE INTO partner_attributions (
                    id, partner_org_id, client_org_id, client_name, attribution_type, status,
                    ltv_total, commission_earned, created_at, converted_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-' || ? || ' days'), ?, datetime('now'))
            `,
                [
                    uuidv4(),
                    PARTNER_ORG_ID,
                    uuidv4(),
                    attr.name,
                    'REFERRAL_LINK',
                    attr.status,
                    attr.revenue,
                    attr.commission,
                    Math.floor(Math.random() * 60) + 15,
                    attr.status === 'converted' ? new Date().toISOString() : null,
                ],
            );
        }
        console.log(`   ✅ ${attributions.length} attributions created`);

        // 5. Commissions
        console.log('💰 Creating commission transactions...');
        const commissions = [
            { amount: 9000, type: 'initial', status: 'approved' },
            { amount: 6000, type: 'initial', status: 'approved' },
            { amount: 3000, type: 'renewal', status: 'pending' },
        ];

        for (const comm of commissions) {
            await run(
                `
                INSERT OR REPLACE INTO partner_commission_transactions (
                    id, partner_org_id, attribution_id, amount, currency, commission_type, status, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', '-' || ? || ' days'), datetime('now'))
            `,
                [
                    uuidv4(),
                    PARTNER_ORG_ID,
                    null,
                    comm.amount,
                    'EUR',
                    comm.type,
                    comm.status,
                    Math.floor(Math.random() * 45) + 5,
                ],
            );
        }
        console.log(`   ✅ ${commissions.length} commissions created`);

        // 6. Certifications
        console.log('🎓 Creating certifications...');
        const certifications = [
            { name: 'Consultinity Foundations', status: 'completed', progress: 100 },
            { name: 'PMO Standards', status: 'completed', progress: 100 },
            { name: 'AI Intelligence Modules', status: 'in_progress', progress: 45 },
            { name: 'Assessment Specialist', status: 'not_started', progress: 0 },
        ];

        for (const cert of certifications) {
            await run(
                `
                INSERT OR REPLACE INTO partner_certifications (
                    id, partner_org_id, name, type, status, progress, duration, modules,
                    certificate_id, completed_at, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            `,
                [
                    uuidv4(),
                    PARTNER_ORG_ID,
                    cert.name,
                    'core',
                    cert.status,
                    cert.progress,
                    `${Math.floor(Math.random() * 4) + 2} hours`,
                    Math.floor(Math.random() * 8) + 4,
                    cert.status === 'completed' ? `CERT-${Date.now()}` : null,
                    cert.status === 'completed' ? new Date().toISOString() : null,
                ],
            );
        }
        console.log(`   ✅ ${certifications.length} certifications created`);

        // 7. Client Organizations
        console.log('🏢 Creating client organizations...');
        const clients = [
            { name: 'Demo Client A', industry: 'Technology', users: 25, projects: 2 },
            { name: 'Demo Client B', industry: 'Manufacturing', users: 50, projects: 3 },
        ];

        for (const client of clients) {
            await run(
                `
                INSERT OR REPLACE INTO partner_client_organizations (
                    id, partner_org_id, organization_id, client_name, industry, user_count, project_count,
                    assessment_score, status, onboarded_at, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-' || ? || ' days'), datetime('now'), datetime('now'))
            `,
                [
                    uuidv4(),
                    PARTNER_ORG_ID,
                    uuidv4(),
                    client.name,
                    client.industry,
                    client.users,
                    client.projects,
                    Math.random() * 2 + 3,
                    'active',
                    Math.floor(Math.random() * 120) + 30,
                ],
            );
        }
        console.log(`   ✅ ${clients.length} client organizations created`);

        console.log('\n✨ Partner demo seed completed successfully!\n');
        console.log(`📋 Partner Organization ID: ${PARTNER_ORG_ID}`);
        console.log(`🔑 Referral Code: ${config.referralCode || 'DEMO2026'}`);
        console.log('\n');
    } catch (error) {
        console.error('❌ Error during partner seed:', error);
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    seedPartnerDemo()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}

export { seedPartnerDemo, SeedConfig };
