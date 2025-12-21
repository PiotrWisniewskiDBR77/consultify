const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.resolve(__dirname, 'consultify.db');
const db = new sqlite3.Database(dbPath);

const hashedPassword = bcrypt.hashSync('123456', 8);

const superAdminOrgId = 'org-dbr77-system';
const dbr77OrgId = 'org-dbr77-test';

const adminId = 'admin-001';
const piotrId = 'user-dbr77-admin';
const justynaId = 'user-dbr77-user';

console.log("Restoring DBR77 Users...");

db.serialize(() => {
    // 1. Ensure Organizations exist
    const insertOrg = db.prepare(`INSERT OR IGNORE INTO organizations(id, name, plan, status) VALUES(?, ?, ?, ?)`);
    insertOrg.run(superAdminOrgId, 'DBR77 System', 'enterprise', 'active');
    insertOrg.run(dbr77OrgId, 'DBR77', 'pro', 'active');
    insertOrg.finalize();

    // 2. Clear existing DBR77 users to reset them correctly
    // We use REPLACE OR IGNORE but let's be explicit and update passwords if they exist
    const upsertUser = (id, orgId, email, firstName, lastName, role) => {
        db.run(`
            INSERT INTO users (id, organization_id, email, password, first_name, last_name, role, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
            ON CONFLICT(email) DO UPDATE SET
                password = excluded.password,
                first_name = excluded.first_name,
                last_name = excluded.last_name,
                role = excluded.role,
                status = 'active'
        `, [id, orgId, email, hashedPassword, firstName, lastName, role], (err) => {
            if (err) console.error(`Error restoring ${email}:`, err.message);
            else console.log(`Restored/Updated user: ${email}`);
        });
    };

    upsertUser(adminId, superAdminOrgId, 'admin@dbr77.com', 'Super', 'Admin', 'SUPERADMIN');
    upsertUser(piotrId, dbr77OrgId, 'piotr.wisniewski@dbr77.com', 'Piotr', 'Wiśniewski', 'ADMIN');
    upsertUser(justynaId, dbr77OrgId, 'justyna.laskowska@dbr77.com', 'Justyna', 'Laskowska', 'USER');

    // 3. Ensure default project exists for Piotr
    const dbr77ProjectId = 'project-dbr77-001';
    db.run(`
        INSERT OR IGNORE INTO projects(id, organization_id, name, status, owner_id)
        VALUES(?, ?, ?, ?, ?)
    `, [dbr77ProjectId, dbr77OrgId, 'Digital Transformation 2025', 'active', piotrId], (err) => {
        if (!err) console.log("Default project verified.");
    });
});

setTimeout(() => {
    db.close();
    console.log("Restoration complete.");
}, 1000);
