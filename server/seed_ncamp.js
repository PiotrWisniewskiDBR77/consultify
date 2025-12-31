const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

const dbPath = path.resolve(__dirname, 'consultify.db');
const db = new sqlite3.Database(dbPath);

const ORG_ID = uuidv4();
const USER_ID = uuidv4();
const USER_2_ID = uuidv4();
const PROJECT_ID = uuidv4();
const BRANDING_ID = uuidv4();

// Branding Constants
const BRANDING = {
    primary_color: '#1CD7C5', // Teal/Cyan
    secondary_color: '#121127', // Dark Navy
    accent_color: '#413258', // Purple
    background_color: '#F9F9FB', // Off-white
    text_color: '#121127', // Dark Navy for text
    logo_light_url: 'https://www.mim.gov.sa/images/Logo.png',
    logo_dark_url: 'https://www.mim.gov.sa/images/Logo.png', // Using same for now
    font_family: 'Inter' // Websites used standard sans-serifs
};

// Mock Session Data (similar to Saudi demo but tailored)
const MOCK_SESSION_DATA = {
    steps: {
        step1Completed: true,
        step2Completed: true,
        step3Completed: true,
        step4Completed: false,
        step5Completed: false
    },
    assessment: {
        completedAxes: ["processes", "digitalProducts", "businessModels", "dataManagement", "culture", "aiMaturity"],
        processes: { answers: [7, 6, 7], score: 6.7, status: "COMPLETED" }, // High process maturity
        digitalProducts: { answers: [5, 5, 6], score: 5.3, status: "COMPLETED" },
        businessModels: { answers: [6, 7, 7], score: 6.7, status: "COMPLETED" },
        dataManagement: { answers: [3, 4, 3], score: 3.3, status: "COMPLETED" }, // Needs work
        culture: { answers: [6, 5, 6], score: 5.7, status: "COMPLETED" },
        aiMaturity: { answers: [4, 3, 5], score: 4.0, status: "COMPLETED" }
    },
    initiatives: [
        { id: "1", name: "National Industry 4.0 Data Hub", axis: "dataManagement", priority: "High", complexity: "High", status: "Ready", quarter: "Q1 2025" },
        { id: "2", name: "Smart Factory Pilot Program", axis: "aiMaturity", priority: "High", complexity: "Medium", status: "Draft", quarter: "Q2 2025" },
        { id: "3", name: "Workforce Digital Upskilling", axis: "culture", priority: "Medium", complexity: "Low", status: "Draft", quarter: "Q2 2025" }
    ],
    economics: {
        totalCost: 2500,
        totalAnnualBenefit: 8500,
        overallROI: 340,
        paybackPeriodYears: 0.3
    }
};

console.log("Seeding NCAMP (National Center for Advanced Manufacturing) Data...");

db.serialize(() => {
    // 1. Create Organization
    const orgName = 'National Center for Advanced Manufacturing';
    db.run(`INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)`,
        [ORG_ID, orgName, 'enterprise', 'active'],
        (err) => {
            if (err) console.error("Org Creation Error:", err.message);
            else console.log(`Organization created: ${orgName}`);
        }
    );

    // 2. Create Users
    const password = bcrypt.hashSync('Saudi2030!', 8);

    // Admin
    db.run(`INSERT INTO users (id, organization_id, email, password, first_name, last_name, role) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [USER_ID, ORG_ID, 'ncamp_admin@mim.gov.sa', password, 'Faisal', 'Al-Saud', 'ADMIN'],
        (err) => {
            if (err) console.error("Admin User Error:", err.message);
            else console.log("Admin user created: ncamp_admin@mim.gov.sa");
        }
    );

    // Regular User
    db.run(`INSERT INTO users (id, organization_id, email, password, first_name, last_name, role) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [USER_2_ID, ORG_ID, 'ncamp_user@mim.gov.sa', password, 'Sara', 'Ahmed', 'USER'],
        (err) => {
            if (err) console.error("Regular User Error:", err.message);
            else console.log("Regular user created: ncamp_user@mim.gov.sa");
        }
    );

    // 3. Create Project
    const projectName = 'Factory 4.0 Maturity Assessment';
    db.run(`INSERT INTO projects (id, organization_id, name, status, owner_id) VALUES (?, ?, ?, ?, ?)`,
        [PROJECT_ID, ORG_ID, projectName, 'active', USER_ID],
        (err) => {
            if (err) console.error("Project Error:", err.message);
            else console.log(`Project created: ${projectName}`);
        }
    );

    // 4. Create Session Data
    db.run(`INSERT INTO sessions (user_id, type, data, project_id) VALUES (?, ?, ?, ?)`,
        [USER_ID, 'full', JSON.stringify(MOCK_SESSION_DATA), PROJECT_ID],
        (err) => {
            if (err) console.error("Session Error:", err.message);
            else console.log("Session data seeded.");
        }
    );

    // 5. Insert Branding
    // Ensure table exists first (in case migration didn't run)
    db.run(`CREATE TABLE IF NOT EXISTS organization_branding (
        id TEXT PRIMARY KEY,
        organization_id TEXT UNIQUE NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        logo_light_url TEXT,
        logo_dark_url TEXT,
        logo_icon_url TEXT,
        favicon_url TEXT,
        primary_color TEXT DEFAULT '#8B5CF6',
        secondary_color TEXT DEFAULT '#3B82F6',
        accent_color TEXT DEFAULT '#10B981',
        background_color TEXT DEFAULT '#F8FAFC',
        text_color TEXT DEFAULT '#1E293B',
        dark_primary_color TEXT DEFAULT '#A78BFA',
        dark_secondary_color TEXT DEFAULT '#60A5FA',
        dark_background_color TEXT DEFAULT '#0F172A',
        dark_text_color TEXT DEFAULT '#F8FAFC',
        font_family TEXT DEFAULT 'Inter',
        heading_font_family TEXT DEFAULT 'Inter',
        font_size_base TEXT DEFAULT '14px',
        custom_css TEXT,
        login_background_url TEXT,
        login_background_color TEXT,
        login_tagline TEXT,
        login_welcome_message TEXT,
        email_header_html TEXT,
        email_footer_html TEXT,
        email_primary_color TEXT,
        email_logo_url TEXT,
        custom_domain TEXT,
        custom_domain_verified INTEGER DEFAULT 0,
        custom_domain_ssl_status TEXT DEFAULT 'pending',
        custom_domain_verified_at TEXT,
        hide_powered_by INTEGER DEFAULT 0,
        custom_support_email TEXT,
        custom_support_url TEXT,
        custom_terms_url TEXT,
        custom_privacy_url TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        created_by TEXT REFERENCES users(id)
    )`, (err) => {
        if (err) {
            console.error("Create Table Error:", err.message);
            return;
        }

        const insertBrandingQuery = `
            INSERT INTO organization_branding (
                id, organization_id, 
                primary_color, secondary_color, accent_color, background_color, text_color,
                logo_light_url, logo_dark_url, font_family
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        db.run(insertBrandingQuery, [
            BRANDING_ID, ORG_ID,
            BRANDING.primary_color, BRANDING.secondary_color, BRANDING.accent_color,
            BRANDING.background_color, BRANDING.text_color,
            BRANDING.logo_light_url, BRANDING.logo_dark_url, BRANDING.font_family
        ], (err) => {
            if (err) console.error("Branding Error:", err.message);
            else console.log("Branding configuration applied.");
        });
    });

});

// Close DB
setTimeout(() => {
    db.close();
    console.log("NCAMP Seeding Complete.");
}, 1000);
