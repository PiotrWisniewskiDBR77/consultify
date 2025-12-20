/**
 * Legolex Test Organization Seed Script
 * 
 * Creates a comprehensive test organization that:
 * - Passes Demo → Trial → Paid lifecycle
 * - Has users, roles, invitations
 * - Has attribution, promo codes, partner
 * - Generates settlements
 * - Uses help/playbooks
 * 
 * This is a "living organism" test org, not just 3 seed records.
 * 
 * Usage:
 *   node server/scripts/seedLegolexDemoOrg.js [--clean] [--verify]
 * 
 * Options:
 *   --clean   Remove existing Legolex data before seeding
 *   --verify  Only verify existing data, don't seed
 * 
 * @module seedLegolexDemoOrg
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

// ==========================================
// PRODUCTION GUARD (Enterprise Hygiene)
// ==========================================

if (process.env.NODE_ENV === 'production') {
    console.error('❌ Error: Legolex seed script cannot run in production environment.');
    process.exit(1);
}

// ==========================================
// CONFIGURATION
// ==========================================

const dbPath = path.resolve(__dirname, '../consultify.db');
const DEFAULT_PASSWORD = '123456';
const HASHED_PASSWORD = bcrypt.hashSync(DEFAULT_PASSWORD, 8);

// Fixed IDs for findability and idempotency (Legolex v2 - Deterministic)
const IDS = {
    // Organization
    ORG: 'legolex-org-001',

    // Users
    USER_SUPERADMIN: 'superadmin-001',
    USER_ANNA: 'legolex-admin-001',
    USER_PIOTR: 'legolex-user-001',
    USER_MARTA: 'legolex-user-002',
    USER_KAMIL: 'legolex-user-003',
    USER_JULIA: 'legolex-user-004',   // Risk persona
    USER_TOMASZ: 'legolex-user-005',  // Partner-linked user

    // Mapping for logic
    USER_ADMIN: 'legolex-admin-001',

    // Partner
    PARTNER: 'partner-lex-001',
    PARTNER_AGREEMENT: 'agreement-lex-001',

    // Promo Codes
    PROMO_DEMO: 'promo-legodemo-001',
    PROMO_PARTNER: 'promo-legopartner-001',

    // Settlement
    SETTLEMENT_PERIOD: 'settlement-period-2025-01',

    // Projects (3)
    PROJ_CORE: 'legolex-project-001',
    PROJ_PORTAL: 'legolex-project-002',
    PROJ_AI: 'legolex-project-003',

    // Initiatives (10)
    INIT_001: 'init-lex-001',
    INIT_002: 'init-lex-002',
    INIT_003: 'init-lex-003',
    INIT_004: 'init-lex-004',
    INIT_005: 'init-lex-005',
    INIT_006: 'init-lex-006',
    INIT_007: 'init-lex-007',
    INIT_008: 'init-lex-008',
    INIT_009: 'init-lex-009', // Partner Integration (Blocked)
    INIT_010: 'init-lex-010',

    // Invitations
    INVITE_PIOTR: 'invite-lex-001',
    INVITE_MARTA: 'invite-lex-002',
    INVITE_REVOKED: 'invite-lex-003'
};

// Timestamps for lifecycle simulation
const NOW = new Date();
const T0 = new Date(NOW);
T0.setDate(T0.getDate() - 30); // 30 days ago (demo start)

const T1 = new Date(T0);
T1.setDate(T1.getDate() + 1); // 1 day after demo (trial start)

const T2 = new Date(T1);
T2.setDate(T2.getDate() + 10); // 10 days into trial (extension)

const T3 = new Date(T2);
T3.setDate(T3.getDate() + 5); // 5 days after extension (upgrade)

const TRIAL_EXPIRES = new Date(T1);
TRIAL_EXPIRES.setDate(TRIAL_EXPIRES.getDate() + 21); // 14 + 7 days

// ==========================================
// DATABASE CONNECTION
// ==========================================

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Error opening database:', err.message);
        process.exit(1);
    }
    console.log('📂 Connected to database:', dbPath);
});

// Promisified db.run
const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
    });
});

// Promisified db.get
const dbGet = (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
    });
});

// Promisified db.all
const dbAll = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
    });
});

// ==========================================
// CLEANUP FUNCTION
// ==========================================

async function cleanupLegolex() {
    console.log('\n🧹 Cleaning up existing Legolex data...');

    // Identifiers for multi-entity deletion
    const projectIds = `'${IDS.PROJ_CORE}', '${IDS.PROJ_PORTAL}', '${IDS.PROJ_AI}'`;

    // Order matters due to foreign keys
    const cleanupQueries = [
        // Metrics & Events
        `DELETE FROM metrics_events WHERE organization_id = '${IDS.ORG}'`,
        `DELETE FROM metrics_snapshots WHERE dimensions LIKE '%${IDS.ORG}%'`,
        `DELETE FROM metrics_events WHERE id LIKE 'metrics-lex-%'`,

        // Help events
        `DELETE FROM help_events WHERE organization_id = '${IDS.ORG}'`,
        `DELETE FROM help_events WHERE id LIKE 'help-lex-%'`,

        // Settlements
        `DELETE FROM partner_settlements WHERE settlement_period_id = '${IDS.SETTLEMENT_PERIOD}'`,
        `DELETE FROM settlement_periods WHERE id = '${IDS.SETTLEMENT_PERIOD}'`,

        // Attribution
        `DELETE FROM attribution_events WHERE organization_id = '${IDS.ORG}'`,
        `DELETE FROM attribution_events WHERE id LIKE 'attr-lex-%'`,

        // Promo usage
        `DELETE FROM promo_code_usage WHERE organization_id = '${IDS.ORG}'`,

        // Promo codes
        `DELETE FROM promo_codes WHERE id IN ('${IDS.PROMO_DEMO}', '${IDS.PROMO_PARTNER}')`,
        `DELETE FROM promo_codes WHERE code IN ('LEGODEMO14', 'LEGOPARTNER')`,

        // Partner agreements & partner
        `DELETE FROM partner_agreements WHERE partner_id = '${IDS.PARTNER}'`,
        `DELETE FROM partners WHERE id = '${IDS.PARTNER}'`,

        // Invitations
        `DELETE FROM invitation_events WHERE invitation_id IN ('${IDS.INVITE_PIOTR}', '${IDS.INVITE_MARTA}', '${IDS.INVITE_REVOKED}')`,
        `DELETE FROM invitations WHERE organization_id = '${IDS.ORG}'`,

        // Organization events
        `DELETE FROM organization_events WHERE organization_id = '${IDS.ORG}'`,
        `DELETE FROM organization_events WHERE id LIKE 'org-event-%'`,

        // Organization limits
        `DELETE FROM organization_limits WHERE organization_id = '${IDS.ORG}'`,

        // Project-related (tasks, initiatives, sessions)
        `DELETE FROM tasks WHERE id LIKE 'task-lex-%'`,
        `DELETE FROM tasks WHERE project_id IN (${projectIds})`,
        `DELETE FROM initiatives WHERE id LIKE 'init-lex-%'`,
        `DELETE FROM initiatives WHERE project_id IN (${projectIds})`,
        `DELETE FROM sessions WHERE project_id IN (${projectIds})`,
        `DELETE FROM projects WHERE id IN (${projectIds})`,

        // Users
        `DELETE FROM users WHERE organization_id = '${IDS.ORG}'`,
        `DELETE FROM users WHERE id IN ('${IDS.USER_SUPERADMIN}', '${IDS.USER_ANNA}', '${IDS.USER_PIOTR}', '${IDS.USER_MARTA}', '${IDS.USER_KAMIL}', '${IDS.USER_JULIA}', '${IDS.USER_TOMASZ}')`,
        `DELETE FROM users WHERE email IN ('anna@legolex.com', 'piotr@legolex.com', 'marta@legolex.com', 'kamil@legolex.com', 'julia@legolex.com', 'tomasz@legolex.com', 'super@legolex.com')`,

        // Organization
        `DELETE FROM organizations WHERE id = '${IDS.ORG}'`
    ];

    for (const query of cleanupQueries) {
        try {
            await dbRun(query);
        } catch (err) {
            // Ignore errors (table might not exist)
        }
    }

    console.log('   ✓ Cleanup complete');
}

// ==========================================
// SCHEMA ENSURANCE
// ==========================================

async function ensureSchema() {
    console.log('\n🛠 Ensuring database schema is ready...');

    // Partner Settlements adjustment columns
    const partnerSettlementsCols = await dbAll(`PRAGMA table_info(partner_settlements)`);
    const hasEntryType = partnerSettlementsCols.some(c => c.name === 'entry_type');

    if (!hasEntryType) {
        console.log('   Adding missing columns to partner_settlements...');
        try {
            await dbRun(`ALTER TABLE partner_settlements ADD COLUMN entry_type TEXT DEFAULT 'NORMAL'`);
            await dbRun(`ALTER TABLE partner_settlements ADD COLUMN adjusts_settlement_id TEXT`);
            await dbRun(`ALTER TABLE partner_settlements ADD COLUMN adjustment_reason TEXT`);
        } catch (err) {
            console.log('   ⚠️ Could not add partner_settlements columns (might already exist)');
        }
    }

    // attribution_events table column additions
    const attributionCols = await dbAll(`PRAGMA table_info(attribution_events)`);
    const hasPartnerId = attributionCols.some(c => c.name === 'partner_id');
    if (!hasPartnerId) {
        try {
            await dbRun(`ALTER TABLE attribution_events ADD COLUMN partner_id TEXT`);
        } catch (err) {
            console.log('   ⚠️ Could not add partner_id to attribution_events');
        }
    }

    // help_playbooks table
    await dbRun(`CREATE TABLE IF NOT EXISTS help_playbooks (
        id TEXT PRIMARY KEY,
        key TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        target_role TEXT DEFAULT 'ANY',
        target_org_type TEXT DEFAULT 'ANY',
        priority INTEGER DEFAULT 3,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // help_steps table
    await dbRun(`CREATE TABLE IF NOT EXISTS help_steps (
        id TEXT PRIMARY KEY,
        playbook_id TEXT NOT NULL,
        step_order INTEGER NOT NULL,
        title TEXT NOT NULL,
        content_md TEXT NOT NULL,
        ui_target TEXT,
        action_type TEXT DEFAULT 'INFO',
        action_payload TEXT DEFAULT '{}',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(playbook_id) REFERENCES help_playbooks(id) ON DELETE CASCADE
    )`);

    // help_events table (Enterprise+ append-only log)
    await dbRun(`CREATE TABLE IF NOT EXISTS help_events (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        organization_id TEXT NOT NULL,
        playbook_key TEXT NOT NULL,
        event_type TEXT NOT NULL,              -- VIEWED | STARTED | COMPLETED | DISMISSED
        context TEXT DEFAULT '{}',             -- JSON context
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
    )`);

    // metrics_events table (Enterprise+ Single Source of Truth)
    await dbRun(`CREATE TABLE IF NOT EXISTS metrics_events (
        id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        user_id TEXT,
        organization_id TEXT,
        source TEXT,
        context TEXT DEFAULT '{}',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
    )`);

    console.log('   ✓ Schema check complete');
}

// ==========================================
// PHASE 1: ORGANIZATION
// ==========================================

async function seedOrganization() {
    console.log('\n🏢 Phase 1: Creating Organization...');

    await dbRun(`
        INSERT INTO organizations (
            id, name, plan, status, industry,
            organization_type, trial_started_at, trial_expires_at,
            is_active, created_by_user_id, trial_extension_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        IDS.ORG,
        'Legolex',
        'enterprise', // License: ENTERPRISE
        'active',
        'Legal Technology',
        'PAID',
        T1.toISOString(),
        TRIAL_EXPIRES.toISOString(),
        1,
        IDS.USER_ADMIN,
        1
    ]);

    console.log('   ✓ Organization: Legolex (PAID/ENTERPRISE)');
}

// ==========================================
// PHASE 2: USERS
// ==========================================

async function seedUsers() {
    console.log('\n👥 Phase 2: Creating Users...');

    const users = [
        {
            id: IDS.USER_SUPERADMIN,
            email: 'super@legolex.com',
            firstName: 'Super',
            lastName: 'Admin',
            role: 'SUPERADMIN'
        },
        {
            id: IDS.USER_ANNA,
            email: 'anna@legolex.com',
            firstName: 'Anna',
            lastName: 'Kowalska',
            role: 'ADMIN'
        },
        {
            id: IDS.USER_PIOTR,
            email: 'piotr@legolex.com',
            firstName: 'Piotr',
            lastName: 'Nowak',
            role: 'USER'
        },
        {
            id: IDS.USER_MARTA,
            email: 'marta@legolex.com',
            firstName: 'Marta',
            lastName: 'Zielińska',
            role: 'USER'
        },
        {
            id: IDS.USER_KAMIL,
            email: 'kamil@legolex.com',
            firstName: 'Kamil',
            lastName: 'Lewandowski',
            role: 'USER'
        },
        {
            id: IDS.USER_JULIA,
            email: 'julia@legolex.com',
            firstName: 'Julia',
            lastName: 'Wiśniewska',
            role: 'USER' // Risk persona
        },
        {
            id: IDS.USER_TOMASZ,
            email: 'tomasz@legolex.com',
            firstName: 'Tomasz',
            lastName: 'Partner',
            role: 'USER' // Partner-linked
        }
    ];

    for (const user of users) {
        await dbRun(`
            INSERT INTO users (
                id, organization_id, email, password,
                first_name, last_name, role, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            user.id,
            IDS.ORG,
            user.email,
            HASHED_PASSWORD,
            user.firstName,
            user.lastName,
            user.role,
            'active'
        ]);
        console.log(`   ✓ User: ${user.firstName} ${user.lastName} (${user.role})`);
    }
}

// ==========================================
// PHASE 3: ORGANIZATION LIMITS
// ==========================================

async function seedOrganizationLimits() {
    console.log('\n📊 Phase 3: Creating Organization Limits...');

    // PAID org - generous limits
    await dbRun(`
        INSERT INTO organization_limits (
            id, organization_id,
            max_projects, max_users, max_ai_calls_per_day,
            max_initiatives, max_storage_mb,
            ai_roles_enabled_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        uuidv4(),
        IDS.ORG,
        50,   // max_projects
        100,  // max_users
        1000, // max_ai_calls_per_day
        200,  // max_initiatives
        10000, // max_storage_mb (10GB)
        '["ADVISOR", "MANAGER", "OPERATOR"]'
    ]);

    console.log('   ✓ Organization limits set (PAID tier)');
}

// ==========================================
// PHASE 4: ORGANIZATION LIFECYCLE EVENTS
// ==========================================

async function seedOrganizationEvents() {
    console.log('\n📅 Phase 4: Creating Lifecycle Events...');

    const events = [
        { id: 'org-event-001', type: 'DEMO_CREATED', date: T0 },
        { id: 'org-event-002', type: 'TRIAL_STARTED', date: T1 },
        { id: 'org-event-003', type: 'TRIAL_EXTENDED', date: T2 },
        { id: 'org-event-004', type: 'UPGRADED_TO_PAID', date: T3 }
    ];

    for (const event of events) {
        await dbRun(`
            INSERT INTO organization_events (
                id, organization_id, event_type, created_at
            ) VALUES (?, ?, ?, ?)
        `, [event.id, IDS.ORG, event.type, event.date.toISOString()]);
        console.log(`   ✓ Event: ${event.type}`);
    }
}

// ==========================================
// PHASE 5: PARTNER + PROMO CODES
// ==========================================

async function seedPartnerAndPromoCodes() {
    console.log('\n🤝 Phase 5: Creating Partner & Promo Codes...');

    // Create Partner
    await dbRun(`
        INSERT INTO partners (
            id, name, partner_type, email, contact_name,
            default_revenue_share_percent, is_active, metadata, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        IDS.PARTNER,
        'LexPartners',
        'REFERRAL',
        'tomasz@legolex.com',
        'Tomasz Partner',
        15,
        1,
        JSON.stringify({ industry: 'Legal', region: 'EU' }),
        T0.toISOString()
    ]);
    console.log('   ✓ Partner: LexPartners (REFERRAL, 15%)');

    // Create Partner Agreement
    await dbRun(`
        INSERT INTO partner_agreements (
            id, partner_id, valid_from, valid_until,
            revenue_share_percent, applies_to, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
        IDS.PARTNER_AGREEMENT,
        IDS.PARTNER,
        '2024-01-01',
        null, // Indefinite
        15,
        'GLOBAL',
        T0.toISOString()
    ]);
    console.log('   ✓ Partner Agreement: 15% revenue share (indefinite)');

    // Promo Code: LEGODEMO14
    await dbRun(`
        INSERT INTO promo_codes (
            id, code, type, discount_type, discount_value,
            valid_from, valid_until, max_uses, used_count,
            created_by_user_id, is_active, metadata, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        IDS.PROMO_DEMO,
        'LEGODEMO14',
        'DISCOUNT',
        'PERCENT',
        10,
        '2024-01-01',
        null,
        1000,
        1,
        IDS.USER_SUPERADMIN,
        1,
        JSON.stringify({ campaign: 'demo_internal' }),
        T0.toISOString()
    ]);

    // Promo Code: LEGOPARTNER
    await dbRun(`
        INSERT INTO promo_codes (
            id, code, type, discount_type, discount_value,
            valid_from, valid_until, max_uses, used_count,
            created_by_user_id, is_active, metadata, partner_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        IDS.PROMO_PARTNER,
        'LEGOPARTNER',
        'PARTNER',
        'PERCENT',
        15,
        '2024-01-01',
        null,
        null,
        1,
        IDS.USER_SUPERADMIN,
        1,
        JSON.stringify({ partner: 'LexPartners' }),
        IDS.PARTNER,
        T0.toISOString()
    ]);
    console.log('   ✓ Promo Code: LEGODEMO14, LEGOPARTNER');
}

// ==========================================
// PHASE 6: ATTRIBUTION EVENTS
// ==========================================

async function seedAttributionEvents() {
    console.log('\n📈 Phase 6: Creating Attribution Events...');

    const attributionEvents = [
        {
            id: 'attr-lex-001',
            sourceType: 'DEMO',
            sourceId: null,
            campaign: 'demo_internal',
            partnerCode: null,
            medium: 'direct',
            revenueAmount: 0,
            timestamp: T0
        },
        {
            id: 'attr-lex-002',
            sourceType: 'PROMO_CODE',
            sourceId: IDS.PROMO_PARTNER,
            campaign: 'LEGOPARTNER',
            partnerCode: 'lexpartners',
            medium: 'promo',
            revenueAmount: 1000,
            timestamp: T1
        },
        {
            id: 'attr-lex-003',
            sourceType: 'INVITATION',
            sourceId: IDS.INVITE_MARTA,
            campaign: 'partner_referral',
            partnerCode: 'lexpartners',
            medium: 'referral',
            revenueAmount: 500,
            timestamp: T2
        }
    ];

    for (const attr of attributionEvents) {
        await dbRun(`
            INSERT INTO attribution_events (
                id, organization_id, user_id, source_type, source_id,
                campaign, partner_code, medium, metadata,
                revenue_amount, currency, partner_id, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            attr.id,
            IDS.ORG,
            IDS.USER_ADMIN,
            attr.sourceType,
            attr.sourceId,
            attr.campaign,
            attr.partnerCode,
            attr.medium,
            JSON.stringify({ seeded: true }),
            attr.revenueAmount,
            'USD',
            (attr.sourceType === 'PROMO_CODE' || attr.sourceType === 'INVITATION') ? IDS.PARTNER : null,
            attr.timestamp.toISOString()
        ]);
        console.log(`   ✓ Attribution: ${attr.sourceType} (revenue: $${attr.revenueAmount})`);
    }
}

// ==========================================
// PHASE 7: INVITATIONS
// ==========================================

async function seedInvitations() {
    console.log('\n✉️ Phase 7: Creating Invitations...');

    const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

    const invitations = [
        {
            id: IDS.INVITE_PIOTR,
            email: 'piotr@legolex.com',
            status: 'accepted',
            role: 'USER',
            n: 1
        },
        {
            id: IDS.INVITE_MARTA,
            email: 'marta@legolex.com',
            status: 'accepted',
            role: 'USER',
            n: 2
        },
        {
            id: IDS.INVITE_REVOKED,
            email: 'ghost@legolex.com',
            status: 'revoked',
            role: 'USER',
            n: 3
        }
    ];

    const expiresAt = new Date(NOW);
    expiresAt.setDate(expiresAt.getDate() + 7);

    for (const inv of invitations) {
        const tokenSource = `legolex-invite-${inv.n}`;
        const tokenHash = hashToken(tokenSource);

        await dbRun(`
            INSERT INTO invitations (
                id, organization_id, project_id, invitation_type,
                email, role, invited_by,
                token, token_hash, status, expires_at, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            inv.id,
            IDS.ORG,
            null,
            'ORG',
            inv.email,
            inv.role,
            IDS.USER_ADMIN,
            tokenSource,
            tokenHash,
            inv.status,
            expiresAt.toISOString(),
            T1.toISOString()
        ]);
        console.log(`   ✓ Invitation: ${inv.email} (${inv.status})`);

        // Log invitation events
        await dbRun(`
            INSERT INTO invitation_events (
                id, invitation_id, event_type, performed_by_user_id, created_at
            ) VALUES (?, ?, ?, ?, ?)
        `, [uuidv4(), inv.id, 'SENT', IDS.USER_ADMIN, T1.toISOString()]);

        if (inv.status === 'accepted') {
            await dbRun(`
                INSERT INTO invitation_events (
                    id, invitation_id, event_type, performed_by_user_id, created_at
                ) VALUES (?, ?, ?, ?, ?)
            `, [uuidv4(), inv.id, 'ACCEPTED', null, T2.toISOString()]);
        }

        if (inv.status === 'revoked') {
            await dbRun(`
                INSERT INTO invitation_events (
                    id, invitation_id, event_type, performed_by_user_id, created_at
                ) VALUES (?, ?, ?, ?, ?)
            `, [uuidv4(), inv.id, 'REVOKED', IDS.USER_ADMIN, T2.toISOString()]);
        }
    }
}

// ==========================================
// PHASE 8: SETTLEMENT PERIOD
// ==========================================

async function seedSettlements() {
    console.log('\n💰 Phase 8: Creating Settlements...');

    const periodStart = '2025-01-01T00:00:00Z';
    const periodEnd = '2025-01-31T23:59:59Z';
    const totalRevenue = 1500; // $1000 + $500 from attribution
    const settlementAmount = totalRevenue * 0.15; // 15% = $225

    // Create settlement period
    await dbRun(`
        INSERT INTO settlement_periods(
                    id, period_start, period_end, status,
                    calculated_at, calculated_by, locked_at, locked_by,
                    total_revenue, total_settlements, partner_count, created_at
                ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
        IDS.SETTLEMENT_PERIOD,
        periodStart,
        periodEnd,
        'LOCKED',
        T3.toISOString(),
        IDS.USER_SUPERADMIN,
        NOW.toISOString(),
        IDS.USER_SUPERADMIN,
        totalRevenue,
        settlementAmount,
        1,
        T3.toISOString()
    ]);
    console.log('   ✓ Settlement Period: January 2025 (LOCKED)');

    // Get attribution event IDs for settlement linking
    const attributions = await dbAll(`
        SELECT id, revenue_amount FROM attribution_events 
        WHERE organization_id = ? AND revenue_amount > 0
                `, [IDS.ORG]);

    // Create settlement entries for each attribution with revenue
    for (const attr of attributions) {
        await dbRun(`
            INSERT INTO partner_settlements(
                    id, settlement_period_id, partner_id, organization_id,
                    source_attribution_id, revenue_amount, revenue_share_percent,
                    settlement_amount, currency, agreement_id, metadata,
                    entry_type, adjusts_settlement_id, adjustment_reason, created_at
                ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
            uuidv4(),
            IDS.SETTLEMENT_PERIOD,
            IDS.PARTNER,
            IDS.ORG,
            attr.id,
            attr.revenue_amount,
            15,
            attr.revenue_amount * 0.15,
            'USD',
            IDS.PARTNER_AGREEMENT,
            JSON.stringify({ calculated: true }),
            'NORMAL',
            null,
            null,
            T3.toISOString()
        ]);
        console.log(`   ✓ Settlement Entry: $${attr.revenue_amount} → $${(attr.revenue_amount * 0.15).toFixed(2)} to LexPartners`);
    }
}

// ==========================================
// PHASE 9: HELP EVENTS
// ==========================================

async function seedHelpEvents() {
    console.log('\n📚 Phase 9: Creating Help Events...');

    const tableExists = await dbGet(`
        SELECT name FROM sqlite_master 
        WHERE type = 'table' AND name = 'help_events'
    `);

    if (!tableExists) {
        console.log('   ⚠️ help_events table does not exist - skipping');
        return;
    }

    const scenarios = [
        { user: IDS.USER_ANNA, pb: 'invite_team', status: 'COMPLETED', time: T1 },
        { user: IDS.USER_ANNA, pb: 'billing_overview', status: 'VIEWED', time: T3 },
        { user: IDS.USER_PIOTR, pb: 'use_ai_features', status: 'STARTED', time: T2 },
        { user: IDS.USER_PIOTR, pb: 'first_value_checklist', status: 'STARTED', time: T1 },
        { user: IDS.USER_PIOTR, pb: 'demo_mode_explained', status: 'STARTED', time: T1 },
        { user: IDS.USER_PIOTR, pb: 'manage_users', status: 'STARTED', time: T2 },
        { user: IDS.USER_JULIA, pb: 'trial_days_remaining', status: 'STARTED', time: T2 },
        { user: IDS.USER_JULIA, pb: 'start_trial_from_demo', status: 'STARTED', time: T2 },
        { user: IDS.USER_TOMASZ, pb: 'partner_attribution_explained', status: 'STARTED', time: T1 }
    ];

    let eventCount = 0;
    for (const scenario of scenarios) {
        eventCount++;
        const eventId = `help-lex-${String(eventCount).padStart(3, '0')}`;

        await dbRun(`
            INSERT INTO help_events (
                id, user_id, organization_id, playbook_key,
                event_type, context, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
            eventId,
            scenario.user,
            IDS.ORG,
            scenario.pb,
            scenario.status,
            JSON.stringify({ route: '/dashboard', scenario: true }),
            scenario.time.toISOString()
        ]);

        if (scenario.status === 'COMPLETED') {
            eventCount++;
            const startEventId = `help-lex-${String(eventCount).padStart(3, '0')}`;
            const startedAt = new Date(scenario.time);
            startedAt.setMinutes(startedAt.getMinutes() - 10);

            await dbRun(`
                INSERT INTO help_events (
                    id, user_id, organization_id, playbook_key,
                    event_type, context, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
                startEventId,
                scenario.user,
                IDS.ORG,
                scenario.pb,
                'STARTED',
                JSON.stringify({ route: '/dashboard', auto_started: true }),
                startedAt.toISOString()
            ]);
        }

        console.log(`   ✓ Help Event: ${scenario.user.split('-').pop()} -> ${scenario.pb} (${scenario.status})`);
    }
}

async function seedMetricsEvents() {
    console.log('\n📊 Phase 11: Creating Metrics Events (Step 7 Support)...');

    // Check if metrics_events table exists
    const tableExists = await dbGet(`
        SELECT name FROM sqlite_master 
        WHERE type = 'table' AND name = 'metrics_events'
    `);

    if (!tableExists) {
        console.log('   ⚠️ metrics_events table does not exist - skipping');
        return;
    }

    const eventBuckets = [
        { type: 'INVITE_SENT', count: 7, user: IDS.USER_ANNA },
        { type: 'INVITE_ACCEPTED', count: 5, user: null },
        { type: 'HELP_STARTED', count: 12, user: IDS.USER_PIOTR },
        { type: 'TASK_COMPLETED', count: 15, user: IDS.USER_KAMIL },
        { type: 'INITIATIVE_BLOCKED', count: 1, user: IDS.USER_ANNA },
        // Risk signals for Julia (Low activity)
        { type: 'LOGIN', count: 1, user: IDS.USER_JULIA },
        { type: 'HELP_VIEWED', count: 1, user: IDS.USER_JULIA }
    ];

    let totalMetrics = 0;
    for (const bucket of eventBuckets) {
        for (let i = 0; i < bucket.count; i++) {
            totalMetrics++;
            const metricId = `metrics-lex-${String(totalMetrics).padStart(3, '0')}`;
            const eventTime = new Date(T1.getTime() + (i * 3600000)); // Spread by hour

            await dbRun(`
                INSERT INTO metrics_events (
                    id, event_type, user_id, organization_id, source, context, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
                metricId,
                bucket.type,
                bucket.user,
                IDS.ORG,
                'DEMO_SEED',
                JSON.stringify({ bucket_index: i, enterprise: true }),
                eventTime.toISOString()
            ]);
        }
        console.log(`   ✓ Metrics: ${bucket.type} (x${bucket.count})`);
    }
}

// ==========================================
// PHASE 10: PROJECT & SAMPLE DATA
// ==========================================

async function seedProjectAndData() {
    console.log('\n📁 Phase 10: Creating Projects, Initiatives & Tasks...');

    // 1. Projects
    const projects = [
        { id: IDS.PROJ_CORE, name: 'Legolex Legal Platform 2025', owner: IDS.USER_ANNA },
        { id: IDS.PROJ_PORTAL, name: 'Client Self-Service Portal', owner: IDS.USER_ANNA },
        { id: IDS.PROJ_AI, name: 'AI Contract Review Pilot', owner: IDS.USER_PIOTR }
    ];

    for (const proj of projects) {
        await dbRun(`
            INSERT INTO projects(id, organization_id, name, status, owner_id, created_at)
        VALUES(?, ?, ?, ?, ?, ?)
        `, [proj.id, IDS.ORG, proj.name, 'active', proj.owner, T1.toISOString()]);
        console.log(`   ✓ Project: ${proj.name} `);
    }

    // 2. Initiatives (Realistic Portfolio)
    const initiatives = [
        { id: IDS.INIT_001, proj: IDS.PROJ_CORE, name: 'AI Contract Automation', axis: 'technology', status: 'step4_pilot', value: 'High', owner: IDS.USER_PIOTR },
        { id: IDS.INIT_002, proj: IDS.PROJ_CORE, name: 'GDPR Compliance Update', axis: 'governance', status: 'step5_full', value: 'Critical', owner: IDS.USER_ANNA },
        { id: IDS.INIT_003, proj: IDS.PROJ_CORE, name: 'Workflow Automation', axis: 'processes', status: 'step4_pilot', value: 'High', owner: IDS.USER_KAMIL },
        { id: IDS.INIT_004, proj: IDS.PROJ_CORE, name: 'Reporting Dashboard', axis: 'customer', status: 'step3_list', value: 'Medium', owner: IDS.USER_MARTA },
        { id: IDS.INIT_005, proj: IDS.PROJ_CORE, name: 'Security Hardening', axis: 'governance', status: 'step4_pilot', value: 'Critical', owner: IDS.USER_ANNA },
        { id: IDS.INIT_006, proj: IDS.PROJ_CORE, name: 'Cloud Migration', axis: 'technology', status: 'step4_pilot', value: 'High', owner: IDS.USER_KAMIL },

        { id: IDS.INIT_007, proj: IDS.PROJ_PORTAL, name: 'Client Portal MVP', axis: 'customer', status: 'step5_full', value: 'High', owner: IDS.USER_MARTA },
        { id: IDS.INIT_008, proj: IDS.PROJ_PORTAL, name: 'User Onboarding Redesign', axis: 'customer', status: 'step3_list', value: 'Medium', owner: IDS.USER_JULIA },

        { id: IDS.INIT_009, proj: IDS.PROJ_CORE, name: 'Partner Integration', axis: 'technology', status: 'step3_list', value: 'High', owner: IDS.USER_KAMIL },
        { id: IDS.INIT_010, proj: IDS.PROJ_AI, name: 'AI Review Pilot', axis: 'technology', status: 'step4_pilot', value: 'High', owner: IDS.USER_PIOTR }
    ];

    for (const init of initiatives) {
        // Link Partner Integration (INIT_009) specifically to BLOCKED state for simulation
        const isPartnerInit = init.id === IDS.INIT_009;
        const status = isPartnerInit ? 'BLOCKED' : init.status;
        const blockedReason = isPartnerInit ? 'Legal review pending' : null;

        await dbRun(`
            INSERT INTO initiatives (
                id, organization_id, project_id, name, axis,
                status, business_value, owner_business_id, blocked_reason, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [init.id, IDS.ORG, init.proj, init.name, init.axis, status, init.value, init.owner, blockedReason, T2.toISOString()]);
        console.log(`   ✓ Initiative: ${init.name} (${status === 'BLOCKED' ? 'BLOCKED' : 'ACTIVE'})`);
    }

    // 3. Tasks (Precisely 43 tasks as requested)
    console.log('   🛠 Seeding 43 tasks with varied statuses...');

    const taskSchemas = [
        { name: 'Analyze current contracts', status: 'done', type: 'technical' },
        { name: 'Define AI rules', status: 'in_progress', type: 'business' },
        { name: 'Integrate model API', status: 'blocked', type: 'technical' },
        { name: 'Legal validation', status: 'todo', type: 'legal' },
        { name: 'Pilot with 3 clients', status: 'todo', type: 'business' }
    ];

    let taskCount = 0;
    for (let idx = 0; idx < initiatives.length; idx++) {
        const init = initiatives[idx];
        // Distribution: 7 initiatives * 4 tasks = 28; 3 initiatives * 5 tasks = 15. Total = 43.
        const numTasks = idx < 7 ? 4 : 5;

        for (let i = 0; i < numTasks; i++) {
            taskCount++;
            const taskId = `task-lex-${String(taskCount).padStart(3, '0')}`;
            const schema = taskSchemas[i % taskSchemas.length];
            const userId = (idx === 8 && i % 2 === 0) ? IDS.USER_JULIA : (i % 2 === 0 ? init.owner : IDS.USER_PIOTR);

            // Trigger USER_AT_RISK for Julia: set her tasks to 'todo'
            let status = schema.status;
            if (userId === IDS.USER_JULIA) {
                status = 'todo';
            }

            await dbRun(`
                INSERT INTO tasks (
                    id, organization_id, project_id, initiative_id,
                    title, status, priority, assignee_id, task_type, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                taskId,
                IDS.ORG,
                init.proj,
                init.id,
                `${schema.name} (${init.name})`,
                status,
                i === 0 ? 'high' : 'medium',
                userId,
                schema.type,
                T2.toISOString()
            ]);
        }
    }
    console.log(`   ✓ Seeded ${taskCount} tasks across ${initiatives.length} initiatives.`);
}

// ==========================================
// VERIFICATION
// ==========================================

async function verify() {
    console.log('\n🔍 Verifying Legolex Data...\n');

    const checks = [];

    // Organization
    const org = await dbGet(`SELECT * FROM organizations WHERE id = ? `, [IDS.ORG]);
    checks.push({
        name: 'Organization',
        passed: !!org,
        details: org ? `${org.name} (${org.organization_type})` : 'NOT FOUND'
    });

    // Users
    const userCount = await dbGet(`SELECT COUNT(*) as count FROM users WHERE organization_id = ? `, [IDS.ORG]);
    const roles = await dbAll(`SELECT role, COUNT(*) as count FROM users WHERE organization_id = ? GROUP BY role`, [IDS.ORG]);
    checks.push({
        name: 'Users',
        passed: userCount.count === 7,
        details: `${userCount.count} total(${roles.map(r => `${r.role}: ${r.count}`).join(', ')})`
    });

    // Projects
    const projectCount = await dbGet(`SELECT COUNT(*) as count FROM projects WHERE organization_id = ? `, [IDS.ORG]);
    checks.push({
        name: 'Projects',
        passed: projectCount.count >= 3,
        details: `${projectCount.count} (Core, Portal, AI Pilot)`
    });

    // Initiatives
    const initCount = await dbGet(`SELECT COUNT(*) as count FROM initiatives WHERE organization_id = ? `, [IDS.ORG]);
    checks.push({
        name: 'Initiatives',
        passed: initCount.count >= 10,
        details: `${initCount.count} (Realistic Portfolio)`
    });

    // Tasks
    const taskCount = await dbGet(`SELECT COUNT(*) as count FROM tasks WHERE organization_id = ? `, [IDS.ORG]);
    const taskStats = await dbAll(`SELECT status, COUNT(*) as count FROM tasks WHERE organization_id = ? GROUP BY status`, [IDS.ORG]);
    checks.push({
        name: 'Tasks',
        passed: taskCount.count === 43,
        details: `${taskCount.count} total(${taskStats.map(s => `${s.status}: ${s.count}`).join(', ')})`
    });

    // Partner
    const partner = await dbGet(`SELECT * FROM partners WHERE id = ? `, [IDS.PARTNER]);
    checks.push({
        name: 'Partner',
        passed: !!partner,
        details: partner ? `${partner.name} (${partner.partner_type}, ${partner.default_revenue_share_percent}%)` : 'NOT FOUND'
    });

    // Promo Codes
    const promoCodes = await dbAll(`SELECT code FROM promo_codes WHERE id IN(?, ?)`, [IDS.PROMO_DEMO, IDS.PROMO_PARTNER]);
    checks.push({
        name: 'Promo Codes',
        passed: promoCodes.length >= 2,
        details: promoCodes.map(p => p.code).join(', ') || 'NONE'
    });

    // Attribution Events
    const attributions = await dbAll(`SELECT source_type FROM attribution_events WHERE organization_id = ? `, [IDS.ORG]);
    checks.push({
        name: 'Attribution Events',
        passed: attributions.length >= 3,
        details: `${attributions.length} (${[...new Set(attributions.map(a => a.source_type))].join(', ')})`
    });

    // Organization Events (lifecycle)
    const orgEvents = await dbAll(`SELECT event_type FROM organization_events WHERE organization_id = ? `, [IDS.ORG]);
    checks.push({
        name: 'Lifecycle Events',
        passed: orgEvents.length >= 4,
        details: `${orgEvents.length} (${orgEvents.map(e => e.event_type).join(', ')})`
    });

    // Settlement Period
    const settlement = await dbGet(`SELECT * FROM settlement_periods WHERE id = ? `, [IDS.SETTLEMENT_PERIOD]);
    checks.push({
        name: 'Settlement Period',
        passed: settlement && settlement.status === 'LOCKED',
        details: settlement ? `${settlement.status} (Revenue: $${settlement.total_revenue}, Payout: $${settlement.total_settlements})` : 'NOT FOUND'
    });

    // Partner Settlements
    const settlements = await dbAll(`SELECT SUM(settlement_amount) as total FROM partner_settlements WHERE settlement_period_id = ? `, [IDS.SETTLEMENT_PERIOD]);
    checks.push({
        name: 'Partner Settlements',
        passed: settlements[0]?.total > 0,
        details: `$${settlements[0]?.total || 0} `
    });

    // Help Events
    const helpTableExists = await dbGet(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'help_events'`);
    if (helpTableExists) {
        const helpEvents = await dbAll(`SELECT event_type, COUNT(*) as count FROM help_events WHERE organization_id = ? GROUP BY event_type`, [IDS.ORG]);
        checks.push({
            name: 'Help Events',
            passed: helpEvents.length > 0,
            details: `${helpEvents.map(e => `${e.event_type}: ${e.count}`).join(', ')} `
        });
    } else {
        checks.push({ name: 'Help Events', passed: false, details: 'Table not created' });
    }

    // Metrics Events
    const metricsTableExists = await dbGet(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'metrics_events'`);
    if (metricsTableExists) {
        const metricEvents = await dbAll(`SELECT event_type, COUNT(*) as count FROM metrics_events WHERE organization_id = ? GROUP BY event_type`, [IDS.ORG]);
        checks.push({
            name: 'Metrics (Step 7)',
            passed: metricEvents.length > 0,
            details: `${metricEvents.map(m => `${m.event_type}: ${m.count}`).join(', ')} `
        });
    } else {
        checks.push({ name: 'Metrics (Step 7)', passed: false, details: 'Table not created' });
    }

    // Print results
    let allPassed = true;
    for (const check of checks) {
        const icon = check.passed ? '✓' : '✗';
        const color = check.passed ? '\x1b[32m' : '\x1b[31m';
        console.log(`${color}${icon} \x1b[0m ${check.name}: ${check.details} `);
        if (!check.passed && check.name !== 'Help Events' && check.name !== 'Metrics (Step 7)') allPassed = false;
    }

    console.log('\n' + (allPassed ? '✅ Core checks passed!' : '❌ Some core checks failed'));
    return allPassed;
}

// ==========================================
// MAIN
// ==========================================

async function main() {
    const args = process.argv.slice(2);
    const shouldClean = args.includes('--clean');
    const verifyOnly = args.includes('--verify');

    console.log('═══════════════════════════════════════════════════');
    console.log('  LEGOLEX TEST ORGANIZATION SEED SCRIPT v2');
    console.log('═══════════════════════════════════════════════════');

    try {
        if (verifyOnly) {
            const passed = await verify();
            process.exit(passed ? 0 : 1);
        }

        if (shouldClean) {
            await cleanupLegolex();
        }

        // Pre-flight schema check
        await ensureSchema();

        // Seed in order
        await seedOrganization();
        await seedUsers();
        await seedOrganizationLimits();
        await seedOrganizationEvents();
        await seedPartnerAndPromoCodes();
        await seedAttributionEvents();
        await seedInvitations();
        await seedSettlements();
        await seedHelpEvents();
        await seedProjectAndData();      // Phase 10
        await seedMetricsEvents();       // Phase 11

        console.log('\n✅ SEEDING COMPLETED SUCCESSFULLY');
        await verify();

        console.log('\n═══════════════════════════════════════════════════');
        console.log('  🎉 LEGOLEX v2 SEED COMPLETE (ENTERPRISE MODE)');
        console.log('═══════════════════════════════════════════════════');
        console.log('\nLogin credentials:');
        console.log('  Anna (ADMIN):     anna@legolex.com / 123456');
        console.log('  Piotr (USER):    piotr@legolex.com / 123456');
        console.log('  Marta (USER):    marta@legolex.com / 123456');
        console.log('  Kamil (USER):    kamil@legolex.com / 123456');
        console.log('  Julia (RISK):    julia@legolex.com / 123456');
        console.log('  Tomasz (PARTNER): tomasz@legolex.com / 123456');
        console.log('  SuperAdmin:      super@legolex.com / 123456');
        console.log('\nUsage: node server/scripts/seedLegolexDemoOrg.js [--clean] [--verify]');

        db.close();
        process.exit(0);

    } catch (err) {
        console.error('\n❌ Error:', err.message);
        console.error(err.stack);
        db.close();
        process.exit(1);
    }
}

main();
